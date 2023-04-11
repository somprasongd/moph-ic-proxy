const express = require('express');
const auth = require('./auth');
const proxy = require('./proxy');

function init() {
  const router = express.Router();

  router.use('/api/auth', auth);
  router.use(proxy);

  return router;
}

module.exports = { init };
