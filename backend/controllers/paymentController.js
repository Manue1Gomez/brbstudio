const paymentService = require('../services/paymentService');
const sendError = require('./errorResponse');

async function getOverview(req, res, next) {
  try {
    res.json(await paymentService.getOverview());
  } catch (error) {
    next(error);
  }
}

async function verify(req, res, next) {
  try {
    res.json(await paymentService.verifyPayment(req.params.id));
  } catch (error) {
    sendError(error, res, next);
  }
}

async function reject(req, res, next) {
  try {
    res.json(await paymentService.rejectPayment(req.params.id, req.body?.reason));
  } catch (error) {
    sendError(error, res, next);
  }
}

async function record(req, res, next) {
  try {
    res.status(201).json(await paymentService.recordPayment(req.body));
  } catch (error) {
    sendError(error, res, next);
  }
}

module.exports = { getOverview, verify, reject, record };
