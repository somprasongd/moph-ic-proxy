const express = require('express');
const keygen = require('../../helper/keygen');
const cache = require('../../cache');
const { isCurrentAuthPayload } = require('../../helper/auth-payload');

const router = express.Router();

router.all('/api-key', async (req, res) => {
  const payload = {
    status: '',
    message: '',
  };

  if (req.method === 'POST') {
    const { username, password } = req.body;
    const isMatch = await isCurrentAuthPayload(username, password);
    if (!isMatch) {
      payload.status = 'error';
      payload.message = 'Invalid username or password';
    } else {
      payload.status = 'success';
      payload.message = keygen.getApiKey();
    }
  }

  res.render('api-key', payload);
});

module.exports = router;
