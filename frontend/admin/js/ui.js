const TOAST_DURATION_MS = 4000;

let toastTimer = null;

export function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');

  clearTimeout(toastTimer);

  toast.textContent = message;
  toast.classList.toggle('toast--error', type === 'error');
  toast.hidden = false;

  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, TOAST_DURATION_MS);
}

export function enableDialogDismiss() {
  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog || event.target.closest('[data-dialog-close]')) dialog.close();
    });
  });
}

export function setFieldError(form, fieldName, text) {
  const input = form.elements[fieldName];
  const field = input?.closest('.field');
  const message = field?.querySelector('.field__error');

  if (!message) return false;

  field.classList.add('field--invalid');
  message.textContent = text;
  message.hidden = false;
  return true;
}

export function clearFormErrors(form) {
  form.querySelectorAll('.field').forEach((field) => {
    field.classList.remove('field--invalid');
    const message = field.querySelector('.field__error');
    if (message) message.hidden = true;
  });

  const alert = form.querySelector('.alert');
  if (alert) alert.hidden = true;
}

export function showFormError(form, error) {
  const fieldErrors = error.fieldErrors ?? {};
  const shown = Object.entries(fieldErrors).map(([name, text]) => setFieldError(form, name, text));

  if (shown.includes(true) && Object.keys(fieldErrors).every((name) => form.elements[name])) return;

  const alert = form.querySelector('.alert');
  alert.textContent = error.message;
  alert.hidden = false;
}

export function clearFieldOnInput(form) {
  form.addEventListener('input', ({ target }) => {
    const field = target.closest('.field');
    if (!field) return;

    field.classList.remove('field--invalid');
    const message = field.querySelector('.field__error');
    if (message) message.hidden = true;
  });
}
