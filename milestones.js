/* S27 Developmental Milestones (app.html?page=milestones[&view=child][&child=<id>][&cls=<class>][&area=<areaId>][&ms=<milestoneId>])
   Class table (children × areas, Secure %, review flag), area chart and "Children who may benefit from a review" on one
   side; one child's milestones by area on the other. Every number comes from store.milestoneOverview(), and the review
   flag from store.milestoneFlag(), so all views agree. Phones always use the child view.
   Test hooks: ?fail=1 (load error), ?msfail=save (next save fails once), ?msfail=bulk (2nd child of a bulk save fails). */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const day = s => (s ? new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const when = s => (s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const ST = ['emerging', 'developing', 'secure'];
  const LETTER = { emerging: 'E', developing: 'D', secure: 'S' };

  function render(key, main, user) {
    if (key !== 'milestones') return false;
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
    const me = () => store.currentUser();
    const MS = store.MS_STATUS;
    const FAIL = { forbidden: 'You can assess children in your own classes only. Nothing was changed.', missing: 'This milestone isn’t in the active framework any more.', stale: 'Someone else changed this assessment just now. The latest version is shown — try again.', storage: 'This couldn’t be saved on this device. Your entries are still here — try again.' };
    const failText = r => r.message || (r.errors && Object.values(r.errors)[0]) || FAIL[r.reason] || FAIL.storage;
    let failOnce = params.get('fail') === '1';
    const failNext = { [params.get('msfail') || '']: true };
    const takeFail = k => { const v = Boolean(failNext[k]); failNext[k] = false; return v; };
    const scopeClasses = () => store.activeClasses().filter(c => store.classScope(me()).includes(c.name));
    let view = params.get('view') === 'child' ? 'child' : 'class';
    let cls = params.get('cls') || '';
    let childId = params.get('child') || '';
    let areaF = params.get('area') || '';
    let bandF = '';
    let period = '';
    let q = '';
    let sort = { key: 'name', dir: 1 };
    let loaded = false;
    let drawer = null;
    const openMs = params.get('ms') || '';

    main.classList.add('kids-page');
    document.title = 'Developmental Milestones · Nexora';
    const $ = s => main.querySelector(s);
    const child = id => store.getChildren().find(c => c.id === id) || null;
    const avatar = (c, x = '') => (c?.photo ? `<img class="ob-av ${x}" src="${esc(c.photo)}" alt="">` : `<span class="ob-av ob-av--i ${x}" aria-hidden="true">${esc(c ? `${c.firstName[0]}${c.lastName?.[0] || ''}` : '?')}</span>`);
    const pill = (s, extra = '') => (s ? `<span class="ms-pill ms-pill--${s}"${extra}><span class="ms-pill__l" aria-hidden="true">${LETTER[s]}</span>${MS[s]}</span>` : `<span class="ms-pill ms-pill--none"${extra}>Not assessed</span>`);
    const head = `<header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Developmental Milestones</h1><p class="kids-head__sub">Track developmental progress, review evidence, and identify where additional support may help.</p></div><div class="kids-head__actions" data-headacts></div></header>`;
    const state = (ic, title, text, action = '', tone = '') => `<div class="kids-empty ms-state"${tone === 'error' ? ' role="alert"' : ''}><span class="state-icon${tone ? ` state-icon--${tone}` : ''}" aria-hidden="true">${icon(ic)}</span><h2 class="kids-empty__title">${title}</h2><p>${text}</p>${action}</div>`;
    const syncUrl = () => { const u = new URL(location.href); [['view', view === 'child' ? 'child' : ''], ['child', view === 'child' ? childId : ''], ['cls', cls], ['area', areaF]].forEach(([k, v]) => (v ? u.searchParams.set(k, v) : u.searchParams.delete(k))); u.searchParams.delete('ms'); history.replaceState(null, '', u); };
    const effView = () => (mqPhone.matches ? 'child' : view);
    const periodFrom = () => { if (!period) return ''; if (period === 'year') return store.getSettings(store.school.id).academicYear.start || ''; const d = new Date(); d.setDate(d.getDate() - Number(period)); return d.toISOString().slice(0, 10); };
    const PERIODS = () => [['', 'All dates'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ...(store.getSettings(store.school.id).academicYear.start ? [['year', 'This academic year']] : [])];

    function load() {
      main.innerHTML = `<div class="kids ms" aria-busy="true">${head}${'<span class="skeleton ms-skel"></span>'.repeat(2)}<p class="sr-only" role="status">Loading milestones</p></div>`;
      setTimeout(() => {
        if (failOnce) { failOnce = false; main.innerHTML = `<div class="kids ms">${head}${state('alert-circle', 'We couldn’t load the milestones', 'Nothing has changed. Check your connection, then try again.', '<button class="btn btn--primary" type="button" data-retry>Try again</button>', 'error')}</div>`; return; }
        loaded = true;
        const classes = scopeClasses();
        if (child(childId) && classes.some(c => c.name === child(childId).cls)) cls = child(childId).cls;
        if (!classes.some(c => c.name === cls)) cls = classes[0]?.name || '';
        draw();
        if (openMs && childId) milestoneDrawer(childId, openMs);
        else $('#page-title')?.focus();
      }, 300);
    }

    /* ----------------------------- Shared data for the current selection */

    function ov() {
      const o = store.milestoneOverview(me(), { cls, from: periodFrom() });
      const ms = o.milestones.filter(m => (!areaF || m.areaId === areaF) && (!bandF || m.ageBand === bandF));
      return { ...o, ms };
    }

    function draw() {
      if (!loaded) return;
      const active = document.activeElement;
      const keep = active && main.contains(active) ? { id: active.id, pos: active.selectionStart } : null;
      const classes = scopeClasses();
      if (!classes.length) { main.innerHTML = `<div class="kids ms">${head}${state('lock', 'No classes to assess', 'You aren’t assigned to a class yet. Ask a school leader to add you to one.')}</div>`; return; }
      const o = ov();
      if (!o.framework) { main.innerHTML = `<div class="kids ms">${head}${state('layers', 'No learning framework yet', 'Milestones come from the school’s active learning framework.', store.canAccess(me(), 'framework') ? `<a class="btn btn--primary" href="${routes.page('framework')}">Open Learning Framework</a>` : '')}</div>`; return; }
      const v = effView();
      const bands = [...new Set(o.milestones.map(m => m.ageBand).filter(Boolean))];
      const rows = o.rows;
      const assessedRows = rows.filter(r => r.assessedCount);
      const allSt = rows.flatMap(r => Object.entries(r.assessed).filter(([id]) => o.ms.some(m => m.id === id)).map(([, s]) => s));
      const secure = allSt.filter(s => s === 'secure').length;
      const flagged = rows.filter(r => r.flags.some(f => !areaF || f.areaId === areaF)).length;
      const controls = `<div class="ms-controls">
        ${mqPhone.matches ? '' : `<div class="pt-ctl"><span class="field__label" id="ms-view-l">View</span><div class="segmented" role="group" aria-labelledby="ms-view-l">${[['class', 'By class', 'users'], ['child', 'By child', 'user']].map(([k, l, ic]) => `<button type="button" aria-pressed="${v === k}" data-view="${k}">${icon(ic, 'icon--sm')}${l}</button>`).join('')}</div></div>`}
        <div class="field pt-ctl"><label class="field__label" for="ms-cls">Class</label><select class="input" id="ms-cls" data-f="cls">${classes.map(c => `<option${c.name === cls ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field pt-ctl"><label class="field__label" for="ms-area">Area</label><select class="input" id="ms-area" data-f="area"><option value="">All areas</option>${o.areas.map(a => `<option value="${esc(a.id)}"${a.id === areaF ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
        <div class="field pt-ctl"><label class="field__label" for="ms-band">Age band</label><select class="input" id="ms-band" data-f="band"><option value="">All age bands</option>${bands.map(b => `<option${b === bandF ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></div>
        <div class="field pt-ctl"><label class="field__label" for="ms-period">Assessed</label><select class="input" id="ms-period" data-f="period">${PERIODS().map(([k, l]) => `<option value="${k}"${k === period ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
        <div class="field pt-ctl ms-q"><label class="field__label" for="ms-q">Search</label><div class="input-wrap input-wrap--lead">${icon('search')}<input class="input" id="ms-q" type="search" placeholder="Child or milestone" value="${esc(q)}" data-f="q" autocomplete="off"></div></div>
      </div>
      <dl class="wt-strip pt-strip" aria-label="Summary"><div><dt>Children assessed</dt><dd>${assessedRows.length} <small>of ${rows.length}</small></dd></div><div><dt>Milestones assessed</dt><dd>${allSt.length}</dd></div><div><dt>Secure</dt><dd>${allSt.length ? `${Math.round((secure / allSt.length) * 100)}%` : '—'}</dd></div><div><dt>May benefit from review</dt><dd>${flagged}</dd></div></dl>`;
      let body;
      if (!o.milestones.length) body = state('star', 'No milestones in this framework yet', 'Milestones are added to sub-areas in the Learning Framework.', store.canEditFramework(me()) ? `<a class="btn btn--secondary" href="${routes.page('framework')}">Open Learning Framework</a>` : '');
      else if (!rows.length) body = state('users', `No children in ${esc(cls)}`, 'Children enrolled in this class appear here.');
      else body = v === 'class' ? classView(o) : childView(o);
      main.innerHTML = `<div class="kids ms">${head}${controls}<p class="sr-only" role="status" aria-live="polite" data-live></p>${body}</div>`;
      const acts = $('[data-headacts]');
      acts.innerHTML = `${['Director', 'Super Admin'].includes(me().role) && !mqPhone.matches ? `<button class="btn btn--secondary" type="button" data-rules>${icon('sliders', 'icon--sm')}Review rule</button>` : ''}${rows.some(r => store.canAssess(me(), r.child.id)) ? `<button class="btn btn--primary kids-yellow" type="button" data-bulk>${icon('users', 'icon--sm')}Bulk assess</button>` : ''}`;
      if (keep) { const el = keep.id && main.querySelector(`#${CSS.escape(keep.id)}`); if (el) { el.focus(); if (keep.pos != null && el.setSelectionRange) try { el.setSelectionRange(keep.pos, keep.pos); } catch { /* */ } } }
      if (drawer) drawer.refresh();
    }

    /* ----------------------------- By class */

    function areaCell(r, a) {
      const x = r.areas[a.id];
      const flag = x.flag.state === 'review';
      return `<td class="ms-c-area${areaF === a.id ? ' is-focus' : ''}"><button class="ms-cell" type="button" data-areacell="${esc(a.id)}" data-child="${esc(r.child.id)}" aria-label="${esc(`${store.childName(r.child)}, ${a.name}: ${x.status ? MS[x.status] : 'not assessed'}, ${x.assessed} of ${x.total} milestones assessed${flag ? ', review recommended' : ''}`)}">${pill(x.status)}<span class="ms-cov">${x.assessed}/${x.total}</span>${flag ? '<span class="ms-flagmark" aria-hidden="true">⚑</span>' : x.flag.state === 'insufficient' && x.assessed ? '<span class="ms-insuf" title="Not enough information for the review rule" aria-hidden="true">?</span>' : ''}</button></td>`;
    }

    function classView(o) {
      const ql = q.trim().toLowerCase();
      const areas = areaF ? o.areas.filter(a => a.id === areaF) : o.areas;
      let rows = o.rows.filter(r => !ql || store.childName(r.child).toLowerCase().includes(ql) || o.ms.some(m => m.name.toLowerCase().includes(ql) && r.assessed[m.id]));
      const rank = s => (s ? store.MS_RANK[s] : -1);
      const val = r => ({ name: store.childName(r.child), secure: r.securePct ?? -1, flag: r.flags.length, area: areaF ? rank(r.areas[areaF].status) : r.assessedCount }[sort.key]);
      rows = rows.slice().sort((a, b) => { const x = val(a); const y = val(b); return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sort.dir; });
      const th = (k, l, cls2 = '') => `<th scope="col" class="${cls2}" aria-sort="${sort.key === k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button class="ms-sort" type="button" data-sort="${k}">${l}${sort.key === k ? icon(sort.dir > 0 ? 'arrow-up' : 'arrow-down', 'icon--sm') : ''}</button></th>`;
      const table = !rows.length ? state('search', 'No children match', 'Try another search.', '<button class="btn btn--secondary btn--sm" type="button" data-clearq>Clear search</button>')
        : `<div class="ms-tablewrap"><table class="ms-table"><caption class="sr-only">${esc(cls)} milestones by area. Each area shows the overall status and how many milestones are assessed.</caption>
          <thead><tr>${th('name', 'Child', 'ms-c-child')}${areas.map(a => `<th scope="col">${areaF ? `<button class="ms-sort" type="button" data-sort="area">${esc(a.name)}${sort.key === 'area' ? icon(sort.dir > 0 ? 'arrow-up' : 'arrow-down', 'icon--sm') : ''}</button>` : esc(a.name)}</th>`).join('')}${th('secure', 'Secure', 'ms-c-num')}${th('flag', 'Flag', 'ms-c-flag')}</tr></thead>
          <tbody>${rows.map(r => `<tr><th scope="row" class="ms-c-child"><button class="ms-kid" type="button" data-openchild="${esc(r.child.id)}">${avatar(r.child, 'ob-av--sm')}<span><b>${esc(store.childName(r.child))}</b><small>${r.lastDate ? `Last assessed ${esc(day(r.lastDate))}` : 'No assessments yet'}</small></span></button></th>
            ${areas.map(a => areaCell(r, a)).join('')}
            <td class="ms-c-num"><button class="ms-pct" type="button" data-pct="${esc(r.child.id)}" aria-label="${esc(`${store.childName(r.child)}: ${r.securePct == null ? 'not assessed' : `${r.securePct}% secure, ${r.secureCount} of ${r.assessedCount} assessed milestones`}`)}">${r.securePct == null ? '—' : `${r.securePct}%`}</button></td>
            <td class="ms-c-flag">${r.flags.length ? `<button class="ms-flag" type="button" data-flag="${esc(r.child.id)}" data-flagarea="${esc(r.flags[0].areaId)}" aria-label="${esc(`Review recommended for ${store.childName(r.child)}: ${r.flags.map(f => f.area).join(', ')}`)}">⚑<span>${r.flags.length}</span></button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
      return `<div class="ms-cls">${table}<div class="ms-side">${chart(o)}${reviewList(o)}</div></div>`;
    }

    function chart(o) {
      const data = o.areas.map(a => {
        const ms = o.ms.filter(m => m.areaId === a.id);
        const st = o.rows.flatMap(r => ms.filter(m => r.assessed[m.id]).map(m => r.assessed[m.id]));
        const possible = ms.length * o.rows.length;
        return { a, assessed: st.length, secure: st.filter(s => s === 'secure').length, possible, configured: ms.length };
      });
      const any = data.some(d => d.assessed);
      return `<section class="panel ms-chart" aria-labelledby="ms-chart-h"><h2 class="cd-h2" id="ms-chart-h">Secure by area</h2><p class="cd-note">${esc(cls)} · share of assessed milestones that are Secure. The thin bar is assessment coverage.</p>
        ${!any ? '<p class="pt-ready__empty">No assessments recorded yet. Choose a milestone to begin tracking developmental progress.</p>'
          : `<ul class="ms-bars">${data.map(d => { const pct = d.assessed ? Math.round((d.secure / d.assessed) * 100) : null; const cov = d.possible ? Math.round((d.assessed / d.possible) * 100) : 0; return `<li><button class="ms-bar${areaF === d.a.id ? ' is-picked' : ''}" type="button" data-areabar="${esc(d.a.id)}" aria-pressed="${areaF === d.a.id}" aria-label="${esc(`${d.a.name}: ${pct == null ? 'not assessed' : `${pct}% secure`}, ${d.assessed} of ${d.possible} child milestones assessed, ${d.configured} milestones configured`)}">
              <span class="ms-bar__label">${esc(d.a.name)}</span><span class="ms-bar__val">${pct == null ? '—' : `${pct}%`}</span>
              <span class="ms-bar__track" aria-hidden="true"><i style="--w:${pct || 0}%"></i></span><span class="ms-bar__cov" aria-hidden="true"><i style="--w:${cov}%"></i></span>
              <span class="ms-bar__meta">${d.assessed} of ${d.possible} assessed · ${plural(d.configured, 'milestone')}</span></button></li>`; }).join('')}</ul>`}
      </section>`;
    }

    function reviewList(o) {
      const items = o.rows.flatMap(r => r.flags.filter(f => !areaF || f.areaId === areaF).map(f => ({ r, f })));
      return `<section class="panel ms-review" aria-labelledby="ms-rev-h"><h2 class="cd-h2" id="ms-rev-h">Children who may benefit from a review</h2>
        ${!items.length ? '<p class="pt-ready__empty">No children currently meet the configured review criteria. Continue observing and assessing progress.</p>'
          : `<ul class="pt-ready__list">${items.map(({ r, f }) => `<li class="pt-ready__item">${avatar(r.child, 'ob-av--sm')}<div><p class="pt-ready__who">${esc(store.childName(r.child))} <small class="cp-muted">${esc(r.child.cls)}</small></p><p class="pt-ready__next"><b>${esc(f.area)}</b>${f.ageBand ? ` · current band ${esc(f.ageBand)}` : ''}</p><p class="pt-ready__why">${esc(f.reason)} · coverage ${f.coverage.assessed}/${f.coverage.total}${r.lastDate ? ` · last assessed ${esc(day(r.lastDate))}` : ''}</p>
            <div class="pt-ready__acts"><button class="btn btn--tertiary btn--sm" type="button" data-flag="${esc(r.child.id)}" data-flagarea="${esc(f.areaId)}">Why?</button><button class="btn btn--tertiary btn--sm" type="button" data-openchild="${esc(r.child.id)}" data-openarea="${esc(f.areaId)}">Review evidence</button><button class="btn btn--tertiary btn--sm" type="button" data-plan="${esc(r.child.id)}" data-planarea="${esc(f.areaId)}">Create learning plan</button></div></div></li>`).join('')}</ul>`}
        <p class="cd-note">${icon('info', 'icon--sm')} A prompt for educator review, not a diagnosis. Rule v${o.rules.version}: ${o.rules.minExpected}+ milestones expected by the child’s age assessed, with ${o.rules.minEmerging}+ and ${Math.round(o.rules.emergingShare * 100)}%+ Emerging.</p></section>`;
    }

    /* ----------------------------- By child */

    function childView(o) {
      const pool = store.getChildren().filter(c => store.classScope(me()).includes(c.cls) && ['active', 'starting'].includes(c.status)).sort((a, b) => a.cls.localeCompare(b.cls) || a.firstName.localeCompare(b.firstName));
      if (!o.rows.some(r => r.child.id === childId)) childId = o.rows[0]?.child.id || '';
      const r = o.rows.find(x => x.child.id === childId);
      const c = r.child;
      const can = store.canAssess(me(), c.id);
      const age = store.ageAt(c.dob, store.today());
      const band = store.childAgeBand(store.activeFramework(), c.dob);
      const ql = q.trim().toLowerCase();
      const areas = areaF ? o.areas.filter(a => a.id === areaF) : o.areas;
      const fw = store.activeFramework();
      const evCount = mid => store.milestoneEvidenceFor(me(), c.id, mid).length;
      return `<section class="ms-child" aria-labelledby="ms-child-h">
        <div class="pt-child__pick"><div class="field"><label class="field__label" for="ms-childsel">Child</label><input class="input pt-find" type="search" placeholder="Search children" aria-label="Search children" data-childfind><select class="input" id="ms-childsel" data-childsel>${[...new Set(pool.map(k => k.cls))].map(g => `<optgroup label="${esc(g)}">${pool.filter(k => k.cls === g).map(k => `<option value="${esc(k.id)}"${k.id === c.id ? ' selected' : ''}>${esc(store.childName(k))}</option>`).join('')}</optgroup>`).join('')}</select></div></div>
        <div class="panel ms-child__head">
          <div class="pt-child__head">${avatar(c, 'ob-av--lg')}<div><h2 class="cd-h2" id="ms-child-h">${esc(store.childName(c))}</h2><p class="cd-note">${esc(c.cls)} · ${age ? `${age.years}y ${age.months}m` : 'Date of birth not recorded'}${c.dob ? ` (born ${esc(day(c.dob))})` : ''} · age band ${band ? esc(band) : '<span class="cp-muted">not matched in this framework</span>'} · <a href="${routes.record(c.id)}#tab=learning">Portfolio</a></p></div></div>
          <dl class="ms-facts"><div><dt>Last assessed</dt><dd>${r.lastDate ? esc(day(r.lastDate)) : '—'}</dd></div><div><dt>Coverage</dt><dd>${r.assessedCount} of ${o.milestones.length}</dd></div><div><dt>Secure</dt><dd>${r.securePct == null ? '—' : `${r.securePct}%`}</dd></div><div><dt>Review</dt><dd>${r.flags.length ? `⚑ ${esc(r.flags.map(f => f.area).join(', '))}` : 'No review flag'}</dd></div></dl>
          ${!can ? `<p class="wt-banner wt-banner--neutral">${icon('lock')}<span>View only — you can assess children in your own classes.</span></p>` : ''}
        </div>
        ${areas.map(a => {
          const x = r.areas[a.id];
          const ms = o.ms.filter(m => m.areaId === a.id && (!ql || m.name.toLowerCase().includes(ql) || (m.code || '').toLowerCase().includes(ql)));
          const groups = [...new Set(ms.map(m => m.ageBand || 'No age band'))];
          const flagHtml = x.flag.state === 'review' ? `<div class="ms-flagbox" role="note">${icon('alert-triangle')}<div><p><b>Review recommended:</b> recent assessments suggest ${esc(a.name)} may benefit from additional observation and support.</p><div class="pt-ready__acts"><button class="btn btn--tertiary btn--sm" type="button" data-flag="${esc(c.id)}" data-flagarea="${esc(a.id)}">Why?</button><button class="btn btn--tertiary btn--sm" type="button" data-plan="${esc(c.id)}" data-planarea="${esc(a.id)}">Create learning plan</button></div></div></div>`
            : (x.flag.state === 'insufficient' && x.assessed) || x.flag.state === 'unknown' ? `<p class="ms-insufnote">${icon('info', 'icon--sm')}${esc(x.flag.reason)}</p>` : '';
          return `<details class="panel ms-area" data-areaid="${esc(a.id)}"${mqPhone.matches && areaF !== a.id && !params.get('area') ? '' : ' open'}><summary><span class="ms-area__name">${esc(a.name)}</span>${pill(x.status)}<span class="ms-cov">${x.assessed}/${x.total} assessed</span>${x.flag.state === 'review' ? '<span class="ms-flagmark">⚑<span class="sr-only"> review recommended</span></span>' : ''}</summary>
            ${flagHtml}
            ${!x.total ? '<p class="cd-note">No milestones are configured for this area.</p>' : !ms.length ? '<p class="cd-note">No milestones match the search.</p>' : groups.map(g => `<h3 class="pt-sub__h">${esc(g)}</h3><ul class="ms-mlist">${ms.filter(m => (m.ageBand || 'No age band') === g).map(m => {
              const as = store.assessmentFor(c.id, m.id);
              const st = r.assessed[m.id] || null;
              const n = evCount(m.id);
              return `<li class="ms-mrow"><div class="ms-mrow__main"><button class="pt-mrow__name" type="button" data-ms="${esc(m.id)}">${m.code ? `<span class="pt-mat__n">${esc(m.code)}</span>` : ''}${esc(m.name)}</button>${m.description ? `<p class="ms-desc">${esc(m.description)}</p>` : ''}
                <p class="pt-mrow__meta">Expected ${m.ageBand ? esc(m.ageBand) : 'band not set'} · ${as ? `${esc(day(as.date))} · ${esc(as.assessorName || '—')}${st ? '' : ' (outside the chosen dates)'}` : 'Not assessed'} · <button class="fw-link" type="button" data-ms="${esc(m.id)}" data-msfocus="evidence">${n ? plural(n, 'observation') : 'No evidence linked'}</button></p></div>
                ${pill(st)}${can ? `<button class="btn btn--secondary btn--sm" type="button" data-ms="${esc(m.id)}" data-msfocus="assess">Assess</button>` : ''}</li>`;
            }).join('')}</ul>`).join('')}
          </details>`;
        }).join('')}
        ${fw && !o.milestones.some(m => m.band) ? `<p class="wt-banner wt-banner--neutral">${icon('info')}<span>No milestones have a readable age band (like “3–4 years”), so review flags can’t be worked out.</span></p>` : ''}
      </section>`;
    }

    /* ----------------------------- Milestone drawer */

    function milestoneDrawer(cid, mid, focusPart = '') {
      const opener = document.activeElement;
      drawer?.close(false);
      const el = document.createElement('dialog');
      el.className = 'drawer ms-drawer';
      el.setAttribute('aria-labelledby', 'ms-d-title');
      el.innerHTML = `<div class="drawer__panel"><div class="drawer__head"><h2 id="ms-d-title">Milestone</h2><button class="btn btn--icon-ghost" type="button" aria-label="Close milestone details" data-close>${icon('x')}</button></div><div class="drawer__body" data-body></div></div>`;
      document.body.appendChild(el);
      const body = el.querySelector('[data-body]');
      let busy = false;
      const close = (restore = true) => { if (busy || !el.isConnected || el.classList.contains('is-closing')) return; el.classList.add('is-closing'); drawer = null; const done = () => { el.close(); el.remove(); if (restore && opener && document.contains(opener)) opener.focus({ preventScroll: true }); }; reduceMotion.matches ? done() : setTimeout(done, 170); };
      el.addEventListener('cancel', e => { e.preventDefault(); close(); });
      const NC = '<span class="cp-muted">Not configured</span>';
      let draft = null;
      const refresh = () => {
        const c = child(cid);
        const m = store.milestoneCatalogue().milestones.find(x => x.id === mid);
        if (!c || !m) { body.innerHTML = state('alert-circle', 'Milestone not available', 'It may have been hidden or removed from the framework.'); return; }
        const a = store.assessmentFor(cid, mid);
        const hist = store.assessmentHistory(cid, mid);
        const ev = store.milestoneEvidenceFor(me(), cid, mid);
        const can = store.canAssess(me(), cid);
        const linkable = store.listObservations(me(), { childId: cid, status: 'published' }).filter(o => !ev.some(e => e.id === o.id && e.linked));
        const prog = m.materials.map(x => ({ ...x, state: store.progressFor(cid, x.id)?.state || 'not_introduced' }));
        draft = draft || { status: a?.status || '', date: store.today(), note: a?.note || '' };
        body.innerHTML = `<div><p class="fw-d-kind">${esc(m.area)}${m.subarea ? ` › ${esc(m.subarea)}` : ''} · ${esc(store.childName(c))}</p><h3 class="fw-d-h">${m.code ? `${esc(m.code)} · ` : ''}${esc(m.name)}</h3></div>
          <dl class="token-sheet fw-d-dl">
            <div><dt>Description</dt><dd>${m.description ? esc(m.description) : NC}</dd></div>
            <div><dt>Expected age band</dt><dd>${m.ageBand ? esc(m.ageBand) : NC}</dd></div>
            <div><dt>Current status</dt><dd>${pill(a?.status || null)}${a ? ` <small>${esc(day(a.date))} · ${esc(a.assessorName || '—')}</small>` : ''}</dd></div>
            <div><dt>Materials (sub-area)</dt><dd>${prog.length ? prog.map(x => `${esc(x.name)} <small>(${esc(store.PROGRESS_STATES[x.state])})</small>`).join('<br>') : NC}</dd></div>
            <div><dt>Milestone ID</dt><dd><code class="mk-tag">${esc(m.id)}</code></dd></div>
          </dl>
          ${prog.some(x => x.state === 'mastered') ? `<p class="cd-note">${icon('info', 'icon--sm')} Material mastery in the Progress Tracker is context only — it doesn’t set this milestone.</p>` : ''}
          ${can ? `<form class="ms-assess" data-assess novalidate><fieldset class="an-fs"><legend class="field__label">Assessment</legend><div class="fw-choice">${ST.map(s => `<label><input type="radio" name="status" value="${s}"${draft.status === s ? ' checked' : ''}><span>${pill(s)}</span></label>`).join('')}</div><p class="field__hint field__hint--error" data-err="status" hidden></p></fieldset>
              <div class="cls-form__row"><div class="field"><label class="field__label" for="ms-d-date">Assessment date</label><input class="input" id="ms-d-date" name="date" type="date" max="${store.today()}" value="${esc(draft.date)}"><p class="field__hint field__hint--error" data-err="date" hidden></p></div></div>
              <div class="field"><label class="field__label" for="ms-d-note">Note</label><textarea class="input" id="ms-d-note" name="note" rows="2" maxlength="1000" placeholder="Optional — what you saw">${esc(draft.note)}</textarea></div>
              <p class="field__hint field__hint--error" data-formerr role="alert" hidden></p>
              <div class="fw-d-save"><button class="btn btn--primary btn--sm" type="submit">Save assessment</button><span class="fw-d-status" data-status role="status"></span></div></form>` : `<p class="wt-banner wt-banner--neutral">${icon('lock')}<span>View only — you can assess children in your own classes.</span></p>`}
          <section data-evidence><h3 class="mk-h3">Evidence (${ev.length})</h3>${ev.length ? `<ul class="mk-list">${ev.map(e => `<li><span><a href="${routes.page('observations', { obs: e.id })}">${esc(day(e.date))} · ${esc(e.author)}</a><small>${esc(e.excerpt)}${e.excerpt.length >= 160 ? '…' : ''}${e.tagged ? ' · tagged with this milestone' : ''}</small></span>${e.linked && can ? `<button class="btn btn--tertiary btn--sm" type="button" data-unlink="${esc(e.id)}">Remove link</button>` : ''}</li>`).join('')}</ul>` : '<p class="cd-note">No evidence linked.</p>'}
            ${can && a ? (linkable.length ? `<div class="ms-link"><label class="field__label" for="ms-d-link">Link an existing observation</label><div class="ms-link__row"><select class="input" id="ms-d-link">${linkable.map(o => `<option value="${esc(o.id)}">${esc(day(o.publishedAt))} · ${esc(o.authorName)} · ${esc(o.note.slice(0, 50))}</option>`).join('')}</select><button class="btn btn--secondary btn--sm" type="button" data-link>Link</button></div></div>` : `<p class="cd-note">No other published observations of ${esc(c.firstName)} to link.</p>`) : can ? '<p class="cd-note">Save an assessment first, then link observations to it.</p>' : ''}</section>
          <section><h3 class="mk-h3">History</h3>${hist.length ? `<ol class="wt-hist">${hist.map(h => `<li><b>${h.kind === 'evidence' ? `Evidence ${h.evidenceAdded.length ? 'linked' : 'removed'}` : `${h.from ? esc(MS[h.from]) : 'Not assessed'} → ${esc(MS[h.to])}${h.kind === 'reassessed' ? ' (re-assessed)' : ''}`} · ${esc(day(h.date))}</b><span>${esc(h.by)} · recorded ${esc(when(h.at))}${h.note ? ` · ${esc(h.note)}` : ''}</span></li>`).join('')}</ol>` : '<p class="cd-note">Not assessed yet.</p>'}</section>`;
        const f = body.querySelector('[data-assess]');
        f?.addEventListener('input', () => { draft = { status: f.querySelector('[name=status]:checked')?.value || '', date: f.elements.date.value, note: f.elements.note.value }; });
        f?.addEventListener('change', () => { draft = { status: f.querySelector('[name=status]:checked')?.value || '', date: f.elements.date.value, note: f.elements.note.value }; });
        f?.addEventListener('submit', async e => {
          e.preventDefault();
          if (busy) return;
          f.querySelectorAll('[data-err], [data-formerr]').forEach(h => { h.hidden = true; });
          busy = true;
          const btn = f.querySelector('[type=submit]');
          btn.disabled = true;
          f.querySelector('[data-status]').innerHTML = '<span class="spinner" aria-hidden="true"></span>Saving…';
          const r = await store.saveAssessment(me(), cid, mid, { status: draft.status, date: draft.date, note: draft.note }, { expected: a?.updatedAt || null, fail: takeFail('save') });
          busy = false;
          btn.disabled = false;
          f.querySelector('[data-status]').textContent = '';
          if (!r.ok) {
            if (r.errors) { Object.entries(r.errors).forEach(([k, msg]) => { const h = f.querySelector(`[data-err="${k}"]`); if (h) { h.textContent = msg; h.hidden = false; } }); return; }
            const fe = f.querySelector('[data-formerr]');
            fe.textContent = `Not saved — ${failText(r)}`;
            fe.hidden = false;
            if (r.reason === 'stale') { draft = null; refresh(); }
            return;
          }
          draft = null;
          draw();
          refresh();
          body.querySelector('[data-status]')?.replaceChildren(document.createTextNode(r.unchanged ? 'No changes to save' : 'Saved'));
          toast(r.unchanged ? 'No changes' : 'Assessment saved', `${store.childName(c)} · ${m.name}: ${MS[r.assessment.status]}`, 'check-circle');
        });
        body.querySelector('[data-link]')?.addEventListener('click', async () => {
          const id = body.querySelector('#ms-d-link').value;
          const r = await store.saveAssessment(me(), cid, mid, { evidenceIds: [...(a.evidenceIds || []), id] }, { fail: takeFail('save') });
          if (!r.ok) { toast('Not linked', failText(r), 'alert-circle'); return; }
          draw(); refresh(); toast('Evidence linked', 'The observation itself isn’t changed.', 'check-circle');
          body.querySelector('[data-evidence] h3')?.setAttribute('tabindex', '-1'); body.querySelector('[data-evidence] h3')?.focus();
        });
        body.querySelectorAll('[data-unlink]').forEach(b => b.addEventListener('click', () => {
          const d = kids.dialog({ label: 'Developmental milestones', title: 'Remove this evidence link?', desc: 'The observation stays in Learning Observations and in the portfolio; it just won’t count as evidence for this milestone. The change is recorded in the history.', body: '', submit: 'Remove link',
            async onSubmit() { const r = await store.saveAssessment(me(), cid, mid, { evidenceIds: (a.evidenceIds || []).filter(x => x !== b.dataset.unlink) }, { fail: takeFail('save') }); if (!r.ok) return { ok: false, message: failText(r) }; draw(); refresh(); toast('Link removed', '', 'check-circle'); return { ok: true }; } });
          void d;
        }));
      };
      drawer = { close, refresh };
      el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-close]')) close(); });
      refresh();
      el.showModal();
      const target = focusPart === 'evidence' ? body.querySelector('[data-evidence] h3') : focusPart === 'assess' ? body.querySelector('[name=status]:checked, [name=status]') : null;
      if (target) { if (!target.matches('input')) target.setAttribute('tabindex', '-1'); target.focus(); } else el.querySelector('[data-close]').focus();
    }

    /* ----------------------------- Flag explanation, coverage, learning plan */

    function flagDialog(cid, areaId) {
      const o = store.milestoneOverview(me(), { childIds: [cid], from: periodFrom() });
      const r = o.rows[0];
      const f = r.areas[areaId].flag;
      const d = kids.dialog({
        label: 'Developmental milestones / Review', title: `${store.childName(r.child)} · ${f.area}`,
        desc: f.state === 'review' ? 'Review recommended: recent assessments suggest this area may benefit from additional observation and support. This is a prompt for educator review, not a diagnosis.' : esc(f.reason),
        body: `<dl class="wt-ctx mk-dl"><div><dt>Child’s age</dt><dd>${f.age != null ? `${Math.floor(f.age)}y ${Math.round((f.age % 1) * 12)}m` : '—'}${f.ageBand ? ` · band ${esc(f.ageBand)}` : ''}</dd></div><div><dt>Expected by now</dt><dd>${f.expectedCount ?? 0} milestone${f.expectedCount === 1 ? '' : 's'} whose age band has ended</dd></div><div><dt>Assessed</dt><dd>${f.assessedCount ?? 0} of those · ${f.emergingCount ?? 0} Emerging</dd></div><div><dt>Coverage</dt><dd>${f.coverage ? `${f.coverage.assessed} of ${f.coverage.total} milestones in the area` : '—'}</dd></div><div><dt>Why</dt><dd>${esc(f.reason)}</dd></div><div><dt>Rule</dt><dd>Version ${f.ruleVersion}</dd></div><div><dt>Last assessed</dt><dd>${r.lastDate ? esc(day(r.lastDate)) : '—'}</dd></div></dl>
          ${(f.expected || []).length ? `<h3 class="mk-h3">Milestones expected by now</h3><ul class="mk-list">${f.expected.map(m => `<li><span>${m.code ? `<b>${esc(m.code)}</b> ` : ''}${esc(m.name)}<small>${esc(m.ageBand)}</small></span>${pill(m.status)}</li>`).join('')}</ul>` : ''}`,
        submit: 'Review evidence',
        async onSubmit() { childId = cid; view = 'child'; areaF = areaId; syncUrl(); setTimeout(() => { draw(); main.querySelector(`[data-areaid="${CSS.escape(areaId)}"] summary`)?.focus(); }, 0); return { ok: true }; }
      });
      if (f.state === 'review') d.form.querySelector('.modal__foot').insertAdjacentHTML('afterbegin', `<button class="btn btn--secondary" type="button" data-plan2>Create learning plan</button>`);
      d.form.querySelector('[data-plan2]')?.addEventListener('click', () => { d.close(); setTimeout(() => planDialog(cid, areaId), 200); });
    }

    function pctDialog(cid) {
      const o = store.milestoneOverview(me(), { childIds: [cid], from: periodFrom() });
      const r = o.rows[0];
      const by = s => Object.values(r.assessed).filter(x => x === s).length;
      kids.dialog({ label: 'Developmental milestones', title: `${store.childName(r.child)} · coverage`, desc: 'Secure % = Secure ÷ assessed milestones. Milestones not yet assessed are left out of the percentage.',
        body: `<dl class="wt-ctx mk-dl"><div><dt>Milestones configured</dt><dd>${o.milestones.length}</dd></div><div><dt>Assessed</dt><dd>${r.assessedCount}</dd></div><div><dt>Secure</dt><dd>${by('secure')}</dd></div><div><dt>Developing</dt><dd>${by('developing')}</dd></div><div><dt>Emerging</dt><dd>${by('emerging')}</dd></div><div><dt>Not assessed</dt><dd>${o.milestones.length - r.assessedCount}</dd></div><div><dt>Secure %</dt><dd>${r.securePct == null ? '—' : `${r.securePct}%`}</dd></div></dl>`,
        submit: 'Done', async onSubmit() { return { ok: true }; } }).form.querySelector('[type=submit]').focus();
    }

    // S29 hand-off. Learning plans don't exist in this project, so this shows what would be passed and creates nothing.
    function planDialog(cid, areaId) {
      const lp = store.learningPlans;
      const ctx = lp.context(me(), cid, areaId);
      const existing = lp.forChild(cid, areaId);
      const summary = `${store.childName(child(cid))} (${ctx.cls}) · ${ctx.area}\n${ctx.flag?.reason || ''}\nMilestones: ${ctx.milestones.map(m => `${m.code || ''} ${m.name} — ${MS[m.status]}`).join('; ')}\nEvidence: ${ctx.observationIds.length} observation(s) · coverage ${ctx.coverage.assessed}/${ctx.coverage.total}`;
      const d = kids.dialog({
        label: 'Learning plan (S29)', title: lp.available ? (existing.length ? 'A learning plan already exists' : 'Create learning plan') : 'Learning plans aren’t available yet',
        desc: esc(lp.available ? '' : lp.reason),
        body: `<p class="cd-note">This is what a new plan would start with — nothing has been created:</p><dl class="wt-ctx mk-dl"><div><dt>Child</dt><dd>${esc(store.childName(child(cid)))} · ${esc(ctx.cls)}</dd></div><div><dt>Area</dt><dd>${esc(ctx.area)}</dd></div><div><dt>Why</dt><dd>${esc(ctx.flag?.reason || '—')}</dd></div><div><dt>Milestones</dt><dd>${ctx.milestones.length ? ctx.milestones.map(m => `${esc(m.name)} — ${esc(MS[m.status])}`).join('<br>') : '—'}</dd></div><div><dt>Evidence</dt><dd>${plural(ctx.observationIds.length, 'observation')}</dd></div><div><dt>Coverage</dt><dd>${ctx.coverage.assessed} of ${ctx.coverage.total}</dd></div></dl>`,
        submit: 'Copy summary',
        async onSubmit() { try { await navigator.clipboard.writeText(summary); toast('Summary copied', 'Paste it into your school’s support-plan process.', 'copy'); } catch { toast('Couldn’t copy', 'Select the details above to copy them.', 'info'); } return { ok: true }; }
      });
      void d;
    }

    /* ----------------------------- Bulk assess */

    function bulkDialog() {
      const cat = store.milestoneCatalogue();
      const pool = store.getChildren().filter(c => c.cls === cls && ['active', 'starting'].includes(c.status) && store.canAssess(me(), c.id)).sort((a, b) => a.firstName.localeCompare(b.firstName));
      const clientId = `cl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      const s = { step: 1, msId: '', mq: '', kq: '', sel: new Set(), status: '', date: store.today(), note: '', evidenceId: '', result: null };
      const el = document.createElement('dialog');
      el.className = 'modal ms-bulk';
      el.setAttribute('aria-labelledby', 'ms-b-title');
      el.innerHTML = `<form class="modal__panel" novalidate><span class="modal__grabber" aria-hidden="true"></span><div class="modal__top"><span class="tech-label">Developmental milestones / Bulk assess · ${esc(cls)}</span><button class="btn btn--icon-ghost" type="button" aria-label="Close" data-close>${icon('x')}</button></div><div class="modal__body"><h2 class="modal__title" id="ms-b-title">Bulk assess</h2><ol class="ms-steps" aria-label="Steps">${['Milestone', 'Children', 'Assessment', 'Review'].map((l, i) => `<li data-stepn="${i + 1}">${i + 1}. ${l}</li>`).join('')}</ol><div data-b-body></div><p class="field__hint field__hint--error" data-b-err role="alert" hidden></p></div><div class="modal__foot" data-b-foot></div></form>`;
      document.body.appendChild(el);
      const body = el.querySelector('[data-b-body]');
      const foot = el.querySelector('[data-b-foot]');
      const err = el.querySelector('[data-b-err]');
      let busy = false;
      const close = () => { if (busy || el.classList.contains('is-closing')) return; el.classList.add('is-closing'); const done = () => { el.close(); el.remove(); $('[data-bulk]')?.focus(); }; reduceMotion.matches ? done() : setTimeout(done, 170); };
      const m = () => cat.milestones.find(x => x.id === s.msId);
      const paint = (focusSel) => {
        err.hidden = true;
        el.querySelectorAll('[data-stepn]').forEach(li => { li.toggleAttribute('aria-current', Number(li.dataset.stepn) === s.step); li.classList.toggle('is-done', Number(li.dataset.stepn) < s.step); });
        if (s.result) {
          const R = s.result;
          body.innerHTML = `${state(R.failed.length ? 'alert-triangle' : 'check-circle', R.failed.length ? 'Some assessments weren’t saved' : 'Bulk assessment saved', `${m().name}: ${MS[s.status]}`)}<dl class="wt-strip fw-mstrip"><div><dt>Saved</dt><dd>${R.saved.length}</dd></div><div><dt>Unchanged</dt><dd>${R.unchanged.length}</dd></div><div><dt>Failed</dt><dd>${R.failed.length}</dd></div></dl>${R.failed.length ? `<ul class="mk-list">${R.failed.map(f => `<li><span>${esc(store.childName(child(f.childId)))}<small>${esc(f.message || FAIL[f.reason] || FAIL.storage)}</small></span></li>`).join('')}</ul>` : ''}`;
          foot.innerHTML = `<button class="btn btn--primary" type="button" data-close>Done</button>${R.failed.length ? '<button class="btn btn--secondary" type="button" data-retryb>Retry the failed ones</button>' : ''}`;
          (foot.querySelector('[data-retryb]') || foot.querySelector('button')).focus();
          return;
        }
        if (s.step === 1) {
          const ql = s.mq.trim().toLowerCase();
          const list = cat.milestones.filter(x => !ql || `${x.code} ${x.name} ${x.area}`.toLowerCase().includes(ql));
          body.innerHTML = `<input class="input" type="search" placeholder="Search milestones" aria-label="Search milestones" data-mq value="${esc(s.mq)}"><div class="ob-c-list" role="radiogroup" aria-label="Milestone">${cat.areas.map(a => { const g = list.filter(x => x.areaId === a.id); return g.length ? `<div class="fw-pick__g"><p>${esc(a.name)}</p>${g.map(x => `<label class="fw-pick__opt"><input type="radio" name="ms" value="${esc(x.id)}"${s.msId === x.id ? ' checked' : ''}><span>${x.code ? `<b>${esc(x.code)}</b> ` : ''}${esc(x.name)}${x.ageBand ? ` <small>${esc(x.ageBand)}</small>` : ''}${x.description ? `<small> · ${esc(x.description)}</small>` : ''}</span></label>`).join('')}</div>` : ''; }).join('') || '<p class="cd-note">No milestones match.</p>'}</div>`;
        } else if (s.step === 2) {
          const ql = s.kq.trim().toLowerCase();
          const list = pool.filter(c => !ql || store.childName(c).toLowerCase().includes(ql));
          body.innerHTML = `<p class="cd-note"><b>${esc(m().name)}</b> · ${esc(m().area)}</p><input class="input" type="search" placeholder="Search children" aria-label="Search children" data-kq value="${esc(s.kq)}">
            <div class="ms-bulk__acts"><button class="btn btn--tertiary btn--sm" type="button" data-all>Select all ${list.length ? `(${list.length})` : ''}</button><button class="btn btn--tertiary btn--sm" type="button" data-none>Clear</button><span class="cd-note">${s.sel.size} selected</span></div>
            <div class="ob-c-list">${list.map(c => { const a = store.assessmentFor(c.id, s.msId); return `<label class="fw-pick__opt"><input type="checkbox" value="${esc(c.id)}" data-kid${s.sel.has(c.id) ? ' checked' : ''}><span class="ob-c-kid">${avatar(c, 'ob-av--sm')}${esc(store.childName(c))} <small>${a ? `${esc(MS[a.status])} · ${esc(day(a.date))}` : 'Not assessed'}</small></span></label>`; }).join('') || '<p class="cd-note">No children match.</p>'}</div>`;
        } else if (s.step === 3) {
          const obs = store.listObservations(me(), { status: 'published' }).filter(o => [...s.sel].every(id => o.childIds.includes(id)));
          body.innerHTML = `<fieldset class="an-fs"><legend class="field__label">Status for all ${s.sel.size} selected</legend><div class="fw-choice">${ST.map(x => `<label><input type="radio" name="bstatus" value="${x}"${s.status === x ? ' checked' : ''}><span>${pill(x)}</span></label>`).join('')}</div></fieldset>
            <div class="cls-form__row"><div class="field"><label class="field__label" for="ms-b-date">Assessment date</label><input class="input" id="ms-b-date" type="date" max="${store.today()}" value="${esc(s.date)}" data-bdate></div></div>
            <div class="field"><label class="field__label" for="ms-b-note">Shared note</label><textarea class="input" id="ms-b-note" rows="2" maxlength="1000" data-bnote placeholder="Optional — added to each child’s history; existing notes aren’t replaced">${esc(s.note)}</textarea></div>
            <div class="field"><label class="field__label" for="ms-b-ev">Shared evidence</label><select class="input" id="ms-b-ev" data-bev><option value="">None</option>${obs.map(o => `<option value="${esc(o.id)}"${s.evidenceId === o.id ? ' selected' : ''}>${esc(day(o.publishedAt))} · ${esc(o.authorName)} · ${esc(o.note.slice(0, 50))}</option>`).join('')}</select><p class="field__hint">${obs.length ? 'Only observations that include every selected child.' : 'No published observation includes all the selected children.'}</p></div>`;
        } else {
          const ch = [...s.sel].map(id => ({ id, a: store.assessmentFor(id, s.msId) }));
          const same = ch.filter(x => x.a?.status === s.status && (!s.evidenceId || x.a.evidenceIds.includes(s.evidenceId))).length;
          body.innerHTML = `<div class="wt-banner wt-banner--warn">${icon('alert-triangle')}<p><b>${MS[s.status]}</b> will be applied to <b>all ${s.sel.size} selected children</b> for <b>${esc(m().name)}</b>, dated ${esc(day(s.date))}.</p></div>
            <dl class="wt-strip fw-mstrip"><div><dt>New</dt><dd>${ch.filter(x => !x.a).length}</dd></div><div><dt>Updated</dt><dd>${ch.filter(x => x.a && x.a.status !== s.status).length}</dd></div><div><dt>Already ${esc(MS[s.status])}</dt><dd>${same}</dd></div></dl>
            <ul class="mk-list">${ch.map(x => `<li><span>${esc(store.childName(child(x.id)))}</span><span>${pill(x.a?.status || null)} → ${pill(s.status)}</span></li>`).join('')}</ul>${s.note ? `<p class="cd-note">Shared note: ${esc(s.note)}</p>` : ''}`;
        }
        foot.innerHTML = `${s.step === 4 ? `<button class="btn btn--primary kids-yellow" type="submit">Apply to ${s.sel.size} children</button>` : '<button class="btn btn--primary" type="submit">Next</button>'}${s.step > 1 ? '<button class="btn btn--secondary" type="button" data-back>Back</button>' : ''}<button class="btn btn--tertiary" type="button" data-close>Cancel</button>`;
        const fs = focusSel && body.querySelector(focusSel);
        (fs || body.querySelector('input, select, textarea') || foot.querySelector('[type=submit]'))?.focus();
      };
      const fail = msg => { err.textContent = msg; err.hidden = false; };
      async function apply(ids) {
        busy = true;
        foot.innerHTML = '<span class="cd-note" role="status"><span class="spinner" aria-hidden="true"></span> Saving…</span>';
        const r = await store.bulkAssess(me(), s.msId, ids, { status: s.status, date: s.date, note: s.note, evidenceId: s.evidenceId, clientId, failAt: takeFail('bulk') ? 1 : -1 });
        busy = false;
        if (r.errors) { s.step = 3; paint(); fail(Object.values(r.errors)[0]); return; }
        const prev = s.result;
        s.result = prev ? { saved: [...prev.saved, ...r.saved], unchanged: [...prev.unchanged, ...r.unchanged], failed: r.failed } : r;
        draw();
        paint();
      }
      el.querySelector('form').addEventListener('submit', async e => {
        e.preventDefault();
        if (busy) return;
        if (s.step === 1) { if (!s.msId) return fail('Choose one milestone.'); s.step = 2; }
        else if (s.step === 2) { if (!s.sel.size) return fail('Select at least one child.'); s.step = 3; }
        else if (s.step === 3) { if (!s.status) return fail('Choose Emerging, Developing or Secure.'); if (!s.date || s.date > store.today()) return fail('Choose today or an earlier date.'); s.step = 4; }
        else { await apply([...s.sel]); return; }
        paint();
      });
      el.addEventListener('cancel', e => { e.preventDefault(); close(); });
      el.addEventListener('click', e => {
        const t = e.target;
        if (t === el || t.closest('[data-close]')) { close(); return; }
        if (t.closest('[data-back]')) { s.step -= 1; paint(); return; }
        if (t.closest('[data-all]')) { pool.filter(c => !s.kq || store.childName(c).toLowerCase().includes(s.kq.trim().toLowerCase())).forEach(c => s.sel.add(c.id)); paint('[data-all]'); return; }
        if (t.closest('[data-none]')) { s.sel.clear(); paint('[data-none]'); return; }
        if (t.closest('[data-retryb]')) { apply(s.result.failed.map(f => f.childId)); }
      });
      el.addEventListener('change', e => {
        const t = e.target;
        if (t.name === 'ms') s.msId = t.value;
        if (t.matches('[data-kid]')) { t.checked ? s.sel.add(t.value) : s.sel.delete(t.value); paint(`[data-kid][value="${CSS.escape(t.value)}"]`); }
        if (t.name === 'bstatus') s.status = t.value;
        if (t.matches('[data-bdate]')) s.date = t.value;
        if (t.matches('[data-bev]')) s.evidenceId = t.value;
      });
      el.addEventListener('input', e => {
        const t = e.target;
        if (t.matches('[data-mq]')) { s.mq = t.value; const pos = t.selectionStart; paint('[data-mq]'); body.querySelector('[data-mq]').setSelectionRange(pos, pos); }
        if (t.matches('[data-kq]')) { s.kq = t.value; const pos = t.selectionStart; paint('[data-kq]'); body.querySelector('[data-kq]').setSelectionRange(pos, pos); }
        if (t.matches('[data-bnote]')) s.note = t.value;
      });
      el.showModal();
      paint();
    }

    function rulesDialog() {
      const r = store.getMilestoneRules();
      kids.dialog({
        label: 'Developmental milestones', title: 'Review rule',
        desc: 'For each child and area, milestones “expected by now” are those whose age band has ended by the child’s current age. Review is suggested only when enough of them are assessed and enough are Emerging. Changing the rule recalculates every flag.',
        body: `<div class="cls-form"><div class="cls-form__row">${kids.field('kd-minExpected', 'Milestones expected by now that must be assessed', `<input class="input" id="kd-minExpected" name="minExpected" type="number" min="1" max="10" value="${r.minExpected}">`)}${kids.field('kd-minEmerging', 'At least this many Emerging', `<input class="input" id="kd-minEmerging" name="minEmerging" type="number" min="1" max="10" value="${r.minEmerging}">`)}</div>
          ${kids.field('kd-emergingShare', 'And at least this share Emerging', `<select class="input" id="kd-emergingShare" name="emergingShare">${[0.34, 0.5, 0.67, 0.75, 1].map(x => `<option value="${x}"${Math.abs(x - r.emergingShare) < 0.01 ? ' selected' : ''}>${Math.round(x * 100)}%</option>`).join('')}</select>`)}
          <p class="cd-note">Current rule: version ${r.version}${r.updatedBy ? ` · changed by ${esc(r.updatedBy)} on ${esc(day(r.updatedAt))}` : ' (default)'}.</p></div>`,
        submit: 'Save rule',
        async onSubmit(form) {
          const res = await store.saveMilestoneRules(me(), { minExpected: form.elements.minExpected.value, minEmerging: form.elements.minEmerging.value, emergingShare: form.elements.emergingShare.value });
          if (!res.ok) return res.errors ? { ok: false, errors: res.errors } : { ok: false, message: failText(res) };
          draw();
          toast(res.unchanged ? 'No changes' : 'Review rule saved', res.unchanged ? '' : `Version ${res.rules.version}. Flags have been recalculated.`, 'check-circle');
          return { ok: true };
        }
      });
    }

    /* ----------------------------- Events */

    main.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('[data-retry]')) { load(); return; }
      const v = t.closest('[data-view]');
      if (v) { view = v.dataset.view; syncUrl(); draw(); main.querySelector(`[data-view="${view}"]`)?.focus(); return; }
      if (t.closest('[data-clearq]')) { q = ''; draw(); $('#ms-q')?.focus(); return; }
      if (t.closest('[data-bulk]')) { bulkDialog(); return; }
      if (t.closest('[data-rules]')) { rulesDialog(); return; }
      const sb = t.closest('[data-sort]');
      if (sb) { const k = sb.dataset.sort; sort = sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: k === 'name' ? 1 : -1 }; draw(); main.querySelector(`[data-sort="${k}"]`)?.focus(); return; }
      const bar = t.closest('[data-areabar]');
      if (bar) { areaF = areaF === bar.dataset.areabar ? '' : bar.dataset.areabar; syncUrl(); draw(); main.querySelector(`[data-areabar="${CSS.escape(bar.dataset.areabar)}"]`)?.focus(); return; }
      const fl = t.closest('[data-flag]');
      if (fl) { flagDialog(fl.dataset.flag, fl.dataset.flagarea); return; }
      const pl = t.closest('[data-plan]');
      if (pl) { planDialog(pl.dataset.plan, pl.dataset.planarea); return; }
      const pc = t.closest('[data-pct]');
      if (pc) { pctDialog(pc.dataset.pct); return; }
      const oc = t.closest('[data-openchild]');
      if (oc) { childId = oc.dataset.openchild; view = 'child'; if (oc.dataset.openarea) areaF = oc.dataset.openarea; syncUrl(); draw(); $('#ms-childsel')?.focus(); return; }
      const ac = t.closest('[data-areacell]');
      if (ac) { childId = ac.dataset.child; view = 'child'; areaF = ac.dataset.areacell; syncUrl(); draw(); main.querySelector(`[data-areaid="${CSS.escape(areaF)}"] summary`)?.focus(); return; }
      const ms = t.closest('[data-ms]');
      if (ms) milestoneDrawer(childId, ms.dataset.ms, ms.dataset.msfocus || '');
    });
    main.addEventListener('change', e => {
      const t = e.target;
      const k = t.dataset.f;
      if (k === 'cls') { cls = t.value; childId = ''; }
      else if (k === 'area') areaF = t.value;
      else if (k === 'band') bandF = t.value;
      else if (k === 'period') period = t.value;
      else if (t.matches('[data-childsel]')) { childId = t.value; const c = child(childId); if (c && c.cls !== cls) { cls = c.cls; toast('Class changed', `${store.childName(c)} is in ${c.cls}.`, 'info'); } }
      else return;
      syncUrl();
      draw();
    });
    main.addEventListener('input', e => {
      if (e.target.dataset.f === 'q') { q = e.target.value; draw(); return; }
      if (e.target.matches('[data-childfind]')) {
        const ql = e.target.value.trim().toLowerCase();
        const sel = $('#ms-childsel');
        sel.querySelectorAll('option').forEach(o => { o.hidden = Boolean(ql) && !o.textContent.toLowerCase().includes(ql) && !o.selected; });
        sel.querySelectorAll('optgroup').forEach(g => { g.hidden = ![...g.children].some(o => !o.hidden); });
      }
    });
    mqPhone.addEventListener('change', () => draw());
    store.subscribe(({ key }) => { if (loaded && !document.querySelector('dialog.modal[open]') && (!key || /^nexora-(milestone|frameworks|framework-active|children|class|observations|progress|demo-role|settings)/.test(key))) draw(); });
    load();
  }

  window.NexoraMilestones = { render };
})();
