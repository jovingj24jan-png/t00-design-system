/* Public form page (form.html?f=<formId>): shows only the published version of a live Form Builder form and saves the
   answers through the store, which re-validates everything. No sign-in. Prototype: the form and its answers live in this
   browser's storage, so a link opened on another device shows "not available". Test hook: ?fail=1 (first submit fails). */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const kit = window.NexoraFormKit;
  const host = document.querySelector('[data-host]');
  const params = new URLSearchParams(location.search);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // The few icons a form needs (the app's full set lives in shell.js, which this page doesn't load).
  const SPRITE = {
    upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>', refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>', check: '<path d="M20 6 9 17l-5-5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>', 'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
    file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>', leaf: '<path d="M5 19c0-8 5-14 15-15 0 10-6 15-14 15"/><path d="M5 19c3-4 6-7 10-9"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'
  };
  document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${Object.entries(SPRITE).map(([k, p]) => `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</symbol>`).join('')}</defs></svg>`);

  let failOnce = params.get('fail') === '1';
  const p = store.publicBuilderForm(params.get('f') || '');
  host.removeAttribute('aria-busy');
  if (!p.ok) {
    document.title = 'Form not available';
    host.innerHTML = `<div class="kids-empty an-state"><span class="state-icon state-icon--lock" aria-hidden="true"><svg class="icon"><use href="#i-lock"/></svg></span><h1 class="kids-empty__title">This form isn’t available</h1><p>It may not be published yet, or it has been closed. If you were sent this link, contact the school.</p><p class="fk-help">In this prototype, published forms open only in the browser where they were created.</p></div>`;
    return;
  }
  document.title = `${p.form.name} · ${p.school.name}`;
  const newClientId = () => `bfp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  // One id per attempt, kept across retries, so a retried or double-clicked submit is saved once.
  let clientId = newClientId();
  kit.renderForm(host, p.form, {
    mode: 'live', school: p.school, idPrefix: 'fkp',
    onUpload: (fieldId, file) => store.uploadBuilderFile(p.form.id, fieldId, file),
    async onSubmit(answers) {
      if (failOnce) { failOnce = false; await store.settle({}); return { ok: false, reason: 'storage' }; }
      const r = await store.submitBuilderForm(p.form.id, answers, { clientId, campaignTag: params.get('campaign') || '' });
      if (r.ok) clientId = newClientId();
      return r;
    }
  });
  host.querySelector('.fk-title')?.setAttribute('id', 'fkp-title');
  void esc;
})();
