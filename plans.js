/* plans.html?plan=…&module=… — S61 plans & upgrade (prototype: no billing).
   Director, Admin and Super Admin can switch the school's plan; everyone else can compare plans. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const { routes, school } = store;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const FLASH_KEY = 'nexora-plan-flash';

  const params = new URLSearchParams(location.search);
  const selected = store.planById(params.get('plan'));
  const fromKey = store.requiredPlanFor(params.get('module')) ? params.get('module') : null;
  // Module lists start open where there is room; on phones only the plan you came to see is open.
  const wide = window.matchMedia('(min-width: 768px)').matches;
  const fromPage = fromKey ? store.pageByKey(fromKey) : null;
  const main = document.getElementById('content');

  if (!store.session.isSignedIn()) {
    location.replace(routes.signIn({ next: `${location.pathname.split('/').pop()}${location.search}` }));
    return;
  }

  window.NexoraShell.mount();
  main.classList.add('record-page');

  const user = store.currentUser();
  const current = store.currentPlan();
  const canManage = store.canManagePlan(user);
  document.title = 'Plans & upgrade · Nexora';

  function contextHtml() {
    if (!fromPage) return '';
    if (store.isEntitled(fromKey)) {
      return `
        <div class="pp-context pp-context--ok" role="status">
          ${icon('check-circle', 'icon--success')}
          <p><strong>${esc(fromPage.name)}</strong> is included in your ${esc(current.name)} plan.</p>
          <a class="btn btn--primary" href="${routes.page(fromKey)}">Open ${esc(fromPage.name)}${icon('arrow-right', 'icon--sm')}</a>
        </div>`;
    }
    const required = store.requiredPlanFor(fromKey);
    return `
      <div class="pp-context">
        ${icon('lock', 'icon--primary')}
        <p><strong>${esc(fromPage.name)}</strong> needs the ${esc(required.name)} plan or higher. ${esc(school.name)} is on ${esc(current.name)}.</p>
      </div>`;
  }

  function planHtml(plan) {
    const isCurrent = plan.id === current.id;
    const isSelected = selected && plan.id === selected.id && !isCurrent;
    const included = store.modulesInPlan(plan.id);
    const upgrade = plan.rank > current.rank;
    let action = '';
    if (canManage) {
      action = isCurrent
        ? `<button class="btn btn--secondary btn--block" type="button" disabled>${icon('check', 'icon--sm')}Current plan</button>`
        : `<button class="btn ${isSelected || (!selected && upgrade) ? 'btn--primary' : 'btn--secondary'} btn--block" type="button" data-switch="${plan.id}" aria-haspopup="dialog">${upgrade ? 'Upgrade' : 'Move'} to ${esc(plan.name)}</button>`;
    }
    return `
      <article class="pp-card${isCurrent ? ' is-current' : ''}${isSelected ? ' is-selected' : ''}" aria-labelledby="plan-${plan.id}">
        <div class="pp-card__top">
          <h2 class="pp-card__name" id="plan-${plan.id}">${esc(plan.name)}</h2>
          <span class="pp-card__badges">
            ${isCurrent ? '<span class="badge badge--success">Current plan</span>' : ''}
            ${plan.id === 'premium' && !isCurrent ? '<span class="badge badge--primary badge--plain">Recommended</span>' : ''}
            ${isSelected ? '<span class="badge badge--info badge--plain">Selected</span>' : ''}
          </span>
        </div>
        <p class="pp-card__text">${esc(plan.summary)}</p>
        <details class="pp-card__more" data-accordion${wide || isSelected || (fromKey && included.includes(fromKey) && upgrade) ? ' open' : ''}>
        <summary class="pp-card__toggle"><span class="tech-label tech-label--plain">${included.length} of ${store.moduleKeys.length} modules</span>${icon('chevron-down', 'icon--sm accordion__chev')}</summary>
        <ul class="pp-card__modules">
          ${store.moduleKeys.map(k => {
            const on = included.includes(k);
            return `<li class="${on ? 'is-on' : 'is-off'}${k === fromKey ? ' is-from' : ''}">${icon(on ? 'check' : 'lock', 'icon--sm')}<span>${esc(store.pageByKey(k).name)}</span><span class="sr-only">${on ? ' (included)' : ' (not included)'}</span></li>`;
          }).join('')}
        </ul>
        </details>
        ${action}
      </article>`;
  }

  main.innerHTML = `
    <div class="pp">
      <header class="panel pp-head">
        <span class="tech-label">S61 · Plans &amp; upgrade</span>
        <h1 class="pp-head__title">Plans for ${esc(school.name)}</h1>
        <p class="pp-head__text">You're on the <strong>${esc(current.name)}</strong> plan. ${canManage ? 'Compare plans and switch when you are ready.' : 'Only your director or school admin can change the plan.'}</p>
        <p class="pp-head__proto">${icon('info', 'icon--sm')}Prototype: no payment is taken. Switching changes the demo plan saved in this browser.</p>
        ${contextHtml()}
      </header>
      <div class="pp-grid">${store.plans.map(planHtml).join('')}</div>
    </div>

    <dialog class="modal" id="switch-modal" aria-labelledby="switch-title" aria-describedby="switch-desc">
      <div class="modal__panel">
        <span class="modal__grabber" aria-hidden="true"></span>
        <div class="modal__top">
          <span class="tech-label">Plan / Change</span>
          <button class="btn btn--icon-ghost" type="button" aria-label="Close" data-close>${icon('x')}</button>
        </div>
        <div class="modal__body">
          <h2 class="modal__title" id="switch-title"></h2>
          <p class="modal__desc" id="switch-desc"></p>
          <div data-switch-effects></div>
          <p class="field__hint field__hint--error" data-offline-error role="alert" hidden></p>
        </div>
        <div class="modal__foot">
          <button class="btn btn--primary" type="button" data-confirm>Switch plan</button>
          <button class="btn btn--secondary" type="button" data-close>Cancel</button>
        </div>
      </div>
    </dialog>`;

  // Toast carried over the reload that follows a plan change.
  try {
    const flash = sessionStorage.getItem(FLASH_KEY);
    if (flash) { sessionStorage.removeItem(FLASH_KEY); window.NexoraToast.show(flash, 'Prototype: no payment was taken.'); }
  } catch { /* storage blocked */ }

  main.querySelector('.pp-card.is-selected')?.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });

  if (!canManage) return;

  const modal = main.querySelector('#switch-modal');
  const confirmBtn = modal.querySelector('[data-confirm]');
  const offlineError = modal.querySelector('[data-offline-error]');
  let target = null;
  let opener = null;

  function open(plan, from) {
    target = plan;
    opener = from;
    const upgrade = plan.rank > current.rank;
    const gained = store.modulesInPlan(plan.id).filter(k => !store.isEntitled(k, current));
    const lost = store.modulesInPlan(current.id).filter(k => !store.isEntitled(k, plan));
    const list = keys => keys.map(k => `<li>${esc(store.pageByKey(k).name)}</li>`).join('');
    modal.querySelector('#switch-title').textContent = `${upgrade ? 'Upgrade' : 'Move'} to ${plan.name}?`;
    modal.querySelector('#switch-desc').textContent = `${school.name} will move from ${current.name} to ${plan.name}. Prototype: no payment is taken.`;
    modal.querySelector('[data-switch-effects]').innerHTML = gained.length
      ? `<div class="well"><span class="tech-label">Unlocks</span><ul class="pp-effects">${list(gained)}</ul></div>`
      : `<div class="well pp-warn"><span class="tech-label">Locks again</span><ul class="pp-effects">${list(lost)}</ul></div>`;
    confirmBtn.textContent = `${upgrade ? 'Upgrade' : 'Move'} to ${plan.name}`;
    offlineError.hidden = true;
    modal.classList.remove('is-closing');
    modal.showModal();
    confirmBtn.focus();
  }
  function close() {
    if (!modal.open || modal.classList.contains('is-closing')) return;
    modal.classList.add('is-closing');
    const done = () => { modal.classList.remove('is-closing'); modal.close(); opener?.focus(); };
    reduceMotion.matches ? done() : setTimeout(done, 170);
  }

  main.querySelectorAll('[data-switch]').forEach(b => b.addEventListener('click', () => open(store.planById(b.dataset.switch), b)));
  modal.addEventListener('cancel', e => { e.preventDefault(); close(); });
  modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-close]')) close(); });

  const showError = text => { offlineError.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-info"/></svg>${text}`; offlineError.hidden = false; };
  confirmBtn.addEventListener('click', () => {
    if (!window.NexoraConnectivity.requireOnline('Changing the plan', showError)) return;
    const result = store.setSchoolPlan(user, target.id);
    // Shown in the dialog: a toast would sit behind the open modal.
    if (!result.ok) { showError("We couldn't save the new plan. Nothing was changed. Please try again."); return; }
    try { sessionStorage.setItem(FLASH_KEY, `${school.name} is now on ${result.plan.name}`); } catch { /* toast is optional */ }
    // Reload so the sidebar locks and every card reflect the new plan; ?plan is dropped so
    // the selection doesn't point at the plan the school is already on.
    location.replace(routes.plans({ module: fromKey }));
  });
})();
