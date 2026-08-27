// ทดสอบ in-memory fallback ของ cache (ใช้เมื่อไม่ได้ตั้ง REDIS_HOST)
// รวม regression ของ TTL overflow ที่เคยทำให้ token หายหลังจาก set ไป 1ms
const { test, before } = require('node:test');
const assert = require('node:assert/strict');

// บังคับใช้ memory backend ไม่งั้นเครื่องที่รัน Redis อยู่จะทดสอบไม่ตรงกัน
delete process.env.REDIS_HOST;
delete process.env.REDIS_PASSWORD;
// cache module require config ตอนโหลด จึงต้องมี MOPH_HCODE ก่อน
process.env.MOPH_HCODE = process.env.MOPH_HCODE || '11242';

const cache = require('../../src/cache');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

before(async () => {
  // เหมือนตอน start จริงที่ index.js เรียก createClient ก่อนใช้งาน
  await cache.createClient();
});

test('backend เป็น memory เมื่อไม่ได้ตั้ง REDIS_HOST', () => {
  assert.equal(cache.getBackend(), 'memory');
});

test('get คีย์ที่ไม่มีอยู่ได้ null', async () => {
  assert.equal(await cache.get('unit:missing'), null);
});

test('set แล้ว get ได้ค่าเดิม', async () => {
  await cache.set('unit:k1', 'hello');
  assert.equal(await cache.get('unit:k1'), 'hello');
});

test('set ค่าเดิมซ้ำได้ (ไม่ error)', async () => {
  await cache.set('unit:k1', 'world');
  assert.equal(await cache.get('unit:k1'), 'world');
});

test('setex แบบเวลาอดีตลบคีย์ทิ้งทันที', async () => {
  await cache.set('unit:past', 'x');
  await cache.setex('unit:past', 'x', Math.floor(Date.now() / 1000) - 10);
  assert.equal(await cache.get('unit:past'), null);
});

test('setex หมดอายุตามเวลาจริง', async () => {
  await cache.setex('unit:ttl', 'temp', Math.floor(Date.now() / 1000) + 1);
  assert.equal(await cache.get('unit:ttl'), 'temp');
  await sleep(1300);
  assert.equal(await cache.get('unit:ttl'), null);
});

test('setex TTL ยาวกว่าขอบ setTimeout ต้องไม่หายกะทันหัน', async () => {
  // regression: delay เกิน 2147483647ms เดิมโดน Node บีบเหลือ 1ms
  // ทำให้ token ที่ควรอยู่นานหายทันทีที่ set
  const farFuture = 4102444800; // 2100-01-01
  await cache.setex('unit:far', 'long-lived', farFuture);
  await sleep(50);
  assert.equal(await cache.get('unit:far'), 'long-lived');
});

test('del ลบคีย์และคืนจำนวนที่ลบได้', async () => {
  await cache.set('unit:del', 'x');
  assert.equal(await cache.del('unit:del'), 1);
  assert.equal(await cache.get('unit:del'), null);
  assert.equal(await cache.del('unit:del'), 0);
});

test('close ปิด timer แล้วยังใช้งาน memory ต่อได้', async () => {
  await cache.set('unit:close', 'still-here');
  await cache.close();
  assert.equal(await cache.get('unit:close'), 'still-here');
});
