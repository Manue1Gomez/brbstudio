const AppError = require('./appError');
const { PAYABLE_STATUSES } = require('../config/bookingRules');
const reportModel = require('../models/reportModel');
const serviceModel = require('../models/serviceModel');
const { toCents, fromCents } = require('./money');

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_RANGE_MONTHS = 12;

const asText = (value) => String(value ?? '').trim();

const toMonthKey = (year, monthIndex) => `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

const monthNumber = (key) => {
  const [year, month] = key.split('-').map(Number);
  return year * 12 + month - 1;
};

function defaultRange() {
  const today = new Date();

  return { from: toMonthKey(today.getFullYear(), 0), to: toMonthKey(today.getFullYear(), today.getMonth()) };
}

function readQuery(query) {
  const defaults = defaultRange();
  const from = asText(query.from) || defaults.from;
  const to = asText(query.to) || defaults.to;
  const errors = {};

  if (!MONTH_PATTERN.test(from)) errors.from = 'Choose a valid month.';
  if (!MONTH_PATTERN.test(to)) errors.to = 'Choose a valid month.';

  if (Object.keys(errors).length === 0) {
    const months = monthNumber(to) - monthNumber(from) + 1;

    if (months < 1) errors.to = 'The last month cannot be earlier than the first month.';
    else if (months > MAX_RANGE_MONTHS) errors.to = `Choose a range of up to ${MAX_RANGE_MONTHS} months.`;
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError('Please choose a valid date range.', 400, errors);
  }

  const serviceText = asText(query.serviceId);
  const serviceId = serviceText ? Number(serviceText) : null;

  if (serviceText && (!Number.isInteger(serviceId) || serviceId < 1)) {
    throw new AppError('Service not found.', 404);
  }

  return { from, to, serviceId };
}

function toDateRange(from, to) {
  const [toYear, toMonth] = to.split('-').map(Number);
  const lastDay = new Date(toYear, toMonth, 0).getDate();

  return { startDate: `${from}-01`, endDate: `${to}-${String(lastDay).padStart(2, '0')}` };
}

function listMonths(from, to) {
  const months = [];

  for (let number = monthNumber(from); number <= monthNumber(to); number += 1) {
    months.push(toMonthKey(Math.floor(number / 12), number % 12));
  }

  return months;
}

function toAmounts(row) {
  const valueCents = toCents(row.bookingValue);
  const receivedCents = toCents(row.received);

  return {
    bookingValue: fromCents(valueCents),
    received: fromCents(receivedCents),
    outstanding: fromCents(valueCents - receivedCents),
  };
}

function toMonthlyIncome(months, rows) {
  const incomeByMonth = new Map(rows.map((row) => [row.month, toCents(row.income)]));

  return months.map((month) => ({ month, income: fromCents(incomeByMonth.get(month) ?? 0) }));
}

async function getReport(query = {}) {
  const { from, to, serviceId } = readQuery(query);
  const { startDate, endDate } = toDateRange(from, to);
  const range = { from, to };
  const months = listMonths(from, to);

  if (serviceId === null) {
    const [summary, monthlyIncome, services] = await Promise.all([
      reportModel.findSummary(startDate, endDate, PAYABLE_STATUSES),
      reportModel.findMonthlyIncome(startDate, endDate, PAYABLE_STATUSES),
      reportModel.findBookingsByService(startDate, endDate, PAYABLE_STATUSES),
    ]);

    return {
      range,
      service: null,
      summary: { bookings: summary.bookings, ...toAmounts(summary) },
      monthlyIncome: toMonthlyIncome(months, monthlyIncome),
      services: services.map((row) => ({ id: row.id, name: row.name, bookings: row.bookings, ...toAmounts(row) })),
    };
  }

  const service = await serviceModel.findById(serviceId);
  if (!service) throw new AppError('Service not found.', 404);

  const [summary, monthlyIncome, bookings] = await Promise.all([
    reportModel.findServiceSummary(serviceId, startDate, endDate, PAYABLE_STATUSES),
    reportModel.findServiceMonthlyIncome(serviceId, startDate, endDate, PAYABLE_STATUSES),
    reportModel.findServiceBookings(serviceId, startDate, endDate, PAYABLE_STATUSES),
  ]);

  return {
    range,
    service: { id: service.id, name: service.name },
    summary: { bookings: summary.bookings, ...toAmounts(summary) },
    monthlyIncome: toMonthlyIncome(months, monthlyIncome),
    bookings: bookings.map((row) => ({
      id: row.id,
      reference: row.reference,
      clientName: row.clientName,
      eventDate: row.eventDate,
      status: row.status,
      ...toAmounts(row),
    })),
  };
}

module.exports = { getReport };
