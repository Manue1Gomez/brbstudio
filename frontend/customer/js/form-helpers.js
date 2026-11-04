// Small DOM helpers shared by the register and login forms.

const NETWORK_ERROR_MESSAGE = 'Unable to reach the server. Please check your connection and try again.';
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

function getFieldParts(input) {
  const field = input.closest('.form-field');
  return { field, message: field.querySelector('.form-field__error') };
}

export function setFieldError(input, text) {
  const { field, message } = getFieldParts(input);

  field.classList.add('form-field--invalid');
  input.setAttribute('aria-invalid', 'true');
  message.textContent = text;
  message.hidden = false;
}

export function clearFieldError(input) {
  const { field, message } = getFieldParts(input);

  field.classList.remove('form-field--invalid');
  input.removeAttribute('aria-invalid');
  message.hidden = true;
}

export function clearFormErrors(form, alertElement) {
  [...form.elements].filter((el) => el.matches('.form-field__input')).forEach(clearFieldError);
  alertElement.hidden = true;
}

// errors: { fieldName: 'message' }. Focuses the first invalid field.
export function showFieldErrors(form, errors) {
  const inputs = Object.keys(errors)
    .map((name) => form.elements[name])
    .filter(Boolean);

  inputs.forEach((input) => setFieldError(input, errors[input.name]));
  inputs[0]?.focus();

  return inputs.length > 0;
}

export function showAlert(alertElement, text) {
  alertElement.textContent = text;
  alertElement.hidden = false;
}

export function setSubmitting(button, isSubmitting) {
  button.disabled = isSubmitting;
}

// Shows the server's field errors, or its message, or a fallback.
export function showServerError(form, alertElement, { data }) {
  if (showFieldErrors(form, data.errors ?? {})) return;
  showAlert(alertElement, data.message || GENERIC_ERROR_MESSAGE);
}

export function showNetworkError(alertElement) {
  showAlert(alertElement, NETWORK_ERROR_MESSAGE);
}

// Typing in a field clears that field's error.
export function clearErrorOnInput(form) {
  form.addEventListener('input', ({ target }) => {
    if (target.matches('.form-field__input')) clearFieldError(target);
  });
}

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
