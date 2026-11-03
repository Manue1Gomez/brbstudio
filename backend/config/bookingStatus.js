// Single source of truth for booking.Status values.
// If the database stores different labels, change them here only.
const BOOKING_STATUS = Object.freeze({
  PENDING: 'Pending',
  TO_PAY: 'To Pay',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
});

// Accepted by the admin and still holding a schedule slot.
const UPCOMING_STATUSES = [BOOKING_STATUS.TO_PAY, BOOKING_STATUS.CONFIRMED];

// Shown on the day schedule (past days still show finished work).
const DAY_SCHEDULE_STATUSES = [
  BOOKING_STATUS.TO_PAY,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.COMPLETED,
];

// Bookings whose remaining balance the studio is still waiting on.
const COLLECTIBLE_STATUSES = [
  BOOKING_STATUS.TO_PAY,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.COMPLETED,
];

module.exports = {
  BOOKING_STATUS,
  UPCOMING_STATUSES,
  DAY_SCHEDULE_STATUSES,
  COLLECTIBLE_STATUSES,
};
