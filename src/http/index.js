const axios = require('axios');
const axiosRetry = require('axios-retry');
const https = require('https');
const jwt_decode = require('jwt-decode');

const cache = require('../cache');

const {
  MOPH_CLAIM_API,
  MOPH_PHR_API,
  EPIDEM_API,
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

const getTokenClient = axios.create({
  baseURL: MOPH_C19_AUTH,
  httpsAgent,
});
axiosRetry(getTokenClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
});

async function getToken(options = { force: false }) {
  // console.log('gettoken with options:', options);
  let token = options.force ? null : await cache.get(TOKEN_KEY);
  // console.log(
  //   'token from cache:',
  //   token === null || token === '' ? 'no token' : 'have token'
  // );
  if (token === null || token === '') {
    try {
      // const url = `/token?Action=get_moph_access_token&user=${MOPH_USER}&password_hash=${MOPH_PASSWD}&hospital_code=${MOPH_HCODE}`;
      const url = `/token?Action=get_moph_access_token`;
      const payload = {
        user: MOPH_USER,
        password_hash: MOPH_PASSWD,
        hospital_code: MOPH_HCODE,
      };
      const response = await getTokenClient.post(url, payload);
      token = response.data;
      const decoded = jwt_decode(token);
      console.log('New mophic token exp at', decoded.exp);

      cache.setex('token', token, decoded.exp - 60); // set expire before 60s
    } catch (error) {
      console.error(error);
    }
  }
  return token;
}

const defaultOptions = {
  baseURL: MOPH_C19_API,
  headers: {
    'Content-Type': 'application/json',
  },
  httpsAgent,
};

const instance = axios.create(defaultOptions);

// const controller = new AbortController();

instance.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (!token) {
    return Promise.reject({ message: 'no token' });
  }

  // console.log('interceptors.request', `Bearer ${token}`);
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

instance.interceptors.response.use(null, async (error) => {
  if (error.config && error.response && error.response.status === 401) {
    const token = await getToken({ force: true });
    if (!token) {
      console.log('Cancal Retry from interceptors.response', error);
      return Promise.reject(error);
    }

    // console.log('interceptors.response', `Bearer ${token}`);
    error.config.headers.Authorization = `Bearer ${token}`;
    console.log('Retry from interceptors.response');
    return axios.request(error.config);
  }

  return Promise.reject(error);
});

const epidemOptions = {
  baseURL: EPIDEM_API,
  headers: {
    'Content-Type': 'application/json',
  },
  httpsAgent,
};

const instanceEpidem = axios.create(epidemOptions);

instanceEpidem.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (!token) {
    return Promise.reject({ message: 'no token' });
  }
  // console.log('interceptors.request', `Bearer ${token}`);
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

instanceEpidem.interceptors.response.use(null, async (error) => {
  if (error.config && error.response && error.response.status === 401) {
    const token = await getToken({ force: true });
    if (!token) {
      console.log('Cancal Retry from interceptors.response', error);
      return Promise.reject(error);
    }

    // console.log('interceptors.response', `Bearer ${token}`);
    error.config.headers.Authorization = `Bearer ${token}`;
    // console.log('Retry from interceptors.response');
    return axios.request(error.config);
  }

  return Promise.reject(error);
});

const phrOptions = {
  baseURL: MOPH_PHR_API,
  headers: {
    'Content-Type': 'application/json',
  },
  httpsAgent,
};

const instancePhr = axios.create(phrOptions);

instancePhr.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (!token) {
    return Promise.reject({ message: 'no token' });
  }
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

instancePhr.interceptors.response.use(null, async (error) => {
  if (
    error.config &&
    error.response &&
    (error.response.status === 401 || error.response.status === 501)
  ) {
    const token = await getToken({ force: true });
    if (!token) {
      console.log('Cancal Retry from interceptors.response', error);
      return Promise.reject(error);
    }
    error.config.headers.Authorization = `Bearer ${token}`;
    return axios.request(error.config);
  }

  return Promise.reject(error);
});

const claimOptions = {
  baseURL: MOPH_CLAIM_API,
  headers: {
    'Content-Type': 'application/json',
  },
  httpsAgent,
};

const instanceClaim = axios.create(claimOptions);

instanceClaim.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (!token) {
    return Promise.reject({ message: 'no token' });
  }
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

instanceClaim.interceptors.response.use(null, async (error) => {
  if (error.config && error.response && error.response.status === 401) {
    const token = await getToken({ force: true });
    if (!token) {
      console.log('Cancal Retry from interceptors.response', error);
      return Promise.reject(error);
    }
    error.config.headers.Authorization = `Bearer ${token}`;
    return axios.request(error.config);
  }

  return Promise.reject(error);
});

function getClient(endpoint = 'mophic') {
  switch (endpoint) {
    case 'epidem':
      return instanceEpidem;
    case 'phr':
      return instancePhr;
    case 'claim':
      return instanceClaim;
    default:
      return instance;
  }
}

module.exports = {
  client: instance,
  clientEpidem: instanceEpidem,
  clientPhr: instanceClaim,
  clientClaim: instancePhr,
  getToken,
  getClient,
};
