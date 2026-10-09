/* maintenance.html — standalone (no app shell). Retry reloads; config.js decides what shows next. */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const from = params.get('from') || '';
  // Only return to a page of this site (e.g. "app.html?page=fees"), never an outside URL.
  const safeFrom = /^[a-z0-9-]+\.html(?:[?#][^\s]*)?$/i.test(from) ? from : null;

  // Maintenance has ended and the visitor was sent here from a page: take them back to it.
  // Opened directly (no "from"), the page always shows, so it can be reviewed at its URL.
  if (!window.NexoraConfig?.maintenanceMode && safeFrom) {
    location.replace(safeFrom);
    return;
  }

  const btn = document.querySelector('[data-retry]');
  const status = document.getElementById('retry-status');

  btn.addEventListener('click', () => {
    if (btn.classList.contains('is-loading')) return;
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.setAttribute('aria-busy', 'true');
    btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>Checking…';
    status.textContent = 'Checking whether the service is available…';
    // A short pause so the loading state is visible before the browser starts reloading.
    setTimeout(() => window.location.reload(), 600);
  });
})();
