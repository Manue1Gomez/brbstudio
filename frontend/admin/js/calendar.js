import { deleteRequest, getJson, sendJson } from './admin-api.js';

const API_BASE = '/api/admin/calendar';
const TOAST_DURATION_MS = 3500;

const monthTitleFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const longDateFormat = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const elements = {
  title: document.getElementById('calendarTitle'),
  grid: document.getElementById('calendarGrid'),
  previousMonth: document.getElementById('previousMonth'),
  nextMonth: document.getElementById('nextMonth'),
  dayTitle: document.getElementById('dayTitle'),
  bookingList: document.getElementById('bookingList'),
  bookingEmpty: document.getElementById('bookingEmpty'),
  bookingTemplate: document.getElementById('bookingItemTemplate'),
  dayNote: document.getElementById('dayNote'),
  toggleBlock: document.getElementById('toggleBlockButton'),
  blockedList: document.getElementById('blockedList'),
  blockedEmpty: document.getElementById('blockedEmpty'),
  blockedTemplate: document.getElementById('blockedItemTemplate'),
  blockDialog: document.getElementById('blockDialog'),
  blockDialogMessage: document.getElementById('blockDialogMessage'),
  confirmBlock: document.getElementById('confirmBlockButton'),
  toast: document.getElementById('toast'),
};

const pad = (number) => String(number).padStart(2, '0');

const toIsoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const fromIsoDate = (isoDate) => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatLongDate = (isoDate) => longDateFormat.format(fromIsoDate(isoDate));

const today = toIsoDate(new Date());

const state = {
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  selectedDate: today,
  bookedDates: new Set(),
  blockedDates: new Set(),
  day: null,
  busy: false,
};

let latestMonthRequest = 0;
let latestDayRequest = 0;
let toastTimer = null;

const monthKey = () => `${state.year}-${pad(state.month + 1)}`;

function showToast(message, type = 'success') {
  clearTimeout(toastTimer);

  elements.toast.textContent = message;
  elements.toast.classList.toggle('toast--error', type === 'error');
  elements.toast.hidden = false;

  toastTimer = setTimeout(() => {
    elements.toast.hidden = true;
  }, TOAST_DURATION_MS);
}

function describeDay(isoDate) {
  const parts = [formatLongDate(isoDate)];

  if (state.blockedDates.has(isoDate)) parts.push('unavailable');
  if (state.bookedDates.has(isoDate)) parts.push('has bookings');

  return parts.join(', ');
}

function createDayCell(day) {
  const isoDate = `${monthKey()}-${pad(day)}`;
  const cell = document.createElement('button');
  const number = document.createElement('span');

  cell.type = 'button';
  cell.className = 'calendar__day';
  cell.dataset.date = isoDate;
  cell.setAttribute('aria-label', describeDay(isoDate));
  cell.setAttribute('aria-pressed', String(isoDate === state.selectedDate));

  number.className = 'calendar__number';
  number.textContent = day;
  cell.append(number);

  cell.classList.toggle('calendar__day--unavailable', state.blockedDates.has(isoDate));
  cell.classList.toggle('calendar__day--selected', isoDate === state.selectedDate);
  cell.classList.toggle('calendar__day--today', isoDate === today);

  if (state.bookedDates.has(isoDate)) {
    const dot = document.createElement('span');
    dot.className = 'calendar__dot';
    cell.append(dot);
  }

  return cell;
}

function createEmptyCell() {
  const cell = document.createElement('span');
  cell.className = 'calendar__day calendar__day--empty';
  cell.setAttribute('aria-hidden', 'true');
  return cell;
}

function renderCalendar() {
  const leadingBlanks = new Date(state.year, state.month, 1).getDay();
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
  const totalCells = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;

  const cells = Array.from({ length: totalCells }, (_, index) => {
    const day = index - leadingBlanks + 1;
    return day >= 1 && day <= daysInMonth ? createDayCell(day) : createEmptyCell();
  });

  elements.title.textContent = monthTitleFormat.format(new Date(state.year, state.month, 1));
  elements.grid.replaceChildren(...cells);
}

function createBookingItem(booking) {
  const item = elements.bookingTemplate.content.firstElementChild.cloneNode(true);
  const status = item.querySelector('.booking-item__status');

  item.querySelector('.booking-item__time').textContent = booking.timeLabel;
  item.querySelector('.booking-item__client').textContent = booking.clientName;
  item.querySelector('.booking-item__services').textContent = booking.services;

  status.textContent = booking.status;
  status.classList.add(`booking-item__status--${booking.status.toLowerCase().replace(/\s+/g, '-')}`);

  return item;
}

function renderToggleButton() {
  const { day, selectedDate } = state;
  const isPast = selectedDate < today;
  const isBlocked = Boolean(day?.blocked);
  const button = elements.toggleBlock;

  button.disabled = state.busy || !day || isPast;
  button.className = `btn btn--block btn--lg ${isBlocked ? '' : 'btn--primary'}`.trim();

  if (isBlocked) {
    button.textContent = 'Mark as Available';
  } else {
    button.innerHTML = '<span class="btn__icon btn__icon--ban" aria-hidden="true"></span>Mark as Unavailable';
  }

  elements.dayNote.hidden = !isPast;
  elements.dayNote.textContent = "Dates that have already passed can't be changed.";
}

function renderDayPanel() {
  const { day, selectedDate } = state;

  elements.dayTitle.textContent = formatLongDate(selectedDate);

  if (!day) {
    elements.bookingList.replaceChildren();
    elements.bookingEmpty.textContent = 'Loading bookings...';
    elements.bookingEmpty.hidden = false;
  } else {
    elements.bookingList.replaceChildren(...day.bookings.map(createBookingItem));
    elements.bookingEmpty.textContent = 'No bookings on this date.';
    elements.bookingEmpty.hidden = day.bookings.length > 0;
  }

  renderToggleButton();
}

function renderBlockedList(blockedDates) {
  const items = blockedDates.map((isoDate) => {
    const item = elements.blockedTemplate.content.firstElementChild.cloneNode(true);
    const dateButton = item.querySelector('.blocked-item__date');
    const removeButton = item.querySelector('.blocked-item__remove');

    dateButton.textContent = formatLongDate(isoDate);
    dateButton.dataset.date = isoDate;
    removeButton.dataset.date = isoDate;
    removeButton.setAttribute('aria-label', `Remove block on ${formatLongDate(isoDate)}`);

    return item;
  });

  elements.blockedList.replaceChildren(...items);
  elements.blockedEmpty.hidden = blockedDates.length > 0;
}

async function loadMonth() {
  const requestId = ++latestMonthRequest;

  try {
    const overview = await getJson(`${API_BASE}/month?month=${monthKey()}`);
    if (requestId !== latestMonthRequest) return;

    state.bookedDates = new Set(overview.bookedDates);
    state.blockedDates = new Set(overview.blockedDates);
    renderCalendar();
  } catch (error) {
    if (requestId === latestMonthRequest) showToast(error.message, 'error');
  }
}

async function loadDay() {
  const requestId = ++latestDayRequest;
  const date = state.selectedDate;

  try {
    const day = await getJson(`${API_BASE}/day?date=${date}`);
    if (requestId !== latestDayRequest) return;

    state.day = day;
    renderDayPanel();
  } catch (error) {
    if (requestId === latestDayRequest) showToast(error.message, 'error');
  }
}

async function loadBlockedList() {
  try {
    renderBlockedList(await getJson(`${API_BASE}/blocked-dates`));
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function selectDate(isoDate) {
  state.selectedDate = isoDate;
  state.day = null;

  renderCalendar();
  renderDayPanel();
  loadDay();
}

function changeMonth(step) {
  const target = new Date(state.year, state.month + step, 1);

  state.year = target.getFullYear();
  state.month = target.getMonth();
  state.bookedDates = new Set();
  state.blockedDates = new Set();

  const isCurrentMonth = target.getFullYear() === new Date().getFullYear() && target.getMonth() === new Date().getMonth();

  selectDate(isCurrentMonth ? today : `${monthKey()}-01`);
  loadMonth();
}

async function refreshAvailability() {
  state.day = null;
  renderDayPanel();

  await Promise.all([loadMonth(), loadDay(), loadBlockedList()]);
}

async function runAction(action, successMessage) {
  state.busy = true;
  renderToggleButton();

  try {
    await action();
    showToast(successMessage);
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    state.busy = false;
    await refreshAvailability();
  }
}

function blockDate(isoDate) {
  return runAction(
    () => sendJson(`${API_BASE}/blocked-dates`, 'POST', { date: isoDate }),
    `${formatLongDate(isoDate)} is now unavailable.`
  );
}

function unblockDate(isoDate) {
  return runAction(
    () => deleteRequest(`${API_BASE}/blocked-dates/${isoDate}`),
    `${formatLongDate(isoDate)} is available again.`
  );
}

function handleToggleBlock() {
  const { day, selectedDate } = state;
  if (!day) return;

  if (day.blocked) {
    unblockDate(selectedDate);
    return;
  }

  if (day.bookings.length === 0) {
    blockDate(selectedDate);
    return;
  }

  const count = day.bookings.length;
  elements.blockDialogMessage.textContent =
    `${formatLongDate(selectedDate)} already has ${count} ${count === 1 ? 'booking' : 'bookings'}. ` +
    "They stay on the schedule, but customers won't be able to choose this date for new bookings.";
  elements.blockDialog.showModal();
}

elements.previousMonth.addEventListener('click', () => changeMonth(-1));
elements.nextMonth.addEventListener('click', () => changeMonth(1));

elements.grid.addEventListener('click', (event) => {
  const cell = event.target.closest('button[data-date]');
  if (cell) selectDate(cell.dataset.date);
});

elements.toggleBlock.addEventListener('click', handleToggleBlock);

elements.confirmBlock.addEventListener('click', () => {
  elements.blockDialog.close();
  blockDate(state.selectedDate);
});

elements.blockedList.addEventListener('click', (event) => {
  const dateButton = event.target.closest('.blocked-item__date');
  const removeButton = event.target.closest('.blocked-item__remove');

  if (dateButton) {
    const target = fromIsoDate(dateButton.dataset.date);

    state.year = target.getFullYear();
    state.month = target.getMonth();
    state.bookedDates = new Set();
    state.blockedDates = new Set();

    selectDate(dateButton.dataset.date);
    loadMonth();
  }

  if (removeButton) unblockDate(removeButton.dataset.date);
});

elements.blockDialog.addEventListener('click', (event) => {
  if (event.target === elements.blockDialog || event.target.closest('[data-dialog-close]')) {
    elements.blockDialog.close();
  }
});

renderCalendar();
renderDayPanel();
loadMonth();
loadDay();
loadBlockedList();
