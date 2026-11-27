const AppError = require('./appError');
const rescheduleModel = require('../models/rescheduleModel');
const { splitServices } = require('../models/bookingSql');
const { formatTimeRange } = require('./timeHelper');

const NOT_FOUND_MESSAGE = 'Request not found or already reviewed.';

function parseRequestId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new AppError(NOT_FOUND_MESSAGE, 404);
  return id;
}

function toRequestEntry(row) {
  return {
    id: row.id,
    bookingId: row.bookingId,
    reference: row.reference,
    customerName: row.customerName,
    services: splitServices(row.services),
    oldDate: row.oldDate,
    oldTimeLabel: formatTimeRange(row.oldStartMinutes, row.oldEndMinutes),
    newDate: row.newDate,
    newTimeLabel: formatTimeRange(row.newStartMinutes, row.newEndMinutes),
    requestedAt: row.requestedAt,
  };
}

async function listRequests() {
  const rows = await rescheduleModel.findPending();
  return { requests: rows.map(toRequestEntry) };
}

module.exports = { listRequests };