/**
 * Form helper utilities shared by login (1.1.2) and register (1.1.1).
 * Not a standalone WBS item — supports input validation, error display,
 * and password toggle features required by both pages.
 */

const NETWORK_ERROR_MESSAGE = 'Unable to reach the server. Please check your connection and try again.';
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

function getFieldParts(input) {
  const field = input.closest('.form-field');
  return { field, message: field.querySelector('.form-field__error') };
}

<<<<<<< HEAD:frontend/customer/js/form-helpers.js

=======
// 1.1.1 / 1.1.2 — Mark a single field as invalid and show its error message
>>>>>>> 70d365e65dc1c3cf6b3f2ee8997eab8c1d5d60c3:frontend/admin/customer/js/form-helpers.js
export function setFieldError(input, text) {
  const { field, message } = getFieldParts(input);
  field.classList.add('form-field--invalid');
  input.setAttribute('aria-invalid', 'true');
  message.textContent = text;
  message.hidden = false;
}

<<<<<<< HEAD:frontend/customer/js/form-helpers.js

=======
// 1.1.1 / 1.1.2 — Clear error state from a single field
>>>>>>> 70d365e65dc1c3cf6b3f2ee8997eab8c1d5d60c3:frontend/admin/customer/js/form-helpers.js
export function clearFieldError(input) {
  const { field, message } = getFieldParts(input);
  field.classList.remove('form-field--invalid');
  input.removeAttribute('aria-invalid');
  message.hidden = true;
}

<<<<<<< HEAD:frontend/customer/js/form-helpers.js

=======
// 1.1.1 / 1.1.2 — Clear all field errors and the form-level alert
>>>>>>> 70d365e65dc1c3cf6b3f2ee8997eab8c1d5d60c3:frontend/admin/customer/js/form-helpers.js
export function clearFormErrors(form, alertElement) {
  [...form.elements].filter((el) => el.matches('.form-field__input')).forEach(clearFieldError);
  alertElement.hidden = true;
}

// 1.1.1 / 1.1.2 — Show all field errors from a validation errors object
export function showFieldErrors(form, errors) {
  const inputs = Object.keys(errors)
    .map((name) => form.elements[name])
    .filter(Boolean);

  inputs.forEach((input) => setFieldError(input, errors[input.name]));
  inputs[0]?.focus();

  return inputs.length > 0;
}

// 1.1.1 / 1.1.2 — Show a form-level alert message
export function showAlert(alertElement, text) {
  alertElement.textContent = text;
  alertElement.hidden = false;
}

// 1.1.1 / 1.1.2 — Disable the submit button while a request is in progress
export function setSubmitting(button, isSubmitting) {
  button.disabled = isSubmitting;
}

// 1.1.1 / 1.1.2 — Handle server validation errors returned from the API
export function showServerError(form, alertElement, { data }) {
  if (showFieldErrors(form, data.errors ?? {})) return;
  showAlert(alertElement, data.message || GENERIC_ERROR_MESSAGE);
}

// 1.1.1 / 1.1.2 — Show a network error when the server cannot be reached
export function showNetworkError(alertElement) {
  showAlert(alertElement, NETWORK_ERROR_MESSAGE);
}

// 1.1.1 / 1.1.2 — Clear a field's error as the customer types a correction
export function clearErrorOnInput(form) {
  form.addEventListener('input', ({ target }) => {
    if (target.matches('.form-field__input')) clearFieldError(target);
  });
}

// 1.1.2 — Toggle show/hide password visibility on password fields
export function bindPasswordToggles() {
  document.querySelectorAll('.password-input__toggle').forEach((toggle) => {
    const input = toggle.parentElement.querySelector('input');

    toggle.addEventListener('click', () => {
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      toggle.classList.toggle('is-visible', isHidden);
      toggle.setAttribute('aria-pressed', String(isHidden));
      toggle.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    });
  });
}
