// ตัวกลางสำหรับส่งต่อคำขอไปยังปลายทางต่าง ๆ พร้อมจัดการไฟล์ multipart
const axios = require('axios');
const express = require('express');
const formidable = require('formidable');
const FormData = require('form-data');
const queryString = require('query-string');
const fs = require('fs');
const crypto = require('crypto');
const http = require('../../http');
const { redactConfig } = require('../../helper/redact');

// อ่านข้อมูลจาก stream มารวมกันเป็น string โดยจำกัดขนาด
// ใช้กับ error body ของ upstream กันกรณี body ใหญ่ผิดปกติจนกินเมมโมรี
const bufferStream = (stream, capBytes = 1024 * 1024) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    stream.on('data', (chunk) => {
      size += chunk.length;
      if (size > capBytes) {
        stream.destroy();
        resolve(Buffer.concat(chunks).toString());
        return;
      }
      chunks.push(chunk);
    });
    stream.on('end', () => resolve(Buffer.concat(chunks).toString()));
    stream.on('error', reject);
  });

// ดึง hostname ของ upstream จาก baseURL ของ client เพื่อใช้ใน log
const getUpstreamHost = (client) => {
  try {
    return new URL(client.defaults.baseURL).hostname;
  } catch (error) {
    return client.defaults.baseURL || 'unknown';
  }
};

const createFormidable = (options = {}) => {
  if (typeof formidable === 'function') {
    return formidable(options);
  }
  if (typeof formidable.formidable === 'function') {
    return formidable.formidable(options);
  }
  return new formidable.IncomingForm(options);
};

const router = express.Router();

router.all('*', async (req, res, next) => {
  const { query } = req;
  // เลือก client ตาม header หรือ query endpoint เพื่อยิงไปปลายทางที่ถูกต้อง
  const endpoint = req.header('x-api-endpoint') || query['endpoint'];
  const client = http.getClient(endpoint);

  // สร้าง request id สั้น ๆ ไว้ chain บรรทัด log ของ request เดียวกันได้
  const requestId = crypto.randomBytes(4).toString('hex');
  const startAt = Date.now();
  // สรุปผล request บรรทัดเดียว: method/path ที่รับ + upstream ที่ยิงจริง + ผลลัพธ์
  // upstream=false สำหรับกรณีที่จบในตัว proxy เอง ยังไม่ได้ยิงออกไปไหนเลย
  const logRequest = (result, upstream = true) => {
    const target = upstream ? ` -> ${getUpstreamHost(client)}` : '';
    console.log(
      `proxy: [${requestId}] ${req.method} ${req.originalUrl}${target} ${result} ${Date.now() - startAt}ms`
    );
  };

  if (query['endpoint']) {
    delete query['endpoint'];
  }

  // ประกอบ URL ใหม่จาก path เดิมและ query ที่เหลืออยู่
  const stringified = queryString.stringify(query);
  const url = `${req.params['0']}${
    stringified === '' ? '' : `?${stringified}`
  }`;

  try {
    let response;

    if (req.method === 'GET') {
      // ส่งผ่าน GET โดยตรงไม่มีการดัดแปลง body
      response = await client.get(url, { responseType: 'stream' });
    } else if (req.method === 'POST') {
      // ตรวจสอบชนิดข้อมูลเพื่อแยกจัดการ JSON และ multipart
      const contentTypeHeader = req.get('Content-Type') || '';
      const mimeType = contentTypeHeader.split(';')[0].trim().toLowerCase();

      if (mimeType === 'application/json') {
        response = await client.post(url, req.body, { responseType: 'stream' });
      } else if (mimeType === 'multipart/form-data') {
        // ใช้ formidable อ่านฟอร์มหรือไฟล์จากคำขอ
        const reqForm = createFormidable({
          multiples: true,
          // FDH doc: API นำเข้า 16 แฟ้ม (16_files) รับไฟล์รวมไม่เกิน 50MB
          maxFileSize: 60 * 1024 * 1024, // ต่อไฟล์ (50MB + headroom)
          maxTotalFileSize: 60 * 1024 * 1024, // รวมทุกไฟล์
        });
        const [fields, files] = await reqForm.parse(req);

        const form = new FormData();
        if (fields) {
          for (const key in fields) {
            if (Object.hasOwnProperty.call(fields, key)) {
              const element = fields[key];
              const value = Array.isArray(element) ? element[0] : element;
              // append ฟิลด์ธรรมดาเหมือนผู้ใช้ส่งมา
              form.append(key, value);
            }
          }
        }

        if (files) {
          for (const key in files) {
            if (Object.hasOwnProperty.call(files, key)) {
              const element = files[key];
              const appendFile = (file) => {
                // ใช้ stream เพื่อไม่โหลดไฟล์ทั้งหมดเข้าเมมโมรี
                form.append(key, fs.createReadStream(file.filepath), {
                  filename: file.originalFilename,
                  contentType: file.mimetype,
                });
              };

              if (Array.isArray(element)) {
                element.forEach(appendFile);
              } else {
                appendFile(element);
              }
            }
          }
        }

        response = await client.post(url, form, {
          // ใช้ header ใหม่จาก FormData เพื่อให้ boundary ถูกต้อง
          headers: form.getHeaders(),
          responseType: 'stream',
        });
      } else {
        logRequest(415, false);
        return res.status(415).json({
          message: `Unsupported Content-Type${
            mimeType ? `: ${mimeType}` : ''
          }`,
        });
      }
    } else if (req.method === 'PUT') {
      response = await client.put(url, req.body, { responseType: 'stream' });
    } else if (req.method === 'PATCH') {
      response = await client.patch(url, req.body, { responseType: 'stream' });
    } else if (req.method === 'DELETE') {
      response = await client.delete(url, { responseType: 'stream' });
    } else {
      // ป้องกันการใช้ method แปลกเพื่อให้ behavior ชัดเจน
      logRequest(405, false);
      return res.status(405).json({
        message:
          'proxy error: allow only GET, POST, PUT, PATCH and DELETE method.',
      }); // Method Not Allowed
    }

    // ส่งต่อ content-type ของ upstream เพื่อไม่ให้ express เดา type เอง
    const contentType = response.headers?.['content-type'];
    if (contentType) {
      res.set('Content-Type', contentType);
    }
    // อย่า forward content-length ของ upstream เพราะ axios แตก gzip ให้แล้ว
    // ขนาดจริงที่ส่งต่อไม่ตรงค่าเดิม ปล่อยเป็น chunked แทน
    logRequest(response.status);
    res.status(response.status);
    // ถ้า client ตัดการเชื่อมต่อกลางทาง ให้ destroy stream ฝั่ง upstream ด้วย
    // ไม่งั้น keep-alive socket ของ agent จะถูกจับค้างจน upstream ปิดเอง
    res.on('close', () => {
      if (!res.writableEnded) {
        response.data.destroy();
      }
    });
    // ป้องกัน stream error กลางทางทำให้ process crash
    response.data.on('error', (streamError) => {
      console.error(
        `proxy: [${requestId}] stream error after headers:`,
        streamError.message || streamError
      );
      res.destroy(streamError);
    });
    return response.data.pipe(res);
  } catch (error) {
    // ตอนนี้ response เป็น stream ดังนั้น error body ก็เป็น stream เช่นกัน
    // ต้อง buffer เป็น string ก่อนเพื่อให้ central error handler ส่งต่อได้เหมือนเดิม
    if (
      error.response?.data &&
      typeof error.response.data.on === 'function' &&
      typeof error.response.data.pipe === 'function'
    ) {
      try {
        error.response.data = await bufferStream(error.response.data);
      } catch (bufferError) {
        error.response.data = '';
      }
    }

    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        // แยกกรณี timeout ให้ตอบ 504 ชัดเจน
        console.error(`proxy: [${requestId}] axios timeout:`, error.message);
        logRequest('timeout');
        return res.status(504).json({
          message: 'upstream request timeout',
          detail: error.message,
          endpoint,
          url,
          timeoutMs: error.config?.timeout,
        });
      }

      // log รายละเอียด axios error ให้ตรวจสอบ trace ได้ง่าย (นำหน้าด้วย id เดียวกัน)
      console.error(`proxy: [${requestId}] axios error.message:`, error.message);
      console.error(`proxy: [${requestId}] axios error.code:`, error.code);
      console.error(`proxy: [${requestId}] axios error.syscall:`, error.syscall);
      console.error(`proxy: [${requestId}] axios error.errno:`, error.errno);
      console.error(
        `proxy: [${requestId}] axios error.response?.status:`,
        error.response?.status
      );
      console.error(
        `proxy: [${requestId}] axios error.response?.data:`,
        error.response?.data
      );
      console.error(`proxy: [${requestId}] axios error.cause:`, error.cause);
      if (typeof error.toJSON === 'function') {
        // log แบบถอด Authorization ออกก่อน กัน Bearer token หลุดเข้า log
        const json = error.toJSON();
        console.error(`proxy: [${requestId}] axios error.toJSON():`, {
          ...json,
          config: redactConfig(json.config),
        });
      }
      logRequest(error.response ? error.response.status : error.code || 'error');
    } else {
      console.error(`proxy: [${requestId}] non-axios error:`, error);
      // error ที่ไม่ใช่ axios (เช่น formidable 413) ยังไม่ได้ยิงถึง upstream
      logRequest(error.statusCode || 'error', false);
    }
    // formidable ใส่ status ไว้ใน httpCode (เช่น 413 กรณีไฟล์ใหญ่เกิน limit)
    // ให้ map มาที่ statusCode เพื่อให้ error handler ตอบสถานะที่ถูกต้อง
    if (error.httpCode && !error.statusCode) {
      error.statusCode = error.httpCode;
    }
    next(error);
  }
});

module.exports = router;
