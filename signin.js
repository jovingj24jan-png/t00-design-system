/* S01 — staff sign-in. School comes from ?school= (demo fixture, default Northvale); text from i18n.js;
   credentials are checked by auth.js (demo only). First sign-in → S03, otherwise → S04.
   Shared branding, footer, language menu and password toggle come from auth-ui.js. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const auth = window.NexoraAuth;
  const { routes } = store;
  const $ = s => document.querySelector(s);

  const params = new URLSearchParams(location.search);
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

  const ui = window.NexoraAuthUI.mount({ onLanguageChange: renderDynamic });
  const { school, t, esc, icon } = ui;
  const paused = school.status === 'paused';
  const ssoAvailable = school.enterprise && school.ssoEnabled;
  const pwToggle = ui.bindPasswordToggle(toggleBtn, pwInput);

  function renderDynamic() {
    document.title = `${t('pageTitle')} · ${school.name}`;
    alertText.textContent = state.alertKey ? t(state.alertKey) : '';
    status.textContent = state.statusKey ? t(state.statusKey) : '';
    Object.entries(state.fieldErrors).forEach(([id, key]) => showFieldError(id, key));
    if (state.busy) ui.setLoading(submitBtn, 'signingIn');
    if (state.lockedUntil) tick();
    $('[data-demo-note]').textContent = t('demoNote');
  }

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
    [idInput, pwInput, remember, toggleBtn, ssoBtn].forEach(el => { el.disabled = !enabled; });
    submitBtn.dataset.lockedDisabled = String(!enabled);
    submitBtn.disabled = !enabled;
  }
  function setBusy(busy) {
    state.busy = busy;
    if (busy) setFormEnabled(false);
    ui.setLoading(submitBtn, busy ? 'signingIn' : null);
    if (!busy) setFormEnabled(!paused && !state.lockedUntil);
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
    pwToggle.hide();
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

  // Forgot password (S02): carry a typed email over so it doesn't have to be entered twice.
  $('[data-route="forgotPassword"]').addEventListener('click', () => {
    const value = idInput.value.trim();
    if (value.includes('@')) auth.recoveryFlow.save({ email: value, step: 1 });
  });

  /* ------------------------------------------------------------ Demo details (prototype only) */
  function renderDemo() {
    const accounts = store.users.filter(u => u.schoolId === school.id);
    $('[data-demo-accounts]').innerHTML = accounts.length
      ? accounts.map(u => `<li><span class="mono">${esc(u.email)}</span> · ${esc(u.role)}${u.firstLogin ? ' · first sign-in' : ''}</li>`).join('') + `<li>Password for every account: <span class="mono">${esc(auth.demoPassword)}</span> (unless you've reset it)</li>`
      : '<li>No password accounts at this school.</li>';
    $('[data-demo-schools]').innerHTML = `Demo schools: ${store.schools.map(s => s.id === school.id
      ? `<strong>${esc(s.name)}</strong>`
      : `<a class="auth-link" href="${routes.signIn({ school: s.id })}">${esc(s.name)}</a>`).join(' · ')} (Riverside: Enterprise with SSO. Meadowbrook: paused.)`;
  }

  /* ------------------------------------------------------------ Start */
  ssoWrap.hidden = !ssoAvailable;
  if (paused) { pausedBox.hidden = false; setFormEnabled(false); }
  renderDemo();
  renderDynamic();
  const lock = auth.lockState(school.id);
  if (!paused && lock.locked) startLockout(lock.lockedUntil);

  // Arriving from S02 after a reset (or "Back to sign in"): prefill the email, never the password.
  const handoff = auth.takeSignInHandoff();
  if (handoff?.email) idInput.value = handoff.email;
  if (handoff?.notice) window.NexoraToast?.show(t(handoff.notice), '', 'check-circle');
})();
