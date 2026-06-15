const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./config/db'); // Manggil file koneksi database
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json()); // Biar server bisa nerima data format JSON
app.use(express.urlencoded({ extended: true }));

// Import routes
const authRoutes = require('./routes/authRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaveRoutes = require('./routes/leaveRoutes');

// Daftarin endpoint
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);

// Route testing dasar (Buka di browser: http://localhost:3000)
app.get('/', (req, res) => {
    res.send('API Absensi PT Padma Soode Running Coy! 🚀');
});

// Route testing koneksi database (Buka di browser: http://localhost:3000/test-db)
app.get('/test-db', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT 1 + 1 AS solution');
        res.json({ message: 'Koneksi database sukses!', data: rows });
    } catch (error) {
        res.status(500).json({ message: 'Database error nih', error: error.message });
    }
});

// Nyalain server
app.listen(port, () => {
    console.log(`Server nyala di http://localhost:${port}`);
});