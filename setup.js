/* S05 — first-time school setup wizard (7 steps). One step table drives rendering, validation,
   saving and navigation. Data goes to the shared school records in store.js (also read by S58
   Settings and S17 Classes); progress is saved after every successful step.
   Steps 1–4 and 7 are required; 5 and 6 can be skipped. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const { routes } = store;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const clone = v => JSON.parse(JSON.stringify(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const FLASH_KEY = 'nexora-flash';

  document.body.insertAdjacentHTML('afterbegin', `
    <svg xmlns="http://www.w3.org/2000/svg" hidden aria-hidden="true">
      <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol>
      <symbol id="i-check-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 5-5"/></symbol>
      <symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></symbol>
      <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></symbol>
      <symbol id="i-alert" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></symbol>
      <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
      <symbol id="i-trash" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></symbol>
      <symbol id="i-arrow-left" viewBox="0 0 24 24"><path d="M19 12H5M11 18l-6-6 6-6"/></symbol>
      <symbol id="i-chevron-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
      <symbol id="i-pencil" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></symbol>
    </svg>`);

  /* ------------------------------------------------------------ Access */
  const here = `${location.pathname.split('/').pop()}${location.search}`;
  if (!store.session.isSignedIn()) { location.replace(routes.signIn({ next: here })); return; }
  const user = store.currentUser();
  const school = store.school; // the signed-in school; every read and write is scoped to its ID
  const card = $('[data-card]');
  const schoolName = () => store.getSettings(school.id).profile.name || school.name;
  $('[data-school-name]').textContent = schoolName();
  $('[data-brand]').href = routes.landing;
  if (!store.canManagePlan(user)) {
    card.removeAttribute('aria-busy');
    card.innerHTML = `
      <div class="wz-head"><h1 class="wz-title">School setup</h1>
      <p class="wz-text">Only your school's director or admin can set up the school. You're signed in as ${esc(user.role)}.</p></div>
      <div class="wz-actions-end"><a class="btn auth-btn" href="${routes.landing}">Back to dashboard</a></div>`;
    return;
  }

  /* ------------------------------------------------------------ Field helpers */
  const fieldId = (step, name) => `s${step}-${name}`;
  function errorHtml(id, msg) {
    return `<p class="field__hint field__hint--error" id="${id}-error"${msg ? '' : ' hidden'}>${msg ? `${icon('alert')}${esc(msg)}` : ''}</p>`;
  }
  function input(step, name, label, value, err, { type = 'text', required = false, hint = '', attrs = '' } = {}) {
    const id = fieldId(step, name);
    const described = [hint ? `${id}-hint` : '', `${id}-error`].filter(Boolean).join(' ');
    return `
      <div class="field">
        <label class="field__label" for="${id}">${esc(label)} ${required ? '<span class="field__req" aria-hidden="true">*</span>' : '<span class="wz-optional">Optional</span>'}</label>
        ${type === 'textarea'
          ? `<textarea class="input" id="${id}" name="${name}" aria-describedby="${described}"${required ? ' required' : ''}${err ? ' aria-invalid="true"' : ''} ${attrs}>${esc(value)}</textarea>`
          : `<input class="input" id="${id}" name="${name}" type="${type}" value="${esc(value)}" aria-describedby="${described}"${required ? ' required' : ''}${err ? ' aria-invalid="true"' : ''} ${attrs}>`}
        ${hint ? `<p class="field__hint" id="${id}-hint">${esc(hint)}</p>` : ''}
        ${errorHtml(id, err)}
      </div>`;
  }
  function select(id, name, label, value, options, err, { labelClass = 'field__label', placeholder = 'Choose…' } = {}) {
    return `
      <div class="field">
        <label class="${labelClass}" for="${id}">${esc(label)}${labelClass === 'field__label' ? ' <span class="field__req" aria-hidden="true">*</span>' : ''}</label>
        <span class="wz-select">
          <select class="input" id="${id}" name="${name}" required aria-describedby="${id}-error"${err ? ' aria-invalid="true"' : ''}>
            <option value=""${value ? '' : ' selected'}>${esc(placeholder)}</option>
            ${options.map(o => `<option value="${esc(o)}"${o === value ? ' selected' : ''}>${esc(o)}</option>`).join('')}
          </select>
          ${icon('chevron-down')}
        </span>
        ${errorHtml(id, err)}
      </div>`;
  }
  const newId = prefix => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const DAY_LABEL = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
  const LANG_LABEL = { en: 'English', ta: 'தமிழ் (Tamil)', ar: 'العربية (Arabic)' };
  const fmtDate = d => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  function fmtTime(t, format) {
    if (!t) return '';
    if (format === '24h') return t;
    const [h, m] = t.split(':').map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }

  /* ------------------------------------------------------------ Step definitions */
  const STEPS = [
    {
      n: 1, label: 'School', required: true,
      title: "Let's set up your school",
      text: "Start with the details that help us personalize your school's workspace.",
      load: () => store.getSettings(school.id).profile,
      render: (v, e) => `
        <div class="wz-grid">
          ${input(1, 'name', 'School name', v.name, e.name, { required: true, attrs: 'autocomplete="organization" maxlength="80"' })}
          ${input(1, 'email', 'School contact email', v.email, e.email, { type: 'email', required: true, attrs: 'autocomplete="email" inputmode="email" dir="auto"' })}
          ${input(1, 'phone', 'Phone number', v.phone, e.phone, { type: 'tel', attrs: 'autocomplete="tel" inputmode="tel" dir="auto"' })}
          <div class="span-all">${input(1, 'address', 'Address', v.address, e.address, { type: 'textarea', attrs: 'rows="2" maxlength="200" autocomplete="street-address"' })}</div>
        </div>`,
      read: f => ({ name: f.name.value, email: f.email.value, phone: f.phone.value, address: f.address.value }),
      validate(v) {
        const e = {};
        if (!v.name.trim()) e.name = 'Enter your school’s name.';
        if (!v.email.trim()) e.email = 'Enter a contact email for the school.';
        else if (!EMAIL_RE.test(v.email.trim())) e.email = 'Enter an email address like office@school.org.';
        if (v.phone.trim() && !/^\+?[\d\s()-]{7,20}$/.test(v.phone.trim())) e.phone = 'Use numbers, spaces and + only, like +91 44 2345 6789.';
        return e;
      },
      save: v => store.saveSettings(school.id, 'profile', { name: v.name.trim(), email: v.email.trim(), phone: v.phone.trim(), address: v.address.trim() })
    },
    {
      n: 2, label: 'Academic Year', required: true,
      title: 'Set your academic year',
      text: 'Choose the academic year your school will use for classes and records.',
      load: () => store.getSettings(school.id).academicYear,
      render: (v, e) => `
        <div class="wz-grid">
          <div class="span-all">${input(2, 'name', 'Academic year name', v.name, e.name, { required: true, hint: 'For example, 2026–27.', attrs: 'maxlength="40"' })}</div>
          ${input(2, 'start', 'Start date', v.start, e.start, { type: 'date', required: true })}
          ${input(2, 'end', 'End date', v.end, e.end, { type: 'date', required: true })}
        </div>`,
      read: f => ({ name: f.name.value, start: f.start.value, end: f.end.value }),
      validate(v) {
        const e = {};
        if (!v.name.trim()) e.name = 'Give the academic year a name, like 2026–27.';
        if (!v.start) e.start = 'Choose the first day of the academic year.';
        if (!v.end) e.end = 'Choose the last day of the academic year.';
        else if (v.start && v.end <= v.start) e.end = 'The end date must be after the start date.';
        else if (v.start && (new Date(v.end) - new Date(v.start)) / 864e5 > 731) e.end = 'An academic year can be at most two years long.';
        return e;
      },
      save: v => store.saveSettings(school.id, 'academicYear', { name: v.name.trim(), start: v.start, end: v.end })
    },
    {
      n: 3, label: 'School Hours', required: true,
      title: 'Set your school hours',
      text: 'Choose the usual hours for your school day.',
      load: () => store.getSettings(school.id).hours,
      render: (v, e) => `
        <div class="wz-grid">
          ${input(3, 'open', 'Opening time', v.open, e.open, { type: 'time', required: true })}
          ${input(3, 'close', 'Closing time', v.close, e.close, { type: 'time', required: true })}
          <fieldset class="field span-all wz-days" aria-describedby="s3-days-error">
            <legend class="field__label">School days <span class="field__req" aria-hidden="true">*</span></legend>
            <div class="wz-days__row">
              ${store.WEEKDAYS.map(d => `<label class="check"><input type="checkbox" name="days" value="${d}"${v.days.includes(d) ? ' checked' : ''}>${DAY_LABEL[d]}</label>`).join('')}
            </div>
            ${errorHtml('s3-days', e.days)}
          </fieldset>
        </div>`,
      read: f => ({ open: f.open.value, close: f.close.value, days: $$('input[name="days"]:checked', f).map(c => c.value) }),
      validate(v) {
        const e = {};
        if (!v.open) e.open = 'Choose the time your school opens.';
        if (!v.close) e.close = 'Choose the time your school closes.';
        else if (v.open && v.close <= v.open) e.close = 'Closing time must be after opening time.';
        if (!v.days.length) e.days = 'Choose at least one school day.';
        return e;
      },
      save: v => store.saveSettings(school.id, 'hours', { open: v.open, close: v.close, days: store.WEEKDAYS.filter(d => v.days.includes(d)) })
    },
    {
      n: 4, label: 'Classes', required: true,
      title: 'Add your classes',
      text: 'Create the classes your teachers and students will use every day.',
      load: () => store.getClasses(school.id).map(c => ({ id: c.id, name: c.name, level: c.level, section: c.section || '', capacity: c.capacity == null ? '' : String(c.capacity) })),
      render: (rows, e) => tableHtml({
        kind: 'class', noun: 'class', rows, errors: e,
        cols: ['Class name', 'Level', 'Section', 'Capacity', ''],
        empty: ['No classes yet', 'Add the classes your school runs, like “UKG B” or “Montessori A”.'],
        addLabel: 'Add class',
        cells: (r, i, er) => `
          ${rowInput(4, r.id, 'name', 'Class name', r.name, er.name, 'maxlength="40" placeholder="e.g. UKG B"')}
          ${select(`s4-${r.id}-level`, 'level', 'Level', r.level, store.CLASS_LEVELS, er.level, { labelClass: 'wz-row__label' })}
          ${rowInput(4, r.id, 'section', 'Section (optional)', r.section, er.section, 'maxlength="10" placeholder="A"')}
          ${rowInput(4, r.id, 'capacity', 'Capacity (optional)', r.capacity, er.capacity, 'type="number" inputmode="numeric" min="1" max="60" placeholder="20"')}`
      }),
      read: f => $$('[data-row]', f).map(row => ({ id: row.dataset.row, name: $('[name="name"]', row).value, level: $('[name="level"]', row).value, section: $('[name="section"]', row).value, capacity: $('[name="capacity"]', row).value })),
      validate(rows) {
        const e = {};
        const seen = new Map();
        rows.forEach(r => {
          const er = {};
          const key = r.name.trim().toLowerCase();
          if (!key) er.name = 'Enter a class name.';
          else if (seen.has(key)) er.name = 'Another class already has this name.';
          if (key) seen.set(key, r.id);
          if (!r.level) er.level = 'Choose a level.';
          if (r.capacity !== '' && !(Number.isInteger(Number(r.capacity)) && Number(r.capacity) >= 1 && Number(r.capacity) <= 60)) er.capacity = 'Use a whole number from 1 to 60.';
          if (Object.keys(er).length) e[r.id] = er;
        });
        return e;
      },
      save: rows => store.saveClasses(school.id, rows)
    },
    {
      n: 5, label: 'Staff', required: false,
      title: 'Invite your team',
      text: 'Prepare your staff workspace so the right people can help manage the school.',
      load: () => store.getStaffDrafts(school.id).map(s => ({ id: s.id, name: s.name, email: s.email, role: s.role })),
      render: (rows, e) => `
        <p class="wz-note">${icon('info')}<span>Invitations can’t be sent from this prototype yet. Staff you add here are saved as drafts, marked “Not invited yet”.</span></p>
        ${tableHtml({
          kind: 'staff', noun: 'staff member', rows, errors: e,
          cols: ['Name', 'Email', 'Role', ''],
          empty: ['No staff added yet', 'Add the people who’ll help run the school. You can also do this later.'],
          addLabel: 'Add staff',
          cells: (r, i, er) => `
            ${rowInput(5, r.id, 'name', 'Name', r.name, er.name, 'maxlength="60" autocomplete="off"')}
            ${rowInput(5, r.id, 'email', 'Email', r.email, er.email, 'type="email" inputmode="email" autocomplete="off" dir="auto"')}
            ${select(`s5-${r.id}-role`, 'role', 'Role', r.role, store.STAFF_ROLES, er.role, { labelClass: 'wz-row__label' })}`
        })}`,
      read: f => $$('[data-row]', f).map(row => ({ id: row.dataset.row, name: $('[name="name"]', row).value, email: $('[name="email"]', row).value, role: $('[name="role"]', row).value })),
      validate(rows) {
        const e = {};
        const seen = new Set();
        const taken = new Set(store.users.filter(u => u.schoolId === school.id).map(u => u.email.toLowerCase()));
        rows.forEach(r => {
          const er = {};
          const mail = r.email.trim().toLowerCase();
          if (!r.name.trim()) er.name = 'Enter a name.';
          if (!mail) er.email = 'Enter an email address.';
          else if (!EMAIL_RE.test(mail)) er.email = 'Enter an email address like name@school.org.';
          else if (seen.has(mail)) er.email = 'This email is already in the list.';
          else if (taken.has(mail)) er.email = 'This person already has an account.';
          if (mail) seen.add(mail);
          if (!r.role) er.role = 'Choose a role.';
          if (Object.keys(er).length) e[r.id] = er;
        });
        return e;
      },
      save: rows => store.saveStaffDrafts(school.id, rows)
    },
    {
      n: 6, label: 'Preferences', required: false,
      title: 'Make it work for your school',
      text: 'Choose the preferences that make your daily workflow more comfortable.',
      load: () => store.getSettings(school.id).preferences,
      render: v => `
        <div class="wz-grid">
          <fieldset class="field span-all wz-choice">
            <legend class="field__label">Language <span class="wz-optional">Optional</span></legend>
            <p class="field__hint">Used for sign-in screens on this device, and as your school’s default.</p>
            <div class="wz-choice__row">
              ${Object.entries(LANG_LABEL).map(([code, name]) => `<label class="radio"><input type="radio" name="language" value="${code}"${v.language === code ? ' checked' : ''}><span lang="${code}">${esc(name)}</span></label>`).join('')}
            </div>
          </fieldset>
          <fieldset class="field span-all wz-choice">
            <legend class="field__label">Time format <span class="wz-optional">Optional</span></legend>
            <div class="wz-choice__row">
              <label class="radio"><input type="radio" name="timeFormat" value="12h"${v.timeFormat === '12h' ? ' checked' : ''}>12-hour (3:30 PM)</label>
              <label class="radio"><input type="radio" name="timeFormat" value="24h"${v.timeFormat === '24h' ? ' checked' : ''}>24-hour (15:30)</label>
            </div>
          </fieldset>
        </div>`,
      read: f => ({ language: (f.querySelector('[name="language"]:checked') || {}).value || 'en', timeFormat: (f.querySelector('[name="timeFormat"]:checked') || {}).value || '12h' }),
      validate: () => ({}),
      save(v) {
        const ok = store.saveSettings(school.id, 'preferences', v);
        if (ok) window.NexoraI18n?.rememberLocale(v.language);
        return ok;
      }
    },
    {
      n: 7, label: 'Review', required: true,
      title: 'Your school is almost ready',
      text: 'Take a quick look at your setup before you finish.',
      load: () => ({}),
      render: () => reviewHtml(),
      read: () => ({}),
      validate: () => ({}),
      save: () => true
    }
  ];
  const step = n => STEPS[n - 1];

  function rowInput(n, rowId, name, label, value, err, attrs = '') {
    const id = `s${n}-${rowId}-${name}`;
    return `
      <div class="field">
        <label class="wz-row__label" for="${id}">${esc(label)}</label>
        <input class="input" id="${id}" name="${name}" value="${esc(value)}" aria-describedby="${id}-error"${err ? ' aria-invalid="true"' : ''} ${attrs.includes('type=') ? '' : 'type="text"'} ${attrs}>
        ${errorHtml(id, err)}
      </div>`;
  }
  function tableHtml({ kind, noun, rows, errors, cols, empty, addLabel, cells }) {
    return `
      <div class="wz-table wz-table--${kind}">
        ${rows.length ? `<div class="wz-table__head" aria-hidden="true">${cols.map(c => `<span>${esc(c)}</span>`).join('')}</div>` : ''}
        <ul class="wz-rows" aria-label="${kind === 'class' ? 'Classes' : 'Staff'}">
          ${rows.map((r, i) => `
            <li class="wz-row" data-row="${esc(r.id)}">
              <p class="wz-row__title">${esc(kind === 'class' ? 'Class' : 'Staff member')} ${i + 1}</p>
              ${cells(r, i, errors[r.id] || {})}
              <button class="wz-row__remove" type="button" data-remove="${esc(r.id)}" aria-label="Remove ${esc(noun)} ${i + 1}${r.name ? `, ${esc(r.name)}` : ''}">${icon('trash')}<span class="wz-row__remove-text">Remove</span></button>
            </li>`).join('')}
        </ul>
        ${rows.length ? '' : `<div class="wz-empty"><p class="wz-empty__title">${esc(empty[0])}</p><p class="wz-empty__text">${esc(empty[1])}</p></div>`}
        <button class="btn auth-btn auth-btn--outline wz-add" type="button" data-add>${icon('plus')}${esc(addLabel)}</button>
      </div>`;
  }

  /* ------------------------------------------------------------ State */
  const setup = store.getSetup(school.id);
  const state = {
    step: 1,
    completed: new Set(setup.completed),
    skipped: new Set(setup.skipped),
    saved: {},     // last values saved to the school records
    baseline: {},  // what "no unsaved changes" means (saved, or the draft kept when a step was skipped)
    draft: {},     // what's on screen / in memory
    errors: {},
    busy: false,
    returnToReview: false,
    status: setup.status
  };
  STEPS.forEach(s => {
    state.saved[s.n] = clone(s.load());
    state.baseline[s.n] = clone(setup.drafts?.[s.n] ?? state.saved[s.n]);
    state.draft[s.n] = clone(state.baseline[s.n]);
    state.errors[s.n] = {};
  });

  const isDone = n => state.completed.has(n) || state.skipped.has(n);
  // A step can be opened once every step before it is done (completed, or skipped where allowed).
  const reachable = n => STEPS.slice(0, n - 1).every(s => isDone(s.n));
  const firstOpen = () => (STEPS.find(s => !isDone(s.n) && s.n < 7) || step(7)).n;
  const dirtySteps = () => STEPS.filter(s => s.n < 7 && !same(state.draft[s.n], state.baseline[s.n])).map(s => s.n);

  /* ------------------------------------------------------------ Unsaved changes (native prompt only) */
  const onBeforeUnload = e => { e.preventDefault(); e.returnValue = ''; };
  let guarding = false;
  function syncGuard() {
    const dirty = dirtySteps().length > 0;
    if (dirty && !guarding) { addEventListener('beforeunload', onBeforeUnload); guarding = true; }
    if (!dirty && guarding) { removeEventListener('beforeunload', onBeforeUnload); guarding = false; }
  }
  function leave(url) {
    removeEventListener('beforeunload', onBeforeUnload);
    guarding = false;
    location.assign(url);
  }

  /* ------------------------------------------------------------ Rendering */
  function renderStepper() {
    $('[data-stepper]').innerHTML = STEPS.map(s => {
      const done = state.completed.has(s.n);
      const skipped = !done && state.skipped.has(s.n);
      const current = s.n === state.step;
      const open = reachable(s.n);
      const statusText = done ? 'completed' : skipped ? 'skipped' : current ? 'current step' : open ? 'not started' : 'not available yet';
      return `
        <li class="wz-step${done ? ' is-done' : ''}${skipped ? ' is-skipped' : ''}${current ? ' is-current' : ''}">
          <button class="wz-step__btn" type="button" data-goto="${s.n}"${current ? ' aria-current="step"' : ''}${open ? '' : ' disabled'}>
            <span class="wz-step__dot" aria-hidden="true">${done ? icon('check') : s.n}</span>
            <span class="wz-step__label">${esc(s.label)}</span>
            <span class="sr-only">, step ${s.n} of 7, ${statusText}</span>
          </button>
        </li>`;
    }).join('');
    const s = step(state.step);
    $('[data-mprogress-label]').textContent = `Step ${s.n} of 7 · ${s.label}`;
    $('[data-mprogress-fill]').style.width = `${(s.n / 7) * 100}%`;
  }

  function renderCard({ focus = 'title' } = {}) {
    const s = step(state.step);
    const optional = !s.required;
    const last = s.n === 7;
    const complete = state.status === 'complete';
    card.removeAttribute('aria-busy');
    card.innerHTML = `
      <form class="wz-form" novalidate data-form>
        <div class="wz-head">
          <p class="wz-kicker">Step ${s.n} of 7${optional ? ' · Optional' : ''}</p>
          <h1 class="wz-title" tabindex="-1" data-title>${esc(s.title)}</h1>
          <p class="wz-text">${esc(s.text)}</p>
        </div>
        <div class="auth-alert auth-alert--error" data-alert role="alert" hidden>${icon('alert')}<p data-alert-text></p></div>
        <div class="wz-body" data-body>${s.render(state.draft[s.n], state.errors[s.n])}</div>
        <div class="wz-foot">
          <button class="btn auth-btn auth-btn--outline" type="button" data-back${s.n === 1 ? ' hidden' : ''}>${icon('arrow-left')}Back</button>
          <p class="wz-saved" data-saved role="status" aria-live="polite"></p>
          <div class="wz-foot__end">
            ${optional ? '<button class="wz-skip" type="button" data-skip>Skip for now</button>' : ''}
            <button class="btn auth-btn wz-next" type="submit" data-next data-label="${last ? (complete ? 'Done' : 'Finish setup') : 'Next'}">${last ? (complete ? 'Done' : 'Finish setup') : 'Next'}</button>
          </div>
        </div>
      </form>`;
    renderStepper();
    renderSaved();
    $('[data-exit]').disabled = false; // a finished save leaves "Save & exit" usable on the next step
    document.title = `${s.label} · School setup · ${schoolName()}`;
    $('[data-school-name]').textContent = schoolName();
    if (focus === 'title') $('[data-title]').focus({ preventScroll: true });
    if (focus === 'error') focusFirstError();
    card.classList.remove('is-entering');
    void card.offsetWidth;
    if (!reduceMotion.matches) card.classList.add('is-entering');
  }

  function renderSaved(message) {
    const el = $('[data-saved]');
    if (!el) return;
    const at = store.getSetup(school.id).lastSavedAt;
    el.textContent = message || (at ? `Saved ${new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : '');
  }

  function showAlert(text) {
    const box = $('[data-alert]');
    $('[data-alert-text]', box).textContent = text || '';
    box.hidden = !text;
  }

  function focusFirstError() {
    const el = $('[aria-invalid="true"]', card);
    if (el) { el.focus(); return true; }
    return false;
  }

  /* ------------------------------------------------------------ Review (step 7) */
  function reviewHtml() {
    const s = store.getSettings(school.id);
    const classes = store.getClasses(school.id);
    const staff = store.getStaffDrafts(school.id);
    const fmt = s.preferences.timeFormat;
    const missing = [1, 2, 3, 4].filter(n => !state.completed.has(n));
    const row = (label, value) => `<div><dt>${esc(label)}</dt><dd>${value ? esc(value) : '<span class="wz-missing">Not added</span>'}</dd></div>`;
    const section = (n, title, body) => `
      <section class="wz-review__section${state.completed.has(n) || state.skipped.has(n) ? '' : ' needs-attention'}" aria-labelledby="rv-${n}">
        <div class="wz-review__head">
          <h2 class="wz-review__title" id="rv-${n}">${esc(title)}</h2>
          <button class="wz-edit" type="button" data-edit="${n}" aria-label="Edit ${esc(title)}">${icon('pencil')}Edit</button>
        </div>
        ${body}
      </section>`;
    const statusFor = n => (state.completed.has(n) ? '' : state.skipped.has(n) ? '<p class="wz-review__flag">Skipped for now</p>' : '<p class="wz-review__flag wz-review__flag--error">Needs attention</p>');
    const draftsKept = (setup.drafts?.[5] || []).length && state.skipped.has(5);
    return `
      ${state.status === 'complete' ? `<div class="wz-done" role="status">${icon('check-circle')}<p>Setup is complete. You can still edit any section.</p></div>` : ''}
      ${missing.length ? `<div class="auth-alert auth-alert--error" role="alert">${icon('alert')}<div><p>Finish these required steps before you complete setup:</p><ul class="wz-missing-list">${missing.map(n => `<li><button class="auth-link" type="button" data-edit="${n}">${esc(step(n).label)}</button></li>`).join('')}</ul></div></div>` : ''}
      <div class="wz-review">
        ${section(1, 'School details', `${statusFor(1)}<dl class="wz-dl">${row('Name', s.profile.name)}${row('Contact email', s.profile.email)}${row('Phone', s.profile.phone)}${row('Address', s.profile.address)}</dl>`)}
        ${section(2, 'Academic year', `${statusFor(2)}<dl class="wz-dl">${row('Name', s.academicYear.name)}${row('Dates', s.academicYear.start && s.academicYear.end ? `${fmtDate(s.academicYear.start)} – ${fmtDate(s.academicYear.end)}` : '')}</dl>`)}
        ${section(3, 'School hours', `${statusFor(3)}<dl class="wz-dl">${row('Hours', s.hours.open && s.hours.close ? `${fmtTime(s.hours.open, fmt)} – ${fmtTime(s.hours.close, fmt)}` : '')}${row('School days', s.hours.days.map(d => DAY_LABEL[d]).join(', '))}</dl>`)}
        ${section(4, 'Classes', `${statusFor(4)}${classes.length ? `<ul class="wz-chips">${classes.map(c => `<li>${esc(c.name)} <span>${esc(c.level)}${c.capacity ? ` · ${c.capacity} places` : ''}</span></li>`).join('')}</ul>` : '<p class="wz-missing">No classes added</p>'}`)}
        ${section(5, 'Staff', `${statusFor(5)}${staff.length ? `<ul class="wz-chips">${staff.map(p => `<li>${esc(p.name)} <span>${esc(p.role)} · Not invited yet</span></li>`).join('')}</ul>` : '<p class="wz-missing">No staff added</p>'}${draftsKept ? '<p class="wz-review__flag">Some unfinished staff entries are kept for later.</p>' : ''}`)}
        ${section(6, 'Preferences', `${statusFor(6)}<dl class="wz-dl">${row('Language', LANG_LABEL[s.preferences.language])}${row('Time format', s.preferences.timeFormat === '24h' ? '24-hour' : '12-hour')}</dl>`)}
      </div>`;
  }

  /* ------------------------------------------------------------ Dialog (native <dialog>, T00 modal) */
  const dialog = $('#wz-dialog');
  let dialogResolve = null;
  function ask({ title, text, actions, escape }) {
    $('#wz-dialog-title').textContent = title;
    $('#wz-dialog-text').textContent = text;
    $('[data-dialog-actions]', dialog).innerHTML = actions.map(a => `<button class="btn auth-btn${a.kind === 'secondary' ? ' auth-btn--outline' : a.kind === 'danger' ? ' wz-danger' : ''}" type="button" data-action="${a.value}">${esc(a.label)}</button>`).join('');
    const opener = document.activeElement;
    dialog.classList.remove('is-closing');
    dialog.showModal();
    // Focus the safe choice first.
    $(`[data-action="${escape}"]`, dialog).focus();
    return new Promise(resolve => {
      dialogResolve = value => {
        dialogResolve = null;
        const done = () => { dialog.classList.remove('is-closing'); dialog.close(); if (opener && document.contains(opener)) opener.focus(); resolve(value); };
        dialog.classList.add('is-closing');
        reduceMotion.matches ? done() : setTimeout(done, 170);
      };
      dialog.dataset.escape = escape;
    });
  }
  dialog.addEventListener('click', e => { const b = e.target.closest('[data-action]'); if (b && dialogResolve) dialogResolve(b.dataset.action); });
  // Escape picks the safe option; clicking the backdrop does nothing, so nothing is dismissed by accident.
  dialog.addEventListener('cancel', e => { e.preventDefault(); if (dialogResolve) dialogResolve(dialog.dataset.escape); });

  /* ------------------------------------------------------------ Saving */
  const settle = ms => new Promise(r => setTimeout(r, ms));
  async function saveStep(n) {
    const s = step(n);
    const values = state.draft[n];
    const errors = s.validate(values);
    state.errors[n] = errors;
    if (Object.keys(errors).length) return { ok: false, reason: 'invalid' };
    await settle(250);
    let result = s.save(values);
    if (typeof result === 'boolean') result = { ok: result, reason: result ? '' : 'storage' };
    if (!result.ok) return result;
    state.saved[n] = clone(s.load());
    state.draft[n] = clone(state.saved[n]);
    state.baseline[n] = clone(state.saved[n]);
    state.completed.add(n);
    state.skipped.delete(n);
    return { ok: true };
  }
  function persistProgress(currentStep) {
    const drafts = {};
    [5, 6].forEach(n => { if (state.skipped.has(n) && !same(state.baseline[n], state.saved[n])) drafts[n] = state.baseline[n]; });
    return store.saveSetup(school.id, {
      status: state.status === 'complete' ? 'complete' : 'in-progress',
      currentStep, completed: [...state.completed].sort(), skipped: [...state.skipped].sort(), drafts
    });
  }
  function failMessage(result) {
    if (result.reason === 'in-use') return `${result.classes.map(c => c.name).join(', ')} still has students, so it can’t be removed. Move the students to another class first.`;
    if (result.reason === 'duplicate') return 'Two classes have the same name. Give each class a different name.';
    return 'We couldn’t save this step. Your entries are still here — please try again.';
  }
  function setNextBusy(on) {
    const btn = $('[data-next]');
    if (!btn) return;
    btn.classList.toggle('is-loading', on);
    btn.setAttribute('aria-busy', String(on));
    btn.disabled = on;
    btn.innerHTML = on ? '<span class="spinner" aria-hidden="true"></span>Saving…' : esc(btn.dataset.label);
    $$('[data-back], [data-skip]', card).forEach(b => { b.disabled = on; });
    $('[data-exit]').disabled = on;
  }

  /* ------------------------------------------------------------ Navigation */
  function go(n, { push = true, focus = 'title' } = {}) {
    if (!reachable(n)) n = firstOpen();
    state.step = n;
    if (push) history.pushState({ step: n }, '', `#step-${n}`);
    else history.replaceState({ step: n }, '', `#step-${n}`);
    renderCard({ focus });
  }
  addEventListener('popstate', e => {
    const n = e.state?.step || Number((location.hash.match(/^#step-([1-7])$/) || [])[1]) || firstOpen();
    go(n, { push: false });
  });

  async function next() {
    if (state.busy) return;
    const n = state.step;
    showAlert(null);
    if (n === 7) { finish(); return; }

    if (n === 4 && state.draft[4].length === 0) {
      const choice = await ask({
        title: 'No classes added yet',
        text: 'Adding at least one class helps your school get ready for daily use.',
        actions: [{ label: 'Add a class', value: 'add' }],
        escape: 'add'
      });
      if (choice === 'add') addRow();
      return;
    }
    // Next on an optional step with nothing entered counts as skipping it.
    if ((n === 5 && state.draft[5].length === 0) && !state.completed.has(5)) { skip(); return; }

    state.busy = true;
    setNextBusy(true);
    const result = await saveStep(n);
    state.busy = false;
    if (!result.ok) {
      setNextBusy(false);
      if (result.reason === 'invalid') { rerenderBody(); focusFirstError(); }
      else showAlert(failMessage(result));
      return;
    }
    const target = state.returnToReview ? 7 : n + 1;
    state.returnToReview = false;
    if (!persistProgress(target)) { setNextBusy(false); showAlert('Your entries were saved, but we couldn’t save your place in setup. Please try again.'); return; }
    syncGuard();
    go(target);
    renderSaved('All changes saved');
  }

  function skip() {
    const n = state.step;
    if (step(n).required || state.busy) return;
    // Keep whatever was typed, but don't create records from it.
    state.baseline[n] = clone(state.draft[n]);
    if (!state.completed.has(n)) state.skipped.add(n);
    const target = state.returnToReview ? 7 : n + 1;
    state.returnToReview = false;
    persistProgress(target);
    syncGuard();
    go(target);
    renderSaved('Progress saved');
  }

  function back() {
    if (state.step > 1) go(state.step - 1);
  }

  async function finish() {
    const missing = [1, 2, 3, 4].filter(n => !state.completed.has(n));
    if (missing.length) { showAlert(`Finish ${missing.map(n => step(n).label).join(', ')} before completing setup.`); return; }
    if (!(await saveDirty())) return;
    state.busy = true;
    setNextBusy(true);
    await settle(300);
    const was = state.status;
    state.status = 'complete';
    const ok = store.saveSetup(school.id, {
      status: 'complete', currentStep: 7, completed: [...state.completed].sort(), skipped: [...state.skipped].sort(),
      completedAt: store.getSetup(school.id).completedAt || new Date().toISOString()
    }) && store.getSetup(school.id).status === 'complete';
    state.busy = false;
    if (!ok) {
      state.status = was;
      setNextBusy(false);
      showAlert('We couldn’t finish setup. Your entries are saved — please try again.');
      return;
    }
    flash(was === 'complete' ? 'Setup saved' : 'Your school is ready', was === 'complete' ? 'Your changes are saved.' : `${schoolName()} is set up. You can change these details in Settings.`);
    leave(routes.landing);
  }

  // Saves every step with unsaved, valid changes. Returns false (and shows the first problem) otherwise.
  async function saveDirty() {
    for (const n of dirtySteps()) {
      // A skipped optional step keeps what was typed as a draft instead of creating records.
      if (!step(n).required && !state.completed.has(n) && state.skipped.has(n)) { state.baseline[n] = clone(state.draft[n]); continue; }
      const result = await saveStep(n);
      if (!result.ok) {
        go(n, { focus: result.reason === 'invalid' ? 'error' : 'title' });
        showAlert(result.reason === 'invalid' ? 'Some details need attention before we can save them.' : failMessage(result));
        return false;
      }
    }
    return true;
  }

  function flash(title, text) {
    try { sessionStorage.setItem(FLASH_KEY, JSON.stringify({ title, text })); } catch { /* toast is optional */ }
  }

  async function saveAndExit() {
    if (state.busy) return;
    if (!dirtySteps().length) { leave(routes.landing); return; }
    const choice = await ask({
      title: 'Save your progress and exit?',
      text: 'Your setup is not finished yet. Save your progress so you can continue later.',
      actions: [{ label: 'Continue setup', value: 'stay', kind: 'secondary' }, { label: 'Save & exit', value: 'save' }],
      escape: 'stay'
    });
    if (choice !== 'save') return;
    state.busy = true;
    const ok = await saveDirty();
    state.busy = false;
    if (!ok) return;
    if (!persistProgress(state.step)) { showAlert('We couldn’t save your progress. Please try again.'); return; }
    flash('Progress saved', 'You can finish setting up your school any time.');
    leave(routes.landing);
  }

  /* ------------------------------------------------------------ Rows (classes, staff) */
  function rerenderBody() {
    const s = step(state.step);
    $('[data-body]', card).innerHTML = s.render(state.draft[s.n], state.errors[s.n]);
  }
  function addRow() {
    const n = state.step;
    const id = newId(n === 4 ? 'cls' : 'stf');
    state.draft[n].push(n === 4 ? { id, name: '', level: '', section: '', capacity: '' } : { id, name: '', email: '', role: '' });
    rerenderBody();
    syncGuard();
    $(`[data-row="${id}"] input`, card).focus();
  }
  async function removeRow(id) {
    const n = state.step;
    const rows = state.draft[n];
    const row = rows.find(r => r.id === id);
    if (!row) return;
    const savedRow = (state.saved[n] || []).find(r => r.id === id);
    if (n === 4 && savedRow && store.classStudentCount(school.id, savedRow.name) > 0) {
      const count = store.classStudentCount(school.id, savedRow.name);
      await ask({
        title: 'This class has students',
        text: `${savedRow.name} has ${count} student${count === 1 ? '' : 's'}. Move them to another class before removing it.`,
        actions: [{ label: 'OK', value: 'ok' }],
        escape: 'ok'
      });
      return;
    }
    const hasData = Object.entries(row).some(([k, v]) => k !== 'id' && String(v).trim() !== '');
    if (hasData) {
      const isClass = n === 4;
      const choice = await ask({
        title: isClass ? 'Remove this class?' : 'Remove this staff member?',
        text: isClass ? 'You’ve entered information for this class. Are you sure you want to remove it?' : 'You’ve entered details for this person. Are you sure you want to remove them?',
        actions: [{ label: isClass ? 'Keep class' : 'Keep', value: 'keep', kind: 'secondary' }, { label: isClass ? 'Remove class' : 'Remove', value: 'remove', kind: 'danger' }],
        escape: 'keep'
      });
      if (choice !== 'remove') return;
    }
    const index = rows.indexOf(row);
    rows.splice(index, 1);
    delete state.errors[n][id];
    rerenderBody();
    syncGuard();
    const nextFocus = $$('[data-remove]', card)[Math.min(index, rows.length - 1)] || $('[data-add]', card);
    nextFocus.focus();
  }

  /* ------------------------------------------------------------ Events */
  card.addEventListener('submit', e => { e.preventDefault(); next(); });
  card.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t || state.busy) return;
    if (t.matches('[data-back]')) back();
    else if (t.matches('[data-skip]')) skip();
    else if (t.matches('[data-add]')) addRow();
    else if (t.matches('[data-remove]')) removeRow(t.dataset.remove);
    else if (t.matches('[data-edit]')) { state.returnToReview = true; go(Number(t.dataset.edit)); }
  });
  // Keep the in-memory draft in step with every edit; clear a field's error once it's fixed.
  card.addEventListener('input', onEdit);
  card.addEventListener('change', onEdit);
  function onEdit(e) {
    const form = $('[data-form]', card);
    if (!form || state.step === 7) return;
    const s = step(state.step);
    state.draft[s.n] = s.read(form);
    const field = e.target.closest('input, select, textarea');
    if (field && field.getAttribute('aria-invalid') === 'true') {
      const errors = s.validate(state.draft[s.n]);
      const rowId = field.closest('[data-row]')?.dataset.row;
      const stillWrong = rowId ? errors[rowId]?.[field.name] : errors[field.name] || (field.name === 'days' && errors.days);
      if (!stillWrong) {
        const errId = field.name === 'days' ? 's3-days' : field.id;
        field.setAttribute('aria-invalid', 'false');
        const hint = document.getElementById(`${errId}-error`);
        if (hint) { hint.hidden = true; hint.innerHTML = ''; }
        if (rowId && state.errors[s.n][rowId]) delete state.errors[s.n][rowId][field.name];
        else delete state.errors[s.n][field.name];
      }
    }
    syncGuard();
  }
  $('[data-stepper]').addEventListener('click', e => {
    const b = e.target.closest('[data-goto]');
    if (b && !b.disabled && !state.busy) { state.returnToReview = false; go(Number(b.dataset.goto)); }
  });
  $('[data-exit]').addEventListener('click', saveAndExit);

  /* ------------------------------------------------------------ Start: resume where the admin left off */
  $('[data-exit]').hidden = false;
  $('.wz-steps').hidden = false;
  $('[data-mprogress]').hidden = false;
  const fromHash = Number((location.hash.match(/^#step-([1-7])$/) || [])[1]);
  const start = state.status === 'complete' ? (fromHash || 7) : (fromHash || setup.currentStep || 1);
  // A link straight to a later step can't jump past unfinished required steps.
  go(reachable(start) ? start : firstOpen(), { push: false, focus: 'none' });
  if (setup.status === 'in-progress' && setup.lastSavedAt && !fromHash) renderSaved('Welcome back — you’re where you left off');
})();
