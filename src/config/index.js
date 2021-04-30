const APP_PORT = process.env.APP_PORT || 3000;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const MOPH_C19_API = process.env.MOPH_C19_API;
const MOPH_C19_AUTH = process.env.MOPH_C19_AUTH || process.env.MOPH_C19_API;
const MOPH_USER = process.env.MOPH_USER;
const MOPH_PASSWD = process.env.MOPH_PASSWD;
const MOPH_HCODE = process.env.MOPH_HCODE;
const TOKEN_KEY = 'token';

module.exports = {
  APP_PORT,
  REDIS_HOST,
  REDIS_PORT,
  TOKEN_KEY,
  MOPH_C19_API,
  MOPH_C19_AUTH,
  MOPH_USER,
  MOPH_PASSWD,
  MOPH_HCODE,
};
