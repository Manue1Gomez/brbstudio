import { bookingUrl, loadCustomer, logoutCustomer } from './session.js';
import { confirmLogout } from '../../shared/js/logout-confirmation.js';

const guestLinks = document.getElementById('guestLinks');
const memberLinks = document.getElementById('memberLinks');
const logoutButton = document.getElementById('siteHeaderLogoutButton');
const logoutStatus = document.getElementById('siteHeaderLogoutStatus');
const bookLinks = document.querySelectorAll('[data-book-link]');

async function showAccountLinks() {
  const customer = await loadCustomer();
  if (!customer) return;

  guestLinks.hidden = true;
  memberLinks.hidden = false;
  bookLinks.forEach((link) => link.setAttribute('href', bookingUrl(customer)));
}

async function handleLogout() {
  if (!await confirmLogout()) return;

  logoutButton.disabled = true;
  logoutStatus.hidden = true;
  logoutStatus.textContent = '';

  try {
    window.location.assign(await logoutCustomer());
  } catch (error) {
    logoutStatus.textContent = error instanceof Error
      ? error.message
      : 'Unable to log out. Please try again.';
    logoutStatus.hidden = false;
    logoutButton.disabled = false;
  }
}

logoutButton.addEventListener('click', handleLogout);
showAccountLinks();
