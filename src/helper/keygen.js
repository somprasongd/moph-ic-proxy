const fs = require('fs');
const path = require('path');
const util = require('util');
const uuidAPIKey = require('uuid-apikey');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const keygenFile = path.join(
  __dirname,
  '..',
  '..',
  '.authorized_key',
  '.access.key'
);

if (!fs.existsSync(path.dirname(keygenFile))) {
  fs.mkdirSync(path.dirname(keygenFile));
}

let secret;
let apiKey;
async function init() {
  try {
    secret = await readFile(keygenFile, { encoding: 'utf8' });
    apiKey = uuidAPIKey.toAPIKey(secret);
  } catch (error) {
    try {
      const key = uuidAPIKey.create();
      await writeFile(keygenFile, key.uuid, { encoding: 'utf8' });
      secret = key.uuid;
      apiKey = key.apiKey;
    } catch (error) {
      winston.error(error);
    }
  }
  // console.log(`Your api key is ${apiKey}`);
  console.log(`Enable API Key: true`);
}

function verify(apiKey) {
  if (!apiKey || !uuidAPIKey.isAPIKey(apiKey)) {
    return false;
  }

  if (uuidAPIKey.toUUID(apiKey) !== secret) {
    return false;
  }

  return true;
}

function getApiKey() {
  return apiKey;
}

module.exports = {
  init,
  verify,
  getApiKey,
};
