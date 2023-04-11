const { createHmac } = require('crypto');
const config = require('../config');

function hashPassword(password) {
  return createHmac('sha256', config.MOPH_C19_AUTH_SECRET)
    .update(password)
    .digest('hex');
}

module.exports = {
  hashPassword,
};
