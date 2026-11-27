const voucherService = require('../services/voucherManagementService');
const sendError = require('./errorResponse');

async function list(req, res, next) {
  try {
    res.json(await voucherService.listVouchers());
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    res.status(201).json(await voucherService.createVoucher(req.body));
  } catch (error) {
    sendError(error, res, next);
  }
}

async function update(req, res, next) {
  try {
    res.json(await voucherService.updateVoucher(req.params.id, req.body));
  } catch (error) {
    sendError(error, res, next);
  }
}

module.exports = { list, create, update };
