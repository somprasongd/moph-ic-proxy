// ทดสอบตัว proxy จริง: เลือก upstream, แก้ query, ส่งต่อ body,
// error handling และความครบถ้วนของ stream — ยิงที่ fake upstream ทั้งหมด
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const express = require('express');

const { createFakeUpstream } = require('../helpers/fake-upstream');

// ต้องตั้ง env ก่อน require โมดูลของ proxy เพราะ axios instance
// และ config ถูกสร้างตอน require
delete process.env.REDIS_HOST;
delete process.env.REDIS_PASSWORD;
process.env.MOPH_HCODE = process.env.MOPH_HCODE || '11242';
// /api/slow ของ fake upstream หน่วง 5 วินาที — ตั้ง timeout สั้นกว่าเพื่อทดสอบ 504
process.env.HTTP_TIMEOUT_MS = '1500';

const upstream = createFakeUpstream({ tokenDelayMs: 20 });
let appServer;
let baseUrl;

before(async () => {
  const url = await upstream.listen();
  // ชี้ทุก upstream ไปที่ fake ตัวเดียวกัน (มันบันทึกสิ่งที่ได้รับไว้ให้ตรวจ)
  process.env.MOPH_IC_API = url;
  process.env.MOPH_IC_AUTH = url;
  process.env.EPIDEM_API = url;
  process.env.MOPH_PHR_API = url;
  process.env.MOPH_CLAIM_API = url;
  process.env.FDH_API = url;
  process.env.FDH_AUTH = url;

  const http = require('../../src/http');
  const proxyRouter = require('../../src/api/proxy');

  // seed credential ของทั้งสองแอปให้ request interceptor มี token ใช้ทันที
  await http.getToken({
    force: true,
    username: 'proxy-user',
    password: 'proxy-pass',
  });
  await http.getToken({
    force: true,
    app: 'fdh',
    username: 'fdh-user',
    password: 'fdh-pass',
  });

  const app = express();
  app.use(express.json({ limit: '6mb' }));
  app.use(proxyRouter);
  // error handler ย่อจากตัวจริงใน src/index.js (ส่งต่อ status/body ของ upstream)
  app.use((error, req, res, next) => {
    if (error.response) {
      const forwardableHeaders = {};
      for (const name of ['content-type', 'location']) {
        const value = error.response.headers[name];
        if (value) {
          forwardableHeaders[name] = value;
        }
      }
      res.set(forwardableHeaders);
      return res.status(error.response.status).send(error.response.data);
    }
    res.status(error.statusCode || 500);
    res.json({
      error: { statusCode: error.statusCode || 500, message: error.message },
    });
  });

  appServer = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  baseUrl = `http://127.0.0.1:${appServer.address().port}`;
});

after(async () => {
  await new Promise((resolve) => appServer.close(resolve));
  await upstream.close();
});

// จับ console.log ชั่วคราวเพื่อตรวจรูปแบบบรรทัด correlation log
const captureConsoleLog = async (fn) => {
  const original = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));
  try {
    await fn();
  } finally {
    console.log = original;
  }
  return lines;
};

test('ส่งต่อ path/query โดยลบ endpoint ออกก่อน และไม่รั่วไป upstream', async () => {
  const res = await fetch(`${baseUrl}/api/echo?endpoint=fdh&foo=bar&baz=1`);
  assert.equal(res.status, 200);
  const seen = await res.json();

  const seenUrl = new URL(seen.url, 'http://upstream.local');
  assert.equal(seenUrl.pathname, '/api/echo');
  assert.equal(seenUrl.searchParams.get('foo'), 'bar');
  assert.equal(seenUrl.searchParams.get('baz'), '1');
  assert.equal(
    seenUrl.searchParams.has('endpoint'),
    false,
    'endpoint ต้องไม่รั่วไป upstream'
  );
});

test('เลือก upstream ผ่าน x-api-endpoint header ได้ และแนบ Bearer token', async () => {
  const res = await fetch(`${baseUrl}/api/echo`, {
    headers: { 'x-api-endpoint': 'claim' },
  });
  assert.equal(res.status, 200);
  const seen = await res.json();
  assert.equal(seen.url, '/api/echo');
  assert.match(seen.authorization, /^Bearer v\d+\./);
});

test('method ที่ไม่รองรับตอบ 405 โดยไม่ยิงออกไป upstream', async () => {
  const requestsBefore = upstream.requests.length;
  const res = await fetch(`${baseUrl}/api/echo`, { method: 'OPTIONS' });
  assert.equal(res.status, 405);
  const body = await res.json();
  assert.match(body.message, /allow only GET, POST, PUT, PATCH and DELETE/);
  assert.equal(upstream.requests.length, requestsBefore);
});

test('POST ที่ไม่ใช่ JSON/multipart ตอบ 415', async () => {
  const res = await fetch(`${baseUrl}/api/echo`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: 'hello',
  });
  assert.equal(res.status, 415);
  const body = await res.json();
  assert.match(body.message, /Unsupported Content-Type: text\/plain/);
});

test('POST JSON ส่ง body ต่อไป upstream ครบถ้วน (รวมภาษาไทย)', async () => {
  const payload = { hello: 'สวัสดี', n: 42 };
  const res = await fetch(`${baseUrl}/api/echo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(res.status, 200);
  const seen = await res.json();
  assert.deepEqual(JSON.parse(seen.body), payload);
  assert.match(seen.contentType, /^application\/json/);
});

test('PUT ส่ง body ต่อได้', async () => {
  const res = await fetch(`${baseUrl}/api/echo`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ update: true }),
  });
  assert.equal(res.status, 200);
  const seen = await res.json();
  assert.equal(seen.method, 'PUT');
  assert.deepEqual(JSON.parse(seen.body), { update: true });
});

test('POST multipart ส่งต่อ field และไฟล์ได้ (rebuild ด้วย boundary ใหม่)', async () => {
  const form = new FormData();
  form.append('cid', '1234567890123');
  form.append(
    'file',
    new Blob([Buffer.from('file-content-for-upload-test')]),
    'report.txt'
  );
  const res = await fetch(`${baseUrl}/api/echo`, { method: 'POST', body: form });
  assert.equal(res.status, 200);
  const seen = await res.json();

  assert.match(seen.contentType, /^multipart\/form-data; boundary=/);
  assert.ok(seen.body.includes('1234567890123'), 'ต้องมี field ธรรมดา');
  assert.ok(seen.body.includes('report.txt'), 'ต้องเก็บชื่อไฟล์เดิม');
  assert.ok(
    seen.body.includes('file-content-for-upload-test'),
    'ต้องมีเนื้อไฟล์ครบ'
  );
});

test('error ของ upstream ที่ gzip ต้องถูก decompress แล้วส่งต่ออ่านได้', async () => {
  const res = await fetch(`${baseUrl}/api/gzip-error`);
  assert.equal(res.status, 418);
  // express เติม charset ตอนส่งต่อ body ที่แตก gzip แล้ว จึงเทียบด้วย startsWith
  assert.ok(res.headers.get('content-type').startsWith('application/json'));
  // ห้าม forward content-encoding เพราะ axios แตก gzip ให้แล้ว
  assert.equal(res.headers.get('content-encoding'), null);
  const body = await res.json();
  assert.equal(body.error.message, 'teapot');
});

test('404 จาก upstream ส่งต่อ status และ body เดิม', async () => {
  const res = await fetch(`${baseUrl}/api/nonexistent`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.match(body.message, /Cannot GET \/api\/nonexistent/);
});

test('timeout ต้องตอบ 504 พร้อมรายละเอียด', async () => {
  const res = await fetch(`${baseUrl}/api/slow`);
  assert.equal(res.status, 504);
  const body = await res.json();
  assert.equal(body.message, 'upstream request timeout');
  assert.equal(body.timeoutMs, 1500);
});

test('ส่งต่อ binary ขนาด 1MB แบบ stream ได้ครบทุก byte', async () => {
  const res = await fetch(`${baseUrl}/api/big`);
  assert.equal(res.status, 200);
  const received = Buffer.from(await res.arrayBuffer());

  const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');
  assert.equal(received.length, upstream.bigPayload.length);
  assert.equal(md5(received), md5(upstream.bigPayload));
});

test('log บรรทัดสรุป request ตามรูปแบบ proxy: [id] ... -> host status ระยะเวลา', async () => {
  const lines = await captureConsoleLog(() =>
    fetch(`${baseUrl}/api/echo?unit=log`)
  );
  const line = lines.find((l) => l.includes('/api/echo?unit=log'));
  assert.ok(line, 'ต้องมีบรรทัด log ของ request นี้');
  assert.match(
    line,
    /^proxy: \[[0-9a-f]{8}\] GET \/api\/echo\?unit=log -> 127\.0\.0\.1 200 \d+ms$/
  );
});
