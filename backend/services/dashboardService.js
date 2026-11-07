const bookingModel = require('../models/bookingModel');
const customerModel = require('../models/customerModel');
const serviceModel = require('../models/serviceModel');
const { formatMinutes } = require('./timeHelper');
const {
  BOOKING_STATUS,
  UPCOMING_STATUSES,
  DAY_SCHEDULE_STATUSES,
  COLLECTIBLE_STATUSES,
} = require('../config/bookingStatus');

const UPCOMING_LIMIT = 10;

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
  const rows = await bookingModel.findUpcoming(UPCOMING_STATUSES, UPCOMING_LIMIT);

  return rows.map(({ id, eventDate, serviceName, clientName, startMinutes }) => ({
    id,
    eventDate,
    serviceName,
    clientName,
    startTime: formatMinutes(startMinutes),
  }));
}

function toScheduleEntry(row) {
  return {
    id: row.id,
    serviceName: row.serviceName,
    clientName: row.clientName,
    status: row.status,
    startMinutes: row.startMinutes,
    endMinutes: row.endMinutes,
    timeLabel: `${formatMinutes(row.startMinutes)} - ${formatMinutes(row.endMinutes)}`,
  };
}

async function getDaySchedule(date) {
  const [services, entries] = await Promise.all([
    serviceModel.findActive(),
    bookingModel.findScheduleEntries(date, DAY_SCHEDULE_STATUSES),
  ]);

  const columns = services.map(({ serviceId, serviceName }) => ({
    serviceId,
    serviceName,
    bookings: entries.filter((entry) => entry.serviceId === serviceId).map(toScheduleEntry),
  }));

  return { date, columns };
}

module.exports = { getSummary, getUpcomingBookings, getDaySchedule };
