const db = require('../config/db');

exports.clockIn = async (req, res) => {
    const { latitude, longitude, photo_url } = req.body;
    const userId = req.user.id; // Didapet dari middleware Satpam

    try {
        // Cek apakah hari ini udah absen masuk
        const [existing] = await db.query(
            'SELECT * FROM attendances WHERE user_id = ? AND DATE(clock_in_time) = CURDATE()',
            [userId]
        );

        if (existing.length > 0) {
            return res.status(400).json({ message: 'Lu udah absen masuk hari ini cuy!' });
        }

        const status = 'hadir';

        // Simpan ke database
        await db.query(
            'INSERT INTO attendances (user_id, clock_in_time, latitude, longitude, photo_url, status) VALUES (?, NOW(), ?, ?, ?, ?)',
            [userId, latitude, longitude, photo_url, status]
        );

        res.status(201).json({ message: 'Absen masuk berhasil direkam!' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.clockOut = async (req, res) => {
    const userId = req.user.id; // Didapet dari token Satpam

    try {
        // Cari absen masuk hari ini
        const [existing] = await db.query(
            'SELECT * FROM attendances WHERE user_id = ? AND DATE(clock_in_time) = CURDATE()',
            [userId]
        );

        // Kalau belum absen masuk, gak bisa absen pulang dong
        if (existing.length === 0) {
            return res.status(400).json({ message: 'Lu belum absen masuk hari ini!' });
        }

        // Kalau udah pernah absen pulang sebelumnya
        if (existing[0].clock_out_time !== null) {
            return res.status(400).json({ message: 'Lu udah absen pulang cuy!' });
        }

        // Update jam pulang di database
        await db.query(
            'UPDATE attendances SET clock_out_time = NOW() WHERE id = ?',
            [existing[0].id]
        );

        res.status(200).json({ message: 'Absen pulang berhasil direkam! Hati-hati di jalan.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getHistory = async (req, res) => {
    const userId = req.user.id; // Tetep didapet otomatis dari token Satpam

    try {
        // Ambil semua data absen user ini, urutin dari yang paling baru
        const [history] = await db.query(
            'SELECT * FROM attendances WHERE user_id = ? ORDER BY clock_in_time DESC',
            [userId]
        );

        res.status(200).json({ 
            message: 'Berhasil mengambil riwayat absensi', 
            data: history 
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};