const bookingModel = require('../models/bookingModel');
const customerModel = require('../models/customerModel');
const serviceModel = require('../models/serviceModel');
const { parseTimeSlot, formatMinutes } = require('./timeHelper');
const {
  BOOKING_STATUS,
  UPCOMING_STATUSES,
  DAY_SCHEDULE_STATUSES,
  COLLECTIBLE_STATUSES,
} = require('../config/bookingStatus');

const UPCOMING_LIMIT = 10;
// Time_Slot is text, so ordering within a day happens here, not in SQL.
const UPCOMING_FETCH_LIMIT = 50;

async function getSummary() {
  const [totalBookings, waitingForReview, totalClients, paymentsToCollect] = await Promise.all([
    bookingModel.countAll(),
    bookingModel.countByStatus(BOOKING_STATUS.PENDING),
    customerModel.countAll(),
    bookingModel.sumBalanceByStatuses(COLLECTIBLE_STATUSES),
  ]);

  return { totalBookings, waitingForReview, totalClients, paymentsToCollect };
}

async function getUpcomingBookings() {
  const rows = await bookingModel.findUpcoming(UPCOMING_STATUSES, UPCOMING_FETCH_LIMIT);

  return rows
    .map((row) => ({ ...row, slot: parseTimeSlot(row.timeSlot) }))
    .sort(
      (a, b) =>
        a.eventDate.localeCompare(b.eventDate) || (a.slot?.start ?? 0) - (b.slot?.start ?? 0)
    )
    .slice(0, UPCOMING_LIMIT)
    .map(({ id, eventDate, serviceName, clientName, timeSlot, slot }) => ({
      id,
      eventDate,
      serviceName,
      clientName,
      startTime: slot ? formatMinutes(slot.start) : timeSlot,
    }));
}

function toScheduleEntry(row) {
  const slot = parseTimeSlot(row.timeSlot);
  if (!slot) return null;

  return {
    id: row.id,
    serviceName: row.serviceName,
    clientName: row.clientName,
    status: row.status,
    startMinutes: slot.start,
    endMinutes: slot.end,
    timeLabel: `${formatMinutes(slot.start)} - ${formatMinutes(slot.end)}`,
  };
}

// One column per active service, each holding that service's bookings for the day.
async function getDaySchedule(date) {
  const [services, bookings] = await Promise.all([
    serviceModel.findActive(),
    bookingModel.findByDate(date, DAY_SCHEDULE_STATUSES),
  ]);

  const columns = services.map(({ serviceId, serviceName }) => ({
    serviceId,
    serviceName,
    bookings: bookings
      .filter((booking) => booking.serviceId === serviceId)
      .map(toScheduleEntry)
      .filter(Boolean),
  }));

  return { date, columns };
}

module.exports = { getSummary, getUpcomingBookings, getDaySchedule };
