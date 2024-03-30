const express = require('express');
const formidable = require('formidable');
const FormData = require('form-data');
const queryString = require('query-string');
const fs = require('fs');
const http = require('../../http');

const router = express.Router();

router.all('*', async (req, res, next) => {
  // allow get and post
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.sendStatus(405); // Method Not Allowed
    return;
  }

  const { query } = req;
  const endpoint = req.header('x-api-endpoint') || query['endpoint'];
  const client = http.getClient(endpoint);

  if (query['endpoint']) {
    delete query['endpoint'];
  }

  const stringified = queryString.stringify(query);
  const url = `${req.params['0']}${
    stringified === '' ? '' : `?${stringified}`
  }`;

  try {
    let respone;

    if (req.method === 'GET') {
      respone = await client.get(url);
    } else {
      contentTypes = req.get('Content-Type').split(';');
      if (contentTypes[0] === 'application/json') {
        respone = await client.post(url, req.body);
      } else if (contentTypes[0] === 'multipart/form-data') {
        const reqForm = formidable.formidable({
          multiples: true,
          // maxFileSize: 100 * 1024 * 1024, // 100MB default 200MB
        });
        const [fields, files] = await reqForm.parse(req);

        const form = new FormData();
        if (fields) {
          for (const key in fields) {
            if (Object.hasOwnProperty.call(fields, key)) {
              const element = fields[key];
              form.append(key, element[0]);
            }
          }
        }

        if (files) {
          for (const key in files) {
            if (Object.hasOwnProperty.call(files, key)) {
              const element = files[key];
              if (Array.isArray(element)) {
                for (const v of element) {
                  form.append(key, fs.createReadStream(v.filepath), {
                    filename: v.originalFilename,
                    contentType: v.mimetype,
                  });
                }
              } else {
                form.append(key, element.filepath, {
                  filename: element.originalFilename,
                  contentType: v.mimetype,
                });
              }
            }
          }
        }
        respone = await client.post(url, form, {
          headers: {
            'Content-Type': req.get('Content-Type'),
          },
        });
      } else {
        next(new Error(`Unsupport Content-Type: ${contentTypes[0]}`));
      }
    }

    return res.send(respone.data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
