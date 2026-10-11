/* Announcements & Emergency Broadcast (app.html?page=communication[&tab=sent|scheduled|drafts][&focus=<id>][&compose=1])
   Everything goes through the store (resolveAudience, saveAnnouncementDraft, scheduleAnnouncement, sendAnnouncement,
   remindUnread, sendEmergency …), which re-checks permissions, the audience and the typed emergency phrase at save time.
   Family reads/acknowledgements are a labelled demo simulation; family delivery is recorded as queued, never as delivered.
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
  const isoDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const initials = n => String(n || '').trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
  const when = s => (s ? new Date(s).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
  const time = s => new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const TABS = [['sent', 'Sent'], ['scheduled', 'Scheduled'], ['drafts', 'Drafts']];
  const STEPS = ['Audience', 'Message', 'Options', 'Preview'];
  const STEP_OF = { audience: 0, title: 1, body: 1, attachments: 1, channels: 2, scheduledAt: 2 };
  const STATUS = { draft: ['info', 'Draft'], scheduled: ['warning', 'Scheduled'], sending: ['info', 'Sending'], sent: ['success', 'Sent'], failed: ['error', 'Failed'], cancelled: ['neutral', 'Cancelled'] };
  const FAIL = {
    forbidden: 'Your role can’t do this. Nothing was changed.',
    missing: 'This announcement no longer exists. Refresh the page.',
    locked: 'This announcement has already been sent or cancelled, so it can’t be changed.',
    busy: 'Still working on the last request — please wait a moment.',
    none: 'There’s no one left to do this for.',
    'no-recipients': 'No one is in this audience any more, so nothing was sent.',
    storage: 'This couldn’t be saved on this device. Nothing was changed. Please try again.'
  };
  const failText = r => (r.errors && Object.values(r.errors)[0]) || FAIL[r.reason] || FAIL.storage;
  const toast = (t, x, i = 'info', o) => window.NexoraToast?.show(t, x, i, o);

  function render(key, main, user) {
    if (key !== 'communication') return false;
    page(main, user);
    return true;
  }

  // Counts how each recipient's copy was recorded, for honest delivery summaries.
  function deliverySummary(a) {
    const rs = a.recipients || [];
    const n = re => rs.filter(r => re.test(r.delivery?.app || '')).length;
    return { notified: n(/^notified/), queued: n(/^queued/), skipped: n(/^skipped/) };
  }
  const deliveryText = d => [d.notified && `${d.notified} staff notified`, d.queued && `${d.queued} queued for families (demo — not delivered)`, d.skipped && `${d.skipped} skipped (no parent-app account)`].filter(Boolean).join(' · ') || 'Nothing recorded';

  function page(main, user) {
    const t0 = store.announcementTargets(user);
    const lead = t0.canAll;
    const canNew = store.canAnnounce(user);
    const canSos = store.canEmergency(user);
    const myClasses = store.classScope(user);
    let tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'sent';
    let q = '';
    let loaded = false;
    let failOnce = params.get('fail') === '1';
    let drawer = null;
    let openMenu = null;
    const me = () => store.currentUser();

    main.classList.add('kids-page');
    document.title = 'Announcements · Nexora';
    main.innerHTML = `
      <div class="kids an">
        <header class="kids-head an-head">
          <div class="kids-head__text"><nav class="kids-crumbs" aria-label="Breadcrumb"><span>Communications</span> / <span aria-current="page">Announcements</span></nav>
            <h1 class="kids-head__title" id="page-title" tabindex="-1">Announcements</h1>
            <p class="kids-head__sub">News, reminders and urgent alerts for families and staff — with read and acknowledgement tracking.</p></div>
          <div class="an-head__actions">
            ${canSos ? `<button class="btn an-sos-btn" type="button" data-emergency>${icon('siren', 'icon--sm')}Emergency broadcast</button>` : ''}
            ${canNew ? `<button class="btn btn--primary kids-yellow" type="button" data-new>${icon('plus', 'icon--sm')}New announcement</button>` : ''}
          </div>
        </header>
        <div data-sos></div>
        <section class="cls-sum an-sum" aria-label="Summary" data-sum>${'<span class="skeleton kpi kpi--static"></span>'.repeat(4)}</section>
        <div class="an-bar">
          <div class="tabs an-tabs" role="tablist" aria-label="Announcements">${TABS.map(([k, l]) => `<button class="tab" type="button" role="tab" id="an-tab-${k}" aria-controls="an-panel" aria-selected="${k === tab}" tabindex="${k === tab ? 0 : -1}" data-tab="${k}">${l}<span class="tab__count" data-count="${k}">·</span></button>`).join('')}</div>
          <div class="an-search"><label class="sr-only" for="an-q">Search announcements</label>${icon('search', 'icon--sm')}<input class="input" id="an-q" type="search" placeholder="Search announcements" autocomplete="off"></div>
        </div>
        <section class="an-panel" id="an-panel" role="tabpanel" aria-labelledby="an-tab-${tab}" aria-busy="true" data-panel><span class="skeleton" style="display:block;height:300px;border-radius:var(--radius-lg)"></span></section>
      </div>`;
    const $ = s => main.querySelector(s);
    const syncUrl = (focus = '') => {
      const u = new URL(location.href);
      tab === 'sent' ? u.searchParams.delete('tab') : u.searchParams.set('tab', tab);
      focus ? u.searchParams.set('focus', focus) : u.searchParams.delete('focus');
      u.searchParams.delete('compose');
      history.replaceState(null, '', u);
    };
    const chip = (tone, text, extra = '') => `<span class="badge badge--plain an-chip an-chip--${tone}"${extra}>${esc(text)}</span>`;
    const state = (iconName, title, text, action = '', tone = '') => `<div class="kids-empty an-state"${tone === 'error' ? ' role="alert"' : ''}><span class="state-icon${tone ? ` state-icon--${tone}` : ''}" aria-hidden="true">${icon(iconName)}</span><h2 class="kids-empty__title">${title}</h2><p>${text}</p>${action}</div>`;

    const visible = a => lead || a.createdById === user.id || (a.status === 'sent' && (a.recipients || []).some(r => r.id === `staff:${user.id}` || (r.classes || []).some(c => myClasses.includes(c))));
    const all = () => store.getAnnouncements().filter(visible);
    const byTab = list => ({
      sent: list.filter(a => ['sent', 'failed'].includes(a.status)).sort((a, b) => (b.sentAt || b.updatedAt).localeCompare(a.sentAt || a.updatedAt)),
      scheduled: [...list.filter(a => a.status === 'scheduled').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)), ...list.filter(a => a.status === 'cancelled').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))],
      drafts: list.filter(a => a.status === 'draft').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    });
    const find = id => store.getAnnouncements().find(a => a.id === id);

    /* ---------------------------------------------------------------- Page */

    function sosHtml() {
      const active = store.activeBroadcasts();
      if (!active.length) return '';
      const staff = store.users.filter(u => u.schoolId === store.school.id).length;
      return `<section class="an-live" aria-labelledby="an-live-title"><div class="an-live__icon" aria-hidden="true">${icon('siren')}</div><div class="an-live__main"><h2 class="an-live__title" id="an-live-title">Emergency broadcast active</h2>
        <ul>${active.map(b => `<li><p>${esc(b.message)}</p><small>Sent by ${esc(b.createdByName)} · ${esc(when(b.createdAt))} · acknowledged by ${b.ackBy.length} of ${staff} staff</small>${store.canBroadcast(user) ? `<button class="btn btn--secondary btn--sm" type="button" data-end="${esc(b.id)}">End broadcast</button>` : ''}</li>`).join('')}</ul></div></section>`;
    }

    function summaryHtml(list) {
      const now = new Date();
      const sameMonth = s => { const d = new Date(s); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); };
      const sentMonth = list.filter(a => a.status === 'sent' && a.sentAt && sameMonth(a.sentAt));
      const scheduled = list.filter(a => a.status === 'scheduled').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
      const drafts = list.filter(a => a.status === 'draft');
      const rated = sentMonth.map(a => store.announcementStats(a)).filter(s => s.total);
      const avg = rated.length ? Math.round(rated.reduce((n, s) => n + s.pct, 0) / rated.length) : null;
      const stat = (iconName, label, value, context, tone = '') => `<div class="kpi kpi--static cls-sum__item${tone ? ` kpi--${tone}` : ''}"><span class="kpi__top"><span class="kpi__icon" aria-hidden="true">${icon(iconName)}</span><span class="kpi__label">${label}</span></span><span class="kpi__value">${value}</span><span class="kpi__context">${context}</span></div>`;
      return stat('megaphone', 'Sent this month', sentMonth.length, sentMonth.length ? `${sentMonth.filter(a => a.type === 'emergency').length ? `${plural(sentMonth.filter(a => a.type === 'emergency').length, 'emergency broadcast')} · ` : ''}${now.toLocaleDateString('en-GB', { month: 'long' })}` : 'Nothing sent yet this month')
        + stat('clock', 'Scheduled', scheduled.length, scheduled.length ? `Next: ${esc(when(scheduled[0].scheduledAt))}` : 'Nothing waiting to go out')
        + stat('pencil', 'Drafts', drafts.length, drafts.length ? `Last edited ${esc(when(drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0].updatedAt))}` : 'No drafts saved')
        + stat('eye', 'Average read rate', avg === null ? '—' : `${avg}<small>%</small>`, avg === null ? 'No recipients this month yet' : `Across ${plural(rated.length, 'announcement')} · family reads are demo only`);
    }

    const progress = a => {
      const s = store.announcementStats(a);
      return `<div class="an-prog"><span class="an-prog__bar" aria-hidden="true"><i style="width:${s.pct}%"></i></span><span class="an-prog__txt">Read ${s.read}/${s.total} · ${s.pct}%</span></div>`;
    };
    const ackCell = a => { if (!a.requireAck) return '<span class="cp-muted">Not required</span>'; const s = store.announcementStats(a); return `<span class="an-ack${s.ack === s.total && s.total ? ' is-done' : ''}">${icon('check-circle', 'icon--sm')}${s.ack}/${s.total} · ${s.ackPct}%</span>`; };
    const tags = a => `${a.type === 'emergency' ? chip('error', `Emergency · ${store.EMERGENCY_TYPES[a.emergencyType] || 'Other'}`) : chip('cat', store.ANN_CATEGORIES[a.category] || 'General')}${a.status !== 'sent' && a.status !== 'draft' ? chip(STATUS[a.status][0], STATUS[a.status][1]) : ''}`;
    const dateFor = a => (a.status === 'scheduled' ? `For ${when(a.scheduledAt)}` : a.status === 'cancelled' ? `Cancelled ${when(a.cancelledAt || a.updatedAt)}` : a.status === 'draft' ? `Edited ${when(a.updatedAt)}` : a.status === 'failed' ? `Failed · ${a.failReason || 'not sent'}` : when(a.sentAt));

    function actions(a) {
      const m = store.canManageAnn(user, a);
      const s = store.announcementStats(a);
      const out = [['view', 'eye', 'View details']];
      if (a.status === 'sent' && m && s.read < s.total) out.push(['remind', 'bell', 'Remind unread']);
      if (a.status === 'scheduled' && m) out.push(['edit', 'pencil', 'Edit'], ['sendnow', 'megaphone', 'Send now']);
      if (a.status === 'draft' && m) out.push(['edit', 'pencil', 'Edit']);
      if (canNew && a.type !== 'emergency') out.push(['duplicate', 'copy', 'Duplicate']);
      if (a.status === 'scheduled' && m) out.push(['cancel', 'x', 'Cancel schedule', true]);
      if (a.status === 'draft' && m) out.push(['delete', 'trash', 'Delete draft', true]);
      return out;
    }
    const menu = (a, where) => `<div class="menu-wrap"><button class="btn btn--icon-ghost" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(a.title || 'untitled draft')}" data-menu="${esc(a.id)}" data-where="${where}">${icon('more-v')}</button>
      <div class="menu" role="menu" hidden>${actions(a).map(([k, ic, l, danger]) => `<button type="button" role="menuitem" data-act="${k}" data-id="${esc(a.id)}"${danger ? ' class="is-danger"' : ''}>${icon(ic, 'icon--sm')}${l}</button>`).join('')}</div></div>`;

    function listHtml(rows) {
      const cols = { sent: ['Announcement', 'Audience', 'Sent', 'Read', 'Acknowledged'], scheduled: ['Announcement', 'Audience', 'When', 'Status'], drafts: ['Announcement', 'Audience', 'Last edited'] }[tab];
      const title = a => `<button class="an-title" type="button" data-open="${esc(a.id)}">${esc(a.title || 'Untitled draft')}</button>`;
      const cells = a => {
        if (tab === 'sent') return `<td>${esc(a.audience || '—')}</td><td>${esc(dateFor(a))}</td><td>${a.status === 'sent' ? progress(a) : '—'}</td><td>${a.status === 'sent' ? ackCell(a) : '—'}</td>`;
        if (tab === 'scheduled') return `<td>${esc(a.audience || '—')}</td><td>${esc(a.status === 'scheduled' ? when(a.scheduledAt) : when(a.cancelledAt || a.updatedAt))}</td><td>${chip(STATUS[a.status][0], STATUS[a.status][1])}</td>`;
        return `<td>${esc(a.audience || 'No audience yet')}</td><td>${esc(when(a.updatedAt))}</td>`;
      };
      const table = `<div class="table-shell an-table"><table class="data-table"><caption class="sr-only">${TABS.find(x => x[0] === tab)[1]} announcements</caption><thead><tr>${cols.map(c => `<th scope="col">${c}</th>`).join('')}<th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${rows.map(a => `<tr class="${a.type === 'emergency' ? 'is-emergency' : ''}${a.status === 'cancelled' ? ' is-muted' : ''}"><td><div class="an-cell">${title(a)}<div class="an-tags">${tags(a)}${a.requireAck ? chip('neutral', 'Acknowledgement') : ''}</div></div></td>${cells(a)}<td class="an-actions">${menu(a, 't')}</td></tr>`).join('')}</tbody></table></div>`;
      const cards = `<ul class="an-cards">${rows.map(a => `<li class="panel an-card${a.type === 'emergency' ? ' is-emergency' : ''}${a.status === 'cancelled' ? ' is-muted' : ''}">
          <div class="an-card__head"><div class="an-tags">${tags(a)}</div>${menu(a, 'c')}</div>
          ${title(a)}
          <p class="an-card__meta">${icon('users', 'icon--sm')}<span>${esc(a.audience || 'No audience yet')}</span></p>
          <p class="an-card__meta">${icon('clock', 'icon--sm')}<span>${esc(dateFor(a))}</span></p>
          ${a.status === 'sent' ? `${progress(a)}${a.requireAck ? `<p class="an-card__meta">${ackCell(a)} acknowledged</p>` : ''}` : ''}
        </li>`).join('')}</ul>`;
      return table + cards;
    }

    function paint() {
      const list = all();
      const groups = byTab(list);
      $('[data-sos]').innerHTML = sosHtml();
      $('[data-sum]').innerHTML = summaryHtml(list);
      TABS.forEach(([k]) => {
        const el = $(`[data-count="${k}"]`);
        const n = k === 'scheduled' ? groups.scheduled.filter(a => a.status === 'scheduled').length : groups[k].length;
        el.textContent = n;
        el.setAttribute('aria-label', plural(n, 'item'));
        const b = $(`#an-tab-${k}`);
        b.setAttribute('aria-selected', String(k === tab));
        b.tabIndex = k === tab ? 0 : -1;
      });
      const panel = $('[data-panel]');
      panel.setAttribute('aria-labelledby', `an-tab-${tab}`);
      panel.removeAttribute('aria-busy');
      const ql = q.trim().toLowerCase();
      const rows = groups[tab].filter(a => !ql || `${a.title} ${a.body} ${a.audience} ${a.createdBy}`.toLowerCase().includes(ql));
      const newBtn = canNew ? `<button class="btn btn--primary kids-yellow" type="button" data-new>${icon('plus', 'icon--sm')}New announcement</button>` : '';
      if (!groups[tab].length) {
        panel.innerHTML = tab === 'sent' ? state('megaphone', 'No announcements sent yet', 'Announcements you send to families and staff will appear here with their read progress.', newBtn)
          : tab === 'scheduled' ? state('clock', 'Nothing scheduled', 'Schedule an announcement to send it later — it waits here until then.', newBtn)
            : state('pencil', 'No drafts', 'Save an announcement as a draft to finish it later.', newBtn);
        return;
      }
      if (!rows.length) { panel.innerHTML = state('search', 'No announcements match', `Nothing in ${TABS.find(x => x[0] === tab)[1].toLowerCase()} matches “${esc(q.trim())}”.`, '<button class="btn btn--tertiary btn--sm" type="button" data-clear-q>Clear search</button>'); return; }
      panel.innerHTML = listHtml(rows);
    }

    function load() {
      setTimeout(() => {
        if (failOnce) {
          failOnce = false;
          $('[data-sum]').innerHTML = '';
          $('[data-panel]').removeAttribute('aria-busy');
          $('[data-panel]').innerHTML = state('alert-circle', 'Announcements couldn’t load', 'Something went wrong while reading announcements on this device. Nothing was changed.', '<button class="btn btn--primary kids-yellow" type="button" data-retry>Try again</button>', 'error');
          return;
        }
        loaded = true;
        paint();
        if (params.get('focus') && find(params.get('focus'))) openDrawer(params.get('focus'), $('#page-title'));
        else if (params.get('compose') === '1' && canNew) composer();
      }, 250);
    }

    /* ---------------------------------------------------------------- Actions */

    const confirm = ({ label, title, desc, submit, danger = false, run }) => kids.dialog({ label, title, desc, body: '', submit, danger, async onSubmit() { const r = await run(); return r.ok ? r : { ok: false, message: failText(r) }; } });

    async function act(kind, id) {
      const a = find(id);
      if (!a) { toast('Not found', FAIL.missing); return; }
      if (kind === 'view') { openDrawer(id); return; }
      if (kind === 'edit') { drawer?.close(false); composer(a); return; }
      if (kind === 'remind') { remindDialog(a); return; }
      if (kind === 'duplicate') {
        const r = await store.duplicateAnnouncement(me(), id);
        if (!r.ok) { toast('Not duplicated', failText(r)); return; }
        tab = 'drafts'; syncUrl(); paint();
        toast('Copy saved as a draft', `“${r.announcement.title}” — choose its audience again before sending.`, 'copy', { action: { label: 'Edit', onClick: () => composer(find(r.announcement.id)) } });
        return;
      }
      if (kind === 'delete') {
        confirm({ label: 'Announcements / Draft', title: 'Delete this draft?', desc: `“${esc(a.title || 'Untitled draft')}” will be removed. This can’t be undone.`, submit: 'Delete draft', danger: true,
          run: async () => { const r = await store.deleteAnnouncementDraft(me(), id); if (r.ok) { drawer?.close(false); toast('Draft deleted', a.title || 'Untitled draft', 'trash'); } return r; } });
        return;
      }
      if (kind === 'sendnow') {
        const n = store.resolveAudience(me(), a.audienceSpec).count;
        confirm({ label: 'Announcements / Scheduled', title: 'Send it now?', desc: `“${esc(a.title)}” was scheduled for ${esc(when(a.scheduledAt))}. It will go to ${esc(plural(n, 'recipient'))} straight away instead.`, submit: `Send now to ${plural(n, 'recipient')}`,
          run: async () => { const r = await store.sendScheduledNow(me(), id); if (r.ok) { tab = 'sent'; syncUrl(); paint(); toast('Announcement sent', deliveryText(deliverySummary(r.announcement)), 'check-circle', { action: { label: 'View', onClick: () => openDrawer(id) } }); } return r; } });
        return;
      }
      if (kind === 'cancel') {
        confirm({ label: 'Announcements / Scheduled', title: 'Cancel this scheduled announcement?', desc: `“${esc(a.title)}” won’t be sent on ${esc(when(a.scheduledAt))}. It stays in the list as cancelled; duplicate it to send it later.`, submit: 'Cancel schedule', danger: true,
          run: async () => { const r = await store.cancelAnnouncement(me(), id); if (r.ok) toast('Schedule cancelled', `“${a.title}” won’t be sent.`, 'x'); return r; } });
      }
    }

    function remindDialog(a) {
      const unread = a.recipients.filter(r => !r.readAt);
      if (!unread.length) { toast('Everyone has read it', 'There’s no one to remind.', 'check-circle'); return; }
      const fam = unread.filter(r => r.kind === 'family').length;
      confirm({ label: 'Announcements / Reminder', title: `Remind ${plural(unread.length, 'unread recipient')}?`,
        desc: `Only people who haven’t read “${esc(a.title)}” get a reminder${fam ? ` — family reminders are recorded as queued (demo — not delivered)` : ''}. Anyone reminded in the last 10 minutes is skipped, so no one is reminded twice.`,
        submit: `Remind ${unread.length} unread`,
        run: async () => { const r = await store.remindUnread(me(), a.id); if (r.ok) toast('Reminders recorded', `${r.targeted} unread · ${r.queued} reminded · ${r.skipped} skipped`, 'bell'); return r; } });
    }

    /* ---------------------------------------------------------------- Composer (4 steps) */

    function composer(rec = null) {
      if (!canNew) return;
      const t = store.announcementTargets(user);
      const opener = document.activeElement;
      const spec = rec?.audienceSpec || {};
      const later = new Date(Date.now() + 60 * 60000);
      const sched = rec?.scheduledAt ? new Date(rec.scheduledAt) : later;
      const s = {
        id: rec?.id || null, title: rec?.title || '', body: rec?.body || '', category: rec?.category || 'general',
        spec: { mode: spec.mode || (t.canAll ? 'all' : 'classes'), classIds: [...(spec.classIds || [])], familyIds: [...(spec.familyIds || [])], staffIds: [...(spec.staffIds || [])] },
        channels: rec?.channels?.length ? rec.channels.filter(c => store.ANN_CHANNELS[c]?.available) : ['app'],
        requireAck: Boolean(rec?.requireAck), when: rec?.status === 'scheduled' ? 'schedule' : 'now',
        sdate: isoDay(sched), stime: `${pad(sched.getHours())}:${pad(sched.getMinutes())}`,
        attachments: (rec?.attachments || []).map(id => ({ id, name: store.chatFile(user, id)?.name || 'Attachment', state: 'ready' }))
      };
      const snap = () => JSON.stringify({ ...s, id: 0, attachments: s.attachments.map(x => x.id) });
      let saved = snap();
      let step = rec ? 3 : 0;
      let reached = rec ? 3 : 0;
      let mode = 'edit';
      let busy = false;
      let errors = {};
      let pick = { q: '' };
      const editingScheduled = rec?.status === 'scheduled';

      const el = document.createElement('dialog');
      el.className = 'modal an-modal';
      el.setAttribute('aria-labelledby', 'an-c-title');
      el.innerHTML = `<div class="modal__panel">
        <span class="modal__grabber" aria-hidden="true"></span>
        <div class="modal__top"><span class="tech-label">Communications / ${rec ? 'Edit' : 'New'} announcement</span><button class="btn btn--icon-ghost" type="button" aria-label="Close" data-x>${icon('x')}</button></div>
        <div class="an-c-head"><h2 class="modal__title" id="an-c-title">${rec ? 'Edit announcement' : 'New announcement'}</h2><ol class="an-steps" data-steps></ol></div>
        <div class="modal__body an-c-body" data-body></div>
        <div class="modal__foot an-c-foot" data-foot></div></div>`;
      document.body.appendChild(el);
      const body = el.querySelector('[data-body]');
      const foot = el.querySelector('[data-foot]');
      const aud = () => store.resolveAudience(user, s.spec);
      const input = () => ({ title: s.title, body: s.body, category: s.category, audienceSpec: s.spec, channels: s.channels, requireAck: s.requireAck, attachments: s.attachments.filter(x => x.state === 'ready').map(x => x.id), scheduledAt: s.when === 'schedule' ? new Date(`${s.sdate}T${s.stime || '00:00'}:00`).toISOString() : null });
      const err = k => `<p class="field__hint field__hint--error" id="an-err-${k}" data-err="${k}"${errors[k] ? '' : ' hidden'}>${errors[k] ? `${icon('info')}${esc(errors[k])}` : ''}</p>`;
      const inv = k => (errors[k] ? ` aria-invalid="true" aria-describedby="an-err-${k}"` : ` aria-describedby="an-err-${k}"`);

      const close = () => {
        if (el.classList.contains('is-closing')) return;
        el.classList.add('is-closing');
        const done = () => { el.close(); el.remove(); if (opener && document.contains(opener)) opener.focus(); else $('#page-title')?.focus(); };
        reduceMotion.matches ? done() : setTimeout(done, 170);
      };
      const requestClose = () => { if (busy) return; if (mode !== 'edit') { mode = 'edit'; draw(); return; } if (snap() !== saved) { mode = 'leaving'; draw(); } else close(); };

      function countHtml() {
        const a = aud();
        const unit = s.spec.mode === 'staff' ? plural(a.count, 'staff member') : plural(a.count, 'family', 'families');
        let note = '';
        if (s.spec.mode === 'classes' && s.spec.classIds.length > 1) {
          const sum = t.classes.filter(c => s.spec.classIds.includes(c.id)).reduce((n, c) => n + c.families, 0);
          if (sum > a.count) note = `<small>${plural(sum - a.count, 'family', 'families')} with children in more than one selected class ${sum - a.count === 1 ? 'is' : 'are'} counted once.</small>`;
        }
        return `<span class="an-count__n">${icon('users', 'icon--sm')}<b>${unit}</b> will receive this</span>${note}`;
      }
      function pickerHtml() {
        const m = s.spec.mode;
        if (m === 'all') return `<p class="cd-note">Every family with a child currently enrolled — one copy per family, even with several children.</p>`;
        if (m === 'classes') {
          return `<fieldset class="an-fs"><legend class="field__label">Classes <span class="field__req" aria-hidden="true">*</span></legend><div class="an-picks">${t.classes.map(c => `<label class="an-pick"><input type="checkbox" data-class value="${esc(c.id)}"${s.spec.classIds.includes(c.id) ? ' checked' : ''}><span><b>${esc(c.name)}</b><small>${plural(c.families, 'family', 'families')}</small></span></label>`).join('') || '<p class="cp-muted">You aren’t assigned to any classes.</p>'}</div></fieldset>`;
        }
        const isFam = m === 'families';
        const key = isFam ? 'familyIds' : 'staffIds';
        const pool = isFam ? t.families : t.staff;
        const chosen = pool.filter(p => s.spec[key].includes(p.id));
        return `<div class="an-picker">
          <label class="field__label" for="an-pq">${isFam ? 'Find families' : 'Find staff'}</label>
          <div class="an-search an-search--block">${icon('search', 'icon--sm')}<input class="input" id="an-pq" type="search" autocomplete="off" placeholder="${isFam ? 'Family or child name' : 'Name or role'}" value="${esc(pick.q)}" data-pq></div>
          <div class="an-chosen" aria-live="polite" data-chosen>${chosenHtml(chosen, key)}</div>
          <ul class="an-plist" role="list" data-plist>${plistHtml(pool, key)}</ul></div>`;
      }
      const chosenHtml = (chosen, key) => (chosen.length ? chosen.map(p => `<span class="an-chosen__chip">${esc(p.name)}<button type="button" aria-label="Remove ${esc(p.name)}" data-unpick="${esc(p.id)}" data-key="${key}">${icon('x', 'icon--sm')}</button></span>`).join('') : '<span class="cp-muted">No one selected yet.</span>');
      function plistHtml(pool, key) {
        const ql = pick.q.trim().toLowerCase();
        const rows = pool.filter(p => !ql || `${p.name} ${(p.children || []).join(' ')} ${p.role || ''} ${(p.classes || []).join(' ')}`.toLowerCase().includes(ql));
        return rows.map(p => `<li><label class="an-prow"><input type="checkbox" data-person="${esc(p.id)}" data-key="${key}"${s.spec[key].includes(p.id) ? ' checked' : ''}><span class="an-av" aria-hidden="true">${esc(initials(p.name))}</span><span class="an-prow__txt"><b>${esc(p.name)}</b><small>${esc(p.children ? `${p.children.join(', ')} · ${p.classes.join(', ')}` : p.role)}</small></span></label></li>`).join('') || '<li class="cp-muted an-plist__none">No one matches.</li>';
      }

      function stepHtml() {
        if (step === 0) {
          const modes = [t.canAll && ['all', 'All families', plural(t.families.length, 'family', 'families'), 'users'], t.classes.length && ['classes', 'Classes', plural(t.classes.length, 'class', 'classes'), 'grid'], t.families.length && ['families', 'Individual families', 'Choose by name', 'user'], t.staff.length && ['staff', 'Staff', 'Colleagues', 'shield']].filter(Boolean);
          return `<h3 class="an-c-h" tabindex="-1" data-h>Who should receive this?</h3>
            <fieldset class="an-fs"><legend class="sr-only">Audience</legend><div class="an-modes">${modes.map(([k, l, sub, ic]) => `<label class="an-mode"><input type="radio" name="an-mode" value="${k}"${s.spec.mode === k ? ' checked' : ''}><span class="an-mode__icon" aria-hidden="true">${icon(ic)}</span><span><b>${l}</b><small>${sub}</small></span></label>`).join('')}</div></fieldset>
            <div data-picker>${pickerHtml()}</div>
            <p class="an-count" aria-live="polite" data-count>${countHtml()}</p>${err('audience')}`;
        }
        if (step === 1) {
          const files = s.attachments.map((f, i) => `<li class="an-file${f.state === 'error' ? ' is-error' : ''}">${icon(f.state === 'error' ? 'alert-circle' : 'file', 'icon--sm')}<span>${esc(f.name)}${f.state === 'uploading' ? ' · attaching…' : f.state === 'error' ? ` · ${esc(f.error)}` : ''}</span><button class="btn btn--icon-ghost btn--sm" type="button" aria-label="Remove ${esc(f.name)}" data-unfile="${i}">${icon('x', 'icon--sm')}</button></li>`).join('');
          return `<h3 class="an-c-h" tabindex="-1" data-h>Write the message</h3>
            <div class="field"><label class="field__label" for="an-title">Title <span class="field__req" aria-hidden="true">*</span></label><input class="input" id="an-title" maxlength="120" required value="${esc(s.title)}" placeholder="e.g. Sports day moves to Friday" data-model="title"${inv('title')}><p class="field__hint an-counter" data-counter="title">${s.title.length}/120</p>${err('title')}</div>
            <div class="field"><label class="field__label" for="an-cat">Category</label><select class="input" id="an-cat" data-model="category">${Object.entries(store.ANN_CATEGORIES).map(([k, l]) => `<option value="${k}"${k === s.category ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
            <div class="field"><label class="field__label" for="an-body">Message <span class="field__req" aria-hidden="true">*</span></label><textarea class="input an-textarea" id="an-body" rows="7" maxlength="4000" required placeholder="Keep it short and clear — what’s happening, when, and what families need to do." data-model="body"${inv('body')}>${esc(s.body)}</textarea><p class="field__hint an-counter" data-counter="body">${s.body.length}/4000</p>${err('body')}</div>
            <div class="field"><span class="field__label">Attachment <span class="cp-muted">(optional)</span></span>
              <div class="an-attach"><input class="sr-only" type="file" id="an-file" accept="image/jpeg,image/png,image/webp,application/pdf" data-file${s.attachments.length >= 3 ? ' disabled' : ''}><label class="btn btn--secondary btn--sm${s.attachments.length >= 3 ? ' is-disabled' : ''}" for="an-file">${icon('upload', 'icon--sm')}Attach image or PDF</label><span class="cp-muted">Up to 3 files, 1 MB each. Stored on this device only.</span></div>
              ${files ? `<ul class="an-files">${files}</ul>` : ''}${err('attachments')}</div>`;
        }
        if (step === 2) {
          return `<h3 class="an-c-h" tabindex="-1" data-h>Delivery options</h3>
            <fieldset class="an-fs"><legend class="field__label">Channels <span class="field__req" aria-hidden="true">*</span></legend><div class="an-chans">${Object.entries(store.ANN_CHANNELS).map(([k, c]) => `<label class="an-chan${c.available ? '' : ' is-off'}"><input type="checkbox" data-chan value="${k}"${s.channels.includes(k) ? ' checked' : ''}${c.available ? '' : ' disabled aria-describedby="an-chan-' + k + '"'}><span class="an-chan__txt"><b>${esc(c.label)}</b><small id="an-chan-${k}">${c.available ? 'Staff get a Nexora notification. Families: recorded as queued (demo) until the parent app exists.' : `Unavailable — ${esc(c.note)}`}</small></span>${c.available ? '' : `<span class="badge badge--plain an-chip an-chip--neutral">${icon('lock', 'icon--sm')}Not set up</span>`}</label>`).join('')}</div></fieldset>${err('channels')}
            <div class="an-opt"><button class="switch" type="button" role="switch" aria-checked="${s.requireAck}" aria-describedby="an-ack-desc" data-ack><span class="switch__track"><span class="switch__thumb"></span></span><span>Require acknowledgement</span></button><p class="cd-note" id="an-ack-desc">Recipients are asked to confirm they’ve read and understood it. Opening it isn’t enough — reads and acknowledgements are tracked separately.</p></div>
            <fieldset class="an-fs"><legend class="field__label">When</legend><div class="an-modes an-modes--2">
              <label class="an-mode"><input type="radio" name="an-when" value="now"${s.when === 'now' ? ' checked' : ''}><span class="an-mode__icon" aria-hidden="true">${icon('megaphone')}</span><span><b>Send now</b><small>As soon as you confirm</small></span></label>
              <label class="an-mode"><input type="radio" name="an-when" value="schedule"${s.when === 'schedule' ? ' checked' : ''}><span class="an-mode__icon" aria-hidden="true">${icon('clock')}</span><span><b>Schedule</b><small>Choose a date and time</small></span></label></div></fieldset>
            ${s.when === 'schedule' ? `<div class="cls-form__row an-when"><div class="field"><label class="field__label" for="an-sdate">Date <span class="field__req" aria-hidden="true">*</span></label><input class="input" type="date" id="an-sdate" min="${isoDay(new Date())}" value="${esc(s.sdate)}" data-model="sdate"${inv('scheduledAt')}></div>
              <div class="field"><label class="field__label" for="an-stime">Time <span class="field__req" aria-hidden="true">*</span></label><input class="input" type="time" id="an-stime" value="${esc(s.stime)}" data-model="stime"${inv('scheduledAt')}><p class="field__hint">Time zone: ${esc(Intl.DateTimeFormat().resolvedOptions().timeZone || 'this device')}</p></div></div>
              <p class="cd-note">Prototype: a scheduled announcement is sent when Nexora is open on a device at that time. There’s no server scheduler yet.</p>` : ''}${err('scheduledAt')}`;
        }
        const a = aud();
        const d = { staff: a.recipients.filter(r => r.kind === 'staff').length, fam: a.recipients.filter(r => r.kind === 'family').length };
        const ready = s.attachments.filter(x => x.state === 'ready');
        return `<h3 class="an-c-h" tabindex="-1" data-h>Check before sending</h3>
          <div class="an-prev">
            <div class="an-phone" aria-label="Preview of the announcement" role="group"><div class="an-phone__bar"><span>${icon('megaphone', 'icon--sm')}${esc(store.school.name || 'School')}</span><span>Now</span></div>
              <div class="an-phone__card"><span class="badge badge--plain an-chip an-chip--cat">${esc(store.ANN_CATEGORIES[s.category])}</span><h4>${esc(s.title || 'Untitled')}</h4><p>${esc(s.body || 'No message yet.')}</p>
              ${ready.length ? `<ul class="an-files an-files--prev">${ready.map(f => `<li>${icon('file', 'icon--sm')}<span>${esc(f.name)}</span></li>`).join('')}</ul>` : ''}
              ${s.requireAck ? `<span class="an-phone__ack">${icon('check', 'icon--sm')}I’ve read and understood</span>` : ''}</div></div>
            <dl class="an-review">
              <div><dt>Audience</dt><dd>${esc(a.label)}<button class="btn btn--tertiary btn--sm" type="button" data-step="0">Change</button></dd></div>
              <div><dt>Title</dt><dd>${esc(s.title || '—')}<button class="btn btn--tertiary btn--sm" type="button" data-step="1">Change</button></dd></div>
              <div><dt>Channels</dt><dd>${esc(s.channels.map(c => store.ANN_CHANNELS[c].label).join(', ') || 'None')}<button class="btn btn--tertiary btn--sm" type="button" data-step="2">Change</button></dd></div>
              <div><dt>Acknowledgement</dt><dd>${s.requireAck ? 'Required' : 'Not required'}</dd></div>
              <div><dt>When</dt><dd>${s.when === 'schedule' ? esc(when(input().scheduledAt)) : 'Immediately after you confirm'}</dd></div>
            </dl>
          </div>
          <p class="ls-banner">${icon('info', 'icon--sm')}<span>${d.staff ? `${plural(d.staff, 'staff member')} will get a Nexora notification. ` : ''}${d.fam ? `Families can’t receive announcements yet (no parent app or email/SMS provider), so their ${d.fam === 1 ? 'copy is' : `${d.fam} copies are`} recorded as queued (demo) — nothing is really delivered.` : ''}</span></p>
          ${Object.keys(errors).length ? `<p class="field__hint field__hint--error" role="alert">${icon('info')}${esc(Object.values(errors)[0])}</p>` : ''}`;
      }

      function draw(focusHeading = true) {
        el.querySelector('[data-steps]').innerHTML = STEPS.map((l, i) => `<li><button type="button" data-step="${i}"${i === step ? ' aria-current="step"' : ''}${i > reached ? ' disabled' : ''} class="${i < step || i <= reached ? 'is-done' : ''}"><span class="an-steps__n">${i < step ? icon('check', 'icon--sm') : i + 1}</span><span class="an-steps__l">${l}</span></button></li>`).join('');
        el.querySelector('[data-steps]').hidden = mode !== 'edit';
        if (mode === 'confirm') {
          const a = aud();
          const sched = s.when === 'schedule';
          body.innerHTML = `<div class="an-confirm"><span class="modal__icon an-confirm__icon" aria-hidden="true">${icon(sched ? 'clock' : 'megaphone')}</span><h3 class="an-c-h" tabindex="-1" data-h>${sched ? `Schedule for ${esc(when(input().scheduledAt))}?` : `Send to ${esc(plural(a.count, a.recipients[0]?.kind === 'staff' ? 'staff member' : 'family', a.recipients[0]?.kind === 'staff' ? 'staff members' : 'families'))} now?`}</h3>
            <p class="modal__desc">“${esc(s.title)}” · ${esc(a.label)}</p><p class="cd-note">${sched ? 'You can still edit, send early or cancel it from the Scheduled tab until then.' : 'Once sent it can’t be unsent. You can remind people who haven’t read it.'}</p></div>`;
          foot.innerHTML = `<button class="btn btn--primary kids-yellow" type="button" data-go="${sched ? 'schedule' : 'send'}">${sched ? `${icon('clock', 'icon--sm')}Yes, schedule it` : `${icon('megaphone', 'icon--sm')}Yes, send now`}</button><button class="btn btn--secondary" type="button" data-back-edit>Go back</button>`;
        } else if (mode === 'leaving') {
          body.innerHTML = `<div class="an-confirm"><span class="modal__icon an-confirm__icon is-warn" aria-hidden="true">${icon('alert-triangle')}</span><h3 class="an-c-h" tabindex="-1" data-h>Discard your changes?</h3><p class="modal__desc">You have unsaved changes to this announcement. Save it as a draft to finish later, or discard the changes.</p></div>`;
          foot.innerHTML = `<button class="btn btn--primary kids-yellow" type="button" data-go="draft">${icon('pencil', 'icon--sm')}Save draft</button><button class="btn btn--secondary is-danger" type="button" data-discard>Discard changes</button><button class="btn btn--tertiary" type="button" data-back-edit>Keep editing</button>`;
        } else {
          body.innerHTML = stepHtml();
          const draftLabel = editingScheduled ? 'Unschedule to draft' : 'Save draft';
          const next = step < 3 ? `<button class="btn btn--primary kids-yellow" type="button" data-next>Next: ${STEPS[step + 1]}${icon('arrow-right', 'icon--sm')}</button>`
            : s.when === 'schedule' ? `<button class="btn btn--primary kids-yellow" type="button" data-confirm>${icon('clock', 'icon--sm')}Schedule</button>` : `<button class="btn btn--primary kids-yellow" type="button" data-confirm>${icon('megaphone', 'icon--sm')}Send</button>`;
          foot.innerHTML = `${next}<button class="btn btn--secondary" type="button" data-go="draft">${draftLabel}</button>${step > 0 ? `<button class="btn btn--tertiary an-c-back" type="button" data-prev>${icon('arrow-left', 'icon--sm')}Back</button>` : ''}`;
        }
        if (focusHeading) body.querySelector('[data-h]')?.focus();
      }

      const stepErrors = i => {
        const e = {};
        if (i === 0 && !aud().count) e.audience = s.spec.mode === 'classes' ? 'Choose at least one class.' : s.spec.mode === 'all' ? 'There are no families to send to.' : 'Choose at least one person.';
        if (i === 1) { if (!s.title.trim()) e.title = 'Give the announcement a title.'; if (!s.body.trim()) e.body = 'Write the message.'; if (s.attachments.some(x => x.state === 'uploading')) e.attachments = 'Wait for the attachment to finish.'; }
        if (i === 2) {
          if (!s.channels.length) e.channels = 'Choose at least one delivery channel.';
          if (s.when === 'schedule') { const at = new Date(`${s.sdate}T${s.stime}:00`); if (!s.sdate || !s.stime || Number.isNaN(at.getTime())) e.scheduledAt = 'Choose a date and time.'; else if (at.getTime() <= Date.now() + 60000) e.scheduledAt = 'Choose a time at least a minute from now.'; }
        }
        return e;
      };
      const goTo = i => { step = i; reached = Math.max(reached, i); errors = {}; pick.q = ''; draw(); };
      const showErr = (e, at) => {
        errors = e;
        mode = 'edit';
        step = at;
        draw(false);
        (body.querySelector('[aria-invalid="true"]') || body.querySelector('[data-err]:not([hidden])') || body.querySelector('[data-h]'))?.focus();
      };

      async function submit(kind) {
        if (busy) return;
        if (kind !== 'draft') {
          for (let i = 0; i < 3; i += 1) { const e = stepErrors(i); if (Object.keys(e).length) { showErr(e, i); return; } }
        }
        busy = true;
        foot.querySelectorAll('button').forEach(b => { b.disabled = true; });
        const go = foot.querySelector(`[data-go="${kind}"]`);
        if (go) { go.classList.add('is-loading'); go.setAttribute('aria-busy', 'true'); go.innerHTML = `<span class="spinner" aria-hidden="true"></span>${kind === 'draft' ? 'Saving…' : kind === 'schedule' ? 'Scheduling…' : 'Sending…'}`; }
        let r;
        try {
          r = kind === 'draft' ? await store.saveAnnouncementDraft(me(), input(), s.id) : kind === 'schedule' ? await store.scheduleAnnouncement(me(), input(), s.id) : await store.sendAnnouncement(me(), input(), s.id);
        } catch { r = { ok: false, reason: 'storage' }; }
        busy = false;
        if (r.ok) {
          s.id = r.announcement.id;
          saved = snap();
          close();
          tab = kind === 'draft' ? 'drafts' : kind === 'schedule' ? 'scheduled' : 'sent';
          syncUrl();
          paint();
          const id = r.announcement.id;
          if (kind === 'draft') toast('Draft saved', `“${r.announcement.title || 'Untitled draft'}” is in Drafts.`, 'pencil');
          else if (kind === 'schedule') toast('Announcement scheduled', `“${r.announcement.title}” · ${when(r.announcement.scheduledAt)}`, 'clock');
          else toast('Announcement sent', deliveryText(deliverySummary(r.announcement)), 'check-circle', { duration: 7000, action: { label: 'View', onClick: () => openDrawer(id) } });
          return;
        }
        if (r.errors) { const k = Object.keys(r.errors)[0]; showErr(r.errors, STEP_OF[k] ?? 3); return; }
        mode = 'edit';
        draw(false);
        foot.insertAdjacentHTML('afterbegin', `<p class="field__hint field__hint--error an-c-fail" role="alert">${icon('info')}${esc(FAIL[r.reason] || FAIL.storage)}</p>`);
      }

      async function addFile(file) {
        const item = { name: file.name, state: 'uploading' };
        s.attachments.push(item);
        draw(false);
        let data = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(''); fr.readAsDataURL(file); });
        let { size } = file;
        let mime = file.type;
        if (mime.startsWith('image/') && data && size > 300 * 1024) { const out = await shrink(data); if (out) { data = out; size = Math.round((out.length - 23) * 0.75); mime = 'image/jpeg'; } }
        const r = await store.uploadChatFile(me(), { name: file.name, mime, size, data });
        if (r.ok) Object.assign(item, { id: r.file.id, state: 'ready' }); else Object.assign(item, { state: 'error', error: r.errors?.file || 'Couldn’t attach this file.' });
        if (el.isConnected && step === 1 && mode === 'edit') { draw(false); el.querySelector('label[for="an-file"]')?.focus(); }
      }

      const refreshAudience = () => { body.querySelector('[data-count]').innerHTML = countHtml(); if (errors.audience && aud().count) { delete errors.audience; const h = body.querySelector('[data-err="audience"]'); if (h) h.hidden = true; } };
      el.addEventListener('cancel', e => { e.preventDefault(); requestClose(); });
      el.addEventListener('click', e => {
        if (e.target === el || e.target.closest('[data-x]')) { requestClose(); return; }
        if (busy) return;
        const st = e.target.closest('[data-step]');
        if (st && !st.disabled) { if (+st.dataset.step > step) { const er = stepErrors(step); if (Object.keys(er).length) { showErr(er, step); return; } } goTo(+st.dataset.step); return; }
        if (e.target.closest('[data-next]')) { const er = stepErrors(step); if (Object.keys(er).length) { showErr(er, step); return; } goTo(step + 1); return; }
        if (e.target.closest('[data-prev]')) { goTo(step - 1); return; }
        if (e.target.closest('[data-confirm]')) { for (let i = 0; i < 3; i += 1) { const er = stepErrors(i); if (Object.keys(er).length) { showErr(er, i); return; } } mode = 'confirm'; draw(); return; }
        if (e.target.closest('[data-back-edit]')) { mode = 'edit'; draw(); return; }
        if (e.target.closest('[data-discard]')) { close(); return; }
        const go = e.target.closest('[data-go]');
        if (go) { submit(go.dataset.go); return; }
        if (e.target.closest('[data-ack]')) { s.requireAck = !s.requireAck; e.target.closest('[data-ack]').setAttribute('aria-checked', String(s.requireAck)); return; }
        const un = e.target.closest('[data-unpick]');
        if (un) { s.spec[un.dataset.key] = s.spec[un.dataset.key].filter(id => id !== un.dataset.unpick); body.querySelector('[data-picker]').innerHTML = pickerHtml(); refreshAudience(); body.querySelector('#an-pq')?.focus(); return; }
        const uf = e.target.closest('[data-unfile]');
        if (uf) { s.attachments.splice(+uf.dataset.unfile, 1); delete errors.attachments; draw(false); el.querySelector('label[for="an-file"]')?.focus(); }
      });
      el.addEventListener('change', e => {
        const tg = e.target;
        if (tg.name === 'an-mode') { s.spec.mode = tg.value; pick.q = ''; body.querySelector('[data-picker]').innerHTML = pickerHtml(); refreshAudience(); return; }
        if (tg.name === 'an-when') { s.when = tg.value; delete errors.scheduledAt; draw(false); el.querySelector(`input[name="an-when"][value="${tg.value}"]`)?.focus(); return; }
        if (tg.matches('[data-class]')) { s.spec.classIds = [...body.querySelectorAll('[data-class]:checked')].map(x => x.value); refreshAudience(); return; }
        if (tg.matches('[data-person]')) {
          const k = tg.dataset.key;
          s.spec[k] = tg.checked ? [...new Set([...s.spec[k], tg.dataset.person])] : s.spec[k].filter(id => id !== tg.dataset.person);
          const pool = k === 'familyIds' ? t.families : t.staff;
          body.querySelector('[data-chosen]').innerHTML = chosenHtml(pool.filter(p => s.spec[k].includes(p.id)), k);
          refreshAudience();
          return;
        }
        if (tg.matches('[data-chan]')) { s.channels = [...body.querySelectorAll('[data-chan]:checked')].map(x => x.value); return; }
        if (tg.matches('[data-model="category"]')) { s.category = tg.value; return; }
        if (tg.matches('[data-file]') && tg.files[0]) { const f = tg.files[0]; tg.value = ''; addFile(f); }
      });
      el.addEventListener('input', e => {
        const tg = e.target;
        if (tg.matches('[data-pq]')) { pick.q = tg.value; const k = s.spec.mode === 'families' ? 'familyIds' : 'staffIds'; body.querySelector('[data-plist]').innerHTML = plistHtml(k === 'familyIds' ? t.families : t.staff, k); return; }
        const m = tg.dataset.model;
        if (!m || m === 'category') return;
        s[m] = tg.value;
        const c = body.querySelector(`[data-counter="${m}"]`);
        if (c) c.textContent = `${tg.value.length}/${m === 'title' ? 120 : 4000}`;
        if (errors[m] && tg.value.trim()) { delete errors[m]; tg.removeAttribute('aria-invalid'); const h = body.querySelector(`[data-err="${m}"]`); if (h) h.hidden = true; }
      });
      el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input:not([type="checkbox"]):not([type="radio"])')) e.preventDefault(); });
      el.showModal();
      draw();
    }
    const shrink = src => new Promise(r => { const img = new Image(); img.onload = () => { const k = Math.min(1, 1280 / Math.max(img.width, img.height)); const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); r(cv.toDataURL('image/jpeg', 0.82)); }; img.onerror = () => r(''); img.src = src; });

    /* ---------------------------------------------------------------- Emergency broadcast */

    function emergency() {
      if (!canSos) return;
      const t = store.announcementTargets(user);
      const spec = { mode: 'all', classIds: [], familyIds: [], staffIds: [] };
      let sent = false;
      const countText = () => { const a = store.resolveAudience(user, spec); return `${icon('users', 'icon--sm')}<b>${a.count ? esc(a.label.split(' · ')[1]) : 'No one'}</b> will be alerted immediately`; };
      const d = kids.dialog({
        label: 'Communications / Emergency', title: 'Emergency broadcast', danger: true,
        desc: 'For urgent safety situations only. It is sent immediately — it can’t be scheduled or unsent — and staff also see a banner until they acknowledge it.',
        body: `<div class="an-em">
          <fieldset class="an-fs"><legend class="field__label">Type of emergency <span class="field__req" aria-hidden="true">*</span></legend><div class="an-etypes">${Object.entries(store.EMERGENCY_TYPES).map(([k, l], i) => `<label class="an-pick an-pick--em"><input type="radio" name="etype" value="${k}"${i === 0 ? ' checked' : ''}><span><b>${esc(l)}</b></span></label>`).join('')}</div></fieldset>
          ${kids.field('kd-etitle', 'Title', '<input class="input" id="kd-etitle" name="etitle" maxlength="120" required placeholder="e.g. Early closure — collect children by 1 pm">', { required: true })}
          ${kids.field('kd-ebody', 'Message', '<textarea class="input an-textarea" id="kd-ebody" name="ebody" rows="4" maxlength="4000" required placeholder="What has happened, what families and staff must do now."></textarea>', { required: true })}
          <fieldset class="an-fs"><legend class="field__label">Who to alert <span class="field__req" aria-hidden="true">*</span></legend><div class="an-modes an-modes--3">
            <label class="an-mode"><input type="radio" name="emode" value="all" checked><span><b>All families</b><small>${plural(t.families.length, 'family', 'families')}</small></span></label>
            <label class="an-mode"><input type="radio" name="emode" value="classes"><span><b>Selected classes</b><small>Choose below</small></span></label>
            <label class="an-mode"><input type="radio" name="emode" value="staff"><span><b>All staff</b><small>${plural(t.staff.length, 'colleague')}</small></span></label></div>
            <div class="an-picks" data-eclasses hidden>${t.classes.map(c => `<label class="an-pick"><input type="checkbox" data-eclass value="${esc(c.id)}"><span><b>${esc(c.name)}</b><small>${plural(c.families, 'family', 'families')}</small></span></label>`).join('')}</div>
            <p class="field__hint field__hint--error" data-error-for="audience" hidden></p></fieldset>
          <p class="an-count an-count--em" aria-live="polite" data-ecount>${countText()}</p>
          <fieldset class="an-fs"><legend class="field__label">Channels</legend><div class="an-chans">${Object.entries(store.ANN_CHANNELS).map(([k, c]) => `<label class="an-chan${c.available ? '' : ' is-off'}"><input type="checkbox" name="echan" value="${k}"${c.available ? ' checked' : ' disabled'}><span class="an-chan__txt"><b>${esc(c.label)}</b><small>${c.available ? 'Staff notified now; families recorded as queued (demo — not delivered).' : `Unavailable — ${esc(c.note)}`}</small></span></label>`).join('')}</div><p class="field__hint field__hint--error" data-error-for="channels" hidden></p></fieldset>
          <div class="an-em__prev" aria-live="polite"><span class="tech-label">Preview</span><div class="an-em__card"><span class="an-em__badge">${icon('siren', 'icon--sm')}<span data-eprev-type>Emergency · Safety</span></span><b data-eprev-title>Title</b><p data-eprev-body>Your message will appear here.</p></div></div>
          <div class="field an-em__confirm"><label class="field__label" for="kd-confirm">Type <b>${store.EMERGENCY_PHRASE}</b> to confirm <span class="field__req" aria-hidden="true">*</span></label><input class="input" id="kd-confirm" name="confirm" autocomplete="off" spellcheck="false" autocapitalize="characters"><p class="field__hint field__hint--error" data-error-for="confirm" hidden></p></div>
        </div>`,
        submit: 'Send emergency broadcast',
        async onSubmit(form) {
          if (sent) return { ok: true };
          const input = { emergencyType: form.elements.etype.value, title: form.elements.etitle.value, body: form.elements.ebody.value, audienceSpec: spec, channels: [...form.querySelectorAll('[name="echan"]:checked')].map(x => x.value) };
          const r = await store.sendEmergency(me(), input, form.elements.confirm.value.trim());
          if (!r.ok) return r.errors ? { ok: false, errors: Object.fromEntries(Object.entries(r.errors).map(([k, v]) => [{ title: 'etitle', body: 'ebody' }[k] || k, v])) } : { ok: false, message: failText(r) };
          sent = true;
          tab = 'sent'; syncUrl(); paint();
          toast('Emergency broadcast sent', `${deliveryText(deliverySummary(r.announcement))}. Staff also see the alert banner.`, 'siren', { duration: 9000, action: { label: 'View', onClick: () => openDrawer(r.announcement.id) } });
          return { ok: true };
        }
      });
      const f = d.form;
      const btn = f.querySelector('[type="submit"]');
      const sync = () => {
        const a = store.resolveAudience(user, spec);
        f.querySelector('[data-ecount]').innerHTML = countText();
        f.querySelector('[data-eprev-type]').textContent = `Emergency · ${store.EMERGENCY_TYPES[f.elements.etype.value]}`;
        f.querySelector('[data-eprev-title]').textContent = f.elements.etitle.value.trim() || 'Title';
        f.querySelector('[data-eprev-body]').textContent = f.elements.ebody.value.trim() || 'Your message will appear here.';
        const ok = f.elements.confirm.value.trim() === store.EMERGENCY_PHRASE && a.count > 0;
        btn.disabled = !ok;
        btn.title = ok ? '' : `Type ${store.EMERGENCY_PHRASE} and choose who to alert`;
      };
      f.addEventListener('input', sync);
      f.addEventListener('change', e => {
        if (e.target.name === 'emode') { spec.mode = e.target.value; f.querySelector('[data-eclasses]').hidden = spec.mode !== 'classes'; }
        if (e.target.matches('[data-eclass]')) spec.classIds = [...f.querySelectorAll('[data-eclass]:checked')].map(x => x.value);
        sync();
      });
      f.querySelector('#kd-etitle').focus();
      sync();
    }

    /* ---------------------------------------------------------------- Details drawer */

    function openDrawer(id, opener = document.activeElement) {
      drawer?.close(false);
      const first = find(id);
      if (first?.status === 'sent' && first.recipients?.some(r => r.id === `staff:${user.id}` && !r.readAt)) store.markAnnouncementRead(me(), id);
      syncUrl(id);
      const el = document.createElement('dialog');
      el.className = 'drawer an-drawer';
      el.setAttribute('aria-labelledby', 'an-d-title');
      el.innerHTML = `<div class="drawer__panel"><div class="drawer__head"><h2 id="an-d-title">Announcement</h2><button class="btn btn--icon-ghost" type="button" aria-label="Close announcement details" data-close>${icon('x')}</button></div><div class="drawer__body" data-body></div><div class="drawer__foot" data-foot></div></div>`;
      document.body.appendChild(el);
      let rf = 'all';
      let rq = '';
      let simBusy = false;
      const close = (restore = true) => {
        if (!el.isConnected || el.classList.contains('is-closing')) return;
        el.classList.add('is-closing');
        const done = () => { el.close(); el.remove(); if (restore && opener && document.contains(opener)) opener.focus(); };
        reduceMotion.matches ? done() : setTimeout(done, 170);
        drawer = null;
        syncUrl();
      };
      const FILTERS = a => [['all', 'All'], ['read', 'Read'], ['unread', 'Unread'], ...(a.requireAck ? [['ack', 'Acknowledged'], ['noack', 'Not acknowledged']] : [])];
      const match = (r, f) => f === 'all' || (f === 'read' && r.readAt) || (f === 'unread' && !r.readAt) || (f === 'ack' && r.ackAt) || (f === 'noack' && !r.ackAt);
      function recipientsHtml(a) {
        const ql = rq.trim().toLowerCase();
        const rows = a.recipients.filter(r => match(r, rf) && (!ql || `${r.name} ${(r.children || []).join(' ')} ${(r.classes || []).join(' ')} ${r.role || ''}`.toLowerCase().includes(ql)));
        return rows.map(r => `<li class="an-rec${r.readAt ? ' is-read' : ''}"><span class="an-av" aria-hidden="true">${esc(initials(r.name))}</span>
          <span class="an-rec__who"><b>${esc(r.name)}</b><small>${esc(r.kind === 'family' ? `${(r.children || []).join(', ')} · ${(r.classes || []).join(', ')}` : r.role || 'Staff')}</small><small class="an-rec__del">${esc(r.delivery?.app || '')}${r.reminders?.length ? ` · ${plural(r.reminders.length, 'reminder')}` : ''}</small></span>
          <span class="an-rec__st">${r.readAt ? `<span class="an-st an-st--read">${icon('eye', 'icon--sm')}Read ${esc(time(r.readAt))}${r.readDemo ? ' <em>demo</em>' : ''}</span>` : `<span class="an-st">${icon('eye-off', 'icon--sm')}Unread</span>`}
          ${a.requireAck ? (r.ackAt ? `<span class="an-st an-st--ack">${icon('check-circle', 'icon--sm')}Acknowledged${r.ackDemo ? ' <em>demo</em>' : ''}</span>` : `<span class="an-st an-st--wait">${icon('clock', 'icon--sm')}Not acknowledged</span>`) : ''}</span></li>`).join('') || `<li class="cp-muted an-rec--none">${rq || rf !== 'all' ? 'No recipients match this filter.' : 'No recipients.'}</li>`;
      }
      const refresh = () => {
        const a = find(id);
        const body = el.querySelector('[data-body]');
        const foot = el.querySelector('[data-foot]');
        if (!a || !visible(a)) { body.innerHTML = state('megaphone', 'Announcement not available', 'It may have been deleted, or it isn’t addressed to you.'); foot.innerHTML = ''; return; }
        const m = store.canManageAnn(user, a);
        const st = store.announcementStats(a);
        const mine = a.recipients?.find(r => r.id === `staff:${user.id}`);
        el.querySelector('#an-d-title').textContent = a.type === 'emergency' ? 'Emergency broadcast' : 'Announcement';
        const sent = a.status === 'sent';
        const counts = Object.fromEntries(FILTERS(a).map(([k]) => [k, (a.recipients || []).filter(r => match(r, k)).length]));
        const dl = deliverySummary(a);
        const lastRem = (a.reminders || []).slice(-1)[0];
        const files = (a.attachments || []).map(fid => store.chatFile(user, fid));
        const keepQ = body.querySelector('[data-rq]') === document.activeElement;
        body.innerHTML = `
          <div class="an-d-top"><div class="an-tags">${tags(a)}${chip(STATUS[a.status][0], STATUS[a.status][1])}${a.requireAck ? chip('neutral', 'Acknowledgement required') : ''}</div><h3 class="an-d-title">${esc(a.title || 'Untitled draft')}</h3></div>
          <dl class="token-sheet an-d-meta">
            <div><dt>Audience</dt><dd>${esc(a.audience || 'Not chosen yet')}</dd></div>
            <div><dt>From</dt><dd>${esc(a.createdBy)}</dd></div>
            <div><dt>${sent ? 'Sent' : a.status === 'scheduled' ? 'Scheduled for' : a.status === 'cancelled' ? 'Cancelled' : 'Last edited'}</dt><dd>${esc(when(sent ? a.sentAt : a.status === 'scheduled' ? a.scheduledAt : a.status === 'cancelled' ? a.cancelledAt : a.updatedAt))}</dd></div>
            <div><dt>Channels</dt><dd>${esc((a.channels || []).map(c => store.ANN_CHANNELS[c]?.label).filter(Boolean).join(', ') || '—')}</dd></div>
            ${a.status === 'failed' ? `<div><dt>Why it failed</dt><dd>${esc(a.failReason || 'Unknown')}</dd></div>` : ''}
          </dl>
          <div class="an-d-msg">${esc(a.body || 'No message yet.')}</div>
          ${files.length ? `<ul class="an-files">${files.map(f => (f ? `<li>${icon('file', 'icon--sm')}<button class="btn btn--tertiary btn--sm" type="button" data-file="${esc(f.id)}">${esc(f.name)}</button></li>` : `<li class="cp-muted">${icon('alert-circle', 'icon--sm')}Attachment not available on this device</li>`)).join('')}</ul>` : ''}
          ${mine && a.requireAck ? `<div class="an-mine${mine.ackAt ? ' is-done' : ''}">${mine.ackAt ? `${icon('check-circle', 'icon--sm')}<span>You acknowledged this ${esc(when(mine.ackAt))}.</span>` : `${icon('alert-triangle', 'icon--sm')}<span>${esc(a.createdBy)} asked you to acknowledge this.</span><button class="btn btn--primary kids-yellow btn--sm" type="button" data-ack-me>I’ve read and understood</button>`}</div>` : ''}
          ${sent ? `
          <section class="an-d-sec" aria-label="Tracking">
            <div class="an-d-stats">
              <div class="an-stat"><span class="an-stat__l">Read</span><b class="an-stat__v">${st.read}<small>/${st.total}</small></b><span class="an-prog__bar" aria-hidden="true"><i style="width:${st.pct}%"></i></span><small>${st.pct}% read</small></div>
              <div class="an-stat"><span class="an-stat__l">Acknowledged</span>${a.requireAck ? `<b class="an-stat__v">${st.ack}<small>/${st.total}</small></b><span class="an-prog__bar an-prog__bar--ack" aria-hidden="true"><i style="width:${st.ackPct}%"></i></span><small>${st.ackPct}% acknowledged</small>` : '<b class="an-stat__v an-stat__v--off">—</b><small>Not requested</small>'}</div>
            </div>
            ${a.requireAck ? '<p class="cd-note">Reading isn’t acknowledging — someone can read it without confirming. Each is counted once per recipient.</p>' : ''}
            <p class="cd-note">${icon('inbox', 'icon--sm')} Delivery: ${esc(deliveryText(dl))}.${lastRem ? ` Last reminder ${esc(when(lastRem.at))} by ${esc(lastRem.by)}: ${lastRem.queued} reminded, ${lastRem.skipped} skipped.` : ''}</p>
            ${t0.canAll && store.messagingDemo() && a.recipients.some(r => r.kind === 'family') ? `<div class="an-demo"><span class="tech-label">Demo only</span><p>Families can’t open announcements yet, so their reads are never real. Simulate some to preview tracking — they’re labelled “demo”.</p><div class="an-demo__btns"><button class="btn btn--secondary btn--sm" type="button" data-sim="read"${a.recipients.some(r => r.kind === 'family' && !r.readAt) ? '' : ' disabled'}>Simulate recipient reads</button>${a.requireAck ? `<button class="btn btn--secondary btn--sm" type="button" data-sim="ack"${a.recipients.some(r => r.kind === 'family' && r.readAt && !r.ackAt) ? '' : ' disabled'}>Simulate acknowledgements</button>` : ''}</div></div>` : ''}
          </section>
          <section class="an-d-sec" aria-labelledby="an-rec-h">
            <h3 class="cd-qv-h" id="an-rec-h">Recipients (${st.total})</h3>
            <div class="an-search an-search--block">${icon('search', 'icon--sm')}<label class="sr-only" for="an-rq">Search recipients</label><input class="input" id="an-rq" type="search" autocomplete="off" placeholder="Search by name, child or class" value="${esc(rq)}" data-rq></div>
            <div class="chip-row an-rfilters" role="group" aria-label="Show recipients">${FILTERS(a).map(([k, l]) => `<button class="chip chip--sm" type="button" aria-pressed="${rf === k}" data-rf="${k}">${l} · ${counts[k]}</button>`).join('')}</div>
            <ul class="an-recs" data-recs aria-live="polite">${recipientsHtml(a)}</ul>
          </section>` : ''}
          <p class="cal-meta">Created by ${esc(a.createdBy)} · ${esc(when(a.createdAt))}${a.legacy ? ' · imported from the earlier announcements list' : ''}</p>`;
        if (keepQ) { const qi = body.querySelector('[data-rq]'); qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }
        const unread = sent ? a.recipients.filter(r => !r.readAt).length : 0;
        foot.innerHTML = sent && m ? `<button class="btn btn--primary kids-yellow" type="button" data-act="remind" data-id="${esc(a.id)}"${unread ? '' : ' disabled'}>${icon('bell', 'icon--sm')}${unread ? `Remind unread (${unread})` : 'Everyone has read it'}</button>${canNew && a.type !== 'emergency' ? `<button class="btn btn--secondary" type="button" data-act="duplicate" data-id="${esc(a.id)}">${icon('copy', 'icon--sm')}Duplicate</button>` : ''}`
          : a.status === 'scheduled' && m ? `<button class="btn btn--secondary" type="button" data-act="edit" data-id="${esc(a.id)}">${icon('pencil', 'icon--sm')}Edit</button><button class="btn btn--primary kids-yellow" type="button" data-act="sendnow" data-id="${esc(a.id)}">${icon('megaphone', 'icon--sm')}Send now</button><button class="btn btn--tertiary is-danger" type="button" data-act="cancel" data-id="${esc(a.id)}">Cancel</button>`
            : a.status === 'draft' && m ? `<button class="btn btn--primary kids-yellow" type="button" data-act="edit" data-id="${esc(a.id)}">${icon('pencil', 'icon--sm')}Edit</button><button class="btn btn--secondary" type="button" data-act="duplicate" data-id="${esc(a.id)}">${icon('copy', 'icon--sm')}Duplicate</button><button class="btn btn--tertiary is-danger" type="button" data-act="delete" data-id="${esc(a.id)}">${icon('trash', 'icon--sm')}Delete</button>`
              : canNew && a.type !== 'emergency' ? `<button class="btn btn--secondary" type="button" data-act="duplicate" data-id="${esc(a.id)}">${icon('copy', 'icon--sm')}Duplicate</button>` : '';
        foot.hidden = !foot.innerHTML;
      };
      el.addEventListener('cancel', e => { e.preventDefault(); close(); });
      el.addEventListener('input', e => { if (e.target.matches('[data-rq]')) { rq = e.target.value; const a = find(id); if (a) el.querySelector('[data-recs]').innerHTML = recipientsHtml(a); } });
      el.addEventListener('click', async e => {
        if (e.target === el || e.target.closest('[data-close]')) { close(); return; }
        const f = e.target.closest('[data-rf]');
        if (f) { rf = f.dataset.rf; el.querySelectorAll('[data-rf]').forEach(b => b.setAttribute('aria-pressed', String(b === f))); el.querySelector('[data-recs]').innerHTML = recipientsHtml(find(id)); return; }
        const sim = e.target.closest('[data-sim]');
        if (sim) {
          if (simBusy) return;
          simBusy = true;
          sim.disabled = true;
          const r = await store.simulateAnnouncementActivity(me(), id, sim.dataset.sim, 0.5);
          simBusy = false;
          refresh();
          toast(r.ok ? 'Demo activity added' : 'Nothing simulated', r.ok ? `${plural(r.changed, 'family', 'families')} marked as ${sim.dataset.sim === 'read' ? 'read' : 'acknowledged'} (demo).` : failText(r), 'info');
          return;
        }
        if (e.target.closest('[data-ack-me]')) {
          const b = e.target.closest('[data-ack-me]');
          b.disabled = true;
          const r = await store.acknowledgeAnnouncement(me(), id);
          if (!r.ok) { b.disabled = false; toast('Not saved', failText(r)); } else toast('Acknowledged', 'Thanks — the sender can see you’ve confirmed.', 'check-circle');
          return;
        }
        const fb = e.target.closest('[data-file]');
        if (fb) {
          const file = store.chatFile(user, fb.dataset.file);
          if (!file) { toast('File not available', 'It couldn’t be loaded on this device.'); return; }
          const a = document.createElement('a');
          a.href = file.data; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
          return;
        }
        const b = e.target.closest('[data-act]');
        if (b) act(b.dataset.act, b.dataset.id);
      });
      el.showModal();
      drawer = { close, refresh, id };
      refresh();
      el.querySelector('[data-close]').focus();
    }

    /* ---------------------------------------------------------------- Events */

    const closeMenu = (restore = false) => {
      if (!openMenu) return;
      const btn = openMenu.querySelector('[data-menu]');
      openMenu.querySelector('.menu').hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      openMenu.closest('tr, .an-card')?.classList.remove('has-menu');
      openMenu = null;
      if (restore) btn.focus();
    };
    document.addEventListener('click', e => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); });
    main.addEventListener('click', async e => {
      if (e.target.closest('[data-new]')) { composer(); return; }
      if (e.target.closest('[data-emergency]')) { emergency(); return; }
      if (e.target.closest('[data-retry]')) { $('[data-panel]').innerHTML = '<span class="skeleton" style="display:block;height:300px;border-radius:var(--radius-lg)"></span>'; load(); return; }
      if (e.target.closest('[data-clear-q]')) { q = ''; $('#an-q').value = ''; paint(); $('#an-q').focus(); return; }
      const tb = e.target.closest('[data-tab]');
      if (tb) { tab = tb.dataset.tab; closeMenu(); syncUrl(); paint(); return; }
      const end = e.target.closest('[data-end]');
      if (end) {
        confirm({ label: 'Emergency', title: 'End this emergency broadcast?', desc: 'The banner will stop showing for staff. The announcement and its tracking stay in Sent.', submit: 'End broadcast',
          run: async () => { const r = await store.endBroadcast(me(), end.dataset.end); if (r.ok) toast('Broadcast ended', 'Staff no longer see the banner.', 'check-circle'); return r; } });
        return;
      }
      const op = e.target.closest('[data-open]');
      if (op) { openDrawer(op.dataset.open); return; }
      const mb = e.target.closest('[data-menu]');
      if (mb) {
        const wrap = mb.closest('.menu-wrap');
        if (openMenu === wrap) { closeMenu(); return; }
        closeMenu();
        const m = wrap.querySelector('.menu');
        m.hidden = false;
        m.classList.toggle('is-up', mb.getBoundingClientRect().bottom + 240 > innerHeight);
        mb.setAttribute('aria-expanded', 'true');
        wrap.closest('tr, .an-card')?.classList.add('has-menu');
        openMenu = wrap;
        m.querySelector('button').focus();
        return;
      }
      const item = e.target.closest('[data-act]');
      if (item) { closeMenu(true); act(item.dataset.act, item.dataset.id); }
    });
    main.addEventListener('input', e => { if (e.target.id === 'an-q') { q = e.target.value; paint(); } });
    main.addEventListener('keydown', e => {
      if (openMenu) {
        const items = [...openMenu.querySelectorAll('.menu button')];
        const i = items.indexOf(document.activeElement);
        if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); return; }
        if (e.key === 'Tab') { closeMenu(); return; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); return; }
        if (e.key === 'Home') { e.preventDefault(); items[0].focus(); return; }
        if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); return; }
      }
      const tb = e.target.closest('[role="tab"]');
      if (!tb) return;
      const keys = TABS.map(([k]) => k);
      const i = keys.indexOf(tb.dataset.tab);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: keys.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      tab = keys[(to + keys.length) % keys.length]; syncUrl(); paint(); $(`#an-tab-${tab}`)?.focus();
    });
    let queued = false;
    store.subscribe(({ key }) => {
      if (!loaded || (key && !/^nexora-(announcements|broadcasts|demo-role|families|children|class-registry|parent-app|messaging-demo)/.test(key))) return;
      if (queued) return;
      queued = true;
      setTimeout(() => {
        queued = false;
        if (openMenu) return;
        const fid = document.activeElement?.closest?.('#main [data-open], #main [data-menu], #main [data-tab]');
        const sel = fid ? ['data-open', 'data-menu', 'data-tab'].map(k => (fid.hasAttribute(k) ? `[${k}="${fid.getAttribute(k)}"]` : '')).find(Boolean) : '';
        paint();
        drawer?.refresh();
        if (sel) main.querySelector(sel)?.focus();
      }, 0);
    });
    load();
  }

  window.NexoraAnnouncements = { render };
})();
