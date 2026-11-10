const bookingService = require('../services/bookingManagementService');
const sendError = require('./errorResponse');

async function list(req, res, next) {
  try {
    res.json(await bookingService.listBookings(req.query));
  } catch (error) {
    sendError(error, res, next);
  }
}

async function details(req, res, next) {
  try {
    res.json(await bookingService.getBookingDetails(req.params.id));
  } catch (error) {
    sendError(error, res, next);
  }
}

async function update(req, res, next) {
  try {
    res.json(await bookingService.updateBooking(req.params.id, req.body));
  } catch (error) {
    sendError(error, res, next);
  }
}

async function remove(req, res, next) {
  try {
    await bookingService.deleteBooking(req.params.id);
    res.status(204).end();
  } catch (error) {
    sendError(error, res, next);
  }
}

module.exports = { list, details, update, remove };
