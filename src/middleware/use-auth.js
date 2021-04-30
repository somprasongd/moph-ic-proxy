const keygen = require('../helper/keygen');

function validateApikey(req, res, next) {
  const apiKey = req.header('x-api-key') || req.query['x-api-key'];
  
  if (!apiKey) {
    const err = new Error('Access denied. No x-api-key provided');
    err.status = 401; // 401 Unauthorized
    return next(err);
  }

  if (!keygen.verify(apiKey)) {
    const err = new Error('Invalid x-api-key');
    err.status = 400; // 401 Unauthorized
    return next(err);
  }

  delete req.query['x-api-key'];

  next()
}


module.exports = {
  validateApikey
}