import { getJson, postJson } from './api.js';

const BOOKING_PAGE = 'book-service.html';

const guestLinks = document.getElementById('guestLinks');
const memberLinks = document.getElementById('memberLinks');
const logoutButton = document.getElementById('logoutButton');
const bookLinks = document.querySelectorAll('[data-book-link]');
const guestOnlyElements = document.querySelectorAll('[data-guest-only]');
const memberOnlyElements = document.querySelectorAll('[data-member-only]');

function showMemberView() {
  guestLinks.hidden = true;
  memberLinks.hidden = false;
  guestOnlyElements.forEach((element) => (element.hidden = true));
  memberOnlyElements.forEach((element) => (element.hidden = false));
  bookLinks.forEach((link) => link.setAttribute('href', BOOKING_PAGE));
}

async function loadSession() {
  const response = await getJson('/api/auth/me').catch(() => null);
  if (response?.ok) showMemberView();
}

async function logout() {
  logoutButton.disabled = true;

  try {
    const { ok, data } = await postJson('/api/auth/logout', {});

    if (ok) {
      window.location.assign(data.redirectTo);
      return;
    }
  } catch {
    logoutButton.disabled = false;
    return;
  }

  logoutButton.disabled = false;
}

logoutButton.addEventListener('click', logout);
loadSession();
