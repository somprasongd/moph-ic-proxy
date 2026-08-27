// จัดการสร้างและตรวจสอบ API Key ที่ใช้ป้องกันการเข้าถึงระบบ
const fs = require('fs');
const path = require('path');
const util = require('util');
const apiKeyHelper = require('./api-key');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

// กำหนดตำแหน่งไฟล์ key ได้ผ่าน API_KEY_FILE เพื่อใช้ใน unit test
// โดยไม่ต้องเขียนทับไฟล์จริงในโปรเจกต์
const keygenFile =
  process.env.API_KEY_FILE ||
  path.join(__dirname, '..', '..', '.authorized_key', '.access.key');

if (!fs.existsSync(path.dirname(keygenFile))) {
  // สร้างโฟลเดอร์เก็บไฟล์ key ล่วงหน้าหากยังไม่มี
  fs.mkdirSync(path.dirname(keygenFile));
}

let secret;
let apiKey;
async function init() {
  try {
    // พยายามอ่าน secret ที่เคยสร้างไว้ก่อน
    secret = await readFile(keygenFile, { encoding: 'utf8' });
    apiKey = apiKeyHelper.uuidToApiKey(secret);
  } catch (readError) {
    try {
      // ถ้าไม่มีให้สุ่ม key ใหม่แล้วบันทึกเป็นไฟล์
      const key = apiKeyHelper.create();
      await writeFile(keygenFile, key.uuid, { encoding: 'utf8' });
      secret = key.uuid;
      apiKey = key.apiKey;
    } catch (writeError) {
      console.error('Unable to initialize API key store', writeError);
      throw writeError;
    }
  }
  // console.log(`Your api key is ${apiKey}`);
  console.log(`Enable API Key: true`);
}

function verify(apiKey) {
  // ตรวจสอบรูปแบบและเทียบ UUID เพื่อยืนยันว่า key ถูกต้อง
  if (!apiKey || !apiKeyHelper.isApiKey(apiKey)) {
    return false;
  }

  // คีย์รูปแบบถูกแต่ข้อมูลเสียหาย (parity ไม่ผ่าน) จะได้ null กลับมา
  if (apiKeyHelper.apiKeyToUuid(apiKey) !== secret) {
    return false;
  }

  return true;
}

function getApiKey() {
  // ใช้ในหน้าเว็บเพื่อแสดงคีย์ปัจจุบันให้ผู้ดูแล
  return apiKey;
}

module.exports = {
  init,
  verify,
  getApiKey,
};
