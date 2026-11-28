import { getJson, postJson } from './api.js';
import { startAccountPage } from './account-page.js';
import { createCalendar } from './calendar-grid.js';
import { formatLongDate, formatPeso, formatTime } from './format.js';
import { setSubmitting, showAlert, showNetworkError } from './form-helpers.js';

const LOGIN_PAGE = 'login.html';
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

const panels = [...document.querySelectorAll('.booking-step')];
const stepperSteps = document.querySelectorAll('.stepper__step');
const stepTitle = document.getElementById('stepTitle');
const stepSubtitle = document.getElementById('stepSubtitle');

const serviceStatus = document.getElementById('serviceStatus');
const serviceOptions = document.getElementById('serviceOptions');
const optionTemplate = document.getElementById('serviceOptionTemplate');
const serviceContinue = document.getElementById('serviceContinue');

const scheduleError = document.getElementById('scheduleError');
const scheduleContinue = document.getElementById('scheduleContinue');
const availableSlots = document.getElementById('availableSlots');
const slotStatus = document.getElementById('slotStatus');
const pendingReservationNotice = document.getElementById('pendingReservationNotice');
const pendingReservationTitle = document.getElementById('pendingReservationTitle');
const workshopNotice = document.getElementById('workshopNotice');
const bookingHoursNote = document.getElementById('bookingHoursNote');

const summaryDetails = document.getElementById('summaryDetails');
const summaryServices = document.getElementById('summaryServices');
const summaryDate = document.getElementById('summaryDate');
const summaryTime = document.getElementById('summaryTime');
const summarySubtotal = document.getElementById('summarySubtotal');
const summaryDiscount = document.getElementById('summaryDiscount');
const summaryTotal = document.getElementById('summaryTotal');
const submitError = document.getElementById('submitError');
const submitButton = document.getElementById('submitBooking');
const summaryBack = document.getElementById('summaryBack');
const lockedContinue = document.getElementById('lockedContinue');
const requestSent = document.getElementById('requestSent');
const voucherInput = document.getElementById('voucherInput');
const voucherApply = document.getElementById('voucherApply');
const voucherAlert = document.getElementById('voucherAlert');
const voucherSuccess = document.getElementById('voucherSuccess');

const state = {
  services: [],
  selectedIds: new Set(),
  date: null,
  slots: [],
  selectedSlot: null,
  pendingReservations: [],
  wholeDay: false,
  dayAvailable: false,
  durationHours: 0,
  bookingId: null,
  discountAmount: 0,
  pendingVoucherCode: null,
};

let availabilityRequest = 0;

const selectedServices = () => state.services.filter((service) => state.selectedIds.has(service.id));

function goToStep(step) {
  const current = panels.find((panel) => Number(panel.dataset.step) === step);

  panels.forEach((panel) => {
    panel.hidden = panel !== current;
  });
  stepperSteps.forEach((item) => {
    const stepNumber = Number(item.dataset.step);
    const stepButton = item.querySelector('.stepper__dot[data-go-to]');
    item.classList.toggle('is-reached', stepNumber <= step);
    if (stepButton) {
      stepButton.disabled = stepNumber > step;
      if (stepNumber === step) stepButton.setAttribute('aria-current', 'step');
      else stepButton.removeAttribute('aria-current');
    }
  });

  stepTitle.textContent = current.dataset.title;
  stepSubtitle.textContent = current.dataset.subtitle;

  if (step === 3) renderSummary();

  window.scrollTo({ top: 0 });
}

function buildOption(service) {
  const item = optionTemplate.content.firstElementChild.cloneNode(true);
  const image = item.querySelector('.service-option__image');
  const input = item.querySelector('.service-option__input');

  input.value = service.id;
  input.checked = state.selectedIds.has(service.id);
  item.querySelector('.service-option__name').textContent = service.name;
  item.querySelector('.service-option__price').textContent = formatPeso(service.price);
  item.querySelector('.service-option__duration').textContent = service.durationHours === null
    ? 'Full day'
    : `${service.durationHours} hour${service.durationHours === 1 ? '' : 's'}`;

  if (service.imageUrl) {
    image.src = service.imageUrl;
    image.alt = service.name;
  } else {
    image.remove();
  }

  return item;
}

function showServiceStatus(text) {
  serviceStatus.textContent = text;
  serviceStatus.hidden = false;
}

async function loadServices() {
  try {
    const { ok, data } = await getJson('/api/services');

    if (!ok) {
      showServiceStatus('Services could not be loaded. Please refresh the page.');
      return;
    }

    if (data.length === 0) {
      showServiceStatus('No services are available right now.');
      return;
    }

    state.services = data;

    const preselected = Number(new URLSearchParams(window.location.search).get('service'));
    if (data.some((service) => service.id === preselected)) state.selectedIds.add(preselected);

    serviceOptions.replaceChildren(...data.map(buildOption));
    updateServiceSelectionControls();
    serviceContinue.disabled = state.selectedIds.size === 0;
    serviceStatus.hidden = true;
  } catch {
    showServiceStatus('Unable to reach the server. Please check your connection and try again.');
  }
}

function isWorkshop(service) {
  return /modeling workshop/i.test(service.name);
}

function updateServiceSelectionControls() {
  const workshopSelected = selectedServices().some(isWorkshop);
  const regularSelected = selectedServices().some((service) => !isWorkshop(service));
  const inputs = [...serviceOptions.querySelectorAll('.service-option__input')];

  inputs.forEach((input) => {
    const service = state.services.find((item) => item.id === Number(input.value));
    input.disabled = (workshopSelected && !isWorkshop(service)) || (regularSelected && isWorkshop(service));
  });

  workshopNotice.hidden = !workshopSelected;
  workshopNotice.textContent = 'Modeling Workshop cannot be combined with any other service.';
  serviceContinue.disabled = state.selectedIds.size === 0;
  if (state.date) loadAvailability();
}

function renderSlots() {
  availableSlots.replaceChildren();
  renderPendingReservations();

  if (state.wholeDay) {
    slotStatus.textContent = state.dayAvailable
      ? 'Modeling Workshop is a full-day booking. No time selection is needed.'
      : 'This date is unavailable for a Modeling Workshop.';
    scheduleContinue.disabled = !state.dayAvailable;
    return;
  }

  if (!state.date || state.selectedIds.size === 0) {
    slotStatus.textContent = 'Choose services and a date to see available times.';
    scheduleContinue.disabled = true;
    return;
  }

  if (state.slots.length === 0) {
    slotStatus.textContent = 'No time slots are available for the selected services on this date. Please choose another date.';
    scheduleContinue.disabled = true;
    return;
  }

  slotStatus.textContent = `Available slots for ${state.durationHours} hour${state.durationHours === 1 ? '' : 's'}:`;
  availableSlots.replaceChildren(...state.slots.map((slot) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'schedule__slot';
    button.textContent = slot.label;
    button.setAttribute('aria-pressed', String(state.selectedSlot?.startTime === slot.startTime));
    if (state.selectedSlot?.startTime === slot.startTime) button.classList.add('schedule__slot--selected');
    button.addEventListener('click', () => {
      state.selectedSlot = slot;
      renderSlots();
    });
    return button;
  }));
  scheduleContinue.disabled = !state.selectedSlot;
}

function renderPendingReservations() {
  if (!state.selectedSlot) {
    pendingReservationNotice.hidden = true;
    return;
  }

  const [selectedHours, selectedMinutes] = state.selectedSlot.startTime.split(':').map(Number);
  const selectedStart = selectedHours * 60 + selectedMinutes;
  const selectedEnd = selectedStart + state.durationHours * 60;
  const reservations = state.pendingReservations.filter(({ startMinute, endMinute }) =>
    selectedStart < endMinute && selectedEnd > startMinute
  );
  if (reservations.length === 0) {
    pendingReservationNotice.hidden = true;
    return;
  }

  pendingReservationTitle.textContent = reservations.length === 1
    ? 'Another customer has also booked this time; their request is only waiting for admin approval.'
    : 'Other customers have also booked this time; their requests are only waiting for admin approval.';
  pendingReservationNotice.hidden = false;
}

async function loadAvailability(iso = state.date) {
  const request = ++availabilityRequest;
  state.date = iso;
  state.slots = [];
  state.selectedSlot = null;
  state.pendingReservations = [];
  renderPendingReservations();
  state.wholeDay = false;
  state.dayAvailable = false;
  state.durationHours = 0;
  scheduleError.hidden = true;

  if (!iso || state.selectedIds.size === 0) {
    renderSlots();
    return;
  }

  slotStatus.textContent = 'Checking available slots...';
  scheduleContinue.disabled = true;

  try {
    const params = new URLSearchParams({
      date: iso,
      serviceIds: [...state.selectedIds].join(','),
    });
    const { ok, data } = await getJson(`/api/bookings/availability?${params}`);
    if (request !== availabilityRequest) return;
    if (!ok) throw new Error(data.message ?? 'Could not load available slots.');

    state.slots = data.slots ?? [];
    state.pendingReservations = data.pendingReservations ?? [];
    state.wholeDay = Boolean(data.wholeDay);
    state.dayAvailable = Boolean(data.available);
    state.durationHours = data.durationHours ?? 0;
    renderSlots();
  } catch (error) {
    if (request !== availabilityRequest) return;
    slotStatus.textContent = error.message || 'Unable to load available slots. Please try again.';
    scheduleContinue.disabled = true;
  }
}

function renderSummary() {
  const services = selectedServices();
  const subtotal = services.reduce((sum, service) => sum + service.price, 0);
  const discount = state.discountAmount;
  const total = subtotal - discount;

  summaryServices.replaceChildren(
    ...services.map((service) => {
      const item = document.createElement('li');

      item.textContent = service.name;
      return item;
    })
  );
  summaryDate.textContent = formatLongDate(state.date);
  summaryTime.textContent = state.wholeDay
    ? 'Full day'
    : (state.selectedSlot?.label ?? '—');
  if (summarySubtotal) summarySubtotal.textContent = formatPeso(subtotal);
  if (summaryDiscount) summaryDiscount.textContent = discount > 0 ? `−${formatPeso(discount)}` : '—';
  summaryTotal.textContent = formatPeso(total);
}

function readErrorMessage(data) {
  return Object.values(data.errors ?? {})[0] || data.message || GENERIC_ERROR_MESSAGE;
}

function showRequestSent() {
  summaryDetails.hidden = true;
  requestSent.hidden = false;
  summaryBack.hidden = true;
  submitButton.hidden = true;
  lockedContinue.hidden = false;
}

async function applyVoucher() {
  if (!voucherInput || !voucherAlert || !voucherSuccess) return;

  const code = voucherInput.value.trim().toUpperCase();
  voucherAlert.hidden = true;
  voucherSuccess.hidden = true;

  if (!code) {
    showAlert(voucherAlert, 'Enter a voucher code.');
    return;
  }

  // Compute current subtotal from selected services
  const subtotal = selectedServices().reduce((sum, s) => sum + s.price, 0);

  voucherApply.disabled = true;
  voucherApply.textContent = 'Checking...';

  try {
    const response = await postJson('/api/bookings/validate-voucher', { voucherCode: code, subtotal });

    if (response.ok) {
      // Apply discount to state and re-render totals immediately
      state.discountAmount = response.data.discountAmount;
      state.pendingVoucherCode = response.data.voucherCode;
      voucherInput.disabled = true;
      voucherApply.textContent = 'Applied';
      renderSummary();
      showAlert(voucherSuccess, `Voucher applied! You save ${formatPeso(state.discountAmount)}.`);
    } else {
      const msg = response.data.errors?.voucherCode ?? response.data.message ?? 'Invalid voucher code.';
      showAlert(voucherAlert, msg);
      voucherApply.disabled = false;
      voucherApply.textContent = 'Apply';
    }
  } catch {
    showAlert(voucherAlert, 'Unable to reach the server.');
    voucherApply.disabled = false;
    voucherApply.textContent = 'Apply';
  }
}

async function submitBooking() {
  submitError.hidden = true;
  setSubmitting(submitButton, true);

  const payload = {
    serviceIds: [...state.selectedIds],
    eventDate: state.date,
    ...(state.wholeDay ? {} : { startTime: state.selectedSlot?.startTime }),
    voucherCode: state.pendingVoucherCode ?? '',
  };

  try {
    const response = await postJson('/api/bookings', payload);

    if (response.ok) {
      state.bookingId = response.data.id;
      showRequestSent();
      return;
    }

    if (response.status === 401) {
      window.location.assign(LOGIN_PAGE);
      return;
    }

    // Surface a voucher error back to the voucher field
    if (response.data.errors?.voucherCode && voucherAlert) {
      showAlert(voucherAlert, response.data.errors.voucherCode);
      setSubmitting(submitButton, false);
      return;
    }

    showAlert(submitError, readErrorMessage(response.data));
  } catch {
    showNetworkError(submitError);
  }

  setSubmitting(submitButton, false);
}

function continueToSummary() {
  if (!state.date) {
    showAlert(scheduleError, 'Please choose a date for your booking.');
    return;
  }
  if (!state.wholeDay && !state.selectedSlot) {
    showAlert(scheduleError, 'Choose an available time slot.');
    return;
  }
  if (state.wholeDay && !state.dayAvailable) {
    showAlert(scheduleError, 'Choose an available date for the Modeling Workshop.');
    return;
  }

  goToStep(3);
}

serviceOptions.addEventListener('change', ({ target }) => {
  const id = Number(target.value);

  if (target.checked) state.selectedIds.add(id);
  else state.selectedIds.delete(id);

  updateServiceSelectionControls();
});

serviceContinue.addEventListener('click', () => goToStep(2));
scheduleContinue.addEventListener('click', continueToSummary);
submitButton.addEventListener('click', submitBooking);
if (voucherApply) voucherApply.addEventListener('click', applyVoucher);

document.addEventListener('click', ({ target }) => {
  const trigger = target.closest('[data-go-to]');
  if (trigger) goToStep(Number(trigger.dataset.goTo));
});

const calendar = createCalendar(
  {
    monthLabel: document.getElementById('calendarMonth'),
    prevButton: document.getElementById('calendarPrev'),
    nextButton: document.getElementById('calendarNext'),
    dayGrid: document.getElementById('calendarDays'),
    status: document.getElementById('calendarStatus'),
  },
  loadAvailability
);

async function init() {
  const customer = await startAccountPage();
  if (!customer) return;

  const requestedDate = new URLSearchParams(window.location.search).get('date');
  try {
    const { ok, data } = await getJson('/api/calendar/hours');
    bookingHoursNote.textContent = ok
      ? `Studio hours: ${formatTime(data.open)} - ${formatTime(data.close)}.`
      : 'Studio hours could not be loaded.';
  } catch {
    bookingHoursNote.textContent = 'Studio hours could not be loaded.';
  }
  goToStep(1);

  await Promise.all([loadServices(), requestedDate ? calendar.show(requestedDate) : calendar.load()]);
}

init();
