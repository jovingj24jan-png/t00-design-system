/* S09 Waitlist (app.html?page=waitlist[&cls=<classId>][&focus=<entryId>])
   One ordered list per class, with S17 seat availability. Staff reorder by dragging (or Move up / Move down), always
   with a reason; offers reuse the S07 offer letter (NexoraAdmissions.actions().offerDialog), and the store moves the
   child off the active list only once the offer is recorded. Removal keeps the record and its history.
   Test hooks: ?fail=1 (load error), ?wlfail=reorder|remove (save failure), ?sendfail=1 (offer send failure). */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const kids = window.NexoraChildren;
  const { routes } = store;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const params = new URLSearchParams(location.search);
  const toast = (t, x, i = 'info', o) => window.NexoraToast?.show(t, x, i, o);
  const day = s => (s ? new Date(/T/.test(s) ? s : `${s}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const FLASH_KEY = 'nexora-children-flash';
  const FLAG_ICON = { sibling: 'users', staff: 'user', returning: 'refresh' };
  const FAIL = {
    forbidden: 'Your role can’t change the waitlist. Nothing was changed.',
    missing: 'This child is no longer on the waitlist. The latest list is shown.',
    closed: 'This child has already left the waitlist. The latest list is shown.',
    stale: 'Someone else changed this waitlist just now. The latest order is shown — please try again.',
    storage: 'This couldn’t be saved on this device. Nothing was changed. Please try again.'
  };
  const failText = r => r.message || (r.errors && Object.values(r.errors)[0]) || FAIL[r.reason] || FAIL.storage;
  const state = (iconName, title, text, action = '', tone = '') => `<div class="kids-empty an-state"${tone === 'error' ? ' role="alert"' : ''}><span class="state-icon${tone ? ` state-icon--${tone}` : ''}" aria-hidden="true">${icon(iconName)}</span><h2 class="kids-empty__title">${title}</h2><p>${text}</p>${action}</div>`;
  const ageText = (dob, at) => { const a = store.ageAt(dob, at); return a ? `${a.years}y ${a.months}m` : '—'; };
  const periodOf = s => { if (!s) return 'unknown'; const m = s.slice(0, 7); const now = store.today().slice(0, 7); const d = new Date(); d.setMonth(d.getMonth() + 3); const lim = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; return m <= now ? 'now' : m <= lim ? 'soon' : 'later'; };
  const PERIODS = { now: 'This month or earlier', soon: 'Next 3 months', later: 'Later' };

  function render(key, main, user) {
    if (key !== 'waitlist') return false;
    page(main, user);
    return true;
  }

  function page(main, user) {
    const manage = store.canManageChildren(user);
    const offers = store.canAccess(user, 'admissions') && store.isEntitled('admissions');
    const f = { q: '', period: '', flag: '', applicant: '' };
    let clsId = params.get('cls') || '';
    let focus = params.get('focus') || '';
    let loaded = false;
    let failLoad = params.get('fail') === '1';
    const failNext = { reorder: params.get('wlfail') === 'reorder', remove: params.get('wlfail') === 'remove' };
    const failSend = { on: params.get('sendfail') === '1' };
    let openMenu = null;
    let dragId = null;
    let pending = false;
    const me = () => store.currentUser();
    const act = window.NexoraAdmissions?.actions?.(user, () => draw());

    main.classList.add('kids-page');
    document.title = 'Waitlist · Nexora';

    const classes = () => store.activeClasses().map(c => store.waitlistSummary(c.name)).filter(Boolean);
    const current = () => { const list = classes(); return list.find(c => c.id === clsId) || list.find(c => c.name === clsId) || list.find(c => c.waiting) || list[0] || null; };
    const filtered = () => Object.values(f).some(Boolean);
    const seatLine = s => (s.capacity == null ? 'capacity not set' : `${plural(s.available, 'place')} to offer`);
    const tabLine = s => `${s.capacity == null ? 'Capacity not set' : `${plural(s.free, 'seat')} free`} · ${s.waiting} waiting`;
    const syncUrl = () => { const u = new URL(location.href); u.searchParams.set('cls', clsId); u.searchParams.delete('focus'); history.replaceState(null, '', u); };

    function load() {
      main.innerHTML = `<div class="kids wt" aria-busy="true"><header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Waitlist</h1><p class="kids-head__sub">Loading the waitlist…</p></div></header>
        <div class="wt-skel" aria-hidden="true"><span class="skeleton wt-skel__tabs"></span><span class="skeleton wt-skel__strip"></span>${'<span class="skeleton wt-skel__row"></span>'.repeat(4)}</div><p class="sr-only" role="status">Loading the waitlist</p></div>`;
      setTimeout(() => {
        if (failLoad) {
          failLoad = false;
          main.innerHTML = `<div class="kids wt"><header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Waitlist</h1></div></header>${state('alert-circle', 'We couldn’t load the waitlist', 'Check your connection, then try again. Nothing has changed.', '<button class="btn btn--primary" type="button" data-retry>Try again</button>', 'error')}</div>`;
          return;
        }
        loaded = true;
        draw();
        try { const fl = JSON.parse(sessionStorage.getItem(FLASH_KEY)); sessionStorage.removeItem(FLASH_KEY); if (fl) toast(fl.title, fl.text, 'check-circle'); } catch { /* none */ }
        const row = focus && main.querySelector(`[data-id="${CSS.escape(focus)}"]`);
        if (row) { row.scrollIntoView({ block: 'center' }); row.querySelector('[data-name]')?.focus(); } else $('#page-title')?.focus();
      }, 350);
    }
    const $ = sel => main.querySelector(sel);

    function draw() {
      if (!loaded) return;
      const list = classes();
      const s = current();
      if (s) clsId = s.id;
      const head = `<header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Waitlist</h1><p class="kids-head__sub">Children waiting for a place, in the order they’ll be offered one. Being on the waitlist doesn’t enrol a child.</p></div>${store.canAccess(user, 'classes') ? `<a class="btn btn--secondary" href="${routes.page('classes')}">${icon('grid', 'icon--sm')}Classes &amp; capacity</a>` : ''}</header>`;
      if (!s) {
        main.innerHTML = `<div class="kids wt">${head}${state('grid', 'No classes yet', 'A waitlist belongs to a class. Add classes and their capacity first.', store.canAccess(user, 'classes') ? `<a class="btn btn--primary" href="${routes.page('classes')}">Go to Classes</a>` : '<p class="cd-note">Ask a school leader to set up classes.</p>')}</div>`;
        return;
      }
      const all = store.waitlistFor(s.name);
      const rows = all.filter(w => {
        if (f.q) { const q = f.q.toLowerCase(); if (!`${w.firstName} ${w.lastName} ${w.guardianName}`.toLowerCase().includes(q)) return false; }
        if (f.period && periodOf(w.startDate) !== f.period) return false;
        const flags = store.waitlistFlags(w);
        if (f.flag === 'any' ? !flags.length : f.flag && !flags.some(x => x.key === f.flag)) return false;
        if (f.applicant === 'linked' && !w.enquiryId) return false;
        if (f.applicant === 'none' && w.enquiryId) return false;
        return true;
      });
      const canDrag = manage && !filtered() && all.length > 1;
      main.innerHTML = `<div class="kids wt">${head}
        <div class="wt-classes">
          <div class="wt-tabs" role="tablist" aria-label="Classes">${list.map(c => `<button class="wt-tab" type="button" role="tab" id="wt-tab-${esc(c.id)}" aria-selected="${c.id === s.id}" aria-controls="wt-panel" tabindex="${c.id === s.id ? 0 : -1}" data-cls="${esc(c.id)}"><span class="wt-tab__name">${esc(c.name)}</span><span class="wt-tab__meta">${esc(tabLine(c))}</span></button>`).join('')}</div>
          <div class="field wt-pick"><label class="field__label" for="wt-cls">Class</label><select class="input" id="wt-cls" data-pick>${list.map(c => `<option value="${esc(c.id)}"${c.id === s.id ? ' selected' : ''}>${esc(c.name)} — ${esc(tabLine(c))}</option>`).join('')}</select></div>
        </div>
        <section class="wt-panel" id="wt-panel" role="tabpanel" aria-labelledby="wt-tab-${esc(s.id)}">
          ${summary(s)}
          ${all.length ? filters() : ''}
          ${!all.length ? state('clock', `Nobody is waiting for ${esc(s.name)}`, s.available ? `There ${s.available === 1 ? 'is a place' : `are ${s.available} places`} to offer. Children added from a full class during enrolment appear here.` : 'Children added from a full class during enrolment appear here.', manage ? `<a class="btn btn--secondary" href="${routes.page('enrol')}">${icon('user-plus', 'icon--sm')}Start an enrolment</a>` : '')
            : !rows.length ? state('search', 'No children match these filters', `${plural(all.length, 'child', 'children')} ${all.length === 1 ? 'is' : 'are'} waiting for ${esc(s.name)}.`, '<button class="btn btn--secondary" type="button" data-clear>Clear filters</button>')
            : table(s, rows, all.length, canDrag)}
          ${all.length > 1 && manage && filtered() ? '<p class="cd-note">Clear the filters to change the order.</p>' : ''}
          <p class="cd-note wt-foot">${icon('info', 'icon--sm')}The order is set by staff and changes only with a recorded reason. Priority flags are shown for information — they don’t reorder the list.</p>
        </section></div>`;
    }

    function summary(s) {
      const cells = [['Capacity', s.capacity ?? '—'], ['Enrolled', s.enrolled], ...(s.incoming ? [['Moving in', s.incoming]] : []), ['Seats free', s.free ?? '—'], ['Held by offers', s.held], ['Waiting', s.waiting]];
      let banner;
      if (s.capacity == null) banner = `<div class="wt-banner wt-banner--neutral" role="status">${icon('info')}<p><b>${esc(s.name)} has no capacity set.</b> Seat availability can’t be checked until it’s added in Classes.</p></div>`;
      else if (s.overCapacity) banner = `<div class="wt-banner wt-banner--warn" role="status">${icon('alert-triangle')}<p><b>${esc(s.name)} is over capacity.</b> No places can be offered until enrolment is below ${s.capacity}.</p></div>`;
      else if (s.available > 0 && s.waiting) banner = `<div class="wt-banner wt-banner--ok" role="status">${icon('check-circle')}<p><b>${plural(s.available, 'place')} to offer in ${esc(s.name)}.</b> Review number 1 first${s.held ? ` · ${plural(s.held, 'offer')} already waiting for a reply` : ''}.</p></div>`;
      else if (s.available > 0) banner = `<div class="wt-banner wt-banner--ok" role="status">${icon('check-circle')}<p><b>${plural(s.available, 'place')} free.</b> Nobody is waiting for this class.</p></div>`;
      else banner = `<div class="wt-banner wt-banner--full" role="status">${icon('lock')}<p><b>No places to offer in ${esc(s.name)}.</b> ${s.held && !s.free ? '' : s.held ? `The free ${s.free === 1 ? 'seat is' : 'seats are'} held by outstanding offers. ` : 'The class is full. '}You’ll get a notification when a place opens.</p></div>`;
      return `<dl class="wt-strip" aria-label="${esc(s.name)} seats">${cells.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${banner}`;
    }

    function filters() {
      return `<div class="wt-filters" role="search" aria-label="Filter the waitlist">
        <div class="field wt-filters__q"><label class="sr-only" for="wt-q">Search by child or parent</label><div class="input-wrap input-wrap--lead">${icon('search')}<input class="input" id="wt-q" type="search" placeholder="Search child or parent" value="${esc(f.q)}" data-f="q"></div></div>
        <div class="field"><label class="sr-only" for="wt-period">Requested start</label><select class="input" id="wt-period" data-f="period"><option value="">Any start date</option>${Object.entries(PERIODS).map(([k, l]) => `<option value="${k}"${f.period === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label class="sr-only" for="wt-flag">Priority</label><select class="input" id="wt-flag" data-f="flag"><option value="">Any priority</option><option value="any"${f.flag === 'any' ? ' selected' : ''}>Has a priority flag</option>${Object.entries(store.WL_FLAGS).map(([k, l]) => `<option value="${k}"${f.flag === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label class="sr-only" for="wt-app">Application</label><select class="input" id="wt-app" data-f="applicant"><option value="">Any application</option><option value="linked"${f.applicant === 'linked' ? ' selected' : ''}>Has an admissions record</option><option value="none"${f.applicant === 'none' ? ' selected' : ''}>No admissions record yet</option></select></div>
        ${filtered() ? '<button class="btn btn--tertiary btn--sm" type="button" data-clear>Clear filters</button>' : ''}
      </div>`;
    }

    function table(s, rows, total, canDrag) {
      return `<div class="wt-table-wrap"><table class="wt-table">
        <caption class="sr-only">${esc(s.name)} waitlist in order${canDrag ? '. Drag a row, or use its actions menu, to change the order.' : ''}</caption>
        <thead><tr><th scope="col" class="wt-c-pos">#</th><th scope="col">Child</th><th scope="col">Age at start</th><th scope="col">Requested start</th><th scope="col">Added</th><th scope="col">Priority</th><th scope="col">Notes</th><th scope="col" class="wt-c-act"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${rows.map(w => row(w, s, total, canDrag)).join('')}</tbody></table></div>`;
    }

    function row(w, s, total, canDrag) {
      const e = w.enquiryId ? store.getAdmissionEnquiries().find(x => x.id === w.enquiryId) : null;
      const flags = store.waitlistFlags(w);
      const canOfferNow = manage && offers && (s.capacity == null || s.available > 0);
      const name = `${w.firstName} ${w.lastName}`;
      return `<tr class="wt-row${w.id === focus ? ' is-focus' : ''}${s.available > 0 && w.position <= s.available ? ' is-next' : ''}" data-id="${esc(w.id)}"${canDrag ? ' draggable="true"' : ''}>
        <td class="wt-c-pos">${canDrag ? `<span class="wt-grip" aria-hidden="true" title="Drag to reorder">${icon('grip')}</span>` : ''}<span class="wt-num"><span class="sr-only">Number </span>${w.position}</span></td>
        <td class="wt-c-child"><a class="wt-name" href="${e && offers ? routes.page('admissions', { applicant: e.id }) : '#'}" data-name${e && offers ? '' : ' aria-disabled="true" tabindex="0" role="link"'}>${esc(name)}</a>
          <span class="wt-sub">${esc(w.guardianName || 'Guardian not recorded')}${w.guardianPhone ? ` · <span dir="ltr">${esc(w.guardianPhone)}</span>` : ''}</span>
          <span class="wt-sub">${e ? `Applicant ${esc(e.id)} · ${esc(store.ENQUIRY_STAGES[e.stage])}` : 'No admissions record yet'}</span></td>
        <td class="wt-c-date" data-label="Age at start">${esc(ageText(w.dob, w.startDate || store.today()))}</td>
        <td class="wt-c-date" data-label="Requested start">${esc(day(w.startDate))}</td>
        <td class="wt-c-date" data-label="Added">${esc(day(w.createdAt))}</td>
        <td data-label="Priority">${flags.length ? `<ul class="wt-flags">${flags.map(x => `<li class="wt-flag wt-flag--${x.key}" title="${esc(x.detail)}">${icon(FLAG_ICON[x.key])}<span>${esc(x.label)}</span><span class="sr-only">: ${esc(x.detail)}</span></li>`).join('')}</ul>` : '<span class="wt-none">None</span>'}</td>
        <td data-label="Notes" class="wt-c-notes">${w.notes ? esc(w.notes) : '<span class="wt-none">—</span>'}</td>
        <td class="wt-c-act">${canOfferNow ? `<button class="btn btn--primary btn--sm wt-offer" type="button" data-offer="${esc(w.id)}">Offer place</button>` : ''}
          ${manage ? `<div class="menu-wrap"><button class="btn btn--icon-ghost" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(name)}" data-menu>${icon('more')}</button>
          <div class="menu" role="menu" hidden>
            ${offers ? `<button type="button" role="menuitem" data-offer="${esc(w.id)}"${canOfferNow ? '' : ' disabled'}>${icon('mail', 'icon--sm')}Offer place${canOfferNow ? '' : ' (no place free)'}</button>` : ''}
            <button type="button" role="menuitem" data-up="${esc(w.id)}"${w.position === 1 || filtered() ? ' disabled' : ''}>${icon('arrow-up', 'icon--sm')}Move up</button>
            <button type="button" role="menuitem" data-down="${esc(w.id)}"${w.position === total || filtered() ? ' disabled' : ''}>${icon('arrow-down', 'icon--sm')}Move down</button>
            <button type="button" role="menuitem" data-moveto="${esc(w.id)}"${total < 2 || filtered() ? ' disabled' : ''}>${icon('move', 'icon--sm')}Move to number…</button>
            <button type="button" role="menuitem" data-notes="${esc(w.id)}">${icon('pencil', 'icon--sm')}Edit notes</button>
            <button type="button" role="menuitem" data-history="${esc(w.id)}">${icon('clock', 'icon--sm')}History</button>
            <hr><button type="button" role="menuitem" class="is-danger" data-remove="${esc(w.id)}">${icon('user-minus', 'icon--sm')}Remove from waitlist…</button>
          </div></div>` : ''}</td>
      </tr>`;
    }

    const entry = id => store.getWaitlist().find(w => w.id === id);
    const closeMenu = (restore = false) => { if (!openMenu) return; const b = openMenu.querySelector('[data-menu]'); openMenu.querySelector('.menu').hidden = true; b.setAttribute('aria-expanded', 'false'); openMenu.closest('tr')?.classList.remove('has-menu'); openMenu = null; if (restore) b.focus(); };

    // Reorder: the proposed order is shown straight away; Cancel or a failed save puts the saved order back.
    function reorderDialog(w, to) {
      const total = store.waitlistFor(w.cls).length;
      const order = store.waitlistFor(w.cls).map(x => x.id);
      let saved = false;
      pending = true;
      const d = kids.dialog({
        label: 'Waitlist / Order', title: 'Change the order?',
        desc: `<b>${esc(w.firstName)} ${esc(w.lastName)}</b> · ${esc(w.cls)}. The change, the reason and your name are recorded in the waitlist history.`,
        body: `<div class="wt-move"><div class="wt-move__pos"><span>Now</span><b>${w.position}</b></div>${icon('arrow-right')}<div class="field wt-move__to">${''}<label class="field__label" for="kd-position">New number</label><select class="input" id="kd-position" name="position">${Array.from({ length: total }, (_, i) => `<option value="${i + 1}"${i + 1 === to ? ' selected' : ''}>${i + 1}</option>`).join('')}</select><p class="field__hint field__hint--error" data-error-for="position" hidden></p></div></div>
          <fieldset class="an-fs"><legend class="field__label">Reason <span class="field__req" aria-hidden="true">*</span></legend><div class="ad-reasons">${Object.entries(store.WL_REORDER_REASONS).map(([k, l]) => `<label class="an-pick"><input type="radio" name="oreason" value="${k}"><span><b>${esc(l)}</b></span></label>`).join('')}</div><p class="field__hint field__hint--error" data-error-for="reason" hidden></p></fieldset>
          ${kids.field('kd-detail', 'Details', '<textarea class="input" id="kd-detail" name="detail" rows="2" maxlength="300"></textarea>', { hint: 'Required for “Other”.' })}`,
        submit: 'Confirm new order',
        onClose() { pending = false; if (!saved) { draw(); main.querySelector(`[data-id="${CSS.escape(w.id)}"] [data-name]`)?.focus(); } },
        async onSubmit(form) {
          const reason = form.querySelector('[name="oreason"]:checked')?.value || '';
          if (!reason) return { ok: false, errors: { reason: 'Choose a reason for the change.' } };
          const r = await store.reorderWaitlist(me(), w.id, Number(form.elements.position.value), { reason, detail: form.elements.detail.value, order, fail: failNext.reorder });
          failNext.reorder = false;
          if (!r.ok) {
            if (r.errors) return { ok: false, errors: r.errors };
            if (r.reason === 'stale' || r.reason === 'missing' || r.reason === 'closed') { saved = true; pending = false; draw(); toast('Order not changed', failText(r), 'alert-circle'); return { ok: true }; }
            return { ok: false, message: `The new order couldn’t be saved, so the previous order is kept. ${FAIL.storage}` };
          }
          saved = true;
          pending = false;
          focus = w.id;
          draw();
          main.querySelector(`[data-id="${CSS.escape(w.id)}"] [data-name]`)?.focus();
          toast(r.unchanged ? 'Order unchanged' : 'Order saved', r.unchanged ? 'The position is the same as before.' : `${w.firstName} ${w.lastName} moved from number ${r.from} to ${r.to}.`, 'check-circle');
          return { ok: true };
        }
      });
      d.form.querySelector('[name="oreason"]').focus();
      d.form.elements.position.addEventListener('change', () => preview(w.id, Number(d.form.elements.position.value)));
      preview(w.id, to);
    }
    // Shows the proposed order in the table behind the dialog (not saved).
    function preview(id, to) {
      const body = main.querySelector('.wt-table tbody');
      const tr = body?.querySelector(`[data-id="${CSS.escape(id)}"]`);
      if (!tr) return;
      const others = [...body.children].filter(x => x !== tr);
      body.insertBefore(tr, others[to - 1] || null);
      [...body.children].forEach((x, i) => { x.querySelector('.wt-num').innerHTML = `<span class="sr-only">Number </span>${i + 1}`; x.classList.toggle('is-moving', x === tr); });
    }

    function removeDialog(w) {
      const d = kids.dialog({
        label: 'Waitlist', title: 'Remove from the waitlist?', danger: true,
        desc: `<b>${esc(w.firstName)} ${esc(w.lastName)}</b> · ${esc(w.cls)} · number ${w.position}. The record and its history are kept; the children below move up one place.`,
        body: `<fieldset class="an-fs"><legend class="field__label">Reason <span class="field__req" aria-hidden="true">*</span></legend><div class="ad-reasons">${Object.entries(store.WL_REMOVE_REASONS).map(([k, l]) => `<label class="an-pick"><input type="radio" name="rreason" value="${k}"><span><b>${esc(l)}</b></span></label>`).join('')}</div><p class="field__hint field__hint--error" data-error-for="reason" hidden></p></fieldset>
          ${kids.field('kd-detail', 'Details', '<textarea class="input" id="kd-detail" name="detail" rows="2" maxlength="300"></textarea>', { hint: 'Required for “Other”.' })}`,
        submit: 'Remove from waitlist',
        async onSubmit(form) {
          const reason = form.querySelector('[name="rreason"]:checked')?.value || '';
          if (!reason) return { ok: false, errors: { reason: 'Choose a reason for removing this child.' } };
          const r = await store.removeFromWaitlist(me(), w.id, { reason, detail: form.elements.detail.value, fail: failNext.remove });
          failNext.remove = false;
          if (!r.ok) {
            if (r.errors) return { ok: false, errors: r.errors };
            if (r.reason === 'missing' || r.reason === 'closed') { draw(); toast('Not removed', failText(r), 'alert-circle'); return { ok: true }; }
            return { ok: false, message: `${w.firstName} wasn’t removed. ${FAIL.storage}` };
          }
          draw();
          $('#page-title')?.focus();
          toast('Removed from the waitlist', `${w.firstName} ${w.lastName} · ${store.WL_REMOVE_REASONS[reason]}. The record is kept.`, 'check-circle');
          return { ok: true };
        }
      });
      d.form.querySelector('[name="rreason"]').focus();
    }

    function notesDialog(w) {
      kids.dialog({
        label: 'Waitlist', title: 'Edit notes', desc: `${esc(w.firstName)} ${esc(w.lastName)} · ${esc(w.cls)}`,
        body: kids.field('kd-notes', 'Notes', `<textarea class="input" id="kd-notes" name="notes" rows="3" maxlength="500">${esc(w.notes || '')}</textarea>`, { hint: 'Visible to staff only.' }),
        submit: 'Save notes',
        async onSubmit(form) {
          const r = await store.updateWaitlistNotes(me(), w.id, form.elements.notes.value);
          if (!r.ok) return { ok: false, message: failText(r) };
          draw();
          toast(r.unchanged ? 'No changes' : 'Notes saved', `${w.firstName} ${w.lastName}`, 'check-circle');
          return { ok: true };
        }
      });
    }

    function historyDialog(w) {
      const items = [...w.history].reverse();
      const d = kids.dialog({
        label: 'Waitlist / History', title: `${w.firstName} ${w.lastName}`, desc: `${esc(w.cls)} · added ${esc(day(w.createdAt))} by ${esc(w.addedBy || '—')}`,
        body: items.length ? `<ol class="wt-hist">${items.map(h => `<li><b>${esc(h.detail)}</b><span>${esc(new Date(h.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))} · ${esc(h.by)}</span></li>`).join('')}</ol>` : '<p class="cd-note">No changes recorded yet.</p>',
        submit: 'Done', async onSubmit() { return { ok: true }; }
      });
      d.form.querySelector('[type="submit"]').focus();
    }

    // Offer: the S07 offer letter, after making sure the child has an admissions record to send it from.
    async function offer(w, btn) {
      if (!act) { toast('Offers unavailable', 'The admissions module isn’t loaded.', 'alert-circle'); return; }
      const s = store.waitlistSummary(w.cls);
      if (s.capacity != null && s.available <= 0) { toast('No place to offer', `${w.cls} has no free place right now. ${w.firstName} stays on the waitlist.`, 'lock'); draw(); return; }
      if (btn) { btn.disabled = true; btn.classList.add('is-loading'); }
      const r = await store.ensureWaitlistApplicant(me(), w.id);
      if (btn && document.contains(btn)) { btn.disabled = false; btn.classList.remove('is-loading'); }
      if (!r.ok) { toast('Can’t prepare the offer', r.errors ? `Complete the child’s details first: ${Object.values(r.errors)[0]}` : failText(r), 'alert-circle', { duration: 7000 }); return; }
      if (r.created) toast('Admissions record created', `${w.firstName} ${w.lastName} now has an applicant record (${r.enquiry.id}) for the offer.`, 'user-plus');
      const fresh = entry(w.id);
      const ahead = fresh.position - 1;
      const sibs = store.waitlistFlags(fresh);
      const fam = r.enquiry.familyId ? store.listFamilies?.().find(x => x.id === r.enquiry.familyId) : null;
      const context = `<dl class="wt-ctx">
          <div><dt>Child</dt><dd>${esc(r.enquiry.child)}${fresh.dob ? ` · born ${esc(day(fresh.dob))}` : ''}</dd></div>
          <div><dt>Family</dt><dd>${esc(r.enquiry.parent)}${r.enquiry.phone ? ` · <span dir="ltr">${esc(r.enquiry.phone)}</span>` : ''}${fam ? ` · ${esc(fam.name)}` : ''}</dd></div>
          <div><dt>Class</dt><dd>${esc(fresh.cls)} (${esc(r.enquiry.programme)}) · ${s.capacity == null ? 'capacity not set' : `${plural(s.available, 'place')} to offer`}</dd></div>
          <div><dt>Waitlist</dt><dd>Number ${fresh.position}${sibs.length ? ` · ${esc(sibs.map(x => x.label).join(', '))}` : ''}</dd></div>
        </dl>${ahead ? `<p class="wt-banner wt-banner--warn">${icon('alert-triangle')}<span>${plural(ahead, 'child', 'children')} ${ahead === 1 ? 'is' : 'are'} ahead of ${esc(fresh.firstName)} on this waitlist. Offering out of order is recorded in the history.</span></p>` : ''}`;
      act.offerDialog(r.enquiry, failSend, { context });
    }

    main.addEventListener('click', ev => {
      const t = ev.target;
      if (t.closest('[data-retry]')) { load(); return; }
      if (t.closest('[data-clear]')) { Object.keys(f).forEach(k => { f[k] = ''; }); draw(); $('#wt-q')?.focus(); return; }
      const tab = t.closest('[data-cls]');
      if (tab) { clsId = tab.dataset.cls; focus = ''; syncUrl(); draw(); main.querySelector(`[data-cls="${CSS.escape(clsId)}"]`)?.focus(); return; }
      const nm = t.closest('[data-name][aria-disabled="true"]');
      if (nm) { ev.preventDefault(); toast('No admissions record yet', offers ? 'One is created when you offer this child a place.' : 'Your role can’t open admissions records.', 'info'); return; }
      const mb = t.closest('[data-menu]');
      if (mb) {
        const wrap = mb.closest('.menu-wrap');
        if (openMenu === wrap) { closeMenu(); return; }
        closeMenu();
        const m = wrap.querySelector('.menu');
        m.hidden = false;
        m.classList.toggle('is-up', mb.getBoundingClientRect().bottom + 320 > innerHeight);
        mb.setAttribute('aria-expanded', 'true');
        wrap.closest('tr')?.classList.add('has-menu');
        openMenu = wrap;
        m.querySelector('button:not([disabled])')?.focus();
        return;
      }
      const pick = (attr, fn) => { const b = t.closest(`[${attr}]`); if (!b || b.disabled) return false; closeMenu(); const w = entry(b.getAttribute(attr)); if (!w || w.status !== 'waiting') { draw(); toast('List updated', FAIL.closed, 'info'); return true; } fn(w, b); return true; };
      if (pick('data-offer', (w, b) => offer(w, b.closest('.menu') ? null : b))) return;
      if (pick('data-up', w => reorderDialog(w, w.position - 1))) return;
      if (pick('data-down', w => reorderDialog(w, w.position + 1))) return;
      if (pick('data-moveto', w => reorderDialog(w, w.position))) return;
      if (pick('data-notes', w => notesDialog(w))) return;
      if (pick('data-history', w => historyDialog(w))) return;
      pick('data-remove', w => removeDialog(w));
    });
    document.addEventListener('click', ev => { if (openMenu && !openMenu.contains(ev.target)) closeMenu(); });
    main.addEventListener('keydown', ev => {
      if (ev.key === 'Escape' && openMenu) { closeMenu(true); return; }
      const tab = ev.target.closest('[role="tab"]');
      if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) {
        const tabs = [...main.querySelectorAll('[role="tab"]')];
        const i = tabs.indexOf(tab);
        const next = ev.key === 'Home' ? 0 : ev.key === 'End' ? tabs.length - 1 : (i + (ev.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        ev.preventDefault();
        tabs[next].click();
      }
      if (openMenu && ['ArrowDown', 'ArrowUp'].includes(ev.key)) {
        const items = [...openMenu.querySelectorAll('.menu button:not([disabled])')];
        const i = items.indexOf(document.activeElement);
        ev.preventDefault();
        items[(i + (ev.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      }
    });
    main.addEventListener('change', ev => {
      if (ev.target.matches('[data-pick]')) { clsId = ev.target.value; focus = ''; syncUrl(); draw(); $('#wt-cls')?.focus(); return; }
      const k = ev.target.dataset.f;
      if (k && k !== 'q') { f[k] = ev.target.value; draw(); main.querySelector(`[data-f="${k}"]`)?.focus(); }
    });
    main.addEventListener('input', ev => {
      if (ev.target.dataset.f !== 'q') return;
      f.q = ev.target.value;
      const pos = ev.target.selectionStart;
      draw();
      const q = $('#wt-q');
      if (q) { q.focus(); q.setSelectionRange(pos, pos); }
    });

    // Drag and drop (desktop and tablet): drop shows the new order, then asks for the reason before saving.
    main.addEventListener('dragstart', ev => {
      const tr = ev.target.closest?.('tr[draggable="true"]');
      if (!tr) return;
      dragId = tr.dataset.id;
      tr.classList.add('is-dragging');
      ev.dataTransfer.effectAllowed = 'move';
      try { ev.dataTransfer.setData('text/plain', dragId); } catch { /* some browsers */ }
    });
    const dropIndex = (ev, body) => {
      const rowsEls = [...body.children].filter(x => x.dataset.id !== dragId);
      const i = rowsEls.findIndex(x => { const r = x.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; });
      return i === -1 ? rowsEls.length : i;
    };
    main.addEventListener('dragover', ev => {
      const body = ev.target.closest?.('.wt-table tbody');
      if (!dragId || !body) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      const i = dropIndex(ev, body);
      body.querySelectorAll('.is-drop-before, .is-drop-after').forEach(x => x.classList.remove('is-drop-before', 'is-drop-after'));
      const rowsEls = [...body.children].filter(x => x.dataset.id !== dragId);
      if (rowsEls[i]) rowsEls[i].classList.add('is-drop-before'); else rowsEls[rowsEls.length - 1]?.classList.add('is-drop-after');
    });
    main.addEventListener('drop', ev => {
      const body = ev.target.closest?.('.wt-table tbody');
      if (!dragId || !body) return;
      ev.preventDefault();
      const to = dropIndex(ev, body) + 1;
      const w = entry(dragId);
      dragId = null;
      body.querySelectorAll('.is-dragging, .is-drop-before, .is-drop-after').forEach(x => x.classList.remove('is-dragging', 'is-drop-before', 'is-drop-after'));
      if (!w || w.status !== 'waiting' || to === w.position) return;
      reorderDialog(w, to);
    });
    main.addEventListener('dragend', () => { dragId = null; main.querySelectorAll('.is-dragging, .is-drop-before, .is-drop-after').forEach(x => x.classList.remove('is-dragging', 'is-drop-before', 'is-drop-after')); });

    store.subscribe(({ key }) => { if (!pending && !openMenu && (!key || /^nexora-(waitlist|children|class|admission-enquiries)/.test(key))) draw(); });
    load();
  }

  window.NexoraWaitlist = { render };
})();
