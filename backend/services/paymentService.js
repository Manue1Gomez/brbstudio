const AppError = require('./appError');
const { withTransaction } = require('../config/db');
const { BOOKING_STATUS } = require('../config/bookingStatus');
const { PAYABLE_STATUSES } = require('../config/bookingRules');
const paymentModel = require('../models/paymentModel');
const bookingManagementModel = require('../models/bookingManagementModel');
const { splitServices } = require('../models/bookingSql');
const receiptEmailService = require('./receiptEmailService');
const { toCents, fromCents, parseAmountToCents } = require('./money');
const { requiredDownpaymentCents, statusAfterPayment } = require('./paymentRules');
const { formatTimeRange, timeTextToMinutes, todayIso } = require('./timeHelper');

const PAYMENT_METHODS = ['GCash', 'Cash'];
const MAX_NOTE_LENGTH = 255;
const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 255;

const peso = (cents) =>
  `\u20B1${(cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new AppError('Payment not found.', 404);
  return id;
}

function toReviewEntry(row) {
  const totalCents = toCents(row.totalAmount);
  const paidCents = toCents(row.amountPaid);
  const amountCents = toCents(row.amount);
  const requiredCents = requiredDownpaymentCents(totalCents);

  return {
    id: row.id,
    bookingId: row.bookingId,
    reference: row.reference,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    services: splitServices(row.services),
    type: row.type,
    method: row.method,
    referenceNumber: row.referenceNumber,
    proofUrl: row.proofUrl,
    submittedAt: row.submittedAt,
    totalAmount: fromCents(totalCents),
    amount: fromCents(amountCents),
    balanceAfter: fromCents(totalCents - paidCents - amountCents),
    requiredDownpayment: fromCents(requiredCents),
    belowRequiredDownpayment: row.type === 'Downpayment' && paidCents + amountCents < requiredCents,
  };
}

function toOutstandingEntry(row, today) {
  const totalCents = toCents(row.totalAmount);
  const paidCents = toCents(row.amountPaid);

  return {
    id: row.id,
    reference: row.reference,
    customerName: row.customerName,
    services: splitServices(row.services),
    eventDate: row.eventDate,
    timeLabel: formatTimeRange(row.startMinutes, row.endMinutes),
    status: row.status,
    totalAmount: fromCents(totalCents),
    amountPaid: fromCents(paidCents),
    balance: fromCents(totalCents - paidCents),
    paidPercent: Math.round((paidCents / totalCents) * 100),
    awaitingDownpayment: paidCents === 0,
    pendingPayments: row.pendingPayments,
    overdue: row.eventDate < today,
  };
}

async function getOverview() {
  const [pending, outstanding] = await Promise.all([
    paymentModel.findPendingForReview(),
    paymentModel.findOutstandingBookings(PAYABLE_STATUSES),
  ]);

  const today = todayIso();
  const outstandingEntries = outstanding.map((row) => toOutstandingEntry(row, today));
  const outstandingCents = outstandingEntries.reduce((sum, entry) => sum + toCents(entry.balance), 0);

  return {
    toReview: pending.map(toReviewEntry),
    outstanding: outstandingEntries,
    outstandingTotal: fromCents(outstandingCents),
  };
}

async function sendReceipt({ paymentId, bookingId, outcome }) {
  try {
    const [details, services, payments] = await Promise.all([
      bookingManagementModel.findDetails(bookingId),
      bookingManagementModel.findServices(bookingId),
      paymentModel.findByBooking(bookingId),
    ]);

    const payment = payments.find((entry) => entry.id === paymentId);
    const totalCents = toCents(details.totalAmount);
    const paidCents = toCents(details.amountPaid);

    const result = await receiptEmailService.sendPaymentReceipt({
      outcome,
      customerEmail: details.customerEmail,
      customerFirstName: details.customerName.split(' ')[0],
      reference: details.reference,
      eventDate: details.eventDate,
      timeLabel: formatTimeRange(timeTextToMinutes(details.startTime), timeTextToMinutes(details.endTime)),
      address: details.eventAddress,
      services: services.map((service) => ({ name: service.name, priceCents: toCents(service.price) })),
      subtotalCents: toCents(details.subtotal),
      discountCents: toCents(details.discountAmount),
      voucherCode: details.voucherCode,
      totalCents,
      paidCents,
      balanceCents: totalCents - paidCents,
      requiredDownpaymentCents: requiredDownpaymentCents(totalCents),
      payment: {
        type: payment.type,
        method: payment.method,
        referenceNumber: payment.referenceNumber,
        amountCents: toCents(payment.amount),
      },
    });

    if (result.status === 'sent') await paymentModel.markReceiptSent(paymentId);
    return result;
  } catch (error) {
    console.error(`Could not prepare the e-receipt: ${error.message}`);
    return { status: 'failed', to: null };
  }
}

async function verifyPayment(rawId) {
  const id = parseId(rawId);

  const result = await withTransaction(async (connection) => {
    const bookingId = await paymentModel.findBookingId(connection, id);
    if (!bookingId) throw new AppError('Payment not found.', 404);

    const booking = await bookingManagementModel.lockById(connection, bookingId);
    const payment = await paymentModel.findForUpdate(connection, id);

    if (payment.status !== 'Pending') {
      throw new AppError(`This payment was already ${payment.status.toLowerCase()}.`, 409);
    }
    if (!PAYABLE_STATUSES.includes(booking.status)) {
      throw new AppError('This booking has not been accepted, so its payment cannot be verified.', 409);
    }

    const totalCents = toCents(booking.totalAmount);
    const paidCents = toCents(booking.amountPaid);
    const amountCents = toCents(payment.amount);

    if (paidCents + amountCents > totalCents) {
      throw new AppError('This payment is more than the remaining balance of the booking. Reject it instead.', 409);
    }

    const paidAfter = paidCents + amountCents;
    const statusAfter = statusAfterPayment(booking.status, paidAfter, totalCents);

    await paymentModel.markVerified(connection, id);
    await bookingManagementModel.addToPaid(connection, bookingId, fromCents(amountCents));
    if (statusAfter !== booking.status) await bookingManagementModel.setStatus(connection, bookingId, statusAfter);

    let outcome = receiptEmailService.OUTCOME.RECEIVED;
    if (statusAfter !== booking.status) outcome = receiptEmailService.OUTCOME.CONFIRMED;
    else if (booking.status === BOOKING_STATUS.TO_PAY) outcome = receiptEmailService.OUTCOME.PARTIAL_DOWNPAYMENT;

    return { bookingId, outcome, bookingStatus: statusAfter, paidCents: paidAfter, totalCents };
  });

  const email = await sendReceipt({ paymentId: id, bookingId: result.bookingId, outcome: result.outcome });

  return {
    id,
    status: 'Verified',
    bookingStatus: result.bookingStatus,
    amountPaid: fromCents(result.paidCents),
    balance: fromCents(result.totalCents - result.paidCents),
    email,
  };
}

async function rejectPayment(rawId, rawReason) {
  const id = parseId(rawId);
  const reason = String(rawReason ?? '').trim();

  if (reason.length < MIN_REASON_LENGTH || reason.length > MAX_REASON_LENGTH) {
    const message = `Write a reason of ${MIN_REASON_LENGTH} to ${MAX_REASON_LENGTH} characters. The customer will see it.`;
    throw new AppError(message, 400, { reason: message });
  }

  await withTransaction(async (connection) => {
    const bookingId = await paymentModel.findBookingId(connection, id);
    if (!bookingId) throw new AppError('Payment not found.', 404);

    await bookingManagementModel.lockById(connection, bookingId);
    const payment = await paymentModel.findForUpdate(connection, id);

    if (payment.status !== 'Pending') {
      throw new AppError(`This payment was already ${payment.status.toLowerCase()}.`, 409);
    }

    await paymentModel.markRejected(connection, id, reason);
  });

  return { id, status: 'Rejected' };
}

function readRecordInput(body) {
  const errors = {};
  const markFullyPaid = body.markFullyPaid === true || body.markFullyPaid === 'true';
  const method = String(body.method ?? '');
  const note = String(body.note ?? '').trim();

  if (!PAYMENT_METHODS.includes(method)) errors.method = 'Choose how the payment was received.';
  if (note.length > MAX_NOTE_LENGTH) errors.note = `Note must be ${MAX_NOTE_LENGTH} characters or fewer.`;

  let amountCents = null;
  if (!markFullyPaid) {
    amountCents = parseAmountToCents(body.amount);
    if (amountCents === null) errors.amount = 'Enter an amount greater than 0, e.g. 1500 or 1500.50.';
  }

  return { errors, markFullyPaid, method, note: note || null, amountCents };
}

async function recordPayment(body = {}) {
  const bookingId = Number(body.bookingId);
  if (!Number.isInteger(bookingId) || bookingId < 1) throw new AppError('Booking not found.', 404);

  const input = readRecordInput(body);
  if (Object.keys(input.errors).length > 0) {
    throw new AppError('Please fix the highlighted fields.', 400, input.errors);
  }

  return withTransaction(async (connection) => {
    const booking = await bookingManagementModel.lockById(connection, bookingId);
    if (!booking) throw new AppError('Booking not found.', 404);

    if (!PAYABLE_STATUSES.includes(booking.status)) {
      throw new AppError('Payments can only be recorded for accepted bookings.', 409);
    }

    const totalCents = toCents(booking.totalAmount);
    const paidCents = toCents(booking.amountPaid);
    const remainingCents = totalCents - paidCents;

    if (remainingCents <= 0) throw new AppError('This booking is already fully paid.', 409);

    const amountCents = input.markFullyPaid ? remainingCents : input.amountCents;
    if (amountCents > remainingCents) {
      const message = `Amount can't be more than the remaining balance of ${peso(remainingCents)}.`;
      throw new AppError(message, 400, { amount: message });
    }

    const paidAfter = paidCents + amountCents;
    const statusAfter = statusAfterPayment(booking.status, paidAfter, totalCents);

    await paymentModel.insertVerifiedByAdmin(connection, {
      bookingId,
      type: paidCents === 0 ? 'Downpayment' : 'Balance',
      amount: fromCents(amountCents),
      method: input.method,
      note: input.note,
    });
    await bookingManagementModel.addToPaid(connection, bookingId, fromCents(amountCents));
    if (statusAfter !== booking.status) await bookingManagementModel.setStatus(connection, bookingId, statusAfter);

    return {
      bookingId,
      recorded: fromCents(amountCents),
      bookingStatus: statusAfter,
      amountPaid: fromCents(paidAfter),
      balance: fromCents(totalCents - paidAfter),
    };
  });
}

module.exports = { getOverview, verifyPayment, rejectPayment, recordPayment };
