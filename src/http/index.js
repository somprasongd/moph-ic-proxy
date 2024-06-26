const axios = require('axios');
const axiosRetry = require('axios-retry');
const https = require('https');
const jwt_decode = require('jwt-decode');

const { createAuthPayload } = require('../helper/auth-payload');
const cache = require('../cache');

const {
  MOPH_CLAIM_API,
  MOPH_PHR_API,
  EPIDEM_API,
  FDH_API,
  FDH_AUTH,
  FDH_AUTH_SECRET,
  MOPH_IC_API,
  MOPH_IC_AUTH,
  MOPH_IC_AUTH_SECRET,
  TOKEN_KEY,
  AUTH_PAYLOAD_KEY,
} = require('../config');

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const getTokenClient = axios.create({
  baseURL: MOPH_IC_AUTH,
  httpsAgent,
});
axiosRetry(getTokenClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
});

const getTokenClientFDH = axios.create({
  baseURL: FDH_AUTH,
  httpsAgent,
});
axiosRetry(getTokenClientFDH, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
});

async function getToken(
  options = { force: false, username: '', password: '', app: 'mophic' }
) {
  const {
    force = false,
    username = '',
    password = '',
    app = 'mophic',
  } = options;
  // console.log('gettoken with options:', options);
  const tokenKey = `${app}${TOKEN_KEY}`;
  const authPayloadKey = `${app}${AUTH_PAYLOAD_KEY}`;
  const secretKey = app === 'mophic' ? MOPH_IC_AUTH_SECRET : FDH_AUTH_SECRET;

  let token = null;
  if (force) {
    cache.del(tokenKey);
  } else {
    token = await cache.get(tokenKey);
  }
  if (token === null || token === '') {
    try {
      const url = `/token?Action=get_moph_access_token`;
      let payload = {};
      if (username !== '' && password !== '') {
        payload = createAuthPayload(username, password, secretKey);
      } else {
        const strPayload = await cache.get(authPayloadKey);
        // not logged in
        if (!strPayload) {
          return null;
        }
        payload = JSON.parse(strPayload);
      }

      // console.log('get token with payload', payload);
      const client = app === 'mophic' ? getTokenClient : getTokenClientFDH;
      const response = await client.post(url, payload);
      token = response.data;
      const decoded = jwt_decode(token);
      console.log(`New ${app} token expires at`, decoded.exp);

      cache.setex(tokenKey, token, decoded.exp - 60); // set expire before 60s
      cache.set(authPayloadKey, JSON.stringify(payload));
    } catch (error) {
      console.error(error);
    }
  }
  return token;
}

const defaultOptions = {
  baseURL: MOPH_IC_API,
  headers: {
    'Content-Type': 'application/json',
  },
  httpsAgent,
};

const instance = axios.create(defaultOptions);

// const controller = new AbortController();

instance.interceptors.request.use(async (config) => {
  const token = await getToken({ app: 'mophic' });
  if (!token) {
    return Promise.reject({
      message:
        'Cannot create token, please check the username and password configuration.',
    });
  }

  // console.log('interceptors.request', `Bearer ${token}`);
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

instance.interceptors.response.use(null, async (error) => {
  if (error.config && error.response && error.response.status === 401) {
    const token = await getToken({ force: true, app: 'mophic' });
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
  const token = await getToken({ app: 'mophic' });
  if (!token) {
    return Promise.reject({
      message:
        'Cannot create token, please check the username and password configuration.',
    });
  }
  // console.log('interceptors.request', `Bearer ${token}`);
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

instanceEpidem.interceptors.response.use(null, async (error) => {
  if (error.config && error.response && error.response.status === 401) {
    const token = await getToken({ force: true, app: 'mophic' });
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
  const token = await getToken({ app: 'mophic' });
  if (!token) {
    return Promise.reject({
      message:
        'Cannot create token, please check the username and password configuration.',
    });
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
    const token = await getToken({ force: true, app: 'mophic' });
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
  const token = await getToken({ app: 'mophic' });
  if (!token) {
    return Promise.reject({
      message:
        'Cannot create token, please check the username and password configuration.',
    });
  }
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

instanceClaim.interceptors.response.use(null, async (error) => {
  if (error.config && error.response && error.response.status === 401) {
    const token = await getToken({ force: true, app: 'mophic' });
    if (!token) {
      console.log('Cancal Retry from interceptors.response', error);
      return Promise.reject(error);
    }
    error.config.headers.Authorization = `Bearer ${token}`;
    return axios.request(error.config);
  }

  return Promise.reject(error);
});

const fdhOptions = {
  baseURL: FDH_API,
  headers: {
    'Content-Type': 'application/json',
  },
  httpsAgent,
};

const instanceFDH = axios.create(fdhOptions);

instanceFDH.interceptors.request.use(async (config) => {
  const token = await getToken({ app: 'fdh' });
  if (!token) {
    return Promise.reject({
      message:
        'Cannot create token, please check the username and password configuration.',
    });
  }
  // console.log('interceptors.request', `Bearer ${token}`);
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

instanceFDH.interceptors.response.use(null, async (error) => {
  if (error.config && error.response && error.response.status === 401) {
    const token = await getToken({ force: true, app: 'fdh' });
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

function getClient(endpoint = 'mophic') {
  switch (endpoint) {
    case 'epidem':
      return instanceEpidem;
    case 'phr':
      return instancePhr;
    case 'claim':
      return instanceClaim;
    case 'fdh':
      return instanceFDH;
    default:
      return instance;
  }
}

module.exports = {
  client: instance,
  clientEpidem: instanceEpidem,
  clientPhr: instanceClaim,
  clientClaim: instancePhr,
  clientFDH: instanceFDH,
  getToken,
  getClient,
};
