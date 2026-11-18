const db = require('../config/db');

exports.getAllUsers = async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, name, nip, role FROM users ORDER BY created_at DESC'
    );
    res.json({ data: users });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};