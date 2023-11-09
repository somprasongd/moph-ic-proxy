const express = require('express');
const config = require('../../config');

function init(appName) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const apis = [];
    if (config.MOPH_C19_API) {
      apis.push({
        name: 'MOPH Immunization Center',
        url: 'api/ImmunizationTarget?cid=xxxxxxxxxxxxx',
        doc: 'https://docs.google.com/document/d/1Inyhfrte0pECsD8YoForTL2W8B2hOxezf0GpTGEjJr8/edit',
      });
    }
    if (config.EPIDEM_API) {
      apis.push({
        name: 'EPIDEM Center',
        url: 'api/SendEPIDEM?endpoint=epidem',
        doc: 'https://ddc.moph.go.th/viralpneumonia/file/g_surveillance/g_api_epidem_0165.pdf',
      });
    }
    if (config.MOPH_PHR_API) {
      apis.push({
        name: 'MOPH-PHR',
        url: 'api/RequestTokenv1?endpoint=phr',
        doc: 'https://docs.google.com/document/d/1ZWCBJnxVCtjqmBGNjj1sLnYv11dVzUvnweui-26NDJ0/edit',
      });
    }
    if (config.MOPH_CLAIM_API) {
      apis.push({
        name: 'Moph Claim-NHSO',
        url: 'api/v1/opd/service-admissions/dmht?endpoint=claim',
        doc: 'https://docs.google.com/document/d/1iiybB2y7NJkEhXTdS4DbYe3-Fs7aka7MlEns81lzODQ/edit',
      });
    }
    if (config.FDH_API) {
      apis.push({
        name: 'MOPH Financial Data Hub (FDH)',
        url: 'api/v1/data_hub/16_files?endpoint=fdh',
        doc: 'https://drive.google.com/file/d/17XqRmSEOnXoJVwzmCwteuVdy-Gp_SUyW',
      });
    }
    res.render('index', {
      title: appName,
      useApiKey: config.USE_API_KEY,
      host: req.protocol + '://' + req.get('host'),
      apis,
    });
  });

  return router;
}

module.exports = { init };
