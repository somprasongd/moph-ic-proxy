# MOPH Proxy API

## MOPH IC API Document

https://docs.google.com/document/d/1Inyhfrte0pECsD8YoForTL2W8B2hOxezf0GpTGEjJr8/edit

## Development

- Set env rename `nodemon.example.json` to `nodemon.json` and config with your data

```json
{
  "env": {
    "MOPH_CLAIM_API": "https://uat-moph-nhso.inet.co.th",
    "MOPH_PHR_API": "https://phr1.moph.go.th",
    "EPIDEM_API": "https://epidemcenter.moph.go.th/epidem",
    "MOPH_C19_API": "https://cloud4.hosxp.net",
    "MOPH_C19_AUTH": "https://cvp1.moph.go.th",
    "MOPH_C19_AUTH_SECRET": "secret_key",
    "MOPH_USER": "your-username",
    "MOPH_PASSWD": "your-password",
    "MOPH_HCODE": "your-hcode",
    "USE_API_KEY": "true_or_false_default_is_true"
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
USE_API_KEY=true_or_false_default_is_true
```

- To deploy with this production Compose file you can run

```bash
# create docker network
$ docker network create webproxy

# deploy
$ docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## How to use

Call api from `http://your-server-ip:port/api/XXX?x-api-key=moph-ic-proxy-api-key&AAA=yyyy&BBB=zzzz`

If set `USE_API_KEY=false` call `http://your-server-ip:port/api/XXX?AAA=yyyy&BBB=zzzz`

```
http://localhost:9090/api/ImmunizationTarget?x-api-key=ETB4VPB-HJ4MEFA-MJ356Q5-HC3B87B&cid=1659900783037

# OR

http://localhost:9090/api/ImmunizationTarget?cid=1659900783037
```

> XXX is MOPH IC api endpoint

> AAA, BBB is MOPH IC api query parameters

> moph-ic-proxy-api get from log when start server
