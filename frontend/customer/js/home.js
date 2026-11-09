import { getJson } from './api.js';
import { bookingUrl, loadCustomer } from './session.js';

const header = document.getElementById('siteHeader');
const serviceList = document.getElementById('serviceList');
const serviceStatus = document.getElementById('serviceStatus');
const cardTemplate = document.getElementById('serviceCardTemplate');
const sectionLinks = document.querySelectorAll('[data-section]');
const aboutSection = document.getElementById('about');
const contactSection = document.getElementById('contact');

function buildCard(service, customer) {
  const card = cardTemplate.content.firstElementChild.cloneNode(true);
  const image = card.querySelector('.service-card__image');

  card.querySelector('.service-card__name').textContent = service.name;
  card.querySelector('.service-card__description').textContent = service.description;
  card.querySelector('.service-card__book').setAttribute('href', bookingUrl(customer, { service: service.id }));

  if (service.imageUrl) {
    image.src = service.imageUrl;
    image.alt = service.name;
  } else {
    image.remove();
  }

  return card;
}

function showStatus(text) {
  serviceStatus.textContent = text;
  serviceStatus.hidden = false;
}

async function loadServices() {
  try {
    const [{ ok, data }, customer] = await Promise.all([getJson('/api/services'), loadCustomer()]);

    if (!ok) {
      showStatus('Services could not be loaded. Please refresh the page.');
      return;
    }

    if (data.length === 0) {
      showStatus('No services are available right now.');
      return;
    }

    serviceList.replaceChildren(...data.map((service) => buildCard(service, customer)));
    serviceStatus.hidden = true;
  } catch {
    showStatus('Unable to reach the server. Please check your connection and try again.');
  }
}

function findCurrentSection() {
  const reachedBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
  const threshold = header.offsetHeight + window.innerHeight * 0.3;

  if (reachedBottom || contactSection.getBoundingClientRect().top <= threshold) return 'contact';
  if (aboutSection.getBoundingClientRect().top <= threshold) return 'about';
  return 'home';
}

function highlightCurrentSection() {
  const current = findCurrentSection();

  sectionLinks.forEach((link) => {
    link.classList.toggle('site-header__link--current', link.dataset.section === current);
  });
}

window.addEventListener('scroll', highlightCurrentSection, { passive: true });
window.addEventListener('resize', highlightCurrentSection);

highlightCurrentSection();
loadServices();
