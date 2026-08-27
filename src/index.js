// ไฟล์หลักสำหรับเริ่มต้นเซิร์ฟเวอร์ Express และตั้งค่า middleware ทั้งหมด
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const config = require('./config');
const webRouter = require('./web');
const apiRouter = require('./api');
const useAuth = require('./middleware/use-auth');
const redisClient = require('./cache');
const keygen = require('./helper/keygen');
const { redactConfig } = require('./helper/redact');
const pkgJson = require('../package.json');
const http = require('./http');

async function main() {
  const appName = `MOPH API Proxy v.${pkgJson.version}`;
  console.log(appName);

  try {
    // สร้างการเชื่อมต่อ Redis เพื่อใช้ cache โทเคนก่อนเริ่มระบบ
    await redisClient.createClient();
  } catch (error) {
    throw new Error(`Fatal error: ${error.message}`);
  }

  // ขอ refresh โทเคนล่วงหน้าไว้ใน cache เพื่อให้ proxy เริ่มทำงานได้ทันที
  http.getToken({ force: true, app: 'mophic' });
  http.getToken({ force: true, app: 'fdh' });

  // generate api key
  if (config.USE_API_KEY) {
    try {
      // ถ้าเปิดใช้ API Key ให้ตรวจสอบ/สร้างไฟล์เก็บ key ก่อน
      await keygen.init();
    } catch (error) {
      throw new Error(`Fatal error: ${error.message}`);
    }
  }

  // init web server
  const app = express();

  // use middlewares
  app.use(
    morgan(
      ':remote-addr - :remote-user [:date[iso]] ":method :url HTTP/:http-version" :status - :response-time ms'
    )
  );
  // parse body to json
  app.use(express.urlencoded({ extended: true }));
  // FDH doc อนุญาต JSON ได้ถึง 5MB ต่อ request จึงต้องเพิ่ม limit จาก default 100KB
  app.use(express.json({ limit: config.BODY_LIMIT }));
  app.set('x-powered-by', false);
  // set the view engine to ejs
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.get('/favicon.ico', (req, res) => res.status(204));

  // liveness: ตอบ 200 เสมอถ้า process ยังรับ request ได้ (ให้ container restart เฉพาะเมื่อค้างจริง)
  app.get('/healthz', (req, res) => {
    res.json({
      status: 'ok',
      version: pkgJson.version,
      cache: redisClient.getBackend(),
      uptime: Math.floor(process.uptime()),
    });
  });

  // readiness: พร้อมเมื่อมีโทเคนครบทั้ง 2 แอป (deploy ใหม่ที่ยังไม่ได้ตั้ง credential จะได้ 503)
  app.get('/readyz', async (req, res) => {
    const tokens = await http.getTokenStatus();
    const ready = Object.values(tokens).every(Boolean);
    res.status(ready ? 200 : 503).json({ ready, tokens });
  });

  app.use(webRouter.init(appName));

  app.use(useAuth.validateApikey, apiRouter.init());

  // handle 404
  app.use((req, res, next) => {
    // ทุกเส้นทางที่ไม่ตรงจะสร้าง error 404 ส่งต่อให้ middleware ถัดไป
    const error = new Error(
      `Invalid route: Can not find ${req.originalUrl} on this server!`
    );
    error.statusCode = 404;
    next(error);
  });

  // handle error
  app.use((error, req, res, next) => {
    // เตรียมโครงสร้างตอบกลับเมื่อเกิด error ภายใน proxy
    const json = {
      error: {
        statusCode: 500,
        message: 'Something went wrong',
      },
    };
    // log config แบบถอด Authorization ออกก่อน กัน Bearer token หลุดเข้า log
    console.log('Error config:\n', redactConfig(error.config));
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.log('Error response status:', error.response.status);
      console.log('Error response headers:\n', error.response.headers);
      console.log('Error response data:\n', error.response.data);
      // json.error.statusCode = error.response.status;
      // json.error.message = JSON.stringify(error.response.data);
      // ส่งต่อเฉพาะ header ที่ปลอดภัย เพราะ axios แตกไฟล์ gzip ให้แล้ว
      // การ copy content-encoding/content-length ของ upstream จะทำให้ body กับ header ไม่ตรงกัน
      const forwardableHeaders = {};
      for (const name of ['content-type', 'location']) {
        const value = error.response.headers[name];
        if (value) {
          forwardableHeaders[name] = value;
        }
      }
      res.set(forwardableHeaders);
      res.status(error.response.status).send(error.response.data);
      return;
    } else if (error.request) {
      // The request was made but no response was received
      // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
      // http.ClientRequest in node.js
      console.log('Error request:\n', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.log('Error:\n', error.message);
      json.error.statusCode = error.statusCode;
      json.error.message = error.message;
    }

    res.status(error.statusCode || 500);
    return res.json(json);
  });

  const server = app.listen(
    config.APP_PORT,
    console.log(`Server started on port ${config.APP_PORT}`)
  );

  // graceful shutdown: รอ in-flight request จบก่อนค่อยปิด cache แล้วออก
  // สำคัญกับ CI ที่ redeploy ทุก push เพราะจะไม่ตัด request ที่กำลัง proxied อยู่กลางทาง
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log(`\n${signal} received, shutting down...`);

    // กันเกิน 10 วินาทีแล้วยังมี request ค้าง ให้ออกแบบบังคับ
    const forceExitTimer = setTimeout(() => {
      console.error('Graceful shutdown timeout, force exit.');
      process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    server.close(async () => {
      try {
        await redisClient.close();
      } catch (error) {
        console.error('Error closing cache:', error.message || error);
      }
      console.log('Shutdown complete.');
      process.exit(0);
    });
    // ตัด keep-alive connection ที่ว่างอยู่ให้ server.close จบได้ (Node >= 18.2)
    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
