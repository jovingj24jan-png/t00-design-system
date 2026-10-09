/* Plan-restricted module view: NexoraPlanGate.render(container, user, moduleKey).
   Shown in place of a module the school's plan doesn't include, at the module's own URL,
   so the real page appears there once the plan includes it. Content comes from the catalogue. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const { routes, school } = store;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const date = iso => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const TIMES = ['Morning', 'Afternoon', 'No preference'];

  // Same loading pattern as the design-system buttons: spinner + label, aria-disabled (not
  // disabled) so the primary colour stays, and the original content restored afterwards.
  function setLoading(btn, label) {
    btn.dataset.original = btn.innerHTML;
    btn.style.minWidth = `${btn.offsetWidth}px`;
    btn.classList.add('is-loading');
    btn.setAttribute('aria-busy', 'true');
    btn.setAttribute('aria-disabled', 'true');
    btn.innerHTML = `<span class="spinner" aria-hidden="true"></span>${esc(label)}`;
  }
  function clearLoading(btn) {
    btn.innerHTML = btn.dataset.original;
    delete btn.dataset.original;
    btn.style.minWidth = '';
    btn.classList.remove('is-loading');
    btn.removeAttribute('aria-busy');
    btn.removeAttribute('aria-disabled');
  }

  function planCard(plan, kind, page) {
    const count = store.modulesInPlan(plan.id).length;
    const current = kind === 'current';
    return `
      <article class="pr-plan pr-plan--${kind}" aria-labelledby="pr-plan-${kind}">
        <div class="pr-plan__top">
          <span class="pr-plan__label">${current ? 'Your current plan' : 'Required plan'}</span>
          ${!current && plan.id === 'premium' ? '<span class="badge badge--primary badge--plain pr-plan__badge">Recommended</span>' : ''}
        </div>
        <h3 class="pr-plan__name" id="pr-plan-${kind}">${esc(plan.name)}</h3>
        <p class="pr-plan__text">${esc(plan.summary)}</p>
        <ul class="pr-plan__facts">
          <li>${icon(current ? 'lock' : 'check', 'icon--sm')}${current ? `Doesn't include ${esc(page.name)}` : `Includes ${esc(page.name)}`}</li>
          <li>${icon('grid', 'icon--sm')}${count} of ${store.moduleKeys.length} modules</li>
        </ul>
      </article>`;
  }

  function actionsHtml(user, key, required) {
    if (store.canManagePlan(user)) {
      return `
        <div class="pr-actions">
          <a class="btn btn--primary btn--lg" href="${routes.plans({ plan: required.id, module: key })}">See plans &amp; upgrade${icon('arrow-right', 'icon--sm')}</a>
          <button class="btn btn--secondary btn--lg" type="button" data-talk aria-haspopup="dialog">${icon('message', 'icon--sm')}Talk to us</button>
        </div>
        <p class="pr-note">${icon('info', 'icon--sm')}You can change ${esc(school.name)}'s plan. Prototype: no payment is taken.</p>`;
    }
    return `
      <div class="pr-actions">
        <button class="btn btn--primary btn--lg" type="button" data-ask>${icon('bell', 'icon--sm')}Ask my admin to upgrade</button>
        <a class="btn btn--secondary btn--lg" href="${routes.dashboard}">Back to dashboard</a>
      </div>
      <p class="pr-note" data-ask-note>${icon('info', 'icon--sm')}Only your school admin can change the plan. We'll send them your request with the details.</p>`;
  }

  function modalHtml(user, page, required) {
    const message = `Hi, we'd like to know more about ${page.name} on the ${required.name} plan for ${school.name}.`;
    return `
      <dialog class="modal" id="talk-modal" aria-labelledby="talk-title" aria-describedby="talk-desc">
        <form class="modal__panel" data-talk-form novalidate>
          <span class="modal__grabber" aria-hidden="true"></span>
          <div class="modal__top">
            <span class="tech-label">Enquiry / ${esc(page.name)}</span>
            <button class="btn btn--icon-ghost" type="button" aria-label="Close" data-close>${icon('x')}</button>
          </div>
          <div class="modal__body">
            <h2 class="modal__title" id="talk-title">Let's talk about your school's needs</h2>
            <p class="modal__desc" id="talk-desc">Tell us a little about what you need and when suits you. We'll reply by email.</p>
            <div class="field">
              <label class="field__label" for="talk-name">Name <span class="field__req" aria-hidden="true">*</span></label>
              <input class="input" id="talk-name" name="name" autocomplete="name" required value="${esc(user.name)}" aria-describedby="talk-name-error">
              <p class="field__hint field__hint--error" id="talk-name-error" hidden>${icon('info')}Enter your name.</p>
            </div>
            <div class="field">
              <label class="field__label" for="talk-email">Email <span class="field__req" aria-hidden="true">*</span></label>
              <input class="input" id="talk-email" name="email" type="email" autocomplete="email" required value="${esc(user.email || '')}" aria-describedby="talk-email-error">
              <p class="field__hint field__hint--error" id="talk-email-error" hidden>${icon('info')}Enter an email address like name@school.org.</p>
            </div>
            <div class="field">
              <label class="field__label" for="talk-message">Message <span class="field__req" aria-hidden="true">*</span></label>
              <textarea class="input" id="talk-message" name="message" required maxlength="600" aria-describedby="talk-message-error">${esc(message)}</textarea>
              <p class="field__hint field__hint--error" id="talk-message-error" hidden>${icon('info')}Write a short message so we know how to help.</p>
            </div>
            <fieldset class="field pr-times">
              <legend class="field__label">Preferred time to talk</legend>
              <div class="pr-times__row">
                ${TIMES.map((t, i) => `<label class="radio"><input type="radio" name="time" value="${t}"${i === TIMES.length - 1 ? ' checked' : ''}>${t}</label>`).join('')}
              </div>
            </fieldset>
            <p class="field__hint field__hint--error" data-send-error role="alert" hidden>${icon('info')}Your enquiry couldn't be saved. Your details are still here. Please try again.</p>
          </div>
          <div class="modal__foot">
            <button class="btn btn--primary" type="submit" data-send>Send enquiry</button>
            <button class="btn btn--secondary" type="button" data-close>Cancel</button>
          </div>
        </form>
      </dialog>`;
  }

  function errorHtml() {
    return `
      <article class="panel denied" aria-labelledby="pr-error-title">
        <span class="denied__icon" aria-hidden="true">${icon('info')}</span>
        <h1 class="denied__title" id="pr-error-title">We couldn't check your school's plan</h1>
        <p class="denied__text">Something went wrong while loading the plan details for this page. Your data is safe.</p>
        <div class="nf__actions">
          <button class="btn btn--primary btn--lg" type="button" data-retry>Try again</button>
          <a class="btn btn--secondary btn--lg" href="${routes.dashboard}">Back to dashboard</a>
        </div>
      </article>`;
  }

  function render(main, user, key) {
    const page = store.pageByKey(key);
    const current = store.currentPlan();
    const required = store.requiredPlanFor(key);
    main.classList.add('record-page');
    document.title = `${page.name} · Plan access · Nexora`;

    // Catalogue entry without a known plan: show a recoverable error, never a blank page.
    if (!required || !current || !Array.isArray(page.features)) {
      main.innerHTML = errorHtml();
      main.querySelector('[data-retry]').addEventListener('click', () => location.reload());
      return;
    }

    main.innerHTML = `
      <div class="pr">
        <section class="panel pr-hero" aria-labelledby="pr-title">
          <span class="pr-hero__icon" aria-hidden="true">${icon(page.icon)}</span>
          <div class="pr-hero__copy">
            <span class="tech-label">Plan access · Subscription feature</span>
            <h1 class="pr-hero__title" id="pr-title">${esc(page.name)} is available on ${esc(required.name)}</h1>
            <p class="pr-hero__text">${esc(page.description)}</p>
          </div>
          <span class="pr-lock">${icon('lock', 'icon--sm')}Not in your ${esc(current.name)} plan</span>
        </section>

        <section class="panel pr-section" aria-labelledby="pr-features-title">
          <h2 class="pr-section__title" id="pr-features-title">What you get</h2>
          <ul class="pr-features">
            ${page.features.map(f => `<li class="pr-feature"><span class="pr-feature__icon" aria-hidden="true">${icon('check', 'icon--sm')}</span>${esc(f)}</li>`).join('')}
          </ul>
        </section>

        <section class="panel pr-section" aria-labelledby="pr-plans-title">
          <h2 class="pr-section__title" id="pr-plans-title">Your plan and the next step</h2>
          <div class="pr-compare">
            ${planCard(current, 'current', page)}
            <span class="pr-compare__arrow" aria-hidden="true">${icon('arrow-right')}</span>
            ${planCard(required, 'required', page)}
          </div>
          ${actionsHtml(user, key, required)}
        </section>
      </div>
      ${store.canManagePlan(user) ? modalHtml(user, page, required) : ''}`;

    if (store.canManagePlan(user)) initTalk(main, user, key); else initAsk(main, user, key);

    // A plan change in another tab: reload so the module opens here without a manual refresh.
    addEventListener('storage', () => { if (store.isEntitled(key)) location.reload(); });
  }

  /* "Ask my admin to upgrade" — one request per user and module, kept across reloads. */
  function initAsk(main, user, key) {
    const btn = main.querySelector('[data-ask]');
    const note = main.querySelector('[data-ask-note]');

    function showSent(request) {
      btn.disabled = true;
      btn.innerHTML = `${icon('check', 'icon--sm')}Upgrade requested`;
      note.innerHTML = `${icon('check-circle', 'icon--sm icon--success')}Sent to your school admin on <time datetime="${esc(request.createdAt)}">${esc(date(request.createdAt))}</time>. They'll be in touch.`;
    }
    const existing = store.findUpgradeRequest(user, key);
    if (existing) { showSent(existing); return; }

    btn.addEventListener('click', async () => {
      if (btn.disabled || btn.classList.contains('is-loading')) return;
      if (!window.NexoraConnectivity.requireOnline('Asking your admin')) return;
      setLoading(btn, 'Sending…');
      const result = await store.requestUpgrade(user, key);
      clearLoading(btn);
      if (!result.ok) {
        window.NexoraToast.show("Request not sent", 'We couldn\'t save your request. Please try again.', 'info');
        return;
      }
      showSent(result.request);
      if (result.created) window.NexoraToast.show('Request sent to your school admin', 'Prototype: saved in this browser and shown in the Admin’s notifications.');
      btn.focus();
    });
  }

  /* "Talk to us" contact modal — native <dialog>, same open/close pattern as access-denied. */
  function initTalk(main, user, key) {
    const trigger = main.querySelector('[data-talk]');
    const modal = main.querySelector('#talk-modal');
    const form = modal.querySelector('[data-talk-form]');
    const sendBtn = form.querySelector('[data-send]');
    const sendError = form.querySelector('[data-send-error]');
    const fields = {
      name: { el: form.querySelector('#talk-name'), ok: v => v.trim().length > 0 },
      email: { el: form.querySelector('#talk-email'), ok: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) },
      message: { el: form.querySelector('#talk-message'), ok: v => v.trim().length > 0 }
    };
    let busy = false;

    function setInvalid(name, invalid) {
      const { el } = fields[name];
      el.setAttribute('aria-invalid', String(invalid));
      document.getElementById(`talk-${name}-error`).hidden = !invalid;
    }
    function validate() {
      let first = null;
      for (const name of Object.keys(fields)) {
        const bad = !fields[name].ok(fields[name].el.value);
        setInvalid(name, bad);
        if (bad && !first) first = fields[name].el;
      }
      return first;
    }
    Object.keys(fields).forEach(name => fields[name].el.addEventListener('input', () => {
      if (fields[name].el.getAttribute('aria-invalid') === 'true' && fields[name].ok(fields[name].el.value)) setInvalid(name, false);
    }));

    function open() {
      sendError.hidden = true;
      modal.classList.remove('is-closing');
      modal.showModal();
      fields.message.el.focus();
    }
    function close() {
      if (busy || !modal.open || modal.classList.contains('is-closing')) return;
      modal.classList.add('is-closing');
      const done = () => { modal.classList.remove('is-closing'); modal.close(); trigger.focus(); };
      reduceMotion.matches ? done() : setTimeout(done, 170);
    }

    trigger.addEventListener('click', open);
    modal.addEventListener('cancel', e => { e.preventDefault(); close(); });
    modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-close]')) close(); });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (busy) return;
      sendError.hidden = true;
      const invalid = validate();
      if (invalid) { invalid.focus(); return; }

      busy = true;
      setLoading(sendBtn, 'Sending…');
      const offline = !window.NexoraConnectivity.isOnline();
      const result = await store.submitEnquiry({
        user, module: key, savedOffline: offline,
        name: fields.name.el.value, email: fields.email.el.value, message: fields.message.el.value,
        preferredTime: form.elements.time.value
      });
      busy = false;
      clearLoading(sendBtn);

      // On failure the form keeps everything the user typed.
      if (!result.ok) { sendError.hidden = false; sendBtn.focus(); return; }
      close();
      if (offline) window.NexoraToast.show('Saved on this device', "You're offline. Prototype: enquiries aren't sent to our team yet.", 'info');
      else window.NexoraToast.show('Enquiry saved', 'Prototype: not yet sent to our team.');
    });
  }

  window.NexoraPlanGate = { render };
})();
