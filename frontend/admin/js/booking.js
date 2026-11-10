import { getJson, sendJson, deleteRequest } from './admin-api.js';
import { formatDate, formatDateTime, formatLongDate, formatPeso, statusSlug } from './format.js';
import { clearFieldOnInput, clearFormErrors, enableDialogDismiss, showFormError, showToast } from './ui.js';

const API_BASE = '/api/admin/bookings';
const SERVICES_API = '/api/admin/services';
const SEARCH_DELAY_MS = 300;
const CONTRACT_MESSAGE = "Contract generation isn't available yet. It will be added once the contract template is ready.";

const GROUP_LABELS = {
  ongoing: 'Upcoming and ongoing',
  completed: 'Completed',
  rejected: 'Rejected',
};

const STATUS_HINTS = {
  Pending: 'Waiting for your review.',
  'To Pay': 'Accepted. The customer can now pay the 50% downpayment.',
  Confirmed: 'The downpayment was verified and the schedule is reserved.',
  Completed: 'The event is done. Any unpaid balance stays on the Payments page.',
  Rejected: 'The customer will see this booking as rejected.',
};

const elements = {
  searchInput: document.getElementById('searchInput'),
  serviceFilter: document.getElementById('serviceFilter'),
  dateFilter: document.getElementById('dateFilter'),
  clearFilters: document.getElementById('clearFilters'),
  statusTabs: document.getElementById('statusTabs'),
  bookingWrap: document.getElementById('bookingWrap'),
  bookingBody: document.getElementById('bookingBody'),
  bookingStatus: document.getElementById('bookingStatus'),
  rowTemplate: document.getElementById('bookingRowTemplate'),
  groupTemplate: document.getElementById('groupRowTemplate'),
  pagination: document.getElementById('pagination'),
  pageSummary: document.getElementById('pageSummary'),
  previousPage: document.getElementById('previousPage'),
  nextPage: document.getElementById('nextPage'),

  viewDialog: document.getElementById('viewDialog'),
  viewReference: document.getElementById('viewReference'),
  viewTitle: document.getElementById('viewTitle'),
  viewStatus: document.getElementById('viewStatus'),
  viewCustomer: document.getElementById('viewCustomer'),
  viewSchedule: document.getElementById('viewSchedule'),
  viewServices: document.getElementById('viewServices'),
  viewTotals: document.getElementById('viewTotals'),
  viewPayments: document.getElementById('viewPayments'),
  viewNoPayments: document.getElementById('viewNoPayments'),
  viewContract: document.getElementById('viewContractButton'),
  viewUpdate: document.getElementById('viewUpdateButton'),

  updateDialog: document.getElementById('updateDialog'),
  updateForm: document.getElementById('updateForm'),
  updateReference: document.getElementById('updateReference'),
  updateStatus: document.getElementById('updateStatus'),
  updateStatusHint: document.getElementById('updateStatusHint'),
  updateScheduleHint: document.getElementById('updateScheduleHint'),
  saveUpdate: document.getElementById('saveUpdateButton'),

  confirmDialog: document.getElementById('confirmDialog'),
  confirmTitle: document.getElementById('confirmTitle'),
  confirmMessage: document.getElementById('confirmMessage'),
  confirmError: document.getElementById('confirmError'),
  confirmButton: document.getElementById('confirmButton'),
};

const state = {
  search: '',
  serviceId: '',
  date: '',
  status: 'all',
  page: 1,
  pageSize: 10,
  data: null,
};

let latestRequest = 0;
let searchTimer = null;
let pendingConfirm = null;
let editing = null;
let viewing = null;

const hasActiveFilters = () => Boolean(state.search || state.serviceId || state.date || state.status !== 'all');

function buildQuery() {
  const params = new URLSearchParams({ page: state.page, pageSize: state.pageSize });

  if (state.status !== 'all') params.set('status', state.status);
  if (state.search) params.set('search', state.search);
  if (state.serviceId) params.set('serviceId', state.serviceId);
  if (state.date) params.set('date', state.date);

  return params.toString();
}

function createGroupRow(group, counts) {
  const row = elements.groupTemplate.content.firstElementChild.cloneNode(true);
  const groupTotals = {
    ongoing: counts.Pending + counts['To Pay'] + counts.Confirmed,
    completed: counts.Completed,
    rejected: counts.Rejected,
  };
  const total = state.status === 'all' ? groupTotals[group] : counts[state.status];

  row.querySelector('.group-row__label').textContent = GROUP_LABELS[group];
  row.querySelector('.group-row__count').textContent = total;

  return row;
}

function createBookingRow(booking) {
  const row = elements.rowTemplate.content.firstElementChild.cloneNode(true);
  const pill = row.querySelector('.pill');
  const percent = booking.totalAmount > 0 ? Math.round((booking.amountPaid / booking.totalAmount) * 100) : 0;
  const reviewLink = row.querySelector('.bookings-table__review-link');
  const label = `#${booking.reference}`;

  row.dataset.id = booking.id;
  row.classList.toggle('data-row--pending', booking.status === 'Pending');

  row.querySelector('.bookings-table__name').textContent = booking.customerName;
  row.querySelector('.bookings-table__reference').textContent = label;
  row.querySelector('.bookings-table__services').replaceChildren(
    ...booking.services.map((service) => {
      const line = document.createElement('span');
      line.className = 'bookings-table__service';
      line.textContent = service;
      return line;
    })
  );
  row.querySelector('.bookings-table__date').textContent = formatDate(booking.eventDate);
  row.querySelector('.bookings-table__time').textContent = booking.timeLabel;
  row.querySelector('.bookings-table__amounts').textContent =
    `${formatPeso(booking.amountPaid)} / ${formatPeso(booking.totalAmount)}`;
  row.querySelector('.progress__bar').style.setProperty('--percent', `${percent}%`);
  row.querySelector('.bookings-table__payment-label').textContent = booking.paymentLabel;
  reviewLink.hidden = booking.pendingPayments === 0;

  pill.textContent = booking.status;
  pill.classList.add(`pill--${statusSlug(booking.status)}`);
  row.querySelector('.quick-actions').hidden = booking.status !== 'Pending';

  row.querySelector('[data-action="view"]').setAttribute('aria-label', `View booking ${label}`);
  row.querySelector('[data-action="contract"]').setAttribute('aria-label', `Contract for booking ${label}`);
  row.querySelector('[data-action="update"]').setAttribute('aria-label', `Update booking ${label}`);
  row.querySelector('[data-action="delete"]').setAttribute('aria-label', `Delete booking ${label}`);

  return row;
}

function renderTabs(counts) {
  elements.statusTabs.querySelectorAll('.status-tab').forEach((tab) => {
    const status = tab.dataset.status;
    const isActive = status === state.status;

    tab.classList.toggle('status-tab--active', isActive);
    tab.classList.toggle('status-tab--attention', status === 'Pending' && counts.Pending > 0);
    tab.setAttribute('aria-pressed', String(isActive));
    tab.querySelector('.status-tab__count').textContent = counts[status === 'all' ? 'all' : status];
  });
}

function renderTable() {
  const { bookings, counts, total, page, pageSize } = state.data;
  const rows = [];
  let lastGroup = null;

  bookings.forEach((booking) => {
    if (booking.group !== lastGroup) {
      rows.push(createGroupRow(booking.group, counts));
      lastGroup = booking.group;
    }
    rows.push(createBookingRow(booking));
  });

  elements.bookingBody.replaceChildren(...rows);
  elements.bookingWrap.hidden = bookings.length === 0;
  elements.bookingStatus.hidden = bookings.length > 0;
  elements.pagination.hidden = bookings.length === 0;

  if (bookings.length === 0) {
    elements.bookingStatus.textContent = hasActiveFilters()
      ? 'No bookings match your search or filters.'
      : 'There are no bookings yet.';
  }

  const first = (page - 1) * pageSize + 1;
  const last = first + bookings.length - 1;

  elements.pageSummary.textContent = `Showing ${first}\u2013${last} of ${total}`;
  elements.previousPage.disabled = page <= 1;
  elements.nextPage.disabled = last >= total;
  elements.clearFilters.hidden = !hasActiveFilters();
  renderTabs(counts);
}

async function loadBookings() {
  const requestId = ++latestRequest;

  try {
    const data = await getJson(`${API_BASE}?${buildQuery()}`);
    if (requestId !== latestRequest) return;

    if (data.bookings.length === 0 && data.total > 0 && state.page > 1) {
      state.page -= 1;
      loadBookings();
      return;
    }

    state.data = data;
    renderTable();
  } catch (error) {
    if (requestId !== latestRequest) return;

    elements.bookingWrap.hidden = true;
    elements.pagination.hidden = true;
    elements.bookingStatus.textContent = 'Unable to load bookings. Please refresh the page.';
    elements.bookingStatus.hidden = false;
    console.error(error);
  }
}

function resetToFirstPage() {
  state.page = 1;
  loadBookings();
}

async function loadServiceOptions() {
  try {
    const services = await getJson(SERVICES_API);

    services.forEach((service) => {
      const option = document.createElement('option');
      option.value = service.id;
      option.textContent = service.name;
      elements.serviceFilter.append(option);
    });
  } catch (error) {
    console.error(error);
  }
}

function fillDetailList(list, entries) {
  list.replaceChildren();

  entries.forEach(([label, value]) => {
    const term = document.createElement('dt');
    const description = document.createElement('dd');

    term.textContent = label;
    description.textContent = value || '\u2014';
    list.append(term, description);
  });
}

function addTableRow(container, label, value, className = '') {
  const row = document.createElement('tr');
  const name = document.createElement('td');
  const amount = document.createElement('td');

  name.textContent = label;
  amount.textContent = value;
  row.className = className;
  row.append(name, amount);
  container.append(row);
}

function createPaymentItem(payment) {
  const item = document.createElement('li');
  const main = document.createElement('div');
  const title = document.createElement('strong');
  const meta = document.createElement('span');
  const pill = document.createElement('span');
  const details = [payment.method];

  if (payment.referenceNumber) details.push(`Ref ${payment.referenceNumber}`);
  details.push(payment.recordedBy === 'Admin' ? 'Recorded by admin' : 'Submitted by customer');
  details.push(formatDateTime(payment.submittedAt));

  item.className = 'payment-history__item';
  title.textContent = `${payment.type}: ${formatPeso(payment.amount)}`;
  meta.className = 'payment-history__meta';
  meta.textContent = details.join(' \u00B7 ');
  main.append(title, meta);

  pill.className = `pill pill--${statusSlug(payment.status)}`;
  pill.textContent = payment.status;
  item.append(main, pill);

  if (payment.proofUrl) {
    const link = document.createElement('a');
    link.className = 'payment-history__link';
    link.href = payment.proofUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'View proof';
    item.append(link);
  }

  if (payment.rejectReason) {
    const reason = document.createElement('p');
    reason.className = 'payment-history__reason';
    reason.textContent = `Rejected: ${payment.rejectReason}`;
    item.append(reason);
  }

  if (payment.note) {
    const note = document.createElement('p');
    note.className = 'payment-history__meta';
    note.textContent = `Note: ${payment.note}`;
    item.append(note);
  }

  return item;
}

function renderBookingDetails(details) {
  elements.viewReference.textContent = `Booking #${details.reference}`;
  elements.viewTitle.textContent = details.customer.name;
  elements.viewStatus.textContent = details.status;
  elements.viewStatus.className = `pill pill--${statusSlug(details.status)}`;

  fillDetailList(elements.viewCustomer, [
    ['Email', details.customer.email],
    ['Contact', details.customer.contactNumber],
    ['Booked on', formatDateTime(details.createdAt)],
  ]);

  fillDetailList(elements.viewSchedule, [
    ['Date', formatLongDate(details.eventDate)],
    ['Time', details.timeLabel],
    ['Address', details.eventAddress],
  ]);

  elements.viewServices.replaceChildren();
  elements.viewTotals.replaceChildren();
  details.services.forEach((service) => addTableRow(elements.viewServices, service.name, formatPeso(service.price)));

  addTableRow(elements.viewTotals, 'Subtotal', formatPeso(details.subtotal));
  if (details.discountAmount > 0) {
    const label = details.voucherCode ? `Discount (${details.voucherCode})` : 'Discount';
    addTableRow(elements.viewTotals, label, `-${formatPeso(details.discountAmount)}`);
  }
  addTableRow(elements.viewTotals, 'Total', formatPeso(details.totalAmount), 'mini-table__total');
  addTableRow(elements.viewTotals, 'Paid so far', formatPeso(details.amountPaid));
  addTableRow(elements.viewTotals, `Balance \u00B7 ${details.paymentLabel}`, formatPeso(details.balance));

  elements.viewPayments.replaceChildren(...details.payments.map(createPaymentItem));
  elements.viewNoPayments.hidden = details.payments.length > 0;
}

async function openView(id) {
  try {
    viewing = await getJson(`${API_BASE}/${id}`);
    renderBookingDetails(viewing);
    elements.viewDialog.showModal();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function describeStatusHint(status, details) {
  if (details.allowedStatuses.length === 0 && details.status === 'Confirmed') {
    return 'It can be marked Completed once the event date has passed.';
  }

  return STATUS_HINTS[status];
}

function fillUpdateForm(details) {
  const form = elements.updateForm.elements;
  const options = [details.status, ...details.allowedStatuses];

  elements.updateStatus.replaceChildren(
    ...options.map((status) => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status === details.status ? `${status} (current)` : status;
      return option;
    })
  );
  elements.updateStatus.disabled = details.allowedStatuses.length === 0;
  elements.updateStatusHint.textContent = describeStatusHint(details.status, details);

  form.eventDate.value = details.eventDate;
  form.startTime.value = details.startTime;
  form.endTime.value = details.endTime;
  form.eventAddress.value = details.eventAddress ?? '';

  [form.eventDate, form.startTime, form.endTime].forEach((input) => {
    input.disabled = !details.canReschedule;
  });
  elements.updateScheduleHint.textContent = details.canReschedule
    ? 'Changing the date or time checks blocked dates and other bookings of the same service.'
    : "Completed and rejected bookings can't be rescheduled.";
}

async function openUpdate(id) {
  try {
    editing = await getJson(`${API_BASE}/${id}`);
  } catch (error) {
    showToast(error.message, 'error');
    return;
  }

  clearFormErrors(elements.updateForm);
  elements.updateReference.textContent = `Booking #${editing.reference} \u00B7 ${editing.customer.name}`;
  fillUpdateForm(editing);
  elements.saveUpdate.disabled = false;
  elements.updateDialog.showModal();
}

async function submitUpdate(event) {
  event.preventDefault();
  clearFormErrors(elements.updateForm);
  elements.saveUpdate.disabled = true;

  const form = elements.updateForm.elements;
  const payload = { status: form.status.value, eventAddress: form.eventAddress.value };

  if (editing.canReschedule) {
    payload.eventDate = form.eventDate.value;
    payload.startTime = form.startTime.value;
    payload.endTime = form.endTime.value;
  }

  try {
    await sendJson(`${API_BASE}/${editing.id}`, 'PUT', payload);

    elements.updateDialog.close();
    showToast(`Booking #${editing.reference} was updated.`);
    await loadBookings();
  } catch (error) {
    showFormError(elements.updateForm, error);
  } finally {
    elements.saveUpdate.disabled = false;
  }
}

function openConfirm({ title, message, confirmLabel, variant, action, successMessage }) {
  pendingConfirm = { action, successMessage };

  elements.confirmTitle.textContent = title;
  elements.confirmMessage.textContent = message;
  elements.confirmError.hidden = true;
  elements.confirmButton.textContent = confirmLabel;
  elements.confirmButton.className = `btn btn--${variant}`;
  elements.confirmButton.disabled = false;

  elements.confirmDialog.showModal();
}

async function runConfirmed() {
  elements.confirmButton.disabled = true;
  elements.confirmError.hidden = true;

  try {
    await pendingConfirm.action();

    elements.confirmDialog.close();
    showToast(pendingConfirm.successMessage);
    await loadBookings();
  } catch (error) {
    elements.confirmError.textContent = error.message;
    elements.confirmError.hidden = false;
    elements.confirmButton.disabled = false;
  }
}

function requiredDownpayment(total) {
  return Math.ceil((total * 100) / 2) / 100;
}

function confirmAccept(booking) {
  openConfirm({
    title: 'Accept this booking?',
    message:
      `Booking #${booking.reference} for ${booking.customerName} on ${formatDate(booking.eventDate)} (${booking.timeLabel}) ` +
      `will be accepted. The customer can then pay the 50% downpayment of ${formatPeso(requiredDownpayment(booking.totalAmount))}.`,
    confirmLabel: 'Accept booking',
    variant: 'success',
    action: () => sendJson(`${API_BASE}/${booking.id}`, 'PUT', { status: 'To Pay' }),
    successMessage: `Booking #${booking.reference} was accepted.`,
  });
}

function confirmDecline(booking) {
  openConfirm({
    title: 'Decline this booking?',
    message: `Booking #${booking.reference} from ${booking.customerName} on ${formatDate(booking.eventDate)} will be marked as Rejected. You can still move it back to Pending later.`,
    confirmLabel: 'Decline booking',
    variant: 'danger-solid',
    action: () => sendJson(`${API_BASE}/${booking.id}`, 'PUT', { status: 'Rejected' }),
    successMessage: `Booking #${booking.reference} was declined.`,
  });
}

function confirmDelete(booking) {
  const notes = [];
  if (booking.amountPaid > 0) notes.push(`The ${formatPeso(booking.amountPaid)} in recorded payments for this booking will be deleted too.`);
  if (booking.pendingPayments > 0) notes.push('Its payment waiting for review will be deleted too.');
  const paymentNote = notes.length > 0 ? ` ${notes.join(' ')}` : '';

  openConfirm({
    title: 'Delete this booking?',
    message:
      `Booking #${booking.reference} for ${booking.customerName} (${formatDate(booking.eventDate)}) will be permanently deleted.` +
      `${paymentNote} This can't be undone.`,
    confirmLabel: 'Delete booking',
    variant: 'danger-solid',
    action: () => deleteRequest(`${API_BASE}/${booking.id}`),
    successMessage: `Booking #${booking.reference} was deleted.`,
  });
}

elements.searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = elements.searchInput.value.trim();
    resetToFirstPage();
  }, SEARCH_DELAY_MS);
});

elements.serviceFilter.addEventListener('change', () => {
  state.serviceId = elements.serviceFilter.value;
  resetToFirstPage();
});

elements.dateFilter.addEventListener('change', () => {
  state.date = elements.dateFilter.value;
  resetToFirstPage();
});

elements.clearFilters.addEventListener('click', () => {
  state.search = '';
  state.serviceId = '';
  state.date = '';
  state.status = 'all';
  elements.searchInput.value = '';
  elements.serviceFilter.value = '';
  elements.dateFilter.value = '';
  resetToFirstPage();
});

elements.statusTabs.addEventListener('click', (event) => {
  const tab = event.target.closest('.status-tab');
  if (!tab) return;

  state.status = tab.dataset.status;
  resetToFirstPage();
});

elements.previousPage.addEventListener('click', () => {
  state.page -= 1;
  loadBookings();
});

elements.nextPage.addEventListener('click', () => {
  state.page += 1;
  loadBookings();
});

elements.bookingBody.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const booking = state.data.bookings.find((entry) => entry.id === Number(button.closest('tr').dataset.id));
  const action = button.dataset.action;

  if (action === 'view') openView(booking.id);
  if (action === 'update') openUpdate(booking.id);
  if (action === 'contract') showToast(CONTRACT_MESSAGE, 'info');
  if (action === 'delete') confirmDelete(booking);
  if (action === 'accept') confirmAccept(booking);
  if (action === 'decline') confirmDecline(booking);
});

elements.viewContract.addEventListener('click', () => showToast(CONTRACT_MESSAGE, 'info'));

elements.viewUpdate.addEventListener('click', () => {
  const id = viewing.id;

  elements.viewDialog.close();
  openUpdate(id);
});

elements.updateStatus.addEventListener('change', () => {
  elements.updateStatusHint.textContent = STATUS_HINTS[elements.updateStatus.value];
});

elements.updateForm.addEventListener('submit', submitUpdate);
elements.confirmButton.addEventListener('click', runConfirmed);

clearFieldOnInput(elements.updateForm);
enableDialogDismiss();
loadServiceOptions();
loadBookings();
