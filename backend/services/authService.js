const bcrypt = require('bcryptjs');
const customerModel = require('../models/customerModel');

const SALT_ROUNDS = 10;
const MYSQL_DUPLICATE_ENTRY = 'ER_DUP_ENTRY';

// Where each page lives, so the frontend never hard-codes redirects.
const LOGIN_PAGE = '/customer/html/login.html';
// TODO: point this at the My Profile page once it exists.
const CUSTOMER_HOME = '/customer/html/index.html';

const NAME_PATTERN = /^\p{L}[\p{L} .'-]*$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_PATTERN = /^09\d{9}$/;

// Compared against when the email is unknown, so "no such account" takes as long as "wrong password".
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', SALT_ROUNDS);

class AuthError extends Error {
  constructor(message, status, fieldErrors = {}) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

const asText = (value) => String(value ?? '');

function normalizeRegistration(body = {}) {
  return {
    firstName: asText(body.firstName).trim(),
    lastName: asText(body.lastName).trim(),
    email: asText(body.email).trim().toLowerCase(),
    contactNumber: asText(body.contactNumber).replace(/[\s-]/g, ''),
    password: asText(body.password),
    confirmPassword: asText(body.confirmPassword),
  };
}

function validateName(value, label) {
  if (!value) return `${label} is required.`;
  if (value.length > 50) return `${label} must be 50 characters or fewer.`;
  if (!NAME_PATTERN.test(value)) {
    return `${label} can only contain letters, spaces, apostrophes and hyphens.`;
  }
  return null;
}

function validatePassword(password) {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 72) return 'Password must be 72 characters or fewer.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must contain at least one letter and one number.';
  }
  return null;
}

function validateRegistration(data) {
  const errors = {
    firstName: validateName(data.firstName, 'First name'),
    lastName: validateName(data.lastName, 'Last name'),
    email: null,
    contactNumber: null,
    password: validatePassword(data.password),
    confirmPassword: null,
  };

  if (!data.email) errors.email = 'Email address is required.';
  else if (data.email.length > 100 || !EMAIL_PATTERN.test(data.email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!data.contactNumber) errors.contactNumber = 'Contact number is required.';
  else if (!CONTACT_PATTERN.test(data.contactNumber)) {
    errors.contactNumber = 'Enter a valid mobile number, e.g. 09123456789.';
  }

  if (!errors.password && data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match. Please re-enter your password.';
  }

  // Drop the fields that passed.
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message));
}

function toPublicProfile(customer) {
  return {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
  };
}

const emailTakenError = () =>
  new AuthError('This email is already registered.', 409, {
    email: 'This email is already registered.',
  });

async function registerCustomer(body) {
  const data = normalizeRegistration(body);

  const errors = validateRegistration(data);
  if (Object.keys(errors).length > 0) {
    throw new AuthError('Please fix the highlighted fields.', 400, errors);
  }

  if (await customerModel.findByEmail(data.email)) throw emailTakenError();

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

  try {
    const id = await customerModel.create({ ...data, passwordHash });
    return toPublicProfile({ ...data, id });
  } catch (error) {
    // Two sign-ups with the same email at the same moment: the UNIQUE index catches the second.
    if (error.code === MYSQL_DUPLICATE_ENTRY) throw emailTakenError();
    throw error;
  }
}

async function authenticateCustomer(body = {}) {
  const email = asText(body.email).trim().toLowerCase();
  const password = asText(body.password);

  const errors = {};
  if (!email) errors.email = 'Email address is required.';
  if (!password) errors.password = 'Password is required.';
  if (Object.keys(errors).length > 0) {
    throw new AuthError('Please enter your email address and password.', 400, errors);
  }

  const customer = await customerModel.findByEmail(email);
  const passwordMatches = await bcrypt.compare(password, customer ? customer.passwordHash : DUMMY_HASH);

  // One message for both cases so the form never reveals which emails have accounts.
  if (!customer || !passwordMatches) throw new AuthError('Invalid email or password.', 401);

  return toPublicProfile(customer);
}

module.exports = {
  AuthError,
  LOGIN_PAGE,
  CUSTOMER_HOME,
  registerCustomer,
  authenticateCustomer,
};
