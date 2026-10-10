/* S17 Classes overview (app.html?page=classes). NexoraClasses.render(key, main, user) → true when handled.
   Data: store.classCards() — the class registry joined with S14 enrolment (active + starting-soon
   children) and today's S19 registers and staff attendance. Writes go through store.saveClass /
   store.archiveClass, which enforce every rule again (the UI checks are only for fast feedback).
   Test hook: ?fail=1 makes the first load fail so the error state can be checked. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const kids = window.NexoraChildren;
  const { routes } = store;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const params = new URLSearchParams(location.search);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const initials = n => String(n || '').replace(/^(Ms|Mr|Mrs|Dr)\.?\s+/i, '').trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const ages = c => `${c.ageMin}–${c.ageMax} yrs`;
  const FAIL = {
    forbidden: 'Your role can’t change classes. Nothing was saved.',
    missing: 'This class no longer exists or was archived. Refresh the page.',
    archived: 'This class is already archived.',
    storage: 'This couldn’t be saved on this device. Nothing was changed. Please try again.'
  };

  /* ------------------------------------------------------------------ Card */

  function staffBlock(c, manage) {
    if (!c.staff.length) {
      return `<div class="cls-staff cls-staff--empty">${icon('user', 'icon--sm')}<span>No staff assigned</span>${manage ? `<button class="btn btn--sm btn--tertiary" type="button" data-act="edit" data-id="${esc(c.id)}">Assign staff</button>` : ''}</div>`;
    }
    const [lead, ...others] = c.staff;
    const shown = others.slice(0, 3);
    const more = others.length - shown.length;
    return `<div class="cls-staff">
      <span class="cls-lead"><span class="cls-av cls-av--lead" aria-hidden="true">${esc(initials(lead.name))}</span><span><b>${esc(lead.name)}</b><small>Lead teacher</small></span></span>
      ${others.length ? `<span class="cls-others" role="img" aria-label="Also assigned: ${esc(others.map(e => e.name).join(', '))}">${shown.map(e => `<span class="cls-av" title="${esc(e.name)}" aria-hidden="true">${esc(initials(e.name))}</span>`).join('')}${more > 0 ? `<span class="cls-av cls-av--more" aria-hidden="true">+${more}</span>` : ''}</span>` : ''}
    </div>`;
  }

  function capacityBlock(c) {
    const { pct, tone } = c.capacityInfo;
    if (pct == null) return `<div class="cls-cap"><p class="cls-cap__text"><b>${c.enrolled}</b> ${c.enrolled === 1 ? 'child' : 'children'} · capacity not set</p></div>`;
    const over = c.enrolled - c.capacity;
    const label = tone === 'full' ? (over > 0 ? `Over capacity by ${over}` : 'Full') : tone === 'near' ? 'Nearly full' : `${c.capacity - c.enrolled} ${c.capacity - c.enrolled === 1 ? 'place' : 'places'} left`;
    return `<div class="cls-cap cls-cap--${tone}">
      <p class="cls-cap__text"><span><b>${c.enrolled} / ${c.capacity}</b> children</span><span class="cls-cap__state">${tone === 'full' ? icon('alert-triangle', 'icon--sm') : ''}${esc(label)}</span></p>
      <span class="cls-bar" aria-hidden="true"><span class="cls-bar__fill" style="--fill:${Math.min(100, pct).toFixed(1)}%"></span></span>
      ${over > 0 ? `<p class="cls-cap__warn" role="note">${plural(c.enrolled, 'child', 'children')} enrolled for ${c.capacity} places. Nobody has been moved.</p>` : ''}
    </div>`;
  }

  function todayBlock(c) {
    const r = c.ratioToday;
    const rule = `${c.ratio.adults} : ${c.ratio.children}`;
    let chip;
    if (r.status === 'ok') chip = `<span class="badge badge--success cls-ratio">${icon('check-circle', 'icon--sm')}Ratio met · ${plural(r.educators, 'adult')} for ${r.children}</span>`;
    else if (r.status === 'breach') chip = `<span class="badge badge--error cls-ratio">${icon('alert-triangle', 'icon--sm')}Ratio not met · needs ${plural(r.required - r.educators, 'more adult', 'more adults')}</span>`;
    else chip = `<span class="badge cls-ratio cls-ratio--na" title="${esc(r.reason)}">${icon('info', 'icon--sm')}Ratio unavailable</span>`;
    return `<div class="cls-today">
      <p class="cls-today__present">${c.present == null ? `${icon('clock', 'icon--sm')}<span>Attendance not recorded</span>` : `${icon('calendar-check', 'icon--sm')}<span><b>${c.present}</b> ${c.present === 1 ? 'child' : 'children'} present today</span>`}</p>
      <div class="cls-today__ratio">${chip}<span class="cls-rule" title="Adults : children">Rule ${esc(rule)}</span></div>
      ${r.status === 'unavailable' ? `<p class="cls-today__why">${esc(r.reason)}.</p>` : ''}
    </div>`;
  }

  function card(c, manage) {
    return `<article class="cls-card cls-card--${esc(c.colour)}" aria-labelledby="cls-${esc(c.id)}">
      <header class="cls-card__head">
        <div class="cls-card__id">
          <h2 class="cls-card__name" id="cls-${esc(c.id)}">${esc(c.name)}</h2>
          <p class="cls-card__meta"><span>${esc(c.level)}</span><span>${esc(ages(c))}</span>${c.mixedAge ? '<span class="cls-tag">Mixed age</span>' : ''}</p>
        </div>
        ${manage ? `<div class="menu-wrap"><button class="btn btn--icon-ghost" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(c.name)}" data-menu="${esc(c.id)}">${icon('more-v')}</button>
          <div class="menu" role="menu" hidden>
            <button type="button" role="menuitem" data-act="edit">${icon('pencil', 'icon--sm')}Edit</button>
            <button type="button" role="menuitem" data-act="duplicate">${icon('copy', 'icon--sm')}Duplicate</button>
            <hr>
            <button type="button" role="menuitem" class="is-danger" data-act="archive">${icon('archive', 'icon--sm')}Archive</button>
          </div></div>` : ''}
      </header>
      <p class="cls-card__place"><span class="cls-room">${icon('door', 'icon--sm')}${c.room ? esc(c.room) : '<span class="cp-muted">No room set</span>'}</span><span class="cls-colour"><i aria-hidden="true"></i>${esc(store.CLASS_COLOURS[c.colour] || c.colour)}</span></p>
      ${staffBlock(c, manage)}
      ${capacityBlock(c)}
      ${todayBlock(c)}
      <a class="cls-card__link" href="${routes.page('children', { cls: c.name })}">View children${icon('arrow-right', 'icon--sm')}</a>
    </article>`;
  }

  const skeleton = () => Array.from({ length: 3 }, () => `<div class="cls-card cls-card--skel" aria-hidden="true">
      <span class="skeleton" style="width:55%;height:20px"></span><span class="skeleton" style="width:35%;height:12px"></span>
      <span class="skeleton" style="width:70%;height:32px"></span><span class="skeleton" style="width:100%;height:8px"></span><span class="skeleton" style="width:60%;height:24px"></span></div>`).join('');

  /* ------------------------------------------------------------------ Add / edit / duplicate modal */

  const n = id => `kd-${id}`;
  function classDialog(user, { cls = null, copyOf = null, onSaved } = {}) {
    const src = cls || copyOf;
    const all = store.getClassRegistry();
    let copyName = '';
    if (copyOf) {
      copyName = `${copyOf.name} (Copy)`;
      for (let i = 2; all.some(c => c.name.toLowerCase() === copyName.toLowerCase()); i++) copyName = `${copyOf.name} (Copy ${i})`;
    }
    const v = src ? { ...src, name: cls ? cls.name : copyName } : { name: '', level: '', colour: 'amber', room: '', ageMin: '', ageMax: '', mixedAge: false, capacity: '', ratio: { adults: 1, children: '' }, staffIds: [] };
    const enrolled = cls ? store.enrolledIn(cls.name).length : 0;
    const counted = id => store.classesOfStaff(id).filter(x => !cls || x !== cls.name);
    const staffChip = e => {
      const elsewhere = counted(e.id);
      return `<label class="cls-pick"><input type="checkbox" name="staff" value="${esc(e.id)}"${v.staffIds.includes(e.id) ? ' checked' : ''}><span><b>${esc(e.name)}</b>${elsewhere.length ? `<small>Also in ${esc(elsewhere.join(', '))}</small>` : ''}</span></label>`;
    };
    const d = kids.dialog({
      label: cls ? 'Classes / Edit' : copyOf ? 'Classes / Duplicate' : 'Classes / New',
      title: cls ? `Edit ${cls.name}` : copyOf ? `Duplicate ${copyOf.name}` : 'Add class',
      desc: copyOf ? 'Settings are copied. Children, attendance and history stay with the original class.' : cls && enrolled ? `${plural(enrolled, 'child is', 'children are')} enrolled. Changing the class never moves children.` : '',
      body: `<div class="cls-form">
        ${kids.field(n('name'), 'Class name', `<input class="input" id="${n('name')}" name="name" maxlength="60" autocomplete="off" required value="${esc(v.name)}">`, { required: true })}
        <div class="cls-form__row">
          ${kids.field(n('level'), 'Level', `<select class="input" id="${n('level')}" name="level" required><option value="">Choose…</option>${store.CLASS_LEVELS.map(l => `<option${l === v.level ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`, { required: true })}
          ${kids.field(n('room'), 'Room', `<input class="input" id="${n('room')}" name="room" maxlength="60" autocomplete="off" required placeholder="e.g. Room 6" value="${esc(v.room)}">`, { required: true })}
        </div>
        <fieldset class="field cls-colours"><legend class="field__label">Colour tag <span class="field__req" aria-hidden="true">*</span></legend>
          <div class="cls-colours__list">${Object.entries(store.CLASS_COLOURS).map(([k, label]) => `<label class="cls-swatch cls-swatch--${k}"><input type="radio" name="colourTag" value="${k}"${k === v.colour ? ' checked' : ''}><i aria-hidden="true"></i><span>${esc(label)}</span></label>`).join('')}</div>
          <p class="field__hint field__hint--error" data-error-for="colour" hidden></p>
        </fieldset>
        <fieldset class="field cls-ages"><legend class="field__label">Age range (years) <span class="field__req" aria-hidden="true">*</span></legend>
          <div class="cls-form__pair">
            <span><label class="sr-only" for="${n('ageMin')}">Youngest age in years</label><input class="input" id="${n('ageMin')}" name="ageMin" type="number" inputmode="numeric" min="0" max="12" step="1" placeholder="From" value="${esc(v.ageMin)}"></span>
            <span aria-hidden="true">to</span>
            <span><label class="sr-only" for="${n('ageMax')}">Oldest age in years</label><input class="input" id="${n('ageMax')}" name="ageMax" type="number" inputmode="numeric" min="1" max="12" step="1" placeholder="To" value="${esc(v.ageMax)}"></span>
          </div>
          <p class="field__hint field__hint--error" data-error-for="ageMin" hidden></p>
          <p class="field__hint field__hint--error" data-error-for="ageMax" hidden></p>
          <label class="cls-toggle"><input type="checkbox" name="mixedAge" role="switch"${v.mixedAge ? ' checked' : ''}><span class="cls-toggle__track" aria-hidden="true"></span><span>Mixed-age class</span></label>
        </fieldset>
        <div class="cls-form__row">
          ${kids.field(n('capacity'), 'Capacity (children)', `<input class="input" id="${n('capacity')}" name="capacity" type="number" inputmode="numeric" min="1" max="200" step="1" required value="${esc(v.capacity ?? '')}">`, { required: true })}
          <fieldset class="field"><legend class="field__label">Ratio · adults : children <span class="field__req" aria-hidden="true">*</span></legend>
            <div class="cls-form__pair">
              <span><label class="sr-only" for="${n('ratioAdults')}">Adults</label><input class="input" id="${n('ratioAdults')}" name="ratioAdults" type="number" inputmode="numeric" min="1" step="1" value="${esc(v.ratio.adults)}"></span>
              <span aria-hidden="true">:</span>
              <span><label class="sr-only" for="${n('ratioChildren')}">Children</label><input class="input" id="${n('ratioChildren')}" name="ratioChildren" type="number" inputmode="numeric" min="1" step="1" value="${esc(v.ratio.children)}"></span>
            </div>
            <p class="field__hint field__hint--error" data-error-for="ratioAdults" hidden></p>
            <p class="field__hint field__hint--error" data-error-for="ratioChildren" hidden></p>
          </fieldset>
        </div>
        <p class="cls-over" data-over role="status" hidden></p>
        <fieldset class="field cls-staffpick"><legend class="field__label">Staff</legend>
          <p class="field__hint">Assigning staff doesn’t mark them present. Today’s ratio uses staff attendance, and someone in two classes counts in their first class only.</p>
          <div class="cls-picks">${store.educators.map(staffChip).join('')}</div>
          <div class="field cls-leadpick" data-lead-wrap hidden><label class="field__label" for="${n('lead')}">Lead teacher</label><select class="input" id="${n('lead')}" name="lead"></select></div>
          <p class="field__hint field__hint--error" data-error-for="staffIds" hidden></p>
        </fieldset>
      </div>`,
      submit: cls ? 'Save changes' : 'Add class',
      async onSubmit(form) {
        const f = form.elements;
        const picked = [...form.querySelectorAll('[name="staff"]:checked')].map(i => i.value);
        const lead = picked.includes(f.lead.value) ? f.lead.value : picked[0];
        const input = {
          name: f.name.value, level: f.level.value, room: f.room.value, colour: form.querySelector('[name="colourTag"]:checked')?.value || '',
          ageMin: f.ageMin.value, ageMax: f.ageMax.value, mixedAge: f.mixedAge.checked, capacity: f.capacity.value,
          ratioAdults: f.ratioAdults.value, ratioChildren: f.ratioChildren.value,
          staffIds: lead ? [lead, ...picked.filter(id => id !== lead)] : [],
          confirmOverCapacity: form.dataset.confirmOver === String(f.capacity.value).trim()
        };
        const r = await store.saveClass(store.currentUser(), input, cls?.id || null);
        if (r.ok) {
          window.NexoraToast?.show(cls ? 'Changes saved successfully' : 'Class added', cls ? r.cls.name : `${r.cls.name} is ready for enrolments.`);
          onSaved?.(r.cls);
          return r;
        }
        if (r.reason === 'over-capacity') {
          form.dataset.confirmOver = String(r.capacity);
          const box = form.querySelector('[data-over]');
          box.innerHTML = `${icon('alert-triangle', 'icon--sm')}<span><b>${plural(r.enrolled, 'child is', 'children are')} enrolled</b>, more than the new capacity of ${r.capacity}. Nobody will be moved; the class will show as over capacity. Select <b>Save anyway</b> to continue.</span>`;
          box.hidden = false;
          return { keepOpen: true, submitLabel: 'Save anyway' };
        }
        if (r.reason === 'invalid') return { ok: false, errors: r.errors };
        return { ok: false, message: FAIL[r.reason] || FAIL.storage };
      }
    });
    const form = d.form;
    const leadWrap = form.querySelector('[data-lead-wrap]');
    const leadSel = form.elements.lead;
    const drawLead = () => {
      const picked = [...form.querySelectorAll('[name="staff"]:checked')].map(i => i.value);
      const current = leadSel.value || v.staffIds[0];
      leadWrap.hidden = !picked.length;
      leadSel.innerHTML = picked.map(id => `<option value="${esc(id)}"${id === current ? ' selected' : ''}>${esc(store.educators.find(e => e.id === id).name)}</option>`).join('');
      form.querySelectorAll('.cls-pick').forEach(p => p.classList.toggle('is-lead', p.querySelector('input').value === (picked.includes(leadSel.value) ? leadSel.value : picked[0])));
    };
    drawLead();
    form.addEventListener('change', e => { if (e.target.name === 'staff' || e.target === leadSel) drawLead(); });
    // Live capacity warning; a changed capacity needs a fresh "Save anyway".
    const capacity = form.elements.capacity;
    const btn = form.querySelector('[type="submit"]');
    capacity.addEventListener('input', () => {
      delete form.dataset.confirmOver;
      btn.textContent = cls ? 'Save changes' : 'Add class';
      const box = form.querySelector('[data-over]');
      const val = Number(capacity.value);
      if (cls && Number.isInteger(val) && val > 0 && val < enrolled) {
        box.innerHTML = `${icon('alert-triangle', 'icon--sm')}<span>${plural(enrolled, 'child is', 'children are')} enrolled, more than ${val}. Children won’t be moved; you’ll be asked to confirm.</span>`;
        box.hidden = false;
      } else box.hidden = true;
    });
    if (copyOf) { form.elements.name.focus(); form.elements.name.select(); }
    return d;
  }

  /* ------------------------------------------------------------------ Archive */

  function archiveFlow(user, c) {
    // Checked when the action is chosen, and again by the store when Archive is confirmed.
    const count = store.enrolledIn(c.name).length;
    if (count) { blockedDialog(c.name, count); return; }
    kids.dialog({
      label: 'Classes / Archive',
      title: 'Archive this class?',
      desc: `<b>${esc(c.name)}</b> will be removed from class lists and enrolment choices. Its past registers, invoices and history are kept.`,
      body: '',
      submit: 'Archive class',
      danger: true,
      async onSubmit() {
        const r = await store.archiveClass(store.currentUser(), c.id);
        if (r.ok) { window.NexoraToast?.show('Class archived', `${c.name} is no longer offered for enrolment.`); return r; }
        if (r.reason === 'has-children') {
          setTimeout(() => blockedDialog(c.name, r.count), reduceMotion.matches ? 0 : 200);
          return { ok: true };
        }
        return { ok: false, message: FAIL[r.reason] || FAIL.storage };
      }
    });
  }
  function blockedDialog(name, count) {
    kids.dialog({
      label: 'Classes / Archive',
      title: 'This class can’t be archived yet',
      desc: `${plural(count, 'child is', 'children are')} still enrolled in <b>${esc(name)}</b> (active or starting soon). Move them to another class or withdraw them first.`,
      body: '',
      submit: 'View children',
      async onSubmit() { location.href = routes.page('children', { cls: name }); return { ok: true }; }
    });
  }

  /* ------------------------------------------------------------------ Page */

  function listPage(main, user) {
    const manage = store.canManageClasses(user);
    let loaded = false;
    let failOnce = params.get('fail') === '1';

    document.title = 'Classes · Nexora';
    main.classList.add('kids-page');
    main.innerHTML = `
      <div class="kids">
        <header class="kids-head">
          <div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Classes <span class="kids-head__count" data-total></span></h1><p class="kids-head__sub">${user.role === 'Teacher' ? 'Your classrooms, capacity and today’s staffing.' : 'Manage classrooms, capacity and today’s staffing.'}</p></div>
          <div class="kids-head__actions">${manage ? `<button class="btn btn--primary kids-yellow" type="button" data-add>${icon('plus', 'icon--sm')}Add class</button>` : ''}</div>
        </header>
        <p class="sr-only" aria-live="polite" data-live></p>
        <section class="cls-grid" aria-labelledby="page-title" aria-busy="true" data-results>${skeleton()}</section>
      </div>`;
    const $ = s => main.querySelector(s);
    const res = $('[data-results]');
    const scoped = () => { const scope = store.classScope(user); return store.classCards().filter(c => scope.includes(c.name)); };

    function draw() {
      if (!loaded) return;
      const list = scoped();
      $('[data-total]').textContent = `(${list.length})`;
      $('[data-live]').textContent = plural(list.length, 'class', 'classes');
      res.removeAttribute('aria-busy');
      if (!list.length) {
        res.innerHTML = `<div class="kids-empty cls-empty"><span class="state-icon" aria-hidden="true">${icon('grid')}</span><h2 class="kids-empty__title">${user.role === 'Teacher' ? 'No classes assigned to you' : 'No classes yet'}</h2><p>${user.role === 'Teacher' ? 'Ask your school admin to add you to a class.' : 'Add your first class to start enrolling children and taking registers.'}</p>${manage ? `<button class="btn btn--primary kids-yellow" type="button" data-add>${icon('plus', 'icon--sm')}Add class</button>` : ''}</div>`;
        return;
      }
      res.innerHTML = list.map(c => card(c, manage)).join('');
    }

    function load() {
      loaded = false;
      res.setAttribute('aria-busy', 'true');
      res.innerHTML = skeleton();
      setTimeout(() => {
        try {
          if (failOnce) { failOnce = false; throw new Error('test failure'); }
          loaded = true;
          draw();
        } catch {
          res.removeAttribute('aria-busy');
          res.innerHTML = `<div class="kids-empty cls-empty" role="alert"><span class="state-icon state-icon--error" aria-hidden="true">${icon('alert-circle')}</span><h2 class="kids-empty__title">Something went wrong</h2><p>We couldn’t load the classes. Nothing has changed.</p><button class="btn btn--secondary" type="button" data-retry>${icon('refresh', 'icon--sm')}Try again</button></div>`;
          res.querySelector('[data-retry]').addEventListener('click', load);
        }
      }, reduceMotion.matches ? 0 : 350);
    }

    const focusCard = id => requestAnimationFrame(() => res.querySelector(`[data-menu="${CSS.escape(id)}"]`)?.focus());
    function act(action, id) {
      const c = store.classById(id);
      if (!c || c.status !== 'active') { window.NexoraToast?.show('Class not found', FAIL.missing, 'info'); return; }
      if (action === 'edit') classDialog(user, { cls: c, onSaved: s => focusCard(s.id) });
      if (action === 'duplicate') classDialog(user, { copyOf: c, onSaved: s => focusCard(s.id) });
      if (action === 'archive') archiveFlow(user, c);
    }

    let openMenu = null;
    function closeMenu(focusBtn = false) {
      if (!openMenu) return;
      openMenu.querySelector('.menu').hidden = true;
      const b = openMenu.querySelector('[data-menu]');
      b.setAttribute('aria-expanded', 'false');
      openMenu.closest('.cls-card')?.classList.remove('has-menu');
      if (focusBtn) b.focus();
      openMenu = null;
    }
    main.addEventListener('click', e => {
      if (e.target.closest('[data-add]')) { classDialog(user, { onSaved: s => focusCard(s.id) }); return; }
      const menuBtn = e.target.closest('[data-menu]');
      if (menuBtn) {
        const wrap = menuBtn.closest('.menu-wrap');
        if (openMenu === wrap) { closeMenu(); return; }
        closeMenu();
        const menu = wrap.querySelector('.menu');
        menu.hidden = false;
        menu.classList.toggle('is-up', menuBtn.getBoundingClientRect().bottom + 180 > innerHeight);
        menuBtn.setAttribute('aria-expanded', 'true');
        wrap.closest('.cls-card').classList.add('has-menu');
        openMenu = wrap;
        menu.querySelector('button').focus();
        return;
      }
      const item = e.target.closest('[data-act]');
      if (item) {
        const id = item.dataset.id || item.closest('.menu-wrap').querySelector('[data-menu]').dataset.menu;
        closeMenu(true);
        act(item.dataset.act, id);
      }
    });
    main.addEventListener('keydown', e => {
      if (!openMenu) return;
      const items = [...openMenu.querySelectorAll('.menu button')];
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); }
      if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
      if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
      if (e.key === 'Tab') closeMenu();
    });
    document.addEventListener('click', e => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); });

    let queued = false;
    store.subscribe(({ key }) => {
      if (!loaded || (key && !/^nexora-(class|children|register|staff-attendance|classes)/.test(key))) return;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const had = document.activeElement?.dataset?.menu;
        draw();
        if (had) res.querySelector(`[data-menu="${CSS.escape(had)}"]`)?.focus();
      });
    });
    load();
    return true;
  }

  function render(key, main, user) {
    if (key === 'classes') return listPage(main, user);
    return false;
  }

  window.NexoraClasses = { render };
})();
