const AppError = require('./appError');
const bookingManagementModel = require('../models/bookingManagementModel');
const paymentModel = require('../models/paymentModel');
const voucherModel = require('../models/voucherModel');
const { shouldConsumeVoucher, shouldReleaseVoucher } = require('./voucherRedemptionRules');

async function consumeForBooking(connection, booking) {
  if (!shouldConsumeVoucher(booking)) return false;

  const voucher = await voucherModel.findByCodeForUpdate(connection, booking.voucherCode);
  if (voucher && !(await voucherModel.incrementUsedCount(connection, voucher.id))) {
    const message = 'This voucher reached its usage limit before payment was submitted. Please contact the studio for help.';
    throw new AppError(message, 409, { voucherCode: message });
  }

  await bookingManagementModel.setVoucherConsumed(connection, booking.id, true);
  booking.voucherConsumed = true;
  return true;
}

async function releaseForBooking(connection, booking, { force = false } = {}) {
  if (!booking?.voucherCode || !booking.voucherConsumed) return false;

  const hasActivePayment = force
    ? false
    : await paymentModel.hasActivePaymentForBooking(connection, booking.id);
  if (!shouldReleaseVoucher(booking, hasActivePayment, force)) return false;

  await voucherModel.decrementUsedCount(connection, booking.voucherCode);
  await bookingManagementModel.setVoucherConsumed(connection, booking.id, false);
  booking.voucherConsumed = false;
  return true;
}

async function releaseIfNoActivePayment(connection, booking) {
  return releaseForBooking(connection, booking);
}

module.exports = { consumeForBooking, releaseForBooking, releaseIfNoActivePayment };
