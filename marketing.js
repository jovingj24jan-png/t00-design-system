/* Marketing & Referrals (app.html?page=marketing[&period=30|90|365|all][&referral=<id>])
   Analytics come straight from the S06 enquiry records (store.marketingAnalytics), campaigns attribute enquiries by
   campaign ID, and referral rewards are earned by the S14 enrolment itself (store.completeEnquiryEnrolment) — this page
   only shows them, marks them given, and offers the retry path when a reward or notification step failed.
   Test hooks: ?fail=1 (analytics load error), ?mkfail=campaign|referral|given|notify|reconcile (one save failure). */
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
  const when = s => (s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const pct = v => (v == null ? '—' : `${v >= 10 || Number.isInteger(v) ? Math.round(v) : v.toFixed(1)}%`);
  const chip = (tone, text, ic = '') => `<span class="badge badge--plain an-chip an-chip--${tone}">${ic ? icon(ic) : ''}${esc(text)}</span>`;
  const state = (iconName, title, text, action = '', tone = '') => `<div class="kids-empty mk-state"${tone === 'error' ? ' role="alert"' : ''}><span class="state-icon${tone ? ` state-icon--${tone}` : ''}" aria-hidden="true">${icon(iconName)}</span><h3 class="kids-empty__title">${title}</h3><p>${text}</p>${action}</div>`;
  const STAGE_TONE = { enquiry: 'info', tour: 'cat', applied: 'warning', offer: 'warning', enrolled: 'success', lost: 'neutral' };
  const CAMPAIGN_TONE = { scheduled: 'info', active: 'success', completed: 'neutral' };
  const CAMPAIGN_ICON = { scheduled: 'clock', active: 'check-circle', completed: 'archive' };
  const REWARD_TONE = { pending: 'neutral', earned: 'warning', given: 'success' };
  const REWARD_ICON = { pending: 'clock', earned: 'star', given: 'check-circle' };
  const FAIL = {
    forbidden: 'Your role can’t change marketing records. Nothing was changed.',
    missing: 'This record is no longer available. The latest list is shown.',
    stale: 'Someone else changed this campaign just now. Reopen it to see the latest details.',
    storage: 'This couldn’t be saved on this device. Nothing was changed — please try again.',
    busy: 'This is already being saved. Wait a moment, then check the list.'
  };
  const failText = r => r.message || FAIL[r.reason] || FAIL.storage;

  function render(key, main, user) {
    if (key !== 'marketing') return false;
    page(main, user);
    return true;
  }

  function page(main, user) {
    const manage = store.canManageMarketing(user);
    const admissions = store.canAccess(user, 'admissions') && store.isEntitled('admissions');
    const families = store.canAccess(user, 'family');
    const me = () => store.currentUser();
    let period = store.MARKETING_PERIODS[params.get('period')] ? params.get('period') : '90';
    let focus = params.get('referral') || '';
    let loaded = false;
    let failLoad = params.get('fail') === '1';
    const failNext = { [params.get('mkfail') || '']: true };
    const takeFail = k => { const v = Boolean(failNext[k]); failNext[k] = false; return v; };
    const f = { cq: '', cstatus: '', rq: '', rstage: '', rstatus: '' };
    let picked = '';
    let openMenu = null;
    let dialogOpen = false;

    main.classList.add('kids-page');
    document.title = 'Marketing & Referrals · Nexora';
    const $ = sel => main.querySelector(sel);
    const enquiriesHref = q => (admissions ? `${routes.page('admissions', { view: 'list', ...q })}` : '');
    const head = sub => `<header class="kids-head mk-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Marketing &amp; Referrals</h1><p class="kids-head__sub">${sub}</p></div>
      <div class="field mk-period"><label class="field__label" for="mk-period">Reporting period</label><select class="input" id="mk-period" data-period>${Object.entries(store.MARKETING_PERIODS).map(([k, l]) => `<option value="${k}"${k === period ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div></header>`;
    const SUB = 'Understand your admissions channels and recognise families who recommend your school.';

    function load() {
      main.innerHTML = `<div class="kids mk" aria-busy="true">${head(SUB)}
        <div class="mk-grid" aria-hidden="true"><span class="skeleton mk-skel mk-skel--chart"></span><span class="skeleton mk-skel mk-skel--chart"></span></div>
        <span class="skeleton mk-skel mk-skel--table" aria-hidden="true"></span><span class="skeleton mk-skel mk-skel--table" aria-hidden="true"></span>
        <p class="sr-only" role="status">Loading marketing and referrals</p></div>`;
      setTimeout(() => {
        if (failLoad) {
          failLoad = false;
          main.innerHTML = `<div class="kids mk">${head(SUB)}${state('alert-circle', 'We couldn’t load the admissions data', 'The source analytics, campaigns and referrals use the admissions records, which didn’t load. Nothing has changed.', '<button class="btn btn--primary" type="button" data-retry>Try again</button>', 'error')}</div>`;
          return;
        }
        loaded = true;
        draw();
        const row = focus && main.querySelector(`[data-ref="${CSS.escape(focus)}"]`);
        if (row) { row.scrollIntoView({ block: 'center' }); row.querySelector('[data-refname]')?.focus(); } else $('#page-title')?.focus();
      }, 350);
    }

    // Redraws everything, then puts focus (and the caret in a search box) back where it was.
    function draw() {
      if (!loaded) return;
      const active = document.activeElement;
      const keep = active && main.contains(active) ? { id: active.id, sel: active.dataset?.keep, pos: active.selectionStart } : null;
      const a = store.marketingAnalytics({ period });
      const periodText = a.from ? `Enquiries received ${day(a.from)} – ${day(a.to)}` : 'All enquiries on record';
      main.innerHTML = `<div class="kids mk">${head(SUB)}
        <p class="mk-scope">${icon('calendar-check', 'icon--sm')}<span><b>${esc(periodText)}</b> · ${plural(a.total, 'enquiry', 'enquiries')}, ${a.tours} toured, ${a.enrolled} enrolled so far. The period applies to the source analytics only — campaigns and referral rewards are shown in full.</span></p>
        <div class="mk-grid">${sourceChart(a)}${conversionTable(a)}</div>
        ${campaignsSection()}
        ${referralsSection()}
      </div>`;
      if (keep) {
        const el = (keep.sel && main.querySelector(`[data-keep="${keep.sel}"]`)) || (keep.id && main.querySelector(`#${CSS.escape(keep.id)}`));
        if (el) { el.focus(); if (keep.pos != null && el.setSelectionRange) try { el.setSelectionRange(keep.pos, keep.pos); } catch { /* not a text box */ } }
      }
    }

    /* ----------------------------- Analytics */

    function sourceChart(a) {
      const rows = a.rows.filter(r => r.enquiries);
      const empty = a.rows.filter(r => !r.enquiries).map(r => r.label);
      const max = Math.max(1, ...rows.map(r => r.enquiries));
      const sel = rows.find(r => r.key === picked);
      const body = !a.total
        ? state('chart', 'No enquiries in this period', a.period === 'all' ? 'Enquiries added in Admissions will appear here, grouped by how the family found you.' : 'Choose a longer reporting period, or add enquiries in Admissions.', a.period !== 'all' ? '<button class="btn btn--secondary btn--sm" type="button" data-alltime>Show all time</button>' : '')
        : `<ul class="mk-bars" role="list" aria-label="Enquiries by source">${rows.map(r => `<li><button class="mk-bar${r.key === picked ? ' is-picked' : ''}" type="button" data-src="${esc(r.key)}" aria-pressed="${r.key === picked}" aria-label="${esc(r.label)}: ${plural(r.enquiries, 'enquiry', 'enquiries')}, ${r.tours} toured, ${r.enrolled} enrolled" title="${esc(r.label)} · ${plural(r.enquiries, 'enquiry', 'enquiries')} · ${r.tours} toured · ${r.enrolled} enrolled">
              <span class="mk-bar__label">${esc(r.label)}</span>
              <span class="mk-bar__track" aria-hidden="true"><i style="--w:${((r.enquiries / max) * 100).toFixed(1)}%"></i></span>
              <span class="mk-bar__value" aria-hidden="true">${r.enquiries}</span></button></li>`).join('')}</ul>
          <div class="mk-axis" aria-hidden="true"><span>0</span><span>${max} enquiries</span></div>
          <div class="mk-pick" aria-live="polite">${sel ? `<p><b>${esc(sel.label)}</b> · ${plural(sel.enquiries, 'enquiry', 'enquiries')} (${pct((sel.enquiries / a.total) * 100)} of the period) · ${sel.tours} toured · ${sel.enrolled} enrolled</p>${admissions ? `<a class="btn btn--tertiary btn--sm" href="${enquiriesHref({ source: sel.key })}">View in Admissions${icon('arrow-right', 'icon--sm')}</a>` : ''}` : `<p class="cd-note">Select a bar to see its tours and enrolments${admissions ? ' and open those enquiries' : ''}.</p>`}</div>
          ${empty.length ? `<p class="cd-note">No enquiries from: ${esc(empty.join(', '))}.</p>` : ''}`;
      return `<section class="panel mk-card" aria-labelledby="mk-src-h"><div class="mk-card__head"><div><h2 class="cd-h2" id="mk-src-h">Enquiries by source</h2><p class="mk-card__sub">How families first reached the school, from the source on each enquiry.</p></div></div>${body}</section>`;
    }

    function conversionTable(a) {
      const rows = a.rows.filter(r => r.enquiries);
      const link = r => (admissions ? `<a class="mk-link" href="${enquiriesHref({ source: r.key })}">${esc(r.label)}</a>` : esc(r.label));
      const body = !a.total ? state('filter', 'Nothing to compare yet', 'Conversion appears once enquiries arrive in this period.')
        : `<div class="mk-table-wrap"><table class="mk-table mk-table--conv">
            <caption class="sr-only">Conversion by source. Conversion is enrolled divided by enquiries.</caption>
            <thead><tr><th scope="col">Source</th><th scope="col" class="mk-num">Enquiries</th><th scope="col" class="mk-num">Tours</th><th scope="col" class="mk-num">Enrolled</th><th scope="col" class="mk-num">Conversion</th></tr></thead>
            <tbody>${rows.map(r => `<tr><th scope="row" class="mk-c-main">${link(r)}</th><td class="mk-num" data-label="Enquiries">${r.enquiries}</td><td class="mk-num" data-label="Tours">${r.tours}</td><td class="mk-num" data-label="Enrolled">${r.enrolled}</td><td class="mk-num" data-label="Conversion"><span class="mk-conv"><span class="mk-conv__bar" aria-hidden="true"><i style="--w:${(r.conversion || 0).toFixed(1)}%"></i></span>${pct(r.conversion)}</span></td></tr>`).join('')}</tbody>
            <tfoot><tr><th scope="row" class="mk-c-main">All sources</th><td class="mk-num" data-label="Enquiries">${a.total}</td><td class="mk-num" data-label="Tours">${a.tours}</td><td class="mk-num" data-label="Enrolled">${a.enrolled}</td><td class="mk-num" data-label="Conversion">${pct(a.conversion)}</td></tr></tfoot>
          </table></div>
          <details class="mk-defs"><summary>How these are counted</summary><ul>
            <li><b>Enquiries</b> — received in the period, by the source recorded on the enquiry.</li>
            <li><b>Tours</b> — of those, how many booked a school tour (counted once, even if rebooked).</li>
            <li><b>Enrolled</b> — of those, how many completed enrolment. An offer sent is not an enrolment.</li>
            <li><b>Conversion</b> — enrolled ÷ enquiries. Recent enquiries may still enrol, so short periods read low.</li></ul></details>`;
      return `<section class="panel mk-card" aria-labelledby="mk-conv-h"><div class="mk-card__head"><div><h2 class="cd-h2" id="mk-conv-h">Conversion by source</h2><p class="mk-card__sub">From first enquiry to enrolled child.</p></div></div>${body}</section>`;
    }

    /* ----------------------------- Campaigns */

    function campaignsSection() {
      const stats = store.campaignStats();
      const all = store.getCampaigns().map(c => ({ ...c, status: store.campaignStatus(c), ...stats[c.id] }))
        .sort((x, y) => ({ active: 0, scheduled: 1, completed: 2 }[x.status] - { active: 0, scheduled: 1, completed: 2 }[y.status]) || y.start.localeCompare(x.start));
      const q = f.cq.trim().toLowerCase();
      const rows = all.filter(c => (!q || `${c.name} ${c.tag}`.toLowerCase().includes(q)) && (!f.cstatus || c.status === f.cstatus));
      const tools = all.length ? `<div class="mk-tools" role="search" aria-label="Find campaigns">
          <div class="field mk-tools__q"><label class="sr-only" for="mk-cq">Search campaigns</label><div class="input-wrap input-wrap--lead">${icon('search')}<input class="input" id="mk-cq" type="search" placeholder="Search campaign or tag" value="${esc(f.cq)}" data-f="cq" autocomplete="off"></div></div>
          <div class="field"><label class="sr-only" for="mk-cst">Status</label><select class="input" id="mk-cst" data-f="cstatus"><option value="">All statuses</option>${Object.entries(store.CAMPAIGN_STATUSES).map(([k, l]) => `<option value="${k}"${f.cstatus === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
          ${f.cq || f.cstatus ? '<button class="btn btn--tertiary btn--sm" type="button" data-clear="c">Clear</button>' : ''}</div>` : '';
      const body = !all.length ? state('megaphone', 'No campaigns yet', 'Create a campaign with its own source tag. Enquiries that carry the tag are counted here.', manage ? `<button class="btn btn--primary" type="button" data-newcampaign>${icon('plus', 'icon--sm')}New campaign</button>` : '')
        : !rows.length ? state('search', 'No campaigns match', 'Try another search or status.', '<button class="btn btn--secondary btn--sm" type="button" data-clear="c">Clear filters</button>')
        : `<div class="mk-table-wrap"><table class="mk-table mk-table--camp"><caption class="sr-only">Campaigns, with the enquiries and enrolments attributed to each</caption>
            <thead><tr><th scope="col">Campaign</th><th scope="col">Start</th><th scope="col">End</th><th scope="col">Source tag</th><th scope="col" class="mk-num">Enquiries</th><th scope="col" class="mk-num">Enrolled</th><th scope="col">Status</th><th scope="col" class="mk-c-act"><span class="sr-only">Actions</span></th></tr></thead>
            <tbody>${rows.map(campaignRow).join('')}</tbody></table></div>`;
      return `<section class="panel mk-section" aria-labelledby="mk-camp-h">
        <div class="mk-section__head"><div><h2 class="cd-h2 mk-h" id="mk-camp-h">Campaigns</h2><p class="mk-card__sub">An enquiry counts towards a campaign only when it carries that campaign — set on the enquiry, or from a link with the campaign’s tag. Its original source is kept.</p></div>
          ${manage && all.length ? `<button class="btn btn--primary" type="button" data-newcampaign>${icon('plus', 'icon--sm')}New campaign</button>` : ''}</div>
        ${tools}${body}</section>`;
    }

    function campaignRow(c) {
      return `<tr data-camp="${esc(c.id)}">
        <td class="mk-c-main"><button class="mk-name" type="button" data-campview="${esc(c.id)}">${esc(c.name)}</button>${c.notes ? `<span class="mk-sub">${esc(c.notes)}</span>` : ''}</td>
        <td data-label="Start" class="mk-nowrap">${esc(day(c.start))}</td>
        <td data-label="End" class="mk-nowrap">${esc(day(c.end))}</td>
        <td data-label="Source tag"><code class="mk-tag">${esc(c.tag)}</code></td>
        <td data-label="Enquiries" class="mk-num">${c.enquiries}</td>
        <td data-label="Enrolled" class="mk-num">${c.enrolled}</td>
        <td data-label="Status">${chip(CAMPAIGN_TONE[c.status], store.CAMPAIGN_STATUSES[c.status], CAMPAIGN_ICON[c.status])}</td>
        <td class="mk-c-act"><div class="menu-wrap"><button class="btn btn--icon-ghost" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(c.name)}" data-menu>${icon('more')}</button>
          <div class="menu" role="menu" hidden>
            <button type="button" role="menuitem" data-campview="${esc(c.id)}">${icon('eye', 'icon--sm')}View details</button>
            ${manage ? `<button type="button" role="menuitem" data-campedit="${esc(c.id)}">${icon('pencil', 'icon--sm')}Edit campaign</button>` : ''}
            ${admissions ? `<button type="button" role="menuitem" data-campenq="${esc(c.id)}"${c.enquiries ? '' : ' disabled'}>${icon('user-plus', 'icon--sm')}Open its enquiries${c.enquiries ? '' : ' (none yet)'}</button>` : ''}
            <button type="button" role="menuitem" data-camplink="${esc(c.id)}">${icon('copy', 'icon--sm')}Copy tagged visit link</button>
          </div></div></td></tr>`;
    }

    const visitLink = c => new URL(`index.html?campaign=${encodeURIComponent(c.tag)}#visit`, location.href).href;

    function campaignDialog(c = null) {
      let tagTouched = Boolean(c);
      dialogOpen = true;
      const d = kids.dialog({
        label: 'Marketing / Campaigns', title: c ? 'Edit campaign' : 'New campaign',
        desc: c ? `Enquiries already in this campaign stay in it — they’re linked by campaign, not by tag.` : 'A campaign groups enquiries that carry its source tag. Nothing is sent to families from here.',
        body: `<div class="cls-form">
          ${kids.field('kd-name', 'Campaign name', `<input class="input" id="kd-name" name="name" maxlength="80" required value="${esc(c?.name || '')}" placeholder="For example, Spring open day">`, { required: true })}
          <div class="cls-form__row">${kids.field('kd-start', 'Start date', `<input class="input" id="kd-start" name="start" type="date" required value="${esc(c?.start || store.today())}">`, { required: true })}${kids.field('kd-end', 'End date', `<input class="input" id="kd-end" name="end" type="date" required value="${esc(c?.end || '')}">`, { required: true })}</div>
          ${kids.field('kd-tag', 'Source tag', `<input class="input" id="kd-tag" name="tag" maxlength="60" required value="${esc(c?.tag || '')}" placeholder="spring-open-day" autocomplete="off" spellcheck="false">`, { required: true, hint: 'Lower-case words joined by dashes, unique to this campaign. Links ending in ?campaign=<tag> file their enquiries under it.' })}
          <p class="cd-note mk-tagprev" data-tagprev aria-live="polite"></p>
          ${kids.field('kd-notes', 'Notes', `<textarea class="input" id="kd-notes" name="notes" rows="2" maxlength="500" placeholder="Where it ran, who looked after it">${esc(c?.notes || '')}</textarea>`)}</div>`,
        submit: c ? 'Save changes' : 'Create campaign',
        onClose() { dialogOpen = false; },
        async onSubmit(form) {
          const input = Object.fromEntries(['name', 'start', 'end', 'tag', 'notes'].map(k => [k, form.elements[k].value]));
          const r = await store.saveCampaign(me(), { ...input, updatedAt: c?.updatedAt }, c?.id || null, { fail: takeFail('campaign') });
          if (!r.ok) return r.errors ? { ok: false, errors: r.errors } : { ok: false, message: `The campaign wasn’t saved. ${failText(r)}` };
          dialogOpen = false;
          draw();
          main.querySelector(`[data-camp="${CSS.escape(r.campaign.id)}"] [data-campview]`)?.focus();
          toast(r.unchanged ? 'No changes' : c ? 'Campaign saved' : 'Campaign created', `${r.campaign.name} · tag ${r.campaign.tag}`, 'check-circle');
          return { ok: true };
        }
      });
      const prev = () => { const t = store.normCampaignTag(d.form.elements.tag.value); d.form.querySelector('[data-tagprev]').innerHTML = t ? `Saved as <code class="mk-tag">${esc(t)}</code>` : ''; };
      d.form.addEventListener('input', ev => {
        if (ev.target.name === 'tag') tagTouched = true;
        if (ev.target.name === 'name' && !tagTouched) d.form.elements.tag.value = store.normCampaignTag(ev.target.value);
        prev();
      });
      prev();
    }

    function campaignDetails(c) {
      const enq = store.getAdmissionEnquiries().filter(e => e.campaignId === c.id).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
      const st = store.campaignStatus(c);
      dialogOpen = true;
      const d = kids.dialog({
        label: 'Marketing / Campaign', title: c.name, desc: `${esc(day(c.start))} – ${esc(day(c.end))} · ${esc(store.CAMPAIGN_STATUSES[st])}`,
        body: `<dl class="wt-ctx mk-dl"><div><dt>Source tag</dt><dd><code class="mk-tag">${esc(c.tag)}</code></dd></div><div><dt>Visit link</dt><dd class="mk-break">${esc(visitLink(c))}</dd></div><div><dt>Created</dt><dd>${esc(when(c.createdAt))} · ${esc(c.createdBy)}</dd></div>${c.notes ? `<div><dt>Notes</dt><dd>${esc(c.notes)}</dd></div>` : ''}</dl>
          <h3 class="mk-h3">Enquiries in this campaign (${enq.length})</h3>
          ${enq.length ? `<ul class="mk-list">${enq.map(e => `<li><span>${admissions ? `<a href="${routes.page('admissions', { applicant: e.id })}">${esc(e.child)}</a>` : esc(e.child)}<small>${esc(store.ENQUIRY_SOURCES[e.source] || 'Other')} · received ${esc(day(e.createdAt))}</small></span>${chip(STAGE_TONE[e.stage], store.ENQUIRY_STAGES[e.stage])}</li>`).join('')}</ul>` : '<p class="cd-note">None yet. Set the campaign on an enquiry in Admissions, or share the tagged visit link.</p>'}
          ${(c.history || []).length ? `<h3 class="mk-h3">History</h3><ol class="wt-hist">${[...c.history].reverse().map(h => `<li><b>${esc(h.detail)}</b><span>${esc(when(h.at))} · ${esc(h.by)}</span></li>`).join('')}</ol>` : ''}`,
        submit: 'Done', onClose() { dialogOpen = false; }, async onSubmit() { return { ok: true }; }
      });
      d.form.querySelector('[type="submit"]').focus();
    }

    /* ----------------------------- Referrals */

    function referralsSection() {
      const all = store.getReferrals().map(r => store.referralView(r)).sort((x, y) => ({ earned: 0, pending: 1, given: 2 }[x.status] - { earned: 0, pending: 1, given: 2 }[y.status]) || y.createdAt.localeCompare(x.createdAt));
      const q = f.rq.trim().toLowerCase();
      const rows = all.filter(r => (!q || `${r.familyName} ${r.childName}`.toLowerCase().includes(q)) && (!f.rstage || r.stage === f.rstage) && (!f.rstatus || r.status === f.rstatus));
      const count = k => all.filter(r => r.status === k).length;
      const stuck = store.referralsToReconcile();
      const failedNotes = all.filter(r => r.notify?.status === 'failed' && r.status !== 'pending');
      const banners = `${stuck.length ? `<div class="wt-banner wt-banner--warn" role="alert">${icon('alert-triangle')}<p><b>${plural(stuck.length, 'reward')} still Pending although the child has enrolled</b> (${esc(stuck.map(r => r.childName).join(', '))}). The automatic update didn’t finish.${manage ? '' : ' Ask a school leader to update it.'}</p>${manage ? '<button class="btn btn--secondary btn--sm" type="button" data-reconcile>Update rewards</button>' : ''}</div>` : ''}
        ${failedNotes.length ? `<div class="wt-banner wt-banner--warn" role="status">${icon('bell')}<p><b>${plural(failedNotes.length, 'reward notification')} couldn’t be created.</b> The rewards themselves are recorded. Retry from the row’s actions.</p></div>` : ''}`;
      const tools = all.length ? `<div class="mk-tools" role="search" aria-label="Find referrals">
          <div class="field mk-tools__q"><label class="sr-only" for="mk-rq">Search family or child</label><div class="input-wrap input-wrap--lead">${icon('search')}<input class="input" id="mk-rq" type="search" placeholder="Search referring family or referred child" value="${esc(f.rq)}" data-f="rq" autocomplete="off"></div></div>
          <div class="field"><label class="sr-only" for="mk-rstage">Admissions stage</label><select class="input" id="mk-rstage" data-f="rstage"><option value="">Any stage</option>${Object.entries(store.ENQUIRY_STAGES).map(([k, l]) => `<option value="${k}"${f.rstage === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="field"><label class="sr-only" for="mk-rst">Reward status</label><select class="input" id="mk-rst" data-f="rstatus"><option value="">Any reward status</option>${Object.entries(store.REWARD_STATUSES).map(([k, l]) => `<option value="${k}"${f.rstatus === k ? ' selected' : ''}>${l} (${count(k)})</option>`).join('')}</select></div>
          ${f.rq || f.rstage || f.rstatus ? '<button class="btn btn--tertiary btn--sm" type="button" data-clear="r">Clear</button>' : ''}</div>` : '';
      const summary = all.length ? `<dl class="wt-strip mk-strip" aria-label="Rewards"><div><dt>Pending</dt><dd>${count('pending')}</dd></div><div><dt>Earned — to give</dt><dd>${count('earned')}</dd></div><div><dt>Given</dt><dd>${count('given')}</dd></div></dl>` : '';
      const body = !all.length ? state('users', 'No referrals yet', 'When a family recommends the school, record it here and link it to the child’s admissions record. The reward is earned when that child enrols.', manage ? `<button class="btn btn--primary" type="button" data-newref>${icon('plus', 'icon--sm')}Add referral</button>` : '')
        : !rows.length ? state('search', 'No referrals match', 'Try another search, stage or reward status.', '<button class="btn btn--secondary btn--sm" type="button" data-clear="r">Clear filters</button>')
        : `<div class="mk-table-wrap"><table class="mk-table mk-table--ref"><caption class="sr-only">Family referrals and their rewards</caption>
            <thead><tr><th scope="col">Referring family</th><th scope="col">Referred child</th><th scope="col">Stage</th><th scope="col">Reward</th><th scope="col">Reward status</th><th scope="col" class="mk-c-act"><span class="sr-only">Actions</span></th></tr></thead>
            <tbody>${rows.map(referralRow).join('')}</tbody></table></div>`;
      return `<section class="panel mk-section" aria-labelledby="mk-ref-h">
        <div class="mk-section__head"><div><h2 class="cd-h2 mk-h" id="mk-ref-h">Family Referrals</h2><p class="mk-card__sub">Track family recommendations and the rewards earned when referred children enrol.</p></div>
          ${manage && all.length ? `<button class="btn btn--primary" type="button" data-newref>${icon('plus', 'icon--sm')}Add referral</button>` : ''}</div>
        ${banners}${summary}${tools}${body}</section>`;
    }

    function rewardLine(r) {
      if (r.status === 'pending') return r.stage === 'lost' ? 'Not earned — the enquiry is Lost' : 'Earned when the child enrols';
      if (r.status === 'earned') return `Earned ${day(r.earnedAt)}`;
      return `Given ${day(r.givenAt)} · ${r.givenBy}`;
    }

    function referralRow(r) {
      const e = r.enquiry;
      const fam = r.family && families ? `<a class="mk-name" href="${routes.page('family', { id: r.family.id })}" data-refname>${esc(r.familyName)}</a>` : `<span class="mk-name" tabindex="-1" data-refname>${esc(r.familyName)}</span>`;
      const child = e && admissions ? `<a class="mk-link" href="${routes.page('admissions', { applicant: e.id })}">${esc(r.childName)}</a>` : esc(r.childName);
      return `<tr data-ref="${esc(r.id)}" class="${r.id === focus ? 'is-focus' : ''}">
        <td class="mk-c-main">${fam}${r.family?.merged ? '<span class="mk-sub">Merged family record</span>' : ''}<span class="mk-sub">Recorded ${esc(day(r.createdAt))} · ${esc(r.createdBy)}</span></td>
        <td data-label="Referred child">${child}${e ? `<span class="mk-sub">${esc(e.programme)} · ${esc(store.ENQUIRY_SOURCES[e.source] || 'Other')}</span>` : ''}</td>
        <td data-label="Stage">${r.stage ? chip(STAGE_TONE[r.stage], store.ENQUIRY_STAGES[r.stage]) : chip('neutral', 'Not on record')}</td>
        <td data-label="Reward" class="mk-reward">${esc(r.reward)}</td>
        <td data-label="Reward status"><span class="mk-status">${chip(REWARD_TONE[r.status], store.REWARD_STATUSES[r.status], REWARD_ICON[r.status])}<span class="mk-sub">${esc(rewardLine(r))}</span>${r.notify?.status === 'failed' && r.status !== 'pending' ? `<span class="mk-sub mk-warn">${icon('alert-triangle', 'icon--sm')}Notification not created</span>` : ''}</span></td>
        <td class="mk-c-act">${manage && r.status === 'earned' ? `<button class="btn btn--primary btn--sm mk-give" type="button" data-give="${esc(r.id)}">Mark as given</button>` : ''}
          <div class="menu-wrap"><button class="btn btn--icon-ghost" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for the referral of ${esc(r.childName)}" data-menu>${icon('more')}</button>
          <div class="menu" role="menu" hidden>
            <button type="button" role="menuitem" data-refview="${esc(r.id)}">${icon('clock', 'icon--sm')}Details &amp; history</button>
            ${manage && r.status === 'earned' ? `<button type="button" role="menuitem" data-give="${esc(r.id)}">${icon('check-circle', 'icon--sm')}Mark as given…</button>` : ''}
            ${e && admissions ? `<button type="button" role="menuitem" data-refapp="${esc(e.id)}">${icon('user-plus', 'icon--sm')}Open applicant</button>` : ''}
            ${manage && r.notify?.status === 'failed' && r.status !== 'pending' ? `<button type="button" role="menuitem" data-renotify="${esc(r.id)}">${icon('refresh', 'icon--sm')}Retry notification</button>` : ''}
          </div></div></td></tr>`;
    }

    function referralDialog() {
      const fams = store.listFamilies().sort((x, y) => x.name.localeCompare(y.name));
      const enq = store.getAdmissionEnquiries().slice().sort((x, y) => x.child.localeCompare(y.child));
      const rewards = [...new Set(store.getReferrals().map(r => r.reward))];
      const clientId = `cl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      let confirmShared = false;
      const famOpt = x => `<option value="${esc(x.id)}">${esc(x.name)}${x.children.length ? ` — ${esc(x.children.map(k => k.firstName).join(', '))}` : ''}</option>`;
      const enqOpt = e => `<option value="${esc(e.id)}">${esc(e.child)} — ${esc(e.programme)} · ${esc(store.ENQUIRY_STAGES[e.stage])} (${esc(e.parent)})</option>`;
      const groups = list => Object.entries(store.ENQUIRY_STAGES).map(([k, l]) => { const g = list.filter(e => e.stage === k); return g.length ? `<optgroup label="${esc(l)}">${g.map(enqOpt).join('')}</optgroup>` : ''; }).join('');
      dialogOpen = true;
      if (!fams.length || !enq.length) {
        const d = kids.dialog({ label: 'Marketing / Referrals', title: 'Add referral', desc: '', body: `<p class="wt-banner wt-banner--neutral">${icon('info')}<span>${!fams.length ? 'There are no families on record yet. A referral links an existing family to an applicant.' : 'There are no admissions records yet. Add the referred child as an enquiry in Admissions first.'}</span></p>`, submit: 'Close', onClose() { dialogOpen = false; }, async onSubmit() { return { ok: true }; } });
        d.form.querySelector('[type="submit"]').focus();
        return;
      }
      const d = kids.dialog({
        label: 'Marketing / Referrals', title: 'Add referral', desc: 'Link the family who recommended the school to the referred child’s admissions record. No new family, child or enquiry is created.',
        body: `<div class="cls-form mk-pickers">
          <div class="field"><label class="field__label" for="kd-famq">Referring family <span class="field__req" aria-hidden="true">*</span></label>
            <input class="input mk-filter" id="kd-famq" type="search" placeholder="Type to narrow the list" autocomplete="off" aria-controls="kd-familyId" data-narrow="familyId">
            <select class="input" id="kd-familyId" name="familyId" required aria-label="Referring family" size="5">${fams.map(famOpt).join('')}</select>
            <p class="field__hint field__hint--error" data-error-for="familyId" hidden></p></div>
          <div class="field"><label class="field__label" for="kd-enqq">Referred child <span class="field__req" aria-hidden="true">*</span></label>
            <input class="input mk-filter" id="kd-enqq" type="search" placeholder="Type a child or parent name" autocomplete="off" aria-controls="kd-enquiryId" data-narrow="enquiryId">
            <select class="input" id="kd-enquiryId" name="enquiryId" required aria-label="Referred child’s admissions record" size="6">${groups(enq)}</select>
            <p class="field__hint">From Admissions. If the child isn’t listed, add an enquiry there first.</p>
            <p class="field__hint field__hint--error" data-error-for="enquiryId" hidden></p></div>
          <div data-enqinfo aria-live="polite"></div>
          ${kids.field('kd-reward', 'Reward', `<input class="input" id="kd-reward" name="reward" maxlength="80" required list="kd-rewards" placeholder="For example, One week fee credit"><datalist id="kd-rewards">${rewards.map(x => `<option value="${esc(x)}">`).join('')}</datalist>`, { required: true, hint: 'What the family receives once the child enrols. This is a description — no amount is calculated.' })}
          ${kids.field('kd-notes', 'Notes', '<textarea class="input" id="kd-notes" name="notes" rows="2" maxlength="500"></textarea>')}
          <div data-dup hidden></div></div>`,
        submit: 'Add referral',
        onClose() { dialogOpen = false; },
        async onSubmit(form) {
          const input = { familyId: form.elements.familyId.value, enquiryId: form.elements.enquiryId.value, reward: form.elements.reward.value, notes: form.elements.notes.value };
          const r = await store.createReferral(me(), input, { confirmShared, clientId, fail: takeFail('referral'), failNotify: takeFail('notify') });
          if (r.reason === 'duplicate') { showDup(form, r); return r.blocking ? { ok: false, message: 'This referral is already recorded — nothing new was added.' } : { keepOpen: true, submitLabel: 'Add another referral' }; }
          if (!r.ok) return r.errors ? { ok: false, errors: r.errors } : { ok: false, message: `The referral wasn’t added. ${failText(r)}` };
          dialogOpen = false;
          focus = r.referral.id;
          draw();
          main.querySelector(`[data-ref="${CSS.escape(r.referral.id)}"] [data-refname]`)?.focus();
          const notified = r.referral.notify?.status;
          toast(r.repeated ? 'Already added' : 'Referral added', r.earned ? `${r.referral.childName} had already enrolled, so ${r.referral.familyName}’s reward is Earned.${notified === 'failed' ? ' The notification couldn’t be created — retry from the row.' : ''}` : `${r.referral.familyName} → ${r.referral.childName}. The reward is Pending until the child enrols.`, r.earned ? 'star' : 'check-circle', { duration: 7000 });
          return { ok: true };
        }
      });
      const form = d.form;
      const allOpts = { familyId: form.elements.familyId.innerHTML, enquiryId: form.elements.enquiryId.innerHTML };
      const info = () => {
        const e = enq.find(x => x.id === form.elements.enquiryId.value);
        const box = form.querySelector('[data-enqinfo]');
        if (!e) { box.innerHTML = ''; return; }
        const sameFam = e.familyId && e.familyId === form.elements.familyId.value;
        const msg = sameFam ? ['warn', 'alert-triangle', `${esc(e.child)} is already in this family — a family can’t refer its own child.`]
          : e.stage === 'enrolled' ? ['ok', 'star', `${esc(e.child)} has already enrolled (${esc(day(e.stageAt))}). The reward will be recorded as Earned when you save.`]
          : e.stage === 'lost' ? ['warn', 'alert-triangle', `${esc(e.child)}’s enquiry is Lost. The reward stays Pending and is only earned if the child enrols.`]
          : ['neutral', 'info', `${esc(e.child)} is at <b>${esc(store.ENQUIRY_STAGES[e.stage])}</b>. The reward stays Pending until enrolment is completed.${e.source !== 'referral' ? ` The enquiry’s source stays “${esc(store.ENQUIRY_SOURCES[e.source] || 'Other')}”.` : ''}`];
        box.innerHTML = `<p class="wt-banner wt-banner--${msg[0]}">${icon(msg[1])}<span>${msg[2]}</span></p>`;
      };
      form.addEventListener('input', ev => {
        const k = ev.target.dataset.narrow;
        if (k) {
          const sel = form.elements[k];
          const keep = sel.value;
          const tmp = document.createElement('select');
          tmp.innerHTML = allOpts[k];
          const q = ev.target.value.trim().toLowerCase();
          if (q) { tmp.querySelectorAll('option').forEach(o => { if (!o.textContent.toLowerCase().includes(q)) o.remove(); }); tmp.querySelectorAll('optgroup').forEach(g => { if (!g.children.length) g.remove(); }); }
          sel.innerHTML = tmp.innerHTML;
          sel.value = keep;
        }
      });
      form.addEventListener('change', ev => {
        if (['familyId', 'enquiryId'].includes(ev.target.name)) { confirmShared = false; const b = form.querySelector('[data-dup]'); b.hidden = true; b.innerHTML = ''; form.querySelector('[type="submit"]').textContent = 'Add referral'; info(); }
      });
      form.elements.familyId.selectedIndex = -1;
      form.elements.enquiryId.selectedIndex = -1;
      form.querySelector('#kd-famq').focus();
      function showDup(fm, r) {
        const box = fm.querySelector('[data-dup]');
        box.hidden = false;
        box.innerHTML = r.blocking
          ? `<div class="ad-dup__box" role="alert"><p class="ad-dup__t">${icon('alert-triangle', 'icon--sm')}${esc(r.existing.familyName)} already referred ${esc(r.existing.childName)} (recorded ${esc(day(r.existing.createdAt))}, reward ${esc(store.REWARD_STATUSES[r.existing.status])}).</p></div>`
          : `<div class="ad-dup__box" role="alert"><p class="ad-dup__t">${icon('alert-triangle', 'icon--sm')}${esc(r.others[0].childName)} was also referred by ${esc(r.others.map(x => x.familyName).join(', '))}.</p><p class="cd-note">Each referral earns its own reward when the child enrols. Add this one only if both families should be rewarded.</p>
            <label class="fb-check"><input type="checkbox" data-shared${confirmShared ? ' checked' : ''}><span><b>Both families recommended the school</b><small>Record a second referral for this child.</small></span></label></div>`;
        box.querySelector('[data-shared]')?.addEventListener('change', ev => { confirmShared = ev.target.checked; });
        box.querySelector('input')?.focus();
      }
    }

    function giveDialog(r) {
      const billing = store.referralBilling(me());
      dialogOpen = true;
      const d = kids.dialog({
        label: 'Marketing / Referral reward', title: 'Mark reward as given?',
        desc: 'Have you provided this reward to the family?',
        body: `<dl class="wt-ctx mk-dl"><div><dt>Referring family</dt><dd>${esc(r.familyName)}</dd></div><div><dt>Referred child</dt><dd>${esc(r.childName)}${r.stage ? ` · ${esc(store.ENQUIRY_STAGES[r.stage])}` : ''}</dd></div><div><dt>Reward</dt><dd>${esc(r.reward)}</dd></div><div><dt>Reward status</dt><dd>${esc(store.REWARD_STATUSES[r.status])} · ${esc(day(r.earnedAt))}</dd></div></dl>
          <p class="wt-banner wt-banner--neutral">${icon('wallet')}<span><b>Fee credit note: not available.</b> ${esc(billing.reason)} If the reward is a fee credit, apply it through your school’s usual billing process — this only records that the reward was given.</span></p>
          <p class="cd-note">Your name and the time are recorded in the referral history. This can’t be undone.</p>`,
        submit: 'Confirm reward given',
        onClose() { dialogOpen = false; },
        async onSubmit() {
          const res = await store.markReferralGiven(me(), r.id, { fail: takeFail('given') });
          if (!res.ok) {
            if (res.reason === 'already-given') { dialogOpen = false; draw(); toast('Already given', `${res.referral.givenBy} marked this reward as given on ${day(res.referral.givenAt)}.`, 'info'); return { ok: true }; }
            if (res.reason === 'not-earned') { dialogOpen = false; draw(); toast('Not earned yet', 'This reward is no longer Earned, so it can’t be marked as given. The latest status is shown.', 'alert-circle'); return { ok: true }; }
            if (res.reason === 'missing') { dialogOpen = false; draw(); toast('Referral not found', FAIL.missing, 'alert-circle'); return { ok: true }; }
            return { ok: false, message: `The reward is still Earned — nothing was changed. ${res.reason === 'busy' ? FAIL.busy : 'Select Confirm reward given to try again.'}` };
          }
          dialogOpen = false;
          draw();
          main.querySelector(`[data-ref="${CSS.escape(r.id)}"] [data-refname]`)?.focus();
          toast('Reward marked as given', `${res.referral.reward} · ${res.referral.familyName} · ${when(res.referral.givenAt)}`, 'check-circle');
          return { ok: true };
        }
      });
      d.form.querySelector('[type="submit"]').focus();
    }

    function referralDetails(r) {
      const rows = [
        ['Referral ID', r.id], ['Referring family', `${r.familyName}${r.family ? ` (${r.family.id})` : ''}`], ['Referred child', `${r.childName}${r.enquiry ? ` · applicant ${r.enquiry.id}` : ''}`],
        ['Stage', r.stage ? store.ENQUIRY_STAGES[r.stage] : 'Not on record'], ['Reward', r.reward], ['Reward status', store.REWARD_STATUSES[r.status]],
        ['Recorded', `${when(r.createdAt)} · ${r.createdBy}`], ['Earned', r.earnedAt ? `${when(r.earnedAt)}${r.earnedTrigger?.childId ? ` · child ${r.earnedTrigger.childId}` : ''}` : '—'],
        ['Given', r.givenAt ? `${when(r.givenAt)} · ${r.givenBy}` : '—'], ['Credit note', r.creditNoteId || 'None'],
        ['Notification', r.notify ? (r.notify.status === 'failed' ? 'Not created — retry from the actions menu' : `Sent to ${plural(r.notify.count, 'administrator')}`) : r.status === 'pending' ? 'Sent when the reward is earned' : '—'],
        ...(r.notes ? [['Notes', r.notes]] : [])
      ];
      dialogOpen = true;
      const d = kids.dialog({
        label: 'Marketing / Referral', title: `${r.familyName} → ${r.childName}`, desc: '',
        body: `<dl class="wt-ctx mk-dl">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
          <h3 class="mk-h3">History</h3><ol class="wt-hist">${[...(r.history || [])].reverse().map(h => `<li><b>${esc(h.detail)}</b><span>${esc(when(h.at))} · ${esc(h.by)}</span></li>`).join('')}</ol>`,
        submit: 'Done', onClose() { dialogOpen = false; }, async onSubmit() { return { ok: true }; }
      });
      d.form.querySelector('[type="submit"]').focus();
    }

    async function reconcile(btn) {
      btn.disabled = true;
      btn.classList.add('is-loading');
      const r = await store.reconcileReferrals(me(), { fail: takeFail('reconcile'), failNotify: takeFail('notify') });
      if (document.contains(btn)) { btn.disabled = false; btn.classList.remove('is-loading'); }
      if (!r.ok) { toast('Rewards not updated', `${failText(r)} The rewards stay Pending until this succeeds.`, 'alert-circle', { duration: 7000 }); return; }
      draw();
      toast(r.earned.length ? 'Rewards updated' : 'Nothing to update', r.earned.length ? `${plural(r.earned.length, 'reward')} now Earned from the recorded enrolments.` : 'Every reward already matches its child’s enrolment.', 'check-circle');
    }

    /* ----------------------------- Events */

    const closeMenu = (restore = false) => { if (!openMenu) return; const b = openMenu.querySelector('[data-menu]'); openMenu.querySelector('.menu').hidden = true; b.setAttribute('aria-expanded', 'false'); openMenu.closest('tr')?.classList.remove('has-menu'); openMenu = null; if (restore) b.focus(); };
    const ref = id => store.referralView(store.getReferrals().find(x => x.id === id) || { id, history: [] });
    const camp = id => store.getCampaigns().find(c => c.id === id);
    const guard = () => { if (manage) return true; toast('Not allowed', FAIL.forbidden, 'lock'); return false; };

    main.addEventListener('click', async ev => {
      const t = ev.target;
      if (t.closest('[data-retry]')) { load(); return; }
      if (t.closest('[data-alltime]')) { period = 'all'; syncUrl(); draw(); $('#mk-period')?.focus(); return; }
      const src = t.closest('[data-src]');
      if (src) { picked = picked === src.dataset.src ? '' : src.dataset.src; draw(); main.querySelector(`[data-src="${CSS.escape(src.dataset.src)}"]`)?.focus(); return; }
      const clr = t.closest('[data-clear]');
      if (clr) { const p = clr.dataset.clear; Object.keys(f).filter(k => k.startsWith(p)).forEach(k => { f[k] = ''; }); draw(); $(p === 'c' ? '#mk-cq' : '#mk-rq')?.focus(); return; }
      if (t.closest('[data-newcampaign]')) { if (guard()) campaignDialog(); return; }
      if (t.closest('[data-newref]')) { if (guard()) referralDialog(); return; }
      const rc = t.closest('[data-reconcile]');
      if (rc) { if (guard()) reconcile(rc); return; }
      const mb = t.closest('[data-menu]');
      if (mb) {
        const wrap = mb.closest('.menu-wrap');
        if (openMenu === wrap) { closeMenu(); return; }
        closeMenu();
        const m = wrap.querySelector('.menu');
        m.hidden = false;
        m.classList.toggle('is-up', mb.getBoundingClientRect().bottom + 240 > innerHeight);
        mb.setAttribute('aria-expanded', 'true');
        wrap.closest('tr')?.classList.add('has-menu');
        openMenu = wrap;
        m.querySelector('button:not([disabled])')?.focus();
        return;
      }
      const act = (attr, fn) => { const b = t.closest(`[${attr}]`); if (!b || b.disabled) return false; closeMenu(); fn(b.getAttribute(attr), b); return true; };
      if (act('data-campview', id => { const c = camp(id); if (c) campaignDetails(c); else draw(); })) return;
      if (act('data-campedit', id => { const c = camp(id); if (c && guard()) campaignDialog(c); })) return;
      if (act('data-campenq', id => { location.href = enquiriesHref({ campaign: id }); })) return;
      if (act('data-camplink', async id => {
        const c = camp(id);
        if (!c) return;
        try { await navigator.clipboard.writeText(visitLink(c)); toast('Link copied', `Visit requests from this link are filed under “${c.name}”.`, 'copy'); } catch { toast('Copy this link', visitLink(c), 'copy', { duration: 9000 }); }
      })) return;
      if (act('data-give', id => {
        if (!guard()) return;
        const r = ref(id);
        if (r.status !== 'earned') { draw(); toast(r.status === 'given' ? 'Already given' : 'Not earned yet', r.status === 'given' ? `Given ${day(r.givenAt)} by ${r.givenBy}.` : 'A reward can be marked as given only once it’s Earned.', 'info'); return; }
        giveDialog(r);
      })) return;
      if (act('data-refview', id => referralDetails(ref(id)))) return;
      if (act('data-refapp', id => { location.href = routes.page('admissions', { applicant: id }); })) return;
      act('data-renotify', async id => {
        if (!guard()) return;
        const r = await store.retryReferralNotification(me(), id, { fail: takeFail('notify') });
        draw();
        toast(r.ok ? 'Notification created' : 'Still not created', r.ok ? 'School leaders can see the reward in their notifications.' : 'Try again in a moment. The reward itself is recorded.', r.ok ? 'bell' : 'alert-circle');
      });
    });
    document.addEventListener('click', ev => { if (openMenu && !openMenu.contains(ev.target)) closeMenu(); });
    main.addEventListener('keydown', ev => {
      if (ev.key === 'Escape' && openMenu) { closeMenu(true); return; }
      if (openMenu && ['ArrowDown', 'ArrowUp'].includes(ev.key)) {
        const items = [...openMenu.querySelectorAll('.menu button:not([disabled])')];
        const i = items.indexOf(document.activeElement);
        ev.preventDefault();
        items[(i + (ev.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      }
    });
    const syncUrl = () => { const u = new URL(location.href); u.searchParams.set('period', period); u.searchParams.delete('referral'); history.replaceState(null, '', u); };
    main.addEventListener('change', ev => {
      if (ev.target.matches('[data-period]')) { period = ev.target.value; picked = ''; syncUrl(); draw(); return; }
      const k = ev.target.dataset.f;
      if (k && !['cq', 'rq'].includes(k)) { f[k] = ev.target.value; draw(); }
    });
    main.addEventListener('input', ev => {
      const k = ev.target.dataset.f;
      if (k === 'cq' || k === 'rq') { f[k] = ev.target.value; draw(); }
    });

    // Enquiries, tours, enrolments, families, campaigns or referrals changed (here or in another tab): recompute.
    store.subscribe(({ key }) => { if (loaded && !dialogOpen && !openMenu && (!key || /^nexora-(admission-enquiries|tours|campaigns|referrals|families|children|households)/.test(key))) draw(); });
    load();
  }

  window.NexoraMarketing = { render };
})();
