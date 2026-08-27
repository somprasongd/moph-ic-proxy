// ทดสอบ middleware ตรวจ x-api-key ทั้งโหมดเปิด/ปิด
// และการ strip คีย์ออกจาก query ก่อนส่งต่อให้ upstream เสมอ
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ชี้ไฟล์ key ไปที่ temp directory กันเขียนทับไฟล์จริง
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moph-proxy-auth-'));
process.env.API_KEY_FILE = path.join(tmpDir, 'keys', '.access.key');
process.env.MOPH_HCODE = process.env.MOPH_HCODE || '11242';
process.on('exit', () => fs.rmSync(tmpDir, { recursive: true, force: true }));

const MODULES = [
  '../../src/config',
  '../../src/helper/keygen',
  '../../src/middleware/use-auth',
];

// config อ่าน USE_API_KEY ตอน require จึงต้องล้าง cache แล้วโหลดใหม่
// ทุกครั้งที่จะทดสอบด้วยค่าต่างกัน
const loadMiddleware = async (useApiKey) => {
  process.env.USE_API_KEY = String(useApiKey);
  for (const mod of MODULES) {
    delete require.cache[require.resolve(mod)];
  }
  const keygen = require('../../src/helper/keygen');
  const { validateApikey } = require('../../src/middleware/use-auth');
  await keygen.init();
  return { validateApikey, keygen };
};

// req ปลอมที่มีแค่ส่วนที่ middleware ใช้จริง
const makeReq = ({ headerKey = null, query = {} } = {}) => ({
  header: (name) => (name === 'x-api-key' ? headerKey : undefined),
  query: { ...query },
});

const run = (validateApikey, req) =>
  new Promise((resolve) => {
    const next = (err) => resolve({ err, query: req.query });
    validateApikey(req, {}, next);
  });

test('USE_API_KEY=true: ไม่ส่งคีย์ต้องตอบ 401', async () => {
  const { validateApikey } = await loadMiddleware(true);
  const { err } = await run(validateApikey, makeReq());
  assert.equal(err.statusCode, 401);
  assert.match(err.message, /No x-api-key provided/);
});

test('USE_API_KEY=true: คีย์รูปแบบไม่ถูกต้องต้องตอบ 400', async () => {
  const { validateApikey } = await loadMiddleware(true);
  const { err } = await run(
    validateApikey,
    makeReq({ headerKey: 'WRONG-KEY' })
  );
  assert.equal(err.statusCode, 400);
  assert.match(err.message, /Invalid x-api-key/);
});

test('USE_API_KEY=true: คีย์ถูกต้องทาง header ผ่านได้', async () => {
  const { validateApikey, keygen } = await loadMiddleware(true);
  const { err } = await run(
    validateApikey,
    makeReq({ headerKey: keygen.getApiKey(), query: { endpoint: 'fdh' } })
  );
  assert.equal(err, undefined);
});

test('USE_API_KEY=true: คีย์ผ่าน query ต้องถูกลบออกก่อนส่งต่อ', async () => {
  const { validateApikey, keygen } = await loadMiddleware(true);
  const { err, query } = await run(
    validateApikey,
    makeReq({
      query: {
        'x-api-key': keygen.getApiKey(),
        endpoint: 'fdh',
      },
    })
  );
  assert.equal(err, undefined);
  assert.equal('x-api-key' in query, false);
  // parameter อื่นต้องอยู่ครบไม่ถูกลบไปด้วย
  assert.equal(query.endpoint, 'fdh');
});

test('USE_API_KEY=false: ไม่ต้องมีคีย์แต่ยัง strip query กัน leak', async () => {
  const { validateApikey } = await loadMiddleware(false);
  const { err, query } = await run(
    validateApikey,
    makeReq({ query: { 'x-api-key': 'ANYTHING' } })
  );
  assert.equal(err, undefined);
  assert.equal('x-api-key' in query, false);
});
