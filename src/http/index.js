const axios = require('axios');
const axiosRetry = require('axios-retry');
const https = require('https');
const jwt_decode = require('jwt-decode');

const cache = require('../cache');

const {
  MOPH_C19_API,
  MOPH_C19_AUTH,
  MOPH_USER,
  MOPH_PASSWD,
  MOPH_HCODE,
  TOKEN_KEY,
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

const getTokenClient = axios.create({
  baseURL: MOPH_C19_AUTH,
  httpsAgent,
});
axiosRetry(getTokenClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
});

async function getToken(options = { force: false }) {
  let token = options.force ? null : await cache.get(TOKEN_KEY);
  if (token === null || token === '') {
    try {
      const url = `/token?Action=get_moph_access_token&user=${MOPH_USER}&password_hash=${MOPH_PASSWD}&hospital_code=${MOPH_HCODE}`;
      const response = await getTokenClient.get(url);
      token = response.data;
      const decoded = jwt_decode(token);

      cache.setex('token', token, decoded.exp - 60); // set expire before 60s
    } catch (error) {
      console.error(error);
      token = '';
    }
  }
  return token;
}

instance.interceptors.request.use(async (config) => {
  const token = await getToken();

  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

instance.interceptors.response.use(null, async (error) => {
  if (error.config && error.response && error.response.status === 401) {
    const token = await getToken({ force: true });
    error.config.headers.Authorization = `Bearer ${token}`;
    return axios.request(error.config);
  }

  return Promise.reject(error);
});

module.exports = instance;
