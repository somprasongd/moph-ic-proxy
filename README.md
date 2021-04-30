# MOPH Proxy API

## Development

- Set env rename `nodemon.example.jso` to `nodemon.json` and config with your data

```json
{
  "env": {
    "MOPH_C19_API": "https://cloud4.hosxp.net",
    "MOPH_C19_AUTH": "https://cvp1.moph.go.th",
    "MOPH_USER": "your-username",
    "MOPH_PASSWD": "your-hashed-password",
    "MOPH_HCODE": "your-hcode"
  }
}
```

- Start redis server you can run

```bash
$ docker-compose up -d
```

- Install dependencies

```bash
$ npm install
```

- Run dev server

```bash
$ npm run dev
```

## Production

- Change environtment with your data in `docker-compose.prod.yml`

```json
environment:
  - TZ=Asia/Bangkok
  - MOPH_C19_API=https://cloud4.hosxp.net # do not config MOPH_C19_AUTH in production
  - MOPH_USER=your-username
  - MOPH_PASSWD=your-hashed-password
  - MOPH_HCODE=your-hcode
```

- To deploy with this production Compose file you can run

```bash
# create docker network
$ docker network create webproxy

# deploy
$ docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```
