// ทดสอบ POST /api/auth/change-password (mount แบบเดียวกับ src/api/index.js)
// โดยชี้ token endpoint ไปที่ fake upstream
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createFakeUpstream } = require('../helpers/fake-upstream');

delete process.env.REDIS_HOST;
delete process.env.REDIS_PASSWORD;
process.env.MOPH_HCODE = process.env.MOPH_HCODE || '11242';

const upstream = createFakeUpstream();
let server;
let baseUrl;
let upstreamUrl;

before(async () => {
  upstreamUrl = await upstream.listen();
  process.env.MOPH_IC_AUTH = upstreamUrl;
  process.env.FDH_AUTH = upstreamUrl;

  const authRouter = require('../../src/api/auth');
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);

  server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await upstream.close();
});

const postChangePassword = (body, query = '') =>
  fetch(`${baseUrl}/api/auth/change-password${query}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const tokenRequests = () =>
  upstream.requests.filter((r) => r.pathname === '/token');

test('app ที่ไม่รู้จักต้องตอบ 400 ทันที', async () => {
  const res = await postChangePassword(
    { username: 'u', password: 'p' },
    '?app=claim'
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error.message, /Invalid app/);
  assert.equal(tokenRequests().length, 0, 'ต้องไม่ยิงถึง upstream เลย');
});

test('ขาด username ต้องตอบ 400', async () => {
  const res = await postChangePassword({ password: 'p' });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error.message, /username is required/);
});

test('ขาด password ต้องตอบ 400', async () => {
  const res = await postChangePassword({ username: 'u' });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error.message, /password is required/);
});

test('เปลี่ยน credential ของ mophic สำเร็จตอบ 204 และส่ง payload ถูกต้อง', async () => {
  const res = await postChangePassword({
    username: 'route-user',
    password: 'route-pass',
  });
  assert.equal(res.status, 204);

  const last = tokenRequests().pop();
  assert.equal(last.headers.host, new URL(upstreamUrl).host);
  const payload = JSON.parse(last.body.toString());
  assert.equal(payload.user, 'route-user');
  assert.equal(payload.hospital_code, process.env.MOPH_HCODE);
  assert.ok(payload.password_hash);
});

test('เปลี่ยน credential ของ fdh สำเร็จตอบ 204', async () => {
  const res = await postChangePassword(
    { username: 'fdh-user', password: 'fdh-pass' },
    '?app=fdh'
  );
  assert.equal(res.status, 204);
});

test('credential ผิด (upstream ตอบ 401) ต้องตอบ 401', async () => {
  const res = await postChangePassword({
    username: 'bad',
    password: 'nope',
  });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.match(body.error.message, /Invalid username or password/);
});
