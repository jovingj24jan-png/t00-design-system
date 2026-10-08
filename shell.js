/* App shell for secondary pages (record, not found).
   Signed in: the same sidebar + mobile bar as design-system.html. Signed out: logo only. */
(() => {
  'use strict';

  const store = window.MontessoriStore;
  const { routes, session } = store;
  const dash = routes.dashboard;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = n => n.replace(/^(Ms|Mrs|Mr)\.\s*/, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const currentPageKey = () => (/\/(app|access-denied)\.html$/.test(location.pathname) ? new URLSearchParams(location.search).get('page') : null);

  const ICONS = `
    <svg xmlns="http://www.w3.org/2000/svg" hidden aria-hidden="true">
      <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h10"/></symbol>
      <symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></symbol>
      <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></symbol>
      <symbol id="i-chevron-right" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></symbol>
      <symbol id="i-arrow-left" viewBox="0 0 24 24"><path d="M19 12H5M11 18l-6-6 6-6"/></symbol>
      <symbol id="i-home" viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></symbol>
      <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></symbol>
      <symbol id="i-book" viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/></symbol>
      <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></symbol>
      <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol>
      <symbol id="i-check-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 5-5"/></symbol>
      <symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></symbol>
      <symbol id="i-shield-lock" viewBox="0 0 24 24"><path d="M12 2.5 4.5 5.5v6c0 4.6 3.1 8.6 7.5 10 4.4-1.4 7.5-5.4 7.5-10v-6z"/><rect x="9" y="11" width="6" height="5" rx="1"/><path d="M10.2 11V9.6a1.8 1.8 0 0 1 3.6 0V11"/></symbol>
      <symbol id="i-grid" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></symbol>
    </svg>`;

  const NAV = [
    ['Foundations', [['dna', '01', 'Design DNA'], ['type', '02', 'Typography']]],
    ['Components', [['buttons', '03', 'Buttons'], ['forms', '04', 'Form Elements'], ['cards', '05', 'Cards &amp; Data'], ['tables', '06', 'Tables &amp; Lists'], ['tabs', '07', 'Tabs &amp; Filters'], ['overlays', '08', 'Modals &amp; Drawers']]],
    ['Systems', [['states', '09', 'States'], ['responsive', '10', 'Responsive Blueprint'], ['playground', '11', 'Interactive Playground'], ['motion', '12', 'Motion System'], ['tokens', '13', 'Token Inspector']]]
  ];

  // App pages, in sidebar order. Every page is listed; the guard decides what each role can open.
  const APP_PAGES = ['classroom-tracker', 'reports', 'payroll', 'safeguarding', 'fees', 'notifications'];

  function schoolGroupHtml(user) {
    const here = currentPageKey();
    const unread = store.notificationsFor(user.role).filter(n => !n.read).length;
    return `
      <div class="sidebar__group">
        <p class="sidebar__label">School</p>
        <ul>${APP_PAGES.map((key, i) => {
          const page = store.pageByKey(key);
          const current = key === here;
          const badge = key === 'notifications' && unread ? `<span class="nav-link__badge" aria-label="${unread} unread">${unread}</span>` : '';
          return `<li><a class="nav-link${current ? ' is-current' : ''}" href="${routes.page(key)}"${current ? ' aria-current="page"' : ''}><span class="nav-link__num">${String(i + 14).padStart(2, '0')}</span>${esc(page.name)}${badge}</a></li>`;
        }).join('')}</ul>
      </div>`;
  }

  function roleSwitchHtml(user) {
    return `
      <div class="field">
        <label class="field__label" for="demo-role">Demo role <span class="field__extra">Prototype</span></label>
        <select class="input" id="demo-role" data-demo-role>
          ${store.roles.map(r => `<option value="${esc(r)}"${r === user.role ? ' selected' : ''}>${esc(r)}</option>`).join('')}
        </select>
      </div>
      <p class="tech-label tech-label--plain">Signed in as ${esc(user.name)}</p>
      <button class="btn btn--secondary btn--block" type="button" data-session="out">Sign out</button>`;
  }

  const sidebarHtml = user => `
    <aside class="sidebar" id="sidebar" aria-label="Design system navigation">
      <div class="sidebar__head">
        <a class="brand" href="${dash}" aria-label="Montessori, learning with wonder: design system home">
          <span data-logo="lockup"></span>
        </a>
        <button class="btn btn--icon-ghost sidebar__close" type="button" data-nav-close aria-label="Close navigation"><svg class="icon"><use href="#i-x"/></svg></button>
      </div>
      <nav class="sidebar__scroll" aria-label="Sections">
        ${NAV.map(([label, links]) => `
          <div class="sidebar__group">
            <p class="sidebar__label">${label}</p>
            <ul>${links.map(([id, num, text]) => `<li><a class="nav-link" href="${dash}#${id}"><span class="nav-link__num">${num}</span>${text}</a></li>`).join('')}</ul>
          </div>`).join('')}
        ${schoolGroupHtml(user)}
      </nav>
      <div class="sidebar__foot">
        ${roleSwitchHtml(user)}
      </div>
    </aside>
    <div class="nav-backdrop" data-nav-close aria-hidden="true"></div>`;

  const mobilebarHtml = user => `
    <header class="mobilebar">
      <button class="btn btn--icon-ghost" type="button" id="nav-toggle" aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false"><svg class="icon"><use href="#i-menu"/></svg></button>
      <a class="brand" href="${dash}" aria-label="Montessori: design system home"><span data-logo="lockup" data-tagline="false"></span></a>
      <span class="avatar avatar--sm avatar--neutral" role="img" aria-label="${esc(user.name)}, ${esc(user.role)}">${esc(initials(user.name))}</span>
    </header>`;

  const brandbarHtml = () => `
    <header class="nf-brandbar">
      <a class="brand nf-brandbar__brand" href="${dash}" aria-label="Montessori, learning with wonder: design system home"><span data-logo="lockup"></span></a>
    </header>`;

  // Same drawer behaviour as the design-system page below 1024px.
  function initNav() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('nav-toggle');
    const backdrop = document.querySelector('.nav-backdrop');
    const main = document.getElementById('main');
    const desktop = matchMedia('(min-width: 1024px)');
    let open = false;

    function setOpen(value, restore = true) {
      if (open === value) return;
      open = value;
      sidebar.classList.toggle('is-open', value);
      backdrop.classList.toggle('is-visible', value);
      toggle.setAttribute('aria-expanded', String(value));
      main.inert = value;
      document.documentElement.style.overflow = value ? 'hidden' : '';
      if (value) {
        sidebar.setAttribute('role', 'dialog');
        sidebar.setAttribute('aria-modal', 'true');
        requestAnimationFrame(() => sidebar.querySelector('.nav-link').focus());
      } else {
        sidebar.removeAttribute('role');
        sidebar.removeAttribute('aria-modal');
        if (restore) toggle.focus();
      }
    }
    toggle.addEventListener('click', () => setOpen(true));
    document.querySelectorAll('[data-nav-close]').forEach(el => el.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) setOpen(false); });
    desktop.addEventListener('change', e => { if (e.matches) setOpen(false, false); });
  }

  function mount() {
    const signedIn = session.isSignedIn();
    const main = document.getElementById('main');
    document.body.insertAdjacentHTML('afterbegin', ICONS);
    document.body.classList.add(signedIn ? 'is-shell' : 'is-minimal');

    if (signedIn) {
      const user = store.currentUser();
      main.insertAdjacentHTML('beforebegin', sidebarHtml(user));
      main.insertAdjacentHTML('afterbegin', mobilebarHtml(user));
      initNav();
      // Switching role re-runs the page guard, so a page may become allowed or denied.
      document.querySelector('[data-demo-role]').addEventListener('change', e => {
        store.setRole(e.target.value);
        location.reload();
      });
    } else {
      main.insertAdjacentHTML('afterbegin', brandbarHtml());
    }

    window.MontessoriLogo?.render();

    // Prototype session switch (there is no real sign-in).
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-session]');
      if (!b) return;
      session.set(b.dataset.session === 'in');
      location.reload();
    });
    return signedIn;
  }

  window.MontessoriShell = { mount, initials };
})();
