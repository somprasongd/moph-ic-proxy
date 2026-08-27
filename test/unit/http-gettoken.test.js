// ทดสอบ token lifecycle: cache, force refresh, แชร์ in-flight fetch (dedup)
// และ retry ครั้งเดียวเมื่อ upstream ตอบ 401 — ทั้งหมดยิงที่ fake upstream
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { createFakeUpstream } = require('../helpers/fake-upstream');

// ต้องตั้ง env ให้ชี้ไปที่ fake upstream "ก่อน" require src/http
// เพราะ axios instance ถูกสร้างตอน require
delete process.env.REDIS_HOST;
delete process.env.REDIS_PASSWORD;
process.env.MOPH_HCODE = process.env.MOPH_HCODE || '11242';

const upstream = createFakeUpstream({ tokenDelayMs: 30 });
let http;
let cache;

before(async () => {
  const url = await upstream.listen();
  process.env.MOPH_IC_AUTH = url;
  process.env.MOPH_IC_API = url;
  process.env.FDH_AUTH = url;

  http = require('../../src/http');
  cache = require('../../src/cache');
});

after(() => upstream.close());

const tokenRequests = () =>
  upstream.requests.filter((r) => r.pathname === '/token');

test('ยังไม่มี credential ใน cache ตอบ null (ไม่ใช่ throw)', async () => {
  assert.equal(await http.getToken(), null);
});

test('getToken แบบส่ง username/password ได้ token และ cache ไว้', async () => {
  const token = await http.getToken({
    force: true,
    username: 'unit-user',
    password: 'unit-pass',
  });
  assert.ok(token, 'ต้องได้ token กลับมา');
  assert.match(token, /^v\d+\./);
  assert.equal(upstream.hits.token, 1);

  // เรียกซ้ำไม่ force ต้องได้จาก cache โดยไม่ยิงขอใหม่
  assert.equal(await http.getToken(), token);
  assert.equal(upstream.hits.token, 1);
});

test('force refresh ต้องยิงขอ token ใหม่และได้ค่าใหม่', async () => {
  const oldToken = await http.getToken();
  const newToken = await http.getToken({
    force: true,
    username: 'unit-user',
    password: 'unit-pass',
  });
  assert.notEqual(newToken, oldToken);
  assert.equal(upstream.hits.token, 2);
});

test('getToken แบบไม่ส่ง credential ใช้ payload ที่เคยเก็บไว้ได้', async () => {
  // ลบ token ใน cache แต่คง payload ไว้ แล้วขอใหม่ต้องสำเร็จด้วย credential เดิม
  await cache.del('mophic-auth-token');
  const token = await http.getToken();
  assert.ok(token);
  assert.equal(upstream.hits.token, 3);

  const last = tokenRequests().pop();
  const payload = JSON.parse(last.body.toString());
  assert.equal(payload.user, 'unit-user');
  assert.equal(payload.hospital_code, process.env.MOPH_HCODE);
  // รหัสผ่านต้องถูก hash ด้วย HMAC ไม่ใช่ส่งเป็น plain text
  assert.ok(payload.password_hash);
  assert.notEqual(payload.password_hash, 'unit-pass');
});

test('ยิง force refresh พร้อมกัน 8 ตัวต้องแชร์การ fetch ครั้งเดียว', async () => {
  const hitsBefore = upstream.hits.token;
  const results = await Promise.all(
    Array.from(
      { length: 8 },
      () =>
        http.getToken({
          force: true,
          username: 'unit-user',
          password: 'unit-pass',
        })
    )
  );
  assert.equal(upstream.hits.token, hitsBefore + 1);
  assert.ok(results.every(Boolean));
});

test('credential ผิด (upstream ตอบ 401) ได้ undefined ไม่ใช่ throw', async () => {
  const token = await http.getToken({
    force: true,
    username: 'bad',
    password: 'nope',
  });
  assert.equal(token, undefined);
});

test('upstream ตอบ 401 ต้อง refresh token แล้ว retry สำเร็จจนได้', async () => {
  // สถานะตอนนี้ cache token ถูกลบจากเคสก่อนหน้า ให้ seed กลับก่อน
  const token = await http.getToken({
    force: true,
    username: 'unit-user',
    password: 'unit-pass',
  });
  assert.ok(token);

  const tokenHitsBefore = upstream.hits.token;
  const staleHitsBefore = upstream.hits.byPath.get('/api/stale') || 0;

  // /api/stale ของ fake upstream ตอบ 401 กับ request แรกแล้วผ่านหลัง refresh
  const response = await http.client.get('/api/stale');

  assert.equal(response.status, 200);
  assert.equal(response.data.ok, true);
  // ต้อง refresh token เพิ่ม 1 ครั้ง
  assert.equal(upstream.hits.token, tokenHitsBefore + 1);
  // ยิง /api/stale 2 ครั้ง: ครั้งแรกโดน 401 ครั้งหลัง retry สำเร็จ
  assert.equal(
    (upstream.hits.byPath.get('/api/stale') || 0) - staleHitsBefore,
    2
  );
});

test('getTokenStatus รายงานสถานะ token ของทั้งสองแอป', async () => {
  // ตอนนี้ mophic มี token แล้ว แต่ fdh ยังไม่มี
  assert.deepEqual(await http.getTokenStatus(), { mophic: true, fdh: false });

  await http.getToken({
    force: true,
    app: 'fdh',
    username: 'fdh-user',
    password: 'fdh-pass',
  });
  assert.deepEqual(await http.getTokenStatus(), { mophic: true, fdh: true });
});
