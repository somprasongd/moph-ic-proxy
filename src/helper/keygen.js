const fs = require('fs');
const path = require('path');
const util = require('util');
const uuidAPIKey = require('uuid-apikey');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const keygenFile = path.join(__dirname, '..', '..', '.authorized_key', '.access.key');

if (!fs.existsSync(path.dirname(keygenFile))) {
  fs.mkdirSync(path.dirname(keygenFile));
}

let secret;
async function init() {
  try {
    secret = await readFile(keygenFile, { encoding: 'utf8' });
    console.log(`Your api key is ${uuidAPIKey.toAPIKey(secret)}`);
  } catch (error) {
    try {
      const key = uuidAPIKey.create();
      await writeFile(keygenFile, key.uuid, { encoding: 'utf8' });
      secret = key.uuid;
      console.log(`Your api key is ${key.apiKey}`);
    } catch (error) {
      winston.error(error);
    }
  }
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

module.exports = {
  init,
  verify,
};
