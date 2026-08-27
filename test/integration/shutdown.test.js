// Integration test: graceful shutdown ของ process จริง (spawn เป็นลูก)
// ต้องส่งต่อ request ที่กำลังค้างให้จบครบก่อน แล้วออกด้วย exit code 0
// (กัน regression ของ CI redeploy ที่เคยตัด request กลางทาง)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

const { createFakeUpstream } = require('../helpers/fake-upstream');

const ROOT = path.join(__dirname, '..', '..');

// จอง port ว่างก่อนแล้วปิดทิ้ง เพื่อส่งต่อให้ process ลูกใช้
// (ต้องใช้ port ตายตัวเพราะลูกเป็น process แยก อ่านค่าจาก stdout ได้แต่ยุ่งกว่า)
const reservePort = () =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
  });

// รอให้ stdout ของลูกมีข้อความที่ต้องการ (ใช้รอ "Server started on port")
const waitForOutput = (child, text, timeoutMs = 10000) =>
  new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(
      () => reject(new Error(`timeout รอ "${text}" ใน output ของลูก`)),
      timeoutMs
    );
    const check = (chunk) => {
      buffer += chunk.toString();
      if (buffer.includes(text)) {
        clearTimeout(timer);
        resolve(buffer);
      }
    };
    child.stdout.on('data', check);
    child.stderr.on('data', check);
    child.once('exit', () => {
      clearTimeout(timer);
      reject(new Error(`ลูกออกก่อนจะพิมพ์ "${text}" — output:\n${buffer}`));
    });
  });

test(
  'SIGTERM ระหว่างมี request ค้าง: ต้องรอให้ response จบครบแล้ว exit code 0',
  { timeout: 20000 },
  async () => {
    const upstream = createFakeUpstream({ slowMs: 2000 });
    const url = await upstream.listen();
    const port = await reservePort();

    const child = spawn(process.execPath, [path.join(ROOT, 'src', 'index.js')], {
      cwd: ROOT,
      env: {
        ...process.env,
        REDIS_HOST: '',
        REDIS_PASSWORD: '',
        MOPH_HCODE: '11242',
        USE_API_KEY: 'false',
        APP_PORT: String(port),
        MOPH_IC_API: url,
        MOPH_IC_AUTH: url,
        EPIDEM_API: url,
        MOPH_PHR_API: url,
        MOPH_CLAIM_API: url,
        FDH_API: url,
        FDH_AUTH: url,
        // ยาวพอให้ request ช้าจบเองก่อน timeout ของ upstream client
        HTTP_TIMEOUT_MS: '8000',
        HTTP_RETRIES: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    child.stdout.on('data', (chunk) => (stdout += chunk.toString()));
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()));

    const exitCode = new Promise((resolve) => {
      child.once('exit', (code) => resolve(code));
    });

    try {
      await waitForOutput(child, `Server started on port ${port}`);
      const baseUrl = `http://127.0.0.1:${port}`;

      // seed credential ผ่าน change-password เพราะ /api/slow ต้องมี Bearer token
      const auth = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'shut-user', password: 'shut-pass' }),
      });
      assert.equal(auth.status, 204);

      // ยิง request ช้า 2 วินาทีค้างไว้ แล้วส่ง SIGTERM ระหว่างรอ
      const slowRequest = fetch(`${baseUrl}/api/slow`).then((res) => {
        assert.equal(res.status, 200);
        return res.json();
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
      child.kill('SIGTERM');

      // request ที่ค้างอยู่ต้องได้ response ครบถ้วน ไม่โดนตัดกลางทาง
      const body = await slowRequest;
      assert.deepEqual(body, { ok: true });

      // แล้ว process ต้องออกด้วย code 0 หลัง drain เสร็จ
      assert.equal(await exitCode, 0, `stdout:\n${stdout}\nstderr:\n${stderr}`);
      assert.match(stdout, /Shutdown complete\./);
      assert.match(stdout, /SIGTERM received/);
    } finally {
      // กันลูกค้างถ้า test พังกลางทาง
      if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
      await upstream.close();
    }
  }
);
