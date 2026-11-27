import { getJson, sendJson } from './admin-api.js';
import { formatDate } from './format.js';
import { enableDialogDismiss, showToast } from './ui.js';

const API_BASE = '/api/admin/reschedule';

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

enableDialogDismiss();
loadRequests();