/* S01 — staff sign-in. School comes from ?school= (demo fixture, default Northvale); text from i18n.js;
   credentials are checked by auth.js (demo only). First sign-in → S03, otherwise → S04. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const auth = window.NexoraAuth;
  const i18n = window.NexoraI18n;
  const { routes } = store;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  const params = new URLSearchParams(location.search);
  const school = store.schoolById(params.get('school')) || store.school;
  const next = params.get('next') || '';
  // Only return to a page of this site, never an outside URL or the sign-in page itself.
  const safeNext = /^(?!signin\.html)[a-z0-9-]+\.html(?:[?#][^\s]*)?$/i.test(next) ? next : null;

  const form = $('[data-signin-form]');
  const idInput = $('#signin-id');
  const pwInput = $('#signin-password');
  const remember = form.elements.remember;
  const submitBtn = $('[data-submit]');
  const toggleBtn = $('[data-toggle-password]');
  const ssoWrap = $('[data-sso]');
  const ssoBtn = $('[data-sso-button]');
  const alertBox = $('[data-alert]');
  const alertText = $('[data-alert-text]');
  const lockBox = $('[data-lockout]');
  const lockTimer = $('[data-lockout-timer]');
  const pausedBox = $('[data-paused]');
  const status = $('[data-status]');

  // UI state kept as translation keys, so a language switch can re-render every message.
  const state = { busy: false, alertKey: null, statusKey: null, fieldErrors: {}, lockedUntil: 0, timer: null };
  const t = (key, vars) => i18n.t(key, { school: school.name, ...vars });
  const paused = school.status === 'paused';
  const ssoAvailable = school.enterprise && school.ssoEnabled;

  /* ------------------------------------------------------------ Flags (visual only; the name is always shown) */
  const FLAGS = {
    gb: '<svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect class="flag-blue" width="60" height="30"/><path class="flag-white-st" d="M0 0l60 30M60 0L0 30" stroke-width="6"/><path class="flag-red-st" d="M0 0l60 30M60 0L0 30" stroke-width="2"/><path class="flag-white-st" d="M30 0v30M0 15h60" stroke-width="10"/><path class="flag-red-st" d="M30 0v30M0 15h60" stroke-width="6"/></svg>',
    in: '<svg viewBox="0 0 30 20" preserveAspectRatio="none" aria-hidden="true"><rect class="flag-saffron" width="30" height="6.67"/><rect class="flag-white" y="6.67" width="30" height="6.67"/><rect class="flag-green" y="13.33" width="30" height="6.67"/><circle class="flag-navy-st" cx="15" cy="10" r="2.6" fill="none" stroke-width="0.8"/></svg>',
    ae: '<svg viewBox="0 0 30 20" preserveAspectRatio="none" aria-hidden="true"><rect class="flag-uae-green" x="8" width="22" height="6.67"/><rect class="flag-white" x="8" y="6.67" width="22" height="6.67"/><rect class="flag-black" x="8" y="13.33" width="22" height="6.67"/><rect class="flag-red" width="8" height="20"/></svg>'
  };

  /* ------------------------------------------------------------ School branding */
  function renderSchool() {
    $('[data-school-name]').textContent = school.name;
    const initials = school.name.split(/\s+/).filter(w => /^[A-Za-z]/.test(w)).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    $('[data-school-logo]').innerHTML = school.logo
      ? `<img src="${esc(school.logo)}" alt="" width="72" height="72">`
      : `<span class="auth__initials" aria-hidden="true">${esc(initials)}</span>`;
    $$('[data-route]').forEach(a => { a.href = routes[a.dataset.route]; });
    if (paused) pausedBox.hidden = false;
    ssoWrap.hidden = !ssoAvailable;
  }

  /* ------------------------------------------------------------ Translation */
  function applyLanguage() {
    $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    $$('[data-i18n-aria-label]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel)));
    document.title = `${t('pageTitle')} · ${school.name}`;
    toggleBtn.setAttribute('aria-label', t(pwInput.type === 'password' ? 'showPassword' : 'hidePassword'));
    alertText.textContent = state.alertKey ? t(state.alertKey) : '';
    status.textContent = state.statusKey ? t(state.statusKey) : '';
    Object.entries(state.fieldErrors).forEach(([id, key]) => showFieldError(id, key));
    if (state.busy) setBusyLabel();
    if (state.lockedUntil) tick();
    $('[data-demo-note]').textContent = t('demoNote');
    renderLanguageMenu();
  }

  /* ------------------------------------------------------------ Language menu (T00 select pattern) */
  const langRoot = $('[data-lang]');
  const langTrigger = $('[data-lang-trigger]');
  const langMenu = $('[data-lang-menu]');
  let activeLang = 0;

  function renderLanguageMenu() {
    const current = i18n.locale();
    const lang = i18n.language(current);
    $('[data-lang-flag]').innerHTML = FLAGS[lang.flag];
    const name = $('[data-lang-name]');
    name.textContent = lang.name;
    name.lang = lang.code;
    langMenu.setAttribute('aria-label', t('language'));
    langMenu.innerHTML = i18n.languages.map((l, i) => `
      <li class="select__option" role="option" id="lang-${l.code}" data-code="${l.code}" aria-selected="${l.code === current}" lang="${l.code}" dir="${l.dir}">
        <span class="auth-lang__flag" aria-hidden="true">${FLAGS[l.flag]}</span>${esc(l.name)}${icon('check')}
      </li>`).join('');
    activeLang = Math.max(0, i18n.languages.findIndex(l => l.code === current));
  }
  function setActiveLang(i) {
    const options = $$('[role="option"]', langMenu);
    activeLang = (i + options.length) % options.length;
    options.forEach((o, j) => o.classList.toggle('is-active', j === activeLang));
    langMenu.setAttribute('aria-activedescendant', options[activeLang].id);
  }
  const langOpen = () => langRoot.classList.contains('is-open');
  function openLang() {
    langRoot.classList.add('is-open');
    langTrigger.setAttribute('aria-expanded', 'true');
    setActiveLang(activeLang);
    langMenu.focus();
  }
  function closeLang(focusTrigger = true) {
    if (!langOpen()) return;
    langRoot.classList.remove('is-open');
    langTrigger.setAttribute('aria-expanded', 'false');
    langMenu.removeAttribute('aria-activedescendant');
    if (focusTrigger) langTrigger.focus();
  }
  function chooseLang(code) {
    i18n.setLocale(code);
    applyLanguage();
    closeLang();
  }
  langTrigger.addEventListener('click', () => (langOpen() ? closeLang() : openLang()));
  langTrigger.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openLang(); }
  });
  langMenu.addEventListener('click', e => { const o = e.target.closest('[role="option"]'); if (o) chooseLang(o.dataset.code); });
  langMenu.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveLang(activeLang + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveLang(activeLang - 1); }
    else if (e.key === 'Home') { e.preventDefault(); setActiveLang(0); }
    else if (e.key === 'End') { e.preventDefault(); setActiveLang(-1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseLang(i18n.languages[activeLang].code); }
    else if (e.key === 'Escape') { e.preventDefault(); closeLang(); }
    else if (e.key === 'Tab') closeLang(false);
  });
  document.addEventListener('click', e => { if (!langRoot.contains(e.target)) closeLang(false); });

  /* ------------------------------------------------------------ Password visibility */
  toggleBtn.addEventListener('click', () => {
    const show = pwInput.type === 'password';
    pwInput.type = show ? 'text' : 'password';
    toggleBtn.setAttribute('aria-pressed', String(show));
    toggleBtn.setAttribute('aria-label', t(show ? 'hidePassword' : 'showPassword'));
    toggleBtn.innerHTML = icon(show ? 'eye-off' : 'eye');
  });

  /* ------------------------------------------------------------ Messages */
  function showAlert(key) {
    state.alertKey = key;
    alertText.textContent = key ? t(key) : '';
    alertBox.hidden = !key;
  }
  function setStatus(key) {
    state.statusKey = key;
    status.textContent = key ? t(key) : '';
  }
  function showFieldError(id, key) {
    const input = document.getElementById(id);
    const hint = document.getElementById(`${id}-error`);
    if (key) { state.fieldErrors[id] = key; hint.innerHTML = `${icon('alert')}${esc(t(key))}`; } else delete state.fieldErrors[id];
    hint.hidden = !key;
    input.setAttribute('aria-invalid', String(Boolean(key)));
  }
  [idInput, pwInput].forEach(input => input.addEventListener('input', () => {
    if (state.fieldErrors[input.id] && input.value.trim()) showFieldError(input.id, null);
  }));

  /* ------------------------------------------------------------ Form enabled / busy */
  function setFormEnabled(enabled) {
    [idInput, pwInput, remember, toggleBtn].forEach(el => { el.disabled = !enabled; });
    submitBtn.disabled = !enabled;
    ssoBtn.disabled = !enabled;
  }
  function setBusyLabel() {
    submitBtn.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>${esc(t('signingIn'))}</span>`;
  }
  function setBusy(busy) {
    state.busy = busy;
    submitBtn.classList.toggle('is-loading', busy);
    submitBtn.setAttribute('aria-busy', String(busy));
    if (busy) { setBusyLabel(); setFormEnabled(false); }
    else { submitBtn.innerHTML = `<span data-i18n="signIn">${esc(t('signIn'))}</span>`; setFormEnabled(!paused && !state.lockedUntil); }
  }

  /* ------------------------------------------------------------ Lockout */
  const mmss = ms => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  function tick() {
    const left = state.lockedUntil - Date.now();
    if (left <= 0) { endLockout(); return; }
    // Digits stay left-to-right inside Arabic text.
    lockTimer.innerHTML = esc(t('tryAgainIn', { time: '\u0000' })).replace('\u0000', `<bdi dir="ltr" class="auth-alert__time">${mmss(left)}</bdi>`);
  }
  function startLockout(until) {
    showAlert(null);
    setStatus(null);
    state.lockedUntil = until;
    lockBox.hidden = false;
    setFormEnabled(false);
    clearInterval(state.timer); // one countdown at a time
    tick();
    state.timer = setInterval(tick, 1000);
  }
  function endLockout() {
    clearInterval(state.timer);
    state.timer = null;
    state.lockedUntil = 0;
    auth.lockState(school.id); // resets the failure count once the lockout has passed
    lockBox.hidden = true;
    setFormEnabled(!paused);
    setStatus('lockoutOver');
  }
  addEventListener('pagehide', () => clearInterval(state.timer));

  /* ------------------------------------------------------------ Submit */
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (state.busy || paused || state.lockedUntil) return;
    showAlert(null);
    setStatus(null);

    const missingId = !idInput.value.trim();
    const missingPw = !pwInput.value;
    showFieldError(idInput.id, missingId ? 'requiredIdentifier' : null);
    showFieldError(pwInput.id, missingPw ? 'requiredPassword' : null);
    if (missingId || missingPw) { (missingId ? idInput : pwInput).focus(); return; }

    setBusy(true);
    let result;
    try {
      result = await auth.signIn({ schoolId: school.id, identifier: idInput.value, password: pwInput.value });
    } catch {
      result = { ok: false, reason: 'error' };
    }

    if (result.ok) {
      store.session.set(true, { remember: remember.checked });
      store.setRole(result.user.role);
      // Stay in the loading state while the next page loads.
      location.replace(result.firstLogin ? routes.firstLogin : (safeNext || routes.landing));
      return;
    }

    setBusy(false);
    if (result.reason === 'locked') { pwInput.value = ''; startLockout(result.lockedUntil); return; }
    if (result.reason === 'paused') { pausedBox.hidden = false; setFormEnabled(false); return; }
    showAlert(result.reason === 'error' ? 'signInFailed' : 'incorrectCredentials');
    pwInput.value = '';
    pwInput.focus();
  });

  ssoBtn.addEventListener('click', async () => {
    if (state.busy || paused || state.lockedUntil || !ssoAvailable) return;
    showAlert(null);
    ssoBtn.classList.add('is-loading');
    ssoBtn.setAttribute('aria-busy', 'true');
    ssoBtn.disabled = true;
    const result = await auth.signInWithSso({ schoolId: school.id });
    ssoBtn.classList.remove('is-loading');
    ssoBtn.removeAttribute('aria-busy');
    ssoBtn.disabled = false;
    if (!result.ok) showAlert('ssoNotConnected');
  });

  /* ------------------------------------------------------------ Demo details (prototype only) */
  function renderDemo() {
    const accounts = store.users.filter(u => u.schoolId === school.id);
    $('[data-demo-accounts]').innerHTML = accounts.length
      ? accounts.map(u => `<li><span class="mono">${esc(u.email)}</span> · ${esc(u.role)}${u.firstLogin ? ' · first sign-in' : ''}</li>`).join('') + `<li>Password for every account: <span class="mono">${esc(auth.demoPassword)}</span></li>`
      : '<li>No password accounts at this school.</li>';
    $('[data-demo-schools]').innerHTML = `Demo schools: ${store.schools.map(s => s.id === school.id
      ? `<strong>${esc(s.name)}</strong>`
      : `<a class="auth-link" href="${routes.signIn({ school: s.id })}">${esc(s.name)}</a>`).join(' · ')} (Riverside: Enterprise with SSO. Meadowbrook: paused.)`;
  }

  /* ------------------------------------------------------------ Start */
  i18n.setLocale(i18n.locale());
  renderSchool();
  renderDemo();
  applyLanguage();
  if (paused) setFormEnabled(false);
  const lock = auth.lockState(school.id);
  if (!paused && lock.locked) startLockout(lock.lockedUntil);
})();
