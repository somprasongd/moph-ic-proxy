const express = require('express');
const config = require('./config');
const routerProxy = require('./api/proxy');
const redisClient = require('./cache');

async function main() {
  try {
    await redisClient.createClient();
  } catch (error) {
    console.log(`Fatal error: ${error.message}`);
  }

  const app = express();
  // parse body to json
  app.use(express.json());

  app.use(routerProxy);

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
    if (app.get('env') === 'development') {
      console.log('Error config', error.config);
    }
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      if (app.get('env') === 'development') {
        console.log('Error response');
        console.log(error.response.data);
        console.log(error.response.status);
        console.log(error.response.headers);
      }
      json.error.statusCode = error.response.status;
      json.error.message = JSON.stringify(error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
      // http.ClientRequest in node.js
      if (app.get('env') === 'development') {
        console.log('Error request');
        console.log(error.request);
      }
    } else {
      // Something happened in setting up the request that triggered an Error
      if (app.get('env') === 'development') {
        console.log('Error', error.message);
      }
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
