/* record.html?id=… — one student or lesson plan from the store, or the not-found view. */
(() => {
  'use strict';

  const { byId, routes } = window.NexoraStore;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STATUS_CLASS = { Present: 'badge--success', Absent: 'badge--error badge--absent', Late: 'badge--warning badge--late', Active: 'badge--success', Pending: 'badge--warning badge--late', Archived: '' };
  const row = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;

  function studentView(s) {
    return `
      <article class="panel record" aria-labelledby="record-title">
        <header class="panel__head">
          <span class="panel__num">${esc(s.id.toUpperCase())}<i class="marker" aria-hidden="true"></i></span>
          <div><h1 class="panel__title" id="record-title">${esc(s.name)}</h1><p class="panel__sub">${esc(s.cls)} · Student record</p></div>
          <span class="tech-label">Record / Student</span>
        </header>
        <dl class="token-sheet">
          ${row('Status', `<span class="badge ${STATUS_CLASS[s.status]}">${esc(s.status)}</span>`)}
          ${row('Class', esc(s.cls))}
          ${row('Attendance', `${s.attendance}%`)}
          ${row('Progress', `${s.progress}%`)}
          ${row('Guardian', esc(s.guardian))}
        </dl>
        <div class="well"><span class="tech-label">Latest observation</span><p class="ts-small" style="margin-top:var(--space-2)">${esc(s.note)}</p></div>
        <div class="nf__actions">
          <a class="btn btn--primary" href="${routes.designSystem}#tables">All students</a>
          <button class="btn btn--secondary" type="button" data-back>Go back</button>
        </div>
      </article>`;
  }

  function lessonView(l) {
    return `
      <article class="panel record" aria-labelledby="record-title">
        <header class="panel__head">
          <span class="panel__num">${esc(l.id.toUpperCase())}<i class="marker" aria-hidden="true"></i></span>
          <div><h1 class="panel__title" id="record-title"${/[஀-௿]/.test(l.title) ? ' lang="ta"' : ''}>${esc(l.title)}</h1><p class="panel__sub">${esc(l.cls)} · Lesson plan</p></div>
          <span class="tech-label">Record / Lesson</span>
        </header>
        <dl class="token-sheet">
          ${row('Status', `<span class="badge ${STATUS_CLASS[l.status]}">${esc(l.status)}</span>`)}
          ${row('Class', esc(l.cls))}
          ${row('Teacher', esc(l.teacher))}
        </dl>
        <div class="nf__actions">
          <a class="btn btn--primary" href="${routes.designSystem}#tabs">All lesson plans</a>
          <button class="btn btn--secondary" type="button" data-back>Go back</button>
        </div>
      </article>`;
  }

  /* S13 child record: identity, guardian, safety alerts, withdrawal and history from the children store. */
  const ALERT_ICON = { allergy: 'allergy', medical: 'medical', custody: 'shield', dietary: 'leaf' };
  const CHILD_BADGE = { active: 'badge--success', starting: 'badge--info', withdrawn: 'badge--error', graduated: '' };
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const day = d => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  function childView(c, user) {
    const s = window.NexoraStore;
    const name = s.childName(c);
    const age = s.ageParts(c.dob);
    const manage = s.canManageChildren(user);
    const canMessage = s.canAccess(user, 'communication') && s.isEntitled('communication');
    return `
      <article class="panel record kid-record" aria-labelledby="record-title">
        <nav class="kids-crumbs" aria-label="Breadcrumb"><a href="${routes.page('children')}">Children</a> / <span aria-current="page">${esc(name)}</span></nav>
        <header class="kid-record__head">
          ${c.photo ? `<img class="kid-photo kid-photo--lg" src="${esc(c.photo)}" alt="" width="88" height="88">` : `<span class="kid-photo kid-photo--initials kid-photo--lg" aria-hidden="true">${esc((c.firstName[0] || '') + (c.lastName[0] || ''))}</span>`}
          <div class="kid-record__id">
            <h1 class="kid-record__name" id="record-title" tabindex="-1">${esc(name)}</h1>
            <p class="kid-record__meta">${esc(c.cls)} · ${age.years}y ${age.months}m · <span class="badge ${CHILD_BADGE[c.status]}">${esc(s.CHILD_STATUSES[c.status])}</span></p>
          </div>
          <div class="kid-record__actions">
            ${canMessage && ['active', 'starting'].includes(c.status) ? `<a class="btn btn--secondary" href="${routes.page('compose', { children: c.id })}">${icon('message', 'icon--sm')}Message family</a>` : ''}
            ${manage ? `<a class="btn btn--primary" href="${routes.page('enrol', { id: c.id })}">${icon('pencil', 'icon--sm')}Edit</a>` : ''}
          </div>
        </header>
        ${c.alerts.length ? `<section class="kid-record__alerts" aria-label="Safety alerts"><ul>${c.alerts.map(a => `<li class="kid-record__alert kid-record__alert--${a.type}">${icon(ALERT_ICON[a.type])}<div><p class="kid-record__alert-type">${esc(s.ALERT_TYPES[a.type])}</p><p>${esc(a.detail)}</p></div></li>`).join('')}</ul></section>` : '<p class="kid-record__noalerts">No safety alerts on record.</p>'}
        <div class="kid-record__grid">
          <section aria-labelledby="kr-child"><h2 class="kid-record__h" id="kr-child">Child</h2><dl class="token-sheet">
            ${row('Date of birth', esc(day(c.dob)))}${row('Age', `${age.years} years, ${age.months} months`)}${row('Class', esc(c.cls))}${row('Start date', esc(day(c.startDate)))}
          </dl></section>
          <section aria-labelledby="kr-guardian"><h2 class="kid-record__h" id="kr-guardian">Primary guardian</h2><dl class="token-sheet">
            ${row('Name', esc(c.guardian.name))}${row('Relation', esc(c.guardian.relation))}${row('Phone', `<a href="tel:${esc(c.guardian.phone.replace(/[^d+]/g, ''))}">${esc(c.guardian.phone)}</a>`)}${row('Email', c.guardian.email ? `<a href="mailto:${esc(c.guardian.email)}">${esc(c.guardian.email)}</a>` : '—')}
          </dl></section>
        </div>
        ${c.withdrawal ? `<div class="well kid-record__withdrawal"><p class="kid-record__h">Withdrawal</p><p>Last day ${esc(day(c.withdrawal.date))} · ${esc(c.withdrawal.reason)} · recorded by ${esc(c.withdrawal.by)}</p></div>` : ''}
        <section aria-labelledby="kr-history"><h2 class="kid-record__h" id="kr-history">History</h2>
          <ol class="kid-record__history">${[...c.history].reverse().map(h => `<li><time datetime="${esc(h.at)}">${esc(new Date(h.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))}</time><span>${esc(h.detail)} · ${esc(h.by)}</span></li>`).join('')}</ol>
        </section>
        <div class="nf__actions">
          <a class="btn btn--secondary" href="${routes.page('children')}">${icon('arrow-left', 'icon--sm')}All children</a>
        </div>
      </article>`;
  }

  window.NexoraShell.mount();
  const main = document.getElementById('content');
  const id = new URLSearchParams(location.search).get('id');
  const store = window.NexoraStore;
  const kid = id ? store.childById(id) : null;
  if (kid) {
    // Child records are private: signed-in staff with access to Children, within their class scope.
    if (!store.session.isSignedIn()) { location.replace(routes.signIn({ next: `record.html${location.search}` })); return; }
    const user = store.currentUser();
    if (!store.canAccess(user, 'children') || !store.classScope(user).includes(kid.cls)) { location.replace(routes.denied('children')); return; }
    main.classList.add('record-page');
    main.innerHTML = childView(kid, user);
    document.title = `${store.childName(kid)} · Nexora`;
    try { const f = JSON.parse(sessionStorage.getItem('nexora-children-flash')); sessionStorage.removeItem('nexora-children-flash'); if (f) window.NexoraToast?.show(f.title, f.text); } catch { /* no toast */ }
    return;
  }
  const record = id ? byId(id) : null;

  if (!record) {
    window.NexoraNotFound.render(main);
    return;
  }
  main.classList.add('record-page');
  main.innerHTML = record.type === 'student' ? studentView(record.data) : lessonView(record.data);
  document.title = `${record.title} · Nexora`;
  main.querySelector('[data-back]').addEventListener('click', () => {
    if (history.length > 1) history.back(); else location.href = routes.dashboard;
  });
})();
