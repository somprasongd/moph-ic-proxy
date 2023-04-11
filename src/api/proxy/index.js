const express = require('express');
const queryString = require('query-string');
const http = require('../../http');

const router = express.Router();

// router.get('*', async (req, res, next) => {
//   const { query } = req;

//   const client = http.getClient(query['endpoint']);

//   if (query['endpoint']) {
//     console.log(query['endpoint']);
//     delete query['endpoint'];
//   }
//   const stringified = queryString.stringify(query);
//   const url = `${req.params['0']}${
//     stringified === '' ? '' : `?${stringified}`
//   }`;

//   try {
//     const respone = await client.get(url);
//     return res.send(respone.data);
//   } catch (error) {
//     if (error.response && error.response.Message === 'JWT Expire') {
//       cache.del('token');
//       // retry
//       try {
//         const respone = await client.get(url);
//         return res.send(respone.data);
//       } catch (error) {
//         return next(error);
//       }
//     }
//     return next(error);
//   }
// });

// router.post('*', async (req, res, next) => {
//   const json = req.body;

//   const { query } = req;

//   const client = http.getClient(query['endpoint']);

//   if (query['endpoint']) {
//     console.log(query['endpoint']);
//     delete query['endpoint'];
//   }

//   const stringified = queryString.stringify(query);
//   const url = `${req.params['0']}${
//     stringified === '' ? '' : `?${stringified}`
//   }`;

//   try {
//     const respone = await client.post(url, json);
//     return res.send(respone.data);
//   } catch (error) {
//     if (error.response && error.response.Message === 'JWT Expire') {
//       cache.del('token');
//       // retry
//       try {
//         const respone = await client.post(url, json);
//         return res.send(respone.data);
//       } catch (error) {
//         return next(error);
//       }
//     }
//     next(error);
//   }
// });

router.all('*', async (req, res, next) => {
  // allow get and post
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.sendStatus(405); // Method Not Allowed
    return;
  }
  const { query } = req;

  const client = http.getClient(query['endpoint']);

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
      respone = await client.post(url, req.body);
    }

    return res.send(respone.data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
