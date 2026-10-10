/* Shared UI for the signed-out pages (S01 sign-in, S02 password reset): icon sprite, branding
   panel, footer with the language menu, password show/hide, button loading and static
   translation. Usage: const ui = NexoraAuthUI.mount({ onLanguageChange }). */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const i18n = window.NexoraI18n;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  const SPRITE = `
    <svg xmlns="http://www.w3.org/2000/svg" hidden aria-hidden="true">
      <symbol id="i-eye" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></symbol>
      <symbol id="i-eye-off" viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></symbol>
      <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol>
      <symbol id="i-check-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 5-5"/></symbol>
      <symbol id="i-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></symbol>
      <symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></symbol>
      <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></symbol>
      <symbol id="i-chevron-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
      <symbol id="i-arrow-left" viewBox="0 0 24 24"><path d="M19 12H5M11 18l-6-6 6-6"/></symbol>
      <symbol id="i-alert" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></symbol>
      <symbol id="i-pause" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/></symbol>
      <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
      <symbol id="i-key" viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 9.2-9.2M17 6l3 3M14 9l2 2"/></symbol>
    </svg>`;

  const ART = `
    <svg class="auth__art" viewBox="0 0 320 210" aria-hidden="true" focusable="false">
      <circle class="art-sun" cx="262" cy="46" r="20"/>
      <path class="art-soft" d="M20 186h280" stroke-dasharray="2 7"/>
      <rect class="art-ln" x="40" y="150" width="80" height="34" rx="4"/>
      <rect class="art-ln" x="50" y="122" width="60" height="26" rx="4"/>
      <rect class="art-ln" x="58" y="100" width="44" height="20" rx="3"/>
      <rect class="art-ln" x="65" y="84" width="30" height="14" rx="3"/>
      <rect class="art-accent" x="71" y="72" width="18" height="10" rx="2"/>
      <path class="art-ln" d="M150 184h132M150 170h106M150 156h80M150 142h54M150 128h28"/>
      <path class="art-soft" d="M176 184v-4M202 184v-4M228 184v-4M254 184v-4M176 170v-4M202 170v-4M228 170v-4M176 156v-4M202 156v-4"/>
      <path class="art-ln" d="M268 184v-34"/>
      <path class="art-leaf" d="M268 160c-14-2-20-12-18-24 12 1 19 10 18 24zM268 168c12-4 20-14 18-26-12 2-18 12-18 26z"/>
    </svg>`;

  // Flags are visual only; the language name is always shown next to them.
  const FLAGS = {
    gb: '<svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect class="flag-blue" width="60" height="30"/><path class="flag-white-st" d="M0 0l60 30M60 0L0 30" stroke-width="6"/><path class="flag-red-st" d="M0 0l60 30M60 0L0 30" stroke-width="2"/><path class="flag-white-st" d="M30 0v30M0 15h60" stroke-width="10"/><path class="flag-red-st" d="M30 0v30M0 15h60" stroke-width="6"/></svg>',
    in: '<svg viewBox="0 0 30 20" preserveAspectRatio="none" aria-hidden="true"><rect class="flag-saffron" width="30" height="6.67"/><rect class="flag-white" y="6.67" width="30" height="6.67"/><rect class="flag-green" y="13.33" width="30" height="6.67"/><circle class="flag-navy-st" cx="15" cy="10" r="2.6" fill="none" stroke-width="0.8"/></svg>',
    ae: '<svg viewBox="0 0 30 20" preserveAspectRatio="none" aria-hidden="true"><rect class="flag-uae-green" x="8" width="22" height="6.67"/><rect class="flag-white" x="8" y="6.67" width="22" height="6.67"/><rect class="flag-black" x="8" y="13.33" width="22" height="6.67"/><rect class="flag-red" width="8" height="20"/></svg>'
  };

  const footerHtml = () => `
    <div class="select auth-lang" data-lang>
      <button class="select__trigger" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="lang-menu" data-lang-trigger>
        <span class="sr-only" data-i18n="language"></span>
        <span class="auth-lang__flag" data-lang-flag aria-hidden="true"></span>
        <span class="select__value" data-lang-name></span>
        ${icon('chevron-down', 'select__chev')}
      </button>
      <ul class="select__menu" id="lang-menu" role="listbox" tabindex="-1" data-lang-menu></ul>
    </div>
    <nav class="auth-foot__links" aria-label="Support" data-i18n-aria-label="supportLinks">
      <a class="auth-link" href="#" data-route="privacy" data-i18n="privacy"></a>
      <a class="auth-link" href="#" data-route="help" data-i18n="help"></a>
    </nav>`;

  function mount({ onLanguageChange = () => {} } = {}) {
    const params = new URLSearchParams(location.search);
    const school = store.schoolById(params.get('school')) || store.school;
    // Links keep the demo school (?school=) unless it's the default one.
    const withSchool = href => {
      if (school.id === store.school.id) return href;
      const url = new URL(href, location.href);
      url.searchParams.set('school', school.id);
      return url.pathname.split('/').pop() + url.search;
    };
    const t = (key, vars) => i18n.t(key, { school: school.name, ...vars });
    const toggles = [];

    document.body.insertAdjacentHTML('afterbegin', SPRITE);
    i18n.setLocale(i18n.locale());

    // Branding panel
    const brand = $('[data-auth-brand]');
    const initials = school.name.split(/\s+/).filter(w => /^[A-Za-z]/.test(w)).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    brand.innerHTML = `
      <div class="auth__school">
        <span class="auth__logo">${school.logo ? `<img src="${esc(school.logo)}" alt="" width="72" height="72">` : `<span class="auth__initials" aria-hidden="true">${esc(initials)}</span>`}</span>
        <p class="auth__school-name" id="school-name">${esc(school.name)}</p>
      </div>
      ${ART}
      <p class="auth__tagline"><span data-i18n="taglineStart"></span><span class="auth__tagline-accent" data-i18n="taglineAccent"></span></p>`;
    brand.setAttribute('aria-labelledby', 'school-name');

    // Footer + language menu (T00 select pattern)
    const foot = $('[data-auth-foot]');
    foot.innerHTML = footerHtml();
    const langRoot = $('[data-lang]', foot);
    const trigger = $('[data-lang-trigger]', foot);
    const menu = $('[data-lang-menu]', foot);
    let active = 0;

    function renderMenu() {
      const current = i18n.locale();
      const lang = i18n.language(current);
      $('[data-lang-flag]', foot).innerHTML = FLAGS[lang.flag];
      const name = $('[data-lang-name]', foot);
      name.textContent = lang.name;
      name.lang = lang.code;
      menu.setAttribute('aria-label', t('language'));
      menu.innerHTML = i18n.languages.map(l => `
        <li class="select__option" role="option" id="lang-${l.code}" data-code="${l.code}" aria-selected="${l.code === current}" lang="${l.code}" dir="${l.dir}">
          <span class="auth-lang__flag" aria-hidden="true">${FLAGS[l.flag]}</span>${esc(l.name)}${icon('check')}
        </li>`).join('');
      active = Math.max(0, i18n.languages.findIndex(l => l.code === current));
    }
    function setActive(i) {
      const options = $$('[role="option"]', menu);
      active = (i + options.length) % options.length;
      options.forEach((o, j) => o.classList.toggle('is-active', j === active));
      menu.setAttribute('aria-activedescendant', options[active].id);
    }
    const isOpen = () => langRoot.classList.contains('is-open');
    function open() {
      langRoot.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      setActive(active);
      menu.focus();
    }
    function close(focusTrigger = true) {
      if (!isOpen()) return;
      langRoot.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      menu.removeAttribute('aria-activedescendant');
      if (focusTrigger) trigger.focus();
    }
    function choose(code) {
      i18n.setLocale(code);
      applyStatic();
      onLanguageChange();
      close();
    }
    trigger.addEventListener('click', () => (isOpen() ? close() : open()));
    trigger.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); } });
    menu.addEventListener('click', e => { const o = e.target.closest('[role="option"]'); if (o) choose(o.dataset.code); });
    menu.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
      else if (e.key === 'End') { e.preventDefault(); setActive(-1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(i18n.languages[active].code); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Tab') close(false);
    });
    document.addEventListener('click', e => { if (!langRoot.contains(e.target)) close(false); });

    function applyStatic(root = document) {
      $$('[data-i18n]', root).forEach(el => { el.textContent = t(el.dataset.i18n); });
      $$('[data-i18n-placeholder]', root).forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
      $$('[data-i18n-aria-label]', root).forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel)));
      toggles.forEach(tg => tg.refresh());
      renderMenu();
    }

    // Show/hide password: the value is never cleared by toggling.
    function bindPasswordToggle(button, input) {
      const refresh = () => {
        const shown = input.type === 'text';
        button.setAttribute('aria-pressed', String(shown));
        button.setAttribute('aria-label', t(shown ? 'hidePassword' : 'showPassword'));
        button.innerHTML = icon(shown ? 'eye-off' : 'eye');
      };
      button.addEventListener('click', () => { input.type = input.type === 'password' ? 'text' : 'password'; refresh(); });
      const toggle = { refresh, hide: () => { input.type = 'password'; refresh(); } };
      toggles.push(toggle);
      refresh();
      return toggle;
    }

    // Loading state: spinner + translated label; `null` restores the button's own label key.
    function setLoading(button, labelKey) {
      const on = Boolean(labelKey);
      button.classList.toggle('is-loading', on);
      button.setAttribute('aria-busy', String(on));
      button.disabled = on || button.dataset.lockedDisabled === 'true';
      button.innerHTML = on
        ? `<span class="spinner" aria-hidden="true"></span><span>${esc(t(labelKey))}</span>`
        : `<span data-i18n="${button.dataset.label}">${esc(t(button.dataset.label))}</span>`;
      button.dataset.loadingKey = on ? labelKey : '';
    }

    $$('[data-route]').forEach(a => { a.href = withSchool(store.routes[a.dataset.route]); });
    applyStatic();

    return { school, t, esc, icon, applyStatic, bindPasswordToggle, setLoading, withSchool };
  }

  window.NexoraAuthUI = { mount };
})();
