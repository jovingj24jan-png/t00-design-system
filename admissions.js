/* Admissions Pipeline (app.html?page=admissions[&view=kanban|list][&stage=<mobile stage>])
   and S07 applicant details (app.html?page=admissions&applicant=<enquiryId>).
   Reads and writes the shared enquiry records through the store (createEnquiry, moveEnquiry, updateEnquiry,
   setEnquiryFollowUp, startEnquiryEnrolment …). Enrolled is only set when S14 saves the child.
   Test hook: ?fail=1. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const kids = window.NexoraChildren;
  const { routes } = store;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const params = new URLSearchParams(location.search);
  const mobileQ = matchMedia('(max-width: 767px)');
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => (s ? new Date(`${String(s).slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', o) : '—');
  const when = s => new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const monthOf = s => (s ? new Date(`${s.slice(0, 7)}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—');
  const initials = n => String(n || '').trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
  const toast = (t, x, i = 'info', o) => window.NexoraToast?.show(t, x, i, o);
  const STAGES = Object.keys(store.ENQUIRY_STAGES);
  const STAGE_TONE = { enquiry: 'info', tour: 'cat', applied: 'warning', offer: 'warning', enrolled: 'success', lost: 'neutral' };
  const FAIL = {
    forbidden: 'Your role or your school’s plan doesn’t allow this. Nothing was changed.',
    missing: 'This enquiry no longer exists. Refresh the page.',
    stale: 'Someone else changed this enquiry just now. The latest version is shown — please try again.',
    locked: 'This child is already enrolled, so the enquiry can’t be moved.',
    busy: 'Still saving the last change — please wait a moment.',
    'enrol-via-s14': 'Enrolment is completed in the enrolment form.',
    storage: 'This couldn’t be saved on this device. Nothing was changed. Please try again.'
  };
  const failText = r => (r.errors && Object.values(r.errors)[0]) || FAIL[r.reason] || FAIL.storage;
  const chip = (tone, text, ic = '') => `<span class="badge badge--plain an-chip an-chip--${tone}">${ic ? icon(ic) : ''}${esc(text)}</span>`;
  const state = (iconName, title, text, action = '', tone = '') => `<div class="kids-empty an-state"${tone === 'error' ? ' role="alert"' : ''}><span class="state-icon${tone ? ` state-icon--${tone}` : ''}" aria-hidden="true">${icon(iconName)}</span><h2 class="kids-empty__title">${title}</h2><p>${text}</p>${action}</div>`;
  const ownerName = id => store.users.find(u => u.id === id)?.name || '';
  const applicantUrl = id => routes.page('admissions', { applicant: id });
  const ageText = e => { const a = store.ageAt(e.dob, e.preferredStart); return !e.dob ? 'Age unknown' : !a ? (e.preferredStart && e.dob > e.preferredStart ? 'Not born by start' : 'Age unknown') : `${a.years}y ${a.months}m at start`; };
  function daysChip(e) {
    const n = store.daysInStage(e);
    const terminal = ['enrolled', 'lost'].includes(e.stage);
    const tone = terminal ? 'neutral' : n >= 14 ? 'error' : n >= 7 ? 'warning' : 'neutral';
    const label = terminal ? '' : n >= 14 ? ' · overdue' : n >= 7 ? ' · check in' : '';
    return `<span class="badge badge--plain an-chip an-chip--${tone} ad-days" title="Days since it entered ${esc(store.ENQUIRY_STAGES[e.stage])}">${tone === 'error' ? icon('alert-triangle') : tone === 'warning' ? icon('clock') : ''}${n}d in stage${label}</span>`;
  }
  function followText(e) {
    if (!e.followUp) return '<span class="cp-muted">No follow-up set</span>';
    const t = store.today();
    if (['enrolled', 'lost'].includes(e.stage)) return `<span class="cp-muted">Follow-up ${esc(fmt(e.followUp, { day: 'numeric', month: 'short' }))}</span>`;
    if (e.followUp < t) return `<span class="ad-fu is-over">${icon('alert-triangle', 'icon--sm')}Follow-up overdue · ${esc(fmt(e.followUp, { day: 'numeric', month: 'short' }))}</span>`;
    if (e.followUp === t) return `<span class="ad-fu is-today">${icon('phone', 'icon--sm')}Follow up today</span>`;
    return `<span class="ad-fu">${icon('calendar-check', 'icon--sm')}Follow up ${esc(fmt(e.followUp, { weekday: 'short', day: 'numeric', month: 'short' }))}</span>`;
  }

  function render(key, main, user) {
    if (key !== 'admissions') return false;
    main.classList.add('kids-page');
    if (params.get('applicant')) applicant(main, user, params.get('applicant'));
    else pipeline(main, user);
    return true;
  }

  /* ================================================================= Shared actions */

  function actions(user, onDone = () => {}) {
    const busy = new Set();
    const me = () => store.currentUser();
    const find = id => store.getAdmissionEnquiries().find(e => e.id === id);

    async function doMove(e, to, extra = {}) {
      if (busy.has(e.id)) return { ok: false, reason: 'busy' };
      busy.add(e.id);
      const r = await store.moveEnquiry(me(), e.id, to, { from: e.stage, ...extra });
      busy.delete(e.id);
      if (!r.ok) { if (!r.errors) toast('Not moved', failText(r), 'alert-circle'); onDone(); return r; }
      if (!r.unchanged) toast(to === 'lost' ? 'Marked lost' : `Moved to ${store.ENQUIRY_STAGES[to]}`, `${e.child}${to === 'lost' ? ` · ${store.LOST_REASONS[extra.reason]}` : ''}`, to === 'lost' ? 'x' : 'check-circle');
      onDone();
      return r;
    }
    function lostDialog(e) {
      const d = kids.dialog({
        label: 'Admissions', title: 'Mark enquiry as lost?', danger: true,
        desc: `${esc(e.child)} · ${esc(store.ENQUIRY_STAGES[e.stage])}. The record is kept for reporting and can be reopened later.`,
        body: `<fieldset class="an-fs"><legend class="field__label">Reason <span class="field__req" aria-hidden="true">*</span></legend><div class="ad-reasons">${Object.entries(store.LOST_REASONS).map(([k, l]) => `<label class="an-pick"><input type="radio" name="lreason" value="${k}"><span><b>${l}</b></span></label>`).join('')}</div><p class="field__hint field__hint--error" data-error-for="reason" hidden></p></fieldset>
          <div data-other hidden>${kids.field('kd-detail', 'Tell us more', '<textarea class="input" id="kd-detail" name="detail" rows="2" maxlength="300"></textarea>', { required: true })}</div>`,
        submit: 'Confirm lost',
        async onSubmit(form) {
          const reason = form.querySelector('[name="lreason"]:checked')?.value || '';
          if (!reason) return { ok: false, errors: { reason: 'Choose a reason.' } };
          const r = await doMove(find(e.id) || e, 'lost', { reason, detail: form.elements.detail.value });
          return r.ok ? { ok: true } : r.errors ? { ok: false, errors: r.errors } : { ok: false, message: failText(r) };
        }
      });
      d.form.addEventListener('change', ev => { if (ev.target.name === 'lreason') d.form.querySelector('[data-other]').hidden = ev.target.value !== 'other'; });
      d.form.querySelector('[name="lreason"]').focus();
    }
    function tourDialog(e) {
      const next = new Date(); next.setDate(next.getDate() + 1);
      kids.dialog({
        label: 'Admissions', title: 'Book a tour', desc: `${esc(e.child)} moves to <b>Tour booked</b>. Add the tour time so it counts in “Tours booked”; leave it empty if it isn’t scheduled yet.`,
        body: `<div class="cls-form__row">${kids.field('kd-tdate', 'Tour date', `<input class="input" type="date" id="kd-tdate" name="tdate" min="${store.today()}">`)}${kids.field('kd-ttime', 'Time', '<input class="input" type="time" id="kd-ttime" name="ttime" value="10:00">')}</div><p class="field__hint field__hint--error" data-error-for="tourAt" hidden></p>`,
        submit: 'Move to Tour booked',
        async onSubmit(form) {
          const tourAt = form.elements.tdate.value ? `${form.elements.tdate.value}T${form.elements.ttime.value || '10:00'}` : null;
          const r = await doMove(find(e.id) || e, 'tour', { tourAt });
          return r.ok ? { ok: true } : r.errors ? { ok: false, errors: { tdate: r.errors.tourAt } } : { ok: false, message: failText(r) };
        }
      });
    }
    function enrolDialog(e) {
      if (!store.canManageChildren(me())) { toast('Can’t enrol', 'Only school leaders can enrol children.', 'lock'); return; }
      kids.dialog({
        label: 'Admissions', title: 'Ready to enrol this child?',
        desc: `The next step is the enrolment form, prefilled with ${esc(e.child)}’s details, ${esc(e.parent)}’s contact, the programme and the preferred start. The enquiry moves to <b>Enrolled</b> only when that enrolment is saved — not when the form opens.`,
        body: '', submit: 'Continue to enrolment',
        async onSubmit() {
          const r = await store.startEnquiryEnrolment(me(), e.id);
          if (!r.ok) return { ok: false, message: `${failText(r)} Use “Edit details” on the applicant page.` };
          location.href = routes.page('enrol', { enquiry: e.id });
          return { keepOpen: true, submitLabel: 'Opening…' };
        }
      });
    }
    function move(id, to) {
      const e = find(id);
      if (!e || e.stage === to) return;
      if (busy.has(id)) { toast('Still saving', FAIL.busy); return; }
      if (e.stage === 'enrolled') { toast('Already enrolled', FAIL.locked, 'lock'); return; }
      if (to === 'lost') lostDialog(e);
      else if (to === 'enrolled') enrolDialog(e);
      else if (to === 'tour') tourDialog(e);
      else doMove(e, to);
    }

    function enquiryForm(e = null) {
      const owners = store.admissionsOwners();
      const clientId = `cl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      let confirmSibling = false;
      const v = e || { ownerId: owners.some(o => o.id === user.id) ? user.id : '', source: '' };
      const d = kids.dialog({
        label: 'Admissions', title: e ? 'Edit applicant details' : 'Add enquiry', desc: e ? '' : 'Required: parent or guardian, phone, child, programme and preferred start.',
        body: `<div class="cls-form ad-form">
          <div class="cls-form__row">${kids.field('kd-parent', 'Parent or guardian', `<input class="input" id="kd-parent" name="parent" maxlength="80" autocomplete="name" required value="${esc(v.parent || '')}">`, { required: true })}${kids.field('kd-phone', 'Phone', `<input class="input" id="kd-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="24" required placeholder="+91 98400 00000" value="${esc(v.phone || '')}">`, { required: true })}</div>
          ${kids.field('kd-email', 'Email', `<input class="input" id="kd-email" name="email" type="email" autocomplete="email" maxlength="120" placeholder="name@example.com" value="${esc(v.email || '')}">`)}
          <div class="cls-form__row">${kids.field('kd-child', 'Child’s name', `<input class="input" id="kd-child" name="child" maxlength="80" required placeholder="First and last name" value="${esc(v.child || '')}">`, { required: true })}${kids.field('kd-dob', 'Child’s date of birth', `<input class="input" id="kd-dob" name="dob" type="date" max="${store.today()}" value="${esc(v.dob || '')}">`, { hint: 'Needed to show age at start, and for enrolment.' })}</div>
          <div class="cls-form__row">${kids.field('kd-programme', 'Programme', `<select class="input" id="kd-programme" name="programme" required><option value="">Choose…</option>${store.CLASS_LEVELS.map(l => `<option${v.programme === l ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`, { required: true })}${kids.field('kd-preferredStart', 'Preferred start', `<input class="input" id="kd-preferredStart" name="preferredStart" type="date" required min="${e && e.preferredStart < store.today() ? e.preferredStart : store.today()}" value="${esc(v.preferredStart || '')}">`, { required: true })}</div>
          <div class="cls-form__row">${kids.field('kd-source', 'Source', `<select class="input" id="kd-source" name="source"><option value="">Choose…</option>${Object.entries(store.ENQUIRY_SOURCES).map(([k, l]) => `<option value="${k}"${v.source === k ? ' selected' : ''}>${l}</option>`).join('')}</select>`)}${kids.field('kd-ownerId', 'Admissions owner', `<select class="input" id="kd-ownerId" name="ownerId"><option value="">Unassigned</option>${owners.map(o => `<option value="${esc(o.id)}"${v.ownerId === o.id ? ' selected' : ''}>${esc(o.name)} · ${esc(o.role)}</option>`).join('')}</select>`)}</div>
          ${e ? '' : kids.field('kd-followUp', 'Next follow-up', `<input class="input" id="kd-followUp" name="followUp" type="date" value="${esc(store.today())}">`)}
          ${kids.field('kd-notes', 'Notes', `<textarea class="input" id="kd-notes" name="notes" rows="3" maxlength="1000" placeholder="What did the family ask about?">${esc(v.notes || '')}</textarea>`)}
          <div class="ad-dup" data-dup hidden></div></div>`,
        submit: e ? 'Save changes' : 'Add enquiry',
        async onSubmit(form) {
          const input = Object.fromEntries(['parent', 'phone', 'email', 'child', 'dob', 'programme', 'preferredStart', 'source', 'ownerId', 'notes', 'followUp'].filter(k => form.elements[k]).map(k => [k, form.elements[k].value]));
          const r = e ? await store.updateEnquiry(me(), e.id, { ...input, updatedAt: e.updatedAt }) : await store.createEnquiry(me(), input, { confirmSibling, clientId });
          if (r.reason === 'duplicate') { showDup(form, r); return { keepOpen: true, submitLabel: r.blocking ? (e ? 'Save changes' : 'Add enquiry') : 'Create separate enquiry' }; }
          if (!r.ok) return r.errors ? { ok: false, errors: r.errors } : { ok: false, message: failText(r) };
          if (e) toast(r.unchanged ? 'No changes' : 'Details saved', e.child, 'check-circle');
          else toast('Enquiry added', `${r.enquiry.child} — ${r.enquiry.programme} is in Enquiry.${r.enquiry.ownerId ? ` ${ownerName(r.enquiry.ownerId)} has a Nexora notification.` : ''}`, 'check-circle', { duration: 7000, action: { label: 'Open', onClick: () => { location.href = applicantUrl(r.enquiry.id); } } });
          onDone(r.enquiry);
          return { ok: true };
        }
      });
      function showDup(form, r) {
        const box = form.querySelector('[data-dup]');
        const rows = [...r.duplicates.enquiries.map(x => `<li><b>${esc(x.child)}</b> · ${esc(x.parent)} · ${esc(store.ENQUIRY_STAGES[x.stage])} <a class="btn btn--tertiary btn--sm" href="${applicantUrl(x.id)}">Open existing enquiry</a></li>`), ...r.duplicates.families.map(x => `<li><b>${esc(x.name)}</b> (already at school: ${esc(x.children.join(', ') || 'no children')}) <a class="btn btn--tertiary btn--sm" href="${routes.page('family', { id: x.id })}">Open family</a></li>`)];
        box.hidden = false;
        box.innerHTML = `<div class="ad-dup__box" role="alert"><p class="ad-dup__t">${icon('alert-triangle', 'icon--sm')}${r.blocking ? 'This child already has a record with this phone or email.' : 'This phone or email already belongs to another enquiry or family.'}</p><ul>${rows.join('')}</ul>
          ${r.blocking ? '<p class="cd-note">Open the existing record instead of creating a duplicate. If the details are wrong, change the phone, email or child’s name.</p>' : `<label class="fb-check"><input type="checkbox" data-sibling${confirmSibling ? ' checked' : ''}><span><b>This is a different child (for example a sibling)</b><small>Create a separate enquiry${r.duplicates.families.length ? ' linked to the existing family' : ''}.</small></span></label>`}</div>`;
        const cb = box.querySelector('[data-sibling]');
        if (cb) cb.addEventListener('change', () => { confirmSibling = cb.checked; });
        box.querySelector('a, input')?.focus();
      }
      d.form.addEventListener('input', ev => { if (['phone', 'email', 'child'].includes(ev.target.name)) { confirmSibling = false; const b = d.form.querySelector('[data-dup]'); b.hidden = true; b.innerHTML = ''; d.form.querySelector('[type="submit"]').textContent = e ? 'Save changes' : 'Add enquiry'; } });
    }
    return { move, enquiryForm, lostDialog, enrolDialog, busy };
  }

  /* ================================================================= Pipeline */

  function pipeline(main, user) {
    let view = params.get('view') === 'list' ? 'list' : 'kanban';
    let mStage = STAGES.includes(params.get('stage')) ? params.get('stage') : 'enquiry';
    const f = { q: '', programme: '', source: '', start: '', owner: '' };
    const sort = { key: 'created', dir: -1 };
    let loaded = false;
    let failOnce = params.get('fail') === '1';
    let openMenu = null;
    const act = actions(user, () => paint());
    const owners = store.admissionsOwners();
    document.title = 'Admissions Pipeline · Nexora';
    main.innerHTML = `<div class="kids ad">
      <header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Admissions Pipeline</h1><p class="kids-head__sub">Every enquiry is an opportunity to welcome a new family.</p></div></header>
      <section class="ad-kpis" aria-label="Admissions summary" data-kpis>${'<span class="skeleton kpi kpi--static" style="min-height:104px"></span>'.repeat(6)}</section>
      <div class="ad-toolbar" role="search" aria-label="Find and filter enquiries">
        <div class="an-search">${icon('search', 'icon--sm')}<label class="sr-only" for="ad-q">Search enquiries</label><input class="input" id="ad-q" type="search" placeholder="Child, parent, phone or email" autocomplete="off" data-f="q"></div>
        <label class="sr-only" for="ad-prog">Programme</label><select class="input" id="ad-prog" data-f="programme"><option value="">All programmes</option>${store.CLASS_LEVELS.map(l => `<option>${esc(l)}</option>`).join('')}</select>
        <label class="sr-only" for="ad-src">Source</label><select class="input" id="ad-src" data-f="source"><option value="">All sources</option>${Object.entries(store.ENQUIRY_SOURCES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
        <label class="sr-only" for="ad-start">Preferred start</label><select class="input" id="ad-start" data-f="start" data-startsel></select>
        <label class="sr-only" for="ad-owner">Owner</label><select class="input" id="ad-owner" data-f="owner"><option value="">All owners</option>${owners.map(o => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('')}<option value="none">Unassigned</option></select>
        <button class="btn btn--tertiary btn--sm" type="button" data-reset hidden>Reset filters</button>
        <span class="ad-toolbar__sp"></span>
        <div class="segmented ad-view" role="group" aria-label="View">${[['kanban', 'Kanban', 'grid'], ['list', 'List', 'list']].map(([k, l, ic]) => `<button type="button" aria-pressed="${view === k}" data-view="${k}">${icon(ic, 'icon--sm')}${l}</button>`).join('')}</div>
        <button class="btn btn--primary kids-yellow" type="button" data-add>${icon('plus', 'icon--sm')}Add enquiry</button>
      </div>
      <section class="ad-panel" aria-label="Enquiries" aria-busy="true" data-panel><span class="skeleton" style="display:block;height:360px;border-radius:var(--radius-lg)"></span></section></div>`;
    const $ = s => main.querySelector(s);
    const syncUrl = () => { const u = new URL(location.href); view === 'list' ? u.searchParams.set('view', 'list') : u.searchParams.delete('view'); mStage !== 'enquiry' ? u.searchParams.set('stage', mStage) : u.searchParams.delete('stage'); history.replaceState(null, '', u); };

    function kpis(list) {
      const k = store.admissionsKpis(list);
      const card = (ic, label, value, ctx, tip) => `<div class="kpi kpi--static cls-sum__item ad-kpi" title="${esc(tip)}"><span class="kpi__top"><span class="kpi__icon" aria-hidden="true">${icon(ic)}</span><span class="kpi__label">${label}</span></span><span class="kpi__value">${value}</span><span class="kpi__context">${ctx}</span></div>`;
      $('[data-kpis]').innerHTML = card('user-plus', 'New this week', k.newWeek, 'Enquiries since Monday', 'Unique enquiries created Monday to Sunday this week.')
        + card('calendar-check', 'Tours booked', k.tours, k.toursNoDate ? `${k.toursNoDate} more without a date` : 'Upcoming, with a date', 'In Tour booked with a tour date and time still to come.')
        + card('file', 'Applications', k.applications, 'Currently in Applied', 'Prospects whose current stage is Applied.')
        + card('mail', 'Offers out', k.offers, 'Currently in Offer sent', 'Prospects whose current stage is Offer sent.')
        + card('chart', 'Conversion rate', k.conversion === null ? '—' : `${k.conversion}<small>%</small>`, k.conversion === null ? `Not enough history yet (${k.cohort} of 5)` : `${k.cohortEnrolled} of ${k.cohort} enrolled · 30–365 days old`, 'Of enquiries created 30 to 365 days ago, the share now Enrolled. Newer enquiries are left out because they haven’t had time to decide.')
        + card('clock', 'Expected starts', k.starts, `Next 3 months · to ${fmt(k.startsTo, { day: 'numeric', month: 'short' })}`, 'Offer sent or Enrolled, with a start date from today up to the same day three months from now.');
    }
    function startOptions(list) {
      const months = [...new Set(list.map(e => (e.preferredStart || '').slice(0, 7)).filter(Boolean))].sort();
      const sel = $('[data-startsel]');
      sel.innerHTML = `<option value="">Any start</option>${months.map(m => `<option value="${m}"${f.start === m ? ' selected' : ''}>Starts ${esc(monthOf(m))}</option>`).join('')}`;
    }
    const filtered = all => {
      const ql = f.q.trim().toLowerCase();
      const qd = f.q.replace(/\D/g, '');
      return all.filter(e => (!ql || `${e.child} ${e.parent} ${e.email}`.toLowerCase().includes(ql) || (qd.length >= 3 && String(e.phone).replace(/\D/g, '').includes(qd)))
        && (!f.programme || e.programme === f.programme) && (!f.source || e.source === f.source) && (!f.start || (e.preferredStart || '').startsWith(f.start))
        && (!f.owner || (f.owner === 'none' ? !e.ownerId : e.ownerId === f.owner)));
    };
    const menuHtml = e => `<div class="menu-wrap"><button class="btn btn--icon-ghost btn--sm" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(e.child)}" data-menu="${esc(e.id)}">${icon('more-v')}</button>
      <div class="menu" role="menu" hidden><button type="button" role="menuitem" data-open="${esc(e.id)}">${icon('eye', 'icon--sm')}Open details</button><hr>${STAGES.filter(s => s !== e.stage).map(s => `<button type="button" role="menuitem" data-move="${s}" data-id="${esc(e.id)}"${s === 'lost' ? ' class="is-danger"' : ''}${e.stage === 'enrolled' ? ' disabled' : ''}>${icon(s === 'lost' ? 'x' : s === 'enrolled' ? 'user-plus' : 'arrow-right', 'icon--sm')}${s === 'enrolled' ? 'Continue to enrolment…' : `Move to ${store.ENQUIRY_STAGES[s]}`}</button>`).join('')}</div></div>`;
    function cardHtml(e, draggable) {
      return `<article class="ad-card${['enrolled', 'lost'].includes(e.stage) ? ' is-closed' : ''}" data-card="${esc(e.id)}"${draggable ? ' draggable="true"' : ''} aria-roledescription="${draggable ? 'Draggable prospect card' : 'Prospect card'}">
        <div class="ad-card__top"><a class="ad-card__name" href="${applicantUrl(e.id)}">${esc(e.child)}</a>${menuHtml(e)}</div>
        <p class="ad-card__meta">${esc(ageText(e))} · ${esc(e.parent)}</p>
        <p class="ad-card__meta">${esc(e.programme)} · starts ${esc(monthOf(e.preferredStart))}</p>
        <div class="ad-card__chips">${chip('cat', store.ENQUIRY_SOURCES[e.source] || 'Other')}${daysChip(e)}</div>
        ${e.stage === 'lost' && e.lost ? `<p class="ad-card__note">${icon('info', 'icon--sm')}${esc(store.LOST_REASONS[e.lost.reason] || 'Lost')}</p>` : e.stage === 'tour' && e.tourAt ? `<p class="ad-card__note">${icon('calendar-check', 'icon--sm')}Tour ${esc(when(e.tourAt))}</p>` : ''}
        <div class="ad-card__foot"><span class="ad-card__fu">${followText(e)}</span>${e.ownerId ? `<span class="ad-av" title="Owner: ${esc(ownerName(e.ownerId))}" aria-label="Owner: ${esc(ownerName(e.ownerId))}">${esc(initials(ownerName(e.ownerId)))}</span>` : ''}</div>
      </article>`;
    }
    function kanban(rows) {
      if (mobileQ.matches) {
        const counts = Object.fromEntries(STAGES.map(s => [s, rows.filter(e => e.stage === s).length]));
        const list = rows.filter(e => e.stage === mStage);
        return `<div class="field ad-stagesel"><label class="field__label" for="ad-mstage">Stage</label><select class="input" id="ad-mstage" data-mstage>${STAGES.map(s => `<option value="${s}"${s === mStage ? ' selected' : ''}>${store.ENQUIRY_STAGES[s]} (${counts[s]})</option>`).join('')}</select></div>
          ${list.length ? `<ul class="ad-mlist">${list.map(e => `<li>${cardHtml(e, false)}</li>`).join('')}</ul>` : state('inbox', `Nothing in ${store.ENQUIRY_STAGES[mStage]}`, 'Choose another stage, or change the filters.')}`;
      }
      return `<div class="ad-board" data-board>${STAGES.map(s => { const list = rows.filter(e => e.stage === s); return `<section class="ad-col ad-col--${s}" data-col="${s}" aria-labelledby="ad-col-${s}">
        <header class="ad-col__head"><h2 id="ad-col-${s}">${store.ENQUIRY_STAGES[s]}</h2><span class="tab__count" aria-label="${plural(list.length, 'prospect')}">${list.length}</span></header>
        <p class="ad-col__sub">${plural(list.length, 'prospect')}</p>
        <ul class="ad-list" data-drop="${s}">${list.map(e => `<li>${cardHtml(e, true)}</li>`).join('') || `<li class="ad-col__empty">${s === 'enrolled' ? 'Enrolled after the enrolment form is saved' : 'Drop a card here'}</li>`}</ul></section>`; }).join('')}</div>`;
    }
    function listView(rows) {
      const val = { name: e => e.child.toLowerCase(), stage: e => STAGES.indexOf(e.stage), start: e => e.preferredStart || '9', created: e => e.createdAt, followup: e => e.followUp || '9' };
      const sorted = rows.slice().sort((a, b) => { const x = val[sort.key](a); const y = val[sort.key](b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
      const th = (k, l) => `<th scope="col" aria-sort="${sort.key === k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button class="ad-sort" type="button" data-sort="${k}">${l}${sort.key === k ? icon(sort.dir > 0 ? 'arrow-right' : 'arrow-left', `icon--sm ad-sort__ic${sort.dir > 0 ? ' is-up' : ' is-down'}`) : ''}</button></th>`;
      return `<div class="ad-sortbar"><label class="field__label" for="ad-sortsel">Sort by</label><select class="input input--sm" id="ad-sortsel" data-sortsel>${[['created', 'Newest'], ['name', 'Child name'], ['stage', 'Stage'], ['start', 'Preferred start'], ['followup', 'Next follow-up']].map(([k, l]) => `<option value="${k}"${sort.key === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="table-shell an-table"><table class="data-table"><caption class="sr-only">Enquiries</caption><thead><tr>${th('name', 'Child')}<th scope="col">Parent</th><th scope="col">Programme</th>${th('stage', 'Stage')}${th('start', 'Preferred start')}<th scope="col">Source</th><th scope="col">Owner</th><th scope="col">In stage</th>${th('followup', 'Next follow-up')}<th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${sorted.map(e => `<tr data-row="${esc(e.id)}"><td><a class="an-title" href="${applicantUrl(e.id)}">${esc(e.child)}</a><br><small class="cp-muted">${esc(ageText(e))}</small></td><td>${esc(e.parent)}</td><td>${esc(e.programme)}</td><td>${chip(STAGE_TONE[e.stage], store.ENQUIRY_STAGES[e.stage])}</td><td>${esc(fmt(e.preferredStart))}</td><td>${esc(store.ENQUIRY_SOURCES[e.source] || '')}</td><td>${esc(ownerName(e.ownerId) || '—')}</td><td>${daysChip(e)}</td><td>${followText(e)}</td><td class="an-actions">${menuHtml(e)}</td></tr>`).join('')}</tbody></table></div>
        <ul class="an-cards">${sorted.map(e => `<li class="panel an-card"><div class="an-card__head">${chip(STAGE_TONE[e.stage], store.ENQUIRY_STAGES[e.stage])}${menuHtml(e)}</div><a class="an-title" href="${applicantUrl(e.id)}">${esc(e.child)}</a><p class="an-card__meta">${icon('user', 'icon--sm')}<span>${esc(e.parent)} · ${esc(ageText(e))}</span></p><p class="an-card__meta">${icon('grid', 'icon--sm')}<span>${esc(e.programme)} · starts ${esc(monthOf(e.preferredStart))}</span></p><div class="ad-card__chips">${chip('cat', store.ENQUIRY_SOURCES[e.source] || 'Other')}${daysChip(e)}</div><p class="an-card__meta">${followText(e)}</p></li>`).join('')}</ul>`;
    }
    function paint() {
      const all = store.getAdmissionEnquiries();
      kpis(all);
      startOptions(all);
      const rows = filtered(all);
      const any = Object.values(f).some(Boolean);
      $('[data-reset]').hidden = !any;
      main.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
      const panel = $('[data-panel]');
      panel.removeAttribute('aria-busy');
      const fid = document.activeElement && panel.contains(document.activeElement) ? document.activeElement.id : '';
      if (!all.length) { panel.innerHTML = state('user-plus', 'No enquiries yet', 'Add the first enquiry to start the pipeline.', '<button class="btn btn--primary kids-yellow" type="button" data-add>Add enquiry</button>'); return; }
      if (!rows.length) { panel.innerHTML = state('filter', 'No enquiries match', 'Try a different search or reset the filters.', '<button class="btn btn--tertiary btn--sm" type="button" data-reset>Reset filters</button>'); return; }
      panel.innerHTML = `<p class="sr-only" aria-live="polite">${plural(rows.length, 'enquiry', 'enquiries')}</p>${view === 'list' ? listView(rows) : kanban(rows)}`;
      if (fid) main.querySelector(`#${CSS.escape(fid)}`)?.focus();
    }

    const closeMenu = (restore = false) => { if (!openMenu) return; const b = openMenu.querySelector('[data-menu]'); openMenu.querySelector('.menu').hidden = true; b.setAttribute('aria-expanded', 'false'); openMenu.closest('.ad-card, tr, .an-card')?.classList.remove('has-menu'); openMenu = null; if (restore) b.focus(); };
    document.addEventListener('click', e => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); });
    main.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('[data-add]')) { act.enquiryForm(); return; }
      if (t.closest('[data-retry]')) { load(); return; }
      if (t.closest('[data-reset]')) { Object.keys(f).forEach(k => { f[k] = ''; }); main.querySelectorAll('[data-f]').forEach(i => { i.value = ''; }); paint(); $('#ad-q').focus(); return; }
      const vb = t.closest('[data-view]');
      if (vb) { view = vb.dataset.view; syncUrl(); paint(); main.querySelector(`[data-view="${view}"]`).focus(); return; }
      const sb = t.closest('[data-sort]');
      if (sb) { if (sort.key === sb.dataset.sort) sort.dir *= -1; else { sort.key = sb.dataset.sort; sort.dir = 1; } paint(); main.querySelector(`[data-sort="${sort.key}"]`)?.focus(); return; }
      const mb = t.closest('[data-menu]');
      if (mb) {
        const wrap = mb.closest('.menu-wrap');
        if (openMenu === wrap) { closeMenu(); return; }
        closeMenu();
        const m = wrap.querySelector('.menu');
        m.hidden = false;
        m.classList.toggle('is-up', mb.getBoundingClientRect().bottom + 300 > innerHeight);
        mb.setAttribute('aria-expanded', 'true');
        wrap.closest('.ad-card, tr, .an-card')?.classList.add('has-menu');
        openMenu = wrap;
        m.querySelector('button').focus();
        return;
      }
      const op = t.closest('[data-open]');
      if (op) { closeMenu(); location.href = applicantUrl(op.dataset.open); return; }
      const mv = t.closest('[data-move]');
      if (mv) { closeMenu(true); act.move(mv.dataset.id, mv.dataset.move); return; }
      const card = t.closest('[data-card]');
      if (card && !t.closest('a, button, .menu-wrap')) location.href = applicantUrl(card.dataset.card);
    });
    main.addEventListener('input', e => { if (e.target.dataset.f === 'q') { f.q = e.target.value; paint(); } });
    main.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.f && t.dataset.f !== 'q') { f[t.dataset.f] = t.value; paint(); return; }
      if (t.matches('[data-mstage]')) { mStage = t.value; syncUrl(); paint(); main.querySelector('#ad-mstage')?.focus(); return; }
      if (t.matches('[data-sortsel]')) { sort.key = t.value; sort.dir = t.value === 'created' ? -1 : 1; paint(); main.querySelector('#ad-sortsel')?.focus(); }
    });
    main.addEventListener('keydown', e => {
      if (!openMenu) return;
      const items = [...openMenu.querySelectorAll('.menu button:not(:disabled)')];
      const i = items.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
      else if (e.key === 'Tab') closeMenu();
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); }
    });
    // Drag and drop between columns (desktop and tablet). The ⋯ menu does the same without a mouse.
    let dragId = null;
    main.addEventListener('dragstart', e => { const c = e.target.closest('[data-card][draggable="true"]'); if (!c) return; dragId = c.dataset.card; c.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); });
    main.addEventListener('dragover', e => { const col = e.target.closest('[data-col]'); if (!dragId || !col) return; e.preventDefault(); main.querySelectorAll('.ad-col.is-over').forEach(x => x !== col && x.classList.remove('is-over')); col.classList.add('is-over'); });
    main.addEventListener('dragleave', e => { const col = e.target.closest('[data-col]'); if (col && !col.contains(e.relatedTarget)) col.classList.remove('is-over'); });
    main.addEventListener('drop', e => { const col = e.target.closest('[data-col]'); if (!dragId || !col) return; e.preventDefault(); const id = dragId; dragId = null; main.querySelectorAll('.is-over, .is-dragging').forEach(x => x.classList.remove('is-over', 'is-dragging')); act.move(id, col.dataset.col); });
    main.addEventListener('dragend', () => { dragId = null; main.querySelectorAll('.is-over, .is-dragging').forEach(x => x.classList.remove('is-over', 'is-dragging')); });
    mobileQ.addEventListener('change', () => { if (loaded) paint(); });
    let queued = false;
    store.subscribe(({ key }) => { if (!loaded || (key && !/^nexora-(admission-enquiries|children|families|demo-role|school-plan)/.test(key)) || queued) return; queued = true; setTimeout(() => { queued = false; if (!openMenu && !document.querySelector('dialog[open]')) paint(); else if (!openMenu) { kpis(store.getAdmissionEnquiries()); } }, 0); });
    function load() {
      setTimeout(() => {
        if (failOnce) { failOnce = false; $('[data-kpis]').innerHTML = ''; $('[data-panel]').removeAttribute('aria-busy'); $('[data-panel]').innerHTML = state('alert-circle', 'Enquiries couldn’t load', 'Something went wrong while reading admissions on this device. Nothing was changed.', '<button class="btn btn--primary kids-yellow" type="button" data-retry>Try again</button>', 'error'); return; }
        loaded = true;
        paint();
      }, 250);
    }
    load();
  }

  /* ================================================================= S07 applicant details */

  function applicant(main, user, id) {
    const act = actions(user, () => draw());
    const back = `<a class="btn btn--secondary" href="${routes.page('admissions')}">${icon('arrow-left', 'icon--sm')}Back to pipeline</a>`;
    const TYPE_ICON = { created: 'user-plus', owner: 'user', stage: 'arrow-right', lost: 'x', followup: 'calendar-check', edit: 'pencil', 'enrol-started': 'file', enrolled: 'check-circle' };
    function draw() {
      const e = store.getAdmissionEnquiries().find(x => x.id === id);
      if (!e) { main.innerHTML = `<div class="kids">${state('user', 'Applicant not found', 'The enquiry may have been removed, or the link is incomplete.', back)}</div>`; return; }
      document.title = `${e.child} · Admissions · Nexora`;
      const age = store.ageAt(e.dob, e.preferredStart);
      const dup = store.enquiryDuplicates(e, e.id);
      const canEnrol = store.canManageChildren(user) && !['enrolled'].includes(e.stage);
      const ev = e.history.slice().reverse();
      const focusId = document.activeElement?.id;
      main.innerHTML = `<div class="kids ad-app">
        <nav class="kids-crumbs" aria-label="Breadcrumb"><a href="${routes.page('admissions')}">Admissions</a> / <span aria-current="page">${esc(e.child)}</span></nav>
        <header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">${esc(e.child)}</h1>
          <div class="an-tags ad-app__tags">${chip(STAGE_TONE[e.stage], store.ENQUIRY_STAGES[e.stage])}${daysChip(e)}<span class="cp-muted">Ref ${esc(e.id)}${e.demo ? ' · demo sample' : ''}</span></div></div>
          <div class="an-head__actions">
            ${e.stage !== 'enrolled' ? `<div class="menu-wrap"><button class="btn btn--secondary" type="button" aria-haspopup="menu" aria-expanded="false" data-amenu>${icon('arrow-right', 'icon--sm')}Move to…</button><div class="menu" role="menu" hidden>${STAGES.filter(s => s !== e.stage && s !== 'enrolled').map(s => `<button type="button" role="menuitem" data-move="${s}"${s === 'lost' ? ' class="is-danger"' : ''}>${s === 'lost' ? 'Mark lost…' : `Move to ${store.ENQUIRY_STAGES[s]}`}</button>`).join('')}</div></div>` : ''}
            <button class="btn btn--secondary" type="button" data-edit>${icon('pencil', 'icon--sm')}Edit details</button>
            ${canEnrol ? `<button class="btn btn--primary kids-yellow" type="button" data-enrol>${icon('user-plus', 'icon--sm')}Continue to enrolment</button>` : ''}
          </div></header>
        ${dup.enquiries.length || dup.families.length ? `<p class="ls-banner ls-banner--warn">${icon('alert-triangle', 'icon--sm')}<span>Same phone or email as ${[...dup.enquiries.map(x => `<a href="${applicantUrl(x.id)}">${esc(x.child)}</a> (${esc(store.ENQUIRY_STAGES[x.stage])})`), ...dup.families.map(x => `the <a href="${routes.page('family', { id: x.id })}">${esc(x.name)}</a>`)].join(', ')}.</span></p>` : ''}
        ${e.stage === 'enrolled' && e.childId ? `<p class="ls-banner ls-banner--ok">${icon('check-circle', 'icon--sm')}<span>Enrolled. <a href="${routes.record(e.childId)}">Open ${esc(e.child)}’s record</a>${e.familyId ? ` · <a href="${routes.page('family', { id: e.familyId })}">family</a>` : ''}.</span></p>` : ''}
        ${e.stage === 'lost' && e.lost ? `<p class="ls-banner">${icon('info', 'icon--sm')}<span>Marked lost ${esc(when(e.lost.at))} by ${esc(e.lost.by)} — ${esc(store.LOST_REASONS[e.lost.reason] || 'Other')}${e.lost.detail ? `: ${esc(e.lost.detail)}` : ''}. Move it to another stage to reopen it.</span></p>` : ''}
        <div class="ad-app__grid">
          <section class="panel ad-box" aria-labelledby="ad-det-h"><h2 class="cd-h2" id="ad-det-h">Applicant</h2>
            <dl class="token-sheet ad-dl">
              <div><dt>Child</dt><dd>${esc(e.child)}</dd></div>
              <div><dt>Date of birth</dt><dd>${e.dob ? esc(fmt(e.dob)) : '<span class="cp-muted">Not recorded</span>'}</dd></div>
              <div><dt>Age at start</dt><dd>${age ? `${age.years}y ${age.months}m` : '<span class="cp-muted">Needs a date of birth</span>'}</dd></div>
              <div><dt>Programme</dt><dd>${esc(e.programme)}</dd></div>
              <div><dt>Preferred start</dt><dd>${esc(fmt(e.preferredStart))}</dd></div>
              <div><dt>Parent / guardian</dt><dd>${esc(e.parent)}</dd></div>
              <div><dt>Phone</dt><dd><a href="tel:${esc(String(e.phone).replace(/[^\d+]/g, ''))}">${esc(e.phone)}</a></dd></div>
              <div><dt>Email</dt><dd>${e.email ? `<a href="mailto:${esc(e.email)}">${esc(e.email)}</a>` : '<span class="cp-muted">—</span>'}</dd></div>
              <div><dt>Source</dt><dd>${esc(store.ENQUIRY_SOURCES[e.source] || 'Other')}</dd></div>
              <div><dt>Owner</dt><dd>${esc(ownerName(e.ownerId) || 'Unassigned')}</dd></div>
              ${e.tourAt ? `<div><dt>Tour</dt><dd>${esc(when(e.tourAt))}${new Date(e.tourAt) < new Date() ? ' (past)' : ''}</dd></div>` : ''}
              <div><dt>Created</dt><dd>${esc(when(e.createdAt))} by ${esc(e.createdBy)}</dd></div>
            </dl>
            ${e.notes ? `<p class="pt-text ad-notes">${esc(e.notes)}</p>` : ''}
          </section>
          <section class="panel ad-box" aria-labelledby="ad-fu-h"><h2 class="cd-h2" id="ad-fu-h">Next follow-up</h2>
            <p>${followText(e)}</p>
            <form class="ad-fuform" data-fuform novalidate><label class="field__label" for="ad-fu">Follow-up date</label><div class="pt-link__row"><input class="input" type="date" id="ad-fu" value="${esc(e.followUp || '')}"><button class="btn btn--secondary btn--sm" type="submit">Save</button>${e.followUp ? '<button class="btn btn--tertiary btn--sm" type="button" data-fuclear>Clear</button>' : ''}</div><p class="field__hint field__hint--error" data-fuerr hidden></p></form>
            <p class="cd-note">No automatic email or SMS reminders are sent — overdue follow-ups are highlighted here and on the pipeline.</p>
          </section>
          <section class="panel ad-box ad-box--wide" aria-labelledby="ad-tl-h"><h2 class="cd-h2" id="ad-tl-h">Timeline</h2>
            <ol class="ad-tl">${ev.map(x => `<li class="ad-tl__item ad-tl__item--${esc(x.type)}"><span class="ad-tl__ic" aria-hidden="true">${icon(TYPE_ICON[x.type] || 'info', 'icon--sm')}</span><div><p>${esc(x.type === 'stage' ? `Stage changed: ${store.ENQUIRY_STAGES[x.from] || x.from} → ${store.ENQUIRY_STAGES[x.to]}` : x.type === 'lost' ? `Marked Lost (${store.ENQUIRY_STAGES[x.from] || ''} → Lost)` : x.type === 'enrolled' ? `Stage changed: ${store.ENQUIRY_STAGES[x.from] || ''} → Enrolled` : x.detail)}</p>${(x.type === 'stage' || x.type === 'lost' || x.type === 'enrolled') && x.detail ? `<small>${esc(x.detail)}</small>` : ''}<small>${esc(when(x.at))} · ${esc(x.by)}</small></div></li>`).join('')}</ol>
          </section>
        </div></div>`;
      if (focusId && main.querySelector(`#${CSS.escape(focusId)}`)) main.querySelector(`#${CSS.escape(focusId)}`).focus();
    }
    main.addEventListener('click', async ev => {
      const t = ev.target;
      const e = store.getAdmissionEnquiries().find(x => x.id === id);
      if (!e) return;
      if (t.closest('[data-amenu]')) { const m = main.querySelector('[data-amenu] + .menu'); m.hidden = !m.hidden; t.closest('[data-amenu]').setAttribute('aria-expanded', String(!m.hidden)); if (!m.hidden) m.querySelector('button').focus(); return; }
      const mv = t.closest('[data-move]');
      if (mv) { main.querySelector('[data-amenu] + .menu').hidden = true; act.move(id, mv.dataset.move); return; }
      if (t.closest('[data-edit]')) { act.enquiryForm(e); return; }
      if (t.closest('[data-enrol]')) { act.enrolDialog(e); return; }
      if (t.closest('[data-fuclear]')) { const r = await store.setEnquiryFollowUp(store.currentUser(), id, ''); toast(r.ok ? 'Follow-up cleared' : 'Not saved', r.ok ? e.child : failText(r), r.ok ? 'check-circle' : 'alert-circle'); return; }
      const menu = main.querySelector('[data-amenu] + .menu');
      if (menu && !menu.hidden && !t.closest('.menu-wrap')) menu.hidden = true;
    });
    main.addEventListener('keydown', ev => { const m = main.querySelector('[data-amenu] + .menu'); if (ev.key === 'Escape' && m && !m.hidden) { m.hidden = true; main.querySelector('[data-amenu]').focus(); } });
    main.addEventListener('submit', async ev => {
      if (!ev.target.matches('[data-fuform]')) return;
      ev.preventDefault();
      const r = await store.setEnquiryFollowUp(store.currentUser(), id, main.querySelector('#ad-fu').value);
      const err = main.querySelector('[data-fuerr]');
      if (!r.ok) { err.textContent = failText(r); err.hidden = false; return; }
      toast(r.unchanged ? 'No change' : 'Follow-up saved', r.enquiry.followUp ? fmt(r.enquiry.followUp) : 'Cleared', 'check-circle');
    });
    store.subscribe(({ key }) => { if (!key || /^nexora-admission-enquiries/.test(key)) { if (!document.querySelector('dialog[open]')) draw(); } });
    draw();
  }

  window.NexoraAdmissions = { render };
})();
