// แปลง UUID <-> API key ที่อ่านง่าย (Base32 แบบ Crockford + parity)
// ทดแทน dependency uuid-apikey 1.5.3 + encode32 ด้วยโค้ดใน repo เอง
// เพื่อตัด uuid@8 (มีช่องโหว่ moderate) ออกจาก dependency tree
//
// Algorithm ทำตามต้นฉบับเป๊ะ ๆ เพื่อ backward compatible กับคีย์ที่ออกให้ผู้ใช้ไปแล้ว:
// - uuid-apikey (MIT, github.com/chronosis/uuid-apikey)
// - encode32 (MIT, github.com/femto113/node-encode32)
//
// หลักการ: แยก UUID เป็น 4 ชิ้น 8-hex (เลข 32-bit) แล้วแปลงแต่ละชิ้น
// เป็นอักษร Base32 จำนวน 7 ตัว (35 บิต = 32 บิตข้อมูล + 3 บิต parity checksum
// ยัดไว้ในบิตที่เหลือของอักษรตัวสุดท้าย) รวมเป็น XXXXXXX-XXXXXXX-XXXXXXX-XXXXXXX
const crypto = require('crypto');

// ชุดอักษร Base32 แบบ Crockford: ตัด I, L, O (สับสนกับ 1, 0) และ U
// ต้องเรียงแบบนี้เหมือน encode32 เป๊ะ ๆ ไม่งั้นค่าที่แปลงออกจะไม่ตรงกับของเดิม
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

// ตารางถอดรหัส: อักขระที่คนมองสับสนยอมรับเป็น alias (ทำตาม encode32)
const DECODE_TABLE = new Map();
[...ALPHABET].forEach((char, value) => {
  DECODE_TABLE.set(char, value);
  DECODE_TABLE.set(char.toLowerCase(), value);
});
DECODE_TABLE.set('I', DECODE_TABLE.get('1'));
DECODE_TABLE.set('i', DECODE_TABLE.get('1'));
DECODE_TABLE.set('L', DECODE_TABLE.get('1'));
DECODE_TABLE.set('l', DECODE_TABLE.get('1'));
DECODE_TABLE.set('O', DECODE_TABLE.get('0'));
DECODE_TABLE.set('o', DECODE_TABLE.get('0'));

// parity 3-bit ของเลข 32-bit: XOR ของทุกกลุ่ม 3 บิต (เทียบได้กับหลักฐาน 8)
// ใช้ตรวจว่าคีย์ถูกพิมพ์/คัดลอกผิดหรือไม่
const parity3 = (n) => {
  let parity = 0;
  while (n > 7) {
    parity ^= n & 0x7;
    n >>>= 3;
  }
  return parity ^ n;
};

// แปลงเลข 32-bit เป็นอักษร Base32 จำนวน 7 ตัว (ติด parity 3 บิตท้าย)
const encode32 = (n) => {
  const bits =
    (n >>> 0).toString(2).padStart(32, '0') +
    parity3(n).toString(2).padStart(3, '0');
  let out = '';
  for (let i = 0; i < 35; i += 5) {
    out += ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
};

// ถอดอักษร Base32 จำนวน 7 ตัวกลับเป็นเลข 32-bit
// คืน NaN ถ้าความยาวผิด อักขระไม่รู้จัก หรือ parity ไม่ผ่าน
const decode32 = (s) => {
  if (s.length !== 7) {
    return NaN;
  }
  const values = [];
  for (const char of s) {
    const value = DECODE_TABLE.get(char);
    if (value === undefined) {
      return NaN;
    }
    values.push(value);
  }
  // 3 บิตล่างของอักษรสุดท้ายคือ parity ที่ติดมาตอนเข้ารหัส
  const check = values[6] & 0x7;
  // ใช้คูณแทน shift เพราะค่าเต็ม 32 บิตใหญ่กว่า signed int32
  let n = 0;
  for (let i = 0; i < 6; i += 1) {
    n = n * 32 + values[i];
  }
  n = n * 4 + (values[6] >>> 3);
  return check === parity3(n) ? n : NaN;
};

// ตรวจรูปแบบ UUID (ยอมให้ขาดขีดที่ตำแหน่งสุดท้ายเหมือนต้นฉบับ
// เพราะบางระบบเช่น ColdFusion สร้างแบบนั้น)
const isUuid = (uuid) => {
  if (!uuid) {
    return false;
  }
  const dashOk = [8, 13, 18].every((pos) => uuid.charAt(pos) === '-');
  const compact = uuid.replace(/-/g, '');
  return dashOk && compact.length === 32 && /^[0-9a-f]+$/i.test(compact);
};

// ตรวจรูปแบบ API key: 28 อักขระ (ไม่นับขีด) ที่ถอดรหัสได้จริง
// เข้มกว่าต้นฉบับ (เดิมเช็คแค่ความยาว) แต่ครอบคลุมทุกคีย์ที่ต้นฉบับถอดได้
const isApiKey = (apiKey) => {
  if (!apiKey) {
    return false;
  }
  const compact = apiKey.toUpperCase().replace(/-/g, '');
  return (
    compact.length === 28 && [...compact].every((c) => DECODE_TABLE.has(c))
  );
};

// แปลง UUID -> API key เช่น c0ce2eab-8174-4430-b306-0d7d444ad44a
//   -> R372XAV-G5T48C5-PC30TZB-8H5D8JN
const uuidToApiKey = (uuid, options = {}) => {
  if (!isUuid(uuid)) {
    throw new TypeError(`The value provided '${uuid}' is not a valid uuid.`);
  }
  const compact = uuid.replace(/-/g, '');
  const segments = [];
  for (let i = 0; i < 32; i += 8) {
    segments.push(encode32(Number(`0x${compact.slice(i, i + 8)}`)));
  }
  return segments.join(options.noDashes ? '' : '-');
};

// ถอด API key กลับเป็น UUID — คืน null ถ้ารูปแบบถูกแต่ข้อมูลเสียหาย (parity ไม่ผ่าน)
// เพื่อให้ verify() ของ keygen จัดการคีย์แปลก ๆ ได้โดยไม่ throw
const apiKeyToUuid = (apiKey) => {
  if (!isApiKey(apiKey)) {
    throw new TypeError(
      `The value provided '${apiKey}' is not a valid apiKey.`
    );
  }
  const compact = apiKey.replace(/-/g, '');
  const parts = [];
  for (let i = 0; i < 28; i += 7) {
    const n = decode32(compact.slice(i, i + 7));
    if (Number.isNaN(n)) {
      return null;
    }
    parts.push(n.toString(16).padStart(8, '0'));
  }
  const [a, b, c, d] = parts;
  return `${a}-${b.slice(0, 4)}-${b.slice(4)}-${c.slice(0, 4)}-${c.slice(4)}${d}`;
};

// สุ่มคีย์ใหม่พร้อม uuid ต้นทาง (ใช้ randomUUID ของ Node แทน dependency uuid)
const create = () => {
  const uuid = crypto.randomUUID();
  return { apiKey: uuidToApiKey(uuid), uuid };
};

module.exports = {
  create,
  uuidToApiKey,
  apiKeyToUuid,
  isApiKey,
  isUuid,
};
