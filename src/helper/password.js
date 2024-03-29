const { createHmac } = require('crypto');

function hashPassword(password, secretKey) {
  return createHmac('sha256', secretKey).update(password).digest('hex');
}

module.exports = {
  hashPassword,
};
