const db = require('../config/db');

exports.getSettings = async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM settings WHERE id = 1');
    res.json({ data: results[0] || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  const { latitude, longitude, radius, jam_masuk, jam_pulang } = req.body;
  
  const sql = `
    INSERT INTO settings (id, latitude, longitude, radius, jam_masuk, jam_pulang) 
    VALUES (1, ?, ?, ?, ?, ?) 
    ON DUPLICATE KEY UPDATE 
    latitude = VALUES(latitude), longitude = VALUES(longitude), radius = VALUES(radius), jam_masuk = VALUES(jam_masuk), jam_pulang = VALUES(jam_pulang)
  `;
  
  try {
    await db.query(sql, [latitude, longitude, radius, jam_masuk, jam_pulang]);
    res.json({ message: 'Master Data berhasil disimpan ke database!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};