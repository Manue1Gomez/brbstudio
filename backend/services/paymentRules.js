const { BOOKING_STATUS } = require('../config/bookingStatus');

function requiredDownpaymentCents(totalCents) {
  return Math.ceil(totalCents / 2);
}

function describePayment(totalCents, paidCents) {
  if (paidCents <= 0) return 'Unpaid';
  if (paidCents >= totalCents) return 'Fully Paid';
  if (paidCents >= requiredDownpaymentCents(totalCents)) return 'Downpayment Paid';
  return 'Partially Paid';
}

function statusAfterPayment(currentStatus, paidCents, totalCents) {
  const downpaymentReached = paidCents >= requiredDownpaymentCents(totalCents);

  return currentStatus === BOOKING_STATUS.TO_PAY && downpaymentReached
    ? BOOKING_STATUS.CONFIRMED
    : currentStatus;
}

module.exports = { requiredDownpaymentCents, describePayment, statusAfterPayment };
