const express = require('express');

const router = express.Router();
const http = require('../../http');

router.all('/change-password', async (req, res) => {
  const payload = {
    status: '',
    message: '',
  };

  if (req.method === 'POST') {
    const { username, password } = req.body;

    const token = await http.getToken({ force: true, username, password });
    if (!token) {
      payload.status = 'error';
      payload.message = 'Invalid username or password';
    } else {
      payload.status = 'success';
      payload.message = 'Created new MOPH IC Token';
    }
  }

  res.render('change-password', payload);
});

module.exports = router;
