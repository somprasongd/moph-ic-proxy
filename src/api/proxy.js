const express = require('express');
const queryString = require('query-string');
const httpClient = require('../http');

const router = express.Router();

router.get('*', async (req, res, next) => {
  const { query } = req;
  const stringified = queryString.stringify(query);
  const url = `${req.params['0']}${
    stringified === '' ? '' : `?${stringified}`
  }`;

  try {
    const respone = await httpClient.get(url);
    return res.json(respone.data);
  } catch (error) {
    next(error);
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
    const respone = await httpClient.post(url, json);
    return res.json(respone.data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
