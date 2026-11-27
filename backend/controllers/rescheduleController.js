const rescheduleService = require('../services/rescheduleService');

async function list(req, res, next) {
  try {
    res.json(await rescheduleService.listRequests());
  } catch (error) {
    next(error);
  }
}

module.exports = { list };