const { createHmac } = require('crypto');

const APP_PORT = process.env.APP_PORT || 3000;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
const EPIDEM_API = process.env.EPIDEM_API || null;
const MOPH_C19_API = process.env.MOPH_C19_API;
const MOPH_C19_AUTH = process.env.MOPH_C19_AUTH || process.env.MOPH_C19_API;
const MOPH_C19_AUTH_SECRET = process.env.MOPH_C19_AUTH_SECRET || '$jwt@moph#';
const MOPH_USER = process.env.MOPH_USER;
const MOPH_PASSWD = process.env.MOPH_PASSWD;
const MOPH_HCODE = process.env.MOPH_HCODE;
const USE_API_KEY = process.env.USE_API_KEY
  ? process.env.USE_API_KEY === 'true'
  : true;
const TOKEN_KEY = 'token';

const requireds = [
  'MOPH_C19_API',
  'MOPH_C19_AUTH_SECRET',
  'MOPH_USER',
  'MOPH_PASSWD',
  'MOPH_HCODE',
];

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

// hash password
const hash = createHmac('sha256', MOPH_C19_AUTH_SECRET)
  .update(MOPH_PASSWD)
  .digest('hex');

module.exports = {
  APP_PORT,
  REDIS_HOST,
  REDIS_PORT,
  REDIS_PASSWORD,
  TOKEN_KEY,
  EPIDEM_API,
  MOPH_C19_API,
  MOPH_C19_AUTH,
  MOPH_USER,
  MOPH_PASSWD: hash,
  MOPH_HCODE,
  USE_API_KEY,
};
