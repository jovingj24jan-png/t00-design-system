/* Messages & Communications (app.html?page=messages[&c=<conversationId>][&filter=unread|families|staff|groups])
   ?page=messages&family=… still opens the S16 family message log (families.js).
   Reads and writes through the store: listConversations / conversationView / startConversation / sendChatMessage /
   uploadChatFile / markConversationRead / translateMessage / conversationContext. Delivery of scheduled messages and
   demo replies runs in the shell ticker on every page. Test hooks: ?fail=1 (load error), ?sendfail=1 (first send fails). */
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
  const deskQ = matchMedia('(min-width: 1024px)');
  // The details panel opens by default only where the chat still has room beside it.
  const wideQ = matchMedia('(min-width: 1440px)');
  const initials = n => String(n || '').replace(/^(Ms|Mr|Mrs|Dr)\.?\s+/i, '').trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
  const pad = n => String(n).padStart(2, '0');
  const isoDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timeOf = iso => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const linkify = s => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>').replace(/\n/g, '<br>');
  const FILTERS = [['all', 'All'], ['unread', 'Unread'], ['families', 'Families'], ['staff', 'Staff'], ['groups', 'Groups']];
  const TYPE_ICON = { family: 'users', staff: 'user', class: 'megaphone' };
  const LANG_NAME = { en: 'English', ta: 'Tamil', hi: 'Hindi', ar: 'Arabic' };

  function render(key, main, user) {
    if (key !== 'messages' || params.has('family') || params.has('msg')) return false;
    page(main, user);
    return true;
  }

  function page(main, user) {
    let filter = FILTERS.some(([k]) => k === params.get('filter')) ? params.get('filter') : 'all';
    let q = '';
    let current = params.get('c') || '';
    let panelOpen = wideQ.matches;
    let loaded = false;
    let failOnce = params.get('fail') === '1';
    let sendFailOnce = params.get('sendfail') === '1';
    const drafts = {};
    const pending = {};
    const attach = {};
    const shown = {};

    main.classList.add('kids-page', 'ib-page');
    document.title = 'Messages · Nexora';
    main.innerHTML = `
      <div class="ib" data-view="${current ? 'chat' : 'list'}">
        <aside class="ib-list" aria-label="Conversations">
          <div class="ib-list__head">
            <h1 class="ib-title" id="page-title" tabindex="-1">Messages <span class="ib-total" data-total></span></h1>
            <button class="btn btn--primary kids-yellow btn--sm" type="button" data-new>${icon('plus', 'icon--sm')}New message</button>
          </div>
          <div class="ib-demo" data-demo></div>
          <label class="sr-only" for="ib-q">Search conversations</label>
          <input class="input" id="ib-q" type="search" placeholder="Search names, children or messages" autocomplete="off" data-q>
          <div class="ib-filters" role="tablist" aria-label="Filter conversations">${FILTERS.map(([k, l]) => `<button class="ib-filter" type="button" role="tab" aria-selected="${k === filter}" data-filter="${k}">${l}<span data-fcount="${k}"></span></button>`).join('')}</div>
          <ul class="ib-convs" data-convs aria-live="polite"><li><span class="skeleton" style="height:64px"></span></li><li><span class="skeleton" style="height:64px"></span></li></ul>
        </aside>
        <section class="ib-chat" aria-label="Conversation" data-chat></section>
        <aside class="ib-ctx" aria-label="Conversation details" data-ctx ${panelOpen ? '' : 'hidden'}></aside>
      </div>`;
    const $ = s => main.querySelector(s);
    const syncUrl = () => {
      const u = new URL(location.href);
      current ? u.searchParams.set('c', current) : u.searchParams.delete('c');
      filter === 'all' ? u.searchParams.delete('filter') : u.searchParams.set('filter', filter);
      history.replaceState(null, '', u);
      window.NexoraOpenConversation = current || null;
    };

    /* ---------------------------------------------------------------- Conversation list */

    function convAvatar(r) {
      const c = r.conv;
      return `<span class="ib-av ib-av--${c.type}" aria-hidden="true">${c.type === 'class' ? icon('megaphone') : esc(initials(r.title))}</span>`;
    }
    function lastPreview(r) {
      if (!r.last) return r.scheduled ? `${icon('clock', 'icon--sm')}${plural(r.scheduled, 'scheduled message')}` : '<span class="cp-muted">No messages yet</span>';
      const who = r.last.senderType === 'staff' && r.last.senderId === user.id ? 'You: ' : '';
      return `${who}${r.last.attachments?.length ? icon('file', 'icon--sm') : ''}${esc(r.last.body || (r.last.attachments?.length ? 'Attachment' : ''))}`;
    }
    const stamp = iso => { if (!iso) return ''; const d = new Date(iso); const today = isoDay(new Date()); const day = isoDay(d); return day === today ? timeOf(iso) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
    function drawList() {
      const rows = store.listConversations(user, { filter, q });
      const all = store.listConversations(user);
      const unreadTotal = all.reduce((t, r) => t + r.unread, 0);
      $('[data-total]').innerHTML = unreadTotal ? `<span class="ib-badge" aria-label="${plural(unreadTotal, 'unread message')}">${unreadTotal}</span>` : '';
      FILTERS.forEach(([k]) => {
        const n = k === 'unread' ? all.filter(r => r.unread).length : 0;
        const el = main.querySelector(`[data-fcount="${k}"]`);
        if (el) el.innerHTML = n ? ` <b>${n}</b>` : '';
      });
      main.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.filter === filter)));
      const box = $('[data-convs]');
      if (!all.length) {
        box.innerHTML = `<li class="ib-empty"><span class="state-icon" aria-hidden="true">${icon('message')}</span><p class="ib-empty__title">No conversations yet</p><p>Start a conversation with a family, colleague, or class group.</p><button class="btn btn--primary kids-yellow btn--sm" type="button" data-new>Start a conversation</button></li>`;
        return;
      }
      if (!rows.length) { box.innerHTML = `<li class="ib-empty"><p class="ib-empty__title">${filter === 'unread' && !q ? 'No unread conversations' : 'No conversations match'}</p><p>${filter === 'unread' && !q ? 'You’re all caught up.' : 'Try another search or filter.'}</p></li>`; return; }
      box.innerHTML = rows.map(r => `<li><button class="ib-conv${r.conv.id === current ? ' is-current' : ''}${r.unread ? ' is-unread' : ''}" type="button" data-open="${esc(r.conv.id)}"${r.conv.id === current ? ' aria-current="true"' : ''} aria-label="${esc(`${r.title}${r.children.length ? `, ${r.children.join(', ')}` : ''}. ${r.unread ? `${plural(r.unread, 'unread message')}. ` : ''}${r.conv.demo ? 'Demo conversation. ' : ''}`)}">
          ${convAvatar(r)}
          <span class="ib-conv__main"><span class="ib-conv__top"><b>${esc(r.title)}</b><time>${esc(stamp(r.last?.sentAt || r.conv.lastMessageAt))}</time></span>
            ${r.children.length ? `<span class="ib-conv__child">${esc(r.children.join(', '))}</span>` : r.conv.type === 'class' ? '<span class="ib-conv__child">Class broadcast</span>' : ''}
            <span class="ib-conv__last">${lastPreview(r)}</span></span>
          ${r.unread ? `<span class="ib-badge" aria-hidden="true">${r.unread}</span>` : ''}${r.conv.demo ? '<span class="ib-demo-tag">Demo</span>' : ''}
        </button></li>`).join('');
    }

    /* ---------------------------------------------------------------- Chat */

    const dayLabel = iso => {
      const d = isoDay(new Date(iso));
      const t = new Date(); const y = new Date(); y.setDate(y.getDate() - 1);
      return d === isoDay(t) ? 'Today' : d === isoDay(y) ? 'Yesterday' : new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    };
    function attachmentHtml(id) {
      const f = store.chatFile(user, id);
      if (!f) return `<span class="ib-file is-missing">${icon('alert-circle', 'icon--sm')}Attachment not available</span>`;
      if (f.mime.startsWith('image/')) return `<button class="ib-img" type="button" data-file="${esc(id)}" aria-label="Open image ${esc(f.name)}"><img src="${f.data}" alt="${esc(f.name)}"></button>`;
      return `<button class="ib-file" type="button" data-file="${esc(id)}">${icon('file', 'icon--sm')}<span><b>${esc(f.name)}</b><small>PDF · ${Math.round(f.size / 1024)} KB</small></span></button>`;
    }
    function receiptHtml(m) {
      if (m.status === 'scheduled') return `<span class="ib-rcpt is-scheduled">${icon('clock', 'icon--sm')}Scheduled ${esc(new Date(m.scheduledFor).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))} · <button class="ib-link" type="button" data-cancel-sched="${esc(m.id)}">Cancel</button></span>`;
      if (m.status === 'failed') return `<span class="ib-rcpt is-failed">${icon('alert-triangle', 'icon--sm')}Not sent: ${esc(m.failReason || 'failed')}</span>`;
      if (!m.receipt) return '';
      const r = m.receipt;
      const label = r.allRead ? (r.total > 1 ? 'Read by everyone' : 'Read') : r.read ? `Read by ${r.read} of ${r.total}` : 'Sent';
      return `<span class="ib-rcpt${r.allRead ? ' is-read' : ''}" title="${esc(label)}${r.demo ? ' (demo receipt)' : ''}"><span aria-hidden="true">✓✓</span><span class="sr-only">${esc(label)}</span>${r.read && !r.allRead ? `<small>${r.read}/${r.total}</small>` : ''}${r.demo ? '<small>demo</small>' : ''}</span>`;
    }
    function bubble(m) {
      const tr = shown[m.id];
      const canTranslate = !m.mine && m.senderType !== 'staff' && m.lang && m.lang !== 'en';
      return `<li class="ib-msg${m.mine ? ' is-mine' : ''}${m.status === 'scheduled' ? ' is-scheduled' : ''}" data-msg="${esc(m.id)}">
        ${!m.mine ? `<span class="ib-msg__who">${esc(m.senderName)}${m.private ? ' · private reply' : ''}${m.demo ? ' <span class="ib-demo-tag">Demo</span>' : ''}</span>` : ''}
        <div class="ib-bubble">${m.body ? `<p>${linkify(m.body)}</p>` : ''}${(m.attachments || []).length ? `<div class="ib-atts">${m.attachments.map(attachmentHtml).join('')}</div>` : ''}
          ${tr?.text && tr.visible ? `<p class="ib-tr"><span class="ib-tr__label">${esc(LANG_NAME[tr.target] || tr.target)} · ${tr.demo ? 'demo translation (no translation service connected)' : 'translated'}</span><em>${esc(tr.text)}</em></p>` : ''}
          ${tr?.error ? `<p class="ib-tr ib-tr--err" role="alert">${icon('info', 'icon--sm')}${esc(tr.error)}</p>` : ''}
        </div>
        <span class="ib-msg__meta"><time>${esc(timeOf(m.sentAt || m.createdAt))}</time>${m.mine ? receiptHtml(m) : ''}${canTranslate ? `<button class="ib-link" type="button" data-translate="${esc(m.id)}" aria-expanded="${Boolean(tr?.visible)}">${tr?.loading ? 'Translating…' : tr?.visible ? 'Hide translation' : 'Translate'}</button>` : ''}</span>
      </li>`;
    }
    function pendingBubble(p) {
      return `<li class="ib-msg is-mine is-pending" data-pending="${esc(p.clientId)}"><div class="ib-bubble">${p.body ? `<p>${linkify(p.body)}</p>` : ''}${p.files.length ? `<div class="ib-atts">${p.files.map(f => `<span class="ib-file">${icon('file', 'icon--sm')}<span><b>${esc(f.name)}</b></span></span>`).join('')}</div>` : ''}</div>
        <span class="ib-msg__meta">${p.state === 'sending' ? `<span class="ib-rcpt is-sending"><span class="spinner" aria-hidden="true"></span>Sending…</span>` : `<span class="ib-rcpt is-failed" role="alert">${icon('alert-triangle', 'icon--sm')}Not sent. ${esc(p.error || '')} <button class="ib-link" type="button" data-retry-send="${esc(p.clientId)}">Retry</button> · <button class="ib-link" type="button" data-discard="${esc(p.clientId)}">Discard</button></span>`}</span></li>`;
    }
    function hoursNote() {
      const h = store.getSettings(store.school.id).hours;
      if (!/^\d{2}:\d{2}$/.test(h.open || '') || !/^\d{2}:\d{2}$/.test(h.close || '')) return '';
      const d = new Date();
      const wd = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getDay()];
      const now = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      const open = (h.days || []).includes(wd) && now >= h.open && now < h.close;
      return open ? '' : `<p class="ib-hours">${icon('clock', 'icon--sm')}Outside school hours (${esc(h.open)}–${esc(h.close)}). Family will see this now; consider scheduling.</p>`;
    }
    function drawChat({ keepScroll = false } = {}) {
      const chat = $('[data-chat]');
      main.querySelector('.ib').dataset.view = current ? 'chat' : 'list';
      if (!current) {
        chat.innerHTML = `<div class="ib-placeholder"><span class="state-icon" aria-hidden="true">${icon('message')}</span><p class="ib-empty__title">Choose a conversation</p><p>Or start a new one with a family, colleague or class.</p></div>`;
        $('[data-ctx]').innerHTML = '';
        return;
      }
      const v = store.conversationView(user, current);
      if (v.error) {
        chat.innerHTML = `<div class="ib-placeholder" role="alert"><span class="state-icon state-icon--error" aria-hidden="true">${icon('lock')}</span><p class="ib-empty__title">${v.error === 'forbidden' ? 'You can’t open this conversation' : 'Conversation not found'}</p><p>${v.error === 'forbidden' ? 'Only its members can read it.' : 'It may have been removed.'}</p><button class="btn btn--secondary btn--sm" type="button" data-back>Back to conversations</button></div>`;
        $('[data-ctx]').innerHTML = '';
        return;
      }
      const c = v.conv;
      const scroller = chat.querySelector('[data-thread]');
      const nearBottom = !scroller || scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120;
      const prevTop = scroller?.scrollTop;
      const draft = chat.querySelector('[data-body]')?.value ?? drafts[current] ?? '';
      const kidsTxt = c.childIds.map(id => store.childById(id)).filter(Boolean).map(k => store.childName(k)).join(', ');
      let lastDay = '';
      const items = v.messages.map(m => { const d = isoDay(new Date(m.sentAt || m.scheduledFor || m.createdAt)); const sep = d !== lastDay ? `<li class="ib-day" role="separator"><span>${esc(dayLabel(m.sentAt || m.scheduledFor || m.createdAt))}</span></li>` : ''; lastDay = d; return sep + bubble(m); }).join('');
      const pend = (pending[current] || []).map(pendingBubble).join('');
      const quick = store.getQuickReplies();
      chat.innerHTML = `
        <header class="ib-chat__head">
          <button class="btn btn--icon-ghost ib-back" type="button" data-back aria-label="Back to conversations">${icon('arrow-left')}</button>
          <span class="ib-av ib-av--${c.type}" aria-hidden="true">${c.type === 'class' ? icon('megaphone') : esc(initials(v.title))}</span>
          <div class="ib-chat__who"><h2 class="ib-chat__title">${esc(v.title)}${c.demo ? ' <span class="ib-demo-tag">Demo</span>' : ''}</h2><p>${icon(TYPE_ICON[c.type], 'icon--sm')}${esc(store.CONV_TYPES[c.type])}${c.type === 'class' ? ` · broadcast to ${plural(new Set(c.guardianIds).size, 'guardian')} — replies are private` : kidsTxt ? ` · ${esc(kidsTxt)}` : ''}</p></div>
          <button class="btn btn--icon-ghost" type="button" data-ctx-toggle aria-expanded="${panelOpen && deskQ.matches}" aria-label="Conversation details">${icon('info')}</button>
        </header>
        <ol class="ib-thread" data-thread aria-label="Messages" aria-live="polite">${items || pend ? items + pend : '<li class="ib-empty"><p class="ib-empty__title">No messages yet</p><p>Say hello below.</p></li>'}</ol>
        <form class="ib-composer" data-composer novalidate>
          ${hoursNote()}
          <div class="ib-atts-draft" data-atts>${(attach[current] || []).map(f => `<span class="ib-att">${f.mime.startsWith('image/') ? `<img src="${f.preview}" alt="">` : icon('file', 'icon--sm')}<span><b>${esc(f.name)}</b><small>${f.state === 'uploading' ? 'Uploading…' : f.state === 'error' ? esc(f.error) : `${Math.round(f.size / 1024)} KB`}</small></span><button type="button" class="btn btn--icon-ghost btn--sm" data-unattach="${esc(f.key)}" aria-label="Remove ${esc(f.name)}">${icon('x', 'icon--sm')}</button></span>`).join('')}</div>
          <div class="ib-tools">
            <label class="btn btn--icon-ghost btn--sm ib-attach" aria-label="Attach image or PDF" title="Attach image or PDF">${icon('file', 'icon--sm')}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple data-file-input class="sr-only"></label>
            <div class="ib-quick-wrap"><button class="btn btn--tertiary btn--sm" type="button" data-quick aria-haspopup="true" aria-expanded="false">${icon('message', 'icon--sm')}Quick replies</button>
              <ul class="ib-quick" data-quick-list hidden>${quick.map((t, i) => `<li><button type="button" data-quick-pick="${i}">${esc(t)}</button></li>`).join('')}${['Director', 'Admin', 'Super Admin'].includes(user.role) ? '<li><button type="button" data-quick-edit class="ib-link">Edit quick replies</button></li>' : ''}</ul></div>
            <button class="btn btn--tertiary btn--sm ib-sched" type="button" data-schedule>${icon('clock', 'icon--sm')}Schedule</button>
          </div>
          <div class="ib-composer__row">
            <label class="sr-only" for="ib-body">Message</label>
            <textarea class="input ib-input" id="ib-body" rows="1" placeholder="Write a message" data-body name="body">${esc(draft)}</textarea>
            <button class="btn btn--primary kids-yellow ib-send" type="submit" data-send aria-label="Send">${icon('arrow-right')}<span>Send</span></button>
          </div>
          <p class="ib-hint">Enter to send · Shift+Enter for a new line</p>
        </form>`;
      grow();
      sync();
      const t = chat.querySelector('[data-thread]');
      if (keepScroll && !nearBottom && prevTop != null) t.scrollTop = prevTop; else t.scrollTop = t.scrollHeight;
      drawCtx(v);
    }
    function grow() { const ta = $('[data-body]'); if (!ta) return; ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 6 * 22 + 20)}px`; }
    function sync() {
      const ta = $('[data-body]'); if (!ta) return;
      const files = attach[current] || [];
      const ok = (ta.value.trim() || files.some(f => f.state === 'ready')) && !files.some(f => f.state === 'uploading');
      $('[data-send]').disabled = !ok;
      $('[data-schedule]').disabled = !ok;
    }

    /* ---------------------------------------------------------------- Context panel */

    function drawCtx(v) {
      const box = $('[data-ctx]');
      const ctx = store.conversationContext(user, v.conv.id);
      if (!ctx) { box.innerHTML = ''; return; }
      const c = ctx.conv;
      let body = '';
      if (c.type === 'family') {
        body = `${ctx.children.length ? ctx.children.map(k => `<div class="ib-ctx__child">
            ${k.mayOpen ? `<a class="ib-ctx__photo" href="${routes.record(k.id)}">` : '<span class="ib-ctx__photo">'}${k.photo ? `<img src="${esc(k.photo)}" alt="">` : `<span class="ib-av ib-av--lg" aria-hidden="true">${esc(initials(k.name))}</span>`}${k.mayOpen ? '</a>' : '</span>'}
            <div><p class="ib-ctx__name">${k.mayOpen ? `<a href="${routes.record(k.id)}">${esc(k.name)}</a>` : esc(k.name)}</p><p class="cp-muted">${esc(k.cls)}</p>
            ${k.alerts.length ? `<p class="ib-ctx__alerts">${k.alerts.map(a => `<span class="kid-alert kid-alert--${esc(a.type)}" title="${esc(a.label)}">${icon({ allergy: 'allergy', medical: 'medical', custody: 'shield', dietary: 'leaf' }[a.type])}<span class="sr-only">${esc(a.label)}</span></span>`).join('')}<small>${esc([...new Set(k.alerts.map(a => a.label))].join(', '))}</small></p>` : ''}
            ${k.mayOpen ? `<a class="btn btn--tertiary btn--sm" href="${routes.record(k.id)}#tab=diary">${icon('book', 'icon--sm')}Daily Diary (S13)</a>` : '<p class="cp-muted">This child isn’t in your classes, so their profile isn’t linked.</p>'}</div></div>`).join('') : '<p class="cp-muted">No child linked to this family.</p>'}
          <h3 class="cd-qv-h">Guardians</h3><ul class="ib-ctx__list">${ctx.guardians.map(g => `<li><b>${esc(g.name)}</b><small>Prefers ${esc(g.language)}</small></li>`).join('') || '<li class="cp-muted">None on record</li>'}</ul>
          ${c.familyId ? `<a class="btn btn--tertiary btn--sm" href="${routes.page('family', { id: c.familyId })}">Family record</a>` : ''}`;
      } else if (c.type === 'staff') {
        body = `<ul class="ib-ctx__list">${ctx.staff.filter(s => s.id !== user.id).map(s => `<li><span class="ib-av" aria-hidden="true">${esc(initials(s.name))}</span><span><b>${esc(s.name)}</b><small>${esc(s.role)}${s.email ? ` · ${esc(s.email)}` : ''}</small></span></li>`).join('')}</ul>`;
      } else {
        body = `<p class="ib-ctx__name">${esc(ctx.cls?.name || 'Class')}</p><p class="cp-muted">Class broadcast · ${plural(ctx.familyCount, 'guardian')} · ${plural(ctx.childCount, 'child', 'children')}</p>
          <p class="cd-note">Families receive your messages; a family’s reply comes only to staff in this thread, never to other families.</p>
          <h3 class="cd-qv-h">Staff in this thread</h3><ul class="ib-ctx__list">${ctx.staff.map(s => `<li><b>${esc(s.name)}</b><small>${esc(s.role)}</small></li>`).join('')}</ul>
          ${ctx.cls ? `<a class="btn btn--tertiary btn--sm" href="${routes.page('class', { id: ctx.cls.id })}">Open class</a>` : ''}`;
      }
      box.innerHTML = `<div class="ib-ctx__head"><h2 class="cd-h2">Details</h2><button class="btn btn--icon-ghost" type="button" data-ctx-close aria-label="Close details">${icon('x')}</button></div>${body}`;
      box.hidden = !panelOpen || !deskQ.matches;
    }
    function ctxSheet() {
      const v = store.conversationView(user, current);
      if (v.error) return;
      drawCtx(v);
      const html = $('[data-ctx]').innerHTML.replace(/<div class="ib-ctx__head">[\s\S]*?<\/div>/, '');
      kids.dialog({ label: 'Messages', title: 'Conversation details', desc: '', body: `<div class="ib-ctx ib-ctx--sheet">${html}</div>`, submit: 'Close', async onSubmit() { return { ok: true }; } });
    }

    /* ---------------------------------------------------------------- Sending */

    async function send({ retry = null, scheduleAt = '' } = {}) {
      const convId = current;
      let p = retry;
      if (!p) {
        const ta = $('[data-body]');
        const files = (attach[convId] || []).filter(f => f.state === 'ready');
        if (!ta.value.trim() && !files.length) return;
        p = { clientId: `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, body: ta.value, files, state: 'sending' };
        if (!scheduleAt) (pending[convId] = pending[convId] || []).push(p);
        drafts[convId] = '';
        attach[convId] = [];
        ta.value = '';
      } else p.state = 'sending';
      if (!scheduleAt) drawChat();
      let res;
      if (sendFailOnce && !scheduleAt) { sendFailOnce = false; await new Promise(r => setTimeout(r, 400)); res = { ok: false, reason: 'storage' }; }
      else res = await store.sendChatMessage(store.currentUser(), convId, { body: p.body, attachmentIds: p.files.map(f => f.id), clientId: p.clientId, scheduleAt });
      if (res.ok) {
        pending[convId] = (pending[convId] || []).filter(x => x !== p);
        if (scheduleAt) window.NexoraToast?.show('Message scheduled', `Sends ${new Date(scheduleAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} if Nexora is open on a device then (prototype — no server scheduler).`, 'clock');
      } else {
        p.state = 'failed';
        p.error = res.errors ? Object.values(res.errors)[0] : res.reason === 'forbidden' ? 'You’re not a member of this conversation.' : 'Couldn’t save it on this device.';
        if (scheduleAt) { drafts[convId] = p.body; attach[convId] = p.files; window.NexoraToast?.show('Not scheduled', p.error, 'info'); return res; }
      }
      if (convId === current) drawChat();
      drawList();
      return res;
    }
    function scheduleDialog() {
      const ta = $('[data-body]');
      const body = ta.value;
      const files = (attach[current] || []).filter(f => f.state === 'ready');
      const v = store.conversationView(user, current);
      const h = store.getSettings(store.school.id).hours;
      const next = new Date(); next.setDate(next.getDate() + 1);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      kids.dialog({
        label: 'Messages / Schedule', title: 'Schedule message', desc: `To <b>${esc(v.title)}</b>`,
        body: `<div class="cls-form"><blockquote class="ib-preview">${esc(body || `${files.length} attachment(s)`)}</blockquote>
          <div class="cls-form__row">${kids.field('kd-sdate', 'Date', `<input class="input" id="kd-sdate" name="sdate" type="date" required min="${isoDay(new Date())}" value="${isoDay(next)}">`, { required: true })}
          ${kids.field('kd-stime', 'Time', `<input class="input" id="kd-stime" name="stime" type="time" required value="${/^\d{2}:\d{2}$/.test(h.open || '') ? h.open : '08:00'}">`, { required: true, hint: `Time zone: ${tz} (this device)` })}</div>
          <p class="cd-note">Prototype: a scheduled message is sent when Nexora is open on a device at that time. There’s no server scheduler yet.</p>
          <p class="field__hint field__hint--error" data-error-for="schedule" hidden></p></div>`,
        submit: 'Schedule',
        async onSubmit(form) {
          const at = new Date(`${form.elements.sdate.value}T${form.elements.stime.value}:00`);
          if (Number.isNaN(at.getTime())) return { ok: false, errors: { schedule: 'Choose a date and time.' } };
          const res = await send({ scheduleAt: at.toISOString() });
          return res.ok ? res : { ok: false, errors: res.errors || { schedule: 'Couldn’t schedule it.' } };
        }
      });
    }
    async function addFiles(list) {
      const convId = current;
      for (const file of list) {
        const key = `${Date.now()}${Math.random()}`;
        const item = { key, name: file.name, mime: file.type, size: file.size, state: 'uploading' };
        (attach[convId] = attach[convId] || []).push(item);
        drawChatKeepDraft();
        let data = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = () => r(''); fr.readAsDataURL(file); });
        let size = file.size;
        if (file.type.startsWith('image/') && data && size > 300 * 1024) { const out = await shrink(data); if (out) { data = out; size = Math.round((out.length - 23) * 0.75); item.mime = 'image/jpeg'; } }
        item.preview = item.mime.startsWith('image/') ? data : '';
        const res = await store.uploadChatFile(store.currentUser(), { name: file.name, mime: item.mime, size, data });
        if (res.ok) Object.assign(item, { id: res.file.id, size: res.file.size, state: 'ready' }); else Object.assign(item, { state: 'error', error: res.errors?.file || 'Upload failed' });
        if (convId === current) drawChatKeepDraft();
      }
    }
    const shrink = src => new Promise(r => { const img = new Image(); img.onload = () => { const s = Math.min(1, 1280 / Math.max(img.width, img.height)); const cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); r(cv.toDataURL('image/jpeg', 0.82)); }; img.onerror = () => r(''); img.src = src; });
    function drawChatKeepDraft() { const ta = $('[data-body]'); if (ta) drafts[current] = ta.value; drawChat({ keepScroll: true }); $('[data-body]')?.focus(); }

    function openConv(id) {
      const ta = $('[data-body]');
      if (ta && current) drafts[current] = ta.value;
      current = id;
      syncUrl();
      const v = store.conversationView(user, id);
      if (!v.error) store.markConversationRead(store.currentUser(), id);
      drawList();
      drawChat();
      $(mobileQ.matches ? '[data-back]' : '[data-body]')?.focus();
    }

    /* ---------------------------------------------------------------- New conversation */

    function newDialog() {
      const t = store.messageTargets(user);
      let type = 'family';
      const d = kids.dialog({
        label: 'Messages', title: 'New message', desc: '',
        body: `<div class="cls-form"><fieldset class="field"><legend class="field__label">Who is it with?</legend><div class="cls-picks">${[['family', 'Family'], ['staff', 'Staff member'], ['class', 'Class group']].map(([k, l], i) => `<label class="cls-pick"><input type="radio" name="ctype" value="${k}"${i === 0 ? ' checked' : ''}><span><b>${l}</b></span></label>`).join('')}</div></fieldset>
          ${kids.field('kd-tq', 'Search', '<input class="input" id="kd-tq" type="search" autocomplete="off" placeholder="Name or child" data-tq>')}
          <div class="ib-targets" data-targets role="radiogroup" aria-label="Recipients"></div>
          <p class="field__hint field__hint--error" data-error-for="target" hidden></p></div>`,
        submit: 'Start conversation',
        async onSubmit(form) {
          const id = form.querySelector('[name="target"]:checked')?.value;
          if (!id) return { ok: false, errors: { target: 'Choose who the conversation is with.' } };
          const res = await store.startConversation(store.currentUser(), { type, familyId: id, staffUserId: id, classId: id });
          if (!res.ok) return res.errors ? { ok: false, errors: res.errors } : { ok: false, message: 'Couldn’t start the conversation. Please try again.' };
          setTimeout(() => openConv(res.conversation.id), reduceMotion.matches ? 0 : 150);
          return res;
        }
      });
      const draw = () => {
        const qq = d.form.querySelector('[data-tq]').value.trim().toLowerCase();
        const box = d.form.querySelector('[data-targets]');
        const rows = type === 'family' ? t.families.filter(f => !qq || `${f.name} ${f.children.map(c => c.name).join(' ')} ${f.guardians.map(g => g.name).join(' ')}`.toLowerCase().includes(qq)).map(f => [f.id, f.name, `${f.children.map(c => `${c.name} (${c.cls})`).join(', ')} · ${f.guardians.map(g => g.name).join(', ')}`])
          : type === 'staff' ? t.staff.filter(s => !qq || s.name.toLowerCase().includes(qq)).map(s => [s.id, s.name, s.role])
          : t.classes.filter(c => !qq || c.name.toLowerCase().includes(qq)).map(c => [c.id, c.name, `Broadcast to ${plural(c.families, 'family', 'families')} · replies stay private`]);
        box.innerHTML = rows.length ? rows.map(([id, name, sub]) => `<label class="cls-pick ib-target"><input type="radio" name="target" value="${esc(id)}"><span><b>${esc(name)}</b><small>${esc(sub)}</small></span></label>`).join('') : `<p class="cp-muted">${type === 'family' ? 'No families in your classes match.' : type === 'staff' ? 'No colleagues match.' : 'No classes you can message.'}</p>`;
      };
      d.form.addEventListener('change', e => { if (e.target.name === 'ctype') { type = e.target.value; draw(); } });
      d.form.querySelector('[data-tq]').addEventListener('input', draw);
      draw();
    }
    function quickEdit() {
      kids.dialog({
        label: 'Messages / Settings', title: 'Quick replies', desc: 'One per line. Everyone at the school sees these in the composer.',
        body: kids.field('kd-replies', 'Quick replies', `<textarea class="input" id="kd-replies" name="replies" rows="6">${esc(store.getQuickReplies().join('\n'))}</textarea>`),
        submit: 'Save',
        async onSubmit(form) { const res = await store.saveQuickReplies(store.currentUser(), form.elements.replies.value.split('\n')); if (res.ok) { window.NexoraToast?.show('Quick replies saved', plural(res.replies.length, 'reply', 'replies')); drawChatKeepDraft(); } return res.ok ? res : { ok: false, errors: res.errors || {}, message: res.errors ? '' : 'Couldn’t save.' }; }
      });
    }

    /* ---------------------------------------------------------------- Events */

    function drawDemo() {
      const on = store.messagingDemo();
      const lead = ['Director', 'Admin', 'Super Admin'].includes(user.role);
      $('[data-demo]').innerHTML = `<p class="ib-demo__text">${icon('info', 'icon--sm')}<span><b>Prototype.</b> ${on ? 'Demo mode: family replies are simulated and labelled “Demo”.' : 'Demo replies are off.'} Messages are stored on this device only — not secure messaging yet.</span></p>${lead ? `<button class="btn btn--tertiary btn--sm" type="button" data-demo-toggle>${on ? 'Turn demo replies off' : 'Turn demo replies on'}</button>` : ''}`;
    }
    function paint() {
      if (!loaded) return;
      drawDemo();
      drawList();
      drawChat({ keepScroll: true });
    }
    main.addEventListener('click', async e => {
      if (e.target.closest('[data-new]')) { newDialog(); return; }
      const o = e.target.closest('[data-open]');
      if (o) { openConv(o.dataset.open); return; }
      const fl = e.target.closest('[data-filter]');
      if (fl) { filter = fl.dataset.filter; syncUrl(); drawList(); return; }
      if (e.target.closest('[data-back]')) { const ta = $('[data-body]'); if (ta) drafts[current] = ta.value; current = ''; syncUrl(); drawList(); drawChat(); main.querySelector('[data-convs] button')?.focus(); return; }
      if (e.target.closest('[data-ctx-toggle]')) { if (!deskQ.matches) { ctxSheet(); return; } panelOpen = !panelOpen; drawChatKeepDraft(); return; }
      if (e.target.closest('[data-ctx-close]')) { panelOpen = false; drawChatKeepDraft(); return; }
      if (e.target.closest('[data-demo-toggle]')) { await store.setMessagingDemo(store.currentUser(), !store.messagingDemo()); drawDemo(); return; }
      const qb = e.target.closest('[data-quick]');
      if (qb) { const list = $('[data-quick-list]'); list.hidden = !list.hidden; qb.setAttribute('aria-expanded', String(!list.hidden)); if (!list.hidden) list.querySelector('button')?.focus(); return; }
      const qp = e.target.closest('[data-quick-pick]');
      if (qp) { const ta = $('[data-body]'); const text = store.getQuickReplies()[Number(qp.dataset.quickPick)]; ta.value = ta.value ? `${ta.value.trimEnd()} ${text}` : text; $('[data-quick-list]').hidden = true; grow(); sync(); ta.focus(); return; }
      if (e.target.closest('[data-quick-edit]')) { $('[data-quick-list]').hidden = true; quickEdit(); return; }
      if (e.target.closest('[data-schedule]')) { scheduleDialog(); return; }
      const ua = e.target.closest('[data-unattach]');
      if (ua) { attach[current] = (attach[current] || []).filter(f => f.key !== ua.dataset.unattach); drawChatKeepDraft(); return; }
      const rs = e.target.closest('[data-retry-send]');
      if (rs) { const p = (pending[current] || []).find(x => x.clientId === rs.dataset.retrySend); if (p) send({ retry: p }); return; }
      const dc = e.target.closest('[data-discard]');
      if (dc) { pending[current] = (pending[current] || []).filter(x => x.clientId !== dc.dataset.discard); drawChatKeepDraft(); return; }
      const cs = e.target.closest('[data-cancel-sched]');
      if (cs) { const r = await store.cancelScheduled(store.currentUser(), cs.dataset.cancelSched); window.NexoraToast?.show(r.ok ? 'Scheduled message cancelled' : 'Couldn’t cancel', r.ok ? 'It won’t be sent.' : 'It may already have been sent.', 'info'); return; }
      const tr = e.target.closest('[data-translate]');
      if (tr) {
        const id = tr.dataset.translate;
        const s = shown[id];
        if (s?.text) { s.visible = !s.visible; drawChatKeepDraft(); return; }
        if (s?.loading) return;
        shown[id] = { loading: true };
        drawChatKeepDraft();
        const res = await store.translateMessage(store.currentUser(), id, 'en');
        shown[id] = res.ok ? { text: res.text, target: res.target, demo: res.demo, visible: true } : { error: res.reason === 'no-service' ? 'Translation isn’t available — no translation service is connected in this prototype. The original message is unchanged.' : 'Couldn’t translate this message.' };
        drawChatKeepDraft();
        return;
      }
      const fb = e.target.closest('[data-file]');
      if (fb) {
        const f = store.chatFile(user, fb.dataset.file);
        if (!f) { window.NexoraToast?.show('Attachment not available', 'You may not have access to it.', 'info'); return; }
        const blob = await (await fetch(f.data)).blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    });
    main.addEventListener('submit', e => { if (e.target.matches('[data-composer]')) { e.preventDefault(); if (!$('[data-send]').disabled) send(); } });
    main.addEventListener('keydown', e => {
      if (e.target.matches('[data-body]') && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!$('[data-send]').disabled) send(); }
      if (e.key === 'Escape' && !$('[data-quick-list]')?.hidden) { $('[data-quick-list]').hidden = true; $('[data-quick]')?.focus(); }
    });
    main.addEventListener('input', e => {
      if (e.target.matches('[data-q]')) { q = e.target.value; drawList(); return; }
      if (e.target.matches('[data-body]')) { drafts[current] = e.target.value; grow(); sync(); }
    });
    main.addEventListener('change', e => { if (e.target.matches('[data-file-input]')) { const files = [...e.target.files]; e.target.value = ''; addFiles(files); } });
    document.addEventListener('click', e => { const list = main.querySelector('[data-quick-list]'); if (list && !list.hidden && !e.target.closest('.ib-quick-wrap')) list.hidden = true; });

    let queued = false;
    store.subscribe(({ key }) => {
      if (!loaded || (key && !/^nexora-(conversations|chat-|messaging-demo|quick-replies|guardians|children|demo-role|settings)/.test(key))) return;
      if (queued) return;
      queued = true;
      setTimeout(() => {
        queued = false;
        if (current && !document.hidden) store.markConversationRead(store.currentUser(), current);
        const focused = document.activeElement;
        const typing = focused?.matches?.('[data-body]');
        const pos = typing ? focused.selectionStart : null;
        if (typing) drafts[current] = focused.value;
        drawDemo(); drawList(); drawChat({ keepScroll: true });
        if (typing) { const ta = $('[data-body]'); ta.focus(); ta.setSelectionRange(pos, pos); }
      }, 0);
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && current && loaded) store.markConversationRead(store.currentUser(), current); });
    mobileQ.addEventListener('change', () => paint());
    wideQ.addEventListener('change', () => { panelOpen = wideQ.matches; paint(); });
    deskQ.addEventListener('change', () => paint());
    setTimeout(() => {
      try {
        if (failOnce) { failOnce = false; throw new Error('test failure'); }
        loaded = true;
        syncUrl();
        if (current) { const v = store.conversationView(user, current); if (!v.error) store.markConversationRead(store.currentUser(), current); }
        paint();
      } catch {
        $('[data-convs]').innerHTML = `<li class="ib-empty" role="alert"><p class="ib-empty__title">Something went wrong</p><p>We couldn’t load your messages.</p><button class="btn btn--secondary btn--sm" type="button" onclick="location.reload()">Try again</button></li>`;
      }
    }, reduceMotion.matches ? 0 : 250);
  }

  window.NexoraInbox = { render };
})();
