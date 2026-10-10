/* App shell for secondary pages (record, not found).
   Signed in: the same sidebar + mobile bar as design-system.html. Signed out: logo only. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const { routes, session } = store;
  const dash = routes.dashboard;
  const ds = routes.designSystem;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = n => n.replace(/^(Ms|Mrs|Mr)\.\s*/, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const currentPageKey = () => {
    if (/\/plans\.html$/.test(location.pathname)) return 'plans';
    if (/\/dashboard\.html$/.test(location.pathname)) return 'dashboard';
    return /\/(app|access-denied)\.html$/.test(location.pathname) ? new URLSearchParams(location.search).get('page') : null;
  };

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
      <symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></symbol>
      <symbol id="i-arrow-right" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
      <symbol id="i-layers" viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></symbol>
      <symbol id="i-calendar-check" viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M9 15l2 2 4-4"/></symbol>
      <symbol id="i-eye" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></symbol>
      <symbol id="i-message" viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/></symbol>
      <symbol id="i-image" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></symbol>
      <symbol id="i-user-plus" viewBox="0 0 24 24"><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6"/></symbol>
      <symbol id="i-wallet" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/><circle cx="16" cy="14.5" r="1"/></symbol>
      <symbol id="i-chart" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/></symbol>
      <symbol id="i-banknote" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/></symbol>
      <symbol id="i-alert-triangle" viewBox="0 0 24 24"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></symbol>
      <symbol id="i-alert-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></symbol>
      <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
      <symbol id="i-megaphone" viewBox="0 0 24 24"><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></symbol>
      <symbol id="i-siren" viewBox="0 0 24 24"><path d="M7 18v-6a5 5 0 0 1 10 0v6"/><path d="M5 21h14v-3H5zM12 2v2M4.2 5.2l1.4 1.4M19.8 5.2l-1.4 1.4"/></symbol>
      <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/></symbol>
      <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
      <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/></symbol>
      <symbol id="i-sliders" viewBox="0 0 24 24"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></symbol>
      <symbol id="i-inbox" viewBox="0 0 24 24"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></symbol>
      <symbol id="i-phone" viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></symbol>
      <symbol id="i-mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></symbol>
      <symbol id="i-trash" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/></symbol>
      <symbol id="i-more" viewBox="0 0 24 24"><path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3.2"/></symbol>
      <symbol id="i-filter" viewBox="0 0 24 24"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5z"/></symbol>
      <symbol id="i-shield-check" viewBox="0 0 24 24"><path d="M12 2.5 4.5 5.5v6c0 4.6 3.1 8.6 7.5 10 4.4-1.4 7.5-5.4 7.5-10v-6z"/><path d="m9 12 2 2 4-4"/></symbol>
      <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 2.5 4.5 5.5v6c0 4.6 3.1 8.6 7.5 10 4.4-1.4 7.5-5.4 7.5-10v-6z"/><path d="M12 8v4M12 15.5h.01"/></symbol>
      <symbol id="i-leaf" viewBox="0 0 24 24"><path d="M5 19c0-8 5-14 15-15 0 10-6 15-14 15"/><path d="M5 19c3-4 6-7 10-9"/></symbol>
      <symbol id="i-medical" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/></symbol>
      <symbol id="i-allergy" viewBox="0 0 24 24"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></symbol>
      <symbol id="i-list" viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke-width="2.2"/></symbol>
      <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></symbol>
      <symbol id="i-move" viewBox="0 0 24 24"><path d="M4 8h13M13 4l4 4-4 4M20 16H7M11 20l-4-4 4-4"/></symbol>
      <symbol id="i-pencil" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></symbol>
      <symbol id="i-user-minus" viewBox="0 0 24 24"><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 11h6"/></symbol>
      <symbol id="i-more-v" viewBox="0 0 24 24"><path d="M12 5h.01M12 12h.01M12 19h.01" stroke-width="3.2"/></symbol>
    </svg>`;

  const NAV = [
    ['Foundations', [['dna', '01', 'Design DNA'], ['type', '02', 'Typography']]],
    ['Components', [['buttons', '03', 'Buttons'], ['forms', '04', 'Form elements'], ['cards', '05', 'Cards &amp; data'], ['tables', '06', 'Tables &amp; lists'], ['tabs', '07', 'Tabs &amp; filters'], ['overlays', '08', 'Modals &amp; drawers']]],
    ['Systems', [['states', '09', 'States'], ['responsive', '10', 'Responsive blueprint'], ['playground', '11', 'Playground'], ['motion', '12', 'Motion system'], ['tokens', '13', 'Token inspector']]]
  ];

  // App pages, in sidebar order: every catalogue module, then Notifications and Plans.
  // Every page is listed; the guard decides what each role and plan can open.
  // `plans` and `setup` are their own pages; the rest open in app.html.
  const APP_PAGES = ['dashboard', 'children', ...store.moduleKeys, 'classes', 'notifications', 'settings', 'plans', 'setup'];
  const OWN_PAGES = { dashboard: { name: 'Dashboard', href: () => dash }, plans: { name: 'Plans &amp; upgrade', href: () => routes.plans() }, setup: { name: 'School setup', href: () => routes.setup } };

  function schoolGroupHtml(user) {
    const here = currentPageKey();
    const unread = store.unreadCount(user);
    const plan = store.currentPlan();
    return `
      <div class="sidebar__group">
        <p class="sidebar__label">School <span class="sidebar__plan">${esc(plan.name)} plan</span></p>
        <ul>${APP_PAGES.map((key, i) => {
          const own = OWN_PAGES[key];
          const name = own ? own.name : esc(store.pageByKey(key).name);
          const href = own ? own.href() : routes.page(key);
          const current = key === here;
          const locked = !own && !store.isEntitled(key, plan);
          if (key === 'setup' && !store.canManagePlan(user)) return '';
          const setupBadge = key === 'setup' && store.getSetup(store.school.id).status !== 'complete' ? '<span class="nav-link__flag">Not finished</span>' : '';
          const badge = key === 'notifications' ? `<span class="nav-link__badge" data-unread-badge${unread ? '' : ' hidden'}><span aria-hidden="true">${unread > 99 ? '99+' : unread}</span><span class="sr-only"> (${unread} unread)</span></span>` : '';
          const lock = locked ? `<svg class="icon nav-link__lock" aria-hidden="true"><use href="#i-lock"/></svg><span class="sr-only"> (not in your plan)</span>` : '';
          return `<li><a class="nav-link${current ? ' is-current' : ''}${locked ? ' is-locked' : ''}" href="${href}"${current ? ' aria-current="page"' : ''}><span class="nav-link__num">${String(i + 14).padStart(2, '0')}</span><span class="nav-link__text">${name}</span>${lock}${badge}${setupBadge}</a></li>`;
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
        <a class="brand" href="${dash}">
          <img class="brand__logo" src="assets/logos/northvale-crest.png" alt="Northvale Academy" width="40" height="40">
          <span><span class="brand__name">Nexora</span><span class="brand__sub">${esc(store.school.name)}</span></span>
        </a>
        <button class="btn btn--icon-ghost sidebar__close" type="button" data-nav-close aria-label="Close navigation"><svg class="icon"><use href="#i-x"/></svg></button>
      </div>
      <nav class="sidebar__scroll" aria-label="Sections">
        ${NAV.map(([label, links]) => `
          <div class="sidebar__group">
            <p class="sidebar__label">${label}</p>
            <ul>${links.map(([id, num, text]) => `<li><a class="nav-link" href="${ds}#${id}"><span class="nav-link__num">${num}</span>${text}</a></li>`).join('')}</ul>
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
      <a class="brand" href="${dash}"><img class="brand__logo brand__logo--compact" src="assets/logos/northvale-crest.png" alt="Northvale Academy" width="36" height="36"><span class="brand__name">Nexora</span></a>
      <span class="avatar avatar--sm avatar--neutral" role="img" aria-label="${esc(user.name)}, ${esc(user.role)}">${esc(initials(user.name))}</span>
    </header>`;

  const brandbarHtml = () => `
    <header class="nf-brandbar">
      <a class="brand" href="${dash}"><img class="brand__logo nf-brandbar__logo" src="assets/logos/northvale-crest.png" alt="Northvale Academy" width="56" height="56"><span class="brand__name">Nexora</span></a>
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

  // Re-draws the school links and role footer for the current role (used when a page switches
  // role in place instead of reloading).
  function refresh() {
    const user = store.currentUser();
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.querySelector('.sidebar__scroll .sidebar__group:last-child').outerHTML = schoolGroupHtml(user);
    sidebar.querySelector('.sidebar__foot').innerHTML = roleSwitchHtml(user);
    const avatar = document.querySelector('.mobilebar .avatar');
    if (avatar) { avatar.textContent = initials(user.name); avatar.setAttribute('aria-label', `${user.name}, ${user.role}`); }
    bindRoleSwitch();
  }

  let roleHandler = null;
  // Default: switching role re-runs the page guard on reload, so a page may become allowed or denied.
  // A page that passes onRoleChange updates itself in place (it must re-check access itself).
  function bindRoleSwitch() {
    document.querySelector('[data-demo-role]')?.addEventListener('change', e => {
      store.setRole(e.target.value);
      if (!roleHandler) { location.reload(); return; }
      const select = e.target.id;
      refresh();
      document.getElementById(select)?.focus();
      roleHandler(store.currentUser());
    });
  }

  // Sidebar "Notifications" badge follows the shared unread count.
  function updateUnreadBadge() {
    const el = document.querySelector('[data-unread-badge]');
    if (!el) return;
    const n = store.unreadCount(store.currentUser());
    el.hidden = !n;
    el.innerHTML = `<span aria-hidden="true">${n > 99 ? '99+' : n}</span><span class="sr-only"> (${n} unread)</span>`;
  }

  // topbar: false when the page puts the bell in its own header (the dashboard).
  function mount({ onRoleChange, topbar = true } = {}) {
    roleHandler = onRoleChange || null;
    const signedIn = session.isSignedIn();
    const main = document.getElementById('main');
    document.body.insertAdjacentHTML('afterbegin', ICONS);
    document.body.classList.add(signedIn ? 'is-shell' : 'is-minimal');

    if (signedIn) {
      const user = store.currentUser();
      main.insertAdjacentHTML('beforebegin', sidebarHtml(user));
      main.insertAdjacentHTML('afterbegin', mobilebarHtml(user));
      if (window.NexoraBell) {
        const bar = main.querySelector('.mobilebar');
        bar.insertBefore(window.NexoraBell.create(), bar.querySelector('.avatar'));
        if (topbar) {
          bar.insertAdjacentHTML('afterend', '<div class="topbar"></div>');
          main.querySelector('.topbar').appendChild(window.NexoraBell.create());
        }
      }
      let queued = false;
      store.subscribe(() => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; updateUnreadBadge(); }); } });
      initNav();
      window.NexoraConnectivity?.init();
      bindRoleSwitch();
    } else {
      main.insertAdjacentHTML('afterbegin', brandbarHtml());
    }

    // Prototype session switch (there is no real sign-in).
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-session]');
      if (!b) return;
      session.set(b.dataset.session === 'in');
      location.reload();
    });
    return signedIn;
  }

  window.NexoraShell = { mount, refresh, initials };
})();
