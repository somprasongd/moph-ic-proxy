// ทดสอบการสร้าง/ตรวจ API key
// ชี้ไฟล์ key ไปที่ temp directory ผ่าน API_KEY_FILE เพื่อไม่แตะไฟล์จริงในโปรเจกต์
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const apiKeyHelper = require('../../src/helper/api-key');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moph-proxy-keygen-'));
process.env.API_KEY_FILE = path.join(tmpDir, 'keys', '.access.key');
process.on('exit', () => fs.rmSync(tmpDir, { recursive: true, force: true }));

const keygen = require('../../src/helper/keygen');

test('init สร้างไฟล์ key ครั้งแรกและ verify คีย์นั้นผ่าน', async () => {
  await keygen.init();

  const apiKey = keygen.getApiKey();
  assert.ok(apiKeyHelper.isApiKey(apiKey), 'ต้องอยู่ในรูปแบบ API key');
  assert.ok(
    fs.existsSync(process.env.API_KEY_FILE),
    'ต้องมีไฟล์เก็บ uuid ไว้ใช้ต่อหลัง restart'
  );
  assert.equal(keygen.verify(apiKey), true);
});

test('verify คีย์รูปแบบถูกแต่เป็นคนละตัวต้อง false', async () => {
  const other = apiKeyHelper.create();
  assert.equal(keygen.verify(other.apiKey), false);
});

test('verify คีย์มั่วหรือว่างเปล่าต้อง false', () => {
  assert.equal(keygen.verify('not-a-key'), false);
  assert.equal(keygen.verify(''), false);
});

test('require ใหม่ (จำลอง restart) ต้องอ่านคีย์เดิมจากไฟล์', async () => {
  const firstKey = keygen.getApiKey();

  delete require.cache[require.resolve('../../src/helper/keygen')];
  const keygenReloaded = require('../../src/helper/keygen');
  await keygenReloaded.init();

  assert.equal(keygenReloaded.getApiKey(), firstKey);
});
