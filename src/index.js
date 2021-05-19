const express = require('express');
const morgan = require('morgan')
const config = require('./config');
const routerProxy = require('./api/proxy');
const useAuth = require('./middleware/use-auth');
const redisClient = require('./cache');
const keygen = require('./helper/keygen');
const pkgJson = require('../package.json');

async function main() {
  console.log(`MOPH IC Proxy v.${pkgJson.version}`);
  try {
    await redisClient.createClient();
  } catch (error) {
    throw new Error(`Fatal error: ${error.message}`)
  }

  const app = express();

  try {
    await keygen.init(app);
  } catch (error) {
    throw new Error(`Fatal error: ${error.message}`)
  }

  // use middlewares
  app.use(morgan(':remote-addr - :remote-user [:date[iso]] ":method :url HTTP/:http-version" :status - :response-time ms'));
  // parse body to json
  app.use(express.json());

  app.use(useAuth.validateApikey, routerProxy);

  // handle 404
  app.use((req, res, next) => {
    const error = new Error(
      `Invalid route: Can not find ${req.originalUrl} on this server!`
    );
    error.statusCode = 404;
    next(error);
  });

  // handle error
  app.use((error, req, res, next) => {
    const json = {
      error: {
        statusCode: 500,
        message: 'Something went wrong',
      },
    };
    console.log('Error config:\n', error.config);
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.log('Error response status:', error.response.status);
      console.log('Error response headers:\n', error.response.headers);
      console.log('Error response data:\n', error.response.data);
      // json.error.statusCode = error.response.status;
      // json.error.message = JSON.stringify(error.response.data);
      res.set(error.response.headers);
      res.status(error.response.status).send(error.response.data);
      return;
    } else if (error.request) {
      // The request was made but no response was received
      // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
      // http.ClientRequest in node.js
      console.log('Error request:\n', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.log('Error:\n', error.message);
      json.error.statusCode = error.statusCode;
      json.error.message = error.message;
    }

    res.status(error.statusCode || 500);
    return res.json(json);
  });

  app.listen(
    config.APP_PORT,
    console.log(`Server started on port ${config.APP_PORT}`)
  );
}

main();
