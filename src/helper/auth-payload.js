const config = require('../config');
const cache = require('../cache');
const { hashPassword } = require('./password');

function createAuthPayload(username, password, secretKey) {
  return {
    user: username,
    password_hash: hashPassword(password, secretKey),
    hospital_code: config.MOPH_HCODE,
  };
}
async function isCurrentAuthPayload(app, username, password) {
  const strPayload = await cache.get(`${app}${config.AUTH_PAYLOAD_KEY}`);
  // console.log('strPayload', strPayload);
  if (!strPayload) {
    return false;
  }
  // console.log('payload', JSON.stringify(createAuthPayload(username, password)));
  return strPayload === JSON.stringify(createAuthPayload(username, password));
}

module.exports = {
  createAuthPayload,
  isCurrentAuthPayload,
};
