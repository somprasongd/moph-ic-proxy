const express = require('express');
const config = require('../config');
const home = require('./home');
const apiKey = require('./api-key');
const changePwd = require('./change-password');

function init(appName) {
  const router = express.Router();

  router.use(home.init(appName));
  router.use(changePwd);
  if (config.USE_API_KEY) {
    router.use(apiKey);
  }

  return router;
}

module.exports = { init };
