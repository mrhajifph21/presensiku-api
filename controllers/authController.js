const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// --- FUNGSI REGISTER (HRD-gated; see routes/authRoutes.js) ---
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

        const userRole = role || 'karyawan';
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
    try {
        const { nip, password } = req.body;

        const [users] = await db.query('SELECT * FROM users WHERE nip = ?', [nip]);

        if (users.length === 0) {
            return res.status(401).json({ message: 'NIP tidak ditemukan!' });
        }

        const user = users[0];

        // PSI-256: accounts provisioned from psi.hris are disabled when the
        // peserta is set Tidak Aktif there; the API refuses them on login.
        if (user.is_active === 0) {
            return res.status(403).json({ message: 'Akun nonaktif. Hubungi HR.' });
        }

        // PSI-256: accounts provisioned from psi.hris carry PHP's $2y$ bcrypt
        // marker; $2y$ and $2b$ are the same algorithm, so normalize before
        // comparing (node bcrypt rejects the $2y$ prefix outright).
        const storedHash = user.password.startsWith('$2y$')
            ? '$2b$' + user.password.slice(4)
            : user.password;

        const isMatch = await bcrypt.compare(password, storedHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Password salah!' });
        }

        // Env-only secret (audit fix d): index.js already fails closed without it
        const token = jwt.sign(
            { id: user.id, nip: user.nip, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.status(200).json({
            message: 'Login berhasil',
            token: token,
            user: {
                id: user.id,
                nip: user.nip,
                name: user.name,
                role: user.role
            }
        });

    } catch (err) {
        res.status(500).json({ message: 'Server error saat login', error: err.message });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, nip, name, role FROM users ORDER BY created_at DESC'
        );

        res.status(200).json({ message: 'Berhasil mengambil data karyawan', data: users });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
