import { loadCustomer, logoutCustomer } from './session.js';
import { confirmLogout } from '../../shared/js/logout-confirmation.js';

const LOGIN_PAGE = 'login.html';

const sidebar = document.getElementById('accountSidebar');
const sidebarToggle = document.getElementById('accountSidebarToggle');
const siteHeader = document.querySelector('.account-site-header');

if (sidebar && sidebarToggle && siteHeader) {
  const mobileViewport = window.matchMedia('(max-width: 56rem)');

  function updateHeaderOffset() {
    const headerHeight = siteHeader.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--account-header-height', `${headerHeight}px`);
  }

  function setSidebarCollapsed(collapsed) {
    document.body.classList.toggle('account-layout--sidebar-collapsed', collapsed);
    sidebar.inert = collapsed;
    sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
    sidebarToggle.setAttribute(
      'aria-label',
      collapsed ? 'Show customer navigation' : 'Hide customer navigation'
    );

    if (collapsed && sidebar.contains(document.activeElement)) sidebarToggle.focus();
  }

  sidebarToggle.addEventListener('click', () => {
    setSidebarCollapsed(!document.body.classList.contains('account-layout--sidebar-collapsed'));
  });

  mobileViewport.addEventListener('change', (event) => setSidebarCollapsed(event.matches));

  document.addEventListener('keydown', (event) => {
    if (
      event.key === 'Escape' &&
      !document.body.classList.contains('account-layout--sidebar-collapsed')
    ) {
      setSidebarCollapsed(true);
    }
  });

  updateHeaderOffset();
  if ('ResizeObserver' in window) {
    new ResizeObserver(updateHeaderOffset).observe(siteHeader);
  } else {
    window.addEventListener('resize', updateHeaderOffset);
  }
  setSidebarCollapsed(mobileViewport.matches);
}

export async function startAccountPage() {
  const customer = await loadCustomer();

  if (!customer) {
    window.location.replace(LOGIN_PAGE);
    return null;
  }

  document.getElementById('accountName').textContent = `${customer.firstName} ${customer.lastName}`;
  document.getElementById('logoutButton').addEventListener('click', logout);

  return customer;
}

async function logout({ currentTarget }) {
  if (!await confirmLogout()) return;

  currentTarget.disabled = true;

  try {
    window.location.assign(await logoutCustomer());
  } catch {
    currentTarget.disabled = false;
  }
}
