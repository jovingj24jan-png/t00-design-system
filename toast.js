/* Shared toast: NexoraToast.show(title, text, icon). Uses the page's #toast-region, creating it if missing. */
(() => {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  function region() {
    let r = document.getElementById('toast-region');
    if (!r) {
      r = document.createElement('div');
      r.className = 'toast-region';
      r.id = 'toast-region';
      r.setAttribute('aria-live', 'polite');
      document.body.appendChild(r);
    }
    return r;
  }

  function show(title, text = '', kind = 'check-circle') {
    const toastRegion = region();
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${icon(kind, kind === 'check-circle' ? 'icon--success' : 'icon--info')}
      <div class="toast__body"><p class="toast__title">${esc(title)}</p>${text ? `<p class="toast__text">${esc(text)}</p>` : ''}</div>
      <button class="btn btn--icon-ghost" type="button" aria-label="Dismiss">${icon('x')}</button>
      <span class="toast__timer" aria-hidden="true"></span>`;
    let remaining = 4500;
    let started = Date.now();
    let timer = setTimeout(dismiss, remaining);
    function dismiss() {
      clearTimeout(timer);
      if (el.classList.contains('is-leaving')) return;
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), reduceMotion.matches ? 0 : 180);
    }
    el.addEventListener('mouseenter', () => { clearTimeout(timer); remaining -= Date.now() - started; });
    el.addEventListener('mouseleave', () => { started = Date.now(); timer = setTimeout(dismiss, Math.max(remaining, 1000)); });
    el.querySelector('button').addEventListener('click', dismiss);
    toastRegion.appendChild(el);
    const all = toastRegion.querySelectorAll('.toast:not(.is-leaving)');
    if (all.length > 3) all[0].remove();
  }

  window.NexoraToast = { show };
})();
