/* Forms, Permissions & Acknowledgements (app.html?page=forms)
   Views: list (default) · ?edit=<id>|new (three-panel builder, ≥768px) · ?results=<id>[&tab=overview|questions|responses]
   · ?respond=<id>&family=<familyId> (demo parent view: families have no login yet).
   The store re-checks permissions, conditional visibility, required answers, due dates and duplicates on every save.
   Test hooks: ?fail=1 (list load error), ?savefail=1 (first builder save fails). */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const kids = window.NexoraChildren;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const params = new URLSearchParams(location.search);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobileQ = matchMedia('(max-width: 767px)');
  const pad = n => String(n).padStart(2, '0');
  const isoDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const when = s => (s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
  const dayOnly = s => (s ? new Date(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—');
  const toast = (t, x, i = 'info', o) => window.NexoraToast?.show(t, x, i, o);
  const routes = store.routes;
  const QICON = { short: 'note', long: 'list', single: 'check-circle', multi: 'check', rating: 'star', date: 'calendar-check', yesno: 'shield-check', file: 'upload', signature: 'pencil' };
  const TYPE_ICON = { survey: 'chart', permission: 'shield-check', acknowledgement: 'check-circle' };
  const STATUS_TONE = { draft: 'info', open: 'success', closed: 'neutral' };
  const FAIL = {
    forbidden: 'Your role can’t do this. Nothing was changed.',
    missing: 'This form no longer exists. Refresh the page.',
    locked: 'This form has been published or closed, so it can’t be changed here.',
    closed: 'This form is closed and isn’t accepting responses.',
    overdue: 'The due date has passed, so this form isn’t accepting responses.',
    ineligible: 'This family isn’t in the form’s audience.',
    duplicate: 'This family has already responded. Only one response per family is kept.',
    none: 'Everyone eligible has responded — there’s no one to remind.',
    storage: 'This couldn’t be saved on this device. Nothing was changed. Please try again.'
  };
  const failText = r => (r.errors && Object.values(r.errors)[0]) || FAIL[r.reason] || FAIL.storage;
  const chip = (tone, text, ic = '') => `<span class="badge badge--plain an-chip an-chip--${tone}">${ic ? icon(ic) : ''}${esc(text)}</span>`;
  const statusChip = f => (store.formOverdue(f) ? chip('warning', 'Open · past due', 'clock') : chip(STATUS_TONE[f.status], store.FORM_STATUSES[f.status], f.status === 'open' ? 'check' : f.status === 'closed' ? 'lock' : 'pencil'));
  const state = (iconName, title, text, action = '', tone = '') => `<div class="kids-empty an-state"${tone === 'error' ? ' role="alert"' : ''}><span class="state-icon${tone ? ` state-icon--${tone}` : ''}" aria-hidden="true">${icon(iconName)}</span><h2 class="kids-empty__title">${title}</h2><p>${text}</p>${action}</div>`;
  const download = (text, filename) => { const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); const a = Object.assign(document.createElement('a'), { href: url, download: filename }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); };
  const go = extra => { location.href = routes.page('forms', extra); };

  function render(key, main, user) {
    if (key !== 'forms') return false;
    main.classList.add('kids-page');
    if (params.get('edit')) builder(main, user, params.get('edit'));
    else if (params.get('results')) results(main, user, params.get('results'));
    else if (params.get('respond')) respond(main, user, params.get('respond'), params.get('family'));
    else list(main, user);
    return true;
  }

  /* ================================================================= Shared: the parent-facing form */

  // Renders the configured form (same definitions as the builder) into host. mode 'preview' never touches the store.
  function formUI(host, f, { mode, family = null, guardianId = '', guardianName = '', user, draftKey = '', onDirty = () => {}, onSubmitted = () => {} }) {
    const answers = {};
    const local = {};
    const pads = {};
    let busy = false;
    let dirty = false;
    try { Object.assign(answers, JSON.parse(sessionStorage.getItem(draftKey) || '{}')); } catch { /* no draft */ }
    const school = store.school;
    const qHtml = (q, i) => {
      const id = `fp-${q.id}`;
      const req = q.required ? ' <span class="field__req" aria-hidden="true">*</span><span class="sr-only">(required)</span>' : '';
      const help = q.help ? `<p class="fp-help" id="${id}-help">${esc(q.help)}</p>` : '';
      const desc = `${q.help ? `${id}-help ` : ''}${id}-err`;
      const err = `<p class="field__hint field__hint--error" id="${id}-err" data-qerr="${q.id}" hidden></p>`;
      const legend = `<legend class="fp-label"><span class="fp-n">${i + 1}</span><span>${esc(q.label || 'Untitled question')}${req}</span></legend>`;
      const v = answers[q.id];
      let control = '';
      if (q.type === 'short') control = `<input class="input" id="${id}" maxlength="300" data-a="${q.id}" aria-describedby="${desc}" value="${esc(v || '')}">`;
      else if (q.type === 'long') control = `<textarea class="input fp-textarea" id="${id}" rows="4" maxlength="4000" data-a="${q.id}" aria-describedby="${desc}">${esc(v || '')}</textarea>`;
      else if (q.type === 'date') control = `<input class="input" type="date" id="${id}" data-a="${q.id}" aria-describedby="${desc}" value="${esc(v || '')}">`;
      else if (q.type === 'single' || q.type === 'yesno') {
        const opts = q.type === 'yesno' ? [['yes', 'Yes'], ['no', 'No']] : q.options.map(o => [o.id, o.label]);
        control = `<div class="fp-opts${q.type === 'yesno' ? ' fp-opts--yn' : ''}">${opts.map(([k, l]) => `<label class="fp-opt"><input type="radio" name="${id}" value="${esc(k)}" data-a="${q.id}"${v === k ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;
      } else if (q.type === 'multi') control = `<p class="fp-help">Choose all that apply.</p><div class="fp-opts">${q.options.map(o => `<label class="fp-opt fp-opt--check"><input type="checkbox" value="${esc(o.id)}" data-a="${q.id}"${(v || []).includes(o.id) ? ' checked' : ''}><span>${esc(o.label)}</span></label>`).join('')}</div>`;
      else if (q.type === 'rating') control = `<div class="fp-rating"><div class="fp-rating__row">${[1, 2, 3, 4, 5].map(k => `<label class="fp-rate"><input type="radio" name="${id}" value="${k}" data-a="${q.id}"${Number(v) === k ? ' checked' : ''} aria-label="${k} out of 5${k === 1 && q.scale?.low ? ` — ${esc(q.scale.low)}` : k === 5 && q.scale?.high ? ` — ${esc(q.scale.high)}` : ''}"><span aria-hidden="true">${k}</span></label>`).join('')}</div><div class="fp-rating__ends" aria-hidden="true"><span>${esc(q.scale?.low || '')}</span><span>${esc(q.scale?.high || '')}</span></div></div>`;
      else if (q.type === 'file') {
        const acc = q.accept.flatMap(k => (k === 'image' ? ['image/jpeg', 'image/png', 'image/webp'] : ['application/pdf'])).join(',');
        control = `<div class="fp-file"><input class="sr-only" type="file" id="${id}" accept="${acc}" data-file="${q.id}" aria-describedby="${desc}"><label class="btn btn--secondary btn--sm" for="${id}">${icon('upload', 'icon--sm')}Choose file</label><span class="fp-help">${q.accept.length === 2 ? 'Image or PDF' : q.accept[0] === 'pdf' ? 'PDF' : 'Image'} · up to ${q.maxKB >= 1024 ? '1 MB' : `${q.maxKB} KB`}</span></div><ul class="fp-files" data-files="${q.id}"></ul>`;
      } else if (q.type === 'signature') {
        control = `<p class="fp-statement">${esc(q.statement || 'I confirm the information above.')}</p>
          <div class="fp-sig" data-sig="${q.id}"><canvas class="fp-sig__pad" tabindex="0" role="img" aria-label="Signature pad: draw your signature with a finger, stylus or mouse" aria-describedby="${desc}"></canvas><span class="fp-sig__hint" aria-hidden="true">Sign here</span></div>
          <div class="fp-sig__tools"><button class="btn btn--tertiary btn--sm" type="button" data-sig-clear="${q.id}">${icon('refresh', 'icon--sm')}Clear</button><button class="btn btn--tertiary btn--sm" type="button" data-sig-type="${q.id}" aria-expanded="false">Type my name instead</button></div>
          <div class="field fp-sig__typed" data-sig-typed="${q.id}" hidden><label class="field__label" for="${id}-typed">Your full name</label><input class="input" id="${id}-typed" data-sig-name="${q.id}" autocomplete="name"></div>
          <p class="fp-help">Signing as <b>${esc(guardianName || 'the guardian')}</b>. The date and time are recorded when you submit.${mode === 'preview' ? '' : ' Prototype: this is not a verified or legally certified e-signature.'}</p>`;
      }
      const group = ['single', 'yesno', 'multi', 'rating'].includes(q.type);
      return `<div class="fp-q" data-qwrap="${q.id}">${group ? `<fieldset class="fp-fs" aria-describedby="${desc}">${legend}${help}${control}</fieldset>` : `<div class="fp-fs"><label class="fp-label" for="${id}"><span class="fp-n">${i + 1}</span><span>${esc(q.label || 'Untitled question')}${req}</span></label>${help}${control}</div>`}${err}</div>`;
    };
    host.innerHTML = `<div class="fp">
      <div class="fp-brand"><span class="fp-brand__logo" aria-hidden="true">${icon('leaf')}</span><span><b>${esc(school.name || 'School')}</b><small>${esc(store.FORM_TYPES[f.type])}${f.dueAt ? ` · due ${esc(dayOnly(f.dueAt))}` : ''}</small></span></div>
      <h2 class="fp-title">${esc(f.title || 'Untitled form')}</h2>
      ${f.description ? `<p class="fp-desc">${esc(f.description)}</p>` : ''}
      ${f.intro ? `<p class="fp-intro">${esc(f.intro)}</p>` : ''}
      ${family ? `<p class="fp-for">${icon('users', 'icon--sm')}For ${esc(family.children.join(', ') || family.name)}</p>` : ''}
      <div class="fp-progress" aria-live="polite"><span class="an-prog__bar" aria-hidden="true"><i data-prog style="width:0%"></i></span><small data-progtxt></small></div>
      <form class="fp-form" novalidate>${f.questions.map(qHtml).join('') || '<p class="cp-muted">This form has no questions yet.</p>'}
        <p class="field__hint field__hint--error" data-form-error role="alert" hidden></p>
        <button class="btn btn--primary kids-yellow fp-submit" type="submit"${f.questions.length ? '' : ' disabled'}>${f.type === 'survey' ? 'Submit answers' : f.type === 'permission' ? 'Submit permission' : 'Submit acknowledgement'}</button>
      </form></div>`;
    const formEl = host.querySelector('form');

    function refresh() {
      const shown = store.visibleFormQuestions(f.questions, answers);
      f.questions.forEach(q => { const w = host.querySelector(`[data-qwrap="${q.id}"]`); if (w) w.hidden = !shown.has(q.id); });
      const vis = f.questions.filter(q => shown.has(q.id));
      let n = 0;
      vis.forEach((q, i) => { const lab = host.querySelector(`[data-qwrap="${q.id}"] .fp-n`); if (lab) lab.textContent = i + 1; if (store.formAnswered(q, answerFor(q))) n += 1; });
      host.querySelector('[data-prog]').style.width = `${vis.length ? Math.round((n / vis.length) * 100) : 0}%`;
      host.querySelector('[data-progtxt]').textContent = `${n} of ${plural(vis.length, 'question')} answered`;
      Object.keys(pads).forEach(id => pads[id].fit());
      return shown;
    }
    const answerFor = q => (q.type === 'signature' ? (pads[q.id] && !pads[q.id].isEmpty() ? { fileId: 'pending' } : undefined) : q.type === 'file' ? (local[q.id] || []).filter(x => x.state === 'ready').map(x => x.id) : answers[q.id]);
    const markDirty = () => { if (!dirty) { dirty = true; onDirty(true); } if (draftKey) { const safe = Object.fromEntries(Object.entries(answers).filter(([k]) => { const q = f.questions.find(x => x.id === k); return q && !['file', 'signature'].includes(q.type); })); try { sessionStorage.setItem(draftKey, JSON.stringify(safe)); } catch { /* private mode */ } } };
    const showErr = (qid, msg) => { const h = host.querySelector(`[data-qerr="${qid}"]`); if (!h) return; h.innerHTML = msg ? `${icon('info')}${esc(msg)}` : ''; h.hidden = !msg; host.querySelector(`[data-qwrap="${qid}"]`)?.classList.toggle('is-invalid', Boolean(msg)); };

    function drawFiles(qid) {
      host.querySelector(`[data-files="${qid}"]`).innerHTML = (local[qid] || []).map((x, i) => `<li class="fp-fileitem${x.state === 'error' ? ' is-error' : ''}">${icon(x.state === 'error' ? 'alert-circle' : 'file', 'icon--sm')}<span class="fp-fileitem__name">${esc(x.name)}${x.state === 'error' ? ` — ${esc(x.error)}` : ''}</span>${x.state === 'uploading' ? `<progress max="100" value="${x.progress || 0}" aria-label="Uploading ${esc(x.name)}"></progress>` : ''}${x.state !== 'uploading' ? `<button class="btn btn--icon-ghost btn--sm" type="button" aria-label="Remove ${esc(x.name)}" data-unfile="${qid}" data-i="${i}">${icon('x', 'icon--sm')}</button>` : ''}</li>`).join('');
    }
    async function addFile(q, file) {
      const item = { name: file.name, state: 'uploading', progress: 0 };
      (local[q.id] = local[q.id] || []).splice(0, 9, item);
      drawFiles(q.id);
      const allowed = q.accept.flatMap(k => (k === 'image' ? ['image/jpeg', 'image/png', 'image/webp'] : ['application/pdf']));
      if (!allowed.includes(file.type)) { Object.assign(item, { state: 'error', error: q.accept.length === 2 ? 'Choose an image or a PDF.' : q.accept[0] === 'pdf' ? 'Choose a PDF.' : 'Choose an image.' }); drawFiles(q.id); return; }
      if (file.size > q.maxKB * 1024) { Object.assign(item, { state: 'error', error: `This file is over ${q.maxKB >= 1024 ? '1 MB' : `${q.maxKB} KB`}.` }); drawFiles(q.id); return; }
      const data = await new Promise(res => { const fr = new FileReader(); fr.onprogress = e => { if (e.lengthComputable) { item.progress = Math.round((e.loaded / e.total) * 80); drawFiles(q.id); } }; fr.onload = () => res(fr.result); fr.onerror = () => res(''); fr.readAsDataURL(file); });
      if (mode === 'preview') { Object.assign(item, { id: `preview-${Date.now()}`, state: 'ready', progress: 100 }); }
      else {
        item.progress = 90; drawFiles(q.id);
        const r = await store.uploadFormFile(store.currentUser(), f.id, q.id, { name: file.name, mime: file.type, size: file.size, data });
        if (r.ok) Object.assign(item, { id: r.file.id, state: 'ready', progress: 100 }); else Object.assign(item, { state: 'error', error: r.errors?.file || 'Upload failed.' });
      }
      drawFiles(q.id);
      showErr(q.id, '');
      markDirty();
      refresh();
    }

    f.questions.filter(q => q.type === 'signature').forEach(q => { pads[q.id] = signaturePad(host.querySelector(`[data-sig="${q.id}"]`), () => { showErr(q.id, ''); markDirty(); refresh(); }); });

    formEl.addEventListener('input', e => {
      const t = e.target;
      if (t.matches('[data-sig-name]')) { pads[t.dataset.sigName].typed(t.value); return; }
      const qid = t.dataset.a;
      if (!qid) return;
      const q = f.questions.find(x => x.id === qid);
      if (q.type === 'multi') answers[qid] = [...formEl.querySelectorAll(`[data-a="${qid}"]:checked`)].map(x => x.value);
      else if (q.type === 'rating') answers[qid] = Number(t.value);
      else answers[qid] = t.value;
      showErr(qid, '');
      markDirty();
      refresh();
    });
    formEl.addEventListener('change', e => {
      const t = e.target;
      if (t.matches('[data-a]') && (t.type === 'radio' || t.type === 'checkbox')) t.dispatchEvent(new Event('input', { bubbles: true }));
      if (t.matches('[data-file]') && t.files[0]) { const q = f.questions.find(x => x.id === t.dataset.file); const file = t.files[0]; t.value = ''; addFile(q, file); }
    });
    formEl.addEventListener('click', e => {
      const c = e.target.closest('[data-sig-clear]');
      if (c) { pads[c.dataset.sigClear].clear(); const n = host.querySelector(`[data-sig-name="${c.dataset.sigClear}"]`); if (n) n.value = ''; refresh(); return; }
      const ty = e.target.closest('[data-sig-type]');
      if (ty) { const box = host.querySelector(`[data-sig-typed="${ty.dataset.sigType}"]`); box.hidden = !box.hidden; ty.setAttribute('aria-expanded', String(!box.hidden)); if (!box.hidden) box.querySelector('input').focus(); return; }
      const uf = e.target.closest('[data-unfile]');
      if (uf) { local[uf.dataset.unfile].splice(Number(uf.dataset.i), 1); drawFiles(uf.dataset.unfile); refresh(); host.querySelector(`label[for="fp-${uf.dataset.unfile}"]`)?.focus(); }
    });
    formEl.addEventListener('submit', async e => {
      e.preventDefault();
      if (busy) return;
      const formError = formEl.querySelector('[data-form-error]');
      formError.hidden = true;
      const shown = refresh();
      const errs = {};
      f.questions.filter(q => shown.has(q.id)).forEach(q => {
        showErr(q.id, '');
        if ((local[q.id] || []).some(x => x.state === 'uploading')) errs[q.id] = 'Wait for the upload to finish.';
        else if (q.required && !store.formAnswered(q, answerFor(q))) errs[q.id] = q.type === 'signature' ? 'Please sign here.' : q.type === 'file' ? 'Please attach a file.' : 'Please answer this question.';
      });
      const focusFirst = ids => { const first = f.questions.find(q => ids.includes(q.id)); const w = host.querySelector(`[data-qwrap="${first.id}"]`); (w.querySelector('input:not([type="file"]), textarea, canvas, label.btn') || w).focus(); w.scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' }); };
      if (Object.keys(errs).length) { Object.entries(errs).forEach(([k, m]) => showErr(k, m)); focusFirst(Object.keys(errs)); return; }
      const btn = formEl.querySelector('.fp-submit');
      busy = true;
      btn.disabled = true;
      btn.classList.add('is-loading');
      const label = btn.innerHTML;
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>Submitting…';
      const finish = () => { busy = false; btn.disabled = false; btn.classList.remove('is-loading'); btn.innerHTML = label; };
      if (mode === 'preview') {
        await new Promise(r => setTimeout(r, 300));
        finish();
        success(true);
        return;
      }
      const out = { ...answers };
      for (const q of f.questions.filter(x => shown.has(x.id))) {
        if (q.type === 'file') out[q.id] = answerFor(q);
        if (q.type === 'signature' && !pads[q.id].isEmpty()) {
          const data = pads[q.id].toDataURL();
          const up = await store.uploadFormFile(store.currentUser(), f.id, q.id, { name: 'signature.png', mime: 'image/png', size: Math.round((data.length - 22) * 0.75), data });
          if (!up.ok) { finish(); showErr(q.id, failText(up)); focusFirst([q.id]); return; }
          out[q.id] = { fileId: up.file.id };
        }
      }
      const r = await store.submitFormResponse(store.currentUser(), f.id, { familyId: family.familyId, guardianId, answers: out });
      finish();
      if (!r.ok) {
        if (r.errors && r.reason === 'invalid') { const ids = Object.keys(r.errors).filter(k => f.questions.some(q => q.id === k)); ids.forEach(k => showErr(k, r.errors[k])); if (ids.length) { focusFirst(ids); return; } }
        formError.innerHTML = `${icon('info')}${esc(failText(r))}`;
        formError.hidden = false;
        return;
      }
      try { sessionStorage.removeItem(draftKey); } catch { /* ignore */ }
      dirty = false;
      onDirty(false);
      success(false, r.response);
      onSubmitted(r.response);
    });
    function success(preview, resp) {
      host.querySelector('.fp').innerHTML = `<div class="fp-done" role="status"><span class="fp-done__icon" aria-hidden="true">${icon('check-circle')}</span><h2 class="fp-title">${preview ? 'Preview submitted' : 'Thank you — response received'}</h2><p class="fp-desc">${preview ? 'This was a preview. Nothing was saved and response counts haven’t changed.' : `Submitted ${esc(when(resp.submittedAt))} by ${esc(resp.guardianName)}.`}</p>${preview ? '<button class="btn btn--secondary" type="button" data-preview-again>Try again</button>' : ''}</div>`;
      host.querySelector('.fp-done').focus?.();
    }
    refresh();
    return { reset() { Object.keys(answers).forEach(k => delete answers[k]); try { sessionStorage.removeItem(draftKey); } catch { /* ignore */ } formUI(host, f, { mode, family, guardianId, guardianName, user, draftKey, onDirty, onSubmitted }); }, isDirty: () => dirty };
  }

  // Finger, stylus and mouse signature pad; "typed" draws a typed name instead. Ink on a paper surface.
  // The signature pad lives in formkit.js, shared with the Form Builder.
  const signaturePad = (wrap, onChange) => window.NexoraFormKit.signaturePad(wrap, onChange);

  function previewDialog(f, opener = document.activeElement) {
    const el = document.createElement('dialog');
    el.className = 'modal fp-modal';
    el.setAttribute('aria-labelledby', 'fp-prev-title');
    el.innerHTML = `<div class="fp-modal__wrap"><div class="fp-modal__bar"><button class="btn btn--secondary btn--sm" type="button" data-close>${icon('arrow-left', 'icon--sm')}Back to ${f.status === 'draft' ? 'builder' : 'forms'}</button><h2 class="fp-modal__title" id="fp-prev-title">Parent preview</h2><span class="badge badge--plain an-chip an-chip--info">Preview — answers aren’t saved</span><button class="btn btn--tertiary btn--sm" type="button" data-reset>${icon('refresh', 'icon--sm')}Reset answers</button></div>
      <div class="fp-phone"><div class="fp-phone__notch" aria-hidden="true"></div><div class="fp-phone__screen" data-screen></div></div></div>`;
    document.body.appendChild(el);
    const ui = { cur: null };
    const mount = () => { ui.cur = formUI(el.querySelector('[data-screen]'), f, { mode: 'preview', guardianName: 'A guardian' }); };
    const close = () => { if (el.classList.contains('is-closing')) return; el.classList.add('is-closing'); const done = () => { el.close(); el.remove(); if (opener && document.contains(opener)) opener.focus(); }; reduceMotion.matches ? done() : setTimeout(done, 170); };
    el.addEventListener('cancel', e => { e.preventDefault(); close(); });
    el.addEventListener('click', e => {
      if (e.target === el || e.target.closest('[data-close]')) { close(); return; }
      if (e.target.closest('[data-reset]') || e.target.closest('[data-preview-again]')) { mount(); el.querySelector('[data-screen] input, [data-screen] textarea')?.focus(); }
    });
    el.showModal();
    mount();
    el.querySelector('[data-close]').focus();
    return el;
  }

  /* ================================================================= List */

  function list(main, user) {
    const canCreate = store.canManageForms(user);
    const f = { q: '', type: '', status: '', cls: '', due: '' };
    let openMenu = null;
    let failOnce = params.get('fail') === '1';
    let loaded = false;
    document.title = 'Forms & Permissions · Nexora';
    main.innerHTML = `<div class="kids fm">
      <header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Forms &amp; Permissions</h1><p class="kids-head__sub">Create forms, collect consent, and track family responses.</p></div>
        ${canCreate ? `<div class="an-head__actions"><a class="btn btn--primary kids-yellow" href="${routes.page('forms', { edit: 'new' })}" data-create>${icon('plus', 'icon--sm')}Create form</a></div>` : ''}</header>
      <div class="fm-filters" role="search" aria-label="Filter forms">
        <div class="an-search">${icon('search', 'icon--sm')}<label class="sr-only" for="fm-q">Search forms</label><input class="input" id="fm-q" type="search" placeholder="Search by title" data-f="q" autocomplete="off"></div>
        <label class="sr-only" for="fm-type">Type</label><select class="input" id="fm-type" data-f="type"><option value="">All types</option>${Object.entries(store.FORM_TYPES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
        <label class="sr-only" for="fm-status">Status</label><select class="input" id="fm-status" data-f="status"><option value="">All statuses</option>${Object.entries(store.FORM_STATUSES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
        <label class="sr-only" for="fm-cls">Class</label><select class="input" id="fm-cls" data-f="cls"><option value="">All audiences</option>${store.formTargets(user).classes.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('')}</select>
        <label class="sr-only" for="fm-due">Due date</label><select class="input" id="fm-due" data-f="due"><option value="">Any due date</option><option value="week">Due in the next 7 days</option><option value="overdue">Past due</option><option value="none">No due date</option></select>
        <button class="btn btn--tertiary btn--sm" type="button" data-clear hidden>Clear filters</button>
      </div>
      <section aria-label="Forms" aria-busy="true" data-panel><span class="skeleton" style="display:block;height:300px;border-radius:var(--radius-lg)"></span></section></div>`;
    const $ = s => main.querySelector(s);
    const audienceOf = x => x.audience || (x.status === 'draft' ? 'Not published yet' : '—');
    const progress = x => { const s = store.formStats(x); return x.status === 'draft' ? '<span class="cp-muted">Not published</span>' : `<div class="an-prog"><span class="an-prog__bar" aria-hidden="true"><i style="width:${s.pct}%"></i></span><span class="an-prog__txt">${s.received}/${s.eligible} · ${s.pct}%</span></div>`; };
    const due = x => (x.dueAt ? `<span class="fm-due${store.formOverdue(x) ? ' is-over' : ''}">${store.formOverdue(x) ? icon('alert-triangle', 'icon--sm') : ''}${esc(dayOnly(x.dueAt))}${store.formOverdue(x) ? ' · past due' : ''}</span>` : '<span class="cp-muted">—</span>');
    function actions(x) {
      const m = store.canManageForm(user, x);
      const out = [];
      if (x.status === 'draft' && m) out.push(['edit', 'pencil', 'Edit']);
      if (x.status !== 'draft') out.push(['results', 'chart', 'Results']);
      out.push(['preview', 'eye', 'Preview']);
      if (m && store.formAccepting(x) && store.formStats(x).pending) out.push(['remind', 'bell', 'Remind non-responders']);
      if (canCreate) out.push(['duplicate', 'copy', 'Duplicate']);
      if (m && x.status === 'open') out.push(['close', 'lock', 'Close form', true]);
      if (m && (x.status === 'closed' || store.formOverdue(x))) out.push(['reopen', 'refresh', x.status === 'closed' ? 'Reopen' : 'Extend due date']);
      if (m && x.status === 'draft') out.push(['delete', 'trash', 'Delete', true]);
      return out;
    }
    const menu = x => `<div class="menu-wrap"><button class="btn btn--icon-ghost" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(x.title || 'untitled form')}" data-menu="${esc(x.id)}">${icon('more-v')}</button><div class="menu" role="menu" hidden>${actions(x).map(([k, ic, l, d]) => `<button type="button" role="menuitem" data-act="${k}" data-id="${esc(x.id)}"${d ? ' class="is-danger"' : ''}>${icon(ic, 'icon--sm')}${l}</button>`).join('')}</div></div>`;
    const titleLink = x => `<a class="an-title" href="${routes.page('forms', x.status === 'draft' ? { edit: x.id } : { results: x.id })}">${esc(x.title || 'Untitled form')}</a>`;
    const typeChip = x => chip('cat', store.FORM_TYPES[x.type], TYPE_ICON[x.type]);

    function paint() {
      const all = store.listForms(user).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      const now = Date.now();
      const rows = all.filter(x => (!f.q || (x.title || '').toLowerCase().includes(f.q.trim().toLowerCase())) && (!f.type || x.type === f.type) && (!f.status || x.status === f.status)
        && (!f.cls || (x.recipients || []).some(r => r.classes.includes(f.cls)) || (x.status === 'draft' && x.audienceSpec?.classIds?.some(id => store.classById(id)?.name === f.cls)))
        && (!f.due || (f.due === 'none' ? !x.dueAt : f.due === 'overdue' ? store.formOverdue(x) : x.dueAt && new Date(x.dueAt) >= now && new Date(x.dueAt) - now < 7 * 864e5)));
      const any = Object.values(f).some(Boolean);
      $('[data-clear]').hidden = !any;
      const panel = $('[data-panel]');
      panel.removeAttribute('aria-busy');
      const create = canCreate ? `<a class="btn btn--primary kids-yellow" href="${routes.page('forms', { edit: 'new' })}">${icon('plus', 'icon--sm')}Create your first form</a>` : '';
      if (!all.length) { panel.innerHTML = state('list', 'No forms created yet.', canCreate ? 'Create a survey, a permission slip or an acknowledgement and track every family’s response.' : 'Forms for your classes will appear here once they’re published.', create); return; }
      if (!rows.length) { panel.innerHTML = state('filter', 'No forms match your filters.', 'Try a different search or clear the filters.', '<button class="btn btn--tertiary btn--sm" type="button" data-clear>Clear filters</button>'); return; }
      panel.innerHTML = `<p class="sr-only" aria-live="polite">${plural(rows.length, 'form')}</p><div class="table-shell an-table"><table class="data-table"><caption class="sr-only">Forms</caption><thead><tr><th scope="col">Title</th><th scope="col">Type</th><th scope="col">Audience</th><th scope="col">Response rate</th><th scope="col">Status</th><th scope="col">Due date</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${rows.map(x => `<tr><td><div class="an-cell">${titleLink(x)}${x.demo ? '<span class="fm-demo">Demo sample</span>' : ''}</div></td><td>${typeChip(x)}</td><td class="fm-aud">${esc(audienceOf(x))}</td><td>${progress(x)}</td><td>${statusChip(x)}</td><td>${due(x)}</td><td class="an-actions">${menu(x)}</td></tr>`).join('')}</tbody></table></div>
        <ul class="an-cards">${rows.map(x => `<li class="panel an-card"><div class="an-card__head"><div class="an-tags">${typeChip(x)}${statusChip(x)}</div>${menu(x)}</div>${titleLink(x)}<p class="an-card__meta">${icon('users', 'icon--sm')}<span>${esc(audienceOf(x))}</span></p><p class="an-card__meta">${icon('clock', 'icon--sm')}${due(x)}</p>${x.status !== 'draft' ? progress(x) : ''}</li>`).join('')}</ul>`;
    }

    const closeMenu = (restore = false) => { if (!openMenu) return; const b = openMenu.querySelector('[data-menu]'); openMenu.querySelector('.menu').hidden = true; b.setAttribute('aria-expanded', 'false'); openMenu.closest('tr, .an-card')?.classList.remove('has-menu'); openMenu = null; if (restore) b.focus(); };
    document.addEventListener('click', e => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); });
    main.addEventListener('input', e => { const k = e.target.dataset.f; if (k) { f[k] = e.target.value; paint(); } });
    main.addEventListener('change', e => { const k = e.target.dataset.f; if (k && e.target.tagName === 'SELECT') { f[k] = e.target.value; paint(); } });
    main.addEventListener('keydown', e => {
      if (!openMenu) return;
      const items = [...openMenu.querySelectorAll('.menu button')];
      const i = items.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
      else if (e.key === 'Tab') closeMenu();
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); }
    });
    main.addEventListener('click', e => {
      if (e.target.closest('[data-retry]')) { load(); return; }
      if (e.target.closest('[data-clear]')) { Object.keys(f).forEach(k => { f[k] = ''; }); main.querySelectorAll('[data-f]').forEach(i => { i.value = ''; }); paint(); $('#fm-q').focus(); return; }
      const mb = e.target.closest('[data-menu]');
      if (mb) {
        const wrap = mb.closest('.menu-wrap');
        if (openMenu === wrap) { closeMenu(); return; }
        closeMenu();
        const m = wrap.querySelector('.menu');
        m.hidden = false;
        m.classList.toggle('is-up', mb.getBoundingClientRect().bottom + 280 > innerHeight);
        mb.setAttribute('aria-expanded', 'true');
        wrap.closest('tr, .an-card')?.classList.add('has-menu');
        openMenu = wrap;
        m.querySelector('button').focus();
        return;
      }
      const a = e.target.closest('[data-act]');
      if (a) { closeMenu(true); formAction(user, a.dataset.act, a.dataset.id, { after: paint }); }
    });
    function load() {
      $('[data-panel]').innerHTML = '<span class="skeleton" style="display:block;height:300px;border-radius:var(--radius-lg)"></span>';
      setTimeout(() => {
        if (failOnce) { failOnce = false; $('[data-panel]').removeAttribute('aria-busy'); $('[data-panel]').innerHTML = state('alert-circle', 'Forms couldn’t load', 'Something went wrong while reading forms on this device. Nothing was changed.', '<button class="btn btn--primary kids-yellow" type="button" data-retry>Try again</button>', 'error'); return; }
        loaded = true;
        paint();
      }, 250);
    }
    store.subscribe(({ key }) => { if (loaded && (!key || /^nexora-(forms|form-responses|demo-role)/.test(key)) && !openMenu) paint(); });
    load();
  }

  // Actions shared by the list and the results page.
  function formAction(user, kind, id, { after = () => {} } = {}) {
    const x = store.getForms().find(y => y.id === id);
    if (!x) { toast('Not found', FAIL.missing); return; }
    const me = () => store.currentUser();
    const confirm = (o, run) => kids.dialog({ ...o, body: o.body || '', async onSubmit(form) { const r = await run(form); return r.ok ? r : r.errors ? { ok: false, errors: r.errors } : { ok: false, message: failText(r) }; } });
    if (kind === 'edit') { go({ edit: id }); return; }
    if (kind === 'results') { go({ results: id }); return; }
    if (kind === 'preview') { previewDialog(x); return; }
    if (kind === 'duplicate') {
      store.duplicateForm(me(), id).then(r => { if (!r.ok) { toast('Not duplicated', failText(r)); return; } toast('Copy saved as a draft', `“${r.form.title}”`, 'copy', { action: { label: 'Edit', onClick: () => go({ edit: r.form.id }) } }); after(); });
      return;
    }
    if (kind === 'delete') { confirm({ label: 'Forms / Draft', title: 'Delete this draft?', desc: `“${esc(x.title || 'Untitled form')}” and its questions will be removed. This can’t be undone.`, submit: 'Delete draft', danger: true }, async () => { const r = await store.deleteForm(me(), id); if (r.ok) { toast('Draft deleted', x.title || 'Untitled form', 'trash'); after(); } return r; }); return; }
    if (kind === 'close') { confirm({ label: 'Forms / Close', title: 'Close this form?', desc: 'Families will no longer be able to submit new responses. Existing responses, files, signatures and results are kept, and you can still export them.', submit: 'Close form', danger: true }, async () => { const r = await store.closeForm(me(), id); if (r.ok) { toast('Form closed', `“${x.title}” isn’t accepting responses.`, 'lock'); after(); } return r; }); return; }
    if (kind === 'reopen') {
      const d = new Date(Date.now() + 7 * 864e5);
      confirm({ label: 'Forms / Reopen', title: x.status === 'closed' ? 'Reopen this form?' : 'Extend the due date?', desc: 'Families who haven’t responded can submit again until the new due date. The audience is checked again: families no longer in it are removed (their responses are kept but not counted), and newly eligible families are added.', submit: x.status === 'closed' ? 'Reopen form' : 'Extend due date',
        body: `<div class="cls-form__row">${kids.field('kd-rdate', 'New due date', `<input class="input" type="date" id="kd-rdate" name="rdate" required min="${isoDay(new Date())}" value="${isoDay(d)}">`, { required: true })}${kids.field('kd-rtime', 'Time', '<input class="input" type="time" id="kd-rtime" name="rtime" required value="17:00">', { required: true })}</div><p class="field__hint field__hint--error" data-error-for="dueAt" hidden></p>` },
      async form => { const r = await store.reopenForm(me(), id, new Date(`${form.elements.rdate.value}T${form.elements.rtime.value}:00`).toISOString()); if (r.ok) { toast(x.status === 'closed' ? 'Form reopened' : 'Due date extended', `Open until ${when(r.form.dueAt)}${r.added ? ` · ${plural(r.added, 'family', 'families')} added` : ''}${r.removed ? ` · ${plural(r.removed, 'family', 'families')} no longer eligible` : ''}.`, 'refresh'); after(); } return r; });
      return;
    }
    if (kind === 'remind') {
      const v = store.formView(user, id);
      const n = v.stats.pending;
      if (!n) { toast('Everyone has responded', FAIL.none, 'check-circle'); return; }
      confirm({ label: 'Forms / Reminder', title: `Remind ${plural(n, 'family', 'families')}?`, desc: `Only families in <b>${esc(x.audience)}</b> who haven’t responded are reminded (due ${esc(when(x.dueAt))}). Families who already responded are left out, and anyone reminded in the last 10 minutes is skipped. Reminders are recorded as queued (demo — not delivered): families have no app yet.`, submit: `Remind ${n}` },
        async () => { const r = await store.remindFormNonResponders(me(), id); if (r.ok) { toast('Reminders recorded', `${r.targeted} pending · ${r.queued} queued (demo) · ${r.skipped} skipped`, 'bell'); after(); } return r; });
    }
  }

  /* ================================================================= Builder */

  function builder(main, user, id) {
    document.title = 'Form builder · Nexora';
    const back = `<a class="btn btn--secondary" href="${routes.page('forms')}">${icon('arrow-left', 'icon--sm')}Back to forms</a>`;
    if (!store.canManageForms(user)) { main.innerHTML = `<div class="kids">${state('lock', 'You can’t create forms', 'Your role can view forms for your classes but not build them.', back)}</div>`; return; }
    let f = null;
    if (id !== 'new') {
      const found = store.getForms().find(x => x.id === id);
      if (!found || !store.canManageForm(user, found)) { main.innerHTML = `<div class="kids">${state('list', 'Form not available', 'It may have been deleted, or it belongs to someone else.', back)}</div>`; return; }
      if (found.status !== 'draft') { main.innerHTML = `<div class="kids">${state('lock', 'Published forms can’t be edited', 'Families have already been shown these questions. Duplicate the form to make a new version.', `<div class="fm-row"><a class="btn btn--primary kids-yellow" href="${routes.page('forms', { results: id })}">View results</a><button class="btn btn--secondary" type="button" data-dup>Duplicate to edit</button>${back}</div>`)}</div>`; main.querySelector('[data-dup]').addEventListener('click', () => formAction(user, 'duplicate', id, { after: () => {} })); return; }
      f = JSON.parse(JSON.stringify(found));
    }
    let sel = f?.questions[0]?.id || null;
    let save = { state: f ? 'saved' : 'idle', timer: null, inflight: false, again: false, failOnce: params.get('savefail') === '1' };
    let showIssues = false;
    let settingsOpen = false;
    let undo = null;

    async function ensureCreated() {
      if (f) return true;
      const r = await store.saveFormDraft(store.currentUser(), { title: '', type: 'survey', questions: [] });
      if (!r.ok) { main.innerHTML = `<div class="kids">${state('alert-circle', 'The form couldn’t be created', failText(r), back, 'error')}</div>`; return false; }
      f = JSON.parse(JSON.stringify(r.form));
      history.replaceState(null, '', routes.page('forms', { edit: f.id }));
      return true;
    }

    function frame() {
      if (mobileQ.matches) {
        main.innerHTML = `<div class="kids fb-mobile">${state('sliders', 'Edit on a larger screen.', 'The form builder needs a tablet or computer (768px or wider). Your draft is saved — you can still check results and responses here.', `<div class="fm-row">${back}</div>`)}</div>`;
        return;
      }
      main.innerHTML = `<div class="fb">
        <header class="fb-head">
          <a class="btn btn--icon-ghost" href="${routes.page('forms')}" aria-label="Back to forms" data-back>${icon('arrow-left')}</a>
          <div class="fb-head__title"><label class="sr-only" for="fb-htitle">Form title</label><input class="fb-htitle" id="fb-htitle" data-model="title" placeholder="Untitled form" maxlength="120" value="${esc(f.title)}"></div>
          <label class="sr-only" for="fb-type">Form type</label><select class="input input--sm fb-type" id="fb-type" data-model="type">${Object.entries(store.FORM_TYPES).map(([k, l]) => `<option value="${k}"${f.type === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
          <span class="fb-save" role="status" aria-live="polite" data-save></span>
          <span class="fb-head__sp"></span>
          <button class="btn btn--secondary fb-settings-btn" type="button" data-toggle-settings aria-expanded="false" aria-controls="fb-settings">${icon('sliders', 'icon--sm')}Settings</button>
          <button class="btn btn--secondary" type="button" data-preview>${icon('eye', 'icon--sm')}Preview</button>
          <button class="btn btn--primary kids-yellow" type="button" data-publish>${icon('megaphone', 'icon--sm')}Publish</button>
        </header>
        <div class="fb-grid">
          <aside class="fb-palette" aria-labelledby="fb-pal-h"><h2 class="fb-h" id="fb-pal-h">Add a question</h2><p class="fb-note">Drag into the form, or click to add below the selected question.</p>
            <ul class="fb-pal">${Object.entries(store.FORM_QTYPES).map(([k, l]) => `<li><button class="fb-pal__item" type="button" draggable="true" data-add="${k}"><span class="fb-pal__icon" aria-hidden="true">${icon(QICON[k])}</span><span>${l}</span>${icon('plus', 'icon--sm fb-pal__plus')}</button></li>`).join('')}</ul></aside>
          <section class="fb-canvas" aria-label="Form canvas" data-canvas></section>
          <aside class="fb-settings" id="fb-settings" aria-labelledby="fb-set-h" data-settings></aside>
        </div></div>`;
      drawCanvas();
      drawSettings();
      drawSave();
    }

    const qLabel = q => q.label || 'Untitled question';
    function previewControl(q) {
      if (q.type === 'short') return '<span class="fb-mock fb-mock--input"></span>';
      if (q.type === 'long') return '<span class="fb-mock fb-mock--area"></span>';
      if (q.type === 'date') return `<span class="fb-mock fb-mock--input">${icon('calendar-check', 'icon--sm')}dd / mm / yyyy</span>`;
      if (q.type === 'yesno') return '<span class="fb-mock-opts"><span class="fb-mock-pill">Yes</span><span class="fb-mock-pill">No</span></span>';
      if (q.type === 'single' || q.type === 'multi') return `<span class="fb-mock-list">${q.options.slice(0, 4).map(o => `<span class="fb-mock-opt"><i class="${q.type === 'multi' ? 'is-box' : ''}"></i>${esc(o.label || 'Option')}</span>`).join('')}${q.options.length > 4 ? `<small>+${q.options.length - 4} more</small>` : ''}</span>`;
      if (q.type === 'rating') return `<span class="fb-mock-opts">${[1, 2, 3, 4, 5].map(k => `<span class="fb-mock-pill">${k}</span>`).join('')}</span>`;
      if (q.type === 'file') return `<span class="fb-mock fb-mock--input">${icon('upload', 'icon--sm')}${q.accept.length === 2 ? 'Image or PDF' : q.accept[0] === 'pdf' ? 'PDF' : 'Image'} · up to ${q.maxKB >= 1024 ? '1 MB' : `${q.maxKB} KB`}</span>`;
      return `<span class="fb-mock fb-mock--sig">${icon('pencil', 'icon--sm')}Signature pad</span>`;
    }
    function drawCanvas() {
      const host = main.querySelector('[data-canvas]');
      if (!host) return;
      const issues = store.formIssues(f);
      const byQ = qid => issues.issues.filter(x => x.qid === qid);
      host.innerHTML = `<div class="fb-meta panel">
          <label class="sr-only" for="fb-title">Form title</label><input class="fb-title" id="fb-title" data-model="title" placeholder="Untitled form" maxlength="120" value="${esc(f.title)}"${showIssues && issues.errors.title ? ' aria-invalid="true"' : ''}>
          ${showIssues && issues.errors.title ? `<p class="field__hint field__hint--error">${icon('info')}${esc(issues.errors.title)}</p>` : ''}
          <div class="field"><label class="field__label" for="fb-desc">Description or instructions</label><textarea class="input" id="fb-desc" rows="2" maxlength="2000" data-model="description" placeholder="What is this form about? What happens next?">${esc(f.description)}</textarea></div>
          <div class="field"><label class="field__label" for="fb-intro">Introduction for parents <span class="cp-muted">(optional)</span></label><input class="input" id="fb-intro" maxlength="1000" data-model="intro" placeholder="e.g. Please reply by Thursday." value="${esc(f.intro)}"></div>
        </div>
        ${showIssues && (issues.issues.length || issues.errors.questions) ? `<p class="ls-banner ls-banner--warn" role="alert">${icon('alert-triangle', 'icon--sm')}<span>Fix these before publishing: ${esc(issues.errors.questions || '')}</span></p>` : ''}
        ${f.questions.length ? `<ol class="fb-qs" data-qs aria-label="Questions">${f.questions.map((q, i) => `<li class="fb-q${q.id === sel ? ' is-selected' : ''}${showIssues && byQ(q.id).length ? ' is-invalid' : ''}" data-q="${esc(q.id)}">
            <div class="fb-q__bar"><span class="fb-q__handle" draggable="true" data-handle="${esc(q.id)}" title="Drag to reorder" aria-hidden="true">${icon('move', 'icon--sm')}</span><span class="fb-q__n">${i + 1}</span><span class="badge badge--plain an-chip an-chip--neutral">${icon(QICON[q.type])}${esc(store.FORM_QTYPES[q.type])}</span>${q.required ? '<span class="fb-req">Required</span>' : ''}${q.logic.rules.length ? `<span class="fb-cond">${icon('filter', 'icon--sm')}Conditional</span>` : ''}
              <span class="fb-q__tools"><button class="btn btn--icon-ghost btn--sm" type="button" data-up="${esc(q.id)}" aria-label="Move question ${i + 1} up"${i === 0 ? ' disabled' : ''}>${icon('arrow-left', 'icon--sm fb-rot-up')}</button><button class="btn btn--icon-ghost btn--sm" type="button" data-down="${esc(q.id)}" aria-label="Move question ${i + 1} down"${i === f.questions.length - 1 ? ' disabled' : ''}>${icon('arrow-left', 'icon--sm fb-rot-down')}</button><button class="btn btn--icon-ghost btn--sm" type="button" data-dupq="${esc(q.id)}" aria-label="Duplicate question ${i + 1}">${icon('copy', 'icon--sm')}</button><button class="btn btn--icon-ghost btn--sm fb-del" type="button" data-delq="${esc(q.id)}" aria-label="Delete question ${i + 1}">${icon('trash', 'icon--sm')}</button></span></div>
            <button class="fb-q__main" type="button" data-select="${esc(q.id)}" aria-pressed="${q.id === sel}"><b>${esc(qLabel(q))}</b>${q.help ? `<small>${esc(q.help)}</small>` : ''}<span class="fb-q__prev" aria-hidden="true">${previewControl(q)}</span></button>
            ${showIssues && byQ(q.id).length ? `<p class="field__hint field__hint--error">${icon('info')}${esc(byQ(q.id).map(x => x.msg).join(' '))}</p>` : ''}
          </li>`).join('')}</ol>` : `<div class="fb-empty" data-qs data-empty><span class="state-icon" aria-hidden="true">${icon('list')}</span><h2 class="kids-empty__title">No questions yet</h2><p>Drag a question type here, or add one to start.</p><button class="btn btn--primary kids-yellow" type="button" data-add="short">${icon('plus', 'icon--sm')}Add question</button></div>`}
        ${f.questions.length ? `<div class="fb-addrow"><label class="sr-only" for="fb-addtype">Question type to add</label><select class="input input--sm" id="fb-addtype">${Object.entries(store.FORM_QTYPES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select><button class="btn btn--secondary btn--sm" type="button" data-add-sel>${icon('plus', 'icon--sm')}Add question</button></div>` : ''}`;
    }

    function drawSettings() {
      const host = main.querySelector('[data-settings]');
      if (!host) return;
      host.classList.toggle('is-open', settingsOpen);
      main.querySelector('[data-toggle-settings]')?.setAttribute('aria-expanded', String(settingsOpen));
      const i = f.questions.findIndex(x => x.id === sel);
      const q = f.questions[i];
      const close = '<button class="btn btn--icon-ghost fb-settings__close" type="button" aria-label="Close settings" data-close-settings>' + icon('x') + '</button>';
      if (!q) { host.innerHTML = `<div class="fb-set__head"><h2 class="fb-h" id="fb-set-h">Question settings</h2>${close}</div><p class="fb-note">Select a question to edit its settings.</p>`; return; }
      const sources = f.questions.slice(0, i);
      const ruleRow = (r, k) => {
        const src = sources.find(x => x.id === r.q);
        const ops = src ? store.FORM_OPS_FOR[src.type] : [];
        const valCtl = !src || ['answered', 'empty'].includes(r.op) ? '' : src.type === 'yesno' ? `<select class="input input--sm" aria-label="Answer" data-rule="${k}" data-rk="value"><option value="">Choose…</option><option value="yes"${r.value === 'yes' ? ' selected' : ''}>Yes</option><option value="no"${r.value === 'no' ? ' selected' : ''}>No</option></select>`
          : src.type === 'rating' ? `<select class="input input--sm" aria-label="Rating" data-rule="${k}" data-rk="value"><option value="">Choose…</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}"${String(r.value) === String(n) ? ' selected' : ''}>${n}</option>`).join('')}</select>`
            : `<select class="input input--sm" aria-label="Option" data-rule="${k}" data-rk="value"><option value="">Choose…</option>${src.options.map(o => `<option value="${esc(o.id)}"${r.value === o.id ? ' selected' : ''}>${esc(o.label || 'Option')}</option>`).join('')}</select>`;
        return `<li class="fb-rule"><select class="input input--sm" aria-label="Question" data-rule="${k}" data-rk="q"><option value="">Choose a question…</option>${sources.map((s, n) => `<option value="${esc(s.id)}"${s.id === r.q ? ' selected' : ''}>${n + 1}. ${esc((s.label || 'Untitled').slice(0, 48))}</option>`).join('')}</select>
          ${src ? `<select class="input input--sm" aria-label="Comparison" data-rule="${k}" data-rk="op">${ops.map(o => `<option value="${o}"${o === r.op ? ' selected' : ''}>${store.FORM_OPS[o]}</option>`).join('')}</select>` : ''}${valCtl}
          <button class="btn btn--tertiary btn--sm is-danger" type="button" data-rm-rule="${k}">Remove condition</button></li>`;
      };
      const typeSettings = q.type === 'single' || q.type === 'multi' ? `<fieldset class="an-fs"><legend class="field__label">Options</legend><ul class="fb-opts">${q.options.map((o, k) => `<li class="fb-opt"><label class="sr-only" for="fb-o-${k}">Option ${k + 1}</label><input class="input input--sm" id="fb-o-${k}" maxlength="120" value="${esc(o.label)}" data-opt="${k}"><button class="btn btn--icon-ghost btn--sm" type="button" aria-label="Move option ${k + 1} up" data-opt-up="${k}"${k === 0 ? ' disabled' : ''}>${icon('arrow-left', 'icon--sm fb-rot-up')}</button><button class="btn btn--icon-ghost btn--sm" type="button" aria-label="Move option ${k + 1} down" data-opt-down="${k}"${k === q.options.length - 1 ? ' disabled' : ''}>${icon('arrow-left', 'icon--sm fb-rot-down')}</button><button class="btn btn--icon-ghost btn--sm" type="button" aria-label="Remove option ${k + 1}" data-opt-rm="${k}"${q.options.length <= 1 ? ' disabled' : ''}>${icon('x', 'icon--sm')}</button></li>`).join('')}</ul>${q.options.length < 20 ? `<button class="btn btn--tertiary btn--sm" type="button" data-opt-add>${icon('plus', 'icon--sm')}Add option</button>` : ''}</fieldset>`
        : q.type === 'rating' ? `<div class="cls-form__row"><div class="field"><label class="field__label" for="fb-low">Label for 1</label><input class="input input--sm" id="fb-low" maxlength="40" value="${esc(q.scale.low)}" data-scale="low"></div><div class="field"><label class="field__label" for="fb-high">Label for 5</label><input class="input input--sm" id="fb-high" maxlength="40" value="${esc(q.scale.high)}" data-scale="high"></div></div>`
          : q.type === 'file' ? `<fieldset class="an-fs"><legend class="field__label">Accepted files</legend><div class="fb-checks"><label class="fb-check"><input type="checkbox" data-accept="image"${q.accept.includes('image') ? ' checked' : ''}>Images (JPEG, PNG, WebP)</label><label class="fb-check"><input type="checkbox" data-accept="pdf"${q.accept.includes('pdf') ? ' checked' : ''}>PDF</label></div></fieldset><div class="field"><label class="field__label" for="fb-max">Maximum size</label><select class="input input--sm" id="fb-max" data-maxkb>${[[250, '250 KB'], [500, '500 KB'], [1024, '1 MB (school limit)']].map(([k, l]) => `<option value="${k}"${q.maxKB === k ? ' selected' : ''}>${l}</option>`).join('')}</select><p class="field__hint">Files are checked by type and size before and during upload.</p></div>`
            : q.type === 'signature' ? `<div class="field"><label class="field__label" for="fb-stmt">Statement the guardian signs</label><textarea class="input" id="fb-stmt" rows="3" maxlength="600" data-stmt>${esc(q.statement || '')}</textarea><p class="field__hint">Shown above the signature pad. Prototype: not a verified or legally certified e-signature.</p></div>` : '';
      host.innerHTML = `<div class="fb-set__head"><h2 class="fb-h" id="fb-set-h">Question ${i + 1} settings</h2>${close}</div>
        <p class="fb-set__type">${icon(QICON[q.type], 'icon--sm')}${esc(store.FORM_QTYPES[q.type])}</p>
        <div class="field"><label class="field__label" for="fb-label">Question <span class="field__req" aria-hidden="true">*</span></label><textarea class="input" id="fb-label" rows="2" maxlength="300" data-q="label" placeholder="What do you want to ask?">${esc(q.label)}</textarea></div>
        <div class="field"><label class="field__label" for="fb-help">Help text</label><input class="input" id="fb-help" maxlength="500" data-q="help" value="${esc(q.help)}" placeholder="Optional hint shown under the question"></div>
        <button class="switch" type="button" role="switch" aria-checked="${q.required}" data-required><span class="switch__track"><span class="switch__thumb"></span></span><span>Required</span></button>
        ${typeSettings}
        <fieldset class="an-fs fb-logic"><legend class="field__label">${icon('filter', 'icon--sm')}Show this question when…</legend>
          ${!sources.length ? '<p class="fb-note">Add a question above this one to show it only for certain answers.</p>' : `
          ${q.logic.rules.length > 1 ? `<div class="segmented" role="radiogroup" aria-label="Match">${[['all', 'All conditions (AND)'], ['any', 'Any condition (OR)']].map(([k, l]) => `<button type="button" role="radio" aria-checked="${q.logic.join === k}" data-join="${k}">${l}</button>`).join('')}</div>` : ''}
          ${q.logic.rules.length ? `<ul class="fb-rules">${q.logic.rules.map(ruleRow).join('')}</ul>` : '<p class="fb-note">Always shown.</p>'}
          ${q.logic.rules.length < 5 ? `<button class="btn btn--tertiary btn--sm" type="button" data-add-rule>${icon('plus', 'icon--sm')}Add condition</button>` : ''}
          <p class="fb-note">Only questions above this one can be used, so a question can’t depend on itself or loop. Hidden questions never block submitting, and their answers aren’t stored.</p>`}
        </fieldset>`;
    }

    function drawSave() {
      const el = main.querySelector('[data-save]');
      if (!el) return;
      el.className = `fb-save is-${save.state}`;
      el.innerHTML = save.state === 'saving' ? '<span class="spinner" aria-hidden="true"></span>Saving…' : save.state === 'saved' ? `${icon('check', 'icon--sm')}Saved` : save.state === 'failed' ? `${icon('alert-circle', 'icon--sm')}Save failed <button class="btn btn--tertiary btn--sm" type="button" data-retry-save>Retry</button>` : 'Not saved yet';
    }
    async function doSave() {
      clearTimeout(save.timer);
      if (save.inflight) { save.again = true; return save.pending; }
      save.inflight = true;
      save.state = 'saving';
      drawSave();
      save.pending = (async () => {
        let r;
        if (save.failOnce) { save.failOnce = false; await new Promise(res => setTimeout(res, 350)); r = { ok: false, reason: 'storage' }; } else r = await store.saveFormDraft(store.currentUser(), f, f.id);
        save.inflight = false;
        if (r.ok) { save.state = 'saved'; if (save.again) { save.again = false; drawSave(); return doSave(); } } else save.state = 'failed';
        drawSave();
        return r.ok;
      })();
      return save.pending;
    }
    const changed = ({ canvas = true, settings = false } = {}) => { save.state = 'saving'; drawSave(); clearTimeout(save.timer); save.timer = setTimeout(doSave, 600); if (canvas) drawCanvas(); if (settings) drawSettings(); };
    const keepFocus = (sel_, fn) => { fn(); const el = main.querySelector(sel_); if (el) el.focus(); };

    function addQuestion(type, at = null) {
      const q = store.newFormQuestion(type, f.type);
      const i = at ?? (sel ? f.questions.findIndex(x => x.id === sel) + 1 : f.questions.length);
      f.questions.splice(Math.max(0, Math.min(i, f.questions.length)), 0, q);
      sel = q.id;
      if (innerWidth < 1024) settingsOpen = true;
      changed({ settings: true });
      main.querySelector('#fb-label')?.focus();
    }
    function moveQuestion(qid, to) {
      const from = f.questions.findIndex(x => x.id === qid);
      if (from < 0) return;
      const [q] = f.questions.splice(from, 1);
      f.questions.splice(Math.max(0, Math.min(to > from ? to - 1 : to, f.questions.length)), 0, q);
      changed({ settings: true });
    }
    function deleteQuestion(qid) {
      const i = f.questions.findIndex(x => x.id === qid);
      const q = f.questions[i];
      const dependents = f.questions.filter(x => x.logic.rules.some(r => r.q === qid));
      kids.dialog({ label: 'Form builder', title: `Delete question ${i + 1}?`, desc: `“${esc(qLabel(q))}” will be removed.${dependents.length ? ` ${plural(dependents.length, 'question uses', 'questions use')} it in a “Show if” rule; ${dependents.length === 1 ? 'that rule' : 'those rules'} will be removed too.` : ''} You can undo this straight after.`, body: '', submit: 'Delete question', danger: true,
        async onSubmit() {
          const removedRules = dependents.map(d => ({ id: d.id, rules: d.logic.rules.slice() }));
          f.questions.splice(i, 1);
          dependents.forEach(d => { d.logic.rules = d.logic.rules.filter(r => r.q !== qid); });
          undo = { q, i, removedRules };
          sel = f.questions[Math.min(i, f.questions.length - 1)]?.id || null;
          changed({ settings: true });
          toast('Question deleted', `“${qLabel(q)}”`, 'trash', { duration: 8000, action: { label: 'Undo', onClick: () => { if (!undo) return; f.questions.splice(undo.i, 0, undo.q); undo.removedRules.forEach(x => { const d = f.questions.find(y => y.id === x.id); if (d) d.logic.rules = x.rules; }); sel = undo.q.id; undo = null; changed({ settings: true }); } } });
          return { ok: true };
        } });
    }
    function duplicateQuestion(qid) {
      const i = f.questions.findIndex(x => x.id === qid);
      const copy = JSON.parse(JSON.stringify(f.questions[i]));
      copy.id = `q-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      if (copy.options) copy.options = copy.options.map(o => ({ ...o, id: `o-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }));
      copy.label = copy.label ? `${copy.label} (copy)`.slice(0, 300) : '';
      f.questions.splice(i + 1, 0, copy);
      sel = copy.id;
      changed({ settings: true });
      main.querySelector(`[data-select="${copy.id}"]`)?.focus();
    }

    async function publish() {
      showIssues = true;
      const iss = store.formIssues(f);
      drawCanvas();
      if (iss.errors.title || iss.issues.length || iss.errors.questions) { toast('Not ready to publish', iss.errors.title || iss.errors.questions, 'alert-triangle'); main.querySelector('[aria-invalid="true"], .fb-q.is-invalid .fb-q__main')?.focus(); return; }
      if (!(await doSave())) { toast('Save failed', 'The draft must be saved before publishing. Try again.', 'alert-circle'); return; }
      publishDialog(user, f, published => { location.href = routes.page('forms', { results: published.id }); });
    }

    function bind() {
      main.addEventListener('input', e => {
        const t = e.target;
        const m = t.dataset.model;
        if (m) { f[m] = t.value; if (m === 'title') main.querySelectorAll('[data-model="title"]').forEach(x => { if (x !== t) x.value = t.value; }); changed({ canvas: m !== 'title' && m !== 'description' && m !== 'intro' ? true : false }); return; }
        const q = f.questions.find(x => x.id === sel);
        if (!q) return;
        if (t.dataset.q) { q[t.dataset.q] = t.value; changed({}); return; }
        if (t.dataset.opt) { q.options[+t.dataset.opt].label = t.value; changed({}); return; }
        if (t.dataset.scale) { q.scale[t.dataset.scale] = t.value; changed({ canvas: false }); return; }
        if (t.matches('[data-stmt]')) { q.statement = t.value; changed({ canvas: false }); }
      });
      main.addEventListener('change', e => {
        const t = e.target;
        if (t.dataset.model === 'type') { f.type = t.value; changed({ canvas: false }); return; }
        const q = f.questions.find(x => x.id === sel);
        if (!q) return;
        if (t.dataset.accept) { const on = [...main.querySelectorAll('[data-accept]:checked')].map(x => x.dataset.accept); if (!on.length) { t.checked = true; toast('Keep one file type', 'A file question needs at least one accepted type.'); return; } q.accept = on; changed({}); return; }
        if (t.matches('[data-maxkb]')) { q.maxKB = Number(t.value); changed({}); return; }
        if (t.dataset.rule !== undefined && t.dataset.rule !== '') {
          const r = q.logic.rules[+t.dataset.rule];
          r[t.dataset.rk] = t.value;
          if (t.dataset.rk === 'q') { const src = f.questions.find(x => x.id === t.value); r.op = src ? store.FORM_OPS_FOR[src.type][0] : 'eq'; r.value = ''; }
          if (t.dataset.rk === 'op' && ['answered', 'empty'].includes(t.value)) r.value = '';
          keepFocus(`[data-rule="${t.dataset.rule}"][data-rk="${t.dataset.rk}"]`, () => changed({ settings: true }));
        }
      });
      main.addEventListener('click', e => {
        const t = e.target;
        if (t.closest('[data-retry-save]')) { doSave(); return; }
        if (t.closest('[data-preview]')) { doSave(); previewDialog(JSON.parse(JSON.stringify(f))); return; }
        if (t.closest('[data-publish]')) { publish(); return; }
        if (t.closest('[data-toggle-settings]')) { settingsOpen = !settingsOpen; drawSettings(); if (settingsOpen) main.querySelector('[data-settings] input, [data-settings] textarea, [data-close-settings]')?.focus(); return; }
        if (t.closest('[data-close-settings]')) { settingsOpen = false; drawSettings(); main.querySelector(`[data-select="${sel}"]`)?.focus() || main.querySelector('[data-toggle-settings]')?.focus(); return; }
        const add = t.closest('[data-add]');
        if (add) { addQuestion(add.dataset.add); return; }
        if (t.closest('[data-add-sel]')) { addQuestion(main.querySelector('#fb-addtype').value); return; }
        const s = t.closest('[data-select]');
        if (s) { sel = s.dataset.select; if (innerWidth < 1024) settingsOpen = true; drawCanvas(); drawSettings(); main.querySelector(`[data-select="${sel}"]`)?.focus(); return; }
        const up = t.closest('[data-up]');
        if (up) { const i = f.questions.findIndex(x => x.id === up.dataset.up); moveQuestion(up.dataset.up, i - 1); main.querySelector(`[data-up="${up.dataset.up}"]:not(:disabled)`)?.focus() || main.querySelector(`[data-down="${up.dataset.up}"]`)?.focus(); return; }
        const dn = t.closest('[data-down]');
        if (dn) { const i = f.questions.findIndex(x => x.id === dn.dataset.down); moveQuestion(dn.dataset.down, i + 2); main.querySelector(`[data-down="${dn.dataset.down}"]:not(:disabled)`)?.focus() || main.querySelector(`[data-up="${dn.dataset.down}"]`)?.focus(); return; }
        const dq = t.closest('[data-dupq]');
        if (dq) { duplicateQuestion(dq.dataset.dupq); return; }
        const del = t.closest('[data-delq]');
        if (del) { deleteQuestion(del.dataset.delq); return; }
        const q = f.questions.find(x => x.id === sel);
        if (!q) return;
        if (t.closest('[data-required]')) { q.required = !q.required; t.closest('[data-required]').setAttribute('aria-checked', String(q.required)); changed({}); return; }
        if (t.closest('[data-opt-add]')) { q.options.push({ id: `o-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, label: `Option ${q.options.length + 1}` }); keepFocus(`[data-opt="${q.options.length - 1}"]`, () => changed({ settings: true })); return; }
        const ou = t.closest('[data-opt-up]');
        if (ou) { const k = +ou.dataset.optUp; [q.options[k - 1], q.options[k]] = [q.options[k], q.options[k - 1]]; keepFocus(`[data-opt-up="${k - 1}"]:not(:disabled), [data-opt-down="${k - 1}"]`, () => changed({ settings: true })); return; }
        const od = t.closest('[data-opt-down]');
        if (od) { const k = +od.dataset.optDown; [q.options[k + 1], q.options[k]] = [q.options[k], q.options[k + 1]]; keepFocus(`[data-opt-down="${k + 1}"]:not(:disabled), [data-opt-up="${k + 1}"]`, () => changed({ settings: true })); return; }
        const orm = t.closest('[data-opt-rm]');
        if (orm) { const k = +orm.dataset.optRm; const gone = q.options[k]; q.options.splice(k, 1); f.questions.forEach(x => { x.logic.rules = x.logic.rules.filter(r => !(r.q === q.id && r.value === gone.id)); }); keepFocus(`[data-opt="${Math.max(0, k - 1)}"]`, () => changed({ settings: true })); return; }
        if (t.closest('[data-add-rule]')) { const i = f.questions.findIndex(x => x.id === sel); const src = f.questions[i - 1]; q.logic.rules.push({ q: src.id, op: store.FORM_OPS_FOR[src.type][0], value: '' }); keepFocus(`[data-rule="${q.logic.rules.length - 1}"][data-rk="q"]`, () => changed({ settings: true })); return; }
        const rr = t.closest('[data-rm-rule]');
        if (rr) { q.logic.rules.splice(+rr.dataset.rmRule, 1); keepFocus('[data-add-rule]', () => changed({ settings: true })); return; }
        const j = t.closest('[data-join]');
        if (j) { q.logic.join = j.dataset.join; keepFocus(`[data-join="${j.dataset.join}"]`, () => changed({ settings: true })); }
      });
      main.addEventListener('keydown', e => { if (e.key === 'Escape' && settingsOpen && innerWidth < 1024 && e.target.closest('[data-settings]')) { settingsOpen = false; drawSettings(); main.querySelector(`[data-select="${sel}"]`)?.focus(); } });

      // Drag and drop: palette → canvas inserts; handle → canvas reorders. Buttons above do the same without a mouse.
      let drag = null;
      main.addEventListener('dragstart', e => {
        const a = e.target.closest('[data-add]');
        const h = e.target.closest('[data-handle]');
        if (a) drag = { add: a.dataset.add };
        else if (h) { drag = { move: h.dataset.handle }; h.closest('.fb-q').classList.add('is-dragging'); }
        else return;
        e.dataTransfer.effectAllowed = drag.add ? 'copy' : 'move';
        e.dataTransfer.setData('text/plain', drag.add || drag.move);
      });
      const dropIndex = e => {
        const cards = [...main.querySelectorAll('.fb-q')];
        let idx = cards.length;
        for (let k = 0; k < cards.length; k += 1) { const r = cards[k].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { idx = k; break; } }
        return { idx, cards };
      };
      const clearMarks = () => main.querySelectorAll('.is-drop-before, .is-drop-after, .is-drop-into').forEach(x => x.classList.remove('is-drop-before', 'is-drop-after', 'is-drop-into'));
      main.addEventListener('dragover', e => {
        if (!drag || !e.target.closest('[data-canvas]')) return;
        e.preventDefault();
        clearMarks();
        const { idx, cards } = dropIndex(e);
        if (!cards.length) main.querySelector('[data-empty]')?.classList.add('is-drop-into');
        else if (idx < cards.length) cards[idx].classList.add('is-drop-before');
        else cards[cards.length - 1].classList.add('is-drop-after');
      });
      main.addEventListener('drop', e => {
        if (!drag || !e.target.closest('[data-canvas]')) return;
        e.preventDefault();
        const { idx } = dropIndex(e);
        clearMarks();
        const d = drag;
        drag = null;
        if (d.add) addQuestion(d.add, idx); else moveQuestion(d.move, idx);
      });
      main.addEventListener('dragend', () => { drag = null; clearMarks(); main.querySelectorAll('.is-dragging').forEach(x => x.classList.remove('is-dragging')); });
      mobileQ.addEventListener('change', () => { if (f) frame(); else init(); });
      window.addEventListener('beforeunload', e => { if (save.state === 'saving' || save.state === 'failed') { e.preventDefault(); e.returnValue = ''; } });
    }

    // A new form is only created once the builder can actually be used (not on a phone).
    async function init() {
      if (mobileQ.matches) { frame(); return; }
      main.innerHTML = '<div class="kids"><span class="skeleton" style="display:block;height:420px;border-radius:var(--radius-lg)"></span></div>';
      if (!(await ensureCreated())) return;
      sel = sel || f.questions[0]?.id || null;
      frame();
      main.querySelector('#fb-title')?.focus();
    }
    bind();
    init();
  }

  /* ================================================================= Publish */

  function publishDialog(user, f, onDone) {
    const t = store.formTargets(user);
    const spec = { mode: f.audienceSpec?.mode && (f.audienceSpec.mode !== 'all' || t.canAll) ? f.audienceSpec.mode : t.canAll ? 'all' : 'classes', classIds: [...(f.audienceSpec?.classIds || [])], familyIds: [...(f.audienceSpec?.familyIds || [])] };
    let respondent = f.respondent || 'any';
    let stage = 1;
    let fq = '';
    const d0 = new Date(Date.now() + 7 * 864e5);
    const hasSig = f.questions.some(q => q.type === 'signature');
    const d = kids.dialog({
      label: 'Forms / Publish', title: 'Publish form', desc: `${esc(store.FORM_TYPES[f.type])} · “${esc(f.title)}” · ${plural(f.questions.length, 'question')}`,
      body: `<div class="fm-pub" data-stage1>
          <fieldset class="an-fs"><legend class="field__label">Audience <span class="field__req" aria-hidden="true">*</span></legend><div class="an-modes">
            ${t.canAll ? `<label class="an-mode"><input type="radio" name="pmode" value="all"${spec.mode === 'all' ? ' checked' : ''}><span><b>All families</b><small>${plural(t.families.length, 'family', 'families')}</small></span></label>` : ''}
            <label class="an-mode"><input type="radio" name="pmode" value="classes"${spec.mode === 'classes' ? ' checked' : ''}><span><b>Classes</b><small>${plural(t.classes.length, 'class', 'classes')}</small></span></label>
            <label class="an-mode"><input type="radio" name="pmode" value="families"${spec.mode === 'families' ? ' checked' : ''}><span><b>Individual families</b><small>Choose by name</small></span></label></div>
            <div data-pick></div><p class="field__hint field__hint--error" data-error-for="audience" hidden></p></fieldset>
          <fieldset class="an-fs"><legend class="field__label">Who can respond</legend><div class="an-modes an-modes--2">
            <label class="an-mode"><input type="radio" name="presp" value="any"${respondent === 'any' ? ' checked' : ''}><span><b>Any guardian</b><small>One response per family</small></span></label>
            <label class="an-mode"><input type="radio" name="presp" value="primary"${respondent === 'primary' ? ' checked' : ''}><span><b>Primary guardian only</b><small>The family’s main contact</small></span></label></div></fieldset>
          <p class="an-count" aria-live="polite" data-pcount></p>
          <div class="cls-form__row">${kids.field('kd-pdate', 'Due date', `<input class="input" type="date" id="kd-pdate" name="pdate" required min="${isoDay(new Date())}" value="${f.dueAt ? isoDay(new Date(f.dueAt)) : isoDay(d0)}">`, { required: true })}${kids.field('kd-ptime', 'Time', '<input class="input" type="time" id="kd-ptime" name="ptime" required value="17:00">', { required: true, hint: `Time zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone || 'this device'}` })}</div>
          ${f.type !== 'survey' || hasSig ? `<label class="fb-check fm-pub__sig"><input type="checkbox" name="psig"${f.requireSignature !== false || hasSig ? ' checked' : ''}${hasSig ? ' disabled' : ''}><span><b>Require a guardian signature</b><small>${hasSig ? 'The form already has a signature question.' : 'Adds a required “Guardian signature” question at the end.'}</small></span></label>` : ''}
          <p class="cd-note">Prototype: families have no parent app, email or SMS yet, so publishing records each family as queued (demo) or skipped — nothing is delivered. Responses can be entered from the demo parent view.</p>
        </div><div data-stage2 hidden></div>`,
      submit: 'Review',
      async onSubmit(form) {
        const dueAt = new Date(`${form.elements.pdate.value}T${form.elements.ptime.value}:00`);
        const requireSignature = hasSig || Boolean(form.elements.psig?.checked);
        const aud = store.resolveFormAudience(user, spec, respondent);
        if (stage === 1) {
          const errors = {};
          if (!aud.count) errors.audience = aud.why;
          if (Number.isNaN(dueAt.getTime())) errors.pdate = 'Choose a due date and time.';
          else if (dueAt.getTime() <= Date.now() + 3600000) errors.pdate = 'The due date must be at least an hour from now.';
          if (Object.keys(errors).length) return { ok: false, errors };
          stage = 2;
          form.querySelector('[data-stage1]').hidden = true;
          const s2 = form.querySelector('[data-stage2]');
          s2.hidden = false;
          s2.innerHTML = `<h3 class="an-c-h" tabindex="-1">Check and confirm</h3><dl class="an-review">
            <div><dt>Form</dt><dd>${esc(f.title)} · ${esc(store.FORM_TYPES[f.type])}</dd></div>
            <div><dt>Audience</dt><dd>${esc(aud.label)}</dd></div>
            <div><dt>Eligible</dt><dd><b>${plural(aud.count, 'family', 'families')}</b>&nbsp;(${respondent === 'primary' ? 'primary guardian' : 'any guardian'} responds)${aud.noGuardian.length ? ` · ${aud.noGuardian.length} left out: no guardian on record` : ''}</dd></div>
            <div><dt>Due</dt><dd>${esc(dueAt.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))}</dd></div>
            <div><dt>Signature</dt><dd>${requireSignature ? 'Required' : 'Not required'}</dd></div></dl>
            <p class="cd-note">Once published, the questions are locked so every family answers the same version. <button class="btn btn--tertiary btn--sm" type="button" data-pback>Change settings</button></p>`;
          s2.querySelector('h3').focus();
          return { keepOpen: true, submitLabel: `Publish to ${plural(aud.count, 'family', 'families')}` };
        }
        const r = await store.publishForm(store.currentUser(), f.id, { audienceSpec: spec, respondent, requireSignature, dueAt: dueAt.toISOString() });
        if (!r.ok) {
          if (r.issues?.length || r.errors?.questions || r.errors?.title) return { ok: false, message: 'Some questions need attention — close this and check the builder.' };
          stage = 1; form.querySelector('[data-stage1]').hidden = false; form.querySelector('[data-stage2]').hidden = true;
          return r.errors ? { ok: false, errors: Object.fromEntries(Object.entries({ audience: r.errors.audience, pdate: r.errors.dueAt }).filter(([, m]) => m)) } : { ok: false, message: failText(r) };
        }
        toast('Form published', `Open until ${when(r.form.dueAt)} · ${r.queued} queued (demo — not delivered) · ${r.skipped} skipped (no parent-app account).`, 'check-circle', { duration: 8000 });
        onDone(r.form);
        return { ok: true };
      }
    });
    const fm = d.form;
    const btn = fm.querySelector('[type="submit"]');
    const pickHtml = () => {
      if (spec.mode === 'all') return '';
      if (spec.mode === 'classes') return `<div class="an-picks">${t.classes.map(c => `<label class="an-pick"><input type="checkbox" data-pclass value="${esc(c.id)}"${spec.classIds.includes(c.id) ? ' checked' : ''}><span><b>${esc(c.name)}</b><small>${plural(c.families, 'family', 'families')}</small></span></label>`).join('')}</div>`;
      const rows = t.families.filter(x => !fq || `${x.name} ${x.children.join(' ')}`.toLowerCase().includes(fq.toLowerCase()));
      return `<div class="an-picker"><div class="an-search an-search--block">${icon('search', 'icon--sm')}<label class="sr-only" for="fm-pq">Find families</label><input class="input" id="fm-pq" type="search" placeholder="Family or child name" value="${esc(fq)}" data-pq></div><ul class="an-plist">${rows.map(x => `<li><label class="an-prow"><input type="checkbox" data-pfam value="${esc(x.id)}"${spec.familyIds.includes(x.id) ? ' checked' : ''}><span class="an-prow__txt"><b>${esc(x.name)}</b><small>${esc(x.children.join(', '))} · ${esc(x.classes.join(', '))}</small></span></label></li>`).join('') || '<li class="cp-muted an-plist__none">No families match.</li>'}</ul></div>`;
    };
    const count = () => {
      const a = store.resolveFormAudience(user, spec, respondent);
      let note = '';
      if (spec.mode === 'classes' && spec.classIds.length > 1) { const sum = t.classes.filter(c => spec.classIds.includes(c.id)).reduce((n, c) => n + c.families, 0); if (sum > a.count + a.noGuardian.length) note = `<small>Families with children in more than one selected class are counted once.</small>`; }
      fm.querySelector('[data-pcount]').innerHTML = a.count ? `<span class="an-count__n">${icon('users', 'icon--sm')}<b>${plural(a.count, 'eligible family', 'eligible families')}</b></span>${note}${a.noGuardian.length ? `<small>${plural(a.noGuardian.length, 'family', 'families')} left out: no guardian on record.</small>` : ''}` : `<span class="an-count__n">${icon('info', 'icon--sm')}<b>No eligible families</b></span><small>${esc(a.why)}</small>`;
    };
    const toStage1 = () => { if (stage === 2) { stage = 1; fm.querySelector('[data-stage1]').hidden = false; fm.querySelector('[data-stage2]').hidden = true; btn.textContent = 'Review'; } };
    fm.querySelector('[data-pick]').innerHTML = pickHtml();
    count();
    fm.addEventListener('change', e => {
      const tg = e.target;
      if (tg.name === 'pmode') { spec.mode = tg.value; fq = ''; fm.querySelector('[data-pick]').innerHTML = pickHtml(); }
      if (tg.name === 'presp') respondent = tg.value;
      if (tg.matches('[data-pclass]')) spec.classIds = [...fm.querySelectorAll('[data-pclass]:checked')].map(x => x.value);
      if (tg.matches('[data-pfam]')) spec.familyIds = tg.checked ? [...new Set([...spec.familyIds, tg.value])] : spec.familyIds.filter(x => x !== tg.value);
      toStage1();
      count();
    });
    fm.addEventListener('input', e => { if (e.target.matches('[data-pq]')) { fq = e.target.value; const pos = e.target.selectionStart; fm.querySelector('[data-pick]').innerHTML = pickHtml(); const i = fm.querySelector('#fm-pq'); i.focus(); i.setSelectionRange(pos, pos); } });
    fm.addEventListener('click', e => { if (e.target.closest('[data-pback]')) { toStage1(); fm.querySelector('input[name="pmode"]:checked')?.focus(); } });
  }

  /* ================================================================= Results */

  function results(main, user, id) {
    let tab = ['overview', 'questions', 'responses'].includes(params.get('tab')) ? params.get('tab') : 'overview';
    const rf = { q: '', cls: '', status: '', date: '' };
    let drawer = null;
    const back = `<a class="btn btn--secondary" href="${routes.page('forms')}">${icon('arrow-left', 'icon--sm')}Back to forms</a>`;
    const first = store.formView(user, id);
    if (first.error) { main.innerHTML = `<div class="kids">${state('list', first.error === 'missing' ? 'Form not found' : 'You can’t see this form', first.error === 'missing' ? 'It may have been deleted.' : 'Results are visible to leaders, the form’s creator and staff of the classes it was sent to.', back)}</div>`; return; }
    if (first.form.status === 'draft') { location.replace(routes.page('forms', { edit: id })); return; }
    document.title = `${first.form.title} · Results · Nexora`;
    main.innerHTML = '<div class="kids fm fr" data-root></div>';
    const root = main.querySelector('[data-root]');
    const famName = fid => store.familyById(fid)?.name || 'Family';

    function head(v) {
      const x = v.form;
      const sum = store.formStats(x);
      return `<nav class="kids-crumbs" aria-label="Breadcrumb"><a href="${routes.page('forms')}">Forms &amp; Permissions</a> / <span aria-current="page">Results</span></nav>
        <header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">${esc(x.title)}</h1>
          <div class="an-tags fr-tags">${chip('cat', store.FORM_TYPES[x.type], TYPE_ICON[x.type])}${statusChip(x)}${x.demo ? '<span class="fm-demo">Demo sample</span>' : ''}<span class="cp-muted">${esc(x.audience || '')} · due ${esc(when(x.dueAt))}${x.closedAt ? ` · closed ${esc(when(x.closedAt))}` : ''}</span></div></div>
          <div class="an-head__actions">
            ${v.manage && store.formAccepting(x) ? `<button class="btn btn--primary kids-yellow" type="button" data-act="remind"${sum.pending ? '' : ' disabled'} title="${sum.pending ? '' : 'Everyone eligible has responded'}">${icon('bell', 'icon--sm')}${sum.pending ? `Remind non-responders (${sum.pending})` : 'Everyone has responded'}</button>` : ''}
            <button class="btn btn--secondary" type="button" data-export>${icon('download', 'icon--sm')}Export responses (CSV)</button>
            <button class="btn btn--secondary" type="button" data-act="preview">${icon('eye', 'icon--sm')}Preview</button>
            ${v.manage && x.status === 'open' ? `<button class="btn btn--tertiary is-danger" type="button" data-act="close">${icon('lock', 'icon--sm')}Close form</button>` : ''}
            ${v.manage && (x.status === 'closed' || store.formOverdue(x)) ? `<button class="btn btn--tertiary" type="button" data-act="reopen">${icon('refresh', 'icon--sm')}${x.status === 'closed' ? 'Reopen' : 'Extend due date'}</button>` : ''}
          </div></header>
        ${v.scoped ? `<p class="ls-banner">${icon('info', 'icon--sm')}<span>You’re seeing families in your classes only.</span></p>` : ''}
        ${x.status === 'closed' ? `<p class="ls-banner">${icon('lock', 'icon--sm')}<span>This form is closed. No new responses are accepted; results and export stay available.</span></p>` : store.formOverdue(x) ? `<p class="ls-banner ls-banner--warn">${icon('clock', 'icon--sm')}<span>The due date has passed, so no new responses are accepted. ${v.manage ? 'Extend the due date to accept more.' : ''}</span></p>` : ''}
        <div class="tabs an-tabs" role="tablist" aria-label="Results">${[['overview', 'Overview'], ['questions', 'Question results'], ['responses', 'Individual responses']].map(([k, l]) => `<button class="tab" type="button" role="tab" id="fr-tab-${k}" aria-controls="fr-panel" aria-selected="${k === tab}" tabindex="${k === tab ? 0 : -1}" data-tab="${k}">${l}${k === 'responses' ? `<span class="tab__count">${v.stats.received}</span>` : ''}</button>`).join('')}</div>
        <section class="fr-panel" id="fr-panel" role="tabpanel" aria-labelledby="fr-tab-${tab}" data-panel></section>`;
    }
    const kpi = (ic, label, value, ctx, tone = '') => `<div class="kpi kpi--static cls-sum__item${tone ? ` kpi--${tone}` : ''}"><span class="kpi__top"><span class="kpi__icon" aria-hidden="true">${icon(ic)}</span><span class="kpi__label">${label}</span></span><span class="kpi__value">${value}</span><span class="kpi__context">${ctx}</span></div>`;
    function overview(v) {
      const s = v.stats;
      const x = v.form;
      const del = { q: v.recipients.filter(r => /^queued/.test(r.delivery)).length, s: v.recipients.filter(r => /^skipped/.test(r.delivery)).length };
      const last = (x.reminders || []).slice(-1)[0];
      return `<div class="cls-sum fr-kpis">${kpi('users', 'Eligible recipients', s.eligible, 'Families in the audience')}${kpi('check-circle', 'Responses received', s.received, s.received ? `Latest ${esc(when(v.responses.map(r => r.submittedAt).sort().pop()))}` : 'None yet')}
          ${kpi('chart', 'Response rate', `${s.pct}<small>%</small>`, `<span class="an-prog__bar" aria-hidden="true"><i style="width:${s.pct}%"></i></span>${s.received} of ${s.eligible}`)}${kpi('clock', 'Pending', s.pending, s.pending ? (store.formAccepting(x) ? `Due ${esc(when(x.dueAt))}` : 'No longer accepting') : 'Everyone has responded', s.pending && store.formOverdue(x) ? 'warn' : '')}
          ${s.hasSig ? kpi('pencil', 'Signatures', `${s.sigPct}<small>%</small>`, `${s.signed} of ${s.eligible} signed`) : ''}${kpi(x.status === 'closed' ? 'lock' : 'calendar-check', 'Status', esc(store.formOverdue(x) ? 'Past due' : store.FORM_STATUSES[x.status]), `Due ${esc(when(x.dueAt))}`)}</div>
        <div class="panel fr-box"><h2 class="cd-h2">Delivery &amp; reminders</h2><p class="cd-note">Published ${esc(when(x.publishedAt))} by ${esc(x.createdBy)} · ${del.q} queued (demo — not delivered) · ${del.s} skipped (no parent-app account). Families can’t receive forms until the parent app exists.</p>
          <p class="cd-note">${last ? `Last reminder ${esc(when(last.at))} by ${esc(last.by)}: ${last.targeted} pending · ${last.queued} queued · ${last.skipped} skipped.` : 'No reminders sent yet.'}</p>
          <p class="cd-note">Response rate = unique submitted responses ÷ eligible families. Families removed from the audience after reopening aren’t counted.</p></div>`;
    }
    const bars = (rows, unit = 'respondents') => `<ul class="fr-bars">${rows.map(o => `<li><span class="fr-bars__l">${esc(o.label)}</span><span class="fr-bars__track" aria-hidden="true"><i style="width:${o.pct}%"></i></span><span class="fr-bars__v">${o.count} · ${o.pct}%</span></li>`).join('')}</ul><p class="sr-only">${rows.map(o => `${o.label}: ${o.count} ${unit} (${o.pct}%)`).join('; ')}</p>`;
    function questionsTab(v) {
      const sums = store.formQuestionSummary(v.form, v.responses);
      if (!v.responses.length) return state('chart', 'No responses yet', 'Results appear here as families respond.');
      return `<ol class="fr-qs">${sums.map((s, i) => {
        const q = s.q;
        let body = '';
        if (!s.n) body = '<p class="cp-muted">No answers yet. It may be optional or hidden by a “Show if” rule.</p>';
        else if (['yesno', 'single'].includes(q.type)) body = bars(s.options);
        else if (q.type === 'multi') body = `${bars(s.options, 'selections')}<p class="cd-note">Families could choose more than one option, so percentages add up to more than 100%.</p>`;
        else if (q.type === 'rating') body = `<p class="fr-avg"><b>${s.avg}</b><span>average out of 5</span></p>${bars(s.options.map(o => ({ ...o, label: `${o.label}${o.label === '1' && q.scale?.low ? ` · ${q.scale.low}` : o.label === '5' && q.scale?.high ? ` · ${q.scale.high}` : ''}` })))}`;
        else if (q.type === 'signature') body = `<ul class="fr-sigs">${s.items.map(it => { const file = store.formFile(user, it.fileId); return `<li class="fr-sig">${file ? `<img src="${esc(file.data)}" alt="Signature of ${esc(it.name)}">` : '<span class="cp-muted">Image not available on this device</span>'}<b>${esc(it.name)}</b><small>${esc(famName(it.family))} · ${esc(when(it.at))}</small></li>`; }).join('')}</ul>`;
        else if (q.type === 'file') body = `<ul class="fr-files">${s.items.map(it => { const file = store.formFile(user, it.fileId); return `<li>${icon('file', 'icon--sm')}${file ? `<button class="btn btn--tertiary btn--sm" type="button" data-file="${esc(it.fileId)}">${esc(file.name)}</button>` : '<span class="cp-muted">File not available</span>'}<small>${esc(famName(it.family))}</small></li>`; }).join('')}</ul>`;
        else { const items = s.items.slice().sort((a, b) => String(a.value).localeCompare(String(b.value))); body = `${q.type === 'date' && items.length ? `<p class="cd-note">Earliest ${esc(dayOnly(`${items[0].value}T12:00:00`))} · latest ${esc(dayOnly(`${items[items.length - 1].value}T12:00:00`))}</p>` : ''}<ul class="fr-texts">${(q.type === 'date' ? items : s.items).slice(0, 50).map(it => `<li><p>${esc(q.type === 'date' ? dayOnly(`${it.value}T12:00:00`) : it.value)}</p><small>${esc(famName(it.family))}</small></li>`).join('')}</ul>${s.items.length > 50 ? `<p class="cd-note">Showing 50 of ${s.items.length}. Export to see all.</p>` : ''}`; }
        return `<li class="panel fr-q"><div class="fr-q__head"><span class="fb-q__n">${i + 1}</span><div><h3 class="fr-q__t">${esc(q.label)}</h3><p class="cp-muted">${esc(store.FORM_QTYPES[q.type])} · ${plural(s.n, 'answer')}${q.logic?.rules?.length ? ' · conditional' : ''}</p></div></div>${body}</li>`;
      }).join('')}</ol>`;
    }
    function responsesTab(v) {
      const x = v.form;
      const done = Object.fromEntries(v.responses.map(r => [r.familyId, r]));
      const hasSig = x.questions.some(q => q.type === 'signature');
      const allRows = [...v.recipients.map(r => ({ r, resp: done[r.familyId] })), ...v.responses.filter(resp => !v.recipients.some(r => r.familyId === resp.familyId)).map(resp => ({ r: { familyId: resp.familyId, name: famName(resp.familyId), children: resp.children, classes: [], removed: true }, resp }))];
      const ql = rf.q.trim().toLowerCase();
      const rows = allRows.filter(({ r, resp }) => (!ql || `${r.name} ${r.children.join(' ')} ${resp?.guardianName || ''}`.toLowerCase().includes(ql)) && (!rf.cls || r.classes.includes(rf.cls)) && (!rf.status || (rf.status === 'done' ? resp : !resp && !r.removed)) && (!rf.date || (resp && isoDay(new Date(resp.submittedAt)) === rf.date)))
        .sort((a, b) => (b.resp?.submittedAt || '').localeCompare(a.resp?.submittedAt || '') || a.r.name.localeCompare(b.r.name));
      const classes = [...new Set(v.recipients.flatMap(r => r.classes))].sort();
      const accepting = store.formAccepting(x) && v.manage;
      const sigCell = resp => (!hasSig ? '' : resp && Object.keys(resp.signatures || {}).length ? chip('success', 'Signed', 'check') : resp ? chip('neutral', 'Not required') : chip('neutral', '—'));
      const statusCell = ({ r, resp }) => (resp ? chip('success', 'Submitted', 'check') : r.removed ? chip('neutral', 'Removed') : chip('warning', 'Pending', 'clock'));
      const action = ({ r, resp }) => (resp ? `<button class="btn btn--secondary btn--sm" type="button" data-view="${esc(resp.id)}">View response</button>` : accepting && !r.removed ? `<a class="btn btn--tertiary btn--sm" href="${routes.page('forms', { respond: x.id, family: r.familyId })}">Open parent view (demo)</a>` : '');
      return `<div class="fm-filters" role="search" aria-label="Filter responses">
          <div class="an-search">${icon('search', 'icon--sm')}<label class="sr-only" for="fr-q">Search responses</label><input class="input" id="fr-q" type="search" placeholder="Family, child or guardian" value="${esc(rf.q)}" data-rf="q" autocomplete="off"></div>
          <label class="sr-only" for="fr-cls">Class</label><select class="input" id="fr-cls" data-rf="cls"><option value="">All classes</option>${classes.map(c => `<option${c === rf.cls ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
          <label class="sr-only" for="fr-st">Completion</label><select class="input" id="fr-st" data-rf="status"><option value="">Submitted and pending</option><option value="done"${rf.status === 'done' ? ' selected' : ''}>Submitted</option><option value="pending"${rf.status === 'pending' ? ' selected' : ''}>Pending</option></select>
          <label class="sr-only" for="fr-date">Submitted on</label><input class="input" id="fr-date" type="date" data-rf="date" value="${esc(rf.date)}" aria-label="Submitted on">
        </div>
        <p class="sr-only" aria-live="polite">${plural(rows.length, 'family', 'families')}</p>
        ${rows.length ? `<div class="table-shell an-table"><table class="data-table"><caption class="sr-only">Responses</caption><thead><tr><th scope="col">Family</th><th scope="col">Child</th><th scope="col">Submitted</th><th scope="col">Status</th>${hasSig ? '<th scope="col">Signature</th>' : ''}<th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>${rows.map(row => `<tr><td><b>${esc(row.r.name)}</b>${row.resp ? `<br><small class="cp-muted">${esc(row.resp.guardianName)}</small>` : ''}</td><td>${esc(row.r.children.join(', '))}<br><small class="cp-muted">${esc(row.r.classes.join(', '))}</small></td><td>${row.resp ? esc(when(row.resp.submittedAt)) : '—'}</td><td>${statusCell(row)}</td>${hasSig ? `<td>${sigCell(row.resp)}</td>` : ''}<td class="fr-act">${action(row)}</td></tr>`).join('')}</tbody></table></div>
          <ul class="an-cards">${rows.map(row => `<li class="panel an-card"><div class="an-card__head"><b>${esc(row.r.name)}</b>${statusCell(row)}</div><p class="an-card__meta">${icon('user', 'icon--sm')}<span>${esc(row.r.children.join(', '))}${row.r.classes.length ? ` · ${esc(row.r.classes.join(', '))}` : ''}</span></p>${row.resp ? `<p class="an-card__meta">${icon('clock', 'icon--sm')}<span>${esc(when(row.resp.submittedAt))} · ${esc(row.resp.guardianName)}</span></p>` : ''}${hasSig && row.resp ? `<p class="an-card__meta">${sigCell(row.resp)}</p>` : ''}<div>${action(row)}</div></li>`).join('')}</ul>` : state('filter', 'No families match', 'Try another search or filter.')}`;
    }
    function paint() {
      const v = store.formView(user, id);
      if (v.error) { root.innerHTML = state('list', 'Form not available', 'It may have been deleted.', back); return; }
      const focusSel = document.activeElement?.id ? `#${document.activeElement.id}` : '';
      const pos = document.activeElement?.selectionStart;
      root.innerHTML = head(v);
      const panel = root.querySelector('[data-panel]');
      panel.innerHTML = tab === 'overview' ? overview(v) : tab === 'questions' ? questionsTab(v) : responsesTab(v);
      if (focusSel && root.querySelector(focusSel)) { const el = root.querySelector(focusSel); el.focus(); if (pos != null && el.setSelectionRange && el.type === 'search') el.setSelectionRange(pos, pos); }
      drawer?.refresh();
    }
    function viewResponse(rid, opener = document.activeElement) {
      drawer?.close(false);
      const el = document.createElement('dialog');
      el.className = 'drawer an-drawer';
      el.setAttribute('aria-labelledby', 'fr-d-title');
      el.innerHTML = `<div class="drawer__panel"><div class="drawer__head"><h2 id="fr-d-title">Response</h2><button class="btn btn--icon-ghost" type="button" aria-label="Close response" data-close>${icon('x')}</button></div><div class="drawer__body" data-body></div></div>`;
      document.body.appendChild(el);
      const close = (restore = true) => { if (!el.isConnected || el.classList.contains('is-closing')) return; el.classList.add('is-closing'); drawer = null; const done = () => { el.close(); el.remove(); if (restore && opener && document.contains(opener)) opener.focus(); }; reduceMotion.matches ? done() : setTimeout(done, 170); };
      const refresh = () => {
        const v = store.formView(user, id);
        const r = v.responses?.find(x => x.id === rid);
        const body = el.querySelector('[data-body]');
        if (!r) { body.innerHTML = state('lock', 'Response not available', 'You may not have access to it.'); return; }
        const shown = store.visibleFormQuestions(v.form.questions, r.answers);
        el.querySelector('#fr-d-title').textContent = famName(r.familyId);
        body.innerHTML = `<dl class="token-sheet an-d-meta"><div><dt>Guardian</dt><dd>${esc(r.guardianName)}</dd></div><div><dt>Children</dt><dd>${esc(r.children.join(', '))}</dd></div><div><dt>Submitted</dt><dd>${esc(when(r.submittedAt))}</dd></div><div><dt>Form version</dt><dd>${r.version}</dd></div></dl>
          ${r.demo ? '<p class="cd-note">Entered in the demo parent view (or demo sample data) — families can’t log in yet.</p>' : ''}
          <ol class="fr-answers">${v.form.questions.map((q, i) => {
            const val = r.answers[q.id];
            let a;
            if (!shown.has(q.id)) a = '<span class="cp-muted">Not shown to this family (conditional)</span>';
            else if (!store.formAnswered(q, val)) a = '<span class="cp-muted">No answer</span>';
            else if (q.type === 'signature') { const s = r.signatures?.[q.id]; const file = store.formFile(user, val.fileId); a = `<div class="fr-sig fr-sig--big">${file ? `<img src="${esc(file.data)}" alt="Signature of ${esc(s?.name || r.guardianName)}">` : '<span class="cp-muted">Image not available on this device</span>'}<b>${esc(s?.name || r.guardianName)}</b><small>Signed ${esc(when(s?.at || r.submittedAt))} · confirmed: “${esc(q.statement || '')}”</small></div>`; }
            else if (q.type === 'file') a = `<ul class="fr-files">${val.map(fid => { const file = store.formFile(user, fid); return `<li>${icon('file', 'icon--sm')}${file ? `<button class="btn btn--tertiary btn--sm" type="button" data-file="${esc(fid)}">${esc(file.name)}</button>` : '<span class="cp-muted">File not available</span>'}</li>`; }).join('')}</ul>`;
            else a = `<p class="fr-answer">${esc(q.type === 'date' ? dayOnly(`${val}T12:00:00`) : store.formAnswerText(q, val, r))}</p>`;
            return `<li><span class="fb-q__n">${i + 1}</span><div><p class="fr-answers__q">${esc(q.label)}</p>${a}</div></li>`;
          }).join('')}</ol>`;
      };
      el.addEventListener('cancel', e => { e.preventDefault(); close(); });
      el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-close]')) { close(); return; } const fb = e.target.closest('[data-file]'); if (fb) openFile(fb.dataset.file); });
      el.showModal();
      drawer = { close, refresh };
      refresh();
      el.querySelector('[data-close]').focus();
    }
    function openFile(fid) {
      const file = store.formFile(user, fid);
      if (!file) { toast('File not available', 'You may not have access, or it isn’t on this device.'); return; }
      const a = document.createElement('a');
      a.href = file.data; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    }
    root.addEventListener('click', e => {
      const tb = e.target.closest('[data-tab]');
      if (tb) { tab = tb.dataset.tab; const u = new URL(location.href); u.searchParams.set('tab', tab); history.replaceState(null, '', u); paint(); root.querySelector(`#fr-tab-${tab}`)?.focus(); return; }
      if (e.target.closest('[data-export]')) {
        const r = store.formResponsesCsv(user, id);
        if (r.error) { toast('Export failed', FAIL[r.error] || 'The responses couldn’t be exported.', 'alert-circle'); return; }
        try { download(r.csv, r.filename); toast('Export ready', `${plural(r.rows, 'response')} in ${r.filename}`, 'download'); } catch { toast('Export failed', 'Your browser blocked the download. Try again.', 'alert-circle'); }
        return;
      }
      const a = e.target.closest('[data-act]');
      if (a) { formAction(user, a.dataset.act, id, { after: paint }); return; }
      const vw = e.target.closest('[data-view]');
      if (vw) { viewResponse(vw.dataset.view); return; }
      const fb = e.target.closest('[data-file]');
      if (fb) openFile(fb.dataset.file);
    });
    root.addEventListener('input', e => { const k = e.target.dataset.rf; if (k) { rf[k] = e.target.value; paint(); } });
    root.addEventListener('keydown', e => {
      const t = e.target.closest('[role="tab"]');
      if (!t) return;
      const keys = ['overview', 'questions', 'responses'];
      const i = keys.indexOf(t.dataset.tab);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: 2 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      tab = keys[(to + 3) % 3]; paint(); root.querySelector(`#fr-tab-${tab}`)?.focus();
    });
    store.subscribe(({ key }) => { if (!key || /^nexora-(forms|form-responses|demo-role)/.test(key)) { if (!root.contains(document.activeElement) || !/INPUT|SELECT/.test(document.activeElement.tagName)) paint(); } });
    paint();
  }

  /* ================================================================= Demo parent view */

  function respond(main, user, id, familyId) {
    const back = routes.page('forms', { results: id, tab: 'responses' });
    const backBtn = `<a class="btn btn--secondary" href="${back}" data-leave>${icon('arrow-left', 'icon--sm')}Back to results</a>`;
    const v = store.formView(user, id);
    document.title = 'Parent view (demo) · Nexora';
    if (v.error) { main.innerHTML = `<div class="kids">${state('list', 'Form not available', 'It may have been deleted, or you can’t see it.', `<a class="btn btn--secondary" href="${routes.page('forms')}">Back to forms</a>`)}</div>`; return; }
    const f = v.form;
    const r = f.recipients.find(x => x.familyId === familyId && !x.removed);
    const existing = v.responses.find(x => x.familyId === familyId);
    const shell = inner => `<div class="kids fp-page"><nav class="kids-crumbs" aria-label="Breadcrumb"><a href="${routes.page('forms')}">Forms &amp; Permissions</a> / <a href="${back}">${esc(f.title)}</a> / <span aria-current="page">Parent view</span></nav>${inner}</div>`;
    if (!v.manage) { main.innerHTML = shell(state('lock', 'Only the form’s owner can use the parent view', 'Leaders and the person who created the form can enter responses in the demo.', backBtn)); return; }
    if (!r) { main.innerHTML = shell(state('users', 'This family isn’t in the audience', 'Choose a pending family from the Individual responses tab.', backBtn)); return; }
    if (existing) { main.innerHTML = shell(state('check-circle', 'Already responded', `${esc(existing.guardianName)} responded ${esc(when(existing.submittedAt))}. Only one response per family is kept.`, backBtn)); return; }
    if (!store.formAccepting(f)) { main.innerHTML = shell(state('lock', f.status === 'closed' ? 'This form is closed' : 'The due date has passed', 'It isn’t accepting new responses.', backBtn)); return; }
    const fam = store.familyById(familyId);
    const guardians = (fam?.guardians || []).filter(g => r.guardianIds.includes(g.id));
    let gid = guardians.find(g => g.id === fam?.primary?.id)?.id || guardians[0]?.id || '';
    let dirty = false;
    main.innerHTML = shell(`<header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Parent view <span class="kids-head__count">(demo)</span></h1><p class="kids-head__sub">Families can’t log in yet. Submitting here saves a real response for <b>${esc(r.name)}</b>, marked as entered in the demo.</p></div>${backBtn}</header>
      <div class="fp-respond">
        <div class="field fp-guardian"><label class="field__label" for="fp-g">Responding as</label><select class="input" id="fp-g" data-g>${guardians.map(g => `<option value="${esc(g.id)}"${g.id === gid ? ' selected' : ''}>${esc(g.name)}${g.relation ? ` (${esc(g.relation)})` : ''}</option>`).join('')}</select><p class="field__hint">${f.respondent === 'primary' ? 'This form accepts the primary guardian only.' : 'Any guardian in the family can respond.'}</p></div>
        <div class="fp-phone fp-phone--page"><div class="fp-phone__notch" aria-hidden="true"></div><div class="fp-phone__screen" data-screen></div></div>
      </div>`);
    const mount = () => formUI(main.querySelector('[data-screen]'), f, { mode: 'respond', family: r, guardianId: gid, guardianName: guardians.find(g => g.id === gid)?.name, user, draftKey: `nexora-form-draft:${f.id}:${familyId}`, onDirty: x => { dirty = x; }, onSubmitted: () => { dirty = false; toast('Response saved', `${r.name} · counted in the results.`, 'check-circle', { action: { label: 'View results', onClick: () => { location.href = back; } } }); } });
    mount();
    main.querySelector('[data-g]').addEventListener('change', e => { gid = e.target.value; mount(); });
    addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
    main.addEventListener('click', e => {
      const leave = e.target.closest('[data-leave], .kids-crumbs a');
      if (!leave || !dirty) return;
      e.preventDefault();
      kids.dialog({ label: 'Parent view', title: 'Leave without submitting?', desc: 'Typed answers are kept on this device for this session, but files and signatures will need to be added again.', body: '', submit: 'Leave', danger: true, async onSubmit() { dirty = false; location.href = leave.href; return { ok: true }; } });
    });
  }

  window.NexoraForms = { render, visibleForTest: (q, a) => store.visibleFormQuestions(q, a) };
})();
