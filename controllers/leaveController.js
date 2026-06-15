const db = require('../config/db');

// Fungsi Ngajuin Cuti
exports.submitLeave = async (req, res) => {
    const userId = req.user.id; // Dari token Satpam
    const { start_date, end_date, reason, attachment_url } = req.body;

    try {
        await db.query(
            'INSERT INTO leaves (user_id, start_date, end_date, reason, attachment_url) VALUES (?, ?, ?, ?, ?)',
            [userId, start_date, end_date, reason, attachment_url]
        );

        res.status(201).json({ message: 'Pengajuan cuti berhasil dikirim! Tinggal nunggu di-approve HRD.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Fungsi Liat Riwayat Cuti
exports.getLeaveHistory = async (req, res) => {
    const userId = req.user.id;

    try {
        const [history] = await db.query(
            'SELECT * FROM leaves WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );

        res.status(200).json({ message: 'Berhasil mengambil riwayat cuti', data: history });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// --- KHUSUS HRD: Liat semua pengajuan cuti yang masih pending ---
exports.getAllPendingLeaves = async (req, res) => {
    // Cek apakah yang akses ini beneran HRD
    if (req.user.role !== 'hrd') {
        return res.status(403).json({ message: 'Akses ditolak! Lu bukan HRD cuy.' });
    }

    try {
        // Ambil data cuti digabung sama nama karyawannya
        const [leaves] = await db.query(`
            SELECT leaves.*, users.name, users.nip 
            FROM leaves 
            JOIN users ON leaves.user_id = users.id 
            WHERE leaves.status = 'pending' 
            ORDER BY leaves.created_at ASC
        `);

        res.status(200).json({ message: 'Data cuti pending', data: leaves });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// --- KHUSUS HRD: Approve atau Reject Cuti ---
exports.updateLeaveStatus = async (req, res) => {
    if (req.user.role !== 'hrd') {
        return res.status(403).json({ message: 'Akses ditolak! Cuma HRD yang bisa proses.' });
    }

    const { id } = req.params; // ID cutinya dapet dari URL
    const { status } = req.body; // 'approved' atau 'rejected'

    try {
        await db.query(
            'UPDATE leaves SET status = ? WHERE id = ?',
            [status, id]
        );
        res.status(200).json({ message: `Pengajuan cuti berhasil di-${status}!` });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};