/* Shared form renderer for the Form Builder: the builder's preview (formbuilder.js) and the public page (form.html) both
   draw a form with renderForm(), so respondents see exactly what staff previewed. Validation is the store's
   validateBuilderAnswers(); the public page re-checks everything in the store on submit. Also owns the signature pad
   used by family forms (forms.js). */
(() => {
  'use strict';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const SUBMIT = { application: 'Submit application', consent: 'Submit consent', custom: 'Submit' };
  const MIME = { image: ['image/jpeg', 'image/png', 'image/webp'], pdf: ['application/pdf'] };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  function signaturePad(wrap, onChange) {
    const canvas = wrap.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    let strokes = [];
    let typedName = '';
    let drawing = null;
    const ink = () => getComputedStyle(wrap).getPropertyValue('--sig-ink').trim() || getComputedStyle(wrap).color;
    function fit() {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(r.width * dpr)) { canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); redraw(); }
    }
    function redraw() {
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = ink(); ctx.fillStyle = ink(); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (typedName) { ctx.font = 'italic 34px Georgia, serif'; ctx.textBaseline = 'middle'; ctx.fillText(typedName, 18, canvas.height / dpr / 2, canvas.width / dpr - 36); }
      strokes.forEach(s => { ctx.beginPath(); s.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); if (s.length === 1) ctx.lineTo(s[0][0] + 0.1, s[0][1]); ctx.stroke(); });
      wrap.classList.toggle('is-signed', Boolean(typedName || strokes.length));
    }
    const pt = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    canvas.addEventListener('pointerdown', e => { fit(); try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or lost pointer */ } drawing = [pt(e)]; strokes.push(drawing); redraw(); e.preventDefault(); });
    canvas.addEventListener('pointermove', e => { if (!drawing) return; drawing.push(pt(e)); redraw(); });
    const end = () => { if (drawing) { drawing = null; onChange(); } };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    requestAnimationFrame(fit);
    return {
      fit, isEmpty: () => !strokes.length && !typedName.trim(),
      clear() { strokes = []; typedName = ''; redraw(); onChange(); },
      typed(name) { typedName = name.slice(0, 60); strokes = []; redraw(); onChange(); },
      toDataURL() { fit(); return canvas.toDataURL('image/png'); }
    };
  }

  // One field's control. `idp` keeps ids unique when two previews are on screen.
  function fieldHtml(f, idp) {
    const id = `${idp}-${f.id}`;
    const req = f.required ? ' <span class="field__req" aria-hidden="true">*</span><span class="sr-only">(required)</span>' : '';
    const help = f.help ? `<p class="fk-help" id="${id}-help">${esc(f.help)}</p>` : '';
    const desc = `${f.help ? `${id}-help ` : ''}${id}-err`;
    const err = `<p class="field__hint field__hint--error" id="${id}-err" data-ferr="${esc(f.id)}" hidden></p>`;
    const label = `<label class="fk-label" for="${id}">${esc(f.label || 'Untitled field')}${req}</label>`;
    const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : '';
    const dv = f.defaultValue ? ` value="${esc(f.defaultValue)}"` : '';
    const wrap = inner => `<div class="fk-field fk-field--${f.type}" data-fwrap="${esc(f.id)}">${inner}${err}</div>`;
    switch (f.type) {
      case 'section': return `<div class="fk-sec" data-fwrap="${esc(f.id)}"><h3 class="fk-sec__title">${esc(f.label || 'Section')}</h3>${f.help ? `<p class="fk-help">${esc(f.help)}</p>` : ''}</div>`;
      case 'text': return wrap(`${label}${help}<input class="input" id="${id}" data-f="${esc(f.id)}" maxlength="${f.maxLength || 200}"${ph}${dv} aria-describedby="${desc}"${f.mapTo === 'child.name' || f.mapTo === 'guardian.name' ? ' autocomplete="name"' : ''}>`);
      case 'longtext': return wrap(`${label}${help}<textarea class="input fk-textarea" id="${id}" data-f="${esc(f.id)}" rows="4" maxlength="${f.maxLength || 2000}"${ph} aria-describedby="${desc}">${esc(f.defaultValue || '')}</textarea>`);
      case 'email': return wrap(`${label}${help}<input class="input" type="email" id="${id}" data-f="${esc(f.id)}" autocomplete="email" dir="ltr" maxlength="120"${ph}${dv} aria-describedby="${desc}">`);
      case 'phone': return wrap(`${label}${help}<input class="input" type="tel" inputmode="tel" id="${id}" data-f="${esc(f.id)}" autocomplete="tel" dir="ltr" maxlength="24"${ph}${dv} aria-describedby="${desc}">`);
      case 'date': {
        let min = f.minDate || '';
        let max = f.maxDate || '';
        if (f.dateRule === 'past' && (!max || max > today())) max = today();
        if (f.dateRule === 'future' && (!min || min < today())) min = today();
        return wrap(`${label}${help}<input class="input" type="date" id="${id}" data-f="${esc(f.id)}"${min ? ` min="${min}"` : ''}${max ? ` max="${max}"` : ''}${dv} aria-describedby="${desc}">`);
      }
      case 'dropdown': return wrap(`${label}${help}<select class="input" id="${id}" data-f="${esc(f.id)}" aria-describedby="${desc}"><option value="">${esc(f.placeholder || 'Choose…')}</option>${f.options.map(o => `<option value="${esc(o.id)}"${f.defaultValue && f.defaultValue === o.label ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`);
      case 'multiselect': return wrap(`<fieldset class="fk-fs" aria-describedby="${desc}"><legend class="fk-label">${esc(f.label || 'Untitled field')}${req}</legend>${help}<p class="fk-help">${f.minSelect > 1 ? `Choose at least ${f.minSelect}.` : 'Choose all that apply.'}</p><div class="fk-opts">${f.options.map(o => `<label class="fk-opt"><input type="checkbox" value="${esc(o.id)}" data-f="${esc(f.id)}"><span>${esc(o.label)}</span></label>`).join('')}</div></fieldset>`);
      case 'checkbox': return wrap(`<label class="fk-check" for="${id}"><input type="checkbox" id="${id}" data-f="${esc(f.id)}" aria-describedby="${desc}"><span>${esc(f.label || 'Checkbox')}${req}</span></label>${help}`);
      case 'consent': return wrap(`<p class="fk-label" id="${id}-t">${esc(f.label || 'Consent')}</p>${help}<div class="fk-statement" id="${id}-s">${esc(f.statement || '')}</div>${f.requireAccept ? `<label class="fk-check" for="${id}"><input type="checkbox" id="${id}" data-f="${esc(f.id)}" aria-describedby="${id}-s ${desc}"><span>I agree${req}</span></label>` : ''}`);
      case 'file': {
        const acc = (f.accept || ['image', 'pdf']).flatMap(k => MIME[k]).join(',');
        return wrap(`${label}${help}<div class="fk-file"><input class="sr-only" type="file" id="${id}" accept="${acc}" data-file="${esc(f.id)}" aria-describedby="${desc}"><label class="btn btn--secondary btn--sm" for="${id}">${icon('upload', 'icon--sm')}Choose file</label><span class="fk-help">${f.accept?.length === 1 ? (f.accept[0] === 'pdf' ? 'PDF' : 'Image') : 'Image or PDF'} · up to ${f.maxKB >= 1024 ? '1 MB' : `${f.maxKB} KB`}</span></div><ul class="fk-files" data-files="${esc(f.id)}"></ul>`);
      }
      case 'signature': return wrap(`<p class="fk-label" id="${id}-l">${esc(f.label || 'Signature')}${req}</p>${help}${f.statement ? `<p class="fk-statement">${esc(f.statement)}</p>` : ''}
        <div class="fp-sig" data-sig="${esc(f.id)}"><canvas class="fp-sig__pad" tabindex="0" role="img" aria-labelledby="${id}-l" aria-describedby="${desc}"></canvas><span class="fp-sig__hint" aria-hidden="true">Sign here</span></div>
        <div class="fp-sig__tools"><button class="btn btn--tertiary btn--sm" type="button" data-sig-clear="${esc(f.id)}">${icon('refresh', 'icon--sm')}Clear</button><button class="btn btn--tertiary btn--sm" type="button" data-sig-type="${esc(f.id)}" aria-expanded="false">Type my name instead</button></div>
        <div class="field" data-sig-typed="${esc(f.id)}" hidden><label class="field__label" for="${id}-typed">Your full name</label><input class="input" id="${id}-typed" data-sig-name="${esc(f.id)}" autocomplete="name"></div>
        <p class="fk-help">The date and time are recorded when you submit. This is not a verified or legally certified e-signature.</p>`);
      default: return '';
    }
  }

  /* renderForm(host, form, { mode: 'preview'|'live', school, onSubmit(answers) → { ok, errors, message }, onUpload(fieldId, file) })
     Preview never stores anything: files and signatures stay in the page. Returns { reset }. */
  function renderForm(host, form, { mode = 'preview', school = null, onSubmit = async () => ({ ok: true }), onUpload = null, idPrefix = 'fk' } = {}) {
    const store = window.NexoraStore;
    const fields = form.fields || [];
    const files = {};
    const pads = {};
    let busy = false;
    const uploads = new Set();
    const answerable = fields.filter(f => f.type !== 'section');
    host.innerHTML = `<div class="fk">
      <header class="fk-head">${school ? `<p class="fk-brand">${school.logo ? `<img src="${esc(school.logo)}" alt="" width="32" height="32">` : icon('leaf')}<span>${esc(school.name)}</span></p>` : ''}
        <h2 class="fk-title" tabindex="-1">${esc(form.name || 'Untitled form')}</h2>${form.description ? `<p class="fk-desc">${esc(form.description)}</p>` : ''}
        ${answerable.some(f => f.required) ? '<p class="fk-help"><span class="field__req" aria-hidden="true">*</span> marks a required field.</p>' : ''}</header>
      <form class="fk-form" novalidate>${fields.map(f => fieldHtml(f, idPrefix)).join('') || '<p class="fk-help">This form has no fields yet.</p>'}
        <div class="fk-formerr" data-formerr role="alert" tabindex="-1" hidden></div>
        <button class="btn btn--primary fk-submit" type="submit"${answerable.length ? '' : ' disabled'}>${esc(form.submitLabel || SUBMIT[form.type] || 'Submit')}</button>
        ${mode === 'preview' ? '<p class="fk-help fk-note">Preview — answers are checked but not saved.</p>' : ''}
      </form>
      <div class="fk-done" data-done hidden tabindex="-1"></div></div>`;
    const formEl = host.querySelector('form');
    const submitBtn = formEl.querySelector('.fk-submit');
    host.querySelectorAll('[data-sig]').forEach(w => { pads[w.dataset.sig] = signaturePad(w, () => clearErr(w.dataset.sig)); });

    function answers() {
      const a = {};
      fields.forEach(f => {
        if (f.type === 'section') return;
        if (f.type === 'multiselect') a[f.id] = [...formEl.querySelectorAll(`[data-f="${CSS.escape(f.id)}"]:checked`)].map(x => x.value);
        else if (f.type === 'checkbox' || f.type === 'consent') { const el = formEl.querySelector(`[data-f="${CSS.escape(f.id)}"]`); a[f.id] = el ? el.checked : undefined; }
        else if (f.type === 'file') a[f.id] = (files[f.id] || []).map(x => x.id);
        else if (f.type === 'signature') a[f.id] = pads[f.id] && !pads[f.id].isEmpty() ? { fileId: 'pending' } : null;
        else a[f.id] = formEl.querySelector(`[data-f="${CSS.escape(f.id)}"]`)?.value ?? '';
      });
      return a;
    }
    function clearErr(fid) {
      const p = formEl.querySelector(`[data-ferr="${CSS.escape(fid)}"]`);
      if (!p || p.hidden) return;
      p.hidden = true;
      formEl.querySelector(`[data-fwrap="${CSS.escape(fid)}"]`)?.classList.remove('is-invalid');
      formEl.querySelectorAll(`[data-f="${CSS.escape(fid)}"], [data-file="${CSS.escape(fid)}"]`).forEach(x => x.removeAttribute('aria-invalid'));
    }
    function showErrors(errors, message = '') {
      fields.forEach(f => clearErr(f.id));
      const ids = fields.map(f => f.id).filter(id => errors[id]);
      ids.forEach(id => {
        const p = formEl.querySelector(`[data-ferr="${CSS.escape(id)}"]`);
        if (p) { p.innerHTML = `${icon('info')}${esc(errors[id])}`; p.hidden = false; }
        formEl.querySelector(`[data-fwrap="${CSS.escape(id)}"]`)?.classList.add('is-invalid');
        formEl.querySelectorAll(`[data-f="${CSS.escape(id)}"], [data-file="${CSS.escape(id)}"]`).forEach(x => x.setAttribute('aria-invalid', 'true'));
      });
      const box = formEl.querySelector('[data-formerr]');
      if (ids.length || message) {
        box.innerHTML = `${icon('alert-circle')}<span>${message ? esc(message) : `${ids.length === 1 ? '1 field needs' : `${ids.length} fields need`} attention. ${ids.length ? 'Check the highlighted fields.' : ''}`}</span>`;
        box.hidden = false;
      } else box.hidden = true;
      const first = ids[0];
      if (first) {
        const w = formEl.querySelector(`[data-fwrap="${CSS.escape(first)}"]`);
        (w?.querySelector('input:not([type="file"]), select, textarea, canvas') || w?.querySelector('label.btn') || w)?.focus();
        w?.scrollIntoView?.({ block: 'center' });
      } else if (message) box.focus();
    }

    formEl.addEventListener('input', e => { const fid = e.target.dataset.f; if (fid) clearErr(fid); if (e.target.dataset.sigName) { pads[e.target.dataset.sigName].typed(e.target.value); clearErr(e.target.dataset.sigName); } });
    formEl.addEventListener('change', async e => {
      const fid = e.target.dataset.f;
      if (fid) { clearErr(fid); return; }
      const ff = e.target.dataset.file;
      if (!ff) return;
      const f = fields.find(x => x.id === ff);
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const okTypes = (f.accept || ['image', 'pdf']).flatMap(k => MIME[k]);
      const limit = (f.maxKB || 1024) * 1024;
      if (!okTypes.includes(file.type)) { showErrors({ [ff]: `Choose ${f.accept?.length === 1 ? (f.accept[0] === 'pdf' ? 'a PDF' : 'an image (JPEG, PNG or WebP)') : 'an image or a PDF'}.` }); return; }
      if (file.size > limit) { showErrors({ [ff]: `Files must be ${f.maxKB >= 1024 ? '1 MB' : `${f.maxKB} KB`} or less. This one is ${Math.ceil(file.size / 1024)} KB.` }); return; }
      const list = host.querySelector(`[data-files="${CSS.escape(ff)}"]`);
      if (mode === 'preview' || !onUpload) {
        files[ff] = [...(files[ff] || []), { id: `local-${Date.now()}`, name: file.name, size: file.size }];
      } else {
        list.insertAdjacentHTML('beforeend', `<li class="fk-fileitem" data-uploading>${icon('upload', 'icon--sm')}<span>${esc(file.name)} · uploading…</span></li>`);
        // Submitting waits for uploads still in progress, so a file is never silently left out.
        const job = (async () => {
          const data = await new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(rd.result); rd.onerror = rej; rd.readAsDataURL(file); }).catch(() => null);
          const r = data ? await onUpload(ff, { name: file.name, mime: file.type, size: file.size, data }) : { ok: false, message: 'The file couldn’t be read. Try another file.' };
          list.querySelector('[data-uploading]')?.remove();
          if (r.ok) files[ff] = [...(files[ff] || []), { id: r.file.id, name: r.file.name, size: r.file.size }];
          return r;
        })();
        uploads.add(job);
        const r = await job;
        uploads.delete(job);
        if (!r.ok) { showErrors({ [ff]: r.message || 'The file wasn’t uploaded. Try again.' }); return; }
      }
      drawFiles(ff);
      clearErr(ff);
    });
    function drawFiles(ff) {
      const list = host.querySelector(`[data-files="${CSS.escape(ff)}"]`);
      list.innerHTML = (files[ff] || []).map(x => `<li class="fk-fileitem">${icon('file', 'icon--sm')}<span class="fk-fileitem__name">${esc(x.name)} · ${Math.max(1, Math.round(x.size / 1024))} KB${mode === 'preview' ? ' (preview — not uploaded)' : ''}</span><button class="btn btn--icon-ghost btn--sm" type="button" aria-label="Remove ${esc(x.name)}" data-rmfile="${esc(ff)}" data-fid="${esc(x.id)}">${icon('x', 'icon--sm')}</button></li>`).join('');
    }
    if (host.fkClick) host.removeEventListener('click', host.fkClick);
    host.fkClick = e => {
      const t = e.target;
      const rm = t.closest('[data-rmfile]');
      if (rm) { const ff = rm.dataset.rmfile; files[ff] = (files[ff] || []).filter(x => x.id !== rm.dataset.fid); drawFiles(ff); host.querySelector(`[data-file="${CSS.escape(ff)}"]`)?.focus(); return; }
      const sc = t.closest('[data-sig-clear]');
      if (sc) { pads[sc.dataset.sigClear].clear(); const n = host.querySelector(`[data-sig-name="${CSS.escape(sc.dataset.sigClear)}"]`); if (n) n.value = ''; return; }
      const st = t.closest('[data-sig-type]');
      if (st) { const box = host.querySelector(`[data-sig-typed="${CSS.escape(st.dataset.sigType)}"]`); box.hidden = !box.hidden; st.setAttribute('aria-expanded', String(!box.hidden)); if (!box.hidden) box.querySelector('input').focus(); return; }
      if (t.closest('[data-again]')) { reset(); }
    };
    host.addEventListener('click', host.fkClick);

    formEl.addEventListener('submit', async e => {
      e.preventDefault();
      if (busy) return;
      if (uploads.size) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span>Finishing uploads…'; await Promise.allSettled([...uploads]); submitBtn.disabled = false; submitBtn.innerHTML = esc(form.submitLabel || SUBMIT[form.type] || 'Submit'); }
      const a = answers();
      const v = store.validateBuilderAnswers(fields, a);
      if (Object.keys(v.errors).length) { showErrors(v.errors); return; }
      busy = true;
      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');
      submitBtn.classList.add('is-loading');
      const label = submitBtn.innerHTML;
      submitBtn.innerHTML = `<span class="spinner" aria-hidden="true"></span>${mode === 'preview' ? 'Checking…' : 'Submitting…'}`;
      let r;
      try {
        // Signatures become images only at submit time, so a cleared pad is never stored.
        if (mode === 'live' && onUpload) {
          for (const f of fields.filter(x => x.type === 'signature' && a[x.id])) {
            const data = pads[f.id].toDataURL();
            const up = await onUpload(f.id, { name: 'signature.png', mime: 'image/png', size: Math.round((data.length - 22) * 0.75), data });
            if (!up.ok) { r = { ok: false, errors: { [f.id]: up.message || 'The signature couldn’t be saved. Try again.' } }; break; }
            a[f.id] = { fileId: up.file.id };
          }
        }
        if (!r) r = await onSubmit(a);
      } catch { r = { ok: false, reason: 'storage' }; }
      busy = false;
      submitBtn.disabled = false;
      submitBtn.removeAttribute('aria-busy');
      submitBtn.classList.remove('is-loading');
      submitBtn.innerHTML = label;
      if (r.ok) { done(r); return; }
      if (r.errors && Object.keys(r.errors).length) { showErrors(r.errors, r.message || ''); return; }
      showErrors({}, r.message || (r.reason === 'unavailable' ? 'This form is no longer accepting responses.' : 'Your answers weren’t sent. Check your connection and try again — nothing was lost.'));
    });
    function done(r) {
      const box = host.querySelector('[data-done]');
      formEl.hidden = true;
      box.hidden = false;
      box.innerHTML = `<span class="fk-done__icon" aria-hidden="true">${icon('check')}</span><h3 class="fk-done__title">${mode === 'preview' ? 'Everything checks out' : form.type === 'application' ? 'Thank you — your application has been received' : 'Thank you — your response has been received'}</h3>
        <p>${mode === 'preview' ? 'All required fields and rules passed. This was a preview, so nothing was saved and no enquiry was created.' : form.type === 'application' ? 'Our admissions team will contact you soon.' : 'You can close this page.'}</p>
        ${mode === 'preview' || r.again ? `<button class="btn btn--secondary" type="button" data-again>${mode === 'preview' ? 'Preview again' : 'Send another response'}</button>` : ''}`;
      box.focus();
    }
    function reset() { renderForm(host, form, { mode, school, onSubmit, onUpload, idPrefix }); host.querySelector('input, select, textarea')?.focus(); }
    return { reset, answers };
  }

  window.NexoraFormKit = { renderForm, signaturePad, fieldHtml };
})();
