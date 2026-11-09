import { getJson } from './api.js';

const serviceList = document.getElementById('serviceList');
const serviceStatus = document.getElementById('serviceStatus');
const cardTemplate = document.getElementById('serviceCardTemplate');

function formatPrice(price) {
  const decimals = Number.isInteger(price) ? 0 : 2;

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price);
}

function buildCard(service) {
  const card = cardTemplate.content.firstElementChild.cloneNode(true);
  const image = card.querySelector('.service-card__image');

  card.querySelector('.service-card__name').textContent = service.name;
  card.querySelector('.service-card__description').textContent = service.description;
  card.querySelector('.service-card__price-value').textContent = formatPrice(service.price);

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
    const { ok, data } = await getJson('/api/services');

    if (!ok) {
      showStatus('Services could not be loaded. Please refresh the page.');
      return;
    }

    if (data.length === 0) {
      showStatus('No services are available right now.');
      return;
    }

    serviceList.replaceChildren(...data.map(buildCard));
    serviceStatus.hidden = true;
  } catch {
    showStatus('Unable to reach the server. Please check your connection and try again.');
  }
}

loadServices();
