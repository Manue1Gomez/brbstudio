const serviceModel = require('../models/serviceModel');
const imageStorage = require('./imageStorage');

const MYSQL_DUPLICATE_ENTRY = 'ER_DUP_ENTRY';
const MYSQL_ROW_IS_REFERENCED = 'ER_ROW_IS_REFERENCED_2';

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const PRICE_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

class ServiceError extends Error {
  constructor(message, status, fieldErrors = {}) {
    super(message);
    this.name = 'ServiceError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

const nameTakenError = () =>
  new ServiceError('A service with this name already exists.', 409, {
    name: 'A service with this name already exists.',
  });

const hasBookingsError = () =>
  new ServiceError(
    "This service already has bookings, so it can't be removed. Set it to Inactive instead.",
    409
  );

const notFoundError = () => new ServiceError('Service not found.', 404);

const asText = (value) => String(value ?? '');

// Form data arrives as text ("true", "on", "1"); anything unrecognised falls back to the default.
function parseBoolean(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;

  const text = String(value).toLowerCase();
  if (['true', '1', 'on'].includes(text)) return true;
  if (['false', '0', 'off'].includes(text)) return false;
  return fallback;
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw notFoundError();
  return id;
}

function normalizeFields(body = {}) {
  return {
    name: asText(body.name).trim(),
    description: asText(body.description).trim(),
    price: asText(body.price).replace(/[₱,\s]/g, ''),
    available: body.available,
    removeImage: parseBoolean(body.removeImage, false),
  };
}

function validateFields(fields, file) {
  const errors = {};

  if (!fields.name) errors.name = 'Service name is required.';
  else if (fields.name.length > MAX_NAME_LENGTH) {
    errors.name = `Service name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }

  if (!fields.description) errors.description = 'Description is required.';
  else if (fields.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`;
  }

  if (!fields.price) errors.price = 'Price is required.';
  else if (!PRICE_PATTERN.test(fields.price) || Number(fields.price) <= 0) {
    errors.price = 'Enter a valid price greater than 0, e.g. 1500 or 1500.50.';
  }

  if (file && !imageStorage.isSupportedImage(file.buffer)) {
    errors.image = 'Image must be a JPG, PNG or WEBP file.';
  }

  if (Object.keys(errors).length > 0) {
    throw new ServiceError('Please fix the highlighted fields.', 400, errors);
  }
}

function toPublicService(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    imageUrl: row.imagePath,
    available: Boolean(row.available),
  };
}

async function listServices() {
  return (await serviceModel.findAll()).map(toPublicService);
}

// What customers see: only services the studio currently offers.
async function listAvailableServices() {
  return (await serviceModel.findAvailable()).map(toPublicService);
}

async function createService(body, file) {
  const fields = normalizeFields(body);
  validateFields(fields, file);

  const imagePath = file ? await imageStorage.saveServiceImage(file.buffer) : null;

  try {
    const id = await serviceModel.create({
      ...fields,
      imagePath,
      available: parseBoolean(fields.available, true),
    });

    return toPublicService(await serviceModel.findById(id));
  } catch (error) {
    await imageStorage.deleteServiceImage(imagePath);

    if (error.code === MYSQL_DUPLICATE_ENTRY) throw nameTakenError();
    throw error;
  }
}

async function updateService(rawId, body, file) {
  const id = parseId(rawId);
  const existing = await serviceModel.findById(id);
  if (!existing) throw notFoundError();

  const fields = normalizeFields(body);
  validateFields(fields, file);

  let imagePath = existing.imagePath;
  if (file) imagePath = await imageStorage.saveServiceImage(file.buffer);
  else if (fields.removeImage) imagePath = null;

  try {
    await serviceModel.update(id, {
      ...fields,
      imagePath,
      available: parseBoolean(fields.available, Boolean(existing.available)),
    });
  } catch (error) {
    if (file) await imageStorage.deleteServiceImage(imagePath);

    if (error.code === MYSQL_DUPLICATE_ENTRY) throw nameTakenError();
    throw error;
  }

  // The old picture is only deleted after the database change has succeeded.
  if (imagePath !== existing.imagePath) await imageStorage.deleteServiceImage(existing.imagePath);

  return toPublicService(await serviceModel.findById(id));
}

async function setServiceAvailability(rawId, available) {
  const id = parseId(rawId);

  if (typeof available !== 'boolean') {
    throw new ServiceError('Availability must be true or false.', 400);
  }
  if (!(await serviceModel.findById(id))) throw notFoundError();

  await serviceModel.setAvailability(id, available);
  return toPublicService(await serviceModel.findById(id));
}

async function deleteService(rawId) {
  const id = parseId(rawId);
  const existing = await serviceModel.findById(id);
  if (!existing) throw notFoundError();

  if (await serviceModel.hasBookings(id)) throw hasBookingsError();

  try {
    await serviceModel.remove(id);
  } catch (error) {
    // Safety net when the booking table has a foreign key to service.
    if (error.code === MYSQL_ROW_IS_REFERENCED) throw hasBookingsError();
    throw error;
  }

  await imageStorage.deleteServiceImage(existing.imagePath);
}

module.exports = {
  ServiceError,
  listServices,
  listAvailableServices,
  createService,
  updateService,
  setServiceAvailability,
  deleteService,
};
