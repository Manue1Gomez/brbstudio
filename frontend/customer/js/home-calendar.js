import { getJson } from './api.js';
import { bookingUrl, loadCustomer } from './session.js';

const monthLabel = document.getElementById('calendarMonth');
const prevButton = document.getElementById('calendarPrev');
const nextButton = document.getElementById('calendarNext');
const dayGrid = document.getElementById('calendarDays');
const calendarStatus = document.getElementById('calendarStatus');
const dayHeading = document.getElementById('dayHeading');
const dayStatus = document.getElementById('dayStatus');
const dayList = document.getElementById('dayList');
const dayBookLink = document.getElementById('dayBookLink');
const rowTemplate = document.getElementById('bookedRowTemplate');

const today = new Date();
const view = { year: today.getFullYear(), month: today.getMonth() };

let customer = null;
let blockedDates = new Set();
let selectedDate = null;
let monthRequest = 0;
let dayRequest = 0;

const pad = (value) => String(value).padStart(2, '0');
const toIso = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;
const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate());

function formatLongDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);

  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function buildDay(day) {
  const iso = toIso(view.year, view.month, day);
  const button = document.createElement('button');

  button.type = 'button';
  button.className = 'calendar__day';
  button.textContent = day;
  button.dataset.date = iso;

  if (iso < todayIso) {
    button.disabled = true;
    button.classList.add('is-past');
  } else if (blockedDates.has(iso)) {
    button.disabled = true;
    button.classList.add('is-blocked');
    button.setAttribute('aria-label', `${formatLongDate(iso)}, unavailable`);
  }

  if (iso === selectedDate) {
    button.classList.add('is-selected');
    button.setAttribute('aria-pressed', 'true');
  }

  return button;
}

function renderMonth() {
  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const spacers = Array.from({ length: firstWeekday }, () => document.createElement('span'));
  const days = Array.from({ length: daysInMonth }, (_, index) => buildDay(index + 1));

  monthLabel.textContent = new Date(view.year, view.month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  prevButton.disabled = view.year === today.getFullYear() && view.month === today.getMonth();
  dayGrid.replaceChildren(...spacers, ...days);
}

async function loadMonth() {
  const request = ++monthRequest;
  const month = `${view.year}-${pad(view.month + 1)}`;

  try {
    const { ok, data } = await getJson(`/api/calendar/blocked-dates?month=${month}`);
    if (request !== monthRequest) return;

    if (!ok) throw new Error('Request failed');

    blockedDates = new Set(data.blockedDates);
    calendarStatus.hidden = true;
  } catch {
    if (request !== monthRequest) return;

    blockedDates = new Set();
    calendarStatus.textContent = 'Unavailable dates could not be loaded.';
    calendarStatus.hidden = false;
  }

  renderMonth();
}

function showDayStatus(text) {
  dayStatus.textContent = text;
  dayStatus.hidden = false;
}

function buildRow({ serviceName, timeLabel }) {
  const row = rowTemplate.content.firstElementChild.cloneNode(true);

  row.querySelector('.day-panel__service').textContent = serviceName;
  row.querySelector('.day-panel__time').textContent = timeLabel;

  return row;
}

async function loadDay(iso) {
  const request = ++dayRequest;

  dayHeading.textContent = formatLongDate(iso);
  dayList.replaceChildren();
  dayBookLink.hidden = true;
  showDayStatus('Loading bookings...');

  try {
    const { ok, data } = await getJson(`/api/calendar/day?date=${iso}`);
    if (request !== dayRequest) return;

    if (!ok) throw new Error('Request failed');

    if (data.blocked) {
      showDayStatus('This date is unavailable.');
      return;
    }

    dayList.replaceChildren(...data.booked.map(buildRow));
    dayBookLink.setAttribute('href', bookingUrl(customer, { date: iso }));
    dayBookLink.hidden = false;

    if (data.booked.length > 0) dayStatus.hidden = true;
    else showDayStatus('No bookings yet. This date is open.');
  } catch {
    if (request !== dayRequest) return;
    showDayStatus('Bookings for this date could not be loaded.');
  }
}

function selectDate(iso) {
  selectedDate = iso;

  dayGrid.querySelectorAll('.calendar__day').forEach((button) => {
    const isSelected = button.dataset.date === iso;

    button.classList.toggle('is-selected', isSelected);
    button.setAttribute('aria-pressed', String(isSelected));
  });

  loadDay(iso);
}

async function changeMonth(step) {
  const next = new Date(view.year, view.month + step, 1);

  view.year = next.getFullYear();
  view.month = next.getMonth();

  await loadMonth();
}

dayGrid.addEventListener('click', ({ target }) => {
  const button = target.closest('.calendar__day');
  if (button && !button.disabled) selectDate(button.dataset.date);
});

prevButton.addEventListener('click', () => changeMonth(-1));
nextButton.addEventListener('click', () => changeMonth(1));

async function init() {
  customer = await loadCustomer();
  await loadMonth();

  if (!blockedDates.has(todayIso)) selectDate(todayIso);
}

init();
