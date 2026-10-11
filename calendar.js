/* Calendar & Events (app.html?page=calendar[&view=month|week|day|agenda][&date=YYYY-MM-DD][&type=trip,meeting][&cls=<class>][&event=<occurrenceId>])
   Reads store.eventsBetween / eventResponses; writes through createEvent / updateEvent / deleteEvent / moveEvent /
   setEventRsvp / setEventConsent / sendEventNotice / addEventFile, which check permissions and validate everything.
   Weeks start on Monday. Mobile defaults to Agenda unless the user saved another view. Test hook: ?fail=1. */
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
  const coarse = matchMedia('(pointer: coarse)');
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => new Date(`${s}T12:00:00`);
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const addMonths = (s, n) => { const d = parse(s); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return iso(d); };
  const mondayOf = s => { const d = parse(s); return addDays(s, -((d.getDay() + 6) % 7)); };
  const dateOnly = v => String(v).slice(0, 10);
  const timeOnly = v => (String(v).length > 10 ? String(v).slice(11, 16) : '');
  const minutes = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fmtDay = (s, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => parse(s).toLocaleDateString('en-GB', opts);
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const initials = n => String(n || '').replace(/^(Ms|Mr|Mrs|Dr)\.?\s+/i, '').trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();

  const VIEWS = [['month', 'Month'], ['week', 'Week'], ['day', 'Day'], ['agenda', 'Agenda']];
  const TYPE_ICON = { event: 'star', trip: 'arrow-right', meeting: 'users', holiday: 'lock', conference: 'message' };
  const HOUR_START = 7;
  const HOUR_END = 19;
  const HOUR_PX = 48;
  const FAIL = {
    forbidden: 'Your role can’t change events. Ask a school leader.',
    missing: 'This event no longer exists. Refresh the calendar.',
    invalid: 'Check the highlighted fields.',
    storage: 'This couldn’t be saved on this device. Nothing was changed. Please try again.'
  };

  function render(key, main, user) {
    if (key !== 'calendar') return false;
    page(main, user);
    return true;
  }

  function page(main, user) {
    const today = store.today();
    const manage = store.canManageEvents(user);
    const prefs = store.getCalendarPrefs(user);
    const scope = store.classScope(user);
    let view = VIEWS.some(([k]) => k === params.get('view')) ? params.get('view') : prefs.view || (mobileQ.matches ? 'agenda' : 'month');
    let cursor = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') : today;
    const types = new Set((params.get('type') || '').split(',').filter(t => store.EVENT_TYPES[t]));
    let cls = store.getClassRegistry().some(c => c.status === 'active' && c.name === params.get('cls')) ? params.get('cls') : '';
    let focus = params.get('event') || '';
    let loaded = false;
    let failOnce = params.get('fail') === '1';
    let drawer = null;

    main.classList.add('kids-page');
    document.title = 'Calendar & Events · Nexora';
    const state = (iconName, title, text, action = '', tone = '') => `<div class="kids-empty cal-state"${tone === 'error' ? ' role="alert"' : ''}><span class="state-icon${tone ? ` state-icon--${tone}` : ''}" aria-hidden="true">${icon(iconName)}</span><h2 class="kids-empty__title">${title}</h2><p>${text}</p>${action}</div>`;
    const classes = () => store.getClassRegistry().filter(c => c.status === 'active' && (manage || scope.includes(c.name)));

    main.innerHTML = `
      <div class="kids cal">
        <header class="kids-head">
          <div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Calendar &amp; Events</h1><p class="kids-head__sub">Events, trips, meetings, closures and parent conferences.</p></div>
          <div class="kids-head__actions">${manage ? `<button class="btn btn--primary kids-yellow" type="button" data-new>${icon('plus', 'icon--sm')}New event</button>` : ''}</div>
        </header>
        <section class="panel cal-bar" aria-label="Calendar controls">
          <div class="cal-nav">
            <button class="btn btn--secondary btn--sm" type="button" data-today>Today</button>
            <button class="btn btn--icon-ghost" type="button" data-step="-1" aria-label="Previous">${icon('arrow-left')}</button>
            <button class="btn btn--icon-ghost" type="button" data-step="1" aria-label="Next">${icon('arrow-right')}</button>
            <h2 class="cal-title" data-title aria-live="polite"></h2>
          </div>
          <div class="segmented cal-views" role="group" aria-label="View">${VIEWS.map(([k, l]) => `<button type="button" data-view="${k}" aria-pressed="${k === view}">${l}</button>`).join('')}</div>
          <div class="cal-filters">
            <div class="cal-types" role="group" aria-label="Event types">${Object.entries(store.EVENT_TYPES).map(([k, l]) => `<button class="chip cal-type-chip" type="button" data-type="${k}" aria-pressed="${types.has(k)}"><i class="cal-key cal-ev--${k}" aria-hidden="true"></i>${esc(l)}</button>`).join('')}</div>
            <button class="btn btn--secondary btn--sm cal-filter-btn" type="button" data-filter-sheet>${icon('filter', 'icon--sm')}Filters<span data-filter-count></span></button>
            <div class="field cal-cls"><label class="sr-only" for="cal-cls">Class</label><select class="input" id="cal-cls" data-cls><option value="">All classes</option>${classes().map(c => `<option${c.name === cls ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
          </div>
        </section>
        <ul class="cal-legend" aria-label="Event types">${Object.entries(store.EVENT_TYPES).map(([k, l]) => `<li><i class="cal-key cal-ev--${k}" aria-hidden="true"></i>${esc(l)}</li>`).join('')}</ul>
        <section class="cal-body" aria-labelledby="page-title" aria-busy="true" data-results><span class="skeleton" style="height:420px;border-radius:var(--radius-lg)"></span></section>
      </div>`;
    const $ = s => main.querySelector(s);

    /* ---------------------------------------------------------------- Range + data */

    function range() {
      if (view === 'month') {
        const first = cursor.slice(0, 8) + '01';
        const start = mondayOf(first);
        const last = addDays(addMonths(first, 1), -1);
        const end = addDays(mondayOf(last), 6);
        return { start, end, title: parse(first).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) };
      }
      if (view === 'week') {
        const start = mondayOf(cursor);
        const end = addDays(start, 6);
        return { start, end, title: `${fmtDay(start, { day: 'numeric', month: 'short' })} – ${fmtDay(end, { day: 'numeric', month: 'short', year: 'numeric' })}` };
      }
      if (view === 'day') return { start: cursor, end: cursor, title: fmtDay(cursor, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) };
      const end = addDays(cursor, 29);
      return { start: cursor, end, title: `${fmtDay(cursor, { day: 'numeric', month: 'short' })} – ${fmtDay(end, { day: 'numeric', month: 'short', year: 'numeric' })}` };
    }
    const fetch = r => store.eventsBetween(user, r.start, r.end, { types: [...types], cls });
    const on = (list, day) => list.filter(o => dateOnly(o.start) <= day && dateOnly(o.end) >= day);
    const syncUrl = () => {
      const u = new URL(location.href);
      u.searchParams.set('view', view);
      if (cursor === today) u.searchParams.delete('date'); else u.searchParams.set('date', cursor);
      types.size ? u.searchParams.set('type', [...types].join(',')) : u.searchParams.delete('type');
      cls ? u.searchParams.set('cls', cls) : u.searchParams.delete('cls');
      focus ? u.searchParams.set('event', focus) : u.searchParams.delete('event');
      history.replaceState(null, '', u);
    };
    const when = o => {
      if (o.allDay) return dateOnly(o.start) === dateOnly(o.end) ? 'All day' : `All day · until ${fmtDay(dateOnly(o.end))}`;
      const sameDay = dateOnly(o.start) === dateOnly(o.end);
      return `${timeOnly(o.start)}–${sameDay ? timeOnly(o.end) : `${fmtDay(dateOnly(o.end))} ${timeOnly(o.end)}`}`;
    };
    const typeLabel = o => store.EVENT_TYPES[o.type];
    const canDrag = () => manage && !coarse.matches && !mobileQ.matches;
    const chip = (o, extra = '') => `<button class="cal-chip cal-ev--${esc(o.type)}${extra}" type="button" data-event="${esc(o.id)}"${canDrag() ? ' draggable="true"' : ''} aria-label="${esc(`${o.title}, ${typeLabel(o)}, ${fmtDay(dateOnly(o.start))} ${when(o)}${o.recurring ? ', repeats' : ''}`)}"><span class="cal-chip__t">${o.allDay ? '' : `<b>${esc(timeOnly(o.start))}</b> `}${esc(o.title)}</span>${o.recurring ? icon('refresh', 'icon--sm cal-chip__rep') : ''}</button>`;

    /* ---------------------------------------------------------------- Views */

    function monthHtml(list, r) {
      const month = cursor.slice(0, 7);
      const days = [];
      for (let d = r.start; d <= r.end; d = addDays(d, 1)) days.push(d);
      const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const mob = mobileQ.matches;
      const grid = `<div class="cal-month" role="grid" aria-label="${esc(r.title)}"><div class="cal-month__head" role="row">${names.map(n => `<span role="columnheader">${n}</span>`).join('')}</div>
        ${Array.from({ length: days.length / 7 }, (_, w) => `<div class="cal-month__row" role="row">${days.slice(w * 7, w * 7 + 7).map(d => {
          const evs = on(list, d);
          const max = 3;
          const closed = evs.some(o => o.type === 'holiday' && !o.classIds.length);
          return `<div class="cal-cell${d.slice(0, 7) !== month ? ' is-out' : ''}${d === today ? ' is-today' : ''}${d === cursor ? ' is-selected' : ''}${closed ? ' is-closed' : ''}" role="gridcell" data-day="${d}" data-drop="${d}">
            <button class="cal-cell__num" type="button" data-pick-day="${d}" aria-label="${esc(fmtDay(d, { weekday: 'long', day: 'numeric', month: 'long' }))}${evs.length ? `, ${plural(evs.length, 'event')}` : ''}"${d === cursor ? ' aria-current="date"' : ''}>${Number(d.slice(8))}</button>
            ${mob ? (evs.length ? `<span class="cal-dots" aria-hidden="true">${evs.slice(0, 4).map(o => `<i class="cal-key cal-ev--${esc(o.type)}"></i>`).join('')}${evs.length > 4 ? '<b>+</b>' : ''}</span>` : '')
              : `${evs.slice(0, max).map(o => chip(o)).join('')}${evs.length > max ? `<button class="cal-more" type="button" data-more="${d}">+${evs.length - max} more</button>` : ''}`}
          </div>`;
        }).join('')}</div>`).join('')}</div>`;
      // On phones the selected day's events sit under the grid.
      const sel = mob ? `<section class="cal-dayList" aria-label="${esc(fmtDay(cursor, { weekday: 'long', day: 'numeric', month: 'long' }))}"><h3 class="cal-h3">${esc(fmtDay(cursor, { weekday: 'long', day: 'numeric', month: 'long' }))}</h3>${agendaItems(on(list, cursor)) || '<p class="cp-muted">No events this day.</p>'}${manage ? `<button class="btn btn--secondary btn--sm" type="button" data-new-on="${cursor}">${icon('plus', 'icon--sm')}Add on this day</button>` : ''}</section>` : '';
      return grid + sel;
    }

    // Lanes so overlapping timed events sit side by side.
    function lanes(evs) {
      const sorted = [...evs].sort((a, b) => a.start.localeCompare(b.start));
      const out = [];
      let group = [];
      let groupEnd = '';
      const flush = () => {
        const cols = [];
        group.forEach(o => { let i = cols.findIndex(end => end <= o.start); if (i < 0) { i = cols.length; cols.push(''); } cols[i] = o.end; out.push({ o, lane: i }); });
        out.filter(x => group.includes(x.o)).forEach(x => { x.of = cols.length; });
        group = [];
      };
      sorted.forEach(o => { if (group.length && o.start >= groupEnd) flush(); group.push(o); groupEnd = groupEnd > o.end && group.length > 1 ? groupEnd : o.end; });
      if (group.length) flush();
      return out;
    }
    function timedBlocks(day, evs) {
      return lanes(evs).map(({ o, lane, of }) => {
        const s = dateOnly(o.start) < day ? HOUR_START * 60 : minutes(timeOnly(o.start));
        const e = dateOnly(o.end) > day ? HOUR_END * 60 : minutes(timeOnly(o.end));
        const top = (Math.max(s, HOUR_START * 60) - HOUR_START * 60) / 60 * HOUR_PX;
        const h = Math.max(22, (Math.min(e, HOUR_END * 60) - Math.max(s, HOUR_START * 60)) / 60 * HOUR_PX);
        const outside = e <= HOUR_START * 60 || s >= HOUR_END * 60;
        return `<button class="cal-block cal-ev--${esc(o.type)}${outside ? ' is-outside' : ''}" type="button" data-event="${esc(o.id)}"${canDrag() ? ' draggable="true"' : ''} style="top:${outside ? 0 : top}px;height:${h}px;left:calc(${(lane / of) * 100}% + 2px);width:calc(${100 / of}% - 4px)" aria-label="${esc(`${o.title}, ${typeLabel(o)}, ${when(o)}${o.location ? `, ${o.location}` : ''}`)}">
          <span class="cal-block__type">${icon(TYPE_ICON[o.type], 'icon--sm')}${esc(typeLabel(o))}</span><b>${esc(o.title)}</b><span>${esc(when(o))}${o.location ? ` · ${esc(o.location)}` : ''}</span></button>`;
      }).join('');
    }
    function gridHtml(list, days) {
      const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
      const allDay = days.map(d => on(list, d).filter(o => o.allDay));
      const timed = days.map(d => on(list, d).filter(o => !o.allDay));
      return `<div class="cal-grid cal-grid--${days.length === 1 ? 'day' : 'week'}" style="--cols:${days.length}">
        <div class="cal-grid__head"><span></span>${days.map(d => `<button class="cal-grid__day${d === today ? ' is-today' : ''}${d === cursor ? ' is-selected' : ''}" type="button" data-pick-day="${d}">${esc(fmtDay(d, { weekday: 'short' }))}<b>${Number(d.slice(8))}</b></button>`).join('')}</div>
        <div class="cal-grid__allday"><span class="cal-grid__label">All day</span>${days.map((d, i) => `<div class="cal-grid__adcell" data-drop="${d}">${allDay[i].map(o => chip(o)).join('')}${manage && !allDay[i].length ? `<button class="cal-slot cal-slot--ad" type="button" data-new-on="${d}" data-allday="1" aria-label="New all-day event on ${esc(fmtDay(d))}"></button>` : ''}</div>`).join('')}</div>
        <div class="cal-grid__body" style="--hours:${hours.length};--hour:${HOUR_PX}px">
          <div class="cal-grid__axis">${hours.map(h => `<span>${pad(h)}:00</span>`).join('')}</div>
          ${days.map((d, i) => `<div class="cal-grid__col" data-col="${d}">
            ${hours.flatMap(h => ['00', '30'].map(m => `<button class="cal-slot" type="button" data-slot="${d}T${pad(h)}:${m}" data-drop="${d}T${pad(h)}:${m}" ${manage ? '' : 'tabindex="-1" disabled'} aria-label="${manage ? `New event ${esc(fmtDay(d))} ${pad(h)}:${m}` : ''}"></button>`)).join('')}
            ${timedBlocks(d, timed[i])}
          </div>`).join('')}
        </div>
        ${timed.flat().some(o => minutes(timeOnly(o.start)) < HOUR_START * 60 || minutes(timeOnly(o.end) || '00:00') > HOUR_END * 60) ? `<p class="cp-muted cal-note">Some events run outside ${HOUR_START}:00–${HOUR_END}:00; their full times are in the details.</p>` : ''}
      </div>`;
    }
    function agendaItems(list) {
      if (!list.length) return '';
      return `<ul class="cal-agenda__list">${list.map(o => `<li><button class="cal-agenda__item" type="button" data-event="${esc(o.id)}">
          <span class="cal-agenda__when">${esc(when(o))}</span>
          <span class="cal-agenda__main"><span class="cal-badge cal-ev--${esc(o.type)}">${icon(TYPE_ICON[o.type], 'icon--sm')}${esc(typeLabel(o))}</span><b>${esc(o.title)}</b>
            <small>${[o.location, o.classIds.length ? o.classIds.map(id => store.classById(id)?.name).filter(Boolean).join(', ') : 'Whole school'].filter(Boolean).map(esc).join(' · ')}</small>
            ${indicators(o)}</span>
        </button></li>`).join('')}</ul>`;
    }
    function indicators(o) {
      if (!o.rsvp && !o.consent) return '';
      const r = store.eventResponses(user, o.id);
      if (!r) return '';
      return `<span class="cal-ind">${r.rsvp ? `<span>${icon('check-circle', 'icon--sm')}RSVP ${r.rsvp.yes} yes · ${r.rsvp.no} no · ${r.rsvp.none} no reply</span>` : ''}${r.consent ? `<span class="${r.consent.pending ? 'is-warn' : ''}">${icon('shield-check', 'icon--sm')}Consent ${r.consent.granted} received · ${r.consent.pending} pending${r.consent.declined ? ` · ${r.consent.declined} declined` : ''}</span>` : ''}</span>`;
    }
    function agendaHtml(list, r) {
      if (!list.length) return '';
      const days = [];
      for (let d = r.start; d <= r.end; d = addDays(d, 1)) { const evs = on(list, d); if (evs.length) days.push([d, evs]); }
      return `<div class="cal-agenda">${days.map(([d, evs]) => `<section class="cal-agenda__day"><h3 class="cal-h3${d === today ? ' is-today' : ''}">${esc(fmtDay(d, { weekday: 'long', day: 'numeric', month: 'long' }))}${d === today ? ' · Today' : ''}</h3>${agendaItems(evs)}</section>`).join('')}</div>`;
    }

    function paint() {
      if (!loaded) return;
      const r = range();
      $('[data-title]').textContent = r.title;
      main.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
      main.querySelectorAll('[data-type]').forEach(b => b.setAttribute('aria-pressed', String(types.has(b.dataset.type))));
      $('[data-filter-count]').textContent = types.size || cls ? ` (${types.size + (cls ? 1 : 0)})` : '';
      const list = fetch(r);
      const res = $('[data-results]');
      res.removeAttribute('aria-busy');
      const filtered = types.size || cls;
      const empty = filtered
        ? state('filter', 'No events match these filters', `Nothing in ${esc(r.title)} for the chosen ${types.size ? 'types' : ''}${types.size && cls ? ' and ' : ''}${cls ? esc(cls) : ''}.`, `<button class="btn btn--secondary" type="button" data-clear-filters>Clear filters</button>`)
        : state('calendar-check', 'No events in this period', manage ? 'Add an event, trip, meeting or closure with New event.' : 'Events your school adds will appear here.', manage ? `<button class="btn btn--primary kids-yellow" type="button" data-new>${icon('plus', 'icon--sm')}New event</button>` : '');
      if (view === 'month') res.innerHTML = monthHtml(list, r) + (!list.length ? `<p class="cp-muted cal-note">${filtered ? 'No events match these filters this month.' : 'No events this month.'}</p>` : '');
      else if (view === 'week') { const days = Array.from({ length: 7 }, (_, i) => addDays(r.start, i)); res.innerHTML = gridHtml(list, days) + (!list.length ? `<p class="cp-muted cal-note">${filtered ? 'No events match these filters this week.' : 'No events this week.'}</p>` : ''); }
      else if (view === 'day') res.innerHTML = gridHtml(list, [cursor]) + (!list.length ? `<p class="cp-muted cal-note">${filtered ? 'No events match these filters.' : 'No events this day.'}</p>` : '');
      else res.innerHTML = list.length ? agendaHtml(list, r) : empty;
      if (drawer) drawer.refresh();
    }

    function load() {
      loaded = false;
      setTimeout(() => {
        try {
          if (failOnce) { failOnce = false; throw new Error('test failure'); }
          loaded = true;
          syncUrl();
          paint();
          if (focus) { const o = store.findOccurrence(focus); if (o && store.eventsBetween(user, dateOnly(o.start), dateOnly(o.end)).some(x => x.id === o.id)) openEvent(focus); else { focus = ''; syncUrl(); } }
        } catch {
          $('[data-results]').removeAttribute('aria-busy');
          $('[data-results]').innerHTML = state('alert-circle', 'Something went wrong', 'We couldn’t load the calendar. Nothing has changed.', `<button class="btn btn--secondary" type="button" data-retry>${icon('refresh', 'icon--sm')}Try again</button>`, 'error');
        }
      }, reduceMotion.matches ? 0 : 300);
    }

    /* ---------------------------------------------------------------- Event form */

    function eventForm({ occurrence = null, scopeChoice = 'all', preset = {} } = {}) {
      const o = occurrence;
      const editingOne = o && o.recurring && scopeChoice === 'this';
      const v = o ? { ...o, startDate: dateOnly(o.start), startTime: timeOnly(o.start) || '09:00', endDate: dateOnly(o.end), endTime: timeOnly(o.end) || '10:00' }
        : { title: '', type: preset.type || 'event', allDay: Boolean(preset.allDay), startDate: preset.date || cursor, startTime: preset.time || '09:00', endDate: preset.date || cursor, endTime: preset.time ? `${pad(Math.min(23, Number(preset.time.slice(0, 2)) + 1))}:${preset.time.slice(3)}` : '10:00', repeat: 'none', until: '', location: '', description: '', classIds: cls ? [store.classByName(cls)?.id].filter(Boolean) : [], staffIds: [], rsvp: false, consent: false, attachments: [] };
      if (o && o.recurring && scopeChoice !== 'this') { v.repeat = o.repeat; v.until = o.until; }
      const files = [...(v.attachments || [])];
      const impact = o ? store.eventImpact(o.id, scopeChoice) : null;
      const cl = store.getClassRegistry().filter(c => c.status === 'active');
      const d = kids.dialog({
        label: o ? `Calendar / Edit${o.recurring ? ` · ${{ this: 'this event only', future: 'this and future events', all: 'entire series' }[scopeChoice]}` : ''}` : 'Calendar / New event',
        title: o ? 'Edit event' : 'New event',
        desc: impact && (impact.rsvps || impact.consents) ? `${plural(impact.rsvps, 'RSVP reply', 'RSVP replies')} and ${plural(impact.consents, 'consent record')} are linked to ${impact.occurrences === 1 ? 'this date' : `these ${impact.occurrences} dates`}. They stay with their events; families aren’t told about changes unless you notify them.` : '',
        body: `<div class="cls-form cal-form">
          ${kids.field('kd-title', 'Event title', `<input class="input" id="kd-title" name="title" maxlength="120" required autocomplete="off" value="${esc(v.title)}">`, { required: true })}
          <div class="cls-form__row">
            ${kids.field('kd-type', 'Event type', `<select class="input" id="kd-type" name="type" required>${Object.entries(store.EVENT_TYPES).map(([k, l]) => `<option value="${k}"${k === v.type ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`, { required: true })}
            <label class="cls-toggle cal-allday"><input type="checkbox" name="allDay" role="switch"${v.allDay ? ' checked' : ''}><span class="cls-toggle__track" aria-hidden="true"></span><span>All-day event</span></label>
          </div>
          <div class="cls-form__row">
            ${kids.field('kd-startDate', 'Start date', `<input class="input" id="kd-startDate" name="startDate" type="date" required value="${v.startDate}">`, { required: true })}
            <div data-time>${kids.field('kd-startTime', 'Start time', `<input class="input" id="kd-startTime" name="startTime" type="time" value="${v.startTime}">`, { required: true })}</div>
          </div>
          <div class="cls-form__row">
            ${kids.field('kd-endDate', 'End date', `<input class="input" id="kd-endDate" name="endDate" type="date" required value="${v.endDate}">`, { required: true })}
            <div data-time>${kids.field('kd-endTime', 'End time', `<input class="input" id="kd-endTime" name="endTime" type="time" value="${v.endTime}">`, { required: true })}</div>
          </div>
          ${editingOne ? '<p class="cp-muted">You’re changing only this date. Repeats stay as they are.</p>' : `<div class="cls-form__row">
            ${kids.field('kd-repeat', 'Repeat', `<select class="input" id="kd-repeat" name="repeat">${Object.entries(store.EVENT_REPEATS).map(([k, l]) => `<option value="${k}"${k === v.repeat ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`, { hint: 'Monthly repeats skip months without that date (e.g. the 31st).' })}
            <div data-until>${kids.field('kd-until', 'Repeat until', `<input class="input" id="kd-until" name="until" type="date" value="${esc(v.until)}">`, { required: true })}</div>
          </div>`}
          ${kids.field('kd-location', 'Location (optional)', `<input class="input" id="kd-location" name="location" maxlength="120" autocomplete="off" value="${esc(v.location)}">`)}
          <fieldset class="field"><legend class="field__label">Classes involved <span class="field__extra">None = whole school</span></legend>
            ${cl.length ? `<div class="cls-picks">${cl.map(c => `<label class="cls-pick"><input type="checkbox" name="cls" value="${esc(c.id)}"${v.classIds.includes(c.id) ? ' checked' : ''}><span><b>${esc(c.name)}</b></span></label>`).join('')}</div>` : '<p class="cp-muted">No active classes yet.</p>'}
            <p class="field__hint field__hint--error" data-error-for="classIds" hidden></p></fieldset>
          <fieldset class="field"><legend class="field__label">Staff <span class="field__extra">Optional</span></legend>
            ${store.educators.length ? `<div class="cls-picks">${store.educators.map(e => `<label class="cls-pick"><input type="checkbox" name="staff" value="${esc(e.id)}"${v.staffIds.includes(e.id) ? ' checked' : ''}><span><b>${esc(e.name)}</b></span></label>`).join('')}</div>` : '<p class="cp-muted">No staff on record.</p>'}
            <p class="field__hint field__hint--error" data-error-for="staffIds" hidden></p></fieldset>
          <div class="cal-toggles">
            <label class="cls-toggle" data-rsvp-wrap><input type="checkbox" name="rsvpOn" role="switch"${v.rsvp ? ' checked' : ''}><span class="cls-toggle__track" aria-hidden="true"></span><span>Requires RSVP</span></label>
            <label class="cls-toggle cal-consent" data-consent-wrap><input type="checkbox" name="consentOn" role="switch"${v.consent ? ' checked' : ''}><span class="cls-toggle__track" aria-hidden="true"></span><span>Requires consent <small data-consent-hint>Trips usually need written consent from a guardian.</small></span></label>
            <p class="field__hint field__hint--error" data-error-for="rsvp" hidden></p><p class="field__hint field__hint--error" data-error-for="consent" hidden></p>
          </div>
          ${kids.field('kd-description', 'Description (optional)', `<textarea class="input" id="kd-description" name="description" rows="3" maxlength="2000">${esc(v.description)}</textarea>`)}
          <div class="field"><label class="field__label" for="kd-file">Attachment <span class="field__extra">Optional · PDF, JPEG or PNG up to 1 MB</span></label>
            <input class="input" id="kd-file" type="file" accept="application/pdf,image/jpeg,image/png" ${manage ? '' : 'disabled'}>
            <ul class="cal-files" data-files></ul>
            <p class="field__hint field__hint--error" data-error-for="attachment" hidden></p><p class="field__hint field__hint--error" data-error-for="attachments" hidden></p></div>
        </div>`,
        submit: o ? 'Save changes' : 'Save event',
        async onSubmit(form) {
          const f = form.elements;
          const input = {
            title: f.title.value, type: f.type.value, allDay: f.allDay.checked, startDate: f.startDate.value, startTime: f.startTime.value, endDate: f.endDate.value, endTime: f.endTime.value,
            repeat: f.repeat ? f.repeat.value : 'none', until: f.until ? f.until.value : '', location: f.location.value, description: f.description.value,
            classIds: [...form.querySelectorAll('[name="cls"]:checked')].map(i => i.value), staffIds: [...form.querySelectorAll('[name="staff"]:checked')].map(i => i.value),
            rsvp: !form.querySelector('[data-rsvp-wrap]').hidden && f.rsvpOn.checked, consent: !form.querySelector('[data-consent-wrap]').hidden && f.consentOn.checked, attachments: files
          };
          const res = o ? await store.updateEvent(store.currentUser(), o.id, input, scopeChoice) : await store.createEvent(store.currentUser(), input);
          if (!res.ok) return res.errors ? { ok: false, errors: res.errors } : { ok: false, message: FAIL[res.reason] || FAIL.storage };
          window.NexoraToast?.show(o ? 'Event updated' : 'Event saved', `${input.title} · ${fmtDay(input.startDate)}${input.repeat !== 'none' && !editingOne ? ` · repeats ${input.repeat}` : ''}`);
          focus = res.occurrenceId;
          cursor = input.startDate;
          syncUrl();
          setTimeout(() => { paint(); openEvent(res.occurrenceId); }, reduceMotion.matches ? 0 : 200);
          return res;
        }
      });
      const form = d.form;
      const drawFiles = () => {
        form.querySelector('[data-files]').innerHTML = files.map(id => { const m = store.eventFileMeta(id); return `<li>${icon('file', 'icon--sm')}<span>${esc(m?.name || 'Missing file')}${m ? ` · ${Math.round(m.size / 1024)} KB` : ''}</span><button class="btn btn--icon-ghost btn--sm" type="button" data-unfile="${esc(id)}" aria-label="Remove ${esc(m?.name || 'file')}">${icon('x', 'icon--sm')}</button></li>`; }).join('');
      };
      const sync = () => {
        const t = form.elements.type.value;
        form.querySelectorAll('[data-time]').forEach(x => { x.hidden = form.elements.allDay.checked; });
        const rep = form.elements.repeat;
        if (rep) form.querySelector('[data-until]').hidden = rep.value === 'none';
        form.querySelector('[data-rsvp-wrap]').hidden = !['event', 'trip', 'conference'].includes(t);
        form.querySelector('[data-consent-wrap]').hidden = !['event', 'trip'].includes(t);
        form.querySelector('[data-consent-wrap]').classList.toggle('is-prominent', t === 'trip');
        form.querySelector('[data-consent-hint]').hidden = t !== 'trip';
      };
      form.addEventListener('change', e => {
        if (e.target.name === 'startDate' && form.elements.endDate.value < e.target.value) form.elements.endDate.value = e.target.value;
        if (e.target.name === 'type' && e.target.value === 'holiday' && !form.elements.allDay.checked) form.elements.allDay.checked = true;
        sync();
      });
      form.querySelector('#kd-file').addEventListener('change', async e => {
        const file = e.target.files[0];
        const err = form.querySelector('[data-error-for="attachment"]');
        err.hidden = true;
        if (!file) return;
        const li = document.createElement('li');
        li.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>Uploading ${esc(file.name)}…</span>`;
        form.querySelector('[data-files]').appendChild(li);
        const data = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = () => r(''); fr.readAsDataURL(file); });
        const res = await store.addEventFile(store.currentUser(), { name: file.name, mime: file.type, size: file.size, data });
        e.target.value = '';
        if (res.ok) files.push(res.file.id); else { err.textContent = res.errors?.attachment || FAIL.storage; err.hidden = false; }
        drawFiles();
      });
      form.addEventListener('click', e => { const u = e.target.closest('[data-unfile]'); if (u) { files.splice(files.indexOf(u.dataset.unfile), 1); drawFiles(); } });
      drawFiles();
      sync();
    }

    // Recurring changes ask which events they apply to before anything opens.
    function chooseScope(o, verb, then) {
      if (!o.recurring) { then('all'); return; }
      const label = { edit: 'Edit', delete: 'Delete', move: 'Move' }[verb];
      kids.dialog({
        label: 'Calendar / Repeating event', title: `${label} a repeating event`,
        desc: `<b>${esc(o.title)}</b> · ${esc(fmtDay(o.date, { weekday: 'long', day: 'numeric', month: 'long' }))}`,
        body: `<fieldset class="field"><legend class="sr-only">Which events</legend><div class="cal-scope">
          ${[['this', verb === 'delete' ? 'Delete this event' : 'This event only'], ['future', verb === 'delete' ? 'Delete this and future events' : 'This and future events'], ['all', verb === 'delete' ? 'Delete entire series' : 'Entire series']].map(([k, l], i) => `<label class="cls-pick"><input type="radio" name="scopePick" value="${k}"${i === 0 ? ' checked' : ''}><span><b>${esc(l)}</b><small>${esc((store.eventImpact(o.id, k) || {}).occurrences || 0)} date${(store.eventImpact(o.id, k) || {}).occurrences === 1 ? '' : 's'}</small></span></label>`).join('')}
        </div></fieldset>`,
        submit: 'Continue',
        danger: verb === 'delete',
        async onSubmit(form) { const s = form.querySelector('[name="scopePick"]:checked').value; setTimeout(() => then(s), reduceMotion.matches ? 0 : 200); return { ok: true }; }
      });
    }

    function confirmDelete(o, scopeChoice) {
      const impact = store.eventImpact(o.id, scopeChoice);
      const what = !o.recurring ? 'this event' : { this: 'this event only', future: 'this and all later events in the series', all: 'every event in the series' }[scopeChoice];
      kids.dialog({
        label: 'Calendar / Delete', title: 'Delete event?',
        desc: `<b>${esc(o.title)}</b> · ${esc(fmtDay(o.date, { weekday: 'long', day: 'numeric', month: 'long' }))}. This deletes ${esc(what)}${impact.occurrences > 1 ? ` (${impact.occurrences} dates)` : ''}.${impact.rsvps || impact.consents ? ` ${plural(impact.rsvps, 'RSVP reply', 'RSVP replies')} and ${plural(impact.consents, 'consent record')} are kept in the history.` : ''}`,
        body: '', submit: 'Delete', danger: true,
        async onSubmit() {
          const res = await store.deleteEvent(store.currentUser(), o.id, scopeChoice);
          if (!res.ok) return { ok: false, message: FAIL[res.reason] || FAIL.storage };
          window.NexoraToast?.show('Event deleted', `${o.title} · ${fmtDay(o.date)}${res.scope === 'future' ? ' and later' : res.scope === 'all' && o.recurring ? ' · whole series' : ''}`);
          drawer?.close(false);
          return res;
        }
      });
    }

    // Move confirmation: nothing is saved until the user chooses.
    function confirmMove(o, target) {
      const dest = { date: target.slice(0, 10), time: target.length > 10 ? target.slice(11, 16) : '' };
      const span = o.allDay ? 0 : (new Date(o.end) - new Date(o.start)) / 60000;
      const newStart = o.allDay ? dest.date : `${dest.date}T${dest.time || timeOnly(o.start)}`;
      if (newStart === o.start) return;
      const endD = o.allDay ? null : new Date(new Date(`${newStart}:00`).getTime() + span * 60000);
      const proposed = o.allDay ? `${fmtDay(dest.date, { weekday: 'long', day: 'numeric', month: 'long' })} · all day` : `${fmtDay(dest.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${newStart.slice(11)}–${pad(endD.getHours())}:${pad(endD.getMinutes())}`;
      const families = o.type !== 'meeting' && o.type !== 'holiday' ? true : o.type === 'holiday';
      const run = scopeChoice => {
        let notify = true;
        const dlg = kids.dialog({
          label: 'Calendar / Reschedule', title: families ? 'Move and notify families?' : 'Move this event?',
          desc: `<b>${esc(o.title)}</b>`,
          body: `<dl class="token-sheet"><div><dt>Now</dt><dd>${esc(fmtDay(dateOnly(o.start), { weekday: 'long', day: 'numeric', month: 'long' }))} · ${esc(when(o))}</dd></div><div><dt>Move to</dt><dd>${esc(proposed)}</dd></div>${o.recurring ? `<div><dt>Applies to</dt><dd>${esc({ this: 'This event only', future: 'This and future events', all: 'Entire series' }[scopeChoice])}</dd></div>` : ''}</dl>
            ${families ? '<p class="cp-muted">Families with an active parent-app account are recorded for a notice after the move is saved. In this prototype nothing is actually sent.</p>' : ''}`,
          submit: families ? 'Move and notify' : 'Move',
          async onSubmit() {
            const res = await store.moveEvent(store.currentUser(), o.id, dest, scopeChoice, families && notify);
            if (!res.ok) { paint(); return res.errors ? { ok: false, message: Object.values(res.errors)[0] } : { ok: false, message: FAIL[res.reason] || FAIL.storage }; }
            const n = res.notice;
            window.NexoraToast?.show('Event moved', n ? (n.ok ? `${plural(n.queued, 'family notice')} recorded (demo — not delivered)${n.skipped ? `, ${n.skipped} skipped` : ''}.` : 'The move is saved, but the notices couldn’t be recorded.') : `${o.title} · ${proposed}`, n && !n.ok ? 'info' : 'check-circle');
            focus = res.occurrenceId;
            syncUrl();
            return res;
          }
        });
        if (families) {
          const foot = dlg.form.querySelector('.modal__foot');
          foot.insertAdjacentHTML('beforeend', `<button class="btn btn--secondary" type="button" data-quiet>Move without notification</button>`);
          foot.querySelector('[data-quiet]').addEventListener('click', () => { notify = false; dlg.form.requestSubmit(); });
        }
        dlg.el.addEventListener('close', () => paint(), { once: true });
      };
      chooseScope(o, 'move', run);
    }

    function rescheduleDialog(o) {
      kids.dialog({
        label: 'Calendar / Reschedule', title: 'Reschedule',
        desc: `<b>${esc(o.title)}</b> · now ${esc(fmtDay(dateOnly(o.start)))} ${esc(when(o))}. The length stays the same.`,
        body: `<div class="cls-form__row">${kids.field('kd-rdate', 'New date', `<input class="input" id="kd-rdate" name="rdate" type="date" required value="${dateOnly(o.start)}">`, { required: true })}${o.allDay ? '' : kids.field('kd-rtime', 'New start time', `<input class="input" id="kd-rtime" name="rtime" type="time" required value="${timeOnly(o.start)}">`, { required: true })}</div>`,
        submit: 'Next',
        async onSubmit(form) {
          const date = form.elements.rdate.value;
          const time = form.elements.rtime?.value || '';
          if (!date || (!o.allDay && !time)) return { ok: false, errors: { rdate: 'Choose the new date and time.' } };
          setTimeout(() => confirmMove(o, o.allDay ? date : `${date}T${time}`), reduceMotion.matches ? 0 : 200);
          return { ok: true };
        }
      });
    }

    /* ---------------------------------------------------------------- Details drawer */

    function openEvent(occurrenceId, opener = document.activeElement) {
      drawer?.close(false);
      focus = occurrenceId;
      syncUrl();
      const el = document.createElement('dialog');
      el.className = 'drawer cal-drawer';
      el.setAttribute('aria-labelledby', 'cal-drawer-title');
      el.innerHTML = `<div class="drawer__panel"><div class="drawer__head"><h2 id="cal-drawer-title">Event</h2><button class="btn btn--icon-ghost" type="button" aria-label="Close event details" data-close>${icon('x')}</button></div><div class="drawer__body" data-body></div><div class="drawer__foot" data-foot></div></div>`;
      document.body.appendChild(el);
      let listFilter = 'all';
      const close = (restore = true) => {
        if (!el.isConnected || el.classList.contains('is-closing')) return;
        el.classList.add('is-closing');
        const done = () => { el.close(); el.remove(); if (restore && opener && document.contains(opener)) opener.focus(); };
        reduceMotion.matches ? done() : setTimeout(done, 170);
        drawer = null;
        focus = '';
        syncUrl();
      };
      const refresh = () => {
        const o = store.findOccurrence(occurrenceId);
        const body = el.querySelector('[data-body]');
        const foot = el.querySelector('[data-foot]');
        if (!o || !store.eventsBetween(user, dateOnly(o.start), dateOnly(o.end)).some(x => x.id === o.id)) { body.innerHTML = state('calendar-check', 'Event not available', 'It may have been deleted or moved.'); foot.innerHTML = ''; return; }
        const r = store.eventResponses(user, o.id);
        el.querySelector('#cal-drawer-title').textContent = o.title;
        const names = ids => ids.map(id => store.classById(id)?.name || store.educators.find(e => e.id === id)?.name).filter(Boolean).join(', ');
        const rows = r.rows.filter(x => listFilter === 'all' || (listFilter === 'none' && o.rsvp && !x.rsvp) || (listFilter === 'yes' && x.rsvp?.response === 'yes') || (listFilter === 'no' && x.rsvp?.response === 'no') || (listFilter === 'pending' && o.consent && !x.consent) || (listFilter === 'declined' && x.consent?.status === 'declined'));
        const guardianOpts = c => (c.guardianLinks || []).map(l => { const g = store.guardianById(l.guardianId); return g ? `<option value="${esc(g.id)}"${l.primary ? ' selected' : ''}>${esc(g.name)} (${esc(l.relation || 'Guardian')})</option>` : ''; }).join('');
        body.innerHTML = `
          <div class="cal-d-head"><span class="cal-badge cal-ev--${esc(o.type)}">${icon(TYPE_ICON[o.type], 'icon--sm')}${esc(typeLabel(o))}</span>${o.recurring ? `<span class="cal-rep">${icon('refresh', 'icon--sm')}${esc(store.EVENT_REPEATS[o.repeat])} until ${esc(fmtDay(o.until))}${o.exception ? ' · this date changed' : ''}</span>` : ''}</div>
          <dl class="token-sheet">
            <div><dt>When</dt><dd>${esc(fmtDay(dateOnly(o.start), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))} · ${esc(when(o))}</dd></div>
            ${o.location ? `<div><dt>Where</dt><dd>${esc(o.location)}</dd></div>` : ''}
            <div><dt>Classes</dt><dd>${o.classIds.length ? esc(names(o.classIds)) : 'Whole school'}</dd></div>
            ${o.staffIds.length ? `<div><dt>Staff</dt><dd>${esc(names(o.staffIds))}</dd></div>` : ''}
          </dl>
          ${o.description ? `<p class="cal-desc">${esc(o.description)}</p>` : ''}
          ${o.attachments.length ? `<div class="cal-d-sec"><h3 class="cd-qv-h">Attachments</h3><ul class="cal-files">${o.attachments.map(id => { const m = store.eventFileMeta(id); return m ? `<li>${icon('file', 'icon--sm')}<button class="btn btn--tertiary btn--sm" type="button" data-open-file="${esc(id)}">${esc(m.name)}</button><small>${Math.round(m.size / 1024)} KB</small></li>` : `<li class="cp-muted">${icon('alert-circle', 'icon--sm')}File not available on this device</li>`; }).join('')}</ul></div>` : ''}
          ${r.rsvp ? `<div class="cal-d-sec"><h3 class="cd-qv-h">RSVP</h3><div class="cal-counts"><span class="is-yes"><b>${r.rsvp.yes}</b>Yes</span><span class="is-no"><b>${r.rsvp.no}</b>No</span><span class="is-none"><b>${r.rsvp.none}</b>No reply</span></div>${!r.rsvp.yes && !r.rsvp.no ? '<p class="cp-muted">No replies yet.</p>' : ''}</div>` : ''}
          ${r.consent ? `<div class="cal-d-sec"><h3 class="cd-qv-h">Consent</h3><div class="cal-counts"><span class="is-yes"><b>${r.consent.granted}</b>Received</span><span class="is-warn"><b>${r.consent.pending}</b>Pending</span><span class="is-no"><b>${r.consent.declined}</b>Declined</span></div>${r.consent.pending ? `<p class="cal-pending">${icon('alert-triangle', 'icon--sm')}${plural(r.consent.pending, 'child', 'children')} can’t go until a guardian gives consent. An RSVP isn’t consent.</p>` : ''}</div>` : ''}
          ${(r.rsvp || r.consent) ? (r.rows.length ? `<div class="cal-d-sec"><div class="cal-d-bar"><h3 class="cd-qv-h">Children (${r.rows.length})</h3><label class="sr-only" for="cal-rfilter">Show</label><select class="input input--sm" id="cal-rfilter" data-rfilter><option value="all">Everyone</option>${r.rsvp ? '<option value="none">No reply</option><option value="yes">RSVP yes</option><option value="no">RSVP no</option>' : ''}${r.consent ? '<option value="pending">Consent pending</option><option value="declined">Consent declined</option>' : ''}</select></div>
            <ul class="cal-people">${rows.map(x => `<li class="cal-person${o.consent && !x.consent ? ' is-pending' : ''}">
              <span class="cal-person__who"><b>${esc(store.childName(x.child))}</b><small>${esc(x.child.cls)}</small></span>
              ${r.rsvp ? `<span class="cal-person__ctl" role="group" aria-label="RSVP for ${esc(x.child.firstName)}"><span class="cal-person__lab">RSVP</span>${['yes', 'no'].map(k => `<button class="chip chip--sm" type="button" data-rsvp="${esc(x.child.id)}" data-val="${k}" aria-pressed="${x.rsvp?.response === k}">${k === 'yes' ? 'Yes' : 'No'}</button>`).join('')}${x.rsvp ? `<small title="${esc(`Recorded by ${x.rsvp.recordedBy}`)}">${x.rsvp.guardianId ? `from ${esc(store.guardianById(x.rsvp.guardianId)?.name || 'a guardian')}` : 'family reply'}</small>` : '<small>No reply</small>'}</span>` : ''}
              ${r.consent ? `<span class="cal-person__ctl" role="group" aria-label="Consent for ${esc(x.child.firstName)}"><span class="cal-person__lab">Consent</span>${x.consent ? `<span class="cal-cs cal-cs--${x.consent.status}">${x.consent.status === 'granted' ? 'Received' : 'Declined'}</span><small>${esc(store.guardianById(x.consent.guardianId)?.name || '')}</small><button class="btn btn--tertiary btn--sm" type="button" data-consent="${esc(x.child.id)}" data-val="">Reset</button>` : `<span class="cal-cs cal-cs--pending">Pending</span><label class="sr-only" for="g-${esc(x.child.id)}">Guardian</label><select class="input input--sm" id="g-${esc(x.child.id)}" data-guardian="${esc(x.child.id)}">${guardianOpts(x.child)}</select><button class="chip chip--sm" type="button" data-consent="${esc(x.child.id)}" data-val="granted">Received</button><button class="chip chip--sm" type="button" data-consent="${esc(x.child.id)}" data-val="declined">Declined</button>`}</span>` : ''}
            </li>`).join('') || '<li class="cp-muted">Nobody matches this filter.</li>'}</ul></div>` : '<div class="cal-d-sec"><p class="cp-muted">No children are linked to this event’s classes, or none are in your classes.</p></div>') : ''}
          <p class="cal-meta">Added by ${esc(o.createdBy || '—')}${o.updatedBy ? ` · last changed by ${esc(o.updatedBy)}` : ''}</p>`;
        const sel = body.querySelector('[data-rfilter]');
        if (sel) sel.value = listFilter;
        foot.innerHTML = `${manage ? `<button class="btn btn--secondary" type="button" data-edit>${icon('pencil', 'icon--sm')}Edit</button><button class="btn btn--secondary" type="button" data-resched>${icon('clock', 'icon--sm')}Reschedule</button>` : ''}
          ${r.rsvp && r.rsvp.none && (manage || r.rows.length) ? `<button class="btn btn--primary kids-yellow" type="button" data-remind>${icon('bell', 'icon--sm')}Remind non-responders (${r.rsvp.none})</button>` : ''}
          ${manage ? `<button class="btn btn--tertiary is-danger" type="button" data-delete>${icon('trash', 'icon--sm')}Delete</button>` : ''}`;
      };
      el.addEventListener('cancel', e => { e.preventDefault(); close(); });
      el.addEventListener('change', e => { if (e.target.matches('[data-rfilter]')) { listFilter = e.target.value; refresh(); } });
      el.addEventListener('click', async e => {
        if (e.target === el || e.target.closest('[data-close]')) { close(); return; }
        const o = store.findOccurrence(occurrenceId);
        if (!o) return;
        if (e.target.closest('[data-edit]')) { chooseScope(o, 'edit', s => eventForm({ occurrence: o, scopeChoice: s })); return; }
        if (e.target.closest('[data-delete]')) { chooseScope(o, 'delete', s => confirmDelete(o, s)); return; }
        if (e.target.closest('[data-resched]')) { rescheduleDialog(o); return; }
        const f = e.target.closest('[data-open-file]');
        if (f) {
          const file = store.eventFile(user, o.id, f.dataset.openFile);
          if (!file) { window.NexoraToast?.show('File not available', 'It couldn’t be loaded on this device.', 'info'); return; }
          const blob = await (await window.fetch(file.data)).blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
          return;
        }
        const rv = e.target.closest('[data-rsvp]');
        if (rv) {
          const cur = store.eventResponses(user, o.id).rows.find(x => x.child.id === rv.dataset.rsvp)?.rsvp?.response;
          rv.disabled = true;
          const res = await store.setEventRsvp(store.currentUser(), o.id, rv.dataset.rsvp, cur === rv.dataset.val ? null : rv.dataset.val);
          if (!res.ok) { rv.disabled = false; window.NexoraToast?.show('Not saved', (res.errors && Object.values(res.errors)[0]) || FAIL[res.reason] || FAIL.storage, 'info'); }
          return;
        }
        const cs = e.target.closest('[data-consent]');
        if (cs) {
          const gid = el.querySelector(`[data-guardian="${CSS.escape(cs.dataset.consent)}"]`)?.value || '';
          cs.disabled = true;
          const res = await store.setEventConsent(store.currentUser(), o.id, cs.dataset.consent, cs.dataset.val || null, gid);
          if (!res.ok) { cs.disabled = false; window.NexoraToast?.show('Not saved', (res.errors && Object.values(res.errors)[0]) || FAIL[res.reason] || FAIL.storage, 'info'); }
          return;
        }
        const rm = e.target.closest('[data-remind]');
        if (rm) {
          rm.disabled = true;
          rm.innerHTML = `<span class="spinner" aria-hidden="true"></span>Recording…`;
          const res = await store.sendEventNotice(store.currentUser(), { occurrenceId: o.id, kind: 'reminder' });
          refresh();
          if (!res.ok) { window.NexoraToast?.show('Reminders not recorded', FAIL[res.reason] || FAIL.storage, 'info'); return; }
          window.NexoraToast?.show(res.queued ? 'Reminders recorded' : 'No reminders recorded', `${res.queued} of ${res.families} families queued (demo — not delivered).${res.reasons.length ? ` Skipped: ${res.reasons.map(x => x.replace('skipped: ', '')).join('; ')}.` : ''}`, res.queued ? 'check-circle' : 'info');
        }
      });
      el.showModal();
      drawer = { close, refresh };
      refresh();
      el.querySelector('[data-close]').focus();
    }

    /* ---------------------------------------------------------------- Filters sheet (phones) */

    function filterSheet() {
      kids.dialog({
        label: 'Calendar / Filters', title: 'Filters', desc: '',
        body: `<fieldset class="field"><legend class="field__label">Event types</legend><div class="cls-picks">${Object.entries(store.EVENT_TYPES).map(([k, l]) => `<label class="cls-pick"><input type="checkbox" name="ft" value="${k}"${types.has(k) ? ' checked' : ''}><span><i class="cal-key cal-ev--${k}" aria-hidden="true"></i><b>${esc(l)}</b></span></label>`).join('')}</div><p class="field__hint">None ticked = all types.</p></fieldset>
          ${kids.field('kd-fcls', 'Class', `<select class="input" id="kd-fcls" name="fcls"><option value="">All classes</option>${classes().map(c => `<option${c.name === cls ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`)}`,
        submit: 'Apply',
        async onSubmit(form) {
          types.clear();
          form.querySelectorAll('[name="ft"]:checked').forEach(i => types.add(i.value));
          cls = form.elements.fcls.value;
          $('[data-cls]').value = cls;
          syncUrl(); paint();
          return { ok: true };
        }
      });
    }

    /* ---------------------------------------------------------------- Events */

    function setView(v) {
      view = v;
      store.saveCalendarPrefs(user, { view });
      syncUrl(); paint();
      main.querySelector(`[data-view="${v}"]`)?.focus();
    }
    main.addEventListener('click', e => {
      if (e.target.closest('[data-retry]')) { load(); return; }
      if (e.target.closest('[data-new]')) { eventForm({ preset: { date: cursor } }); return; }
      const nv = e.target.closest('[data-new-on]');
      if (nv) { if (manage) eventForm({ preset: { date: nv.dataset.newOn, allDay: Boolean(nv.dataset.allday) } }); return; }
      const sl = e.target.closest('[data-slot]');
      if (sl) { if (manage) eventForm({ preset: { date: sl.dataset.slot.slice(0, 10), time: sl.dataset.slot.slice(11) } }); return; }
      if (e.target.closest('[data-today]')) { cursor = today; syncUrl(); paint(); return; }
      const st = e.target.closest('[data-step]');
      if (st) {
        const n = Number(st.dataset.step);
        cursor = view === 'month' ? addMonths(cursor, n) : view === 'week' ? addDays(cursor, 7 * n) : view === 'day' ? addDays(cursor, n) : addDays(cursor, 30 * n);
        syncUrl(); paint(); return;
      }
      const v = e.target.closest('[data-view]');
      if (v) { setView(v.dataset.view); return; }
      const t = e.target.closest('[data-type]');
      if (t) { types.has(t.dataset.type) ? types.delete(t.dataset.type) : types.add(t.dataset.type); syncUrl(); paint(); return; }
      if (e.target.closest('[data-clear-filters]')) { types.clear(); cls = ''; $('[data-cls]').value = ''; syncUrl(); paint(); return; }
      if (e.target.closest('[data-filter-sheet]')) { filterSheet(); return; }
      const ev = e.target.closest('[data-event]');
      if (ev) { openEvent(ev.dataset.event, ev); return; }
      const more = e.target.closest('[data-more]');
      if (more) { cursor = more.dataset.more; setView('day'); return; }
      const pd = e.target.closest('[data-pick-day]');
      if (pd) {
        cursor = pd.dataset.pickDay;
        syncUrl(); paint();
        main.querySelector(`[data-pick-day="${cursor}"]`)?.focus();
        return;
      }
      // Empty part of a month cell: select it and (for leaders) start a new event there.
      const cell = e.target.closest('.cal-cell');
      if (cell && !mobileQ.matches) { cursor = cell.dataset.day; syncUrl(); paint(); if (manage) eventForm({ preset: { date: cursor, allDay: false } }); }
    });
    main.addEventListener('change', e => { if (e.target.matches('[data-cls]')) { cls = e.target.value; syncUrl(); paint(); } });

    // Drag to reschedule (mouse only; touch and keyboard use Reschedule in the details).
    let dragging = null;
    main.addEventListener('dragstart', e => { const ev = e.target.closest('[data-event][draggable="true"]'); if (!ev) return; dragging = ev.dataset.event; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragging); ev.classList.add('is-dragging'); });
    main.addEventListener('dragend', e => { e.target.closest?.('[data-event]')?.classList.remove('is-dragging'); main.querySelectorAll('.is-drop').forEach(x => x.classList.remove('is-drop')); });
    main.addEventListener('dragover', e => { if (!dragging) return; const t = e.target.closest('[data-drop]'); if (!t) return; e.preventDefault(); main.querySelectorAll('.is-drop').forEach(x => x !== t && x.classList.remove('is-drop')); t.classList.add('is-drop'); });
    main.addEventListener('drop', e => {
      const t = e.target.closest('[data-drop]');
      if (!dragging || !t) return;
      e.preventDefault();
      t.classList.remove('is-drop');
      const o = store.findOccurrence(dragging);
      dragging = null;
      if (!o) return;
      let target = t.dataset.drop;
      if (o.allDay) target = target.slice(0, 10);
      else if (target.length === 10) target = `${target}T${timeOnly(o.start)}`;
      confirmMove(o, target);
    });

    mobileQ.addEventListener('change', () => paint());
    let queued = false;
    store.subscribe(({ key }) => {
      if (!loaded || (key && !/^nexora-(events|event-|children|class-registry|guardians|calendar-prefs|demo-role)/.test(key))) return;
      if (queued) return;
      queued = true;
      setTimeout(() => { queued = false; paint(); }, 0);
    });
    load();
  }

  window.NexoraCalendar = { render };
})();
