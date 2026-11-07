const serviceService = require('../services/serviceManagementService');
const sendError = require('./errorResponse');

async function listAvailable(req, res, next) {
  try {
    res.json(await serviceService.listAvailableServices());
  } catch (error) {
    next(error);
  }
}

async function listAll(req, res, next) {
  try {
    res.json(await serviceService.listServices());
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    res.status(201).json(await serviceService.createService(req.body, req.file));
  } catch (error) {
    sendError(error, res, next);
  }
}

async function update(req, res, next) {
  try {
    res.json(await serviceService.updateService(req.params.id, req.body, req.file));
  } catch (error) {
    sendError(error, res, next);
  }
}

async function setAvailability(req, res, next) {
  try {
    res.json(await serviceService.setServiceAvailability(req.params.id, req.body?.available));
  } catch (error) {
    sendError(error, res, next);
  }
}

async function remove(req, res, next) {
  try {
    await serviceService.deleteService(req.params.id);
    res.status(204).end();
  } catch (error) {
    sendError(error, res, next);
  }
}

module.exports = { listAvailable, listAll, create, update, setAvailability, remove };
