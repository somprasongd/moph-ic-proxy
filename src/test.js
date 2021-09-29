const fs = require('fs');
const axios = require('axios');
const path = require('path');

async function main() {
  const data = fs.readFileSync(path.join(__dirname, 'cid.txt'));

  const cids = data.toString().split('\r\n');
  for (const cid of cids) {
    try {
      await axios.get(
        'http://localhost:9090/api/ImmunizationTarget?cid=' + cid,
        {
          headers: {
            'x-api-key': 'ETB4VPB-HJ4MEFA-MJ356Q5-HC3B87B',
          },
        }
      );
    } catch (error) {
      console.log(error);
    }
  }
}

main();
