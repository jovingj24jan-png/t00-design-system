/* Lesson Planning & Class Timetable (app.html?page=lessons[&cls=<class>][&week=YYYY-MM-DD][&tab=weekly|themes|timetable|library][&day=mon])
   Reads/writes through the store: weeklyPlan / savePlanEntries / copyLastWeek / submitPlan / reviewPlan / startRevision,
   themesFor / saveTheme, routineBlocks / saveRoutineBlock, getActivities / saveActivity, frameworkOutcomes (S24 adapter).
   Every grid change is saved straight away; if a save fails the grid is redrawn from the saved plan. Test hook: ?fail=1. */
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
  const wideQ = matchMedia('(min-width: 1024px)');
  const coarse = matchMedia('(pointer: coarse)');
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (s, n) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };
  const fmt = (s, o = { day: 'numeric', month: 'short' }) => new Date(`${s}T12:00:00`).toLocaleDateString('en-GB', o);
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const DAY_INDEX = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5 };
  const AREA_KEY = { 'Practical life': 'pl', Sensorial: 'se', Language: 'la', Mathematics: 'ma', Culture: 'cu' };
  const TABS = [['weekly', 'Weekly plan'], ['themes', 'Monthly themes'], ['timetable', 'Timetable'], ['library', 'Activity library']];
  const STATUS_TONE = { draft: 'draft', submitted: 'submitted', approved: 'approved', changes: 'changes' };
  const FAIL = {
    forbidden: 'You can’t change plans for this class.',
    submitted: 'This plan is waiting for review, so it can’t be changed now.',
    approved: 'This plan is approved. Choose “Edit plan” to start a new revision first.',
    missing: 'This record no longer exists. Refresh the page.',
    'no-reviewer': 'No reviewer is set for lesson plans. A school leader can choose one under Reviewer.',
    'self-review': 'The plan’s author can’t review it. Choose a different reviewer.',
    'empty-source': 'Last week has no planned activities to copy.',
    storage: 'This couldn’t be saved on this device. Nothing was changed. Please try again.'
  };

  function render(key, main, user) {
    if (key !== 'lessons') return false;
    page(main, user);
    return true;
  }

  function page(main, user) {
    const today = store.today();
    const scope = store.classScope(user);
    const classes = () => store.getClassRegistry().filter(c => c.status === 'active' && scope.includes(c.name));
    let cls = scope.includes(params.get('cls')) ? params.get('cls') : scope[0] || '';
    let week = store.weekOf(/^\d{4}-\d{2}-\d{2}$/.test(params.get('week') || '') ? params.get('week') : today);
    let tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'weekly';
    let mday = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].includes(params.get('day')) ? params.get('day') : null;
    let month = week.slice(0, 7);
    let libQ = '';
    let libArea = '';
    let libAge = '';
    let ttDay = '';
    let loaded = false;
    let failOnce = params.get('fail') === '1';
    let saveState = '';

    main.classList.add('kids-page');
    document.title = 'Lesson Planning · Nexora';
    const state = (iconName, title, text, action = '', tone = '') => `<div class="kids-empty ls-state"${tone === 'error' ? ' role="alert"' : ''}><span class="state-icon${tone ? ` state-icon--${tone}` : ''}" aria-hidden="true">${icon(iconName)}</span><h2 class="kids-empty__title">${title}</h2><p>${text}</p>${action}</div>`;

    main.innerHTML = `
      <div class="kids ls">
        <header class="kids-head">
          <div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Lesson Planning</h1><p class="kids-head__sub">Plan the week, set monthly themes, keep the timetable and browse the activity library.</p></div>
          <div class="kids-head__actions" data-actions></div>
        </header>
        <section class="panel ls-bar" aria-label="Class and week">
          <div class="field ls-cls"><label class="field__label" for="ls-cls">Class</label><select class="input" id="ls-cls" data-cls ${scope.length ? '' : 'disabled'}>${classes().map(c => `<option${c.name === cls ? ' selected' : ''}>${esc(c.name)}</option>`).join('') || '<option>No classes</option>'}</select></div>
          <div class="ls-week"><span class="field__label">Week</span><div class="ls-week__nav"><button class="btn btn--icon-ghost" type="button" data-week="-1" aria-label="Previous week">${icon('arrow-left')}</button><span class="ls-week__label" data-week-label aria-live="polite"></span><button class="btn btn--icon-ghost" type="button" data-week="1" aria-label="Next week">${icon('arrow-right')}</button><button class="btn btn--tertiary btn--sm" type="button" data-week-now>This week</button></div></div>
          <div class="ls-status" data-status></div>
        </section>
        <div data-banner></div>
        <div class="tabs ls-tabs" role="tablist" aria-label="Lesson planning">${TABS.map(([k, l]) => `<button class="tab" type="button" role="tab" id="ls-tab-${k}" aria-controls="ls-panel" aria-selected="${k === tab}" tabindex="${k === tab ? 0 : -1}" data-tab="${k}">${l}</button>`).join('')}</div>
        <section class="ls-panel" id="ls-panel" role="tabpanel" aria-labelledby="ls-tab-${tab}" tabindex="-1" aria-busy="true" data-panel><span class="skeleton" style="height:360px;border-radius:var(--radius-lg)"></span></section>
      </div>`;
    const $ = s => main.querySelector(s);

    const klass = () => store.classByName(cls);
    const plan = () => store.weeklyPlan(klass().id, week);
    const editable = p => ['draft', 'changes'].includes(p.status) && store.canPlan(user, cls);
    const reviewer = () => store.planReviewer();
    const isReviewer = p => reviewer()?.id === user.id && p.status === 'submitted' && p.submittedById !== user.id;
    const days = () => store.planDays().filter(d => d !== 'sun');
    const dateOf = d => addDays(week, DAY_INDEX[d]);
    const syncUrl = () => {
      const u = new URL(location.href);
      u.searchParams.set('cls', cls);
      week === store.weekOf(today) ? u.searchParams.delete('week') : u.searchParams.set('week', week);
      tab === 'weekly' ? u.searchParams.delete('tab') : u.searchParams.set('tab', tab);
      mday ? u.searchParams.set('day', mday) : u.searchParams.delete('day');
      history.replaceState(null, '', u);
    };
    const areaTag = a => `<span class="ls-area ls-area--${AREA_KEY[a.area] || 'na'}">${esc(a.area)}</span>`;
    const statusChip = s => `<span class="ls-chip ls-chip--${STATUS_TONE[s]}">${icon({ draft: 'pencil', submitted: 'clock', approved: 'check-circle', changes: 'alert-triangle' }[s], 'icon--sm')}${esc(store.PLAN_STATUS[s])}</span>`;

    /* ---------------------------------------------------------------- Header: status, actions, banners */

    function header(p) {
      $('[data-week-label]').textContent = `${fmt(week)} – ${fmt(addDays(week, 4), { day: 'numeric', month: 'short', year: 'numeric' })}`;
      const r = reviewer();
      $('[data-status]').innerHTML = `<span class="field__label">Plan</span><div class="ls-status__row">${statusChip(p.status)}${p.revision ? `<small>Revision ${p.revision}</small>` : ''}<small class="ls-save" data-save aria-live="polite">${esc(saveState)}</small></div>`;
      let actions = '';
      if (isReviewer(p)) actions = `<button class="btn btn--secondary" type="button" data-review="changes">${icon('alert-triangle', 'icon--sm')}Request changes</button><button class="btn btn--primary kids-yellow" type="button" data-review="approved">${icon('check-circle', 'icon--sm')}Approve</button>`;
      else if (editable(p)) actions = `<button class="btn btn--secondary" type="button" data-save-draft>${icon('check', 'icon--sm')}Save draft</button><button class="btn btn--primary kids-yellow" type="button" data-submit ${p.entries.length ? '' : 'disabled'}>${icon('arrow-right', 'icon--sm')}Submit for review</button>`;
      else if (p.status === 'approved' && store.canPlan(user, cls)) actions = `<button class="btn btn--primary kids-yellow" type="button" data-revise>${icon('pencil', 'icon--sm')}Edit plan</button>`;
      if (['Director', 'Admin', 'Super Admin'].includes(user.role)) actions += `<button class="btn btn--tertiary btn--sm" type="button" data-reviewer>Reviewer: ${esc(r ? r.name : 'not set')}</button>`;
      $('[data-actions]').innerHTML = actions;
      const hist = p.id ? store.planHistory(p.id) : [];
      const last = hist[hist.length - 1];
      let banner = '';
      if (!r) banner += `<p class="ls-banner ls-banner--warn" role="alert">${icon('alert-triangle', 'icon--sm')}<span><b>No reviewer is set for lesson plans.</b> Plans can be drafted but not submitted until a school leader chooses a reviewer.</span></p>`;
      if (p.status === 'changes' && last?.comment) banner += `<div class="ls-banner ls-banner--changes" role="note">${icon('message', 'icon--sm')}<div><b>Changes requested by ${esc(last.decidedBy)}</b> · ${esc(new Date(last.decidedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}<p>${esc(last.comment)}</p><small>Edit the plan below, then submit it again.</small></div></div>`;
      if (p.status === 'submitted') banner += `<p class="ls-banner">${icon('clock', 'icon--sm')}<span>Submitted by ${esc(p.submittedBy)} on ${esc(new Date(p.submittedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}. ${isReviewer(p) ? 'Review it and approve or request changes.' : `Waiting for ${esc(r?.name || 'the reviewer')}. The plan is locked until then.`}</span></p>`;
      if (p.status === 'approved') banner += `<p class="ls-banner ls-banner--ok">${icon('check-circle', 'icon--sm')}<span>Approved by ${esc(p.approved?.by || last?.decidedBy || '')}. Editing starts a new revision that needs approval again; the approved version is kept.</span></p>`;
      if (hist.length) banner += `<details class="ls-hist"><summary>Review history (${hist.length})</summary><ol>${hist.map(h => `<li><b>Revision ${h.revision}</b> · submitted by ${esc(h.submittedBy)} ${esc(fmt(h.submittedAt.slice(0, 10)))}${h.decision ? ` · ${h.decision === 'approved' ? 'approved' : 'changes requested'} by ${esc(h.decidedBy)}${h.comment ? ` — “${esc(h.comment)}”` : ''}` : ' · awaiting review'}</li>`).join('')}</ol></details>`;
      $('[data-banner]').innerHTML = banner;
    }

    /* ---------------------------------------------------------------- Weekly plan */

    function entryCard(e, p) {
      const a = store.activityById(e.activityId);
      const can = editable(p);
      const drag = can && !coarse.matches;
      if (!a) return `<li class="ls-card ls-card--flag" data-entry="${esc(e.id)}"><span class="ls-card__title">${icon('alert-triangle', 'icon--sm')}Activity no longer in the library</span>${can ? `<button class="ls-card__x" type="button" data-remove="${esc(e.id)}" aria-label="Remove missing activity">${icon('x', 'icon--sm')}</button>` : ''}</li>`;
      return `<li class="ls-card ls-card--${AREA_KEY[a.area]}${e.flag ? ' ls-card--flag' : ''}" data-entry="${esc(e.id)}"${drag ? ' draggable="true"' : ''}>
        ${drag ? `<span class="ls-card__grip" aria-hidden="true">${icon('more-v', 'icon--sm')}</span>` : ''}
        <button class="ls-card__open" type="button" data-open-entry="${esc(e.id)}" aria-label="${esc(`${a.title}, ${a.area}${a.materials.length ? `, ${a.materials.length} materials` : ''}${e.note ? ', has a note' : ''}${e.flag ? ', needs attention' : ''}. Open details.`)}">
          <span class="ls-card__title">${esc(a.title)}</span>
          <span class="ls-card__meta"><span class="ls-area-dot ls-area--${AREA_KEY[a.area]}" aria-hidden="true"></span>${esc(a.area)}${a.materials.length ? `<span class="ls-mat" title="${esc(a.materials.join(', '))}">${icon('layers', 'icon--sm')}${a.materials.length}</span>` : ''}${e.note ? `<span class="ls-note" title="${esc(e.note)}">${icon('note', 'icon--sm')}</span>` : ''}${e.flag ? `<span class="ls-flag">${icon('alert-triangle', 'icon--sm')}Check</span>` : ''}</span>
        </button>
        ${can ? `<button class="ls-card__x" type="button" data-remove="${esc(e.id)}" aria-label="Remove ${esc(a.title)}">${icon('x', 'icon--sm')}</button>` : ''}
      </li>`;
    }
    function cellHtml(p, d, b) {
      const runs = b.appliesTo.includes(d);
      const list = p.entries.filter(e => e.day === d && e.blockId === b.id).sort((x, y) => x.order - y.order);
      if (!runs) return `<td class="ls-cell is-off"><span class="sr-only">${esc(b.title)} doesn’t run on ${esc(store.DAY_NAMES[d])}</span></td>`;
      return `<td class="ls-cell${dateOf(d) === today ? ' is-today' : ''}" data-drop="${d}|${b.id}"><ul class="ls-cards">${list.map(e => entryCard(e, p)).join('')}</ul>${editable(p) ? `<button class="ls-add" type="button" data-add-slot="${d}|${b.id}" aria-label="Add an activity to ${esc(b.title)} on ${esc(store.DAY_NAMES[d])}">${icon('plus', 'icon--sm')}</button>` : ''}</td>`;
    }
    function weeklyHtml(p) {
      const blocks = store.routineBlocks(klass().id);
      if (!blocks.length) return state('clock', 'No timetable yet', 'Weekly plans are organised by the class timetable. Add routine blocks first.', store.canEditTimetable(user, klass().id) ? `<button class="btn btn--primary kids-yellow" type="button" data-tab="timetable">Set up the timetable</button>` : '');
      const ds = days();
      const orphans = p.entries.filter(e => !blocks.some(b => b.id === e.blockId));
      const tools = `<div class="ls-tools">${editable(p) ? `<button class="btn btn--secondary btn--sm" type="button" data-copy>${icon('copy', 'icon--sm')}Copy last week</button>` : ''}<button class="btn btn--secondary btn--sm ls-lib-btn" type="button" data-lib-sheet>${icon('book', 'icon--sm')}Activity library</button>${!p.entries.length ? '<span class="cp-muted">No activities planned for this week yet.</span>' : `<span class="cp-muted">${plural(p.entries.length, 'activity', 'activities')} planned</span>`}</div>`;
      const mob = mobileQ.matches;
      if (!mday || !ds.includes(mday)) mday = ds.includes(['mon', 'tue', 'wed', 'thu', 'fri', 'sat'][(new Date(`${today}T12:00:00`).getDay() + 6) % 7]) && store.weekOf(today) === week ? ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'][(new Date(`${today}T12:00:00`).getDay() + 6) % 7] : ds[0];
      const shown = mob ? [mday] : ds;
      const dayNav = mob ? `<div class="ls-daynav"><button class="btn btn--icon-ghost" type="button" data-day-step="-1" aria-label="Previous day" ${ds.indexOf(mday) > 0 ? '' : 'disabled'}>${icon('arrow-left')}</button><p class="ls-daynav__label${dateOf(mday) === today ? ' is-today' : ''}"><b>${esc(store.DAY_NAMES[mday])}</b> ${esc(fmt(dateOf(mday)))}${dateOf(mday) === today ? ' · Today' : ''}</p><button class="btn btn--icon-ghost" type="button" data-day-step="1" aria-label="Next day" ${ds.indexOf(mday) < ds.length - 1 ? '' : 'disabled'}>${icon('arrow-right')}</button></div>` : '';
      const table = `<div class="ls-grid-wrap" data-swipe><table class="ls-grid"><caption class="sr-only">Weekly plan for ${esc(cls)}, week of ${esc(fmt(week))}. Rows are timetable blocks, columns are days.</caption>
        <thead><tr><th scope="col" class="ls-grid__block">Routine</th>${shown.map(d => `<th scope="col" class="${dateOf(d) === today ? 'is-today' : ''}">${esc(store.DAY_NAMES[d].slice(0, 3))} <span>${esc(fmt(dateOf(d)))}</span>${dateOf(d) === today ? '<small>Today</small>' : ''}</th>`).join('')}</tr></thead>
        <tbody>${blocks.map(b => `<tr><th scope="row" class="ls-grid__block"><b>${esc(b.title)}</b><small>${esc(b.start)}–${esc(b.end)}</small></th>${shown.map(d => cellHtml(p, d, b)).join('')}</tr>`).join('')}
        ${orphans.length ? `<tr class="ls-orphans"><th scope="row" class="ls-grid__block"><b>Routine removed</b><small>Move or remove these</small></th>${shown.map(d => `<td class="ls-cell"><ul class="ls-cards">${orphans.filter(e => e.day === d).map(e => entryCard(e, p)).join('')}</ul></td>`).join('')}</tr>` : ''}
        </tbody></table></div>`;
      const lib = wideQ.matches ? `<aside class="ls-lib panel" aria-label="Activity library">${libraryHtml(true)}</aside>` : '';
      return `${tools}<div class="ls-weekly${lib ? ' has-lib' : ''}"><div class="ls-weekly__main">${dayNav}${table}</div>${lib}</div>`;
    }

    /* ---------------------------------------------------------------- Library */

    function libraryList() {
      const q = libQ.trim().toLowerCase();
      const age = Number(libAge);
      return store.getActivities().filter(a => a.status === 'active')
        .filter(a => !libArea || a.area === libArea)
        .filter(a => !q || [a.title, a.area, a.objectives, ...a.materials].join(' ').toLowerCase().includes(q))
        .filter(a => { if (!age) return true; const m = String(a.ages).match(/(\d+)\D+(\d+)/); return !m || (age >= Number(m[1]) && age <= Number(m[2])); })
        .sort((a, b) => a.area.localeCompare(b.area) || a.title.localeCompare(b.title));
    }
    function libraryHtml(compact = false) {
      const all = store.getActivities().filter(a => a.status === 'active');
      const list = libraryList();
      const p = plan();
      const drag = editable(p) && !coarse.matches;
      const filters = `<div class="ls-lib__filters"><div class="field"><label class="sr-only" for="ls-q${compact ? 'c' : ''}">Search activities</label><input class="input" id="ls-q${compact ? 'c' : ''}" type="search" placeholder="Search activities or materials" value="${esc(libQ)}" data-lib-q autocomplete="off"></div>
        <div class="ls-lib__row"><div class="field"><label class="sr-only" for="ls-area${compact ? 'c' : ''}">Learning area</label><select class="input" id="ls-area${compact ? 'c' : ''}" data-lib-area><option value="">All areas</option>${store.LEARNING_AREAS.map(a => `<option${a === libArea ? ' selected' : ''}>${esc(a)}</option>`).join('')}</select></div>
        <div class="field"><label class="sr-only" for="ls-age${compact ? 'c' : ''}">Age</label><select class="input" id="ls-age${compact ? 'c' : ''}" data-lib-age><option value="">Any age</option>${[2, 3, 4, 5, 6].map(n => `<option value="${n}"${String(n) === libAge ? ' selected' : ''}>Age ${n}</option>`).join('')}</select></div></div></div>`;
      const items = !all.length ? state('book', 'The library is empty', 'Add activities so they can be planned.', `<button class="btn btn--primary kids-yellow" type="button" data-new-activity>${icon('plus', 'icon--sm')}New activity</button>`)
        : !list.length ? `<p class="cp-muted ls-none">No activities match. Try another word or area.</p>`
        : `<ul class="ls-lib__list${compact ? '' : ' ls-lib__list--grid'}">${list.map(a => `<li class="ls-libcard ls-card--${AREA_KEY[a.area]}"${drag ? ` draggable="true" data-drag-activity="${esc(a.id)}"` : ''}>
            <button class="ls-libcard__open" type="button" data-open-activity="${esc(a.id)}"><span class="ls-card__title">${esc(a.title)}</span><span class="ls-card__meta">${areaTag(a)}${a.ages ? `<span>Ages ${esc(a.ages)}</span>` : ''}${a.materials.length ? `<span class="ls-mat">${icon('layers', 'icon--sm')}${a.materials.length}</span>` : ''}</span></button>
            ${editable(p) ? `<button class="btn btn--icon-ghost btn--sm" type="button" data-quick-add="${esc(a.id)}" aria-label="Add ${esc(a.title)} to the plan">${icon('plus', 'icon--sm')}</button>` : ''}
          </li>`).join('')}</ul>`;
      return `<div class="ls-lib__head"><h2 class="cd-h2">Activity library</h2>${compact ? '' : `<button class="btn btn--secondary btn--sm" type="button" data-new-activity>${icon('plus', 'icon--sm')}New activity</button>`}</div>${filters}${items}${all.some(a => a.demo) ? '<p class="cp-muted ls-demo">Includes demo activities to get started.</p>' : ''}`;
    }

    /* ---------------------------------------------------------------- Themes */

    function themesHtml() {
      const list = store.themesFor(klass().id, month);
      const can = store.canPlan(user, cls);
      const label = new Date(`${month}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      const nav = `<div class="ls-tools"><button class="btn btn--icon-ghost" type="button" data-month="-1" aria-label="Previous month">${icon('arrow-left')}</button><h2 class="cd-h2">${esc(label)}</h2><button class="btn btn--icon-ghost" type="button" data-month="1" aria-label="Next month">${icon('arrow-right')}</button>${can ? `<button class="btn btn--primary kids-yellow btn--sm" type="button" data-new-theme>${icon('plus', 'icon--sm')}Add theme</button>` : ''}</div>`;
      if (!list.length) return nav + state('leaf', 'No themes this month', 'Add a weekly theme with its focus areas, vocabulary and activities.', '');
      return nav + `<ul class="ls-themes">${list.map((t, i) => `<li class="panel ls-theme">
        <header class="ls-theme__head"><span class="ls-theme__wk">Week ${i + 1} · ${esc(fmt(t.start))} – ${esc(fmt(t.end))}</span>${can ? `<button class="btn btn--icon-ghost btn--sm" type="button" data-edit-theme="${esc(t.id)}" aria-label="Edit ${esc(t.name)}">${icon('pencil', 'icon--sm')}</button>` : ''}</header>
        <h3 class="ls-theme__name">${esc(t.name)}</h3>
        ${t.description ? `<p class="ls-theme__desc">${esc(t.description)}</p>` : ''}
        ${t.focusAreas.length ? `<p class="ls-theme__areas">${t.focusAreas.map(a => `<span class="ls-area ls-area--${AREA_KEY[a]}">${esc(a)}</span>`).join('')}</p>` : ''}
        ${t.vocabulary.length ? `<p class="ls-theme__vocab"><b>Vocabulary</b> ${t.vocabulary.map(w => `<span class="chip chip--sm">${esc(w)}</span>`).join('')}</p>` : ''}
        ${t.activityIds.length ? `<p class="ls-theme__acts"><b>Activities</b> ${t.activityIds.map(id => store.activityById(id)).filter(Boolean).map(a => `<button class="btn btn--tertiary btn--sm" type="button" data-open-activity="${esc(a.id)}">${esc(a.title)}</button>`).join('')}</p>` : ''}
        ${t.notes ? `<p class="cp-muted">${esc(t.notes)}</p>` : ''}
      </li>`).join('')}</ul>`;
    }

    /* ---------------------------------------------------------------- Timetable */

    function timetableHtml() {
      const c = klass();
      const blocks = store.routineBlocks(c.id);
      const can = store.canEditTimetable(user, c.id);
      const todayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(`${today}T12:00:00`).getDay()];
      const ds = days();
      const shown = blocks.filter(b => !ttDay || b.appliesTo.includes(ttDay));
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
      const tools = `<div class="ls-tools"><div class="ls-chips" role="group" aria-label="Day">${[['', 'All days'], ...ds.map(d => [d, store.DAY_NAMES[d].slice(0, 3)])].map(([k, l]) => `<button class="chip" type="button" data-tt-day="${k}" aria-pressed="${ttDay === k}">${esc(l)}${k === todayKey ? ' · today' : ''}</button>`).join('')}</div>${can ? `<button class="btn btn--primary kids-yellow btn--sm" type="button" data-new-block>${icon('plus', 'icon--sm')}Add routine block</button>` : ''}</div>`;
      if (!blocks.length) return tools + state('clock', 'No timetable configured', 'Add the blocks of the class day, such as arrival, work cycle and lunch.');
      return tools + `<ol class="ls-tt">${shown.map(b => {
        const isToday = b.appliesTo.includes(todayKey);
        const now = isToday && nowMin >= mins(b.start) && nowMin < mins(b.end);
        const a = b.activityId ? store.activityById(b.activityId) : null;
        return `<li class="ls-tt__block${now ? ' is-now' : ''}"${now ? ' aria-current="time"' : ''}>
          <span class="ls-tt__time"><b>${esc(b.start)}</b>–${esc(b.end)}</span>
          <div class="ls-tt__body"><p class="ls-tt__name">${esc(b.title)}${now ? '<span class="badge badge--success">Now</span>' : ''}</p>
            ${b.description ? `<p class="cp-muted">${esc(b.description)}</p>` : ''}
            <p class="ls-tt__meta">${b.location ? `<span>${icon('door', 'icon--sm')}${esc(b.location)}</span>` : ''}${a ? `<span>${icon('book', 'icon--sm')}${esc(a.title)}</span>` : ''}<span>${esc(b.days?.length ? b.days.map(d => store.DAY_NAMES[d].slice(0, 3)).join(', ') : 'Every school day')}</span></p></div>
          ${can ? `<button class="btn btn--icon-ghost btn--sm" type="button" data-edit-block="${esc(b.id)}" aria-label="Edit ${esc(b.title)}">${icon('pencil', 'icon--sm')}</button>` : ''}
        </li>`;
      }).join('') || '<li class="cp-muted">No blocks on this day.</li>'}</ol>`;
    }

    /* ---------------------------------------------------------------- Paint */

    function paint({ focusPanel = false } = {}) {
      if (!loaded) return;
      const panel = $('[data-panel]');
      panel.removeAttribute('aria-busy');
      main.querySelectorAll('[data-tab]').forEach(b => { if (b.getAttribute('role') !== 'tab') return; const on = b.dataset.tab === tab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
      panel.setAttribute('aria-labelledby', `ls-tab-${tab}`);
      if (!scope.length || !klass()) {
        $('[data-actions]').innerHTML = ''; $('[data-status]').innerHTML = ''; $('[data-banner]').innerHTML = '';
        panel.innerHTML = state('lock', 'No class to plan for', user.role === 'Teacher' ? 'You aren’t assigned to a class yet. Ask the school office.' : 'Add a class first.', '', 'error');
        return;
      }
      const p = plan();
      header(p);
      panel.innerHTML = tab === 'weekly' ? weeklyHtml(p) : tab === 'themes' ? themesHtml() : tab === 'timetable' ? timetableHtml() : `<section class="panel">${libraryHtml(false)}</section>`;
      if (focusPanel) panel.focus();
    }
    function load() {
      loaded = false;
      setTimeout(() => {
        try {
          if (failOnce) { failOnce = false; throw new Error('test failure'); }
          loaded = true;
          if (cls) syncUrl();
          paint();
        } catch {
          $('[data-panel]').removeAttribute('aria-busy');
          $('[data-panel]').innerHTML = state('alert-circle', 'Something went wrong', 'We couldn’t load the plan. Nothing has changed.', `<button class="btn btn--secondary" type="button" data-retry>${icon('refresh', 'icon--sm')}Try again</button>`, 'error');
        }
      }, reduceMotion.matches ? 0 : 300);
    }

    /* ---------------------------------------------------------------- Saving the grid */

    async function saveEntries(entries, message = '') {
      const p = plan();
      saveState = 'Saving…';
      const s = $('[data-save]'); if (s) s.textContent = saveState;
      const res = await store.savePlanEntries(store.currentUser(), { classId: klass().id, weekStart: week, entries });
      if (res.ok) {
        saveState = `Saved ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
        if (message) window.NexoraToast?.show(message, `${cls} · week of ${fmt(week)}`);
      } else {
        saveState = 'Not saved';
        window.NexoraToast?.show('Not saved', (res.errors && Object.values(res.errors)[0]) || FAIL[res.reason] || FAIL.storage, 'info');
      }
      void p;
      paint();
      return res;
    }
    const entriesNow = () => plan().entries.map(e => ({ ...e }));
    function addEntry(activityId, day, blockId) {
      const list = entriesNow();
      if (list.some(e => e.day === day && e.blockId === blockId && e.activityId === activityId)) { window.NexoraToast?.show('Already planned', 'This activity is already in that slot.', 'info'); return; }
      const order = Math.max(-1, ...list.filter(e => e.day === day && e.blockId === blockId).map(e => e.order)) + 1;
      list.push({ activityId, day, blockId, order, note: '' });
      saveEntries(list);
    }
    function moveEntry(entryId, day, blockId, beforeId = null) {
      const list = entriesNow();
      const e = list.find(x => x.id === entryId);
      if (!e) return;
      if (list.some(x => x.id !== entryId && x.day === day && x.blockId === blockId && x.activityId === e.activityId)) { window.NexoraToast?.show('Already planned', 'This activity is already in that slot.', 'info'); paint(); return; }
      e.day = day; e.blockId = blockId; e.flag = null;
      const cell = list.filter(x => x.day === day && x.blockId === blockId && x.id !== entryId).sort((a, b) => a.order - b.order);
      const at = beforeId ? cell.findIndex(x => x.id === beforeId) : -1;
      cell.splice(at < 0 ? cell.length : at, 0, e);
      cell.forEach((x, i) => { x.order = i; });
      saveEntries(list);
    }

    /* ---------------------------------------------------------------- Dialogs */

    const slotFields = (p, preset = {}) => {
      const blocks = store.routineBlocks(klass().id);
      const ds = days();
      return `<div class="cls-form__row">${kids.field('kd-day', 'Day', `<select class="input" id="kd-day" name="day">${ds.map(d => `<option value="${d}"${d === (preset.day || mday || ds[0]) ? ' selected' : ''}>${esc(store.DAY_NAMES[d])} ${esc(fmt(dateOf(d)))}</option>`).join('')}</select>`)}
        ${kids.field('kd-block', 'Routine block', `<select class="input" id="kd-block" name="block">${blocks.map(b => `<option value="${esc(b.id)}" data-days="${esc(b.appliesTo.join(','))}"${b.id === preset.blockId ? ' selected' : ''}>${esc(b.start)} · ${esc(b.title)}</option>`).join('')}</select>`)}</div>`;
    };
    function activityDialog(activityId, { entry = null } = {}) {
      const a = store.activityById(activityId);
      if (!a) { window.NexoraToast?.show('Activity not found', FAIL.missing, 'info'); return; }
      const p = plan();
      const can = editable(p);
      const fw = store.frameworkOutcomes();
      const linked = a.outcomeIds.map(id => fw.lookup(id) || { id, missing: true });
      const themes = store.themesFor(klass().id, month).filter(t => t.activityIds.includes(a.id));
      const d = kids.dialog({
        label: entry ? `${cls} / ${store.DAY_NAMES[entry.day]}` : 'Activity library',
        title: a.title,
        desc: '',
        body: `<div class="ls-detail">
          <p class="ls-card__meta">${areaTag(a)}${a.ages ? `<span>Ages ${esc(a.ages)}</span>` : ''}${a.demo ? '<span class="cp-muted">Demo activity</span>' : ''}</p>
          ${a.objectives ? `<div><h3 class="cd-qv-h">Learning objectives</h3><p>${esc(a.objectives)}</p></div>` : ''}
          <div><h3 class="cd-qv-h">Framework outcomes (S24)</h3>${!fw.available && !linked.length ? '<p class="ls-banner">No learning framework is active yet, so no outcomes can be linked. A school leader can set one up in Learning Framework.</p>' : linked.length ? `<ul class="ls-outcomes">${linked.map(o => o.missing ? `<li class="is-missing">${icon('alert-circle', 'icon--sm')}Outcome ${esc(o.id)} is no longer in the framework</li>` : `<li><b>${esc(o.code || '')}</b> ${esc(o.title || '')}${o.hidden ? ' <small>(hidden in the framework)</small>' : ''}${!o.active ? ` <small>(${esc(o.frameworkName)} — not the active framework)</small>` : ''}</li>`).join('')}</ul>` : '<p class="cp-muted">No outcomes linked yet.</p>'}</div>
          <div><h3 class="cd-qv-h">Materials</h3>${a.materials.length ? `<ul class="ls-mats">${a.materials.map(m => `<li>${icon('layers', 'icon--sm')}${esc(m)}</li>`).join('')}</ul>` : '<p class="cp-muted">No materials listed.</p>'}</div>
          ${a.prep ? `<div><h3 class="cd-qv-h">Preparation</h3><p>${esc(a.prep)}</p></div>` : ''}
          ${a.notes ? `<div><h3 class="cd-qv-h">Teacher notes</h3><p>${esc(a.notes)}</p></div>` : ''}
          ${themes.length ? `<div><h3 class="cd-qv-h">Monthly theme</h3><p>${themes.map(t => esc(t.name)).join(', ')}</p></div>` : ''}
          ${entry && can ? `<div class="ls-detail__plan"><h3 class="cd-qv-h">In this plan</h3>${slotFields(p, entry)}${kids.field('kd-pnote', 'Planning note', `<textarea class="input" id="kd-pnote" name="pnote" rows="2" maxlength="300">${esc(entry.note)}</textarea>`)}</div>` : ''}
          ${!entry && can && tab !== 'library' ? `<div class="ls-detail__plan"><h3 class="cd-qv-h">Add to plan</h3>${slotFields(p)}</div>` : ''}
          ${!entry && can && tab === 'library' ? `<div class="ls-detail__plan"><h3 class="cd-qv-h">Add to this week’s plan</h3>${slotFields(p)}</div>` : ''}
        </div>`,
        submit: entry && can ? 'Save changes' : can ? 'Add to plan' : 'Close',
        async onSubmit(form) {
          if (!can) return { ok: true };
          const day = form.elements.day.value;
          const blockId = form.elements.block.value;
          const opt = form.elements.block.selectedOptions[0];
          if (!opt.dataset.days.split(',').includes(day)) return { ok: false, errors: { block: `${opt.textContent.split(' · ')[1]} doesn’t run on ${store.DAY_NAMES[day]}.` } };
          let list = entriesNow();
          if (entry) {
            const e = list.find(x => x.id === entry.id);
            if (!e) return { ok: false, message: FAIL.missing };
            if ((e.day !== day || e.blockId !== blockId) && list.some(x => x.id !== e.id && x.day === day && x.blockId === blockId && x.activityId === e.activityId)) return { ok: false, errors: { block: 'This activity is already in that slot.' } };
            Object.assign(e, { day, blockId, note: form.elements.pnote.value, flag: null });
          } else {
            if (list.some(x => x.day === day && x.blockId === blockId && x.activityId === a.id)) return { ok: false, errors: { block: 'This activity is already in that slot.' } };
            list.push({ activityId: a.id, day, blockId, order: 99, note: '' });
          }
          const res = await saveEntries(list, entry ? 'Plan updated' : 'Added to plan');
          return res.ok ? res : { ok: false, message: (res.errors && Object.values(res.errors)[0]) || FAIL[res.reason] || FAIL.storage };
        }
      });
      if (entry && can) {
        const foot = d.form.querySelector('.modal__foot');
        foot.insertAdjacentHTML('beforeend', `<button class="btn btn--tertiary is-danger" type="button" data-remove-entry>${icon('trash', 'icon--sm')}Remove from plan</button>`);
        foot.querySelector('[data-remove-entry]').addEventListener('click', async () => { d.close(); await saveEntries(entriesNow().filter(x => x.id !== entry.id), 'Removed from plan'); });
      }
      if (store.canAccess(user, 'lessons')) {
        const foot = d.form.querySelector('.modal__foot');
        foot.insertAdjacentHTML('beforeend', `<button class="btn btn--tertiary" type="button" data-edit-activity>${icon('pencil', 'icon--sm')}Edit activity</button>`);
        foot.querySelector('[data-edit-activity]').addEventListener('click', () => { d.close(); setTimeout(() => activityForm(a), reduceMotion.matches ? 0 : 200); });
      }
    }
    function slotPicker(day, blockId) {
      const list = libraryList();
      const b = store.routineBlocks(klass().id).find(x => x.id === blockId);
      kids.dialog({
        label: `${cls} / ${store.DAY_NAMES[day]}`, title: `Add to ${b?.title || 'plan'}`, desc: `${esc(store.DAY_NAMES[day])} ${esc(fmt(dateOf(day)))}${b ? ` · ${esc(b.start)}–${esc(b.end)}` : ''}`,
        body: `<div class="ls-pick">${kids.field('kd-pq', 'Search', `<input class="input" id="kd-pq" type="search" autocomplete="off" placeholder="Search activities" data-pq>`)}<ul class="ls-lib__list" data-pl>${list.map(a => `<li><label class="cls-pick ls-pickrow"><input type="radio" name="act" value="${esc(a.id)}"><span><b>${esc(a.title)}</b><small>${esc(a.area)}</small></span></label></li>`).join('')}</ul>${list.length ? '' : '<p class="cp-muted">No activities match the library filters.</p>'}<p class="field__hint field__hint--error" data-error-for="act" hidden></p></div>`,
        submit: 'Add to plan',
        async onSubmit(form) {
          const id = form.querySelector('[name="act"]:checked')?.value;
          if (!id) return { ok: false, errors: { act: 'Choose an activity.' } };
          if (plan().entries.some(x => x.day === day && x.blockId === blockId && x.activityId === id)) return { ok: false, errors: { act: 'This activity is already in that slot.' } };
          const res = await saveEntries([...entriesNow(), { activityId: id, day, blockId, order: 99, note: '' }], 'Added to plan');
          return res.ok ? res : { ok: false, message: (res.errors && Object.values(res.errors)[0]) || FAIL[res.reason] || FAIL.storage };
        }
      }).form.querySelector('[data-pq]').addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        e.target.closest('form').querySelectorAll('[data-pl] li').forEach(li => { li.hidden = !li.textContent.toLowerCase().includes(q); });
      });
    }
    function librarySheet() {
      const d = kids.dialog({ label: `${cls} / Plan`, title: 'Activity library', desc: 'Open an activity to read it, or use + to add it to the plan.', body: `<div class="ls-sheet">${libraryHtml(true)}</div>`, submit: 'Done', async onSubmit() { return { ok: true }; } });
      d.form.addEventListener('input', e => { if (e.target.matches('[data-lib-q]')) { libQ = e.target.value; redrawSheet(); } });
      d.form.addEventListener('change', e => { if (e.target.matches('[data-lib-area]')) { libArea = e.target.value; redrawSheet(); } if (e.target.matches('[data-lib-age]')) { libAge = e.target.value; redrawSheet(); } });
      d.form.addEventListener('click', e => {
        const o = e.target.closest('[data-open-activity]'); const q = e.target.closest('[data-quick-add]');
        if (o || q) { e.preventDefault(); d.close(); setTimeout(() => activityDialog((o || q).dataset.openActivity || (o || q).dataset.quickAdd), reduceMotion.matches ? 0 : 200); }
      });
      function redrawSheet() { const box = d.form.querySelector('.ls-sheet'); const pos = box.querySelector('[data-lib-q]').selectionStart; box.innerHTML = libraryHtml(true); const inp = box.querySelector('[data-lib-q]'); inp.focus(); inp.setSelectionRange(pos, pos); }
    }
    function activityForm(a = null) {
      kids.dialog({
        label: 'Activity library', title: a ? 'Edit activity' : 'New activity', desc: '',
        body: `<div class="cls-form">
          ${kids.field('kd-title', 'Title', `<input class="input" id="kd-title" name="title" maxlength="80" required value="${esc(a?.title || '')}">`, { required: true })}
          <div class="cls-form__row">${kids.field('kd-area', 'Learning area', `<select class="input" id="kd-area" name="area" required><option value="">Choose…</option>${store.LEARNING_AREAS.map(x => `<option${x === a?.area ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>`, { required: true })}
          ${kids.field('kd-ages', 'Ages', `<input class="input" id="kd-ages" name="ages" maxlength="20" placeholder="e.g. 3–6" value="${esc(a?.ages || '')}">`)}</div>
          ${kids.field('kd-objectives', 'Learning objectives', `<textarea class="input" id="kd-objectives" name="objectives" rows="2" maxlength="600">${esc(a?.objectives || '')}</textarea>`)}
          ${kids.field('kd-materials', 'Materials (one per line)', `<textarea class="input" id="kd-materials" name="materials" rows="3">${esc((a?.materials || []).join('\n'))}</textarea>`)}
          ${kids.field('kd-prep', 'Preparation', `<textarea class="input" id="kd-prep" name="prep" rows="2" maxlength="600">${esc(a?.prep || '')}</textarea>`)}
          ${kids.field('kd-notes', 'Teacher notes', `<textarea class="input" id="kd-notes" name="notes" rows="2" maxlength="600">${esc(a?.notes || '')}</textarea>`)}
          ${window.NexoraFramework ? window.NexoraFramework.picker({ type: 'outcome', current: a?.outcomeIds || [], id: 'kd-outcomes' }) : ''}
        </div>`,
        submit: a ? 'Save activity' : 'Add activity',
        async onSubmit(form) {
          const f = form.elements;
          const res = await store.saveActivity(store.currentUser(), { title: f.title.value, area: f.area.value, ages: f.ages.value, objectives: f.objectives.value, materials: f.materials.value.split('\n'), prep: f.prep.value, notes: f.notes.value, outcomeIds: window.NexoraFramework ? window.NexoraFramework.pickedIds(form) : a?.outcomeIds || [] }, a?.id || null);
          if (!res.ok) return res.errors ? { ok: false, errors: res.errors } : { ok: false, message: FAIL[res.reason] || FAIL.storage };
          window.NexoraToast?.show(a ? 'Activity saved' : 'Activity added', res.activity.title);
          return res;
        }
      });
    }
    function themeForm(t = null) {
      const start = t?.start || (() => { let d = `${month}-01`; while (new Date(`${d}T12:00:00`).getDay() !== 1) d = addDays(d, 1); return d; })();
      const acts = store.getActivities().filter(a => a.status === 'active');
      const d = kids.dialog({
        label: `${cls} / Themes`, title: t ? 'Edit theme' : 'Add theme', desc: '',
        body: `<div class="cls-form">
          ${kids.field('kd-name', 'Theme name', `<input class="input" id="kd-name" name="name" maxlength="80" required value="${esc(t?.name || '')}">`, { required: true })}
          <div class="cls-form__row">${kids.field('kd-start', 'Start date', `<input class="input" id="kd-start" name="start" type="date" required value="${esc(start)}">`, { required: true })}${kids.field('kd-end', 'End date', `<input class="input" id="kd-end" name="end" type="date" required value="${esc(t?.end || addDays(start, 4))}">`, { required: true })}</div>
          ${kids.field('kd-description', 'Description or guiding question', `<textarea class="input" id="kd-description" name="description" rows="2" maxlength="600">${esc(t?.description || '')}</textarea>`)}
          <fieldset class="field"><legend class="field__label">Focus areas</legend><div class="cls-picks">${store.LEARNING_AREAS.map(x => `<label class="cls-pick"><input type="checkbox" name="fa" value="${esc(x)}"${t?.focusAreas.includes(x) ? ' checked' : ''}><span><b>${esc(x)}</b></span></label>`).join('')}</div><p class="field__hint field__hint--error" data-error-for="focusAreas" hidden></p></fieldset>
          ${kids.field('kd-vocab', 'Key vocabulary (comma separated)', `<input class="input" id="kd-vocab" name="vocab" value="${esc((t?.vocabulary || []).join(', '))}">`)}
          <fieldset class="field"><legend class="field__label">Linked activities <span class="field__extra">Optional</span></legend><div class="cls-picks ls-actpicks">${acts.map(x => `<label class="cls-pick"><input type="checkbox" name="ta" value="${esc(x.id)}"${t?.activityIds.includes(x.id) ? ' checked' : ''}><span><b>${esc(x.title)}</b><small>${esc(x.area)}</small></span></label>`).join('')}</div><p class="field__hint field__hint--error" data-error-for="activityIds" hidden></p></fieldset>
          ${kids.field('kd-tnotes', 'Notes', `<textarea class="input" id="kd-tnotes" name="tnotes" rows="2" maxlength="1000">${esc(t?.notes || '')}</textarea>`)}
        </div>`,
        submit: t ? 'Save theme' : 'Add theme',
        async onSubmit(form) {
          const f = form.elements;
          const res = await store.saveTheme(store.currentUser(), klass().id, { name: f.name.value, start: f.start.value, end: f.end.value, description: f.description.value, focusAreas: [...form.querySelectorAll('[name="fa"]:checked')].map(i => i.value), vocabulary: f.vocab.value.split(','), activityIds: [...form.querySelectorAll('[name="ta"]:checked')].map(i => i.value), notes: f.tnotes.value }, t?.id || null);
          if (!res.ok) return res.errors ? { ok: false, errors: res.errors } : { ok: false, message: FAIL[res.reason] || FAIL.storage };
          window.NexoraToast?.show(t ? 'Theme saved' : 'Theme added', res.theme.name);
          month = res.theme.start.slice(0, 7);
          return res;
        }
      });
      if (t) {
        const foot = d.form.querySelector('.modal__foot');
        foot.insertAdjacentHTML('beforeend', `<button class="btn btn--tertiary is-danger" type="button" data-del-theme>${icon('trash', 'icon--sm')}Delete theme</button>`);
        foot.querySelector('[data-del-theme]').addEventListener('click', async () => {
          const res = await store.deleteTheme(store.currentUser(), klass().id, t.id);
          if (res.ok) { window.NexoraToast?.show('Theme deleted', t.name); d.close(); } else window.NexoraToast?.show('Not deleted', FAIL[res.reason] || FAIL.storage, 'info');
        });
      }
    }
    function blockForm(b = null) {
      const c = klass();
      const acts = store.getActivities().filter(a => a.status === 'active');
      let allow = false;
      const d = kids.dialog({
        label: `${cls} / Timetable`, title: b ? 'Edit routine block' : 'Add routine block', desc: '',
        body: `<div class="cls-form">
          ${kids.field('kd-btitle', 'Block name', `<input class="input" id="kd-btitle" name="btitle" maxlength="60" required value="${esc(b?.title || '')}">`, { required: true })}
          <div class="cls-form__row">${kids.field('kd-bstart', 'Start time', `<input class="input" id="kd-bstart" name="bstart" type="time" required value="${esc(b?.start || '')}">`, { required: true })}${kids.field('kd-bend', 'End time', `<input class="input" id="kd-bend" name="bend" type="time" required value="${esc(b?.end || '')}">`, { required: true })}</div>
          <fieldset class="field"><legend class="field__label">Days <span class="field__extra">None ticked = every school day</span></legend><div class="cls-picks">${days().map(x => `<label class="cls-pick"><input type="checkbox" name="bd" value="${x}"${b?.days?.includes(x) ? ' checked' : ''}><span><b>${esc(store.DAY_NAMES[x].slice(0, 3))}</b></span></label>`).join('')}</div></fieldset>
          ${kids.field('kd-bdesc', 'Description', `<textarea class="input" id="kd-bdesc" name="bdesc" rows="2" maxlength="300">${esc(b?.description || '')}</textarea>`)}
          <div class="cls-form__row">${kids.field('kd-bloc', 'Location or materials', `<input class="input" id="kd-bloc" name="bloc" maxlength="80" value="${esc(b?.location || '')}">`)}${kids.field('kd-bact', 'Linked activity', `<select class="input" id="kd-bact" name="bact"><option value="">None</option>${acts.map(x => `<option value="${esc(x.id)}"${x.id === b?.activityId ? ' selected' : ''}>${esc(x.title)}</option>`).join('')}</select>`)}</div>
          <p class="ls-banner ls-banner--warn" data-overlap hidden role="alert"></p>
        </div>`,
        submit: b ? 'Save block' : 'Add block',
        async onSubmit(form) {
          const f = form.elements;
          const res = await store.saveRoutineBlock(store.currentUser(), c.id, { title: f.btitle.value, start: f.bstart.value, end: f.bend.value, days: [...form.querySelectorAll('[name="bd"]:checked')].map(i => i.value), description: f.bdesc.value, location: f.bloc.value, activityId: f.bact.value }, b?.id || null, { allowOverlap: allow });
          if (res.ok) { window.NexoraToast?.show(b ? 'Block saved' : 'Block added', `${f.btitle.value} · ${f.bstart.value}–${f.bend.value}`); return res; }
          if (res.reason === 'overlap') {
            const box = form.querySelector('[data-overlap]');
            box.innerHTML = `${icon('alert-triangle', 'icon--sm')}<span>This overlaps ${esc(res.clash.join(', '))}. Select <b>Save anyway</b> if both really happen at the same time.</span>`;
            box.hidden = false;
            allow = true;
            return { keepOpen: true, submitLabel: 'Save anyway' };
          }
          return res.errors ? { ok: false, errors: { title: res.errors.title, start: res.errors.start, end: res.errors.end, activityId: res.errors.activityId, btitle: res.errors.title, bstart: res.errors.start, bend: res.errors.end, bact: res.errors.activityId } } : { ok: false, message: FAIL[res.reason] || FAIL.storage };
        }
      });
      d.form.addEventListener('input', e => { if (['bstart', 'bend', 'bd'].includes(e.target.name)) { allow = false; d.form.querySelector('[data-overlap]').hidden = true; d.form.querySelector('[type="submit"]').textContent = b ? 'Save block' : 'Add block'; } });
      if (b) {
        const foot = d.form.querySelector('.modal__foot');
        foot.insertAdjacentHTML('beforeend', `<button class="btn btn--tertiary is-danger" type="button" data-del-block>${icon('trash', 'icon--sm')}Delete block</button>`);
        foot.querySelector('[data-del-block]').addEventListener('click', async () => {
          let res = await store.deleteRoutineBlock(store.currentUser(), c.id, b.id);
          if (res.reason === 'in-use') {
            d.close();
            kids.dialog({
              label: `${cls} / Timetable`, title: 'This block is in lesson plans',
              desc: `${plural(res.count, 'planned activity', 'planned activities')} use <b>${esc(b.title)}</b>. They won’t be moved or deleted — they’ll show under “Routine removed” so you can place them again.`,
              body: '', submit: 'Delete block', danger: true,
              async onSubmit() { const r2 = await store.deleteRoutineBlock(store.currentUser(), c.id, b.id, { confirmPlans: true }); if (r2.ok) window.NexoraToast?.show('Block deleted', `${b.title}. ${plural(r2.kept, 'planned activity', 'planned activities')} kept under “Routine removed”.`); return r2.ok ? r2 : { ok: false, message: FAIL[r2.reason] || FAIL.storage }; }
            });
            return;
          }
          if (res.ok) { window.NexoraToast?.show('Block deleted', b.title); d.close(); } else window.NexoraToast?.show('Not deleted', FAIL[res.reason] || FAIL.storage, 'info');
        });
      }
    }

    /* ---------------------------------------------------------------- Workflow actions */

    function copyDialog() {
      const p = plan();
      const src = store.weeklyPlan(klass().id, addDays(week, -7));
      kids.dialog({
        label: `${cls} / Copy last week`, title: 'Copy last week?',
        desc: `From <b>${esc(fmt(src.weekStart))} – ${esc(fmt(addDays(src.weekStart, 4)))}</b> (${plural(src.entries.length, 'activity', 'activities')}) to <b>${esc(fmt(week))} – ${esc(fmt(addDays(week, 4)))}</b>.${p.entries.length ? ` <b>This replaces the ${plural(p.entries.length, 'activity', 'activities')} already planned this week.</b>` : ''} The copy starts as a draft; review history isn’t copied and last week stays as it is.`,
        body: '', submit: 'Copy plan', danger: Boolean(p.entries.length),
        async onSubmit() {
          const res = await store.copyLastWeek(store.currentUser(), { classId: klass().id, weekStart: week });
          if (!res.ok) return { ok: false, message: FAIL[res.reason] || FAIL.storage };
          window.NexoraToast?.show('Plan copied', res.flagged ? `${plural(res.flagged, 'activity needs', 'activities need')} checking — marked “Check”.` : `${plural(res.plan.entries.length, 'activity', 'activities')} copied.`, res.flagged ? 'info' : 'check-circle');
          return res;
        }
      });
    }
    function submitDialog() {
      const p = plan();
      const r = reviewer();
      if (!r) { window.NexoraToast?.show('No reviewer set', FAIL['no-reviewer'], 'info'); return; }
      kids.dialog({
        label: `${cls} / Submit`, title: 'Submit for review?',
        desc: `<b>${esc(cls)}</b>, week of ${esc(fmt(week, { day: 'numeric', month: 'long' }))} · ${plural(p.entries.length, 'activity', 'activities')}. ${esc(r.name)} will be notified and the plan is locked until it’s reviewed.`,
        body: '', submit: 'Submit for review',
        async onSubmit() {
          const res = await store.submitPlan(store.currentUser(), p.id);
          if (!res.ok) return { ok: false, message: (res.errors && Object.values(res.errors)[0]) || FAIL[res.reason] || FAIL.storage };
          window.NexoraToast?.show('Plan submitted', `${res.reviewer} has been notified in Nexora.`);
          return res;
        }
      });
    }
    function reviewDialog(decision) {
      const p = plan();
      kids.dialog({
        label: `${cls} / Review`, title: decision === 'approved' ? 'Approve this plan?' : 'Request changes',
        desc: `${esc(cls)}, week of ${esc(fmt(week, { day: 'numeric', month: 'long' }))} · revision ${p.revision} by ${esc(p.submittedBy)}.`,
        body: kids.field('kd-comment', decision === 'approved' ? 'Comment (optional)' : 'What needs to change?', `<textarea class="input" id="kd-comment" name="comment" rows="3" maxlength="1000" ${decision === 'changes' ? 'required' : ''}></textarea>`, { required: decision === 'changes' }),
        submit: decision === 'approved' ? 'Approve' : 'Request changes',
        danger: decision === 'changes',
        async onSubmit(form) {
          const res = await store.reviewPlan(store.currentUser(), p.id, decision, form.elements.comment.value);
          if (!res.ok) return res.errors ? { ok: false, errors: res.errors } : { ok: false, message: FAIL[res.reason] || FAIL.storage };
          window.NexoraToast?.show(decision === 'approved' ? 'Plan approved' : 'Changes requested', `${p.submittedBy} has been notified in Nexora.`);
          return res;
        }
      });
    }
    function reviewerDialog() {
      const cur = store.getPlanSettings().reviewerId;
      const leaders = store.users.filter(u => u.schoolId === store.school.id && ['Director', 'Admin', 'Super Admin'].includes(u.role));
      kids.dialog({
        label: 'Lesson planning / Settings', title: 'Plan reviewer', desc: 'Submitted plans go to this person. They can’t approve plans they submitted themselves.',
        body: kids.field('kd-reviewerId', 'Reviewer', `<select class="input" id="kd-reviewerId" name="reviewerId"><option value="">No reviewer</option>${leaders.map(u => `<option value="${esc(u.id)}"${u.id === cur ? ' selected' : ''}>${esc(u.name)} · ${esc(u.role)}</option>`).join('')}</select>`),
        submit: 'Save',
        async onSubmit(form) {
          const res = await store.setPlanReviewer(store.currentUser(), form.elements.reviewerId.value);
          if (!res.ok) return res.errors ? { ok: false, errors: res.errors } : { ok: false, message: FAIL[res.reason] || FAIL.storage };
          window.NexoraToast?.show('Reviewer saved', form.elements.reviewerId.selectedOptions[0].textContent);
          paint();
          return res;
        }
      });
    }

    /* ---------------------------------------------------------------- Events */

    function selectTab(k, focus = false) {
      tab = k; syncUrl(); paint();
      if (focus) $(`#ls-tab-${k}`)?.focus();
    }
    main.addEventListener('click', async e => {
      const t = e.target.closest('[data-tab]');
      if (t) { selectTab(t.dataset.tab, t.getAttribute('role') === 'tab'); return; }
      if (e.target.closest('[data-retry]')) { load(); return; }
      const wk = e.target.closest('[data-week]');
      if (wk) { week = addDays(week, 7 * Number(wk.dataset.week)); month = week.slice(0, 7); mday = null; saveState = ''; syncUrl(); paint(); return; }
      if (e.target.closest('[data-week-now]')) { week = store.weekOf(today); month = week.slice(0, 7); mday = null; syncUrl(); paint(); return; }
      const ds = e.target.closest('[data-day-step]');
      if (ds) { const list = days(); mday = list[Math.max(0, Math.min(list.length - 1, list.indexOf(mday) + Number(ds.dataset.dayStep)))]; syncUrl(); paint(); main.querySelector(`[data-day-step="${ds.dataset.dayStep}"]`)?.focus(); return; }
      const mo = e.target.closest('[data-month]');
      if (mo) { const d = new Date(`${month}-01T12:00:00`); d.setMonth(d.getMonth() + Number(mo.dataset.month)); month = iso(d).slice(0, 7); paint(); return; }
      if (e.target.closest('[data-save-draft]')) { await saveEntries(entriesNow(), 'Draft saved'); return; }
      if (e.target.closest('[data-submit]')) { submitDialog(); return; }
      const rv = e.target.closest('[data-review]');
      if (rv) { reviewDialog(rv.dataset.review); return; }
      if (e.target.closest('[data-reviewer]')) { reviewerDialog(); return; }
      if (e.target.closest('[data-revise]')) {
        const p = plan();
        kids.dialog({ label: `${cls} / Plan`, title: 'Edit the approved plan?', desc: `This starts revision ${p.revision + 1} as a draft. The approved version (revision ${p.revision}) is kept, and the new revision needs approval again.`, body: '', submit: 'Start new revision',
          async onSubmit() { const r = await store.startRevision(store.currentUser(), p.id); if (r.ok) window.NexoraToast?.show('New revision started', 'Make your changes, then submit for review.'); return r.ok ? r : { ok: false, message: FAIL[r.reason] || FAIL.storage }; } });
        return;
      }
      if (e.target.closest('[data-copy]')) { copyDialog(); return; }
      if (e.target.closest('[data-lib-sheet]')) { librarySheet(); return; }
      const rm = e.target.closest('[data-remove]');
      if (rm) { await saveEntries(entriesNow().filter(x => x.id !== rm.dataset.remove)); return; }
      const oe = e.target.closest('[data-open-entry]');
      if (oe) { const en = plan().entries.find(x => x.id === oe.dataset.openEntry); if (en) activityDialog(en.activityId, { entry: en }); return; }
      const oa = e.target.closest('[data-open-activity]');
      if (oa) { activityDialog(oa.dataset.openActivity); return; }
      const qa = e.target.closest('[data-quick-add]');
      if (qa) { activityDialog(qa.dataset.quickAdd); return; }
      const as = e.target.closest('[data-add-slot]');
      if (as) { const [d, b] = as.dataset.addSlot.split('|'); slotPicker(d, b); return; }
      if (e.target.closest('[data-new-activity]')) { activityForm(); return; }
      if (e.target.closest('[data-new-theme]')) { themeForm(); return; }
      const et = e.target.closest('[data-edit-theme]');
      if (et) { themeForm(store.themesFor(klass().id, month).find(x => x.id === et.dataset.editTheme)); return; }
      if (e.target.closest('[data-new-block]')) { blockForm(); return; }
      const eb = e.target.closest('[data-edit-block]');
      if (eb) { blockForm(store.routineBlocks(klass().id).find(x => x.id === eb.dataset.editBlock)); return; }
      const td = e.target.closest('[data-tt-day]');
      if (td) { ttDay = td.dataset.ttDay; paint(); main.querySelector(`[data-tt-day="${ttDay}"]`)?.focus(); }
    });
    main.addEventListener('change', e => {
      if (e.target.matches('[data-cls]')) { cls = e.target.value; saveState = ''; syncUrl(); paint(); return; }
      if (e.target.matches('[data-lib-area]')) { libArea = e.target.value; paint(); return; }
      if (e.target.matches('[data-lib-age]')) { libAge = e.target.value; paint(); }
    });
    main.addEventListener('input', e => {
      if (!e.target.matches('[data-lib-q]')) return;
      libQ = e.target.value;
      const id = e.target.id;
      const pos = e.target.selectionStart;
      paint();
      const inp = main.querySelector(`#${id}`);
      if (inp) { inp.focus(); inp.setSelectionRange(pos, pos); }
    });
    main.addEventListener('keydown', e => {
      const t = e.target.closest('[role="tab"]');
      if (!t) return;
      const keys = TABS.map(([k]) => k);
      const i = keys.indexOf(t.dataset.tab);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: keys.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      selectTab(keys[(to + keys.length) % keys.length], true);
    });

    // Drag and drop (mouse): library → cell, card → cell (before another card to reorder).
    let drag = null;
    main.addEventListener('dragstart', e => {
      const lib = e.target.closest('[data-drag-activity]');
      const card = e.target.closest('.ls-card[data-entry][draggable="true"]');
      if (!lib && !card) return;
      drag = lib ? { activityId: lib.dataset.dragActivity } : { entryId: card.dataset.entry };
      e.dataTransfer.effectAllowed = lib ? 'copy' : 'move';
      e.dataTransfer.setData('text/plain', lib ? lib.dataset.dragActivity : card.dataset.entry);
      (lib || card).classList.add('is-dragging');
    });
    main.addEventListener('dragend', e => { e.target.closest?.('.is-dragging')?.classList.remove('is-dragging'); main.querySelectorAll('.is-drop, .is-nodrop').forEach(x => x.classList.remove('is-drop', 'is-nodrop')); drag = null; });
    main.addEventListener('dragover', e => {
      if (!drag) return;
      const cell = e.target.closest('td.ls-cell');
      main.querySelectorAll('.is-drop, .is-nodrop').forEach(x => x !== cell && x.classList.remove('is-drop', 'is-nodrop'));
      if (!cell) return;
      if (!cell.dataset.drop) { cell.classList.add('is-nodrop'); return; }
      e.preventDefault();
      cell.classList.add('is-drop');
    });
    main.addEventListener('drop', e => {
      const cell = e.target.closest('td.ls-cell[data-drop]');
      if (!drag || !cell) return;
      e.preventDefault();
      const [day, blockId] = cell.dataset.drop.split('|');
      const before = e.target.closest('.ls-card[data-entry]')?.dataset.entry || null;
      const d = drag;
      drag = null;
      cell.classList.remove('is-drop');
      if (d.activityId) addEntry(d.activityId, day, blockId);
      else if (d.entryId && d.entryId !== before) moveEntry(d.entryId, day, blockId, before);
    });

    // Swipe between days on phones (horizontal only, so vertical scrolling still works).
    let touch = null;
    main.addEventListener('touchstart', e => { if (!e.target.closest('[data-swipe]') || !mobileQ.matches) return; touch = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
    main.addEventListener('touchend', e => {
      if (!touch) return;
      const dx = e.changedTouches[0].clientX - touch.x;
      const dy = e.changedTouches[0].clientY - touch.y;
      touch = null;
      if (Math.abs(dx) < 60 || Math.abs(dy) > 40) return;
      const list = days();
      const i = list.indexOf(mday) + (dx < 0 ? 1 : -1);
      if (list[i]) { mday = list[i]; syncUrl(); paint(); }
    });

    mobileQ.addEventListener('change', () => paint());
    wideQ.addEventListener('change', () => paint());
    let queued = false;
    store.subscribe(({ key }) => {
      if (!loaded || (key && !/^nexora-(lesson-plans|plan-|themes|activities|class-routines|class-registry|frameworks|framework-active|settings|demo-role)/.test(key))) return;
      if (queued) return;
      queued = true;
      setTimeout(() => { queued = false; paint(); }, 0);
    });
    load();
  }

  window.NexoraLessons = { render };
})();
