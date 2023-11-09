const { createHmac } = require('crypto');

const APP_PORT = process.env.APP_PORT || 3000;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
const MOPH_CLAIM_API = process.env.MOPH_CLAIM_API || null;
const MOPH_PHR_API = process.env.MOPH_PHR_API || null;
const EPIDEM_API = process.env.EPIDEM_API || null;
const FDH_API = process.env.FDH_API || null;
const MOPH_C19_API = process.env.MOPH_C19_API;
const MOPH_C19_AUTH = process.env.MOPH_C19_AUTH || process.env.MOPH_C19_API;
const MOPH_C19_AUTH_SECRET = process.env.MOPH_C19_AUTH_SECRET || '$jwt@moph#';
const MOPH_HCODE = process.env.MOPH_HCODE;
const USE_API_KEY = process.env.USE_API_KEY
  ? process.env.USE_API_KEY === 'true'
  : true;
const TOKEN_KEY = 'moph-ic-token';
const AUTH_PAYLOAD_KEY = 'moph-ic-auth-payload';

const requireds = ['MOPH_C19_AUTH', 'MOPH_C19_AUTH_SECRET', 'MOPH_HCODE'];

const errors = [];

requireds.forEach((key) => {
  if (!process.env[key]) {
    errors.push(key);
  }
});

if (errors.length > 0) {
  throw new Error(
    `Fatal error: Environment is required [${errors.join(', ')}]`
  );
}

// // hash password
// const hash = createHmac('sha256', MOPH_C19_AUTH_SECRET)
//   .update(MOPH_PASSWD)
//   .digest('hex');

module.exports = {
  APP_PORT,
  REDIS_HOST,
  REDIS_PORT,
  REDIS_PASSWORD,
  TOKEN_KEY,
  AUTH_PAYLOAD_KEY,
  MOPH_C19_AUTH_SECRET,
  MOPH_CLAIM_API,
  MOPH_PHR_API,
  EPIDEM_API,
  FDH_API,
  MOPH_C19_API,
  MOPH_C19_AUTH,
  MOPH_HCODE,
  USE_API_KEY,
};
