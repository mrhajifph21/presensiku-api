// PSI-355: second connection for the company attendance DB (zkteco_logs
// in db_hris on MySQL 201). Defaults match the 201 Docker host, whose
// MySQL is local (root@127.0.0.1). Local development must point these at
// the Laragon mirror - NEVER write to 201/202 while developing.
const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.ZK_DB_HOST || '127.0.0.1',
    user: process.env.ZK_DB_USER,
    password: process.env.ZK_DB_PASSWORD,
    database: process.env.ZK_DB_NAME || 'db_hris',
    waitForConnections: true,
    connectionLimit: 3,
    queueLimit: 0
});

const promisePool = pool.promise();

module.exports = promisePool;
