import { getJson } from './api.js';

const BOOKING_PAGE = 'book-service.html';
const LOGIN_PAGE = 'login.html';

let pendingCustomer;

export function loadCustomer() {
  pendingCustomer ??= getJson('/api/auth/me')
    .then(({ ok, data }) => (ok ? data.customer : null))
    .catch(() => null);

  return pendingCustomer;
}

export function bookingUrl(customer, query = {}) {
  if (!customer) return LOGIN_PAGE;

  const search = new URLSearchParams(query).toString();
  return search ? `${BOOKING_PAGE}?${search}` : BOOKING_PAGE;
}
