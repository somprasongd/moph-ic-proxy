const express = require('express');

const router = express.Router();
const http = require('../../http');

router.all('/change-password', async (req, res) => {
  const app = req.query.app || 'mophic'; // mophic or fdh
  const payload = {
    app: app,
    status: '',
    message: '',
  };

  if (req.method === 'POST') {
    const { username, password } = req.body;

    const token = await http.getToken({ force: true, username, password, app });
    if (!token) {
      payload.status = 'error';
      payload.message = 'Invalid username or password';
    } else {
      payload.status = 'success';
      payload.message = `Created new ${
        app === 'mophic' ? 'MOPH IC' : 'FDH'
      } Token`;
    }
  }

  res.render('change-password', payload);
});

module.exports = router;
