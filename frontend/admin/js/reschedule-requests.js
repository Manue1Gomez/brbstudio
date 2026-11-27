import { getJson, sendJson } from './admin-api.js';
import { formatDate } from './format.js';
import { enableDialogDismiss, showToast } from './ui.js';

const API_BASE = '/api/admin/reschedule';

const DECISIONS = {
  approve: {
    title: 'Approve this request?',
    confirmLabel: 'Approve',
    confirmClass: 'btn--primary',
    successMessage: 'Request approved. The booking now uses the new schedule.',
  },
  reject: {
    title: 'Reject this request?',
    confirmLabel: 'Reject',
    confirmClass: 'btn--danger-solid',
    successMessage: 'Request rejected. The booking keeps its original schedule.',
  },
};

const elements = {
  status: document.getElementById('pageStatus'),
  list: document.getElementById('requestList'),
  emptyStatus: document.getElementById('emptyStatus'),
  cardTemplate: document.getElementById('requestCardTemplate'),

  confirmDialog: document.getElementById('confirmDialog'),
  confirmTitle: document.getElementById('confirmDialogTitle'),
  confirmMessage: document.getElementById('confirmMessage'),
  confirmError: document.getElementById('confirmError'),
  confirmButton: document.getElementById('confirmButton'),
};

let requests = [];
let pendingDecision = null;

const findRequest = (id) => requests.find((request) => request.id === Number(id));

function createCard(request) {
  const card = elements.cardTemplate.content.firstElementChild.cloneNode(true);
  const setField = (name, text) => {
    card.querySelector(`[data-field="${name}"]`).textContent = text;
  };

  card.dataset.id = request.id;

  card.querySelector('.request-card__reference').textContent = `Booking ID: #${request.reference}`;
  card.querySelector('.request-card__requested').textContent = `Requested on ${formatDate(request.requestedAt.slice(0, 10))}`;
  card.querySelector('.request-card__summary').textContent = `${request.customerName} - ${request.services.join(', ')}`;

  setField('oldDate', formatDate(request.oldDate));
  setField('oldTime', request.oldTimeLabel);
  setField('newDate', formatDate(request.newDate));
  setField('newTime', request.newTimeLabel);

  return card;
}

function renderRequests() {
  const isEmpty = requests.length === 0;

  elements.list.replaceChildren(...requests.map(createCard));
  elements.list.hidden = isEmpty;
  elements.emptyStatus.hidden = !isEmpty;
}

async function loadRequests() {
  try {
    ({ requests } = await getJson(API_BASE));

    elements.status.hidden = true;
    renderRequests();
  } catch (error) {
    elements.status.textContent = error.message;
  }
}

function openConfirmDialog(request, action) {
  const decision = DECISIONS[action];

  pendingDecision = { request, action };

  elements.confirmTitle.textContent = decision.title;
  elements.confirmMessage.textContent =
    `${request.customerName}'s booking #${request.reference} ` +
    (action === 'approve'
      ? `will move to ${formatDate(request.newDate)}, ${request.newTimeLabel}.`
      : `will stay on ${formatDate(request.oldDate)}, ${request.oldTimeLabel}.`);

  elements.confirmError.hidden = true;
  elements.confirmButton.className = `btn ${decision.confirmClass}`;
  elements.confirmButton.textContent = decision.confirmLabel;
  elements.confirmButton.disabled = false;

  elements.confirmDialog.showModal();
}

async function handleConfirm() {
  const { request, action } = pendingDecision;

  elements.confirmButton.disabled = true;
  elements.confirmError.hidden = true;

  try {
    await sendJson(`${API_BASE}/${request.id}/${action}`, 'POST', {});

    requests = requests.filter((item) => item.id !== request.id);
    renderRequests();

    elements.confirmDialog.close();
    showToast(DECISIONS[action].successMessage);
  } catch (error) {
    elements.confirmError.textContent = error.message;
    elements.confirmError.hidden = false;
    elements.confirmButton.disabled = false;
  }
}

elements.list.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  openConfirmDialog(findRequest(button.closest('.request-card').dataset.id), button.dataset.action);
});

elements.confirmButton.addEventListener('click', handleConfirm);

enableDialogDismiss();
loadRequests();
