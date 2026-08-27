// Integration test: boot ตัว src/index.js จริงทั้งตัวใน process เดียวกัน
// (morgan, web pages, api-key middleware, api router, error handler, /healthz, /readyz)
// โดยชี้ทุก upstream ไปที่ fake upstream
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createFakeUpstream } = require('../helpers/fake-upstream');

delete process.env.REDIS_HOST;
delete process.env.REDIS_PASSWORD;
process.env.MOPH_HCODE = process.env.MOPH_HCODE || '11242';
process.env.USE_API_KEY = 'true';
process.env.APP_PORT = '0'; // ให้ OS จัด ephemeral port (main คืน server ให้อ่านทีหลัง)

// ชี้ไฟล์ api key ไปที่ temp directory กันเขียนทับของจริง
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moph-proxy-int-app-'));
process.env.API_KEY_FILE = path.join(tmpDir, 'keys', '.access.key');
process.on('exit', () => fs.rmSync(tmpDir, { recursive: true, force: true }));

const upstream = createFakeUpstream();
const pkgJson = require('../../package.json');

let server;
let baseUrl;
let apiKey;

before(async () => {
  const url = await upstream.listen();
  for (const key of [
    'MOPH_IC_API',
    'MOPH_IC_AUTH',
    'EPIDEM_API',
    'MOPH_PHR_API',
    'MOPH_CLAIM_API',
    'FDH_API',
    'FDH_AUTH',
  ]) {
    process.env[key] = url;
  }

  // main() ของ index.js จะสร้าง api key ให้เมื่อ USE_API_KEY=true
  const { main } = require('../../src/index');
  server = await main();
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const keygen = require('../../src/helper/keygen');
  apiKey = keygen.getApiKey();
  assert.ok(apiKey, 'boot ด้วย USE_API_KEY=true ต้องสร้าง api key');
});

after(async () => {
  await new Promise((resolve) => {
    // ตัด keep-alive ที่ fetch ถือค้างให้ server.close จบได้
    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }
    server.close(resolve);
  });
  await upstream.close();
});

test('GET /healthz ตอบ 200 พร้อม version จาก package.json และ cache backend', async () => {
  const res = await fetch(`${baseUrl}/healthz`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.version, pkgJson.version);
  assert.equal(body.cache, 'memory');
});

test('GET /favicon.ico ตอบ 204', async () => {
  const res = await fetch(`${baseUrl}/favicon.ico`);
  assert.equal(res.status, 204);
});

test('GET /readyz ตอบ 503 ก่อนตั้ง credential ทั้งสองแอป', async () => {
  const res = await fetch(`${baseUrl}/readyz`);
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.ready, false);
  assert.deepEqual(body.tokens, { mophic: false, fdh: false });
});

test('เรียก API โดยไม่มี x-api-key ตอบ 401', async () => {
  const res = await fetch(`${baseUrl}/api/echo`);
  assert.equal(res.status, 401);
});

test('เรียก API ด้วย x-api-key ผิดตอบ 400', async () => {
  const res = await fetch(`${baseUrl}/api/echo`, {
    headers: { 'x-api-key': 'WRONG-KEY' },
  });
  assert.equal(res.status, 400);
});

test('ตั้ง credential ครบทั้งสองแอปแล้ว /readyz ตอบ 200', async () => {
  for (const query of ['', '?app=fdh']) {
    const res = await fetch(`${baseUrl}/api/auth/change-password${query}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ username: 'int-user', password: 'int-pass' }),
    });
    assert.equal(res.status, 204);
  }

  const res = await fetch(`${baseUrl}/readyz`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ready, true);
  assert.deepEqual(body.tokens, { mophic: true, fdh: true });
});

test('proxy end-to-end: ผ่าน api key ทาง query แล้วไม่รั่วไป upstream เลย', async () => {
  const res = await fetch(
    `${baseUrl}/api/echo?x-api-key=${encodeURIComponent(
      apiKey
    )}&endpoint=fdh&foo=bar`
  );
  assert.equal(res.status, 200);
  const seen = await res.json();

  const seenUrl = new URL(seen.url, 'http://upstream.local');
  assert.equal(
    seenUrl.searchParams.has('x-api-key'),
    false,
    'api key ต้องไม่รั่วไป upstream'
  );
  assert.equal(seenUrl.searchParams.has('endpoint'), false);
  assert.equal(seenUrl.searchParams.get('foo'), 'bar');
  assert.ok(seen.authorization, 'ต้องแนบ Bearer token ของแอป fdh');
});

test('path ที่ upstream ไม่มี ต้องส่งต่อ 404 ผ่าน error handler จริงของ index.js', async () => {
  const res = await fetch(`${baseUrl}/no-such-route`, {
    headers: { 'x-api-key': apiKey },
  });
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.match(body.message, /Cannot GET \/no-such-route/);
});

test('หน้าเว็บทั้งสามเปิดได้โดยไม่ต้องมี api key', async () => {
  for (const page of ['/', '/change-password', '/api-key']) {
    const res = await fetch(`${baseUrl}${page}`);
    assert.equal(res.status, 200, `หน้า ${page} ต้องเปิดได้`);
    assert.ok(
      (res.headers.get('content-type') || '').includes('text/html'),
      `${page} ต้องเป็น HTML`
    );
  }
  const html = await (await fetch(`${baseUrl}/`)).text();
  assert.match(html, /MOPH API Proxy/);
});
