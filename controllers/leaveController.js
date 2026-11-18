const db = require('../config/db');

// 1. Tambah pengajuan cuti baru
exports.createLeave = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { jenis, tanggal_mulai, tanggal_selesai, alasan, keterangan } = req.body;
    
    const finalAlasan = alasan || keterangan || '-';
    const finalJenis = jenis || 'Cuti';
    const startDate = tanggal_mulai || req.body.start_date;
    const endDate = tanggal_selesai || req.body.end_date;

    // Asumsi lu pakai nama kolom ini pas insert sebelumnya dan berhasil
    const sql = `
      INSERT INTO leaves (user_id, jenis, tanggal_mulai, tanggal_selesai, alasan, status) 
      VALUES (?, ?, ?, ?, ?, 'Pending')
    `;
    
    await db.query(sql, [userId, finalJenis, startDate, endDate, finalAlasan]);
    res.status(201).json({ message: 'Pengajuan cuti berhasil dikirim' });
  } catch (err) {
    console.error('🔴 Error createLeave:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// 2. Ambil semua data cuti untuk Web (ANTI ERROR DATABASE)
exports.getLeaves = async (req, res) => {
  try {
    const userId = req.user.id;
    const [userRows] = await db.query('SELECT role, division FROM users WHERE id = ?', [userId]);
    const currentUser = userRows[0] || {};

    // Tarik pakai leaves.* murni, biar SQL gak pusing nyari nama kolom spesifik
    let sql = `
      SELECT leaves.*, 
             users.name as nama_karyawan, 
             users.division, 
             users.nip 
      FROM leaves 
      LEFT JOIN users ON leaves.user_id = users.id
    `;
    let params = [];
    let conditions = [];

    const role = currentUser.role ? currentUser.role.toLowerCase() : '';
    if (role === 'supervisor') {
      const userDivision = currentUser.division ? currentUser.division.trim() : '';
      if (userDivision) {
        conditions.push('LOWER(TRIM(users.division)) = LOWER(?)');
        params.push(userDivision);
      } else {
        conditions.push('1 = 0');
      }
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY leaves.id DESC';

    const [results] = await db.query(sql, params);

    // MAPPING SAPU JAGAT DI JAVASCRIPT (Web & HP mau manggil variabel apa aja pasti dapet)
    const mappedData = results.map(item => ({
      ...item,
      start_date: item.tanggal_mulai || item.start_date || item.tanggal || '-',
      end_date: item.tanggal_selesai || item.end_date || item.tanggal || '-',
      reason: item.alasan || item.reason || item.keterangan || '-',
      // Buat jaga-jaga kalau frontend butuhnya versi bahasa indonesia
      tanggal_mulai: item.tanggal_mulai || item.start_date || item.tanggal || '-',
      tanggal_selesai: item.tanggal_selesai || item.end_date || item.tanggal || '-',
      alasan: item.alasan || item.reason || item.keterangan || '-'
    }));

    res.json({ data: mappedData });
  } catch (err) {
    console.error('🔴 Error getLeaves:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// 3. Ambil riwayat cuti HP (ANTI ERROR DATABASE)
exports.getMyLeaves = async (req, res) => {
  try {
    const userId = req.user.id;
    const sql = `SELECT * FROM leaves WHERE user_id = ? ORDER BY id DESC`;
    const [results] = await db.query(sql, [userId]);

    // MAPPING SAPU JAGAT DI JAVASCRIPT
    const mappedData = results.map(item => ({
      ...item,
      start_date: item.tanggal_mulai || item.start_date || item.tanggal || '-',
      end_date: item.tanggal_selesai || item.end_date || item.tanggal || '-',
      reason: item.alasan || item.reason || item.keterangan || '-',
      tanggal_mulai: item.tanggal_mulai || item.start_date || item.tanggal || '-',
      tanggal_selesai: item.tanggal_selesai || item.end_date || item.tanggal || '-',
      alasan: item.alasan || item.reason || item.keterangan || '-'
    }));

    res.json({ data: mappedData });
  } catch (err) {
    console.error('🔴 Error getMyLeaves:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// 4. Update status cuti 
exports.updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await db.query('UPDATE leaves SET status = ? WHERE id = ?', [status, id]);
    res.json({ message: 'Status cuti berhasil diperbarui' });
  } catch (err) {
    console.error('🔴 Error updateLeaveStatus:', err.message);
    res.status(500).json({ error: err.message });
  }
};