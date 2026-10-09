/* S02 — forgot / reset password, three steps on one page:
   1 find your account → 2 check your email → 3 set a new password → back to S01.
   Recovery requests, the demo email link and the reset itself go through auth.js (mock only).
   The reset token stays in memory on this page; passwords are never stored or logged. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const auth = window.NexoraAuth;
  const { routes } = store;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const steps = { 1: $('[data-step="1"]'), 2: $('[data-step="2"]'), 3: $('[data-step="3"]') };
  const emailInput = $('#rs-email');
  const sendBtn = $('[data-send]');
  const openBtn = $('[data-open-link]');
  const resendBtn = $('[data-resend]');
  const saveBtn = $('[data-save]');
  const newInput = $('#rs-new');
  const confirmInput = $('#rs-confirm');
  const status = $('[data-status]');
  const linkInvalid = $('[data-link-invalid]');

  const saved = auth.recoveryFlow.read() || {};
  // Messages are kept as translation keys so a language switch re-renders them.
  const state = {
    step: 1, depth: 0, busy: false,
    email: saved.email || '', resendAt: saved.resendAt || 0,
    token: null, alerts: {}, emailError: null, statusKey: null, timer: null
  };

  const ui = window.NexoraAuthUI.mount({ onLanguageChange: renderDynamic });
  const { t, esc, icon, school } = ui;
  const toggles = [ui.bindPasswordToggle($('[data-toggle="rs-new"]'), newInput), ui.bindPasswordToggle($('[data-toggle="rs-confirm"]'), confirmInput)];

  /* ------------------------------------------------------------ Messages */
  function showAlert(step, key) {
    state.alerts[step] = key;
    const box = $(`[data-alert="${step}"]`);
    $('[data-alert-text]', box).textContent = key ? t(key) : '';
    box.hidden = !key;
  }
  function setEmailError(key) {
    state.emailError = key;
    const hint = $('#rs-email-error');
    hint.innerHTML = key ? `${icon('alert')}${esc(t(key))}` : '';
    hint.hidden = !key;
    emailInput.setAttribute('aria-invalid', String(Boolean(key)));
  }
  function setStatus(key) {
    state.statusKey = key;
    status.textContent = key ? t(key) : '';
  }

  function renderDynamic() {
    document.title = `${t('resetPageTitle')} · ${school.name}`;
    $('[data-step-label]').textContent = t('stepOf', { n: state.step });
    // The address the user typed, kept left-to-right inside Arabic text.
    $('[data-s2-text]').innerHTML = esc(t('s2Text', { email: '\u0000' })).replace('\u0000', `<bdi dir="ltr" class="rs-email">${esc(state.email)}</bdi>`);
    Object.entries(state.alerts).forEach(([step, key]) => showAlert(step, key));
    setEmailError(state.emailError);
    setStatus(state.statusKey);
    [sendBtn, openBtn, saveBtn, resendBtn].forEach(b => { if (b.dataset.loadingKey) ui.setLoading(b, b.dataset.loadingKey); });
    renderResend();
    evaluatePassword();
  }

  /* ------------------------------------------------------------ Steps + history */
  function persist() {
    // Step 3 needs the in-memory token, so a reload comes back to step 2 at most.
    auth.recoveryFlow.save({ email: state.email, step: Math.min(state.step, 2), resendAt: state.resendAt });
  }

  function showStep(n, { push = true, focus = true } = {}) {
    if (n === 3 && state.step !== 3 && !state.token) n = 2;
    if (state.step === 3 && n !== 3) leaveStep3();
    if (state.step === 2 && n !== 2) clearInterval(state.timer);
    state.step = n;
    Object.entries(steps).forEach(([k, el]) => { el.hidden = Number(k) !== n; });
    $$('[data-step-seg]').forEach(seg => {
      const k = Number(seg.dataset.stepSeg);
      seg.className = k < n ? 'is-done' : k === n ? 'is-current' : '';
    });
    if (push) { history.pushState({ step: n }, '', `#step-${n}`); state.depth += 1; }
    else history.replaceState({ step: n }, '', `#step-${n}`);
    if (n === 2) startResendTimer();
    if (n === 3) enterStep3();
    persist();
    renderDynamic();
    if (focus) $('.auth__title', steps[n]).focus();
  }

  function goBack() {
    // Use the browser history when this page added it, so the Back button and gesture agree.
    if (state.depth > 0) history.back();
    else showStep(Math.max(1, state.step - 1), { push: false });
  }
  addEventListener('popstate', e => {
    state.depth = Math.max(0, state.depth - 1);
    // A hand-edited #step-N carries no state: read the hash (step 3 still needs a link).
    const fromHash = Number((location.hash.match(/^#step-([123])$/) || [])[1]);
    const n = e.state?.step || fromHash || 1;
    showStep(n === 2 && !state.email ? 1 : n, { push: false });
  });
  $$('[data-back]').forEach(b => b.addEventListener('click', goBack));

  /* ------------------------------------------------------------ Step 1 */
  $('[data-back-signin]').href = ui.withSchool(routes.signIn());
  $('[data-back-signin]').addEventListener('click', () => {
    const email = emailInput.value.trim();
    if (email) auth.handOffToSignIn({ email });
  });
  emailInput.addEventListener('input', () => { if (state.emailError && auth.EMAIL_RE.test(emailInput.value.trim())) setEmailError(null); });

  steps[1].addEventListener('submit', async e => {
    e.preventDefault();
    if (state.busy) return;
    showAlert(1, null);
    const email = emailInput.value.trim();
    if (!email) { setEmailError('requiredEmail'); emailInput.focus(); return; }
    if (!auth.EMAIL_RE.test(email)) { setEmailError('invalidEmail'); emailInput.focus(); return; }
    setEmailError(null);

    // Same address and a link sent moments ago: show step 2 again rather than a new request.
    if (email.toLowerCase() === state.email.toLowerCase() && state.resendAt > Date.now()) { showStep(2); return; }

    state.busy = true;
    ui.setLoading(sendBtn, 'sending');
    let result;
    try { result = await auth.requestPasswordReset({ schoolId: school.id, email }); } catch { result = { ok: false, reason: 'error' }; }
    state.busy = false;
    ui.setLoading(sendBtn, null);

    if (result.ok) {
      state.email = email;
      state.resendAt = result.resendAt;
      state.token = null;
      setStatus(null);
      showAlert(2, null);
      showStep(2);
    } else if (result.reason === 'invalid-email') { setEmailError('invalidEmail'); emailInput.focus(); }
    else if (result.reason === 'rate-limited') showAlert(1, 'requestTooSoon');
    else showAlert(1, 'requestFailed');
  });

  /* ------------------------------------------------------------ Step 2: demo link + resend */
  function renderResend() {
    if (resendBtn.dataset.loadingKey) return;
    const left = Math.ceil((state.resendAt - Date.now()) / 1000);
    resendBtn.dataset.lockedDisabled = String(left > 0);
    resendBtn.disabled = left > 0;
    resendBtn.textContent = left > 0 ? t('resendIn', { s: left }) : t('resend');
  }
  function startResendTimer() {
    clearInterval(state.timer); // only ever one countdown
    renderResend();
    state.timer = setInterval(() => {
      renderResend();
      if (state.resendAt <= Date.now()) clearInterval(state.timer);
    }, 1000);
  }
  addEventListener('pagehide', () => clearInterval(state.timer));

  resendBtn.addEventListener('click', async () => {
    if (state.busy || state.resendAt > Date.now()) return;
    state.busy = true;
    setStatus(null);
    showAlert(2, null);
    ui.setLoading(resendBtn, 'resending');
    let result;
    try { result = await auth.requestPasswordReset({ schoolId: school.id, email: state.email }); } catch { result = { ok: false, reason: 'error' }; }
    state.busy = false;
    ui.setLoading(resendBtn, null);
    if (result.ok) {
      // The countdown restarts only after the service accepted the new request.
      state.resendAt = result.resendAt;
      state.token = null;
      setStatus('resent');
    } else if (result.reason === 'rate-limited') {
      state.resendAt = result.retryAt;
    } else {
      showAlert(2, 'resendFailed');
    }
    persist();
    startResendTimer();
  });

  openBtn.addEventListener('click', async () => {
    if (state.busy) return;
    state.busy = true;
    ui.setLoading(openBtn, 'opening');
    state.token = await auth.openDemoResetLink(state.email);
    state.busy = false;
    ui.setLoading(openBtn, null);
    // With no token (unknown address, or this page was reloaded) step 3 shows the invalid-link state.
    state.token = state.token || 'none';
    showStep(3);
  });

  /* ------------------------------------------------------------ Step 3: new password */
  function enterStep3() {
    showAlert(3, null);
    const valid = auth.checkResetToken(state.token);
    linkInvalid.hidden = valid;
    [newInput, confirmInput, ...$$('[data-toggle]')].forEach(el => { el.disabled = !valid; });
  }
  function leaveStep3() {
    newInput.value = '';
    confirmInput.value = '';
    toggles.forEach(tg => tg.hide());
    state.token = null; // the demo link has to be opened again
    evaluatePassword();
  }
  $('[data-new-link]').addEventListener('click', () => {
    leaveStep3();
    state.resendAt = 0;
    showStep(1);
  });

  const LEVELS = ['weak', 'weak', 'fair', 'fair', 'strong'];
  function evaluatePassword() {
    const pw = newInput.value;
    let met = 0;
    $$('[data-rule]').forEach(li => {
      const ok = auth.passwordRules[li.dataset.rule](pw);
      met += ok;
      li.classList.toggle('is-met', ok);
      $('use', li).setAttribute('href', ok ? '#i-check-circle' : '#i-circle');
      $('[data-rule-state]', li).textContent = `: ${t(ok ? 'ruleMet' : 'ruleNotMet')}`;
    });
    const level = pw ? LEVELS[met] : 'none';
    $('#rs-strength').dataset.level = level;
    $('[data-strength-label]').textContent = level === 'none' ? '' : t(`strength${level[0].toUpperCase()}${level.slice(1)}`);

    // Mismatch shows only once the confirmation has something in it.
    const mismatch = confirmInput.value !== '' && confirmInput.value !== pw;
    const hint = $('#rs-confirm-error');
    hint.innerHTML = mismatch ? `${icon('alert')}${esc(t('passwordsDontMatch'))}` : '';
    hint.hidden = !mismatch;
    confirmInput.setAttribute('aria-invalid', String(mismatch));

    const ready = met === 4 && confirmInput.value !== '' && !mismatch && auth.checkResetToken(state.token);
    saveBtn.dataset.lockedDisabled = String(!ready);
    if (!saveBtn.dataset.loadingKey) saveBtn.disabled = !ready;
    return ready;
  }
  newInput.addEventListener('input', evaluatePassword);
  confirmInput.addEventListener('input', evaluatePassword);

  steps[3].addEventListener('submit', async e => {
    e.preventDefault();
    if (state.busy || !evaluatePassword()) return;
    state.busy = true;
    showAlert(3, null);
    ui.setLoading(saveBtn, 'saving');
    let result;
    try { result = await auth.resetPassword({ token: state.token, password: newInput.value }); } catch { result = { ok: false, reason: 'error' }; }

    if (result.ok) {
      newInput.value = '';
      confirmInput.value = '';
      state.token = null;
      auth.recoveryFlow.clear();
      store.session.set(false); // a password change ends any session in this browser
      auth.handOffToSignIn({ email: result.email, notice: 'passwordUpdated' });
      location.replace(ui.withSchool(routes.signIn()));
      return;
    }
    state.busy = false;
    ui.setLoading(saveBtn, null);
    if (result.reason === 'invalid-token') { linkInvalid.hidden = false; [newInput, confirmInput].forEach(el => { el.disabled = true; }); }
    else showAlert(3, 'saveFailed');
    evaluatePassword();
  });

  /* ------------------------------------------------------------ Start */
  emailInput.value = state.email;
  resendBtn.dataset.label = 'resend';
  const startStep = saved.step === 2 && state.email ? 2 : 1;
  showStep(startStep, { push: false, focus: false });
})();
