// Kita pakai rumus Haversine (ngitung jarak lurus dua titik di bumi)
exports.cekGeofence = (userLat, userLng, officeLat, officeLng, maxRadius) => {
    // Fungsi konversi derajat ke radian
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371e3; // Radius bumi dalam meter

    const dLat = toRad(officeLat - userLat);
    const dLon = toRad(officeLng - userLng);
    
    const lat1 = toRad(userLat);
    const lat2 = toRad(officeLat);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = Math.round(R * c); // Jarak dalam meter

    return {
        valid: distance <= maxRadius,
        jarak: distance
    };
};