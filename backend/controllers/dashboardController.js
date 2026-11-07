const dashboardService = require('../services/dashboardService');
const { isValidIsoDate, todayIso } = require('../services/timeHelper');

async function getSummary(req, res, next) {
  try {
    res.json(await dashboardService.getSummary());
  } catch (error) {
    next(error);
  }
}

async function getUpcomingBookings(req, res, next) {
  try {
    res.json(await dashboardService.getUpcomingBookings());
  } catch (error) {
    next(error);
  }
}

async function getDaySchedule(req, res, next) {
  const date = req.query.date || todayIso();

  if (!isValidIsoDate(date)) {
    return res.status(400).json({ message: 'Date must be a valid YYYY-MM-DD value.' });
  }

  try {
    res.json(await dashboardService.getDaySchedule(date));
  } catch (error) {
    next(error);
  }
}

module.exports = { getSummary, getUpcomingBookings, getDaySchedule };
