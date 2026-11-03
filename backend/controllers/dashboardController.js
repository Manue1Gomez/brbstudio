const dashboardService = require('../services/dashboardService');
const { todayIso } = require('../services/timeHelper');

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (!DATE_FORMAT.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  );
}

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

  if (!isValidDate(date)) {
    return res.status(400).json({ message: 'Date must be a valid YYYY-MM-DD value.' });
  }

  try {
    res.json(await dashboardService.getDaySchedule(date));
  } catch (error) {
    next(error);
  }
}

module.exports = { getSummary, getUpcomingBookings, getDaySchedule };
