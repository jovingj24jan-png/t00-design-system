/* Children pages in app.html: NexoraChildren.render(key, main, user) → true when handled.
   S12 children (search, filters, grid/list, bulk actions) · S14 enrol / edit (?id=) · S31 compose (?children=id,id).
   All data comes from NexoraStore (children records, classes, permissions); the page re-renders on
   store changes, so another tab's enrolment or a move shows up without a reload.
   Test hook: app.html?page=children&fail=1 makes the first load fail so the error state can be checked. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const { routes } = store;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 767px)');
  const params = new URLSearchParams(location.search);
  const FLASH_KEY = 'nexora-children-flash';

  const ALERT_ICON = { allergy: 'allergy', medical: 'medical', custody: 'shield', dietary: 'leaf' };
  const STATUS_BADGE = { active: 'badge--success', starting: 'badge--info', withdrawn: 'badge--error', graduated: '' };
  const AGE_BANDS = [
    { id: 'under-3', label: 'Under 3', min: 0, max: 36 },
    { id: '3-4', label: '3–4 years', min: 36, max: 48 },
    { id: '4-5', label: '4–5 years', min: 48, max: 60 },
    { id: '5-6', label: '5–6 years', min: 60, max: 72 },
    { id: '6-plus', label: '6 and over', min: 72, max: Infinity }
  ];
  const CURRENT = ['active', 'starting'];

  const name = c => store.childName(c);
  const initials = c => `${c.firstName[0] || ''}${c.lastName[0] || ''}`.toUpperCase();
  const ageText = c => { const a = store.ageParts(c.dob); return `${a.years}y ${a.months}m`; };
  const ageLong = c => { const a = store.ageParts(c.dob); return `${a.years} year${a.years === 1 ? '' : 's'}, ${a.months} month${a.months === 1 ? '' : 's'}`; };
  const date = d => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const photo = (c, cls = '') => c.photo
    ? `<img class="kid-photo ${cls}" src="${esc(c.photo)}" alt="" width="64" height="64">`
    : `<span class="kid-photo kid-photo--initials ${cls}" aria-hidden="true">${esc(initials(c))}</span>`;
  const alertLabel = a => `${store.ALERT_TYPES[a.type]}: ${a.detail}`;
  const alertsHtml = c => c.alerts.length
    ? `<ul class="kid-alerts" aria-label="Safety alerts for ${esc(name(c))}">${c.alerts.map((a, i) => `<li><button class="kid-alert kid-alert--${a.type}" type="button" data-alert="${esc(c.id)}:${i}" aria-label="${esc(alertLabel(a))}" aria-describedby="kids-tip" aria-expanded="false">${icon(ALERT_ICON[a.type])}</button></li>`).join('')}</ul>`
    : '<span class="kid-alerts kid-alerts--none">No alerts</span>';

  function flash(title, text) { try { sessionStorage.setItem(FLASH_KEY, JSON.stringify({ title, text })); } catch { /* toast is optional */ } }
  function takeFlash() {
    try { const f = JSON.parse(sessionStorage.getItem(FLASH_KEY)); sessionStorage.removeItem(FLASH_KEY); if (f) window.NexoraToast?.show(f.title, f.text); } catch { /* nothing */ }
  }

  /* ------------------------------------------------------------------ CSV */

  const csvCell = v => { const s = String(v ?? ''); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  function downloadCsv(list, filename) {
    const header = ['Child name', 'First name', 'Last name', 'Date of birth', 'Age', 'Class', 'Primary guardian', 'Relation', 'Phone', 'Email', 'Start date', 'Status', 'Alert categories', 'Alert details'];
    const rows = list.map(c => [name(c), c.firstName, c.lastName, c.dob, ageText(c), c.cls, c.guardian.name, c.guardian.relation, c.guardian.phone, c.guardian.email, c.startDate, store.CHILD_STATUSES[c.status],
      c.alerts.map(a => store.ALERT_TYPES[a.type]).join('; '), c.alerts.map(alertLabel).join('; ')]);
    // BOM so spreadsheet apps read the file as UTF-8 (Tamil names, dashes).
    const text = '﻿' + [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ------------------------------------------------------------------ Dialog helper (same pattern as NexoraWorkflows) */

  function dialog({ label, title, desc, body, submit, danger = false, onSubmit }) {
    const opener = document.activeElement;
    const el = document.createElement('dialog');
    el.className = 'modal';
    el.setAttribute('aria-labelledby', 'kd-title');
    el.innerHTML = `
      <form class="modal__panel" novalidate>
        <span class="modal__grabber" aria-hidden="true"></span>
        <div class="modal__top">
          <span class="tech-label">${esc(label)}</span>
          <button class="btn btn--icon-ghost" type="button" aria-label="Close" data-close>${icon('x')}</button>
        </div>
        <div class="modal__body">
          <h2 class="modal__title" id="kd-title">${esc(title)}</h2>
          ${desc ? `<p class="modal__desc">${desc}</p>` : ''}
          ${body}
          <p class="field__hint field__hint--error" data-form-error role="alert" hidden></p>
        </div>
        <div class="modal__foot">
          <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" type="submit">${esc(submit)}</button>
          <button class="btn btn--secondary" type="button" data-close>Cancel</button>
        </div>
      </form>`;
    document.body.appendChild(el);
    const form = el.querySelector('form');
    const btn = form.querySelector('[type="submit"]');
    let busy = false;
    const close = () => {
      if (busy || el.classList.contains('is-closing')) return;
      el.classList.add('is-closing');
      const done = () => { el.close(); el.remove(); if (opener && document.contains(opener)) opener.focus(); };
      reduceMotion.matches ? done() : setTimeout(done, 170);
    };
    const showErrors = (errors = {}) => {
      form.querySelectorAll('[data-error-for]').forEach(h => { h.hidden = true; });
      form.querySelectorAll('[aria-invalid="true"]').forEach(i => i.setAttribute('aria-invalid', 'false'));
      let first = null;
      Object.entries(errors).forEach(([k, msg]) => {
        const hint = form.querySelector(`[data-error-for="${k}"]`);
        if (hint) { hint.innerHTML = `${icon('info')}${esc(msg)}`; hint.hidden = false; }
        const input = form.elements[k];
        input?.setAttribute('aria-invalid', 'true');
        first = first || input;
      });
      first?.focus();
    };
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (busy) return;
      const formError = form.querySelector('[data-form-error]');
      formError.hidden = true;
      busy = true;
      btn.classList.add('is-loading');
      btn.setAttribute('aria-busy', 'true');
      const original = btn.innerHTML;
      btn.innerHTML = `<span class="spinner" aria-hidden="true"></span>Saving…`;
      let r;
      try { r = await onSubmit(form); } catch { r = { ok: false, reason: 'storage' }; }
      busy = false;
      btn.classList.remove('is-loading');
      btn.removeAttribute('aria-busy');
      btn.innerHTML = original;
      if (r.ok) { close(); return; }
      if (r.errors) { showErrors(r.errors); return; }
      formError.innerHTML = `${icon('info')}${esc(r.message || 'This couldn’t be saved. Nothing was changed. Please try again.')}`;
      formError.hidden = false;
    });
    el.addEventListener('cancel', e => { e.preventDefault(); close(); });
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-close]')) close(); });
    el.showModal();
    (form.querySelector('.modal__body select, .modal__body input, .modal__body textarea') || btn).focus();
    return { el, form, close };
  }

  const field = (id, label, control, { required = false, hint = '' } = {}) => `
    <div class="field">
      <label class="field__label" for="${id}">${esc(label)}${required ? ' <span class="field__req" aria-hidden="true">*</span>' : ''}</label>
      ${control}
      ${hint ? `<p class="field__hint">${esc(hint)}</p>` : ''}
      <p class="field__hint field__hint--error" id="${id}-error" data-error-for="${id.replace(/^kd-/, '')}" hidden></p>
    </div>`;

  const FAIL = {
    forbidden: 'Your role can’t change children’s records. Nothing was saved.',
    closed: 'Withdrawn or graduated children can’t be moved. Nothing was saved.',
    missing: 'One of these children no longer exists. Refresh and try again.',
    storage: 'This couldn’t be saved on this device. Nothing was changed. Please try again.'
  };

  function moveDialog(user, kids, done) {
    const scope = store.classScope(user);
    const single = kids.length === 1;
    const current = [...new Set(kids.map(c => c.cls))];
    const options = scope.filter(c => !(single && c === kids[0].cls));
    dialog({
      label: 'Children / Move class',
      title: single ? `Move ${name(kids[0])}` : `Move ${kids.length} children`,
      desc: single ? `Currently in <b>${esc(kids[0].cls)}</b>.` : `Currently in ${current.map(c => `<b>${esc(c)}</b>`).join(', ')}.`,
      body: field('kd-cls', 'Move to', `<select class="input" id="kd-cls" name="cls" required aria-describedby="kd-cls-error"><option value="">Choose a class</option>${options.map(c => `<option>${esc(c)}</option>`).join('')}</select>`, { required: true, hint: 'Attendance and ratios use the new class from today.' }),
      submit: single ? 'Move child' : `Move ${kids.length} children`,
      async onSubmit(form) {
        const cls = form.elements.cls.value;
        if (!cls) return { ok: false, errors: { cls: 'Choose a class to move to.' } };
        const r = await store.moveChildren(store.currentUser(), kids.map(c => c.id), cls);
        if (r.ok) { window.NexoraToast?.show(single ? 'Class changed' : `${r.moved} children moved`, `${single ? name(kids[0]) : 'Selected children'} now in ${cls}.`); done?.(r); return r; }
        return { ...r, message: FAIL[r.reason] };
      }
    });
  }

  function withdrawDialog(user, c, done) {
    dialog({
      label: 'Children / Withdraw',
      title: `Withdraw ${name(c)}?`,
      desc: `${esc(name(c))} (${esc(c.cls)}) will be marked Withdrawn and leave today’s registers. Their record, alerts and history are kept.`,
      body: `
        ${field('kd-date', 'Last day at school', `<input class="input" type="date" id="kd-date" name="date" value="${store.today()}" required aria-describedby="kd-date-error">`, { required: true })}
        ${field('kd-reason', 'Reason', `<textarea class="input" id="kd-reason" name="reason" rows="3" required aria-describedby="kd-reason-error" placeholder="For example: family relocating"></textarea>`, { required: true })}`,
      submit: 'Withdraw child',
      danger: true,
      async onSubmit(form) {
        const r = await store.withdrawChild(store.currentUser(), c.id, { date: form.elements.date.value, reason: form.elements.reason.value });
        if (r.ok) { window.NexoraToast?.show('Child withdrawn', `${name(c)} is now Withdrawn. The record is kept.`); done?.(r); return r; }
        return { ...r, message: FAIL[r.reason] };
      }
    });
  }

  /* ------------------------------------------------------------------ S12 Children */

  function childrenPage(main, user) {
    const manage = store.canManageChildren(user);
    const canMessage = store.canAccess(user, 'communication') && store.isEntitled('communication');
    const scope = store.classScope(user);
    const prefs = store.getChildPrefs(user);
    const state = { q: '', cls: new Set(), age: new Set(), status: new Set(), alerts: new Set(), view: prefs.view === 'list' ? 'list' : 'grid', selected: new Set() };
    let loaded = false;
    let failOnce = params.get('fail') === '1';

    const GROUPS = [
      { key: 'cls', label: 'Class', options: () => scope.map(c => [c, c]) },
      { key: 'age', label: 'Age band', options: () => AGE_BANDS.map(b => [b.id, b.label]) },
      { key: 'status', label: 'Status', options: () => Object.entries(store.CHILD_STATUSES) },
      { key: 'alerts', label: 'Alerts', options: () => [['any', 'All alerts'], ...Object.entries(store.ALERT_TYPES)] }
    ];
    const optionLabel = (key, value) => (GROUPS.find(g => g.key === key).options().find(([v]) => v === value) || [, value])[1];
    const activeCount = () => GROUPS.reduce((n, g) => n + state[g.key].size, 0);

    const inScope = () => store.getChildren().filter(c => scope.includes(c.cls));
    function matches(c) {
      const q = state.q.trim().toLowerCase().replace(/\s+/g, ' ');
      if (q) {
        const hay = [c.firstName, c.lastName, name(c), c.guardian.name].map(s => s.toLowerCase());
        if (!hay.some(h => h.includes(q))) return false;
      }
      if (state.cls.size && !state.cls.has(c.cls)) return false;
      if (state.age.size) {
        const m = store.ageParts(c.dob).total;
        if (![...state.age].some(id => { const b = AGE_BANDS.find(x => x.id === id); return m >= b.min && m < b.max; })) return false;
      }
      // With no status chosen the list shows current children (active and starting soon).
      if (state.status.size ? !state.status.has(c.status) : !CURRENT.includes(c.status)) return false;
      if (state.alerts.size) {
        const types = c.alerts.map(a => a.type);
        if (!(state.alerts.has('any') && types.length) && !types.some(t => state.alerts.has(t))) return false;
      }
      return true;
    }
    const results = () => inScope().filter(matches).sort((a, b) => a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName));

    document.title = 'Children · Nexora';
    main.classList.add('kids-page');
    main.innerHTML = `
      <div class="kids">
        <header class="kids-head">
          <div class="kids-head__text">
            <h1 class="kids-head__title" id="page-title" tabindex="-1">Children <span class="kids-head__count" data-total></span></h1>
            <p class="kids-head__sub" data-summary aria-live="polite"></p>
          </div>
          <div class="kids-head__actions">
            <button class="btn btn--secondary" type="button" data-export>${icon('download', 'icon--sm')}Export</button>
            ${manage ? `<a class="btn btn--primary kids-yellow kids-head__enrol" href="${routes.page('enrol')}">${icon('user-plus', 'icon--sm')}Enrol child</a>` : ''}
          </div>
        </header>

        <div class="kids-toolbar">
          <div class="input-wrap input-wrap--lead kids-search">
            ${icon('search')}
            <label class="sr-only" for="kids-q">Search by child or parent name</label>
            <input class="input" id="kids-q" type="search" placeholder="Search by child or parent name" autocomplete="off" spellcheck="false" data-q>
          </div>
          <div class="kids-filters" data-filters>
            ${GROUPS.map(g => `
              <div class="kids-filter" data-group="${g.key}">
                <button class="kids-filter__btn" type="button" aria-expanded="false" aria-controls="kf-${g.key}" data-filter-btn>${esc(g.label)}<span class="kids-filter__n" data-n></span>${icon('chevron-down', 'icon--sm')}</button>
                <div class="kids-filter__panel" id="kf-${g.key}" role="group" aria-label="${esc(g.label)}" hidden></div>
              </div>`).join('')}
          </div>
          <button class="btn btn--secondary kids-filter-open" type="button" aria-haspopup="dialog" data-sheet-open>${icon('filter', 'icon--sm')}Filter<span class="kids-filter__n" data-sheet-n></span></button>
          <div class="segmented kids-view" role="group" aria-label="View">
            <button type="button" aria-pressed="false" data-view="grid">${icon('grid', 'icon--sm')}<span>Grid</span></button>
            <button type="button" aria-pressed="false" data-view="list">${icon('list', 'icon--sm')}<span>List</span></button>
          </div>
        </div>

        <div class="kids-chips" data-chips hidden></div>

        <div class="kids-bulk" data-bulk hidden>
          <span class="kids-bulk__count" aria-live="polite"><b data-bulk-n>0</b> selected</span>
          <div class="kids-bulk__actions">
            <button class="btn btn--sm btn--secondary" type="button" data-bulk-export>${icon('download', 'icon--sm')}Export CSV</button>
            ${canMessage ? `<button class="btn btn--sm btn--secondary" type="button" data-bulk-message>${icon('message', 'icon--sm')}Message families</button>` : ''}
            ${manage ? `<button class="btn btn--sm btn--secondary" type="button" data-bulk-move>${icon('move', 'icon--sm')}Move class</button>` : ''}
            <button class="btn btn--sm btn--ghost" type="button" data-bulk-clear>Clear selection</button>
          </div>
        </div>

        <section class="kids-results" aria-labelledby="page-title" data-results aria-busy="true"></section>
        <div class="kids-tip" id="kids-tip" role="tooltip" hidden></div>
        ${manage ? `<a class="fab fab--fixed kids-fab" href="${routes.page('enrol')}" aria-label="Enrol child">${icon('plus')}</a>` : ''}
      </div>`;

    const $ = s => main.querySelector(s);
    const resultsEl = $('[data-results]');
    const tip = $('#kids-tip');

    /* ----------------------------- Filters: desktop popovers */

    const panelHtml = (g, selected, prefix) => g.options().map(([v, l]) => `
      <label class="check kids-opt"><input type="checkbox" name="${prefix}-${g.key}" value="${esc(v)}"${selected.has(v) ? ' checked' : ''}>${esc(l)}</label>`).join('');

    function renderFilterButtons() {
      main.querySelectorAll('[data-group]').forEach(wrap => {
        const n = state[wrap.dataset.group].size;
        const badge = wrap.querySelector('[data-n]');
        badge.textContent = n ? n : '';
        badge.hidden = !n;
        wrap.querySelector('[data-filter-btn]').classList.toggle('is-active', n > 0);
      });
      const total = activeCount();
      const sheetN = $('[data-sheet-n]');
      sheetN.textContent = total ? total : '';
      sheetN.hidden = !total;
      $('[data-sheet-open]').setAttribute('aria-label', total ? `Filter, ${total} active` : 'Filter');
    }

    let openFilter = null;
    function closeFilter(focusBtn = false) {
      if (!openFilter) return;
      const btn = openFilter.querySelector('[data-filter-btn]');
      openFilter.querySelector('.kids-filter__panel').hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      if (focusBtn) btn.focus();
      openFilter = null;
    }
    $('[data-filters]').addEventListener('click', e => {
      const btn = e.target.closest('[data-filter-btn]');
      if (!btn) return;
      const wrap = btn.closest('[data-group]');
      if (openFilter === wrap) { closeFilter(); return; }
      closeFilter();
      const g = GROUPS.find(x => x.key === wrap.dataset.group);
      const panel = wrap.querySelector('.kids-filter__panel');
      panel.innerHTML = panelHtml(g, state[g.key], 'kf');
      panel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      openFilter = wrap;
      panel.querySelector('input')?.focus();
    });
    $('[data-filters]').addEventListener('change', e => {
      const input = e.target.closest('input[type="checkbox"]');
      if (!input) return;
      const key = input.closest('[data-group]').dataset.group;
      input.checked ? state[key].add(input.value) : state[key].delete(input.value);
      update();
    });
    document.addEventListener('click', e => { if (openFilter && !openFilter.contains(e.target)) closeFilter(); });
    main.addEventListener('keydown', e => { if (e.key === 'Escape' && openFilter) { e.stopPropagation(); closeFilter(true); } });

    /* ----------------------------- Filters: mobile sheet */

    $('[data-sheet-open]').addEventListener('click', () => {
      const staged = Object.fromEntries(GROUPS.map(g => [g.key, new Set(state[g.key])]));
      const d = dialog({
        label: 'Children / Filter',
        title: 'Filter children',
        desc: '',
        body: `<div class="kids-sheet">${GROUPS.map(g => `<fieldset class="kids-sheet__group"><legend>${esc(g.label)}</legend><div class="kids-sheet__opts">${panelHtml(g, staged[g.key], 'ks')}</div></fieldset>`).join('')}</div>`,
        submit: 'Apply',
        onSubmit: async form => {
          GROUPS.forEach(g => { state[g.key] = new Set([...form.querySelectorAll(`[name="ks-${g.key}"]:checked`)].map(i => i.value)); });
          update();
          return { ok: true };
        }
      });
      d.el.classList.add('kids-sheet-modal');
      const foot = d.form.querySelector('.modal__foot');
      foot.querySelector('[data-close]').outerHTML = '<button class="btn btn--secondary" type="button" data-sheet-reset>Reset</button>';
      foot.querySelector('[data-sheet-reset]').addEventListener('click', () => { d.form.querySelectorAll('input[type="checkbox"]').forEach(i => { i.checked = false; }); });
    });

    /* ----------------------------- Chips */

    function renderChips() {
      const chips = GROUPS.flatMap(g => [...state[g.key]].map(v => ({ key: g.key, value: v, text: `${g.label}: ${optionLabel(g.key, v)}` })));
      const el = $('[data-chips]');
      el.hidden = !chips.length;
      el.innerHTML = chips.length ? `
        <ul class="kids-chips__list" aria-label="Active filters">${chips.map(c => `<li><span class="kids-chip">${esc(c.text)}<button type="button" aria-label="Remove filter ${esc(c.text)}" data-chip="${c.key}" data-value="${esc(c.value)}">${icon('x', 'icon--sm')}</button></span></li>`).join('')}</ul>
        <button class="btn btn--sm btn--tertiary" type="button" data-clear-all>Clear all</button>` : '';
    }
    $('[data-chips]').addEventListener('click', e => {
      const x = e.target.closest('[data-chip]');
      if (x) {
        state[x.dataset.chip].delete(x.dataset.value);
        const next = x.closest('li').nextElementSibling?.querySelector('button') || x.closest('li').previousElementSibling?.querySelector('button');
        update();
        (next && document.contains(next) ? next : $('[data-q]')).focus();
        return;
      }
      if (e.target.closest('[data-clear-all]')) { clearFilters(); $('[data-q]').focus(); }
    });
    function clearFilters({ search = false } = {}) {
      GROUPS.forEach(g => state[g.key].clear());
      if (search) { state.q = ''; $('[data-q]').value = ''; }
      update();
    }

    /* ----------------------------- Search + view toggle */

    $('[data-q]').addEventListener('input', e => { state.q = e.target.value; update(); });
    main.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
      if (state.view === b.dataset.view) return;
      state.view = b.dataset.view;
      store.saveChildPrefs(user, { view: state.view });
      update();
    }));

    /* ----------------------------- Results */

    const cardHtml = (c, i) => `
      <article class="kid-card${state.selected.has(c.id) ? ' is-selected' : ''}" style="--i:${Math.min(i, 12)}" data-id="${esc(c.id)}">
        <label class="check kid-card__check"><input type="checkbox" data-select="${esc(c.id)}"${state.selected.has(c.id) ? ' checked' : ''} aria-label="Select ${esc(name(c))}"></label>
        ${rowMenu(c, 'kid-card__menu')}
        ${photo(c, 'kid-card__photo')}
        <h2 class="kid-card__name"><a class="kid-card__link" href="${routes.record(c.id)}"><span class="kid-card__first">${esc(c.firstName)}</span> <span class="kid-card__last">${esc(c.lastName)}</span></a></h2>
        <p class="kid-card__age" aria-label="Age ${esc(ageLong(c))}">${esc(ageText(c))}</p>
        <span class="kid-card__class">${esc(c.cls)}</span>
        ${c.status !== 'active' ? `<span class="badge ${STATUS_BADGE[c.status]} kid-card__status">${esc(store.CHILD_STATUSES[c.status])}</span>` : ''}
        <div class="kid-card__alerts">${alertsHtml(c)}</div>
      </article>`;

    function rowMenu(c, cls = '') {
      const closed = ['withdrawn', 'graduated'].includes(c.status);
      return `
        <div class="menu-wrap ${cls}">
          <button class="btn btn--icon-ghost kid-menu-btn" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(name(c))}" data-menu="${esc(c.id)}">${icon('more-v')}</button>
          <div class="menu" role="menu" hidden>
            <button type="button" role="menuitem" data-act="view">${icon('eye', 'icon--sm')}View</button>
            ${manage ? `<button type="button" role="menuitem" data-act="edit">${icon('pencil', 'icon--sm')}Edit</button>` : ''}
            ${manage && !closed ? `<button type="button" role="menuitem" data-act="move">${icon('move', 'icon--sm')}Move class</button>` : ''}
            ${manage && c.status !== 'withdrawn' && c.status !== 'graduated' ? `<hr><button class="is-danger" type="button" role="menuitem" data-act="withdraw">${icon('user-minus', 'icon--sm')}Withdraw</button>` : ''}
          </div>
        </div>`;
    }

    function tableHtml(list) {
      const all = list.length && list.every(c => state.selected.has(c.id));
      const some = list.some(c => state.selected.has(c.id));
      return `
        <div class="table-shell kids-table">
          <table class="data-table" aria-label="Children">
            <thead><tr>
              <th class="cell-check" scope="col"><label class="check"><input type="checkbox" data-select-all${all ? ' checked' : ''}${!all && some ? ' data-indeterminate' : ''} aria-label="Select all ${list.length} children shown"></label></th>
              <th scope="col">Child</th><th scope="col" class="col-age">Age</th><th scope="col">Class</th><th scope="col">Primary guardian</th>
              <th scope="col" class="col-start">Start date</th><th scope="col">Status</th><th scope="col">Alerts</th>
              <th class="cell-action" scope="col"><span class="sr-only">Actions</span></th>
            </tr></thead>
            <tbody>${list.map(c => `
              <tr class="kid-row${state.selected.has(c.id) ? ' is-selected' : ''}" data-id="${esc(c.id)}" data-href="${routes.record(c.id)}">
                <td class="cell-check"><label class="check"><input type="checkbox" data-select="${esc(c.id)}"${state.selected.has(c.id) ? ' checked' : ''} aria-label="Select ${esc(name(c))}"></label></td>
                <td class="cell-student"><span class="kid-row__who">${photo(c, 'kid-photo--sm')}<a class="kid-row__name" href="${routes.record(c.id)}">${esc(name(c))}</a></span></td>
                <td class="col-age" data-label="Age"><span aria-label="${esc(ageLong(c))}">${esc(ageText(c))}</span></td>
                <td data-label="Class">${esc(c.cls)}</td>
                <td data-label="Guardian"><span class="kid-row__guardian">${esc(c.guardian.name)}<small>${esc(c.guardian.relation)}</small></span></td>
                <td class="col-start" data-label="Start date"><time datetime="${esc(c.startDate)}">${esc(date(c.startDate))}</time></td>
                <td data-label="Status"><span class="badge ${STATUS_BADGE[c.status]}">${esc(store.CHILD_STATUSES[c.status])}</span></td>
                <td data-label="Alerts">${alertsHtml(c)}</td>
                <td class="cell-action">${rowMenu(c)}</td>
              </tr>`).join('')}</tbody>
          </table>
        </div>`;
    }

    const emptyHtml = everyone => everyone
      ? `<div class="kids-empty"><span class="state-icon" aria-hidden="true">${icon('users')}</span><h2 class="kids-empty__title">No children enrolled yet</h2><p>Children you enrol appear here, with their alerts and guardians.</p>${manage ? `<a class="btn btn--primary" href="${routes.page('enrol')}">${icon('user-plus', 'icon--sm')}Enrol child</a>` : ''}</div>`
      : `<div class="kids-empty"><span class="state-icon" aria-hidden="true">${icon('search')}</span><h2 class="kids-empty__title">No children match these filters</h2><p>Try a different name, or clear the filters to see everyone.</p><button class="btn btn--secondary" type="button" data-clear-filters>Clear filters</button></div>`;

    function update() {
      if (!loaded) return;
      closeTip();
      const all = inScope();
      const list = results();
      // Selection only ever covers children that are on screen.
      const visible = new Set(list.map(c => c.id));
      [...state.selected].forEach(id => { if (!visible.has(id)) state.selected.delete(id); });

      const current = all.filter(c => CURRENT.includes(c.status)).length;
      $('[data-total]').textContent = `(${current})`;
      const filtered = state.q.trim() || activeCount();
      $('[data-summary]').textContent = filtered
        ? `${list.length} ${list.length === 1 ? 'child matches' : 'children match'} your search and filters`
        : `${current} current ${current === 1 ? 'child' : 'children'}${all.length > current ? ` · ${all.length - current} withdrawn or graduated (use the Status filter)` : ''}`;
      $('[data-export]').disabled = !list.length;

      main.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
      renderFilterButtons();
      renderChips();

      resultsEl.removeAttribute('aria-busy');
      if (!list.length) resultsEl.innerHTML = emptyHtml(!all.length);
      else if (state.view === 'grid') {
        const allSel = list.every(c => state.selected.has(c.id));
        resultsEl.innerHTML = `
          <div class="kids-gridbar"><label class="check"><input type="checkbox" data-select-all${allSel ? ' checked' : ''}${!allSel && state.selected.size ? ' data-indeterminate' : ''}>Select all ${list.length}</label></div>
          <div class="kids-grid">${list.map(cardHtml).join('')}</div>`;
      } else resultsEl.innerHTML = tableHtml(list);
      resultsEl.querySelectorAll('[data-indeterminate]').forEach(i => { i.indeterminate = true; });
      renderBulk();
    }

    function renderBulk() {
      const n = state.selected.size;
      const bar = $('[data-bulk]');
      bar.hidden = !n;
      $('[data-bulk-n]').textContent = n;
      main.classList.toggle('has-selection', n > 0);
    }

    function setSelected(id, on) {
      on ? state.selected.add(id) : state.selected.delete(id);
      resultsEl.querySelectorAll(`[data-id="${CSS.escape(id)}"]`).forEach(el => el.classList.toggle('is-selected', on));
      const list = results();
      const sel = list.filter(c => state.selected.has(c.id)).length;
      resultsEl.querySelectorAll('[data-select-all]').forEach(i => { i.checked = sel === list.length && sel > 0; i.indeterminate = sel > 0 && sel < list.length; });
      renderBulk();
    }

    resultsEl.addEventListener('change', e => {
      const one = e.target.closest('[data-select]');
      if (one) { setSelected(one.dataset.select, one.checked); return; }
      const all = e.target.closest('[data-select-all]');
      if (all) {
        results().forEach(c => (all.checked ? state.selected.add(c.id) : state.selected.delete(c.id)));
        update();
        resultsEl.querySelector('[data-select-all]')?.focus();
      }
    });

    /* ----------------------------- Row navigation, menus, alert tooltips */

    let openMenu = null;
    function closeMenu(focusBtn = false) {
      if (!openMenu) return;
      openMenu.querySelector('.menu').hidden = true;
      const btn = openMenu.querySelector('[data-menu]');
      btn.setAttribute('aria-expanded', 'false');
      if (focusBtn) btn.focus();
      openMenu.closest('.kid-card, .kid-row')?.classList.remove('has-menu');
      openMenu = null;
    }
    function act(action, id) {
      const c = store.childById(id);
      if (!c) return;
      if (action === 'view') location.href = routes.record(id);
      if (action === 'edit') location.href = routes.page('enrol', { id });
      if (action === 'move') moveDialog(user, [c]);
      if (action === 'withdraw') withdrawDialog(user, c);
    }

    resultsEl.addEventListener('click', e => {
      if (e.target.closest('[data-clear-filters]')) { clearFilters({ search: true }); $('[data-q]').focus(); return; }
      const menuBtn = e.target.closest('[data-menu]');
      if (menuBtn) {
        const wrap = menuBtn.closest('.menu-wrap');
        if (openMenu === wrap) { closeMenu(); return; }
        closeMenu();
        const menu = wrap.querySelector('.menu');
        menu.hidden = false;
        // Open upwards when the menu would run off the bottom of the screen.
        menu.classList.toggle('is-up', menuBtn.getBoundingClientRect().bottom + 200 > innerHeight);
        menuBtn.setAttribute('aria-expanded', 'true');
        wrap.closest('.kid-card, .kid-row')?.classList.add('has-menu');
        openMenu = wrap;
        menu.querySelector('button').focus();
        return;
      }
      const item = e.target.closest('[data-act]');
      if (item) { const id = item.closest('.menu-wrap').querySelector('[data-menu]').dataset.menu; closeMenu(); act(item.dataset.act, id); return; }
      const alertBtn = e.target.closest('[data-alert]');
      if (alertBtn) { e.preventDefault(); tipFor === alertBtn ? closeTip() : showTip(alertBtn, true); return; }
      // A row click opens the child unless it came from a control inside the row.
      const row = e.target.closest('.kid-row');
      if (row && !e.target.closest('a, button, input, label, .menu')) location.href = row.dataset.href;
    });
    resultsEl.addEventListener('keydown', e => {
      if (!openMenu) return;
      const items = [...openMenu.querySelectorAll('.menu button')];
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); }
      if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
      if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
      if (e.key === 'Tab') closeMenu();
    });
    document.addEventListener('click', e => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); });

    let tipFor = null;
    function showTip(btn, pinned = false) {
      const [id, idx] = btn.dataset.alert.split(':');
      const a = store.childById(id)?.alerts[Number(idx)];
      if (!a) return;
      if (tipFor && tipFor !== btn) tipFor.setAttribute('aria-expanded', 'false');
      tip.innerHTML = `<span class="kids-tip__type kids-tip__type--${a.type}">${icon(ALERT_ICON[a.type], 'icon--sm')}${esc(store.ALERT_TYPES[a.type])}</span><span>${esc(a.detail)}</span>`;
      tip.hidden = false;
      tip.dataset.pinned = pinned ? '1' : '';
      btn.setAttribute('aria-expanded', 'true');
      tipFor = btn;
      const r = btn.getBoundingClientRect();
      const w = tip.offsetWidth;
      const h = tip.offsetHeight;
      const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), document.documentElement.clientWidth - w - 8);
      const above = r.top - h - 8 > 8;
      tip.style.left = `${left + scrollX}px`;
      tip.style.top = `${(above ? r.top - h - 8 : r.bottom + 8) + scrollY}px`;
      tip.classList.toggle('is-below', !above);
    }
    function closeTip() {
      if (!tipFor) return;
      tipFor.setAttribute('aria-expanded', 'false');
      tip.hidden = true;
      tipFor = null;
    }
    resultsEl.addEventListener('mouseover', e => { const b = e.target.closest('[data-alert]'); if (b && b !== tipFor) showTip(b); });
    resultsEl.addEventListener('mouseout', e => { const b = e.target.closest('[data-alert]'); if (b && b === tipFor && !tip.dataset.pinned && !b.contains(e.relatedTarget)) closeTip(); });
    resultsEl.addEventListener('focusin', e => { const b = e.target.closest('[data-alert]'); if (b) showTip(b); });
    resultsEl.addEventListener('focusout', e => { const b = e.target.closest('[data-alert]'); if (b && b === tipFor) closeTip(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && tipFor) closeTip(); });
    document.addEventListener('click', e => { if (tipFor && !e.target.closest('[data-alert]')) closeTip(); });
    addEventListener('scroll', () => { if (tipFor && !tip.dataset.pinned) closeTip(); }, { passive: true });

    /* ----------------------------- Export + bulk actions */

    const stamp = () => store.today();
    $('[data-export]').addEventListener('click', () => {
      const list = results();
      downloadCsv(list, `children-${stamp()}.csv`);
      window.NexoraToast?.show('Export ready', `${list.length} ${list.length === 1 ? 'child' : 'children'} exported to CSV.`);
    });
    const selectedKids = () => results().filter(c => state.selected.has(c.id));
    $('[data-bulk-export]').addEventListener('click', () => {
      const list = selectedKids();
      downloadCsv(list, `children-selected-${stamp()}.csv`);
      window.NexoraToast?.show('Export ready', `${list.length} selected ${list.length === 1 ? 'child' : 'children'} exported to CSV.`);
    });
    $('[data-bulk-message]')?.addEventListener('click', () => { location.href = routes.page('compose', { children: selectedKids().map(c => c.id).join(',') }); });
    $('[data-bulk-move]')?.addEventListener('click', () => {
      const list = selectedKids();
      const closed = list.filter(c => ['withdrawn', 'graduated'].includes(c.status));
      if (closed.length) { window.NexoraToast?.show('Can’t move these children', `${closed.map(name).join(', ')} ${closed.length === 1 ? 'is' : 'are'} withdrawn or graduated. Unselect them and try again.`, 'info'); return; }
      moveDialog(user, list, () => { state.selected.clear(); update(); });
    });
    $('[data-bulk-clear]').addEventListener('click', () => { state.selected.clear(); update(); $('[data-q]').focus(); });

    /* ----------------------------- Load, live updates */

    function skeleton() {
      resultsEl.setAttribute('aria-busy', 'true');
      resultsEl.innerHTML = `<p class="sr-only">Loading children…</p><div class="kids-grid" aria-hidden="true">${Array.from({ length: 10 }, () => `
        <div class="kid-card kid-card--skeleton"><span class="skeleton sk-circle kid-card__photo"></span><span class="skeleton sk-line w-70"></span><span class="skeleton sk-line w-40"></span><span class="skeleton sk-line w-50"></span></div>`).join('')}</div>`;
    }
    function load() {
      skeleton();
      setTimeout(() => {
        try {
          if (failOnce) { failOnce = false; throw new Error('demo failure'); }
          store.getChildren();
          loaded = true;
          update();
        } catch {
          resultsEl.removeAttribute('aria-busy');
          resultsEl.innerHTML = `<div class="kids-empty" role="alert"><span class="state-icon state-icon--error" aria-hidden="true">${icon('alert-circle')}</span><h2 class="kids-empty__title">Something went wrong</h2><p>We couldn’t load the children’s records. Nothing has changed.</p><button class="btn btn--secondary" type="button" data-retry>${icon('refresh', 'icon--sm')}Try again</button></div>`;
          resultsEl.querySelector('[data-retry]').addEventListener('click', load);
        }
      }, reduceMotion.matches ? 0 : 450);
    }

    let queued = false;
    store.subscribe(({ key }) => {
      if (!loaded || (key && !key.startsWith('nexora-children:'))) return;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const active = document.activeElement;
        const keep = active && resultsEl.contains(active) ? (active.dataset.select || active.dataset.menu) : null;
        update();
        if (keep) resultsEl.querySelector(`[data-select="${CSS.escape(keep)}"], [data-menu="${CSS.escape(keep)}"]`)?.focus();
      });
    });

    takeFlash();
    load();
    return true;
  }

  /* ------------------------------------------------------------------ S14 Enrol / edit */

  function enrolPage(main, user) {
    const id = params.get('id');
    const child = id ? store.childById(id) : null;
    const scope = store.classScope(user);
    if (id && !child) {
      main.innerHTML = `<article class="panel record"><div class="kids-empty"><span class="state-icon" aria-hidden="true">${icon('search')}</span><h1 class="kids-empty__title">We couldn’t find that child</h1><p>The record may have been removed, or the link is incomplete.</p><a class="btn btn--primary" href="${routes.page('children')}">All children</a></div></article>`;
      return true;
    }
    const v = child || { firstName: '', lastName: '', dob: '', cls: '', startDate: store.today(), guardian: { name: '', relation: 'Mother', phone: '', email: '' }, alerts: [] };
    const alertOf = type => v.alerts.find(a => a.type === type);
    const f = (key, label, control, opts) => field(`ke-${key}`, label, control, opts).replace(`data-error-for="ke-${key}"`, `data-error-for="${key}"`);
    document.title = `${child ? `Edit ${name(child)}` : 'Enrol child'} · Nexora`;
    main.innerHTML = `
      <div class="kids kids--form">
        <nav class="kids-crumbs" aria-label="Breadcrumb"><a href="${routes.page('children')}">Children</a>${child ? ` / <a href="${routes.record(child.id)}">${esc(name(child))}</a>` : ''} / <span aria-current="page">${child ? 'Edit' : 'Enrol child'}</span></nav>
        <form class="panel kids-form" novalidate data-form>
          <header class="kids-form__head">
            <h1 class="kids-head__title" id="page-title" tabindex="-1">${child ? `Edit ${esc(name(child))}` : 'Enrol child'}</h1>
            <p class="kids-head__sub">${child ? 'Changes save to the child’s record and appear on the Children page straight away.' : 'Add a new child to the school. Fields marked * are required.'}</p>
          </header>
          <fieldset class="kids-form__section"><legend>Child</legend>
            <div class="kids-form__grid">
              ${f('firstName', 'First name', `<input class="input" id="ke-firstName" name="firstName" value="${esc(v.firstName)}" required autocomplete="off">`, { required: true })}
              ${f('lastName', 'Last name', `<input class="input" id="ke-lastName" name="lastName" value="${esc(v.lastName)}" required autocomplete="off">`, { required: true })}
              ${f('dob', 'Date of birth', `<input class="input" type="date" id="ke-dob" name="dob" value="${esc(v.dob)}" max="${store.today()}" required>`, { required: true })}
              ${f('cls', 'Class', `<select class="input" id="ke-cls" name="cls" required><option value="">Choose a class</option>${scope.map(c => `<option${c === v.cls ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>`, { required: true })}
              ${f('startDate', 'Start date', `<input class="input" type="date" id="ke-startDate" name="startDate" value="${esc(v.startDate)}" required>`, { required: true, hint: 'A future date shows the child as Starting soon.' })}
            </div>
          </fieldset>
          <fieldset class="kids-form__section"><legend>Primary guardian</legend>
            <div class="kids-form__grid">
              ${f('guardianName', 'Full name', `<input class="input" id="ke-guardianName" name="guardianName" value="${esc(v.guardian.name)}" required autocomplete="off">`, { required: true })}
              ${f('guardianRelation', 'Relation', `<select class="input" id="ke-guardianRelation" name="guardianRelation">${['Mother', 'Father', 'Guardian', 'Grandparent'].map(r => `<option${r === v.guardian.relation ? ' selected' : ''}>${r}</option>`).join('')}</select>`)}
              ${f('guardianPhone', 'Phone', `<input class="input" type="tel" id="ke-guardianPhone" name="guardianPhone" value="${esc(v.guardian.phone)}" required inputmode="tel" placeholder="+91 98400 00000">`, { required: true })}
              ${f('guardianEmail', 'Email', `<input class="input" type="email" id="ke-guardianEmail" name="guardianEmail" value="${esc(v.guardian.email)}" placeholder="name@example.com">`, { hint: 'Optional.' })}
            </div>
          </fieldset>
          <fieldset class="kids-form__section"><legend>Safety alerts</legend>
            <p class="field__hint">Tick each alert that applies and describe it exactly as staff should read it.</p>
            <div class="kids-form__alerts">
              ${Object.entries(store.ALERT_TYPES).map(([type, label]) => {
                const a = alertOf(type);
                return `<div class="kids-form__alert kids-form__alert--${type}">
                  <label class="check"><input type="checkbox" name="alert-${type}"${a ? ' checked' : ''} data-alert-toggle="${type}">${icon(ALERT_ICON[type], 'icon--sm')}${esc(label)}</label>
                  <label class="sr-only" for="ke-alert-${type}">${esc(label)} details</label>
                  <input class="input" id="ke-alert-${type}" name="alertDetail-${type}" value="${esc(a?.detail || '')}" placeholder="${type === 'allergy' ? 'e.g. Severe peanut allergy — EpiPen in office' : type === 'medical' ? 'e.g. Asthma — inhaler in class bag' : type === 'custody' ? 'e.g. Collection by mother only' : 'e.g. Vegetarian'}"${a ? '' : ' disabled'}>
                </div>`;
              }).join('')}
            </div>
            <p class="field__hint field__hint--error" data-error-for="alerts" hidden></p>
          </fieldset>
          <p class="field__hint field__hint--error" data-form-error role="alert" hidden></p>
          <div class="kids-form__foot">
            <a class="btn btn--secondary" href="${child ? routes.record(child.id) : routes.page('children')}">Cancel</a>
            <button class="btn btn--primary" type="submit">${child ? 'Save changes' : 'Enrol child'}</button>
          </div>
        </form>
      </div>`;

    const form = main.querySelector('[data-form]');
    form.addEventListener('change', e => {
      const t = e.target.closest('[data-alert-toggle]');
      if (!t) return;
      const input = form.elements[`alertDetail-${t.dataset.alertToggle}`];
      input.disabled = !t.checked;
      if (t.checked) input.focus();
    });
    let busy = false;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (busy) return;
      const data = Object.fromEntries(['firstName', 'lastName', 'dob', 'cls', 'startDate', 'guardianName', 'guardianRelation', 'guardianPhone', 'guardianEmail'].map(k => [k, form.elements[k].value]));
      const missingDetail = Object.keys(store.ALERT_TYPES).find(t => form.elements[`alert-${t}`].checked && !form.elements[`alertDetail-${t}`].value.trim());
      data.alerts = Object.keys(store.ALERT_TYPES).filter(t => form.elements[`alert-${t}`].checked).map(t => ({ type: t, detail: form.elements[`alertDetail-${t}`].value }));
      form.querySelectorAll('[data-error-for]').forEach(h => { h.hidden = true; });
      form.querySelectorAll('[aria-invalid="true"]').forEach(i => i.setAttribute('aria-invalid', 'false'));
      const formError = form.querySelector('[data-form-error]');
      formError.hidden = true;
      const btn = form.querySelector('[type="submit"]');
      busy = true;
      const label = btn.innerHTML;
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>Saving…';
      btn.setAttribute('aria-busy', 'true');
      let r = missingDetail ? { ok: false, reason: 'invalid', errors: { [`alertDetail-${missingDetail}`]: `Describe the ${store.ALERT_TYPES[missingDetail].toLowerCase()} alert, or untick it.` } } : await store.saveChild(user, data, child?.id);
      busy = false;
      btn.innerHTML = label;
      btn.removeAttribute('aria-busy');
      if (r.ok) {
        flash(child ? 'Changes saved' : 'Child enrolled', child ? `${name(r.child)}’s record is up to date.` : `${name(r.child)} joined ${r.child.cls}${r.child.status === 'starting' ? ` (starts ${date(r.child.startDate)})` : ''}.`);
        location.href = child ? routes.record(r.child.id) : routes.page('children');
        return;
      }
      if (r.errors) {
        let first = null;
        Object.entries(r.errors).forEach(([k, msg]) => {
          const hint = form.querySelector(`[data-error-for="${k}"]`) || (k.startsWith('alertDetail') ? form.querySelector('[data-error-for="alerts"]') : null);
          if (hint) { hint.innerHTML = `${icon('info')}${esc(msg)}`; hint.hidden = false; }
          const input = form.elements[k];
          input?.setAttribute('aria-invalid', 'true');
          first = first || input;
        });
        first?.focus();
        return;
      }
      formError.innerHTML = `${icon('info')}${esc(r.reason === 'duplicate' ? `${name(r.child)} (born ${date(r.child.dob)}) is already on record.` : FAIL[r.reason] || FAIL.storage)}`;
      formError.hidden = false;
    });
    main.querySelector('#page-title').focus();
    return true;
  }

  /* ------------------------------------------------------------------ S31 Message families */

  function composePage(main, user) {
    if (!store.isEntitled('communication')) { window.NexoraPlanGate?.render(main, user, 'communication'); return true; }
    const ids = (params.get('children') || '').split(',').filter(Boolean);
    const scope = store.classScope(user);
    const kids = ids.map(store.childById).filter(c => c && scope.includes(c.cls));
    // One recipient per family: the same guardian (name + phone) for siblings is listed once.
    const keyOf = g => `${g.name.toLowerCase()}|${g.phone.replace(/\D/g, '')}`;
    const families = new Map();
    const addFamily = c => {
      const k = keyOf(c.guardian);
      if (!families.has(k)) families.set(k, { key: k, guardian: c.guardian, children: [] });
      families.get(k).children.push(name(c));
    };
    kids.forEach(addFamily);
    const directory = store.getChildren().filter(c => scope.includes(c.cls) && ['active', 'starting'].includes(c.status));

    document.title = 'Message families · Nexora';
    main.innerHTML = `
      <div class="kids kids--form">
        <nav class="kids-crumbs" aria-label="Breadcrumb"><a href="${routes.page('children')}">Children</a> / <span aria-current="page">Message families</span></nav>
        <form class="panel kids-form" novalidate data-form>
          <header class="kids-form__head">
            <h1 class="kids-head__title" id="page-title" tabindex="-1">Message families</h1>
            <p class="kids-head__sub">Prototype: the message is saved to the outbox on this device. Nothing is sent to families.</p>
          </header>
          <div class="field">
            <span class="field__label" id="kc-to-label">To <span class="field__req" aria-hidden="true">*</span></span>
            <ul class="kids-recipients" aria-labelledby="kc-to-label" data-recipients></ul>
            <div class="kids-recipients__add">
              <label class="sr-only" for="kc-add">Add a family</label>
              <input class="input" id="kc-add" list="kc-dir" placeholder="Add a family by child or parent name" autocomplete="off">
              <datalist id="kc-dir">${directory.map(c => `<option value="${esc(`${c.guardian.name} — ${name(c)}`)}"></option>`).join('')}</datalist>
              <button class="btn btn--secondary" type="button" data-add>${icon('plus', 'icon--sm')}Add</button>
            </div>
            <p class="field__hint field__hint--error" data-error-for="recipients" hidden></p>
          </div>
          ${field('kc-subject', 'Subject', '<input class="input" id="kc-subject" name="subject" required autocomplete="off">', { required: true }).replace('data-error-for="kc-subject"', 'data-error-for="subject"')}
          ${field('kc-body', 'Message', '<textarea class="input" id="kc-body" name="body" rows="7" required></textarea>', { required: true }).replace('data-error-for="kc-body"', 'data-error-for="body"')}
          <p class="field__hint field__hint--error" data-form-error role="alert" hidden></p>
          <div class="kids-form__foot">
            <a class="btn btn--secondary" href="${routes.page('children')}">Cancel</a>
            <button class="btn btn--primary" type="submit">${icon('message', 'icon--sm')}Save to outbox</button>
          </div>
        </form>
      </div>`;

    const list = main.querySelector('[data-recipients]');
    const draw = () => {
      list.innerHTML = families.size ? [...families.values()].map(f => `<li><span class="kids-chip kids-chip--recipient"><span><b>${esc(f.guardian.name)}</b> <small>${esc(f.children.join(', '))}</small></span><button type="button" aria-label="Remove ${esc(f.guardian.name)}" data-remove="${esc(f.key)}">${icon('x', 'icon--sm')}</button></span></li>`).join('')
        : '<li class="kids-recipients__none">No families yet. Add one below.</li>';
    };
    draw();
    list.addEventListener('click', e => {
      const b = e.target.closest('[data-remove]');
      if (!b) return;
      families.delete(b.dataset.remove);
      draw();
      (list.querySelector('[data-remove]') || main.querySelector('#kc-add')).focus();
    });
    const addInput = main.querySelector('#kc-add');
    const add = () => {
      const val = addInput.value.trim().toLowerCase();
      if (!val) return;
      const c = directory.find(x => `${x.guardian.name} — ${name(x)}`.toLowerCase() === val) || directory.find(x => name(x).toLowerCase() === val || x.guardian.name.toLowerCase() === val);
      const hint = main.querySelector('[data-error-for="recipients"]');
      if (!c) { hint.innerHTML = `${icon('info')}No current family matches “${esc(addInput.value)}”. Pick one from the list.`; hint.hidden = false; return; }
      hint.hidden = true;
      addFamily(c);
      addInput.value = '';
      draw();
    };
    main.querySelector('[data-add]').addEventListener('click', add);
    addInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });

    const form = main.querySelector('[data-form]');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      form.querySelectorAll('[data-error-for]').forEach(h => { h.hidden = true; });
      const btn = form.querySelector('[type="submit"]');
      const label = btn.innerHTML;
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>Saving…';
      const r = await store.saveFamilyMessage(user, {
        recipients: [...families.values()].map(f => ({ name: f.guardian.name, phone: f.guardian.phone, email: f.guardian.email, children: f.children })),
        subject: form.elements.subject.value, body: form.elements.body.value
      });
      btn.innerHTML = label;
      if (r.ok) {
        flash('Message saved to outbox', `${r.message.recipients.length} ${r.message.recipients.length === 1 ? 'family' : 'families'}. Prototype: not delivered.`);
        location.href = routes.page('children');
        return;
      }
      if (r.errors) {
        let first = null;
        Object.entries(r.errors).forEach(([k, msg]) => {
          const hint = form.querySelector(`[data-error-for="${k}"]`);
          if (hint) { hint.innerHTML = `${icon('info')}${esc(msg)}`; hint.hidden = false; }
          first = first || form.elements[k] || addInput;
        });
        first?.focus();
        return;
      }
      const err = form.querySelector('[data-form-error]');
      err.innerHTML = `${icon('info')}${esc(FAIL[r.reason] || FAIL.storage)}`;
      err.hidden = false;
    });
    main.querySelector(families.size ? '#kc-subject' : '#kc-add').focus();
    return true;
  }

  function render(key, main, user) {
    if (key === 'children') return childrenPage(main, user);
    if (key === 'enrol') return enrolPage(main, user);
    if (key === 'compose') return composePage(main, user);
    return false;
  }

  window.NexoraChildren = { render, downloadCsv };
})();
