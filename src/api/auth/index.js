const express = require('express');

const router = express.Router();

router.post('/change-password', async (req, res, next) => {
  try {
    const json = req.body;
    console.log(json);
    return res.sendStatus(200);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
