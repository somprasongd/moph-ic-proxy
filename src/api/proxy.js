const express = require('express');
const queryString = require('query-string');
const http = require('../http');
const cache = require('../cache');

const router = express.Router();

router.get('*', async (req, res, next) => {
  const { query } = req;

  const client = http.getClient(query['endpoint']);

  if (query['endpoint']) {
    console.log(query['endpoint']);
    delete query['endpoint'];
  }
  const stringified = queryString.stringify(query);
  const url = `${req.params['0']}${
    stringified === '' ? '' : `?${stringified}`
  }`;

  try {
    const respone = await client.get(url);
    return res.send(respone.data);
  } catch (error) {
    if (error.response && error.response.Message === 'JWT Expire') {
      cache.del('token');
      // retry
      try {
        const respone = await client.get(url);
        return res.send(respone.data);
      } catch (error) {
        return next(error);
      }
    }
    return next(error);
  }
});

router.post('*', async (req, res, next) => {
  const json = req.body;

  const { query } = req;

  const client = http.getClient(query['endpoint']);

  if (query['endpoint']) {
    console.log(query['endpoint']);
    delete query['endpoint'];
  }

  const stringified = queryString.stringify(query);
  const url = `${req.params['0']}${
    stringified === '' ? '' : `?${stringified}`
  }`;

  try {
    const respone = await client.post(url, json);
    return res.send(respone.data);
  } catch (error) {
    if (error.response && error.response.Message === 'JWT Expire') {
      cache.del('token');
      // retry
      try {
        const respone = await client.post(url, json);
        return res.send(respone.data);
      } catch (error) {
        return next(error);
      }
    }
    next(error);
  }
});

module.exports = router;
