/**
 * Security regression tests for the PresensiKu API.
 * Seam: HTTP API via supertest (public boundary).
 * Each describe maps to one audit blocker; all must be RED on pre-fix code.
 */
const request = require('supertest');
const bcrypt = require('bcrypt');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test_secret_strong_0123456789_abcdef';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const app = require('../index');
const db = require('../config/db');

const HRD_NIP = 'tst_hrd_001';
const KAR_NIP = 'tst_kar_001';
const HARD_CODED_FALLBACK = 'presensiku_secret_key_2024_padmasoode';

let hrdToken, karToken, hrdId, karId;

beforeAll(async () => {
  const hash = await bcrypt.hash('TestPass123!', 10);
  const [h] = await db.query(
    'INSERT INTO users (nip, name, password, role) VALUES (?, ?, ?, ?)',
    [HRD_NIP, 'Test HRD', hash, 'hrd']
  );
  hrdId = h.insertId;
  const [k] = await db.query(
    'INSERT INTO users (nip, name, password, role) VALUES (?, ?, ?, ?)',
    [KAR_NIP, 'Test Karyawan', hash, 'karyawan']
  );
  karId = k.insertId;

  const sign = (u) => jwt.sign({ id: u.id, nip: u.nip, role: u.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
  hrdToken = sign({ id: hrdId, nip: HRD_NIP, role: 'hrd' });
  karToken = sign({ id: karId, nip: KAR_NIP, role: 'karyawan' });
});

afterAll(async () => {
  await db.query('DELETE FROM users WHERE nip IN (?, ?)', [HRD_NIP, KAR_NIP]);
  await db.query('DELETE FROM attendances WHERE user_id IN (?, ?)', [hrdId, karId]);
  await db.end();
});

// (a) Registration must be privileged-role gated
describe('audit fix (a): registration authorization', () => {
  test('anonymous registration is rejected with 401', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nip: 'tst_evil_001', name: 'Evil', password: 'x12345678', role: 'hrd' });
    expect(res.status).toBe(401);
  });

  test('karyawan token cannot register users (403)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${karToken}`)
      .send({ nip: 'tst_evil_002', name: 'Evil', password: 'x12345678', role: 'hrd' });
    expect(res.status).toBe(403);
  });

  test('hrd token can register a user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${hrdToken}`)
      .send({ nip: 'tst_new_001', name: 'New', password: 'x12345678', role: 'karyawan' });
    expect(res.status).toBe(201);
    await db.query('DELETE FROM users WHERE nip = ?', ['tst_new_001']);
  });
});

// (b) Settings (geofence master data) must require auth
describe('audit fix (b): settings authorization', () => {
  test('GET /api/settings without token is 401', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(401);
  });

  test('PUT /api/settings without token is 401', async () => {
    const res = await request(app).put('/api/settings').send({ latitude: 1, longitude: 1, radius: 1 });
    expect(res.status).toBe(401);
  });

  test('PUT /api/settings with karyawan token is 403', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${karToken}`)
      .send({ latitude: -6.35, longitude: 106.96, radius: 500, jam_masuk: '08:00', jam_pulang: '17:00' });
    expect(res.status).toBe(403);
  });
});

// (d) No hardcoded JWT fallback: old-secret tokens die, missing secret fails closed
describe('audit fix (d): JWT secret handling', () => {
  test('token forged with the old hardcoded secret is rejected', async () => {
    const forged = jwt.sign({ id: 1, nip: '1', role: 'hrd' }, HARD_CODED_FALLBACK, { expiresIn: '1h' });
    const res = await request(app)
      .get('/api/auth/karyawan')
      .set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  test('server refuses to start without JWT_SECRET', () => {
    const env = { ...process.env };
    delete env.JWT_SECRET;
    let exitThrew = false;
    try {
      // cwd without a .env so dotenv finds nothing and JWT_SECRET stays unset
      execFileSync('node', [path.join(__dirname, '..', 'index.js')], {
        env,
        cwd: require('os').tmpdir(),
        timeout: 8000,
        stdio: 'pipe',
      });
    } catch (err) {
      exitThrew = true;
      expect(String(err.stderr)).toMatch(/JWT_SECRET/);
    }
    expect(exitThrew).toBe(true);
  }, 15000);
});

// (e) Uploads must be type/size restricted (via the real clock-in endpoint;
// the /test-upload debug route was removed in PSI-256 #12)
describe('audit fix (e): upload validation', () => {
  test('text file upload is rejected with 400', async () => {
    const res = await request(app)
      .post('/api/attendance/clock-in')
      .set('Authorization', `Bearer ${karToken}`)
      .attach('selfie', Buffer.from('<html>x</html>'), { filename: 'evil.html', contentType: 'text/html' });
    expect(res.status).toBe(400);
  });

  test('jpg upload is accepted', async () => {
    const res = await request(app)
      .post('/api/attendance/clock-in')
      .set('Authorization', `Bearer ${karToken}`)
      .attach('selfie', Buffer.alloc(64, 0xff), { filename: 'ok.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(201);
  });
});

// (g) PSI-256 #12: /uploads is private and the debug route is gone
describe('fix #12: uploads gated behind auth', () => {
  // Self-contained fixture: the auth gate is under test, not an upload
  // that happened to exist on someone's disk.
  const FIXTURE_URL = 'uploads/selfie/selfie_fixture.jpg';
  const FIXTURE_PATH = path.join(__dirname, '..', FIXTURE_URL);

  beforeAll(() => {
    fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
    fs.writeFileSync(FIXTURE_PATH, Buffer.alloc(64, 0xff));
  });

  afterAll(() => {
    fs.rmSync(FIXTURE_PATH, { force: true });
  });

  test('unauthenticated GET /uploads is rejected with 401', async () => {
    const res = await request(app).get(`/${FIXTURE_URL}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toBeDefined();
  });

  test('authenticated GET /uploads serves the file', async () => {
    const res = await request(app)
      .get(`/${FIXTURE_URL}`)
      .set('Authorization', `Bearer ${karToken}`);
    expect(res.status).toBe(200);
  });

  test('POST /test-upload is gone (404)', async () => {
    const res = await request(app)
      .post('/test-upload')
      .set('Authorization', `Bearer ${karToken}`);
    expect(res.status).toBe(404);
  });
});

// (f) CORS must come from configuration, not a hardcoded localhost
describe('audit fix (f): CORS from env', () => {
  test('reflects CORS_ORIGIN for the allowed origin', async () => {
    const res = await request(app).get('/').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
