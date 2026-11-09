import { bookingUrl, loadCustomer } from './session.js';

const guestLinks = document.getElementById('guestLinks');
const memberLinks = document.getElementById('memberLinks');
const bookLinks = document.querySelectorAll('[data-book-link]');

async function showAccountLinks() {
  const customer = await loadCustomer();
  if (!customer) return;

  guestLinks.hidden = true;
  memberLinks.hidden = false;
  bookLinks.forEach((link) => link.setAttribute('href', bookingUrl(customer)));
}

showAccountLinks();
