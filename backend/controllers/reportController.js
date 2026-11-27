const reportService = require('../services/reportService');
const sendError = require('./errorResponse');

async function getReport(req, res, next) {
  try {
    res.json(await reportService.getReport(req.query));
  } catch (error) {
    sendError(error, res, next);
  }
}

module.exports = { getReport };
