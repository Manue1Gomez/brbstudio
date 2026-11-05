import { ApiError, deleteRequest, getJson, sendForm, sendJson } from './admin-api.js';

const API_BASE = '/api/admin/services';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const TOAST_DURATION_MS = 3500;

const elements = {
  grid: document.getElementById('serviceGrid'),
  status: document.getElementById('serviceStatus'),
  cardTemplate: document.getElementById('serviceCardTemplate'),
  addButton: document.getElementById('addServiceButton'),
  toast: document.getElementById('toast'),

  serviceDialog: document.getElementById('serviceDialog'),
  serviceForm: document.getElementById('serviceForm'),
  serviceDialogTitle: document.getElementById('serviceDialogTitle'),
  serviceFormError: document.getElementById('serviceFormError'),
  serviceSubmit: document.getElementById('serviceSubmitButton'),
  imageInput: document.getElementById('serviceImage'),
  imagePreview: document.getElementById('imagePreview'),
  imagePlaceholder: document.getElementById('imagePlaceholder'),
  chooseImageLabel: document.getElementById('chooseImageLabel'),
  removeImageButton: document.getElementById('removeImageButton'),
  availableInput: document.getElementById('serviceAvailable'),
  availableLabel: document.getElementById('serviceAvailableLabel'),

  deleteDialog: document.getElementById('deleteDialog'),
  deleteMessage: document.getElementById('deleteMessage'),
  deleteError: document.getElementById('deleteError'),
  confirmDelete: document.getElementById('confirmDeleteButton'),
};

let services = [];
let editingService = null; // null while adding a new service
let serviceToDelete = null;
let removeCurrentImage = false;
let previewObjectUrl = null;
let toastTimer = null;

/* ---- Helpers ---------------------------------------------------------- */

const findService = (id) => services.find((service) => service.id === Number(id));

// Whole amounts show as 1,500; amounts with centavos always show two digits (12,500.50).
function formatPrice(price) {
  const amount = Number(price);
  const decimals = Number.isInteger(amount) ? 0 : 2;

  return `\u20B1 ${amount.toLocaleString('en-PH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function showToast(message, type = 'success') {
  clearTimeout(toastTimer);

  elements.toast.textContent = message;
  elements.toast.classList.toggle('toast--error', type === 'error');
  elements.toast.hidden = false;

  toastTimer = setTimeout(() => {
    elements.toast.hidden = true;
  }, TOAST_DURATION_MS);
}

function setAvailabilityLabel(labelElement, isAvailable) {
  labelElement.textContent = isAvailable ? 'Active' : 'Inactive';
}

/* ---- Service cards ---------------------------------------------------- */

function createCard(service) {
  const card = elements.cardTemplate.content.firstElementChild.cloneNode(true);
  const image = card.querySelector('.service-card__image');
  const placeholder = card.querySelector('.service-card__placeholder');
  const description = card.querySelector('.service-card__description');
  const toggle = card.querySelector('[data-action="toggle"]');

  card.dataset.id = service.id;
  card.classList.toggle('service-card--inactive', !service.available);

  card.querySelector('.service-card__name').textContent = service.name;
  card.querySelector('.service-card__price').textContent = formatPrice(service.price);
  card.querySelector('.service-card__status').title = service.available ? 'Active' : 'Inactive';
  description.textContent = service.description;
  description.title = service.description;

  image.hidden = !service.imageUrl;
  placeholder.hidden = Boolean(service.imageUrl);
  if (service.imageUrl) {
    image.src = service.imageUrl;
    image.alt = service.name;
  }

  toggle.checked = service.available;
  setAvailabilityLabel(card.querySelector('.switch__label'), service.available);

  return card;
}

function renderServices() {
  elements.grid.replaceChildren(...services.map(createCard));

  elements.status.hidden = services.length > 0;
  if (services.length === 0) {
    elements.status.textContent = 'No services yet. Click "+ Add Service" to create the first one.';
  }
}

function replaceService(updated) {
  const index = services.findIndex((service) => service.id === updated.id);
  services[index] = updated;

  const oldCard = elements.grid.querySelector(`[data-id="${updated.id}"]`);
  oldCard.replaceWith(createCard(updated));
}

async function loadServices() {
  try {
    services = await getJson(API_BASE);
    renderServices();
  } catch (error) {
    console.error('Could not load services:', error);
    elements.status.textContent = 'Unable to load services. Please refresh the page.';
    elements.status.hidden = false;
  }
}

/* ---- Active toggle ---------------------------------------------------- */

async function handleToggle(toggle) {
  const card = toggle.closest('.service-card');
  const available = toggle.checked;

  toggle.disabled = true;

  try {
    const updated = await sendJson(`${API_BASE}/${card.dataset.id}/availability`, 'PATCH', { available });

    replaceService(updated);
    showToast(`${updated.name} is now ${updated.available ? 'active' : 'inactive'}.`);
  } catch (error) {
    toggle.checked = !available;
    toggle.disabled = false;
    showToast(error.message, 'error');
  }
}

/* ---- Add / edit dialog ------------------------------------------------ */

function setPreview(url) {
  elements.imagePreview.hidden = !url;
  elements.imagePlaceholder.hidden = Boolean(url);
  if (url) elements.imagePreview.src = url;
}

function releasePreviewUrl() {
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = null;
}

function clearFormErrors() {
  elements.serviceFormError.hidden = true;

  elements.serviceForm.querySelectorAll('.field').forEach((field) => {
    field.classList.remove('field--invalid');
    const message = field.querySelector('.field__error');
    if (message) message.hidden = true;
  });
}

function setFieldError(fieldName, text) {
  const input = elements.serviceForm.elements[fieldName];
  const field = input?.closest('.field');
  const message = field?.querySelector('.field__error');

  if (!message) return false;

  field.classList.add('field--invalid');
  message.textContent = text;
  message.hidden = false;
  return true;
}

function openServiceDialog(service = null) {
  editingService = service;
  removeCurrentImage = false;

  elements.serviceForm.reset();
  releasePreviewUrl();
  clearFormErrors();

  elements.serviceDialogTitle.textContent = service ? 'Edit Service' : 'Add Service';
  elements.serviceForm.elements.name.value = service?.name ?? '';
  elements.serviceForm.elements.description.value = service?.description ?? '';
  elements.serviceForm.elements.price.value = service?.price ?? '';
  elements.availableInput.checked = service ? service.available : true;
  setAvailabilityLabel(elements.availableLabel, elements.availableInput.checked);

  setPreview(service?.imageUrl ?? null);
  elements.removeImageButton.hidden = !service?.imageUrl;

  elements.serviceDialog.showModal();
  elements.serviceForm.elements.name.focus();
}

function handleImageChosen() {
  const [file] = elements.imageInput.files;
  if (!file) return;

  if (!ALLOWED_IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
    elements.imageInput.value = '';
    setFieldError('image', file.size > MAX_IMAGE_BYTES ? 'Image must be 5 MB or smaller.' : 'Image must be a JPG, PNG or WEBP file.');
    return;
  }

  elements.imageInput.closest('.field').classList.remove('field--invalid');
  elements.imageInput.closest('.field').querySelector('.field__error').hidden = true;

  releasePreviewUrl();
  previewObjectUrl = URL.createObjectURL(file);
  setPreview(previewObjectUrl);

  removeCurrentImage = false;
  elements.removeImageButton.hidden = false;
}

function handleRemoveImage() {
  elements.imageInput.value = '';
  releasePreviewUrl();
  setPreview(null);

  // Only an image that is already saved needs telling the server to delete it.
  removeCurrentImage = Boolean(editingService?.imageUrl);
  elements.removeImageButton.hidden = true;
}

function buildFormData() {
  const formData = new FormData(elements.serviceForm);
  const [file] = elements.imageInput.files;

  // An empty file input still sends a blank part; leave it out.
  if (!file) formData.delete('image');

  formData.set('available', elements.availableInput.checked);
  if (removeCurrentImage) formData.set('removeImage', 'true');

  return formData;
}

async function handleServiceSubmit(event) {
  event.preventDefault();
  clearFormErrors();
  elements.serviceSubmit.disabled = true;

  try {
    const formData = buildFormData();
    const saved = editingService
      ? await sendForm(`${API_BASE}/${editingService.id}`, 'PUT', formData)
      : await sendForm(API_BASE, 'POST', formData);

    if (editingService) {
      replaceService(saved);
    } else {
      services.push(saved);
      renderServices();
    }

    elements.serviceDialog.close();
    showToast(editingService ? `${saved.name} was updated.` : `${saved.name} was added.`);
  } catch (error) {
    showServiceFormError(error);
  } finally {
    elements.serviceSubmit.disabled = false;
  }
}

function showServiceFormError(error) {
  const fieldErrors = error instanceof ApiError ? error.fieldErrors : {};
  const shown = Object.entries(fieldErrors).map(([name, text]) => setFieldError(name, text));

  if (shown.includes(true)) return;

  elements.serviceFormError.textContent = error.message;
  elements.serviceFormError.hidden = false;
}

/* ---- Remove dialog ---------------------------------------------------- */

function openDeleteDialog(service) {
  serviceToDelete = service;

  elements.deleteMessage.textContent =
    `"${service.name}" will be permanently removed from the catalog. This can't be undone. ` +
    'If you only want to hide it from customers, set it to Inactive instead.';
  elements.deleteError.hidden = true;
  elements.confirmDelete.disabled = false;

  elements.deleteDialog.showModal();
}

async function handleConfirmDelete() {
  elements.confirmDelete.disabled = true;
  elements.deleteError.hidden = true;

  try {
    await deleteRequest(`${API_BASE}/${serviceToDelete.id}`);

    services = services.filter((service) => service.id !== serviceToDelete.id);
    renderServices();

    elements.deleteDialog.close();
    showToast(`${serviceToDelete.name} was removed.`);
  } catch (error) {
    elements.deleteError.textContent = error.message;
    elements.deleteError.hidden = false;
    elements.confirmDelete.disabled = false;
  }
}

/* ---- Wiring ----------------------------------------------------------- */

elements.addButton.addEventListener('click', () => openServiceDialog());

elements.grid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const service = findService(button.closest('.service-card').dataset.id);

  if (button.dataset.action === 'edit') openServiceDialog(service);
  if (button.dataset.action === 'remove') openDeleteDialog(service);
});

elements.grid.addEventListener('change', (event) => {
  if (event.target.matches('[data-action="toggle"]')) handleToggle(event.target);
});

elements.serviceForm.addEventListener('submit', handleServiceSubmit);
// Editing a field clears its error straight away.
elements.serviceForm.addEventListener('input', ({ target }) => {
  const field = target.closest('.field');
  if (!field) return;

  field.classList.remove('field--invalid');
  field.querySelector('.field__error').hidden = true;
});
elements.imageInput.addEventListener('change', handleImageChosen);
elements.removeImageButton.addEventListener('click', handleRemoveImage);
elements.availableInput.addEventListener('change', () =>
  setAvailabilityLabel(elements.availableLabel, elements.availableInput.checked)
);
elements.confirmDelete.addEventListener('click', handleConfirmDelete);

// Cancel buttons, and clicking the dark area outside a dialog, close it.
document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog || event.target.closest('[data-dialog-close]')) dialog.close();
  });
});

elements.serviceDialog.addEventListener('close', releasePreviewUrl);

loadServices();
