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

const REQUIRED_MESSAGES = {
  firstName: 'First name is required.',
  lastName: 'Last name is required.',
  email: 'Email address is required.',
  contactNumber: 'Contact number is required.',
  password: 'Password is required.',
  confirmPassword: 'Please confirm your password.',
};

// Quick checks for instant feedback. The server repeats and enforces every rule.
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

clearErrorOnInput(form);
