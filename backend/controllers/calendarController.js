const calendarService = require('../services/calendarService');
const sendError = require('./errorResponse');

async function getMonthOverview(req, res, next) {
  try {
    res.json(await calendarService.getMonthOverview(req.query.month));
  } catch (error) {
    sendError(error, res, next);
  }
}

async function getBlockedDatesInMonth(req, res, next) {
  try {
    res.json(await calendarService.getBlockedDatesInMonth(req.query.month));
  } catch (error) {
    sendError(error, res, next);
  }
}

async function getDayDetails(req, res, next) {
  try {
    res.json(await calendarService.getDayDetails(req.query.date));
  } catch (error) {
    sendError(error, res, next);
  }
}

async function listBlockedDates(req, res, next) {
  try {
    res.json(await calendarService.listUpcomingBlockedDates());
  } catch (error) {
    next(error);
  }
}

async function blockDate(req, res, next) {
  try {
    res.status(201).json(await calendarService.blockDate(req.body?.date));
  } catch (error) {
    sendError(error, res, next);
  }
}

async function unblockDate(req, res, next) {
  try {
    await calendarService.unblockDate(req.params.date);
    res.status(204).end();
  } catch (error) {
    sendError(error, res, next);
  }
}

module.exports = {
  getMonthOverview,
  getBlockedDatesInMonth,
  getDayDetails,
  listBlockedDates,
  blockDate,
  unblockDate,
};
