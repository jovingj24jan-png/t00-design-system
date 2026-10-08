/* "We couldn't find that page" view, shared by 404.html and record.html (unknown record IDs). */
(() => {
  'use strict';

  const { routes, search, session } = window.MontessoriStore;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = t => t.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const ART = `
    <svg class="nf__art" viewBox="0 0 200 160" aria-hidden="true" focusable="false">
      <path class="nf-ln nf-ln--soft" d="M14 146c14-12 26-4 38-14" stroke-dasharray="3 6"/>
      <path class="nf-ln" d="M62 18h50l24 24v92a6 6 0 0 1-6 6H62a6 6 0 0 1-6-6V24a6 6 0 0 1 6-6z"/>
      <path class="nf-ln" d="M112 18v18a6 6 0 0 0 6 6h18"/>
      <path class="nf-ln nf-ln--soft" d="M70 60h40M70 74h48M70 88h18M96 88h12M70 102h30"/>
      <circle class="nf-ln nf-ln--accent" cx="138" cy="110" r="20"/>
      <path class="nf-ln nf-ln--accent" d="m152 125 16 16"/>
      <path class="nf-ln nf-ln--accent" d="M132 104a6 6 0 1 1 8.5 5.4c-1.7.8-2.5 2-2.5 3.6M138 118.5h.01"/>
    </svg>`;

  function markup() {
    return `
      <section class="nf" aria-labelledby="nf-title">
        ${ART}
        <p class="nf__code" aria-hidden="true">404</p>
        <span class="nf__rule" aria-hidden="true"></span>
        <h1 class="nf__title" id="nf-title">We couldn't find that page</h1>
        <p class="nf__text">The link may be broken or the page may have moved.</p>
        <div class="nf__actions">
          <a class="btn btn--primary btn--lg" href="${routes.dashboard}" data-nf-dashboard>Go to dashboard</a>
          <button class="btn btn--secondary btn--lg" type="button" data-nf-back>Go back</button>
        </div>
        <div class="nf__search" role="search">
          <label class="sr-only" for="nf-search">Search students and lesson plans</label>
          <div class="input-wrap input-wrap--lead">
            <svg class="icon" aria-hidden="true"><use href="#i-search"/></svg>
            <input class="input" id="nf-search" type="search" placeholder="Search" autocomplete="off" spellcheck="false"
              role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="nf-results" aria-describedby="nf-search-hint">
          </div>
          <p class="sr-only" id="nf-search-hint">Type a name, class or teacher, then use the arrow keys to pick a result.</p>
          <div class="nf__dropdown" data-nf-dropdown hidden>
            <ul class="nf__results" id="nf-results" role="listbox" aria-label="Matching records"></ul>
            <p class="nf__empty" data-nf-empty hidden><svg class="icon icon--sm" aria-hidden="true"><use href="#i-info"/></svg>No matching results</p>
          </div>
          <p class="sr-only" role="status" data-nf-status></p>
        </div>
        ${session.isSignedIn() ? '' : '<button class="btn btn--tertiary btn--sm nf__proto" type="button" data-session="in">Preview the signed-in layout</button>'}
      </section>`;
  }

  function goBack() {
    const before = location.href;
    if (history.length > 1) {
      history.back();
      // If there was nothing to go back to, we are still here: fall back to the dashboard.
      setTimeout(() => { if (location.href === before) location.href = routes.dashboard; }, 450);
    } else {
      location.href = routes.dashboard;
    }
  }

  function initSearch(root) {
    const input = root.querySelector('#nf-search');
    const dropdown = root.querySelector('[data-nf-dropdown]');
    const list = root.querySelector('#nf-results');
    const empty = root.querySelector('[data-nf-empty]');
    const status = root.querySelector('[data-nf-status]');
    let results = [];
    let active = -1;
    let timer;

    function setActive(i) {
      const items = [...list.children];
      if (!items.length) { active = -1; input.removeAttribute('aria-activedescendant'); return; }
      active = (i + items.length) % items.length;
      items.forEach((li, j) => li.setAttribute('aria-selected', String(j === active)));
      input.setAttribute('aria-activedescendant', items[active].id);
      items[active].scrollIntoView({ block: 'nearest' });
    }

    function open(show) {
      dropdown.hidden = !show;
      input.setAttribute('aria-expanded', String(show && results.length > 0));
      if (!show) { active = -1; input.removeAttribute('aria-activedescendant'); }
    }

    function render() {
      const q = input.value.trim();
      results = q ? search(q) : [];
      active = -1;
      input.removeAttribute('aria-activedescendant');
      if (!q) { list.innerHTML = ''; open(false); status.textContent = ''; return; }
      list.innerHTML = results.map((r, i) => `
        <li class="nf__option" id="nf-opt-${i}" role="option" aria-selected="false" data-href="${esc(routes.record(r.id))}">
          <span class="avatar avatar--sm${r.type === 'lesson' ? ' avatar--neutral' : ''}" aria-hidden="true">${r.type === 'lesson' ? '<svg class="icon icon--sm"><use href="#i-book"/></svg>' : esc(initials(r.title))}</span>
          <span class="nf__option-text"><span class="nf__option-title">${esc(r.title)}</span><span class="nf__option-sub">${esc(r.subtitle)}</span></span>
          <span class="badge badge--plain">${r.type === 'lesson' ? 'Lesson' : 'Student'}</span>
          <svg class="icon icon--sm nf__option-go" aria-hidden="true"><use href="#i-chevron-right"/></svg>
        </li>`).join('');
      empty.hidden = results.length > 0;
      open(true);
      status.textContent = results.length ? `${results.length} matching ${results.length === 1 ? 'result' : 'results'}` : 'No matching results';
    }

    const go = i => { const li = list.children[i]; if (li) location.href = li.dataset.href; };

    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 120); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (dropdown.hidden) render(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (dropdown.hidden) render(); setActive(active - 1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        // Enter opens the results; it only navigates when a result is highlighted.
        if (!dropdown.hidden && active >= 0) go(active);
        else { clearTimeout(timer); render(); }
      } else if (e.key === 'Escape') {
        if (!dropdown.hidden) { e.preventDefault(); open(false); } else input.value = '';
      } else if (e.key === 'Tab') open(false);
    });
    list.addEventListener('mousemove', e => { const li = e.target.closest('[role="option"]'); if (li) setActive([...list.children].indexOf(li)); });
    list.addEventListener('click', e => { const li = e.target.closest('[role="option"]'); if (li) location.href = li.dataset.href; });
    document.addEventListener('pointerdown', e => { if (!root.querySelector('.nf__search').contains(e.target)) open(false); });
  }

  function render(container) {
    container.innerHTML = markup();
    document.title = 'Page not found · Montessori';
    container.querySelector('[data-nf-back]').addEventListener('click', goBack);
    initSearch(container);
  }

  window.MontessoriNotFound = { render };
})();
