// const { createHmac } = require('crypto');

const env = {
  APP_PORT: process.env.APP_PORT || 3000,
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: process.env.REDIS_PORT || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
  MOPH_CLAIM_API: process.env.MOPH_CLAIM_API || null,
  MOPH_PHR_API: process.env.MOPH_PHR_API || null,
  EPIDEM_API: process.env.EPIDEM_API || null,
  FDH_API: process.env.FDH_API || null,
  MOPH_C19_API: process.env.MOPH_C19_API,
  MOPH_C19_AUTH: process.env.MOPH_C19_AUTH || process.env.MOPH_C19_API,
  MOPH_C19_AUTH_SECRET: process.env.MOPH_C19_AUTH_SECRET || '$jwt@moph#',
  MOPH_HCODE: process.env.MOPH_HCODE,
  USE_API_KEY: process.env.USE_API_KEY
    ? process.env.USE_API_KEY === 'true'
    : true,
  TOKEN_KEY: 'moph-ic-token',
  AUTH_PAYLOAD_KEY: 'moph-ic-auth-payload',
};

// const APP_PORT = process.env.APP_PORT || 3000;
// const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
// const REDIS_PORT = process.env.REDIS_PORT || 6379;
// const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
// const MOPH_CLAIM_API = process.env.MOPH_CLAIM_API || null;
// const MOPH_PHR_API = process.env.MOPH_PHR_API || null;
// const EPIDEM_API = process.env.EPIDEM_API || null;
// const FDH_API = process.env.FDH_API || null;
// const MOPH_C19_API = process.env.MOPH_C19_API;
// const MOPH_C19_AUTH = process.env.MOPH_C19_AUTH || process.env.MOPH_C19_API;
// const MOPH_C19_AUTH_SECRET = process.env.MOPH_C19_AUTH_SECRET || '$jwt@moph#';
// const MOPH_HCODE = process.env.MOPH_HCODE;
// const USE_API_KEY = process.env.USE_API_KEY
//   ? process.env.USE_API_KEY === 'true'
//   : true;
// const TOKEN_KEY = 'moph-ic-token';
// const AUTH_PAYLOAD_KEY = 'moph-ic-auth-payload';

const requireds = ['MOPH_C19_AUTH', 'MOPH_C19_AUTH_SECRET', 'MOPH_HCODE'];

const errors = [];

requireds.forEach((key) => {
  if (!env[key]) {
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

module.exports = env;
