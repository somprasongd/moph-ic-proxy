// ทดสอบการ hash รหัสผ่านด้วย HMAC-SHA256 เทียบกับ known vector ภายนอก
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { hashPassword } = require('../../src/helper/password');

test('hash ตรงกับ known vector ของ HMAC-SHA256', () => {
  // ค่าคาดหวังคำนวณแยกด้วย openssl เพื่อรับประกันว่า implementation ไม่เปลี่ยน:
  // echo -n 's3cret-passw0rd' | openssl dgst -sha256 -hmac 'unit-test-secret'
  assert.equal(
    hashPassword('s3cret-passw0rd', 'unit-test-secret'),
    '0fcd3f631018f8a2e8fc61a7e05c3e03a80d97097a568d18cb58aab04a0f0bd5'
  );
});

test('secret ต่างกันต้องได้ hash ต่างกัน (แยกแยะ mophic/fdh ได้)', () => {
  assert.notEqual(
    hashPassword('pass', 'secret-a'),
    hashPassword('pass', 'secret-b')
  );
});

test('password ต่างกันต้องได้ hash ต่างกัน', () => {
  assert.notEqual(
    hashPassword('pass-a', 'secret'),
    hashPassword('pass-b', 'secret')
  );
});

test('hash เป็น hex 128 ตัวอักษร', () => {
  assert.match(hashPassword('x', 'y'), /^[0-9a-f]{64}$/);
});
