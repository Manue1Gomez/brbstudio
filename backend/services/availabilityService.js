const AppError = require('./appError');
const { BOOKING_HOURS, SCHEDULE_CONFLICT_STATUSES } = require('../config/bookingRules');
const { BOOKING_STATUS } = require('../config/bookingStatus');
const blockedDateModel = require('../models/blockedDateModel');
const blockedTimeModel = require('../models/blockedTimeModel');
const bookingManagementModel = require('../models/bookingManagementModel');
const customerBookingModel = require('../models/customerBookingModel');
const { generateSlots } = require('./timeslotService');
const { getScheduleDetails } = require('./serviceScheduleRules');
const { isValidIsoDate, timeTextToMinutes, todayIso } = require('./timeHelper');

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function readServiceIds(value) {
  const rawIds = Array.isArray(value) ? value : String(value ?? '').split(',');
  const ids = rawIds.map((value) => Number(String(value).trim()));
  if (ids.length === 0 || ids.some((id) => !Number.isInteger(id) || id < 1)) {
    throw new AppError('Choose at least one valid service.', 400, {
      serviceIds: 'Choose at least one valid service.',
    });
  }
  return [...new Set(ids)];
}

function currentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function endTimeFor(startTime, durationHours) {
  const end = timeTextToMinutes(startTime) + durationHours * 60;
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

function makeSlots(date, durationHours, busyIntervals) {
  return generateSlots({
    open: BOOKING_HOURS.open,
    close: BOOKING_HOURS.close,
    durationHours,
    busyIntervals,
    nowMinutes: date === todayIso() ? currentMinutes() : null,
  });
}

async function getAvailability({
  date,
  serviceIds: rawServiceIds,
  executor,
  excludeBookingId = 0,
  customerId = null,
  services: existingServices = null,
}) {
  if (!isValidIsoDate(date)) {
    throw new AppError('Date must be a valid YYYY-MM-DD value.', 400, { date: 'Choose a valid date.' });
  }
  if (date < todayIso()) {
    throw new AppError('Choose today or a later date.', 400, { date: 'Choose today or a later date.' });
  }

  const serviceIds = readServiceIds(rawServiceIds);
  const services = existingServices ?? await customerBookingModel.findAvailableServices(executor, serviceIds);
  if (services.length !== serviceIds.length) {
    throw new AppError('One of the selected services is no longer available.', 409, {
      serviceIds: 'One of the selected services is no longer available.',
    });
  }

  const { durationHours, isWorkshop } = getScheduleDetails(services);
  if (await blockedDateModel.exists(date)) {
    return { durationHours, wholeDay: isWorkshop, available: false, slots: [] };
  }

  const bookingIntervals = await bookingManagementModel.findBusyIntervals(executor, {
    date,
    bookingId: excludeBookingId,
    statuses: SCHEDULE_CONFLICT_STATUSES,
  });
  const blockedIntervals = await blockedTimeModel.findOnDate(executor, date);
  const busyIntervals = [
    ...bookingIntervals
      .filter(({ status }) => status !== BOOKING_STATUS.PENDING)
      .map(({ start, end }) => ({ start, end })),
    ...blockedIntervals.map(({ startMinute, endMinute }) => ({ start: startMinute, end: endMinute })),
  ];
  const pendingReservations = bookingIntervals
    .filter(({ status, customerId: bookingCustomerId }) =>
      status === BOOKING_STATUS.PENDING &&
      (customerId === null || Number(bookingCustomerId) !== Number(customerId))
    )
    .map(({ start, end }) => ({
      startMinute: start,
      endMinute: end,
    }));

  if (isWorkshop) {
    const opens = timeTextToMinutes(BOOKING_HOURS.open);
    const closes = timeTextToMinutes(BOOKING_HOURS.close);
    const available = !busyIntervals.some((busy) => opens < busy.end && closes > busy.start);
    return { durationHours: null, wholeDay: true, available, slots: [], pendingReservations };
  }

  return {
    durationHours,
    wholeDay: false,
    available: true,
    slots: makeSlots(date, durationHours, busyIntervals),
    pendingReservations,
  };
}

async function resolveSchedule(connection, { date, serviceIds, startTime, bookingId = 0, services: existingServices = null }) {
  const services = existingServices ?? await customerBookingModel.findAvailableServices(connection, serviceIds);
  if (services.length !== serviceIds.length) {
    throw new AppError('One of the selected services is no longer available.', 409, {
      serviceIds: 'One of the selected services is no longer available.',
    });
  }

  const { durationHours, isWorkshop } = getScheduleDetails(services);
  await bookingManagementModel.lockScheduleDate(connection, date);

  if (await blockedDateModel.exists(date)) {
    const message = 'This date is not available, choose another schedule.';
    throw new AppError(message, 409, { eventDate: message });
  }

  const bookingIntervals = await bookingManagementModel.findBusyIntervals(connection, {
    date,
    bookingId,
    statuses: SCHEDULE_CONFLICT_STATUSES,
    forUpdate: true,
  });
  const blockedIntervals = await blockedTimeModel.findOnDate(connection, date, { forUpdate: true });
  const busyIntervals = [
    ...bookingIntervals
      .filter(({ status }) => status !== BOOKING_STATUS.PENDING)
      .map(({ start, end }) => ({ start, end })),
    ...blockedIntervals.map(({ startMinute, endMinute }) => ({ start: startMinute, end: endMinute })),
  ];

  if (isWorkshop) {
    if (startTime) {
      throw new AppError('Modeling Workshop is a full-day booking and does not have a start time.', 400, {
        startTime: 'Modeling Workshop is a full-day booking.',
      });
    }

    const opens = timeTextToMinutes(BOOKING_HOURS.open);
    const closes = timeTextToMinutes(BOOKING_HOURS.close);
    if (busyIntervals.some((busy) => opens < busy.end && closes > busy.start)) {
      throw new AppError('This date is not available for a Modeling Workshop.', 409, {
        eventDate: 'This date is not available for a Modeling Workshop.',
      });
    }
    return { startTime: BOOKING_HOURS.open, endTime: BOOKING_HOURS.close, durationHours: null };
  }

  if (!TIME_PATTERN.test(startTime)) {
    throw new AppError('Choose an available start time.', 400, { startTime: 'Choose an available start time.' });
  }

  const slot = makeSlots(date, durationHours, busyIntervals).find((candidate) => candidate.startTime === startTime);
  if (!slot) {
    const message = 'This date or time is not available, choose another schedule.';
    throw new AppError(message, 409, { schedule: message });
  }

  return { startTime: slot.startTime, endTime: endTimeFor(slot.startTime, durationHours), durationHours };
}

module.exports = { getAvailability, resolveSchedule, readServiceIds };
