const db = require('../config/db');
// PSI-355: zkteco_logs sink (company attendance DB on 201)
const {
    ZK_TYPE_CHECK_OUT,
    legacyWritesEnabled,
    writeZktecoEvent,
} = require('../utils/zkteco');
// IMPORT GEOFENCE BIAR STATUSNYA OTOMATIS
const { cekGeofence } = require('../utils/geofence'); 

exports.getAttendances = async (req, res) => {
  try {
    const userId = req.user.id;
    const [userRows] = await db.query('SELECT role, division FROM users WHERE id = ?', [userId]);
    const currentUser = userRows[0] || {};

    let sql = `
      SELECT attendances.*, users.name, users.nip, users.division 
      FROM attendances 
      JOIN users ON attendances.user_id = users.id
    `;
    let params = [];
    let conditions = [];

    if (currentUser.role && currentUser.role.toLowerCase() === 'supervisor') {
      const userDivision = currentUser.division ? currentUser.division.trim() : '';
      if (userDivision) {
        conditions.push('LOWER(TRIM(users.division)) = LOWER(?)');
        params.push(userDivision);
      } else {
        conditions.push('1 = 0');
      }
    }

    const filterDate = req.query.tanggal || req.query.date;
    if (filterDate && filterDate !== 'undefined' && filterDate !== 'null' && filterDate !== '') {
      conditions.push('DATE(attendances.clock_in_time) = ?');
      params.push(filterDate);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY attendances.id DESC';

    const [results] = await db.query(sql, params);
    res.json({ data: results });
  } catch (err) {
    console.error('Error getAttendances:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.clockIn = async (req, res) => {
  try {
    const userId = req.user.id;
    // SAPU JAGAT: Nangkep 'lat' atau 'latitude'
    const lat = req.body.lat || req.body.latitude || null;
    const lng = req.body.lng || req.body.longitude || null;
    const selfiePath = req.file ? req.file.path : (req.body.selfie || null);

    const [existing] = await db.query(
      'SELECT * FROM attendances WHERE user_id = ? AND DATE(clock_in_time) = CURDATE()',
      [userId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: 'Kamu sudah absen masuk hari ini.' });
    }

    let statusKehadiran = 'Hadir (Dinas Luar)';
    
    // AMBIL SETTINGAN WEB DARI DATABASE
    const [settingRows] = await db.query('SELECT * FROM settings LIMIT 1');
    
    if (settingRows.length > 0) {
      const webSettings = settingRows[0];
      
      // -- LOGIKA 1: GEOFENCE (Di Kantor atau Dinas Luar) --
      if (lat && lng) {
        const officeLat = parseFloat(webSettings.latitude || webSettings.office_lat || webSettings.office_latitude);
        const officeLng = parseFloat(webSettings.longitude || webSettings.office_lng || webSettings.office_longitude);
        const radius = parseFloat(webSettings.radius || webSettings.office_radius || webSettings.radius_meter);

        const userLat = parseFloat(lat);
        const userLng = parseFloat(lng);

        const { cekGeofence } = require('../utils/geofence'); 
        const geoInfo = cekGeofence(userLat, userLng, officeLat, officeLng, radius);

        if (geoInfo.valid) {
          statusKehadiran = 'Hadir (Di Kantor)';
        }
      }

      // -- LOGIKA 2: JAM TERLAMBAT --
      // (Sesuaikan webSettings.jam_masuk kalau nama kolom di db lu beda)
      const batasMasuk = webSettings.jam_masuk || '08:00'; 
      
      // Ambil waktu server saat ini (Format HH:mm)
      const now = new Date();
      const currentHour = now.getHours().toString().padStart(2, '0');
      const currentMin = now.getMinutes().toString().padStart(2, '0');
      const currentTimeStr = `${currentHour}:${currentMin}`;

      // Potong batas masuk jadi 5 digit (misal dari "08:00:00" jadi "08:00")
      const batasMasukStr = batasMasuk.substring(0, 5);

      // Cek kalau absennya lewat dari jam masuk
      if (currentTimeStr > batasMasukStr) {
        statusKehadiran = statusKehadiran.replace('Hadir', 'Terlambat');
      }
    }

    const sql = `
      INSERT INTO attendances (user_id, clock_in_time, clock_in_lat, clock_in_lng, selfie_in, status) 
      VALUES (?, NOW(), ?, ?, ?, ?)
    `;

    // Legacy presensiku@202 write stays behind the flag (default ON)
    // until the zkteco_logs cutover is verified; removal is a follow-up.
    if (legacyWritesEnabled()) {
      await db.query(sql, [userId, lat, lng, selfiePath, statusKehadiran]);
    }

    // PSI-355: mirror the check-in into zkteco_logs (MySQL 201). The nip
    // comes from users (authoritative), not the JWT.
    const [nipRows] = await db.query('SELECT nip FROM users WHERE id = ?', [userId]);
    await writeZktecoEvent({ nip: nipRows.length > 0 ? nipRows[0].nip : null });

    res.status(201).json({ message: `Absen berhasil! Status: ${statusKehadiran}` });
  } catch (err) {
    console.error('Error clock in:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.clockOut = async (req, res) => {
  try {
    const userId = req.user.id;
    // SAPU JAGAT DI CLOCK OUT BIAR AMAN!
    const lat = req.body.lat || req.body.latitude || null;
    const lng = req.body.lng || req.body.longitude || null;

    const [existing] = await db.query(
      'SELECT * FROM attendances WHERE user_id = ? AND DATE(clock_in_time) = CURDATE()',
      [userId]
    );

    if (existing.length === 0) {
      return res.status(400).json({ message: 'Belum melakukan absen masuk hari ini.' });
    }

    if (existing[0].clock_out_time) {
      return res.status(400).json({ message: 'Kamu sudah melakukan absen keluar hari ini.' });
    }

    const sql = `
      UPDATE attendances 
      SET clock_out_time = NOW(), clock_out_lat = ?, clock_out_lng = ? 
      WHERE user_id = ? AND DATE(clock_in_time) = CURDATE()
    `;

    // Legacy presensiku@202 write stays behind the flag (default ON);
    // see clockIn. The check-out row lands as type/state 1 so the
    // psi.hris view keeps a truthful pulang time (PSI-355).
    if (legacyWritesEnabled()) {
      await db.query(sql, [lat, lng, userId]);
    }

    const [nipRows] = await db.query('SELECT nip FROM users WHERE id = ?', [userId]);
    await writeZktecoEvent({ nip: nipRows.length > 0 ? nipRows[0].nip : null, type: ZK_TYPE_CHECK_OUT });

    res.json({ message: 'Absen keluar berhasil dicatat!' });
  } catch (err) {
    console.error('Error clock out:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getHistory = async (req, res) => {
    const userId = req.user.id;
    try {
        const [history] = await db.query(
            'SELECT * FROM attendances WHERE user_id = ? ORDER BY clock_in_time DESC',
            [userId]
        );
        res.status(200).json({
            message: 'Berhasil mengambil riwayat absensi.',
            data    : history,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};