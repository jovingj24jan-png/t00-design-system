/* S28 Child Learning Portfolio (app.html?page=portfolio[&child=<id>][&term=year][&area=<name>])
   One chronological learning story per child, read live from the canonical records through store.portfolioItems():
   S25 observations, S26 material progress, S27 assessments, presentation records and the portfolio's own work samples.
   Pins and family visibility are saved per item (observations use their own S25 sharing). Export prints a cover and the
   items oldest-first, by default only what the family may see. Test hooks: ?fail=1 (load error),
   ?pffail=file|save|pin|visibility (that operation fails once). */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const day = s => (s ? new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
  const when = s => (s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
  const monthOf = s => new Date(`${s.slice(0, 7)}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const TYPE_ICON = { observation: 'eye', evidence: 'image', progress: 'grid', assessment: 'star', presentation: 'book' };
  const UNCAT = '__none';

  // Downscales images on this device (longest side 1600 px, JPEG) so work samples fit device storage; PDFs are kept as-is.
  function readFile(file) {
    return new Promise((resolve, reject) => {
      if (file.type === 'application/pdf') { const r = new FileReader(); r.onload = () => resolve({ name: file.name, mime: file.type, size: file.size, data: r.result }); r.onerror = () => reject(new Error('read')); r.readAsDataURL(file); return; }
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { reject(new Error('type')); return; }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * scale);
        cv.height = Math.round(img.height * scale);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        const data = cv.toDataURL('image/jpeg', 0.85);
        resolve({ name: file.name.replace(/\.(png|webp)$/i, '.jpg'), mime: 'image/jpeg', size: Math.round((data.length - 23) * 0.75), data });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
      img.src = url;
    });
  }

  function render(key, main, user) {
    if (key !== 'portfolio') return false;
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
    const me = () => store.currentUser();
    const FAIL = { forbidden: 'You can’t change this item. Nothing was changed.', missing: 'This item is no longer available. The portfolio has been refreshed.', storage: 'This couldn’t be saved on this device. Nothing was changed — try again.' };
    const failText = r => r.message || (r.errors && Object.values(r.errors)[0]) || FAIL[r.reason] || FAIL.storage;
    let failOnce = params.get('fail') === '1';
    const failNext = { [params.get('pffail') || '']: true };
    const takeFail = k => { const v = Boolean(failNext[k]); failNext[k] = false; return v; };
    let childId = params.get('child') || '';
    let term = params.get('term') || '';
    let area = params.get('area') || '';
    let lens = 'staff';
    let loading = true;
    const open = new Set();
    const busy = new Set();

    main.classList.add('kids-page');
    document.title = 'Child Learning Portfolio · Nexora';
    const $ = s => main.querySelector(s);
    const pool = () => store.getChildren().filter(c => store.classScope(me()).includes(c.cls) && ['active', 'starting'].includes(c.status)).sort((a, b) => a.cls.localeCompare(b.cls) || a.firstName.localeCompare(b.firstName));
    const child = id => store.getChildren().find(c => c.id === id) || null;
    const avatar = (c, x = '') => (c?.photo ? `<img class="ob-av ${x}" src="${esc(c.photo)}" alt="">` : `<span class="ob-av ob-av--i ${x}" aria-hidden="true">${esc(c ? `${c.firstName[0]}${c.lastName?.[0] || ''}` : '?')}</span>`);
    const head = `<header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Child Learning Portfolio</h1><p class="kids-head__sub">Each child’s learning story — observations, work samples, material progress and milestones.</p></div><div class="kids-head__actions" data-acts></div></header>`;
    const state = (ic, title, text, action = '', tone = '') => `<div class="kids-empty pf-state"${tone === 'error' ? ' role="alert"' : ''}><span class="state-icon${tone ? ` state-icon--${tone}` : ''}" aria-hidden="true">${icon(ic)}</span><h2 class="kids-empty__title">${title}</h2><p>${text}</p>${action}</div>`;
    const syncUrl = () => { const u = new URL(location.href); [['child', childId], ['term', term], ['area', area]].forEach(([k, v]) => (v ? u.searchParams.set(k, v) : u.searchParams.delete(k))); history.replaceState(null, '', u); };
    const areaNames = () => { const fw = store.activeFramework(); return fw ? fw.items.filter(i => i.type === 'area' && !i.hidden).sort((a, b) => a.order - b.order).map(a => a.name) : store.LEARNING_AREAS.slice(); };

    // A new child never shows the previous child's items: the skeleton is drawn first, then the new child's data.
    function load() {
      loading = true;
      main.innerHTML = `<div class="kids pf" aria-busy="true">${head}<span class="skeleton pf-skel pf-skel--head" aria-hidden="true"></span><div class="pf-grid" aria-hidden="true">${'<span class="skeleton pf-skel"></span>'.repeat(4)}</div><p class="sr-only" role="status">Loading the portfolio</p></div>`;
      setTimeout(() => {
        if (failOnce) { failOnce = false; main.innerHTML = `<div class="kids pf">${head}${state('alert-circle', 'We couldn’t load the portfolio', 'Nothing has changed. Check your connection, then try again.', '<button class="btn btn--primary" type="button" data-retry>Try again</button>', 'error')}</div>`; return; }
        if (childId && !pool().some(c => c.id === childId)) { const c = child(childId); childId = ''; if (c) toast('Not available', 'You can open portfolios of children in your classes only.', 'lock'); }
        loading = false;
        draw();
        $('#page-title')?.focus();
      }, 250);
    }

    function data() {
      const r = store.portfolioItems(me(), childId);
      const t = store.portfolioTerms().find(x => x.id === term);
      const inTerm = i => !t || (i.date >= t.start && i.date <= t.end);
      const inArea = i => !area || (area === UNCAT ? !i.areas.length : i.areas.includes(area));
      const all = r.items;
      const shown = all.filter(i => inTerm(i) && inArea(i) && (lens === 'staff' || i.visibility.family));
      return { ...r, all, shown, t };
    }

    function draw() {
      if (loading) return;
      const active = document.activeElement;
      const keep = active && main.contains(active) ? { id: active.id, key: active.closest('[data-item]')?.dataset.item, act: [...active.attributes].map(a => a.name).find(n => /^data-(pin|vis|more|view)/.test(n)) } : null;
      const kidsList = pool();
      const acts = $('[data-acts]');
      if (!kidsList.length) { main.innerHTML = `<div class="kids pf">${head}${state('lock', 'No children to show', 'You aren’t assigned to a class yet. Ask a school leader to add you to one.')}</div>`; return; }
      const picker = `<div class="pf-controls">
        <div class="field pt-ctl pf-pick"><label class="field__label" for="pf-child">Child</label><input class="input pt-find" type="search" placeholder="Search children" aria-label="Search children" data-childfind><select class="input" id="pf-child" data-child><option value="">Choose a child…</option>${[...new Set(kidsList.map(k => k.cls))].map(g => `<optgroup label="${esc(g)}">${kidsList.filter(k => k.cls === g).map(k => `<option value="${esc(k.id)}"${k.id === childId ? ' selected' : ''}>${esc(store.childName(k))} · ${esc(k.cls)}</option>`).join('')}</optgroup>`).join('')}</select></div>
        <div class="field pt-ctl"><label class="field__label" for="pf-term">Term</label><select class="input" id="pf-term" data-term><option value="">All dates</option>${store.portfolioTerms().map(t => `<option value="${t.id}"${t.id === term ? ' selected' : ''}>${esc(t.name)} (${esc(day(t.start))} – ${esc(day(t.end))})</option>`).join('')}</select>${store.portfolioTerms().length ? '' : '<p class="field__hint">No terms are set up. Add the academic year in School setup.</p>'}</div>
        <div class="field pt-ctl"><label class="field__label" for="pf-area">Area</label><select class="input" id="pf-area" data-area><option value="">All areas</option>${areaNames().map(a => `<option${a === area ? ' selected' : ''}>${esc(a)}</option>`).join('')}<option value="${UNCAT}"${area === UNCAT ? ' selected' : ''}>Uncategorised</option></select></div>
        <div class="pt-ctl"><span class="field__label" id="pf-lens-l">Show</span><div class="segmented" role="group" aria-labelledby="pf-lens-l">${[['staff', 'Everything'], ['family', 'Family view']].map(([k, l]) => `<button type="button" aria-pressed="${lens === k}" data-lens="${k}">${l}</button>`).join('')}</div></div>
      </div>`;
      if (!childId) {
        main.innerHTML = `<div class="kids pf">${head}${picker}${state('user', 'Choose a child', 'Pick a child to see their learning story — observations, work samples, material progress and milestones.')}</div>`;
        $('[data-acts]').innerHTML = '';
        return;
      }
      const c = child(childId);
      const d = data();
      if (!d.ok) { main.innerHTML = `<div class="kids pf">${head}${picker}${state('lock', 'This portfolio isn’t available to you', 'Portfolios are open to staff of the child’s class.')}</div>`; return; }
      const can = store.canCuratePortfolio(me(), childId);
      const pinned = d.shown.filter(i => i.pinned);
      const rest = d.shown.filter(i => !i.pinned);
      const months = [];
      rest.forEach(i => { const m = i.date.slice(0, 7); let g = months.find(x => x.m === m); if (!g) { g = { m, list: [] }; months.push(g); } g.list.push(i); });
      const filtered = term || area || lens === 'family';
      const body = !d.all.length ? state('image', `${esc(c.firstName)}’s portfolio is empty`, 'Observations, material progress, milestone assessments and work samples for this child appear here automatically.', can ? `<button class="btn btn--primary kids-yellow" type="button" data-add>${icon('plus', 'icon--sm')}Add evidence</button>` : '')
        : !d.shown.length ? state(lens === 'family' ? 'lock' : 'filter', lens === 'family' && !term && !area ? 'Nothing is visible to the family yet' : 'No items match these filters', lens === 'family' && !term && !area ? 'Turn on “Visible to family” on the items you want to share.' : `${plural(d.all.length, 'item')} in total. Try another term or area.`, '<button class="btn btn--secondary btn--sm" type="button" data-clear>Show everything</button>')
        : `${pinned.length ? `<section class="pf-pinned" aria-labelledby="pf-pin-h"><h2 class="pf-h" id="pf-pin-h">${icon('star', 'icon--sm')}Pinned moments</h2><div class="pf-grid pf-grid--pinned">${pinned.map(card).join('')}</div></section>` : ''}
          ${months.map(g => `<section class="pf-month" aria-labelledby="pf-m-${g.m}"><h2 class="pf-h" id="pf-m-${g.m}">${esc(monthOf(g.m))}</h2><div class="pf-grid">${g.list.map(card).join('')}</div></section>`).join('')}`;
      main.innerHTML = `<div class="kids pf">${head}${picker}
        <section class="panel pf-hero" aria-label="Portfolio">${c.photo ? `<img class="pf-hero__photo" src="${esc(c.photo)}" alt="">` : `<span class="pf-hero__photo pf-hero__photo--i" aria-hidden="true">${esc(c.firstName[0])}${esc(c.lastName?.[0] || '')}</span>`}
          <div><p class="fw-d-kind">${esc(c.cls)} · ${esc(d.t ? d.t.name : 'All dates')} · ${esc(area ? (area === UNCAT ? 'Uncategorised' : area) : 'All areas')}</p><h2 class="pf-hero__name">${esc(store.childName(c))}</h2><p class="cd-note">${plural(d.shown.length, 'item')}${filtered ? ' match' : ''} · <a href="${routes.record(c.id)}#tab=learning">Child profile</a></p></div></section>
        ${lens === 'family' ? `<p class="wt-banner wt-banner--neutral">${icon('users')}<span><b>Family view:</b> only items visible to ${esc(c.firstName)}’s family, as they would see them — other children aren’t named and photos follow consent. No parent app is connected yet, so families can’t open this themselves.</span></p>` : ''}
        <div class="pf-layout"><div class="pf-main">${body}</div>${summary(d)}</div>
        <p class="sr-only" role="status" aria-live="polite" data-live></p></div>`;
      $('[data-acts]').innerHTML = `${can ? `<button class="btn btn--primary kids-yellow" type="button" data-add>${icon('plus', 'icon--sm')}Add evidence</button>` : ''}<button class="btn btn--secondary" type="button" data-export>${icon('printer', 'icon--sm')}Export / Print</button>`;
      main.querySelectorAll('img[data-src]').forEach(img => { img.addEventListener('error', () => { img.closest('.pf-media')?.classList.add('is-broken'); img.replaceWith(Object.assign(document.createElement('span'), { className: 'pf-broken', textContent: 'Image unavailable' })); }, { once: true }); img.src = img.dataset.src; });
      main.querySelectorAll('.pf-text').forEach(n => { const b = n.parentElement.querySelector('[data-more]'); if (b) b.hidden = !(n.scrollHeight > n.clientHeight + 2 || open.has(n.closest('[data-item]').dataset.item)); });
      if (keep) { const node = keep.key && main.querySelector(`[data-item="${CSS.escape(keep.key)}"]`); const el = (node && keep.act && node.querySelector(`[${keep.act}]`)) || (keep.id && main.querySelector(`#${CSS.escape(keep.id)}`)); if (el) el.focus({ preventScroll: true }); }
    }

    function media(i) {
      if (i.type === 'observation' && i.photoIds.length) {
        const hidePhotos = lens === 'family' && i.visibility.photosWithheld;
        if (hidePhotos) return '<div class="pf-media pf-media--note">Photos aren’t shown to the family (photo consent isn’t recorded for every child in it).</div>';
        const src = store.observationPhoto(me(), i.photoIds[0]);
        return src ? `<button class="pf-media" type="button" data-view="obs:${esc(i.photoIds[0])}" aria-label="View photo"><img data-src="${esc(src)}" alt="Photo from an observation on ${esc(day(i.date))}" loading="lazy">${i.photoIds.length > 1 ? `<span class="pf-media__n">+${i.photoIds.length - 1}</span>` : ''}</button>` : '<div class="pf-media is-broken"><span class="pf-broken">Photo unavailable</span></div>';
      }
      if (i.type === 'evidence' && i.files.length) {
        const f = i.files[0];
        if (f.missing) return '<div class="pf-media is-broken"><span class="pf-broken">File unavailable on this device</span></div>';
        if (lens === 'family' && i.visibility.photosWithheld && /^image\//.test(f.mime)) return '<div class="pf-media pf-media--note">Photo not shown to the family — photo consent isn’t recorded.</div>';
        if (/^image\//.test(f.mime)) { const full = store.portfolioFile(me(), childId, f.id); return full ? `<button class="pf-media" type="button" data-view="ev:${esc(f.id)}" aria-label="View ${esc(f.name)}"><img data-src="${esc(full.data)}" alt="${esc(i.title)}" loading="lazy">${i.files.length > 1 ? `<span class="pf-media__n">+${i.files.length - 1}</span>` : ''}</button>` : '<div class="pf-media is-broken"><span class="pf-broken">File unavailable</span></div>'; }
        return `<button class="pf-media pf-media--pdf" type="button" data-view="ev:${esc(f.id)}" aria-label="Open ${esc(f.name)}">${icon('file')}<span>${esc(f.name)}</span></button>`;
      }
      return '';
    }

    function card(i) {
      const isOpen = open.has(i.key);
      const v = i.visibility;
      const saving = busy.has(i.key);
      const linkHtml = i.type === 'observation' ? `<a href="${routes.page('observations', { obs: i.sourceId })}">Open observation</a>`
        : i.type === 'progress' ? `<a href="${routes.page('classroom-tracker', { view: 'child', child: childId, cls: child(childId).cls })}">Progress Tracker</a>${i.observationId ? ` · <a href="${routes.page('observations', { obs: i.observationId })}">Observation</a>` : ''}`
        : i.type === 'assessment' ? `<a href="${routes.page('milestones', { view: 'child', child: childId, cls: child(childId).cls, ms: i.milestoneId })}">Open milestone</a>`
        : i.type === 'evidence' && i.linkObservationId ? `<a href="${routes.page('observations', { obs: i.linkObservationId })}">Linked observation</a>` : '';
      const subtitle = i.type === 'progress' ? `${esc(store.PROGRESS_STATES[i.from])} → <b>${esc(store.PROGRESS_STATES[i.to])}</b>` : i.type === 'assessment' ? esc(i.label) : '';
      return `<article class="pf-card pf-card--${i.type}${i.pinned ? ' is-pinned' : ''}" data-item="${esc(i.key)}" aria-labelledby="pf-t-${esc(i.key.replace(':', '-'))}">
        ${media(i)}
        <div class="pf-card__body">
          <p class="pf-card__meta"><span class="pf-type">${icon(TYPE_ICON[i.type], 'icon--sm')}${esc(store.PF_TYPES[i.type])}</span><time datetime="${esc(i.date)}">${esc(day(i.date))}</time>${i.pinned ? `<span class="pf-pinmark">${icon('star', 'icon--sm')}Pinned</span>` : ''}</p>
          <h3 class="pf-card__title" id="pf-t-${esc(i.key.replace(':', '-'))}">${i.type === 'assessment' && i.code ? `<span class="fw-code">${esc(i.code)}</span> ` : ''}${esc(i.title)}</h3>
          ${subtitle ? `<p class="pf-card__sub">${subtitle}</p>` : ''}
          <div class="pf-areas">${i.areas.length ? i.areas.map(a => `<span class="badge badge--plain an-chip an-chip--cat">${esc(a)}</span>`).join('') : '<span class="badge badge--plain an-chip an-chip--neutral">Uncategorised</span>'}</div>
          ${i.text && !(i.type === 'observation' && i.text.split('\n')[0].slice(0, 90) === i.text) ? `<p class="pf-text${isOpen ? '' : ' is-clamped'}" id="pf-x-${esc(i.key.replace(':', '-'))}">${esc(i.text)}</p><button class="ob-more" type="button" data-more aria-expanded="${isOpen}" aria-controls="pf-x-${esc(i.key.replace(':', '-'))}" hidden>${isOpen ? 'Show less' : 'Read more'}</button>` : ''}
          ${i.outcomes?.length && lens === 'staff' ? `<div class="fw-tags">${i.outcomes.slice(0, 3).map(o => `<span class="fw-tag">${o.code ? `<b>${esc(o.code)}</b> ` : ''}${esc(o.name)}</span>`).join('')}</div>` : ''}
          <p class="pf-card__by">${esc(i.author || '')}${lens === 'staff' && i.others ? ` · with ${plural(i.others, 'other child', 'other children')}` : ''}${linkHtml && lens === 'staff' ? ` · ${linkHtml}` : ''}</p>
          ${lens === 'staff' ? `<div class="pf-card__acts">
            <label class="pt-switch pf-vis${saving ? ' is-saving' : ''}" title="${esc(v.reason)}"><input type="checkbox" role="switch" data-vis${v.family ? ' checked' : ''}${v.canChange && !saving ? '' : ' disabled'}><span class="pt-switch__track" aria-hidden="true"><i></i></span><span>${saving ? 'Saving…' : 'Visible to family'}</span></label>
            ${store.canCuratePortfolio(me(), childId) ? `<button class="btn btn--icon-ghost btn--sm" type="button" data-pin aria-pressed="${i.pinned}" aria-label="${i.pinned ? 'Unpin' : 'Pin'} this item" title="${i.pinned ? 'Unpin' : 'Pin to the top'}">${icon('star')}</button>` : ''}
          </div>${!v.canChange ? `<p class="pf-card__note">${icon('lock', 'icon--sm')}${esc(v.reason)}</p>` : v.family && v.photosWithheld ? `<p class="pf-card__note">${icon('info', 'icon--sm')}Shared without photos — photo consent isn’t recorded for every child in it.</p>` : ''}` : ''}
        </div></article>`;
    }

    function summary(d) {
      const names = areaNames();
      const counts = names.map(n => ({ n, c: d.shown.filter(i => i.area === n).length }));
      const other = d.shown.filter(i => !i.area || !names.includes(i.area)).length;
      const max = Math.max(1, ...counts.map(x => x.c), other);
      const bar = (n, c, val) => `<li><button class="mk-bar${area === val ? ' is-picked' : ''}" type="button" data-sumarea="${esc(val)}" aria-pressed="${area === val}" aria-label="${esc(`${n}: ${plural(c, 'item')}`)}"><span class="mk-bar__label">${esc(n)}</span><span class="mk-bar__track" aria-hidden="true"><i style="--w:${((c / max) * 100).toFixed(1)}%"></i></span><span class="mk-bar__value" aria-hidden="true">${c}</span></button></li>`;
      return `<aside class="panel pf-sum" aria-labelledby="pf-sum-h"><h2 class="cd-h2" id="pf-sum-h">Summary</h2>
        <dl class="ms-facts"><div><dt>Items</dt><dd>${d.shown.length}</dd></div><div><dt>Visible to family</dt><dd>${d.shown.filter(i => i.visibility.family).length}</dd></div><div><dt>Pinned</dt><dd>${d.shown.filter(i => i.pinned).length}</dd></div></dl>
        ${d.shown.length ? `<ul class="mk-bars pf-bars">${counts.map(x => bar(x.n, x.c, x.n)).join('')}${other ? bar('Uncategorised', other, UNCAT) : ''}</ul><p class="cd-note">Each item counts once, under its first area.</p>` : '<p class="cd-note">No items to count.</p>'}
        <p class="cd-note">Last updated: ${d.lastUpdated ? esc(when(d.lastUpdated)) : 'No updates recorded'}</p></aside>`;
    }

    /* ----------------------------- Actions */

    async function toggleVisibility(key, on) {
      if (busy.has(key)) return;
      const item = data().all.find(i => i.key === key);
      if (on && key.startsWith('obs:') && item?.others) {
        const ok = await confirmShare(item);
        if (!ok) { draw(); return; }
      }
      busy.add(key);
      draw();
      const r = await store.setPortfolioVisibility(me(), childId, key, on, { fail: takeFail('visibility') });
      busy.delete(key);
      draw();
      const live = $('[data-live]');
      if (!r.ok) { toast('Visibility not changed', failText(r), 'alert-circle', { duration: 7000 }); if (live) live.textContent = 'Not saved.'; return; }
      if (live) live.textContent = on ? 'Visible to family, saved.' : 'Hidden from family, saved.';
      toast(on ? 'Visible to family' : 'Hidden from family', on ? 'Saved. No parent app is connected yet, so families can’t open it themselves.' : 'Saved.', 'check-circle');
    }
    function confirmShare(item) {
      return new Promise(resolve => {
        let done = false;
        kids.dialog({
          label: 'Portfolio / Family visibility', title: 'Share this group observation?',
          desc: `This observation is about ${plural(item.others + 1, 'child', 'children')}. ${esc(child(childId).firstName)}’s family will see the note and outcomes, but not the other children’s names. ${item.visibility.photosWithheld || item.photoIds.length ? 'Photos are shown only if every child in it has photo consent. ' : ''}Check the note doesn’t name another child — it’s shown as written.`,
          body: '', submit: 'Share with this family',
          onClose() { if (!done) resolve(false); },
          async onSubmit() { done = true; resolve(true); return { ok: true }; }
        });
      });
    }
    async function togglePin(key) {
      const item = data().all.find(i => i.key === key);
      const r = await store.setPortfolioPin(me(), childId, key, !item.pinned, { fail: takeFail('pin') });
      if (!r.ok) { toast('Not saved', failText(r), 'alert-circle'); return; }
      draw();
      main.querySelector(`[data-item="${CSS.escape(key)}"] [data-pin]`)?.focus();
      toast(item.pinned ? 'Unpinned' : 'Pinned', item.pinned ? 'Back in its place in the timeline.' : 'Shown in Pinned moments.', 'check-circle');
    }
    function viewMedia(ref) {
      const [kind, id] = ref.split(':');
      let src;
      let name = 'Photo';
      let pdf = false;
      if (kind === 'obs') src = store.observationPhoto(me(), id);
      else { const f = store.portfolioFile(me(), childId, id); src = f?.data; name = f?.name || 'File'; pdf = f?.mime === 'application/pdf'; }
      if (!src) { toast('Unavailable', 'This file is no longer on this device.', 'alert-circle'); return; }
      const d = kids.dialog({ label: 'Portfolio', title: name, desc: '', body: pdf ? `<object class="pf-pdf" data="${esc(src)}" type="application/pdf" aria-label="${esc(name)}"><p class="cd-note">This browser can’t preview PDFs here. <a href="${esc(src)}" download="${esc(name)}">Download ${esc(name)}</a></p></object>` : `<img class="ob-full" src="${esc(src)}" alt="${esc(name)}">`, submit: 'Close', async onSubmit() { return { ok: true }; } });
      d.el.classList.add('ob-viewer');
      d.form.querySelector('[type=submit]').focus();
    }

    function evidenceDialog() {
      const c = child(childId);
      const fw = store.activeFramework();
      const mats = fw ? fw.items.filter(i => i.type === 'material' && !i.hidden) : [];
      const mss = fw ? fw.items.filter(i => i.type === 'milestone' && !i.hidden) : [];
      const obs = store.listObservations(me(), { childId, status: 'published' });
      const consent = store.photoConsent(childId);
      const clientId = `cl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      const files = [];
      let saving = false;
      const opener = document.activeElement;
      const el = document.createElement('dialog');
      el.className = 'modal pf-add';
      el.setAttribute('aria-labelledby', 'pf-a-title');
      el.innerHTML = `<form class="modal__panel" novalidate><span class="modal__grabber" aria-hidden="true"></span><div class="modal__top"><span class="tech-label">Portfolio / ${esc(store.childName(c))}</span><button class="btn btn--icon-ghost" type="button" aria-label="Close" data-close>${icon('x')}</button></div>
        <div class="modal__body"><h2 class="modal__title" id="pf-a-title">Add evidence</h2>
          <section class="ob-c-sec"><h3 class="ob-c-h">${icon('image', 'icon--sm')}Photos or files <span class="field__req" aria-hidden="true">*</span></h3><div class="ob-c-photos" data-files></div><p class="cd-note">JPEG, PNG, WebP or PDF, up to 1 MB each (photos are resized on this device). Up to ${store.PF_MAX_FILES}.</p><p class="cd-note" data-fstatus role="status"></p><p class="field__hint field__hint--error" data-error-for="files" hidden></p></section>
          <div class="cls-form">
            ${kids.field('kd-caption', 'Caption', '<input class="input" id="kd-caption" name="caption" maxlength="120" required placeholder="For example, First map of the continents">', { required: true })}
            ${kids.field('kd-description', 'Learning note', '<textarea class="input" id="kd-description" name="description" rows="3" maxlength="2000" placeholder="What does this show about the child’s learning?"></textarea>')}
            <div class="cls-form__row">${kids.field('kd-area', 'Area', `<select class="input" id="kd-area" name="area"><option value="">Uncategorised</option>${areaNames().map(a => `<option>${esc(a)}</option>`).join('')}</select>`)}${kids.field('kd-date', 'Date of the work', `<input class="input" id="kd-date" name="date" type="date" required max="${store.today()}" value="${store.today()}">`, { required: true, hint: 'The term is worked out from this date.' })}</div>
            <details class="pf-links"><summary>Link to an observation, material or milestone (optional)</summary>
              ${kids.field('kd-linkObservationId', 'Observation', `<select class="input" id="kd-linkObservationId" name="linkObservationId"><option value="">None</option>${obs.map(o => `<option value="${esc(o.id)}">${esc(day(o.publishedAt))} · ${esc(o.note.slice(0, 50))}</option>`).join('')}</select>`)}
              ${kids.field('kd-linkMaterialId', 'Material', `<select class="input" id="kd-linkMaterialId" name="linkMaterialId"><option value="">None</option>${mats.map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}</select>`)}
              ${kids.field('kd-linkMilestoneId', 'Milestone', `<select class="input" id="kd-linkMilestoneId" name="linkMilestoneId"><option value="">None</option>${mss.map(m => `<option value="${esc(m.id)}">${esc(m.code ? `${m.code} ` : '')}${esc(m.name)}</option>`).join('')}</select>`)}
            </details>
            <label class="pt-switch"><input type="checkbox" role="switch" name="familyVisible"><span class="pt-switch__track" aria-hidden="true"><i></i></span><span>Visible to family</span></label>
            ${consent ? '' : `<p class="cd-note">${icon('info', 'icon--sm')}${esc(c.firstName)} has no photo consent, so photos won’t be shown to the family even if this is visible.</p>`}
          </div>
          <p class="field__hint field__hint--error" data-form-error role="alert" hidden></p></div>
        <div class="modal__foot"><button class="btn btn--primary kids-yellow" type="submit">Save evidence</button><button class="btn btn--secondary" type="button" data-close>Cancel</button></div></form>`;
      document.body.appendChild(el);
      const form = el.querySelector('form');
      const close = () => { if (saving || el.classList.contains('is-closing')) return; el.classList.add('is-closing'); const done = () => { el.close(); el.remove(); if (opener && document.contains(opener)) opener.focus(); }; reduceMotion.matches ? done() : setTimeout(done, 170); };
      const err = (k, msg) => { const h = form.querySelector(`[data-error-for="${k}"]`); if (h) { h.textContent = msg || ''; h.hidden = !msg; } };
      const paintFiles = () => {
        form.querySelector('[data-files]').innerHTML = `${files.map((f, i) => `<figure class="ob-c-ph pf-fprev">${/^image\//.test(f.mime) ? `<img src="${esc(f.data)}" alt="${esc(f.name)}">` : `<span class="pf-media--pdf">${icon('file')}<span>${esc(f.name)}</span></span>`}<figcaption class="sr-only">${esc(f.name)}</figcaption><button class="btn btn--icon-ghost btn--sm" type="button" data-rmfile="${i}" aria-label="Remove ${esc(f.name)}">${icon('x')}</button></figure>`).join('')}${files.length < store.PF_MAX_FILES ? `<label class="ob-c-add">${icon('plus')}<span>Add</span><input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple data-addfiles></label>` : ''}`;
      };
      async function add(list) {
        err('files', '');
        const st = form.querySelector('[data-fstatus]');
        const room = store.PF_MAX_FILES - files.length;
        const msgs = [];
        if (list.length > room) msgs.push(`Only ${store.PF_MAX_FILES} files fit. ${list.length - room} weren’t added.`);
        for (const [n, file] of [...list].slice(0, room).entries()) {
          st.innerHTML = `<span class="spinner" aria-hidden="true"></span> Adding ${esc(file.name)} (${n + 1} of ${Math.min(list.length, room)})…`;
          let x;
          try { x = await readFile(file); } catch { msgs.push(`${file.name} isn’t a supported file. Use JPEG, PNG, WebP or PDF.`); continue; }
          const r = await store.addPortfolioFile(me(), childId, x, { fail: takeFail('file') });
          if (!r.ok) { msgs.push(`${r.message || FAIL.storage} You can try adding it again.`); continue; }
          files.push(r.file);
        }
        st.textContent = files.length ? `${plural(files.length, 'file')} attached.` : '';
        paintFiles();
        if (msgs.length) err('files', msgs.join(' '));
      }
      form.addEventListener('submit', async e => {
        e.preventDefault();
        if (saving) return;
        saving = true;
        const btn = form.querySelector('[type=submit]');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>Saving…';
        form.querySelectorAll('[data-error-for]').forEach(h => { h.hidden = true; });
        form.querySelector('[data-form-error]').hidden = true;
        const input = { caption: form.elements.caption.value, description: form.elements.description.value, area: form.elements.area.value, date: form.elements.date.value, fileIds: files.map(f => f.id), linkObservationId: form.elements.linkObservationId.value, linkMaterialId: form.elements.linkMaterialId.value, linkMilestoneId: form.elements.linkMilestoneId.value, familyVisible: form.elements.familyVisible.checked };
        const r = await store.addPortfolioEvidence(me(), childId, input, { clientId, fail: takeFail('save') });
        saving = false;
        btn.disabled = false;
        btn.textContent = 'Save evidence';
        if (!r.ok) {
          if (r.errors) { Object.entries(r.errors).forEach(([k, m]) => err(k, m)); return; }
          const fe = form.querySelector('[data-form-error]');
          fe.textContent = `Not saved — ${failText(r)} Your files and details are still here.`;
          fe.hidden = false;
          return;
        }
        saving = false;
        close();
        draw();
        toast('Evidence saved', `${r.evidence.caption} · ${day(r.evidence.date)}`, 'check-circle');
      });
      el.addEventListener('cancel', e => { e.preventDefault(); close(); });
      el.addEventListener('click', e => {
        if (e.target === el || e.target.closest('[data-close]')) { close(); return; }
        const rm = e.target.closest('[data-rmfile]');
        if (rm) { files.splice(Number(rm.dataset.rmfile), 1); paintFiles(); form.querySelector('[data-fstatus]').textContent = 'File removed.'; }
      });
      el.addEventListener('change', e => { if (e.target.matches('[data-addfiles]') && e.target.files.length) add(e.target.files); });
      paintFiles();
      el.showModal();
      form.querySelector('[data-addfiles]')?.closest('label')?.setAttribute('tabindex', '-1');
      form.elements.caption.focus();
    }

    /* ----------------------------- Export */

    function exportDialog() {
      const c = child(childId);
      const d = data();
      const famCount = d.all.filter(i => i.visibility.family && (!d.t || (i.date >= d.t.start && i.date <= d.t.end)) && (!area || (area === UNCAT ? !i.areas.length : i.areas.includes(area)))).length;
      const staffCount = d.all.filter(i => (!d.t || (i.date >= d.t.start && i.date <= d.t.end)) && (!area || (area === UNCAT ? !i.areas.length : i.areas.includes(area)))).length;
      kids.dialog({
        label: 'Portfolio / Export', title: 'Export learning story',
        desc: `${esc(store.childName(c))} · ${esc(d.t ? d.t.name : 'All dates')} · ${esc(area ? (area === UNCAT ? 'Uncategorised' : area) : 'All areas')}. Opens your browser’s print dialog — choose “Save as PDF” to keep a copy.`,
        body: `<fieldset class="an-fs"><legend class="field__label">Include</legend><div class="ob-share-list">
          <label class="an-pick"><input type="radio" name="mode" value="family" checked><span><b>For the family — ${plural(famCount, 'item')}</b><small>Only items visible to the family, as they’d see them. Other children aren’t named; photos follow consent.</small></span></label>
          <label class="an-pick"><input type="radio" name="mode" value="staff"><span><b>Staff copy — ${plural(staffCount, 'item')}</b><small>Everything you can see, marked “Staff only — not for families”.</small></span></label></div></fieldset>`,
        submit: 'Print',
        async onSubmit(form) {
          const mode = form.querySelector('[name=mode]:checked').value;
          if (!(mode === 'family' ? famCount : staffCount)) return { ok: false, message: mode === 'family' ? 'Nothing in this view is visible to the family yet.' : 'There’s nothing to export for these filters.' };
          setTimeout(() => printStory(mode), 200);
          return { ok: true };
        }
      });
    }

    function printStory(mode) {
      const c = child(childId);
      const d = data();
      const consent = store.photoConsent(childId);
      const fam = mode === 'family';
      const items = d.all.filter(i => (!fam || i.visibility.family) && (!d.t || (i.date >= d.t.start && i.date <= d.t.end)) && (!area || (area === UNCAT ? !i.areas.length : i.areas.includes(area)))).slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.at || '').localeCompare(String(b.at || '')) || a.key.localeCompare(b.key));
      const img = i => {
        if (i.type === 'observation' && i.photoIds.length && !(fam && i.visibility.photosWithheld)) { const s = store.observationPhoto(me(), i.photoIds[0]); return s ? `<img src="${esc(s)}" alt="">` : ''; }
        if (i.type === 'evidence') { const f = i.files.find(x => /^image\//.test(x.mime || '')); if (f && !(fam && !consent)) { const full = store.portfolioFile(me(), childId, f.id); return full ? `<img src="${esc(full.data)}" alt="">` : ''; } const pdf = i.files.find(x => x.mime === 'application/pdf'); return pdf ? `<p class="pfp-file">PDF work sample: ${esc(pdf.name)}</p>` : ''; }
        return '';
      };
      const box = document.createElement('div');
      box.className = 'pf-print';
      box.innerHTML = `<section class="pfp-cover">${c.photo && (!fam || consent) ? `<img class="pfp-photo" src="${esc(c.photo)}" alt="">` : `<span class="pfp-photo pfp-photo--i">${esc(c.firstName[0])}${esc(c.lastName?.[0] || '')}</span>`}
          <p class="pfp-kicker">${esc(store.school.name)}</p><h1>My Learning Journey</h1><p class="pfp-name">${esc(store.childName(c))}</p><p class="pfp-meta">${esc(c.cls)} · ${esc(d.t ? `${d.t.name} (${day(d.t.start)} – ${day(d.t.end)})` : 'All dates')}${area ? ` · ${esc(area === UNCAT ? 'Uncategorised' : area)}` : ''}</p>
          <p class="pfp-meta">Exported ${esc(day(store.today()))} · ${plural(items.length, 'item')}${fam ? '' : ' · <b>Staff only — not for families</b>'}</p></section>
        ${items.map(i => `<article class="pfp-item">${img(i)}<div><p class="pfp-imeta">${esc(day(i.date))} · ${esc(i.areas.join(', ') || 'Uncategorised')} · ${esc(store.PF_TYPES[i.type])}</p><h2>${esc(i.title)}</h2>${i.type === 'progress' ? `<p>${esc(store.PROGRESS_STATES[i.from])} → ${esc(store.PROGRESS_STATES[i.to])}</p>` : i.type === 'assessment' ? `<p>${esc(i.label)}</p>` : ''}${i.text && i.text !== i.title ? `<p class="pfp-text">${esc(i.text)}</p>` : ''}${!fam && i.author ? `<p class="pfp-imeta">${esc(i.author)}</p>` : ''}</div></article>`).join('')}`;
      main.appendChild(box);
      document.body.classList.add('is-printing-portfolio');
      const cleanup = () => { document.body.classList.remove('is-printing-portfolio'); box.remove(); window.removeEventListener('afterprint', cleanup); };
      window.addEventListener('afterprint', cleanup);
      const imgs = [...box.querySelectorAll('img')];
      // Images are inline data, so wait for them to decode before opening the print dialog.
      Promise.all(imgs.map(im => (im.complete ? 1 : new Promise(r => { im.onload = r; im.onerror = r; })))).then(() => window.print());
    }

    /* ----------------------------- Events */

    main.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('[data-retry]')) { load(); return; }
      if (t.closest('[data-add]')) { if (store.canCuratePortfolio(me(), childId)) evidenceDialog(); return; }
      if (t.closest('[data-export]')) { exportDialog(); return; }
      if (t.closest('[data-clear]')) { term = ''; area = ''; lens = 'staff'; syncUrl(); draw(); return; }
      const l = t.closest('[data-lens]');
      if (l) { lens = l.dataset.lens; draw(); main.querySelector(`[data-lens="${lens}"]`)?.focus(); return; }
      const sa = t.closest('[data-sumarea]');
      if (sa) { area = area === sa.dataset.sumarea ? '' : sa.dataset.sumarea; syncUrl(); draw(); main.querySelector(`[data-sumarea="${CSS.escape(sa.dataset.sumarea)}"]`)?.focus(); return; }
      const v = t.closest('[data-view]');
      if (v) { viewMedia(v.dataset.view); return; }
      const cardEl = t.closest('[data-item]');
      if (!cardEl) return;
      const key = cardEl.dataset.item;
      if (t.closest('[data-more]')) { open.has(key) ? open.delete(key) : open.add(key); draw(); return; }
      if (t.closest('[data-pin]')) togglePin(key);
    });
    main.addEventListener('change', e => {
      const t = e.target;
      if (t.matches('[data-child]')) { childId = t.value; open.clear(); syncUrl(); load(); return; }
      if (t.matches('[data-term]')) { term = t.value; syncUrl(); draw(); $('#pf-term')?.focus(); return; }
      if (t.matches('[data-area]')) { area = t.value; syncUrl(); draw(); $('#pf-area')?.focus(); return; }
      if (t.matches('[data-vis]')) { const key = t.closest('[data-item]').dataset.item; toggleVisibility(key, t.checked); }
    });
    main.addEventListener('input', e => {
      if (!e.target.matches('[data-childfind]')) return;
      const q = e.target.value.trim().toLowerCase();
      const sel = $('#pf-child');
      sel.querySelectorAll('option').forEach((o, i) => { if (i) o.hidden = Boolean(q) && !o.textContent.toLowerCase().includes(q) && !o.selected; });
      sel.querySelectorAll('optgroup').forEach(g => { g.hidden = ![...g.children].some(o => !o.hidden); });
    });
    store.subscribe(({ key }) => { if (!loading && !busy.size && !document.querySelector('dialog[open]') && !document.body.classList.contains('is-printing-portfolio') && (!key || /^nexora-(observations|observation-photos|progress|milestone|learning|portfolio|frameworks|framework-active|children|consents|settings|demo-role)/.test(key))) draw(); });
    load();
  }

  window.NexoraPortfolio = { render };
})();
