function shouldConsumeVoucher(booking) {
  return Boolean(booking?.voucherCode && !booking.voucherConsumed);
}

function shouldReleaseVoucher(booking, hasActivePayment, force = false) {
  return Boolean(
    booking?.voucherCode &&
    booking.voucherConsumed &&
    (force || !hasActivePayment)
  );
}

module.exports = { shouldConsumeVoucher, shouldReleaseVoucher };
