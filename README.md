# MOPH Proxy API

## MOPH IC API Document

https://docs.google.com/document/d/1Inyhfrte0pECsD8YoForTL2W8B2hOxezf0GpTGEjJr8/edit

## Development

- Set env rename `nodemon.example.json` to `nodemon.json` and config with your data

```json
{
  "env": {
    "MOPH_C19_API": "https://cloud4.hosxp.net",
    "MOPH_C19_AUTH": "https://cvp1.moph.go.th",
    "MOPH_C19_AUTH_SECRET": "secret_key",
    "MOPH_USER": "your-username",
    "MOPH_PASSWD": "your-password",
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

- Create `moph-ic-proxy.env` file

```env
MOPH_C19_API=https://cvp1.moph.go.th
MOPH_C19_AUTH_SECRET=secret_key
MOPH_USER=your-user
MOPH_PASSWD=your-password
MOPH_HCODE=your-hcode
```

- To deploy with this production Compose file you can run

```bash
# create docker network
$ docker network create webproxy

# deploy
$ docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```
