const multer = require('multer');
const path   = require('path');
const crypto = require('crypto');

// Upload whitelist (audit fix e): selfie images only, max 5MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads/selfie'));
    },
    filename: (req, file, cb) => {
        // Random, non-guessable name (PSI-256 #12): no timestamp enumeration
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `selfie_${crypto.randomUUID()}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    const extOk = /\.(jpe?g|png|webp)$/i.test(path.extname(file.originalname));
    if (ALLOWED_MIME.includes(file.mimetype) && extOk) {
        return cb(null, true);
    }
    cb(new Error('Hanya file gambar (jpg/png/webp) yang diizinkan.'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE_BYTES } });

module.exports = upload;
