import { getJson, sendJson } from './admin-api.js';
import { formatDate, formatDateTime, formatPeso } from './format.js';
import { clearFieldOnInput, clearFormErrors, enableDialogDismiss, showFormError, showToast } from './ui.js';

const API_BASE = '/api/admin/payments';

const elements = {
  reviewGrid: document.getElementById('reviewGrid'),
  reviewStatus: document.getElementById('reviewStatus'),
  reviewCount: document.getElementById('reviewCount'),
  reviewTemplate: document.getElementById('reviewCardTemplate'),
  outstandingWrap: document.getElementById('outstandingWrap'),
  outstandingBody: document.getElementById('outstandingBody'),
  outstandingStatus: document.getElementById('outstandingStatus'),
  outstandingSummary: document.getElementById('outstandingSummary'),
  outstandingTemplate: document.getElementById('outstandingRowTemplate'),

  proofDialog: document.getElementById('proofDialog'),
  proofImage: document.getElementById('proofImage'),
  proofCaption: document.getElementById('proofCaption'),

  verifyDialog: document.getElementById('verifyDialog'),
  verifyDetails: document.getElementById('verifyDetails'),
  verifyWarning: document.getElementById('verifyWarning'),
  verifyEmailNote: document.getElementById('verifyEmailNote'),
  verifyError: document.getElementById('verifyError'),
  confirmVerify: document.getElementById('confirmVerifyButton'),

  rejectDialog: document.getElementById('rejectDialog'),
  rejectForm: document.getElementById('rejectForm'),
  rejectMessage: document.getElementById('rejectMessage'),
  confirmReject: document.getElementById('confirmRejectButton'),

  recordDialog: document.getElementById('recordDialog'),
  recordForm: document.getElementById('recordForm'),
  recordSummary: document.getElementById('recordSummary'),
  fillBalance: document.getElementById('fillBalanceButton'),
  confirmRecord: document.getElementById('confirmRecordButton'),

  fullDialog: document.getElementById('fullDialog'),
  fullForm: document.getElementById('fullForm'),
  fullMessage: document.getElementById('fullMessage'),
  confirmFull: document.getElementById('confirmFullButton'),
};

let toReview = [];
let outstanding = [];
let activePayment = null;
let activeBooking = null;

const findById = (list, id) => list.find((item) => item.id === Number(id));

function createReviewCard(payment) {
  const card = elements.reviewTemplate.content.firstElementChild.cloneNode(true);
  const image = card.querySelector('.review-card__image');
  const empty = card.querySelector('.review-card__empty');
  const zoom = card.querySelector('[data-action="zoom"]');
  const warning = card.querySelector('.review-card__warning');
  const details = [payment.method];

  if (payment.referenceNumber) details.push(`Ref ${payment.referenceNumber}`);
  details.push(`Submitted ${formatDateTime(payment.submittedAt)}`);

  card.dataset.id = payment.id;
  card.querySelector('.review-card__reference').textContent = `#${payment.reference}`;
  card.querySelector('.review-card__name').textContent = payment.customerName;
  card.querySelector('.review-card__services').textContent = payment.services.join(', ');
  card.querySelector('[data-field="total"]').textContent = formatPeso(payment.totalAmount);
  card.querySelector('[data-field="amountLabel"]').textContent = payment.type === 'Downpayment' ? 'Downpayment' : 'Payment';
  card.querySelector('[data-field="amount"]').textContent = formatPeso(payment.amount);
  card.querySelector('[data-field="balance"]').textContent = formatPeso(payment.balanceAfter);
  card.querySelector('.review-card__meta').textContent = details.join(' \u00B7 ');

  if (payment.proofUrl) {
    image.src = payment.proofUrl;
    image.hidden = false;
    empty.hidden = true;
  } else {
    zoom.disabled = true;
    zoom.querySelector('.review-card__expand').hidden = true;
  }

  if (payment.belowRequiredDownpayment) {
    warning.textContent = `Below the 50% downpayment of ${formatPeso(payment.requiredDownpayment)}.`;
    warning.hidden = false;
  }

  return card;
}

function renderReview() {
  elements.reviewGrid.replaceChildren(...toReview.map(createReviewCard));
  elements.reviewCount.textContent = toReview.length || '';
  elements.reviewStatus.hidden = toReview.length > 0;
  elements.reviewStatus.textContent = "You're all caught up. No payments are waiting for review.";
}

function describeProgress(entry) {
  if (entry.pendingPayments > 0) return { text: 'Payment awaiting review', review: true };
  if (entry.awaitingDownpayment) return { text: 'Awaiting downpayment', review: false };
  return { text: entry.paidPercent >= 50 ? 'Downpayment paid' : 'Partially paid', review: false };
}

function createOutstandingRow(entry) {
  const row = elements.outstandingTemplate.content.firstElementChild.cloneNode(true);
  const note = row.querySelector('.outstanding-table__note');
  const progress = describeProgress(entry);

  row.dataset.id = entry.id;
  row.querySelector('.outstanding-table__customer').textContent = entry.customerName;
  row.querySelector('.outstanding-table__reference').textContent = `#${entry.reference} \u00B7 ${entry.status}`;
  row.querySelector('.outstanding-table__services').textContent = entry.services.join(', ');
  row.querySelector('.outstanding-table__date').textContent = formatDate(entry.eventDate);
  row.querySelector('.outstanding-table__time').textContent = entry.timeLabel;
  row.querySelector('.tag--overdue').hidden = !entry.overdue;
  row.querySelector('.outstanding-table__amounts').textContent = `${formatPeso(entry.amountPaid)} / ${formatPeso(entry.totalAmount)}`;
  row.querySelector('.progress__bar').style.setProperty('--percent', `${entry.paidPercent}%`);
  row.querySelector('.outstanding-table__balance').textContent = formatPeso(entry.balance);

  note.textContent = progress.text;
  note.classList.toggle('tag--review', progress.review);

  return row;
}

function renderOutstanding(total) {
  const hasRows = outstanding.length > 0;

  elements.outstandingBody.replaceChildren(...outstanding.map(createOutstandingRow));
  elements.outstandingWrap.hidden = !hasRows;
  elements.outstandingStatus.hidden = hasRows;
  elements.outstandingStatus.textContent = 'Every accepted booking is fully paid.';
  elements.outstandingSummary.textContent = hasRows
    ? `${outstanding.length} ${outstanding.length === 1 ? 'booking' : 'bookings'} \u00B7 ${formatPeso(total)} still to collect`
    : '';
}

async function loadOverview() {
  try {
    const overview = await getJson(`${API_BASE}/overview`);

    toReview = overview.toReview;
    outstanding = overview.outstanding;
    renderReview();
    renderOutstanding(overview.outstandingTotal);
  } catch (error) {
    elements.reviewStatus.textContent = 'Unable to load payments. Please refresh the page.';
    elements.reviewStatus.hidden = false;
    elements.outstandingStatus.textContent = 'Unable to load balances. Please refresh the page.';
    elements.outstandingStatus.hidden = false;
    console.error(error);
  }
}

function openProof(payment) {
  elements.proofImage.src = payment.proofUrl;
  elements.proofCaption.textContent =
    `#${payment.reference} \u00B7 ${payment.customerName} \u00B7 ${formatPeso(payment.amount)} via ${payment.method}`;
  elements.proofDialog.showModal();
}

function addDetail(list, label, value) {
  const term = document.createElement('dt');
  const description = document.createElement('dd');

  term.textContent = label;
  description.textContent = value;
  list.append(term, description);
}

function openVerify(payment) {
  activePayment = payment;

  elements.verifyDetails.replaceChildren();
  addDetail(elements.verifyDetails, 'Customer', payment.customerName);
  addDetail(elements.verifyDetails, 'Booking', `#${payment.reference} \u00B7 ${payment.services.join(', ')}`);
  addDetail(elements.verifyDetails, payment.type, formatPeso(payment.amount));
  addDetail(elements.verifyDetails, 'Paid through', payment.referenceNumber ? `${payment.method} (Ref ${payment.referenceNumber})` : payment.method);
  addDetail(elements.verifyDetails, 'Balance after', formatPeso(payment.balanceAfter));

  elements.verifyWarning.hidden = !payment.belowRequiredDownpayment;
  elements.verifyWarning.textContent =
    `This is below the 50% downpayment of ${formatPeso(payment.requiredDownpayment)}. The booking stays "To Pay" until the downpayment is complete.`;
  elements.verifyEmailNote.textContent =
    `An e-receipt with the approved date and remaining balance will be emailed to ${payment.customerEmail}.`;
  elements.verifyError.hidden = true;
  elements.confirmVerify.disabled = false;
  elements.confirmVerify.textContent = 'Verify payment';

  elements.verifyDialog.showModal();
}

function receiptToast(result) {
  const { email } = result;

  if (email.status === 'sent') return showToast(`Payment verified. E-receipt sent to ${email.to}.`);
  if (email.status === 'not_configured') {
    return showToast("Payment verified, but the e-receipt was not sent because email isn't set up yet.", 'error');
  }

  return showToast(`Payment verified, but the e-receipt could not be sent to ${email.to}.`, 'error');
}

async function confirmVerify() {
  elements.confirmVerify.disabled = true;
  elements.confirmVerify.textContent = 'Verifying...';
  elements.verifyError.hidden = true;

  try {
    const result = await sendJson(`${API_BASE}/${activePayment.id}/verify`, 'POST', {});

    elements.verifyDialog.close();
    receiptToast(result);
    await loadOverview();
  } catch (error) {
    elements.verifyError.textContent = error.message;
    elements.verifyError.hidden = false;
    elements.confirmVerify.disabled = false;
    elements.confirmVerify.textContent = 'Verify payment';
    if (error.status === 409) loadOverview();
  }
}

function openReject(payment) {
  activePayment = payment;

  clearFormErrors(elements.rejectForm);
  elements.rejectForm.reset();
  elements.rejectMessage.textContent =
    `${formatPeso(payment.amount)} from ${payment.customerName} for #${payment.reference} will be rejected. The customer can submit a new payment.`;
  elements.confirmReject.disabled = false;

  elements.rejectDialog.showModal();
  elements.rejectForm.elements.reason.focus();
}

async function submitReject(event) {
  event.preventDefault();
  clearFormErrors(elements.rejectForm);
  elements.confirmReject.disabled = true;

  try {
    await sendJson(`${API_BASE}/${activePayment.id}/reject`, 'POST', { reason: elements.rejectForm.elements.reason.value });

    elements.rejectDialog.close();
    showToast(`Payment from ${activePayment.customerName} was rejected.`);
    await loadOverview();
  } catch (error) {
    showFormError(elements.rejectForm, error);
    if (error.status === 409) loadOverview();
  } finally {
    elements.confirmReject.disabled = false;
  }
}

function openRecord(entry) {
  activeBooking = entry;

  clearFormErrors(elements.recordForm);
  elements.recordForm.reset();
  elements.recordSummary.textContent =
    `#${entry.reference} \u00B7 ${entry.customerName}. Remaining balance: ${formatPeso(entry.balance)}.`;
  elements.fillBalance.textContent = `Fill in the full balance (${formatPeso(entry.balance)})`;
  elements.confirmRecord.disabled = false;

  elements.recordDialog.showModal();
  elements.recordForm.elements.amount.focus();
}

function describeRecorded(result, entry) {
  const parts = [`${formatPeso(result.recorded)} recorded for #${entry.reference}.`];

  if (result.balance === 0) parts.push('Now fully paid.');
  if (entry.status === 'To Pay' && result.bookingStatus === 'Confirmed') parts.push('Booking confirmed.');

  return parts.join(' ');
}

async function submitRecord(event) {
  event.preventDefault();
  clearFormErrors(elements.recordForm);
  elements.confirmRecord.disabled = true;

  const form = elements.recordForm.elements;

  try {
    const result = await sendJson(`${API_BASE}/record`, 'POST', {
      bookingId: activeBooking.id,
      amount: form.amount.value,
      method: form.method.value,
      note: form.note.value,
    });

    elements.recordDialog.close();
    showToast(describeRecorded(result, activeBooking));
    await loadOverview();
  } catch (error) {
    showFormError(elements.recordForm, error);
    if (error.status === 409) loadOverview();
  } finally {
    elements.confirmRecord.disabled = false;
  }
}

function openFull(entry) {
  activeBooking = entry;

  clearFormErrors(elements.fullForm);
  elements.fullForm.reset();
  elements.fullMessage.textContent =
    `${formatPeso(entry.balance)} will be recorded as received for #${entry.reference} (${entry.customerName}), ` +
    'and the booking will leave this list.';
  elements.confirmFull.disabled = false;

  elements.fullDialog.showModal();
}

async function submitFull(event) {
  event.preventDefault();
  clearFormErrors(elements.fullForm);
  elements.confirmFull.disabled = true;

  try {
    const result = await sendJson(`${API_BASE}/record`, 'POST', {
      bookingId: activeBooking.id,
      markFullyPaid: true,
      method: elements.fullForm.elements.method.value,
    });

    elements.fullDialog.close();
    showToast(describeRecorded(result, activeBooking));
    await loadOverview();
  } catch (error) {
    showFormError(elements.fullForm, error);
    if (error.status === 409) loadOverview();
  } finally {
    elements.confirmFull.disabled = false;
  }
}

elements.reviewGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const payment = findById(toReview, button.closest('.review-card').dataset.id);

  if (button.dataset.action === 'zoom') openProof(payment);
  if (button.dataset.action === 'verify') openVerify(payment);
  if (button.dataset.action === 'reject') openReject(payment);
});

elements.outstandingBody.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const entry = findById(outstanding, button.closest('tr').dataset.id);

  if (button.dataset.action === 'record') openRecord(entry);
  if (button.dataset.action === 'full') openFull(entry);
});

elements.fillBalance.addEventListener('click', () => {
  elements.recordForm.elements.amount.value = activeBooking.balance;
  elements.recordForm.elements.amount.focus();
});

elements.confirmVerify.addEventListener('click', confirmVerify);
elements.rejectForm.addEventListener('submit', submitReject);
elements.recordForm.addEventListener('submit', submitRecord);
elements.fullForm.addEventListener('submit', submitFull);

[elements.rejectForm, elements.recordForm, elements.fullForm].forEach(clearFieldOnInput);
enableDialogDismiss();
loadOverview();
