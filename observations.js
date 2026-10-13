/* S25 Learning Observations (app.html?page=observations[&obs=<id>][&new=1])
   Feed of canonical observation records (store.listObservations) with filters, a composer for notes, photos, several
   children and framework outcomes, and family sharing per tagged child. The child profile (S28 portfolio, S27 milestone
   evidence) reads the same records. Below 768px a camera button opens the device camera/photo picker directly.
   Test hooks: ?fail=1 (feed load error), ?obfail=photo|draft|publish|delete|share (that operation fails once). */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const when = s => (s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const initials = n => String(n || '?').replace(/^(Ms|Mrs|Mr|Dr)\.?\s+/i, '').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  // Downscales on this device (longest side 1280 px, JPEG), like the Daily Diary, so photos fit device storage.
  function shrink(file) {
    return new Promise((resolve, reject) => {
      if (!/^image\//.test(file.type)) { reject(new Error('type')); return; }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        const data = canvas.toDataURL('image/jpeg', 0.82);
        resolve({ data, mime: 'image/jpeg', size: Math.round((data.length - 23) * 0.75) });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
      img.src = url;
    });
  }

  function render(key, main, user) {
    if (key !== 'observations') return false;
    page(main, user);
    return true;
  }

  function page(main, user) {
    const kids = window.NexoraChildren;
    const fwk = window.NexoraFramework;
    const { routes } = store;
    const params = new URLSearchParams(location.search);
    const toast = (t, x, i = 'info', o) => window.NexoraToast?.show(t, x, i, o);
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const mqPhone = matchMedia('(max-width: 767px)');
    const mqNarrow = matchMedia('(max-width: 1023px)');
    const me = () => store.currentUser();
    const FAIL = {
      forbidden: 'You can only change observations you wrote (a Director can change any in this school). Nothing was changed.',
      missing: 'This observation is no longer available. The feed has been refreshed.',
      stale: 'Someone else changed this observation just now. Close it and open it again to see the latest version.',
      storage: 'This couldn’t be saved on this device. Your note, children, outcomes and photos are still here — try again.',
      busy: 'Still saving the previous change. Try again in a moment.'
    };
    const failText = r => r.message || FAIL[r.reason] || FAIL.storage;
    let failOnce = params.get('fail') === '1';
    const failNext = { [params.get('obfail') || '']: true };
    const takeFail = k => { const v = Boolean(failNext[k]); failNext[k] = false; return v; };
    const f = { q: '', childId: '', cls: '', area: '', authorId: '', from: '', to: '', status: '' };
    let focus = params.get('obs') || '';
    let loaded = false;
    let openMenu = null;
    let composing = false;
    const expanded = new Set();

    main.classList.add('kids-page');
    document.title = 'Learning Observations · Nexora';
    const $ = s => main.querySelector(s);
    const head = `<header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Learning Observations</h1><p class="kids-head__sub">Capture the small moments that show how children learn, explore, and grow.</p></div>
      <div class="kids-head__actions"><button class="btn btn--primary kids-yellow" type="button" data-new>${icon('plus', 'icon--sm')}New observation</button></div></header>`;
    const state = (ic, title, text, action = '', tone = '') => `<div class="kids-empty ob-state"${tone === 'error' ? ' role="alert"' : ''}><span class="state-icon${tone ? ` state-icon--${tone}` : ''}" aria-hidden="true">${icon(ic)}</span><h2 class="kids-empty__title">${title}</h2><p>${text}</p>${action}</div>`;
    const child = id => store.childById?.(id) || store.getChildren().find(c => c.id === id) || null;
    const nameOf = id => { const c = child(id); return c ? store.childName(c) : 'Child no longer on record'; };
    const avatar = (c, cls = '') => (c?.photo ? `<img class="ob-av ${cls}" src="${esc(c.photo)}" alt="">` : `<span class="ob-av ob-av--i ${cls}" aria-hidden="true">${esc(c ? initials(store.childName(c)) : '?')}</span>`);
    const activeFilters = () => Object.entries(f).filter(([k, v]) => v && k !== 'q');

    function load() {
      main.innerHTML = `<div class="kids ob" aria-busy="true">${head}<div class="ob-layout"><div class="ob-feed">${'<span class="skeleton ob-skel"></span>'.repeat(3)}</div></div><p class="sr-only" role="status">Loading observations</p></div>`;
      setTimeout(() => {
        if (failOnce) {
          failOnce = false;
          main.innerHTML = `<div class="kids ob">${head}${state('alert-circle', 'We couldn’t load the observations', 'Nothing has changed. Check your connection, then try again.', '<button class="btn btn--primary" type="button" data-retry>Try again</button>', 'error')}</div>`;
          return;
        }
        loaded = true;
        draw();
        const card = focus && main.querySelector(`[data-obs="${CSS.escape(focus)}"]`);
        if (card) { card.scrollIntoView({ block: 'center' }); card.focus(); } else $('#page-title')?.focus();
        if (params.get('new') === '1') composer();
      }, 300);
    }

    /* ----------------------------- Feed */

    function filtersHtml(prefix) {
      const fw = store.activeFramework();
      const areas = fw ? fw.items.filter(i => i.type === 'area' && !i.hidden).sort((a, b) => a.order - b.order) : [];
      const all = store.listObservations(me());
      const authors = [...new Map(all.map(o => [o.authorId, o.authorName])).entries()];
      const kidsList = store.observationTaggable(me()).sort((a, b) => store.childName(a).localeCompare(store.childName(b)));
      const classes = store.activeClasses().filter(c => store.classScope(me()).includes(c.name));
      const dateBad = f.from && f.to && f.to < f.from;
      const sel = (id, k, label, opts) => `<div class="field"><label class="field__label" for="${prefix}-${id}">${label}</label><select class="input" id="${prefix}-${id}" data-f="${k}"><option value="">All</option>${opts.map(([v, l]) => `<option value="${esc(v)}"${f[k] === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
      return `<div class="ob-filters" role="search" aria-label="Filter observations">
        <div class="field"><label class="field__label" for="${prefix}-q">Search</label><div class="input-wrap input-wrap--lead">${icon('search')}<input class="input" id="${prefix}-q" type="search" placeholder="Note, child, outcome or author" value="${esc(f.q)}" data-f="q" autocomplete="off"></div></div>
        <div class="field"><label class="field__label" for="${prefix}-child">Child</label><input class="input ob-filters__find" type="search" placeholder="Type to narrow" aria-label="Narrow the child list" data-childfind><select class="input" id="${prefix}-child" data-f="childId"><option value="">All children</option>${kidsList.map(c => `<option value="${esc(c.id)}"${f.childId === c.id ? ' selected' : ''}>${esc(store.childName(c))} · ${esc(c.cls)}</option>`).join('')}</select></div>
        ${sel('cls', 'cls', 'Class', classes.map(c => [c.name, c.name]))}
        ${sel('area', 'area', 'Learning area', areas.map(a => [a.id, a.name]))}
        ${sel('author', 'authorId', 'Author', authors)}
        <div class="ob-dates"><div class="field"><label class="field__label" for="${prefix}-from">From</label><input class="input" id="${prefix}-from" type="date" value="${esc(f.from)}" data-f="from" max="${esc(f.to || store.today())}"></div><div class="field"><label class="field__label" for="${prefix}-to">To</label><input class="input" id="${prefix}-to" type="date" value="${esc(f.to)}" data-f="to" min="${esc(f.from)}" max="${esc(store.today())}"${dateBad ? ' aria-invalid="true" aria-describedby="' + prefix + '-dateerr"' : ''}></div></div>
        ${dateBad ? `<p class="field__hint field__hint--error" id="${prefix}-dateerr">${icon('info')}The end date can’t be before the start date.</p>` : ''}
        <fieldset class="ob-status"><legend class="field__label">Status</legend><div class="segmented" role="group">${[['', 'All'], ['draft', 'Draft'], ['published', 'Published']].map(([v, l]) => `<button type="button" aria-pressed="${f.status === v}" data-status="${v}">${l}</button>`).join('')}</div></fieldset>
        ${activeFilters().length || f.q ? '<button class="btn btn--tertiary btn--sm" type="button" data-reset>Reset filters</button>' : ''}
      </div>`;
    }

    function draw() {
      if (!loaded) return;
      const active = document.activeElement;
      const keep = active && main.contains(active) ? { id: active.id, pos: active.selectionStart } : null;
      const dateBad = f.from && f.to && f.to < f.from;
      const all = store.listObservations(me());
      const list = dateBad ? [] : store.listObservations(me(), { ...f, areaName: store.activeFramework()?.items.find(i => i.id === f.area)?.name });
      const nFilters = activeFilters().length + (f.q ? 1 : 0);
      const chips = activeFilters().map(([k, v]) => {
        const label = { childId: nameOf(v), cls: v, area: store.activeFramework()?.items.find(i => i.id === v)?.name || 'Area', authorId: all.find(o => o.authorId === v)?.authorName || 'Author', from: `From ${v}`, to: `To ${v}`, status: store.OBS_STATUS[v] }[k];
        return `<button class="ob-chip" type="button" data-unf="${k}" aria-label="Remove filter: ${esc(label)}">${esc(label)}${icon('x', 'icon--sm')}</button>`;
      }).join('');
      const body = !all.length ? state('eye', 'No observations yet', 'Capture what a child explored, tried or discovered. Add photos, tag the children and link the learning outcomes.', '<button class="btn btn--primary kids-yellow" type="button" data-new>Create your first observation</button>')
        : dateBad ? state('calendar-check', 'Check the dates', 'The end date is before the start date, so nothing can match.')
        : !list.length ? state('search', 'No observations match these filters', `${plural(all.length, 'observation')} in total. Try fewer filters.`, '<button class="btn btn--secondary btn--sm" type="button" data-reset>Reset filters</button>')
        : `<p class="ob-count" role="status">${plural(list.length, 'observation')}${nFilters ? ' match' : ''}</p><div class="ob-cards">${list.map(card).join('')}</div>`;
      main.innerHTML = `<div class="kids ob">${head}
        <div class="ob-layout">
          ${mqNarrow.matches ? '' : `<aside class="panel ob-side" aria-label="Filters">${filtersHtml('obf')}</aside>`}
          <section class="ob-feed" aria-label="Observation feed">
            ${mqNarrow.matches ? `<div class="ob-bar"><div class="field ob-bar__q"><label class="sr-only" for="obm-q">Search observations</label><div class="input-wrap input-wrap--lead">${icon('search')}<input class="input" id="obm-q" type="search" placeholder="Search observations" value="${esc(f.q)}" data-f="q" autocomplete="off"></div></div><button class="btn btn--secondary" type="button" data-filters aria-haspopup="dialog">${icon('filter', 'icon--sm')}Filters${activeFilters().length ? ` <span class="tab__count">${activeFilters().length}</span>` : ''}</button></div>` : ''}
            ${chips ? `<div class="ob-active" aria-label="Active filters">${chips}</div>` : ''}
            ${body}
          </section>
        </div>
        ${mqPhone.matches ? `<label class="ob-fab" for="ob-cam" tabindex="0" role="button" title="Take a photo for a new observation">${icon('camera')}<span class="sr-only">Take a photo for a new observation</span></label><input class="sr-only" id="ob-cam" type="file" accept="image/*" capture="environment" data-camera tabindex="-1">` : ''}
      </div>`;
      main.querySelectorAll('.ob-note').forEach(n => { const b = n.parentElement.querySelector('[data-more]'); if (b) b.hidden = !(n.scrollHeight > n.clientHeight + 2 || expanded.has(n.closest('[data-obs]').dataset.obs)); });
      main.querySelectorAll('img[data-photo]').forEach(img => { img.src = store.observationPhoto(me(), img.dataset.photo) || ''; });
      if (keep) { const el = keep.id && main.querySelector(`#${CSS.escape(keep.id)}`); if (el) { el.focus(); if (keep.pos != null && el.setSelectionRange) try { el.setSelectionRange(keep.pos, keep.pos); } catch { /* not text */ } } }
    }

    function card(o) {
      const editable = store.canEditObservation(me(), o);
      const sh = store.observationSharing(o);
      const shared = sh.children.filter(c => c.shared).length;
      const open = expanded.has(o.id);
      const photos = o.photoIds.length ? `<div class="ob-photos ob-photos--${Math.min(o.photoIds.length, 4)}">${o.photoIds.slice(0, 4).map((p, i) => `<button class="ob-ph" type="button" data-view="${esc(p)}" aria-label="View photo ${i + 1} of ${o.photoIds.length}"><img data-photo="${esc(p)}" alt="Photo ${i + 1} of ${o.photoIds.length} from this observation" loading="lazy">${i === 3 && o.photoIds.length > 4 ? `<span class="ob-ph__more">+${o.photoIds.length - 4}</span>` : ''}</button>`).join('')}</div>` : '';
      return `<article class="panel ob-card${o.id === focus ? ' is-focus' : ''}${o.status === 'draft' ? ' is-draft' : ''}" data-obs="${esc(o.id)}" tabindex="-1" aria-labelledby="ob-h-${esc(o.id)}">
        <header class="ob-card__head">
          <span class="ob-av ob-av--i ob-av--author" aria-hidden="true">${esc(initials(o.authorName))}</span>
          <div class="ob-card__who"><h2 class="ob-card__author" id="ob-h-${esc(o.id)}">${esc(o.authorName)}</h2><p class="ob-card__time"><time datetime="${esc(o.publishedAt || o.updatedAt)}">${esc(when(o.publishedAt || o.updatedAt))}</time>${o.status === 'draft' ? ' · last saved' : ''}</p></div>
          <div class="ob-card__flags">
            <span class="badge badge--plain an-chip an-chip--${o.status === 'published' ? 'success' : 'neutral'}">${icon(o.status === 'published' ? 'check-circle' : 'pencil')}${store.OBS_STATUS[o.status]}</span>
            <span class="ob-share${shared ? ' is-on' : ''}" title="${shared ? `Shared with ${shared} of ${sh.children.length} families` : 'Not shared with families'}">${icon(shared ? 'users' : 'lock')}<span>${shared ? `Shared · ${shared}/${sh.children.length}` : 'Not shared'}</span></span>
            ${editable ? `<div class="menu-wrap"><button class="btn btn--icon-ghost" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for this observation" data-menu>${icon('more')}</button><div class="menu" role="menu" hidden>
              <button type="button" role="menuitem" data-edit>${icon('pencil', 'icon--sm')}Edit</button>
              <button type="button" role="menuitem" data-share${o.status === 'published' ? '' : ' disabled'}>${icon('users', 'icon--sm')}Family sharing${o.status === 'published' ? '…' : ' (publish first)'}</button>
              <button type="button" role="menuitem" data-history>${icon('clock', 'icon--sm')}History</button>
              <hr><button type="button" role="menuitem" class="is-danger" data-del>${icon('trash', 'icon--sm')}Delete…</button></div></div>` : ''}
          </div>
        </header>
        ${photos}
        <ul class="ob-kids" aria-label="Children in this observation">${o.childIds.map(id => { const c = child(id); return `<li>${avatar(c)}${c ? `<a href="${routes.record(c.id)}#tab=learning">${esc(store.childName(c))}</a>` : `<span>${esc(nameOf(id))}</span>`}</li>`; }).join('') || '<li class="ob-none">No child tagged yet</li>'}</ul>
        ${o.note ? `<div class="ob-notewrap"><p class="ob-note${open ? '' : ' is-clamped'}" id="ob-n-${esc(o.id)}">${esc(o.note)}</p><button class="ob-more" type="button" data-more aria-expanded="${open}" aria-controls="ob-n-${esc(o.id)}" hidden>${open ? 'Less' : 'More'}</button></div>` : '<p class="ob-none">No note yet.</p>'}
        ${o.outcomeRefs.length && fwk ? `<div class="fw-tags ob-outs" aria-label="Linked learning outcomes">${o.outcomeRefs.map(r => fwk.refLabel(r)).join('')}</div>` : ''}
      </article>`;
    }

    /* ----------------------------- Composer */

    function composer(existing = null, { photo = null, photoError = '' } = {}) {
      if (composing) return;
      if (existing && !store.canEditObservation(me(), existing)) { toast('Not allowed', FAIL.forbidden, 'lock'); return; }
      composing = true;
      const opener = document.activeElement;
      const clientId = `cl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      const s = {
        photos: (existing?.photoIds || []).map(id => ({ id, data: store.observationPhoto(me(), id) })),
        childIds: [...(existing?.childIds || [])],
        outcomeIds: (existing?.outcomeRefs || []).map(r => r.itemId),
        note: existing?.note || ''
      };
      const startJson = JSON.stringify(s);
      if (photo) s.photos.push(photo);
      const keptRefs = existing?.outcomeRefs || [];
      const taggable = store.observationTaggable(me());
      const pool = [...taggable, ...s.childIds.filter(id => !taggable.some(c => c.id === id)).map(child).filter(Boolean)];
      const { framework, options } = store.observationOptions();
      let busy = false;
      let kq = '';
      let oq = '';
      const el = document.createElement('dialog');
      el.className = 'modal ob-composer';
      el.setAttribute('aria-labelledby', 'ob-c-title');
      el.innerHTML = `<form class="modal__panel" novalidate><span class="modal__grabber" aria-hidden="true"></span>
        <div class="modal__top"><span class="tech-label">Learning observations</span><button class="btn btn--icon-ghost" type="button" aria-label="Close" data-close>${icon('x')}</button></div>
        <div class="modal__body"><h2 class="modal__title" id="ob-c-title">${existing ? 'Edit observation' : 'New observation'}</h2>
          ${existing && existing.authorId !== me().id ? `<p class="wt-banner wt-banner--neutral">${icon('info')}<span>Written by ${esc(existing.authorName)}. Your changes are recorded in its history.</span></p>` : ''}
          <div data-c-body></div>
          <p class="field__hint field__hint--error" data-form-error role="alert" hidden></p></div>
        <div class="modal__foot ob-c-foot" data-c-foot></div></form>`;
      document.body.appendChild(el);
      const form = el.querySelector('form');
      const body = el.querySelector('[data-c-body]');
      const foot = el.querySelector('[data-c-foot]');
      const formError = el.querySelector('[data-form-error]');
      const dirty = () => JSON.stringify(s) !== startJson;
      const close = (force = false) => {
        if (busy) return;
        if (!force && dirty()) { confirmDiscard(); return; }
        if (el.classList.contains('is-closing')) return;
        el.classList.add('is-closing');
        composing = false;
        const done = () => { el.close(); el.remove(); if (opener && document.contains(opener)) opener.focus(); };
        reduceMotion.matches ? done() : setTimeout(done, 170);
      };
      const footHtml = () => `<button class="btn btn--primary kids-yellow" type="submit" data-publish>${existing?.status === 'published' ? 'Save changes' : 'Publish observation'}</button>${existing?.status === 'published' ? '' : '<button class="btn btn--secondary" type="button" data-draft>Save draft</button>'}<button class="btn btn--tertiary" type="button" data-cancel>Cancel</button>`;
      function confirmDiscard() {
        foot.innerHTML = `<p class="ob-c-discard" role="alert">Discard your changes?</p><button class="btn btn--danger" type="button" data-discard>Discard</button><button class="btn btn--secondary" type="button" data-keep>Keep editing</button>`;
        foot.querySelector('[data-keep]').focus();
      }
      const err = (k, msg) => { const h = body.querySelector(`[data-error-for="${k}"]`); if (h) { h.innerHTML = msg ? `${icon('info')}${esc(msg)}` : ''; h.hidden = !msg; } };

      function paint() {
        const sel = pool.filter(c => s.childIds.includes(c.id));
        const ql = kq.trim().toLowerCase();
        const kidOpts = taggable.filter(c => !ql || `${store.childName(c)} ${c.cls}`.toLowerCase().includes(ql));
        const classes = [...new Set(kidOpts.map(c => c.cls))];
        const kept = keptRefs.filter(r => !options.some(o => o.id === r.itemId)).map(r => ({ ...store.frameworkRef(r), id: r.itemId }));
        const oql = oq.trim().toLowerCase();
        const groups = [];
        options.filter(o => !oql || `${o.code} ${o.name} ${o.area} ${o.subarea}`.toLowerCase().includes(oql)).forEach(o => { const g = `${o.area} › ${o.subarea}`; let x = groups.find(y => y.g === g); if (!x) { x = { g, list: [] }; groups.push(x); } x.list.push(o); });
        const chosenOuts = s.outcomeIds.map(id => options.find(o => o.id === id) || kept.find(k => k.id === id)).filter(Boolean);
        body.innerHTML = `
          <section class="ob-c-sec" aria-labelledby="ob-c-ph"><h3 class="ob-c-h" id="ob-c-ph">${icon('camera', 'icon--sm')}Photos <small>optional · up to ${store.OBS_MAX_PHOTOS}</small></h3>
            <div class="ob-c-photos">${s.photos.map((p, i) => `<figure class="ob-c-ph"><img src="${esc(p.data || '')}" alt="Photo ${i + 1}"><button class="btn btn--icon-ghost btn--sm" type="button" data-rmphoto="${i}" aria-label="Remove photo ${i + 1}">${icon('x')}</button></figure>`).join('')}
              ${s.photos.length < store.OBS_MAX_PHOTOS ? `<label class="ob-c-add">${icon('plus')}<span>Add photos</span><input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple data-addphotos></label>` : ''}</div>
            <p class="cd-note" data-photostatus role="status"></p>
            <p class="field__hint field__hint--error" data-error-for="photos" hidden></p></section>
          <section class="ob-c-sec" aria-labelledby="ob-c-kids"><h3 class="ob-c-h" id="ob-c-kids">${icon('users', 'icon--sm')}Children <span class="field__req" aria-hidden="true">*</span></h3>
            <div class="ob-c-chips" aria-live="polite">${sel.length ? sel.map(c => `<span class="ob-c-chip">${avatar(c, 'ob-av--sm')}${esc(store.childName(c))}<button type="button" data-rmkid="${esc(c.id)}" aria-label="Remove ${esc(store.childName(c))}">${icon('x', 'icon--sm')}</button></span>`).join('') : '<span class="cd-note">No children tagged yet.</span>'}</div>
            <input class="input" type="search" placeholder="Search children in your classes" aria-label="Search children" data-kq value="${esc(kq)}">
            <div class="ob-c-list" role="group" aria-label="Children">${classes.map(cl => `<div class="fw-pick__g"><p>${esc(cl)}</p>${kidOpts.filter(c => c.cls === cl).map(c => `<label class="fw-pick__opt"><input type="checkbox" value="${esc(c.id)}" data-kid${s.childIds.includes(c.id) ? ' checked' : ''}><span class="ob-c-kid">${avatar(c, 'ob-av--sm')}${esc(store.childName(c))}</span></label>`).join('')}</div>`).join('') || '<p class="cd-note">No children match.</p>'}</div>
            <p class="field__hint field__hint--error" data-error-for="childIds" hidden></p></section>
          <section class="ob-c-sec"><div class="field"><label class="ob-c-h" for="ob-c-note">${icon('note', 'icon--sm')}Observation <span class="field__req" aria-hidden="true">*</span></label>
            <textarea class="input ob-c-note" id="ob-c-note" rows="5" maxlength="${store.OBS_NOTE_MAX}" placeholder="Describe what the child explored, tried, noticed, or discovered…" data-note>${esc(s.note)}</textarea>
            <p class="field__hint"><span data-notecount>${s.note.length}</span> / ${store.OBS_NOTE_MAX.toLocaleString('en-GB')} · Describe what you saw — conclusions are yours to add.</p>
            <p class="field__hint field__hint--error" data-error-for="note" hidden></p></div></section>
          <section class="ob-c-sec" aria-labelledby="ob-c-out"><h3 class="ob-c-h" id="ob-c-out">${icon('layers', 'icon--sm')}Learning outcomes <small>optional</small></h3>
            ${framework ? `<p class="cd-note">${esc(framework.name)} · v${esc(framework.version)}. Hidden items aren’t offered.</p>` : '<p class="cd-note">No learning framework is active, so outcomes can’t be linked yet. A school leader can set one up in Learning Framework.</p>'}
            <div class="ob-c-chips">${chosenOuts.map(o => `<span class="ob-c-chip ob-c-chip--out${o.missing || o.hidden || o.active === false ? ' is-warn' : ''}">${o.type === 'milestone' ? icon('star', 'icon--sm') : icon('check-circle', 'icon--sm')}${o.code ? `<b>${esc(o.code)}</b>` : ''}${esc(o.name)}${o.missing || o.hidden || o.active === false ? ` <small>(${o.missing ? 'removed' : o.hidden ? 'hidden' : `${esc(o.frameworkName)} ${esc(o.version)}`})</small>` : ''}<button type="button" data-rmout="${esc(o.id || o.itemId)}" aria-label="Remove ${esc(o.name)}">${icon('x', 'icon--sm')}</button></span>`).join('')}</div>
            ${kept.length ? `<p class="wt-banner wt-banner--warn">${icon('alert-triangle')}<span>${plural(kept.length, 'linked outcome')} ${kept.length === 1 ? 'isn’t' : 'aren’t'} in the active framework any more (hidden, removed, or from ${esc(kept[0].frameworkName || 'another framework')}). ${existing?.status === 'published' ? 'They stay on this observation as history unless you remove them.' : 'Remove them to publish — nothing is replaced automatically.'}</span></p>` : ''}
            ${framework && options.length ? `<input class="input" type="search" placeholder="Search outcomes and milestones" aria-label="Search outcomes" data-oq value="${esc(oq)}">
              <div class="ob-c-list">${groups.map(g => `<div class="fw-pick__g"><p>${esc(g.g)}</p>${g.list.map(o => `<label class="fw-pick__opt"><input type="checkbox" value="${esc(o.id)}" data-out${s.outcomeIds.includes(o.id) ? ' checked' : ''}><span>${o.type === 'milestone' ? `${icon('star', 'icon--sm')} ` : ''}${o.code ? `<b>${esc(o.code)}</b> ` : ''}${esc(o.name)}${o.ageBand ? ` <small>${esc(o.ageBand)}</small>` : ''}</span></label>`).join('')}</div>`).join('') || '<p class="cd-note">No outcomes match.</p>'}</div>` : ''}
            <p class="field__hint field__hint--error" data-error-for="outcomeIds" hidden></p></section>`;
        if (!foot.querySelector('[data-discard]')) foot.innerHTML = footHtml();
      }
      const repaint = (sel) => { const st = body.parentElement.scrollTop; const pos = document.activeElement?.selectionStart; paint(); body.parentElement.scrollTop = st; const n = sel && body.querySelector(sel); if (n) { n.focus(); if (pos != null && n.setSelectionRange) try { n.setSelectionRange(pos, pos); } catch { /* */ } } };

      async function addFiles(files) {
        const status = body.querySelector('[data-photostatus]');
        err('photos', '');
        const room = store.OBS_MAX_PHOTOS - s.photos.length;
        const list = [...files].slice(0, room);
        if (files.length > room) err('photos', `Only ${store.OBS_MAX_PHOTOS} photos fit on one observation. ${files.length - room} weren’t added.`);
        for (const [i, file] of list.entries()) {
          status.innerHTML = `<span class="spinner" aria-hidden="true"></span> Adding photo ${i + 1} of ${list.length}…`;
          let shrunk;
          try { shrunk = await shrink(file); } catch { err('photos', `${file.name} isn’t a photo this device can read. Choose a JPEG, PNG or WebP image.`); continue; }
          const r = await store.addObservationPhoto(me(), shrunk, { fail: takeFail('photo') });
          if (!r.ok) { err('photos', `${file.name}: ${r.message || FAIL.storage}`); continue; }
          s.photos.push(r.photo);
        }
        const msg = body.querySelector('[data-error-for="photos"]').hidden ? '' : body.querySelector('[data-error-for="photos"]').innerHTML;
        repaint('[data-addphotos]');
        if (msg) { const h = body.querySelector('[data-error-for="photos"]'); h.innerHTML = msg; h.hidden = false; }
        body.querySelector('[data-photostatus]').textContent = list.length ? `${plural(s.photos.length, 'photo')} attached.` : '';
      }

      async function save(publish) {
        if (busy) return;
        busy = true;
        formError.hidden = true;
        ['photos', 'childIds', 'note', 'outcomeIds'].forEach(k => err(k, ''));
        const btn = foot.querySelector(publish ? '[data-publish]' : '[data-draft]');
        const label = btn.innerHTML;
        foot.querySelectorAll('button').forEach(b => { b.disabled = true; });
        btn.innerHTML = `<span class="spinner" aria-hidden="true"></span>${publish ? (existing?.status === 'published' ? 'Saving…' : 'Publishing…') : 'Saving…'}`;
        btn.setAttribute('aria-busy', 'true');
        const r = await store.saveObservation(me(), { note: s.note, childIds: s.childIds, outcomeIds: s.outcomeIds, photoIds: s.photos.map(p => p.id), updatedAt: existing?.updatedAt }, { id: existing?.id || null, publish, clientId, fail: takeFail(publish ? 'publish' : 'draft') });
        busy = false;
        foot.querySelectorAll('button').forEach(b => { b.disabled = false; });
        btn.innerHTML = label;
        btn.removeAttribute('aria-busy');
        if (!r.ok) {
          if (r.errors) { Object.entries(r.errors).forEach(([k, m]) => err(k, m)); body.querySelector('[data-error-for]:not([hidden])')?.closest('.ob-c-sec')?.scrollIntoView({ block: 'nearest' }); return; }
          formError.innerHTML = `${icon('alert-circle')}${publish ? 'Not published. ' : 'Draft not saved. '}${esc(failText(r))}`;
          formError.hidden = false;
          formError.scrollIntoView({ block: 'nearest' });
          return;
        }
        focus = r.observation.id;
        close(true);
        draw();
        const cardEl = main.querySelector(`[data-obs="${CSS.escape(r.observation.id)}"]`);
        cardEl?.scrollIntoView({ block: 'nearest' });
        toast(r.published ? 'Observation published successfully.' : r.unchanged ? 'No changes' : publish || r.observation.status === 'published' ? 'Observation saved' : 'Draft saved', r.published ? `It’s in ${r.observation.childIds.length === 1 ? 'the child’s portfolio' : `the portfolios of ${plural(r.observation.childIds.length, 'child', 'children')}`}${r.observation.outcomeRefs.length ? ' and linked as milestone evidence' : ''}. Not shared with families yet.` : r.observation.status === 'draft' ? 'Only you and school leaders can see drafts.' : '', 'check-circle', { duration: 6000 });
      }

      form.addEventListener('submit', e => { e.preventDefault(); save(true); });
      el.addEventListener('cancel', e => { e.preventDefault(); close(); });
      el.addEventListener('click', e => {
        const t = e.target;
        if (t === el || t.closest('[data-close], [data-cancel]')) { close(); return; }
        if (t.closest('[data-discard]')) { close(true); return; }
        if (t.closest('[data-keep]')) { foot.innerHTML = footHtml(); foot.querySelector('[data-publish]').focus(); return; }
        if (t.closest('[data-draft]')) { save(false); return; }
        const rp = t.closest('[data-rmphoto]');
        if (rp) { s.photos.splice(Number(rp.dataset.rmphoto), 1); repaint('[data-addphotos]'); body.querySelector('[data-photostatus]').textContent = 'Photo removed.'; return; }
        const rk = t.closest('[data-rmkid]');
        if (rk) { s.childIds = s.childIds.filter(x => x !== rk.dataset.rmkid); repaint('[data-kq]'); return; }
        const ro = t.closest('[data-rmout]');
        if (ro) { s.outcomeIds = s.outcomeIds.filter(x => x !== ro.dataset.rmout); repaint('[data-oq]'); }
      });
      el.addEventListener('change', e => {
        const t = e.target;
        if (t.matches('[data-addphotos]')) { if (t.files.length) addFiles(t.files); return; }
        if (t.matches('[data-kid]')) { s.childIds = t.checked ? [...s.childIds, t.value] : s.childIds.filter(x => x !== t.value); repaint(`[data-kid][value="${CSS.escape(t.value)}"]`); return; }
        if (t.matches('[data-out]')) { s.outcomeIds = t.checked ? [...s.outcomeIds, t.value] : s.outcomeIds.filter(x => x !== t.value); repaint(`[data-out][value="${CSS.escape(t.value)}"]`); }
      });
      el.addEventListener('input', e => {
        const t = e.target;
        if (t.matches('[data-note]')) { s.note = t.value; body.querySelector('[data-notecount]').textContent = t.value.length; return; }
        if (t.matches('[data-kq]')) { kq = t.value; repaint('[data-kq]'); return; }
        if (t.matches('[data-oq]')) { oq = t.value; repaint('[data-oq]'); }
      });
      paint();
      if (photoError) err('photos', photoError);
      el.showModal();
      (photo ? body.querySelector('[data-kq]') : body.querySelector('[data-addphotos]')?.closest('label') ? body.querySelector('[data-kq]') : body.querySelector('textarea'))?.focus();
    }

    /* ----------------------------- Other dialogs */

    function shareDialog(o) {
      const sh = store.observationSharing(o);
      const photosNote = o.photoIds.length ? (sh.photosShareable ? 'Photos are included: every tagged child has photo consent.' : `Photos are not included: no photo consent for ${sh.missingConsent.map(nameOf).join(', ')}. Families see the note and outcomes only.`) : 'There are no photos.';
      const d = kids.dialog({
        label: 'Learning observations / Family sharing', title: 'Share with families',
        desc: 'Each family sees this observation for their own child only — the note and the linked outcomes. Other tagged children aren’t named to them.',
        body: `<fieldset class="an-fs"><legend class="field__label">Share with the family of</legend><div class="ob-share-list">${sh.children.map(c => `<label class="an-pick"><input type="checkbox" name="share" value="${esc(c.id)}"${c.shared ? ' checked' : ''}${c.family ? '' : ' disabled'}><span><b>${esc(c.name)}</b><small>${c.family ? `${esc(c.family.name)} · ${plural(c.family.guardians, 'guardian')}` : 'No family on record'}</small></span></label>`).join('')}</div></fieldset>
          <p class="wt-banner wt-banner--${o.photoIds.length && !sh.photosShareable ? 'warn' : 'neutral'}">${icon(o.photoIds.length && !sh.photosShareable ? 'alert-triangle' : 'info')}<span>${esc(photosNote)}</span></p>
          ${o.childIds.length > 1 ? `<p class="wt-banner wt-banner--warn">${icon('alert-triangle')}<span>This observation is about ${plural(o.childIds.length, 'child', 'children')}. Check the note doesn’t name another child before sharing — the note is shown as written.</span></p>` : ''}
          <p class="cd-note">Sharing is recorded here. No parent app is connected in this prototype, so families don’t receive or open it yet.</p>`,
        submit: 'Save sharing',
        async onSubmit(form) {
          const ids = [...form.querySelectorAll('[name="share"]:checked')].map(i => i.value);
          const r = await store.shareObservation(me(), o.id, ids, { fail: takeFail('share') });
          if (!r.ok) return { ok: false, message: `Sharing wasn’t changed. ${failText(r)}` };
          draw();
          toast(r.unchanged ? 'No changes' : 'Sharing updated', ids.length ? `Recorded as shared with ${plural(ids.length, 'family', 'families')}.` : 'Not shared with any family.', 'check-circle');
          return { ok: true };
        }
      });
      void d;
    }

    function deleteDialog(o) {
      kids.dialog({
        label: 'Learning observations', title: 'Delete this observation?', danger: true,
        desc: `It will be removed from the feed, from ${o.childIds.length === 1 ? 'the child’s portfolio' : `${plural(o.childIds.length, 'child’s portfolio', 'children’s portfolios')}`}, and from milestone evidence${(o.sharedChildIds || []).length ? ', and families will no longer see it' : ''}. The school keeps the record and its history.`,
        body: '', submit: 'Delete observation',
        async onSubmit() {
          const r = await store.deleteObservation(me(), o.id, { fail: takeFail('delete') });
          if (!r.ok) return { ok: false, message: `The observation wasn’t deleted. ${failText(r)}` };
          if (focus === o.id) focus = '';
          draw();
          $('#page-title')?.focus();
          toast('Observation deleted', 'It’s no longer in the feed, portfolios or milestone evidence.', 'check-circle');
          return { ok: true };
        }
      });
    }

    function historyDialog(o) {
      const d = kids.dialog({
        label: 'Learning observations / History', title: 'Observation history', desc: `Created ${esc(when(o.createdAt))} by ${esc(o.authorName)}`,
        body: `<ol class="wt-hist">${[...o.history].reverse().map(h => `<li><b>${esc(h.detail)}</b><span>${esc(when(h.at))} · ${esc(h.by)}</span></li>`).join('')}</ol>`,
        submit: 'Done', async onSubmit() { return { ok: true }; }
      });
      d.form.querySelector('[type="submit"]').focus();
    }

    function viewPhoto(id) {
      const data = store.observationPhoto(me(), id);
      if (!data) { toast('Photo unavailable', 'This photo is no longer on this device.', 'alert-circle'); return; }
      const d = kids.dialog({ label: 'Learning observations', title: 'Photo', desc: '', body: `<img class="ob-full" src="${esc(data)}" alt="Observation photo">`, submit: 'Close', async onSubmit() { return { ok: true }; } });
      d.el.classList.add('ob-viewer');
      d.form.querySelector('[type="submit"]').focus();
    }

    function filterDrawer() {
      const opener = document.activeElement;
      const el = document.createElement('dialog');
      el.className = 'drawer ob-fdrawer';
      el.setAttribute('aria-labelledby', 'ob-fd-title');
      el.innerHTML = `<div class="drawer__panel"><div class="drawer__head"><h2 id="ob-fd-title">Filters</h2><button class="btn btn--icon-ghost" type="button" aria-label="Close filters" data-close>${icon('x')}</button></div><div class="drawer__body" data-body></div><div class="drawer__foot"><button class="btn btn--primary" type="button" data-close>Show results</button></div></div>`;
      document.body.appendChild(el);
      const body = el.querySelector('[data-body]');
      const paint = (sel) => { body.innerHTML = filtersHtml('obd'); bindFilters(body, () => { draw(); paint(document.activeElement?.id ? `#${document.activeElement.id}` : null); }); if (sel) body.querySelector(sel)?.focus(); };
      const close = () => { if (!el.isConnected || el.classList.contains('is-closing')) return; el.classList.add('is-closing'); const done = () => { el.close(); el.remove(); const b = main.querySelector('[data-filters]') || opener; if (b && document.contains(b)) b.focus(); }; reduceMotion.matches ? done() : setTimeout(done, 170); };
      el.addEventListener('cancel', e => { e.preventDefault(); close(); });
      el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-close]')) close(); });
      paint();
      el.showModal();
      body.querySelector('input, select')?.focus();
    }

    // Filter controls (side panel or drawer). `after` redraws.
    function bindFilters(root, after) {
      root.addEventListener('change', e => { const k = e.target.dataset.f; if (k && k !== 'q') { f[k] = e.target.value; after(); } });
      root.addEventListener('input', e => {
        if (e.target.matches('[data-childfind]')) {
          const q = e.target.value.trim().toLowerCase();
          const selEl = e.target.parentElement.querySelector('select');
          [...selEl.options].forEach((o, i) => { if (i) o.hidden = Boolean(q) && !o.textContent.toLowerCase().includes(q); });
          return;
        }
        if (e.target.dataset.f === 'q') { f.q = e.target.value; after(); }
      });
      root.addEventListener('click', e => {
        const st = e.target.closest('[data-status]');
        if (st) { f.status = st.dataset.status; after(); return; }
        if (e.target.closest('[data-reset]')) { Object.keys(f).forEach(k => { f[k] = ''; }); after(); }
      });
    }

    /* ----------------------------- Events */

    const obs = id => store.listObservations(me()).find(o => o.id === id);
    const closeMenu = (restore = false) => { if (!openMenu) return; const b = openMenu.querySelector('[data-menu]'); openMenu.querySelector('.menu').hidden = true; b.setAttribute('aria-expanded', 'false'); openMenu.closest('.ob-card')?.classList.remove('has-menu'); openMenu = null; if (restore) b.focus(); };
    bindFilters(main, () => draw());

    main.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('[data-retry]')) { load(); return; }
      if (t.closest('[data-new]')) { composer(); return; }
      if (t.closest('[data-filters]')) { filterDrawer(); return; }
      const un = t.closest('[data-unf]');
      if (un) { f[un.dataset.unf] = ''; draw(); (main.querySelector('[data-unf]') || main.querySelector('[data-filters]') || $('#obf-q'))?.focus(); return; }
      const ph = t.closest('[data-view]');
      if (ph) { viewPhoto(ph.dataset.view); return; }
      const cardEl = t.closest('[data-obs]');
      if (!cardEl) return;
      const id = cardEl.dataset.obs;
      if (t.closest('[data-more]')) { expanded.has(id) ? expanded.delete(id) : expanded.add(id); draw(); main.querySelector(`[data-obs="${CSS.escape(id)}"] [data-more]`)?.focus(); return; }
      const mb = t.closest('[data-menu]');
      if (mb) {
        const wrap = mb.closest('.menu-wrap');
        if (openMenu === wrap) { closeMenu(); return; }
        closeMenu();
        const m = wrap.querySelector('.menu');
        m.hidden = false;
        m.classList.toggle('is-up', mb.getBoundingClientRect().bottom + 220 > innerHeight);
        mb.setAttribute('aria-expanded', 'true');
        cardEl.classList.add('has-menu');
        openMenu = wrap;
        m.querySelector('button:not([disabled])')?.focus();
        return;
      }
      const o = obs(id);
      if (!o) { draw(); toast('Not available', FAIL.missing, 'info'); return; }
      const act = (sel, fn) => { const b = t.closest(sel); if (!b || b.disabled) return false; closeMenu(); fn(); return true; };
      if (act('[data-edit]', () => composer(o))) return;
      if (act('[data-share]', () => shareDialog(o))) return;
      if (act('[data-history]', () => historyDialog(o))) return;
      act('[data-del]', () => deleteDialog(o));
    });
    document.addEventListener('click', e => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); });
    main.addEventListener('keydown', e => {
      if (e.key === 'Escape' && openMenu) { closeMenu(true); return; }
      if (openMenu && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
        const items = [...openMenu.querySelectorAll('.menu button:not([disabled])')];
        const i = items.indexOf(document.activeElement);
        e.preventDefault();
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      }
      if (e.target.matches?.('.ob-fab') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); main.querySelector('[data-camera]')?.click(); }
    });
    // Camera-first (phones): the label opens the camera/photo picker directly; a chosen photo opens the composer with it attached.
    main.addEventListener('change', async e => {
      if (!e.target.matches('[data-camera]')) return;
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      let shrunk;
      try { shrunk = await shrink(file); } catch { composer(null, { photoError: 'That file isn’t a photo this device can read. Add a JPEG, PNG or WebP photo below.' }); return; }
      const r = await store.addObservationPhoto(me(), shrunk, { fail: takeFail('photo') });
      if (!r.ok) { composer(null, { photoError: `The photo wasn’t attached. ${r.message || FAIL.storage} You can add it again below.` }); return; }
      composer(null, { photo: r.photo });
    });
    main.addEventListener('keyup', e => { if (e.target.matches('.ob-fab')) e.preventDefault(); });

    const relayout = () => draw();
    mqPhone.addEventListener('change', relayout);
    mqNarrow.addEventListener('change', relayout);
    store.subscribe(({ key }) => { if (loaded && !composing && !openMenu && !document.querySelector('dialog[open]') && (!key || /^nexora-(observations|frameworks|framework-active|children|class|demo-role)/.test(key))) draw(); });
    load();
  }

  window.NexoraObservations = { render };
})();
