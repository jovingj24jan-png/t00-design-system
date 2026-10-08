/* app.html?page=… — every school page goes through one guard:
   unknown page → not-found view; signed out → demo sign-in; no permission → access-denied.html; else the page. */
(() => {
  'use strict';

  const store = window.MontessoriStore;
  const { routes } = store;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const key = new URLSearchParams(location.search).get('page');
  const page = key ? store.pageByKey(key) : null;
  const main = document.getElementById('content');

  if (!page) {
    window.MontessoriShell.mount();
    window.MontessoriNotFound.render(main);
    return;
  }

  if (!store.session.isSignedIn()) {
    window.MontessoriShell.mount();
    renderSignIn();
    return;
  }

  const user = store.currentUser();
  if (!store.canAccess(user, key)) {
    // replace() so Back does not bounce the user into the same redirect again.
    location.replace(routes.denied(key));
    return;
  }

  window.MontessoriShell.mount();
  document.title = `${page.name} · Montessori`;
  main.classList.add('record-page');
  if (key === 'notifications') renderNotifications(); else renderPage();

  function renderPage() {
    main.innerHTML = `
      <article class="panel record" aria-labelledby="page-title">
        <header class="panel__head">
          <span class="panel__num">${esc(page.name.slice(0, 2).toUpperCase())}<i class="marker" aria-hidden="true"></i></span>
          <div><h1 class="panel__title" id="page-title">${esc(page.name)}</h1><p class="panel__sub">${esc(page.summary)}</p></div>
          <span class="tech-label">Page / ${esc(page.name)}</span>
        </header>
        <dl class="token-sheet">
          <div><dt>Signed in as</dt><dd>${esc(user.name)} · ${esc(user.role)}</dd></div>
          <div><dt>Who can open</dt><dd>${page.roles.map(esc).join(', ')}</dd></div>
        </dl>
        <div class="well"><span class="tech-label">Prototype page</span><p class="ts-small" style="margin-top:var(--space-2)">This page exists to demonstrate role permissions. Its content is not built yet.</p></div>
        <div class="nf__actions"><a class="btn btn--primary" href="${routes.dashboard}">Back to dashboard</a><a class="btn btn--secondary" href="${routes.page('notifications')}">Notifications</a></div>
      </article>`;
  }

  function renderNotifications() {
    const list = store.notificationsFor(user.role);
    const unread = list.filter(n => !n.read).length;
    const time = iso => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    main.innerHTML = `
      <article class="panel record" aria-labelledby="page-title">
        <header class="panel__head">
          <span class="panel__num">NO<i class="marker" aria-hidden="true"></i></span>
          <div><h1 class="panel__title" id="page-title">Notifications</h1><p class="panel__sub">For ${esc(user.name)} · ${esc(user.role)}${unread ? ` · ${unread} unread` : ''}</p></div>
          <span class="tech-label">Page / Notifications</span>
        </header>
        ${list.length ? `
          <ul class="notice-list">
            ${list.map(n => `
              <li class="notice${n.read ? '' : ' is-unread'}">
                <span class="avatar avatar--sm avatar--accent" aria-hidden="true"><svg class="icon icon--sm"><use href="#i-shield-lock"/></svg></span>
                <div class="notice__body">
                  <p class="notice__title">${n.read ? '' : '<span class="sr-only">Unread: </span>'}${esc(n.title)}</p>
                  <p class="notice__text">${esc(n.body)}</p>
                  ${n.reason ? `<blockquote class="notice__reason">“${esc(n.reason)}”</blockquote>` : '<p class="notice__text">No reason given.</p>'}
                  <p class="notice__meta"><time datetime="${esc(n.createdAt)}">${esc(time(n.createdAt))}</time>${n.read ? '' : ' · <span class="badge badge--primary badge--plain">New</span>'}</p>
                </div>
              </li>`).join('')}
          </ul>
          ${unread ? '<div class="nf__actions"><button class="btn btn--secondary" type="button" data-mark-read>Mark all as read</button></div>' : ''}`
        : `<div class="state-tile__body state-tile__center" style="padding:var(--space-8) 0"><span class="state-icon" aria-hidden="true"><svg class="icon"><use href="#i-bell"/></svg></span><h2 class="card__title">No notifications yet</h2><p class="card__meta">Requests and updates for ${esc(user.role)}s will appear here.</p></div>`}
      </article>`;
    main.querySelector('[data-mark-read]')?.addEventListener('click', () => { store.markAllRead(user.role); location.reload(); });
  }

  function renderSignIn() {
    document.title = `Sign in · Montessori`;
    main.innerHTML = `
      <article class="panel denied" aria-labelledby="signin-title">
        <span class="denied__icon" aria-hidden="true"><svg class="icon"><use href="#i-user"/></svg></span>
        <h1 class="denied__title" id="signin-title">Sign in to open ${esc(page.name)}</h1>
        <p class="denied__text">This is a prototype, so there are no passwords. Choose a demo role to continue.</p>
        <div class="role-pick" role="group" aria-label="Demo roles">
          ${store.roles.map(r => `<button class="btn btn--secondary" type="button" data-sign-in="${esc(r)}">${esc(r)}</button>`).join('')}
        </div>
      </article>`;
    main.querySelectorAll('[data-sign-in]').forEach(b => b.addEventListener('click', () => {
      store.setRole(b.dataset.signIn);
      store.session.set(true);
      location.reload();
    }));
  }
})();
