/**
 * 1.1.1 Allow customers to register an account
 * Frontend: Build a registration form with the required fields, input validation,
 * and password confirmation, and redirect to login after a successful registration.
 */

import { postJson } from './api.js';
import {
  clearErrorOnInput,
  clearFormErrors,
  setSubmitting,
  showFieldErrors,
  showNetworkError,
  showServerError,
} from './form-helpers.js';

const form = document.getElementById('registerForm');
const formError = document.getElementById('formError');
const submitButton = form.querySelector('[type="submit"]');

// 1.1.1 Required field error messages shown when a field is left blank
const REQUIRED_MESSAGES = {
  firstName: 'First name is required.',
  lastName: 'Last name is required.',
  email: 'Email address is required.',
  contactNumber: 'Contact number is required.',
  password: 'Password is required.',
  confirmPassword: 'Please confirm your password.',
};

// 1.1.1 Client-side validation — checks blank fields and mismatched passwords
function findLocalErrors(values) {
  const errors = {};

  Object.entries(REQUIRED_MESSAGES).forEach(([name, message]) => {
    if (!values[name].trim()) errors[name] = message;
  });

  if (!errors.password && !errors.confirmPassword && values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match. Please re-enter your password.';
  }

  return errors;
}

// 1.1.1 Submit the registration form and redirect to login on success
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFormErrors(form, formError);

  const values = Object.fromEntries(new FormData(form));
  if (showFieldErrors(form, findLocalErrors(values))) return;

  setSubmitting(submitButton, true);

  try {
    const response = await postJson('/api/auth/register', values);

    if (response.ok) {
      window.location.assign(response.data.redirectTo);
      return;
    }

    showServerError(form, formError, response);
  } catch {
    showNetworkError(formError);
  }

  setSubmitting(submitButton, false);
});

// 1.1.1 Clear field errors as the customer types corrections
clearErrorOnInput(form);
