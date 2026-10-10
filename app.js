/* app.html?page=… — every school page goes through one guard:
   unknown page → not-found view; signed out → S01 sign-in; no permission → access-denied.html;
   module not in the school's plan → plan-restricted view at this same URL; else the page. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const { routes } = store;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const key = new URLSearchParams(location.search).get('page');
  const page = key ? store.pageByKey(key) : null;
  const main = document.getElementById('content');

  if (!page) {
    window.NexoraShell.mount();
    window.NexoraNotFound.render(main);
    return;
  }

  // Signed out: S01 sign-in, which brings the user back here afterwards.
  if (!store.session.isSignedIn()) {
    location.replace(routes.signIn({ next: `${location.pathname.split('/').pop()}${location.search}` }));
    return;
  }

  const user = store.currentUser();
  if (!store.canAccess(user, key)) {
    // replace() so Back does not bounce the user into the same redirect again.
    location.replace(routes.denied(key));
    return;
  }

  window.NexoraShell.mount();
  // Entitlement is read fresh on every load, so after an upgrade the same URL shows the module.
  if (!store.isEntitled(key)) {
    window.NexoraPlanGate.render(main, user, key);
    return;
  }
  document.title = `${page.name} · Nexora`;
  main.classList.add('record-page');
  if (window.NexoraNotifications?.render(key, main, user)) { /* notification centre / S63 */ }
  else if (window.NexoraClasses?.render(key, main, user)) { /* S17 classes */ }
  else if (key === 'settings') renderSettings();
  else if (window.NexoraFamilies?.render(key, main, user)) { /* S15 families, S16 family detail */ }
  else if (window.NexoraEnrol?.render(key, main, user)) { /* S14 enrol, S09 waitlist, S18 rosters */ }
  else if (window.NexoraChildren?.render(key, main, user)) { /* S12 children, S31 compose */ }
  else if (!window.NexoraModules?.render(key, main, user)) renderPage();

  function renderPage() {
    main.innerHTML = `
      <article class="panel record" aria-labelledby="page-title">
        <header class="panel__head">
          <span class="panel__num">${esc(page.name.slice(0, 2).toUpperCase())}<i class="marker" aria-hidden="true"></i></span>
          <div><h1 class="panel__title" id="page-title">${esc(page.name)}</h1><p class="panel__sub">${esc(page.summary)}</p></div>
          <span class="tech-label">Page / ${esc(page.name)}</span>
        </header>
        <dl class="token-sheet">
          <div><dt>Signed in as</dt><dd>${esc(user.name)} · ${esc(user.role)}</dd></div>
          <div><dt>Who can open</dt><dd>${page.roles.map(esc).join(', ')}</dd></div>
        </dl>
        <div class="well"><span class="tech-label">Prototype page</span><p class="ts-small" style="margin-top:var(--space-2)">This page exists to demonstrate role permissions. Its content is not built yet.</p></div>
        <div class="nf__actions"><a class="btn btn--primary" href="${routes.dashboard}">Back to dashboard</a><a class="btn btn--secondary" href="${routes.page('notifications')}">Notifications</a></div>
      </article>`;
  }

  // S58 Settings — reads the same settings record the S05 setup writes.
  function renderSettings() {
    const s = store.getSettings(store.school.id);
    const setup = store.getSetup(store.school.id);
    const days = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
    const langs = { en: 'English', ta: 'தமிழ் (Tamil)', ar: 'العربية (Arabic)' };
    const date = d => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
    const time = t => {
      if (!t) return '';
      if (s.preferences.timeFormat === '24h') return t;
      const [h, m] = t.split(':').map(Number);
      return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
    };
    const row = (label, value) => `<div><dt>${esc(label)}</dt><dd>${value ? esc(value) : '<span class="settings-missing">Not set</span>'}</dd></div>`;
    const group = (title, rows) => `<section class="settings-group"><h2 class="settings-group__title">${esc(title)}</h2><dl class="token-sheet">${rows}</dl></section>`;
    const statusText = { complete: 'Complete', 'in-progress': `In progress · step ${setup.currentStep} of 7`, 'not-started': 'Not started' }[setup.status];
    main.innerHTML = `
      <article class="panel record school-page" aria-labelledby="page-title">
        <header class="panel__head">
          <span class="panel__num">S58<i class="marker" aria-hidden="true"></i></span>
          <div><h1 class="panel__title" id="page-title">Settings</h1><p class="panel__sub">${esc(page.summary)}</p></div>
          <span class="tech-label">Page / Settings</span>
        </header>
        ${group('School', row('Name', s.profile.name) + row('Contact email', s.profile.email) + row('Phone', s.profile.phone) + row('Address', s.profile.address))}
        ${group('Academic year', row('Name', s.academicYear.name) + row('Dates', s.academicYear.start && s.academicYear.end ? `${date(s.academicYear.start)} – ${date(s.academicYear.end)}` : ''))}
        ${group('School hours', row('Hours', s.hours.open && s.hours.close ? `${time(s.hours.open)} – ${time(s.hours.close)}` : '') + row('School days', s.hours.days.map(d => days[d]).join(', ')))}
        ${group('Preferences', row('Language', langs[s.preferences.language]) + row('Time format', s.preferences.timeFormat === '24h' ? '24-hour' : '12-hour'))}
        <div class="well"><span class="tech-label">School setup</span><p class="ts-small" style="margin-top:var(--space-2)">${esc(statusText)}${s.updatedAt ? ` · last saved ${esc(new Date(s.updatedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))}` : ''}. Editing here comes later; for now, change these details in school setup.</p></div>
        <div class="nf__actions"><a class="btn btn--primary" href="${routes.setup}${setup.status === 'complete' ? '#step-7' : ''}">${setup.status === 'complete' ? 'Review school setup' : 'Continue school setup'}</a><a class="btn btn--secondary" href="${routes.dashboard}">Back to dashboard</a></div>
      </article>`;
  }
})();
