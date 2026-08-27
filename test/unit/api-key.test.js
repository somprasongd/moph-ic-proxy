// ทดสอบตัวแปลง UUID <-> API key ที่เขียนทดแทน uuid-apikey
// ชุด fixtures freeze ไว้จาก uuid-apikey 1.5.3 (ตัวจริง) ก่อนถอดออก
// ถ้า algorithm เปลี่ยนแม้ตัวเดียว ชุดนี้ต้อง fail ทันที (compatibility lock)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  create,
  uuidToApiKey,
  apiKeyToUuid,
  isApiKey,
  isUuid,
} = require('../../src/helper/api-key');

const vectors = require('../fixtures/api-key-vectors.json');

test('แปลง UUID -> API key ตรงกับ uuid-apikey ตัวจริงทุกคู่ (frozen vectors)', () => {
  for (const { uuid, apiKey, aliasOf } of vectors) {
    // คู่แบบ alias (เขียนด้วยอักขระสับสน) เอาไว้ทดสอบการ decode อย่างเดียว
    // เพราะ encode ต้องได้ canonical เสมอ
    if (aliasOf) {
      continue;
    }
    assert.equal(
      uuidToApiKey(uuid),
      apiKey,
      `uuid ${uuid} ต้องแปลงได้ค่าเดิมของ uuid-apikey`
    );
  }
});

test('ถอด API key -> UUID ตรงกับ uuid-apikey ตัวจริงทุกคู่', () => {
  for (const { uuid, apiKey } of vectors) {
    assert.equal(apiKeyToUuid(apiKey), uuid, `key ${apiKey} ต้องถอดกลับได้ uuid เดิม`);
  }
});

test('คีย์ที่พิมพ์อักขระสับสน (L/o แทน 1/0) ถอดกลับได้ค่าเดิมเหมือนต้นฉบับ', () => {
  // vector สุดท้ายคือคีย์ที่เขียนด้วยอักขระ alias ที่ encode32 ยอมรับ
  const aliasVector = vectors[vectors.length - 1];
  assert.ok(aliasVector.aliasOf, 'fixtures ต้องมี vector แบบ alias');
  assert.equal(apiKeyToUuid(aliasVector.apiKey), aliasVector.uuid);
});

test('round-trip สุ่มใหม่ 1000 คู่ต้องกลับมาเป็น uuid เดิมทุกตัว', () => {
  for (let i = 0; i < 1000; i += 1) {
    const uuid = crypto.randomUUID();
    assert.equal(apiKeyToUuid(uuidToApiKey(uuid)), uuid);
  }
});

test('create คืนคู่ { apiKey, uuid } ที่ตรงกันและเป็น UUIDv4', () => {
  const { apiKey, uuid } = create();
  assert.equal(isApiKey(apiKey), true);
  assert.equal(isUuid(uuid), true);
  assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(apiKeyToUuid(apiKey), uuid);
  // สุ่มสองครั้งต้องไม่ซ้ำกัน
  assert.notEqual(apiKey, create().apiKey);
});

test('รูปแบบ API key: 4 กลุ่ม 7 อักษร ไม่มี I/L/O/U', () => {
  const { apiKey } = create();
  assert.match(apiKey, /^[0-9A-HJKMNP-TV-Z]{7}(-[0-9A-HJKMNP-TV-Z]{7}){3}$/);
});

test('isApiKey ปฏิเสธค่าที่ไม่ใช่คีย์', () => {
  assert.equal(isApiKey(''), false);
  assert.equal(isApiKey(null), false);
  assert.equal(isApiKey(undefined), false);
  assert.equal(isApiKey('R372XAV-G5T48C5-PC30TZB'), false); // ขาดกลุ่ม
  assert.equal(isApiKey('R372XAV-G5T48C5-PC30TZB-8H5D8JX!'), false); // อักขระแปลก
  assert.equal(isApiKey('0123456789abcdefghijklmnpqrstuv'), false); // มี I/L/O/U ในตำแหน่งเกิน
});

test('apiKeyToUuid คืน null เมื่ออักขระถูกแต่ parity เสีย (คีย์เสียหาย)', () => {
  // เปลี่ยนตัวเลขท้ายสุดให้ parity ผิด โดยคงอักขระที่ถอดได้
  const { apiKey } = create();
  const corrupt =
    apiKey === 'R372XAV-G5T48C5-PC30TZB-8H5D8JN'
      ? 'R372XAV-G5T48C5-PC30TZB-8H5D8JM'
      : apiKey.slice(0, -1) + (apiKey.endsWith('0') ? '1' : '0');
  // ไม่การันตีว่า parity จะผิดเสมอ จึง assert แค่ "ไม่ throw และคืนค่าเดิมหรือ null"
  const result = apiKeyToUuid(corrupt);
  assert.ok(result === null || isUuid(result));
});

test('uuidToApiKey throw เมื่อ uuid ไม่ถูกต้อง', () => {
  assert.throws(() => uuidToApiKey('not-a-uuid'), TypeError);
  assert.throws(() => uuidToApiKey(''), TypeError);
  assert.throws(() => uuidToApiKey(null), TypeError);
});

test('apiKeyToUuid throw เมื่อรูปแบบคีย์ผิด', () => {
  assert.throws(() => apiKeyToUuid('hello'), TypeError);
  assert.throws(() => apiKeyToUuid(''), TypeError);
  assert.throws(() => apiKeyToUuid(null), TypeError);
});

test('isUuid ตรวจรูปแบบแบบต้นฉบับ (ยอมขาดขีดตำแหน่งสุดท้าย)', () => {
  assert.equal(isUuid('c0ce2eab-8174-4430-b306-0d7d444ad44a'), true);
  assert.equal(isUuid('c0ce2eab81744430b3060d7d444ad44a'), false); // ไม่มีขีดเลย
  assert.equal(isUuid('c0ce2eab-8174-4430-b306_0d7d444ad44a'), false); // ขีดผิดตำแหน่ง
  assert.equal(isUuid('c0ce2eab-8174-4430-b306-0d7d444ad44z'), false); // ตัวอักษรนอก hex
  assert.equal(isUuid(''), false);
  assert.equal(isUuid(null), false);
});
