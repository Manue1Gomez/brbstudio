import { postJson } from './api.js';
import {
  bindPasswordToggles,
  clearErrorOnInput,
  clearFormErrors,
  setSubmitting,
  showAlert,
  showFieldErrors,
  showNetworkError,
  showServerError,
} from './form-helpers.js';

const form = document.getElementById('loginForm');
const formError = document.getElementById('formError');
const formNotice = document.getElementById('formNotice');
const submitButton = form.querySelector('[type="submit"]');

// register.js sends people here with ?registered=1 after a successful sign-up.
if (new URLSearchParams(window.location.search).get('registered') === '1') {
  showAlert(formNotice, 'Account created! You can now log in.');
}

function findLocalErrors({ email, password }) {
  const errors = {};

  if (!email.trim()) errors.email = 'Email address is required.';
  if (!password) errors.password = 'Password is required.';

  return errors;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFormErrors(form, formError);
  formNotice.hidden = true;

  const values = Object.fromEntries(new FormData(form));
  if (showFieldErrors(form, findLocalErrors(values))) return;

  setSubmitting(submitButton, true);

  try {
    const response = await postJson('/api/auth/login', values);

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
bindPasswordToggles();
