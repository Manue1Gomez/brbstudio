export function confirmLogout() {
  const dialog = document.createElement('dialog');
  dialog.className = 'dialog logout-dialog';
  dialog.setAttribute('aria-labelledby', 'logoutConfirmationTitle');
  dialog.setAttribute('aria-describedby', 'logoutConfirmationMessage');

  const form = document.createElement('form');
  form.className = 'dialog__form';
  form.method = 'dialog';

  const title = document.createElement('h2');
  title.className = 'dialog__title';
  title.id = 'logoutConfirmationTitle';
  title.textContent = 'Log out?';

  const message = document.createElement('p');
  message.className = 'dialog__text';
  message.id = 'logoutConfirmationMessage';
  message.textContent = 'Are you sure you want to log out?';

  const actions = document.createElement('div');
  actions.className = 'dialog__actions';

  const cancelButton = document.createElement('button');
  cancelButton.className = 'btn';
  cancelButton.type = 'submit';
  cancelButton.value = 'cancel';
  cancelButton.textContent = 'Cancel';

  const confirmButton = document.createElement('button');
  confirmButton.className = 'btn btn--danger-solid';
  confirmButton.type = 'submit';
  confirmButton.value = 'confirm';
  confirmButton.textContent = 'Log out';

  actions.append(cancelButton, confirmButton);
  form.append(title, message, actions);
  dialog.append(form);
  document.body.append(dialog);

  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      const confirmed = dialog.returnValue === 'confirm';
      dialog.remove();
      resolve(confirmed);
    }, { once: true });

    dialog.showModal();
    cancelButton.focus();
  });
}
