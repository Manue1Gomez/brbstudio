const AppError = require('./appError');
const { withTransaction } = require('../config/db');
const { BOOKING_STATUS } = require('../config/bookingStatus');
const {
  ONGOING_STATUSES,
  STATUS_TRANSITIONS,
  SCHEDULE_CONFLICT_STATUSES,
  GROUP_BY_STATUS,
} = require('../config/bookingRules');
const bookingManagementModel = require('../models/bookingManagementModel');
const blockedDateModel = require('../models/blockedDateModel');
const paymentModel = require('../models/paymentModel');
const { splitServices } = require('../models/bookingSql');
const { toCents, fromCents } = require('./money');
const { describePayment } = require('./paymentRules');
const { formatMinutes, formatTimeRange, isValidIsoDate, timeTextToMinutes, todayIso } = require('./timeHelper');

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const MAX_SEARCH_LENGTH = 100;
const MAX_ADDRESS_LENGTH = 255;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const ALL_STATUSES = Object.values(BOOKING_STATUS);

const asText = (value) => String(value ?? '').trim();

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new AppError('Booking not found.', 404);
  return id;
}

function parsePositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function readListQuery(query) {
  const status = asText(query.status);
  const date = asText(query.date);
  const search = asText(query.search).slice(0, MAX_SEARCH_LENGTH);

  if (status && status !== 'all' && !ALL_STATUSES.includes(status)) {
    throw new AppError('Unknown booking status.', 400, { status: 'Unknown booking status.' });
  }
  if (date && !isValidIsoDate(date)) {
    throw new AppError('Date must be a valid YYYY-MM-DD value.', 400, { date: 'Enter a valid date.' });
  }

  return {
    filters: {
      search: search || null,
      serviceId: parsePositiveInteger(query.serviceId, null),
      date: date || null,
    },
    status: status && status !== 'all' ? status : null,
    page: parsePositiveInteger(query.page, 1),
    pageSize: Math.min(parsePositiveInteger(query.pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE),
  };
}

function toListEntry(row) {
  const totalCents = toCents(row.totalAmount);
  const paidCents = toCents(row.amountPaid);

  return {
    id: row.id,
    reference: row.reference,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    services: splitServices(row.services),
    eventDate: row.eventDate,
    timeLabel: formatTimeRange(row.startMinutes, row.endMinutes),
    status: row.status,
    group: GROUP_BY_STATUS[row.status],
    totalAmount: fromCents(totalCents),
    amountPaid: fromCents(paidCents),
    paymentLabel: describePayment(totalCents, paidCents),
    pendingPayments: row.pendingPayments,
  };
}

async function listBookings(query = {}) {
  const { filters, status, page, pageSize } = readListQuery(query);

  const [rows, total, statusCounts] = await Promise.all([
    bookingManagementModel.findPage(filters, status, pageSize, (page - 1) * pageSize),
    bookingManagementModel.countFiltered(filters, status),
    bookingManagementModel.countByStatus(filters),
  ]);

  const counts = Object.fromEntries(ALL_STATUSES.map((name) => [name, 0]));
  statusCounts.forEach((row) => {
    counts[row.status] = row.total;
  });
  counts.all = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return { bookings: rows.map(toListEntry), page, pageSize, total, counts };
}

function allowedStatusesFor(booking, today) {
  const paidCents = toCents(booking.amountPaid);

  return STATUS_TRANSITIONS[booking.status].filter((next) => {
    if (next === BOOKING_STATUS.PENDING || next === BOOKING_STATUS.REJECTED) return paidCents === 0;
    if (next === BOOKING_STATUS.COMPLETED) return booking.eventDate <= today;
    return true;
  });
}

function toPaymentEntry(row) {
  return {
    id: row.id,
    type: row.type,
    method: row.method,
    amount: Number(row.amount),
    status: row.status,
    referenceNumber: row.referenceNumber,
    proofUrl: row.proofUrl,
    rejectReason: row.rejectReason,
    note: row.note,
    recordedBy: row.recordedBy,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
  };
}

async function getBookingDetails(rawId) {
  const id = parseId(rawId);
  const details = await bookingManagementModel.findDetails(id);
  if (!details) throw new AppError('Booking not found.', 404);

  const [services, payments] = await Promise.all([
    bookingManagementModel.findServices(id),
    paymentModel.findByBooking(id),
  ]);

  const totalCents = toCents(details.totalAmount);
  const paidCents = toCents(details.amountPaid);

  return {
    id: details.id,
    reference: details.reference,
    status: details.status,
    group: GROUP_BY_STATUS[details.status],
    customer: {
      id: details.customerId,
      name: details.customerName,
      email: details.customerEmail,
      contactNumber: details.customerContact,
    },
    eventDate: details.eventDate,
    startTime: details.startTime,
    endTime: details.endTime,
    timeLabel: formatTimeRange(timeTextToMinutes(details.startTime), timeTextToMinutes(details.endTime)),
    eventAddress: details.eventAddress,
    services: services.map((service) => ({ id: service.id, name: service.name, price: Number(service.price) })),
    voucherCode: details.voucherCode,
    subtotal: Number(details.subtotal),
    discountAmount: Number(details.discountAmount),
    totalAmount: fromCents(totalCents),
    amountPaid: fromCents(paidCents),
    balance: fromCents(totalCents - paidCents),
    paymentLabel: describePayment(totalCents, paidCents),
    createdAt: details.createdAt,
    canReschedule: ONGOING_STATUSES.includes(details.status),
    allowedStatuses: allowedStatusesFor(details, todayIso()),
    payments: payments.map(toPaymentEntry),
  };
}

function readUpdateInput(body, booking) {
  const address = body.eventAddress === undefined ? booking.eventAddress : asText(body.eventAddress);

  return {
    status: asText(body.status ?? booking.status),
    eventDate: asText(body.eventDate ?? booking.eventDate),
    startTime: asText(body.startTime ?? booking.startTime),
    endTime: asText(body.endTime ?? booking.endTime),
    eventAddress: address || null,
  };
}

function validateUpdateInput(input) {
  const errors = {};

  if (!ALL_STATUSES.includes(input.status)) errors.status = 'Choose a valid status.';
  if (!isValidIsoDate(input.eventDate)) errors.eventDate = 'Enter a valid event date.';
  if (!TIME_PATTERN.test(input.startTime)) errors.startTime = 'Enter a valid start time.';
  if (!TIME_PATTERN.test(input.endTime)) errors.endTime = 'Enter a valid end time.';
  if (!errors.startTime && !errors.endTime && input.endTime <= input.startTime) {
    errors.endTime = 'End time must be later than the start time.';
  }
  if (input.eventAddress && input.eventAddress.length > MAX_ADDRESS_LENGTH) {
    errors.eventAddress = `Address must be ${MAX_ADDRESS_LENGTH} characters or fewer.`;
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError('Please fix the highlighted fields.', 400, errors);
  }
}

function assertTransitionAllowed(booking, nextStatus, today) {
  if (allowedStatusesFor(booking, today).includes(nextStatus)) return;

  let message = `A ${booking.status} booking can't be changed to ${nextStatus}.`;

  if (STATUS_TRANSITIONS[booking.status].includes(nextStatus)) {
    if (nextStatus === BOOKING_STATUS.COMPLETED) message = "This event hasn't happened yet, so it can't be marked as completed.";
    else message = 'Payments were already received for this booking, so its status can no longer be moved back or rejected.';
  } else if (nextStatus === BOOKING_STATUS.CONFIRMED && booking.status === BOOKING_STATUS.TO_PAY) {
    message = 'A booking becomes Confirmed automatically once the 50% downpayment is verified on the Payments page.';
  }

  throw new AppError(message, 409, { status: message });
}

async function assertScheduleAvailable(connection, bookingId, input) {
  if (await blockedDateModel.exists(input.eventDate)) {
    const message = 'This date is blocked. Unblock it in the Calendar first, or choose another date.';
    throw new AppError(message, 409, { eventDate: message });
  }

  const serviceIds = await bookingManagementModel.findServiceIds(connection, bookingId);
  const conflict = await bookingManagementModel.findConflict(connection, {
    bookingId,
    date: input.eventDate,
    startTime: input.startTime,
    endTime: input.endTime,
    serviceIds,
    statuses: SCHEDULE_CONFLICT_STATUSES,
  });

  if (conflict) {
    const range = formatTimeRange(timeTextToMinutes(conflict.startTime), timeTextToMinutes(conflict.endTime));
    throw new AppError(`${conflict.serviceName} is already booked from ${range} (#${conflict.reference}).`, 409, {
      schedule: `${conflict.serviceName} is already booked from ${range} (#${conflict.reference}).`,
    });
  }
}

async function updateBooking(rawId, body = {}) {
  const id = parseId(rawId);
  const today = todayIso();

  await withTransaction(async (connection) => {
    const booking = await bookingManagementModel.lockById(connection, id);
    if (!booking) throw new AppError('Booking not found.', 404);

    const input = readUpdateInput(body, booking);
    validateUpdateInput(input);

    const statusChanged = input.status !== booking.status;
    const scheduleChanged =
      input.eventDate !== booking.eventDate ||
      input.startTime !== booking.startTime ||
      input.endTime !== booking.endTime;

    if (statusChanged) assertTransitionAllowed(booking, input.status, today);

    if (scheduleChanged) {
      if (!ONGOING_STATUSES.includes(booking.status)) {
        throw new AppError("Completed or rejected bookings can't be rescheduled.", 409);
      }
      if (input.eventDate < today) {
        const message = 'Choose today or a later date.';
        throw new AppError(message, 400, { eventDate: message });
      }
    }

    const needsAvailabilityCheck =
      (scheduleChanged && ONGOING_STATUSES.includes(input.status)) ||
      (statusChanged && input.status === BOOKING_STATUS.TO_PAY);

    if (needsAvailabilityCheck) await assertScheduleAvailable(connection, id, input);

    await bookingManagementModel.update(connection, id, input);
  });

  return getBookingDetails(id);
}

async function deleteBooking(rawId) {
  const id = parseId(rawId);

  if (!(await bookingManagementModel.remove(id))) throw new AppError('Booking not found.', 404);
}

module.exports = { listBookings, getBookingDetails, updateBooking, deleteBooking };
