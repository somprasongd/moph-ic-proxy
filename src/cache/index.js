const redis = require('redis');

const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } = require('../config');

let redisClient;

const createClient = () =>
  new Promise((resolve, reject) => {
    const option = {
      host: REDIS_HOST,
      port: REDIS_PORT,
    };

    if (REDIS_PASSWORD) {
      option.password = REDIS_PASSWORD;
    }

    redisClient = redis.createClient(option);

    redisClient.on('connect', function () {
      console.log('Redis: connected.');
      redisClient.del('token');
      return resolve();
    });

    redisClient.on('error', function (error) {
      console.error(error);
      return reject(error);
    });
  });

const get = (key) =>
  new Promise((resolve, reject) => {
    redisClient.get(key, (err, reply) => {
      if (err) {
        console.log(err);
        return reject(err);
      }
      // reply is null when the key is missing
      if (reply === null) {
        return resolve(null);
      }
      resolve(reply);
    });
  });

const set = (key, value) =>
  new Promise((resolve, reject) => {
    redisClient.set(key, value, (err, reply) => {
      if (err) {
        console.log(err);
        return reject(err);
      }
      resolve(reply);
    });
  });

const setex = (key, value, unixTimestamp) =>
  new Promise((resolve, reject) => {
    redisClient.set(key, value, (err, reply) => {
      if (err) {
        console.log(err);
        return reject(err);
      }

      redisClient.expireat(key, unixTimestamp);
      resolve(reply);
    });
  });

const del = (key) =>
  new Promise((resolve, reject) => {
    redisClient.del(key, (err, result) => {
      if (err) {
        return reject(err);
      }
      return resolve(result);
    });
  });

module.exports = { createClient, get, set, setex, del };
