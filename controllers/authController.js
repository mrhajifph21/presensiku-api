const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// --- FUNGSI REGISTER ---
exports.register = async (req, res) => {
    const { nip, name, password, role } = req.body;

    try {
        // Cek apakah NIP udah terdaftar
        const [existingUser] = await db.query('SELECT * FROM users WHERE nip = ?', [nip]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'NIP sudah terdaftar!' });
        }

        // Hash password (enkripsi)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Masukin data ke database
        const userRole = role || 'karyawan'; // Default karyawan kalau gak diisi
        await db.query(
            'INSERT INTO users (nip, name, password, role) VALUES (?, ?, ?, ?)',
            [nip, name, hashedPassword, userRole]
        );

        res.status(201).json({ message: 'Registrasi berhasil!' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// --- FUNGSI LOGIN ---
exports.login = async (req, res) => {
    const { nip, password } = req.body;

    try {
        // Cari user berdasarkan NIP
        const [users] = await db.query('SELECT * FROM users WHERE nip = ?', [nip]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'NIP tidak ditemukan!' });
        }

        const user = users[0];

        // Cek kecocokan password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Password salah!' });
        }

        // Bikin token JWT (berlaku 1 hari)
        const token = jwt.sign(
            { id: user.id, nip: user.nip, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            message: 'Login sukses!',
            token: token,
            user: { id: user.id, name: user.name, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};


exports.clockIn = async (req, res) => {
    // Data ini nanti dikirim dari HP (Flutter)
    const { latitude, longitude, photo_url } = req.body;
    const userId = req.user.id; // Didapet dari middleware Satpam tadi

    try {
        // Cek apakah hari ini udah absen masuk (biar gak double)
        const [existing] = await db.query(
            'SELECT * FROM attendances WHERE user_id = ? AND DATE(clock_in_time) = CURDATE()',
            [userId]
        );

        if (existing.length > 0) {
            return res.status(400).json({ message: 'Lu udah absen masuk hari ini cuy!' });
        }

        // Tentukan status terlambat atau hadir (Misal batas masuk jam 08:00)
        // Buat MVP kita set 'hadir' dulu defaultnya
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