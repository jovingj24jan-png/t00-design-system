/* Progress Tracker (app.html?page=classroom-tracker[&cls=<class>][&area=<areaId>][&view=grid|child][&child=<id>][&gaps=1])
   Rows = children of a class, columns = the active framework's materials of one area, in sequence. A click moves a cell
   to the next state (saved first, then shown); right-click or long-press opens the details (date, note, observation,
   history). "Ready for next presentation" comes from prerequisites configured in Learning Framework. Phones always use
   the Child view. Every change is a dated event that the child profile's portfolio also shows.
   Test hooks: ?fail=1 (load error), ?ptfail=save (the next save fails once). */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const day = s => (s ? new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
  const dayShort = s => (s ? new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—');
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const ORDER = ['not_introduced', 'presented', 'practising', 'mastered'];

  function render(key, main, user) {
    if (key !== 'classroom-tracker') return false;
    page(main, user);
    return true;
  }

  function page(main, user) {
    const kids = window.NexoraChildren;
    const { routes } = store;
    const params = new URLSearchParams(location.search);
    const toast = (t, x, i = 'info', o) => window.NexoraToast?.show(t, x, i, o);
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const mqPhone = matchMedia('(max-width: 767px)');
    const mqWide = matchMedia('(min-width: 1024px)');
    const me = () => store.currentUser();
    const S = store.PROGRESS_STATES;
    const L = store.PROGRESS_LETTER;
    const FAIL = {
      forbidden: 'You can only update children in your classes. Nothing was changed.',
      missing: 'This material is no longer in the framework. The tracker has been refreshed.',
      stale: 'This was changed by someone else just now. The latest state is shown — try again if needed.',
      storage: 'This couldn’t be saved on this device, so the previous state is kept. Try again.',
      busy: 'Still saving the previous change.'
    };
    const failText = r => r.message || (r.errors && Object.values(r.errors)[0]) || FAIL[r.reason] || FAIL.storage;
    let failOnce = params.get('fail') === '1';
    let failSave = params.get('ptfail') === 'save';
    const scopeClasses = () => store.activeClasses().filter(c => store.classScope(me()).includes(c.name));
    let cls = params.get('cls') || '';
    let area = params.get('area') || '';
    let view = params.get('view') === 'child' ? 'child' : 'grid';
    let childId = params.get('child') || '';
    let gaps = params.get('gaps') === '1';
    let loaded = false;
    let suppressClick = false;
    let pressTimer = null;
    const pending = new Set();
    let tip = null;
    let drawer = null;
    let focusCell = null;

    main.classList.add('kids-page');
    document.title = 'Progress Tracker · Nexora';
    const $ = s => main.querySelector(s);
    const child = id => store.getChildren().find(c => c.id === id) || null;
    const avatar = (c, cls2 = '') => (c?.photo ? `<img class="ob-av ${cls2}" src="${esc(c.photo)}" alt="">` : `<span class="ob-av ob-av--i ${cls2}" aria-hidden="true">${esc(c ? `${c.firstName[0]}${c.lastName?.[0] || ''}` : '?')}</span>`);
    const head = `<header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Progress Tracker</h1><p class="kids-head__sub">Each child’s journey through the Montessori materials, from first presentation to mastery.</p></div></header>`;
    const state = (ic, title, text, action = '', tone = '') => `<div class="kids-empty pt-state"${tone === 'error' ? ' role="alert"' : ''}><span class="state-icon${tone ? ` state-icon--${tone}` : ''}" aria-hidden="true">${icon(ic)}</span><h2 class="kids-empty__title">${title}</h2><p>${text}</p>${action}</div>`;
    const syncUrl = () => { const u = new URL(location.href); [['cls', cls], ['area', area], ['view', view === 'child' ? 'child' : ''], ['child', view === 'child' ? childId : ''], ['gaps', gaps ? '1' : '']].forEach(([k, v]) => (v ? u.searchParams.set(k, v) : u.searchParams.delete(k))); history.replaceState(null, '', u); };
    const effView = () => (mqPhone.matches ? 'child' : view);

    function load() {
      main.innerHTML = `<div class="kids pt" aria-busy="true">${head}<span class="skeleton pt-skel pt-skel--bar" aria-hidden="true"></span><span class="skeleton pt-skel pt-skel--grid" aria-hidden="true"></span><p class="sr-only" role="status">Loading the progress tracker</p></div>`;
      setTimeout(() => {
        if (failOnce) {
          failOnce = false;
          main.innerHTML = `<div class="kids pt">${head}${state('alert-circle', 'We couldn’t load the progress tracker', 'Nothing has changed. Check your connection, then try again.', '<button class="btn btn--primary" type="button" data-retry>Try again</button>', 'error')}</div>`;
          return;
        }
        loaded = true;
        const classes = scopeClasses();
        // Keep a valid class from the URL; otherwise the selected child's class, otherwise the user's first class.
        if (!classes.some(c => c.name === cls)) cls = (child(childId) && classes.some(c => c.name === child(childId).cls) ? child(childId).cls : '') || classes[0]?.name || '';
        draw();
        $('#page-title')?.focus();
      }, 300);
    }

    /* ----------------------------- Data for the current selection */

    function data() {
      const t = store.trackerMaterials(area);
      if (t.area) area = t.area.id;
      const rows = store.getChildren().filter(c => c.cls === cls && ['active', 'starting'].includes(c.status)).sort((a, b) => a.firstName.localeCompare(b.firstName));
      const prog = store.getProgress();
      const events = store.getProgressEvents();
      const st = (cid, mid) => store.progressFor(cid, mid, prog)?.state || 'not_introduced';
      const cols = gaps ? t.materials.filter(m => rows.some(c => st(c.id, m.id) !== 'mastered')) : t.materials;
      return { ...t, rows, prog, events, st, cols };
    }

    function draw() {
      if (!loaded) return;
      const wrap = $('.pt-gridwrap');
      const scroll = wrap ? { x: wrap.scrollLeft, y: wrap.scrollTop } : null;
      const active = document.activeElement;
      const keep = active && main.contains(active) ? { id: active.id, c: active.dataset?.c, m: active.dataset?.m, sel: [...(active.attributes || [])].map(a => a.name).find(n => /^data-(chip|det|mat|toggle)/.test(n)) } : null;
      hideTip();
      const classes = scopeClasses();
      if (!classes.length) { main.innerHTML = `<div class="kids pt">${head}${state('lock', 'No classes to track', 'You aren’t assigned to a class yet. Ask a school leader to add you to one.')}</div>`; return; }
      const d = data();
      if (!d.framework) { main.innerHTML = `<div class="kids pt">${head}${state('layers', 'No learning framework yet', 'The tracker uses the materials of the school’s active learning framework.', store.canAccess(me(), 'framework') ? `<a class="btn btn--primary" href="${routes.page('framework')}">Open Learning Framework</a>` : '')}</div>`; return; }
      const v = effView();
      const counts = { kids: d.rows.length, mats: d.materials.length, intro: 0, mastered: 0 };
      d.rows.forEach(c => d.materials.forEach(m => { const s = d.st(c.id, m.id); if (s === 'not_introduced') counts.intro += 1; if (s === 'mastered') counts.mastered += 1; }));
      const controls = `<div class="pt-controls">
        <div class="field pt-ctl"><label class="field__label" for="pt-cls">Class</label><select class="input" id="pt-cls" data-cls>${classes.map(c => `<option${c.name === cls ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field pt-ctl"><label class="field__label" for="pt-area">Area</label><select class="input" id="pt-area" data-area>${d.areas.map(a => `<option value="${esc(a.id)}"${a.id === area ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
        ${mqPhone.matches ? '' : `<div class="pt-ctl"><span class="field__label" id="pt-view-l">View</span><div class="segmented" role="group" aria-labelledby="pt-view-l">${[['grid', 'Grid', 'grid'], ['child', 'Child', 'user']].map(([k, l, ic]) => `<button type="button" aria-pressed="${v === k}" data-view="${k}">${icon(ic, 'icon--sm')}${l}</button>`).join('')}</div></div>`}
        <label class="pt-ctl pt-switch"><input type="checkbox" role="switch" data-gaps${gaps ? ' checked' : ''}><span class="pt-switch__track" aria-hidden="true"><i></i></span><span>Show only gaps</span></label>
      </div>
      <dl class="wt-strip pt-strip" aria-label="Summary"><div><dt>Children</dt><dd>${counts.kids}</dd></div><div><dt>Materials</dt><dd>${counts.mats}</dd></div><div><dt>Not yet introduced</dt><dd>${counts.intro}</dd></div><div><dt>Mastered</dt><dd>${counts.mastered}</dd></div></dl>
      <p class="pt-legend" aria-label="Key">${ORDER.map(s => `<span><span class="pt-cell pt-cell--${s} pt-cell--key" aria-hidden="true">${L[s]}</span>${S[s]}</span>`).join('')}<span class="pt-legend__hint">${v === 'grid' ? 'Click a cell for the next state · right-click or long-press for details and history' : 'Tap a state to move it on · Details for date, note and history'}</span></p>`;
      let body;
      if (!d.rows.length) body = state('users', `No children in ${esc(cls)}`, 'Children enrolled in this class appear here.');
      else if (!d.materials.length) body = state('shapes', `No materials in ${esc(d.area?.name || 'this area')}`, 'Materials are added to sub-areas in the Learning Framework.', store.canAccess(me(), 'framework') ? `<a class="btn btn--secondary" href="${routes.page('framework')}">Open Learning Framework</a>` : '');
      else body = v === 'grid' ? gridView(d) : childView(d);
      main.innerHTML = `<div class="kids pt">${head}${controls}<p class="sr-only" role="status" aria-live="polite" data-live></p>${body}</div>`;
      const w2 = $('.pt-gridwrap');
      if (w2 && scroll) { w2.scrollLeft = scroll.x; w2.scrollTop = scroll.y; }
      if (keep) {
        const el = (keep.c && keep.m && main.querySelector(`.pt-cell[data-c="${CSS.escape(keep.c)}"][data-m="${CSS.escape(keep.m)}"], [data-chip][data-c="${CSS.escape(keep.c)}"][data-m="${CSS.escape(keep.m)}"]`)) || (keep.id && main.querySelector(`#${CSS.escape(keep.id)}`));
        if (el) el.focus({ preventScroll: true });
      }
      if (focusCell) { const el = main.querySelector(`.pt-cell[data-c="${CSS.escape(focusCell.c)}"][data-m="${CSS.escape(focusCell.m)}"]`); if (el) el.focus({ preventScroll: true }); focusCell = null; }
      if (drawer) drawer.refresh();
    }

    function latest(cid, mid, d) { return store.progressHistory(cid, mid, d.events).pop() || null; }
    function cellLabel(c, m, s, ev) { return `${store.childName(c)}, ${m.name}: ${S[s]}${ev ? ` since ${day(ev.date)}` : ''}. Activate for ${S[store.PROGRESS_NEXT[s]]}.`; }

    function gridView(d) {
      const groups = [];
      d.cols.forEach(m => { const g = groups[groups.length - 1]; if (g && g.id === m.subareaId) g.n += 1; else groups.push({ id: m.subareaId, name: m.subarea, n: 1 }); });
      const table = !d.cols.length ? state('check-circle', 'No gaps', `Every child in ${esc(cls)} has mastered every material in ${esc(d.area.name)}.`, '<button class="btn btn--secondary btn--sm" type="button" data-gapsoff>Show all materials</button>')
        : `<div class="pt-gridwrap" tabindex="-1"><table class="pt-grid" aria-label="${esc(cls)} · ${esc(d.area.name)} progress">
          <thead><tr class="pt-grid__groups"><td class="pt-corner"></td>${groups.map(g => `<th scope="colgroup" colspan="${g.n}">${esc(g.name)}</th>`).join('')}</tr>
            <tr><th scope="col" class="pt-corner pt-childh">Child</th>${d.cols.map(m => `<th scope="col" class="pt-mat"><button class="pt-mat__btn" type="button" data-mat="${esc(m.id)}" title="${esc(m.name)} — details"><span class="pt-mat__n">${m.position}</span><span class="pt-mat__name">${esc(m.name)}</span></button></th>`).join('')}</tr></thead>
          <tbody>${d.rows.map((c, ri) => `<tr><th scope="row" class="pt-kid"><span class="pt-kid__in">${avatar(c, 'ob-av--sm')}<span class="pt-kid__name">${esc(store.childName(c))}</span></span></th>${d.cols.map((m, ci) => {
            const s = d.st(c.id, m.id);
            const ev = latest(c.id, m.id, d);
            const busy = pending.has(`${c.id}:${m.id}`);
            return `<td><button class="pt-cell pt-cell--${s}${busy ? ' is-saving' : ''}" type="button" data-c="${esc(c.id)}" data-m="${esc(m.id)}" data-s="${s}" tabindex="${ri === 0 && ci === 0 ? 0 : -1}" aria-label="${esc(cellLabel(c, m, s, ev))}"${busy ? ' aria-busy="true"' : ''}>${L[s]}${ev?.note || ev?.observationId ? '<i class="pt-cell__dot" aria-hidden="true"></i>' : ''}</button></td>`;
          }).join('')}</tr>`).join('')}</tbody></table></div>`;
      return `<div class="pt-body">${table}${readyPanel(d)}</div>`;
    }

    function readyPanel(d) {
      const r = store.readyForNext(d.rows.map(c => c.id), d.materials, d.prog, d.events);
      const leader = store.canEditFramework(me());
      const body = !r.configured ? `<p class="pt-ready__empty">${icon('info', 'icon--sm')}<span>No prerequisites are set up for ${esc(d.area.name)} materials yet, so readiness can’t be worked out. ${leader ? `<a href="${routes.page('framework')}">Add prerequisites in Learning Framework</a>.` : 'A school leader can add them in Learning Framework.'}</span></p>`
        : !r.list.length ? '<p class="pt-ready__empty">No children are ready for a next presentation yet. Mastered prerequisites will appear here.</p>'
        : `<ul class="pt-ready__list">${r.list.map(x => { const c = child(x.childId); return `<li class="pt-ready__item">${avatar(c, 'ob-av--sm')}<div><p class="pt-ready__who">${esc(store.childName(c))}</p><p class="pt-ready__next"><b>${esc(x.materialName)}</b> · ${esc(x.area)}</p><p class="pt-ready__why">After ${esc(x.previousName)} · mastered ${esc(dayShort(x.masteredOn))}${x.observationId ? ` · <a href="${routes.page('observations', { obs: x.observationId })}">evidence</a>` : ''}</p>
          <div class="pt-ready__acts"><button class="btn btn--tertiary btn--sm" type="button" data-gochild="${esc(x.childId)}">View child</button><button class="btn btn--tertiary btn--sm" type="button" data-mat="${esc(x.materialId)}">Material</button></div></div></li>`; }).join('')}</ul>`;
      return `<aside class="panel pt-ready" aria-labelledby="pt-ready-h"><h2 class="cd-h2" id="pt-ready-h">Ready for next presentation</h2><p class="cd-note">${esc(cls)} · ${esc(d.area.name)}. Nothing is recorded until you present the material.</p>${body}</aside>`;
    }

    function childView(d) {
      const pool = store.getChildren().filter(c => store.classScope(me()).includes(c.cls) && ['active', 'starting'].includes(c.status)).sort((a, b) => a.cls.localeCompare(b.cls) || a.firstName.localeCompare(b.firstName));
      if (!d.rows.some(c => c.id === childId)) childId = d.rows[0]?.id || '';
      const c = child(childId);
      const mats = gaps ? d.materials.filter(m => d.st(c.id, m.id) !== 'mastered') : d.materials;
      const cnt = s => d.materials.filter(m => d.st(c.id, m.id) === s).length;
      const groups = [];
      mats.forEach(m => { let g = groups.find(x => x.id === m.subareaId); if (!g) { g = { id: m.subareaId, name: m.subarea, list: [] }; groups.push(g); } g.list.push(m); });
      const ready = store.readyForNext([c.id], d.materials, d.prog, d.events).list.map(x => x.materialId);
      return `<section class="pt-child" aria-labelledby="pt-child-h">
        <div class="pt-child__pick"><div class="field"><label class="field__label" for="pt-childsel">Child</label><input class="input pt-find" type="search" placeholder="Search children" aria-label="Search children" data-childfind><select class="input" id="pt-childsel" data-child>${[...new Set(pool.map(k => k.cls))].map(g => `<optgroup label="${esc(g)}">${pool.filter(k => k.cls === g).map(k => `<option value="${esc(k.id)}"${k.id === c.id ? ' selected' : ''}>${esc(store.childName(k))}</option>`).join('')}</optgroup>`).join('')}</select></div></div>
        <div class="panel pt-child__card">
          <div class="pt-child__head">${avatar(c, 'ob-av--lg')}<div><h2 class="cd-h2" id="pt-child-h">${esc(store.childName(c))}</h2><p class="cd-note">${esc(c.cls)} · ${esc(d.area.name)} · <a href="${routes.record(c.id)}#tab=learning">Portfolio</a></p></div></div>
          <div class="pt-chips">${ORDER.slice(1).map(s => `<span class="pt-sum pt-sum--${s}"><b>${cnt(s)}</b> ${S[s]}</span>`).join('')}<span class="pt-sum"><b>${cnt('not_introduced')}</b> Not introduced</span></div>
          ${!mats.length ? state('check-circle', 'No gaps', `${esc(c.firstName)} has mastered every material in ${esc(d.area.name)}.`, '<button class="btn btn--secondary btn--sm" type="button" data-gapsoff>Show all materials</button>')
            : groups.map(g => `<section class="pt-sub"><h3 class="pt-sub__h">${esc(g.name)}</h3><ul class="pt-mlist">${g.list.map(m => {
              const s = d.st(c.id, m.id);
              const hist = store.progressHistory(c.id, m.id, d.events);
              const ev = hist[hist.length - 1];
              const busy = pending.has(`${c.id}:${m.id}`);
              return `<li class="pt-mrow">
                <div class="pt-mrow__main"><button class="pt-mrow__name" type="button" data-mat="${esc(m.id)}"><span class="pt-mat__n">${m.position}</span>${esc(m.name)}</button>
                  <p class="pt-mrow__meta">${ev ? `${esc(S[s])} · ${esc(day(ev.date))}` : 'Not introduced yet'}${hist.some(e => e.observationId) ? ` · ${icon('eye', 'icon--sm')}<span class="sr-only">has</span> observation` : ''}${ready.includes(m.id) ? ' · <span class="pt-readytag">Ready to present</span>' : ''}</p></div>
                <button class="pt-chip pt-chip--${s}${busy ? ' is-saving' : ''}" type="button" data-chip data-c="${esc(c.id)}" data-m="${esc(m.id)}" data-s="${s}" aria-label="${esc(`${m.name}: ${S[s]}. Activate for ${S[store.PROGRESS_NEXT[s]]}.`)}"${busy ? ' aria-busy="true"' : ''}><span class="pt-chip__l" aria-hidden="true">${L[s]}</span>${S[s]}</button>
                <button class="btn btn--icon-ghost" type="button" data-det data-c="${esc(c.id)}" data-m="${esc(m.id)}" aria-label="Details and history for ${esc(m.name)}">${icon('clock')}</button>
                ${hist.length ? `<details class="pt-hist"><summary>History (${hist.length})</summary><ol>${[...hist].reverse().map(e => `<li><b>${esc(S[e.to])}</b> · ${esc(day(e.date))} · ${esc(e.by)}${e.note ? `<span>${esc(e.note)}</span>` : ''}${e.observationId ? `<a href="${routes.page('observations', { obs: e.observationId })}">Observation</a>` : ''}</li>`).join('')}</ol></details>` : ''}
              </li>`;
            }).join('')}</ul></section>`).join('')}
        </div></section>`;
    }

    /* ----------------------------- Changing state */

    async function cycle(cid, mid, el) {
      const key = `${cid}:${mid}`;
      if (pending.has(key)) { setLive('Still saving the previous change.'); return; }
      const from = store.progressFor(cid, mid)?.state || 'not_introduced';
      const to = store.PROGRESS_NEXT[from];
      pending.add(key);
      el?.classList.add('is-saving');
      el?.setAttribute('aria-busy', 'true');
      setLive(`Saving ${S[to]}…`);
      const r = await store.setProgressState(me(), cid, mid, { from, clientId: `cl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, fail: failSave && !(failSave = false) });
      pending.delete(key);
      if (!r.ok) {
        draw();
        toast('Not saved', `${failText(r)}`, 'alert-circle', { duration: 7000 });
        setLive(`Not saved. ${S[from]} is kept.`);
        return;
      }
      draw();
      const m = store.trackerMaterialInfo(mid);
      setLive(`${store.childName(child(cid))} · ${m?.name}: ${S[r.record.state]}, saved.`);
    }
    const setLive = t => { const l = $('[data-live]'); if (l) l.textContent = t; };

    function detailsDialog(cid, mid) {
      const c = child(cid);
      const m = store.trackerMaterialInfo(mid);
      if (!c || !m) return;
      const can = store.canTrack(me(), cid);
      const rec = store.progressFor(cid, mid);
      const cur = rec?.state || 'not_introduced';
      const hist = store.progressHistory(cid, mid);
      const last = hist[hist.length - 1] || null;
      const obsList = store.listObservations(me(), { childId: cid, status: 'published' });
      const obsOpts = sel => `<option value="">No observation linked</option>${obsList.map(o => `<option value="${esc(o.id)}"${o.id === sel ? ' selected' : ''}>${esc(dayShort(o.publishedAt))} · ${esc(o.authorName)} · ${esc(o.note.slice(0, 60))}${o.note.length > 60 ? '…' : ''}</option>`).join('')}`;
      const d = kids.dialog({
        label: 'Progress Tracker / Details', title: `${store.childName(c)} · ${m.name}`, desc: `${esc(m.area)}${m.subarea ? ` › ${esc(m.subarea)}` : ''} · now <b>${esc(S[cur])}</b>${last ? ` since ${esc(day(last.date))}` : ''}`,
        body: `${can ? `<div class="cls-form">
            ${kids.field('kd-state', 'State', `<select class="input" id="kd-state" name="state">${ORDER.map(s => `<option value="${s}"${s === cur ? ' selected' : ''}>${S[s]}${s === cur ? ' (current)' : ''}</option>`).join('')}</select>`)}
            <p class="wt-banner wt-banner--neutral" data-mode role="status"></p>
            ${kids.field('kd-date', 'Date', `<input class="input" id="kd-date" name="date" type="date" max="${store.today()}" value="${store.today()}">`)}
            ${kids.field('kd-note', 'Note', '<textarea class="input" id="kd-note" name="note" rows="3" maxlength="1000" placeholder="Optional — what you noticed"></textarea>')}
            <div class="field"><label class="field__label" for="kd-observationId">Observation</label>${obsList.length > 6 ? '<input class="input pt-find" type="search" placeholder="Search observations" aria-label="Search observations" data-obsfind>' : ''}<select class="input" id="kd-observationId" name="observationId">${obsOpts('')}</select>
              <p class="field__hint">${obsList.length ? `Published observations of ${esc(c.firstName)}.` : `No published observations of ${esc(c.firstName)} yet — you can save without one.`}</p><p class="field__hint field__hint--error" data-error-for="observationId" hidden></p></div></div>`
          : `<p class="wt-banner wt-banner--neutral">${icon('lock')}<span>View only — you can update children in your own classes.</span></p>`}
          <h3 class="mk-h3">History</h3>${hist.length ? `<ol class="wt-hist">${[...hist].reverse().map(e => `<li><b>${esc(S[e.from])} → ${esc(S[e.to])} · ${esc(day(e.date))}</b><span>${esc(e.by)}${e.note ? ` · ${esc(e.note)}` : ''}${e.observationId ? ` · <a href="${routes.page('observations', { obs: e.observationId })}">observation</a>` : ''}${(e.edits || []).length ? ` · edited ${e.edits.length}×` : ''}</span></li>`).join('')}</ol>` : '<p class="cd-note">No changes yet — this material hasn’t been introduced.</p>'}`,
        submit: can ? 'Save' : 'Close',
        async onSubmit(form) {
          if (!can) return { ok: true };
          const to = form.elements.state.value;
          const input = { date: form.elements.date.value, note: form.elements.note.value, observationId: form.elements.observationId.value };
          let r;
          if (to !== cur) r = await store.setProgressState(me(), cid, mid, { from: cur, to, ...input, fail: failSave && !(failSave = false) });
          else if (last) r = await store.editProgressEvent(me(), last.id, input);
          else return { ok: false, errors: { state: 'Choose a state to record.' } };
          if (!r.ok) return r.errors ? { ok: false, errors: r.errors } : { ok: false, message: `Not saved — the previous state is kept. ${failText(r)}` };
          draw();
          toast(r.unchanged ? 'No changes' : to !== cur ? 'Progress saved' : 'Change updated', `${store.childName(c)} · ${m.name}: ${S[to]}${to !== cur ? ` on ${day(input.date)}` : ''}.`, 'check-circle');
          return { ok: true };
        }
      });
      d.el.classList.add('pt-dialog');
      if (!can) return;
      const f = d.form;
      const mode = () => {
        const same = f.elements.state.value === cur;
        const box = f.querySelector('[data-mode]');
        if (same && last) {
          box.hidden = false;
          box.innerHTML = `${icon('pencil')}<span>Editing the latest change (${esc(S[last.to])}, ${esc(day(last.date))}). The earlier note and date are kept in its history.</span>`;
          f.elements.date.value = last.date; f.elements.note.value = last.note || ''; f.elements.observationId.innerHTML = obsOpts(last.observationId || '');
        } else if (same) { box.hidden = false; box.innerHTML = `${icon('info')}<span>Choose a new state to record a change.</span>`; }
        else { box.hidden = false; box.innerHTML = `${icon('check-circle')}<span>Records ${esc(S[cur])} → ${esc(S[f.elements.state.value])}.</span>`; f.elements.date.value = store.today(); f.elements.note.value = ''; f.elements.observationId.innerHTML = obsOpts(''); }
      };
      f.elements.state.addEventListener('change', mode);
      f.querySelector('[data-obsfind]')?.addEventListener('input', e => { const q = e.target.value.trim().toLowerCase(); [...f.elements.observationId.options].forEach((o, i) => { if (i) o.hidden = Boolean(q) && !o.textContent.toLowerCase().includes(q); }); });
      if (cur !== 'mastered' && !last) f.elements.state.value = store.PROGRESS_NEXT[cur];
      mode();
      f.elements.state.focus();
    }

    function materialDrawer(mid) {
      const opener = document.activeElement;
      drawer?.close(false);
      const el = document.createElement('dialog');
      el.className = 'drawer pt-mdrawer';
      el.setAttribute('aria-labelledby', 'pt-md-title');
      el.innerHTML = `<div class="drawer__panel"><div class="drawer__head"><h2 id="pt-md-title">Material</h2><button class="btn btn--icon-ghost" type="button" aria-label="Close material details" data-close>${icon('x')}</button></div><div class="drawer__body" data-body></div></div>`;
      document.body.appendChild(el);
      const body = el.querySelector('[data-body]');
      const close = (restore = true) => { if (!el.isConnected || el.classList.contains('is-closing')) return; el.classList.add('is-closing'); drawer = null; const done = () => { el.close(); el.remove(); if (restore && opener && document.contains(opener)) opener.focus({ preventScroll: true }); }; reduceMotion.matches ? done() : setTimeout(done, 170); };
      el.addEventListener('cancel', e => { e.preventDefault(); close(); });
      el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-close]')) close(); });
      const NC = '<span class="cp-muted">Not configured</span>';
      drawer = {
        close,
        refresh() {
          const m = store.trackerMaterialInfo(mid);
          if (!m) { body.innerHTML = state('alert-circle', 'Material not found', 'It may have been removed from the framework.'); return; }
          const rows = store.getChildren().filter(c => c.cls === cls && ['active', 'starting'].includes(c.status));
          const by = s => rows.filter(c => (store.progressFor(c.id, m.id)?.state || 'not_introduced') === s).length;
          body.innerHTML = `<div><p class="fw-d-kind">${esc(m.area)}${m.subarea ? ` › ${esc(m.subarea)}` : ''}</p><h3 class="fw-d-h">${esc(m.name)}</h3></div>
            <dl class="token-sheet fw-d-dl">
              <div><dt>Sequence</dt><dd>${m.position ? `Number ${m.position} of ${m.of} in ${esc(m.area)}` : NC}</dd></div>
              <div><dt>Age band</dt><dd>${m.ageBand ? esc(m.ageBand) : NC}</dd></div>
              <div><dt>Purpose</dt><dd>${m.description ? esc(m.description) : NC}</dd></div>
              <div><dt>Prerequisites</dt><dd>${m.prerequisites.length ? m.prerequisites.map(p => `${esc(p.name)}${p.missing ? ' (removed)' : p.hidden ? ' (hidden)' : ''}`).join(', ') : NC}</dd></div>
              <div><dt>Outcomes in this sub-area</dt><dd>${m.linked.length ? m.linked.map(o => `${o.code ? `<b>${esc(o.code)}</b> ` : ''}${esc(o.name)}${o.type === 'milestone' ? ' (milestone)' : ''}`).join('<br>') : NC}</dd></div>
              <div><dt>Inventory</dt><dd>${m.inventory ? `${esc(m.inventory.name)} · ${esc(m.inventory.condition)}` : 'Not in the school’s inventory'}</dd></div>
              <div><dt>Framework</dt><dd>${esc(m.framework.name)} v${esc(m.framework.version)}</dd></div>
            </dl>
            <section><h3 class="mk-h3">${esc(cls)}</h3><div class="pt-chips">${ORDER.map(s => `<span class="pt-sum pt-sum--${s}"><b>${by(s)}</b> ${S[s]}</span>`).join('')}</div></section>
            ${store.canEditFramework(me()) ? `<a class="btn btn--secondary btn--sm" href="${routes.page('framework', { item: m.id })}">${icon('pencil', 'icon--sm')}Edit in Learning Framework</a>` : ''}`;
        }
      };
      drawer.refresh();
      el.showModal();
      el.querySelector('[data-close]').focus();
    }

    /* ----------------------------- Tooltip (hover / keyboard focus) */

    function showTip(el) {
      if (mqPhone.matches || !el) return;
      const c = child(el.dataset.c);
      const m = store.trackerMaterialInfo(el.dataset.m);
      if (!c || !m) return;
      const hist = store.progressHistory(c.id, m.id);
      const s = el.dataset.s;
      if (!tip) { tip = document.createElement('div'); tip.className = 'pt-tip'; tip.id = 'pt-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
      tip.innerHTML = `<p class="pt-tip__h">${esc(store.childName(c))} · ${esc(m.name)}</p><p class="pt-tip__s"><b>${esc(S[s])}</b>${hist.length ? ` · ${esc(day(hist[hist.length - 1].date))}` : ''}</p>${hist.length ? `<ol>${hist.map(e => `<li>${esc(S[e.to])} — ${esc(day(e.date))}</li>`).join('')}</ol>` : '<p class="pt-tip__m">No changes recorded yet.</p>'}`;
      tip.hidden = false;
      const r = el.getBoundingClientRect();
      const tw = tip.offsetWidth;
      const th = tip.offsetHeight;
      let x = r.left + r.width / 2 - tw / 2;
      x = Math.max(8, Math.min(x, innerWidth - tw - 8));
      let y = r.top - th - 8;
      if (y < 8) y = r.bottom + 8;
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
      el.setAttribute('aria-describedby', 'pt-tip');
    }
    function hideTip() { if (tip) tip.hidden = true; main.querySelectorAll('[aria-describedby="pt-tip"]').forEach(x => x.removeAttribute('aria-describedby')); }

    /* ----------------------------- Events */

    main.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('[data-retry]')) { load(); return; }
      const v = t.closest('[data-view]');
      if (v) { view = v.dataset.view; syncUrl(); draw(); main.querySelector(`[data-view="${view}"]`)?.focus(); return; }
      if (t.closest('[data-gapsoff]')) { gaps = false; syncUrl(); draw(); $('[data-gaps]')?.focus(); return; }
      const gc = t.closest('[data-gochild]');
      if (gc) { childId = gc.dataset.gochild; view = 'child'; syncUrl(); draw(); $('#pt-childsel')?.focus(); return; }
      const mat = t.closest('[data-mat]');
      if (mat) { materialDrawer(mat.dataset.mat); return; }
      const det = t.closest('[data-det]');
      if (det) { detailsDialog(det.dataset.c, det.dataset.m); return; }
      const cell = t.closest('.pt-cell[data-c], [data-chip]');
      if (cell) {
        if (suppressClick) { suppressClick = false; return; }
        if (!store.canTrack(me(), cell.dataset.c)) { toast('View only', FAIL.forbidden, 'lock'); return; }
        if (cell.matches('.pt-cell')) focusCell = { c: cell.dataset.c, m: cell.dataset.m };
        cycle(cell.dataset.c, cell.dataset.m, cell);
      }
    });
    // Right-click (or the keyboard context-menu key) opens the details instead of changing the state.
    main.addEventListener('contextmenu', e => {
      const cell = e.target.closest('.pt-cell[data-c], [data-chip]');
      if (!cell) return;
      e.preventDefault();
      clearTimeout(pressTimer);
      if (document.querySelector('dialog.pt-dialog[open]')) return;
      hideTip();
      detailsDialog(cell.dataset.c, cell.dataset.m);
    });
    // Long-press (touch / pen): 550 ms without moving; moving or scrolling cancels it. The click that follows is ignored.
    let pressStart = null;
    main.addEventListener('pointerdown', e => {
      const cell = e.target.closest('.pt-cell[data-c], [data-chip]');
      if (!cell || e.pointerType === 'mouse') return;
      pressStart = { x: e.clientX, y: e.clientY };
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => { suppressClick = true; pressStart = null; if (!document.querySelector('dialog.pt-dialog[open]')) detailsDialog(cell.dataset.c, cell.dataset.m); setTimeout(() => { suppressClick = false; }, 800); }, 550);
    });
    main.addEventListener('pointermove', e => { if (pressStart && Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > 8) { clearTimeout(pressTimer); pressStart = null; } });
    ['pointerup', 'pointercancel'].forEach(n => main.addEventListener(n, () => { clearTimeout(pressTimer); pressStart = null; }));
    main.addEventListener('scroll', () => { clearTimeout(pressTimer); hideTip(); }, true);
    main.addEventListener('mouseover', e => { const cell = e.target.closest('.pt-cell[data-c]'); if (cell) showTip(cell); });
    main.addEventListener('mouseout', e => { if (e.target.closest('.pt-cell[data-c]') && !e.relatedTarget?.closest?.('.pt-cell[data-c]')) hideTip(); });
    main.addEventListener('focusin', e => { const cell = e.target.closest('.pt-cell[data-c]'); if (cell) showTip(cell); else hideTip(); });
    main.addEventListener('focusout', e => { if (!main.contains(e.relatedTarget)) hideTip(); });
    // Grid keys: arrows move between cells (one tab stop for the whole grid); Enter/Space change the state.
    main.addEventListener('keydown', e => {
      const cell = e.target.closest('.pt-cell[data-c]');
      if (!cell) return;
      const dirs = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0], Home: [0, -999], End: [0, 999] };
      if (!dirs[e.key]) { if (e.key === 'Escape') hideTip(); return; }
      e.preventDefault();
      const rows = [...main.querySelectorAll('.pt-grid tbody tr')];
      const r = rows.findIndex(tr => tr.contains(cell));
      const cells = [...rows[r].querySelectorAll('.pt-cell')];
      const ci = cells.indexOf(cell);
      const nr = Math.max(0, Math.min(rows.length - 1, r + dirs[e.key][0]));
      const ncells = [...rows[nr].querySelectorAll('.pt-cell')];
      const nc = Math.max(0, Math.min(ncells.length - 1, ci + dirs[e.key][1]));
      const next = ncells[nc];
      main.querySelectorAll('.pt-cell[tabindex="0"]').forEach(x => x.setAttribute('tabindex', '-1'));
      next.setAttribute('tabindex', '0');
      next.focus();
    });
    main.addEventListener('change', e => {
      const t = e.target;
      if (t.matches('[data-cls]')) { cls = t.value; syncUrl(); draw(); $('#pt-cls')?.focus(); return; }
      if (t.matches('[data-area]')) { area = t.value; syncUrl(); draw(); $('#pt-area')?.focus(); return; }
      if (t.matches('[data-gaps]')) { gaps = t.checked; syncUrl(); draw(); $('[data-gaps]')?.focus(); return; }
      if (t.matches('[data-child]')) {
        childId = t.value;
        const c = child(childId);
        if (c && c.cls !== cls) { cls = c.cls; toast('Class changed', `${store.childName(c)} is in ${c.cls}, so the class is now ${c.cls}.`, 'info'); }
        syncUrl(); draw(); $('#pt-childsel')?.focus();
      }
    });
    main.addEventListener('input', e => {
      if (!e.target.matches('[data-childfind]')) return;
      const q = e.target.value.trim().toLowerCase();
      const sel = $('#pt-childsel');
      sel.querySelectorAll('option').forEach(o => { o.hidden = Boolean(q) && !o.textContent.toLowerCase().includes(q) && !o.selected; });
      sel.querySelectorAll('optgroup').forEach(g => { g.hidden = ![...g.children].some(o => !o.hidden); });
    });

    const relayout = () => { hideTip(); draw(); };
    mqPhone.addEventListener('change', relayout);
    mqWide.addEventListener('change', relayout);
    store.subscribe(({ key }) => { if (loaded && !pending.size && !document.querySelector('dialog.modal[open]') && (!key || /^nexora-(progress|frameworks|framework-active|children|class|observations|demo-role)/.test(key))) draw(); });
    load();
  }

  window.NexoraTracker = { render };
})();
