const axios = require('axios');
const https = require('https');
const jwt_decode = require('jwt-decode');

const cache = require('../cache');

const {
  MOPH_C19_API,
  MOPH_C19_AUTH,
  MOPH_USER,
  MOPH_PASSWD,
  MOPH_HCODE,
  TOKEN_KEY
} = require('../config');

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const defaultOptions = {
  baseURL: MOPH_C19_API,
  headers: {
    'Content-Type': 'application/json',
  },
  httpsAgent,
};

const instance = axios.create(defaultOptions);

instance.interceptors.request.use(async (config) => {
  let token = await cache.get(TOKEN_KEY);

  if (token === null) {
    try {
      const url = `${MOPH_C19_AUTH}/token?Action=get_moph_access_token&user=${MOPH_USER}&password_hash=${MOPH_PASSWD}&hospital_code=${MOPH_HCODE}`;
      const response = await axios.get(url, {
        httpsAgent,
      });
      token = response.data;
      const decoded = jwt_decode(token);

      cache.setex('token', token, decoded.exp);
    } catch (error) {
      console.error(error);
      token = '';
    }
  }
  
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

module.exports = instance;
