// ทดสอบ helper ถอด Bearer token ออกจาก axios config ก่อนเขียน log
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { redactConfig } = require('../../src/helper/redact');

test('แทน Authorization ด้วย Bearer *** และไม่แก้ต้นฉบับ', () => {
  const config = {
    method: 'get',
    url: '/api/v1/opd',
    headers: {
      Authorization: 'Bearer real-jwt-token',
      'Content-Type': 'application/json',
    },
  };
  const safe = redactConfig(config);

  assert.equal(safe.headers.Authorization, 'Bearer ***');
  // ต้นฉบับต้องยังเก็บ token จริงอยู่ (ต้องไม่ mutate ค่าที่ axios กำลังใช้)
  assert.equal(config.headers.Authorization, 'Bearer real-jwt-token');
  assert.equal(safe.headers['Content-Type'], 'application/json');
  assert.equal(safe.url, '/api/v1/opd');
});

test('header อื่นที่ไม่มี Authorization ผ่านได้ครบถ้วน', () => {
  const safe = redactConfig({ headers: { Accept: 'application/json' } });
  assert.equal(safe.headers.Accept, 'application/json');
});

test('config ที่ไม่มี headers เลยไม่พัง และคืนข้อมูลส่วนอื่นครบ', () => {
  const safe = redactConfig({ url: '/x' });
  assert.equal(safe.url, '/x');
  assert.equal(safe.headers, undefined);
});

test('config เป็น null/undefined คืนค่าเดิมตามที่รับมา', () => {
  assert.equal(redactConfig(null), null);
  assert.equal(redactConfig(undefined), undefined);
});
