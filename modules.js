/* Module pages in app.html that own the daily workflows: NexoraModules.render(key, main, user) → true when handled.
   Each page opens the same NexoraWorkflows modal as the dashboard quick action, reads its filters
   from the URL (?status=…, ?cls=…, ?view=…) so dashboard KPIs land pre-filtered, and re-renders
   when the store changes. The app.js guard has already checked role and plan. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const flows = window.NexoraWorkflows;
  const { routes } = store;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const money = n => `₹${Math.round(n).toLocaleString('en-IN')}`;
  const when = iso => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const day = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const params = new URLSearchParams(location.search);
  const get = (k, fallback = '') => params.get(k) || fallback;

  function link(key, changes) {
    const q = new URLSearchParams(location.search);
    q.set('page', key);
    Object.entries(changes).forEach(([k, v]) => (v ? q.set(k, v) : q.delete(k)));
    return `app.html?${q}`;
  }
  const chips = (key, name, current, options) => `
    <nav class="mod__filters" aria-label="Filter">
      ${options.map(([value, label, count]) => `<a class="chip" href="${link(key, { [name]: value })}"${value === current ? ' aria-current="true"' : ''}>${esc(label)}${count != null ? ` <span class="tab__count">${count}</span>` : ''}</a>`).join('')}
    </nav>`;
  const head = (num, title, sub) => `
    <header class="panel__head">
      <span class="panel__num">${esc(num)}<i class="marker" aria-hidden="true"></i></span>
      <div><h1 class="panel__title" id="page-title" tabindex="-1">${esc(title)}</h1><p class="panel__sub">${sub}</p></div>
      <span class="tech-label">Page / ${esc(title)}</span>
    </header>`;
  const flowBtn = (kind, cls = 'btn--primary', preset = {}) => {
    if (!flows.available(kind)) return '';
    const m = flows.meta(kind);
    return `<button class="btn ${cls}" type="button" data-flow="${kind}" data-preset='${esc(JSON.stringify(preset))}' aria-haspopup="dialog">${icon(m.icon, 'icon--sm')}${esc(m.label)}</button>`;
  };
  const emptyState = (iconName, title, text) => `<div class="mod__empty"><span class="state-icon" aria-hidden="true">${icon(iconName)}</span><h2 class="card__title">${esc(title)}</h2><p>${esc(text)}</p></div>`;
  const back = `<a class="btn btn--secondary" href="${routes.dashboard}">${icon('arrow-left', 'icon--sm')}Dashboard</a>`;

  /* ------------------------------------------------------------ Attendance (?status=absent|late|not-taken · ?cls · ?view=ratio|staff) */

  function attendance(user) {
    const status = get('status', 'all');
    const cls = get('cls');
    const view = get('view');
    const reg = store.getRegister();
    const scope = store.classScope(user).filter(c => !cls || c === cls);
    const pupils = store.roster.filter(s => scope.includes(s.cls));
    const markOf = s => reg[s.cls]?.marks[s.id];
    const counts = { absent: pupils.filter(s => markOf(s) === 'absent').length, late: pupils.filter(s => markOf(s) === 'late').length, 'not-taken': scope.filter(c => !reg[c]).length };

    let list;
    if (status === 'absent' || status === 'late') {
      const kids = pupils.filter(s => markOf(s) === status);
      list = kids.length ? `<ul class="mod-list">${kids.map(s => `<li class="mod-row"><div class="mod-row__main"><p class="mod-row__title">${esc(s.name)}</p><p class="mod-row__sub">${esc(s.cls)} · marked by ${esc(reg[s.cls].takenBy)} at ${esc(when(reg[s.cls].takenAt))}</p></div><span class="badge ${status === 'absent' ? 'badge--error badge--absent' : 'badge--warning badge--late'}">${status === 'absent' ? 'Absent' : 'Late'}</span></li>`).join('')}</ul>`
        : emptyState('check-circle', status === 'absent' ? 'No absences' : 'No late arrivals', 'Nothing to follow up in the registers taken so far.');
    } else {
      const classes = scope.filter(c => status !== 'not-taken' || !reg[c]);
      list = classes.length ? `<ul class="mod-list">${classes.map(c => {
        const marks = reg[c] ? Object.values(reg[c].marks) : [];
        const n = store.roster.filter(s => s.cls === c).length;
        return `<li class="mod-row"><div class="mod-row__main"><p class="mod-row__title">${esc(c)}</p><p class="mod-row__sub">${reg[c] ? `${marks.filter(m => m !== 'absent').length} of ${n} on site · ${marks.filter(m => m === 'absent').length} absent · taken by ${esc(reg[c].takenBy)} at ${esc(when(reg[c].takenAt))}` : `${n} children · register not taken yet`}</p></div>
          <div class="mod-row__end"><span class="badge ${reg[c] ? 'badge--success' : 'badge--warning badge--late'}">${reg[c] ? 'Taken' : 'Not taken'}</span>${flowBtn('attendance', 'btn--secondary btn--sm', { cls: c }).replace(/Mark attendance/, reg[c] ? 'Edit register' : 'Take register')}</div></li>`;
      }).join('')}</ul>`
        : emptyState('check-circle', 'All attendance is up to date', 'Every register is taken for today.');
    }

    const ratios = store.ratioStatus(user).filter(r => !cls || r.cls === cls);
    const ratioHtml = `
      <section class="mod__section" aria-labelledby="ratio-title" id="ratios">
        <h2 class="mod__section-title" id="ratio-title">Class ratios</h2>
        <ul class="mod-list">${ratios.map(r => `<li class="mod-row${r.status === 'breach' ? ' is-flagged' : ''}"><div class="mod-row__main"><p class="mod-row__title">${esc(r.cls)} <span class="dlist__muted">· limit ${Number.isFinite(r.limit) ? `${r.limit} per educator` : 'not set'}</span></p><p class="mod-row__sub">${r.status === 'unavailable' ? esc(r.reason) : `${r.children} children · ${r.educators} of ${r.assigned} educators on duty`}</p></div><span class="badge ${r.status === 'breach' ? 'badge--error badge--absent' : r.status === 'ok' ? 'badge--success' : 'badge--late'}">${r.status === 'breach' ? 'Over ratio' : r.status === 'ok' ? 'Within ratio' : 'Unavailable'}</span></li>`).join('')}</ul>
      </section>`;

    const staff = store.canManageStaff(user) ? (() => {
      const att = store.getStaffAttendance();
      const eds = store.educators.filter(e => !cls || e.cls === cls);
      return `
        <section class="mod__section" aria-labelledby="staff-title" id="staff">
          <h2 class="mod__section-title" id="staff-title">Staff on duty today</h2>
          <ul class="mod-list">${eds.map(e => `<li class="mod-row"><div class="mod-row__main"><p class="mod-row__title">${esc(e.name)}</p><p class="mod-row__sub">${esc(e.cls)}</p></div>
            <div class="segmented" role="group" aria-label="${esc(e.name)} attendance">${['present', 'absent'].map(v => `<button type="button" data-staff="${e.id}" data-value="${v}" aria-pressed="${att[e.id] === v}">${v === 'present' ? 'On duty' : 'Away'}</button>`).join('')}</div></li>`).join('')}</ul>
          <p class="mod__note">Ratios update as soon as you change who’s on duty.</p>
        </section>`;
    })() : '';

    const registers = `
      <section class="mod__section" aria-labelledby="reg-title">
        <h2 class="mod__section-title" id="reg-title">Today’s registers${cls ? ` · ${esc(cls)}` : ''}</h2>
        ${chips('attendance', 'status', status, [['all', 'All classes'], ['absent', 'Absent', counts.absent], ['late', 'Late', counts.late], ['not-taken', 'Not taken', counts['not-taken']]])}
        ${list}
      </section>`;
    const sections = view === 'staff' ? [staff, ratioHtml, registers] : view === 'ratio' ? [ratioHtml, staff, registers] : [registers, ratioHtml, staff];
    return `
      <article class="panel mod" aria-labelledby="page-title">
        ${head('AT', 'Attendance', `${esc(new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))}${cls ? ` · ${esc(cls)} <a href="${link('attendance', { cls: '' })}">Show all classes</a>` : ''}`)}
        <div class="mod__bar"><div class="mod__actions">${flowBtn('attendance', 'btn--primary', cls ? { cls } : {})}</div>${back}</div>
        ${sections.join('')}
      </article>`;
  }

  /* ------------------------------------------------------------ Admissions (?status=open|followup|all) */

  function admissions() {
    const status = get('status', 'open');
    const all = store.getAdmissionEnquiries();
    const open = all.filter(store.isOpenEnquiry);
    const due = open.filter(store.followUpDue);
    const shown = status === 'followup' ? due : status === 'all' ? all : open;
    return `
      <article class="panel mod" aria-labelledby="page-title">
        ${head('AD', 'Admissions', 'Enquiries from first contact to enrolment.')}
        <div class="mod__bar"><div class="mod__actions">${flowBtn('enquiry')}</div>${back}</div>
        ${chips('admissions', 'status', status, [['open', 'Open', open.length], ['followup', 'Follow-up due', due.length], ['all', 'All', all.length]])}
        ${shown.length ? `<ul class="mod-list">${shown.map(e => {
          const isDue = store.followUpDue(e);
          return `<li class="mod-row${isDue && e.followUp < store.today() ? ' is-flagged' : ''}"><div class="mod-row__main"><p class="mod-row__title">${esc(e.child)} <span class="dlist__muted">· ${esc(e.programme)}</span></p><p class="mod-row__sub">${esc(e.parent)} · <a href="tel:${esc(e.phone.replace(/\s/g, ''))}">${esc(e.phone)}</a>${e.notes ? ` · ${esc(e.notes)}` : ''}</p></div>
            <div class="mod-row__end"><span class="badge badge--plain">${esc(store.ENQUIRY_STATUSES[e.status])}</span>${e.followUp && store.isOpenEnquiry(e) ? `<span class="badge ${isDue ? 'badge--warning badge--late' : ''}">Follow up ${e.followUp === store.today() ? 'today' : esc(day(e.followUp))}</span>` : ''}</div></li>`;
        }).join('')}</ul>` : emptyState('inbox', status === 'followup' ? 'No enquiries need follow-up' : 'No enquiries yet', 'New enquiries from families will appear here.')}
      </article>`;
  }

  /* ------------------------------------------------------------ Fees (?status=outstanding|overdue|all · ?cls) */

  function fees() {
    const status = get('status', 'outstanding');
    const cls = get('cls');
    const ledger = store.feeLedger().filter(l => !cls || l.student.cls === cls);
    const due = ledger.filter(l => l.balance > 0);
    const overdue = due.filter(l => l.overdue);
    const shown = (status === 'overdue' ? overdue : status === 'all' ? ledger : due).sort((a, b) => b.balance - a.balance || a.student.name.localeCompare(b.student.name));
    return `
      <article class="panel mod" aria-labelledby="page-title">
        ${head('FE', 'Fees', `${esc(store.TERM)} · ${money(due.reduce((s, l) => s + l.balance, 0))} outstanding${cls ? ` in ${esc(cls)} · <a href="${link('fees', { cls: '' })}">Show all classes</a>` : ''}`)}
        <div class="mod__bar"><div class="mod__actions">${flowBtn('payment')}</div>${back}</div>
        ${chips('fees', 'status', status, [['outstanding', 'Outstanding', due.length], ['overdue', 'Overdue', overdue.length], ['all', 'All', ledger.length]])}
        ${shown.length ? `<ul class="mod-list">${shown.map(l => `<li class="mod-row"><div class="mod-row__main"><p class="mod-row__title">${esc(l.student.name)} <span class="dlist__muted">· ${esc(l.student.cls)}</span></p><p class="mod-row__sub">${money(l.paid)} of ${money(l.amount)} paid · due ${esc(day(l.dueDate))}</p></div>
          <div class="mod-row__end">${l.balance > 0 ? `<span class="badge ${l.overdue ? 'badge--error badge--absent' : 'badge--warning badge--late'}">${money(l.balance)} ${l.overdue ? 'overdue' : 'due'}</span>${flowBtn('payment', 'btn--secondary btn--sm', { invoiceId: l.id })}` : '<span class="badge badge--success">Paid</span>'}</div></li>`).join('')}</ul>`
          : emptyState('check-circle', 'No fees outstanding', 'Every invoice in this view is paid.')}
        <p class="mod__note">Prototype: payments are recorded here only. No money is taken.</p>
      </article>`;
  }

  /* ------------------------------------------------------------ Safeguarding incidents (?status=open|resolved|all) */

  function safeguarding() {
    const status = get('status', 'open');
    const all = store.getIncidents();
    const shown = all.filter(i => status === 'all' || i.status === status).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return `
      <article class="panel mod" aria-labelledby="page-title">
        ${head('HS', 'Incidents', 'Accidents, illness and concerns, until a leader resolves them.')}
        <div class="mod__bar"><div class="mod__actions">${flowBtn('incident')}</div>${back}</div>
        ${chips('safeguarding', 'status', status, [['open', 'Open', all.filter(i => i.status === 'open').length], ['resolved', 'Resolved'], ['all', 'All']])}
        ${shown.length ? `<ul class="mod-list">${shown.map(i => {
          const s = store.studentById(i.studentId);
          return `<li class="mod-row${i.status === 'open' && i.severity === 'High' ? ' is-flagged' : ''}"><div class="mod-row__main"><p class="mod-row__title">${esc(s?.name || 'Unknown child')} <span class="dlist__muted">· ${esc(i.type)} · ${esc(s?.cls || '')}</span></p><p class="mod-row__sub">${esc(when(i.occurredAt))} · ${esc(i.description)}${i.action ? ` · ${esc(i.action)}` : ''}</p><p class="mod-row__sub">${i.parentInformed ? 'Parent told' : '<strong class="text-warning">Parent not told</strong>'} · logged by ${esc(i.createdBy)}</p></div>
            <div class="mod-row__end"><span class="badge ${i.severity === 'High' ? 'badge--error badge--absent' : i.severity === 'Medium' ? 'badge--warning badge--late' : ''}">${esc(i.severity)}</span>${i.status === 'open' ? `<button class="btn btn--secondary btn--sm" type="button" data-resolve="${esc(i.id)}">${icon('check', 'icon--sm')}Resolve</button>` : '<span class="badge badge--success">Resolved</span>'}</div></li>`;
        }).join('')}</ul>` : emptyState('shield-check', status === 'open' ? 'No incidents today' : 'No incidents', 'Nothing is waiting for follow-up.')}
      </article>`;
  }

  /* ------------------------------------------------------------ Parent communication + S32 emergency broadcasts */

  function communication(user) {
    const list = store.getAnnouncements();
    const active = store.activeBroadcasts();
    const total = store.users.filter(u => u.schoolId === store.school.id).length;
    const sos = store.canBroadcast(user) ? `
      <section class="mod__section" aria-labelledby="sos-title">
        <h2 class="mod__section-title" id="sos-title">Emergency broadcasts</h2>
        ${active.length ? `<ul class="mod-list">${active.map(b => `<li class="mod-row is-flagged"><div class="mod-row__main"><p class="mod-row__title">${esc(b.message)}</p><p class="mod-row__sub">Sent by ${esc(b.createdByName)} · ${esc(when(b.createdAt))} · acknowledged by ${b.ackBy.length} of ${total} staff</p></div><button class="btn btn--secondary btn--sm" type="button" data-end="${esc(b.id)}">End broadcast</button></li>`).join('')}</ul>` : '<p class="mod__note">No emergency broadcast is active.</p>'}
        <div>${flowBtn('broadcast', 'btn--danger')}</div>
      </section>` : '';
    return `
      <article class="panel mod" aria-labelledby="page-title">
        ${head('PC', 'Parent Communication', 'Announcements to families and staff.')}
        <div class="mod__bar"><div class="mod__actions">${flowBtn('announcement')}</div>${back}</div>
        ${sos}
        <section class="mod__section" aria-labelledby="ann-title">
          <h2 class="mod__section-title" id="ann-title">Announcements</h2>
          ${list.length ? `<ul class="mod-list">${list.map(a => `<li class="mod-row"><div class="mod-row__main"><p class="mod-row__title">${esc(a.title)}</p><p class="mod-row__sub">${esc(a.body)}</p><p class="mod-row__sub">${esc(a.audience)} · ${esc(a.createdBy)} · ${esc(when(a.createdAt))}</p></div></li>`).join('')}</ul>` : emptyState('megaphone', 'No announcements yet', 'Announcements to families and staff will appear here.')}
        </section>
      </article>`;
  }

  const PAGES = { attendance, admissions, fees, safeguarding, communication };

  function render(key, main, user) {
    if (!PAGES[key]) return false;
    main.classList.add('record-page');
    const draw = () => {
      const focusKey = document.activeElement?.closest('[data-flow],[data-staff],[data-resolve],[data-end]');
      const selector = focusKey ? ['data-flow', 'data-staff', 'data-resolve', 'data-end'].map(a => focusKey.hasAttribute(a) ? `[${a}="${focusKey.getAttribute(a)}"]${a === 'data-staff' ? `[data-value="${focusKey.dataset.value}"]` : ''}` : '').find(Boolean) : null;
      main.innerHTML = PAGES[key](store.currentUser());
      if (selector) main.querySelector(selector)?.focus();
    };
    draw();
    const view = get('view');
    if (view) document.getElementById(view === 'ratio' ? 'ratios' : 'staff')?.scrollIntoView({ block: 'start' });

    main.addEventListener('click', async e => {
      const f = e.target.closest('[data-flow]');
      if (f) { flows.open(f.dataset.flow, { preset: JSON.parse(f.dataset.preset || '{}') }); return; }
      const st = e.target.closest('[data-staff]');
      if (st) {
        const r = await store.setStaffAttendance(store.currentUser(), st.dataset.staff, st.dataset.value);
        if (!r.ok) window.NexoraToast.show('Not saved', 'Staff attendance couldn’t be saved. Please try again.', 'info');
        return;
      }
      const res = e.target.closest('[data-resolve]');
      if (res) {
        const r = await store.resolveIncident(store.currentUser(), res.dataset.resolve);
        window.NexoraToast.show(r.ok ? 'Incident resolved' : 'Not saved', r.ok ? '' : 'Please try again.', r.ok ? 'check-circle' : 'info');
        return;
      }
      const end = e.target.closest('[data-end]');
      if (end) {
        const r = await store.endBroadcast(store.currentUser(), end.dataset.end);
        window.NexoraToast.show(r.ok ? 'Broadcast ended' : 'Not saved', r.ok ? 'It no longer shows on dashboards.' : 'Please try again.', r.ok ? 'check-circle' : 'info');
      }
    });
    let queued = false;
    store.subscribe(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; draw(); });
    });
    return true;
  }

  window.NexoraModules = { render };
})();
