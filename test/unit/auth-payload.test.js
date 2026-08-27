// ทดสอบการสร้าง auth payload และเทียบ payload กับที่เก็บไว้ใน cache
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

// ตั้ง secret ของสองแอปให้ต่างกัน เพื่อตรวจว่า payload ผูกกับ app ถูกต้อง
// และกันกรณี shell มีค่าเดิมอยู่ทำให้ผลรันไม่แน่นอน
delete process.env.REDIS_HOST;
process.env.MOPH_HCODE = process.env.MOPH_HCODE || '11242';
process.env.MOPH_IC_AUTH_SECRET = 'ic-unit-secret';
process.env.FDH_AUTH_SECRET = 'fdh-unit-secret';

const {
  createAuthPayload,
  isCurrentAuthPayload,
  ALLOWED_APPS,
} = require('../../src/helper/auth-payload');
const cache = require('../../src/cache');

// hash อ้างอิงคำนวณด้วย crypto ตรง ๆ (แยกจาก implementation)
const refHash = (password, secretKey) =>
  crypto.createHmac('sha256', secretKey).update(password).digest('hex');

test('createAuthPayload สร้าง payload ตามโครงสร้างที่ API ต้องการ', () => {
  const payload = createAuthPayload('mophuser', 'plain-pass', 'the-secret');
  assert.deepEqual(payload, {
    user: 'mophuser',
    password_hash: refHash('plain-pass', 'the-secret'),
    hospital_code: '11242',
  });
});

test('ALLOWED_APPS มีแค่ mophic และ fdh', () => {
  assert.deepEqual(ALLOWED_APPS, ['mophic', 'fdh']);
});

test('isCurrentAuthPayload เทียบกับ payload ล่าสุดใน cache', async () => {
  const payload = createAuthPayload(
    'mophuser',
    'plain-pass',
    process.env.MOPH_IC_AUTH_SECRET
  );
  await cache.set('mophic-auth-payload', JSON.stringify(payload));

  assert.equal(
    await isCurrentAuthPayload('mophic', 'mophuser', 'plain-pass'),
    true
  );
  assert.equal(
    await isCurrentAuthPayload('mophic', 'mophuser', 'wrong-pass'),
    false
  );
});

test('isCurrentAuthPayload ของอีกแอปต้องไม่ตรง (secret ต่างกัน)', async () => {
  const payload = createAuthPayload(
    'mophuser',
    'plain-pass',
    process.env.MOPH_IC_AUTH_SECRET
  );
  await cache.set('mophic-auth-payload', JSON.stringify(payload));
  await cache.del('fdh-auth-payload');

  assert.equal(
    await isCurrentAuthPayload('fdh', 'mophuser', 'plain-pass'),
    false
  );
});

test('isCurrentAuthPayload คืน false เมื่อยังไม่มีข้อมูลใน cache', async () => {
  await cache.del('fdh-auth-payload');
  assert.equal(
    await isCurrentAuthPayload('fdh', 'mophuser', 'plain-pass'),
    false
  );
});
