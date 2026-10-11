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
    'offer-via-send': 'Use Send offer — the stage changes when the offer is sent.',
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
    const fu = store.nextFollowUp(e);
    if (!fu) return '<span class="cp-muted">No follow-up set</span>';
    const t = store.today();
    if (['enrolled', 'lost'].includes(e.stage)) return `<span class="cp-muted">Follow-up ${esc(fmt(fu, { day: 'numeric', month: 'short' }))}</span>`;
    if (fu < t) return `<span class="ad-fu is-over">${icon('alert-triangle', 'icon--sm')}Follow-up overdue · ${esc(fmt(fu, { day: 'numeric', month: 'short' }))}</span>`;
    if (fu === t) return `<span class="ad-fu is-today">${icon('phone', 'icon--sm')}Follow up today</span>`;
    return `<span class="ad-fu">${icon('calendar-check', 'icon--sm')}Follow up ${esc(fmt(fu, { weekday: 'short', day: 'numeric', month: 'short' }))}</span>`;
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
        label: 'Admissions', title: 'Book a tour', desc: `${esc(e.child)} moves to <b>Tour booked</b>. Add the tour time so it counts in “Tours booked”; leave it empty if it isn’t scheduled yet. To book a real slot with a guide and capacity, use <a href="${routes.page('tours')}">School Tours</a>.`,
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
      else if (to === 'offer') offerDialog(e);
      else doMove(e, to);
    }

    // Send offer: edit the starter letter → preview with every variable resolved (missing ones marked) → send.
    // There's no email service, so a send is recorded as a labelled demo; only then does the stage move to Offer sent.
    function offerDialog(e, failSend = { on: params.get('sendfail') === '1' }) {
      if (!store.canOffer(e)) { toast('Offer not available', e.stage === 'enrolled' ? 'This child is already enrolled.' : 'Reopen the enquiry before sending an offer.', 'info'); return; }
      const newCid = () => `cl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      let clientId = newCid();
      let stage = 1;
      const v0 = store.offerValues(e);
      const d = kids.dialog({
        label: 'Admissions / Offer', title: 'Send offer', desc: `${esc(e.child)} · step 1 of 3: edit the letter`,
        body: `<div class="ad-offer"><div data-s1>
            ${kids.field('kd-recipient', 'Send to', `<input class="input" id="kd-recipient" name="recipient" type="email" required value="${esc(e.email || '')}" placeholder="family@example.com">`, { required: true })}
            ${kids.field('kd-template', 'Offer letter', `<textarea class="input ad-offer__text" id="kd-template" name="template" rows="11" maxlength="6000">${esc(store.OFFER_TEMPLATE)}</textarea>`, { hint: 'Variables: {{child_name}}, {{start_date}}, {{fees}}. This is an editable starter template, not approved legal wording.' })}
            <div class="cls-form__row">${kids.field('kd-ostart', 'Start date in the letter', `<input class="input" id="kd-ostart" name="ostart" maxlength="60" value="${esc(v0.start_date)}" placeholder="Missing — add the start date">`)}${kids.field('kd-ofees', 'Fees in the letter', `<input class="input" id="kd-ofees" name="ofees" maxlength="120" value="${esc(v0.fees)}" placeholder="Missing — not in the fee table">`, { hint: v0.fees ? 'From the school’s fee table.' : `No fee is set for ${e.programme}. Enter the agreed fee.` })}</div>
            <button class="btn btn--tertiary btn--sm" type="button" data-odraft>${icon('pencil', 'icon--sm')}Save as draft (not sent)</button>
          </div><div data-s2 hidden></div></div>`,
        submit: 'Preview',
        async onSubmit(form) {
          const template = form.elements.template.value;
          const values = { start_date: form.elements.ostart.value.trim(), fees: form.elements.ofees.value.trim() };
          const vals = { child_name: e.child, start_date: values.start_date, fees: values.fees };
          const out = store.renderOffer(template, vals);
          const s1 = form.querySelector('[data-s1]');
          const s2 = form.querySelector('[data-s2]');
          const desc = form.closest('dialog').querySelector('.modal__desc');
          const toEdit = () => { stage = 1; s1.hidden = false; s2.hidden = true; desc.innerHTML = `${esc(e.child)} · step 1 of 3: edit the letter`; };
          const badTo = !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.elements.recipient.value.trim());
          if (stage === 2 && (out.missing.length || out.unknown.length || badTo)) { toEdit(); return { keepOpen: true, submitLabel: 'Preview' }; }
          if (stage === 1) {
            stage = 2;
            const marked = esc(out.text).replace(/\{\{\s*([a-z_]+)\s*\}\}/g, m => `<mark class="ad-offer__miss">${m}</mark>`);
            const blocked = out.missing.length || out.unknown.length || badTo;
            s2.innerHTML = `<p class="cd-note">To <b>${esc(form.elements.recipient.value || '—')}</b></p><div class="ad-offer__preview" aria-label="Letter preview">${marked.replace(/\n/g, '<br>')}</div>
              ${blocked ? `<p class="field__hint field__hint--error" role="alert">${icon('info')}${badTo ? 'Add the family’s email address before sending. ' : ''}${!out.missing.length && !out.unknown.length ? '' : out.missing.length ? `Missing: ${out.missing.map(k => `{{${k}}}`).join(', ')}. Go back and fill ${out.missing.length === 1 ? 'it' : 'them'} in — nothing is made up.` : `Unknown variable: ${out.unknown.map(k => `{{${k}}}`).join(', ')}.`}</p>` : '<p class="cd-note">No email service is connected: sending records the offer as a <b>demo send — the family won’t receive it</b>. The stage then moves to Offer sent.</p>'}
              <button class="btn btn--tertiary btn--sm" type="button" data-oback>${icon('arrow-left', 'icon--sm')}Back to edit</button>`;
            s1.hidden = true;
            s2.hidden = false;
            desc.innerHTML = `${esc(e.child)} · step 2 of 3: preview`;
            s2.querySelector('[data-oback]').addEventListener('click', () => { toEdit(); form.querySelector('[type="submit"]').textContent = 'Preview'; form.elements.template.focus(); });
            return { keepOpen: true, submitLabel: blocked ? 'Back to edit' : 'Send offer' };
          }
          desc.innerHTML = `${esc(e.child)} · step 3 of 3: sending`;
          const r = await store.sendOffer(me(), e.id, { template, values, recipient: form.elements.recipient.value, clientId, fail: failSend.on });
          failSend.on = false;
          if (!r.ok) {
            clientId = newCid();
            if (r.errors) { toEdit(); return { ok: false, errors: r.errors }; }
            desc.innerHTML = `${esc(e.child)} · step 2 of 3: preview`;
            return { ok: false, message: r.reason === 'send-failed' ? `The offer couldn’t be sent. Nothing changed — ${e.child} is still in ${store.ENQUIRY_STAGES[e.stage]}. Try again.` : failText(r) };
          }
          toast('Offer recorded as sent', `Demo — not delivered (no email service).${r.moved ? ' Stage: Offer sent.' : ''}`, 'mail', { duration: 7000 });
          onDone();
          return { ok: true };
        }
      });
      d.form.querySelector('[data-odraft]').addEventListener('click', async ev => {
        const b = ev.currentTarget;
        b.disabled = true;
        const r = await store.saveOfferDraft(me(), e.id, { template: d.form.elements.template.value, values: { start_date: d.form.elements.ostart.value.trim(), fees: d.form.elements.ofees.value.trim() } });
        b.disabled = false;
        toast(r.ok ? 'Draft saved' : 'Not saved', r.ok ? 'Not sent — the stage hasn’t changed.' : failText(r), r.ok ? 'pencil' : 'alert-circle');
        if (r.ok) onDone();
      });
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
    return { move, enquiryForm, lostDialog, enrolDialog, offerDialog, busy };
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
      const val = { name: e => e.child.toLowerCase(), stage: e => STAGES.indexOf(e.stage), start: e => e.preferredStart || '9', created: e => e.createdAt, followup: e => store.nextFollowUp(e) || '9' };
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
    const me = () => store.currentUser();
    const back = `<a class="btn btn--secondary" href="${routes.page('admissions')}">${icon('arrow-left', 'icon--sm')}Back to pipeline</a>`;
    const TYPE_ICON = { created: 'user-plus', owner: 'user', stage: 'arrow-right', lost: 'x', followup: 'calendar-check', edit: 'pencil', 'enrol-started': 'file', enrolled: 'check-circle', note: 'note', call: 'phone', email: 'mail', task: 'list', document: 'upload', offer: 'file', sibling: 'users', tour: 'calendar-check' };
    const TRACK = ['enquiry', 'tour', 'applied', 'offer', 'enrolled'];
    const owners = store.admissionsOwners();
    const canEnrol = store.canManageChildren(user);
    let mtab = ['timeline', 'details', 'documents', 'tasks'].includes(params.get('tab')) ? params.get('tab') : 'timeline';
    let tlFilter = '';
    const failSend = { on: params.get('sendfail') === '1' };
    const find = () => store.getAdmissionEnquiries().find(x => x.id === id);
    const cid = () => `cl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const ageLabel = e => { const at = e.preferredStart || store.today(); const a = store.ageAt(e.dob, at); return a ? `${a.years}y ${a.months}m${e.preferredStart ? ' at start' : ''}` : e.dob ? 'Age unknown' : 'No date of birth'; };
    const owner = id_ => owners.find(o => o.id === id_) || null;
    const av = name => `<span class="ad-av s7-av" aria-hidden="true">${esc(initials(name))}</span>`;

    function tracker(e) {
      const reached = e.stage === 'lost' ? (e.history.slice().reverse().find(h => h.type === 'lost')?.from || 'enquiry') : e.stage;
      const ri = TRACK.indexOf(reached);
      const pills = TRACK.map((s, i) => { const st = e.stage === s ? 'current' : e.stage !== 'lost' && i < ri ? 'done' : e.stage === 'lost' && i <= ri ? 'done' : 'future'; return `<li class="s7-pill is-${st}"${st === 'current' ? ' aria-current="step"' : ''}>${st === 'done' ? icon('check', 'icon--sm') : `<span class="s7-pill__n">${i + 1}</span>`}<span>${store.ENQUIRY_STAGES[s]}</span><span class="sr-only">${st === 'current' ? ' (current stage)' : st === 'done' ? ' (completed)' : ' (not reached)'}</span></li>`; }).join('');
      return `<nav class="s7-track" aria-label="Admissions stage"><ol>${pills}<li class="s7-pill s7-pill--lost is-${e.stage === 'lost' ? 'current' : 'future'}"${e.stage === 'lost' ? ' aria-current="step"' : ''}>${icon('x', 'icon--sm')}<span>Lost</span><span class="sr-only">${e.stage === 'lost' ? ' (current stage)' : ' (not reached)'}</span></li></ol></nav>`;
    }
    const tlTitle = x => ({
      created: 'Enquiry created', owner: x.detail, followup: x.detail, edit: x.detail, note: 'Note', call: `Call · ${store.CALL_OUTCOMES[x.outcome] || ''}`, email: `Email · ${x.subject || ''}`, task: x.detail, document: x.detail, sibling: x.detail,
      stage: `Stage changed: ${store.ENQUIRY_STAGES[x.from] || x.from || '—'} → ${store.ENQUIRY_STAGES[x.to]}`, lost: `Marked Lost (${store.ENQUIRY_STAGES[x.from] || ''} → Lost)`, enrolled: `Converted to enrolled (${store.ENQUIRY_STAGES[x.from] || ''} → Enrolled)`, 'enrol-started': 'Enrolment started', offer: x.action === 'sent' ? 'Offer sent' : x.action === 'failed' ? 'Offer send failed' : 'Offer drafted'
    }[x.type] || x.detail || x.type);
    const tlBody = x => {
      if (x.type === 'note') return `<p class="pt-text">${esc(x.detail)}</p>`;
      if (x.type === 'call') return x.detail ? `<p class="pt-text">${esc(x.detail)}</p>` : '';
      if (x.type === 'email') return `<p class="s7-meta">To ${esc(x.to)} · <b>${esc(x.delivery)}</b></p><p class="pt-text s7-clip">${esc(x.detail)}</p>`;
      if (['stage', 'lost', 'enrolled', 'offer', 'enrol-started'].includes(x.type) && x.detail) return `<p class="s7-meta">${esc(x.detail)}</p>`;
      if (x.type === 'created' && x.detail && x.detail !== 'Enquiry created') return `<p class="s7-meta">${esc(x.detail.replace(/^Enquiry created · ?/, ''))}</p>`;
      return '';
    };
    const TL_GROUPS = [['', 'All'], ['comms', 'Calls, emails & notes'], ['stage', 'Stage changes'], ['other', 'Tasks & documents']];
    const inGroup = x => !tlFilter || (tlFilter === 'comms' ? ['note', 'call', 'email'].includes(x.type) : tlFilter === 'stage' ? ['stage', 'lost', 'enrolled', 'created', 'offer', 'enrol-started'].includes(x.type) : ['task', 'document', 'followup', 'sibling', 'owner', 'edit'].includes(x.type));

    function draw() {
      const e = find();
      if (!e) { main.innerHTML = `<div class="kids">${state('user', 'Applicant not found', 'The enquiry may have been removed, or the link is incomplete.', back)}</div>`; return; }
      document.title = `${e.child} · Admissions · Nexora`;
      const o = owner(e.ownerId);
      const tasks = (e.tasks || []).slice().sort((a, b) => (a.status === b.status ? `${a.due}${a.time}`.localeCompare(`${b.due}${b.time}`) : a.status === 'open' ? -1 : 1));
      const overdue = tasks.filter(t => store.taskOverdue(t)).length;
      const sibs = store.enquirySiblings(e);
      const dup = store.enquiryDuplicates(e, e.id);
      const docsN = Object.keys(e.documents || {}).length;
      const offerOk = store.canOffer(e);
      const enrolOk = canEnrol && !['enrolled', 'lost'].includes(e.stage);
      const focusId = document.activeElement?.id;
      const ev = e.history.slice().sort((a, b) => b.at.localeCompare(a.at));
      const shown = ev.filter(inGroup);
      main.innerHTML = `<div class="kids s7" data-mtab="${mtab}">
        <nav class="kids-crumbs" aria-label="Breadcrumb"><a href="${routes.page('admissions')}">Admissions</a> / <a href="${routes.page('admissions', { view: 'list' })}">Enquiries</a> / <span aria-current="page">${esc(e.child)}</span></nav>
        <header class="s7-head">
          <div class="s7-head__main">
            <h1 class="kids-head__title" id="page-title" tabindex="-1">${esc(e.child)}</h1>
            <p class="s7-head__facts">${esc(ageLabel(e))} · ${esc(e.programme)} · Starts ${esc(fmt(e.preferredStart, { day: 'numeric', month: 'long', year: 'numeric' }))}</p>
            <div class="an-tags s7-head__tags">${chip(STAGE_TONE[e.stage], store.ENQUIRY_STAGES[e.stage])}${daysChip(e)}<span class="s7-owner">${o ? `${av(o.name)}<span>Owner: <b>${esc(o.name)}</b></span>` : '<span class="cp-muted">No owner assigned</span>'}</span><span class="cp-muted">Ref ${esc(e.id)}${e.demo ? ' · demo sample' : ''}</span></div>
          </div>
          <div class="s7-head__actions">
            ${e.stage !== 'enrolled' ? `<button class="btn btn--primary kids-yellow" type="button" data-movestage>${icon('arrow-right', 'icon--sm')}Move stage</button>` : ''}
            ${offerOk ? `<button class="btn btn--secondary" type="button" data-offer>${icon('mail', 'icon--sm')}${e.stage === 'offer' ? 'Resend offer' : 'Send offer'}</button>` : ''}
            ${enrolOk ? `<button class="btn btn--secondary" type="button" data-enrol>${icon('user-plus', 'icon--sm')}Convert to enrolled</button>` : ''}
            <div class="menu-wrap"><button class="btn btn--icon-ghost" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="More actions" data-more>${icon('more-v')}</button>
              <div class="menu" role="menu" hidden><button type="button" role="menuitem" data-editfam>${icon('pencil', 'icon--sm')}Edit applicant</button><button type="button" role="menuitem" data-reassign>${icon('user', 'icon--sm')}Reassign owner</button><button type="button" role="menuitem" data-copyref>${icon('copy', 'icon--sm')}Copy reference</button>${!['lost', 'enrolled'].includes(e.stage) ? `<hr><button type="button" role="menuitem" class="is-danger" data-lost>${icon('x', 'icon--sm')}Mark lost…</button>` : ''}</div></div>
          </div>
        </header>
        ${tracker(e)}
        ${!enrolOk && canEnrol === false && !['enrolled', 'lost'].includes(e.stage) ? '<p class="cd-note">Only school leaders can convert an applicant to enrolled.</p>' : ''}
        ${dup.enquiries.length || dup.families.length ? `<p class="ls-banner ls-banner--warn">${icon('alert-triangle', 'icon--sm')}<span>Same phone or email as ${[...dup.enquiries.map(x => `<a href="${applicantUrl(x.id)}">${esc(x.child)}</a> (${esc(store.ENQUIRY_STAGES[x.stage])})`), ...dup.families.map(x => `the <a href="${routes.page('family', { id: x.id })}">${esc(x.name)}</a>`)].join(', ')}.</span></p>` : ''}
        ${e.stage === 'enrolled' && e.childId ? `<p class="ls-banner ls-banner--ok">${icon('check-circle', 'icon--sm')}<span>Converted to enrolled. <a href="${routes.record(e.childId)}">Open ${esc(e.child)}’s record</a>${e.familyId ? ` · <a href="${routes.page('family', { id: e.familyId })}">Family</a>` : ''}. The applicant history below is kept.</span></p>` : ''}
        ${e.stage === 'lost' && e.lost ? `<p class="ls-banner">${icon('info', 'icon--sm')}<span>Lost ${esc(when(e.lost.at))} · ${esc(store.LOST_REASONS[e.lost.reason] || 'Other')}${e.lost.detail ? `: ${esc(e.lost.detail)}` : ''} · ${esc(e.lost.by)}. Use Move stage to reopen.</span></p>` : ''}
        <div class="tabs s7-tabs" role="tablist" aria-label="Applicant sections">${[['timeline', 'Timeline'], ['details', 'Details'], ['documents', 'Documents'], ['tasks', 'Tasks']].map(([k, l]) => `<button class="tab" type="button" role="tab" id="s7-tab-${k}" aria-selected="${mtab === k}" tabindex="${mtab === k ? 0 : -1}" data-mtab="${k}">${l}${k === 'tasks' && overdue ? `<span class="tab__count s7-od">${overdue}</span>` : k === 'documents' ? `<span class="tab__count">${docsN}/4</span>` : ''}</button>`).join('')}</div>
        <div class="s7-grid">
          <div class="s7-col s7-col--main" data-group="timeline">
            <section class="panel s7-card s7-composer" aria-labelledby="s7-comp-h"><h2 class="cd-h2" id="s7-comp-h">Log a note / call / email</h2>
              <form class="s7-note" data-noteform novalidate><label class="sr-only" for="s7-note">Note</label><textarea class="input" id="s7-note" rows="3" maxlength="2000" placeholder="Write a note about this family…" aria-describedby="s7-note-err"></textarea><p class="field__hint field__hint--error" id="s7-note-err" data-noteerr hidden></p>
                <div class="s7-composer__acts"><button class="btn btn--primary kids-yellow btn--sm" type="submit">${icon('note', 'icon--sm')}Save note</button><button class="btn btn--secondary btn--sm" type="button" data-call>${icon('phone', 'icon--sm')}Log call</button><button class="btn btn--secondary btn--sm" type="button" data-email>${icon('mail', 'icon--sm')}Log email</button></div>
                <p class="cd-note">Notes are internal to school staff — families don’t have a portal yet.</p></form>
            </section>
            <section class="panel s7-card" aria-labelledby="s7-tl-h"><div class="s7-card__head"><h2 class="cd-h2" id="s7-tl-h">Timeline</h2><label class="sr-only" for="s7-tlf">Show</label><select class="input input--sm" id="s7-tlf" data-tlf>${TL_GROUPS.map(([k, l]) => `<option value="${k}"${tlFilter === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
              ${!ev.length ? state('note', 'No activity yet', 'Record your first call, email, or note to start this applicant’s history.') : !shown.length ? '<p class="cp-muted">Nothing of this kind yet.</p>' : `<ol class="ad-tl s7-tl">${shown.map(x => `<li class="ad-tl__item ad-tl__item--${esc(x.type)}"><span class="ad-tl__ic" aria-hidden="true">${icon(TYPE_ICON[x.type] || 'info', 'icon--sm')}</span><div><p>${esc(tlTitle(x))}</p>${tlBody(x)}<small>${esc(when(x.at))} · ${esc(x.by)}</small></div></li>`).join('')}</ol>`}
            </section>
          </div>
          <div class="s7-col s7-col--side">
            <section class="panel s7-card" data-group="details" aria-labelledby="s7-fam-h"><div class="s7-card__head"><h2 class="cd-h2" id="s7-fam-h">Family details</h2><button class="btn btn--tertiary btn--sm" type="button" data-editfam>${icon('pencil', 'icon--sm')}Edit</button></div>
              <dl class="token-sheet ad-dl"><div><dt>Parent / guardian</dt><dd>${esc(e.parent)}</dd></div><div><dt>Phone</dt><dd><a href="tel:${esc(String(e.phone).replace(/[^\d+]/g, ''))}">${esc(e.phone)}</a></dd></div><div><dt>Email</dt><dd>${e.email ? `<a href="mailto:${esc(e.email)}">${esc(e.email)}</a>` : '<span class="cp-muted">Not given</span>'}</dd></div>
                <div><dt>Prefers</dt><dd>${e.contactMethod ? esc(store.CONTACT_METHODS[e.contactMethod]) : '<span class="cp-muted">Not given</span>'}</dd></div><div><dt>Language</dt><dd>${e.language ? esc(e.language) : '<span class="cp-muted">Not given</span>'}</dd></div><div><dt>Address</dt><dd>${e.address ? esc(e.address) : '<span class="cp-muted">Not given</span>'}</dd></div><div><dt>Owner</dt><dd>${o ? esc(o.name) : '<span class="cp-muted">Unassigned</span>'}</dd></div><div><dt>Source</dt><dd>${esc(store.ENQUIRY_SOURCES[e.source] || 'Other')}</dd></div></dl>
            </section>
            <section class="panel s7-card" data-group="details" aria-labelledby="s7-child-h"><div class="s7-card__head"><h2 class="cd-h2" id="s7-child-h">Child details</h2><button class="btn btn--tertiary btn--sm" type="button" data-editchild>${icon('pencil', 'icon--sm')}Edit</button></div>
              <dl class="token-sheet ad-dl"><div><dt>Name</dt><dd>${e.childId ? `<a href="${routes.record(e.childId)}">${esc(e.child)}</a>` : esc(e.child)}</dd></div><div><dt>Date of birth</dt><dd>${e.dob ? esc(fmt(e.dob)) : '<span class="cp-muted">Not given</span>'}</dd></div>
                <div><dt>Age</dt><dd>${(() => { const now = store.ageAt(e.dob, store.today()); const at = store.ageAt(e.dob, e.preferredStart); return now ? `${now.years}y ${now.months}m today${at ? ` · ${at.years}y ${at.months}m at start` : ''}` : '<span class="cp-muted">Needs a date of birth</span>'; })()}</dd></div>
                <div><dt>Programme</dt><dd>${esc(e.programme)}</dd></div><div><dt>Preferred start</dt><dd>${esc(fmt(e.preferredStart))}</dd></div><div><dt>Previous school</dt><dd>${e.previousSchool ? esc(e.previousSchool) : '<span class="cp-muted">Not given</span>'}</dd></div>${e.tourAt ? `<div><dt>Tour</dt><dd>${esc(when(e.tourAt))}${new Date(e.tourAt) < new Date() ? ' (past)' : ''}</dd></div>` : ''}</dl>
              ${e.childNotes || e.notes ? `<p class="pt-text ad-notes">${esc([e.notes, e.childNotes].filter(Boolean).join('\n\n'))}</p>` : ''}
            </section>
            <section class="panel s7-card" data-group="documents" aria-labelledby="s7-doc-h"><div class="s7-card__head"><h2 class="cd-h2" id="s7-doc-h">Documents</h2><span class="cp-muted">${docsN} of 4 uploaded</span></div>
              <ul class="s7-docs">${Object.entries(store.APPLICANT_DOCS).map(([k, l]) => { const d = e.documents?.[k]; return `<li class="s7-doc${d ? ' is-up' : ''}" data-doc="${k}"><div class="s7-doc__main"><b>${esc(l)}</b>${d ? `<small>${esc(d.name)} · ${Math.max(1, Math.round(d.size / 1024))} KB · ${esc(fmt(d.at))}</small>` : `<small>${k === 'photo' ? 'JPEG or PNG' : 'PDF, JPEG or PNG'} · up to 1 MB</small>`}<span class="s7-doc__prog" data-prog="${k}" hidden><progress max="100" value="0" aria-label="Uploading ${esc(l)}"></progress></span><p class="field__hint field__hint--error" data-docerr="${k}" hidden></p></div>
                ${d ? chip('success', 'Uploaded', 'check') : chip('warning', 'Missing', 'alert-triangle')}
                <div class="s7-doc__acts"><input class="sr-only" type="file" id="s7-f-${k}" accept="${store.APPLICANT_DOC_TYPES[k].join(',')}" data-file="${k}"><label class="btn btn--${d ? 'tertiary' : 'secondary'} btn--sm" for="s7-f-${k}">${icon('upload', 'icon--sm')}${d ? 'Replace' : 'Upload'}<span class="sr-only"> ${esc(l)}</span></label>${d ? `<button class="btn btn--tertiary btn--sm" type="button" data-view="${esc(d.fileId)}">${icon('eye', 'icon--sm')}View<span class="sr-only"> ${esc(l)}</span></button><button class="btn btn--icon-ghost btn--sm" type="button" aria-label="Remove ${esc(l)}" data-rmdoc="${k}">${icon('trash', 'icon--sm')}</button>` : ''}</div></li>`; }).join('')}</ul>
              <p class="cd-note">Stored on this device for the prototype — not secure production storage. Copied to the child’s record on enrolment.</p>
            </section>
            <section class="panel s7-card" data-group="details" aria-labelledby="s7-sib-h"><div class="s7-card__head"><h2 class="cd-h2" id="s7-sib-h">Siblings</h2><button class="btn btn--tertiary btn--sm" type="button" data-linksib>${icon('plus', 'icon--sm')}Link existing child</button></div>
              ${sibs.length ? `<ul class="s7-sibs">${sibs.map(s => { const a = store.ageAt(s.dob, store.today()); return `<li>${av(s.name)}<div><a href="${routes.record(s.id)}">${esc(s.name)}</a><small>${esc(s.cls)}${a ? ` · ${a.years}y ${a.months}m` : ''}${s.viaFamily ? ' · same family' : ''}</small></div>${chip(s.status === 'active' ? 'success' : 'neutral', store.CHILD_STATUSES[s.status] || s.status)}${!s.viaFamily ? `<button class="btn btn--icon-ghost btn--sm" type="button" aria-label="Remove link to ${esc(s.name)}" data-unsib="${esc(s.id)}">${icon('x', 'icon--sm')}</button>` : ''}</li>`; }).join('')}</ul>` : `<div class="s7-empty"><p class="kids-empty__title">No siblings linked yet</p><p class="cp-muted">Link a brother or sister already at the school. Nothing is matched by name automatically.</p><button class="btn btn--secondary btn--sm" type="button" data-linksib>Link existing child</button></div>`}
            </section>
            <section class="panel s7-card" data-group="tasks" aria-labelledby="s7-task-h"><div class="s7-card__head"><h2 class="cd-h2" id="s7-task-h">Follow-up tasks</h2><button class="btn btn--tertiary btn--sm" type="button" data-addtask>${icon('plus', 'icon--sm')}Add follow-up</button></div>
              ${tasks.length ? `<ul class="s7-tasks">${tasks.map(t => { const od = store.taskOverdue(t); return `<li class="s7-task${t.status === 'done' ? ' is-done' : ''}${od ? ' is-over' : ''}"><div class="s7-task__main"><p>${esc(t.title)}</p><small>${t.status === 'done' ? `Completed ${esc(when(t.doneAt))} by ${esc(t.doneBy)}` : `Due ${esc(fmt(t.due, { weekday: 'short', day: 'numeric', month: 'short' }))}${t.time ? ` ${esc(t.time)}` : ''}`} · ${esc(owner(t.assigneeId)?.name || 'Unassigned')}</small></div>
                ${t.status === 'done' ? chip('success', 'Completed', 'check') : od ? chip('error', 'Overdue', 'alert-triangle') : chip('info', 'Open', 'clock')}
                <div class="s7-task__acts">${t.status === 'open' ? `<button class="btn btn--secondary btn--sm" type="button" data-done="${esc(t.id)}">${icon('check', 'icon--sm')}Complete<span class="sr-only">: ${esc(t.title)}</span></button><button class="btn btn--icon-ghost btn--sm" type="button" aria-label="Edit ${esc(t.title)}" data-edittask="${esc(t.id)}">${icon('pencil', 'icon--sm')}</button>` : `<button class="btn btn--tertiary btn--sm" type="button" data-reopen="${esc(t.id)}">Reopen</button>`}</div></li>`; }).join('')}</ul>` : `<div class="s7-empty"><p class="kids-empty__title">No follow-ups yet</p><p class="cp-muted">Plan the next call or visit so nothing slips.</p><button class="btn btn--secondary btn--sm" type="button" data-addtask>Add follow-up</button></div>`}
              ${e.followUp ? `<p class="cd-note">Pipeline follow-up date: ${esc(fmt(e.followUp))} <button class="btn btn--tertiary btn--sm" type="button" data-fuclear>Clear</button></p>` : ''}
            </section>
          </div>
        </div></div>`;
      if (focusId && main.querySelector(`#${CSS.escape(focusId)}`)) main.querySelector(`#${CSS.escape(focusId)}`).focus();
    }

    /* ---------------------------------------------------------------- Dialogs */

    function moveStageDialog(e) {
      const opts = Object.keys(store.ENQUIRY_STAGES).filter(s => s !== e.stage);
      const note = { offer: 'Opens Send offer — the stage changes only after the offer is sent.', enrolled: canEnrol ? 'Opens the enrolment form — the stage changes only when enrolment is saved.' : 'Only school leaders can enrol.', lost: 'Asks for a reason.', tour: 'Asks for the tour time.' };
      kids.dialog({
        label: 'Admissions', title: 'Move stage', desc: `${esc(e.child)} is in <b>${esc(store.ENQUIRY_STAGES[e.stage])}</b>. Choose where to move them.`,
        body: `<fieldset class="an-fs"><legend class="sr-only">New stage</legend><div class="s7-stages">${opts.map(s => `<label class="an-mode${s === 'enrolled' && !canEnrol ? ' is-off' : ''}"><input type="radio" name="tostage" value="${s}"${s === 'enrolled' && !canEnrol ? ' disabled' : ''}><span><b>${store.ENQUIRY_STAGES[s]}</b>${note[s] ? `<small>${esc(note[s])}</small>` : ''}</span></label>`).join('')}</div><p class="field__hint field__hint--error" data-error-for="tostage" hidden></p></fieldset>`,
        submit: 'Continue',
        async onSubmit(form) {
          const to = form.querySelector('[name="tostage"]:checked')?.value;
          if (!to) return { ok: false, errors: { tostage: 'Choose a stage.' } };
          if (['enquiry', 'applied'].includes(to)) return confirmPlain(e, to);
          setTimeout(() => (to === 'offer' ? act.offerDialog(find()) : act.move(id, to)), 180);
          return { ok: true };
        }
      });
    }
    function confirmPlain(e, to) {
      setTimeout(() => kids.dialog({ label: 'Admissions', title: `Move to ${store.ENQUIRY_STAGES[to]}?`, desc: `${esc(e.child)}: ${esc(store.ENQUIRY_STAGES[e.stage])} → ${esc(store.ENQUIRY_STAGES[to])}. This is recorded in the timeline.`, body: '', submit: `Move to ${store.ENQUIRY_STAGES[to]}`,
        async onSubmit() { act.move(id, to); return { ok: true }; } }), 180);
      return { ok: true };
    }
    function callDialog(e) {
      const clientId = cid();
      kids.dialog({
        label: 'Admissions', title: 'Log a call', desc: `${esc(e.parent)} · <a href="tel:${esc(String(e.phone).replace(/[^\d+]/g, ''))}">${esc(e.phone)}</a>`,
        body: `<fieldset class="an-fs"><legend class="field__label">Outcome <span class="field__req" aria-hidden="true">*</span></legend><div class="ad-reasons">${Object.entries(store.CALL_OUTCOMES).map(([k, l]) => `<label class="an-pick"><input type="radio" name="coutcome" value="${k}"><span><b>${l}</b></span></label>`).join('')}</div><p class="field__hint field__hint--error" data-error-for="outcome" hidden></p></fieldset>
          ${kids.field('kd-cnotes', 'Notes', '<textarea class="input" id="kd-cnotes" name="cnotes" rows="3" maxlength="2000"></textarea>')}
          <div class="cls-form__row">${kids.field('kd-followUp', 'Next follow-up (optional)', `<input class="input" type="date" id="kd-followUp" name="followUp" min="${store.today()}">`)}${kids.field('kd-followUpTime', 'Time', '<input class="input" type="time" id="kd-followUpTime" name="followUpTime">')}</div>
          ${kids.field('kd-assigneeId', 'Follow-up owner', `<select class="input" id="kd-assigneeId" name="assigneeId">${owners.map(x => `<option value="${esc(x.id)}"${x.id === (e.ownerId || user.id) ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`, { hint: 'A follow-up task is created when you set a date. They get a Nexora notification.' })}`,
        submit: 'Save call',
        async onSubmit(form) {
          const r = await store.logEnquiryCall(me(), id, { outcome: form.querySelector('[name="coutcome"]:checked')?.value, notes: form.elements.cnotes.value, followUp: form.elements.followUp.value, followUpTime: form.elements.followUpTime.value, assigneeId: form.elements.assigneeId.value, clientId });
          if (!r.ok) return r.errors ? { ok: false, errors: r.errors } : { ok: false, message: failText(r) };
          toast('Call logged', r.task ? `Follow-up created for ${fmt(r.task.due)}.` : e.child, 'phone');
          draw();
          return { ok: true };
        }
      });
    }
    function emailDialog(e) {
      const clientId = cid();
      kids.dialog({
        label: 'Admissions', title: 'Log an email', desc: 'No email service is connected, so this is <b>recorded as a draft — it isn’t sent</b>. Send it from your own email, then keep the record here.',
        body: `${kids.field('kd-to', 'Recipient', `<input class="input" id="kd-to" name="to" type="email" required value="${esc(e.email || '')}">`, { required: true })}
          ${kids.field('kd-subject', 'Subject', '<input class="input" id="kd-subject" name="subject" maxlength="200" required>', { required: true })}
          ${kids.field('kd-body', 'Message', '<textarea class="input" id="kd-body" name="body" rows="6" maxlength="4000" required></textarea>', { required: true })}`,
        submit: 'Record email (not sent)',
        async onSubmit(form) {
          const r = await store.logEnquiryEmail(me(), id, { to: form.elements.to.value, subject: form.elements.subject.value, body: form.elements.body.value, clientId });
          if (!r.ok) return r.errors ? { ok: false, errors: r.errors } : { ok: false, message: failText(r) };
          toast('Email recorded', 'Saved in the timeline — not sent (no email service).', 'mail');
          draw();
          return { ok: true };
        }
      });
    }
    function taskDialog(e, t = null) {
      const clientId = cid();
      kids.dialog({
        label: 'Admissions', title: t ? 'Edit follow-up' : 'Add follow-up', desc: esc(e.child),
        body: `${kids.field('kd-title', 'Task', `<input class="input" id="kd-title" name="title" maxlength="200" required value="${esc(t?.title || '')}" placeholder="e.g. Call back about the June start">`, { required: true })}
          <div class="cls-form__row">${kids.field('kd-due', 'Due date', `<input class="input" type="date" id="kd-due" name="due" required value="${esc(t?.due || store.today())}">`, { required: true })}${kids.field('kd-time', 'Time (optional)', `<input class="input" type="time" id="kd-time" name="time" value="${esc(t?.time || '')}">`)}</div>
          ${kids.field('kd-assigneeId', 'Assignee', `<select class="input" id="kd-assigneeId" name="assigneeId" required>${owners.map(x => `<option value="${esc(x.id)}"${x.id === (t?.assigneeId || e.ownerId || user.id) ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`, { required: true, hint: 'They get a Nexora notification.' })}`,
        submit: t ? 'Save changes' : 'Save task',
        async onSubmit(form) {
          const input = { title: form.elements.title.value, due: form.elements.due.value, time: form.elements.time.value, assigneeId: form.elements.assigneeId.value };
          const r = t ? await store.updateEnquiryTask(me(), id, t.id, input) : await store.addEnquiryTask(me(), id, { ...input, clientId });
          if (!r.ok) return r.errors ? { ok: false, errors: r.errors } : { ok: false, message: failText(r) };
          toast(t ? (r.unchanged ? 'No changes' : 'Follow-up updated') : 'Follow-up added', input.title, 'check-circle');
          draw();
          return { ok: true };
        }
      });
    }
    function detailsDialog(e, part) {
      const fam = part === 'family';
      kids.dialog({
        label: 'Admissions', title: fam ? 'Edit family details' : 'Edit child details', desc: '',
        body: fam ? `<div class="cls-form">${kids.field('kd-parent', 'Parent or guardian', `<input class="input" id="kd-parent" name="parent" maxlength="80" required value="${esc(e.parent)}">`, { required: true })}
            <div class="cls-form__row">${kids.field('kd-phone', 'Phone', `<input class="input" id="kd-phone" name="phone" type="tel" inputmode="tel" maxlength="24" required value="${esc(e.phone)}">`, { required: true })}${kids.field('kd-email', 'Email', `<input class="input" id="kd-email" name="email" type="email" maxlength="120" value="${esc(e.email || '')}">`)}</div>
            <div class="cls-form__row">${kids.field('kd-contactMethod', 'Preferred contact', `<select class="input" id="kd-contactMethod" name="contactMethod"><option value="">Not given</option>${Object.entries(store.CONTACT_METHODS).map(([k, l]) => `<option value="${k}"${e.contactMethod === k ? ' selected' : ''}>${l}</option>`).join('')}</select>`)}${kids.field('kd-language', 'Preferred language', `<input class="input" id="kd-language" name="language" maxlength="60" value="${esc(e.language || '')}">`)}</div>
            ${kids.field('kd-address', 'Address', `<textarea class="input" id="kd-address" name="address" rows="2" maxlength="300">${esc(e.address || '')}</textarea>`)}
            ${kids.field('kd-ownerId', 'Admissions owner', `<select class="input" id="kd-ownerId" name="ownerId"><option value="">Unassigned</option>${owners.map(x => `<option value="${esc(x.id)}"${e.ownerId === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`)}</div>`
          : `<div class="cls-form">${kids.field('kd-child', 'Child’s full name', `<input class="input" id="kd-child" name="child" maxlength="80" required value="${esc(e.child)}">`, { required: true })}
            <div class="cls-form__row">${kids.field('kd-dob', 'Date of birth', `<input class="input" id="kd-dob" name="dob" type="date" max="${store.today()}" value="${esc(e.dob || '')}">`)}${kids.field('kd-programme', 'Programme', `<select class="input" id="kd-programme" name="programme" required>${store.CLASS_LEVELS.map(l => `<option${e.programme === l ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`, { required: true })}</div>
            <div class="cls-form__row">${kids.field('kd-preferredStart', 'Preferred start', `<input class="input" id="kd-preferredStart" name="preferredStart" type="date" required value="${esc(e.preferredStart || '')}">`, { required: true })}${kids.field('kd-previousSchool', 'Previous school', `<input class="input" id="kd-previousSchool" name="previousSchool" maxlength="120" value="${esc(e.previousSchool || '')}">`)}</div>
            ${kids.field('kd-childNotes', 'Notes about the child', `<textarea class="input" id="kd-childNotes" name="childNotes" rows="3" maxlength="1000">${esc(e.childNotes || '')}</textarea>`)}</div>`,
        submit: 'Save changes',
        async onSubmit(form) {
          const keys = fam ? ['parent', 'phone', 'email', 'contactMethod', 'language', 'address', 'ownerId'] : ['child', 'dob', 'programme', 'preferredStart', 'previousSchool', 'childNotes'];
          const r = await store.updateEnquiry(me(), id, { ...Object.fromEntries(keys.map(k => [k, form.elements[k].value])), updatedAt: find()?.updatedAt });
          if (r.reason === 'duplicate') return { ok: false, message: 'Another open enquiry already uses this phone or email for the same child.' };
          if (!r.ok) return r.errors ? { ok: false, errors: r.errors } : { ok: false, message: failText(r) };
          toast(r.unchanged ? 'No changes' : 'Saved', e.child, 'check-circle');
          draw();
          return { ok: true };
        }
      });
    }
    function reassignDialog(e) {
      kids.dialog({ label: 'Admissions', title: 'Reassign owner', desc: esc(e.child),
        body: kids.field('kd-ownerId', 'Admissions owner', `<select class="input" id="kd-ownerId" name="ownerId"><option value="">Unassigned</option>${owners.map(x => `<option value="${esc(x.id)}"${e.ownerId === x.id ? ' selected' : ''}>${esc(x.name)} · ${esc(x.role)}</option>`).join('')}</select>`, { hint: 'The new owner gets a Nexora notification.' }),
        submit: 'Reassign',
        async onSubmit(form) { const r = await store.updateEnquiry(me(), id, { ownerId: form.elements.ownerId.value, updatedAt: find()?.updatedAt }); if (!r.ok) return { ok: false, message: failText(r) }; toast(r.unchanged ? 'No changes' : 'Owner updated', ownerName(form.elements.ownerId.value) || 'Unassigned', 'user'); draw(); return { ok: true }; } });
    }
    function siblingDialog(e) {
      let q = '';
      let timer = null;
      const d = kids.dialog({ label: 'Admissions', title: 'Link existing child', desc: 'Search children already on record. Linking connects this applicant to that child’s family — nothing is matched automatically.',
        body: `<div class="an-search an-search--block">${icon('search', 'icon--sm')}<label class="sr-only" for="s7-sq">Search children</label><input class="input" id="s7-sq" type="search" placeholder="Child’s name (at least 2 letters)" autocomplete="off"></div><ul class="an-plist s7-sres" data-sres role="radiogroup" aria-label="Children"><li class="cp-muted an-plist__none">Type a name to search.</li></ul><p class="field__hint field__hint--error" data-error-for="child" hidden></p>`,
        submit: 'Link child',
        async onSubmit(form) {
          const pick = form.querySelector('[name="sib"]:checked')?.value;
          if (!pick) return { ok: false, errors: { child: 'Choose a child.' } };
          const r = await store.linkSibling(me(), id, pick);
          if (!r.ok) return r.errors ? { ok: false, errors: r.errors } : { ok: false, message: failText(r) };
          toast('Sibling linked', store.childName(store.childById(pick)), 'users');
          draw();
          return { ok: true };
        } });
      const search = () => {
        const ql = q.trim().toLowerCase();
        const box = d.form.querySelector('[data-sres]');
        if (ql.length < 2) { box.innerHTML = '<li class="cp-muted an-plist__none">Type a name to search.</li>'; return; }
        const linked = new Set(store.enquirySiblings(find()).map(s => s.id));
        const rows = store.getChildren().filter(c => store.childName(c).toLowerCase().includes(ql)).slice(0, 12);
        box.innerHTML = rows.map(c => `<li><label class="an-prow"><input type="radio" name="sib" value="${esc(c.id)}"${linked.has(c.id) ? ' disabled' : ''}><span class="an-prow__txt"><b>${esc(store.childName(c))}</b><small>${esc(c.cls)} · ${esc(store.CHILD_STATUSES[c.status] || c.status)}${linked.has(c.id) ? ' · already linked' : ''}</small></span></label></li>`).join('') || '<li class="cp-muted an-plist__none">No children match.</li>';
      };
      d.form.querySelector('#s7-sq').addEventListener('input', ev => { q = ev.target.value; clearTimeout(timer); timer = setTimeout(search, 200); });
      d.form.querySelector('#s7-sq').focus();
    }
    async function uploadDoc(k, file) {
      const e = find();
      const err = main.querySelector(`[data-docerr="${k}"]`);
      const prog = main.querySelector(`[data-prog="${k}"]`);
      const show = msg => { const el = main.querySelector(`[data-docerr="${k}"]`); if (el) { el.textContent = msg; el.hidden = !msg; } };
      show('');
      const types = store.APPLICANT_DOC_TYPES[k];
      if (!types.includes(file.type)) { show(k === 'photo' ? 'Choose a JPEG or PNG photo.' : 'Choose a PDF, JPEG or PNG file.'); return; }
      if (file.size > 1024 * 1024) { show('This file is over 1 MB. Choose a smaller file.'); return; }
      prog.hidden = false;
      const data = await new Promise(res => { const fr = new FileReader(); fr.onprogress = ev => { if (ev.lengthComputable) prog.querySelector('progress').value = Math.round((ev.loaded / ev.total) * 90); }; fr.onload = () => res(fr.result); fr.onerror = () => res(''); fr.readAsDataURL(file); });
      const r = await store.uploadApplicantDocument(me(), id, k, { name: file.name, mime: file.type, size: file.size, data, clientId: cid() });
      if (!r.ok) { prog.hidden = true; show(failText(r)); return; }
      toast('Document uploaded', `${store.APPLICANT_DOCS[k]} · ${file.name}`, 'upload');
      void err; void e;
      draw();
      main.querySelector(`label[for="s7-f-${k}"]`)?.focus();
    }

    /* ---------------------------------------------------------------- Events */

    main.addEventListener('click', async ev => {
      const t = ev.target;
      const e = find();
      if (!e) return;
      const moreMenu = main.querySelector('[data-more] + .menu');
      if (t.closest('[data-more]')) { moreMenu.hidden = !moreMenu.hidden; t.closest('[data-more]').setAttribute('aria-expanded', String(!moreMenu.hidden)); if (!moreMenu.hidden) moreMenu.querySelector('button').focus(); return; }
      if (moreMenu && !moreMenu.hidden && !t.closest('.menu-wrap')) moreMenu.hidden = true;
      if (moreMenu && t.closest('.menu')) moreMenu.hidden = true;
      const tb = t.closest('[data-mtab]');
      if (tb && tb.tagName === 'BUTTON') { mtab = tb.dataset.mtab; const u = new URL(location.href); u.searchParams.set('tab', mtab); history.replaceState(null, '', u); draw(); main.querySelector(`#s7-tab-${mtab}`)?.focus(); return; }
      if (t.closest('[data-movestage]')) { moveStageDialog(e); return; }
      if (t.closest('[data-offer]')) { act.offerDialog(e, failSend); return; }
      if (t.closest('[data-enrol]')) { act.enrolDialog(e); return; }
      if (t.closest('[data-lost]')) { act.lostDialog(e); return; }
      if (t.closest('[data-editfam]')) { detailsDialog(e, 'family'); return; }
      if (t.closest('[data-editchild]')) { detailsDialog(e, 'child'); return; }
      if (t.closest('[data-reassign]')) { reassignDialog(e); return; }
      if (t.closest('[data-copyref]')) { try { await navigator.clipboard.writeText(e.id); toast('Reference copied', e.id, 'copy'); } catch { toast('Reference', e.id, 'copy'); } return; }
      if (t.closest('[data-call]')) { callDialog(e); return; }
      if (t.closest('[data-email]')) { emailDialog(e); return; }
      if (t.closest('[data-addtask]')) { taskDialog(e); return; }
      const et = t.closest('[data-edittask]');
      if (et) { taskDialog(e, e.tasks.find(x => x.id === et.dataset.edittask)); return; }
      const dn = t.closest('[data-done], [data-reopen]');
      if (dn) { dn.disabled = true; const r = await store.updateEnquiryTask(me(), id, dn.dataset.done || dn.dataset.reopen, { status: dn.dataset.done ? 'done' : 'open' }); if (!r.ok) { dn.disabled = false; toast('Not saved', failText(r), 'alert-circle'); return; } toast(dn.dataset.done ? 'Follow-up completed' : 'Follow-up reopened', r.task.title, 'check-circle'); draw(); return; }
      if (t.closest('[data-linksib]')) { siblingDialog(e); return; }
      const us = t.closest('[data-unsib]');
      if (us) { kids.dialog({ label: 'Admissions', title: 'Remove this sibling link?', desc: 'The child’s own record isn’t changed.', body: '', submit: 'Remove link', danger: true, async onSubmit() { const r = await store.unlinkSibling(me(), id, us.dataset.unsib); if (!r.ok) return { ok: false, message: failText(r) }; draw(); return { ok: true }; } }); return; }
      const vw = t.closest('[data-view]');
      if (vw) { const f = store.applicantFile(me(), vw.dataset.view); if (!f) { toast('File not available', 'It may have been removed, or it isn’t on this device.'); return; } const a = document.createElement('a'); a.href = f.data; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); return; }
      const rd = t.closest('[data-rmdoc]');
      if (rd) { kids.dialog({ label: 'Admissions', title: `Remove ${store.APPLICANT_DOCS[rd.dataset.rmdoc]}?`, desc: 'The file is deleted from this device and the checklist item goes back to Missing.', body: '', submit: 'Remove file', danger: true, async onSubmit() { const r = await store.removeApplicantDocument(me(), id, rd.dataset.rmdoc); if (!r.ok) return { ok: false, message: failText(r) }; draw(); return { ok: true }; } }); return; }
      if (t.closest('[data-fuclear]')) { const r = await store.setEnquiryFollowUp(me(), id, ''); if (r.ok) draw(); }
    });
    main.addEventListener('change', ev => {
      const t = ev.target;
      if (t.matches('[data-file]') && t.files[0]) { const file = t.files[0]; t.value = ''; uploadDoc(t.dataset.file, file); return; }
      if (t.matches('[data-tlf]')) { tlFilter = t.value; draw(); main.querySelector('#s7-tlf')?.focus(); }
    });
    main.addEventListener('submit', async ev => {
      if (!ev.target.matches('[data-noteform]')) return;
      ev.preventDefault();
      const ta = main.querySelector('#s7-note');
      const err = main.querySelector('[data-noteerr]');
      const btn = ev.target.querySelector('[type="submit"]');
      if (!ta.value.trim()) { err.textContent = 'Write the note first.'; err.hidden = false; ta.setAttribute('aria-invalid', 'true'); ta.focus(); return; }
      if (btn.disabled) return;
      btn.disabled = true;
      const r = await store.logEnquiryNote(me(), id, { text: ta.value, clientId: ta.dataset.cid || (ta.dataset.cid = cid()) });
      btn.disabled = false;
      if (!r.ok) { err.textContent = failText(r); err.hidden = false; return; }
      toast('Note saved', find().child, 'note');
      draw();
      main.querySelector('#s7-note')?.focus();
    });
    main.addEventListener('keydown', ev => {
      const m = main.querySelector('[data-more] + .menu');
      if (ev.key === 'Escape' && m && !m.hidden) { m.hidden = true; main.querySelector('[data-more]').focus(); return; }
      const t = ev.target.closest('[role="tab"]');
      if (!t) return;
      const keys = ['timeline', 'details', 'documents', 'tasks'];
      const i = keys.indexOf(t.dataset.mtab);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: 3 }[ev.key];
      if (to === undefined) return;
      ev.preventDefault();
      mtab = keys[(to + 4) % 4]; draw(); main.querySelector(`#s7-tab-${mtab}`)?.focus();
    });
    store.subscribe(({ key }) => { if (!key || /^nexora-(admission-enquiries|children|families)/.test(key)) { if (!document.querySelector('dialog[open]') && !(document.activeElement && main.contains(document.activeElement) && /TEXTAREA|INPUT/.test(document.activeElement.tagName))) draw(); } });
    main.innerHTML = `<div class="kids s7"><span class="skeleton" style="display:block;height:40px;width:min(420px,80%);border-radius:var(--radius-sm)"></span><span class="skeleton" style="display:block;height:52px;border-radius:var(--radius-lg)"></span><div class="s7-grid"><span class="skeleton" style="display:block;height:420px;border-radius:var(--radius-lg)"></span><span class="skeleton" style="display:block;height:420px;border-radius:var(--radius-lg)"></span></div></div>`;
    setTimeout(draw, 200);
  }

  window.NexoraAdmissions = { render };
})();
