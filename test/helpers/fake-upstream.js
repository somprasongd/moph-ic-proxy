// จำลอง upstream ของ MOPH เพื่อทดสอบ proxy/token flow โดยไม่ต้องยิงออก internet
// เก็บทุก request ที่ได้รับไว้ใน `requests` เพื่อให้ test ตรวจย้อนได้ว่า proxy ส่งอะไรมา
const http = require('http');
const zlib = require('zlib');
const crypto = require('crypto');

// สร้าง JWT ปลอมที่ decode ได้ (โค้ดจริงแค่ jwt_decode ไม่ได้ตรวจลายเซ็น)
const makeJwt = (expiresInSeconds = 3600) => {
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const payload = b64url({ exp: Math.floor(Date.now() / 1000) + expiresInSeconds });
  const signature = b64url({ sig: 'fake' });
  return `${header}.${payload}.${signature}`;
};

function createFakeUpstream(options = {}) {
  const tokenDelayMs = options.tokenDelayMs || 0;
  const tokenTtlSeconds = options.tokenTtlSeconds || 3600;
  const slowMs = options.slowMs || 5000;

  // ออก token เป็นเวอร์ชันกันหัวชน เพื่อให้ทดสอบ refresh แยก token เก่า/ใหม่ออกจากกันได้
  let tokenVersion = 0;
  // /api/stale ตอบ 401 ครั้งแรกครั้งเดียวแล้วยอมรับทุก token หลังจากนั้น
  // (จำลอง token หมดอายุแล้วได้ token ใหม่จากการ retry)
  let staleRejected = false;

  const requests = [];
  const hits = { token: 0, byPath: new Map() };

  const bigPayload = crypto.randomBytes(1024 * 1024);

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const pathname = req.url.split('?')[0];
      hits.byPath.set(pathname, (hits.byPath.get(pathname) || 0) + 1);
      requests.push({
        method: req.method,
        url: req.url,
        pathname,
        headers: { ...req.headers },
        body,
      });

      const json = (status, obj, extraHeaders = {}) => {
        res.writeHead(status, {
          'Content-Type': 'application/json',
          ...extraHeaders,
        });
        res.end(JSON.stringify(obj));
      };

      // endpoint ขอโทเคน — user เป็น 'bad' จะได้ 401 เหมือนกรอกรหัสผิด
      if (pathname === '/token') {
        hits.token += 1;
        let user = '';
        try {
          user = JSON.parse(body.toString()).user;
        } catch (error) {
          // body ไม่ใช่ json ก็ปล่อยผ่านไปตรวจแค่ user
        }
        if (user === 'bad') {
          return json(401, { error: 'invalid username or password' });
        }
        tokenVersion += 1;
        const token = `v${tokenVersion}.${makeJwt(tokenTtlSeconds)}`;
        const send = () => {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end(token);
        };
        return tokenDelayMs ? setTimeout(send, tokenDelayMs) : send();
      }

      // ตอกลับสิ่งที่ upstream เห็น เพื่อตรวจว่า proxy แก้ query/body ถูกต้อง
      if (pathname === '/api/echo') {
        return json(200, {
          method: req.method,
          url: req.url,
          authorization: req.headers.authorization || null,
          contentType: req.headers['content-type'] || null,
          body: body.toString(),
        });
      }

      // ตอบ 401 กับ request แรกลงมา (จำลอง token หมดอายุ) แล้วยอมรับ token ใหม่
      if (pathname === '/api/stale') {
        if (!staleRejected) {
          staleRejected = true;
          return json(401, { error: 'token expired' });
        }
        return json(200, { ok: true });
      }

      // error พร้อม body ที่ gzip จริง เหมือน upstream ปกติทั่วไป
      if (pathname === '/api/gzip-error') {
        const gz = zlib.gzipSync(
          Buffer.from(JSON.stringify({ error: { message: 'teapot' } }))
        );
        res.writeHead(418, {
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
          'Content-Length': gz.length,
        });
        return res.end(gz);
      }

      // binary ขนาด 1MB สำหรับทดสอบความครบถ้วนของ stream
      if (pathname === '/api/big') {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        return res.end(bigPayload);
      }

      // ช้ากว่า HTTP_TIMEOUT_MS ของ test เพื่อทดสอบ 504
      if (pathname === '/api/slow') {
        return setTimeout(() => json(200, { ok: true }), slowMs);
      }

      // เส้นทางอื่น ๆ ตอบ 404 เลียนแบบ express
      return json(404, { message: `Cannot ${req.method} ${pathname}` });
    });
  });

  let url = null;
  const listen = () =>
    new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        url = `http://127.0.0.1:${server.address().port}`;
        resolve(url);
      });
    });
  const close = () => new Promise((resolve) => server.close(() => resolve()));

  return { server, listen, close, requests, hits, bigPayload };
}

module.exports = { createFakeUpstream };
