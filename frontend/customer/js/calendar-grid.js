import { getJson } from './api.js';

const pad = (value) => String(value).padStart(2, '0');

export const toIso = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;

const longDate = (year, month, day) =>
  new Date(year, month, day).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export function createCalendar({ monthLabel, prevButton, nextButton, dayGrid, status }, onSelect) {
  const today = new Date();
  const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate());
  const view = { year: today.getFullYear(), month: today.getMonth() };

  let blockedDates = new Set();
  let bookedDates = new Set();
  let selectedDate = null;
  let monthRequest = 0;

  const isSelectable = (iso) => iso >= todayIso && !blockedDates.has(iso);

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
      button.setAttribute('aria-label', `${longDate(view.year, view.month, day)}, unavailable`);
    } else if (bookedDates.has(iso)) {
      button.classList.add('is-booked');
      button.setAttribute('aria-label', `${longDate(view.year, view.month, day)}, has bookings; available times may be limited`);
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
      const { ok, data } = await getJson(`/api/calendar/month?month=${month}`);
      if (request !== monthRequest) return;

      if (!ok) throw new Error('Request failed');

      blockedDates = new Set(data.blockedDates ?? []);
      bookedDates = new Set(data.bookedDates ?? []);
      status.hidden = true;
    } catch {
      if (request !== monthRequest) return;

      blockedDates = new Set();
      bookedDates = new Set();
      status.textContent = 'Unavailable dates could not be loaded.';
      status.hidden = false;
    }

    renderMonth();
  }

  function select(iso) {
    selectedDate = iso;

    dayGrid.querySelectorAll('.calendar__day').forEach((button) => {
      const isSelected = button.dataset.date === iso;

      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });

    onSelect(iso);
  }

  async function changeMonth(step) {
    const next = new Date(view.year, view.month + step, 1);

    view.year = next.getFullYear();
    view.month = next.getMonth();

    await loadMonth();
  }

  async function show(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso < todayIso) {
      await loadMonth();
      return;
    }

    const [year, month] = iso.split('-').map(Number);

    view.year = year;
    view.month = month - 1;

    await loadMonth();
    if (isSelectable(iso)) select(iso);
  }

  dayGrid.addEventListener('click', ({ target }) => {
    const button = target.closest('.calendar__day');
    if (button && !button.disabled) select(button.dataset.date);
  });

  prevButton.addEventListener('click', () => changeMonth(-1));
  nextButton.addEventListener('click', () => changeMonth(1));

  return { load: loadMonth, show, select, isSelectable, todayIso };
}
