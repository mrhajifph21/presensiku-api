// Role gate for privileged routes. Mount after authMiddleware.
module.exports = (...allowedRoles) => (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Akses ditolak untuk role ini.' });
    }
    next();
};
