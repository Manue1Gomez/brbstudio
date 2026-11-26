 const voucherModel = require('../models/voucherModel');
const AppError = require('./appError');
const { withTransaction } = require('../config/db');
const { isValidIsoDate } = require('./timeHelper');
const { canSetUsageLimit, getRemainingUses, getSafeCount } = require('./voucherUsageRules');

const MYSQL_DUPLICATE_ENTRY = 'ER_DUP_ENTRY';

const DISCOUNT_TYPES = ['Percentage', 'Fixed'];
const MAX_NAME_LENGTH = 100;
const CODE_PATTERN = /^[A-Z0-9]{3,30}$/;
const VALUE_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;
const LIMIT_PATTERN = /^\d{1,4}$/;
const REQUIRED_MESSAGE = 'This field is required.';
 
 const codeTakenError = () =>
    new AppError('A voucher with this code already exists.', 409, {
      code: 'A voucher with this code already exists.',
    });

async function createVoucher(body) {
  const fields = normalizeFields(body);
  validateFields(fields);

  try {
    const id = await voucherModel.create(fields);
    return toPublicVoucher(await voucherModel.findById(id));
  } catch (error) {
    if (error.code === MYSQL_DUPLICATE_ENTRY) throw codeTakenError();
    throw error;
  }
}

function normalizeFields(body = {}) {
  return {
    code: asText(body.code).trim().toUpperCase(),
    name: asText(body.name).trim(),
    discountType: asText(body.discountType).trim(),
    discountValue: asText(body.discountValue).replace(/[₱%,\s]/g, ''),
    startDate: asText(body.startDate).trim(),
    endDate: asText(body.endDate).trim(),
    usageLimit: asText(body.usageLimit).trim(),
  };
} 
function validateFields(fields) {
  const errors = {};

  Object.entries(fields).forEach(([key, value]) => {
    if (!value) errors[key] = REQUIRED_MESSAGE;
  });

  if (!errors.code && !CODE_PATTERN.test(fields.code)) {
    errors.code = 'Use 3 to 30 letters or numbers, with no spaces.';
  }

  if (!errors.name && fields.name.length > MAX_NAME_LENGTH) {
    errors.name = `Voucher name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }

  if (!errors.discountType && !DISCOUNT_TYPES.includes(fields.discountType)) {
    errors.discountType = 'Choose a discount type.';
  }

  if (!errors.discountValue) {
    if (!VALUE_PATTERN.test(fields.discountValue) || Number(fields.discountValue) <= 0) {
      errors.discountValue = 'Enter a discount greater than 0, e.g. 20 or 150.50.';
    } else if (fields.discountType === 'Percentage' && Number(fields.discountValue) > 100) {
      errors.discountValue = "A percentage discount can't be more than 100.";
    }
  }

  if (!errors.startDate && !isValidIsoDate(fields.startDate)) errors.startDate = 'Enter a valid date.';
  if (!errors.endDate && !isValidIsoDate(fields.endDate)) errors.endDate = 'Enter a valid date.';

  if (!errors.startDate && !errors.endDate && fields.endDate < fields.startDate) {
    errors.endDate = "End date can't be before the start date.";
  }

  if (!errors.usageLimit && (!LIMIT_PATTERN.test(fields.usageLimit) || Number(fields.usageLimit) < 1)) {
    errors.usageLimit = 'Enter a whole number from 1 to 9999.';
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError('Please fix the highlighted fields.', 400, errors);
  }
}



async function createVoucher(body) {
  const fields = normalizeFields(body);
  validateFields(fields);

  try {
    const id = await voucherModel.create(fields);
    return toPublicVoucher(await voucherModel.findById(id));
  } catch (error) {
    if (error.code === MYSQL_DUPLICATE_ENTRY) throw codeTakenError();
    throw error;
  }
}

async function deleteVoucher(rawId) {
  const id = parseId(rawId);
  if (!(await voucherModel.findById(id))) throw notFoundError();

  await voucherModel.remove(id);
}

module.exports = { createVoucher };
