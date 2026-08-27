// ทดสอบการอ่านค่า config จาก environment โดยเฉพาะกรณีขอบ (edge case)
// ของ HTTP_RETRIES ที่เคยกลายเป็น 0 โดยไม่ตั้งใจเมื่อ env ถูกปล่อยว่าง
const { test } = require('node:test');
const assert = require('node:assert/strict');

const CONFIG_PATH = '../../src/config';

// config อ่าน env ตอน require จึงต้องล้าง module cache แล้ว require ใหม่
// เพื่อจำลอง process ที่เพิ่ง start ด้วย env ชุดใหม่ พร้อมคืนค่า env เดิมหลังจบ
const loadConfig = (envOverrides = {}) => {
  const saved = {};
  for (const [key, value] of Object.entries(envOverrides)) {
    saved[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  delete require.cache[require.resolve(CONFIG_PATH)];
  try {
    return require(CONFIG_PATH);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

// ทุกเคสปกติต้องมี MOPH_HCODE ไม่งั้น require จะ throw ก่อนถึงส่วนที่สนใจ
const withHcode = (extra = {}) => ({ MOPH_HCODE: '11242', ...extra });

test('HTTP_RETRIES ค่า default เป็น 1 เมื่อไม่ได้ตั้งค่า', () => {
  const config = loadConfig(withHcode({ HTTP_RETRIES: undefined }));
  assert.equal(config.HTTP_RETRIES, 1);
});

test("HTTP_RETRIES เป็นตัวเลขต้องได้ตัวเลขนั้น ('3' -> 3)", () => {
  const config = loadConfig(withHcode({ HTTP_RETRIES: '3' }));
  assert.equal(config.HTTP_RETRIES, 3);
});

test("HTTP_RETRIES เป็น '0' ต้องได้ 0 (ปิด retry ได้จริงตามที่ตั้งใจ)", () => {
  const config = loadConfig(withHcode({ HTTP_RETRIES: '0' }));
  assert.equal(config.HTTP_RETRIES, 0);
});

test("HTTP_RETRIES เป็นข้อความที่ไม่ใช่ตัวเลขต้องกลับไป default 1", () => {
  const config = loadConfig(withHcode({ HTTP_RETRIES: 'abc' }));
  assert.equal(config.HTTP_RETRIES, 1);
});

test('HTTP_RETRIES ว่างเปล่า (env file ปล่อยว่าง) ต้องไม่กลายเป็น 0', () => {
  const config = loadConfig(withHcode({ HTTP_RETRIES: '' }));
  assert.equal(config.HTTP_RETRIES, 1);
});

test('ไม่มี MOPH_HCODE ต้อง throw ตั้งแต่ตอน start', () => {
  assert.throws(
    () => loadConfig({ MOPH_HCODE: undefined }),
    /Fatal error: Environment is required \[MOPH_HCODE\]/
  );
});

test('ค่า default ของ upstream, timeout และ body limit', () => {
  const config = loadConfig(
    withHcode({
      MOPH_IC_API: undefined,
      MOPH_IC_AUTH: undefined,
      FDH_API: undefined,
      FDH_AUTH: undefined,
      MOPH_CLAIM_API: undefined,
      HTTP_TIMEOUT_MS: undefined,
      BODY_LIMIT: undefined,
      USE_API_KEY: undefined,
    })
  );
  assert.equal(config.MOPH_IC_API, 'https://cvp1.moph.go.th');
  assert.equal(config.MOPH_IC_AUTH, 'https://cvp1.moph.go.th');
  assert.equal(config.FDH_API, 'https://fdh.moph.go.th');
  // FDH เป็น identity provider ของ claim จึงต้องคนละ host กับ claim API
  assert.equal(config.MOPH_CLAIM_API, 'https://claim-nhso.moph.go.th');
  assert.equal(config.HTTP_TIMEOUT_MS, 30000);
  assert.equal(config.BODY_LIMIT, '6mb');
  assert.equal(config.USE_API_KEY, true); // ค่า default คือเปิดใช้ API key
});
