const rescheduleService = require('../services/rescheduleService');
const sendError = require('./errorResponse');

async function list(req, res, next) {
  try {
    res.json(await rescheduleService.listRequests());
  } catch (error) {
    next(error);
  }
}

async function approve(req, res, next) {
  try {
    res.json(await rescheduleService.approveRequest(req.params.id));
  } catch (error) {
    sendError(error, res, next);
  }
}

async function reject(req, res, next) {
  try {
    res.json(await rescheduleService.rejectRequest(req.params.id));
  } catch (error) {
    sendError(error, res, next);
  }
}

module.exports = { list, approve, reject };
