const express = require('express');
const httpClient = require('../http');

const router = express.Router();

router.get('*', async (req, res, next) => {
  const url = `${req.originalUrl}`;

  try {
    const respone = await httpClient.get(url);
    return res.json(respone.data);
  } catch (error) {
    next(error);
  }
});

router.post('*', async (req, res, next) => {
  const json = req.body;

  const url = `${req.originalUrl}`;

  try {
    const respone = await httpClient.post(url, json);
    return res.json(respone.data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;