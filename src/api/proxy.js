const express = require('express');
const queryString = require('query-string');
const http = require('../http');
const cache = require('../cache');

const router = express.Router();

router.get('*', async (req, res, next) => {
  const { query } = req;
  const stringified = queryString.stringify(query);
  const url = `${req.params['0']}${
    stringified === '' ? '' : `?${stringified}`
  }`;

  try {
    const respone = await http.client.get(url);
    return res.send(respone.data);
  } catch (error) {
    if (error.response && error.response.Message === 'JWT Expire') {
      cache.del('token');
      // retry
      try {
        const respone = await http.client.get(url);
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
  const stringified = queryString.stringify(query);
  const url = `${req.params['0']}${
    stringified === '' ? '' : `?${stringified}`
  }`;

  try {
    const respone = await http.client.post(url, json);
    return res.send(respone.data);
  } catch (error) {
    if (error.response && error.response.Message === 'JWT Expire') {
      cache.del('token');
      // retry
      try {
        const respone = await http.client.post(url, json);
        return res.send(respone.data);
      } catch (error) {
        return next(error);
      }
    }
    next(error);
  }
});

module.exports = router;
