const AppError = require('./appError');
const { withTransaction } = require('../config/db');
const { RESCHEDULE_STATUS } = require('../config/bookingStatus');
const { RESCHEDULABLE_STATUSES } = require('../config/bookingRules');
const bookingManagementModel = require('../models/bookingManagementModel');
const rescheduleModel = require('../models/rescheduleModel');
const { splitServices } = require('../models/bookingSql');
const { formatTimeRange } = require('./timeHelper');
const availabilityService = require('./availabilityService');
const customerNotificationEmailService = require('./customerNotificationEmailService');
const workshopEmailService = require('./workshopEmailService');

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

// Approving moves the booking to the requested schedule. The slot is checked again here
// because another booking may have taken it after the customer sent the request.
async function approveRequest(rawId) {
  const id = parseRequestId(rawId);
  let workshopReschedule = null;
  let rescheduleNotification = null;

  await withTransaction(async (connection) => {
    const request = await rescheduleModel.lockPendingById(connection, id);
    if (!request) throw new AppError(NOT_FOUND_MESSAGE, 404);

    const booking = await bookingManagementModel.lockById(connection, request.bookingId);
    if (!booking) throw new AppError('The booking for this request no longer exists.', 404);

    if (!RESCHEDULABLE_STATUSES.includes(booking.status)) {
      throw new AppError(`This booking is now ${booking.status} and can no longer be rescheduled. Reject the request instead.`, 409);
    }

    const services = await bookingManagementModel.findBookingServices(connection, booking.id);
    const schedule = await availabilityService.resolveSchedule(connection, {
      date: request.newDate,
      startTime: request.newStartTime,
      serviceIds: services.map((service) => service.id),
      services,
      bookingId: booking.id,
    });

    await bookingManagementModel.setSchedule(connection, booking.id, {
      eventDate: request.newDate,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
    });
    await rescheduleModel.markReviewed(connection, id, RESCHEDULE_STATUS.APPROVED);

    if (services.some((service) => /modeling workshop/i.test(service.name))) {
      workshopReschedule = { bookingId: booking.id, oldEventDate: booking.eventDate };
    } else {
      rescheduleNotification = {
        bookingId: booking.id,
        status: RESCHEDULE_STATUS.APPROVED,
        requestedDate: request.newDate,
        requestedStartTime: request.newStartTime,
        requestedEndTime: request.newEndTime,
      };
    }
  });

  if (workshopReschedule) {
    await workshopEmailService.sendWorkshopRescheduleEmail(workshopReschedule);
  } else if (rescheduleNotification) {
    await customerNotificationEmailService.sendRescheduleDecisionEmail(rescheduleNotification);
  }

  return { id, status: RESCHEDULE_STATUS.APPROVED };
}

async function rejectRequest(rawId) {
  const id = parseRequestId(rawId);
  let rescheduleNotification = null;

  await withTransaction(async (connection) => {
    const request = await rescheduleModel.lockPendingById(connection, id);
    if (!request) throw new AppError(NOT_FOUND_MESSAGE, 404);

    await rescheduleModel.markReviewed(connection, id, RESCHEDULE_STATUS.REJECTED);
    rescheduleNotification = {
      bookingId: request.bookingId,
      status: RESCHEDULE_STATUS.REJECTED,
      requestedDate: request.newDate,
      requestedStartTime: request.newStartTime,
      requestedEndTime: request.newEndTime,
    };
  });

  if (rescheduleNotification) {
    await customerNotificationEmailService.sendRescheduleDecisionEmail(rescheduleNotification);
  }

  return { id, status: RESCHEDULE_STATUS.REJECTED };
}

module.exports = { listRequests, approveRequest, rejectRequest };
