import { getJson } from './admin-api.js';
import { formatDate, formatPeso, statusSlug } from './format.js';

const API_BASE = '/api/admin/reports';
const SERVICES_API = '/api/admin/services';
const PAGE_URL = 'reports.html';

const elements = {
  title: document.getElementById('reportTitle'),
  filters: document.getElementById('reportFilters'),
  fromMonth: document.getElementById('fromMonth'),
  toMonth: document.getElementById('toMonth'),
  serviceSelect: document.getElementById('serviceSelect'),
  error: document.getElementById('reportError'),
  status: document.getElementById('reportStatus'),
  content: document.getElementById('reportContent'),
  stats: document.querySelectorAll('[data-stat]'),
  grid: document.getElementById('reportGrid'),
  menu: document.getElementById('reportMenu'),
  reportButton: document.querySelector('.nav-link--active[href="reports.html"]'),
  menuTemplate: document.getElementById('menuItemTemplate'),

  incomeBars: document.getElementById('incomeBars'),
  incomeStatus: document.getElementById('incomeStatus'),
  incomeTemplate: document.getElementById('incomeBarTemplate'),

  serviceSection: document.getElementById('serviceSection'),
  serviceBody: document.getElementById('serviceBody'),
  serviceTotals: document.querySelectorAll('[data-total]'),
  serviceTemplate: document.getElementById('serviceRowTemplate'),

  bookingSection: document.getElementById('bookingSection'),
  bookingWrap: document.getElementById('bookingWrap'),
  bookingBody: document.getElementById('bookingBody'),
  bookingStatus: document.getElementById('bookingStatus'),
  bookingTemplate: document.getElementById('bookingRowTemplate'),
};

const shortMonthFormat = new Intl.DateTimeFormat('en-US', { month: 'short' });
const longMonthFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

let services = [];
let latestRequest = 0;

const toMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const fromMonthKey = (key) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1);
};

function readFilters() {
  const params = new URLSearchParams(window.location.search);
  const today = new Date();

  return {
    from: params.get('from') || toMonthKey(new Date(today.getFullYear(), 0, 1)),
    to: params.get('to') || toMonthKey(today),
    serviceId: params.get('serviceId') || '',
  };
}

function currentFilters() {
  return {
    from: elements.fromMonth.value,
    to: elements.toMonth.value,
    serviceId: elements.serviceSelect.value,
  };
}

function toQuery({ from, to, serviceId }) {
  const params = new URLSearchParams({ from, to });
  if (serviceId) params.set('serviceId', serviceId);

  return params.toString();
}

function formatChartAmount(amount) {
  if (amount < 10000) return formatPeso(amount);

  const thousands = amount / 1000;
  return `₱${thousands.toLocaleString('en-PH', { maximumFractionDigits: 1 })}K`;
}

function showError(message) {
  elements.error.textContent = message;
  elements.error.hidden = false;
}

function updateMenu(filters) {
  const query = (serviceId) => toQuery({ ...filters, serviceId });

  elements.menu.querySelectorAll('.nav-submenu__link').forEach((link) => {
    const serviceId = link.dataset.serviceId;

    link.href = `${PAGE_URL}?${query(serviceId)}`;
    link.classList.toggle('nav-submenu__link--active', serviceId === filters.serviceId);
    if (serviceId === filters.serviceId) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function createMenuItem(service) {
  const item = elements.menuTemplate.content.firstElementChild.cloneNode(true);
  const link = item.querySelector('.nav-submenu__link');

  link.dataset.serviceId = service.id;
  link.textContent = service.name;

  return item;
}

function createServiceOption(service) {
  const option = document.createElement('option');
  option.value = service.id;
  option.textContent = service.name;
  return option;
}

async function loadServices() {
  try {
    services = await getJson(SERVICES_API);
  } catch (error) {
    console.error('Could not load services:', error);
    services = [];
  }

  elements.serviceSelect.append(...services.map(createServiceOption));
  elements.menu.append(...services.map(createMenuItem));
}

function renderSummary({ summary }) {
  elements.stats.forEach((element) => {
    element.textContent = formatPeso(summary[element.dataset.stat]);
  });
}

function createIncomeBar({ month, income }, highest, currentMonth, showYear) {
  const bar = elements.incomeTemplate.content.firstElementChild.cloneNode(true);
  const date = fromMonthKey(month);
  const label = showYear
    ? `${shortMonthFormat.format(date)} '${String(date.getFullYear()).slice(2)}`
    : shortMonthFormat.format(date);

  bar.style.setProperty('--percent', (income / highest) * 100);
  bar.classList.toggle('income-bar--current', month === currentMonth);
  bar.title = `${longMonthFormat.format(date)}: ${formatPeso(income)}`;

  bar.querySelector('.income-bar__value').textContent = income > 0 ? formatChartAmount(income) : '';
  bar.querySelector('.income-bar__month').textContent = label;

  return bar;
}

function renderIncome({ monthlyIncome }) {
  const highest = Math.max(...monthlyIncome.map((entry) => entry.income), 1);
  const currentMonth = toMonthKey(new Date());
  const showYear = monthlyIncome[0].month.slice(0, 4) !== monthlyIncome.at(-1).month.slice(0, 4);
  const hasIncome = monthlyIncome.some((entry) => entry.income > 0);

  elements.incomeBars.replaceChildren(
    ...monthlyIncome.map((entry) => createIncomeBar(entry, highest, currentMonth, showYear))
  );

  elements.incomeStatus.textContent = 'No payments received in this period.';
  elements.incomeStatus.hidden = hasIncome;
}

function createServiceRow(service, filters) {
  const row = elements.serviceTemplate.content.firstElementChild.cloneNode(true);
  const link = row.querySelector('.report-table__link');

  link.textContent = service.name;
  link.href = `${PAGE_URL}?${toQuery({ ...filters, serviceId: service.id })}`;

  row.querySelector('[data-field="bookings"]').textContent = service.bookings;
  row.querySelector('[data-field="bookingValue"]').textContent = formatPeso(service.bookingValue);
  row.querySelector('[data-field="received"]').textContent = formatPeso(service.received);
  row.querySelector('[data-field="outstanding"]').textContent = formatPeso(service.outstanding);

  return row;
}

function renderServices({ summary, services: rows }, filters) {
  elements.serviceBody.replaceChildren(...rows.map((service) => createServiceRow(service, filters)));

  elements.serviceTotals.forEach((cell) => {
    const value = summary[cell.dataset.total];
    cell.textContent = cell.dataset.total === 'bookings' ? value : formatPeso(value);
  });
}

function createBookingRow(booking) {
  const row = elements.bookingTemplate.content.firstElementChild.cloneNode(true);
  const field = (name) => row.querySelector(`[data-field="${name}"]`);
  const status = field('status');

  field('reference').textContent = `#${booking.reference}`;
  field('clientName').textContent = booking.clientName;
  field('eventDate').textContent = formatDate(booking.eventDate);
  field('bookingValue').textContent = formatPeso(booking.bookingValue);
  field('received').textContent = formatPeso(booking.received);
  field('outstanding').textContent = formatPeso(booking.outstanding);

  status.textContent = booking.status;
  status.classList.add(`pill--${statusSlug(booking.status)}`);

  return row;
}

function renderBookings({ bookings }) {
  const isEmpty = bookings.length === 0;

  elements.bookingBody.replaceChildren(...bookings.map(createBookingRow));
  elements.bookingWrap.hidden = isEmpty;
  elements.bookingStatus.textContent = 'No bookings found for this period.';
  elements.bookingStatus.hidden = !isEmpty;
}

function renderReport(report, filters) {
  const isService = report.service !== null;

  elements.title.textContent = isService ? report.service.name : 'Overview';
  document.title = `${isService ? report.service.name : 'Reports'} | BRB Studios Admin`;

  elements.grid.classList.toggle('report-grid--service', isService);
  elements.serviceSection.hidden = isService;
  elements.bookingSection.hidden = !isService;

  renderSummary(report);
  renderIncome(report);

  if (isService) renderBookings(report);
  else renderServices(report, filters);

  elements.status.hidden = true;
  elements.content.hidden = false;
}

async function loadReport() {
  const requestId = ++latestRequest;
  const filters = currentFilters();

  elements.error.hidden = true;
  elements.status.textContent = 'Loading report...';
  elements.status.hidden = false;

  try {
    const report = await getJson(`${API_BASE}?${toQuery(filters)}`);

    if (requestId !== latestRequest) return;

    renderReport(report, filters);
    updateMenu(filters);
    window.history.replaceState(null, '', `${PAGE_URL}?${toQuery(filters)}`);
  } catch (error) {
    if (requestId !== latestRequest) return;

    console.error('Could not load report:', error);
    elements.content.hidden = true;
    elements.status.hidden = true;
    showError(Object.values(error.fieldErrors ?? {})[0] || error.message);
  }
}

elements.filters.addEventListener('change', () => {
  const { from, to } = currentFilters();

  if (from && to) loadReport();
});

elements.filters.addEventListener('submit', (event) => event.preventDefault());

elements.reportButton.addEventListener('click', (event) => {
  event.preventDefault();
  const expanded = elements.reportButton.getAttribute('aria-expanded') === 'true';
  elements.reportButton.setAttribute('aria-expanded', String(!expanded));
  elements.menu.hidden = expanded;
  if (!expanded) elements.menu.scrollTo({ top: 0, behavior: 'smooth' });
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

async function init() {
  const filters = readFilters();

  elements.fromMonth.value = filters.from;
  elements.toMonth.value = filters.to;

  await loadServices();

  const isKnownService = services.some((service) => String(service.id) === filters.serviceId);
  elements.serviceSelect.value = isKnownService ? filters.serviceId : '';

  loadReport();
}

init();
