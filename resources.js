/* S23 Rooms & Resources (app.html?page=resources[&tab=rooms|materials|library|inventory][&date=YYYY-MM-DD][&focus=<id>][&repairs=1])
   Reads and writes through the store (getRooms/saveBooking, getMaterials/saveMaterial/setRepairStatus, getBooks/lendBook/
   returnBook, getInventory/adjustStock …), which checks permissions, clashes, copies and stock at save time.
   Test hook: ?fail=1. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const kids = window.NexoraChildren;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const params = new URLSearchParams(location.search);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (s, n) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };
  const fmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(`${s}T12:00:00`).toLocaleDateString('en-GB', o);
  const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const hhmm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const initials = n => String(n || '').trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
  const TABS = [['rooms', 'Rooms'], ['materials', 'Materials'], ['library', 'Library'], ['inventory', 'Inventory']];
  const AREA_KEY = { 'Practical life': 'pl', Sensorial: 'se', Language: 'la', Mathematics: 'ma', Culture: 'cu' };
  const COND_TONE = { good: 'success', repair: 'error', missing: 'warning' };
  const STOCK_TONE = { ok: 'success', low: 'warning', out: 'error' };
  const STOCK_LABEL = { ok: 'OK', low: 'Low', out: 'Out' };
  const FAIL = {
    forbidden: 'Your role can’t do this. Nothing was changed.',
    missing: 'This record no longer exists. Refresh the page.',
    unavailable: 'No copies are available to lend.',
    returned: 'This loan was already returned.',
    insufficient: 'There isn’t enough stock to remove that many.',
    storage: 'This couldn’t be saved on this device. Nothing was changed. Please try again.'
  };

  function render(key, main, user) {
    if (key !== 'resources') return false;
    page(main, user);
    return true;
  }

  function page(main, user) {
    const today = store.today();
    const manage = store.canManageResources(user);
    let tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'rooms';
    let date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') : today;
    let focus = params.get('focus') || '';
    let showRepairs = params.get('repairs') === '1';
    const f = { room: { q: '', type: '', avail: '' }, mat: { q: '', area: '', where: '', cond: '', sort: 'area' }, lib: { q: '', status: '' }, inv: { q: '', cat: '', status: '' } };
    let loaded = false;
    let failOnce = params.get('fail') === '1';

    main.classList.add('kids-page');
    document.title = 'Rooms & Resources · Nexora';
    const state = (iconName, title, text, action = '', tone = '') => `<div class="kids-empty rs-state"${tone === 'error' ? ' role="alert"' : ''}><span class="state-icon${tone ? ` state-icon--${tone}` : ''}" aria-hidden="true">${icon(iconName)}</span><h2 class="kids-empty__title">${title}</h2><p>${text}</p>${action}</div>`;
    const chip = (tone, text) => `<span class="badge badge--plain rs-chip rs-chip--${tone}">${esc(text)}</span>`;
    const reset = key => `<button class="btn btn--tertiary btn--sm" type="button" data-reset="${key}">Reset filters</button>`;
    const classes = () => store.getClassRegistry().filter(c => c.status === 'active');
    const className = id => store.classById(id)?.name || '';
    const staffName = id => store.educators.find(e => e.id === id)?.name || '';

    main.innerHTML = `
      <div class="kids rs">
        <header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Rooms &amp; Resources</h1><p class="kids-head__sub">Rooms and bookings, Montessori materials, the library and classroom stock.</p></div></header>
        <div class="tabs rs-tabs" role="tablist" aria-label="Rooms and resources">${TABS.map(([k, l]) => `<button class="tab" type="button" role="tab" id="rs-tab-${k}" aria-controls="rs-panel" aria-selected="${k === tab}" tabindex="${k === tab ? 0 : -1}" data-tab="${k}">${l}</button>`).join('')}</div>
        <section class="rs-panel" id="rs-panel" role="tabpanel" aria-labelledby="rs-tab-${tab}" tabindex="-1" aria-busy="true" data-panel><span class="skeleton" style="height:320px;border-radius:var(--radius-lg)"></span></section>
      </div>`;
    const $ = s => main.querySelector(s);
    const syncUrl = () => {
      const u = new URL(location.href);
      tab === 'rooms' ? u.searchParams.delete('tab') : u.searchParams.set('tab', tab);
      date === today ? u.searchParams.delete('date') : u.searchParams.set('date', date);
      focus ? u.searchParams.set('focus', focus) : u.searchParams.delete('focus');
      showRepairs ? u.searchParams.set('repairs', '1') : u.searchParams.delete('repairs');
      history.replaceState(null, '', u);
    };
    const head = (title, sub, action = '') => `<div class="rs-head"><div><h2 class="cd-h2">${title}</h2>${sub ? `<p class="cp-muted">${sub}</p>` : ''}</div>${action}</div>`;

    /* ---------------------------------------------------------------- Rooms */

    function roomsHtml() {
      const h = store.roomHours();
      const open = mins(h.open);
      const close = mins(h.close);
      const span = close - open;
      const now = new Date().getHours() * 60 + new Date().getMinutes();
      const isToday = date === today;
      const day = store.schoolDay(date);
      const all = store.getRooms().filter(r => r.status === 'active');
      const q = f.room.q.trim().toLowerCase();
      const rows = all.map(r => ({ r, bookings: store.bookingsOn(r.id, date) })).filter(({ r, bookings }) => {
        if (q && !`${r.name} ${store.ROOM_TYPES[r.type]} ${className(r.classId)}`.toLowerCase().includes(q)) return false;
        if (f.room.type && r.type !== f.room.type) return false;
        const busy = bookings.some(b => isToday && mins(b.start) <= now && now < mins(b.end));
        if (f.room.avail === 'free' && (isToday ? busy : bookings.length)) return false;
        if (f.room.avail === 'busy' && !(isToday ? busy : bookings.length)) return false;
        return true;
      });
      const nav = `<div class="rs-toolbar"><div class="rs-datenav"><button class="btn btn--icon-ghost" type="button" data-day="-1" aria-label="Previous day">${icon('arrow-left')}</button><b class="rs-datenav__label" aria-live="polite">${esc(fmt(date, { weekday: 'long', day: 'numeric', month: 'long' }))}${isToday ? ' · Today' : ''}</b><button class="btn btn--icon-ghost" type="button" data-day="1" aria-label="Next day">${icon('arrow-right')}</button><button class="btn btn--tertiary btn--sm" type="button" data-today>Today</button></div>
        <div class="rs-filters"><label class="sr-only" for="rs-rq">Search rooms</label><input class="input" id="rs-rq" type="search" placeholder="Search rooms" value="${esc(f.room.q)}" data-f="room.q">
        <label class="sr-only" for="rs-rt">Room type</label><select class="input" id="rs-rt" data-f="room.type"><option value="">All types</option>${Object.entries(store.ROOM_TYPES).map(([k, l]) => `<option value="${k}"${k === f.room.type ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <label class="sr-only" for="rs-ra">Availability</label><select class="input" id="rs-ra" data-f="room.avail"><option value="">Any availability</option><option value="free"${f.room.avail === 'free' ? ' selected' : ''}>${isToday ? 'Free now' : 'No bookings'}</option><option value="busy"${f.room.avail === 'busy' ? ' selected' : ''}>${isToday ? 'In use now' : 'Has bookings'}</option></select>
        ${f.room.q || f.room.type || f.room.avail ? reset('room') : ''}</div></div>`;
      const top = head('Rooms', `Bookable ${h.open}–${h.close}. Two bookings can’t overlap in the same room.`, `<div class="rs-head__actions">${manage ? `<button class="btn btn--secondary btn--sm" type="button" data-new-room>${icon('plus', 'icon--sm')}Add room</button>` : ''}<button class="btn btn--primary kids-yellow btn--sm" type="button" data-book="">${icon('calendar-check', 'icon--sm')}Book room</button></div>`);
      if (!all.length) return top + state('door', 'No rooms yet', 'Add the school’s rooms to start booking them.', manage ? `<button class="btn btn--primary kids-yellow" type="button" data-new-room>Add room</button>` : '');
      const closed = !day.open ? `<p class="ls-banner ls-banner--warn">${icon('info', 'icon--sm')}<span>${esc(day.kind === 'holiday' ? day.name : `The school is closed on ${day.name}s`)} — rooms can’t be booked this day.</span></p>` : '';
      const hours = [];
      for (let m = Math.ceil(open / 60) * 60; m < close; m += 60) hours.push(m);
      return top + nav + closed + (rows.length ? `<ul class="rs-rooms">${rows.map(({ r, bookings }) => {
        const cur = isToday ? bookings.find(b => mins(b.start) <= now && now < mins(b.end)) : null;
        const next = isToday ? bookings.find(b => mins(b.start) > now) : null;
        const status = cur ? chip('warning', `In use until ${cur.end}`) : isToday ? chip('success', next ? `Free · next ${next.start}` : 'Free now') : bookings.length ? chip('info', plural(bookings.length, 'booking')) : chip('success', 'No bookings');
        return `<li class="panel rs-room">
          <div class="rs-room__head"><div><h3 class="rs-room__name">${esc(r.name)}</h3><p class="rs-room__meta"><span>${esc(store.ROOM_TYPES[r.type])}</span><span>${icon('users', 'icon--sm')}Up to ${r.capacity}</span>${r.classId ? `<span>${icon('grid', 'icon--sm')}${esc(className(r.classId))}</span>` : ''}</p></div>${status}</div>
          <div class="rs-tl" role="group" aria-label="${esc(`${r.name} on ${fmt(date)}`)}">
            <div class="rs-tl__track">${day.open ? hours.map(m => `<button class="rs-tl__slot" type="button" data-book="${esc(r.id)}" data-at="${hhmm(m)}" style="left:${((m - open) / span) * 100}%;width:${(60 / span) * 100}%" aria-label="Book ${esc(r.name)} at ${hhmm(m)}"></button>`).join('') : ''}
            ${bookings.map(b => `<button class="rs-tl__bk${cur?.id === b.id ? ' is-now' : ''}" type="button" data-booking="${esc(b.id)}" style="left:${Math.max(0, (mins(b.start) - open) / span) * 100}%;width:${Math.max(2, ((Math.min(close, mins(b.end)) - Math.max(open, mins(b.start))) / span) * 100)}%" aria-label="${esc(`${b.start}–${b.end} ${b.title}, ${store.bookingGroup(b)}`)}"><b>${esc(b.title)}</b><span>${esc(b.start)}–${esc(b.end)} · ${esc(store.bookingGroup(b))}</span></button>`).join('')}
            ${isToday && now > open && now < close ? `<i class="rs-tl__now" style="left:${((now - open) / span) * 100}%" aria-hidden="true"></i>` : ''}</div>
            <div class="rs-tl__axis" aria-hidden="true">${hours.filter((_, i) => i % 2 === 0).map(m => `<span style="left:${((m - open) / span) * 100}%">${hhmm(m)}</span>`).join('')}</div>
          </div>
          ${bookings.length ? `<ul class="rs-bklist">${bookings.map(b => `<li><button class="btn btn--tertiary btn--sm" type="button" data-booking="${esc(b.id)}"><b>${esc(b.start)}–${esc(b.end)}</b> ${esc(b.title)} · ${esc(store.bookingGroup(b))}</button></li>`).join('')}</ul>` : `<p class="cp-muted rs-room__empty">${day.open ? 'No bookings this day.' : 'Closed.'}</p>`}
          <div class="rs-room__actions"><button class="btn btn--secondary btn--sm" type="button" data-book="${esc(r.id)}">${icon('plus', 'icon--sm')}Book room</button>${manage ? `<button class="btn btn--tertiary btn--sm" type="button" data-edit-room="${esc(r.id)}">${icon('pencil', 'icon--sm')}Edit</button>` : ''}</div>
        </li>`;
      }).join('')}</ul>` : state('filter', 'No rooms match', 'Try another search or filter.', reset('room')));
    }

    function bookingForm({ roomId = '', at = '', booking = null } = {}) {
      const b = booking;
      const rooms = store.getRooms().filter(r => r.status === 'active');
      const start = b?.start || at || '09:00';
      const end = b?.end || hhmm(Math.min(mins(start) + 60, 23 * 60 + 59));
      const d = kids.dialog({
        label: 'Rooms / Booking', title: b ? 'Edit booking' : 'Book a room', desc: '',
        body: `<div class="cls-form">
          ${kids.field('kd-roomId', 'Room', `<select class="input" id="kd-roomId" name="roomId" required><option value="">Choose…</option>${rooms.map(r => `<option value="${esc(r.id)}"${r.id === (b?.roomId || roomId) ? ' selected' : ''}>${esc(r.name)} · up to ${r.capacity}</option>`).join('')}</select>`, { required: true })}
          ${kids.field('kd-title', 'Purpose', `<input class="input" id="kd-title" name="title" maxlength="80" required placeholder="e.g. Music and movement" value="${esc(b?.title || '')}">`, { required: true })}
          <div class="cls-form__row">${kids.field('kd-date', 'Date', `<input class="input" id="kd-date" name="date" type="date" required min="${today}" value="${esc(b?.date || date)}">`, { required: true })}
            <div class="cls-form__pair rs-times"><span>${kids.field('kd-start', 'Start', `<input class="input" id="kd-start" name="start" type="time" required value="${esc(start)}">`, { required: true })}</span><span aria-hidden="true">–</span><span>${kids.field('kd-end', 'End', `<input class="input" id="kd-end" name="end" type="time" required value="${esc(end)}">`, { required: true })}</span></div></div>
          <div class="cls-form__row">${kids.field('kd-classId', 'Class', `<select class="input" id="kd-classId" name="classId"><option value="">Another group</option>${classes().map(c => `<option value="${esc(c.id)}"${c.id === b?.classId ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`)}
            ${kids.field('kd-group', 'Group name (if not a class)', `<input class="input" id="kd-group" name="group" maxlength="60" value="${esc(b?.group || '')}">`)}</div>
          <div class="cls-form__row">${kids.field('kd-staffId', 'Staff responsible', `<select class="input" id="kd-staffId" name="staffId" required><option value="">Choose…</option>${store.educators.map(e => `<option value="${esc(e.id)}"${e.id === b?.staffId ? ' selected' : ''}>${esc(e.name)}</option>`).join('')}</select>`, { required: true })}
            ${kids.field('kd-participants', 'People (optional)', `<input class="input" id="kd-participants" name="participants" type="number" min="1" step="1" inputmode="numeric" value="${esc(b?.participants ?? '')}">`)}</div>
          ${kids.field('kd-notes', 'Notes (optional)', `<textarea class="input" id="kd-notes" name="notes" rows="2" maxlength="300">${esc(b?.notes || '')}</textarea>`)}
          <div class="rs-clash" data-clash role="alert" hidden></div>
        </div>`,
        submit: b ? 'Save booking' : 'Book room',
        async onSubmit(form) {
          const x = form.elements;
          const clashBox = form.querySelector('[data-clash]');
          clashBox.hidden = true;
          const res = await store.saveBooking(store.currentUser(), { roomId: x.roomId.value, title: x.title.value, date: x.date.value, start: x.start.value, end: x.end.value, classId: x.classId.value, group: x.group.value, staffId: x.staffId.value, participants: x.participants.value, notes: x.notes.value }, b?.id || null);
          if (res.ok) { window.NexoraToast?.show(b ? 'Booking updated' : 'Room booked', `${store.roomById(res.booking.roomId).name} · ${fmt(res.booking.date)} ${res.booking.start}–${res.booking.end}`); date = res.booking.date; syncUrl(); return res; }
          if (res.reason === 'clash') {
            clashBox.innerHTML = `${icon('alert-triangle')}<div><b>Room unavailable</b><p>Room booked ${esc(res.clash.start)}–${esc(res.clash.end)} by ${esc(res.clash.group)}${res.clash.title ? ` (${esc(res.clash.title)})` : ''}.</p><small>Choose another time or another room — nothing was saved.</small></div>`;
            clashBox.hidden = false;
            clashBox.scrollIntoView({ block: 'nearest' });
            return { keepOpen: true };
          }
          return res.errors ? { ok: false, errors: res.errors } : { ok: false, message: FAIL[res.reason] || FAIL.storage };
        }
      });
      d.form.addEventListener('input', () => { d.form.querySelector('[data-clash]').hidden = true; });
    }
    function bookingDetails(id) {
      const b = store.getBookings().find(x => x.id === id && x.status === 'booked');
      if (!b) { window.NexoraToast?.show('Booking not found', FAIL.missing, 'info'); return; }
      const canChange = manage || b.createdById === user.id;
      const d = kids.dialog({
        label: 'Rooms / Booking', title: b.title,
        desc: `${esc(store.roomById(b.roomId)?.name || '')} · ${esc(fmt(b.date, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${esc(b.start)}–${esc(b.end)}`,
        body: `<dl class="token-sheet"><div><dt>Class or group</dt><dd>${esc(store.bookingGroup(b))}</dd></div><div><dt>Staff responsible</dt><dd>${esc(staffName(b.staffId))}</dd></div>${b.participants ? `<div><dt>People</dt><dd>${b.participants}</dd></div>` : ''}${b.notes ? `<div><dt>Notes</dt><dd>${esc(b.notes)}</dd></div>` : ''}<div><dt>Booked by</dt><dd>${esc(b.createdBy || '')}</dd></div></dl>`,
        submit: canChange ? 'Edit booking' : 'Close',
        async onSubmit() { if (canChange) setTimeout(() => bookingForm({ booking: b }), reduceMotion.matches ? 0 : 200); return { ok: true }; }
      });
      if (canChange) {
        const foot = d.form.querySelector('.modal__foot');
        foot.insertAdjacentHTML('beforeend', `<button class="btn btn--tertiary is-danger" type="button" data-cancel-bk>${icon('trash', 'icon--sm')}Cancel booking</button>`);
        foot.querySelector('[data-cancel-bk]').addEventListener('click', async () => { const r = await store.cancelBooking(store.currentUser(), b.id); if (r.ok) { window.NexoraToast?.show('Booking cancelled', `${b.title} · ${b.start}–${b.end}`); d.close(); } else window.NexoraToast?.show('Not cancelled', FAIL[r.reason] || FAIL.storage, 'info'); });
      }
    }
    function roomForm(r = null) {
      kids.dialog({
        label: 'Rooms', title: r ? 'Edit room' : 'Add room', desc: '',
        body: `<div class="cls-form">${kids.field('kd-name', 'Room name', `<input class="input" id="kd-name" name="name" maxlength="60" required value="${esc(r?.name || '')}">`, { required: true })}
          <div class="cls-form__row">${kids.field('kd-type', 'Type', `<select class="input" id="kd-type" name="type" required>${Object.entries(store.ROOM_TYPES).map(([k, l]) => `<option value="${k}"${k === (r?.type || 'classroom') ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`, { required: true })}
          ${kids.field('kd-capacity', 'Maximum capacity (people)', `<input class="input" id="kd-capacity" name="capacity" type="number" min="1" max="500" step="1" required value="${esc(r?.capacity ?? '')}">`, { required: true, hint: 'The room’s safe limit — not the same as a class’s enrolment capacity.' })}</div>
          ${kids.field('kd-classId', 'Assigned class', `<select class="input" id="kd-classId" name="classId"><option value="">None (shared space)</option>${classes().map(c => `<option value="${esc(c.id)}"${c.id === r?.classId ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`)}
          ${kids.field('kd-notes', 'Notes', `<textarea class="input" id="kd-notes" name="notes" rows="2" maxlength="300">${esc(r?.notes || '')}</textarea>`)}</div>`,
        submit: r ? 'Save room' : 'Add room',
        async onSubmit(form) {
          const x = form.elements;
          const res = await store.saveRoom(store.currentUser(), { name: x.name.value, type: x.type.value, capacity: x.capacity.value, classId: x.classId.value, notes: x.notes.value }, r?.id || null);
          if (!res.ok) return res.errors ? { ok: false, errors: res.errors } : { ok: false, message: FAIL[res.reason] || FAIL.storage };
          window.NexoraToast?.show(r ? 'Room saved' : 'Room added', res.room.name);
          return res;
        }
      });
    }

    /* ---------------------------------------------------------------- Materials + repairs */

    function materialsHtml() {
      const all = store.getMaterials();
      const repairs = store.getRepairs();
      const openRepairs = repairs.filter(r => r.status !== 'resolved');
      const q = f.mat.q.trim().toLowerCase();
      const whereOf = m => (m.classId ? className(m.classId) : store.roomById(m.roomId)?.name) || '—';
      let list = all.filter(m => (!q || `${m.name} ${m.notes}`.toLowerCase().includes(q)) && (!f.mat.area || m.area === f.mat.area) && (!f.mat.cond || m.condition === f.mat.cond) && (!f.mat.where || m.classId === f.mat.where || m.roomId === f.mat.where));
      list = f.mat.sort === 'checked' ? list.sort((a, b) => a.lastChecked.localeCompare(b.lastChecked)) : list.sort((a, b) => a.name.localeCompare(b.name));
      const top = head('Materials', 'Montessori materials by curriculum area, with their condition.', `<div class="rs-head__actions"><button class="btn btn--secondary btn--sm" type="button" data-toggle-repairs aria-pressed="${showRepairs}">${icon('alert-triangle', 'icon--sm')}Repair list (${openRepairs.length} open)</button>${manage ? `<button class="btn btn--primary kids-yellow btn--sm" type="button" data-new-material>${icon('plus', 'icon--sm')}Add material</button>` : ''}</div>`);
      const filters = `<div class="rs-filters"><label class="sr-only" for="rs-mq">Search materials</label><input class="input" id="rs-mq" type="search" placeholder="Search materials" value="${esc(f.mat.q)}" data-f="mat.q">
        <label class="sr-only" for="rs-ma">Curriculum area</label><select class="input" id="rs-ma" data-f="mat.area"><option value="">All areas</option>${store.LEARNING_AREAS.map(a => `<option${a === f.mat.area ? ' selected' : ''}>${esc(a)}</option>`).join('')}</select>
        <label class="sr-only" for="rs-mw">Class or room</label><select class="input" id="rs-mw" data-f="mat.where"><option value="">All classes and rooms</option>${classes().map(c => `<option value="${esc(c.id)}"${c.id === f.mat.where ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}${store.getRooms().filter(r => !r.classId).map(r => `<option value="${esc(r.id)}"${r.id === f.mat.where ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select>
        <label class="sr-only" for="rs-mc">Condition</label><select class="input" id="rs-mc" data-f="mat.cond"><option value="">Any condition</option>${Object.entries(store.CONDITIONS).map(([k, l]) => `<option value="${k}"${k === f.mat.cond ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <label class="sr-only" for="rs-ms">Sort</label><select class="input" id="rs-ms" data-f="mat.sort"><option value="area"${f.mat.sort === 'area' ? ' selected' : ''}>Sort by name</option><option value="checked"${f.mat.sort === 'checked' ? ' selected' : ''}>Least recently checked</option></select>
        ${f.mat.q || f.mat.area || f.mat.where || f.mat.cond ? reset('mat') : ''}</div>`;
      const repairsHtml = showRepairs ? `<section class="panel rs-repairs" aria-labelledby="rs-rep"><h3 class="cd-h2" id="rs-rep">Repair list</h3>${repairs.length ? `<ul class="rs-list">${[...repairs].sort((a, b) => (a.status === 'resolved') - (b.status === 'resolved') || b.reportedAt.localeCompare(a.reportedAt)).map(r => { const m = all.find(x => x.id === r.materialId); return `<li class="rs-row"><div class="rs-row__main"><b>${esc(m?.name || 'Removed material')}</b><small>${esc(m ? whereOf(m) : '')} · reported ${esc(fmt(r.reportedAt.slice(0, 10)))} by ${esc(r.reportedBy)}${r.notes ? ` · ${esc(r.notes)}` : ''}</small></div>${chip(r.status === 'resolved' ? 'success' : r.status === 'progress' ? 'info' : 'error', store.REPAIR_STATUS[r.status])}${manage ? `<button class="btn btn--tertiary btn--sm" type="button" data-repair="${esc(r.id)}">Update status</button>` : ''}</li>`; }).join('')}</ul>` : '<p class="cp-muted">No repairs reported.</p>'}</section>` : '';
      if (!all.length) return top + repairsHtml + state('layers', 'No materials yet', 'Add the classroom materials to track their condition.', manage ? `<button class="btn btn--primary kids-yellow" type="button" data-new-material>Add material</button>` : '');
      const groups = store.LEARNING_AREAS.map(a => [a, list.filter(m => m.area === a)]).filter(([, l]) => l.length);
      return top + filters + repairsHtml + (groups.length ? groups.map(([a, l]) => `<section class="rs-group"><h3 class="rs-group__title"><span class="ls-area ls-area--${AREA_KEY[a]}">${esc(a)}</span><small>${l.length}</small></h3>
        <div class="rs-table" role="table" aria-label="${esc(a)} materials"><div class="rs-tr rs-tr--head" role="row"><span role="columnheader">Material</span><span role="columnheader">Class / room</span><span role="columnheader">Condition</span><span role="columnheader">Last checked</span><span role="columnheader"><span class="sr-only">Actions</span></span></div>
        ${l.map(m => `<div class="rs-tr" role="row"><span role="cell" class="rs-td--main"><b>${esc(m.name)}</b>${m.notes ? `<small>${esc(m.notes)}</small>` : ''}</span><span role="cell" data-label="Class / room">${esc(whereOf(m))}</span><span role="cell" data-label="Condition">${chip(COND_TONE[m.condition], store.CONDITIONS[m.condition])}</span><span role="cell" data-label="Last checked">${esc(fmt(m.lastChecked, { day: 'numeric', month: 'short', year: 'numeric' }))}</span><span role="cell" class="rs-td--act">${store.canEditMaterial(user, m) ? `<button class="btn btn--tertiary btn--sm" type="button" data-edit-material="${esc(m.id)}">${icon('pencil', 'icon--sm')}Update</button>` : ''}</span></div>`).join('')}</div></section>`).join('') : state('filter', 'No materials match', 'Try another search or filter.', reset('mat')));
    }
    function materialForm(m = null) {
      kids.dialog({
        label: 'Materials', title: m ? `Update ${m.name}` : 'Add material', desc: '',
        body: `<div class="cls-form">${kids.field('kd-name', 'Material name', `<input class="input" id="kd-name" name="name" maxlength="80" required value="${esc(m?.name || '')}" ${m && !manage ? 'readonly' : ''}>`, { required: true })}
          <div class="cls-form__row">${kids.field('kd-area', 'Curriculum area', `<select class="input" id="kd-area" name="area" required ${m && !manage ? 'disabled' : ''}><option value="">Choose…</option>${store.LEARNING_AREAS.map(a => `<option${a === m?.area ? ' selected' : ''}>${esc(a)}</option>`).join('')}</select>`, { required: true })}
          ${kids.field('kd-classId', 'Class', `<select class="input" id="kd-classId" name="classId" ${m && !manage ? 'disabled' : ''}><option value="">None</option>${classes().filter(c => manage || store.classScope(user).includes(c.name)).map(c => `<option value="${esc(c.id)}"${c.id === m?.classId ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`)}</div>
          ${kids.field('kd-roomId', 'Or shared room', `<select class="input" id="kd-roomId" name="roomId" ${m && !manage ? 'disabled' : ''}><option value="">None</option>${store.getRooms().filter(r => !r.classId).map(r => `<option value="${esc(r.id)}"${r.id === m?.roomId ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select>`)}
          <fieldset class="field"><legend class="field__label">Condition <span class="field__req" aria-hidden="true">*</span></legend><div class="cls-picks">${Object.entries(store.CONDITIONS).map(([k, l]) => `<label class="cls-pick"><input type="radio" name="cond" value="${k}"${k === (m?.condition || 'good') ? ' checked' : ''}><span><b>${esc(l)}</b></span></label>`).join('')}</div><p class="field__hint" data-cond-hint></p><p class="field__hint field__hint--error" data-error-for="condition" hidden></p></fieldset>
          ${kids.field('kd-lastChecked', 'Last checked', `<input class="input" id="kd-lastChecked" name="lastChecked" type="date" required max="${today}" value="${esc(today)}">`, { required: true })}
          ${kids.field('kd-notes', 'Notes', `<textarea class="input" id="kd-notes" name="notes" rows="2" maxlength="500" placeholder="Which pieces are missing, what needs fixing…">${esc(m?.notes || '')}</textarea>`)}</div>`,
        submit: m ? 'Save' : 'Add material',
        async onSubmit(form) {
          const x = form.elements;
          const input = { name: x.name.value, area: x.area.value || m?.area, classId: x.classId.disabled ? m.classId : x.classId.value, roomId: x.roomId.disabled ? m.roomId : x.roomId.value, condition: form.querySelector('[name="cond"]:checked')?.value, lastChecked: x.lastChecked.value, notes: x.notes.value };
          const res = await store.saveMaterial(store.currentUser(), input, m?.id || null);
          if (!res.ok) return res.errors ? { ok: false, errors: res.errors } : { ok: false, message: FAIL[res.reason] || FAIL.storage };
          if (res.repair) window.NexoraToast?.show(res.newTicket ? 'Repair reported' : 'Repair updated', `${res.material.name} is on the repair list. ${res.notified ? `${plural(res.notified, 'school leader')} notified in Nexora.` : 'No one else needed notifying.'}`);
          else window.NexoraToast?.show(m ? 'Material updated' : 'Material added', `${res.material.name} · ${store.CONDITIONS[res.material.condition]}`);
          if (m?.condition === 'repair' && res.material.condition === 'good') setTimeout(() => window.NexoraToast?.show('Repair still open', 'Mark the repair resolved in the repair list once it’s fixed.', 'info'), 400);
          return res;
        }
      }).form.addEventListener('change', e => {
        if (e.target.name !== 'cond') return;
        const hint = e.target.closest('form').querySelector('[data-cond-hint]');
        hint.textContent = e.target.value === 'repair' ? 'Saving adds it to the repair list and notifies the school leaders.' : e.target.value === 'missing' ? 'Note which pieces are missing.' : '';
      });
    }
    function repairForm(id) {
      const r = store.getRepairs().find(x => x.id === id);
      if (!r) return;
      const m = store.getMaterials().find(x => x.id === r.materialId);
      kids.dialog({
        label: 'Materials / Repair', title: `Repair: ${m?.name || ''}`, desc: '',
        body: `<div class="cls-form"><fieldset class="field"><legend class="field__label">Status</legend><div class="cls-picks">${Object.entries(store.REPAIR_STATUS).map(([k, l]) => `<label class="cls-pick"><input type="radio" name="rst" value="${k}"${k === r.status ? ' checked' : ''}><span><b>${esc(l)}</b></span></label>`).join('')}</div></fieldset>
          ${kids.field('kd-rnote', 'Note', `<textarea class="input" id="kd-rnote" name="rnote" rows="2" maxlength="300"></textarea>`)}
          <ul class="ls-hist">${r.history.map(h => `<li>${esc(fmt(h.at.slice(0, 10)))} · ${esc(h.by)} · ${esc(h.action)}${h.detail ? ` — ${esc(h.detail)}` : ''}</li>`).join('')}</ul></div>`,
        submit: 'Save status',
        async onSubmit(form) {
          const res = await store.setRepairStatus(store.currentUser(), r.id, form.querySelector('[name="rst"]:checked').value, form.elements.rnote.value);
          if (!res.ok) return { ok: false, message: FAIL[res.reason] || FAIL.storage };
          window.NexoraToast?.show('Repair updated', `${m?.name}: ${store.REPAIR_STATUS[res.repair.status]}`);
          return res;
        }
      });
    }

    /* ---------------------------------------------------------------- Library */

    function libraryHtml() {
      const books = store.getBooks();
      const loans = store.getLoans();
      const q = f.lib.q.trim().toLowerCase();
      const rows = books.map(b => store.bookStatus(b.id, loans)).filter(s => (!q || `${s.book.title} ${s.book.author} ${s.book.ref}`.toLowerCase().includes(q))
        && (!f.lib.status || (f.lib.status === 'available' && s.available > 0) || (f.lib.status === 'loan' && s.active.length) || (f.lib.status === 'overdue' && s.overdue.length)))
        .sort((a, b) => a.book.title.localeCompare(b.book.title));
      const overdueAll = loans.filter(l => l.status === 'active' && l.dueDate < today);
      const top = head('Library', `${plural(books.length, 'title')} · ${plural(loans.filter(l => l.status === 'active').length, 'copy', 'copies')} on loan${overdueAll.length ? ` · <b class="rs-over">${overdueAll.length} overdue</b>` : ''}`, manage ? `<button class="btn btn--primary kids-yellow btn--sm" type="button" data-new-book>${icon('plus', 'icon--sm')}Add book</button>` : '');
      const filters = `<div class="rs-filters"><label class="sr-only" for="rs-lq">Search books</label><input class="input" id="rs-lq" type="search" placeholder="Title, author or reference" value="${esc(f.lib.q)}" data-f="lib.q">
        <div class="segmented" role="group" aria-label="Show">${[['', 'All'], ['available', 'Available'], ['loan', 'On loan'], ['overdue', 'Overdue']].map(([k, l]) => `<button type="button" data-lib-status="${k}" aria-pressed="${f.lib.status === k}">${l}</button>`).join('')}</div>${f.lib.q || f.lib.status ? reset('lib') : ''}</div>`;
      if (!books.length) return top + state('book', 'No books yet', 'Add the class library’s books to lend them.', manage ? `<button class="btn btn--primary kids-yellow" type="button" data-new-book>Add book</button>` : '');
      const days = d => Math.round((new Date(`${today}T12:00:00`) - new Date(`${d}T12:00:00`)) / 86400000);
      return top + filters + (rows.length ? `<ul class="rs-books">${rows.map(s => `<li class="panel rs-book">
          ${s.book.cover ? `<img class="rs-cover" src="${s.book.cover}" alt="">` : `<span class="rs-cover rs-cover--ph" aria-hidden="true">${icon('book')}<b>${esc(initials(s.book.title))}</b></span>`}
          <div class="rs-book__main"><h3 class="rs-book__title">${esc(s.book.title)}</h3><p class="cp-muted">${esc(s.book.author || 'Unknown author')}${s.book.ref ? ` · ${esc(s.book.ref)}` : ''}</p>
            <p class="rs-book__copies">${chip(s.overdue.length ? 'error' : s.available ? 'success' : 'warning', s.overdue.length ? 'Overdue' : s.available ? 'Available' : 'All on loan')}<span>${s.available} of ${s.book.copies} available</span></p>
            ${s.active.length ? `<ul class="rs-loans">${s.active.map(l => `<li class="${l.dueDate < today ? 'is-overdue' : ''}"><span><b>${esc(store.borrowerName(l))}</b> <small>${l.borrowerType === 'staff' ? 'Staff' : 'Child'} · copy ${l.copy} · due ${esc(fmt(l.dueDate))}${l.dueDate < today ? ` · <strong>Overdue ${plural(days(l.dueDate), 'day')}</strong>` : ''}</small></span><button class="btn btn--tertiary btn--sm" type="button" data-return="${esc(l.id)}">Return</button></li>`).join('')}</ul>` : ''}
          </div>
          <div class="rs-book__act">${s.available ? `<button class="btn btn--secondary btn--sm" type="button" data-lend="${esc(s.book.id)}">${icon('arrow-right', 'icon--sm')}Lend</button>` : '<span class="cp-muted">No copies available</span>'}${manage ? `<button class="btn btn--tertiary btn--sm" type="button" data-edit-book="${esc(s.book.id)}">${icon('pencil', 'icon--sm')}Edit</button>` : ''}</div>
        </li>`).join('')}</ul>` : state('filter', 'No books match', 'Try another search or filter.', reset('lib')));
    }
    function lendForm(bookId) {
      const s = store.bookStatus(bookId);
      if (!s) return;
      if (!s.available) { window.NexoraToast?.show('No copies available', FAIL.unavailable, 'info'); return; }
      const who = store.borrowersFor(user);
      const d = kids.dialog({
        label: 'Library / Lend', title: `Lend “${s.book.title}”`, desc: `${s.available} of ${s.book.copies} copies available.`,
        body: `<div class="cls-form"><fieldset class="field"><legend class="field__label">Borrower</legend><div class="cls-picks"><label class="cls-pick"><input type="radio" name="btype" value="child" checked><span><b>Child</b></span></label><label class="cls-pick"><input type="radio" name="btype" value="staff"><span><b>Staff</b></span></label></div></fieldset>
          ${kids.field('kd-borrowerId', 'Who', `<select class="input" id="kd-borrowerId" name="borrowerId" required></select>`, { required: true })}
          <div class="cls-form__row">${kids.field('kd-loanDate', 'Loan date', `<input class="input" id="kd-loanDate" name="loanDate" type="date" required max="${today}" value="${today}">`, { required: true })}${kids.field('kd-dueDate', 'Due date', `<input class="input" id="kd-dueDate" name="dueDate" type="date" required value="${addDays(today, 14)}">`, { required: true, hint: `Up to ${store.LOAN_MAX_DAYS} days.` })}</div>
          ${kids.field('kd-lnotes', 'Notes (optional)', `<input class="input" id="kd-lnotes" name="lnotes" maxlength="300">`)}</div>`,
        submit: 'Lend',
        async onSubmit(form) {
          const x = form.elements;
          const res = await store.lendBook(store.currentUser(), { bookId, borrowerType: form.querySelector('[name="btype"]:checked').value, borrowerId: x.borrowerId.value, loanDate: x.loanDate.value, dueDate: x.dueDate.value, notes: x.lnotes.value });
          if (!res.ok) return res.errors ? { ok: false, errors: res.errors } : { ok: false, message: FAIL[res.reason] || FAIL.storage };
          window.NexoraToast?.show('Book lent', `${s.book.title} (copy ${res.loan.copy}) to ${store.borrowerName(res.loan)} · due ${fmt(res.loan.dueDate)}.`);
          return res;
        }
      });
      const fill = () => {
        const t = d.form.querySelector('[name="btype"]:checked').value;
        const list = t === 'child' ? who.children : who.staff;
        d.form.elements.borrowerId.innerHTML = `<option value="">Choose…</option>${list.map(x => `<option value="${esc(x.id)}">${esc(x.name)}${x.cls ? ` · ${esc(x.cls)}` : ''}</option>`).join('')}`;
      };
      d.form.addEventListener('change', e => { if (e.target.name === 'btype') fill(); });
      fill();
    }
    function returnForm(loanId) {
      const l = store.getLoans().find(x => x.id === loanId);
      if (!l) return;
      const b = store.getBooks().find(x => x.id === l.bookId);
      kids.dialog({
        label: 'Library / Return', title: 'Return this book?', desc: `<b>${esc(b?.title || '')}</b> (copy ${l.copy}) from <b>${esc(store.borrowerName(l))}</b>, lent ${esc(fmt(l.loanDate))}, due ${esc(fmt(l.dueDate))}. The loan stays in the history.`,
        body: '', submit: 'Mark returned',
        async onSubmit() {
          const res = await store.returnBook(store.currentUser(), loanId);
          if (!res.ok) return { ok: false, message: FAIL[res.reason] || FAIL.storage };
          window.NexoraToast?.show('Book returned', `${b?.title} is available again.`);
          return res;
        }
      });
    }
    function bookForm(b = null) {
      let cover;
      const d = kids.dialog({
        label: 'Library', title: b ? 'Edit book' : 'Add book', desc: '',
        body: `<div class="cls-form">${kids.field('kd-title', 'Title', `<input class="input" id="kd-title" name="title" maxlength="160" required value="${esc(b?.title || '')}">`, { required: true })}
          <div class="cls-form__row">${kids.field('kd-author', 'Author', `<input class="input" id="kd-author" name="author" maxlength="120" value="${esc(b?.author || '')}">`)}${kids.field('kd-ref', 'ISBN or catalogue reference', `<input class="input" id="kd-ref" name="ref" maxlength="40" value="${esc(b?.ref || '')}">`)}</div>
          ${kids.field('kd-copies', 'Number of copies', `<input class="input" id="kd-copies" name="copies" type="number" min="1" max="100" step="1" required value="${esc(b?.copies ?? 1)}">`, { required: true })}
          ${kids.field('kd-cover', 'Cover photo (optional)', `<input class="input" id="kd-cover" name="cover" type="file" accept="image/png,image/jpeg,image/webp">`, { hint: 'Kept on this device; up to 300 KB.' })}</div>`,
        submit: b ? 'Save book' : 'Add book',
        async onSubmit(form) {
          const x = form.elements;
          const res = await store.saveBook(store.currentUser(), { title: x.title.value, author: x.author.value, ref: x.ref.value, copies: x.copies.value, ...(cover !== undefined ? { cover } : {}) }, b?.id || null);
          if (!res.ok) return res.errors ? { ok: false, errors: res.errors } : { ok: false, message: FAIL[res.reason] || FAIL.storage };
          window.NexoraToast?.show(b ? 'Book saved' : 'Book added', res.book.title);
          return res;
        }
      });
      d.form.elements.cover.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) { cover = undefined; return; }
        const r = new FileReader();
        r.onload = () => { cover = r.result; };
        r.readAsDataURL(file);
      });
    }

    /* ---------------------------------------------------------------- Inventory */

    function inventoryHtml() {
      const all = store.getInventory();
      const q = f.inv.q.trim().toLowerCase();
      const cats = [...new Set(all.map(i => i.category))].sort();
      const list = all.filter(i => (!q || `${i.name} ${i.category} ${i.supplier} ${i.location}`.toLowerCase().includes(q)) && (!f.inv.cat || i.category === f.inv.cat) && (!f.inv.status || store.stockStatus(i) === f.inv.status)).sort((a, b) => ({ out: 0, low: 1, ok: 2 }[store.stockStatus(a)] - { out: 0, low: 1, ok: 2 }[store.stockStatus(b)]) || a.name.localeCompare(b.name));
      const low = all.filter(i => store.stockStatus(i) !== 'ok').length;
      const top = head('Inventory', `${plural(all.length, 'item')}${low ? ` · <b class="rs-over">${low} low or out</b>` : ''}`, manage ? `<button class="btn btn--primary kids-yellow btn--sm" type="button" data-new-item>${icon('plus', 'icon--sm')}Add item</button>` : '');
      const filters = `<div class="rs-filters"><label class="sr-only" for="rs-iq">Search stock</label><input class="input" id="rs-iq" type="search" placeholder="Search stock" value="${esc(f.inv.q)}" data-f="inv.q">
        <label class="sr-only" for="rs-ic">Category</label><select class="input" id="rs-ic" data-f="inv.cat"><option value="">All categories</option>${cats.map(c => `<option${c === f.inv.cat ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <div class="segmented" role="group" aria-label="Stock status">${[['', 'All'], ['ok', 'OK'], ['low', 'Low'], ['out', 'Out']].map(([k, l]) => `<button type="button" data-inv-status="${k}" aria-pressed="${f.inv.status === k}">${l}</button>`).join('')}</div>${f.inv.q || f.inv.cat || f.inv.status ? reset('inv') : ''}</div>`;
      if (!all.length) return top + state('inbox', 'No stock items yet', 'Add consumables such as paper, soap and paint to track them.', manage ? `<button class="btn btn--primary kids-yellow" type="button" data-new-item>Add item</button>` : '');
      return top + filters + (list.length ? `<div class="rs-table rs-table--inv" role="table" aria-label="Inventory"><div class="rs-tr rs-tr--head" role="row"><span role="columnheader">Item</span><span role="columnheader">Category</span><span role="columnheader">On hand</span><span role="columnheader">Reorder at</span><span role="columnheader">Status</span><span role="columnheader">Updated</span><span role="columnheader"><span class="sr-only">Actions</span></span></div>
        ${list.map(i => { const st = store.stockStatus(i); return `<div class="rs-tr${focus === i.id ? ' is-focus' : ''}" role="row" id="inv-${esc(i.id)}"><span role="cell" class="rs-td--main"><b>${esc(i.name)}</b>${i.location ? `<small>${esc(i.location)}</small>` : ''}</span><span role="cell" data-label="Category">${esc(i.category)}</span><span role="cell" data-label="On hand"><b class="rs-qty">${i.qty}</b> ${esc(i.unit)}</span><span role="cell" data-label="Reorder at">${i.reorder}</span><span role="cell" data-label="Status">${chip(STOCK_TONE[st], STOCK_LABEL[st])}</span><span role="cell" data-label="Updated">${esc(fmt(String(i.updatedAt).slice(0, 10)))}</span><span role="cell" class="rs-td--act"><button class="btn btn--secondary btn--sm" type="button" data-adjust="${esc(i.id)}">Adjust stock</button><button class="btn btn--tertiary btn--sm" type="button" data-history="${esc(i.id)}">History</button>${manage ? `<button class="btn btn--tertiary btn--sm" type="button" data-edit-item="${esc(i.id)}" aria-label="Edit ${esc(i.name)}">${icon('pencil', 'icon--sm')}</button>` : ''}</span></div>`; }).join('')}</div>` : state('filter', 'No items match', 'Try another search or filter.', reset('inv')));
    }
    function adjustForm(id) {
      const it = store.getInventory().find(x => x.id === id);
      if (!it) return;
      const d = kids.dialog({
        label: 'Inventory / Adjust', title: `Adjust ${it.name}`, desc: `On hand: <b>${it.qty} ${esc(it.unit)}</b> · ${STOCK_LABEL[store.stockStatus(it)]} · reorder at ${it.reorder}`,
        body: `<div class="cls-form"><fieldset class="field"><legend class="field__label">Adjustment</legend><div class="cls-picks"><label class="cls-pick"><input type="radio" name="dir" value="add" checked><span><b>Add</b></span></label><label class="cls-pick"><input type="radio" name="dir" value="remove"><span><b>Remove</b></span></label></div></fieldset>
          <div class="cls-form__row">${kids.field('kd-amount', `Quantity (${it.unit})`, `<input class="input" id="kd-amount" name="amount" type="number" min="1" step="1" inputmode="numeric" required>`, { required: true })}
          ${kids.field('kd-reason', 'Reason', `<select class="input" id="kd-reason" name="reason" required><option value="">Choose…</option>${Object.entries(store.STOCK_REASONS).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select>`, { required: true })}</div>
          ${kids.field('kd-anotes', 'Notes', `<input class="input" id="kd-anotes" name="anotes" maxlength="300">`)}
          <p class="rs-preview" data-preview aria-live="polite"></p></div>`,
        submit: 'Save adjustment',
        async onSubmit(form) {
          const x = form.elements;
          const res = await store.adjustStock(store.currentUser(), it.id, { direction: form.querySelector('[name="dir"]:checked').value, amount: x.amount.value, reason: x.reason.value, notes: x.anotes.value });
          if (!res.ok) return res.errors ? { ok: false, errors: { ...res.errors, anotes: res.errors.notes } } : { ok: false, message: FAIL[res.reason] || FAIL.storage };
          window.NexoraToast?.show('Stock updated', `${res.item.name}: ${res.movement.before} → ${res.item.qty} ${res.item.unit} · ${STOCK_LABEL[res.status]}${res.alert ? ' · school leaders notified' : ''}`, res.status === 'ok' ? 'check-circle' : 'info');
          return res;
        }
      });
      const preview = () => {
        const n = Number(d.form.elements.amount.value);
        const box = d.form.querySelector('[data-preview]');
        if (!Number.isInteger(n) || n < 1) { box.textContent = ''; return; }
        const add = d.form.querySelector('[name="dir"]:checked').value === 'add';
        const after = add ? it.qty + n : it.qty - n;
        if (after < 0) { box.innerHTML = `${icon('alert-triangle', 'icon--sm')}Only ${it.qty} ${esc(it.unit)} in stock — you can’t remove ${n}.`; box.className = 'rs-preview is-bad'; return; }
        const st = after <= 0 ? 'out' : after <= it.reorder ? 'low' : 'ok';
        box.innerHTML = `New quantity: <b>${after} ${esc(it.unit)}</b> · ${STOCK_LABEL[st]}${st !== 'ok' && store.stockStatus(it) === 'ok' ? ' — school leaders will be notified' : ''}`;
        box.className = `rs-preview is-${st}`;
      };
      d.form.addEventListener('input', preview);
      d.form.addEventListener('change', preview);
    }
    function historyDialog(id) {
      const it = store.getInventory().find(x => x.id === id);
      const mv = store.getMovements().filter(m => m.itemId === id).sort((a, b) => b.at.localeCompare(a.at));
      kids.dialog({
        label: 'Inventory / History', title: it?.name || 'Stock history', desc: '',
        body: mv.length ? `<ul class="rs-list">${mv.map(m => `<li class="rs-row"><div class="rs-row__main"><b>${m.direction === 'add' ? '+' : '−'}${m.change} · ${m.before} → ${m.after}</b><small>${esc(m.reason === 'opening' ? 'Opening quantity' : store.STOCK_REASONS[m.reason])}${m.notes ? ` — ${esc(m.notes)}` : ''} · ${esc(new Date(m.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))} · ${esc(m.by)}</small></div></li>`).join('')}</ul>` : '<p class="cp-muted">No stock movements recorded yet.</p>',
        submit: 'Close', async onSubmit() { return { ok: true }; }
      });
    }
    function itemForm(it = null) {
      kids.dialog({
        label: 'Inventory', title: it ? `Edit ${it.name}` : 'Add stock item', desc: it ? 'To change the quantity, use Adjust stock so the change is recorded.' : '',
        body: `<div class="cls-form">${kids.field('kd-name', 'Item name', `<input class="input" id="kd-name" name="name" maxlength="80" required value="${esc(it?.name || '')}">`, { required: true })}
          <div class="cls-form__row">${kids.field('kd-category', 'Category', `<input class="input" id="kd-category" name="category" maxlength="40" required list="rs-cats" value="${esc(it?.category || '')}"><datalist id="rs-cats">${[...new Set(store.getInventory().map(i => i.category))].map(c => `<option value="${esc(c)}">`).join('')}</datalist>`, { required: true })}
          ${kids.field('kd-unit', 'Unit', `<select class="input" id="kd-unit" name="unit" required>${store.STOCK_UNITS.map(u => `<option${u === it?.unit ? ' selected' : ''}>${u}</option>`).join('')}</select>`, { required: true })}</div>
          <div class="cls-form__row">${it ? '' : kids.field('kd-qty', 'Opening quantity', `<input class="input" id="kd-qty" name="qty" type="number" min="0" step="1" required value="0">`, { required: true })}
          ${kids.field('kd-reorder', 'Reorder level', `<input class="input" id="kd-reorder" name="reorder" type="number" min="0" step="1" required value="${esc(it?.reorder ?? 0)}">`, { required: true })}</div>
          <div class="cls-form__row">${kids.field('kd-supplier', 'Supplier / reference', `<input class="input" id="kd-supplier" name="supplier" maxlength="80" value="${esc(it?.supplier || '')}">`)}${kids.field('kd-location', 'Storage location', `<input class="input" id="kd-location" name="location" maxlength="60" value="${esc(it?.location || '')}">`)}</div>
          ${kids.field('kd-inotes', 'Notes', `<input class="input" id="kd-inotes" name="inotes" maxlength="300" value="${esc(it?.notes || '')}">`)}</div>`,
        submit: it ? 'Save item' : 'Add item',
        async onSubmit(form) {
          const x = form.elements;
          const res = await store.saveInventoryItem(store.currentUser(), { name: x.name.value, category: x.category.value, unit: x.unit.value, qty: x.qty?.value, reorder: x.reorder.value, supplier: x.supplier.value, location: x.location.value, notes: x.inotes.value }, it?.id || null);
          if (!res.ok) return res.errors ? { ok: false, errors: res.errors } : { ok: false, message: FAIL[res.reason] || FAIL.storage };
          window.NexoraToast?.show(it ? 'Item saved' : 'Item added', `${res.item.name}${res.alert ? ' · low-stock alert sent to school leaders' : ''}`);
          return res;
        }
      });
    }

    /* ---------------------------------------------------------------- Paint + events */

    function paint() {
      if (!loaded) return;
      const panel = $('[data-panel]');
      panel.removeAttribute('aria-busy');
      main.querySelectorAll('[role="tab"]').forEach(b => { const on = b.dataset.tab === tab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
      panel.setAttribute('aria-labelledby', `rs-tab-${tab}`);
      panel.innerHTML = tab === 'rooms' ? roomsHtml() : tab === 'materials' ? materialsHtml() : tab === 'library' ? libraryHtml() : inventoryHtml();
      if (focus && tab === 'inventory') requestAnimationFrame(() => document.getElementById(`inv-${focus}`)?.scrollIntoView({ block: 'center' }));
    }
    function load() {
      loaded = false;
      setTimeout(() => {
        try {
          if (failOnce) { failOnce = false; throw new Error('test failure'); }
          loaded = true; syncUrl(); paint();
        } catch {
          $('[data-panel]').removeAttribute('aria-busy');
          $('[data-panel]').innerHTML = state('alert-circle', 'Something went wrong', 'We couldn’t load rooms and resources. Nothing has changed.', `<button class="btn btn--secondary" type="button" data-retry>${icon('refresh', 'icon--sm')}Try again</button>`, 'error');
        }
      }, reduceMotion.matches ? 0 : 300);
    }
    const setFilter = (path, value) => { const [k, p] = path.split('.'); f[k][p] = value; };
    main.addEventListener('click', e => {
      const t = e.target.closest('[role="tab"]');
      if (t) { tab = t.dataset.tab; focus = ''; syncUrl(); paint(); return; }
      if (e.target.closest('[data-retry]')) { load(); return; }
      const dd = e.target.closest('[data-day]');
      if (dd) { date = addDays(date, Number(dd.dataset.day)); syncUrl(); paint(); main.querySelector(`[data-day="${dd.dataset.day}"]`)?.focus(); return; }
      if (e.target.closest('[data-today]')) { date = today; syncUrl(); paint(); return; }
      const rs = e.target.closest('[data-reset]');
      if (rs) { const k = rs.dataset.reset; Object.keys(f[k]).forEach(p => { if (p !== 'sort') f[k][p] = ''; }); paint(); return; }
      const bk = e.target.closest('[data-book]');
      if (bk) { bookingForm({ roomId: bk.dataset.book, at: bk.dataset.at || '' }); return; }
      const bd = e.target.closest('[data-booking]');
      if (bd) { bookingDetails(bd.dataset.booking); return; }
      if (e.target.closest('[data-new-room]')) { roomForm(); return; }
      const er = e.target.closest('[data-edit-room]');
      if (er) { roomForm(store.roomById(er.dataset.editRoom)); return; }
      if (e.target.closest('[data-toggle-repairs]')) { showRepairs = !showRepairs; syncUrl(); paint(); return; }
      if (e.target.closest('[data-new-material]')) { materialForm(); return; }
      const em = e.target.closest('[data-edit-material]');
      if (em) { materialForm(store.getMaterials().find(m => m.id === em.dataset.editMaterial)); return; }
      const rp = e.target.closest('[data-repair]');
      if (rp) { repairForm(rp.dataset.repair); return; }
      const ls = e.target.closest('[data-lib-status]');
      if (ls) { f.lib.status = ls.dataset.libStatus; paint(); return; }
      const ln = e.target.closest('[data-lend]');
      if (ln) { lendForm(ln.dataset.lend); return; }
      const rt = e.target.closest('[data-return]');
      if (rt) { returnForm(rt.dataset.return); return; }
      if (e.target.closest('[data-new-book]')) { bookForm(); return; }
      const eb = e.target.closest('[data-edit-book]');
      if (eb) { bookForm(store.getBooks().find(b => b.id === eb.dataset.editBook)); return; }
      const is = e.target.closest('[data-inv-status]');
      if (is) { f.inv.status = is.dataset.invStatus; paint(); return; }
      const ad = e.target.closest('[data-adjust]');
      if (ad) { adjustForm(ad.dataset.adjust); return; }
      const hi = e.target.closest('[data-history]');
      if (hi) { historyDialog(hi.dataset.history); return; }
      if (e.target.closest('[data-new-item]')) { itemForm(); return; }
      const ei = e.target.closest('[data-edit-item]');
      if (ei) { itemForm(store.getInventory().find(i => i.id === ei.dataset.editItem)); }
    });
    main.addEventListener('change', e => { const el = e.target.closest('select[data-f]'); if (el) { setFilter(el.dataset.f, el.value); paint(); } });
    main.addEventListener('input', e => {
      const el = e.target.closest('input[data-f]');
      if (!el) return;
      setFilter(el.dataset.f, el.value);
      const id = el.id; const pos = el.selectionStart;
      paint();
      const again = main.querySelector(`#${id}`); if (again) { again.focus(); again.setSelectionRange(pos, pos); }
    });
    main.addEventListener('keydown', e => {
      const t = e.target.closest('[role="tab"]');
      if (!t) return;
      const keys = TABS.map(([k]) => k);
      const i = keys.indexOf(t.dataset.tab);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: keys.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      tab = keys[(to + keys.length) % keys.length]; syncUrl(); paint(); $(`#rs-tab-${tab}`)?.focus();
    });
    let queued = false;
    store.subscribe(({ key }) => {
      if (!loaded || (key && !/^nexora-(rooms|room-bookings|materials|repairs|books|loans|inventory|stock-movements|class-registry|children|settings|events|demo-role)/.test(key))) return;
      if (queued) return;
      queued = true;
      setTimeout(() => { queued = false; paint(); }, 0);
    });
    load();
  }

  window.NexoraResources = { render };
})();
