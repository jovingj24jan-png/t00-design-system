/* School Tours (app.html?page=tours[&week=YYYY-MM-DD][&day=YYYY-MM-DD][&tour=<bookingId>])
   Slots come from recurring patterns; every booking is linked to an admissions enquiry (S06/S07). The store checks
   capacity, guide clashes and enquiry state at the moment of saving (bookTour, rescheduleTour, markTourNoShow …).
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
  const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'this device';
  const STATE = { open: ['Open', 'calendar-check'], partial: ['Partly booked', 'users'], full: ['Full', 'lock'], completed: ['Completed', 'check'], cancelled: ['Cancelled', 'x'] };
  const B_TONE = { booked: 'info', attended: 'success', no_show: 'error', cancelled: 'neutral' };
  const FAIL = {
    forbidden: 'Your role or your school’s plan doesn’t allow this. Nothing was changed.',
    missing: 'This record no longer exists. Refresh the page.',
    locked: 'This tour has already been completed or cancelled.',
    storage: 'This couldn’t be saved on this device. Nothing was changed. Please try again.'
  };
  const failText = r => r.message || (r.errors && Object.values(r.errors)[0]) || FAIL[r.reason] || FAIL.storage;
  const chip = (tone, text, ic = '') => `<span class="badge badge--plain an-chip an-chip--${tone}">${ic ? icon(ic) : ''}${esc(text)}</span>`;
  const state = (iconName, title, text, action = '', tone = '') => `<div class="kids-empty an-state"${tone === 'error' ? ' role="alert"' : ''}><span class="state-icon${tone ? ` state-icon--${tone}` : ''}" aria-hidden="true">${icon(iconName)}</span><h2 class="kids-empty__title">${title}</h2><p>${text}</p>${action}</div>`;
  const guideName = id => store.users.find(u => u.id === id)?.name || 'No guide';
  const enq = id => store.getAdmissionEnquiries().find(e => e.id === id);
  const family = b => { const e = enq(b.enquiryId); return e ? `${e.parent.split(' ')[0]}’s family` : 'Family'; };
  const tourWhen = b => `${fmt(b.date)} · ${b.start}–${b.end}`;

  function render(key, main, user) {
    if (key !== 'tours') return false;
    page(main, user);
    return true;
  }

  function page(main, user) {
    const manage = store.canManageTours(user);
    let week = /^\d{4}-\d{2}-\d{2}$/.test(params.get('week') || '') ? mondayOf(params.get('week')) : mondayOf(store.today());
    let day = /^\d{4}-\d{2}-\d{2}$/.test(params.get('day') || '') ? params.get('day') : store.today();
    let upFilter = 'upcoming';
    let loaded = false;
    let failOnce = params.get('fail') === '1';
    let drawer = null;
    const me = () => store.currentUser();
    const cid = () => `cl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

    main.classList.add('kids-page');
    document.title = 'School Tours · Nexora';
    main.innerHTML = `<div class="kids tr">
      <header class="kids-head"><div class="kids-head__text"><nav class="kids-crumbs" aria-label="Breadcrumb"><a href="${routes.page('admissions')}">Admissions</a> / <span aria-current="page">Tours</span></nav><h1 class="kids-head__title" id="page-title" tabindex="-1">School Tours</h1><p class="kids-head__sub">Schedule visits, welcome prospective families, and track attendance.</p></div>
        ${manage ? `<div class="an-head__actions"><button class="btn btn--primary kids-yellow" type="button" data-manage>${icon('sliders', 'icon--sm')}Manage slots</button></div>` : ''}</header>
      <div class="tr-bar" data-bar></div>
      <div class="tr-grid"><section class="tr-cal" aria-label="Tour calendar" aria-busy="true" data-cal><span class="skeleton" style="display:block;height:420px;border-radius:var(--radius-lg)"></span></section>
        <aside class="panel tr-up" aria-labelledby="tr-up-h" data-up><h2 class="cd-h2" id="tr-up-h">Upcoming tours</h2><span class="skeleton" style="display:block;height:200px;border-radius:var(--radius-md)"></span></aside></div></div>`;
    const $ = s => main.querySelector(s);
    const syncUrl = () => { const u = new URL(location.href); week !== mondayOf(store.today()) ? u.searchParams.set('week', week) : u.searchParams.delete('week'); day !== store.today() ? u.searchParams.set('day', day) : u.searchParams.delete('day'); drawer?.kind === 'tour' ? u.searchParams.set('tour', drawer.id) : u.searchParams.delete('tour'); history.replaceState(null, '', u); };

    /* ---------------------------------------------------------------- Calendar */

    function slotLabel(s) {
      const names = s.bookings.filter(b => b.status !== 'cancelled').map(family);
      const left = s.capacity - s.booked;
      if (s.state === 'open') return `${s.start}–${s.end}, open, 0 of ${s.capacity} families booked, guide ${guideName(s.guideId)}. Book a tour`;
      if (s.state === 'partial') return `${s.start}–${s.end}, ${names.join(', ')}, ${left} of ${s.capacity} places left, guide ${guideName(s.guideId)}`;
      return `${s.start}–${s.end}, ${STATE[s.state][0]}${names.length ? `, ${names.join(', ')}` : ''}, guide ${guideName(s.guideId)}`;
    }
    function slotInner(s, compact) {
      const names = s.bookings.filter(b => b.status !== 'cancelled').map(family);
      if (s.state === 'open') return `<b>${esc(s.start)}–${esc(s.end)}</b><span>0/${s.capacity} families</span><span class="tr-g">${esc(guideName(s.guideId))}</span>`;
      if (s.state === 'cancelled') return `<b>${esc(s.start)}</b><span>${icon('x', 'icon--sm')}Cancelled</span>`;
      const lead = names[0] ? `${esc(names[0])}${names.length > 1 ? ` +${names.length - 1}` : ''}` : (s.state === 'completed' ? 'No bookings' : '');
      const tag = s.state === 'partial' ? `<i class="tr-left">${s.capacity - s.booked} left</i>` : s.state === 'full' ? `<i class="tr-left is-full">${icon('lock', 'icon--sm')}Full</i>` : s.state === 'completed' ? `<i class="tr-left is-done">${icon('check', 'icon--sm')}Done</i>` : '';
      return compact ? `<b>${esc(s.start)}–${esc(s.end)}</b><span class="tr-fam">${lead}</span><span>${s.state === 'completed' ? '' : `${s.booked}/${s.capacity} `}${tag}</span>`
        : `<b>${esc(s.start)}–${esc(s.end)} · ${lead}</b><span>${s.state === 'completed' ? '' : `${s.booked}/${s.capacity} · `}${esc(guideName(s.guideId))}</span>${tag}`;
    }
    const slotBtn = (s, style = '', compact = false) => {
      const cls = `tr-slot is-${s.state}`;
      const clickable = s.state === 'open' ? manage : s.bookings.length || ['partial', 'full'].includes(s.state);
      return clickable ? `<button class="${cls}" type="button" data-slot="${esc(s.id)}" style="${style}" aria-label="${esc(slotLabel(s))}">${slotInner(s, compact)}</button>` : `<span class="${cls}" style="${style}" role="img" aria-label="${esc(slotLabel(s))}">${slotInner(s, compact)}</span>`;
    };
    function calendar() {
      const all = store.tourSlots(user, {});
      const anyFuture = all.some(s => s.state !== 'cancelled' && s.state !== 'completed');
      const empty = !all.some(s => s.status === 'active') ? state('calendar-check', 'No tour slots available', 'Create a recurring slot pattern to make tours bookable.', manage ? '<button class="btn btn--primary kids-yellow" type="button" data-manage>Manage slots</button>' : '') : '';
      if (mobileQ.matches) {
        const slots = store.tourSlots(user, { from: day, to: day });
        const sd = store.schoolDay(day);
        $('[data-bar]').innerHTML = `<div class="rs-datenav tr-nav"><button class="btn btn--icon-ghost" type="button" data-day="-1" aria-label="Previous day">${icon('arrow-left')}</button><b class="rs-datenav__label" aria-live="polite">${esc(fmt(day, { weekday: 'long', day: 'numeric', month: 'short' }))}${day === store.today() ? ' · Today' : ''}</b><button class="btn btn--icon-ghost" type="button" data-day="1" aria-label="Next day">${icon('arrow-right')}</button><button class="btn btn--tertiary btn--sm" type="button" data-today>Today</button></div><p class="cp-muted tr-tz">Times in ${esc(TZ)}</p>`;
        if (empty) return empty;
        return slots.length ? `<ul class="tr-daylist">${slots.map(s => `<li>${slotBtn(s, '', false)}</li>`).join('')}</ul>` : state('calendar-check', sd.open ? 'No tour slots this day' : `Closed — ${esc(sd.name)}`, anyFuture ? 'Try another day.' : 'Create a recurring slot pattern to make tours bookable.', !anyFuture && manage ? '<button class="btn btn--primary kids-yellow" type="button" data-manage>Manage slots</button>' : '');
      }
      const end = addDays(week, 6);
      $('[data-bar]').innerHTML = `<div class="rs-datenav tr-nav"><button class="btn btn--icon-ghost" type="button" data-week="-1" aria-label="Previous week">${icon('arrow-left')}</button><b class="rs-datenav__label" aria-live="polite">${esc(fmt(week, { day: 'numeric', month: 'short' }))} – ${esc(fmt(end, { day: 'numeric', month: 'short', year: 'numeric' }))}</b><button class="btn btn--icon-ghost" type="button" data-week="1" aria-label="Next week">${icon('arrow-right')}</button><button class="btn btn--tertiary btn--sm" type="button" data-today>Today</button></div>
        <ul class="pt-legend tr-legend" aria-label="Legend"><li><i class="tr-key is-open"></i>Open</li><li><i class="tr-key is-booked"></i>Booked</li><li><i class="tr-key is-completed"></i>Completed</li></ul><p class="cp-muted tr-tz">Times in ${esc(TZ)}</p>`;
      if (empty) return empty;
      const slots = store.tourSlots(user, { from: week, to: end });
      const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
      // Only the hours that have slots (at least four), so blocks are tall enough to read.
      const lo = slots.length ? Math.min(...slots.map(s => mins(s.start))) : 9 * 60;
      const hi = slots.length ? Math.max(...slots.map(s => mins(s.end))) : 13 * 60;
      const top = Math.floor(lo / 60) * 60;
      const bottom = Math.max(top + 240, Math.ceil(hi / 60) * 60);
      const PX = 2.4;
      const cols = `52px ${days.map(d => (store.schoolDay(d).open || slots.some(s => s.date === d) ? 'minmax(112px, 1fr)' : 'minmax(56px, 0.45fr)')).join(' ')}`;
      const minW = 52 + days.reduce((n, d) => n + (store.schoolDay(d).open || slots.some(s => s.date === d) ? 112 : 56), 0);
      const hours = [];
      for (let m = top; m < bottom; m += 60) hours.push(m);
      return `<div class="tr-week" role="region" aria-label="Week of ${esc(fmt(week, { day: 'numeric', month: 'long' }))}" tabindex="0" style="--tr-h:${(bottom - top) * PX}px;--tr-cols:${cols};--tr-minw:${minW}px">
        <div class="tr-week__head"><span aria-hidden="true"></span>${days.map(d => { const sd = store.schoolDay(d); return `<span class="${d === store.today() ? 'is-today' : ''}">${esc(fmt(d))}${!sd.open ? `<small>${esc(sd.kind === 'holiday' ? sd.name : 'Closed')}</small>` : ''}</span>`; }).join('')}</div>
        <div class="tr-week__body"><div class="tr-axis" aria-hidden="true">${hours.map(m => `<span style="top:${(m - top) * PX}px">${pad(m / 60)}:00</span>`).join('')}</div>
          ${days.map(d => `<div class="tr-day${store.schoolDay(d).open ? '' : ' is-closed'}" aria-label="${esc(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }))}" role="group">${hours.map(m => `<i class="tr-line" style="top:${(m - top) * PX}px" aria-hidden="true"></i>`).join('')}${slots.filter(s => s.date === d).map(s => slotBtn(s, `top:${(mins(s.start) - top) * PX}px;height:${Math.max(22, (mins(s.end) - mins(s.start)) * PX - 3)}px`, true)).join('')}</div>`).join('')}
        </div></div>`;
    }

    /* ---------------------------------------------------------------- Upcoming */

    function upcoming() {
      const now = Date.now();
      const all = store.tourBookings(user);
      const slotsById = Object.fromEntries(store.tourSlots(user, {}).map(s => [s.id, s]));
      const needs = b => (b.status === 'booked' && new Date(`${b.date}T${b.end}:00`).getTime() <= now) || (b.status === 'no_show' && (enq(b.enquiryId)?.tasks || []).some(t => t.id === b.followTaskId && t.status === 'open'));
      const rows = upFilter === 'upcoming' ? all.filter(b => b.status === 'booked' && new Date(`${b.date}T${b.end}:00`).getTime() > now)
        : upFilter === 'follow' ? all.filter(needs) : all.slice().reverse();
      const counts = { upcoming: all.filter(b => b.status === 'booked' && new Date(`${b.date}T${b.end}:00`).getTime() > now).length, follow: all.filter(needs).length, all: all.length };
      const filt = `<div class="segmented tr-filter" role="group" aria-label="Show">${[['upcoming', 'Upcoming'], ['follow', 'Needs follow-up'], ['all', 'All']].map(([k, l]) => `<button type="button" aria-pressed="${upFilter === k}" data-upf="${k}">${l} <span class="tr-n">${counts[k]}</span></button>`).join('')}</div>`;
      const item = b => { const e = enq(b.enquiryId); const s = slotsById[b.slotId]; const st = b.status === 'booked' && new Date(`${b.date}T${b.end}:00`).getTime() <= now ? ['warning', 'Record attendance', 'clock'] : [B_TONE[b.status], store.TOUR_STATUSES[b.status], b.status === 'attended' ? 'check' : b.status === 'no_show' ? 'alert-triangle' : b.status === 'cancelled' ? 'x' : 'calendar-check'];
        return `<li><button class="tr-item" type="button" data-tour="${esc(b.id)}"><span class="tr-item__when"><b>${esc(b.start)}</b><small>${esc(fmt(b.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</small></span><span class="tr-item__who"><b>${esc(e?.parent || 'Family')}</b><small>${esc(e?.child || '')} · ${esc(guideName(b.guideId))}</small>${chip(st[0], st[1], st[2])}${s && b.status === 'booked' && s.capacity > 1 ? `<small>${s.booked}/${s.capacity} in this slot</small>` : ''}</span></button></li>`; };
      return `<h2 class="cd-h2" id="tr-up-h">Upcoming tours</h2>${filt}${rows.length ? `<ul class="tr-list">${rows.map(item).join('')}</ul>` : upFilter === 'upcoming' ? `<div class="s7-empty"><p class="kids-empty__title">No upcoming tours</p><p class="cp-muted">Available tour slots will appear on the calendar. Book a slot to get started.</p></div>` : `<p class="cp-muted">${upFilter === 'follow' ? 'Nothing needs follow-up.' : 'No tours yet.'}</p>`}`;
    }
    function paint() {
      const fid = document.activeElement && main.contains(document.activeElement) ? document.activeElement.id || document.activeElement.dataset.slot : '';
      const cal = $('[data-cal]');
      cal.removeAttribute('aria-busy');
      cal.innerHTML = calendar();
      $('[data-up]').innerHTML = upcoming();
      if (fid) (main.querySelector(`#${CSS.escape(fid)}`) || main.querySelector(`[data-slot="${CSS.escape(fid)}"]`))?.focus();
      drawer?.refresh();
    }

    /* ---------------------------------------------------------------- Book a tour */

    function bookDialog(slotId) {
      const s = store.tourSlots(user, {}).find(x => x.id === slotId);
      if (!s) return;
      const clientId = cid();
      const enqClient = cid();
      let mode = 'existing';
      let picked = '';
      let created = null;
      let confirmSibling = false;
      let step = 1;
      let timer = null;
      const d = kids.dialog({
        label: 'School tours', title: 'Book a tour',
        desc: `${esc(fmt(s.date, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${esc(s.start)}–${esc(s.end)} · ${esc(guideName(s.guideId))} · <b>${s.capacity - s.booked} of ${s.capacity} places left</b>`,
        body: `<div class="tr-book"><div data-s1>
            <div class="segmented segmented--block" role="group" aria-label="Family">${[['existing', 'Link an existing enquiry'], ['new', 'Create new enquiry']].map(([k, l]) => `<button type="button" aria-pressed="${k === mode}" data-mode="${k}">${l}</button>`).join('')}</div>
            <div data-existing><div class="an-search an-search--block">${icon('search', 'icon--sm')}<label class="sr-only" for="tr-q">Search enquiries</label><input class="input" id="tr-q" type="search" placeholder="Child, parent, phone or email" autocomplete="off"></div><ul class="an-plist tr-res" data-res role="radiogroup" aria-label="Enquiries"><li class="cp-muted an-plist__none">Type at least 2 characters to search.</li></ul><p class="field__hint field__hint--error" data-error-for="enquiry" hidden></p></div>
            <div data-new hidden><div class="cls-form">
              <div class="cls-form__row">${kids.field('kd-child', 'Child’s name', '<input class="input" id="kd-child" name="child" maxlength="80">', { required: true })}${kids.field('kd-parent', 'Parent or guardian', '<input class="input" id="kd-parent" name="parent" maxlength="80">', { required: true })}</div>
              <div class="cls-form__row">${kids.field('kd-phone', 'Phone', '<input class="input" id="kd-phone" name="phone" type="tel" inputmode="tel" maxlength="24">', { required: true })}${kids.field('kd-email', 'Email', '<input class="input" id="kd-email" name="email" type="email" maxlength="120">')}</div>
              <div class="cls-form__row">${kids.field('kd-programme', 'Programme', `<select class="input" id="kd-programme" name="programme"><option value="">Choose…</option>${store.CLASS_LEVELS.map(l => `<option>${esc(l)}</option>`).join('')}</select>`, { required: true })}${kids.field('kd-preferredStart', 'Preferred start', `<input class="input" id="kd-preferredStart" name="preferredStart" type="date" min="${store.today()}">`, { required: true })}</div>
              <div class="tr-dup" data-dup hidden></div></div></div>
            ${kids.field('kd-tnotes', 'Notes for the tour (optional)', '<textarea class="input" id="kd-tnotes" name="tnotes" rows="2" maxlength="500"></textarea>')}
          </div><div data-s2 hidden></div>
          <div class="tr-full" data-full hidden></div></div>`,
        submit: 'Review booking',
        async onSubmit(form) {
          const fullBox = form.querySelector('[data-full]');
          fullBox.hidden = true;
          const slotNow = store.tourSlots(user, {}).find(x => x.id === slotId);
          if (step === 1) {
            if (slotNow.state === 'full' || slotNow.state === 'completed' || slotNow.state === 'cancelled') return showFull(form, slotNow.state === 'full' ? 'This tour slot is full.' : 'This slot is no longer available.');
            let fam;
            if (mode === 'existing') { if (!picked) return { ok: false, errors: { enquiry: 'Choose an enquiry to link.' } }; const e = enq(picked); fam = `${e.child} · ${e.parent} · ${store.ENQUIRY_STAGES[e.stage]}`; }
            else {
              const v = n => form.elements[n].value.trim();
              const errs = {};
              if (!v('child')) errs.child = 'Enter the child’s name.';
              if (!v('parent')) errs.parent = 'Enter the parent or guardian’s name.';
              if (v('phone').replace(/\D/g, '').length < 7) errs.phone = 'Enter a phone number.';
              if (!v('programme')) errs.programme = 'Choose a programme.';
              if (!v('preferredStart')) errs.preferredStart = 'Choose the preferred start.';
              if (Object.keys(errs).length) return { ok: false, errors: errs };
              const dup = store.enquiryDuplicates({ phone: v('phone'), email: v('email'), child: v('child') });
              if ((dup.enquiries.length || dup.families.length) && !confirmSibling && !created) return showDup(form, dup);
              fam = `${v('child')} · ${v('parent')} · new enquiry`;
            }
            step = 2;
            form.querySelector('[data-s1]').hidden = true;
            const s2 = form.querySelector('[data-s2]');
            s2.hidden = false;
            s2.innerHTML = `<h3 class="an-c-h" tabindex="-1">Confirm the booking</h3><dl class="an-review"><div><dt>Family</dt><dd>${esc(fam)}</dd></div><div><dt>Date</dt><dd>${esc(fmt(slotNow.date, { weekday: 'long', day: 'numeric', month: 'long' }))}</dd></div><div><dt>Time</dt><dd>${esc(slotNow.start)}–${esc(slotNow.end)}</dd></div><div><dt>Guide</dt><dd>${esc(guideName(slotNow.guideId))}</dd></div><div><dt>Booked</dt><dd>${slotNow.booked} of ${slotNow.capacity} families</dd></div></dl>
              <p class="cd-note">The enquiry moves to <b>Tour booked</b> (if it’s still at Enquiry) and the visit is added to its timeline.</p><button class="btn btn--tertiary btn--sm" type="button" data-back>${icon('arrow-left', 'icon--sm')}Change details</button>`;
            s2.querySelector('[data-back]').addEventListener('click', () => { step = 1; form.querySelector('[data-s1]').hidden = false; s2.hidden = true; form.querySelector('[type="submit"]').textContent = 'Review booking'; });
            s2.querySelector('h3').focus();
            return { keepOpen: true, submitLabel: 'Confirm booking' };
          }
          let enquiryId = picked;
          if (mode === 'new') {
            if (!created) {
              const r = await store.createEnquiry(me(), { child: form.elements.child.value, parent: form.elements.parent.value, phone: form.elements.phone.value, email: form.elements.email.value, programme: form.elements.programme.value, preferredStart: form.elements.preferredStart.value, source: 'other', notes: 'Created while booking a school tour' }, { confirmSibling, clientId: enqClient });
              if (!r.ok) { step = 1; form.querySelector('[data-s1]').hidden = false; form.querySelector('[data-s2]').hidden = true; if (r.reason === 'duplicate') return showDup(form, r.duplicates, r.blocking); return r.errors ? { ok: false, errors: r.errors } : { ok: false, message: failText(r) }; }
              created = r.enquiry;
            }
            enquiryId = created.id;
          }
          const r = await store.bookTour(me(), { slotId, enquiryId, notes: form.elements.tnotes.value, clientId });
          if (!r.ok) {
            if (['full', 'past', 'cancelled', 'guide'].includes(r.reason)) return showFull(form, r.message, created);
            return r.errors ? { ok: false, errors: r.errors } : { ok: false, message: failText(r) };
          }
          toast('Tour booked', `${enq(enquiryId).child} · ${tourWhen(r.booking)}${r.moved ? ' · stage: Tour booked' : ''}`, 'check-circle', { action: { label: 'Open', onClick: () => openTour(r.booking.id) } });
          paint();
          return { ok: true };
        }
      });
      const f = d.form;
      function showFull(form, msg, createdEnq) {
        const box = form.querySelector('[data-full]');
        box.hidden = false;
        const others = store.tourSlots(user, { from: store.today() }).filter(x => ['open', 'partial'].includes(x.state) && x.id !== slotId).slice(0, 4);
        box.innerHTML = `<div class="tr-full__box" role="alert"><p><b>${esc(msg.split('.')[0])}.</b> ${esc(msg.split('.').slice(1).join('.').trim() || 'Choose another available time to continue.')}</p>${createdEnq ? `<p class="cd-note">The new enquiry for ${esc(createdEnq.child)} was saved — choose another slot and link it from “existing enquiry”.</p>` : ''}${others.length ? `<p class="cd-note">Next open times:</p><ul class="tr-alt">${others.map(x => `<li><button class="btn btn--secondary btn--sm" type="button" data-alt="${esc(x.id)}">${esc(fmt(x.date))} ${esc(x.start)} · ${x.capacity - x.booked} left</button></li>`).join('')}</ul>` : ''}<button class="btn btn--tertiary btn--sm" type="button" data-tocal>Back to the calendar</button></div>`;
        box.querySelectorAll('[data-alt]').forEach(b => b.addEventListener('click', () => { d.close(); setTimeout(() => bookDialog(b.dataset.alt), 200); }));
        box.querySelector('[data-tocal]').addEventListener('click', () => d.close());
        box.querySelector('button')?.focus();
        return { keepOpen: true, submitLabel: step === 2 ? 'Confirm booking' : 'Review booking' };
      }
      function showDup(form, dup, blocking = null) {
        const box = form.querySelector('[data-dup]');
        const block = blocking ?? (dup.enquiries.some(x => x.sameChild) || dup.families.some(x => x.sameChild));
        box.hidden = false;
        box.innerHTML = `<div class="ad-dup__box" role="alert"><p class="ad-dup__t">${icon('alert-triangle', 'icon--sm')}${block ? 'This child already has an enquiry with this phone or email.' : 'This phone or email belongs to another enquiry or family.'}</p><ul>${dup.enquiries.map(x => `<li><b>${esc(x.child)}</b> · ${esc(store.ENQUIRY_STAGES[x.stage])} <button class="btn btn--tertiary btn--sm" type="button" data-useenq="${esc(x.id)}">Use this enquiry</button></li>`).join('')}${dup.families.map(x => `<li><b>${esc(x.name)}</b> (at school: ${esc(x.children.join(', '))})</li>`).join('')}</ul>${block ? '' : '<label class="fb-check"><input type="checkbox" data-sib><span><b>This is a different child (a sibling)</b><small>Create a separate enquiry.</small></span></label>'}</div>`;
        box.querySelectorAll('[data-useenq]').forEach(b => b.addEventListener('click', () => { mode = 'existing'; picked = b.dataset.useenq; setMode(); const q = f.querySelector('#tr-q'); q.value = enq(picked).child; search(); }));
        box.querySelector('[data-sib]')?.addEventListener('change', ev => { confirmSibling = ev.target.checked; });
        return { keepOpen: true, submitLabel: 'Review booking' };
      }
      const setMode = () => { f.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode))); f.querySelector('[data-existing]').hidden = mode !== 'existing'; f.querySelector('[data-new]').hidden = mode !== 'new'; };
      function search() {
        const q = f.querySelector('#tr-q').value.trim();
        const ql = q.toLowerCase();
        const qd = q.replace(/\D/g, '');
        const box = f.querySelector('[data-res]');
        if (q.length < 2) { box.innerHTML = '<li class="cp-muted an-plist__none">Type at least 2 characters to search.</li>'; return; }
        const rows = store.getAdmissionEnquiries().filter(e => `${e.child} ${e.parent} ${e.email}`.toLowerCase().includes(ql) || (qd.length >= 4 && String(e.phone).replace(/\D/g, '').includes(qd))).slice(0, 10);
        box.innerHTML = rows.map(e => { const off = e.stage === 'enrolled' || e.stage === 'lost'; return `<li><label class="an-prow${off ? ' is-off' : ''}"><input type="radio" name="tenq" value="${esc(e.id)}"${picked === e.id ? ' checked' : ''}${off ? ' disabled' : ''}><span class="an-prow__txt"><b>${esc(e.child)}</b><small>${esc(e.parent)} · ${esc(e.programme)} · ${esc(store.ENQUIRY_STAGES[e.stage])}${off ? ` — ${e.stage === 'enrolled' ? 'already enrolled' : 'reopen in Admissions first'}` : ''} · ${esc(e.phone)}</small></span></label></li>`; }).join('') || '<li class="cp-muted an-plist__none">No enquiries match. Try a phone number, or create a new enquiry.</li>';
      }
      f.addEventListener('click', ev => { const m = ev.target.closest('[data-mode]'); if (m) { mode = m.dataset.mode; setMode(); (mode === 'new' ? f.querySelector('#kd-child') : f.querySelector('#tr-q')).focus(); } });
      f.addEventListener('input', ev => { if (ev.target.id === 'tr-q') { clearTimeout(timer); timer = setTimeout(search, 200); } if (['phone', 'email', 'child'].includes(ev.target.name)) { confirmSibling = false; f.querySelector('[data-dup]').hidden = true; } });
      f.addEventListener('change', ev => { if (ev.target.name === 'tenq') picked = ev.target.value; });
      f.querySelector('#tr-q').focus();
    }

    /* ---------------------------------------------------------------- Drawers */

    function shell(kind, id, title, opener) {
      drawer?.close(false);
      const el = document.createElement('dialog');
      el.className = 'drawer an-drawer tr-drawer';
      el.setAttribute('aria-labelledby', 'tr-d-title');
      el.innerHTML = `<div class="drawer__panel"><div class="drawer__head"><h2 id="tr-d-title">${esc(title)}</h2><button class="btn btn--icon-ghost" type="button" aria-label="Close" data-close>${icon('x')}</button></div><div class="drawer__body" data-body></div><div class="drawer__foot" data-foot></div></div>`;
      document.body.appendChild(el);
      const close = (restore = true) => { if (!el.isConnected || el.classList.contains('is-closing')) return; el.classList.add('is-closing'); drawer = null; syncUrl(); const done = () => { el.close(); el.remove(); if (restore && opener && document.contains(opener)) opener.focus(); }; reduceMotion.matches ? done() : setTimeout(done, 170); };
      el.addEventListener('cancel', e => { e.preventDefault(); close(); });
      el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-close]')) close(); });
      return { el, close, body: el.querySelector('[data-body]'), foot: el.querySelector('[data-foot]') };
    }
    function openSlot(slotId, opener = document.activeElement) {
      const s0 = store.tourSlots(user, {}).find(x => x.id === slotId);
      if (!s0) return;
      if (s0.state === 'open') { if (manage) bookDialog(slotId); return; }
      const d = shell('slot', slotId, 'Tour slot', opener);
      const refresh = () => {
        const s = store.tourSlots(user, {}).find(x => x.id === slotId);
        const cancelled = store.tourBookings(user).filter(b => b.slotId === slotId && b.status === 'cancelled').length;
        d.body.innerHTML = `<div class="an-d-top"><div class="an-tags">${chip(s.state === 'full' ? 'error' : s.state === 'completed' ? 'success' : s.state === 'cancelled' ? 'neutral' : 'warning', STATE[s.state][0], STATE[s.state][1])}</div><h3 class="an-d-title">${esc(fmt(s.date, { weekday: 'long', day: 'numeric', month: 'long' }))}</h3><p class="cp-muted">${esc(s.start)}–${esc(s.end)} · ${esc(guideName(s.guideId))} · ${s.booked} of ${s.capacity} families</p></div>
          <ul class="tr-list">${s.bookings.map(b => { const e = enq(b.enquiryId); return `<li><button class="tr-item" type="button" data-tour="${esc(b.id)}"><span class="tr-item__who"><b>${esc(e?.parent || 'Family')}</b><small>${esc(e?.child || '')}</small>${chip(B_TONE[b.status], store.TOUR_STATUSES[b.status])}</span></button></li>`; }).join('') || '<li class="cp-muted">No families booked.</li>'}</ul>${cancelled ? `<p class="cd-note">${plural(cancelled, 'cancelled booking')} kept in history.</p>` : ''}`;
        d.foot.innerHTML = manage && ['open', 'partial'].includes(s.state) ? `<button class="btn btn--primary kids-yellow" type="button" data-bookslot>${icon('plus', 'icon--sm')}Book a family</button>` : '';
        d.foot.hidden = !d.foot.innerHTML;
      };
      d.el.addEventListener('click', e => { const t = e.target.closest('[data-tour]'); if (t) { openTour(t.dataset.tour); return; } if (e.target.closest('[data-bookslot]')) { d.close(false); setTimeout(() => bookDialog(slotId), 180); } });
      d.el.showModal();
      drawer = { kind: 'slot', id: slotId, close: d.close, refresh };
      refresh();
      d.el.querySelector('[data-close]').focus();
    }
    function openTour(id, opener = document.activeElement) {
      const d = shell('tour', id, 'Tour details', opener);
      const refresh = () => {
        const b = store.tourBookings(user).find(x => x.id === id);
        if (!b) { d.body.innerHTML = state('calendar-check', 'Tour not found', 'It may have been removed.'); d.foot.innerHTML = ''; return; }
        const e = enq(b.enquiryId);
        const task = e?.tasks?.find(t => t.id === b.followTaskId);
        const started = new Date(`${b.date}T${b.start}:00`).getTime() <= Date.now();
        const dayOf = b.date <= store.today();
        d.body.innerHTML = `<div class="an-d-top"><div class="an-tags">${chip(B_TONE[b.status], store.TOUR_STATUSES[b.status], b.status === 'attended' ? 'check' : b.status === 'no_show' ? 'alert-triangle' : b.status === 'cancelled' ? 'x' : 'calendar-check')}${b.demo ? '<span class="fm-demo">Demo sample</span>' : ''}</div><h3 class="an-d-title">${esc(e?.parent || 'Family')}</h3><p class="cp-muted">${esc(e?.child || '')}${e ? ` · <a href="${routes.page('admissions', { applicant: e.id })}">Enquiry ${esc(e.id)}</a> · ${esc(store.ENQUIRY_STAGES[e.stage])}` : ''}</p></div>
          <dl class="token-sheet an-d-meta"><div><dt>Date</dt><dd>${esc(fmt(b.date, { weekday: 'long', day: 'numeric', month: 'long' }))}</dd></div><div><dt>Time</dt><dd>${esc(b.start)}–${esc(b.end)}</dd></div><div><dt>Guide</dt><dd>${esc(guideName(b.guideId))}</dd></div><div><dt>Booked</dt><dd>${esc(when(b.createdAt))} by ${esc(b.createdBy)}</dd></div>
            ${b.status === 'attended' ? `<div><dt>Attended</dt><dd>${esc(when(b.attendedAt))} · recorded by ${esc(b.attendedBy)}</dd></div>` : ''}${b.status === 'no_show' ? `<div><dt>No-show</dt><dd>${esc(when(b.noShowAt))} · recorded by ${esc(b.noShowBy)}</dd></div>` : ''}${b.status === 'cancelled' ? `<div><dt>Cancelled</dt><dd>${esc(when(b.cancelledAt))} by ${esc(b.cancelledBy)}${b.cancelReason ? ` — ${esc(b.cancelReason)}` : ''}</dd></div>` : ''}</dl>
          ${b.notes ? `<p class="pt-text ad-notes">${esc(b.notes)}</p>` : ''}
          ${task ? `<div class="an-mine${task.status === 'done' ? ' is-done' : ''}">${icon(task.status === 'done' ? 'check-circle' : 'list', 'icon--sm')}<span>Follow-up: ${esc(task.title)} — due ${esc(fmt(task.due))} · ${esc(guideName(task.assigneeId))} · ${task.status === 'done' ? 'completed' : 'open'}</span><a class="btn btn--tertiary btn--sm" href="${routes.page('admissions', { applicant: e.id, tab: 'tasks' })}">Open</a></div>` : ''}
          ${(b.moves || []).length ? `<section class="an-d-sec"><h3 class="cd-qv-h">Reschedule history</h3><ul class="pt-log">${b.moves.map(m => `<li>${esc(tourWhen(m.from))} → moved ${esc(when(m.at))} by ${esc(m.by)}${m.reason ? ` (${esc(m.reason)})` : ''}</li>`).join('')}</ul></section>` : ''}
          ${b.status === 'booked' && !dayOf ? '<p class="cd-note">Attendance can be recorded from the day of the tour.</p>' : ''}`;
        const acts = [];
        if (manage && b.status === 'booked') {
          if (dayOf) acts.push(`<button class="btn btn--primary kids-yellow" type="button" data-attended>${icon('check', 'icon--sm')}Mark attended</button><button class="btn btn--secondary" type="button" data-noshow>${icon('alert-triangle', 'icon--sm')}No-show</button>`);
          if (!started) acts.push(`<button class="btn btn--secondary" type="button" data-resched>${icon('refresh', 'icon--sm')}Reschedule</button><button class="btn btn--tertiary is-danger" type="button" data-cancel>${icon('x', 'icon--sm')}Cancel</button>`);
        }
        d.foot.innerHTML = acts.join('');
        d.foot.hidden = !d.foot.innerHTML;
      };
      d.el.addEventListener('click', e => {
        const b = store.tourBookings(user).find(x => x.id === id);
        if (!b) return;
        if (e.target.closest('[data-attended]')) attendedDialog(b);
        else if (e.target.closest('[data-noshow]')) noShowDialog(b);
        else if (e.target.closest('[data-resched]')) rescheduleDialog(b);
        else if (e.target.closest('[data-cancel]')) cancelDialog(b);
      });
      d.el.showModal();
      drawer = { kind: 'tour', id, close: d.close, refresh };
      syncUrl();
      refresh();
      d.el.querySelector('[data-close]').focus();
    }
    const confirm = (o, run) => kids.dialog({ ...o, body: o.body || '', async onSubmit(form) { const r = await run(form); if (r.ok) paint(); return r.ok ? { ok: true } : r.errors ? { ok: false, errors: r.errors } : { ok: false, message: failText(r) }; } });
    function attendedDialog(b) {
      const e = enq(b.enquiryId);
      confirm({ label: 'School tours', title: 'Mark as attended?', desc: `${esc(e?.parent || 'Family')} · ${esc(tourWhen(b))}. This is recorded in ${esc(e?.child || 'the applicant')}’s timeline. It doesn’t enrol the child.`, submit: 'Mark attended' },
        async () => { const r = await store.markTourAttended(me(), b.id); if (r.ok) toast('Attendance recorded', `${e?.child || ''} attended`, 'check-circle'); return r; });
    }
    function noShowDialog(b) {
      const e = enq(b.enquiryId);
      const owners = store.tourGuides();
      confirm({ label: 'School tours', title: 'Record a no-show?', desc: `${esc(e?.parent || 'Family')} · ${esc(tourWhen(b))}. A follow-up task <b>Follow up after missed school tour</b> is created once and the assignee is notified in Nexora.`,
        body: `<div class="cls-form__row">${kids.field('kd-due', 'Follow-up due', `<input class="input" type="date" id="kd-due" name="due" required min="${store.today()}" value="${addDays(store.today(), 1)}">`, { required: true })}${kids.field('kd-assigneeId', 'Assign to', `<select class="input" id="kd-assigneeId" name="assigneeId">${owners.map(o => `<option value="${esc(o.id)}"${o.id === (e?.ownerId || user.id) ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}</select>`)}</div>`,
        submit: 'Record no-show' },
      async form => { const r = await store.markTourNoShow(me(), b.id, { due: form.elements.due.value, assigneeId: form.elements.assigneeId.value }); if (r.ok) toast('No-show recorded', r.task ? `Follow-up created for ${guideName(r.task.assigneeId)}.` : 'Follow-up already exists.', 'alert-triangle'); return r.ok ? r : { ...r, errors: r.errors ? { due: r.errors.due, assigneeId: r.errors.assigneeId } : undefined }; });
    }
    function cancelDialog(b) {
      const e = enq(b.enquiryId);
      confirm({ label: 'School tours', title: 'Cancel this tour?', danger: true, desc: `<b>${esc(e?.parent || 'Family')}</b> (${esc(e?.child || '')}) · ${esc(tourWhen(b))} · ${esc(guideName(b.guideId))}. The booking is kept as Cancelled and the place is freed. The enquiry’s stage doesn’t change. No message is sent to the family (no email or SMS service is connected).`,
        body: kids.field('kd-reason', 'Reason (optional)', '<input class="input" id="kd-reason" name="reason" maxlength="200">'), submit: 'Cancel tour' },
      async form => { const r = await store.cancelTour(me(), b.id, { reason: form.elements.reason.value }); if (r.ok) toast('Tour cancelled', 'The place is free again.', 'x'); return r; });
    }
    function rescheduleDialog(b) {
      const e = enq(b.enquiryId);
      const opts = dte => store.tourSlots(user, { from: dte, to: dte }).filter(s => s.id !== b.slotId && ['open', 'partial'].includes(s.state));
      const firstDay = store.tourSlots(user, { from: store.today() }).find(s => s.id !== b.slotId && ['open', 'partial'].includes(s.state))?.date || store.today();
      const d = kids.dialog({ label: 'School tours', title: 'Reschedule tour', desc: `${esc(e?.parent || 'Family')} · now ${esc(tourWhen(b))}. The current booking stays in place until the new time is secured.`,
        body: `<div class="cls-form">${kids.field('kd-rdate', 'New date', `<input class="input" type="date" id="kd-rdate" name="rdate" min="${store.today()}" value="${firstDay}">`)}
          ${kids.field('kd-slot', 'Available slot', '<select class="input" id="kd-slot" name="slot" required></select>', { required: true })}
          ${kids.field('kd-reason', 'Reason (optional)', '<input class="input" id="kd-reason" name="reason" maxlength="200">')}<div class="tr-full" data-full hidden></div></div>`,
        submit: 'Move tour',
        async onSubmit(form) {
          const slotId = form.elements.slot.value;
          if (!slotId) return { ok: false, errors: { slot: 'Choose an available slot.' } };
          const r = await store.rescheduleTour(me(), b.id, { slotId, reason: form.elements.reason.value });
          if (!r.ok) { const box = form.querySelector('[data-full]'); box.hidden = false; box.innerHTML = `<div class="tr-full__box" role="alert"><p>${esc(failText(r))}</p><p class="cd-note">The original tour (${esc(tourWhen(b))}) is unchanged.</p></div>`; fill(); return { keepOpen: true, submitLabel: 'Move tour' }; }
          toast('Tour rescheduled', `${e?.child || ''} · ${tourWhen(r.booking)}`, 'refresh');
          paint();
          return { ok: true };
        } });
      const fill = () => { const list = opts(d.form.elements.rdate.value); d.form.elements.slot.innerHTML = list.length ? list.map(s => `<option value="${esc(s.id)}">${esc(s.start)}–${esc(s.end)} · ${esc(guideName(s.guideId))} · ${s.capacity - s.booked} of ${s.capacity} left</option>`).join('') : '<option value="">No available slots this day</option>'; };
      fill();
      d.form.elements.rdate.addEventListener('change', fill);
    }

    /* ---------------------------------------------------------------- Manage slots */

    function manageDialog() {
      const guides = store.tourGuides();
      let skip = false;
      const patterns = () => store.getTourPatterns().filter(p => p.status === 'active');
      const DAY = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];
      const patHtml = () => { const list = patterns(); return list.length ? `<ul class="tr-pats">${list.map(p => `<li><div><b>${esc(p.name || 'Tour pattern')}</b><small>${esc(p.days.map(x => DAY.find(y => y[0] === x)[1]).join(', '))} · ${esc(p.start)}–${esc(p.end)} · ${p.duration} min · up to ${plural(p.capacity, 'family', 'families')} · ${esc(guideName(p.guideId))} · ${esc(fmt(p.from, { day: 'numeric', month: 'short' }))}–${p.to ? esc(fmt(p.to, { day: 'numeric', month: 'short' })) : 'ongoing'}</small></div><button class="btn btn--tertiary btn--sm is-danger" type="button" data-rmpat="${esc(p.id)}">Remove</button></li>`).join('')}</ul>` : '<p class="cp-muted">No recurring patterns yet.</p>'; };
      const d = kids.dialog({ label: 'School tours', title: 'Manage tour slots', desc: 'Create recurring availability. Existing slots and bookings are never overwritten.',
        body: `<div class="tr-manage"><section><h3 class="cd-qv-h">Current patterns</h3><div data-pats>${patHtml()}</div></section>
          <section class="cls-form"><h3 class="cd-qv-h">New pattern</h3>
            ${kids.field('kd-name', 'Pattern name', '<input class="input" id="kd-name" name="name" maxlength="60" placeholder="e.g. Morning tours">')}
            <fieldset class="an-fs"><legend class="field__label">Days <span class="field__req" aria-hidden="true">*</span></legend><div class="pt-days">${DAY.map(([k, l]) => `<label class="an-pick"><input type="checkbox" name="pday" value="${k}"><span><b>${l}</b></span></label>`).join('')}</div><p class="field__hint field__hint--error" data-error-for="days" hidden></p></fieldset>
            <div class="cls-form__row">${kids.field('kd-start', 'Start time', '<input class="input" type="time" id="kd-start" name="start" value="09:00" required>', { required: true })}${kids.field('kd-end', 'End time', '<input class="input" type="time" id="kd-end" name="end" value="11:00" required>', { required: true })}</div>
            <div class="cls-form__row">${kids.field('kd-duration', 'Tour length', `<select class="input" id="kd-duration" name="duration">${store.TOUR_DURATIONS.map(n => `<option value="${n}"${n === 30 ? ' selected' : ''}>${n} minutes</option>`).join('')}</select>`)}${kids.field('kd-capacity', 'Families per slot', '<input class="input" type="number" id="kd-capacity" name="capacity" min="1" max="20" step="1" value="2" inputmode="numeric" required>', { required: true })}</div>
            <div class="cls-form__row">${kids.field('kd-guideId', 'Guide', `<select class="input" id="kd-guideId" name="guideId" required><option value="">Choose…</option>${guides.map(g => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select>`, { required: true })}${kids.field('kd-from', 'Starts on', `<input class="input" type="date" id="kd-from" name="from" value="${store.today()}" required>`, { required: true })}</div>
            ${kids.field('kd-to', 'Ends on (optional)', '<input class="input" type="date" id="kd-to" name="to">', { hint: 'Without an end date, slots are created for the next eight weeks.' })}
            <div class="pt-preview" aria-live="polite" data-pv></div>
            <p class="field__hint field__hint--error" data-error-for="form" hidden></p></section></div>`,
        submit: 'Create slots',
        async onSubmit(form) {
          const r = await store.saveTourPattern(me(), input(form), { skipConflicts: skip });
          if (r.reason === 'conflict') { preview(); return { ok: false, message: `${plural(r.conflicts.length, 'time')} clash with the guide’s other slots. Change the time or guide, or tick “Skip the conflicting times”.` }; }
          if (!r.ok) return r.errors ? { ok: false, errors: r.errors } : { ok: false, message: failText(r) };
          toast('Tour slots created', `${plural(r.created, 'slot')} created${r.skipped.duplicates ? ` · ${r.skipped.duplicates} already existed` : ''}${r.skipped.conflicts ? ` · ${r.skipped.conflicts} skipped (guide clash)` : ''}.`, 'check-circle');
          paint();
          return { ok: true };
        } });
      const f = d.form;
      const input = form => ({ name: form.elements.name.value, days: [...form.querySelectorAll('[name="pday"]:checked')].map(x => x.value), start: form.elements.start.value, end: form.elements.end.value, duration: form.elements.duration.value, capacity: form.elements.capacity.value === '' ? NaN : Number(form.elements.capacity.value), guideId: form.elements.guideId.value, from: form.elements.from.value, to: form.elements.to.value });
      function preview() {
        const p = store.previewTourPattern(user, input(f));
        const errs = Object.values(p.errors);
        const byDay = {};
        (p.slots || []).forEach(s => { const k = s.date; (byDay[k] = byDay[k] || []).push(`${s.start}–${s.end}`); });
        const sample = Object.entries(byDay).slice(0, 4);
        f.querySelector('[data-pv]').innerHTML = errs.length ? `<p class="pt-preview__err">${icon('info', 'icon--sm')}${esc(errs[0])}</p>` : `<div class="pt-preview__nums"><span><b>${p.slots.length}</b>slots</span><span><b>${Object.keys(byDay).length}</b>days</span><span><b>${p.duplicates}</b>already exist</span><span><b>${p.conflicts.length}</b>clashes</span></div>
          ${sample.map(([dte, list]) => `<p class="pt-sample"><b>${esc(fmt(dte))}</b> ${esc(list.join(', '))}</p>`).join('')}${Object.keys(byDay).length > 4 ? `<p class="cd-note">… until ${esc(fmt(p.to, { day: 'numeric', month: 'short', year: 'numeric' }))}</p>` : ''}
          ${p.closed ? `<p class="cd-note">${plural(p.closed, 'closed school day')} skipped.</p>` : ''}${p.duplicatePattern ? '<p class="pt-preview__err">An identical pattern already exists — its slots won’t be duplicated.</p>' : ''}
          ${p.conflicts.length ? `<div class="tr-full__box" role="alert"><p><b>Guide clash.</b> ${esc(p.conflicts[0].guide)} already has slots at:</p><ul class="pt-log">${p.conflicts.slice(0, 5).map(c => `<li>${esc(fmt(c.date))} ${esc(c.start)}–${esc(c.end)} (overlaps ${esc(c.with)})</li>`).join('')}</ul><p class="cd-note">Change the time or the guide — or skip just those times.</p><label class="fb-check"><input type="checkbox" data-skip${skip ? ' checked' : ''}><span>Skip the conflicting times</span></label></div>` : ''}
          ${!p.slots.length ? '<p class="pt-preview__err">No new slots fit these settings.</p>' : ''}`;
        const cb = f.querySelector('[data-skip]');
        if (cb) cb.addEventListener('change', () => { skip = cb.checked; });
      }
      preview();
      f.addEventListener('input', preview);
      f.addEventListener('change', ev => { if (!ev.target.matches('[data-skip]')) preview(); });
      f.addEventListener('click', ev => { const rm = ev.target.closest('[data-rmpat]'); if (rm) { d.close(); setTimeout(() => removePatternDialog(rm.dataset.rmpat), 200); } });
    }
    function removePatternDialog(id) {
      const imp = store.tourPatternImpact(id);
      const d = kids.dialog({ label: 'School tours', title: 'Remove this pattern?', danger: true,
        desc: `${plural(imp.empty, 'future empty slot')} will be withdrawn. Past tours and their attendance are kept.`,
        body: imp.booked.length ? `<div class="tr-full__box"><p><b>${plural(imp.booked.length, 'slot has', 'slots have')} bookings:</b></p><ul class="pt-log">${imp.booked.map(x => `<li>${esc(fmt(x.date))} ${esc(x.start)} · ${plural(x.families, 'family', 'families')}</li>`).join('')}</ul></div>
          <fieldset class="an-fs"><legend class="field__label">What should happen to them? <span class="field__req" aria-hidden="true">*</span></legend><div class="s7-stages"><label class="an-mode"><input type="radio" name="decide" value="keep"><span><b>Keep these tours</b><small>The booked slots stay; only empty ones are withdrawn.</small></span></label><label class="an-mode"><input type="radio" name="decide" value="cancel"><span><b>Cancel these tours too</b><small>Each booking is marked Cancelled and noted in its enquiry’s timeline.</small></span></label></div><p class="field__hint field__hint--error" data-error-for="decision" hidden></p></fieldset>` : '',
        submit: 'Remove pattern',
        async onSubmit(form) {
          const decision = form.querySelector('[name="decide"]:checked')?.value || null;
          if (imp.booked.length && !decision) return { ok: false, errors: { decision: 'Choose what happens to the booked tours.' } };
          const r = await store.removeTourPattern(me(), id, { bookedSlots: decision });
          if (!r.ok) return { ok: false, message: failText(r) };
          toast('Pattern removed', `${plural(r.cancelledSlots, 'slot')} withdrawn${r.keptSlots ? ` · ${r.keptSlots} booked kept` : ''}.`, 'check-circle');
          paint();
          return { ok: true };
        } });
      void d;
    }

    /* ---------------------------------------------------------------- Events */

    main.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('[data-manage]')) { manageDialog(); return; }
      if (t.closest('[data-retry]')) { load(); return; }
      const wk = t.closest('[data-week]');
      if (wk) { week = addDays(week, 7 * Number(wk.dataset.week)); syncUrl(); paint(); main.querySelector(`[data-week="${wk.dataset.week}"]`)?.focus(); return; }
      const dy = t.closest('[data-day]');
      if (dy) { day = addDays(day, Number(dy.dataset.day)); syncUrl(); paint(); main.querySelector(`[data-day="${dy.dataset.day}"]`)?.focus(); return; }
      if (t.closest('[data-today]')) { week = mondayOf(store.today()); day = store.today(); syncUrl(); paint(); main.querySelector('[data-today]')?.focus(); return; }
      const uf = t.closest('[data-upf]');
      if (uf) { upFilter = uf.dataset.upf; paint(); main.querySelector(`[data-upf="${upFilter}"]`)?.focus(); return; }
      const sl = t.closest('[data-slot]');
      if (sl) { openSlot(sl.dataset.slot); return; }
      const tr = t.closest('[data-tour]');
      if (tr) openTour(tr.dataset.tour);
    });
    mobileQ.addEventListener('change', () => { if (loaded) paint(); });
    let queued = false;
    store.subscribe(({ key }) => { if (!loaded || (key && !/^nexora-(tour|admission-enquiries|demo-role|school-plan|holidays|events)/.test(key)) || queued) return; queued = true; setTimeout(() => { queued = false; if (!document.querySelector('dialog.modal[open]')) paint(); else drawer?.refresh(); }, 0); });
    function load() {
      setTimeout(() => {
        if (failOnce) { failOnce = false; $('[data-cal]').removeAttribute('aria-busy'); $('[data-cal]').innerHTML = state('alert-circle', 'Tours couldn’t load', 'Something went wrong while reading tours on this device. Nothing was changed.', '<button class="btn btn--primary kids-yellow" type="button" data-retry>Try again</button>', 'error'); return; }
        loaded = true;
        paint();
        if (params.get('tour')) openTour(params.get('tour'), $('#page-title'));
      }, 250);
    }
    load();
  }

  window.NexoraTours = { render };
})();
