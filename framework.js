/* S24 Learning Framework (app.html?page=framework[&fw=<frameworkId>][&item=<itemId>])
   Tree of the school's framework (area → sub-area → outcome | milestone | material) with a details panel. Editing is
   for school leaders from 768px up; teachers and phones get a read-only, searchable tree. All rules live in the store.
   Also exports NexoraFramework.picker / pickedIds: the outcome and milestone picker used by the child profile (S25
   observation tagging, S27 milestones) and Lesson Planning, so every selector reads the same active framework.
   Test hooks: ?fail=1 (load error), ?fwfail=save|move|hide|delete|activate|library|import|merge|history (one failure). */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const when = s => (s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const TYPE_ICON = { area: 'layers', subarea: 'grid', outcome: 'check-circle', milestone: 'star', material: 'shapes' };

  /* ----------------------------------------------------------------- Shared picker (S25 / S27 / lessons) */

  // `type` 'outcome' (observation tags, activities) or 'milestone'. `current` = refs already on the record: kept and
  // shown even when hidden or from another framework, so editing an old record never drops its history.
  function picker({ type = 'outcome', name = 'outcomeIds', current = [], multiple = true, id = 'fwp' } = {}) {
    const { framework, options } = store.frameworkOptions(type);
    const label = type === 'milestone' ? 'Milestone' : 'Framework outcomes';
    const keep = current.map(r => ({ ...store.frameworkRef(r), itemId: r.itemId || r })).filter(r => !options.some(o => o.id === r.itemId));
    if (!framework && !keep.length) return `<div class="fw-pick fw-pick--empty"><p class="field__label">${label}</p><p class="field__hint">No learning framework is active yet. A school leader can set one up in Learning Framework.</p></div>`;
    const groups = [];
    options.forEach(o => { const g = `${o.area} › ${o.subarea}`; let x = groups.find(y => y.g === g); if (!x) { x = { g, list: [] }; groups.push(x); } x.list.push(o); });
    const inputType = multiple ? 'checkbox' : 'radio';
    const sel = new Set(current.map(r => r.itemId || r));
    const opt = (o, extra = '') => `<label class="fw-pick__opt" data-text="${esc(`${o.code} ${o.name} ${o.area || ''} ${o.subarea || ''}`.toLowerCase())}"><input type="${inputType}" name="${name}" value="${esc(o.id || o.itemId)}"${sel.has(o.id || o.itemId) ? ' checked' : ''}><span>${o.code ? `<b>${esc(o.code)}</b> ` : ''}${esc(o.name)}${o.ageBand ? ` <small>${esc(o.ageBand)}</small>` : ''}${extra}</span></label>`;
    return `<fieldset class="fw-pick" id="${id}"><legend class="field__label">${label}${multiple ? '' : ' <span class="field__req" aria-hidden="true">*</span>'}</legend>
      ${framework ? `<p class="field__hint">${esc(framework.name)} · version ${esc(framework.version)}. Hidden items aren’t offered.</p>` : '<p class="field__hint">No framework is active — only tags already on this record are shown.</p>'}
      ${options.length > 6 ? `<input class="input fw-pick__q" type="search" placeholder="Filter ${type === 'milestone' ? 'milestones' : 'outcomes'}" aria-label="Filter ${type === 'milestone' ? 'milestones' : 'outcomes'}" data-pickq>` : ''}
      <div class="fw-pick__list">${keep.length ? `<div class="fw-pick__g"><p>Already on this record</p>${keep.map(r => opt({ ...r, id: r.itemId }, ` <small class="fw-pick__note">${r.missing ? 'removed from the framework' : r.hidden ? 'hidden in the framework' : `${esc(r.frameworkName)} ${esc(r.version)} — not active`}</small>`)).join('')}</div>` : ''}
        ${groups.map(g => `<div class="fw-pick__g"><p>${esc(g.g)}</p>${g.list.map(o => opt(o)).join('')}</div>`).join('')}
        ${!options.length ? `<p class="field__hint">The active framework has no visible ${type === 'milestone' ? 'milestones' : 'outcomes'} yet.</p>` : ''}</div>
      <p class="field__hint field__hint--error" data-error-for="${name}" hidden></p></fieldset>`;
  }
  const pickedIds = (form, name = 'outcomeIds') => [...form.querySelectorAll(`[name="${name}"]:checked`)].map(i => i.value);
  document.addEventListener('input', e => {
    if (!e.target.matches('[data-pickq]')) return;
    const q = e.target.value.trim().toLowerCase();
    const box = e.target.closest('.fw-pick');
    box.querySelectorAll('.fw-pick__opt').forEach(l => { l.hidden = Boolean(q) && !l.dataset.text.includes(q) && !l.querySelector('input').checked; });
    box.querySelectorAll('.fw-pick__g').forEach(g => { g.hidden = ![...g.querySelectorAll('.fw-pick__opt')].some(l => !l.hidden); });
  });
  // A stored tag, for read-only display: current name if the item still exists, otherwise the saved name.
  function refLabel(r) {
    const x = store.frameworkRef(r);
    const note = x.missing ? 'removed from the framework' : x.hidden ? 'hidden' : !x.active ? `${x.frameworkName} ${x.version}` : '';
    return `<span class="fw-tag${x.missing || x.hidden || !x.active ? ' is-muted' : ''}" title="${esc([x.frameworkName, x.version, ...(x.path || [])].filter(Boolean).join(' · '))}">${x.code ? `<b>${esc(x.code)}</b> ` : ''}${esc(x.name)}${note ? ` <small>(${esc(note)})</small>` : ''}</span>`;
  }

  /* ----------------------------------------------------------------- Page */

  function render(key, main, user) {
    if (key !== 'framework') return false;
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
    const mqNarrow = matchMedia('(max-width: 1023px)');
    const me = () => store.currentUser();
    const FAIL = {
      forbidden: 'Your role can’t change the learning framework. Nothing was changed.',
      missing: 'This item is no longer in the framework. The latest version is shown.',
      stale: 'Someone else changed this framework just now. The latest version is shown — please try again.',
      storage: 'This couldn’t be saved on this device. Nothing was changed — please try again.',
      unavailable: 'The platform template library (P15) couldn’t be reached. Nothing was changed.'
    };
    const failText = r => r.message || (r.errors && Object.values(r.errors)[0]) || FAIL[r.reason] || FAIL.storage;
    let failOnce = params.get('fail') === '1';
    const failNext = { [params.get('fwfail') || '']: true };
    const takeFail = k => { const v = Boolean(failNext[k]); failNext[k] = false; return v; };

    let fwId = params.get('fw') || '';
    let selected = params.get('item') || '';
    let q = '';
    let renaming = '';
    let loaded = false;
    let busy = false;
    let openMenu = null;
    let drag = null;
    let drawer = null;
    const expandedKey = () => `nexora-fw-open:${fwId}`;
    let expanded = new Set();
    const loadExpanded = () => { try { expanded = new Set(JSON.parse(sessionStorage.getItem(expandedKey())) || []); } catch { expanded = new Set(); } };
    const saveExpanded = () => { try { sessionStorage.setItem(expandedKey(), JSON.stringify([...expanded])); } catch { /* optional */ } };

    main.classList.add('kids-page');
    document.title = 'Learning Framework · Nexora';
    const $ = s => main.querySelector(s);
    const fw = () => store.frameworkById(fwId);
    const item = id => fw()?.items.find(i => i.id === id) || null;
    const kidsOf = (f, pid) => f.items.filter(i => (i.parentId || null) === (pid || null)).sort((a, b) => (a.type === 'material') - (b.type === 'material') || a.order - b.order);
    const pathOf = (f, id) => { const out = []; for (let it = f.items.find(i => i.id === id), n = 0; it && n < 10; it = f.items.find(i => i.id === it.parentId), n += 1) out.unshift(it); return out; };
    const hiddenBy = (f, id) => pathOf(f, id).find(i => i.hidden) || null;
    const descendants = (f, id) => { const out = []; const walk = p => f.items.filter(i => i.parentId === p).forEach(c => { out.push(c); walk(c.id); }); walk(id); return out; };
    const canEdit = () => store.canEditFramework(me()) && !mqPhone.matches;
    const head = sub => `<header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Learning Framework</h1><p class="kids-head__sub">${sub}</p></div></header>`;
    const SUB = 'The areas, outcomes, milestones and materials your observations and plans refer to.';
    const state = (ic, title, text, action = '', tone = '') => `<div class="kids-empty fw-state"${tone === 'error' ? ' role="alert"' : ''}><span class="state-icon${tone ? ` state-icon--${tone}` : ''}" aria-hidden="true">${icon(ic)}</span><h2 class="kids-empty__title">${title}</h2><p>${text}</p>${action}</div>`;
    const syncUrl = () => { const u = new URL(location.href); fwId ? u.searchParams.set('fw', fwId) : u.searchParams.delete('fw'); selected ? u.searchParams.set('item', selected) : u.searchParams.delete('item'); history.replaceState(null, '', u); };

    function load() {
      main.innerHTML = `<div class="kids fw" aria-busy="true">${head(SUB)}<span class="skeleton fw-skel fw-skel--head" aria-hidden="true"></span><div class="fw-body" aria-hidden="true"><span class="skeleton fw-skel fw-skel--tree"></span><span class="skeleton fw-skel fw-skel--tree"></span></div><p class="sr-only" role="status">Loading the learning framework</p></div>`;
      setTimeout(() => {
        if (failOnce) {
          failOnce = false;
          main.innerHTML = `<div class="kids fw">${head(SUB)}${state('alert-circle', 'We couldn’t load the learning framework', 'Nothing has changed. Check your connection, then try again.', '<button class="btn btn--primary" type="button" data-retry>Try again</button>', 'error')}</div>`;
          return;
        }
        loaded = true;
        if (!store.frameworkById(fwId)) fwId = store.activeFrameworkId() || store.getFrameworks()[0]?.id || '';
        loadExpanded();
        if (selected && item(selected)) pathOf(fw(), selected).slice(0, -1).forEach(p => expanded.add(p.id));
        else if (!expanded.size && fw()) kidsOf(fw(), null).slice(0, 1).forEach(a => expanded.add(a.id));
        draw();
        const row = selected && main.querySelector(`[data-node="${CSS.escape(selected)}"]`);
        if (row) { row.scrollIntoView({ block: 'center' }); row.querySelector('[data-select]')?.focus(); } else $('#page-title')?.focus();
      }, 300);
    }

    /* ----------------------------- Drawing */

    function draw() {
      if (!loaded) return;
      const active = document.activeElement;
      const keep = active && main.contains(active) ? { id: active.id, sel: active.closest('[data-node]')?.dataset.node, act: [...active.attributes].map(a => a.name).find(n => n.startsWith('data-') && n !== 'data-node'), pos: active.selectionStart } : null;
      const f = fw();
      const all = store.getFrameworks();
      if (!f) {
        main.innerHTML = `<div class="kids fw">${head(SUB)}${state('layers', 'No learning framework yet', all.length ? 'Choose which installed framework the school uses.' : 'Import a framework from the platform template library to start. You can adapt it to your school afterwards.', store.canEditFramework(me()) ? `<div class="fw-state__acts">${all.length ? '<button class="btn btn--secondary" type="button" data-change>Choose framework</button>' : ''}<button class="btn btn--primary" type="button" data-import>${icon('download', 'icon--sm')}Import from library</button></div>` : '<p class="cd-note">Ask a school leader to set up the learning framework.</p>')}</div>`;
        return;
      }
      if (selected && !item(selected)) selected = '';
      const isActive = f.id === store.activeFrameworkId();
      const count = t => f.items.filter(i => i.type === t).length;
      const hiddenCount = f.items.filter(i => i.hidden).length;
      const edit = canEdit();
      main.innerHTML = `<div class="kids fw">${head(SUB)}
        <section class="panel fw-head" aria-labelledby="fw-name">
          <div class="fw-head__main">
            <div class="fw-head__tags">${isActive ? `<span class="badge badge--plain an-chip an-chip--success">${icon('check-circle')}Active framework</span>` : `<span class="badge badge--plain an-chip an-chip--neutral">${icon('eye-off')}Not active — viewing only</span>`}${f.type ? `<span class="badge badge--plain an-chip an-chip--cat">${esc(f.type)}</span>` : ''}${f.source?.demo ? '<span class="badge badge--plain an-chip an-chip--warning">Demo template</span>' : ''}</div>
            <h2 class="fw-head__name" id="fw-name">${esc(f.name)} <span class="fw-head__ver">v${esc(f.version)}</span></h2>
            <p class="fw-head__meta">${f.source ? `From ${esc(f.source.library)} · ${esc(f.source.provider)} · template ${esc(f.source.templateVersion)}` : 'Created in this school'} · Last updated ${esc(when(f.updatedAt))} by ${esc(f.updatedBy || f.createdBy)}</p>
            <dl class="fw-head__counts"><div><dt>Areas</dt><dd>${count('area')}</dd></div><div><dt>Sub-areas</dt><dd>${count('subarea')}</dd></div><div><dt>Outcomes</dt><dd>${count('outcome')}</dd></div><div><dt>Milestones</dt><dd>${count('milestone')}</dd></div><div><dt>Materials</dt><dd>${count('material')}</dd></div><div><dt>Hidden</dt><dd>${hiddenCount}</dd></div></dl>
          </div>
          <div class="fw-head__acts">
            ${store.canEditFramework(me()) && !isActive ? '<button class="btn btn--primary" type="button" data-activate>Make this the active framework</button>' : ''}
            ${store.canEditFramework(me()) || all.length > 1 ? `<button class="btn btn--secondary" type="button" data-change>${icon('refresh', 'icon--sm')}${store.canEditFramework(me()) ? 'Change framework' : 'Other frameworks'}</button>` : ''}
            <button class="btn btn--secondary" type="button" data-history>${icon('clock', 'icon--sm')}Change history</button>
            ${store.canEditFramework(me()) && !mqPhone.matches ? `<button class="btn ${isActive ? 'btn--primary' : 'btn--secondary'}" type="button" data-import>${icon('download', 'icon--sm')}Import from library</button>` : ''}
          </div>
        </section>
        ${mqPhone.matches ? `<div class="wt-banner wt-banner--neutral fw-banner" role="note">${icon('info')}<p><b>Edit on a larger screen</b><br>Framework editing is available on tablet and desktop. You can still browse and search the current framework here.</p></div>`
          : !store.canEditFramework(me()) ? `<div class="wt-banner wt-banner--neutral fw-banner" role="note">${icon('lock')}<p><b>View only.</b> School leaders (Director or Admin) can change the framework.</p></div>` : ''}
        <div class="fw-body">
          <section class="panel fw-tree-panel" aria-labelledby="fw-tree-h">
            <div class="fw-tools">
              <h2 class="sr-only" id="fw-tree-h">Framework tree</h2>
              <div class="field fw-tools__q"><label class="sr-only" for="fw-q">Search the framework</label><div class="input-wrap input-wrap--lead">${icon('search')}<input class="input" id="fw-q" type="search" placeholder="Search names, codes, descriptions, materials" value="${esc(q)}" data-q autocomplete="off"></div></div>
              <div class="fw-tools__btns"><button class="btn btn--tertiary btn--sm" type="button" data-expandall>Expand all</button><button class="btn btn--tertiary btn--sm" type="button" data-collapseall>Collapse all</button>${edit ? `<button class="btn btn--secondary btn--sm" type="button" data-add="">${icon('plus', 'icon--sm')}Add area</button>` : ''}</div>
            </div>
            ${tree(f, edit)}
            ${edit ? '<p class="cd-note fw-hint">Drag an item to reorder it or move it to another valid parent, or use its <b>⋯</b> menu (Move up, Move down, Move to…).</p>' : ''}
          </section>
          <aside class="panel fw-details" aria-labelledby="fw-d-h" data-details>${details(f, edit)}</aside>
        </div>
      </div>`;
      if (drawer) drawer.refresh();
      if (keep) {
        const node = keep.sel && main.querySelector(`[data-node="${CSS.escape(keep.sel)}"]`);
        const el = (keep.id && main.querySelector(`#${CSS.escape(keep.id)}`)) || (node && keep.act && node.querySelector(`[${keep.act}]`)) || node?.querySelector('[data-select]');
        if (el) { el.focus(); if (keep.pos != null && el.setSelectionRange) try { el.setSelectionRange(keep.pos, keep.pos); } catch { /* not text */ } }
      }
      const ri = renaming && main.querySelector('[data-renameinput]');
      if (ri) { ri.focus(); ri.select(); }
    }

    function matchSet(f) {
      if (!q.trim()) return null;
      const needle = q.trim().toLowerCase();
      const inv = store.getMaterials();
      const hits = f.items.filter(i => `${i.name} ${i.code} ${i.description} ${i.type === 'material' ? inv.find(m => m.id === i.materialId)?.name || '' : ''}`.toLowerCase().includes(needle));
      const show = new Set();
      hits.forEach(h => pathOf(f, h.id).forEach(p => show.add(p.id)));
      return { hits: new Set(hits.map(h => h.id)), show };
    }

    function tree(f, edit) {
      const m = matchSet(f);
      if (!f.items.length) return state('layers', 'This framework is empty', edit ? 'Add the first area, or merge items from a library template.' : 'No areas have been added yet.', edit ? `<button class="btn btn--primary" type="button" data-add="">${icon('plus', 'icon--sm')}Add area</button>` : '');
      if (m && !m.hits.size) return state('search', 'Nothing matches', `No names, codes, descriptions or materials contain “${esc(q)}”.`, '<button class="btn btn--secondary btn--sm" type="button" data-clearq>Clear search</button>');
      const node = (it, level) => {
        if (m && !m.show.has(it.id)) return '';
        const kids = kidsOf(f, it.id);
        const open = m ? kids.some(k => m.show.has(k.id)) : expanded.has(it.id);
        const isHidden = it.hidden;
        const inheritsHidden = !isHidden && hiddenBy(f, it.id);
        const allowed = store.FW_CHILDREN[it.type];
        const mats = it.type === 'subarea' ? kids.filter(k => k.type === 'material') : [];
        const nonMats = kids.filter(k => k.type !== 'material');
        const kidsHtml = kids.length ? `<ul class="fw-tree__group" id="fw-g-${esc(it.id)}" role="list">${nonMats.map(k => node(k, level + 1)).join('')}${mats.length && (!m || mats.some(k => m.show.has(k.id))) ? `<li class="fw-tree__caption" aria-hidden="true">Materials</li>${mats.map(k => node(k, level + 1)).join('')}` : ''}</ul>` : '';
        const emptyBranch = !kids.length && allowed.length && expanded.has(it.id) && !m ? `<p class="fw-tree__empty">No ${it.type === 'area' ? 'sub-areas' : 'outcomes, milestones or materials'} yet.${edit ? ` <button class="btn btn--tertiary btn--sm" type="button" data-add="${esc(it.id)}">Add one</button>` : ''}</p>` : '';
        const count = it.type === 'area' ? kids.length : it.type === 'subarea' ? nonMats.length : null;
        const name = renaming === it.id
          ? `<form class="fw-rename" data-renameform="${esc(it.id)}" novalidate><label class="sr-only" for="fw-rn">New name for ${esc(it.name)}</label><input class="input input--sm" id="fw-rn" data-renameinput value="${esc(it.name)}" maxlength="120" aria-describedby="fw-rn-hint"><span class="sr-only" id="fw-rn-hint">Press Enter to save or Escape to cancel.</span></form>`
          : `<button class="fw-node__name" type="button" data-select aria-current="${selected === it.id ? 'true' : 'false'}">${it.code ? `<span class="fw-code">${esc(it.code)}</span>` : ''}<span class="fw-node__text">${hl(it.name, m)}</span></button>`;
        return `<li class="fw-tree__item fw-t--${it.type}${selected === it.id ? ' is-selected' : ''}${isHidden || inheritsHidden ? ' is-hidden' : ''}${m?.hits.has(it.id) ? ' is-hit' : ''}" data-node="${esc(it.id)}" data-type="${it.type}" style="--lvl:${level}">
          <div class="fw-row"${edit && !m && renaming !== it.id ? ' draggable="true"' : ''}>
            ${kids.length || allowed.length ? `<button class="fw-toggle" type="button" data-toggle aria-expanded="${open}" ${kids.length ? `aria-controls="fw-g-${esc(it.id)}"` : ''} aria-label="${open ? 'Collapse' : 'Expand'} ${esc(it.name)}"${m ? ' disabled' : ''}>${icon('chevron-right')}</button>` : '<span class="fw-toggle fw-toggle--leaf" aria-hidden="true"></span>'}
            <span class="fw-type fw-type--${it.type}" title="${store.FW_TYPES[it.type]}">${icon(TYPE_ICON[it.type])}<span class="sr-only">${store.FW_TYPES[it.type]}: </span></span>
            ${name}
            <span class="fw-node__meta">${it.ageBand ? `<span class="fw-age">${esc(it.ageBand)}</span>` : ''}${count != null ? `<span class="fw-count" title="${it.type === 'area' ? 'Sub-areas' : 'Outcomes and milestones'}">${count}</span>` : ''}${isHidden ? `<span class="fw-hid">${icon('eye-off')}Hidden</span>` : inheritsHidden ? `<span class="fw-hid fw-hid--inherit" title="Hidden because ${esc(inheritsHidden.name)} is hidden">${icon('eye-off')}Hidden by parent</span>` : ''}${it.type === 'material' && !it.materialId ? '<span class="fw-unlinked" title="Not in the school’s materials inventory">Not in inventory</span>' : ''}</span>
            ${edit && renaming !== it.id ? `<span class="fw-acts">
              ${allowed.length ? `<button class="btn btn--icon-ghost btn--sm" type="button" data-add="${esc(it.id)}" aria-label="Add inside ${esc(it.name)}" title="Add">${icon('plus')}</button>` : ''}
              <button class="btn btn--icon-ghost btn--sm" type="button" data-rename aria-label="Rename ${esc(it.name)}" title="Rename">${icon('pencil')}</button>
              <button class="btn btn--icon-ghost btn--sm" type="button" data-vis aria-label="${isHidden ? 'Show' : 'Hide'} ${esc(it.name)}" aria-pressed="${isHidden}" title="${isHidden ? 'Show' : 'Hide'}">${icon(isHidden ? 'eye-off' : 'eye')}</button>
              <span class="menu-wrap"><button class="btn btn--icon-ghost btn--sm" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="More actions for ${esc(it.name)}" data-menu>${icon('more')}</button>
                <span class="menu" role="menu" hidden>
                  <button type="button" role="menuitem" data-up>${icon('arrow-up', 'icon--sm')}Move up</button>
                  <button type="button" role="menuitem" data-down>${icon('arrow-down', 'icon--sm')}Move down</button>
                  ${it.type !== 'area' ? `<button type="button" role="menuitem" data-moveto>${icon('move', 'icon--sm')}Move to…</button>` : ''}
                  <hr><button type="button" role="menuitem" class="is-danger" data-del>${icon('trash', 'icon--sm')}Delete…</button>
                </span></span></span>` : ''}
          </div>${open ? kidsHtml : ''}${emptyBranch}</li>`;
      };
      return `<ul class="fw-tree" role="list" aria-label="${esc(f.name)}">${kidsOf(f, null).map(a => node(a, 1)).join('')}</ul>`;
    }
    const hl = (text, m) => {
      if (!m) return esc(text);
      const i = text.toLowerCase().indexOf(q.trim().toLowerCase());
      return i < 0 ? esc(text) : `${esc(text.slice(0, i))}<mark>${esc(text.slice(i, i + q.trim().length))}</mark>${esc(text.slice(i + q.trim().length))}`;
    };

    function details(f, edit) {
      const it = item(selected);
      if (!it) return `<div class="fw-d-empty">${icon('layers')}<p>Select an item in the framework tree to view its details.</p></div>`;
      const p = pathOf(f, it.id).slice(0, -1);
      const usage = store.frameworkItemUsage(f.id, it.id);
      const hb = hiddenBy(f, it.id);
      const kids = kidsOf(f, it.id);
      const inv = store.getMaterials();
      const mat = it.type === 'material' ? inv.find(m => m.id === it.materialId) : null;
      const editable = edit;
      const ages = f.ageBands || [];
      const field = (id, label, control, hint = '') => `<div class="field"><label class="field__label" for="${id}">${label}</label>${control}${hint ? `<p class="field__hint">${hint}</p>` : ''}<p class="field__hint field__hint--error" data-error-for="${id.replace('fwd-', '')}" hidden></p></div>`;
      const ro = (k, v) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`;
      const mats = it.type === 'subarea' ? kids.filter(k => k.type === 'material') : it.type === 'outcome' || it.type === 'milestone' ? kidsOf(f, it.parentId).filter(k => k.type === 'material') : [];
      const matList = mats.length ? `<ul class="fw-d-list">${mats.map(k => `<li>${icon('shapes', 'icon--sm')}<button class="fw-link" type="button" data-goto="${esc(k.id)}">${esc(k.name)}</button>${k.materialId ? '' : ' <small>not in inventory</small>'}</li>`).join('')}</ul>` : '<p class="cp-muted">None linked.</p>';
      const usageText = usage ? [usage.self.observations && plural(usage.self.observations, 'observation'), usage.self.milestones && plural(usage.self.milestones, 'child milestone'), usage.self.activities && plural(usage.self.activities, 'lesson activity', 'lesson activities')].filter(Boolean).join(', ') || 'Not used yet' : '—';
      const form = editable ? `<form class="fw-d-form" data-itemform novalidate>
          ${field('fwd-name', 'Name <span class="field__req" aria-hidden="true">*</span>', `<input class="input" id="fwd-name" name="name" maxlength="120" required value="${esc(it.name)}">`)}
          ${it.type !== 'material' ? `<div class="fw-d-row">${field('fwd-code', 'Code', `<input class="input" id="fwd-code" name="code" maxlength="24" value="${esc(it.code)}" autocomplete="off" spellcheck="false">`, 'Unique in this framework. Stays when you rename.')}${field('fwd-ageBand', 'Age band', `<select class="input" id="fwd-ageBand" name="ageBand"><option value="">None</option>${ages.map(a => `<option${a === it.ageBand ? ' selected' : ''}>${esc(a)}</option>`).join('')}${it.ageBand && !ages.includes(it.ageBand) ? `<option selected>${esc(it.ageBand)}</option>` : ''}</select>`, ages.length ? 'This framework’s own age bands.' : 'This framework has no age bands.')}</div>` : field('fwd-materialId', 'Inventory material', `<select class="input" id="fwd-materialId" name="materialId"><option value="">Not in the school’s inventory</option>${inv.map(m => `<option value="${esc(m.id)}"${m.id === it.materialId ? ' selected' : ''}>${esc(m.name)} · ${esc(m.area)}</option>`).join('')}</select>`, 'From Rooms &amp; Resources.')}
          ${field('fwd-description', 'Description', `<textarea class="input" id="fwd-description" name="description" rows="3" maxlength="1000">${esc(it.description)}</textarea>`)}
          <div class="fw-d-save"><button class="btn btn--primary btn--sm" type="submit">Save changes</button><span class="fw-d-status" data-savestatus role="status"></span></div>
        </form>` : '';
      return `<div class="fw-d">
        <div class="fw-d-top"><span class="fw-type fw-type--${it.type}">${icon(TYPE_ICON[it.type])}</span><div><p class="fw-d-kind">${store.FW_TYPES[it.type]}${p.length ? ` · ${p.map(x => esc(x.name)).join(' › ')}` : ''}</p><h2 class="fw-d-h" id="fw-d-h">${esc(it.name)}</h2></div></div>
        ${it.hidden ? `<p class="wt-banner wt-banner--neutral">${icon('eye-off')}<span><b>Hidden.</b> Not offered for new observations or milestones. Records that already use it keep it.</span></p>` : hb ? `<p class="wt-banner wt-banner--neutral">${icon('eye-off')}<span><b>Hidden by ${esc(hb.name)}.</b> It isn’t offered while its parent is hidden. Its own setting is Visible.</span></p>` : ''}
        ${form}
        <dl class="token-sheet fw-d-dl">
          ${editable ? '' : ro('Name', esc(it.name)) + (it.type !== 'material' ? ro('Code', esc(it.code || '—')) + ro('Age band', esc(it.ageBand || '—')) : ro('Inventory', mat ? esc(mat.name) : 'Not in the school’s inventory')) + ro('Description', esc(it.description || '—'))}
          ${p.length ? ro(it.type === 'subarea' ? 'Area' : 'Area › Sub-area', p.map(x => esc(x.name)).join(' › ')) : ''}
          ${ro('Visibility', it.hidden ? 'Hidden' : hb ? `Visible (hidden by ${esc(hb.name)})` : 'Visible')}
          ${it.type === 'area' ? ro('Sub-areas', kids.length ? kids.map(k => `<button class="fw-link" type="button" data-goto="${esc(k.id)}">${esc(k.name)}</button>`).join(', ') : 'None yet') : ''}
          ${it.type === 'subarea' ? ro('Outcomes & milestones', String(kids.filter(k => k.type !== 'material').length)) : ''}
          ${['subarea', 'outcome', 'milestone'].includes(it.type) ? ro(it.type === 'subarea' ? 'Linked materials' : 'Materials (sub-area)', matList) : ''}
          ${it.type === 'material' ? ro('Linked to', p.length ? `<button class="fw-link" type="button" data-goto="${esc(p[p.length - 1].id)}">${esc(p[p.length - 1].name)}</button>` : '—') : ''}
          ${ro('Used by', esc(usageText))}
          ${ro('Created', esc(when(it.createdAt)))}${ro('Last updated', esc(when(it.updatedAt)))}
          ${ro('Item ID', `<code class="mk-tag">${esc(it.id)}</code>${it.sourceId ? ` <small>template ${esc(it.sourceId)}</small>` : ''}`)}
        </dl>
        ${editable ? `<div class="fw-d-acts"><button class="btn btn--secondary btn--sm" type="button" data-vis>${icon(it.hidden ? 'eye' : 'eye-off', 'icon--sm')}${it.hidden ? 'Show' : 'Hide'}</button>${store.FW_CHILDREN[it.type].length ? `<button class="btn btn--secondary btn--sm" type="button" data-add="${esc(it.id)}">${icon('plus', 'icon--sm')}Add inside</button>` : ''}<button class="btn btn--tertiary btn--sm fw-d-del" type="button" data-del>${icon('trash', 'icon--sm')}Delete</button></div>` : ''}
      </div>`;
    }

    // Below 1024px the details open in a side drawer (the same content, kept in sync).
    function openDrawer() {
      if (!mqNarrow.matches || !item(selected)) return;
      if (drawer) { drawer.refresh(); return; }
      const opener = document.activeElement;
      const el = document.createElement('dialog');
      el.className = 'drawer fw-drawer';
      el.setAttribute('aria-labelledby', 'fw-dr-title');
      el.innerHTML = `<div class="drawer__panel"><div class="drawer__head"><h2 id="fw-dr-title">Item details</h2><button class="btn btn--icon-ghost" type="button" aria-label="Close details" data-close>${icon('x')}</button></div><div class="drawer__body" data-body></div></div>`;
      document.body.appendChild(el);
      const body = el.querySelector('[data-body]');
      const close = () => { if (!el.isConnected || el.classList.contains('is-closing')) return; el.classList.add('is-closing'); drawer = null; const done = () => { el.close(); el.remove(); const back = main.querySelector(`[data-node="${CSS.escape(selected)}"] [data-select]`) || (document.contains(opener) ? opener : null); back?.focus(); }; reduceMotion.matches ? done() : setTimeout(done, 170); };
      el.addEventListener('cancel', e => { e.preventDefault(); close(); });
      el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-close]')) close(); });
      bindDetails(body);
      drawer = { el, close, refresh() { const f = fw(); if (!f || !item(selected)) { close(); return; } body.innerHTML = details(f, canEdit()); } };
      drawer.refresh();
      el.showModal();
      body.querySelector('input, select, textarea, button')?.focus();
    }

    /* ----------------------------- Actions */

    const guard = () => { if (store.canEditFramework(me()) && !mqPhone.matches) return true; toast('View only', mqPhone.matches ? 'Edit the framework on a tablet or computer.' : FAIL.forbidden, 'lock'); return false; };
    const select = (id, { focusRow = true } = {}) => {
      selected = id;
      const f = fw();
      pathOf(f, id).slice(0, -1).forEach(p => expanded.add(p.id));
      saveExpanded();
      syncUrl();
      draw();
      if (focusRow) main.querySelector(`[data-node="${CSS.escape(id)}"] [data-select]`)?.focus();
      openDrawer();
    };
    async function run(promise, okTitle, okText, { onOk } = {}) {
      if (busy) return null;
      busy = true;
      const r = await promise;
      busy = false;
      if (!r.ok) {
        if (['stale', 'missing'].includes(r.reason)) draw();
        if (r.reason !== 'invalid' || !r.errors) toast('Not saved', failText(r), 'alert-circle', { duration: 7000 });
        return r;
      }
      onOk?.(r);
      draw();
      if (okTitle && !r.unchanged) toast(okTitle, okText(r), 'check-circle');
      return r;
    }

    function addDialog(parentId) {
      const f = fw();
      const parent = parentId ? item(parentId) : null;
      const types = store.FW_CHILDREN[parent ? parent.type : 'root'];
      if (!types.length) return;
      const inv = store.getMaterials();
      const ages = f.ageBands || [];
      const d = kids.dialog({
        label: 'Learning framework', title: parent ? `Add to ${parent.name}` : 'Add area', desc: parent ? `${store.FW_TYPES[parent.type]} · ${esc(pathOf(f, parent.id).map(x => x.name).join(' › '))}` : 'Areas sit at the top of the framework.',
        body: `<div class="cls-form">
          ${types.length > 1 ? `<fieldset class="an-fs"><legend class="field__label">What are you adding?</legend><div class="fw-typepick">${types.map((t, i) => `<label class="an-pick"><input type="radio" name="type" value="${t}"${i === 0 ? ' checked' : ''}><span>${icon(TYPE_ICON[t], 'icon--sm')}<b>${store.FW_TYPES[t]}</b></span></label>`).join('')}</div><p class="field__hint field__hint--error" data-error-for="type" hidden></p></fieldset>` : `<input type="hidden" name="type" value="${types[0]}">`}
          <div data-matbox hidden>${kids.field('kd-materialId', 'Material from the inventory', `<select class="input" id="kd-materialId" name="materialId"><option value="">Not in the inventory — name it below</option>${inv.map(m => `<option value="${esc(m.id)}">${esc(m.name)} · ${esc(m.area)}</option>`).join('')}</select>`, { hint: 'Materials come from Rooms & Resources. They’re linked to this sub-area, not turned into outcomes.' })}</div>
          ${kids.field('kd-name', 'Name', `<input class="input" id="kd-name" name="name" maxlength="120" required>`, { required: true })}
          <div class="cls-form__row" data-codebox>${kids.field('kd-code', 'Code', '<input class="input" id="kd-code" name="code" maxlength="24" autocomplete="off" spellcheck="false">', { hint: 'Optional. Must be unique in this framework.' })}${kids.field('kd-ageBand', 'Age band', `<select class="input" id="kd-ageBand" name="ageBand"><option value="">None</option>${ages.map(a => `<option>${esc(a)}</option>`).join('')}</select>`)}</div>
          ${kids.field('kd-description', 'Description', '<textarea class="input" id="kd-description" name="description" rows="2" maxlength="1000"></textarea>')}</div>`,
        submit: 'Add',
        async onSubmit(form) {
          const type = form.querySelector('[name="type"]:checked, [name="type"][type="hidden"]').value;
          const input = { parentId: parent?.id || null, type, name: form.elements.name.value, code: form.elements.code.value, ageBand: form.elements.ageBand.value, description: form.elements.description.value, materialId: type === 'material' ? form.elements.materialId.value : '' };
          if (type === 'material' && !input.name && !input.materialId) return { ok: false, errors: { name: 'Choose a material or enter its name.' } };
          const r = await store.addFrameworkItem(me(), f.id, input, { rev: f.rev, fail: takeFail('save') });
          if (!r.ok) return r.errors ? { ok: false, errors: r.errors } : { ok: false, message: `Nothing was added. ${failText(r)}` };
          if (parent) expanded.add(parent.id);
          select(r.item.id);
          toast(`${store.FW_TYPES[r.item.type]} added`, `${r.item.name}${parent ? ` · in ${parent.name}` : ''}`, 'check-circle');
          return { ok: true };
        }
      });
      const sync = () => {
        const t = d.form.querySelector('[name="type"]:checked, [name="type"][type="hidden"]').value;
        d.form.querySelector('[data-matbox]').hidden = t !== 'material';
        d.form.querySelector('[data-codebox]').hidden = t === 'material';
      };
      d.form.addEventListener('change', e => {
        if (e.target.name === 'type') sync();
        if (e.target.name === 'materialId' && e.target.value && !d.form.elements.name.value) d.form.elements.name.value = inv.find(m => m.id === e.target.value)?.name || '';
      });
      sync();
    }

    async function saveRename(id, value) {
      const f = fw();
      const it = item(id);
      if (!it) { renaming = ''; draw(); return; }
      const name = value.trim();
      if (!name) { toast('Name needed', 'An item can’t have an empty name. Press Escape to keep the old one.', 'alert-circle'); return; }
      const r = await store.updateFrameworkItem(me(), f.id, id, { name }, { rev: f.rev, fail: takeFail('save') });
      if (!r.ok) { toast('Not renamed', failText(r), 'alert-circle', { duration: 7000 }); return; }
      renaming = '';
      draw();
      main.querySelector(`[data-node="${CSS.escape(id)}"] [data-select]`)?.focus();
      if (!r.unchanged) toast('Renamed', `${it.name} → ${r.item.name}. Records that use it show the new name.`, 'check-circle');
    }

    async function move(id, parentId, index) {
      const f = fw();
      const it = item(id);
      const r = await run(store.moveFrameworkItem(me(), f.id, id, { parentId, index }, { rev: f.rev, fail: takeFail('move') }), 'Moved', x => (x.item.parentId === it.parentId ? `${it.name} is now number ${index + 1}.` : `${it.name} moved to ${item(x.item.parentId)?.name || 'the top level'}.`), { onOk: x => { if (x.item.parentId) expanded.add(x.item.parentId); saveExpanded(); } });
      if (r?.ok) main.querySelector(`[data-node="${CSS.escape(id)}"] [data-select]`)?.focus();
      return r;
    }
    function siblings(f, it) { return f.items.filter(i => (i.parentId || null) === (it.parentId || null)).sort((a, b) => a.order - b.order); }

    function moveToDialog(it) {
      const f = fw();
      const parentType = { subarea: 'area', outcome: 'subarea', milestone: 'subarea', material: 'subarea' }[it.type];
      const targets = f.items.filter(i => i.type === parentType).map(i => ({ id: i.id, label: pathOf(f, i.id).map(x => x.name).join(' › ') }));
      kids.dialog({
        label: 'Learning framework / Move', title: `Move ${it.name}`, desc: `${store.FW_TYPES[it.type]}s can only go inside a ${store.FW_TYPES[parentType].toLowerCase()}. Its ID, tags and history stay the same.`,
        body: kids.field('kd-parent', `New ${store.FW_TYPES[parentType].toLowerCase()}`, `<select class="input" id="kd-parent" name="parent">${targets.map(t => `<option value="${esc(t.id)}"${t.id === it.parentId ? ' selected' : ''}>${esc(t.label)}${t.id === it.parentId ? ' (current)' : ''}</option>`).join('')}</select>`),
        submit: 'Move',
        async onSubmit(form) {
          const to = form.elements.parent.value;
          if (to === it.parentId) return { ok: true };
          const r = await store.moveFrameworkItem(me(), f.id, it.id, { parentId: to }, { rev: f.rev, fail: takeFail('move') });
          if (!r.ok) return { ok: false, message: failText(r) };
          expanded.add(to);
          select(it.id);
          toast('Moved', `${it.name} is now in ${item(to)?.name}.`, 'check-circle');
          return { ok: true };
        }
      });
    }

    function visibility(it) {
      const f = fw();
      const hide = !it.hidden;
      const desc = descendants(f, it.id);
      const usage = store.frameworkItemUsage(f.id, it.id);
      const doIt = () => run(store.setFrameworkItemHidden(me(), f.id, it.id, hide, { rev: f.rev, fail: takeFail('hide') }), hide ? 'Hidden' : 'Shown', () => (hide ? `${it.name} won’t be offered for new observations or milestones. Existing records keep it.` : `${it.name} is available for new observations and milestones again${hiddenBy(fw(), it.id) ? ', once its hidden parent is shown' : ''}.`));
      if (hide && (desc.length || usage.subtree.total)) {
        kids.dialog({
          label: 'Learning framework', title: `Hide ${it.name}?`,
          desc: `${desc.length ? `The ${plural(desc.length, 'item')} inside it won’t be offered either while it’s hidden. Their own settings aren’t changed, so showing it again brings them back as they were. ` : ''}${usage.subtree.total ? `${plural(usage.subtree.total, 'existing record')} that use${usage.subtree.total === 1 ? 's' : ''} it stay${usage.subtree.total === 1 ? 's' : ''} as they are.` : ''}`,
          body: '', submit: 'Hide',
          async onSubmit() { const r = await store.setFrameworkItemHidden(me(), f.id, it.id, true, { rev: f.rev, fail: takeFail('hide') }); if (!r.ok) return { ok: false, message: failText(r) }; draw(); toast('Hidden', `${it.name} won’t be offered for new observations or milestones.`, 'check-circle'); return { ok: true }; }
        });
        return;
      }
      doIt();
    }

    function deleteDialog(it) {
      const f = fw();
      const usage = store.frameworkItemUsage(f.id, it.id);
      const u = usage.subtree;
      if (u.total) {
        const parts = [u.observations && plural(u.observations, 'observation'), u.milestones && plural(u.milestones, 'child milestone record'), u.activities && plural(u.activities, 'lesson activity', 'lesson activities')].filter(Boolean).join(', ');
        const d = kids.dialog({
          label: 'Learning framework / Delete', title: u.observations ? 'This item is linked to existing observations and cannot be deleted.' : 'This item is in use and cannot be deleted.',
          desc: `${esc(it.name)}${usage.descendants ? ' or an item inside it' : ''} is used by ${esc(parts)}. Those records must keep their history, so the item stays. Hiding it stops it being offered for new observations and milestones.`,
          body: '', submit: 'Hide instead',
          async onSubmit() {
            if (it.hidden) return { ok: true };
            const r = await store.setFrameworkItemHidden(me(), f.id, it.id, true, { rev: f.rev, fail: takeFail('hide') });
            if (!r.ok) return { ok: false, message: failText(r) };
            draw();
            toast('Hidden instead', `${it.name} is kept for existing records and no longer offered for new ones.`, 'eye-off');
            return { ok: true };
          }
        });
        if (it.hidden) { d.form.querySelector('[type="submit"]').textContent = 'Close'; d.form.querySelector('.modal__desc').insertAdjacentHTML('beforeend', ' It’s already hidden.'); }
        d.form.querySelector('[type="submit"]').focus();
        return;
      }
      kids.dialog({
        label: 'Learning framework / Delete', title: `Delete ${it.name}?`, danger: true,
        desc: `${usage.descendants ? `This also deletes the ${plural(usage.descendants, 'item')} inside it. ` : ''}Nothing uses ${usage.descendants ? 'them' : 'it'} yet, so no records are affected. The deletion is recorded in the change history. This can’t be undone.`,
        body: '', submit: 'Delete',
        async onSubmit() {
          const r = await store.deleteFrameworkItem(me(), f.id, it.id, { rev: f.rev, fail: takeFail('delete') });
          if (!r.ok) { if (r.reason === 'linked') { setTimeout(() => deleteDialog(item(it.id) || it), 0); return { ok: true }; } return { ok: false, message: `Nothing was deleted. ${failText(r)}` }; }
          if (selected === it.id || descendants(f, it.id).some(x => x.id === selected)) selected = it.parentId || '';
          syncUrl();
          draw();
          (selected ? main.querySelector(`[data-node="${CSS.escape(selected)}"] [data-select]`) : $('#fw-q'))?.focus();
          toast('Deleted', `${it.name}${r.removed > 1 ? ` and ${plural(r.removed - 1, 'item')} inside it` : ''}`, 'check-circle');
          return { ok: true };
        }
      });
    }

    /* ----------------------------- Change framework */

    function changeDialog() {
      const list = store.getFrameworks();
      const activeId = store.activeFrameworkId();
      const editor = store.canEditFramework(me());
      if (list.length < 2 && activeId) {
        const d = kids.dialog({ label: 'Learning framework', title: 'Only one framework installed', desc: `${esc(list[0].name)} v${esc(list[0].version)} is the school’s only framework, and it’s active.`, body: `<p class="cd-note">${editor ? 'Import another framework from the library first — it’s added alongside this one and stays inactive until you choose it here.' : 'A school leader can import another framework.'}</p>`, submit: editor && !mqPhone.matches ? 'Import from library' : 'Close', async onSubmit() { if (editor && !mqPhone.matches) setTimeout(importDrawer, 0); return { ok: true }; } });
        d.form.querySelector('[type="submit"]').focus();
        return;
      }
      const d = kids.dialog({
        label: 'Learning framework', title: editor ? 'Change framework' : 'Frameworks',
        desc: 'The active framework decides which outcomes and milestones are offered for new observations, milestones and lesson activities. Existing records keep the framework and version they were made with — nothing is remapped.',
        body: `<fieldset class="an-fs"><legend class="sr-only">Installed frameworks</legend><div class="fw-fwlist">${list.map(x => `<label class="an-pick fw-fwopt"><input type="radio" name="fw" value="${esc(x.id)}"${x.id === (fwId || activeId) ? ' checked' : ''}><span><b>${esc(x.name)} · v${esc(x.version)}</b>${x.id === activeId ? ' <span class="badge badge--plain an-chip an-chip--success">Active</span>' : ''}<small>${esc(x.type || '')}${x.source ? ` · ${esc(x.source.provider)}` : ' · created in this school'} · ${x.items.filter(i => i.type === 'outcome').length} outcomes · updated ${esc(when(x.updatedAt))}</small>${x.description ? `<small>${esc(x.description)}</small>` : ''}</span></label>`).join('')}</div></fieldset>
          <div data-impact aria-live="polite"></div>`,
        submit: 'View',
        async onSubmit(form) {
          const id = form.querySelector('[name="fw"]:checked')?.value;
          const mode = form.dataset.mode;
          if (!id) return { ok: false, message: 'Choose a framework.' };
          if (mode !== 'activate') { fwId = id; selected = ''; loadExpanded(); syncUrl(); draw(); return { ok: true }; }
          const r = await store.setActiveFramework(me(), id, { fail: takeFail('activate') });
          if (!r.ok) return { ok: false, message: `The active framework wasn’t changed. ${failText(r)}` };
          fwId = id; selected = ''; loadExpanded(); syncUrl(); draw();
          toast('Active framework changed', `${r.framework.name} v${r.framework.version} is now offered for new observations and milestones. Earlier records keep their original framework.`, 'check-circle', { duration: 8000 });
          return { ok: true };
        }
      });
      const btn = d.form.querySelector('[type="submit"]');
      const sync = () => {
        const id = d.form.querySelector('[name="fw"]:checked')?.value;
        const box = d.form.querySelector('[data-impact]');
        if (!editor || !id || id === activeId) { d.form.dataset.mode = 'view'; btn.textContent = 'View'; box.innerHTML = id === activeId ? '<p class="cd-note">This is the active framework.</p>' : ''; return; }
        const imp = store.frameworkSwitchImpact(id);
        const refs = imp.refs;
        d.form.dataset.mode = 'activate';
        btn.textContent = 'Make active';
        box.innerHTML = `<div class="wt-banner wt-banner--warn">${icon('alert-triangle')}<div><p><b>Before you switch to ${esc(imp.target.name)} v${esc(imp.target.version)}</b></p><ul class="fw-impact">
          <li>New observations and milestones will only offer its ${plural(imp.target.outcomes, 'outcome')} and ${plural(imp.target.milestones, 'milestone')}.</li>
          ${refs.total ? `<li>${[refs.observations && plural(refs.observations, 'observation'), refs.milestones && plural(refs.milestones, 'child milestone'), refs.activities && plural(refs.activities, 'lesson activity', 'lesson activities')].filter(Boolean).join(', ')} stay linked to ${esc(imp.current.name)} v${esc(imp.current.version)} and are shown with that context.</li>` : '<li>No existing records use the current framework.</li>'}
          ${imp.sameAgeBands ? '' : '<li>The two frameworks use different age bands. Nothing is converted between them.</li>'}
          <li>${esc(imp.current?.name || 'The current framework')} isn’t deleted. You can switch back at any time.</li></ul>
          <p class="fw-viewonly"><button class="btn btn--tertiary btn--sm" type="button" data-justview>Just view it, don’t switch</button></p></div></div>`;
        box.querySelector('[data-justview]').addEventListener('click', () => { fwId = id; selected = ''; loadExpanded(); syncUrl(); d.close(); draw(); });
      };
      d.form.addEventListener('change', sync);
      sync();
    }

    /* ----------------------------- Import from library (P15) */

    function importDrawer() {
      if (!guard()) return;
      const opener = document.activeElement;
      const el = document.createElement('dialog');
      el.className = 'drawer fw-lib';
      el.setAttribute('aria-labelledby', 'fw-lib-title');
      el.innerHTML = `<div class="drawer__panel"><div class="drawer__head"><h2 id="fw-lib-title">Import from library</h2><button class="btn btn--icon-ghost" type="button" aria-label="Close the library" data-close>${icon('x')}</button></div><div class="drawer__body" data-body></div><div class="drawer__foot" data-foot hidden></div></div>`;
      document.body.appendChild(el);
      const body = el.querySelector('[data-body]');
      const foot = el.querySelector('[data-foot]');
      let working = false;
      const close = () => { if (working || !el.isConnected || el.classList.contains('is-closing')) return; el.classList.add('is-closing'); const done = () => { el.close(); el.remove(); if (document.contains(opener)) opener.focus(); }; reduceMotion.matches ? done() : setTimeout(done, 170); };
      el.addEventListener('cancel', e => { e.preventDefault(); close(); });
      el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-close]')) close(); });
      el.showModal();
      let templates = [];
      let tq = '';
      let ttype = '';
      const setFoot = html => { foot.hidden = !html; foot.innerHTML = html; };

      async function list() {
        body.innerHTML = `<p class="cd-note">Loading the platform template library…</p>${'<span class="skeleton fw-skel fw-skel--card"></span>'.repeat(3)}`;
        setFoot('');
        const r = await store.platformTemplates({ fail: takeFail('library') });
        if (!r.ok) { body.innerHTML = state('alert-circle', 'The library isn’t available', FAIL.unavailable, '<button class="btn btn--primary" type="button" data-relist>Try again</button>', 'error'); body.querySelector('[data-relist]').addEventListener('click', list); return; }
        templates = r.templates;
        drawList(r.demo);
      }
      function drawList(demo) {
        const types = [...new Set(templates.map(t => t.type))];
        const shown = templates.filter(t => (!tq || `${t.name} ${t.description} ${t.provider}`.toLowerCase().includes(tq)) && (!ttype || t.type === ttype));
        const cur = fw();
        body.innerHTML = `${demo ? `<p class="wt-banner wt-banner--warn">${icon('info')}<span><b>Demo library.</b> The platform template library (P15) isn’t connected in this prototype. These templates are demo content written for testing, not official frameworks.</span></p>` : ''}
          <div class="mk-tools"><div class="field mk-tools__q"><label class="sr-only" for="fw-lq">Search templates</label><div class="input-wrap input-wrap--lead">${icon('search')}<input class="input" id="fw-lq" type="search" placeholder="Search templates" value="${esc(tq)}"></div></div>
          <div class="field"><label class="sr-only" for="fw-lt">Type</label><select class="input" id="fw-lt"><option value="">All types</option>${types.map(t => `<option${t === ttype ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div></div>
          ${!templates.length ? state('layers', 'No templates in the library', 'The platform library has no framework templates yet.') : !shown.length ? state('search', 'No templates match', 'Try another search or type.') : `<ul class="fw-tpls">${shown.map(t => {
            const installed = store.getFrameworks().filter(x => x.source?.templateId === t.id);
            const compat = cur ? (JSON.stringify(cur.ageBands) === JSON.stringify(t.ageBands) ? 'Same age bands as the framework you’re viewing' : 'Different age bands from the framework you’re viewing — merging adds them, nothing is converted') : 'No framework yet';
            return `<li class="fw-tpl"><div class="fw-tpl__top"><b>${esc(t.name)}</b><span class="fw-head__ver">v${esc(t.version)}</span></div>
              <p class="fw-tpl__meta">${esc(t.type)} · ${esc(t.provider)} · ${t.counts.areas} areas · ${t.counts.outcomes} outcomes · ${t.counts.milestones} milestones · ${t.counts.materials} materials</p>
              <p class="fw-tpl__desc">${esc(t.description)}</p>
              <p class="fw-tpl__meta">${icon('info', 'icon--sm')}${esc(compat)}${installed.length ? ` · already installed as ${esc(installed.map(x => x.name).join(', '))}` : ''}</p>
              <button class="btn btn--secondary btn--sm" type="button" data-preview="${esc(t.id)}">Preview</button></li>`;
          }).join('')}</ul>`}`;
        const qi = body.querySelector('#fw-lq');
        qi?.addEventListener('input', () => { tq = qi.value.trim().toLowerCase(); const pos = qi.selectionStart; drawList(demo); const n = body.querySelector('#fw-lq'); n.focus(); n.setSelectionRange(pos, pos); });
        body.querySelector('#fw-lt')?.addEventListener('change', e => { ttype = e.target.value; drawList(demo); body.querySelector('#fw-lt').focus(); });
        body.querySelectorAll('[data-preview]').forEach(b => b.addEventListener('click', () => preview(templates.find(t => t.id === b.dataset.preview))));
        setFoot('');
        (body.querySelector('#fw-lq') || body.querySelector('button'))?.focus();
      }
      function preview(t) {
        const open = new Set(t.items.filter(i => i.type === 'area').slice(0, 1).map(i => i.id));
        const drawTree = () => {
          const node = (it, lvl) => {
            const kids = t.items.filter(i => i.parentId === it.id);
            const isOpen = open.has(it.id);
            return `<li class="fw-tree__item fw-t--${it.type}" style="--lvl:${lvl}"><div class="fw-row">${kids.length ? `<button class="fw-toggle" type="button" data-ptoggle="${esc(it.id)}" aria-expanded="${isOpen}" aria-label="${isOpen ? 'Collapse' : 'Expand'} ${esc(it.name)}">${icon('chevron-right')}</button>` : '<span class="fw-toggle fw-toggle--leaf" aria-hidden="true"></span>'}<span class="fw-type fw-type--${it.type}">${icon(TYPE_ICON[it.type])}<span class="sr-only">${store.FW_TYPES[it.type]}: </span></span><span class="fw-node__name fw-node__name--ro">${it.code ? `<span class="fw-code">${esc(it.code)}</span>` : ''}<span class="fw-node__text">${esc(it.name)}</span></span><span class="fw-node__meta">${it.ageBand ? `<span class="fw-age">${esc(it.ageBand)}</span>` : ''}</span></div>${isOpen && kids.length ? `<ul class="fw-tree__group" role="list">${kids.map(k => node(k, lvl + 1)).join('')}</ul>` : ''}</li>`;
          };
          return `<ul class="fw-tree fw-tree--preview" role="list" aria-label="Preview of ${esc(t.name)}">${t.items.filter(i => !i.parentId).map(a => node(a, 1)).join('')}</ul>`;
        };
        const cur = fw();
        const paint = () => {
          body.innerHTML = `<button class="btn btn--tertiary btn--sm" type="button" data-back>${icon('arrow-left', 'icon--sm')}All templates</button>
            <div><h3 class="fw-tpl__h">${esc(t.name)} <span class="fw-head__ver">v${esc(t.version)}</span></h3><p class="fw-tpl__meta">${esc(t.type)} · ${esc(t.provider)} · age bands: ${esc(t.ageBands.join(', '))}</p><p class="fw-tpl__desc">${esc(t.description)}</p></div>
            <p class="cd-note">Read-only preview — nothing changes until you choose an option below.</p>${drawTree()}`;
          body.querySelector('[data-back]').addEventListener('click', () => drawList(templates.every(x => x.demo)));
          body.querySelectorAll('[data-ptoggle]').forEach(b => b.addEventListener('click', () => { const id = b.dataset.ptoggle; open.has(id) ? open.delete(id) : open.add(id); paint(); body.querySelector(`[data-ptoggle="${CSS.escape(id)}"]`)?.focus(); }));
        };
        paint();
        setFoot(`<button class="btn btn--secondary" type="button" data-asnew>Import as new</button>${cur ? `<button class="btn btn--primary" type="button" data-merge>Merge into ${esc(cur.name)}</button>` : ''}`);
        foot.querySelector('[data-asnew]').addEventListener('click', () => asNew(t));
        foot.querySelector('[data-merge]')?.addEventListener('click', () => mergeReview(t));
        body.querySelector('[data-back]').focus();
      }
      async function asNew(t, confirmCopy = false) {
        const noneActive = !store.activeFrameworkId();
        working = true;
        setFoot('<span class="cd-note" role="status"><span class="spinner" aria-hidden="true"></span> Importing…</span>');
        const r = await store.importFrameworkTemplate(me(), t.id, { activate: noneActive, confirmCopy, fail: takeFail('import') });
        working = false;
        if (r.reason === 'exists') {
          setFoot(`<button class="btn btn--secondary" type="button" data-cancelcopy>Cancel</button><button class="btn btn--primary" type="button" data-copy>Import a second copy</button>`);
          body.insertAdjacentHTML('afterbegin', `<p class="wt-banner wt-banner--warn" role="alert">${icon('alert-triangle')}<span>${esc(r.existing.name)} v${esc(r.existing.version)} is already installed from this template. A second copy gets new IDs and is kept separate.</span></p>`);
          foot.querySelector('[data-copy]').addEventListener('click', () => asNew(t, true));
          foot.querySelector('[data-cancelcopy]').addEventListener('click', () => preview(t));
          return;
        }
        if (!r.ok) {
          body.insertAdjacentHTML('afterbegin', `<p class="wt-banner wt-banner--warn" role="alert">${icon('alert-circle')}<span><b>Import failed.</b> ${esc(r.issues ? `The template has problems: ${r.issues.join('; ')}` : failText(r))} Nothing was added.</span></p>`);
          preview(t);
          return;
        }
        fwId = r.framework.id; selected = ''; expanded = new Set(); syncUrl(); draw();
        body.innerHTML = state('check-circle', `${esc(r.framework.name)} imported`, `${plural(r.framework.items.length, 'item')} added as a new framework${r.activated ? ' and made active, because the school had none' : '. The active framework hasn’t changed — use Change framework when you’re ready to switch'}.${r.unlinkedMaterials ? ` ${plural(r.unlinkedMaterials, 'material')} aren’t in the school’s inventory yet and are marked “Not in inventory”.` : ''}`);
        setFoot('<button class="btn btn--primary" type="button" data-close>Done</button>');
        foot.querySelector('[data-close]').focus();
      }
      function mergeReview(t) {
        const cur = fw();
        const plan = store.planFrameworkMerge(cur.id, t.id);
        if (!plan.ok) { body.insertAdjacentHTML('afterbegin', `<p class="wt-banner wt-banner--warn" role="alert">${icon('alert-circle')}<span>${esc(plan.issues ? `This template can’t be merged: ${plan.issues.join('; ')}` : failText(plan))}</span></p>`); return; }
        const dec = {};
        const by = s => plan.rows.filter(r => r.status === s);
        const label = r => `${icon(TYPE_ICON[r.type], 'icon--sm')}${r.code ? `<b>${esc(r.code)}</b> ` : ''}${esc(r.name)}`;
        const choice = (r, opts) => `<div class="fw-choice" role="radiogroup" aria-label="Decision for ${esc(r.name)}">${opts.map(([v, l]) => `<label><input type="radio" name="d-${esc(r.tid)}" value="${v}"${(dec[r.tid] || r.decision) === v ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
        const paint = () => {
          const open = plan.rows.filter(r => r.choices.length && !(dec[r.tid] || r.decision));
          body.innerHTML = `<button class="btn btn--tertiary btn--sm" type="button" data-back>${icon('arrow-left', 'icon--sm')}Back to preview</button>
            <div><h3 class="fw-tpl__h">Merge ${esc(t.name)} v${esc(t.version)}</h3><p class="fw-tpl__meta">into ${esc(cur.name)} v${esc(cur.version)} · existing items keep their IDs, new items get new ones</p></div>
            <dl class="wt-strip fw-mstrip"><div><dt>To add</dt><dd>${by('add').length}</dd></div><div><dt>Unchanged</dt><dd>${by('same').length}</dd></div><div><dt>Differences</dt><dd>${by('changed').length}</dd></div><div><dt>To resolve</dt><dd>${by('code-clash').length + by('lookalike').length}</dd></div></dl>
            ${plan.missingBands.length ? `<p class="wt-banner wt-banner--neutral">${icon('info')}<span>Age bands that will be added to this framework: ${esc(plan.missingBands.join(', '))}. Existing age bands aren’t changed.</span></p>` : ''}
            ${by('code-clash').length || by('lookalike').length ? `<section class="fw-msec"><h4>Needs your decision</h4><ul class="fw-mlist">${[...by('code-clash').map(r => `<li class="fw-mrow is-conflict"><p>${label(r)}</p><p class="fw-mnote">Code ${esc(r.code)} is already used by ${esc(store.FW_TYPES[r.clashWith.type].toLowerCase())} “${esc(r.clashWith.name)}”.</p>${choice(r, [['suffix', 'Add with a new code'], ['skip', 'Skip']])}</li>`), ...by('lookalike').map(r => `<li class="fw-mrow is-conflict"><p>${label(r)}</p><p class="fw-mnote">Possible duplicate: “${esc(r.lookalike.name)}”${r.lookalike.code ? ` (${esc(r.lookalike.code)})` : ''} has the same name but a different code, so it isn’t treated as the same item.</p>${choice(r, [['add', 'Add as a separate item'], ['skip', 'Skip']])}</li>`)].join('')}</ul></section>` : ''}
            ${by('changed').length ? `<section class="fw-msec"><h4>Your version differs from the template</h4><ul class="fw-mlist">${by('changed').map(r => `<li class="fw-mrow"><p>${label(r)}</p><ul class="fw-diff">${r.diffs.map(x => `<li><b>${esc(x.field === 'ageBand' ? 'Age band' : x.field[0].toUpperCase() + x.field.slice(1))}</b><span>Yours: ${esc(x.mine || '—')}</span><span>Template: ${esc(x.theirs || '—')}</span></li>`).join('')}</ul>${choice(r, [['keep', 'Keep mine'], ['use', 'Use the template’s']])}</li>`).join('')}</ul></section>` : ''}
            ${by('add').length ? `<section class="fw-msec"><h4>Will be added</h4><ul class="fw-mlist fw-mlist--plain">${by('add').map(r => `<li>${label(r)}${r.parentTid ? ` <small>in ${esc(plan.rows.find(x => x.tid === r.parentTid)?.name || '')}</small>` : ''}</li>`).join('')}</ul></section>` : ''}
            ${!by('add').length && !by('changed').length && !by('code-clash').length && !by('lookalike').length && !plan.missingBands.length ? '<p class="cd-note">Everything in this template is already in the framework. There’s nothing to merge.</p>' : ''}`;
          body.querySelector('[data-back]').addEventListener('click', () => preview(t));
          body.querySelectorAll('.fw-choice input').forEach(i => i.addEventListener('change', () => { dec[i.name.slice(2)] = i.value; const st = body.scrollTop; paint(); body.scrollTop = st; body.querySelector(`[name="${CSS.escape(i.name)}"][value="${i.value}"]`)?.focus(); }));
          setFoot(`<button class="btn btn--secondary" type="button" data-back2>Cancel</button><button class="btn btn--primary" type="button" data-apply${open.length ? ' aria-disabled="true"' : ''}>${open.length ? `Resolve ${plural(open.length, 'item')} first` : 'Merge'}</button>`);
          foot.querySelector('[data-back2]').addEventListener('click', () => preview(t));
          foot.querySelector('[data-apply]').addEventListener('click', async () => {
            if (open.length) { body.querySelector('.fw-mrow.is-conflict input')?.focus(); toast('Decisions needed', `Choose what to do with ${plural(open.length, 'item')} marked “Needs your decision”.`, 'info'); return; }
            working = true;
            setFoot('<span class="cd-note" role="status"><span class="spinner" aria-hidden="true"></span> Merging…</span>');
            const r = await store.mergeFrameworkTemplate(me(), cur.id, t.id, { decisions: dec, rev: plan.rev, fail: takeFail('merge') });
            working = false;
            if (!r.ok) { paint(); body.insertAdjacentHTML('afterbegin', `<p class="wt-banner wt-banner--warn" role="alert">${icon('alert-circle')}<span><b>Merge not applied.</b> ${esc(r.reason === 'stale' ? 'The framework changed while you were reviewing. Go back to the preview and review again.' : failText(r))} The framework is unchanged.</span></p>`); body.scrollTop = 0; return; }
            draw();
            const s = r.summary;
            body.innerHTML = state('check-circle', r.unchanged ? 'Nothing to merge' : 'Merge complete', r.unchanged ? 'The framework already had everything you chose.' : `From ${esc(t.name)} v${esc(t.version)}.`) + (r.unchanged ? '' : `<dl class="wt-strip fw-mstrip"><div><dt>Added</dt><dd>${s.added.length}</dd></div><div><dt>Updated</dt><dd>${s.updated.length}</dd></div><div><dt>Unchanged</dt><dd>${s.unchanged + s.kept}</dd></div><div><dt>Skipped</dt><dd>${s.skipped.length}</dd></div></dl>${s.added.length ? `<p class="cd-note"><b>Added:</b> ${esc(s.added.join(', '))}</p>` : ''}${s.updated.length ? `<p class="cd-note"><b>Updated from the template:</b> ${esc(s.updated.join(', '))}</p>` : ''}${s.skipped.length ? `<p class="cd-note"><b>Skipped:</b> ${esc(s.skipped.join(', '))}</p>` : ''}`);
            setFoot('<button class="btn btn--primary" type="button" data-close>Done</button>');
            foot.querySelector('[data-close]').focus();
          });
        };
        paint();
        body.querySelector('[data-back]').focus();
      }
      list();
    }

    /* ----------------------------- Change history */

    function historyDrawer() {
      const f = fw();
      const opener = document.activeElement;
      const el = document.createElement('dialog');
      el.className = 'drawer fw-hist-d';
      el.setAttribute('aria-labelledby', 'fw-h-title');
      el.innerHTML = `<div class="drawer__panel"><div class="drawer__head"><h2 id="fw-h-title">Change history</h2><button class="btn btn--icon-ghost" type="button" aria-label="Close change history" data-close>${icon('x')}</button></div><div class="drawer__body" data-body><p class="cd-note">Loading…</p></div></div>`;
      document.body.appendChild(el);
      const body = el.querySelector('[data-body]');
      const close = () => { if (!el.isConnected || el.classList.contains('is-closing')) return; el.classList.add('is-closing'); const done = () => { el.close(); el.remove(); if (document.contains(opener)) opener.focus(); }; reduceMotion.matches ? done() : setTimeout(done, 170); };
      el.addEventListener('cancel', e => { e.preventDefault(); close(); });
      el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-close]')) close(); });
      el.showModal();
      let kind = '';
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const paint = () => {
        let all;
        try {
          if (takeFail('history')) throw new Error('history');
          all = store.frameworkHistory(f.id);
        } catch {
          body.innerHTML = state('alert-circle', 'The history couldn’t be loaded', 'Nothing has changed. Try again.', '<button class="btn btn--primary btn--sm" type="button" data-hretry>Try again</button>', 'error');
          body.querySelector('[data-hretry]').addEventListener('click', paint);
          return;
        }
        const kinds = [...new Set(all.map(a => a.kind))];
        const list = all.filter(a => !kind || a.kind === kind);
        body.innerHTML = `<p class="cd-note">${esc(f.name)} v${esc(f.version)} · times in ${esc(tz)}${store.canEditFramework(me()) ? '' : ' · read only'}</p>
          ${all.length ? `<div class="field"><label class="field__label" for="fw-hk">Show</label><select class="input" id="fw-hk"><option value="">All changes (${all.length})</option>${kinds.map(k => `<option value="${k}"${k === kind ? ' selected' : ''}>${esc(store.FW_ACTIONS[k] || k)}</option>`).join('')}</select></div>` : ''}
          ${!all.length ? state('clock', 'No changes yet', 'Changes to this framework — edits, moves, hiding, imports and merges — will be listed here.') : !list.length ? state('filter', 'No changes of this kind', 'Choose another type.') : `<ol class="fw-hist">${list.map(a => `<li><p class="fw-hist__top"><span class="badge badge--plain an-chip an-chip--${a.kind === 'deleted' ? 'error' : a.kind === 'hidden' ? 'neutral' : ['imported', 'merged', 'activated'].includes(a.kind) ? 'info' : 'cat'}">${esc(a.label)}</span><time datetime="${esc(a.at)}">${esc(when(a.at))}</time></p>
            <p class="fw-hist__d">${esc(a.detail)}</p>
            ${(a.changes || []).length ? `<ul class="fw-diff">${a.changes.map(c => `<li><b>${esc(c.field === 'ageBand' ? 'Age band' : c.field)}</b><span>Before: ${esc(c.from || '—')}</span><span>After: ${esc(c.to || '—')}</span></li>`).join('')}</ul>` : a.from || a.to ? `<p class="fw-hist__m">${a.from ? `From ${esc(a.from)}` : ''}${a.from && a.to ? ' → ' : ''}${a.to ? `${a.from ? '' : 'To '}${esc(a.to)}` : ''}</p>` : ''}
            ${a.source ? `<p class="fw-hist__m">Source: P15 · ${esc(a.source)}</p>` : ''}
            <p class="fw-hist__m">${esc(a.actorName)} · ${esc(a.actorRole)}${a.itemId ? ` · <code class="mk-tag">${esc(a.itemId)}</code>` : ''}</p></li>`).join('')}</ol>`}
          <p class="cd-note">Kept in the school’s shared audit log on this device (the latest 500 entries across the school).</p>`;
        body.querySelector('#fw-hk')?.addEventListener('change', e => { kind = e.target.value; paint(); body.querySelector('#fw-hk').focus(); });
      };
      setTimeout(paint, 200);
      el.querySelector('[data-close]').focus();
    }

    /* ----------------------------- Events */

    const closeMenu = (restore = false) => { if (!openMenu) return; const b = openMenu.querySelector('[data-menu]'); openMenu.querySelector('.menu').hidden = true; b.setAttribute('aria-expanded', 'false'); openMenu.closest('.fw-row')?.classList.remove('has-menu'); openMenu = null; if (restore) b.focus(); };
    const nodeOf = t => t.closest('[data-node]')?.dataset.node || null;

    function bindDetails(root) {
      root.addEventListener('submit', async e => {
        if (!e.target.matches('[data-itemform]')) return;
        e.preventDefault();
        if (!guard()) return;
        const f = fw();
        const it = item(selected);
        const form = e.target;
        const st = form.querySelector('[data-savestatus]');
        form.querySelectorAll('[data-error-for]').forEach(h => { h.hidden = true; });
        st.innerHTML = '<span class="spinner" aria-hidden="true"></span>Saving…';
        const input = { name: form.elements.name.value, description: form.elements.description.value };
        if (form.elements.code) input.code = form.elements.code.value;
        if (form.elements.ageBand) input.ageBand = form.elements.ageBand.value;
        if (form.elements.materialId) input.materialId = form.elements.materialId.value;
        const r = await store.updateFrameworkItem(me(), f.id, it.id, input, { rev: f.rev, fail: takeFail('save') });
        if (!r.ok) {
          st.textContent = '';
          if (r.errors) { Object.entries(r.errors).forEach(([k, msg]) => { const h = form.querySelector(`[data-error-for="${k}"]`); if (h) { h.textContent = msg; h.hidden = false; } }); form.elements[Object.keys(r.errors)[0]]?.focus(); return; }
          st.innerHTML = `<span class="fw-d-err">${icon('alert-circle', 'icon--sm')}Not saved. ${esc(failText(r))}</span>`;
          if (['stale', 'missing'].includes(r.reason)) draw();
          return;
        }
        draw();
        const s2 = (drawer ? drawer.el : main).querySelector('[data-savestatus]');
        if (s2) s2.innerHTML = r.unchanged ? 'No changes to save' : `${icon('check-circle', 'icon--sm')}Saved`;
        (drawer ? drawer.el : main).querySelector('[data-itemform] [type="submit"]')?.focus();
      });
      root.addEventListener('click', e => {
        const t = e.target;
        const go = t.closest('[data-goto]');
        if (go) { select(go.dataset.goto); return; }
        if (t.closest('[data-vis]') && !nodeOf(t)) { if (guard()) visibility(item(selected)); return; }
        if (t.closest('[data-del]') && !nodeOf(t)) { if (guard()) deleteDialog(item(selected)); return; }
        const add = t.closest('[data-add]');
        if (add && !nodeOf(t)) { if (guard()) addDialog(add.dataset.add || null); }
      });
    }
    bindDetails(main);

    main.addEventListener('click', async e => {
      const t = e.target;
      if (t.closest('[data-retry]')) { load(); return; }
      if (t.closest('[data-import]')) { importDrawer(); return; }
      if (t.closest('[data-change]')) { changeDialog(); return; }
      if (t.closest('[data-activate]')) { changeDialog(); return; }
      if (t.closest('[data-history]')) { historyDrawer(); return; }
      if (t.closest('[data-clearq]')) { q = ''; draw(); $('#fw-q')?.focus(); return; }
      if (t.closest('[data-expandall]')) { fw().items.forEach(i => { if (store.FW_CHILDREN[i.type].length) expanded.add(i.id); }); saveExpanded(); draw(); return; }
      if (t.closest('[data-collapseall]')) { expanded.clear(); saveExpanded(); draw(); return; }
      const id = nodeOf(t);
      if (!id) return;
      const it = item(id);
      if (!it) { draw(); return; }
      const mb = t.closest('[data-menu]');
      if (mb) {
        const wrap = mb.closest('.menu-wrap');
        if (openMenu === wrap) { closeMenu(); return; }
        closeMenu();
        const m = wrap.querySelector('.menu');
        const sib = siblings(fw(), it);
        m.querySelector('[data-up]').disabled = sib[0]?.id === it.id;
        m.querySelector('[data-down]').disabled = sib[sib.length - 1]?.id === it.id;
        m.hidden = false;
        m.classList.toggle('is-up', mb.getBoundingClientRect().bottom + 200 > innerHeight);
        mb.setAttribute('aria-expanded', 'true');
        wrap.closest('.fw-row')?.classList.add('has-menu');
        openMenu = wrap;
        m.querySelector('button:not([disabled])')?.focus();
        return;
      }
      if (t.closest('[data-toggle]')) { expanded.has(id) ? expanded.delete(id) : expanded.add(id); saveExpanded(); draw(); main.querySelector(`[data-node="${CSS.escape(id)}"] [data-toggle]`)?.focus(); return; }
      if (t.closest('[data-select]')) { select(id); return; }
      if (t.closest('[data-add]')) { if (guard()) addDialog(id); return; }
      if (t.closest('[data-rename]')) { if (guard()) { renaming = id; draw(); } return; }
      if (t.closest('[data-vis]')) { if (guard()) visibility(it); return; }
      if (t.closest('[data-up], [data-down]')) {
        closeMenu();
        if (!guard()) return;
        const sib = siblings(fw(), it);
        const i = sib.findIndex(s => s.id === id);
        await move(id, it.parentId || null, i + (t.closest('[data-up]') ? -1 : 1));
        return;
      }
      if (t.closest('[data-moveto]')) { closeMenu(); if (guard()) moveToDialog(it); return; }
      if (t.closest('[data-del]')) { closeMenu(); if (guard()) deleteDialog(it); }
    });
    document.addEventListener('click', e => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); });
    main.addEventListener('submit', e => { const f = e.target.closest('[data-renameform]'); if (!f) return; e.preventDefault(); saveRename(f.dataset.renameform, f.querySelector('input').value); });
    main.addEventListener('keydown', e => {
      if (e.target.matches('[data-renameinput]') && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); const id = renaming; renaming = ''; draw(); main.querySelector(`[data-node="${CSS.escape(id)}"] [data-select]`)?.focus(); return; }
      if (e.key === 'Escape' && openMenu) { closeMenu(true); return; }
      if (openMenu && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
        const items = [...openMenu.querySelectorAll('.menu button:not([disabled])')];
        const i = items.indexOf(document.activeElement);
        e.preventDefault();
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
        return;
      }
      // Tree keys on a node name: Up/Down move between visible nodes, Right/Left expand/collapse, F2 renames.
      if (e.target.matches('[data-select]')) {
        const names = [...main.querySelectorAll('.fw-tree [data-select]')];
        const i = names.indexOf(e.target);
        const id = nodeOf(e.target);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); names[i + (e.key === 'ArrowDown' ? 1 : -1)]?.focus(); }
        else if (e.key === 'ArrowRight' && !expanded.has(id) && store.FW_CHILDREN[item(id).type].length) { e.preventDefault(); expanded.add(id); saveExpanded(); draw(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); if (expanded.has(id)) { expanded.delete(id); saveExpanded(); draw(); } else { const p = item(id).parentId; if (p) main.querySelector(`[data-node="${CSS.escape(p)}"] [data-select]`)?.focus(); } }
        else if (e.key === 'F2' && canEdit()) { e.preventDefault(); renaming = id; draw(); }
      }
    });
    main.addEventListener('input', e => { if (e.target.matches('[data-q]')) { q = e.target.value; draw(); } });

    /* Drag and drop: drop on the top/bottom edge of a row to place it before/after; on the middle of a valid parent to move it inside. */
    const zone = (e, row) => { const r = row.getBoundingClientRect(); const y = (e.clientY - r.top) / r.height; return y < 0.3 ? 'before' : y > 0.7 ? 'after' : 'inside'; };
    function dropTarget(e) {
      const li = e.target.closest?.('[data-node]');
      if (!li || !drag) return null;
      const f = fw();
      const target = item(li.dataset.node);
      const src = item(drag);
      if (!target || !src || target.id === src.id || descendants(f, src.id).some(d => d.id === target.id)) return { li, ok: false };
      let z = zone(e, li.querySelector('.fw-row'));
      if (z === 'inside' && !store.FW_CHILDREN[target.type].includes(src.type)) z = e.clientY < li.querySelector('.fw-row').getBoundingClientRect().top + li.querySelector('.fw-row').offsetHeight / 2 ? 'before' : 'after';
      if (z === 'inside') return { li, ok: true, z, parentId: target.id, index: null };
      const parent = target.parentId ? item(target.parentId) : null;
      if (!store.FW_CHILDREN[parent ? parent.type : 'root'].includes(src.type)) return { li, ok: false, z };
      const sib = siblings(f, target).filter(s => s.id !== src.id);
      const i = sib.findIndex(s => s.id === target.id);
      return { li, ok: true, z, parentId: target.parentId || null, index: z === 'before' ? i : i + 1 };
    }
    const clearDrop = () => main.querySelectorAll('.is-drop-before, .is-drop-after, .is-drop-inside, .is-drop-no').forEach(x => x.classList.remove('is-drop-before', 'is-drop-after', 'is-drop-inside', 'is-drop-no'));
    main.addEventListener('dragstart', e => {
      const row = e.target.closest?.('.fw-row[draggable="true"]');
      if (!row) return;
      drag = nodeOf(row);
      row.closest('[data-node]').classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', drag); } catch { /* some browsers */ }
    });
    main.addEventListener('dragover', e => {
      const d = dropTarget(e);
      if (!d) return;
      e.preventDefault();
      clearDrop();
      const row = d.li.querySelector('.fw-row');
      if (!d.ok) { row.classList.add('is-drop-no'); e.dataTransfer.dropEffect = 'none'; return; }
      e.dataTransfer.dropEffect = 'move';
      row.classList.add(`is-drop-${d.z}`);
    });
    main.addEventListener('dragleave', e => { if (!main.contains(e.relatedTarget)) clearDrop(); });
    main.addEventListener('drop', async e => {
      const d = dropTarget(e);
      const id = drag;
      drag = null;
      clearDrop();
      main.querySelectorAll('.is-dragging').forEach(x => x.classList.remove('is-dragging'));
      if (!d) return;
      e.preventDefault();
      if (!guard()) return;
      if (!d.ok) {
        const src = item(id);
        const target = item(d.li.dataset.node);
        toast('Can’t move there', target && src ? `A ${store.FW_TYPES[src.type].toLowerCase()} can’t go ${d.z === 'inside' || !d.z ? `inside ${target.name}` : `next to a ${store.FW_TYPES[target.type].toLowerCase()}`}. ${src.type === 'subarea' ? 'Sub-areas belong in an area.' : src.type === 'area' ? 'Areas stay at the top level.' : 'Outcomes, milestones and materials belong in a sub-area.'}` : 'That isn’t a valid place.', 'alert-circle', { duration: 6000 });
        return;
      }
      await move(id, d.parentId, d.index);
    });
    main.addEventListener('dragend', () => { drag = null; clearDrop(); main.querySelectorAll('.is-dragging').forEach(x => x.classList.remove('is-dragging')); });

    const relayout = () => { renaming = mqPhone.matches ? '' : renaming; if (!mqNarrow.matches && drawer) drawer.close(); draw(); };
    mqPhone.addEventListener('change', relayout);
    mqNarrow.addEventListener('change', relayout);
    store.subscribe(({ key }) => { if (loaded && !busy && !renaming && !openMenu && !document.querySelector('dialog.modal[open]') && (!key || /^nexora-(frameworks|framework-active|learning|child-milestones|activities|materials|demo-role|school-plan)/.test(key))) draw(); });
    load();
  }

  window.NexoraFramework = { render, picker, pickedIds, refLabel };
})();
