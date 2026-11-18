// PSI-355: zkteco_logs sink helpers (company attendance DB, MySQL 201).
// The builder and identity mapping are DB-free so they stay unit-testable.
const zkDb = require('../config/zkDb');

// Synthetic device identity for PresensIKu writes. device_ip is part of
// the UNIQUE (user_id, record_time, device_ip) key and absorbs retries.
const ZK_DEVICE_NAME = 'PRESENSIKU GPS';
const ZK_DEVICE_IP = 'presensiku.gps';
const ZK_DEVICE_SN = 'PRESENSIKU-GPS';

// ZK convention: 0 = check-in, 1 = check-out (state mirrors type).
const ZK_TYPE_CHECK_IN = 0;
const ZK_TYPE_CHECK_OUT = 1;

// Identity mapping (PSI-355): zkteco_logs.user_id holds the provisioning
// identity. Employees carry an 8-digit NIK as nip; PKL peserta have no
// NIK - provisioning #5 (docs/PSI-256-internship-app-requirements.md 6.2)
// gives them nip 'PKL-<id_magang>', which is also what psi.hris queries
// by. Both go into user_id verbatim; anything else is not writable.
const NIK_8_DIGIT = /^\d{8}$/;
const PESERTA_NIP = /^PKL-\d+$/;

// Dual-write flag: legacy presensiku@202 write path stays ON until the
// zkteco_logs cutover is verified (removal is a follow-up).
function legacyWritesEnabled() {
    return process.env.DUAL_WRITE_LEGACY !== 'false' && process.env.DUAL_WRITE_LEGACY !== '0';
}

function resolveZkUserId(nip) {
    if (typeof nip !== 'string') {
        return null;
    }

    if (NIK_8_DIGIT.test(nip) || PESERTA_NIP.test(nip)) {
        return nip;
    }

    return null;
}

// '2026-11-18 08:55:11' in the API host timezone (WIB on the 201 host).
function toMysqlDatetime(date) {
    const pad = (n) => String(n).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// INSERT that tolerates client retries via ON DUPLICATE KEY UPDATE id=id
// (unique key user_id+record_time+device_ip). state mirrors type.
function buildZktecoInsert({ userId, recordTime, type = ZK_TYPE_CHECK_IN }) {
    const [date, time] = recordTime.split(' ');

    const sql = `
      INSERT INTO zkteco_logs
        (device_ip, device_name, device_sn, uid, user_id, record_time, date, time, state, type)
      VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE id = id
    `;

    return {
        sql,
        params: [ZK_DEVICE_IP, ZK_DEVICE_NAME, ZK_DEVICE_SN, userId, recordTime, date, time, type, type],
    };
}

// Best-effort sink: a down 201 must never fail a user-facing check-in.
// Returns true when the row landed, false when skipped or failed (logged).
async function writeZktecoEvent({ nip, now = new Date(), type = ZK_TYPE_CHECK_IN, db = zkDb, log = console }) {
    const userId = resolveZkUserId(nip);

    if (!userId) {
        log.warn(`zkteco_logs: no writable user id for nip=${nip}, skipped`);
        return false;
    }

    const { sql, params } = buildZktecoInsert({ userId, recordTime: toMysqlDatetime(now), type });

    try {
        await db.query(sql, params);
        return true;
    } catch (err) {
        log.error(`zkteco_logs insert failed for user_id=${userId}: ${err.message}`);
        return false;
    }
}

module.exports = {
    ZK_DEVICE_NAME,
    ZK_DEVICE_IP,
    ZK_DEVICE_SN,
    ZK_TYPE_CHECK_IN,
    ZK_TYPE_CHECK_OUT,
    legacyWritesEnabled,
    resolveZkUserId,
    toMysqlDatetime,
    buildZktecoInsert,
    writeZktecoEvent,
};
