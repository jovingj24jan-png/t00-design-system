/* S17 Class detail (app.html?page=class&id=<classId>[&tab=roster|staff|today|schedule|room]) — a teacher's home base.
   Reads: the S17 class card (capacity, today's ratio), children + alerts + pickup (S12/S13), today's S19 register and
   staff attendance, shifts and cover, the diary, announcements and the class routine — all through NexoraStore.
   Writes go through store.transferChild / assignSubstitute / cancelSubstitute, which re-check every rule.
   Not built in this prototype: S23 rooms & resources and a school calendar — those panels say so instead of guessing.
   Test hook: ?fail=1 makes the first load fail so the error state can be checked. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const kids = window.NexoraChildren;
  const shared = window.NexoraClasses;
  const { routes } = store;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const params = new URLSearchParams(location.search);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const initials = n => String(n || '').replace(/^(Ms|Mr|Mrs|Dr)\.?\s+/i, '').trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const dayLabel = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const timeOf = iso => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const minutes = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

  const TABS = [['roster', 'Roster'], ['staff', 'Staff'], ['today', 'Today'], ['schedule', 'Schedule'], ['room', 'Room & resources']];
  const ALERT_ICON = { allergy: 'allergy', medical: 'medical', custody: 'shield', dietary: 'leaf' };
  // Which profile section guards each alert type's detail.
  const ALERT_SECTION = { allergy: 'medical', medical: 'medical', dietary: 'medical', custody: 'custody' };
  const MARK = {
    present: { tone: 'in', label: 'Present' }, late: { tone: 'in', label: 'Present (late)' },
    absent: { tone: 'out', label: 'Absent' }, collected: { tone: 'done', label: 'Collected' }, none: { tone: 'wait', label: 'Not recorded yet' }
  };
  const DIARY_TYPES = [['meals', 'Meals'], ['rest', 'Rest'], ['notes', 'Notes']];
  const FAIL = {
    forbidden: 'Your role can’t do this. Nothing was changed.',
    missing: 'This record changed or no longer exists. Refresh the page.',
    closed: 'This child is no longer enrolled, so they can’t be moved.',
    storage: 'This couldn’t be saved on this device. Nothing was changed. Please try again.'
  };

  function render(key, main, user) {
    if (key !== 'class') return false;
    page(main, user);
    return true;
  }

  function page(main, user) {
    const id = params.get('id') || '';
    let tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'roster';
    let loaded = false;
    let failOnce = params.get('fail') === '1';
    let drawer = null;
    let clock = null;
    const manage = store.canManageClasses(user);
    const canMove = store.canManageChildren(user);

    main.classList.add('kids-page');
    const state = (iconName, title, text, action = '', tone = '') => `<div class="kids-empty cd-state"${tone === 'error' ? ' role="alert"' : ''}><span class="state-icon${tone ? ` state-icon--${tone}` : ''}" aria-hidden="true">${icon(iconName)}</span><h2 class="kids-empty__title">${title}</h2><p>${text}</p>${action}</div>`;
    const backToClasses = `<a class="btn btn--secondary" href="${routes.page('classes')}">${icon('arrow-left', 'icon--sm')}All classes</a>`;

    // Live data for the class, or a reason it can't be shown.
    function data() {
      const reg = store.getClassRegistry().find(c => c.id === id);
      if (!reg) return { error: 'missing' };
      if (reg.status !== 'active') return { error: 'archived', cls: reg };
      if (!store.classScope(user).includes(reg.name)) return { error: 'scope', cls: reg };
      const card = store.classCards().find(c => c.id === id);
      const register = store.getRegister()[card.name] || null;
      const children = store.enrolledIn(card.name).sort((a, b) => (a.status === b.status ? store.childName(a).localeCompare(store.childName(b)) : a.status === 'active' ? -1 : 1));
      return { card, register, children, view: store.attendanceView(card.name) };
    }
    // From the shared S19 attendance view: in / collected / absent / not recorded.
    const markOf = (d, child) => {
      if (child.status !== 'active') return null;
      const r = d.view.rows.find(x => x.child.id === child.id);
      return r ? { in: r.late ? 'late' : 'present', out: 'collected', absent: 'absent', 'not-arrived': 'none' }[r.status] : 'none';
    };

    /* ---------------------------------------------------------------- Header */

    function headerHtml(d) {
      const c = d.card;
      const { chip, note } = shared.ratioChip(c.ratioToday);
      return `
        <nav class="kids-crumbs" aria-label="Breadcrumb"><a href="${routes.page('classes')}">Classes</a> / <span aria-current="page">${esc(c.name)}</span></nav>
        <header class="cd-head cls-card--${esc(c.colour)}">
          <div class="cd-head__id">
            <h1 class="cd-head__title" id="page-title" tabindex="-1">${esc(c.name)}</h1>
            <p class="cls-card__meta"><span>${esc(c.level)}</span><span>${esc(`${c.ageMin}–${c.ageMax} yrs`)}</span>${c.mixedAge ? '<span class="cls-tag">Mixed age</span>' : ''}</p>
            <p class="cd-head__room">${icon('door', 'icon--sm')}${c.room ? esc(c.room) : '<span class="cp-muted">No room set</span>'}</p>
          </div>
          <div class="cd-head__stats">
            <div class="cd-head__stat">${shared.capacityBlock(c)}</div>
            <div class="cd-head__stat cd-head__ratio"><span class="cls-label">Today’s ratio</span>${chip}<p class="cls-today__why"><span>${esc(note)}</span><span class="cls-rule">Rule ${esc(`${c.ratio.adults}:${c.ratio.children}`)} <span class="sr-only">adults to children</span></span></p></div>
          </div>
          <div class="cd-head__actions">
            ${store.canAccess(user, 'attendance') ? `<a class="btn btn--primary kids-yellow" href="${routes.page('attendance', { cls: c.name })}">${icon('calendar-check', 'icon--sm')}Take attendance</a>` : ''}
            ${manage ? `<button class="btn btn--secondary" type="button" data-edit-class>${icon('pencil', 'icon--sm')}Edit class</button>` : ''}
          </div>
        </header>`;
    }

    const tabsHtml = () => `<div class="tabs cd-tabs" role="tablist" aria-label="Class sections">${TABS.map(([k, label]) => `<button class="tab" type="button" role="tab" id="cd-tab-${k}" aria-controls="cd-panel" aria-selected="${k === tab}" tabindex="${k === tab ? 0 : -1}" data-tab="${k}">${esc(label)}</button>`).join('')}</div>`;

    /* ---------------------------------------------------------------- Roster */

    function alertDots(child) {
      if (!child.alerts.length) return '';
      return `<span class="cd-dots">${child.alerts.map(a => `<span class="cd-dot kid-alert--${esc(a.type)}" title="${esc(store.ALERT_TYPES[a.type])}">${icon(ALERT_ICON[a.type])}</span>`).join('')}</span>`;
    }
    const kidLabel = (child, mark) => {
      const alerts = child.alerts.length ? ` Alerts: ${[...new Set(child.alerts.map(a => store.ALERT_TYPES[a.type]))].join(', ')}.` : '';
      const status = mark ? MARK[mark].label : `Starts ${dayLabel(child.startDate)}`;
      return `${store.childName(child)}. ${status}.${child.pendingMove ? ` Moving to ${child.pendingMove.cls} on ${dayLabel(child.pendingMove.date)}.` : ''}${alerts} Open quick view.`;
    };
    const avatar = (child, cls = '') => child.photo
      ? `<img class="cd-av ${cls}" src="${esc(child.photo)}" alt="">`
      : `<span class="cd-av ${cls}" aria-hidden="true">${esc(initials(store.childName(child)))}</span>`;

    function rosterHtml(d) {
      if (!d.children.length) return state('users', 'No children in this class yet', 'Children enrolled in this class will appear here.', canMove ? `<a class="btn btn--primary kids-yellow" href="${routes.page('enrol')}">${icon('user-plus', 'icon--sm')}Enrol a child</a>` : '');
      const active = d.children.filter(k => k.status === 'active');
      const n = { in: 0, out: 0, wait: 0, done: 0 };
      active.forEach(k => { n[MARK[markOf(d, k)].tone] += 1; });
      return `<section class="panel cd-sec" aria-label="Roster">
        <div class="cd-bar">
          <ul class="cd-legend" aria-label="Today’s attendance">
            <li><i class="cd-ring cd-ring--in" aria-hidden="true"></i>Present <b>${n.in}</b></li>
            <li><i class="cd-ring cd-ring--wait" aria-hidden="true"></i>${d.register ? 'Not recorded' : 'Register not taken'} <b>${n.wait}</b></li>
            <li><i class="cd-ring cd-ring--done" aria-hidden="true"></i>Collected <b>${n.done}</b></li>
            <li><i class="cd-ring cd-ring--out" aria-hidden="true"></i>Absent <b>${n.out}</b></li>
          </ul>
          ${canMove ? `<button class="btn btn--secondary btn--sm" type="button" data-move>${icon('move', 'icon--sm')}Move child</button>` : ''}
        </div>
        <ul class="cd-roster" aria-label="Children in ${esc(d.card.name)}">${d.children.map(k => {
          const mark = markOf(d, k);
          const tone = mark ? MARK[mark].tone : 'soon';
          return `<li><button class="cd-kid" type="button" data-kid="${esc(k.id)}" aria-label="${esc(kidLabel(k, mark))}" aria-haspopup="dialog">
            <span class="cd-kid__ring cd-ring--${tone}">${avatar(k)}${alertDots(k)}</span>
            <span class="cd-kid__name">${esc(k.preferredName || k.firstName)}</span>
            <span class="cd-kid__status">${mark ? esc(MARK[mark].label.replace(' yet', '')) : esc(`Starts ${dayLabel(k.startDate)}`)}</span>
            ${k.pendingMove ? `<span class="cd-kid__move">→ ${esc(k.pendingMove.cls)}</span>` : ''}
          </button></li>`;
        }).join('')}</ul></section>`;
    }

    /* ---------------------------------------------------------------- Staff */

    function staffHtml(d) {
      const c = d.card;
      const reg = store.classById(c.id);
      const date = store.today();
      const covers = store.getSubstitutes().filter(s => s.classId === c.id && s.status === 'active' && s.date >= date).sort((a, b) => a.date.localeCompare(b.date) || minutes(a.start) - minutes(b.start));
      const att = store.getStaffAttendance();
      const name = staffId => store.educators.find(e => e.id === staffId)?.name || 'Unknown';
      const duty = staffId => ({ present: ['ok', 'On duty'], absent: ['off', 'Away today'] }[att[staffId]] || ['na', 'Not recorded']);
      const row = (staffId, role, shift, extra = '', actions = '') => {
        const [tone, text] = duty(staffId);
        return `<li class="cd-staff">
          <span class="cls-av${role === 'Lead teacher' ? ' cls-av--lead' : ''}" aria-hidden="true">${esc(initials(name(staffId)))}</span>
          <div class="cd-staff__main"><p class="cd-staff__name">${esc(name(staffId))}</p><p class="cd-staff__role">${esc(role)}${extra}</p></div>
          <p class="cd-staff__shift">${icon('clock', 'icon--sm')}${shift ? `${esc(shift.start)}–${esc(shift.end)}` : 'Not rostered today'}</p>
          <span class="cls-duty cls-duty--${tone}">${esc(text)}</span>${actions}
        </li>`;
      };
      const todayCovers = covers.filter(s => s.date === date);
      const team = reg.staffIds.length ? `<ul class="cd-staff-list">${reg.staffIds.map(sid => {
        const cover = todayCovers.find(s => s.replacingId === sid);
        return row(sid, store.staffRoleIn(reg, sid), store.shiftOf(sid, date), cover ? ` · <b class="cd-covered">Covered today by ${esc(name(cover.substituteId))}</b>` : '');
      }).join('')}</ul>` : state('user', 'No staff assigned', manage ? 'Assign a lead teacher so the class has an adult on record.' : 'Ask the school office to assign staff to this class.', manage ? `<button class="btn btn--secondary" type="button" data-edit-class>Assign staff</button>` : '');
      const coverList = covers.length ? `<ul class="cd-staff-list">${covers.map(s => row(s.substituteId, 'Substitute', s, ` · replacing ${esc(name(s.replacingId))} · ${s.date === date ? 'today' : esc(dayLabel(s.date))}`, manage ? `<button class="btn btn--tertiary btn--sm" type="button" data-cancel-cover="${esc(s.id)}">Cancel cover</button>` : '')).join('')}</ul>`
        : '<p class="cp-muted cd-note">No cover arranged.</p>';
      return `<section class="panel cd-sec" aria-label="Staff">
        <div class="cd-bar"><h2 class="cd-h2">Assigned staff <span class="cd-h2__sub">${esc(dayLabel(date))}</span></h2>
          ${manage && reg.staffIds.length ? `<button class="btn btn--primary kids-yellow btn--sm" type="button" data-sub>${icon('user-plus', 'icon--sm')}Assign substitute</button>` : ''}</div>
        ${team}
        <h2 class="cd-h2 cd-h2--gap">Cover &amp; substitutes</h2>
        ${coverList}
        ${!manage ? '<p class="cp-muted cd-note">Cover is arranged by the school office.</p>' : ''}</section>`;
    }

    /* ---------------------------------------------------------------- Today */

    function todayHtml(d) {
      const active = d.children.filter(k => k.status === 'active');
      const n = { in: 0, out: 0, wait: 0, done: 0 };
      active.forEach(k => { n[MARK[markOf(d, k)].tone] += 1; });
      const stat = (label, value, tone = '') => `<div class="cd-stat${tone ? ` cd-stat--${tone}` : ''}"><span class="cd-stat__n">${value}</span><span class="cd-stat__l">${label}</span></div>`;
      const closed = !d.view.day.open;
      const attendance = closed ? `
        <section class="panel cd-sec" aria-labelledby="cd-att"><header class="cd-sec__head"><h2 class="cd-h2" id="cd-att">Attendance</h2></header>
          <p class="cd-note">${d.view.day.kind === 'holiday' ? `School holiday: ${esc(d.view.day.name)}.` : `The school is closed on ${esc(d.view.day.name)}s.`} No children are expected today.</p></section>` : `
        <section class="panel cd-sec" aria-labelledby="cd-att">
          <header class="cd-sec__head"><h2 class="cd-h2" id="cd-att">Attendance</h2><span class="cp-muted">${d.register ? `Register taken ${esc(timeOf(d.register.takenAt))} by ${esc(d.register.takenBy)}` : 'Register not taken yet'}</span></header>
          <div class="cd-stats">${stat('Enrolled today', active.length)}${stat('Present', n.in, 'in')}${stat('Collected', n.done, 'done')}${stat('Absent', n.out, 'out')}${stat(d.register ? 'Not recorded' : 'Not yet arrived', n.wait, 'wait')}</div>
          ${active.length && d.register ? `<p class="cd-note">${pct(n.in + n.out + n.done, active.length)}% of children have a mark.${n.wait ? ' Children without a mark aren’t counted as absent.' : ''}</p>` : ''}
          ${!d.register && store.canAccess(user, 'attendance') ? `<a class="btn btn--secondary btn--sm" href="${routes.page('attendance', { cls: d.card.name })}">Take attendance</a>` : ''}
        </section>`;

      let diary;
      if (!store.canView(user, 'diary')) diary = '<p class="cp-muted">Your role can’t see the daily diary.</p>';
      else if (!d.register) diary = '<p class="cd-note">Diary completion starts once the register is taken — entries are expected for children who are present.</p>';
      else {
        const present = active.filter(k => ['in', 'done'].includes(MARK[markOf(d, k)].tone));
        if (!present.length) diary = '<p class="cd-note">No children are present, so no diary entries are expected today.</p>';
        else {
          const todays = present.map(k => store.getDiary(k.id).filter(e => e.date === store.today()));
          diary = `<ul class="cd-diary">${DIARY_TYPES.map(([key, label]) => {
            const done = todays.filter(list => list.some(e => e[key])).length;
            const p = pct(done, present.length);
            const tone = done === present.length ? 'done' : 'pending';
            return `<li class="cd-diary__row cd-diary--${tone}"><span class="cd-diary__name">${esc(label)}</span>
              <span class="cls-bar" aria-hidden="true"><span class="cls-bar__fill" style="--fill:${p}%"></span></span>
              <span class="cd-diary__n"><b>${done} / ${present.length}</b> · ${p}%</span>
              <span class="cd-diary__state">${tone === 'done' ? `${icon('check-circle', 'icon--sm')}Complete` : `${icon('clock', 'icon--sm')}Pending`}</span></li>`;
          }).join('')}</ul><p class="cd-note">Expected: one entry per present child. Counted from diary entries saved today.</p>`;
        }
      }

      const events = [];
      const date = store.today();
      store.getAnnouncements().filter(a => a.createdAt.slice(0, 10) === date && ['All families', 'All staff', d.card.name].includes(a.audience))
        .forEach(a => events.push({ time: timeOf(a.createdAt), title: a.title, kind: `Announcement · ${a.audience}` }));
      d.children.filter(k => k.status === 'starting' && k.startDate === date).forEach(k => events.push({ time: '', title: `${store.childName(k)} starts today`, kind: 'New child' }));
      store.substitutesOn(date).filter(s => s.classId === d.card.id).forEach(s => events.push({ time: s.start, title: `${store.educators.find(e => e.id === s.substituteId)?.name} covers ${store.educators.find(e => e.id === s.replacingId)?.name}`, kind: `Cover until ${s.end}` }));
      events.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
      const eventsHtml = events.length
        ? `<ul class="cd-events">${events.map(e => `<li><span class="cd-events__time">${e.time ? esc(e.time) : 'All day'}</span><span><b>${esc(e.title)}</b><small>${esc(e.kind)}</small></span></li>`).join('')}</ul>`
        : '<p class="cd-note">Nothing scheduled for this class today.</p>';

      return `${attendance}
        <section class="panel cd-sec" aria-labelledby="cd-diary"><header class="cd-sec__head"><h2 class="cd-h2" id="cd-diary">Diary completion</h2></header>${diary}</section>
        <section class="panel cd-sec" aria-labelledby="cd-ev"><header class="cd-sec__head"><h2 class="cd-h2" id="cd-ev">Events today</h2></header>${eventsHtml}
          <p class="cd-note cp-muted">Shows announcements, new children and cover. A school calendar isn’t part of this prototype yet.</p></section>`;
    }

    /* ---------------------------------------------------------------- Schedule */

    function scheduleHtml(d) {
      const r = store.classRoutine(d.card.id);
      const weekday = new Date().toLocaleDateString('en-GB', { weekday: 'long' });
      if (!r.configured) return state('clock', 'No routine set up', 'This class doesn’t have a daily routine yet. The school office sets routines.');
      if (!r.schoolDay) return state('calendar-check', `No routine on ${weekday}s`, 'The class doesn’t meet today. The routine shows on school days.');
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      return `<section class="panel cd-sec" aria-label="Routine"><h2 class="cd-h2">${esc(weekday)} routine</h2>
        <ol class="cd-timeline">${r.blocks.map(b => {
          const current = nowMin >= minutes(b.start) && nowMin < minutes(b.end);
          const past = nowMin >= minutes(b.end);
          return `<li class="cd-block${current ? ' is-now' : ''}${past ? ' is-past' : ''}"${current ? ' aria-current="time"' : ''}>
            <span class="cd-block__time"><b>${esc(b.start)}</b>–${esc(b.end)}</span>
            <div class="cd-block__body"><p class="cd-block__title">${esc(b.title)}${current ? '<span class="badge badge--success cd-now">Now</span>' : ''}</p>
            ${b.description ? `<p class="cd-block__desc">${esc(b.description)}</p>` : ''}${b.location ? `<p class="cd-block__loc">${icon('door', 'icon--sm')}${esc(b.location)}</p>` : ''}</div></li>`;
        }).join('')}</ol>
        <p class="cd-note cp-muted">Routines are set by the school office.</p></section>`;
    }

    /* ---------------------------------------------------------------- Room & resources */

    function roomHtml(d) {
      const c = d.card;
      return `<section class="panel cd-sec" aria-labelledby="cd-room"><header class="cd-sec__head"><h2 class="cd-h2" id="cd-room">Room</h2></header>
          <dl class="token-sheet">
            <div><dt>Room</dt><dd>${c.room ? esc(c.room) : '<span class="settings-missing">Not set</span>'}</dd></div>
            <div><dt>Class capacity (children)</dt><dd>${Number.isInteger(c.capacity) ? `${c.capacity} places · ${c.enrolled} enrolled` : '<span class="settings-missing">Not set</span>'}</dd></div>
            <div><dt>Room capacity</dt><dd><span class="settings-missing">Not tracked separately</span></dd></div>
          </dl>
          <p class="cd-note">Class capacity is how many children can enrol. It isn’t the room’s physical or safety limit.</p></section>
        <section class="panel cd-sec" aria-labelledby="cd-res"><header class="cd-sec__head"><h2 class="cd-h2" id="cd-res">Materials &amp; resources</h2></header>
          ${state('layers', 'Resources aren’t set up yet', 'Classroom materials will be listed here once the resources module (S23) is added. Nothing is shown until then, so no quantity here is a guess.')}</section>`;
    }

    const PANELS = { roster: rosterHtml, staff: staffHtml, today: todayHtml, schedule: scheduleHtml, room: roomHtml };

    /* ---------------------------------------------------------------- Frame + paint */

    main.innerHTML = `<div class="kids cd">
        <div data-head><div class="cd-head cd-head--skel" aria-hidden="true"><span class="skeleton" style="width:40%;height:28px"></span><span class="skeleton" style="width:25%;height:14px"></span><span class="skeleton" style="width:60%;height:40px"></span></div></div>
        <div data-tabs></div>
        <section class="cd-panel" id="cd-panel" role="tabpanel" tabindex="-1" aria-busy="true" data-panel>
          <div class="cd-roster">${Array.from({ length: 8 }, () => '<span class="skeleton cd-skel-kid"></span>').join('')}</div>
        </section>
      </div>`;
    const $ = s => main.querySelector(s);

    function paint({ focusPanel = false } = {}) {
      if (!loaded) return;
      const d = data();
      if (d.error) {
        $('[data-tabs]').innerHTML = '';
        $('[data-panel]').removeAttribute('aria-busy');
        $('[data-panel]').removeAttribute('role');
        const msg = {
          missing: ['grid', 'Class not found', 'This class doesn’t exist. It may have been removed, or the link is wrong.'],
          archived: ['archive', `${esc(d.cls?.name)} is archived`, 'Archived classes keep their history but no longer have a roster.'],
          scope: ['lock', 'This isn’t one of your classes', 'Teachers can open the classes they’re assigned to. Ask the school office if this is wrong.']
        }[d.error];
        $('[data-head]').innerHTML = `<nav class="kids-crumbs" aria-label="Breadcrumb"><a href="${routes.page('classes')}">Classes</a></nav>`;
        $('[data-panel]').innerHTML = state(msg[0], msg[1], msg[2], backToClasses, d.error === 'scope' ? 'error' : '');
        document.title = 'Class · Nexora';
        return;
      }
      document.title = `${d.card.name} · Nexora`;
      $('[data-head]').innerHTML = headerHtml(d);
      if (!$('[data-tabs] [role="tablist"]')) $('[data-tabs]').innerHTML = tabsHtml();
      main.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === tab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
      const panel = $('[data-panel]');
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', `cd-tab-${tab}`);
      panel.removeAttribute('aria-busy');
      panel.innerHTML = PANELS[tab](d);
      if (focusPanel) panel.focus();
      if (drawer) drawer.refresh(d);
    }

    function load() {
      loaded = false;
      setTimeout(() => {
        try {
          if (failOnce) { failOnce = false; throw new Error('test failure'); }
          loaded = true;
          paint();
          $('#page-title')?.focus({ preventScroll: true });
        } catch {
          $('[data-panel]').removeAttribute('aria-busy');
          $('[data-panel]').innerHTML = state('alert-circle', 'Something went wrong', 'We couldn’t load this class. Nothing has changed.', `<button class="btn btn--secondary" type="button" data-retry>${icon('refresh', 'icon--sm')}Try again</button>`, 'error');
        }
      }, reduceMotion.matches ? 0 : 300);
    }

    function selectTab(k, { focus = false } = {}) {
      if (k === tab) return;
      tab = k;
      const u = new URL(location.href);
      u.searchParams.set('tab', k);
      history.replaceState(null, '', u);
      paint();
      $(`#cd-tab-${k}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      if (focus) $(`#cd-tab-${k}`)?.focus();
      clearInterval(clock);
      // Moves the "Now" marker along while the schedule is open.
      if (k === 'schedule') clock = setInterval(() => { if (tab === 'schedule' && !document.querySelector('dialog[open]')) paint(); }, 60000);
    }

    /* ---------------------------------------------------------------- Child quick view */

    function openChild(childId, opener) {
      drawer?.close(false);
      const el = document.createElement('dialog');
      el.className = 'drawer cd-drawer';
      el.setAttribute('aria-labelledby', 'cd-drawer-title');
      el.innerHTML = `<div class="drawer__panel"><div class="drawer__head"><h2 id="cd-drawer-title">Child quick view</h2><button class="btn btn--icon-ghost" type="button" aria-label="Close quick view" data-close>${icon('x')}</button></div>
        <div class="drawer__body" data-body><span class="skeleton" style="height:64px"></span><span class="skeleton" style="height:120px"></span></div><div class="drawer__foot" data-foot></div></div>`;
      document.body.appendChild(el);
      const close = (restore = true) => {
        if (!el.isConnected || el.classList.contains('is-closing')) return;
        el.classList.add('is-closing');
        const done = () => { el.close(); el.remove(); if (restore && opener && document.contains(opener)) opener.focus(); };
        reduceMotion.matches ? done() : setTimeout(done, 170);
        drawer = null;
      };
      const body = el.querySelector('[data-body]');
      const foot = el.querySelector('[data-foot]');
      const refresh = d => {
        try {
          const child = store.childById(childId);
          if (!child) { body.innerHTML = state('alert-circle', 'Child not found', 'This record no longer exists.', '', 'error'); foot.innerHTML = ''; return; }
          const inClass = d.children.some(k => k.id === child.id);
          body.innerHTML = quickView(child, d, inClass);
          const canProfile = store.canAccess(user, 'children');
          foot.innerHTML = `${canProfile ? `<a class="btn btn--primary kids-yellow" href="${routes.record(child.id)}" data-profile>${icon('user', 'icon--sm')}Open full profile</a>` : ''}
            ${canMove && inClass && !child.pendingMove ? `<button class="btn btn--secondary" type="button" data-move-child="${esc(child.id)}">${icon('move', 'icon--sm')}Move child</button>` : ''}`;
        } catch {
          body.innerHTML = state('alert-circle', 'Couldn’t load this child', 'Close the quick view and try again.', '', 'error');
        }
      };
      el.addEventListener('cancel', e => { e.preventDefault(); close(); });
      el.addEventListener('click', e => {
        if (e.target === el || e.target.closest('[data-close]')) close();
        const mv = e.target.closest('[data-move-child]');
        if (mv) moveDialog(mv.dataset.moveChild);
      });
      el.showModal();
      drawer = { close, refresh, childId };
      setTimeout(() => { const d = data(); if (!d.error) refresh(d); el.querySelector('[data-close]').focus(); }, reduceMotion.matches ? 0 : 120);
    }

    function quickView(child, d, inClass) {
      const see = section => store.canView(user, section);
      const visible = child.alerts.filter(a => see(ALERT_SECTION[a.type]));
      const hidden = child.alerts.length - visible.length;
      const tone = a => (a.type === 'allergy' || a.type === 'custody' || a.severity === 'severe' ? 'high' : 'mid');
      const alerts = child.alerts.length
        ? `<ul class="cd-qv-alerts">${visible.map(a => `<li class="cd-qv-alert cd-qv-alert--${tone(a)}"><span class="kid-alert kid-alert--${esc(a.type)}" aria-hidden="true">${icon(ALERT_ICON[a.type])}</span><span><b>${esc(store.ALERT_TYPES[a.type])}${a.severity === 'severe' ? ' · Severe' : ''}</b><span>${esc(a.detail)}</span>${a.instructions ? `<small>${esc(a.instructions)}</small>` : ''}${a.type === 'custody' && a.restrictedPerson ? `<small>Not authorised to collect: <b>${esc(a.restrictedPerson)}</b></small>` : ''}</span></li>`).join('')}</ul>
          ${hidden ? `<p class="cd-note">${plural(hidden, 'more alert')} on file that your role can’t see.</p>` : ''}`
        : '<p class="cd-qv-none">' + icon('check-circle', 'icon--sm') + 'No safety alerts on file.</p>';
      const age = child.dob ? store.ageParts(child.dob) : null;
      const mark = inClass ? markOf(d, child) : null;
      const attendance = !inClass ? '<p class="cp-muted">Not in this class.</p>'
        : child.status !== 'active' ? `<p>Starts ${esc(dayLabel(child.startDate))}.</p>`
        : `<p class="cd-qv-mark"><i class="cd-ring cd-ring--${MARK[mark].tone}" aria-hidden="true"></i><b>${esc(MARK[mark].label)}</b>${d.register ? ` <span class="cp-muted">· register ${esc(timeOf(d.register.takenAt))}</span>` : ' <span class="cp-muted">· register not taken</span>'}</p>`;
      const pickup = !see('emergency') ? '<p class="cp-muted">Your role can’t see pickup contacts.</p>'
        : `${(child.pickup?.authorised || []).length ? `<ul class="cd-qv-list">${child.pickup.authorised.map(p => `<li><b>${esc(p.name)}</b><span>${esc(p.relation || '')}${p.status && p.status !== 'authorised' ? ` · ${esc(p.status)}` : ''}</span></li>`).join('')}</ul>` : '<p class="cp-muted">No authorised pickup contacts on file. Release only to a guardian after checking with the office.</p>'}
          ${(child.emergency || []).length ? `<p class="cd-qv-sub">Emergency contacts <span class="cp-muted">(not authorised to collect unless listed above)</span></p><ul class="cd-qv-list">${child.emergency.map(p => `<li><b>${esc(p.name)}</b><span>${esc(p.relation || '')}</span></li>`).join('')}</ul>` : ''}`;
      const diary = !see('diary') ? '<p class="cp-muted">Your role can’t see the diary.</p>' : (() => {
        const list = store.getDiary(child.id).filter(e => e.date === store.today());
        return list.length ? `<ul class="cd-qv-list">${list.map(e => `<li><b>${esc(e.title)}</b><span>${esc(timeOf(e.createdAt))} · ${esc(e.author)}</span>${e.meals ? `<small>Meals: ${esc(e.meals)}</small>` : ''}${e.rest ? `<small>Rest: ${esc(e.rest)}</small>` : ''}${e.notes ? `<small>${esc(e.notes)}</small>` : ''}</li>`).join('')}</ul>` : '<p class="cp-muted">No diary entries saved today.</p>';
      })();
      return `
        <section class="cd-qv-sec" aria-labelledby="qv-alerts"><h3 class="cd-qv-h" id="qv-alerts">Alerts</h3>${alerts}</section>
        <section class="cd-qv-id">${avatar(child, 'cd-av--lg')}<div><p class="cd-qv-name">${esc(store.childName(child))}</p><p class="cp-muted">${esc(child.cls)}${age ? ` · ${age.years} yrs ${age.months} mo` : ''}</p>${child.pendingMove ? `<p class="cd-kid__move">Moving to ${esc(child.pendingMove.cls)} on ${esc(dayLabel(child.pendingMove.date))}</p>` : ''}</div></section>
        <section class="cd-qv-sec" aria-labelledby="qv-att"><h3 class="cd-qv-h" id="qv-att">Today’s attendance</h3>${attendance}</section>
        <section class="cd-qv-sec" aria-labelledby="qv-pick"><h3 class="cd-qv-h" id="qv-pick">Authorised pickup</h3>${pickup}</section>
        <section class="cd-qv-sec" aria-labelledby="qv-diary"><h3 class="cd-qv-h" id="qv-diary">Today’s diary</h3>${diary}</section>`;
    }

    /* ---------------------------------------------------------------- Move child */

    function moveDialog(presetId = '') {
      const d = data();
      if (d.error) return;
      const movable = d.children.filter(k => !k.pendingMove);
      if (!movable.length) { window.NexoraToast?.show('Nobody to move', 'Every child here already has a move scheduled.', 'info'); return; }
      const others = store.getClassRegistry().filter(c => c.status === 'active' && c.id !== d.card.id);
      const seatText = c => { const s = store.seatsLeft(c.name); return s === null ? 'capacity not set' : s <= 0 ? 'full' : plural(s, 'seat') + ' left'; };
      const preset = movable.find(k => k.id === presetId);
      const dlg = kids.dialog({
        label: `${d.card.name} / Move child`,
        title: preset ? `Move ${store.childName(preset)}` : 'Move a child',
        desc: 'The child keeps their record and history. Past attendance and diary entries stay where they were recorded.',
        body: `<div class="cls-form">
          ${preset ? `<input type="hidden" name="child" value="${esc(preset.id)}"><p class="modal__subject">${avatar(preset)}<span><b>${esc(store.childName(preset))}</b><br><span class="cp-muted">Currently in ${esc(d.card.name)}</span></span></p>`
            : kids.field('kd-child', 'Child', `<select class="input" id="kd-child" name="child" required><option value="">Choose…</option>${movable.map(k => `<option value="${esc(k.id)}">${esc(store.childName(k))} · ${esc(d.card.name)}</option>`).join('')}</select>`, { required: true })}
          ${kids.field('kd-target', 'Move to', `<select class="input" id="kd-target" name="target" required><option value="">Choose a class…</option>${others.map(c => { const s = store.seatsLeft(c.name); return `<option value="${esc(c.name)}"${s !== null && s <= 0 ? ' disabled' : ''}>${esc(c.name)} · ${esc(`${c.ageMin}–${c.ageMax} yrs`)} · ${esc(seatText(c))}</option>`; }).join('')}</select>`, { required: true, hint: others.length ? 'Full classes can’t be chosen. Seats are checked again when you confirm.' : 'There’s no other active class to move to.' })}
          ${kids.field('kd-date', 'Takes effect', `<input class="input" id="kd-date" name="date" type="date" required min="${store.today()}" value="${store.today()}">`, { required: true, hint: 'Today moves the child now. A later date keeps them here until then.' })}
          <div class="cd-confirm" data-confirm hidden></div>
        </div>`,
        submit: 'Review move',
        async onSubmit(form) {
          const f = form.elements;
          const child = store.childById(f.child.value);
          const errors = {};
          if (!child) errors.child = 'Choose a child.';
          if (!f.target.value) errors.target = 'Choose a class to move to.';
          if (!f.date.value) errors.date = 'Choose the date the move takes effect.';
          if (Object.keys(errors).length) return { ok: false, errors };
          const box = form.querySelector('[data-confirm]');
          const sig = `${f.child.value}|${f.target.value}|${f.date.value}`;
          if (form.dataset.reviewed !== sig) {
            form.dataset.reviewed = sig;
            box.innerHTML = `<p class="cd-h2">Check before moving</p><dl class="token-sheet"><div><dt>Child</dt><dd>${esc(store.childName(child))}</dd></div><div><dt>From</dt><dd>${esc(child.cls)}</dd></div><div><dt>To</dt><dd>${esc(f.target.value)}</dd></div><div><dt>Takes effect</dt><dd>${f.date.value === store.today() ? 'Today' : esc(dayLabel(f.date.value))}</dd></div></dl>`;
            box.hidden = false;
            return { keepOpen: true, submitLabel: 'Confirm move' };
          }
          const r = await store.transferChild(store.currentUser(), child.id, f.target.value, f.date.value);
          if (r.ok) {
            window.NexoraToast?.show(r.immediate ? 'Child moved' : 'Move scheduled', r.immediate ? `${store.childName(r.child)} is now in ${r.to}.` : `${store.childName(r.child)} moves to ${r.to} on ${dayLabel(r.date)}.`);
            if (r.immediate) drawer?.close(false);
            return r;
          }
          delete form.dataset.reviewed;
          box.hidden = true;
          if (r.errors) return { ok: false, errors: r.errors };
          return { ok: false, message: FAIL[r.reason] || FAIL.storage };
        }
      });
      // Any change after the review needs a fresh review.
      dlg.form.addEventListener('change', () => {
        delete dlg.form.dataset.reviewed;
        dlg.form.querySelector('[data-confirm]').hidden = true;
        dlg.form.querySelector('[type="submit"]').textContent = 'Review move';
      });
    }

    /* ---------------------------------------------------------------- Assign substitute */

    // Today if the school is open, otherwise the next day it is.
    function nextSchoolDay() {
      const open = store.schoolDays();
      const d = new Date();
      for (let i = 0; i < 7; i++, d.setDate(d.getDate() + 1)) {
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (open.includes(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getDay()])) return iso;
      }
      return store.today();
    }

    function substituteDialog() {
      const d = data();
      if (d.error) return;
      const reg = store.classById(d.card.id);
      const nameOf = sid => store.educators.find(e => e.id === sid)?.name || '';
      const dlg = kids.dialog({
        label: `${d.card.name} / Cover`,
        title: 'Assign substitute',
        desc: 'Only staff who are free for the whole shift are listed. Availability is checked again when you confirm.',
        body: `<div class="cls-form">
          <div class="cls-form__row">
            ${kids.field('kd-date', 'Date', `<input class="input" id="kd-date" name="date" type="date" required min="${store.today()}" value="${nextSchoolDay()}">`, { required: true })}
            ${kids.field('kd-replacingId', 'Replacing', `<select class="input" id="kd-replacingId" name="replacingId" required><option value="">Choose…</option>${reg.staffIds.map(sid => `<option value="${esc(sid)}">${esc(nameOf(sid))} · ${esc(store.staffRoleIn(reg, sid))}</option>`).join('')}</select>`, { required: true })}
          </div>
          <p class="cd-shift" data-shift role="status"></p>
          <fieldset class="field cd-subpick"><legend class="field__label">Substitute <span class="field__req" aria-hidden="true">*</span></legend>
            <label class="sr-only" for="kd-subsearch">Search staff</label>
            <input class="input" id="kd-subsearch" type="search" placeholder="Search staff" autocomplete="off" data-search>
            <div class="cd-subs" data-subs></div>
            <p class="field__hint field__hint--error" data-error-for="substituteId" hidden></p>
          </fieldset>
        </div>`,
        submit: 'Confirm substitution',
        async onSubmit(form) {
          const f = form.elements;
          const r = await store.assignSubstitute(store.currentUser(), { classId: d.card.id, date: f.date.value, replacingId: f.replacingId.value, substituteId: form.querySelector('[name="substitute"]:checked')?.value || '' });
          if (r.ok) {
            const s = r.substitute;
            window.NexoraToast?.show('Substitute assigned', `${nameOf(s.substituteId)} covers ${nameOf(s.replacingId)} ${s.date === store.today() ? 'today' : `on ${dayLabel(s.date)}`}, ${s.start}–${s.end}.`);
            return r;
          }
          if (r.errors) { drawSubs(); return { ok: false, errors: r.errors }; }
          return { ok: false, message: FAIL[r.reason] || FAIL.storage };
        }
      });
      const form = dlg.form;
      function drawSubs() {
        const f = form.elements;
        const box = form.querySelector('[data-subs]');
        const shiftBox = form.querySelector('[data-shift]');
        const picked = form.querySelector('[name="substitute"]:checked')?.value;
        if (!f.date.value || !f.replacingId.value) { shiftBox.textContent = ''; box.innerHTML = '<p class="cd-note">Choose the date and who is being replaced to see who’s available.</p>'; return; }
        box.innerHTML = '<span class="skeleton" style="height:44px"></span>';
        const { window: w, options } = store.substituteOptions(d.card.id, f.date.value, f.replacingId.value);
        if (!w) { shiftBox.textContent = ''; box.innerHTML = `<p class="cd-note">${esc(nameOf(f.replacingId.value))} isn’t rostered that day, so there’s no shift to cover.</p>`; return; }
        shiftBox.innerHTML = `${icon('clock', 'icon--sm')}Shift to cover: <b>${esc(w.start)}–${esc(w.end)}</b> (${esc(nameOf(f.replacingId.value))}’s shift)`;
        const q = form.querySelector('[data-search]').value.trim().toLowerCase();
        const match = o => !q || o.name.toLowerCase().includes(q);
        const ok = options.filter(o => o.eligible && match(o));
        const no = options.filter(o => !o.eligible && match(o));
        box.innerHTML = `${ok.length ? `<div class="cd-subs__list">${ok.map(o => `<label class="cls-pick cd-sub"><input type="radio" name="substitute" value="${esc(o.id)}"${o.id === picked ? ' checked' : ''}><span><b>${esc(o.name)}</b><small>${o.relief ? 'Relief staff' : 'Staff'} · works ${esc(o.shift.start)}–${esc(o.shift.end)}${o.reason ? ` · ${esc(o.reason)}` : ''}</small></span></label>`).join('')}</div>`
          : `<p class="cd-none">${icon('info', 'icon--sm')}${q ? 'No available staff match your search.' : 'Nobody is free for this whole shift. Try another date, or contact relief staff directly.'}</p>`}
          ${no.length ? `<details class="cd-unavail"><summary>${plural(no.length, 'person', 'people')} not available</summary><ul>${no.map(o => `<li><b>${esc(o.name)}</b><span>${esc(o.reason)}</span></li>`).join('')}</ul></details>` : ''}`;
      }
      form.addEventListener('change', e => { if (e.target.name === 'date' || e.target.name === 'replacingId') drawSubs(); });
      form.querySelector('[data-search]').addEventListener('input', drawSubs);
      drawSubs();
    }

    /* ---------------------------------------------------------------- Events */

    main.addEventListener('click', e => {
      if (e.target.closest('[data-retry]')) { $('[data-panel]').innerHTML = '<span class="skeleton" style="height:120px"></span>'; load(); return; }
      const t = e.target.closest('[data-tab]');
      if (t) { selectTab(t.dataset.tab); return; }
      const kid = e.target.closest('[data-kid]');
      if (kid) { openChild(kid.dataset.kid, kid); return; }
      if (e.target.closest('[data-move]')) { moveDialog(); return; }
      if (e.target.closest('[data-sub]')) { substituteDialog(); return; }
      if (e.target.closest('[data-edit-class]')) { const c = store.classById(id); if (c && c.status === 'active') shared.classDialog(user, { cls: c }); return; }
      const cancel = e.target.closest('[data-cancel-cover]');
      if (cancel) {
        const s = store.getSubstitutes().find(x => x.id === cancel.dataset.cancelCover);
        if (!s) return;
        const nm = sid => store.educators.find(x => x.id === sid)?.name || '';
        kids.dialog({
          label: 'Cover / Cancel', title: 'Cancel this cover?',
          desc: `${esc(nm(s.substituteId))} won’t cover ${esc(nm(s.replacingId))} on ${esc(dayLabel(s.date))}. The record is kept in the class history.`,
          body: '', submit: 'Cancel cover', danger: true,
          async onSubmit() {
            const r = await store.cancelSubstitute(store.currentUser(), s.id);
            if (r.ok) window.NexoraToast?.show('Cover cancelled', `${nm(s.replacingId)} is no longer covered on ${dayLabel(s.date)}.`);
            return r.ok ? r : { ok: false, message: FAIL[r.reason] || FAIL.storage };
          }
        });
      }
    });
    main.addEventListener('keydown', e => {
      const t = e.target.closest('[role="tab"]');
      if (!t) return;
      const keys = TABS.map(([k]) => k);
      const i = keys.indexOf(t.dataset.tab);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: keys.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      selectTab(keys[(to + keys.length) % keys.length], { focus: true });
    });

    let queued = false;
    store.subscribe(({ key }) => {
      if (!loaded || (key && !/^nexora-(class-registry|children|register|staff-attendance|substitutes|staff-shifts|class-routines|diary|announcements|guardians|settings)/.test(key))) return;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const focusedKid = document.activeElement?.dataset?.kid;
        const focusedTab = document.activeElement?.dataset?.tab;
        paint();
        if (focusedKid) main.querySelector(`[data-kid="${CSS.escape(focusedKid)}"]`)?.focus();
        if (focusedTab) main.querySelector(`[data-tab="${CSS.escape(focusedTab)}"]`)?.focus();
      });
    });
    if (tab === 'schedule') clock = setInterval(() => { if (tab === 'schedule' && !document.querySelector('dialog[open]')) paint(); }, 60000);
    load();
  }

  window.NexoraClassDetail = { render };
})();
