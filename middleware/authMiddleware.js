const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports = (req, res, next) => {
    // Ambil token dari header request
    const token = req.header('Authorization');

    // Kalau gak ada token, tolak mentah-mentah
    if (!token) {
        return res.status(401).json({ message: 'Akses ditolak! Token tidak ditemukan.' });
    }

    try {
        // Format token biasanya "Bearer <token_acak>", jadi kita ambil tokennya aja
        const tokenString = token.split(' ')[1];
        
        // Verifikasi apakah tokennya asli buatan sistem kita
        const decoded = jwt.verify(tokenString, process.env.JWT_SECRET);
        
        // Kalau asli, simpen data user-nya ke request, terus lanjut ke proses berikutnya
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token tidak valid atau sudah expired!' });
    }
};