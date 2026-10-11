/* S19 Attendance (app.html?page=attendance[&cls=<class>][&date=YYYY-MM-DD][&status=not-arrived|in|out|absent|not-taken])
   Live check-in / check-out / absence for one class. Everything is read from store.attendanceView (the same view the
   dashboard, Classes and class detail use) and written through store.checkIn / checkOut / markAbsent / bulkCheckIn /
   undoBulk / refuseRelease, which re-check permissions, state and pickup authorisation on every call.
   ?view=staff and ?view=ratio stay on the older module page (modules.js). Test hook: ?fail=1. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const kids = window.NexoraChildren;
  const { routes } = store;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const params = new URLSearchParams(location.search);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const initials = n => String(n || '').trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const timeOf = iso => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '');
  const dayLabel = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const requestId = () => `req-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  const STATUS = {
    'not-arrived': { label: 'Not arrived', icon: 'clock', tone: 'wait' },
    in: { label: 'In', icon: 'check-circle', tone: 'in' },
    out: { label: 'Out', icon: 'arrow-right', tone: 'out' },
    absent: { label: 'Absent', icon: 'x', tone: 'absent' }
  };
  const FILTERS = [['all', 'All'], ['not-arrived', 'Not arrived'], ['in', 'In'], ['out', 'Out'], ['absent', 'Absent']];
  const ALERT_ICON = { allergy: 'allergy', medical: 'medical', custody: 'shield', dietary: 'leaf' };
  const ALERT_SECTION = { allergy: 'medical', medical: 'medical', dietary: 'medical', custody: 'custody' };
  const FAIL = {
    forbidden: 'Your role can’t record attendance for this class. Nothing was changed.',
    closed: 'The school is closed today, so attendance can’t be recorded.',
    'not-expected': 'This child isn’t expected in this class today. Refresh the page.',
    conflict: 'Someone else just updated this child. The latest status is now shown — check it before trying again.',
    expired: 'Undo is no longer available. Use the child’s tile to correct their attendance.',
    missing: 'That change can’t be found any more. Refresh the page.',
    storage: 'This couldn’t be saved on this device. Nothing was changed. Please try again.'
  };

  function render(key, main, user) {
    if (key !== 'attendance' || ['staff', 'ratio'].includes(params.get('view'))) return false;
    page(main, user);
    return true;
  }

  function page(main, user) {
    const scope = store.classScope(user);
    const today = store.today();
    let cls = scope.includes(params.get('cls')) ? params.get('cls') : (scope.find(c => store.attendanceView(c).counts.notArrived) || scope[0] || '');
    let date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') && params.get('date') <= today ? params.get('date') : today;
    const statusParam = params.get('status');
    let filter = FILTERS.some(([k]) => k === statusParam) ? statusParam : statusParam === 'not-taken' ? 'not-arrived' : 'all';
    let selecting = false;
    const selected = new Set();
    let loaded = false;
    let failOnce = params.get('fail') === '1';
    let lastCounts = '';

    main.classList.add('kids-page');
    document.title = 'Attendance · Nexora';
    const state = (iconName, title, text, action = '', tone = '') => `<div class="kids-empty att-state"${tone === 'error' ? ' role="alert"' : ''}><span class="state-icon${tone ? ` state-icon--${tone}` : ''}" aria-hidden="true">${icon(iconName)}</span><h2 class="kids-empty__title">${title}</h2><p>${text}</p>${action}</div>`;

    main.innerHTML = `
      <div class="kids att">
        <header class="kids-head">
          <div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Attendance <span class="att-mode" data-mode></span></h1><p class="kids-head__sub">Check children in and out, and record absences.</p></div>
          <div class="kids-head__actions">${store.canManageStaff(user) ? `<a class="btn btn--secondary btn--sm" href="${routes.page('attendance', { view: 'staff' })}">${icon('user', 'icon--sm')}Staff on duty</a>` : ''}</div>
        </header>
        <section class="panel att-bar" aria-label="Class and date">
          <div class="att-bar__pick">
            <div class="field"><label class="field__label" for="att-cls">Class</label><select class="input" id="att-cls" data-cls ${scope.length ? '' : 'disabled'}>${scope.length ? scope.map(c => `<option${c === cls ? ' selected' : ''}>${esc(c)}</option>`).join('') : '<option>No classes</option>'}</select></div>
            <div class="field"><label class="field__label" for="att-date">Date</label><input class="input" id="att-date" type="date" max="${today}" value="${date}" data-date></div>
          </div>
          <ul class="att-counts" aria-label="Attendance counts" data-counts></ul>
          <div class="att-ratio" data-ratio></div>
        </section>
        <p class="sr-only" aria-live="polite" data-live></p>
        <div data-reminders></div>
        <div class="att-tools" data-tools></div>
        <section class="att-grid-wrap" aria-labelledby="page-title" aria-busy="true" data-results>
          <ul class="att-grid">${Array.from({ length: 10 }, () => '<li><span class="skeleton att-skel"></span></li>').join('')}</ul>
        </section>
      </div>`;
    const $ = s => main.querySelector(s);

    const view = () => store.attendanceView(cls, date);
    const canSee = section => store.canView(user, section);
    const canAct = store.canAccess(user, 'attendance') && store.isEntitled('attendance');
    const syncUrl = () => {
      const u = new URL(location.href);
      u.searchParams.set('cls', cls);
      if (date === today) u.searchParams.delete('date'); else u.searchParams.set('date', date);
      if (filter === 'all') u.searchParams.delete('status'); else u.searchParams.set('status', filter);
      history.replaceState(null, '', u);
    };

    /* ---------------------------------------------------------------- Header pieces */

    function countsHtml(v) {
      const c = v.counts;
      const item = (label, n, tone) => `<li class="att-count att-count--${tone}"><span class="att-count__n">${n}</span><span class="att-count__l">${label}</span></li>`;
      return item('Expected', c.expected, 'all') + item('In', c.in, 'in') + item('Out', c.out, 'out') + item('Absent', c.absent, 'absent');
    }
    function ratioHtml(v) {
      if (!v.live) return '<span class="cls-label">Ratio</span><p class="att-ratio__na">Shown for today only</p>';
      const r = store.classRatio(cls);
      const { chip, note } = window.NexoraClasses.ratioChip(r);
      return `<span class="cls-label">Today’s ratio</span>${chip}<p class="cls-today__why"><span>${esc(note)}</span>${r.ratio ? `<span class="cls-rule">Rule ${r.ratio.adults}:${r.ratio.children}</span>` : ''}</p>`;
    }
    function remindersHtml() {
      if (date !== today) return '';
      const list = store.remindersFor(cls, date).filter(r => r.status !== 'resolved');
      if (!list.length) return '';
      const name = id => { const c = store.childById(id); return c ? store.childName(c) : 'A child'; };
      const due = list.filter(r => r.status === 'due');
      const pending = list.filter(r => r.status === 'pending');
      return `<div class="att-remind${due.length ? ' att-remind--due' : ''}" role="${due.length ? 'alert' : 'status'}">${icon(due.length ? 'phone' : 'clock')}
        <div>${due.length ? `<p><b>Call the family now:</b> ${due.map(r => esc(name(r.childId))).join(', ')} — absent with no reason given.</p>` : ''}
        ${pending.length ? `<p>${due.length ? '' : '<b>Reminder set:</b> '}contact the family of ${pending.map(r => esc(name(r.childId))).join(', ')} after 10:00 if there’s still no reason.</p>` : ''}
        <p class="att-remind__note">Shown while Nexora is open on this device — no text or call is sent automatically in this prototype.</p></div></div>`;
    }

    function toolsHtml(v) {
      const n = v.counts;
      const filters = `<div class="att-filters" role="group" aria-label="Filter children">${FILTERS.map(([k, label]) => {
        const count = k === 'all' ? n.expected : n[{ 'not-arrived': 'notArrived', in: 'in', out: 'out', absent: 'absent' }[k]];
        return `<button class="chip att-chip${filter === k ? ' is-active' : ''}" type="button" aria-pressed="${filter === k}" data-filter="${k}">${esc(label)}<span class="att-chip__n">${count}</span></button>`;
      }).join('')}</div>`;
      if (!v.live || !v.day.open || !n.expected || !canAct) return filters;
      const bulk = selecting
        ? `<div class="att-bulk is-selecting" role="toolbar" aria-label="Selection"><span class="att-bulk__n" aria-live="polite">${plural(selected.size, 'child', 'children')} selected</span>
            <button class="btn btn--danger btn--sm" type="button" data-bulk-absent ${selected.size ? '' : 'disabled'}>${icon('x', 'icon--sm')}Mark selected absent</button>
            <button class="btn btn--tertiary btn--sm" type="button" data-select-cancel>Cancel</button></div>`
        : `<div class="att-bulk" role="toolbar" aria-label="Bulk actions">
            <button class="btn btn--primary kids-yellow btn--sm" type="button" data-bulk-in ${n.notArrived ? '' : 'disabled'}>${icon('check', 'icon--sm')}Mark all present</button>
            <button class="btn btn--secondary btn--sm" type="button" data-select ${n.notArrived ? '' : 'disabled'}>${icon('list', 'icon--sm')}Select</button></div>`;
      return filters + bulk;
    }

    /* ---------------------------------------------------------------- Tiles */

    function alertDots(child) {
      if (!child.alerts.length) return '';
      return `<span class="att-dots">${[...new Set(child.alerts.map(a => a.type))].map(t => `<span class="cd-dot kid-alert--${esc(t)}">${icon(ALERT_ICON[t])}</span>`).join('')}</span>`;
    }
    function tileMeta(r) {
      const d = r.detail;
      if (r.status === 'in') return d?.inAt ? `In ${timeOf(d.inAt)}` : 'In · time not recorded';
      if (r.status === 'out') return `Out ${timeOf(d?.outAt)}${d?.collector ? ` · ${d.collector.name}` : ''}`;
      if (r.status === 'absent') return d?.reason ? store.ABSENCE_REASONS[d.reason] : 'Reason not given';
      return 'Tap to check in';
    }
    function tileLabel(r) {
      const types = [...new Set(r.child.alerts.map(a => store.ALERT_TYPES[a.type]))];
      return `${store.childName(r.child)}. ${STATUS[r.status].label}${r.late && r.status !== 'absent' ? ', late' : ''}. ${tileMeta(r)}.${types.length ? ` Alerts: ${types.join(', ')}.` : ''}`;
    }
    function tile(r, v) {
      const s = STATUS[r.status];
      const selectable = selecting && r.status === 'not-arrived';
      const photo = r.child.photo ? `<img class="att-av" src="${esc(r.child.photo)}" alt="">` : `<span class="att-av" aria-hidden="true">${esc(initials(store.childName(r.child)))}</span>`;
      const inner = `<span class="att-tile__photo">${photo}${alertDots(r.child)}</span>
        <span class="att-tile__name">${esc(r.child.preferredName || r.child.firstName)}</span>
        <span class="att-tile__status">${icon(s.icon, 'icon--sm')}${esc(s.label)}${r.late && r.status !== 'absent' ? '<span class="att-late">Late</span>' : ''}</span>
        <span class="att-tile__meta">${esc(v.live || r.status !== 'not-arrived' ? tileMeta(r) : 'No record')}</span>`;
      if (selecting) {
        return `<li><label class="att-tile att-tile--${s.tone}${selectable ? '' : ' is-disabled'}"><input class="att-check" type="checkbox" data-pick="${esc(r.child.id)}"${selected.has(r.child.id) ? ' checked' : ''}${selectable ? '' : ' disabled'} aria-label="Select ${esc(store.childName(r.child))}${selectable ? '' : ` (${s.label}, can’t be marked absent here)`}">${inner}</label></li>`;
      }
      return `<li><button class="att-tile att-tile--${s.tone}" type="button" data-kid="${esc(r.child.id)}" aria-haspopup="dialog" aria-label="${esc(tileLabel(r))}">${inner}</button></li>`;
    }

    function paint() {
      if (!loaded) return;
      const res = $('[data-results]');
      res.removeAttribute('aria-busy');
      $('[data-mode]').innerHTML = date === today ? '<span class="att-live"><i aria-hidden="true"></i>Live</span>' : '<span class="att-hist">History · read only</span>';
      if (!scope.length) {
        $('[data-counts]').innerHTML = '';
        $('[data-ratio]').innerHTML = '';
        $('[data-tools]').innerHTML = '';
        res.innerHTML = state('grid', 'No class to show', user.role === 'Teacher' ? 'You aren’t assigned to a class yet. Ask the school office.' : 'Add a class first.', user.role === 'Teacher' ? '' : `<a class="btn btn--primary kids-yellow" href="${routes.page('classes')}">Go to Classes</a>`);
        return;
      }
      const v = view();
      $('[data-counts]').innerHTML = countsHtml(v);
      $('[data-ratio]').innerHTML = ratioHtml(v);
      $('[data-reminders]').innerHTML = remindersHtml();
      $('[data-tools]').innerHTML = toolsHtml(v);
      const sig = `${v.counts.expected}/${v.counts.in}/${v.counts.out}/${v.counts.absent}`;
      if (sig !== lastCounts) { $('[data-live]').textContent = `${cls}: ${v.counts.in} in, ${v.counts.out} out, ${v.counts.absent} absent, ${v.counts.notArrived} not arrived.`; lastCounts = sig; }
      if (!v.day.open) {
        res.innerHTML = v.day.kind === 'holiday'
          ? state('calendar-check', esc(v.day.name), `${esc(dayLabel(date))} is a school holiday. No children are expected.`)
          : state('calendar-check', `School closed on ${esc(v.day.name)}s`, `No children are expected on ${esc(dayLabel(date))}. Pick a school day to see its attendance.`);
        return;
      }
      if (!v.counts.expected) { res.innerHTML = state('users', 'No children expected', `Nobody in ${esc(cls)} is booked for ${esc(dayLabel(date))}. Children appear here once they’re enrolled and booked for this day.`); return; }
      if (!v.live && !v.entry) { res.innerHTML = state('clock', 'No attendance recorded', `Nothing was recorded for ${esc(cls)} on ${esc(dayLabel(date))}. History can’t be added from here.`); return; }
      const rows = v.rows.filter(r => filter === 'all' || r.status === filter);
      res.innerHTML = rows.length
        ? `<ul class="att-grid">${rows.map(r => tile(r, v)).join('')}</ul>`
        : state('check-circle', `No children ${esc(FILTERS.find(([k]) => k === filter)[1].toLowerCase())}`, 'Choose another filter to see the rest of the class.', `<button class="btn btn--secondary" type="button" data-filter="all">Show all</button>`);
    }

    function load() {
      loaded = false;
      setTimeout(() => {
        try {
          if (failOnce) { failOnce = false; throw new Error('test failure'); }
          loaded = true;
          if (cls) syncUrl();
          store.processDueReminders();
          paint();
        } catch {
          $('[data-results]').removeAttribute('aria-busy');
          $('[data-results]').innerHTML = state('alert-circle', 'Something went wrong', 'We couldn’t load the attendance information. Nothing has changed.', `<button class="btn btn--secondary" type="button" data-retry>${icon('refresh', 'icon--sm')}Try again</button>`, 'error');
        }
      }, reduceMotion.matches ? 0 : 300);
    }

    const toastFail = r => window.NexoraToast?.show('Not saved', (r.errors && Object.values(r.errors)[0]) || FAIL[r.reason] || FAIL.storage, 'info');
    const rowOf = id => view().rows.find(r => r.child.id === id);

    /* ---------------------------------------------------------------- Check-in (+ dropped by, mark absent) */

    function checkInDialog(r) {
      const people = store.familyContacts(r.child);
      const start = view().start;
      let absentInstead = false;
      const d = kids.dialog({
        label: `${cls} / Check in`,
        title: `Check in ${r.child.preferredName || r.child.firstName}`,
        desc: start ? `Class starts at ${esc(start)}. Arrivals after that are marked late.` : 'This class has no start time set, so lateness isn’t recorded.',
        body: `<div class="att-form">
          ${alertsBlock(r.child)}
          <fieldset class="field att-pick"><legend class="field__label">Dropped off by <span class="field__extra">Optional</span></legend>
            ${people.length ? `<div class="att-pick__list">${people.map(p => `<label class="cls-pick"><input type="radio" name="dropper" value="${esc(p.id)}"><span><b>${esc(p.name)}</b><small>${esc(p.relation)}</small></span></label>`).join('')}
              <label class="cls-pick"><input type="radio" name="dropper" value="" checked><span><b>Skip</b><small>Not recorded</small></span></label></div>` : '<p class="cp-muted">No family contacts on file.</p>'}
            <p class="field__hint">Dropping a child off doesn’t make someone allowed to collect them.</p>
            <p class="field__hint field__hint--error" data-error-for="droppedBy" hidden></p>
          </fieldset>
        </div>`,
        submit: 'Check in',
        async onSubmit(form) {
          if (absentInstead) return { ok: true };
          const res = await store.checkIn(store.currentUser(), { cls, childId: r.child.id, droppedBy: form.querySelector('[name="dropper"]:checked')?.value || '', requestId: form.dataset.req });
          if (res.ok) { window.NexoraToast?.show(res.late ? 'Checked in · late' : 'Checked in', `${r.child.firstName} · ${timeOf(res.event.at)}${res.event.droppedBy ? ` · dropped off by ${res.event.droppedBy.name}` : ''}`); return res; }
          delete form.dataset.req;
          form.dataset.req = requestId();
          if (res.errors) return { ok: false, errors: res.errors };
          if (res.reason === 'conflict') { paint(); return { ok: true, conflict: true }; }
          return { ok: false, message: FAIL[res.reason] || FAIL.storage };
        }
      });
      d.form.dataset.req = requestId();
      const foot = d.form.querySelector('.modal__foot');
      foot.insertAdjacentHTML('beforeend', `<button class="btn btn--tertiary" type="button" data-absent-instead>${icon('x', 'icon--sm')}Mark absent instead</button>`);
      foot.querySelector('[data-absent-instead]').addEventListener('click', () => { absentInstead = true; d.close(); setTimeout(() => absenceDialog([r.child.id]), reduceMotion.matches ? 0 : 200); });
    }

    /* ---------------------------------------------------------------- Check-out (pickup verification) */

    function alertsBlock(child, { pickupOnly = false } = {}) {
      const list = child.alerts.filter(a => canSee(ALERT_SECTION[a.type]) && (!pickupOnly || a.type === 'custody'));
      if (!list.length) return '';
      return `<ul class="att-alerts">${list.map(a => `<li class="att-alert att-alert--${a.type === 'custody' || a.type === 'allergy' ? 'high' : 'mid'}"><span class="kid-alert kid-alert--${esc(a.type)}" aria-hidden="true">${icon(ALERT_ICON[a.type])}</span><span><b>${esc(store.ALERT_TYPES[a.type])}</b> ${esc(a.detail)}</span></li>`).join('')}</ul>`;
    }

    function checkOutDialog(r) {
      const child = r.child;
      let opts = store.pickupOptions(user, child.id);
      if (!opts) { window.NexoraToast?.show('Can’t check out', 'Your role can’t see this child’s pickup list. Ask the class teacher or the office.', 'info'); return; }
      const contactsHtml = () => `
        ${opts.restricted.map(b => `<div class="att-who att-who--barred" role="note"><span class="att-who__av" aria-hidden="true">${esc(initials(b.name))}</span><span><b>${esc(b.name)}</b><small>Restricted person</small></span><span class="att-dnr">${icon('alert-triangle', 'icon--sm')}Do not release</span></div>`).join('')}
        ${opts.contacts.map(p => p.eligible
          ? `<label class="att-who"><input type="radio" name="collector" value="${esc(p.id)}"><span class="att-who__av" aria-hidden="true">${esc(initials(p.name))}</span><span><b>${esc(p.name)}</b><small>${esc(p.relation)} · Authorised${p.hasIdRef ? ' · ID on file' : ''}</small></span></label>`
          : `<div class="att-who att-who--${p.restricted ? 'barred' : 'off'}"><span class="att-who__av" aria-hidden="true">${esc(initials(p.name))}</span><span><b>${esc(p.name)}</b><small>${esc(p.relation)} · ${esc(store.PICKUP_STATUS[p.status] || p.status)}</small></span><span class="${p.restricted ? 'att-dnr' : 'att-off'}">${p.restricted ? icon('alert-triangle', 'icon--sm') : ''}${esc(p.restricted ? 'Do not release' : p.reason)}</span></div>`).join('')}
        ${opts.contacts.some(p => p.eligible) ? '' : `<p class="att-none" role="alert">${icon('alert-triangle', 'icon--sm')}Nobody on file is currently allowed to collect ${esc(child.firstName)}. Do not release — contact a guardian and the office.</p>`}
        <label class="att-who att-who--else"><input type="radio" name="collector" value="__else"><span class="att-who__av" aria-hidden="true">?</span><span><b>Someone else</b><small>Not on the list</small></span></label>`;
      const d = kids.dialog({
        label: `${cls} / Check out`,
        title: `Check out ${child.preferredName || child.firstName}`,
        desc: '',
        body: `<div class="att-form att-out">
          <div class="att-out__who">${child.photo ? `<img class="att-av" src="${esc(child.photo)}" alt="">` : `<span class="att-av" aria-hidden="true">${esc(initials(store.childName(child)))}</span>`}<span><b>${esc(store.childName(child))}</b><small>${esc(cls)} · in since ${esc(timeOf(r.detail?.inAt) || 'time not recorded')}</small></span></div>
          ${alertsBlock(child, { pickupOnly: true })}
          ${opts.verification ? `<p class="att-policy">${icon('info', 'icon--sm')}${esc(opts.verification)}</p>` : ''}
          <fieldset class="field att-pick"><legend class="field__label">Who is collecting? <span class="field__req" aria-hidden="true">*</span></legend>
            <div class="att-who-list" data-who>${contactsHtml()}</div>
            <p class="field__hint field__hint--error" data-error-for="collectorId" hidden></p>
          </fieldset>
          <div class="att-else" data-else hidden role="alert"><p class="att-else__title">${icon('alert-triangle')}Not on authorised list — contact a guardian first</p><p>Do not release ${esc(child.firstName)}. Keep them with staff, call a guardian on file and follow the school’s safeguarding procedure.</p></div>
          <div class="field" data-pass-wrap hidden><label class="field__label" for="kd-passcode">Pickup passcode <span class="field__req" aria-hidden="true">*</span></label>
            <input class="input" id="kd-passcode" name="passcode" type="password" inputmode="numeric" autocomplete="off" maxlength="8">
            <p class="field__hint">Ask the collector to say the code. It’s checked, never shown or saved.</p>
            <p class="field__hint field__hint--error" data-error-for="passcode" hidden></p></div>
        </div>`,
        submit: 'Confirm check-out',
        async onSubmit(form) {
          const pick = form.querySelector('[name="collector"]:checked')?.value;
          if (!pick || pick === '__else') return { ok: false, errors: { collectorId: 'Choose an authorised person to complete check-out.' } };
          const res = await store.checkOut(store.currentUser(), { cls, childId: child.id, collectorId: pick, passcode: form.elements.passcode.value, requestId: form.dataset.req });
          form.elements.passcode.value = '';
          if (res.ok) { window.NexoraToast?.show('Checked out', `${child.firstName} collected by ${res.event.collector.name} · ${timeOf(res.event.at)}`); return res; }
          form.dataset.req = requestId();
          if (res.reason === 'conflict') { paint(); return { ok: false, message: FAIL.conflict }; }
          if (res.reason === 'not-authorised') { opts = store.pickupOptions(user, child.id) || opts; form.querySelector('[data-who]').innerHTML = contactsHtml(); update(); }
          if (res.errors) return { ok: false, errors: res.errors };
          return { ok: false, message: FAIL[res.reason] || FAIL.storage };
        }
      });
      const form = d.form;
      form.dataset.req = requestId();
      const btn = form.querySelector('[type="submit"]');
      const foot = form.querySelector('.modal__foot');
      foot.insertAdjacentHTML('beforeend', `<button class="btn btn--secondary" type="button" data-refuse hidden>${icon('x', 'icon--sm')}Close — ${esc(child.firstName)} stays in</button>`);
      const refuse = foot.querySelector('[data-refuse]');
      function update() {
        const pick = form.querySelector('[name="collector"]:checked')?.value;
        const other = pick === '__else';
        form.querySelector('[data-else]').hidden = !other;
        form.querySelector('[data-pass-wrap]').hidden = !(pick && !other && opts.passcodeRequired);
        btn.hidden = other;
        refuse.hidden = !other;
        btn.disabled = !pick || other || (opts.passcodeRequired && !form.elements.passcode.value.trim());
      }
      form.addEventListener('change', update);
      form.addEventListener('input', update);
      refuse.addEventListener('click', async () => {
        refuse.disabled = true;
        const res = await store.refuseRelease(store.currentUser(), { cls, childId: child.id });
        window.NexoraToast?.show('Not released', res.ok ? `${child.firstName} stays checked in. The attempt was recorded.` : `${child.firstName} stays checked in.`, 'info');
        d.close();
      });
      update();
    }

    /* ---------------------------------------------------------------- Absence */

    function absenceDialog(ids, { current = null } = {}) {
      const many = ids.length > 1;
      const names = ids.map(id => rowOf(id)?.child).filter(Boolean);
      const d = kids.dialog({
        label: `${cls} / Absence`,
        title: many ? `Mark ${ids.length} children absent` : `Mark ${names[0]?.firstName || 'child'} absent`,
        desc: many ? esc(names.map(c => c.firstName).join(', ')) : current ? 'Change the recorded reason.' : '',
        body: `<div class="att-form">
          <fieldset class="field att-pick"><legend class="field__label">Reason <span class="field__req" aria-hidden="true">*</span></legend>
            <div class="att-reasons">${Object.entries(store.ABSENCE_REASONS).map(([k, label]) => `<label class="cls-pick"><input type="radio" name="absReason" value="${k}"${current?.reason === k ? ' checked' : ''}><span><b>${esc(label)}</b></span></label>`).join('')}</div>
            <p class="field__hint" data-unknown-hint hidden>${icon('clock', 'icon--sm')}A reminder to contact the family appears after 10:00 if there’s still no reason.</p>
            <p class="field__hint field__hint--error" data-error-for="reason" hidden></p>
          </fieldset>
          ${kids.field('kd-note', 'Note', `<textarea class="input" id="kd-note" name="note" rows="3" maxlength="500" placeholder="Optional — e.g. parent called at 8:15">${esc(current?.note || '')}</textarea>`, { hint: 'Keep it short. Don’t add medical details that aren’t needed.' })}
        </div>`,
        submit: 'Confirm absence',
        danger: true,
        async onSubmit(form) {
          const reason = form.querySelector('[name="absReason"]:checked')?.value;
          if (!reason) return { ok: false, errors: { reason: 'Choose a reason.' } };
          const res = await store.markAbsent(store.currentUser(), { cls, childIds: ids, reason, note: form.elements.note.value, requestId: form.dataset.req });
          if (res.ok) {
            if (many) { selecting = false; selected.clear(); }
            const skipped = res.skipped?.length ? ` ${plural(res.skipped.length, 'child was', 'children were')} skipped because they’re already in or out.` : '';
            window.NexoraToast?.show(res.applied.length > 1 ? `${res.applied.length} children marked absent` : 'Marked absent', `${store.ABSENCE_REASONS[reason]}.${skipped}`);
            return res;
          }
          form.dataset.req = requestId();
          if (res.errors) return { ok: false, errors: res.errors };
          if (res.reason === 'conflict') { paint(); return { ok: false, message: 'None of these children can be marked absent now — they’ve already arrived or left.' }; }
          return { ok: false, message: FAIL[res.reason] || FAIL.storage };
        }
      });
      d.form.dataset.req = requestId();
      const hint = d.form.querySelector('[data-unknown-hint]');
      const sync = () => { hint.hidden = d.form.querySelector('[name="absReason"]:checked')?.value !== 'unknown'; };
      d.form.addEventListener('change', sync);
      sync();
    }

    /* ---------------------------------------------------------------- Details (out / absent / history) */

    function detailsDialog(r, v) {
      const dd = r.detail || {};
      const rows = [
        ['Status', `${STATUS[r.status].label}${r.late && r.status !== 'absent' ? ' · late' : ''}`],
        r.status !== 'absent' && r.status !== 'not-arrived' && ['Checked in', dd.inAt ? `${timeOf(dd.inAt)} by ${dd.inBy}` : 'Time not recorded (register)'],
        dd.droppedBy && ['Dropped off by', `${dd.droppedBy.name} (${dd.droppedBy.relation})`],
        r.status === 'out' && ['Collected', `${timeOf(dd.outAt)} by ${dd.collector?.name || '—'}${dd.collector?.relation ? ` (${dd.collector.relation})` : ''}`],
        r.status === 'out' && ['Verified', dd.verification?.method === 'passcode' ? 'Authorised contact + passcode' : 'Authorised contact'],
        r.status === 'out' && ['Released by', dd.outBy],
        r.status === 'absent' && ['Reason', dd.reason ? store.ABSENCE_REASONS[dd.reason] : 'Not given'],
        r.status === 'absent' && dd.note && ['Note', dd.note],
        r.status === 'absent' && dd.absentBy && ['Recorded', `${timeOf(dd.absentAt)} by ${dd.absentBy}`]
      ].filter(Boolean);
      const reminder = r.status === 'absent' ? store.remindersFor(cls, v.date).find(x => x.childId === r.child.id && x.status !== 'resolved') : null;
      const live = v.live && canAct;
      const d = kids.dialog({
        label: `${cls} / ${v.live ? 'Today' : dayLabel(v.date)}`,
        title: store.childName(r.child),
        desc: '',
        body: `<div class="att-form">${alertsBlock(r.child)}<dl class="token-sheet">${rows.map(([k, val]) => `<div><dt>${esc(k)}</dt><dd>${esc(val)}</dd></div>`).join('')}</dl>
          ${reminder ? `<p class="att-policy">${icon(reminder.status === 'due' ? 'phone' : 'clock', 'icon--sm')}${reminder.status === 'due' ? 'Call the family now — still no reason.' : 'Reminder to call the family after 10:00.'}</p>` : ''}
          ${r.status === 'out' ? '<p class="cp-muted">Checked-out children can’t be checked in again from here. If they came back, tell the office.</p>' : ''}
          ${!v.live ? '<p class="cp-muted">This is a past day, so it can’t be changed here.</p>' : ''}</div>`,
        submit: live && r.status === 'absent' ? 'Arrived — check in' : 'Close',
        async onSubmit() {
          if (!(live && r.status === 'absent')) return { ok: true };
          const res = await store.checkIn(store.currentUser(), { cls, childId: r.child.id, requestId: requestId() });
          if (res.ok) { window.NexoraToast?.show(res.late ? 'Checked in · late' : 'Checked in', `${r.child.firstName} · ${timeOf(res.event.at)} · absence corrected`); return res; }
          if (res.reason === 'conflict') paint();
          return { ok: false, message: FAIL[res.reason] || FAIL.storage };
        }
      });
      if (live && r.status === 'absent') {
        const foot = d.form.querySelector('.modal__foot');
        foot.insertAdjacentHTML('beforeend', `<button class="btn btn--tertiary" type="button" data-change-reason>Change reason</button>`);
        foot.querySelector('[data-change-reason]').addEventListener('click', () => { d.close(); setTimeout(() => absenceDialog([r.child.id], { current: dd }), reduceMotion.matches ? 0 : 200); });
      }
    }

    /* ---------------------------------------------------------------- Bulk */

    function bulkPresent() {
      const v = view();
      const n = v.counts.notArrived;
      kids.dialog({
        label: `${cls} / Mark all present`,
        title: `Check in ${plural(n, 'child', 'children')}?`,
        desc: `Everyone in ${esc(cls)} who hasn’t arrived is checked in now${v.start ? ` (after ${esc(v.start)} counts as late)` : ''}. Children already in, out or absent aren’t changed. You can undo for 5 seconds.`,
        body: '',
        submit: 'Mark all present',
        async onSubmit() {
          const res = await store.bulkCheckIn(store.currentUser(), { cls, requestId: requestId() });
          if (!res.ok) return { ok: false, message: res.reason === 'conflict' ? 'Nobody is left to check in.' : FAIL[res.reason] || FAIL.storage };
          const t = window.NexoraToast?.show('Attendance updated', `${plural(res.ids.length, 'child', 'children')} checked in.`, 'check-circle', {
            duration: 5000,
            action: {
              label: 'Undo',
              async onClick() {
                const u = await store.undoBulk(store.currentUser(), { cls, bulkId: res.bulkId });
                if (!u.ok) { toastFail(u); return; }
                window.NexoraToast?.show('Check-ins undone', `${plural(u.reverted.length, 'child', 'children')} back to not arrived.${u.skipped.length ? ` ${plural(u.skipped.length, 'child was', 'children were')} changed since, so left as they are.` : ''}`, 'info');
              }
            }
          });
          void t;
          return res;
        }
      });
    }

    /* ---------------------------------------------------------------- Events */

    main.addEventListener('change', e => {
      if (e.target.matches('[data-cls]')) { cls = e.target.value; selecting = false; selected.clear(); syncUrl(); paint(); return; }
      if (e.target.matches('[data-date]')) {
        const val = e.target.value;
        if (!val || val > today) { e.target.value = date; return; }
        date = val; selecting = false; selected.clear(); syncUrl(); paint(); return;
      }
      if (e.target.matches('[data-pick]')) {
        e.target.checked ? selected.add(e.target.dataset.pick) : selected.delete(e.target.dataset.pick);
        $('[data-tools]').innerHTML = toolsHtml(view());
      }
    });
    main.addEventListener('click', e => {
      if (e.target.closest('[data-retry]')) { load(); return; }
      const f = e.target.closest('[data-filter]');
      if (f) { filter = f.dataset.filter; syncUrl(); paint(); main.querySelector(`[data-filter="${filter}"]`)?.focus(); return; }
      if (e.target.closest('[data-bulk-in]')) { bulkPresent(); return; }
      if (e.target.closest('[data-select]')) { selecting = true; selected.clear(); if (filter !== 'all' && filter !== 'not-arrived') filter = 'all'; paint(); main.querySelector('[data-select-cancel]')?.focus(); return; }
      if (e.target.closest('[data-select-cancel]')) { selecting = false; selected.clear(); paint(); main.querySelector('[data-select]')?.focus(); return; }
      if (e.target.closest('[data-bulk-absent]')) { if (selected.size) absenceDialog([...selected]); return; }
      const t = e.target.closest('[data-kid]');
      if (!t) return;
      const v = view();
      const r = v.rows.find(x => x.child.id === t.dataset.kid);
      if (!r) { paint(); return; }
      if (!v.live || !canAct) { detailsDialog(r, v); return; }
      if (r.status === 'not-arrived') checkInDialog(r);
      else if (r.status === 'in') checkOutDialog(r);
      else detailsDialog(r, v);
    });

    let queued = false;
    store.subscribe(({ key }) => {
      if (!loaded || (key && !/^nexora-(register|attendance|children|class-registry|staff-attendance|substitutes|staff-shifts|class-routines|holidays|settings|guardians)/.test(key))) return;
      if (queued) return;
      queued = true;
      setTimeout(() => {
        queued = false;
        const focused = document.activeElement?.dataset?.kid || document.activeElement?.dataset?.pick;
        paint();
        if (focused) main.querySelector(`[data-kid="${CSS.escape(focused)}"], [data-pick="${CSS.escape(focused)}"]`)?.focus();
      }, 0);
    });
    // Unknown-absence reminders fall due while this page is open (no background job in this prototype).
    setInterval(() => { if (loaded) store.processDueReminders(); }, 60000);
    load();
  }

  window.NexoraAttendance = { render };
})();
