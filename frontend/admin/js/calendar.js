import { deleteRequest, getJson, sendJson } from './admin-api.js';

const API_BASE = '/api/admin/calendar';
const TOAST_DURATION_MS = 3500;
const KEEP_SELECTION_AREAS = '.calendar, .day-panel, .blocked-panel, .sidebar, dialog, .toast';

const ICON_BAN = '<span class="btn__icon btn__icon--ban" aria-hidden="true"></span>';
const ICON_CHECK = '<span class="btn__icon btn__icon--check" aria-hidden="true"></span>';

const monthTitleFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const longDateFormat = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const shortMonthFormat = new Intl.DateTimeFormat('en-US', { month: 'short' });
const monthNames = Array.from({ length: 12 }, (_, index) => shortMonthFormat.format(new Date(2000, index, 1)));

const elements = {
  title: document.getElementById('calendarTitle'),
  grid: document.getElementById('calendarGrid'),
  previousMonth: document.getElementById('previousMonth'),
  nextMonth: document.getElementById('nextMonth'),
  monthPickerButton: document.getElementById('monthPickerButton'),
  monthPicker: document.getElementById('monthPicker'),
  monthPickerGrid: document.getElementById('monthPickerGrid'),
  pickerYear: document.getElementById('pickerYear'),
  previousYear: document.getElementById('previousYear'),
  nextYear: document.getElementById('nextYear'),
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

const now = new Date();
const today = toIsoDate(now);

const state = {
  year: now.getFullYear(),
  month: now.getMonth(),
  selectedDate: today,
  bookedDates: new Set(),
  blockedDates: new Set(),
  day: null,
  busy: false,
  pickerOpen: false,
  pickerYear: now.getFullYear(),
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

  if (isoDate === today) parts.push('today');
  if (isoDate < today) parts.push('past date');
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

  cell.classList.toggle('calendar__day--past', isoDate < today);
  cell.classList.toggle('calendar__day--today', isoDate === today);
  cell.classList.toggle('calendar__day--unavailable', state.blockedDates.has(isoDate));
  cell.classList.toggle('calendar__day--selected', isoDate === state.selectedDate);

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
  const isPast = Boolean(selectedDate) && selectedDate < today;
  const isBlocked = Boolean(day?.blocked);
  const button = elements.toggleBlock;

  button.disabled = state.busy || !selectedDate || !day || isPast;
  button.className = `btn btn--block btn--lg ${isBlocked ? 'btn--success' : 'btn--primary'}`;
  button.innerHTML = isBlocked ? `${ICON_CHECK}Mark as Available` : `${ICON_BAN}Mark as Unavailable`;

  elements.dayNote.hidden = !isPast;
  elements.dayNote.textContent = "Dates that have already passed can't be changed.";
}

function renderDayPanel() {
  const { day, selectedDate } = state;

  if (!selectedDate) {
    elements.dayTitle.textContent = 'No date selected';
    elements.bookingList.replaceChildren();
    elements.bookingEmpty.textContent = 'Select a date on the calendar to see its bookings.';
    elements.bookingEmpty.hidden = false;
    renderToggleButton();
    return;
  }

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
  const date = state.selectedDate;
  if (!date) return;

  const requestId = ++latestDayRequest;

  try {
    const day = await getJson(`${API_BASE}/day?date=${date}`);
    if (requestId !== latestDayRequest || state.selectedDate !== date) return;

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

function clearSelection() {
  latestDayRequest += 1;
  state.selectedDate = null;
  state.day = null;

  renderCalendar();
  renderDayPanel();
}

function goToMonth(year, month) {
  state.year = year;
  state.month = month;
  state.bookedDates = new Set();
  state.blockedDates = new Set();

  if (state.selectedDate && !state.selectedDate.startsWith(monthKey())) {
    clearSelection();
  } else {
    renderCalendar();
  }

  loadMonth();
}

function stepMonth(step) {
  const target = new Date(state.year, state.month + step, 1);
  goToMonth(target.getFullYear(), target.getMonth());
}

function renderMonthPicker() {
  elements.pickerYear.textContent = state.pickerYear;

  const buttons = monthNames.map((name, index) => {
    const button = document.createElement('button');
    const isShown = state.pickerYear === state.year && index === state.month;
    const isCurrent = state.pickerYear === now.getFullYear() && index === now.getMonth();

    button.type = 'button';
    button.className = 'month-picker__month';
    button.dataset.month = index;
    button.textContent = name;
    button.setAttribute('aria-pressed', String(isShown));
    button.classList.toggle('month-picker__month--selected', isShown);
    button.classList.toggle('month-picker__month--current', isCurrent && !isShown);

    return button;
  });

  elements.monthPickerGrid.replaceChildren(...buttons);
}

function openMonthPicker() {
  state.pickerOpen = true;
  state.pickerYear = state.year;

  renderMonthPicker();
  elements.monthPicker.hidden = false;
  elements.monthPickerButton.setAttribute('aria-expanded', 'true');

  const target = elements.monthPickerGrid.querySelector('[aria-pressed="true"]') ?? elements.monthPickerGrid.firstElementChild;
  target.focus();
}

function closeMonthPicker({ restoreFocus = false } = {}) {
  state.pickerOpen = false;
  elements.monthPicker.hidden = true;
  elements.monthPickerButton.setAttribute('aria-expanded', 'false');

  if (restoreFocus) elements.monthPickerButton.focus();
}

function shiftPickerYear(step) {
  state.pickerYear += step;
  renderMonthPicker();
}

async function refreshAvailability() {
  const tasks = [loadMonth(), loadBlockedList()];

  if (state.selectedDate) {
    state.day = null;
    renderDayPanel();
    tasks.push(loadDay());
  }

  await Promise.all(tasks);
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
  if (!day || !selectedDate) return;

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

elements.previousMonth.addEventListener('click', () => stepMonth(-1));
elements.nextMonth.addEventListener('click', () => stepMonth(1));

elements.grid.addEventListener('click', (event) => {
  const cell = event.target.closest('button[data-date]');
  if (!cell) return;

  if (cell.dataset.date === state.selectedDate) clearSelection();
  else selectDate(cell.dataset.date);
});

elements.monthPickerButton.addEventListener('click', () => {
  if (state.pickerOpen) closeMonthPicker();
  else openMonthPicker();
});

elements.previousYear.addEventListener('click', () => shiftPickerYear(-1));
elements.nextYear.addEventListener('click', () => shiftPickerYear(1));

elements.monthPickerGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-month]');
  if (!button) return;

  goToMonth(state.pickerYear, Number(button.dataset.month));
  closeMonthPicker({ restoreFocus: true });
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

    goToMonth(target.getFullYear(), target.getMonth());
    selectDate(dateButton.dataset.date);
  }

  if (removeButton) unblockDate(removeButton.dataset.date);
});

elements.blockDialog.addEventListener('click', (event) => {
  if (event.target === elements.blockDialog || event.target.closest('[data-dialog-close]')) {
    elements.blockDialog.close();
  }
});

document.addEventListener('click', (event) => {
  const path = event.composedPath();
  const isInside = (selector) => path.some((node) => node instanceof Element && node.matches(selector));

  if (state.pickerOpen && !isInside('.month-picker')) {
    closeMonthPicker();
    return;
  }

  if (state.selectedDate && !isInside(KEEP_SELECTION_AREAS)) clearSelection();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.pickerOpen) closeMonthPicker({ restoreFocus: true });
});

renderCalendar();
renderDayPanel();
loadMonth();
loadDay();
loadBlockedList();
