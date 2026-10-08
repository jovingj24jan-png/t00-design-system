/* App shell for secondary pages (record, not found).
   Signed in: the same sidebar + mobile bar as design-system.html. Signed out: logo only. */
(() => {
  'use strict';

  const { routes, session } = window.NexoraStore;
  const dash = routes.dashboard;

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
    </svg>`;

  const NAV = [
    ['Foundations', [['dna', '01', 'Design DNA'], ['type', '02', 'Typography']]],
    ['Components', [['buttons', '03', 'Buttons'], ['forms', '04', 'Form elements'], ['cards', '05', 'Cards &amp; data'], ['tables', '06', 'Tables &amp; lists'], ['tabs', '07', 'Tabs &amp; filters'], ['overlays', '08', 'Modals &amp; drawers']]],
    ['Systems', [['states', '09', 'States'], ['responsive', '10', 'Responsive blueprint'], ['playground', '11', 'Playground'], ['motion', '12', 'Motion system'], ['tokens', '13', 'Token inspector']]]
  ];

  const sidebarHtml = () => `
    <aside class="sidebar" id="sidebar" aria-label="Design system navigation">
      <div class="sidebar__head">
        <a class="brand" href="${dash}">
          <img class="brand__logo" src="assets/logos/northvale-crest.png" alt="Northvale Academy" width="40" height="40">
          <span><span class="brand__name">Nexora</span><span class="brand__sub">Design system · v3.0</span></span>
        </a>
        <button class="btn btn--icon-ghost sidebar__close" type="button" data-nav-close aria-label="Close navigation"><svg class="icon"><use href="#i-x"/></svg></button>
      </div>
      <nav class="sidebar__scroll" aria-label="Sections">
        ${NAV.map(([label, links]) => `
          <div class="sidebar__group">
            <p class="sidebar__label">${label}</p>
            <ul>${links.map(([id, num, text]) => `<li><a class="nav-link" href="${dash}#${id}"><span class="nav-link__num">${num}</span>${text}</a></li>`).join('')}</ul>
          </div>`).join('')}
      </nav>
      <div class="sidebar__foot">
        <p class="tech-label tech-label--plain">Signed in · prototype session</p>
        <button class="btn btn--secondary btn--block" type="button" data-session="out">Sign out</button>
      </div>
    </aside>
    <div class="nav-backdrop" data-nav-close aria-hidden="true"></div>`;

  const mobilebarHtml = () => `
    <header class="mobilebar">
      <button class="btn btn--icon-ghost" type="button" id="nav-toggle" aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false"><svg class="icon"><use href="#i-menu"/></svg></button>
      <a class="brand" href="${dash}"><img class="brand__logo brand__logo--compact" src="assets/logos/northvale-crest.png" alt="Northvale Academy" width="36" height="36"><span class="brand__name">Nexora</span></a>
      <span class="avatar avatar--sm avatar--neutral" aria-hidden="true">JV</span>
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

  function mount() {
    const signedIn = session.isSignedIn();
    const main = document.getElementById('main');
    document.body.insertAdjacentHTML('afterbegin', ICONS);
    document.body.classList.add(signedIn ? 'is-shell' : 'is-minimal');

    if (signedIn) {
      main.insertAdjacentHTML('beforebegin', sidebarHtml());
      main.insertAdjacentHTML('afterbegin', mobilebarHtml());
      initNav();
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

  window.NexoraShell = { mount };
})();
