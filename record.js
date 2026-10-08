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
          <a class="btn btn--primary" href="${routes.dashboard}#tables">All students</a>
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
          <a class="btn btn--primary" href="${routes.dashboard}#tabs">All lesson plans</a>
          <button class="btn btn--secondary" type="button" data-back>Go back</button>
        </div>
      </article>`;
  }

  window.NexoraShell.mount();
  const main = document.getElementById('content');
  const id = new URLSearchParams(location.search).get('id');
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
