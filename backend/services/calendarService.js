const AppError = require('./appError');
const bookingModel = require('../models/bookingModel');
const blockedDateModel = require('../models/blockedDateModel');
const { CALENDAR_STATUSES, UPCOMING_STATUSES } = require('../config/bookingStatus');
const { formatMinutes, isValidIsoDate, todayIso } = require('./timeHelper');

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MYSQL_DUPLICATE_ENTRY = 'ER_DUP_ENTRY';

function requireDate(value) {
  if (!isValidIsoDate(value)) {
    const message = 'Date must be a valid YYYY-MM-DD value.';
    throw new AppError(message, 400, { date: message });
  }

  return value;
}

function monthRange(month) {
  if (!MONTH_PATTERN.test(month ?? '')) {
    throw new AppError('Month must be in YYYY-MM format.', 400, { month: 'Month must be in YYYY-MM format.' });
  }

  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = String(new Date(year, monthNumber, 0).getDate()).padStart(2, '0');

  return { start: `${month}-01`, end: `${month}-${lastDay}` };
}

function toBookingSummary(row) {
  return {
    id: row.id,
    clientName: row.clientName,
    services: row.serviceNames,
    status: row.status,
    timeLabel: `${formatMinutes(row.startMinutes)} - ${formatMinutes(row.endMinutes)}`,
  };
}

async function getMonthOverview(month) {
  const { start, end } = monthRange(month);

  const [bookedDates, blockedDates] = await Promise.all([
    bookingModel.findBookedDates(start, end, CALENDAR_STATUSES),
    blockedDateModel.findBetween(start, end),
  ]);

  return { month, bookedDates, blockedDates };
}

async function getBlockedDatesInMonth(month) {
  const { start, end } = monthRange(month);

  return { month, blockedDates: await blockedDateModel.findBetween(start, end) };
}

async function getDayDetails(date) {
  requireDate(date);

  const [bookings, blocked] = await Promise.all([
    bookingModel.findOnDate(date, CALENDAR_STATUSES),
    blockedDateModel.exists(date),
  ]);

  return { date, blocked, bookings: bookings.map(toBookingSummary) };
}

async function getPublicDayAvailability(date) {
  requireDate(date);

  const [bookedServices, blocked] = await Promise.all([
    bookingModel.findBookedServices(date, UPCOMING_STATUSES),
    blockedDateModel.exists(date),
  ]);

  return {
    date,
    blocked,
    booked: bookedServices.map((row) => ({
      serviceName: row.serviceName,
      timeLabel: `${formatMinutes(row.startMinutes)} - ${formatMinutes(row.endMinutes)}`,
    })),
  };
}

function listUpcomingBlockedDates() {
  return blockedDateModel.findFrom(todayIso());
}

async function blockDate(date) {
  requireDate(date);

  if (date < todayIso()) {
    const message = "A date that has already passed can't be blocked.";
    throw new AppError(message, 400, { date: message });
  }

  try {
    await blockedDateModel.create(date);
  } catch (error) {
    if (error.code === MYSQL_DUPLICATE_ENTRY) {
      const message = 'This date is already blocked.';
      throw new AppError(message, 409, { date: message });
    }
    throw error;
  }

  return { date };
}

async function unblockDate(date) {
  requireDate(date);

  if (!(await blockedDateModel.remove(date))) throw new AppError('This date is not blocked.', 404);
}

module.exports = {
  getMonthOverview,
  getBlockedDatesInMonth,
  getDayDetails,
  getPublicDayAvailability,
  listUpcomingBlockedDates,
  blockDate,
  unblockDate,
};
