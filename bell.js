/* Notification bell: NexoraBell.create({ placement }) → element; NexoraBell.setAlert(text|null).
   Every bell on the page reads the same store: badge = all unread notifications for the
   current user, dropdown = the 10 most recent. One store subscription updates them all. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const { routes } = store;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const PREVIEW = 10;

  // Module → icon + colour family, shared with the notification centre.
  const MODULE_STYLE = {
    attendance: ['calendar-check', 'success'], admissions: ['user-plus', 'info'], fees: ['wallet', 'accent'],
    safeguarding: ['shield-check', 'error'], communication: ['megaphone', 'primary'], 'classroom-tracker': ['grid', 'neutral'],
    observations: ['eye', 'neutral'], gallery: ['image', 'neutral'], reports: ['chart', 'neutral'], payroll: ['users', 'neutral'],
    system: ['bell', 'neutral']
  };
  const styleFor = n => (n.kind === 'broadcast' ? ['siren', 'error'] : MODULE_STYLE[n.module || 'system'] || MODULE_STYLE.system);
  const badgeText = n => (n > 99 ? '99+' : String(n));

  function relTime(iso, now = Date.now()) {
    const then = new Date(iso);
    const mins = Math.round((now - then.getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
    const hours = Math.round(mins / 60);
    if (then >= startToday) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    if (then >= new Date(startToday.getTime() - 86400000)) return 'Yesterday';
    const days = Math.floor((startToday - then) / 86400000) + 1;
    if (days < 7) return `${days} days ago`;
    return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: then.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric' });
  }
  const fullTime = iso => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const bells = new Set();
  let alertText = null;
  let subscribed = false;
  let openBell = null;

  function label(count) {
    return ['Notifications', count ? `${count} unread` : 'none unread', alertText].filter(Boolean).join(', ');
  }

  function itemHtml(n) {
    const [ic, tone] = styleFor(n);
    return `
      <li><a class="bell-item${n.read ? '' : ' is-unread'}" href="#" data-notif="${esc(n.id)}">
        <span class="ntf-icon ntf-icon--${tone}" aria-hidden="true">${icon(ic, 'icon--sm')}</span>
        <span class="bell-item__text">
          <span class="bell-item__title">${n.read ? '' : '<span class="sr-only">Unread: </span>'}${esc(n.title)}</span>
          <span class="bell-item__detail">${esc(n.body || '')}</span>
          <time class="bell-item__time" datetime="${esc(n.createdAt)}" title="${esc(fullTime(n.createdAt))}">${esc(relTime(n.createdAt))}</time>
        </span>
        ${n.read ? '' : '<span class="unread-dot" aria-hidden="true"></span>'}
      </a></li>`;
  }

  function update(el) {
    const user = store.currentUser();
    const count = store.unreadCount(user);
    const btn = el.querySelector('.bell__btn');
    btn.setAttribute('aria-label', label(count));
    el.querySelector('.bell__badge').textContent = count ? badgeText(count) : '';
    el.querySelector('.bell__badge').hidden = !count;
    el.querySelector('.bell__alert').hidden = !alertText;
    if (el.classList.contains('is-open')) fill(el);
  }

  function fill(el) {
    const user = store.currentUser();
    const list = store.listNotifications(user).slice(0, PREVIEW);
    const count = store.unreadCount(user);
    el.querySelector('.bell__panel').innerHTML = `
      <div class="bell__head"><p class="bell__title" id="${el.id}-title">Notifications</p>${count ? `<span class="badge badge--primary badge--plain">${count} unread</span>` : ''}</div>
      ${list.length ? `<ul class="bell__list" aria-labelledby="${el.id}-title">${list.map(itemHtml).join('')}</ul>`
        : `<div class="bell__empty">${icon('bell', 'icon--muted')}<p>You're all caught up</p></div>`}
      <a class="bell__all" href="${routes.page('notifications')}">View all notifications${icon('arrow-right', 'icon--sm')}</a>`;
  }

  function setOpen(el, open, { focus = true } = {}) {
    if (open && openBell && openBell !== el) setOpen(openBell, false, { focus: false });
    el.classList.toggle('is-open', open);
    const btn = el.querySelector('.bell__btn');
    btn.setAttribute('aria-expanded', String(open));
    el.querySelector('.bell__panel').hidden = !open;
    if (open) { fill(el); openBell = el; requestAnimationFrame(() => el.querySelector('.bell-item, .bell__all')?.focus()); }
    else { if (openBell === el) openBell = null; if (focus) btn.focus(); }
  }

  // Marks the notification read, then goes to its record (or explains why it can't).
  async function openNotification(id) {
    const user = store.currentUser();
    const n = store.listNotifications(user).find(x => x.id === id);
    if (!n) return;
    if (!n.read) await store.setNotificationsRead(user, [id], true);
    const target = store.notificationTarget(user, n);
    if (target.error) { window.NexoraToast?.show('Can’t open this notification', target.error, 'info'); return; }
    if (target.href) location.href = target.href;
  }

  function create({ placement = 'down' } = {}) {
    const el = document.createElement('div');
    el.className = `bell bell--${placement}`;
    el.id = `bell-${bells.size + 1}`;
    el.innerHTML = `
      <button class="btn btn--icon bell__btn" type="button" aria-expanded="false" aria-controls="${el.id}-panel" aria-haspopup="true">
        ${icon('bell')}<span class="bell__badge" aria-hidden="true" hidden></span><span class="bell__alert" aria-hidden="true" hidden></span>
      </button>
      <div class="bell__panel" id="${el.id}-panel" hidden></div>`;
    el.querySelector('.bell__btn').addEventListener('click', () => setOpen(el, !el.classList.contains('is-open')));
    el.addEventListener('click', e => {
      const item = e.target.closest('[data-notif]');
      if (!item) return;
      e.preventDefault();
      openNotification(item.dataset.notif);
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Escape' && el.classList.contains('is-open')) { e.stopPropagation(); setOpen(el, false); }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && el.classList.contains('is-open')) {
        const items = [...el.querySelectorAll('.bell-item, .bell__all')];
        const i = items.indexOf(document.activeElement);
        if (i === -1) return;
        e.preventDefault();
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
      }
    });
    bells.add(el);
    update(el);
    if (!subscribed) {
      subscribed = true;
      let queued = false;
      store.subscribe(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; bells.forEach(b => { if (document.contains(b)) update(b); else bells.delete(b); }); });
      });
      document.addEventListener('click', e => { if (openBell && !openBell.contains(e.target)) setOpen(openBell, false, { focus: false }); });
      // Relative times in an open dropdown stay current.
      setInterval(() => { if (openBell) fill(openBell); }, 60000);
    }
    return el;
  }

  // Extra state shown as a red dot, e.g. a class over ratio on the dashboard.
  function setAlert(text) {
    alertText = text || null;
    bells.forEach(update);
  }

  window.NexoraBell = { create, setAlert, relTime, fullTime, styleFor, badgeText };
})();
