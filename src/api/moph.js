// unused
const express = require('express');
const queryString = require('query-string');

const router = express.Router();

router.post('/api/update-immunization', async (req, res, next) => {
  const json = req.body;

  const url = `api/UpdateImmunization`;

  try {
    const respone = await httpClient.post(url, json);
    return res.json(respone.data);
  } catch (error) {
    next(error);
  }
});

router.get('/api/immunization-history/:cid', async (req, res, next) => {
  const { cid } = req.params;

  const url = `api/ImmunizationHistory?cid=${cid}`;

  try {
    const respone = await httpClient.get(url);
    return res.json(respone.data);
  } catch (error) {
    next(error);
  }
});

router.get('/api/immunization-target/:cid/:hcode', async (req, res, next) => {
  const { cid, hcode } = req.params;

  const url = `api/ImmunizationTarget?cid=${cid}&hospital_code=${hcode}`;

  try {
    const respone = await httpClient.get(url);
    return res.json(respone.data);
  } catch (error) {
    next(error);
  }
});

router.get(
  '/api/immunization-reaction/:cid/:vaccineCode',
  async (req, res, next) => {
    const { cid, vaccineCode } = req.params;

    const url = `api/ImmunizationReaction?cid=${cid}&vaccine_code=${vaccineCode}`;

    try {
      const respone = await httpClient.get(url);
      return res.json(respone.data);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/api/lookup-table', async (req, res, next) => {
  const { query } = req;
  const stringified = queryString.stringify(query);
  const url = `api/LookupTable?${stringified}`;
  try {
    const respone = await httpClient.get(url);
    return res.json(respone.data);
  } catch (error) {
    next(error);
  }
});

router.get('/api/immunization-inventory', async (req, res, next) => {
  const url = `api/ImmunizationInventory`;
  try {
    const respone = await httpClient.get(url);
    return res.json(respone.data);
  } catch (error) {
    next(error);
  }
});

router.post('/api/send-immunization-target', async (req, res, next) => {
  const json = req.body;

  const url = `api/SendImmunizationTarget`;

  try {
    const respone = await httpClient.post(url, json);
    return res.json(respone.data);
  } catch (error) {
    next(error);
  }
});

router.get('/api/update-person/:cid/:needVaccine', async (req, res, next) => {
  const { cid, needVaccine } = req.params;

  const url = `api/UpdatePerson?cid=${cid}&need_vaccine=${needVaccine}`;

  try {
    const respone = await httpClient.get(url);
    return res.json(respone.data);
  } catch (error) {
    next(error);
  }
});

router.get(
  '/api/immunization-slot/:dateStart/:dateFinish',
  async (req, res, next) => {
    const { dateStart, dateFinish } = req.params;

    const url = `api/ImmunizationSlot?date_start=${dateStart}&date_finish=${dateFinish}`;

    try {
      const respone = await httpClient.get(url);
      return res.json(respone.data);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/api/get-cid--from-passport-number/:passportNumber/:nationality',
  async (req, res, next) => {
    const { passportNumber, nationality } = req.params;

    const url = `api/GetCIDFromPassportNumber?passport_number=${passportNumber}&nationality=${nationality}`;

    try {
      const respone = await httpClient.get(url);
      return res.json(respone.data);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/api/immunization-list/:date', async (req, res, next) => {
  const { date } = req.params;

  const url = `api/ImmunizationList?date=${date}`;

  try {
    const respone = await httpClient.get(url);
    return res.json(respone.data);
  } catch (error) {
    next(error);
  }
});

router.post('/api/update-lab', async (req, res, next) => {
  const json = req.body;

  const url = `api/UpdateLab`;

  try {
    const respone = await httpClient.post(url, json);
    return res.json(respone.data);
  } catch (error) {
    next(error);
  }
});

router.get(
  '/api/immunization-hospital-slot/:cid/:hospitalCode/:date/:slotTime',
  async (req, res, next) => {
    const { cid, hospitalCode, date, slotTime } = req.params;

    const url = `api/ImmunizationHospitalSlot?Action=ConfirmrouterointmentSlot&cid=${cid}&hospital_code=${hospitalCode}&date=${date}&slot_time=${slotTime}`;

    try {
      const respone = await httpClient.get(url);
      return res.json(respone.data);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;