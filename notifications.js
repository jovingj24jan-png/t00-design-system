/* Notification centre (app.html?page=notifications) and S63 Notification settings
   (app.html?page=notification-settings): NexoraNotifications.render(key, main, user) → true when handled.
   Reads and writes the shared store only, so the list, the Unread count, the sidebar badge and
   every bell stay in step. Filters live in the URL (?tab, ?modules, ?from, ?to) and survive reloads.
   Test hook: ?fail=notifications makes the first list load fail, to show the error + Retry state. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const bellApi = window.NexoraBell;
  const { routes } = store;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const PAGE = 20;
  const TABS = [['all', 'All'], ['unread', 'Unread'], ['mentions', 'Mentions']];

  /* ------------------------------------------------------------ Shared dialog (same pattern as the other modals) */

  function dialog({ label, title, desc, body = '', foot, sheet = false, onClose }) {
    const opener = document.activeElement;
    const d = document.createElement('dialog');
    d.className = `modal${sheet ? ' nc-sheet' : ''}`;
    d.setAttribute('aria-labelledby', 'nc-dialog-title');
    d.innerHTML = `
      <form class="modal__panel" novalidate>
        <span class="modal__grabber" aria-hidden="true"></span>
        <div class="modal__top"><span class="tech-label">${esc(label)}</span><button class="btn btn--icon-ghost" type="button" aria-label="Close" data-close>${icon('x')}</button></div>
        <div class="modal__body"><h2 class="modal__title" id="nc-dialog-title">${esc(title)}</h2>${desc ? `<p class="modal__desc">${esc(desc)}</p>` : ''}${body}</div>
        <div class="modal__foot">${foot}</div>
      </form>`;
    document.body.appendChild(d);
    let closing = false;
    const close = () => {
      if (closing) return;
      closing = true;
      d.classList.add('is-closing');
      const done = () => { d.close(); d.remove(); if (document.contains(opener)) opener.focus(); onClose?.(); };
      reduceMotion.matches ? done() : setTimeout(done, 170);
    };
    d.addEventListener('cancel', e => { e.preventDefault(); close(); });
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) close(); });
    d.showModal();
    return { el: d, close };
  }

  function setLoading(btn, text) {
    btn.dataset.original = btn.innerHTML;
    btn.classList.add('is-loading');
    btn.setAttribute('aria-busy', 'true');
    btn.setAttribute('aria-disabled', 'true');
    btn.innerHTML = `<span class="spinner" aria-hidden="true"></span>${esc(text)}`;
  }
  function clearLoading(btn) {
    if (!btn?.dataset.original) return;
    btn.innerHTML = btn.dataset.original;
    delete btn.dataset.original;
    btn.classList.remove('is-loading');
    btn.removeAttribute('aria-busy');
    btn.removeAttribute('aria-disabled');
  }

  /* ------------------------------------------------------------ Notification centre */

  function centre(main) {
    const params = new URLSearchParams(location.search);
    const user = () => store.currentUser();
    const allowedModules = () => store.notificationModules(user()).map(m => m.key);
    const state = {
      tab: TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'all',
      modules: new Set((params.get('modules') || '').split(',').filter(Boolean)),
      from: /^\d{4}-\d{2}-\d{2}$/.test(params.get('from') || '') ? params.get('from') : '',
      to: /^\d{4}-\d{2}-\d{2}$/.test(params.get('to') || '') ? params.get('to') : '',
      limit: PAGE,
      selected: new Set(),
      busy: false,
      failOnce: params.get('fail') === 'notifications'
    };
    // Never filter by a module this role can't see (e.g. a link shared from another role).
    state.modules = new Set([...state.modules].filter(m => allowedModules().includes(m)));
    let lastUnread = null;

    const filters = () => ({ tab: state.tab, modules: [...state.modules], from: state.from, to: state.to });
    const filterCount = () => state.modules.size + (state.from || state.to ? 1 : 0);
    const hasFilters = () => filterCount() > 0;

    function syncUrl() {
      const q = new URLSearchParams({ page: 'notifications' });
      if (state.tab !== 'all') q.set('tab', state.tab);
      if (state.modules.size) q.set('modules', [...state.modules].join(','));
      if (state.from) q.set('from', state.from);
      if (state.to) q.set('to', state.to);
      history.replaceState(null, '', `app.html?${q}`);
    }

    function filterFormHtml(prefix, values) {
      const mods = store.notificationModules(user());
      return `
        <fieldset class="nc-filter">
          <legend class="nc-filter__title">Modules</legend>
          <div class="nc-filter__checks">
            ${mods.map(m => `<label class="check"><input type="checkbox" name="module" value="${esc(m.key)}"${values.modules.has(m.key) ? ' checked' : ''}>${esc(m.name)}</label>`).join('')}
          </div>
        </fieldset>
        <fieldset class="nc-filter">
          <legend class="nc-filter__title">Date</legend>
          <div class="nc-dates">
            <div class="field"><label class="field__label" for="${prefix}-from">From</label><input class="input" type="date" id="${prefix}-from" name="from" value="${esc(values.from)}" max="${store.today()}" aria-describedby="${prefix}-date-error"></div>
            <div class="field"><label class="field__label" for="${prefix}-to">To</label><input class="input" type="date" id="${prefix}-to" name="to" value="${esc(values.to)}" ${values.from ? `min="${esc(values.from)}"` : ''} max="${store.today()}" aria-describedby="${prefix}-date-error"></div>
          </div>
          <p class="field__hint field__hint--error" id="${prefix}-date-error" hidden></p>
        </fieldset>`;
    }

    // Reads a filter form; returns null (and shows why) when the dates don't make a range.
    function readForm(form, prefix) {
      const from = form.elements.from.value;
      const to = form.elements.to.value;
      const err = form.querySelector(`#${prefix}-date-error`);
      const bad = from && to && to < from;
      err.hidden = !bad;
      err.innerHTML = bad ? `${icon('info')}The end date can’t be before the start date.` : '';
      form.elements.to.setAttribute('aria-invalid', String(Boolean(bad)));
      form.elements.to.min = from || '';
      if (bad) return null;
      return { modules: new Set([...form.querySelectorAll('[name="module"]:checked')].map(c => c.value)), from, to };
    }

    function frame() {
      main.innerHTML = `
        <div class="nc" aria-labelledby="page-title">
          <header class="nc-head">
            <div>
              <h1 class="nc-head__title" id="page-title" tabindex="-1">Notifications</h1>
              <p class="nc-head__sub">For ${esc(user().name)} · ${esc(user().role)}</p>
            </div>
            <div class="nc-head__actions">
              <button class="btn btn--secondary" type="button" data-mark-all>${icon('check', 'icon--sm')}Mark all as read</button>
              <a class="btn btn--tertiary" href="${routes.page('notification-settings')}">${icon('sliders', 'icon--sm')}Notification settings</a>
            </div>
          </header>
          <div class="nc-body">
            <aside class="nc-side" aria-labelledby="nc-side-title">
              <div class="nc-side__head"><h2 class="nc-side__title" id="nc-side-title">Filters</h2><button class="btn btn--tertiary btn--sm" type="button" data-clear-filters>Clear filters</button></div>
              <form class="nc-side__form" data-side-form novalidate></form>
            </aside>
            <section class="nc-main" aria-label="Notification list">
              <div class="nc-tabs-row">
                <div class="tabs nc-tabs" role="tablist" aria-label="Show">${TABS.map(([k, l]) => `<button class="tab" type="button" role="tab" id="nc-tab-${k}" aria-controls="nc-panel" data-tab="${k}">${l}${k === 'unread' ? ' <span class="tab__count" data-unread-count>0</span>' : ''}</button>`).join('')}</div>
                <button class="btn btn--secondary btn--sm nc-filter-btn" type="button" data-open-filters aria-haspopup="dialog">${icon('filter', 'icon--sm')}Filter<span class="nc-filter-btn__count" data-filter-count hidden></span></button>
              </div>
              <div class="nc-bulk" data-bulk hidden></div>
              <div class="nc-panel" id="nc-panel" role="tabpanel" data-list></div>
              <p class="sr-only" aria-live="polite" data-live></p>
            </section>
          </div>
        </div>`;
    }

    function drawSideForm() {
      const form = main.querySelector('[data-side-form]');
      form.innerHTML = filterFormHtml('nc-side', state);
    }

    function announce(text) {
      const live = main.querySelector('[data-live]');
      live.textContent = '';
      requestAnimationFrame(() => { live.textContent = text; });
    }

    function rowHtml(n) {
      const [ic, tone] = bellApi.styleFor(n);
      const checked = state.selected.has(n.id);
      const mention = store.isMention(user(), n);
      return `
        <li class="ntf${n.read ? '' : ' is-unread'}${checked ? ' is-selected' : ''}${n.severity === 'critical' ? ' is-critical' : ''}" data-id="${esc(n.id)}">
          ${n.read ? '' : '<span class="unread-dot ntf__dot" aria-hidden="true"></span>'}
          <label class="ntf__check"><input type="checkbox" data-select="${esc(n.id)}"${checked ? ' checked' : ''}><span class="sr-only">Select: ${esc(n.title)}</span></label>
          <span class="ntf-icon ntf-icon--${tone}" aria-hidden="true">${icon(ic, 'icon--sm')}</span>
          <button class="ntf__open" type="button" data-open="${esc(n.id)}">
            <span class="ntf__title">${n.read ? '' : '<span class="sr-only">Unread: </span>'}${esc(n.title)}</span>
            <span class="ntf__detail">${esc(n.body || '')}</span>
            <span class="ntf__meta"><span><time datetime="${esc(n.createdAt)}" title="${esc(bellApi.fullTime(n.createdAt))}" data-rel="${esc(n.createdAt)}">${esc(bellApi.relTime(n.createdAt))}</time><span class="sr-only">, ${esc(bellApi.fullTime(n.createdAt))},</span></span><span class="ntf__sep">${esc(store.moduleLabel(n.module || 'system'))}</span>${mention ? '<span class="ntf__sep"><span class="ntf__tag">Mention</span></span>' : ''}${n.severity === 'critical' ? `<span class="ntf__sep"><span class="ntf__tag ntf__tag--critical">${icon('alert-triangle', 'icon--sm')}Urgent</span></span>` : ''}</span>
          </button>
          <div class="ntf__actions">
            <button class="btn btn--icon-ghost ntf__act" type="button" data-toggle-read="${esc(n.id)}" aria-label="${n.read ? 'Mark as unread' : 'Mark as read'}: ${esc(n.title)}" title="${n.read ? 'Mark as unread' : 'Mark as read'}">${icon(n.read ? 'mail' : 'check', 'icon--sm')}</button>
            <button class="btn btn--icon-ghost ntf__act" type="button" data-delete="${esc(n.id)}" aria-label="Delete: ${esc(n.title)}" title="Delete">${icon('trash', 'icon--sm')}</button>
            <div class="menu-wrap ntf__more">
              <button class="btn btn--icon-ghost" type="button" data-more="${esc(n.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="Actions: ${esc(n.title)}">${icon('more')}</button>
            </div>
          </div>
        </li>`;
    }

    function groupsHtml(list) {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const t0 = start.getTime();
      const groups = [['Today', []], ['Yesterday', []], ['Earlier', []]];
      list.forEach(n => {
        const t = new Date(n.createdAt).getTime();
        groups[t >= t0 ? 0 : t >= t0 - 86400000 ? 1 : 2][1].push(n);
      });
      return groups.filter(([, items]) => items.length).map(([name, items]) => `
        <section class="nc-group" aria-labelledby="nc-g-${name}">
          <h2 class="nc-group__title" id="nc-g-${name}">${name}</h2>
          <ul class="nc-list">${items.map(rowHtml).join('')}</ul>
        </section>`).join('');
    }

    const bellArt = `<svg class="nc-empty__art" viewBox="0 0 120 96" aria-hidden="true" focusable="false"><circle class="nc-art-soft" cx="60" cy="48" r="40"/><path class="nc-art-line" d="M42 58V44a18 18 0 0 1 36 0v14l6 8H36z"/><path class="nc-art-line" d="M54 72a6 6 0 0 0 12 0"/><path class="nc-art-accent" d="M86 22l4-4M92 32h6M30 22l-4-4M24 32h-6"/></svg>`;

    function emptyHtml(kind) {
      if (kind === 'history') return `<div class="nc-empty">${bellArt}<h2 class="nc-empty__title">You're all caught up</h2><p class="nc-empty__text">There are no notifications to show right now.</p></div>`;
      if (kind === 'unread') return `<div class="nc-empty">${icon('check-circle', 'nc-empty__icon icon--success')}<h2 class="nc-empty__title">No unread notifications</h2><p class="nc-empty__text">You’ve read everything. Older notifications are in All.</p><button class="btn btn--secondary btn--sm" type="button" data-tab-go="all">Show all</button></div>`;
      if (kind === 'mentions') return `<div class="nc-empty">${icon('message', 'nc-empty__icon icon--muted')}<h2 class="nc-empty__title">No mentions yet</h2><p class="nc-empty__text">When someone assigns you a follow-up or posts to your class, it shows here.</p></div>`;
      return `<div class="nc-empty">${icon('filter', 'nc-empty__icon icon--muted')}<h2 class="nc-empty__title">No notifications match your filters</h2><p class="nc-empty__text">Try another module or date range.</p><button class="btn btn--secondary btn--sm" type="button" data-clear-filters>Clear filters</button></div>`;
    }

    let current = [];

    function draw() {
      const u = user();
      const listEl = main.querySelector('[data-list]');
      // Remember focus so a re-render (after an action or a change in another tab) doesn't lose it.
      const active = document.activeElement;
      const focusAttr = active && listEl.contains(active) ? ['data-open', 'data-select', 'data-toggle-read', 'data-delete', 'data-more'].find(a => active.hasAttribute(a)) : null;
      const focusId = focusAttr ? active.getAttribute(focusAttr) : null;
      const focusIndex = focusId ? current.findIndex(n => n.id === focusId) : -1;

      let list;
      try {
        if (state.failOnce) { state.failOnce = false; throw new Error('Simulated notification load failure'); }
        list = store.listNotifications(u, filters());
      } catch (err) {
        console.error(err);
        listEl.innerHTML = `<div class="nc-empty nc-empty--error" role="alert">${icon('alert-circle', 'nc-empty__icon icon--error')}<h2 class="nc-empty__title">Something went wrong</h2><p class="nc-empty__text">We couldn’t load your notifications. Nothing was changed.</p><button class="btn btn--primary btn--sm" type="button" data-retry>${icon('refresh', 'icon--sm')}Try again</button></div>`;
        main.querySelector('[data-bulk]').hidden = true;
        return;
      }
      // Keep the selection to what is still in this view, so hidden records are never acted on.
      const ids = new Set(list.map(n => n.id));
      state.selected.forEach(id => { if (!ids.has(id)) state.selected.delete(id); });
      current = list;

      const unread = store.unreadCount(u);
      main.querySelector('[data-unread-count]').textContent = unread > 99 ? '99+' : unread;
      const markAll = main.querySelector('[data-mark-all]');
      if (!markAll.classList.contains('is-loading')) markAll.disabled = !unread;
      main.querySelectorAll('[data-tab]').forEach(t => {
        const on = t.dataset.tab === state.tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      main.querySelector('[data-list]').setAttribute('aria-labelledby', `nc-tab-${state.tab}`);
      const fc = main.querySelector('[data-filter-count]');
      fc.hidden = !filterCount();
      fc.textContent = filterCount() || '';
      main.querySelector('[data-open-filters]').setAttribute('aria-label', `Filter${filterCount() ? `, ${filterCount()} active` : ''}`);
      main.querySelector('.nc-side [data-clear-filters]').disabled = !hasFilters();

      if (!list.length) {
        const total = store.listNotifications(u).length;
        listEl.innerHTML = emptyHtml(!total ? 'history' : !hasFilters() && state.tab !== 'all' ? state.tab : 'filters');
      } else {
        const shown = list.slice(0, state.limit);
        listEl.innerHTML = `
          <p class="nc-count">${plural(list.length, 'notification')}${hasFilters() ? ' match your filters' : ''}${list.length > shown.length ? ` · showing ${shown.length}` : ''}</p>
          ${groupsHtml(shown)}
          ${list.length > shown.length ? `<button class="btn btn--secondary btn--block nc-more" type="button" data-show-more>Show ${Math.min(PAGE, list.length - shown.length)} more</button>` : ''}`;
      }
      drawBulk();

      if (lastUnread !== null && unread !== lastUnread) announce(`${plural(unread, 'unread notification')}.`);
      lastUnread = unread;

      if (focusAttr) {
        const same = listEl.querySelector(`[${focusAttr}="${CSS.escape(focusId)}"]`);
        // If that row left the view (e.g. read while on Unread), move to the row now in its place.
        const fallback = listEl.querySelectorAll('[data-open]')[Math.min(focusIndex, listEl.querySelectorAll('[data-open]').length - 1)];
        (same || fallback || main.querySelector(`#nc-tab-${state.tab}`)).focus({ preventScroll: Boolean(same) });
      }
    }

    function drawBulk() {
      const bar = main.querySelector('[data-bulk]');
      const n = state.selected.size;
      const visible = [...main.querySelectorAll('[data-select]')].map(c => c.dataset.select);
      const allVisible = visible.length && visible.every(id => state.selected.has(id));
      bar.hidden = !n;
      if (!n) { bar.innerHTML = ''; return; }
      const allMatching = n === current.length;
      bar.innerHTML = `
        <label class="check nc-bulk__all"><input type="checkbox" data-select-visible${allVisible ? ' checked' : ''}><span>${allVisible ? 'Deselect shown' : `Select all ${visible.length} shown`}</span></label>
        <p class="nc-bulk__count" role="status"><strong>${n}</strong> selected${allMatching && current.length > visible.length ? ' · every notification matching your filters' : ''}</p>
        ${allVisible && current.length > visible.length && !allMatching ? `<button class="btn btn--tertiary btn--sm" type="button" data-select-matching>Select all ${current.length} matching</button>` : ''}
        <div class="nc-bulk__actions">
          <button class="btn btn--secondary btn--sm" type="button" data-bulk-read${state.busy ? ' disabled' : ''}>${icon('check', 'icon--sm')}Mark read</button>
          <button class="btn btn--secondary btn--sm nc-bulk__delete" type="button" data-bulk-delete${state.busy ? ' disabled' : ''}>${icon('trash', 'icon--sm')}Delete</button>
          <button class="btn btn--ghost btn--sm" type="button" data-clear-selection>Clear</button>
        </div>`;
      const box = bar.querySelector('[data-select-visible]');
      box.indeterminate = !allVisible && visible.some(id => state.selected.has(id));
    }

    function changeFilters(next, { keepFocus = false } = {}) {
      const hadSelection = state.selected.size;
      Object.assign(state, next);
      state.limit = PAGE;
      state.selected.clear();
      syncUrl();
      draw();
      if (hadSelection) announce('Selection cleared because the filters changed.');
      if (!keepFocus) drawSideForm();
    }

    function setTab(tab, focus = true) {
      if (tab === state.tab) return;
      changeFilters({ tab });
      if (focus) main.querySelector(`#nc-tab-${tab}`).focus();
    }

    /* Actions */
    async function run(promise, { ok, partial, fail }) {
      state.busy = true;
      drawBulk();
      let r;
      try { r = await promise; } catch { r = { ok: false, updated: [], failed: [] }; }
      state.busy = false;
      if (r.ok && !r.failed.length) { if (ok) window.NexoraToast.show(ok(r)); announce(ok ? ok(r) : ''); }
      else if (r.updated.length) { window.NexoraToast.show(partial(r), 'The rest are still selected so you can try again.', 'info'); announce(partial(r)); }
      else { window.NexoraToast.show(fail, 'Nothing was changed. Please try again.', 'info'); announce(fail); }
      // Successful items leave the selection; failed ones stay for a retry.
      r.updated.forEach(id => state.selected.delete(id));
      draw();
      return r;
    }

    async function openItem(id) {
      const u = user();
      const n = current.find(x => x.id === id);
      if (!n) return;
      if (!n.read) {
        const r = await store.setNotificationsRead(u, [id], true);
        if (!r.ok) { window.NexoraToast.show('Couldn’t update this notification', 'Please try again.', 'info'); return; }
      }
      const target = store.notificationTarget(u, n);
      if (target.error) { window.NexoraToast.show('Can’t open this notification', target.error, 'info'); return; }
      if (target.href) location.href = target.href;
      else announce('Marked as read.');
    }

    function confirmDelete(ids) {
      const count = ids.length;
      const d = dialog({
        label: 'Notifications / Delete', title: `Delete ${plural(count, 'notification')}?`,
        desc: 'They’re removed from your notifications only. The enquiries, payments, incidents and other records stay as they are.',
        foot: `<button class="btn btn--danger" type="submit">${icon('trash', 'icon--sm')}Delete ${count}</button><button class="btn btn--secondary" type="button" data-close>Cancel</button>`
      });
      d.el.querySelector('[type="submit"]').focus();
      d.el.querySelector('form').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = d.el.querySelector('[type="submit"]');
        if (btn.classList.contains('is-loading')) return;
        setLoading(btn, 'Deleting…');
        const r = await run(store.deleteNotifications(user(), ids), {
          ok: x => `${plural(x.updated.length, 'notification')} deleted`,
          partial: x => `${x.updated.length} deleted, ${x.failed.length} couldn’t be deleted`,
          fail: 'Notifications not deleted'
        });
        clearLoading(btn);
        if (r.updated.length) d.close();
      });
    }

    let menu = null;
    function closeMenu(focus = true) {
      if (!menu) return;
      const { el, trigger } = menu;
      el.remove();
      trigger.setAttribute('aria-expanded', 'false');
      menu = null;
      if (focus && document.contains(trigger)) trigger.focus();
    }
    function openMenu(trigger) {
      closeMenu(false);
      const n = current.find(x => x.id === trigger.dataset.more);
      if (!n) return;
      const el = document.createElement('div');
      el.className = 'menu';
      el.setAttribute('role', 'menu');
      el.innerHTML = `
        <button type="button" role="menuitem" data-toggle-read="${esc(n.id)}">${icon(n.read ? 'mail' : 'check', 'icon--sm')}${n.read ? 'Mark as unread' : 'Mark as read'}</button>
        <button type="button" role="menuitem" class="is-danger" data-delete="${esc(n.id)}">${icon('trash', 'icon--sm')}Delete</button>`;
      trigger.after(el);
      trigger.setAttribute('aria-expanded', 'true');
      menu = { el, trigger };
      el.querySelector('button').focus();
    }

    async function toggleRead(id) {
      const n = current.find(x => x.id === id);
      if (!n) return;
      const toRead = !n.read;
      await run(store.setNotificationsRead(user(), [id], toRead), { ok: () => (toRead ? 'Marked as read' : 'Marked as unread'), partial: () => '', fail: 'Notification not updated' });
    }

    async function deleteOne(id) {
      await run(store.deleteNotifications(user(), [id]), { ok: () => 'Notification deleted', partial: () => '', fail: 'Notification not deleted' });
    }

    function openFilterSheet() {
      const draft = { modules: new Set(state.modules), from: state.from, to: state.to };
      const d = dialog({
        label: 'Notifications / Filter', title: 'Filter notifications', sheet: true,
        body: `<div class="nc-sheet__form">${filterFormHtml('nc-sheet', draft)}</div>`,
        foot: '<button class="btn btn--primary" type="submit">Apply</button><button class="btn btn--secondary" type="button" data-sheet-clear>Clear filters</button>'
      });
      const form = d.el.querySelector('form');
      d.el.querySelector('[name="module"], [name="from"]').focus();
      form.addEventListener('change', () => readForm(form, 'nc-sheet'));
      d.el.querySelector('[data-sheet-clear]').addEventListener('click', () => {
        form.querySelectorAll('[name="module"]').forEach(c => { c.checked = false; });
        form.elements.from.value = '';
        form.elements.to.value = '';
        readForm(form, 'nc-sheet');
      });
      form.addEventListener('submit', e => {
        e.preventDefault();
        const values = readForm(form, 'nc-sheet');
        if (!values) { form.elements.to.focus(); return; }
        changeFilters(values);
        d.close();
      });
    }

    function bind() {
      main.addEventListener('click', e => {
        const t = e.target;
        if (menu && !menu.el.contains(t) && t.closest('[data-more]') !== menu.trigger) closeMenu(false);
        const tab = t.closest('[data-tab]');
        if (tab) { setTab(tab.dataset.tab); return; }
        const go = t.closest('[data-tab-go]');
        if (go) { setTab(go.dataset.tabGo); return; }
        if (t.closest('[data-clear-filters]')) { changeFilters({ modules: new Set(), from: '', to: '' }); main.querySelector('#page-title').focus(); return; }
        if (t.closest('[data-open-filters]')) { openFilterSheet(); return; }
        if (t.closest('[data-retry]')) { draw(); return; }
        if (t.closest('[data-show-more]')) {
          const before = state.limit;
          state.limit += PAGE;
          draw();
          main.querySelectorAll('[data-open]')[before]?.focus();
          return;
        }
        if (t.closest('[data-mark-all]')) {
          const btn = t.closest('[data-mark-all]');
          if (btn.disabled || btn.classList.contains('is-loading')) return;
          setLoading(btn, 'Marking…');
          store.markAllRead(user()).then(r => {
            clearLoading(btn);
            if (r.ok) { window.NexoraToast.show(r.updated.length ? `${plural(r.updated.length, 'notification')} marked as read` : 'Nothing to mark'); announce('All notifications marked as read.'); }
            else window.NexoraToast.show('Couldn’t mark notifications as read', 'Nothing was changed. Please try again.', 'info');
            draw();
          });
          return;
        }
        const more = t.closest('[data-more]');
        if (more) { menu?.trigger === more ? closeMenu() : openMenu(more); return; }
        const toggle = t.closest('[data-toggle-read]');
        if (toggle) { const id = toggle.dataset.toggleRead; closeMenu(false); toggleRead(id); return; }
        const del = t.closest('[data-delete]');
        if (del) { const id = del.dataset.delete; closeMenu(false); deleteOne(id); return; }
        const open = t.closest('[data-open]');
        if (open) { openItem(open.dataset.open); return; }
        if (t.closest('[data-select-matching]')) { current.forEach(n => state.selected.add(n.id)); draw(); main.querySelector('[data-bulk-read]')?.focus(); return; }
        if (t.closest('[data-clear-selection]')) { state.selected.clear(); draw(); announce('Selection cleared.'); main.querySelector('#nc-tab-' + state.tab).focus(); return; }
        if (t.closest('[data-bulk-read]') && !state.busy) {
          const ids = [...state.selected];
          run(store.setNotificationsRead(user(), ids, true), { ok: x => `${plural(x.updated.length, 'notification')} marked as read`, partial: x => `${x.updated.length} marked as read, ${x.failed.length} couldn’t be updated`, fail: 'Notifications not updated' });
          return;
        }
        if (t.closest('[data-bulk-delete]') && !state.busy) { confirmDelete([...state.selected]); }
      });

      main.addEventListener('change', e => {
        const sel = e.target.closest('[data-select]');
        if (sel) {
          sel.checked ? state.selected.add(sel.dataset.select) : state.selected.delete(sel.dataset.select);
          sel.closest('.ntf').classList.toggle('is-selected', sel.checked);
          drawBulk();
          return;
        }
        if (e.target.closest('[data-select-visible]')) {
          const visible = [...main.querySelectorAll('[data-select]')].map(c => c.dataset.select);
          const on = e.target.checked;
          visible.forEach(id => (on ? state.selected.add(id) : state.selected.delete(id)));
          draw();
          main.querySelector('[data-select-visible]')?.focus();
          return;
        }
        // Desktop filters apply as soon as they change.
        const side = e.target.closest('[data-side-form]');
        if (side) {
          const values = readForm(side, 'nc-side');
          if (values) changeFilters(values, { keepFocus: true });
        }
      });

      main.addEventListener('keydown', e => {
        const tab = e.target.closest('[data-tab]');
        if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
          e.preventDefault();
          const keys = TABS.map(([k]) => k);
          const i = keys.indexOf(tab.dataset.tab);
          const next = e.key === 'Home' ? 0 : e.key === 'End' ? keys.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length;
          setTab(keys[next]);
          return;
        }
        if (menu && menu.el.contains(e.target)) {
          const items = [...menu.el.querySelectorAll('[role="menuitem"]')];
          const i = items.indexOf(e.target);
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); }
          if (e.key === 'Tab') closeMenu(false);
        }
      });
      document.addEventListener('click', e => { if (menu && !main.contains(e.target)) closeMenu(false); });

      // Store changes from anywhere (bell, another tab, a new enquiry) → one redraw per frame.
      let queued = false;
      store.subscribe(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; if (!menu) draw(); });
      });
      // Relative times: update the text only, once a minute.
      setInterval(() => main.querySelectorAll('[data-rel]').forEach(t => { t.textContent = bellApi.relTime(t.dataset.rel); }), 60000);
    }

    function skeleton() {
      main.querySelector('[data-list]').innerHTML = `<div class="nc-skeleton" aria-busy="true">${Array.from({ length: 5 }, () => '<div class="sk-row nc-sk-row"><span class="skeleton sk-circle"></span><span class="sk-stack"><span class="skeleton sk-line w-60"></span><span class="skeleton sk-line w-90"></span><span class="skeleton sk-line w-40"></span></span></div>').join('')}<p class="sr-only" role="status">Loading notifications…</p></div>`;
    }

    frame();
    drawSideForm();
    skeleton();
    // Local data is instant; the short skeleton keeps the first paint calm and matches the dashboard.
    setTimeout(() => { bind(); draw(); }, 300);
  }

  /* ------------------------------------------------------------ S63 Notification settings */

  function settings(main) {
    const user = store.currentUser();
    const mods = store.notificationModules(user).filter(m => m.key !== 'system');
    const saved = store.getNotificationSettings(user);
    const muted = new Set(saved.muted);
    main.classList.add('record-page');
    main.innerHTML = `
      <article class="panel record nc-settings" aria-labelledby="page-title">
        <header class="panel__head">
          <span class="panel__num">S63<i class="marker" aria-hidden="true"></i></span>
          <div><h1 class="panel__title" id="page-title">Notification settings</h1><p class="panel__sub">Choose which modules send you notifications, ${esc(user.name)}.</p></div>
          <span class="tech-label">Page / Notification settings</span>
        </header>
        ${mods.length ? `<ul class="nc-settings__list">${mods.map(m => `
          <li class="nc-settings__row">
            <span class="ntf-icon ntf-icon--${bellApi.styleFor({ module: m.key })[1]}" aria-hidden="true">${icon(bellApi.styleFor({ module: m.key })[0], 'icon--sm')}</span>
            <span class="nc-settings__name" id="ns-${esc(m.key)}">${esc(m.name)}</span>
            <button class="switch" type="button" role="switch" aria-checked="${!muted.has(m.key)}" aria-labelledby="ns-${esc(m.key)}" data-module="${esc(m.key)}"><span class="switch__track"><span class="switch__thumb"></span></span><span class="switch__state" aria-hidden="true">${muted.has(m.key) ? 'OFF' : 'ON'}</span></button>
          </li>`).join('')}</ul>` : '<p class="mod__note">Your role has no modules that send notifications yet.</p>'}
        <div class="well"><span class="tech-label">Always on</span><p class="ts-small" style="margin-top:var(--space-2)">Emergency broadcasts, class ratio warnings and high-severity incidents always reach you, whatever you choose here. Turning a module off stops new notifications; ones you already have stay.</p></div>
        <div class="nf__actions"><button class="btn btn--primary" type="button" data-save>Save settings</button><a class="btn btn--secondary" href="${routes.page('notifications')}">${icon('arrow-left', 'icon--sm')}Back to notifications</a></div>
      </article>`;
    main.addEventListener('click', async e => {
      const sw = e.target.closest('[data-module]');
      if (sw) {
        const on = sw.getAttribute('aria-checked') !== 'true';
        sw.setAttribute('aria-checked', String(on));
        sw.querySelector('.switch__state').textContent = on ? 'ON' : 'OFF';
        return;
      }
      const save = e.target.closest('[data-save]');
      if (save && !save.classList.contains('is-loading')) {
        setLoading(save, 'Saving…');
        const r = await store.saveNotificationSettings(user, { muted: [...main.querySelectorAll('[data-module][aria-checked="false"]')].map(b => b.dataset.module) });
        clearLoading(save);
        window.NexoraToast.show(r.ok ? 'Notification settings saved' : 'Settings not saved', r.ok ? '' : 'Storage is blocked in this browser. Please try again.', r.ok ? 'check-circle' : 'info');
      }
    });
  }

  function render(key, main) {
    if (key === 'notifications') { centre(main); return true; }
    if (key === 'notification-settings') { settings(main); return true; }
    return false;
  }

  window.NexoraNotifications = { render };
})();
