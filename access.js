/* access-denied.html?page=… — one page for every restricted school page.
   Role and page name come from the store; requests and Director notifications are saved there too. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const { routes } = store;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MAX = 300;

  const key = new URLSearchParams(location.search).get('page');
  const page = key ? store.pageByKey(key) : null;
  const main = document.getElementById('content');

  // Unknown pages stay a not-found state, never "access denied".
  if (!page) {
    window.NexoraShell.mount();
    window.NexoraNotFound.render(main);
    return;
  }
  // Only signed-in users who really lack permission belong here.
  if (!store.session.isSignedIn() || store.canAccess(store.currentUser(), key)) {
    location.replace(routes.page(key));
    return;
  }

  window.NexoraShell.mount();
  const user = store.currentUser();
  document.title = `No access to ${page.name} · Nexora`;
  main.classList.add('record-page');

  main.innerHTML = `
    <article class="panel denied" aria-labelledby="denied-title">
      <span class="denied__icon" aria-hidden="true"><svg class="icon"><use href="#i-shield-lock"/></svg></span>
      <h1 class="denied__title" id="denied-title" tabindex="-1">You don't have access to this page</h1>
      <p class="denied__text">Your role (<strong>${esc(user.role)}</strong>) doesn't include access to <strong>${esc(page.name)}</strong>. Ask your school director if you need it.</p>
      <div class="nf__actions">
        <button class="btn btn--primary btn--lg" type="button" data-request aria-haspopup="dialog">Request access</button>
        <a class="btn btn--secondary btn--lg" href="${routes.dashboard}">Back to dashboard</a>
      </div>
    </article>

    <dialog class="modal" id="request-modal" aria-labelledby="request-title" aria-describedby="request-desc">
      <form class="modal__panel" data-request-form novalidate>
        <span class="modal__grabber" aria-hidden="true"></span>
        <div class="modal__top">
          <span class="tech-label">Access / ${esc(page.name)}</span>
          <button class="btn btn--icon-ghost" type="button" aria-label="Close" data-close><svg class="icon"><use href="#i-x"/></svg></button>
        </div>
        <div class="modal__body">
          <h2 class="modal__title" id="request-title">Request access</h2>
          <p class="modal__desc" id="request-desc">We'll let your director know that you (${esc(user.role)}) would like access to ${esc(page.name)}.</p>
          <div class="field">
            <label class="field__label" for="request-reason">Reason <span class="field__extra" data-count aria-hidden="true">0 / ${MAX}</span></label>
            <textarea class="input" id="request-reason" name="reason" maxlength="${MAX}" placeholder="Tell your director why you need access (optional)" aria-describedby="request-hint"></textarea>
            <p class="field__hint" id="request-hint">Optional. Up to ${MAX} characters.</p>
            <p class="sr-only" role="status" data-count-status></p>
          </div>
          <p class="field__hint field__hint--error" data-offline-error role="alert" hidden></p>
          <p class="field__hint field__hint--error" data-send-error hidden><svg class="icon" aria-hidden="true"><use href="#i-info"/></svg>Your request couldn't be saved. Please try again.</p>
        </div>
        <div class="modal__foot">
          <button class="btn btn--primary" type="submit">Send</button>
          <button class="btn btn--secondary" type="button" data-close>Cancel</button>
        </div>
      </form>
    </dialog>`;

  const requestBtn = main.querySelector('[data-request]');
  const modal = main.querySelector('#request-modal');
  const form = modal.querySelector('[data-request-form]');
  const reason = modal.querySelector('#request-reason');
  const count = modal.querySelector('[data-count]');
  const countStatus = modal.querySelector('[data-count-status]');
  const sendError = modal.querySelector('[data-send-error]');
  const offlineError = modal.querySelector('[data-offline-error]');

  function showSent() {
    requestBtn.disabled = true;
    requestBtn.removeAttribute('aria-haspopup');
    requestBtn.innerHTML = '<svg class="icon icon--sm" aria-hidden="true"><use href="#i-check"/></svg>Request sent';
  }
  // A saved request for this user + page survives refresh.
  if (store.findRequest(user, key)) showSent();

  /* Modal: same open/close pattern as the design-system dialogs (native <dialog>, animated close). */
  let opener = null;
  function open() {
    opener = document.activeElement;
    sendError.hidden = true;
    offlineError.hidden = true;
    modal.classList.remove('is-closing');
    modal.showModal();
    reason.focus();
  }
  function close() {
    if (!modal.open || modal.classList.contains('is-closing')) return;
    modal.classList.add('is-closing');
    const done = () => {
      modal.classList.remove('is-closing');
      modal.close();
      const target = opener && !opener.disabled && document.contains(opener) ? opener : main.querySelector('.denied a.btn');
      target.focus();
    };
    reduceMotion.matches ? done() : setTimeout(done, 170);
  }

  requestBtn.addEventListener('click', () => { if (!requestBtn.disabled) open(); });
  modal.addEventListener('cancel', e => { e.preventDefault(); close(); });
  modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-close]')) close(); });

  function updateCount() {
    if (reason.value.length > MAX) reason.value = reason.value.slice(0, MAX);
    const n = reason.value.length;
    count.textContent = `${n} / ${MAX}`;
    const left = MAX - n;
    countStatus.textContent = left <= 20 ? (left === 0 ? 'Character limit reached' : `${left} characters left`) : '';
  }
  reason.addEventListener('input', updateCount);

  form.addEventListener('submit', e => {
    e.preventDefault();
    sendError.hidden = true;
    offlineError.hidden = true;
    if (!window.NexoraConnectivity.requireOnline('Requesting access', text => { offlineError.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-info"/></svg>${text}`; offlineError.hidden = false; })) return;
    const result = store.requestAccess(user, key, reason.value);
    if (!result.ok) { sendError.hidden = false; return; }
    opener = null;
    close();
    showSent();
    window.NexoraToast.show('Request sent to your director');
  });
})();
