/* Form Builder (app.html?page=form-builder[&edit=<id>]) — application, consent and custom forms shared by link.
   Staff edit a working copy (autosaved); respondents only ever see the published version at form.html?f=<id>.
   Preview and the public page draw the form with the same renderer (formkit.js) and the same store validation.
   Test hooks: ?fail=1 (list load error), ?savefail=1 (first save fails), ?pubfail=1 (first publish fails),
   ?clipfail=1 (clipboard refused). */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const kids = window.NexoraChildren;
  const { routes } = store;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const params = new URLSearchParams(location.search);
  const toast = (t, x, i = 'info', o) => window.NexoraToast?.show(t, x, i, o);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobileQ = matchMedia('(max-width: 767px)');
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const day = s => (s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const chip = (tone, text, ic = '') => `<span class="badge badge--plain an-chip an-chip--${tone}">${ic ? icon(ic) : ''}${esc(text)}</span>`;
  const state = (iconName, title, text, action = '', tone = '') => `<div class="kids-empty an-state"${tone === 'error' ? ' role="alert"' : ''}><span class="state-icon${tone ? ` state-icon--${tone}` : ''}" aria-hidden="true">${icon(iconName)}</span><h2 class="kids-empty__title">${title}</h2><p>${text}</p>${action}</div>`;
  const FICON = { section: 'layers', text: 'pencil', longtext: 'note', email: 'mail', phone: 'phone', date: 'calendar-check', dropdown: 'list', multiselect: 'check-circle', checkbox: 'check', file: 'upload', signature: 'pencil', consent: 'shield-check' };
  const FHELP = { section: 'Group fields under a heading', text: 'Short answer', longtext: 'Paragraph answer', email: 'Checked email address', phone: 'Phone number', date: 'Date picker', dropdown: 'Choose one', multiselect: 'Choose several', checkbox: 'One tick box', file: 'Image or PDF', signature: 'Drawn or typed', consent: 'Statement to accept' };
  const TICON = { application: 'user-plus', consent: 'shield-check', custom: 'file' };
  const FAIL = {
    forbidden: 'Your role or your school’s plan doesn’t allow this. Nothing was changed.',
    missing: 'This form no longer exists. Refresh the page.',
    storage: 'This couldn’t be saved on this device. Nothing was changed. Please try again.'
  };
  const failText = r => r.message || FAIL[r.reason] || FAIL.storage;
  const absLink = id => new URL(store.builderFormLink(id), location.href).href;
  const answerable = f => f.fields.filter(x => x.type !== 'section').length;
  const fails = { save: params.get('savefail') === '1', publish: params.get('pubfail') === '1', clip: params.get('clipfail') === '1' };

  function render(key, main, user) {
    if (key !== 'form-builder') return false;
    main.classList.add('kids-page');
    if (params.get('edit')) builder(main, user, params.get('edit'));
    else list(main, user);
    return true;
  }

  /* ================================================================= Copy link */

  async function copyLink(id, opener = document.activeElement) {
    const link = absLink(id);
    try {
      if (fails.clip) { fails.clip = false; throw new Error('blocked'); }
      if (!navigator.clipboard?.writeText) throw new Error('unsupported');
      await navigator.clipboard.writeText(link);
      toast('Link copied', link, 'copy');
      return true;
    } catch {
      const d = kids.dialog({
        label: 'Form Builder', title: 'Copy the link yourself',
        desc: 'Your browser didn’t allow copying automatically. Select the link below and copy it.',
        body: `<div class="field"><label class="field__label" for="kd-link">Form link</label><input class="input" id="kd-link" readonly dir="ltr" value="${esc(link)}"></div>`,
        submit: 'Done', async onSubmit() { return { ok: true }; },
        onClose() { if (opener && document.contains(opener)) opener.focus(); }
      });
      const inp = d.form.querySelector('#kd-link');
      inp.focus();
      inp.select();
      return false;
    }
  }

  /* ================================================================= Preview (same renderer as the public page) */

  function previewDialog(form, { title = 'Preview', note = '' } = {}) {
    const opener = document.activeElement;
    const el = document.createElement('dialog');
    el.className = 'modal fp-modal bfp';
    el.setAttribute('aria-labelledby', 'bfp-title');
    el.innerHTML = `<div class="fp-modal__wrap bfp__wrap" data-view="desktop"><div class="fp-modal__bar"><button class="btn btn--secondary btn--sm" type="button" data-close>${icon('arrow-left', 'icon--sm')}Back to editing</button><h2 class="fp-modal__title" id="bfp-title">${esc(title)}</h2>
        <div class="segmented bfp__toggle" role="group" aria-label="Preview size"><button type="button" aria-pressed="true" data-size="desktop">${icon('grid', 'icon--sm')}Desktop</button><button type="button" aria-pressed="false" data-size="phone">${icon('phone', 'icon--sm')}Phone</button></div>
        ${note ? `<span class="badge badge--plain an-chip an-chip--info">${esc(note)}</span>` : ''}</div>
      <div class="bfp__stage"><div class="bfp__frame" data-frame><div class="fp-phone__notch" aria-hidden="true"></div><div class="bfp__screen" data-screen></div></div></div></div>`;
    document.body.appendChild(el);
    const screen = el.querySelector('[data-screen]');
    window.NexoraFormKit.renderForm(screen, form, { mode: 'preview', school: store.school, idPrefix: 'bfp' });
    const close = () => { if (el.classList.contains('is-closing')) return; el.classList.add('is-closing'); const done = () => { el.close(); el.remove(); if (opener && document.contains(opener)) opener.focus(); }; reduceMotion.matches ? done() : setTimeout(done, 170); };
    el.addEventListener('cancel', e => { e.preventDefault(); close(); });
    el.addEventListener('click', e => {
      if (e.target === el || e.target.closest('[data-close]')) { close(); return; }
      const s = e.target.closest('[data-size]');
      if (s) { el.querySelector('.bfp__wrap').dataset.view = s.dataset.size; el.querySelectorAll('[data-size]').forEach(b => b.setAttribute('aria-pressed', String(b === s))); }
    });
    el.showModal();
    el.querySelector('[data-close]').focus();
    return el;
  }

  /* ================================================================= List */

  function list(main, user) {
    document.title = 'Form Builder · Nexora';
    const manage = store.canManageBuilderForms(user);
    let q = '';
    let filter = ['draft', 'live'].includes(params.get('status')) ? params.get('status') : '';
    let failLoad = params.get('fail') === '1';
    let loaded = false;

    function load() {
      main.innerHTML = `<div class="kids bfl" aria-busy="true"><header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Form Builder</h1><p class="kids-head__sub">Loading forms…</p></div></header><div class="bfl-grid">${'<span class="skeleton bfl-skel"></span>'.repeat(3)}</div><p class="sr-only" role="status">Loading forms</p></div>`;
      setTimeout(() => {
        if (failLoad) { failLoad = false; main.innerHTML = `<div class="kids bfl"><header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Form Builder</h1></div></header>${state('alert-circle', 'We couldn’t load your forms', 'Check your connection, then try again. Nothing has changed.', '<button class="btn btn--primary" type="button" data-retry>Try again</button>', 'error')}</div>`; return; }
        loaded = true;
        paint();
        main.querySelector('#page-title')?.focus();
      }, 300);
    }

    function paint() {
      if (!loaded) return;
      const forms = store.getBuilderForms();
      const subs = store.getBuilderSubmissions();
      const shown = forms.filter(f => (!filter || f.status === filter) && (!q || f.name.toLowerCase().includes(q.toLowerCase())));
      const counts = { '': forms.length, draft: forms.filter(f => f.status === 'draft').length, live: forms.filter(f => f.status === 'live').length };
      main.innerHTML = `<div class="kids bfl">
        <header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Form Builder</h1><p class="kids-head__sub">Create and manage your school’s application and consent forms.</p></div>
          ${manage ? `<button class="btn btn--primary bfl-create" type="button" data-create>${icon('plus', 'icon--sm')}Create form</button>` : ''}</header>
        <p class="bfl-mobile-note" role="note">${icon('info', 'icon--sm')}<span>Form editing is available on tablet and desktop. You can still preview and share your forms here.</span></p>
        ${forms.length ? `<div class="bfl-tools"><div class="field bfl-search"><label class="sr-only" for="bfl-q">Search forms</label><div class="input-wrap input-wrap--lead">${icon('search')}<input class="input" id="bfl-q" type="search" placeholder="Search by form name" value="${esc(q)}" data-q></div></div>
          <div class="segmented" role="group" aria-label="Show">${[['', 'All'], ['draft', 'Draft'], ['live', 'Live']].map(([k, l]) => `<button type="button" aria-pressed="${filter === k}" data-filter="${k}">${l} <span class="bfl-n">${counts[k]}</span></button>`).join('')}</div></div>` : ''}
        ${!forms.length ? state('file', 'No forms created yet', 'Build an application or consent form, publish it and share the link with families.', manage ? `<button class="btn btn--primary bfl-create" type="button" data-create>${icon('plus', 'icon--sm')}Create your first form</button>` : '')
          : !shown.length ? state('search', 'No forms match', 'Try another name or show all forms.', '<button class="btn btn--secondary" type="button" data-clear>Show all forms</button>')
          : `<ul class="bfl-grid">${shown.map(f => card(f, subs.filter(s => s.formId === f.id).length)).join('')}</ul>`}
        <p class="cd-note bfl-foot">${icon('info', 'icon--sm')}Permission slips, surveys and acknowledgements for enrolled families are in <a href="${routes.page('forms')}">Forms &amp; Permissions</a>. Prototype: published links and responses are stored in this browser only.</p>
      </div>`;
    }
    function card(f, n) {
      const unpub = store.builderUnpublished(f);
      return `<li class="panel bfl-card" data-form="${esc(f.id)}">
        <div class="bfl-card__top"><span class="bfl-card__icon" aria-hidden="true">${icon(TICON[f.type])}</span><div class="bfl-card__tags">${chip(f.status === 'live' ? 'success' : 'neutral', store.BF_STATUSES[f.status], f.status === 'live' ? 'check-circle' : 'pencil')}${unpub ? chip('warning', 'Unpublished changes', 'alert-triangle') : ''}</div></div>
        <h2 class="bfl-card__title">${esc(f.name)}</h2>
        <p class="bfl-card__type">${esc(store.BF_TYPES[f.type])} form${f.demo ? ' · demo sample' : ''}</p>
        <dl class="bfl-card__facts"><div><dt>Fields</dt><dd>${answerable(f)}</dd></div><div><dt>Responses</dt><dd>${n}</dd></div><div><dt>Updated</dt><dd>${esc(day(f.updatedAt))}</dd></div></dl>
        <div class="bfl-card__acts">
          ${manage ? `<a class="btn btn--secondary btn--sm bfl-edit" href="${routes.page('form-builder', { edit: f.id })}">${icon('pencil', 'icon--sm')}Edit<span class="sr-only"> ${esc(f.name)}</span></a>` : ''}
          <button class="btn btn--secondary btn--sm" type="button" data-preview="${esc(f.id)}">${icon('eye', 'icon--sm')}Preview<span class="sr-only"> ${esc(f.name)}</span></button>
          ${f.status === 'live' ? `<button class="btn btn--secondary btn--sm" type="button" data-copy="${esc(f.id)}">${icon('copy', 'icon--sm')}Copy link<span class="sr-only"> for ${esc(f.name)}</span></button>` : ''}
          ${manage ? `<button class="btn btn--tertiary btn--sm bfl-dup" type="button" data-dup="${esc(f.id)}">${icon('layers', 'icon--sm')}Duplicate<span class="sr-only"> ${esc(f.name)}</span></button>` : ''}
        </div>
        ${f.status === 'live' ? `<p class="bfl-card__link"><span class="sr-only">Link: </span><span dir="ltr">${esc(absLink(f.id))}</span></p>` : ''}
      </li>`;
    }

    function createDialog() {
      const d = kids.dialog({
        label: 'Form Builder', title: 'Create form', desc: 'You can change the name and type later.',
        body: `${kids.field('kd-name', 'Form name', '<input class="input" id="kd-name" name="name" maxlength="120" placeholder="Untitled form">')}
          <fieldset class="an-fs"><legend class="field__label">Type</legend><div class="bfl-types">${Object.entries(store.BF_TYPES).map(([k, l], i) => `<label class="an-mode"><input type="radio" name="btype" value="${k}"${i === 0 ? ' checked' : ''}><span><b>${icon(TICON[k], 'icon--sm')}${l}</b><small>${{ application: 'Files an enquiry in Admissions when submitted.', consent: 'Records the statement and each acceptance.', custom: 'Any other form — answers are kept with the form.' }[k]}</small></span></label>`).join('')}</div></fieldset>`,
        submit: 'Create form',
        async onSubmit(form) {
          const r = await store.createBuilderForm(store.currentUser(), { name: form.elements.name.value, type: form.querySelector('[name="btype"]:checked').value });
          if (!r.ok) return { ok: false, message: failText(r) };
          location.href = routes.page('form-builder', { edit: r.form.id });
          return { keepOpen: true, submitLabel: 'Opening…' };
        }
      });
      d.form.elements.name.focus();
    }

    main.addEventListener('click', async e => {
      const t = e.target;
      if (t.closest('[data-retry]')) { load(); return; }
      if (t.closest('[data-create]')) { createDialog(); return; }
      if (t.closest('[data-clear]')) { q = ''; filter = ''; paint(); main.querySelector('#bfl-q')?.focus(); return; }
      const fb = t.closest('[data-filter]');
      if (fb) { filter = fb.dataset.filter; paint(); main.querySelector(`[data-filter="${filter}"]`)?.focus(); return; }
      const pv = t.closest('[data-preview]');
      if (pv) { const f = store.getBuilderForms().find(x => x.id === pv.dataset.preview); if (f) previewDialog(f.status === 'live' ? f.published : f, { title: f.name, note: f.status === 'live' ? 'What respondents see' : 'Draft — not published' }); return; }
      const cp = t.closest('[data-copy]');
      if (cp) { copyLink(cp.dataset.copy, cp); return; }
      const dp = t.closest('[data-dup]');
      if (dp) {
        dp.disabled = true;
        const r = await store.duplicateBuilderForm(store.currentUser(), dp.dataset.dup);
        if (!r.ok) { dp.disabled = false; toast('Not duplicated', failText(r), 'alert-circle'); return; }
        toast('Form duplicated', `“${r.form.name}” is a new draft.`, 'check-circle', { action: { label: 'Edit', onClick: () => { location.href = routes.page('form-builder', { edit: r.form.id }); } } });
        paint();
      }
    });
    main.addEventListener('input', e => { if (!e.target.matches('[data-q]')) return; q = e.target.value; const pos = e.target.selectionStart; paint(); const i = main.querySelector('#bfl-q'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } });
    store.subscribe(({ key }) => { if (!key || /^nexora-builder-/.test(key)) { const focusId = document.activeElement?.closest?.('main') ? document.activeElement.id : ''; paint(); if (focusId) main.querySelector(`#${CSS.escape(focusId)}`)?.focus(); } });
    load();
  }

  /* ================================================================= Builder */

  function builder(main, user, id) {
    document.title = 'Form Builder · Nexora';
    const back = `<a class="btn btn--secondary" href="${routes.page('form-builder')}">${icon('arrow-left', 'icon--sm')}Back to forms</a>`;
    const found = store.getBuilderForms().find(x => x.id === id);
    if (!store.canManageBuilderForms(user)) { main.innerHTML = `<div class="kids">${state('lock', 'You can’t edit forms', 'Your role or your school’s plan doesn’t include the Form Builder.', back)}</div>`; return; }
    if (!found) { main.innerHTML = `<div class="kids">${state('file', 'Form not found', 'It may have been removed, or the link is incomplete.', back)}</div>`; return; }
    let f = JSON.parse(JSON.stringify(found));
    let sel = f.fields.find(x => x.type !== 'section')?.id || f.fields[0]?.id || null;
    const save = { state: 'saved', timer: null, inflight: false, again: false, pending: null };
    let showIssues = false;
    let settingsOpen = false;
    let undo = null;
    const me = () => store.currentUser();
    const fieldName = q => q.label || (q.type === 'section' ? 'Untitled section' : 'Untitled field');

    function frame() {
      if (mobileQ.matches) {
        main.innerHTML = `<div class="kids bfl">${state('sliders', 'Form editing is available on tablet and desktop.', 'You can still preview and share your forms here.', `<div class="fm-row"><button class="btn btn--primary" type="button" data-preview>${icon('eye', 'icon--sm')}Preview</button>${f.status === 'live' ? `<button class="btn btn--secondary" type="button" data-copy>${icon('copy', 'icon--sm')}Copy link</button>` : ''}${back}</div>`)}${f.status === 'live' ? `<p class="bfl-card__link bfl-mobile-link"><span class="sr-only">Link: </span><span dir="ltr">${esc(absLink(f.id))}</span></p>` : ''}</div>`;
        return;
      }
      main.innerHTML = `<div class="fb bfb">
        <header class="fb-head bfb-head">
          <a class="btn btn--icon-ghost" href="${routes.page('form-builder')}" aria-label="Back to forms" data-back>${icon('arrow-left')}</a>
          <div class="fb-head__title"><label class="sr-only" for="bfb-name">Form name</label><input class="fb-htitle" id="bfb-name" data-model="name" placeholder="Untitled form" maxlength="120" value="${esc(f.name === 'Untitled form' ? '' : f.name)}"></div>
          <label class="sr-only" for="bfb-type">Form type</label><select class="input input--sm fb-type" id="bfb-type" data-model="type">${Object.entries(store.BF_TYPES).map(([k, l]) => `<option value="${k}"${f.type === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
          <span data-status></span>
          <span class="fb-save" role="status" aria-live="polite" data-save></span>
          <span class="fb-head__sp"></span>
          <button class="btn btn--secondary fb-settings-btn" type="button" data-toggle-settings aria-expanded="false" aria-controls="bfb-settings">${icon('sliders', 'icon--sm')}Field settings</button>
          <button class="btn btn--secondary" type="button" data-preview>${icon('eye', 'icon--sm')}Preview</button>
          <span data-copyslot></span>
          <button class="btn btn--primary" type="button" data-publish></button>
        </header>
        <div class="fb-grid">
          <aside class="fb-palette" aria-labelledby="bfb-pal-h"><h2 class="fb-h" id="bfb-pal-h">Add fields</h2><p class="fb-note">Drag into the form, or press a field to add it below the selected one.</p>
            ${store.BF_GROUPS.map(([g, types]) => `<h3 class="bfb-palgroup">${g}</h3><ul class="fb-pal">${types.map(k => `<li><button class="fb-pal__item" type="button" draggable="true" data-add="${k}" aria-label="Add ${esc(store.BF_FIELDS[k])} field"><span class="fb-pal__icon" aria-hidden="true">${icon(FICON[k])}</span><span class="bfb-pal__txt"><span>${esc(store.BF_FIELDS[k])}</span><small>${esc(FHELP[k])}</small></span>${icon('plus', 'icon--sm fb-pal__plus')}</button></li>`).join('')}</ul>`).join('')}</aside>
          <section class="fb-canvas" aria-labelledby="bfb-can-h" data-canvas></section>
          <aside class="fb-settings" id="bfb-settings" aria-labelledby="bfb-set-h" data-settings></aside>
        </div></div>`;
      drawHead();
      drawCanvas();
      drawSettings();
      drawSave();
    }

    function drawHead() {
      const unpub = store.builderUnpublished(f);
      const st = main.querySelector('[data-status]');
      if (st) st.innerHTML = `${chip(f.status === 'live' ? 'success' : 'neutral', store.BF_STATUSES[f.status], f.status === 'live' ? 'check-circle' : 'pencil')}${unpub ? chip('warning', 'Unpublished changes', 'alert-triangle') : ''}`;
      const pb = main.querySelector('[data-publish]');
      if (pb) pb.innerHTML = `${icon('megaphone', 'icon--sm')}${f.status === 'live' ? (unpub ? 'Publish changes' : 'Published') : 'Publish'}`;
      if (pb) pb.disabled = f.status === 'live' && !unpub;
      const cs = main.querySelector('[data-copyslot]');
      if (cs) cs.innerHTML = f.status === 'live' ? `<button class="btn btn--secondary" type="button" data-copy>${icon('copy', 'icon--sm')}Copy link</button>` : '';
    }

    function mock(q) {
      if (q.type === 'section') return '';
      if (q.type === 'text' || q.type === 'email' || q.type === 'phone') return `<span class="fb-mock fb-mock--input">${q.placeholder ? esc(q.placeholder) : q.type === 'email' ? 'name@example.com' : q.type === 'phone' ? '+91 …' : ''}</span>`;
      if (q.type === 'longtext') return '<span class="fb-mock fb-mock--area"></span>';
      if (q.type === 'date') return `<span class="fb-mock fb-mock--input">${icon('calendar-check', 'icon--sm')}dd / mm / yyyy</span>`;
      if (q.type === 'dropdown') return `<span class="fb-mock fb-mock--input">${esc(q.placeholder || 'Choose…')} · ${plural(q.options.length, 'option')}</span>`;
      if (q.type === 'multiselect') return `<span class="fb-mock-list">${q.options.slice(0, 3).map(o => `<span class="fb-mock-opt"><i class="is-box"></i>${esc(o.label || 'Option')}</span>`).join('')}${q.options.length > 3 ? `<small>+${q.options.length - 3} more</small>` : ''}</span>`;
      if (q.type === 'checkbox') return `<span class="fb-mock-list"><span class="fb-mock-opt"><i class="is-box"></i>${esc(q.label || 'Checkbox')}</span></span>`;
      if (q.type === 'file') return `<span class="fb-mock fb-mock--input">${icon('upload', 'icon--sm')}${q.accept.length === 2 ? 'Image or PDF' : q.accept[0] === 'pdf' ? 'PDF' : 'Image'} · up to ${q.maxKB >= 1024 ? '1 MB' : `${q.maxKB} KB`}</span>`;
      if (q.type === 'signature') return `<span class="fb-mock fb-mock--sig">${icon('pencil', 'icon--sm')}Signature pad</span>`;
      return `<span class="bfb-mock-consent">${esc((q.statement || 'Consent statement').slice(0, 140))}${q.requireAccept ? `<span class="fb-mock-opt"><i class="is-box"></i>I agree</span>` : ''}</span>`;
    }

    function drawCanvas() {
      const host = main.querySelector('[data-canvas]');
      if (!host) return;
      const iss = store.builderFormIssues(f);
      const byF = fid => iss.issues.filter(x => x.fid === fid);
      const general = iss.issues.filter(x => !x.fid);
      let n = 0;
      host.innerHTML = `<h2 class="fb-h bfb-canvas-h" id="bfb-can-h">Form content</h2>
        <div class="fb-meta panel">
          <label class="sr-only" for="bfb-title">Form name</label><input class="fb-title" id="bfb-title" data-model="name" placeholder="Untitled form" maxlength="120" value="${esc(f.name === 'Untitled form' ? '' : f.name)}"${showIssues && iss.errors.name ? ' aria-invalid="true"' : ''}>
          ${showIssues && iss.errors.name ? `<p class="field__hint field__hint--error">${icon('info')}${esc(iss.errors.name)}</p>` : ''}
          <div class="field"><label class="field__label" for="bfb-desc">Description</label><textarea class="input" id="bfb-desc" rows="2" maxlength="2000" data-model="description" placeholder="What is this form for? What happens after someone submits it?">${esc(f.description)}</textarea></div>
          <div class="field"><label class="field__label" for="bfb-submit">Submit button text</label><input class="input" id="bfb-submit" maxlength="40" data-model="submitLabel" placeholder="${esc({ application: 'Submit application', consent: 'Submit consent', custom: 'Submit' }[f.type])}" value="${esc(f.submitLabel)}"></div>
        </div>
        ${f.type === 'application' ? `<p class="ls-banner bfb-appnote">${icon('info', 'icon--sm')}<span>Application forms file an enquiry in <a href="${routes.page('admissions')}">Admissions</a> (source “Website form”). Map fields to <b>${store.BF_APPLICATION_REQUIRED.map(k => esc(store.BF_MAP[k].label)).join(', ')}</b> and make them required.</span></p>` : ''}
        ${showIssues && (iss.issues.length || iss.errors.fields) ? `<div class="ls-banner ls-banner--warn" role="alert">${icon('alert-triangle', 'icon--sm')}<div><p><b>Fix these before publishing:</b> ${esc(iss.errors.fields || '')}</p>${general.length ? `<ul class="bfb-issues">${general.map(x => `<li>${esc(x.msg)}</li>`).join('')}</ul>` : ''}</div></div>` : ''}
        ${f.fields.length ? `<ol class="fb-qs bfb-qs" data-qs aria-label="Form fields">${f.fields.map((q, i) => {
          const num = q.type === 'section' ? '' : (n += 1);
          return `<li class="fb-q${q.type === 'section' ? ' bfb-sec' : ''}${q.id === sel ? ' is-selected' : ''}${showIssues && byF(q.id).length ? ' is-invalid' : ''}" data-q="${esc(q.id)}">
            <div class="fb-q__bar"><span class="fb-q__handle" draggable="true" data-handle="${esc(q.id)}" title="Drag to reorder" aria-hidden="true">${icon('grip', 'icon--sm')}</span>${num ? `<span class="fb-q__n">${num}</span>` : ''}<span class="badge badge--plain an-chip an-chip--neutral">${icon(FICON[q.type])}${esc(store.BF_FIELDS[q.type])}</span>${q.required ? '<span class="fb-req">Required</span>' : ''}${q.mapTo ? `<span class="bfb-map">${icon('arrow-right', 'icon--sm')}${esc(store.BF_MAP[q.mapTo].label)}</span>` : ''}
              <span class="fb-q__tools"><button class="btn btn--icon-ghost btn--sm" type="button" data-up="${esc(q.id)}" aria-label="Move ${esc(fieldName(q))} up"${i === 0 ? ' disabled' : ''}>${icon('arrow-up', 'icon--sm')}</button><button class="btn btn--icon-ghost btn--sm" type="button" data-down="${esc(q.id)}" aria-label="Move ${esc(fieldName(q))} down"${i === f.fields.length - 1 ? ' disabled' : ''}>${icon('arrow-down', 'icon--sm')}</button><button class="btn btn--icon-ghost btn--sm" type="button" data-dupq="${esc(q.id)}" aria-label="Duplicate ${esc(fieldName(q))}">${icon('copy', 'icon--sm')}</button><button class="btn btn--icon-ghost btn--sm fb-del" type="button" data-delq="${esc(q.id)}" aria-label="Delete ${esc(fieldName(q))}">${icon('trash', 'icon--sm')}</button></span></div>
            <button class="fb-q__main" type="button" data-select="${esc(q.id)}" aria-pressed="${q.id === sel}"><b>${esc(fieldName(q))}${q.required ? ' <span class="field__req" aria-hidden="true">*</span>' : ''}</b>${q.help ? `<small>${esc(q.help)}</small>` : ''}<span class="fb-q__prev" aria-hidden="true">${mock(q)}</span></button>
            ${showIssues && byF(q.id).length ? `<p class="field__hint field__hint--error">${icon('info')}${esc(byF(q.id).map(x => x.msg).join(' '))}</p>` : ''}
          </li>`;
        }).join('')}</ol>` : `<div class="fb-empty" data-qs data-empty><span class="state-icon" aria-hidden="true">${icon('list')}</span><h2 class="kids-empty__title">This form has no fields yet</h2><p>Drag a field type here, or add one to start.</p><button class="btn btn--primary" type="button" data-add="text">${icon('plus', 'icon--sm')}Add your first field</button></div>`}
        ${f.fields.length ? `<div class="fb-addrow"><label class="sr-only" for="bfb-addtype">Field type to add</label><select class="input input--sm" id="bfb-addtype">${Object.entries(store.BF_FIELDS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select><button class="btn btn--secondary btn--sm" type="button" data-add-sel>${icon('plus', 'icon--sm')}Add field</button></div>` : ''}`;
    }

    // Destinations this field could fill: only compatible types, each destination once per form.
    function mapOptions(q) {
      const used = new Set(f.fields.filter(x => x.id !== q.id && x.mapTo).map(x => x.mapTo));
      const groups = {};
      Object.entries(store.BF_MAP).forEach(([k, m]) => { if (!m.types.includes(q.type)) return; (groups[m.group] ||= []).push(`<option value="${k}"${q.mapTo === k ? ' selected' : ''}${used.has(k) ? ' disabled' : ''}>${esc(m.label)}${used.has(k) ? ' (already used)' : ''}</option>`); });
      return `<option value="">Do not map</option>${Object.entries(groups).map(([g, o]) => `<optgroup label="${esc(g)}">${o.join('')}</optgroup>`).join('')}`;
    }

    function drawSettings() {
      const host = main.querySelector('[data-settings]');
      if (!host) return;
      host.classList.toggle('is-open', settingsOpen);
      main.querySelector('[data-toggle-settings]')?.setAttribute('aria-expanded', String(settingsOpen));
      const close = `<button class="btn btn--icon-ghost fb-settings__close" type="button" aria-label="Close field settings" data-close-settings>${icon('x')}</button>`;
      const q = f.fields.find(x => x.id === sel);
      if (!q) { host.innerHTML = `<div class="fb-set__head"><h2 class="fb-h" id="bfb-set-h">Field settings</h2>${close}</div><p class="fb-note">Select a field to edit its settings.</p>`; return; }
      const canMap = !['section', 'checkbox', 'consent', 'signature', 'file'].includes(q.type) && Object.values(store.BF_MAP).some(m => m.types.includes(q.type));
      const canon = q.mapTo ? store.bfMappedOptions(q.mapTo) : null;
      const sw = (attr, on, text) => `<button class="switch" type="button" role="switch" aria-checked="${on}" ${attr}><span class="switch__track"><span class="switch__thumb"></span></span><span>${text}</span></button>`;
      const opts = () => `<fieldset class="an-fs"><legend class="field__label">Options</legend>${canon ? `<p class="fb-note">${icon('lock', 'icon--sm')} Options follow the school’s list for “${esc(store.BF_MAP[q.mapTo].label)}”, so answers fill the record correctly.</p>` : ''}
        <ul class="fb-opts">${q.options.map((o, k) => `<li class="fb-opt"><label class="sr-only" for="bfb-o-${k}">Option ${k + 1}</label><input class="input input--sm" id="bfb-o-${k}" maxlength="120" value="${esc(o.label)}" data-opt="${k}"${canon ? ' readonly' : ''}${showIssues && !o.label.trim() ? ' aria-invalid="true"' : ''}>${canon ? '' : `<button class="btn btn--icon-ghost btn--sm" type="button" aria-label="Move option ${k + 1} up" data-opt-up="${k}"${k === 0 ? ' disabled' : ''}>${icon('arrow-up', 'icon--sm')}</button><button class="btn btn--icon-ghost btn--sm" type="button" aria-label="Move option ${k + 1} down" data-opt-down="${k}"${k === q.options.length - 1 ? ' disabled' : ''}>${icon('arrow-down', 'icon--sm')}</button><button class="btn btn--icon-ghost btn--sm" type="button" aria-label="Remove option ${k + 1}" data-opt-rm="${k}"${q.options.length <= 1 ? ' disabled' : ''}>${icon('x', 'icon--sm')}</button>`}</li>`).join('')}</ul>
        ${!canon && q.options.length < 30 ? `<button class="btn btn--tertiary btn--sm" type="button" data-opt-add>${icon('plus', 'icon--sm')}Add option</button>` : ''}</fieldset>`;
      let typeSet = '';
      if (q.type === 'text' || q.type === 'longtext') typeSet = `<div class="field"><label class="field__label" for="bfb-max">Maximum length</label><input class="input input--sm" id="bfb-max" type="number" min="1" max="${q.type === 'text' ? 300 : 5000}" value="${q.maxLength}" data-num="maxLength"><p class="field__hint">Characters. Longer answers are refused with a message.</p></div>`;
      if (q.type === 'email') typeSet = '<p class="fb-note">Answers must look like name@example.com.</p>';
      if (q.type === 'phone') typeSet = '<p class="fb-note">Digits (7 to 15), with an optional +, spaces, brackets or dashes. The number is stored exactly as typed.</p>';
      if (q.type === 'date') typeSet = `<div class="field"><label class="field__label" for="bfb-rule">Allowed dates</label><select class="input input--sm" id="bfb-rule" data-sel="dateRule">${[['any', 'Any date'], ['past', 'Today or earlier (e.g. date of birth)'], ['future', 'Today or later (e.g. start date)']].map(([k, l]) => `<option value="${k}"${q.dateRule === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="cls-form__row"><div class="field"><label class="field__label" for="bfb-min">Earliest</label><input class="input input--sm" type="date" id="bfb-min" value="${esc(q.minDate)}" data-sel="minDate"></div><div class="field"><label class="field__label" for="bfb-maxd">Latest</label><input class="input input--sm" type="date" id="bfb-maxd" value="${esc(q.maxDate)}" data-sel="maxDate"></div></div>`;
      if (q.type === 'dropdown') typeSet = `<div class="field"><label class="field__label" for="bfb-ph2">Placeholder</label><input class="input input--sm" id="bfb-ph2" maxlength="120" value="${esc(q.placeholder)}" data-q="placeholder"></div>${opts()}`;
      if (q.type === 'multiselect') typeSet = `${opts()}<div class="field"><label class="field__label" for="bfb-minsel">Choose at least</label><input class="input input--sm" type="number" min="1" max="${q.options.length}" id="bfb-minsel" value="${q.minSelect}" data-num="minSelect"><p class="field__hint">Applies when the field is required, or whenever someone answers it.</p></div>`;
      if (q.type === 'checkbox') typeSet = '<p class="fb-note">The label is the text next to the box. Turn on Required when it must be ticked; the submitted value is recorded.</p>';
      if (q.type === 'file') typeSet = `<fieldset class="an-fs"><legend class="field__label">Accepted files</legend><div class="fb-checks"><label class="fb-check"><input type="checkbox" data-accept="image"${q.accept.includes('image') ? ' checked' : ''}>Images (JPEG, PNG, WebP)</label><label class="fb-check"><input type="checkbox" data-accept="pdf"${q.accept.includes('pdf') ? ' checked' : ''}>PDF</label></div></fieldset><div class="field"><label class="field__label" for="bfb-maxkb">Maximum size</label><select class="input input--sm" id="bfb-maxkb" data-maxkb>${[[250, '250 KB'], [500, '500 KB'], [1024, '1 MB (limit)']].map(([k, l]) => `<option value="${k}"${q.maxKB === k ? ' selected' : ''}>${l}</option>`).join('')}</select><p class="field__hint">Prototype: files are stored in this browser only.</p></div>`;
      if (q.type === 'signature') typeSet = `<div class="field"><label class="field__label" for="bfb-stmt">Statement being signed</label><textarea class="input" id="bfb-stmt" rows="3" maxlength="3000" data-q="statement"${showIssues && !q.statement.trim() ? ' aria-invalid="true"' : ''}>${esc(q.statement)}</textarea><p class="field__hint">The drawn or typed signature and the time are stored. Not a verified or legally certified e-signature.</p></div>`;
      if (q.type === 'consent') typeSet = `<div class="field"><label class="field__label" for="bfb-stmt">Consent statement <span class="field__req" aria-hidden="true">*</span></label><textarea class="input" id="bfb-stmt" rows="5" maxlength="3000" data-q="statement"${showIssues && !q.statement.trim() ? ' aria-invalid="true"' : ''}>${esc(q.statement)}</textarea><p class="field__hint">Each response keeps the exact text and the form version it agreed to.</p></div>${sw('data-accept-req', q.requireAccept, 'Require “I agree” to submit')}`;
      host.innerHTML = `<div class="fb-set__head"><h2 class="fb-h" id="bfb-set-h">Field settings</h2>${close}</div>
        <p class="fb-set__type">${icon(FICON[q.type], 'icon--sm')}${esc(store.BF_FIELDS[q.type])}</p>
        <div class="field"><label class="field__label" for="bfb-label">${q.type === 'section' ? 'Section title' : q.type === 'checkbox' ? 'Text next to the box' : 'Label'} <span class="field__req" aria-hidden="true">*</span></label><input class="input" id="bfb-label" maxlength="200" data-q="label" value="${esc(q.label)}"${showIssues && !q.label.trim() ? ' aria-invalid="true"' : ''}></div>
        <div class="field"><label class="field__label" for="bfb-help">${q.type === 'section' ? 'Description' : 'Help text'}</label><input class="input" id="bfb-help" maxlength="500" data-q="help" value="${esc(q.help)}" placeholder="Optional"></div>
        ${['text', 'longtext', 'email', 'phone'].includes(q.type) ? `<div class="field"><label class="field__label" for="bfb-ph">Placeholder</label><input class="input" id="bfb-ph" maxlength="120" data-q="placeholder" value="${esc(q.placeholder)}" placeholder="Optional example"></div><div class="field"><label class="field__label" for="bfb-def">Default value</label><input class="input" id="bfb-def" maxlength="200" data-q="defaultValue" value="${esc(q.defaultValue)}" placeholder="Optional"></div>` : ''}
        ${['section', 'consent'].includes(q.type) ? '' : sw('data-required', q.required, 'Required')}
        ${typeSet}
        ${canMap ? `<div class="field bfb-mapfield"><label class="field__label" for="bfb-map">${icon('arrow-right', 'icon--sm')}Map to profile field</label><select class="input input--sm" id="bfb-map" data-map>${mapOptions(q)}</select><p class="field__hint">${f.type === 'application' ? 'Mapped answers fill the admissions enquiry and, on enrolment, the child and family records.' : 'Mapping is used by application forms. Other forms keep answers with the form.'}</p></div>` : ''}`;
    }

    function drawSave() {
      const el = main.querySelector('[data-save]');
      if (!el) return;
      el.className = `fb-save is-${save.state}`;
      el.innerHTML = save.state === 'saving' ? '<span class="spinner" aria-hidden="true"></span>Saving…' : save.state === 'dirty' ? `${icon('pencil', 'icon--sm')}Unsaved changes` : save.state === 'saved' ? `${icon('check', 'icon--sm')}Saved` : `${icon('alert-circle', 'icon--sm')}Save failed <button class="btn btn--tertiary btn--sm" type="button" data-retry-save>Retry</button>`;
    }
    async function doSave() {
      clearTimeout(save.timer);
      if (save.inflight) { save.again = true; return save.pending; }
      save.inflight = true;
      save.state = 'saving';
      drawSave();
      save.pending = (async () => {
        const r = await store.saveBuilderForm(me(), f.id, f, { fail: fails.save });
        fails.save = false;
        save.inflight = false;
        if (r.ok) { f.updatedAt = r.form.updatedAt; save.state = 'saved'; if (save.again) { save.again = false; drawSave(); return doSave(); } } else save.state = 'failed';
        drawSave();
        drawHead();
        return r.ok;
      })();
      return save.pending;
    }
    const changed = ({ canvas = true, settings = false } = {}) => { save.state = 'dirty'; drawSave(); clearTimeout(save.timer); save.timer = setTimeout(doSave, 600); if (canvas) drawCanvas(); if (settings) drawSettings(); drawHead(); };
    const keepFocus = (selector, fn) => { fn(); main.querySelector(selector)?.focus(); };

    function addField(type, at = null) {
      const q = store.newBuilderField(type);
      const i = at ?? (sel ? f.fields.findIndex(x => x.id === sel) + 1 : f.fields.length);
      f.fields.splice(Math.max(0, Math.min(i, f.fields.length)), 0, q);
      sel = q.id;
      if (innerWidth < 1024) settingsOpen = true;
      changed({ settings: true });
      main.querySelector('#bfb-label')?.focus();
      main.querySelector(`[data-q="${CSS.escape(q.id)}"]`)?.scrollIntoView?.({ block: 'nearest' });
    }
    function moveField(fid, to) {
      const from = f.fields.findIndex(x => x.id === fid);
      if (from < 0) return;
      const [q] = f.fields.splice(from, 1);
      f.fields.splice(Math.max(0, Math.min(to > from ? to - 1 : to, f.fields.length)), 0, q);
      changed({ settings: true });
    }
    function deleteField(fid) {
      const i = f.fields.findIndex(x => x.id === fid);
      const q = f.fields[i];
      kids.dialog({ label: 'Form Builder', title: 'Delete this field?', desc: `“${esc(fieldName(q))}” and its settings${q.mapTo ? `, including its mapping to ${esc(store.BF_MAP[q.mapTo].label)},` : ''} will be removed. Answers already submitted are kept. You can undo this straight after.`, body: '', submit: 'Delete field', danger: true,
        async onSubmit() {
          f.fields.splice(i, 1);
          undo = { q, i };
          sel = f.fields[Math.min(i, f.fields.length - 1)]?.id || null;
          changed({ settings: true });
          toast('Field deleted', `“${fieldName(q)}”`, 'trash', { duration: 8000, action: { label: 'Undo', onClick: () => { if (!undo) return; f.fields.splice(undo.i, 0, undo.q); sel = undo.q.id; undo = null; changed({ settings: true }); } } });
          return { ok: true };
        } });
    }
    function duplicateField(fid) {
      const i = f.fields.findIndex(x => x.id === fid);
      const copy = JSON.parse(JSON.stringify(f.fields[i]));
      const fresh = store.newBuilderField(copy.type);
      copy.id = fresh.id;
      if (copy.options) copy.options = copy.options.map(o => ({ ...o, id: `bo-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}` }));
      copy.label = copy.label ? `${copy.label} (copy)`.slice(0, 200) : '';
      const wasMapped = Boolean(copy.mapTo);
      copy.mapTo = '';
      f.fields.splice(i + 1, 0, copy);
      sel = copy.id;
      changed({ settings: true });
      main.querySelector(`[data-select="${CSS.escape(copy.id)}"]`)?.focus();
      toast('Field duplicated', wasMapped ? 'The copy isn’t mapped — each profile field can be filled once.' : `“${fieldName(copy)}”`, 'copy');
    }

    async function publish() {
      showIssues = true;
      const iss = store.builderFormIssues(f);
      drawCanvas();
      drawSettings();
      if (Object.keys(iss.errors).length || iss.issues.length) {
        toast('Not ready to publish', `${iss.errors.name ? `${iss.errors.name} ` : ''}${iss.errors.fields || ''} The form stays in ${f.status === 'live' ? 'its published version' : 'Draft'}.`, 'alert-triangle', { duration: 7000 });
        const bad = iss.issues.find(x => x.fid);
        if (iss.errors.name) main.querySelector('#bfb-title')?.focus();
        else if (bad) { sel = bad.fid; drawCanvas(); drawSettings(); main.querySelector(`[data-select="${CSS.escape(bad.fid)}"]`)?.focus(); }
        return;
      }
      if (!(await doSave())) { toast('Save failed', 'The form must be saved before publishing. Try again.', 'alert-circle'); return; }
      const again = f.status === 'live';
      kids.dialog({
        label: 'Form Builder', title: again ? 'Publish these changes?' : 'Publish this form?',
        desc: `<b>${esc(f.name)}</b> · ${esc(store.BF_TYPES[f.type])} form · ${plural(answerable(f), 'field')}. ${again ? 'People who open the link will see the new version from now on. Responses already submitted keep the answers and wording they saw.' : 'Anyone with the link will be able to fill it in.'}${f.type === 'application' ? ' Each valid submission creates an enquiry in Admissions.' : ''}`,
        body: '<p class="cd-note">Prototype: the link works in this browser only — responses are stored on this device.</p>',
        submit: again ? 'Publish changes' : 'Publish',
        async onSubmit() {
          const r = await store.publishBuilderForm(me(), f.id, { fail: fails.publish });
          fails.publish = false;
          if (!r.ok) return { ok: false, message: r.reason === 'invalid' ? 'The form has problems — close this and fix them first.' : `The form wasn’t published, so it’s still ${f.status === 'live' ? 'showing the previous version' : 'a draft'}. ${FAIL.storage}` };
          f = JSON.parse(JSON.stringify(r.form));
          drawHead();
          setTimeout(() => published(r), 200);
          return { ok: true };
        }
      });
    }
    function published(r) {
      const link = absLink(r.form.id);
      const d = kids.dialog({
        label: 'Form Builder', title: 'Your form is live',
        desc: `<b>${esc(r.form.name)}</b> · version ${r.form.version}. Share this link with families.`,
        body: `<div class="field"><label class="field__label" for="kd-plink">Form link</label><div class="bfb-linkrow"><input class="input" id="kd-plink" readonly dir="ltr" value="${esc(link)}"><button class="btn btn--secondary" type="button" data-pcopy>${icon('copy', 'icon--sm')}Copy link</button></div></div>
          <p><a class="btn btn--tertiary btn--sm" href="${esc(store.builderFormLink(r.form.id))}" target="_blank" rel="noopener">${icon('eye', 'icon--sm')}Preview live form</a></p>`,
        submit: 'Done', async onSubmit() { return { ok: true }; }
      });
      d.form.querySelector('[data-pcopy]').addEventListener('click', e => copyLink(r.form.id, e.currentTarget));
      d.form.querySelector('[data-pcopy]').focus();
    }

    function bind() {
      main.addEventListener('input', e => {
        const t = e.target;
        const m = t.dataset.model;
        if (m && m !== 'type') { f[m] = t.value; if (m === 'name') main.querySelectorAll('[data-model="name"]').forEach(x => { if (x !== t) x.value = t.value; }); changed({ canvas: false }); return; }
        const q = f.fields.find(x => x.id === sel);
        if (!q) return;
        if (t.dataset.q) {
          q[t.dataset.q] = t.value;
          changed({ canvas: false });
          const card = main.querySelector(`[data-select="${CSS.escape(q.id)}"]`);
          if (card && (t.dataset.q === 'label' || t.dataset.q === 'help' || t.dataset.q === 'placeholder' || t.dataset.q === 'statement')) { card.querySelector('b').innerHTML = `${esc(fieldName(q))}${q.required ? ' <span class="field__req" aria-hidden="true">*</span>' : ''}`; const sm = card.querySelector('small'); if (q.help) { if (sm) sm.textContent = q.help; else card.querySelector('b').insertAdjacentHTML('afterend', `<small>${esc(q.help)}</small>`); } else sm?.remove(); card.querySelector('.fb-q__prev').innerHTML = mock(q); }
          return;
        }
        if (t.dataset.opt) { q.options[+t.dataset.opt].label = t.value; changed({ canvas: false }); main.querySelector(`[data-select="${CSS.escape(q.id)}"] .fb-q__prev`).innerHTML = mock(q); return; }
        if (t.dataset.num) { const v = Number(t.value); if (Number.isFinite(v) && v >= 1) { q[t.dataset.num] = Math.round(v); changed({ canvas: false }); } }
      });
      main.addEventListener('change', e => {
        const t = e.target;
        if (t.dataset.model === 'type') {
          f.type = t.value;
          keepFocus('#bfb-type', () => { changed({ settings: true }); main.querySelector('#bfb-submit')?.setAttribute('placeholder', { application: 'Submit application', consent: 'Submit consent', custom: 'Submit' }[f.type]); });
          return;
        }
        const q = f.fields.find(x => x.id === sel);
        if (!q) return;
        if (t.dataset.sel) { q[t.dataset.sel] = t.value; keepFocus(`[data-sel="${t.dataset.sel}"]`, () => changed({ settings: false })); return; }
        if (t.dataset.accept) { const on = [...main.querySelectorAll('[data-accept]:checked')].map(x => x.dataset.accept); if (!on.length) { t.checked = true; toast('Keep one file type', 'A file field needs at least one accepted type.'); return; } q.accept = on; changed({}); return; }
        if (t.matches('[data-maxkb]')) { q.maxKB = Number(t.value); changed({}); return; }
        if (t.matches('[data-map]')) {
          q.mapTo = t.value;
          const canon = store.bfMappedOptions(q.mapTo);
          if (canon && q.options) {
            const had = q.options.map(o => o.label.trim().toLowerCase());
            if (canon.some(c => !had.includes(c.toLowerCase())) || had.some(h => !canon.some(c => c.toLowerCase() === h))) { q.options = canon.map(label => ({ id: q.options.find(o => o.label.trim().toLowerCase() === label.toLowerCase())?.id || `bo-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, label })); toast('Options updated', `The options now match the school’s list for ${store.BF_MAP[q.mapTo].label}.`, 'list'); }
          }
          if (q.mapTo === 'child.dob' && q.dateRule === 'any') q.dateRule = 'past';
          if (q.mapTo === 'child.start' && q.dateRule === 'any') q.dateRule = 'future';
          keepFocus('[data-map]', () => changed({ settings: true }));
        }
      });
      main.addEventListener('click', e => {
        const t = e.target;
        if (t.closest('[data-retry-save]')) { doSave(); return; }
        if (t.closest('[data-preview]')) { if (!mobileQ.matches) doSave(); previewDialog(JSON.parse(JSON.stringify(f)), { title: f.name, note: f.status === 'live' && store.builderUnpublished(f) ? 'Your unpublished changes' : f.status === 'live' ? 'Same as the live form' : 'Draft — not published' }); return; }
        if (t.closest('[data-copy]')) { copyLink(f.id, t.closest('[data-copy]')); return; }
        if (t.closest('[data-publish]')) { publish(); return; }
        if (t.closest('[data-toggle-settings]')) { settingsOpen = !settingsOpen; drawSettings(); if (settingsOpen) main.querySelector('[data-settings] input, [data-settings] textarea, [data-close-settings]')?.focus(); return; }
        if (t.closest('[data-close-settings]')) { settingsOpen = false; drawSettings(); (main.querySelector(`[data-select="${CSS.escape(sel || '')}"]`) || main.querySelector('[data-toggle-settings]'))?.focus(); return; }
        const add = t.closest('[data-add]');
        if (add) { addField(add.dataset.add); return; }
        if (t.closest('[data-add-sel]')) { addField(main.querySelector('#bfb-addtype').value); return; }
        const s = t.closest('[data-select]');
        if (s) { sel = s.dataset.select; if (innerWidth < 1024) settingsOpen = true; drawCanvas(); drawSettings(); main.querySelector(`[data-select="${CSS.escape(sel)}"]`)?.focus(); return; }
        const up = t.closest('[data-up]');
        if (up) { const i = f.fields.findIndex(x => x.id === up.dataset.up); moveField(up.dataset.up, i - 1); (main.querySelector(`[data-up="${CSS.escape(up.dataset.up)}"]:not(:disabled)`) || main.querySelector(`[data-down="${CSS.escape(up.dataset.up)}"]`))?.focus(); return; }
        const dn = t.closest('[data-down]');
        if (dn) { const i = f.fields.findIndex(x => x.id === dn.dataset.down); moveField(dn.dataset.down, i + 2); (main.querySelector(`[data-down="${CSS.escape(dn.dataset.down)}"]:not(:disabled)`) || main.querySelector(`[data-up="${CSS.escape(dn.dataset.down)}"]`))?.focus(); return; }
        const dq = t.closest('[data-dupq]');
        if (dq) { duplicateField(dq.dataset.dupq); return; }
        const del = t.closest('[data-delq]');
        if (del) { deleteField(del.dataset.delq); return; }
        const q = f.fields.find(x => x.id === sel);
        if (!q) return;
        if (t.closest('[data-required]')) { q.required = !q.required; keepFocus('[data-required]', () => changed({ settings: true })); return; }
        if (t.closest('[data-accept-req]')) { q.requireAccept = !q.requireAccept; q.required = q.requireAccept; keepFocus('[data-accept-req]', () => changed({ settings: true })); return; }
        if (t.closest('[data-opt-add]')) { q.options.push({ id: `bo-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, label: `Option ${q.options.length + 1}` }); keepFocus(`[data-opt="${q.options.length - 1}"]`, () => changed({ settings: true })); return; }
        const ou = t.closest('[data-opt-up]');
        if (ou) { const k = +ou.dataset.optUp; [q.options[k - 1], q.options[k]] = [q.options[k], q.options[k - 1]]; keepFocus(`[data-opt-up="${k - 1}"]:not(:disabled), [data-opt-down="${k - 1}"]`, () => changed({ settings: true })); return; }
        const od = t.closest('[data-opt-down]');
        if (od) { const k = +od.dataset.optDown; [q.options[k + 1], q.options[k]] = [q.options[k], q.options[k + 1]]; keepFocus(`[data-opt-down="${k + 1}"]:not(:disabled), [data-opt-up="${k + 1}"]`, () => changed({ settings: true })); return; }
        const orm = t.closest('[data-opt-rm]');
        if (orm) { const k = +orm.dataset.optRm; q.options.splice(k, 1); q.minSelect = Math.min(q.minSelect || 1, q.options.length); keepFocus(`[data-opt="${Math.max(0, k - 1)}"]`, () => changed({ settings: true })); }
      });
      main.addEventListener('keydown', e => { if (e.key === 'Escape' && settingsOpen && innerWidth < 1024 && e.target.closest('[data-settings]')) { settingsOpen = false; drawSettings(); main.querySelector(`[data-select="${CSS.escape(sel || '')}"]`)?.focus(); } });

      // Drag and drop: palette → canvas inserts; handle → canvas reorders. Buttons do the same without a mouse.
      let drag = null;
      main.addEventListener('dragstart', e => {
        const a = e.target.closest?.('[data-add]');
        const h = e.target.closest?.('[data-handle]');
        if (a) drag = { add: a.dataset.add };
        else if (h) { drag = { move: h.dataset.handle }; h.closest('.fb-q').classList.add('is-dragging'); }
        else return;
        e.dataTransfer.effectAllowed = drag.add ? 'copy' : 'move';
        try { e.dataTransfer.setData('text/plain', drag.add || drag.move); } catch { /* some browsers */ }
      });
      const dropIndex = e => {
        const cards = [...main.querySelectorAll('.bfb-qs > .fb-q')];
        let idx = cards.length;
        for (let k = 0; k < cards.length; k += 1) { const r = cards[k].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { idx = k; break; } }
        return { idx, cards };
      };
      const clearMarks = () => main.querySelectorAll('.is-drop-before, .is-drop-after, .is-drop-into').forEach(x => x.classList.remove('is-drop-before', 'is-drop-after', 'is-drop-into'));
      main.addEventListener('dragover', e => {
        if (!drag || !e.target.closest?.('[data-canvas]')) return;
        e.preventDefault();
        clearMarks();
        const { idx, cards } = dropIndex(e);
        if (!cards.length) main.querySelector('[data-empty]')?.classList.add('is-drop-into');
        else if (idx < cards.length) cards[idx].classList.add('is-drop-before');
        else cards[cards.length - 1].classList.add('is-drop-after');
      });
      main.addEventListener('drop', e => {
        if (!drag || !e.target.closest?.('[data-canvas]')) return;
        e.preventDefault();
        const { idx } = dropIndex(e);
        clearMarks();
        const d = drag;
        drag = null;
        if (d.add) addField(d.add, idx); else moveField(d.move, idx);
      });
      main.addEventListener('dragend', () => { drag = null; clearMarks(); main.querySelectorAll('.is-dragging').forEach(x => x.classList.remove('is-dragging')); });
      mobileQ.addEventListener('change', frame);
      window.addEventListener('beforeunload', e => { if (['dirty', 'saving', 'failed'].includes(save.state)) { e.preventDefault(); e.returnValue = ''; } });
      main.addEventListener('click', e => { const b = e.target.closest('[data-back]'); if (b && ['dirty', 'saving'].includes(save.state)) { e.preventDefault(); doSave().then(ok => { if (ok) location.href = b.href; }); } });
    }

    bind();
    frame();
    main.querySelector('#bfb-title')?.focus();
  }

  window.NexoraFormBuilder = { render, copyLink };
})();
