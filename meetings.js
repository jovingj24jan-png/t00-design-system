/* Parent–Teacher Meetings (app.html?page=meetings[&tab=availability|bookings|records][&week=YYYY-MM-DD][&day=YYYY-MM-DD]
   [&teacher=<educatorId>][&booking=<id>][&record=<id>])
   Slots, bookings and conference records go through the store (planSlots/createSlots, bookMeeting, cancelMeeting,
   saveConferenceRecord, shareConferenceRecord …), which re-checks permissions and availability at the moment of saving.
   Test hook: ?fail=1. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const kids = window.NexoraChildren;
  const { routes } = store;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const params = new URLSearchParams(location.search);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobileQ = matchMedia('(max-width: 767px)');
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (s, n) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };
  const mondayOf = s => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
  const fmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(`${s}T12:00:00`).toLocaleDateString('en-GB', o);
  const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const when = s => new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const toast = (t, x, i = 'info', o) => window.NexoraToast?.show(t, x, i, o);
  const TABS = [['availability', 'Availability'], ['bookings', 'Bookings'], ['records', 'Conference records']];
  const STATE_LABEL = { open: 'Open', booked: 'Booked', past: 'Past', unavailable: 'Unavailable' };
  const STATUS_TONE = { upcoming: 'info', completed: 'success', cancelled: 'neutral', no_show: 'warning' };
  const ACT_TONE = { pending: 'info', completed: 'success', overdue: 'error' };
  const ACT_LABEL = { pending: 'Pending', completed: 'Completed', overdue: 'Overdue' };
  const FAIL = {
    forbidden: 'Your role can’t do this. Nothing was changed.',
    missing: 'This record no longer exists. Refresh the page.',
    locked: 'This meeting has already been completed or cancelled.',
    already: 'This booking was already cancelled. No second notice was recorded.',
    early: 'The meeting hasn’t started yet.',
    booked: 'This slot has a booking. Cancel the booking first.',
    storage: 'This couldn’t be saved on this device. Nothing was changed. Please try again.'
  };
  const failText = r => (r.errors && Object.values(r.errors)[0]) || FAIL[r.reason] || FAIL.storage;
  const chip = (tone, text, ic = '') => `<span class="badge badge--plain an-chip an-chip--${tone}">${ic ? icon(ic) : ''}${esc(text)}</span>`;
  const state = (iconName, title, text, action = '', tone = '') => `<div class="kids-empty an-state"${tone === 'error' ? ' role="alert"' : ''}><span class="state-icon${tone ? ` state-icon--${tone}` : ''}" aria-hidden="true">${icon(iconName)}</span><h2 class="kids-empty__title">${title}</h2><p>${text}</p>${action}</div>`;
  const delivery = r => (/^queued/.test(r) ? 'recorded as queued (demo — not delivered)' : 'not sent: the family has no parent-app account');

  function render(key, main, user) {
    if (key !== 'meetings') return false;
    page(main, user);
    return true;
  }

  function page(main, user) {
    const lead = store.meetingTeachers(user).length > 1;
    const mine = store.educatorOf(user);
    const teachers = store.meetingTeachers(user);
    const canBook = store.canUseMeetings(user) && teachers.length > 0;
    let tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'availability';
    let week = /^\d{4}-\d{2}-\d{2}$/.test(params.get('week') || '') ? mondayOf(params.get('week')) : mondayOf(store.today());
    let day = /^\d{4}-\d{2}-\d{2}$/.test(params.get('day') || '') ? params.get('day') : store.today();
    let teacherF = params.get('teacher') || '';
    const bf = { q: '', from: '', to: '', teacher: '', cls: '', mode: '', status: 'upcoming' };
    const rf = { q: '', teacher: '', cls: '', from: '', to: '', follow: '' };
    let loaded = false;
    let failOnce = params.get('fail') === '1';
    let drawer = null;

    main.classList.add('kids-page');
    document.title = 'Parent–Teacher Meetings · Nexora';
    main.innerHTML = `<div class="kids pt">
      <header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Parent–Teacher Meetings</h1><p class="kids-head__sub">Plan conversations, support each child's progress, and keep agreed actions on track.</p></div>
        ${canBook ? `<div class="an-head__actions"><button class="btn btn--secondary" type="button" data-book>${icon('user-plus', 'icon--sm')}Book for a family</button><button class="btn btn--primary kids-yellow" type="button" data-generate>${icon('plus', 'icon--sm')}Generate slots</button></div>` : ''}</header>
      <section class="cls-sum" aria-label="Summary" data-sum>${'<span class="skeleton kpi kpi--static" style="min-height:112px"></span>'.repeat(4)}</section>
      <div class="tabs an-tabs" role="tablist" aria-label="Meetings">${TABS.map(([k, l]) => `<button class="tab" type="button" role="tab" id="pt-tab-${k}" aria-controls="pt-panel" aria-selected="${k === tab}" tabindex="${k === tab ? 0 : -1}" data-tab="${k}">${l}</button>`).join('')}</div>
      <section class="pt-panel" id="pt-panel" role="tabpanel" aria-labelledby="pt-tab-${tab}" aria-busy="true" data-panel><span class="skeleton" style="display:block;height:320px;border-radius:var(--radius-lg)"></span></section></div>`;
    const $ = s => main.querySelector(s);
    const syncUrl = () => {
      const u = new URL(location.href);
      const set = (k, v, def = '') => (v && v !== def ? u.searchParams.set(k, v) : u.searchParams.delete(k));
      set('tab', tab, 'availability'); set('week', week, mondayOf(store.today())); set('day', day, store.today()); set('teacher', teacherF);
      ['booking', 'record'].forEach(k => { if (!drawer || drawer.kind !== k) u.searchParams.delete(k); });
      if (drawer) u.searchParams.set(drawer.kind, drawer.id);
      history.replaceState(null, '', u);
    };
    const child = id => store.childById(id);
    const childLabel = id => { const c = child(id); return c ? store.childName(c) : 'Child'; };
    const famName = id => store.familyById(id)?.name || 'Family';
    const teacherClass = id => store.getClassRegistry().find(c => c.status === 'active' && c.staffIds.includes(id))?.name || '';

    /* ---------------------------------------------------------------- Summary */

    function summary() {
      const s = store.meetingSummary(user);
      const kpi = (ic, label, value, ctx, tone = '') => `<div class="kpi kpi--static cls-sum__item${tone ? ` kpi--${tone}` : ''}"><span class="kpi__top"><span class="kpi__icon" aria-hidden="true">${icon(ic)}</span><span class="kpi__label">${label}</span></span><span class="kpi__value">${value}</span><span class="kpi__context">${ctx}</span></div>`;
      $('[data-sum]').innerHTML = kpi('calendar-check', 'Open slots', s.open, s.open ? 'Future times families can book' : 'Generate slots to open times')
        + kpi('clock', 'Upcoming meetings', s.upcoming, s.awaiting ? `${plural(s.awaiting, 'meeting')} awaiting an outcome` : 'Booked and still to come')
        + kpi('check-circle', 'Completed meetings', s.completed, 'With or without a record')
        + kpi('list', 'Follow-up actions due', s.due, s.overdue ? `${s.overdue} overdue` : 'Due in the next 7 days', s.overdue ? 'warn' : '');
    }

    /* ---------------------------------------------------------------- Availability */

    const slotText = s => `${s.start}–${s.end}`;
    const legend = `<ul class="pt-legend" aria-label="Legend"><li><i class="pt-dot is-open"></i>Open</li><li><i class="pt-dot is-booked"></i>Booked</li><li><i class="pt-dot is-past"></i>Past</li><li><i class="pt-dot is-unavailable"></i>Unavailable</li></ul>`;
    function slotChip(s, { withTeacher = false } = {}) {
      const len = mins(s.end) - mins(s.start);
      const who = s.booking ? `${childLabel(s.booking.childId)} · ${famName(s.booking.familyId)}` : s.bookedHidden ? 'Booked by another class' : '';
      const modeTag = s.mode === 'video' ? ' · video only' : s.mode === 'in_person' ? ' · in person only' : '';
      const body = `<span class="pt-slot__t">${esc(slotText(s))}</span><span class="pt-slot__s">${STATE_LABEL[s.state]} · ${len} min${modeTag}</span>${withTeacher ? `<span class="pt-slot__w">${esc(store.teacherName(s.teacherId))}</span>` : ''}${who ? `<span class="pt-slot__w">${esc(who)}</span>` : ''}`;
      const label = `${slotText(s)}, ${fmt(s.date, { weekday: 'long', day: 'numeric', month: 'long' })}, ${store.teacherName(s.teacherId)}: ${STATE_LABEL[s.state]}${who ? `, ${who}` : ''}`;
      if (s.state === 'open' && canBook) return `<button class="pt-slot is-open" type="button" data-slot="${esc(s.id)}" aria-label="${esc(`${label}. Book`)}">${body}<span class="pt-slot__go">Book${icon('arrow-right', 'icon--sm')}</span></button>`;
      if (s.state === 'booked' && s.booking) return `<button class="pt-slot is-booked" type="button" data-booking="${esc(s.booking.id)}" aria-label="${esc(`${label}. View booking`)}">${body}</button>`;
      return `<span class="pt-slot is-${s.state}" role="img" aria-label="${esc(label)}">${body}</span>`;
    }
    function availability() {
      const ids = teacherF ? [teacherF] : teachers.map(t => t.id);
      const tsel = `<label class="sr-only" for="pt-tf">Teacher</label><select class="input" id="pt-tf" data-teacherf>${lead ? '<option value="">All teachers</option>' : ''}${teachers.map(t => `<option value="${esc(t.id)}"${t.id === teacherF ? ' selected' : ''}>${esc(t.name)}${teacherClass(t.id) ? ` · ${esc(teacherClass(t.id))}` : ''}</option>`).join('')}</select>`;
      if (!teachers.length) return state('lock', 'No teacher profile', 'Your account isn’t linked to a teacher, so there are no slots to show.');
      if (mobileQ.matches) {
        const slots = store.meetingSlots(user, { from: day, to: day, teacherIds: ids });
        const sd = store.schoolDay(day);
        return `<div class="pt-bar"><div class="rs-datenav"><button class="btn btn--icon-ghost" type="button" data-day="-1" aria-label="Previous day">${icon('arrow-left')}</button><b class="rs-datenav__label" aria-live="polite">${esc(fmt(day, { weekday: 'long', day: 'numeric', month: 'short' }))}${day === store.today() ? ' · Today' : ''}</b><button class="btn btn--icon-ghost" type="button" data-day="1" aria-label="Next day">${icon('arrow-right')}</button></div><button class="btn btn--tertiary btn--sm" type="button" data-today>Today</button>${tsel}</div>${legend}
          ${slots.length ? `<ul class="pt-daylist">${slots.map(s => `<li>${slotChip(s, { withTeacher: true })}</li>`).join('')}</ul>` : state('calendar-check', sd.open ? 'No slots this day' : `Closed — ${esc(sd.name)}`, sd.open ? 'Generate slots to open times families can book.' : 'The school is closed this day.', canBook && sd.open ? '<button class="btn btn--primary kids-yellow" type="button" data-generate>Generate slots</button>' : '')}`;
      }
      const end = addDays(week, 6);
      const slots = store.meetingSlots(user, { from: week, to: end, teacherIds: ids });
      const days = Array.from({ length: 7 }, (_, i) => addDays(week, i)).filter(d => store.schoolDay(d).kind !== 'closed' || slots.some(s => s.date === d));
      const rows = ids.filter(id => teacherF || slots.some(s => s.teacherId === id));
      const head = `<div class="pt-bar"><div class="rs-datenav"><button class="btn btn--icon-ghost" type="button" data-week="-1" aria-label="Previous week">${icon('arrow-left')}</button><b class="rs-datenav__label" aria-live="polite">${esc(fmt(week, { day: 'numeric', month: 'short' }))} – ${esc(fmt(end, { day: 'numeric', month: 'short', year: 'numeric' }))}</b><button class="btn btn--icon-ghost" type="button" data-week="1" aria-label="Next week">${icon('arrow-right')}</button></div><button class="btn btn--tertiary btn--sm" type="button" data-today>Today</button>${tsel}</div>${legend}`;
      if (!rows.length) return head + state('calendar-check', 'No slots this week', 'Generate slots to open times families can book. Slots only appear for teachers who have them.', canBook ? '<button class="btn btn--primary kids-yellow" type="button" data-generate>Generate slots</button>' : '');
      return `${head}<div class="pt-week" role="region" aria-label="Weekly availability" tabindex="0" style="--pt-days:${days.length}">
        <div class="pt-week__head" aria-hidden="true"><span>Teacher</span>${days.map(d => { const sd = store.schoolDay(d); return `<span class="${d === store.today() ? 'is-today' : ''}">${esc(fmt(d))}${!sd.open ? `<small>${esc(sd.kind === 'holiday' ? sd.name : 'Closed')}</small>` : ''}</span>`; }).join('')}</div>
        ${rows.map(id => { const shift = store.shiftOf(id, week) || store.shiftOf(id, addDays(week, 1)); const mineSlots = slots.filter(s => s.teacherId === id); return `<section class="pt-trow" aria-labelledby="pt-t-${esc(id)}"><h3 class="pt-trow__t" id="pt-t-${esc(id)}">${esc(store.teacherName(id))}<small>${esc(teacherClass(id) || 'Relief staff')}${shift ? ` · works ${esc(shift.start)}–${esc(shift.end)}` : ''} · ${plural(mineSlots.filter(s => s.state === 'open').length, 'open slot')}</small></h3>
          ${days.map(d => { const ds = mineSlots.filter(s => s.date === d); return `<div class="pt-cell"><span class="pt-cell__d">${esc(fmt(d))}</span>${ds.length ? `<ul>${ds.map(s => `<li>${slotChip(s)}</li>`).join('')}</ul>` : '<span class="pt-none">—</span>'}</div>`; }).join('')}</section>`; }).join('')}
      </div>`;
    }

    /* ---------------------------------------------------------------- Bookings */

    const isPast = b => new Date(`${b.date}T${b.start}:00`).getTime() <= Date.now();
    const statusChip = b => (b.status === 'upcoming' && isPast(b) ? chip('warning', 'Awaiting outcome', 'clock') : chip(STATUS_TONE[b.status], store.BOOKING_STATUSES[b.status], b.status === 'completed' ? 'check' : b.status === 'cancelled' ? 'x' : b.status === 'no_show' ? 'alert-triangle' : 'calendar-check'));
    const modeChip = b => chip('neutral', store.MEETING_MODES[b.mode], b.mode === 'video' ? 'camera' : 'door');
    function bookings() {
      const all = store.meetingBookings(user);
      const ql = bf.q.trim().toLowerCase();
      const rows = all.filter(b => (!ql || `${famName(b.familyId)} ${childLabel(b.childId)} ${store.teacherName(b.teacherId)}`.toLowerCase().includes(ql)) && (!bf.from || b.date >= bf.from) && (!bf.to || b.date <= bf.to) && (!bf.teacher || b.teacherId === bf.teacher) && (!bf.cls || child(b.childId)?.cls === bf.cls) && (!bf.mode || b.mode === bf.mode) && (!bf.status || (bf.status === 'upcoming' ? b.status === 'upcoming' : b.status === bf.status)));
      rows.sort((a, b) => (bf.status === 'upcoming' ? 1 : -1) * (a.date + a.start).localeCompare(b.date + b.start));
      const classes = [...new Set(store.getClassRegistry().filter(c => c.status === 'active').map(c => c.name))];
      const filters = `<div class="fm-filters" role="search" aria-label="Filter bookings">
        <div class="an-search">${icon('search', 'icon--sm')}<label class="sr-only" for="pt-bq">Search bookings</label><input class="input" id="pt-bq" type="search" placeholder="Family, child or teacher" value="${esc(bf.q)}" data-bf="q" autocomplete="off"></div>
        <label class="sr-only" for="pt-bs">Status</label><select class="input" id="pt-bs" data-bf="status"><option value="">All statuses</option>${Object.entries(store.BOOKING_STATUSES).map(([k, l]) => `<option value="${k}"${bf.status === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
        ${lead ? `<label class="sr-only" for="pt-bt">Teacher</label><select class="input" id="pt-bt" data-bf="teacher"><option value="">All teachers</option>${teachers.map(t => `<option value="${esc(t.id)}"${bf.teacher === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select>` : ''}
        <label class="sr-only" for="pt-bc">Class</label><select class="input" id="pt-bc" data-bf="cls"><option value="">All classes</option>${classes.map(c => `<option${bf.cls === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <label class="sr-only" for="pt-bm">Mode</label><select class="input" id="pt-bm" data-bf="mode"><option value="">Any mode</option>${Object.entries(store.MEETING_MODES).map(([k, l]) => `<option value="${k}"${bf.mode === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <label class="sr-only" for="pt-bfrom">From</label><input class="input" type="date" id="pt-bfrom" aria-label="From date" value="${esc(bf.from)}" data-bf="from"><label class="sr-only" for="pt-bto">To</label><input class="input" type="date" id="pt-bto" aria-label="To date" value="${esc(bf.to)}" data-bf="to">
      </div>`;
      if (!all.length) return filters + state('calendar-check', 'No meetings booked yet', 'Book a meeting for a family from an open slot.', canBook ? '<button class="btn btn--primary kids-yellow" type="button" data-book>Book for a family</button>' : '');
      if (!rows.length) return filters + state('filter', 'No meetings match', 'Try another filter or search.', '<button class="btn btn--tertiary btn--sm" type="button" data-bclear>Clear filters</button>');
      const groups = [];
      rows.forEach(b => { const g = groups.find(x => x.date === b.date); g ? g.items.push(b) : groups.push({ date: b.date, items: [b] }); });
      const dateHead = d => `${fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}${d === store.today() ? ' · Today' : ''}`;
      return `${filters}<p class="sr-only" aria-live="polite">${plural(rows.length, 'meeting')}</p>
        <div class="table-shell an-table"><table class="data-table pt-table"><caption class="sr-only">Meetings</caption><thead><tr><th scope="col">Time</th><th scope="col">Family</th><th scope="col">Child</th><th scope="col">Teacher</th><th scope="col">Mode</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
        ${groups.map(g => `<tbody><tr class="pt-group"><th scope="rowgroup" colspan="7">${esc(dateHead(g.date))}</th></tr>${g.items.map(b => `<tr><td class="pt-time">${esc(b.start)}–${esc(b.end)}</td><td>${esc(famName(b.familyId))}</td><td>${esc(childLabel(b.childId))}<br><small class="cp-muted">${esc(child(b.childId)?.cls || '')}</small></td><td>${esc(store.teacherName(b.teacherId))}</td><td>${modeChip(b)}</td><td>${statusChip(b)}</td><td class="fr-act"><button class="btn btn--secondary btn--sm" type="button" data-booking="${esc(b.id)}">View</button></td></tr>`).join('')}</tbody>`).join('')}</table></div>
        <div class="an-cards pt-cards">${groups.map(g => `<h3 class="pt-cards__d">${esc(dateHead(g.date))}</h3><ul class="pt-cards__l">${g.items.map(b => `<li><button class="panel an-card pt-card" type="button" data-booking="${esc(b.id)}"><span class="an-card__head"><b>${esc(b.start)}–${esc(b.end)}</b>${statusChip(b)}</span><span class="pt-card__who">${esc(childLabel(b.childId))} · ${esc(famName(b.familyId))}</span><span class="an-card__meta">${icon('user', 'icon--sm')}<span>${esc(store.teacherName(b.teacherId))}</span></span><span class="an-card__meta">${modeChip(b)}</span></button></li>`).join('')}</ul>`).join('')}</div>`;
    }

    /* ---------------------------------------------------------------- Records */

    const follow = r => { const st = r.actions.map(store.conferenceActionStatus); return { total: st.length, done: st.filter(x => x === 'completed').length, overdue: st.filter(x => x === 'overdue').length }; };
    const followChip = r => { const f = follow(r); return !f.total ? chip('neutral', 'No actions') : f.overdue ? chip('error', `${f.overdue} overdue`, 'alert-triangle') : f.done === f.total ? chip('success', 'All done', 'check') : chip('info', `${f.total - f.done} pending`, 'clock'); };
    const shareChip = r => (r.shared ? chip('success', 'Shared with family', 'eye') : chip('neutral', 'Not shared', 'eye-off'));
    function records() {
      const all = store.conferenceRecords(user);
      const ql = rf.q.trim().toLowerCase();
      const rows = all.filter(r => (!ql || `${famName(r.familyId)} ${childLabel(r.childId)} ${r.topic}`.toLowerCase().includes(ql)) && (!rf.teacher || r.teacherId === rf.teacher) && (!rf.cls || child(r.childId)?.cls === rf.cls) && (!rf.from || r.date >= rf.from) && (!rf.to || r.date <= rf.to)
        && (!rf.follow || (rf.follow === 'overdue' ? follow(r).overdue : rf.follow === 'pending' ? follow(r).total - follow(r).done > 0 : follow(r).total && follow(r).done === follow(r).total)));
      const classes = [...new Set(store.getClassRegistry().filter(c => c.status === 'active').map(c => c.name))];
      const filters = `<div class="fm-filters" role="search" aria-label="Filter conference records">
        <div class="an-search">${icon('search', 'icon--sm')}<label class="sr-only" for="pt-rq">Search records</label><input class="input" id="pt-rq" type="search" placeholder="Child, family or topic" value="${esc(rf.q)}" data-rf="q" autocomplete="off"></div>
        ${lead ? `<label class="sr-only" for="pt-rt">Teacher</label><select class="input" id="pt-rt" data-rf="teacher"><option value="">All teachers</option>${teachers.map(t => `<option value="${esc(t.id)}"${rf.teacher === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select>` : ''}
        <label class="sr-only" for="pt-rc">Class</label><select class="input" id="pt-rc" data-rf="cls"><option value="">All classes</option>${classes.map(c => `<option${rf.cls === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <label class="sr-only" for="pt-rfol">Follow-up</label><select class="input" id="pt-rfol" data-rf="follow"><option value="">Any follow-up</option><option value="overdue"${rf.follow === 'overdue' ? ' selected' : ''}>Overdue actions</option><option value="pending"${rf.follow === 'pending' ? ' selected' : ''}>Pending actions</option><option value="done"${rf.follow === 'done' ? ' selected' : ''}>All done</option></select>
        <input class="input" type="date" aria-label="From date" value="${esc(rf.from)}" data-rf="from"><input class="input" type="date" aria-label="To date" value="${esc(rf.to)}" data-rf="to">
      </div>`;
      if (!all.length) return filters + state('note', 'No conference records yet', 'After a meeting, open it from Bookings and add a record of what was discussed and agreed.');
      if (!rows.length) return filters + state('filter', 'No records match', 'Try another filter or search.');
      return `${filters}<p class="sr-only" aria-live="polite">${plural(rows.length, 'record')}</p>
        <div class="table-shell an-table"><table class="data-table"><caption class="sr-only">Conference records</caption><thead><tr><th scope="col">Date</th><th scope="col">Child</th><th scope="col">Teacher</th><th scope="col">Topic</th><th scope="col">Actions</th><th scope="col">Follow-up</th><th scope="col">Family</th><th scope="col"><span class="sr-only">Open</span></th></tr></thead>
        <tbody>${rows.map(r => { const f = follow(r); return `<tr><td>${esc(fmt(r.date))}</td><td><b>${esc(childLabel(r.childId))}</b><br><small class="cp-muted">${esc(famName(r.familyId))}</small></td><td>${esc(store.teacherName(r.teacherId))}</td><td>${esc(r.topic || '—')}${r.notes ? `<br><small class="cp-muted">${icon('note', 'icon--sm')} Notes recorded</small>` : ''}</td><td>${f.done}/${f.total}</td><td>${followChip(r)}</td><td>${shareChip(r)}</td><td class="fr-act"><button class="btn btn--secondary btn--sm" type="button" data-record="${esc(r.id)}">Open</button></td></tr>`; }).join('')}</tbody></table></div>
        <ul class="an-cards">${rows.map(r => { const f = follow(r); return `<li><button class="panel an-card pt-card" type="button" data-record="${esc(r.id)}"><span class="an-card__head"><b>${esc(childLabel(r.childId))}</b>${followChip(r)}</span><span class="an-card__meta">${icon('calendar-check', 'icon--sm')}<span>${esc(fmt(r.date))} · ${esc(store.teacherName(r.teacherId))}</span></span><span class="an-card__meta">${icon('note', 'icon--sm')}<span>${esc(r.topic || 'Conference')}${r.notes ? ' · notes recorded' : ''}</span></span><span class="an-card__meta">${icon('list', 'icon--sm')}<span>${f.done}/${f.total} actions done</span></span><span class="an-card__meta">${shareChip(r)}</span></button></li>`; }).join('')}</ul>`;
    }

    function paint() {
      summary();
      TABS.forEach(([k]) => { const b = $(`#pt-tab-${k}`); b.setAttribute('aria-selected', String(k === tab)); b.tabIndex = k === tab ? 0 : -1; });
      const panel = $('[data-panel]');
      panel.setAttribute('aria-labelledby', `pt-tab-${tab}`);
      panel.removeAttribute('aria-busy');
      const fid = document.activeElement?.id && main.contains(document.activeElement) ? document.activeElement.id : '';
      const pos = document.activeElement?.selectionStart;
      panel.innerHTML = tab === 'availability' ? availability() : tab === 'bookings' ? bookings() : records();
      if (fid) { const el = main.querySelector(`#${CSS.escape(fid)}`); if (el) { el.focus(); if (pos != null && el.type === 'search') el.setSelectionRange(pos, pos); } }
      drawer?.refresh();
    }

    /* ---------------------------------------------------------------- Generate slots */

    function generateDialog() {
      const nextMon = mondayOf(addDays(store.today(), 7));
      const allowed = teachers;
      const sel = new Set(teacherF ? [teacherF] : mine ? [mine.id] : []);
      let tq = '';
      const d = kids.dialog({
        label: 'Meetings / Availability', title: 'Generate slots',
        desc: 'Create bookable times for one or more teachers. Existing slots and bookings are never overwritten.',
        body: `<div class="pt-gen">
          <fieldset class="an-fs"><legend class="field__label">Teachers <span class="field__req" aria-hidden="true">*</span></legend>
            ${allowed.length > 6 ? `<div class="an-search an-search--block">${icon('search', 'icon--sm')}<label class="sr-only" for="pt-gq">Find teachers</label><input class="input" id="pt-gq" type="search" placeholder="Search teachers" data-gq></div>` : ''}
            <div class="an-picks" data-gteachers></div><p class="field__hint field__hint--error" data-error-for="teachers" hidden></p></fieldset>
          <div class="cls-form__row">${kids.field('kd-from', 'From', `<input class="input" type="date" id="kd-from" name="from" required min="${store.today()}" value="${nextMon}">`, { required: true })}${kids.field('kd-to', 'To', `<input class="input" type="date" id="kd-to" name="to" required min="${store.today()}" value="${addDays(nextMon, 4)}">`, { required: true })}</div>
          <fieldset class="an-fs"><legend class="field__label">Days</legend><div class="pt-days">${[['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']].map(([k, l]) => `<label class="an-pick"><input type="checkbox" name="wd" value="${k}"${['sat', 'sun'].includes(k) ? '' : ' checked'}><span><b>${l}</b></span></label>`).join('')}</div><p class="field__hint field__hint--error" data-error-for="weekdays" hidden></p></fieldset>
          <div class="cls-form__row">${kids.field('kd-start', 'Start time', '<input class="input" type="time" id="kd-start" name="start" required value="13:30">', { required: true })}${kids.field('kd-end', 'End time', '<input class="input" type="time" id="kd-end" name="end" required value="15:30">', { required: true })}</div>
          <div class="cls-form__row"><fieldset class="an-fs"><legend class="field__label">Slot length</legend><div class="segmented" role="radiogroup">${store.SLOT_LENGTHS.map(n => `<label class="pt-seg"><input type="radio" name="len" value="${n}"${n === 15 ? ' checked' : ''}><span>${n} min</span></label>`).join('')}</div><p class="field__hint field__hint--error" data-error-for="length" hidden></p></fieldset>
            ${kids.field('kd-gap', 'Break between slots (minutes)', '<input class="input" type="number" id="kd-gap" name="gap" min="0" max="60" step="1" value="5" inputmode="numeric">')}</div>
          ${kids.field('kd-mode', 'Meeting mode', `<select class="input" id="kd-mode" name="mode">${Object.entries(store.SLOT_MODES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>`)}
          <label class="fb-check"><input type="checkbox" name="hours" checked><span><b>Only within each teacher’s working hours</b><small>Uses the staff rota. Uncheck for after-school meetings outside their usual hours.</small></span></label>
          <div class="pt-preview" aria-live="polite" data-preview></div>
          <p class="field__hint field__hint--error" data-error-for="form" hidden></p></div>`,
        submit: 'Create slots',
        async onSubmit(form) {
          const r = await store.createSlots(store.currentUser(), input(form));
          if (!r.ok) return r.errors ? { ok: false, errors: r.errors } : { ok: false, message: failText(r) };
          toast('Slots created', `${plural(r.created, 'slot')} created${r.skipped ? ` · ${r.skipped} skipped (already there, past, or outside working hours)` : ''}.`, 'check-circle');
          const first = store.meetingSlots(user, { from: input(form).from, to: input(form).to }).find(s => s.state === 'open');
          if (first) { week = mondayOf(first.date); day = first.date; }
          tab = 'availability'; syncUrl(); paint();
          return { ok: true };
        }
      });
      const f = d.form;
      const input = form => ({ teacherIds: [...sel], from: form.elements.from.value, to: form.elements.to.value, start: form.elements.start.value, end: form.elements.end.value, length: Number(form.elements.len.value), gap: form.elements.gap.value === '' ? NaN : Number(form.elements.gap.value), weekdays: [...form.querySelectorAll('[name="wd"]:checked')].map(x => x.value), mode: form.elements.mode.value, hoursOnly: form.elements.hours.checked });
      const drawTeachers = () => { f.querySelector('[data-gteachers]').innerHTML = allowed.filter(t => !tq || t.name.toLowerCase().includes(tq.toLowerCase())).map(t => `<label class="an-pick"><input type="checkbox" data-gt value="${esc(t.id)}"${sel.has(t.id) ? ' checked' : ''}><span><b>${esc(t.name)}</b><small>${esc(teacherClass(t.id) || 'Relief')}</small></span></label>`).join('') || '<p class="cp-muted">No teachers match.</p>'; };
      const preview = () => {
        const p = store.planSlots(user, input(f));
        const btn = f.querySelector('[type="submit"]');
        const errs = Object.values(p.errors);
        btn.disabled = Boolean(errs.length) || !p.slots.length;
        const sk = p.skipped;
        const skippedN = sk.exists + sk.hours + sk.past;
        f.querySelector('[data-preview]').innerHTML = errs.length ? `<p class="pt-preview__err">${icon('info', 'icon--sm')}${esc(errs[0])}</p>`
          : `<div class="pt-preview__nums"><span><b>${p.slots.length}</b>slots to create</span><span><b>${p.teachers}</b>${p.teachers === 1 ? 'teacher' : 'teachers'}</span><span><b>${p.days}</b>${p.days === 1 ? 'day' : 'days'}</span><span><b>${skippedN}</b>skipped</span></div>
            ${skippedN ? `<p class="cd-note">Skipped: ${[sk.exists && `${sk.exists} already exist or overlap`, sk.hours && `${sk.hours} outside working hours`, sk.past && `${sk.past} in the past`].filter(Boolean).join(' · ')}.</p>` : ''}
            ${p.closedDays.length ? `<p class="cd-note">School closed: ${esc(p.closedDays.slice(0, 4).join(', '))}${p.closedDays.length > 4 ? '…' : ''}.</p>` : ''}
            ${Object.entries(p.samples).map(([tid, list]) => `<p class="pt-sample"><b>${esc(store.teacherName(tid))}</b> ${esc(list.slice(0, 3).map(x => x.slice(11)).join(', '))}${list.length > 3 ? ` … ${list.length} in all` : ''}</p>`).join('')}
            ${!p.slots.length ? '<p class="pt-preview__err">No new slots fit these settings.</p>' : ''}`;
      };
      drawTeachers();
      preview();
      f.addEventListener('change', e => { if (e.target.matches('[data-gt]')) e.target.checked ? sel.add(e.target.value) : sel.delete(e.target.value); preview(); });
      f.addEventListener('input', e => { if (e.target.matches('[data-gq]')) { tq = e.target.value; drawTeachers(); } preview(); });
    }

    /* ---------------------------------------------------------------- Book for a family */

    function bookDialog(prefill = {}) {
      const clientId = `cl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      const scope = store.classScope(user);
      const fams = store.listFamilies().map(f => ({ ...f, kids: f.children.filter(c => c.status === 'active' && (lead || scope.includes(c.cls))) })).filter(f => f.kids.length);
      const pre = prefill.slotId ? store.meetingSlots(user, { from: store.today(), to: '9999-12-31' }).find(s => s.id === prefill.slotId) : null;
      const st = { familyId: '', childId: '', teacherId: pre?.teacherId || teacherF || mine?.id || '', slotId: pre?.id || '', mode: pre?.mode === 'video' ? 'video' : 'in_person', fq: '' };
      const d = kids.dialog({
        label: 'Meetings / Booking', title: 'Book for a family', desc: pre ? `${esc(store.teacherName(pre.teacherId))} · ${esc(fmt(pre.date, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${esc(pre.start)}–${esc(pre.end)}` : 'Book an open slot on a family’s behalf.',
        body: `<div class="pt-book">
          <div class="field"><label class="field__label" for="pt-fq">Family or child <span class="field__req" aria-hidden="true">*</span></label><div class="an-search an-search--block">${icon('search', 'icon--sm')}<input class="input" id="pt-fq" type="search" placeholder="Search by family or child name" autocomplete="off" data-fq></div>
            <ul class="an-plist pt-fams" data-fams role="radiogroup" aria-label="Family"></ul><p class="field__hint field__hint--error" data-error-for="familyId" hidden></p></div>
          ${kids.field('kd-childId', 'Child', '<select class="input" id="kd-childId" name="childId" required disabled><option value="">Choose a family first</option></select>', { required: true })}
          ${kids.field('kd-teacherId', 'Teacher', `<select class="input" id="kd-teacherId" name="teacherId" required>${teachers.map(t => `<option value="${esc(t.id)}"${t.id === st.teacherId ? ' selected' : ''}>${esc(t.name)}${teacherClass(t.id) ? ` · ${esc(teacherClass(t.id))}` : ''}</option>`).join('')}</select>`, { required: true })}
          ${kids.field('kd-slotId', 'Time', '<select class="input" id="kd-slotId" name="slotId" required></select>', { required: true })}
          <fieldset class="an-fs"><legend class="field__label">Meeting mode <span class="field__req" aria-hidden="true">*</span></legend><div class="an-modes an-modes--2" data-modes>${Object.entries(store.MEETING_MODES).map(([k, l]) => `<label class="an-mode"><input type="radio" name="mode" value="${k}"${st.mode === k ? ' checked' : ''}><span><b>${l}</b><small data-modehint="${k}"></small></span></label>`).join('')}</div><p class="field__hint field__hint--error" data-error-for="mode" hidden></p></fieldset>
          <div data-video hidden>${kids.field('kd-videoLink', 'Video link (optional)', '<input class="input" id="kd-videoLink" name="videoLink" type="url" inputmode="url" placeholder="https://…">', { hint: 'No video service is connected. Paste a meeting link if you have one — otherwise add it later.' })}</div>
          ${kids.field('kd-topic', 'Topic (optional)', '<input class="input" id="kd-topic" name="topic" maxlength="200" placeholder="e.g. Settling in, reading progress">')}
          ${kids.field('kd-internalNote', 'Internal note (staff only)', '<textarea class="input" id="kd-internalNote" name="internalNote" rows="2" maxlength="1000" placeholder="Never shown to the family"></textarea>')}
          <p class="cd-note">The family is notified when the booking is saved — families have no app yet, so the notice is recorded as queued (demo) or skipped.</p></div>`,
        submit: 'Book meeting',
        async onSubmit(form) {
          if (!st.familyId) return { ok: false, errors: { familyId: 'Choose a family.' } };
          const r = await store.bookMeeting(store.currentUser(), { slotId: form.elements.slotId.value, familyId: st.familyId, childId: form.elements.childId.value, mode: form.querySelector('[name="mode"]:checked')?.value, topic: form.elements.topic.value, internalNote: form.elements.internalNote.value, videoLink: form.elements.videoLink.value, clientId });
          if (!r.ok) {
            if (r.reason === 'conflict') { drawSlots(); paint(); }
            return r.errors ? { ok: false, errors: r.errors } : { ok: false, message: failText(r) };
          }
          const b = r.booking;
          paint();
          toast(r.repeated ? 'Already booked' : 'Meeting booked', `${childLabel(b.childId)} with ${store.teacherName(b.teacherId)} · ${fmt(b.date)} ${b.start} · ${store.MEETING_MODES[b.mode]}. Family notice ${delivery(b.notifications[0].result)}.`, 'check-circle', { duration: 8000, action: { label: 'View', onClick: () => openBooking(b.id) } });
          return { ok: true };
        }
      });
      const f = d.form;
      const drawFams = () => {
        const ql = st.fq.trim().toLowerCase();
        const list = fams.filter(x => !ql || `${x.name} ${x.kids.map(k => k.name).join(' ')}`.toLowerCase().includes(ql)).slice(0, 8);
        f.querySelector('[data-fams]').innerHTML = list.map(x => `<li><label class="an-prow"><input type="radio" name="fam" value="${esc(x.id)}"${st.familyId === x.id ? ' checked' : ''}><span class="an-prow__txt"><b>${esc(x.name)}</b><small>${esc(x.kids.map(k => `${k.name} (${k.cls})`).join(', '))}</small></span></label></li>`).join('') || '<li class="cp-muted an-plist__none">No families match.</li>';
      };
      const drawChildren = () => {
        const fam = fams.find(x => x.id === st.familyId);
        const sel = f.elements.childId;
        sel.disabled = !fam;
        sel.innerHTML = fam ? (fam.kids.length > 1 ? '<option value="">Choose a child</option>' : '') + fam.kids.map(k => `<option value="${esc(k.id)}">${esc(k.name)} · ${esc(k.cls)}</option>`).join('') : '<option value="">Choose a family first</option>';
        if (fam && fam.kids.length === 1) st.childId = fam.kids[0].id;
      };
      function drawSlots() {
        const slots = store.openSlotsFor(user, f.elements.teacherId.value);
        const sel = f.elements.slotId;
        const groups = [];
        slots.forEach(s => { const g = groups.find(x => x.date === s.date); g ? g.items.push(s) : groups.push({ date: s.date, items: [s] }); });
        sel.innerHTML = slots.length ? `<option value="">Choose a time</option>${groups.map(g => `<optgroup label="${esc(fmt(g.date, { weekday: 'long', day: 'numeric', month: 'short' }))}">${g.items.map(s => `<option value="${esc(s.id)}"${s.id === st.slotId ? ' selected' : ''}>${esc(s.start)}–${esc(s.end)}${s.mode !== 'both' ? ` · ${esc(store.SLOT_MODES[s.mode])}` : ''}</option>`).join('')}</optgroup>`).join('')}` : '<option value="">No open slots — generate some first</option>';
        if (!slots.some(s => s.id === st.slotId)) st.slotId = '';
        drawModes();
      }
      function drawModes() {
        const s = store.openSlotsFor(user, f.elements.teacherId.value).find(x => x.id === f.elements.slotId.value);
        f.querySelectorAll('[name="mode"]').forEach(r => { const ok = !s || s.mode === 'both' || s.mode === r.value; r.disabled = !ok; f.querySelector(`[data-modehint="${r.value}"]`).textContent = !ok ? 'Not available for this slot' : r.value === 'in_person' ? store.teacherLocation(f.elements.teacherId.value) : 'Link added by staff'; if (!ok && r.checked) { r.checked = false; } });
        if (!f.querySelector('[name="mode"]:checked')) f.querySelector('[name="mode"]:not(:disabled)').checked = true;
        f.querySelector('[data-video]').hidden = f.querySelector('[name="mode"]:checked')?.value !== 'video';
      }
      drawFams();
      drawSlots();
      f.addEventListener('input', e => { if (e.target.matches('[data-fq]')) { st.fq = e.target.value; drawFams(); } });
      f.addEventListener('change', e => {
        const t = e.target;
        if (t.name === 'fam') { st.familyId = t.value; drawChildren(); const fam = fams.find(x => x.id === st.familyId); const cls = fam?.kids[0]?.cls; const tLead = store.getClassRegistry().find(c => c.name === cls)?.staffIds?.[0]; if (!pre && tLead && teachers.some(x => x.id === tLead)) { f.elements.teacherId.value = tLead; drawSlots(); } }
        if (t.name === 'teacherId') { st.slotId = ''; drawSlots(); }
        if (t.name === 'slotId') { st.slotId = t.value; drawModes(); }
        if (t.name === 'mode') drawModes();
      });
      f.querySelector('#pt-fq').focus();
    }

    /* ---------------------------------------------------------------- Booking drawer */

    function shell(kind, id, title, opener) {
      drawer?.close(false);
      const el = document.createElement('dialog');
      el.className = 'drawer an-drawer pt-drawer';
      el.setAttribute('aria-labelledby', 'pt-d-title');
      el.innerHTML = `<div class="drawer__panel"><div class="drawer__head"><h2 id="pt-d-title">${esc(title)}</h2><button class="btn btn--icon-ghost" type="button" aria-label="Close" data-close>${icon('x')}</button></div><div class="drawer__body" data-body></div><div class="drawer__foot" data-foot></div></div>`;
      document.body.appendChild(el);
      const close = (restore = true) => { if (!el.isConnected || el.classList.contains('is-closing')) return; el.classList.add('is-closing'); drawer = null; syncUrl(); const done = () => { el.close(); el.remove(); if (restore && opener && document.contains(opener)) opener.focus(); }; reduceMotion.matches ? done() : setTimeout(done, 170); };
      el.addEventListener('cancel', e => { e.preventDefault(); close(); });
      el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-close]')) close(); });
      return { el, close, body: el.querySelector('[data-body]'), foot: el.querySelector('[data-foot]') };
    }
    const childLinks = c => (c ? `<div class="pt-links"><a class="btn btn--tertiary btn--sm" href="${routes.record(c.id)}#tab=conferences">${icon('user', 'icon--sm')}Child profile</a><a class="btn btn--tertiary btn--sm" href="${routes.record(c.id)}#tab=diary">${icon('book', 'icon--sm')}Daily diary</a><a class="btn btn--tertiary btn--sm" href="${routes.page('lessons', { cls: c.cls })}">${icon('layers', 'icon--sm')}Class planning</a><a class="btn btn--tertiary btn--sm" href="${routes.record(c.id)}#tab=learning">${icon('star', 'icon--sm')}Learning &amp; portfolio</a></div>` : '');

    function openBooking(id, opener = document.activeElement) {
      const d = shell('booking', id, 'Meeting', opener);
      const refresh = () => {
        const b = store.meetingBookings(user).find(x => x.id === id);
        if (!b) { d.body.innerHTML = state('lock', 'Meeting not available', 'It may have been removed, or it isn’t one you can see.'); d.foot.innerHTML = ''; return; }
        const c = child(b.childId);
        const rec = store.conferenceRecords(user).find(r => r.bookingId === b.id);
        const manage = teachers.some(t => t.id === b.teacherId);
        const past = isPast(b);
        d.body.innerHTML = `<div class="an-d-top"><div class="an-tags">${statusChip(b)}${modeChip(b)}${b.demo ? '<span class="fm-demo">Demo sample</span>' : ''}</div><h3 class="an-d-title">${esc(childLabel(b.childId))}</h3></div>
          <dl class="token-sheet an-d-meta">
            <div><dt>Family</dt><dd>${esc(famName(b.familyId))}</dd></div>
            <div><dt>Teacher</dt><dd>${esc(store.teacherName(b.teacherId))}</dd></div>
            <div><dt>When</dt><dd>${esc(fmt(b.date, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${esc(b.start)}–${esc(b.end)} (${mins(b.end) - mins(b.start)} min)</dd></div>
            <div><dt>${b.mode === 'video' ? 'Video' : 'Where'}</dt><dd>${b.mode === 'video' ? (b.videoLink ? `<a href="${esc(b.videoLink)}" target="_blank" rel="noopener noreferrer">${esc(b.videoLink)}</a>` : '<span class="cp-muted">No link yet — no video service is connected</span>') : esc(b.location || store.teacherLocation(b.teacherId))}</dd></div>
            <div><dt>Topic</dt><dd>${esc(b.topic || '—')}</dd></div>
            ${b.status === 'cancelled' ? `<div><dt>Cancelled</dt><dd>${esc(when(b.cancelledAt))} by ${esc(b.cancelledBy)}${b.reopened ? ' · slot reopened' : ' · slot not reopened'}</dd></div>` : ''}
          </dl>
          ${b.mode === 'video' && manage && b.status === 'upcoming' ? `<form class="pt-link" data-linkform novalidate><label class="field__label" for="pt-vl">Meeting link</label><div class="pt-link__row"><input class="input" id="pt-vl" type="url" inputmode="url" placeholder="https://…" value="${esc(b.videoLink)}"><button class="btn btn--secondary btn--sm" type="submit">Save link</button></div><p class="field__hint field__hint--error" data-linkerr hidden></p></form>` : ''}
          ${b.internalNote ? `<div class="pt-internal"><span class="tech-label">${icon('lock', 'icon--sm')}Staff only</span><p>${esc(b.internalNote)}</p></div>` : ''}
          <section class="an-d-sec"><h3 class="cd-qv-h">Conference record</h3>${rec ? `<button class="pt-reclink" type="button" data-record="${esc(rec.id)}"><b>${esc(rec.topic || 'Conference record')}</b><span>${followChip(rec)}${shareChip(rec)}</span></button>` : `<p class="cp-muted">${b.status === 'cancelled' ? 'This meeting was cancelled.' : past ? 'No record yet.' : 'You can add a record once the meeting has started.'}</p>`}</section>
          ${childLinks(c)}
          <section class="an-d-sec"><h3 class="cd-qv-h">Family notices</h3><ul class="pt-log">${(b.notifications || []).map(n => `<li>${esc(n.kind === 'booked' ? 'Booking confirmation' : 'Cancellation notice')} · ${esc(when(n.at))} · ${esc(delivery(n.result))}</li>`).join('') || '<li class="cp-muted">None recorded.</li>'}</ul></section>
          <p class="cal-meta">Booked by ${esc(b.createdBy)} · ${esc(when(b.createdAt))}</p>`;
        d.foot.innerHTML = !manage ? '' : b.status === 'upcoming' ? (past
          ? `<button class="btn btn--primary kids-yellow" type="button" data-addrec="${esc(b.id)}">${icon('note', 'icon--sm')}Add conference record</button><button class="btn btn--secondary" type="button" data-outcome="completed">Mark completed</button><button class="btn btn--tertiary" type="button" data-outcome="no_show">No-show</button>`
          : `<button class="btn btn--tertiary is-danger" type="button" data-cancel>${icon('x', 'icon--sm')}Cancel booking</button>`)
          : b.status === 'completed' ? (rec ? `<button class="btn btn--secondary" type="button" data-record="${esc(rec.id)}">${icon('note', 'icon--sm')}Open conference record</button>` : `<button class="btn btn--primary kids-yellow" type="button" data-addrec="${esc(b.id)}">${icon('note', 'icon--sm')}Add conference record</button>`) : '';
        d.foot.hidden = !d.foot.innerHTML;
      };
      d.el.addEventListener('submit', async e => {
        if (!e.target.matches('[data-linkform]')) return;
        e.preventDefault();
        const r = await store.setMeetingVideoLink(store.currentUser(), id, d.el.querySelector('#pt-vl').value);
        const err = d.el.querySelector('[data-linkerr]');
        if (!r.ok) { err.textContent = failText(r); err.hidden = false; return; }
        toast('Link saved', 'The meeting link is on the booking.', 'check-circle');
      });
      d.el.addEventListener('click', async e => {
        if (e.target.closest('[data-cancel]')) { cancelDialog(id); return; }
        const rb = e.target.closest('[data-record]');
        if (rb) { openRecord(rb.dataset.record); return; }
        const ar = e.target.closest('[data-addrec]');
        if (ar) { recordEditor({ bookingId: ar.dataset.addrec }); return; }
        const oc = e.target.closest('[data-outcome]');
        if (oc) { oc.disabled = true; const r = await store.setMeetingOutcome(store.currentUser(), id, oc.dataset.outcome); if (!r.ok) { oc.disabled = false; toast('Not saved', failText(r)); return; } toast(oc.dataset.outcome === 'completed' ? 'Marked completed' : 'Marked as no-show', 'The meeting status is updated.', 'check-circle'); }
      });
      d.el.showModal();
      drawer = { kind: 'booking', id, close: d.close, refresh };
      syncUrl();
      refresh();
      d.el.querySelector('[data-close]').focus();
    }

    function cancelDialog(id) {
      const b = store.meetingBookings(user).find(x => x.id === id);
      if (!b) return;
      kids.dialog({ label: 'Meetings / Cancel', title: 'Cancel this meeting?', danger: true,
        desc: `${esc(childLabel(b.childId))} with ${esc(store.teacherName(b.teacherId))} · ${esc(fmt(b.date, { weekday: 'long', day: 'numeric', month: 'long' }))} ${esc(b.start)}. The family will be notified (recorded as queued (demo) or skipped — families have no app yet). The booking is kept in the history.`,
        body: `<label class="fb-check"><input type="checkbox" name="keep" checked><span><b>Reopen the slot for other families</b><small>Only if it’s still in the future. Uncheck to make the time unavailable.</small></span></label>${kids.field('kd-reason', 'Reason (optional)', '<input class="input" id="kd-reason" name="reason" maxlength="200">')}`,
        submit: 'Cancel meeting',
        async onSubmit(form) {
          const r = await store.cancelMeeting(store.currentUser(), id, { keepOpen: form.elements.keep.checked, reason: form.elements.reason.value });
          if (!r.ok) return { ok: false, message: failText(r) };
          toast('Meeting cancelled', `${r.reopened ? 'The slot is open again.' : r.past ? 'The slot is in the past, so it wasn’t reopened.' : 'The slot is now unavailable.'} Family notice ${delivery(r.notification)}.`, 'check-circle', { duration: 8000 });
          return { ok: true };
        } });
    }

    /* ---------------------------------------------------------------- Conference record */

    function recordEditor({ bookingId = null, record = null } = {}) {
      const b = store.meetingBookings(user).find(x => x.id === (record?.bookingId || bookingId));
      if (!b) return;
      const owners = store.actionOwners(b.familyId, b.teacherId);
      const learning = store.getLearning(b.childId);
      const st = { actions: (record?.actions || []).map(a => ({ ...a })) };
      if (!st.actions.length) st.actions.push({ id: '', text: '', owner: { kind: 'staff', id: b.teacherId }, due: addDays(store.today(), 14), done: false, learningRef: '', share: true });
      const actionsHtml = () => st.actions.map((a, i) => `<li class="pt-act-edit"><div class="field"><label class="field__label" for="pt-a${i}">Action ${i + 1}</label><input class="input" id="pt-a${i}" data-ak="text" data-ai="${i}" maxlength="300" value="${esc(a.text)}" placeholder="What was agreed?"></div>
        <div class="cls-form__row"><div class="field"><label class="field__label" for="pt-ao${i}">Owner</label><select class="input" id="pt-ao${i}" data-ak="owner" data-ai="${i}">${owners.map(o => `<option value="${o.kind}:${esc(o.id)}"${a.owner?.kind === o.kind && a.owner?.id === o.id ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div><div class="field"><label class="field__label" for="pt-ad${i}">Due date</label><input class="input" type="date" id="pt-ad${i}" data-ak="due" data-ai="${i}" value="${esc(a.due || '')}"></div></div>
        ${learning.length ? `<div class="field"><label class="field__label" for="pt-al${i}">Linked learning (optional)</label><select class="input" id="pt-al${i}" data-ak="learningRef" data-ai="${i}"><option value="">None</option>${learning.slice(0, 30).map(l => `<option value="${esc(l.id)}"${a.learningRef === l.id ? ' selected' : ''}>${esc(l.material)} · ${esc(l.area)} (${esc(store.LEARNING_STAGES[l.stage])})</option>`).join('')}</select><p class="field__hint">For reference only — it doesn’t change the child’s progress.</p></div>` : ''}
        <div class="pt-act-edit__foot"><label class="fb-check"><input type="checkbox" data-ak="share" data-ai="${i}"${a.share ? ' checked' : ''}>Share this action with the family</label><button class="btn btn--tertiary btn--sm is-danger" type="button" data-arm="${i}">Remove</button></div>
        <p class="field__hint field__hint--error" data-error-for="action-${i}" hidden></p></li>`).join('');
      const d = kids.dialog({
        label: 'Meetings / Conference record', title: record ? 'Edit conference record' : 'Add conference record',
        desc: `${esc(childLabel(b.childId))} · ${esc(famName(b.familyId))} · ${esc(store.teacherName(b.teacherId))} · ${esc(fmt(b.date))}`,
        body: `<div class="pt-rec">
          ${kids.field('kd-topic', 'Topic', `<input class="input" id="kd-topic" name="topic" maxlength="200" value="${esc(record?.topic ?? b.topic)}">`)}
          ${kids.field('kd-strengths', 'Strengths and progress discussed', `<textarea class="input" id="kd-strengths" name="strengths" rows="3" maxlength="2000">${esc(record?.strengths || '')}</textarea>`)}
          <label class="fb-check"><input type="checkbox" name="shareStrengths"${record ? (record.shareStrengths ? ' checked' : '') : ' checked'}>Include strengths in what the family sees</label>
          ${kids.field('kd-concerns', 'Concerns or support needs (staff only)', `<textarea class="input" id="kd-concerns" name="concerns" rows="2" maxlength="2000">${esc(record?.concerns || '')}</textarea>`)}
          ${kids.field('kd-notes', 'Discussion notes (staff only)', `<textarea class="input" id="kd-notes" name="notes" rows="4" maxlength="4000">${esc(record?.notes || '')}</textarea>`, { hint: 'Never shared with the family.' })}
          ${kids.field('kd-familySummary', 'Summary for the family', `<textarea class="input" id="kd-familySummary" name="familySummary" rows="3" maxlength="2000" placeholder="Written for parents — only this, chosen strengths and shared actions are ever shown to them.">${esc(record?.familySummary || '')}</textarea>`)}
          ${kids.field('kd-followUpDate', 'Follow-up date (optional)', `<input class="input" type="date" id="kd-followUpDate" name="followUpDate" value="${esc(record?.followUpDate || '')}">`)}
          <fieldset class="an-fs"><legend class="field__label">Agreed actions</legend><ol class="pt-acts-edit" data-acts>${actionsHtml()}</ol><button class="btn btn--tertiary btn--sm" type="button" data-aadd>${icon('plus', 'icon--sm')}Add action</button></fieldset>
          <p class="field__hint field__hint--error" data-error-for="notes" hidden></p></div>`,
        submit: record ? 'Save record' : 'Save record',
        async onSubmit(form) {
          const input = { bookingId: b.id, topic: form.elements.topic.value, strengths: form.elements.strengths.value, shareStrengths: form.elements.shareStrengths.checked, concerns: form.elements.concerns.value, notes: form.elements.notes.value, familySummary: form.elements.familySummary.value, followUpDate: form.elements.followUpDate.value, actions: st.actions.filter(a => a.text.trim() || a.id) };
          const r = await store.saveConferenceRecord(store.currentUser(), input, record?.id || null);
          if (!r.ok) return r.errors ? { ok: false, errors: r.errors } : { ok: false, message: failText(r) };
          toast(record ? 'Record updated' : 'Conference record saved', `${childLabel(b.childId)} · ${plural(r.record.actions.length, 'action')}`, 'check-circle');
          setTimeout(() => openRecord(r.record.id), 200);
          return { ok: true };
        }
      });
      const f = d.form;
      const redraw = focusSel => { f.querySelector('[data-acts]').innerHTML = actionsHtml(); if (focusSel) f.querySelector(focusSel)?.focus(); };
      f.addEventListener('input', e => { const t = e.target; if (t.dataset.ak === 'text') st.actions[+t.dataset.ai].text = t.value; });
      f.addEventListener('change', e => {
        const t = e.target;
        const a = st.actions[+t.dataset.ai];
        if (!a) return;
        if (t.dataset.ak === 'owner') { const [kind, ...rest] = t.value.split(':'); a.owner = { kind, id: rest.join(':') }; }
        if (t.dataset.ak === 'due') a.due = t.value;
        if (t.dataset.ak === 'learningRef') a.learningRef = t.value;
        if (t.dataset.ak === 'share') a.share = t.checked;
      });
      f.addEventListener('click', e => {
        if (e.target.closest('[data-aadd]')) { st.actions.push({ id: '', text: '', owner: { kind: 'staff', id: b.teacherId }, due: addDays(store.today(), 14), done: false, learningRef: '', share: true }); redraw(`#pt-a${st.actions.length - 1}`); return; }
        const rm = e.target.closest('[data-arm]');
        if (rm) { st.actions.splice(+rm.dataset.arm, 1); redraw('[data-aadd]'); }
      });
    }

    function openRecord(id, opener = document.activeElement) {
      const d = shell('record', id, 'Conference record', opener);
      let af = '';
      const refresh = () => {
        const r = store.conferenceRecords(user).find(x => x.id === id);
        if (!r) { d.body.innerHTML = state('lock', 'Record not available', 'It may have been removed, or it isn’t one you can see.'); d.foot.innerHTML = ''; return; }
        const edit = store.canEditRecord(user, r);
        const c = child(r.childId);
        const learning = store.getLearning(r.childId);
        const acts = r.actions.map(a => ({ a, s: store.conferenceActionStatus(a) })).filter(x => !af || x.s === af);
        const counts = Object.fromEntries(['pending', 'overdue', 'completed'].map(k => [k, r.actions.filter(a => store.conferenceActionStatus(a) === k).length]));
        d.body.innerHTML = `<div class="an-d-top"><div class="an-tags">${followChip(r)}${shareChip(r)}${r.demo ? '<span class="fm-demo">Demo sample</span>' : ''}</div><h3 class="an-d-title">${esc(childLabel(r.childId))}</h3><p class="cp-muted">${esc(r.topic || 'Conference')}</p></div>
          <dl class="token-sheet an-d-meta"><div><dt>Meeting</dt><dd>${esc(fmt(r.date, { weekday: 'long', day: 'numeric', month: 'long' }))}</dd></div><div><dt>Family</dt><dd>${esc(famName(r.familyId))}</dd></div><div><dt>Teacher</dt><dd>${esc(store.teacherName(r.teacherId))}</dd></div>${r.followUpDate ? `<div><dt>Follow-up</dt><dd>${esc(fmt(r.followUpDate))}</dd></div>` : ''}</dl>
          ${childLinks(c)}
          ${edit ? `<div class="pt-share"><button class="switch" type="button" role="switch" aria-checked="${Boolean(r.shared)}" data-share><span class="switch__track"><span class="switch__thumb"></span></span><span>Share with family</span></button><small>${r.shared ? `Shared ${esc(when(r.sharedAt))} by ${esc(r.sharedBy)}. Only the family summary${r.shareStrengths ? ', strengths' : ''} and shared actions are visible.` : 'Not shared. The family sees nothing from this record.'}</small></div>` : ''}
          ${r.familySummary ? `<section class="an-d-sec"><h3 class="cd-qv-h">Summary for the family</h3><p class="pt-text">${esc(r.familySummary)}</p></section>` : ''}
          ${r.strengths ? `<section class="an-d-sec"><h3 class="cd-qv-h">Strengths &amp; progress ${r.shareStrengths ? chip('neutral', 'Family can see') : chip('neutral', 'Staff only', 'lock')}</h3><p class="pt-text">${esc(r.strengths)}</p></section>` : ''}
          ${r.concerns || r.notes ? `<section class="pt-internal"><span class="tech-label">${icon('lock', 'icon--sm')}Staff only — never shared</span>${r.concerns ? `<h4>Concerns or support needs</h4><p class="pt-text">${esc(r.concerns)}</p>` : ''}${r.notes ? `<h4>Discussion notes</h4><p class="pt-text">${esc(r.notes)}</p>` : ''}</section>` : ''}
          <section class="an-d-sec" aria-labelledby="pt-acts-h"><h3 class="cd-qv-h" id="pt-acts-h">Agreed actions (${r.actions.length})</h3>
            <div class="chip-row an-rfilters" role="group" aria-label="Show actions">${[['', 'All', r.actions.length], ['pending', 'Pending', counts.pending], ['overdue', 'Overdue', counts.overdue], ['completed', 'Completed', counts.completed]].map(([k, l, n]) => `<button class="chip chip--sm" type="button" aria-pressed="${af === k}" data-af="${k}">${l} · ${n}</button>`).join('')}</div>
            <ul class="pt-acts">${acts.map(({ a, s }) => { const lr = learning.find(l => l.id === a.learningRef); return `<li class="pt-act is-${s}"><label class="pt-act__check"><input type="checkbox" data-done="${esc(a.id)}"${a.done ? ' checked' : ''}${edit ? '' : ' disabled'}><span class="sr-only">Mark “${esc(a.text)}” ${a.done ? 'not done' : 'done'}</span></label>
              <div class="pt-act__main"><p>${esc(a.text)}</p><small>${esc(store.ownerName(a.owner))}${a.owner?.kind === 'family' ? ' (family)' : ''}${a.due ? ` · due ${esc(fmt(a.due))}` : ''}${a.doneAt ? ` · done ${esc(when(a.doneAt))}` : ''}${a.share ? ' · shared' : ' · staff only'}${lr ? ` · linked: ${esc(lr.material)}` : ''}</small></div>
              ${chip(ACT_TONE[s], ACT_LABEL[s], s === 'overdue' ? 'alert-triangle' : s === 'completed' ? 'check' : 'clock')}${edit ? `<button class="btn btn--icon-ghost btn--sm" type="button" aria-label="Remove action “${esc(a.text)}”" data-rmact="${esc(a.id)}">${icon('trash', 'icon--sm')}</button>` : ''}</li>`; }).join('') || `<li class="cp-muted">${r.actions.length ? 'No actions with this status.' : 'No actions were agreed.'}</li>`}</ul></section>
          ${(r.shareHistory || []).length ? `<section class="an-d-sec"><h3 class="cd-qv-h">Sharing history</h3><ul class="pt-log">${r.shareHistory.map(h => `<li>${h.shared ? 'Shared' : 'Unshared'} by ${esc(h.by)} · ${esc(when(h.at))}${h.shared ? ` · family notice ${esc(delivery(h.result))}` : ''}</li>`).join('')}</ul></section>` : ''}
          <p class="cal-meta">Created by ${esc(r.createdBy)} · ${esc(when(r.createdAt))}${r.updatedAt !== r.createdAt ? ` · updated ${esc(when(r.updatedAt))}` : ''}</p>`;
        d.foot.innerHTML = edit ? `<button class="btn btn--secondary" type="button" data-editrec>${icon('pencil', 'icon--sm')}Edit record</button><button class="btn btn--tertiary" type="button" data-booking="${esc(r.bookingId)}">View meeting</button>` : `<button class="btn btn--tertiary" type="button" data-booking="${esc(r.bookingId)}">View meeting</button>`;
      };
      d.el.addEventListener('click', async e => {
        const fb = e.target.closest('[data-af]');
        if (fb) { af = fb.dataset.af; refresh(); d.el.querySelector(`[data-af="${af}"]`)?.focus(); return; }
        const r = store.conferenceRecords(user).find(x => x.id === id);
        if (!r) return;
        if (e.target.closest('[data-editrec]')) { recordEditor({ record: r }); return; }
        const bk = e.target.closest('[data-booking]');
        if (bk) { openBooking(bk.dataset.booking); return; }
        if (e.target.closest('[data-share]')) { shareDialog(r); return; }
        const rm = e.target.closest('[data-rmact]');
        if (rm) {
          const a = r.actions.find(x => x.id === rm.dataset.rmact);
          kids.dialog({ label: 'Conference record', title: 'Remove this action?', desc: `“${esc(a.text)}” will be removed from the record. The record itself is kept.`, body: '', submit: 'Remove action', danger: true, async onSubmit() { const res = await store.setConferenceAction(store.currentUser(), id, a.id, { remove: true }); return res.ok ? res : { ok: false, message: failText(res) }; } });
        }
      });
      d.el.addEventListener('change', async e => {
        const cb = e.target.closest('[data-done]');
        if (!cb) return;
        cb.disabled = true;
        const res = await store.setConferenceAction(store.currentUser(), id, cb.dataset.done, { done: cb.checked });
        if (!res.ok) { cb.checked = !cb.checked; cb.disabled = false; toast('Not saved', failText(res)); }
      });
      d.el.showModal();
      drawer = { kind: 'record', id, close: d.close, refresh };
      syncUrl();
      refresh();
      d.el.querySelector('[data-close]').focus();
    }

    function shareDialog(r) {
      if (r.shared) {
        kids.dialog({ label: 'Conference record', title: 'Stop sharing with the family?', desc: 'The family-facing summary will be hidden from the family portal. The internal record isn’t changed or deleted.', body: '', submit: 'Stop sharing', danger: true,
          async onSubmit() { const res = await store.shareConferenceRecord(store.currentUser(), r.id, false); if (res.ok) toast('No longer shared', 'The family can’t see this record.', 'eye-off'); return res.ok ? res : { ok: false, message: failText(res) }; } });
        return;
      }
      const v = store.familyConferenceView(r);
      kids.dialog({ label: 'Conference record', title: 'Share with the family?', desc: 'This is exactly what the family will see. Discussion notes and concerns stay internal.',
        body: `<div class="pt-famview" aria-label="Family view preview"><p class="tech-label">Family view</p><h3>${esc(v.child)} · ${esc(fmt(v.date, { day: 'numeric', month: 'long' }))}</h3><p class="cp-muted">With ${esc(v.teacher)}${v.topic ? ` · ${esc(v.topic)}` : ''}</p>
          ${v.summary ? `<p class="pt-text">${esc(v.summary)}</p>` : '<p class="cp-muted">No family summary written.</p>'}
          ${v.strengths ? `<h4>Strengths &amp; progress</h4><p class="pt-text">${esc(v.strengths)}</p>` : ''}
          ${v.actions.length ? `<h4>Agreed next steps</h4><ul>${v.actions.map(a => `<li>${esc(a.text)} <small>— ${esc(a.owner)}${a.due ? `, by ${esc(fmt(a.due))}` : ''}</small></li>`).join('')}</ul>` : ''}</div>
          <p class="field__hint field__hint--error" data-error-for="share" hidden></p>
          <p class="cd-note">Families have no portal or app yet: the record is marked as shared and the notice is recorded as queued (demo) or skipped.</p>`,
        submit: 'Share with family',
        async onSubmit() { const res = await store.shareConferenceRecord(store.currentUser(), r.id, true); if (!res.ok) return res.errors ? { ok: false, errors: res.errors } : { ok: false, message: failText(res) }; toast('Shared with family', `Family notice ${delivery(res.notification)}.`, 'eye'); return { ok: true }; } });
    }

    /* ---------------------------------------------------------------- Events */

    main.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('[data-generate]')) { generateDialog(); return; }
      if (t.closest('[data-book]')) { bookDialog(); return; }
      if (t.closest('[data-retry]')) { load(); return; }
      const tb = t.closest('[data-tab]');
      if (tb) { tab = tb.dataset.tab; syncUrl(); paint(); return; }
      const wk = t.closest('[data-week]');
      if (wk) { week = addDays(week, 7 * Number(wk.dataset.week)); syncUrl(); paint(); main.querySelector(`[data-week="${wk.dataset.week}"]`)?.focus(); return; }
      const dy = t.closest('[data-day]');
      if (dy) { day = addDays(day, Number(dy.dataset.day)); syncUrl(); paint(); main.querySelector(`[data-day="${dy.dataset.day}"]`)?.focus(); return; }
      if (t.closest('[data-today]')) { week = mondayOf(store.today()); day = store.today(); syncUrl(); paint(); main.querySelector('[data-today]')?.focus(); return; }
      if (t.closest('[data-bclear]')) { Object.assign(bf, { q: '', from: '', to: '', teacher: '', cls: '', mode: '', status: '' }); paint(); return; }
      const sl = t.closest('[data-slot]');
      if (sl) { bookDialog({ slotId: sl.dataset.slot }); return; }
      const bk = t.closest('[data-booking]');
      if (bk) { openBooking(bk.dataset.booking); return; }
      const rc = t.closest('[data-record]');
      if (rc) openRecord(rc.dataset.record);
    });
    const onFilter = e => {
      const t = e.target;
      if (t.matches('[data-teacherf]')) { teacherF = t.value; syncUrl(); paint(); return; }
      if (t.dataset.bf !== undefined) { bf[t.dataset.bf] = t.value; paint(); return; }
      if (t.dataset.rf !== undefined) { rf[t.dataset.rf] = t.value; paint(); }
    };
    main.addEventListener('input', e => { if (e.target.type === 'search') onFilter(e); });
    main.addEventListener('change', e => { if (e.target.type !== 'search') onFilter(e); });
    main.addEventListener('keydown', e => {
      const t = e.target.closest('[role="tab"]');
      if (!t) return;
      const keys = TABS.map(([k]) => k);
      const i = keys.indexOf(t.dataset.tab);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: keys.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      tab = keys[(to + keys.length) % keys.length]; syncUrl(); paint(); $(`#pt-tab-${tab}`)?.focus();
    });
    mobileQ.addEventListener('change', () => { if (loaded) paint(); });
    let queued = false;
    store.subscribe(({ key }) => {
      if (!loaded || (key && !/^nexora-(ptm-|demo-role|families|children|class-registry|staff-shifts|holidays|events|learning)/.test(key))) return;
      if (queued) return;
      queued = true;
      setTimeout(() => { queued = false; if (document.activeElement && main.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName)) { summary(); drawer?.refresh(); return; } paint(); }, 0);
    });
    function load() {
      setTimeout(() => {
        if (failOnce) { failOnce = false; $('[data-sum]').innerHTML = ''; $('[data-panel]').removeAttribute('aria-busy'); $('[data-panel]').innerHTML = state('alert-circle', 'Meetings couldn’t load', 'Something went wrong while reading meetings on this device. Nothing was changed.', '<button class="btn btn--primary kids-yellow" type="button" data-retry>Try again</button>', 'error'); return; }
        loaded = true;
        paint();
        if (params.get('booking')) openBooking(params.get('booking'), $('#page-title'));
        else if (params.get('record')) openRecord(params.get('record'), $('#page-title'));
      }, 250);
    }
    load();
  }

  window.NexoraMeetings = { render };
})();
