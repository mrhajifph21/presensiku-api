/**
 * PSI-355: unit tests for the zkteco_logs sink builder + identity mapping.
 * Pure seam: no MySQL required (db/log are injectable into writeZktecoEvent).
 */
const {
    ZK_TYPE_CHECK_IN,
    ZK_TYPE_CHECK_OUT,
    legacyWritesEnabled,
    resolveZkUserId,
    toMysqlDatetime,
    buildZktecoInsert,
    writeZktecoEvent,
} = require('../utils/zkteco');

describe('resolveZkUserId (NIK / peserta provisioning mapping)', () => {
    test('8-digit NIK passes through', () => {
        expect(resolveZkUserId('00022802')).toBe('00022802');
    });

    test('peserta provisioning nip (PKL-<id>) passes through', () => {
        expect(resolveZkUserId('PKL-12')).toBe('PKL-12');
    });

    test('anything else maps to null (write skipped)', () => {
        expect(resolveZkUserId('tst_kar_001')).toBeNull();
        expect(resolveZkUserId('1234567')).toBeNull();
        expect(resolveZkUserId('PKL-')).toBeNull();
        expect(resolveZkUserId(null)).toBeNull();
    });
});

describe('toMysqlDatetime', () => {
    test('formats local Y-m-d H:i:s', () => {
        expect(toMysqlDatetime(new Date(2026, 10, 18, 8, 55, 11))).toBe('2026-11-18 08:55:11');
    });
});

describe('buildZktecoInsert', () => {
    test('check-in row carries type/state 0 and the retry guard', () => {
        const { sql, params } = buildZktecoInsert({ userId: 'PKL-3', recordTime: '2026-11-18 08:55:11' });

        expect(sql).toContain('INSERT INTO zkteco_logs');
        expect(sql).toContain('ON DUPLICATE KEY UPDATE id = id');
        expect(params).toEqual([
            'presensiku.gps', 'PRESENSIKU GPS', 'PRESENSIKU-GPS',
            'PKL-3', '2026-11-18 08:55:11', '2026-11-18', '08:55:11',
            ZK_TYPE_CHECK_IN, ZK_TYPE_CHECK_IN,
        ]);
    });

    test('check-out row carries type/state 1', () => {
        const { params } = buildZktecoInsert({
            userId: '00022802', recordTime: '2026-11-18 17:00:00', type: ZK_TYPE_CHECK_OUT,
        });

        expect(params[7]).toBe(1);
        expect(params[8]).toBe(1);
    });
});

describe('writeZktecoEvent (stubbed db)', () => {
    test('writes the built insert for a mapped nip', async () => {
        const queries = [];
        const db = { query: async (sql, params) => { queries.push([sql, params]); } };

        const ok = await writeZktecoEvent({
            nip: 'PKL-3', now: new Date(2026, 10, 18, 8, 55, 11), db, log: console,
        });

        expect(ok).toBe(true);
        expect(queries).toHaveLength(1);
        expect(queries[0][1][4]).toBe('2026-11-18 08:55:11');
    });

    test('unmapped nip skips the write', async () => {
        const db = { query: async () => { throw new Error('must not be called'); } };
        const silent = { warn: () => {}, error: () => {} };

        const ok = await writeZktecoEvent({ nip: 'weird_nip', db, log: silent });

        expect(ok).toBe(false);
    });

    test('a down sink is swallowed (never fails the check-in)', async () => {
        const db = { query: async () => { throw new Error('ECONNREFUSED'); } };
        const silent = { warn: () => {}, error: () => {} };

        const ok = await writeZktecoEvent({ nip: 'PKL-3', db, log: silent });

        expect(ok).toBe(false);
    });
});

describe('legacyWritesEnabled (dual-write flag)', () => {
    const original = process.env.DUAL_WRITE_LEGACY;

    afterAll(() => {
        if (original === undefined) {
            delete process.env.DUAL_WRITE_LEGACY;
        } else {
            process.env.DUAL_WRITE_LEGACY = original;
        }
    });

    test('defaults ON', () => {
        delete process.env.DUAL_WRITE_LEGACY;
        expect(legacyWritesEnabled()).toBe(true);
    });

    test('explicit false/0 turns it off', () => {
        process.env.DUAL_WRITE_LEGACY = 'false';
        expect(legacyWritesEnabled()).toBe(false);

        process.env.DUAL_WRITE_LEGACY = '0';
        expect(legacyWritesEnabled()).toBe(false);
    });
});
