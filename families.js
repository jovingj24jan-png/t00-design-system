/* S15 families (app.html?page=families) and S16 family detail (app.html?page=family&id=<familyId>).
   NexoraFamilies.render(key, main, user) → true when handled. Data: store.listFamilies() — households,
   guardians, children and parent-app status resolved from the shared records, never copied.
   Test hook: ?fail=1 makes the first load of S15 fail so the error state can be checked. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const kids = window.NexoraChildren;
  const { routes } = store;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const params = new URLSearchParams(location.search);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const money = n => `₹${Math.round(n).toLocaleString('en-IN')}`;
  const when = iso => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const initials = n => String(n || '').trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
  const STATUS_BADGE = { active: 'badge--success', invited: 'badge--info', 'not-invited': '' };
  const STATUS_ICON = { active: 'check-circle', invited: 'mail', 'not-invited': 'info' };
  const RELATIONS = ['Mother', 'Father', 'Guardian', 'Grandparent', 'Aunt', 'Uncle', 'Carer', 'Other'];
  const FLASH_KEY = 'nexora-children-flash';

  const statusBadge = s => `<span class="badge ${STATUS_BADGE[s]} fam-status">${icon(STATUS_ICON[s], 'icon--sm')}${esc(store.APP_STATUS[s])}</span>`;
  // Avatar stacks: up to `max` circles, then +N. The list is announced as text for screen readers.
  function stack(people, { max = 3, kind = 'child' } = {}) {
    if (!people.length) return '<span class="cp-muted">None linked</span>';
    const shown = people.slice(0, max);
    const more = people.length - shown.length;
    return `<span class="fam-stack" role="img" aria-label="${esc(people.map(p => p.name).join(', '))}">${shown.map(p => p.photo
      ? `<img class="fam-av" src="${esc(p.photo)}" alt="" title="${esc(p.name)}">`
      : `<span class="fam-av fam-av--${kind}" title="${esc(p.name)}" aria-hidden="true">${esc(initials(p.name))}</span>`).join('')}${more > 0 ? `<span class="fam-av fam-av--more" aria-hidden="true">+${more}</span>` : ''}</span>`;
  }
  const flash = (title, text) => { try { sessionStorage.setItem(FLASH_KEY, JSON.stringify({ title, text })); } catch { /* optional */ } };
  const takeFlash = () => { try { const f = JSON.parse(sessionStorage.getItem(FLASH_KEY)); sessionStorage.removeItem(FLASH_KEY); if (f) window.NexoraToast?.show(f.title, f.text); } catch { /* none */ } };
  const canSeeBalance = user => store.canAccess(user, 'fees') && store.isEntitled('fees');
  const FAIL = { forbidden: 'Your role can’t change families. Nothing was saved.', storage: 'This couldn’t be saved on this device. Nothing was changed.', none: 'Every guardian in this selection already has an active account or no contact route. No invites were sent.' };

  /* ------------------------------------------------------------------ Shared dialogs */

  function inviteDialog(user, familyIds, onDone) {
    const p = store.invitePreview(familyIds);
    const famCount = p.eligibleFamilies.length;
    kids.dialog({
      label: 'Families / Parent app',
      title: familyIds.length === 1 ? `Invite the ${p.families[0]?.name || 'family'} to the parent app?` : `Invite ${famCount} ${famCount === 1 ? 'family' : 'families'} to the parent app?`,
      desc: p.recipients.length ? `Invitations go to <b>${p.recipients.length}</b> guardian ${p.recipients.length === 1 ? 'account' : 'accounts'}. Guardians linked to more than one selected family get one invite.` : 'Nobody in this selection can be invited.',
      body: `${p.recipients.length ? `<ul class="fam-recips">${p.recipients.map(r => `<li>${esc(r.name)}${r.resend ? ' <span class="cp-muted">(invite resent)</span>' : ''}</li>`).join('')}</ul>` : ''}
        ${p.skipped.length ? `<p class="cp-muted">Not invited: ${p.skipped.map(s => `${esc(s.name)} (${esc(s.reason.toLowerCase())})`).join(', ')}.</p>` : ''}
        <p class="wiz-note">${icon('info', 'icon--sm')}Prototype: invites are recorded here, not delivered by email or SMS.</p>`,
      submit: p.recipients.length ? 'Send invites' : 'Close',
      async onSubmit() {
        if (!p.recipients.length) return { ok: true };
        const r = await store.inviteFamilies(store.currentUser(), familyIds);
        if (!r.ok) return { ok: false, message: FAIL[r.reason] || FAIL.storage };
        const n = r.invitedFamilies.length;
        const failed = r.results.filter(x => !x.ok).length;
        window.NexoraToast?.show(n === 1 && familyIds.length === 1 ? 'Invite sent to the family' : `Invites sent to ${n} ${n === 1 ? 'family' : 'families'}`, `${r.results.filter(x => x.ok).length} guardian ${r.results.filter(x => x.ok).length === 1 ? 'account' : 'accounts'} invited${failed ? ` · ${failed} failed` : ''}. Prototype: not delivered.`);
        onDone?.(r);
        return { ok: true };
      }
    });
  }

  function editDialog(user, fam) {
    kids.dialog({
      label: 'Families / Edit', title: `Edit ${fam.name}`, desc: 'Guardians and children are edited on each child’s profile, so every page stays in step.',
      body: `${kids.field('kd-name', 'Family name', `<input class="input" id="kd-name" name="name" value="${esc(fam.name)}" required>`, { required: true })}
        ${kids.field('kd-primaryGuardianId', 'Primary contact', `<select class="input" id="kd-primaryGuardianId" name="primaryGuardianId">${fam.guardians.map(g => `<option value="${esc(g.id)}"${g.id === fam.primary?.id ? ' selected' : ''}>${esc(g.name)} · ${esc(g.phone || 'no phone')}</option>`).join('')}</select>`)}
        ${kids.field('kd-notes', 'Notes', `<textarea class="input" id="kd-notes" name="notes" rows="3">${esc(fam.notes || '')}</textarea>`)}`,
      submit: 'Save family',
      async onSubmit(form) {
        const r = await store.saveFamily(store.currentUser(), { name: form.elements.name.value, primaryGuardianId: form.elements.primaryGuardianId.value, notes: form.elements.notes.value }, fam.id);
        if (r.ok) window.NexoraToast?.show('Changes saved successfully', r.family.name);
        return r.ok ? r : { ...r, message: FAIL[r.reason] };
      }
    });
  }

  function addDialog(user) {
    const guardians = store.getGuardians();
    const children = store.getChildren().filter(c => ['active', 'starting'].includes(c.status));
    const d = kids.dialog({
      label: 'Families / Add', title: 'Add family', desc: 'Link people already on record, or add new guardians. Existing records are reused, never copied.',
      body: `${kids.field('kd-name', 'Family name', '<input class="input" id="kd-name" name="name" required placeholder="e.g. Raman family">', { required: true })}
        <fieldset class="fam-fs"><legend class="field__label">Existing guardians</legend>
          <div class="fam-pick"><label class="sr-only" for="fam-gq">Find a guardian</label><input class="input" id="fam-gq" list="fam-glist" placeholder="Search by name or phone" autocomplete="off"><datalist id="fam-glist">${guardians.map(g => `<option value="${esc(`${g.name} · ${g.phone}`)}"></option>`).join('')}</datalist><button class="btn btn--sm btn--secondary" type="button" data-pick-g>Link</button></div>
          <ul class="fam-picked" data-picked-g></ul><p class="field__hint field__hint--error" data-error-for="guardians" hidden></p></fieldset>
        <fieldset class="fam-fs"><legend class="field__label">New guardians</legend><div data-new-g></div><button class="btn btn--sm btn--secondary" type="button" data-add-g>${icon('plus', 'icon--sm')}Add new guardian</button></fieldset>
        <fieldset class="fam-fs"><legend class="field__label">Children <span class="field__extra">Optional</span></legend>
          <div class="fam-pick"><label class="sr-only" for="fam-cq">Find a child</label><input class="input" id="fam-cq" list="fam-clist" placeholder="Search by child name" autocomplete="off"><datalist id="fam-clist">${children.map(c => `<option value="${esc(`${store.childName(c)} · ${c.cls}`)}"></option>`).join('')}</datalist><button class="btn btn--sm btn--secondary" type="button" data-pick-c>Link</button></div>
          <ul class="fam-picked" data-picked-c></ul></fieldset>`,
      submit: 'Create family',
      async onSubmit(form) {
        const newGuardians = [...form.querySelectorAll('[data-ng]')].map(row => ({ name: row.querySelector('[data-k="name"]').value, phone: row.querySelector('[data-k="phone"]').value, email: row.querySelector('[data-k="email"]').value, relation: row.querySelector('[data-k="relation"]').value }));
        const r = await store.saveFamily(store.currentUser(), { name: form.elements.name.value, existingGuardianIds: pickedG, newGuardians, childIds: pickedC });
        if (r.ok) { window.NexoraToast?.show('Family added', r.family.name); return r; }
        return { ...r, message: r.errors ? null : FAIL[r.reason] };
      }
    });
    d.el.classList.add('cp-modal');
    const pickedG = [];
    const pickedC = [];
    const drawPicked = () => {
      d.form.querySelector('[data-picked-g]').innerHTML = pickedG.map(id => { const g = guardians.find(x => x.id === id); return `<li><span class="kids-chip">${esc(g.name)} · ${esc(g.phone)}<button type="button" aria-label="Remove ${esc(g.name)}" data-unpick-g="${esc(id)}">${icon('x', 'icon--sm')}</button></span></li>`; }).join('');
      d.form.querySelector('[data-picked-c]').innerHTML = pickedC.map(id => { const c = children.find(x => x.id === id); return `<li><span class="kids-chip">${esc(store.childName(c))} · ${esc(c.cls)}<button type="button" aria-label="Remove ${esc(store.childName(c))}" data-unpick-c="${esc(id)}">${icon('x', 'icon--sm')}</button></span></li>`; }).join('');
    };
    let ng = 0;
    const addNew = () => {
      const i = ng++;
      d.form.querySelector('[data-new-g]').insertAdjacentHTML('beforeend', `<fieldset class="cp-row" data-ng><legend class="sr-only">New guardian</legend>
        <div class="field"><label class="field__label" for="ng-${i}-n">Name *</label><input class="input" id="ng-${i}-n" data-k="name" name="newGuardians.${i}.name"><p class="field__hint field__hint--error" data-error-for="newGuardians.${i}.name" hidden></p></div>
        <div class="field"><label class="field__label" for="ng-${i}-r">Relationship *</label><select class="input" id="ng-${i}-r" data-k="relation" name="newGuardians.${i}.relation"><option value="">Choose</option>${RELATIONS.map(r => `<option>${r}</option>`).join('')}</select><p class="field__hint field__hint--error" data-error-for="newGuardians.${i}.relation" hidden></p></div>
        <div class="field"><label class="field__label" for="ng-${i}-p">Phone *</label><input class="input" type="tel" id="ng-${i}-p" data-k="phone" name="newGuardians.${i}.phone"><p class="field__hint field__hint--error" data-error-for="newGuardians.${i}.phone" hidden></p></div>
        <div class="field"><label class="field__label" for="ng-${i}-e">Email</label><input class="input" type="email" id="ng-${i}-e" data-k="email" name="newGuardians.${i}.email"><p class="field__hint field__hint--error" data-error-for="newGuardians.${i}.email" hidden></p></div>
        <button class="btn btn--sm btn--ghost cp-row__remove" type="button" data-rm-ng>${icon('x', 'icon--sm')}Remove</button></fieldset>`);
    };
    d.form.addEventListener('click', e => {
      if (e.target.closest('[data-add-g]')) { addNew(); return; }
      if (e.target.closest('[data-rm-ng]')) { e.target.closest('[data-ng]').remove(); return; }
      const pick = (inputSel, list, findFn, arr) => {
        const v = d.form.querySelector(inputSel).value.trim();
        const hit = list.find(x => findFn(x) === v) || list.find(x => findFn(x).toLowerCase().startsWith(v.toLowerCase()));
        if (hit && !arr.includes(hit.id)) arr.push(hit.id);
        d.form.querySelector(inputSel).value = '';
        drawPicked();
      };
      if (e.target.closest('[data-pick-g]')) pick('#fam-gq', guardians, g => `${g.name} · ${g.phone}`, pickedG);
      if (e.target.closest('[data-pick-c]')) pick('#fam-cq', children, c => `${store.childName(c)} · ${c.cls}`, pickedC);
      const ug = e.target.closest('[data-unpick-g]');
      if (ug) { pickedG.splice(pickedG.indexOf(ug.dataset.unpickG), 1); drawPicked(); }
      const uc = e.target.closest('[data-unpick-c]');
      if (uc) { pickedC.splice(pickedC.indexOf(uc.dataset.unpickC), 1); drawPicked(); }
    });
  }

  // Side-by-side comparison with field-level choices, then an explicit confirmation step.
  function mergeDialog(user, ids, onDone) {
    const [A, B] = ids.map(id => store.familyById(id));
    if (!A || !B || A.merged || B.merged) { window.NexoraToast?.show('Can’t merge', 'One of these families no longer exists. Refresh and try again.', 'info'); return; }
    const billOk = canSeeBalance(user);
    const col = (f, tag) => `<div class="fam-col"><p class="fam-col__tag">Family ${tag}</p><h3 class="fam-col__name">${esc(f.name)}</h3>
      <dl class="cp-dl">
        <div><dt>Guardians</dt><dd>${f.guardians.map(g => `${esc(g.name)} <span class="cp-muted">(${esc(store.APP_STATUS[g.account.status])})</span>`).join('<br>') || '—'}</dd></div>
        <div><dt>Children</dt><dd>${f.children.map(c => `${esc(c.name)} <span class="cp-muted">${esc(c.cls)}</span>`).join('<br>') || '—'}</dd></div>
        <div><dt>Primary contact</dt><dd>${esc(f.primary?.name || '—')} ${f.primary?.phone ? `· ${esc(f.primary.phone)}` : ''}</dd></div>
        <div><dt>Households</dt><dd>${f.households.map(h => esc(h.label)).join(', ')}</dd></div>
        <div><dt>Parent app</dt><dd>${statusBadge(f.appStatus)}</dd></div>
        ${billOk ? `<div><dt>Billing</dt><dd>${f.invoiceIds.length} invoice${f.invoiceIds.length === 1 ? '' : 's'} · ${money(f.balance)} due</dd></div>` : ''}
      </dl></div>`;
    const allGuardians = [...A.guardians, ...B.guardians.filter(g => !A.guardians.some(x => x.id === g.id))];
    const d = kids.dialog({
      label: 'Families / Merge', title: 'Merge two families',
      desc: 'Guardians and children are combined by record ID — people who only share a name stay separate. Nothing is deleted.',
      body: `<div class="fam-compare">${col(A, 'A')}${col(B, 'B')}</div>
        <div class="fam-quick"><button class="btn btn--sm btn--secondary" type="button" data-keep="A">Keep details from Family A</button><button class="btn btn--sm btn--secondary" type="button" data-keep="B">Keep details from Family B</button></div>
        <fieldset class="wiz-radios"><legend class="field__label">Family that remains *</legend><div class="wiz-radios__opts">
          <label class="radio"><input type="radio" name="keep" value="${esc(A.id)}" checked>${esc(A.name)} (A)</label><label class="radio"><input type="radio" name="keep" value="${esc(B.id)}">${esc(B.name)} (B)</label></div></fieldset>
        <fieldset class="wiz-radios"><legend class="field__label">Family name *</legend><div class="wiz-radios__opts">
          <label class="radio"><input type="radio" name="name" value="A" checked>${esc(A.name)}</label><label class="radio"><input type="radio" name="name" value="B">${esc(B.name)}</label></div></fieldset>
        ${kids.field('kd-primary', 'Primary contact', `<select class="input" id="kd-primary" name="primary">${allGuardians.map(g => `<option value="${esc(g.id)}"${g.id === A.primary?.id ? ' selected' : ''}>${esc(g.name)} · ${esc(g.phone || 'no phone')}</option>`).join('')}</select>`, { required: true })}
        <div class="fam-confirm" data-confirm hidden></div>`,
      submit: 'Review merge',
      async onSubmit(form) {
        const keepId = form.elements.keep.value;
        const mergeId = keepId === A.id ? B.id : A.id;
        const name = form.elements.name.value === 'A' ? A.name : B.name;
        const primaryGuardianId = form.elements.primary.value;
        const box = form.querySelector('[data-confirm]');
        const btn = form.querySelector('[type=submit]');
        // First submit shows the summary; the second commits.
        if (box.hidden) {
          const keep = keepId === A.id ? A : B;
          const gone = keepId === A.id ? B : A;
          const kidsCount = new Set([...A.children, ...B.children].map(c => c.id)).size;
          const gCount = allGuardians.length;
          box.hidden = false;
          box.innerHTML = `<div class="wiz-alert wiz-alert--warn">${icon('alert-triangle')}<div><p><b>${esc(keep.name)}</b> (${esc(keep.id)}) remains, renamed “${esc(name)}”. <b>${esc(gone.name)}</b> (${esc(gone.id)}) is merged into it and stops appearing as its own family.</p><p>Combined: ${gCount} guardian${gCount === 1 ? '' : 's'}, ${kidsCount} child${kidsCount === 1 ? '' : 'ren'}, ${keep.households.length + gone.households.length} household${keep.households.length + gone.households.length === 1 ? '' : 's'} (each home stays separate). Primary contact: ${esc(allGuardians.find(g => g.id === primaryGuardianId)?.name)}. Invitation and billing history are kept.</p></div></div>`;
          btn.classList.add('btn--danger');
          btn.classList.remove('btn--primary');
          box.scrollIntoView({ block: 'nearest' });
          return { ok: false, keepOpen: true, submitLabel: 'Merge families' };
        }
        const r = await store.mergeFamilies(store.currentUser(), { keepId, mergeId, name, primaryGuardianId });
        if (!r.ok) return { ok: false, message: r.message || FAIL[r.reason] || FAIL.storage };
        window.NexoraToast?.show('Families merged', `${r.merged.name} is now part of ${r.family.name}.`);
        onDone?.(r);
        return r;
      }
    });
    d.el.classList.add('cp-modal', 'fam-merge');
    d.form.addEventListener('click', e => {
      const k = e.target.closest('[data-keep]');
      if (!k) return;
      const f = k.dataset.keep === 'A' ? A : B;
      d.form.querySelector(`[name="keep"][value="${CSS.escape(f.id)}"]`).checked = true;
      d.form.querySelector(`[name="name"][value="${k.dataset.keep}"]`).checked = true;
      if (f.primary) d.form.elements.primary.value = f.primary.id;
    });
    // Any change after the summary needs a fresh review.
    d.form.addEventListener('change', () => {
      const box = d.form.querySelector('[data-confirm]');
      if (box.hidden) return;
      box.hidden = true;
      const btn = d.form.querySelector('[type=submit]');
      btn.textContent = 'Review merge';
      btn.classList.remove('btn--danger');
      btn.classList.add('btn--primary');
    });
  }

  /* ------------------------------------------------------------------ S15 list */

  function listPage(main, user) {
    const manage = store.canManageFamilies(user);
    const billOk = canSeeBalance(user);
    const scope = store.classScope(user);
    const state = { q: '', cls: new Set(), app: new Set(), bal: '', selected: new Set() };
    let loaded = false;
    let failOnce = params.get('fail') === '1';

    // Teachers see families with a child in their classes.
    const all = () => store.listFamilies().filter(f => user.role !== 'Teacher' || f.children.some(c => scope.includes(c.cls)));
    const match = f => {
      const q = state.q.trim().toLowerCase();
      if (q && ![f.name, ...f.guardians.map(g => g.name), ...f.children.map(c => c.name)].some(s => s.toLowerCase().includes(q))) return false;
      if (state.cls.size && !f.children.some(c => state.cls.has(c.cls))) return false;
      if (state.app.size && !state.app.has(f.appStatus)) return false;
      if (billOk && state.bal === 'due' && !(f.balance > 0)) return false;
      if (billOk && state.bal === 'clear' && f.balance > 0) return false;
      return true;
    };

    document.title = 'Families · Nexora';
    main.classList.add('kids-page');
    main.innerHTML = `
      <div class="kids">
        <header class="kids-head">
          <div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Families <span class="kids-head__count" data-total></span></h1><p class="kids-head__sub" data-summary aria-live="polite"></p></div>
          <div class="kids-head__actions">${manage ? `<button class="btn btn--primary kids-yellow" type="button" data-add>${icon('plus', 'icon--sm')}Add family</button>` : ''}</div>
        </header>
        <div class="kids-toolbar">
          <div class="input-wrap input-wrap--lead kids-search">${icon('search')}<label class="sr-only" for="fam-q">Search families</label><input class="input" id="fam-q" type="search" placeholder="Search by family, guardian or child name" data-q></div>
          <div class="field fam-filter"><label class="sr-only" for="fam-cls">Class of any child</label><select class="input" id="fam-cls" data-f="cls"><option value="">Class: any</option>${scope.map(c => `<option>${esc(c)}</option>`).join('')}</select></div>
          <div class="field fam-filter"><label class="sr-only" for="fam-app">Parent-app status</label><select class="input" id="fam-app" data-f="app"><option value="">Parent app: all</option>${Object.entries(store.APP_STATUS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
          ${billOk ? `<div class="field fam-filter"><label class="sr-only" for="fam-bal">Has balance</label><select class="input" id="fam-bal" data-f="bal"><option value="">Balance: all</option><option value="due">Has outstanding balance</option><option value="clear">No outstanding balance</option></select></div>` : ''}
        </div>
        <div class="kids-chips" data-chips hidden></div>
        <div class="kids-bulk" data-bulk hidden>
          <span class="kids-bulk__count" aria-live="polite"><b data-bulk-n>0</b> selected</span>
          <div class="kids-bulk__actions">
            <button class="btn btn--sm btn--secondary" type="button" data-bulk-invite>${icon('mail', 'icon--sm')}Invite to parent app</button>
            <button class="btn btn--sm btn--secondary" type="button" data-bulk-merge disabled aria-describedby="fam-merge-hint">${icon('users', 'icon--sm')}Merge families</button>
            <span class="sr-only" id="fam-merge-hint">Select exactly two families to merge.</span>
            <button class="btn btn--sm btn--ghost" type="button" data-bulk-clear>Clear selection</button>
          </div>
        </div>
        <section class="kids-results" aria-labelledby="page-title" data-results aria-busy="true"></section>
      </div>`;
    const $ = s => main.querySelector(s);
    const res = $('[data-results]');

    function rowMenu(f) {
      return `<div class="menu-wrap"><button class="btn btn--icon-ghost" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(f.name)}" data-menu="${esc(f.id)}">${icon('more-v')}</button>
        <div class="menu" role="menu" hidden>
          <button type="button" role="menuitem" data-act="view">${icon('eye', 'icon--sm')}View family</button>
          ${manage ? `<button type="button" role="menuitem" data-act="edit">${icon('pencil', 'icon--sm')}Edit family</button><button type="button" role="menuitem" data-act="invite">${icon('mail', 'icon--sm')}Invite to parent app</button><button type="button" role="menuitem" data-act="merge">${icon('users', 'icon--sm')}Merge with…</button>` : ''}
        </div></div>`;
    }

    function draw() {
      if (!loaded) return;
      const families = all();
      const list = families.filter(match).sort((a, b) => a.name.localeCompare(b.name));
      const visible = new Set(list.map(f => f.id));
      [...state.selected].forEach(id => { if (!visible.has(id)) state.selected.delete(id); });
      $('[data-total]').textContent = `(${families.length})`;
      const filtered = state.q.trim() || state.cls.size || state.app.size || state.bal;
      $('[data-summary]').textContent = filtered ? `${list.length} of ${families.length} ${families.length === 1 ? 'family' : 'families'} match` : `${families.length} ${families.length === 1 ? 'family' : 'families'}${billOk ? '' : ''}`;
      const chips = [...[...state.cls].map(v => ['cls', v, `Class: ${v}`]), ...[...state.app].map(v => ['app', v, `Parent app: ${store.APP_STATUS[v]}`]), ...(state.bal ? [['bal', state.bal, state.bal === 'due' ? 'Has outstanding balance' : 'No outstanding balance']] : [])];
      $('[data-chips]').hidden = !chips.length;
      $('[data-chips]').innerHTML = chips.length ? `<ul class="kids-chips__list" aria-label="Active filters">${chips.map(([k, v, t]) => `<li><span class="kids-chip">${esc(t)}<button type="button" aria-label="Remove filter ${esc(t)}" data-chip="${k}" data-value="${esc(v)}">${icon('x', 'icon--sm')}</button></span></li>`).join('')}</ul><button class="btn btn--sm btn--tertiary" type="button" data-clear-all>Clear all</button>` : '';
      res.removeAttribute('aria-busy');
      if (!families.length) { res.innerHTML = `<div class="kids-empty"><h2 class="kids-empty__title">No families yet</h2><p>Families appear when children are enrolled, or when you add one.</p>${manage ? `<button class="btn btn--primary" type="button" data-add>${icon('plus', 'icon--sm')}Add family</button>` : ''}</div>`; renderBulk(); return; }
      if (!list.length) { res.innerHTML = '<div class="kids-empty"><h2 class="kids-empty__title">No families match these filters</h2><p>Try another class or status, or clear the filters.</p><button class="btn btn--secondary" type="button" data-clear-filters>Clear filters</button></div>'; renderBulk(); return; }
      const allSel = list.every(f => state.selected.has(f.id));
      const someSel = list.some(f => state.selected.has(f.id));
      res.innerHTML = `<div class="table-shell fam-table"><table class="data-table" aria-label="Families"><thead><tr>
          ${manage ? `<th class="cell-check" scope="col"><label class="check"><input type="checkbox" data-select-all aria-label="Select all ${list.length} families shown"${allSel ? ' checked' : ''}${!allSel && someSel ? ' data-ind' : ''}></label></th>` : ''}
          <th scope="col">Family</th><th scope="col">Guardians</th><th scope="col">Children</th><th scope="col">Primary contact</th><th scope="col">Parent app</th>${billOk ? '<th scope="col">Balance</th>' : ''}<th class="cell-action" scope="col"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${list.map(f => `<tr class="fam-row${state.selected.has(f.id) ? ' is-selected' : ''}" data-id="${esc(f.id)}">
          ${manage ? `<td class="cell-check"><label class="check"><input type="checkbox" data-select="${esc(f.id)}" aria-label="Select ${esc(f.name)}"${state.selected.has(f.id) ? ' checked' : ''}></label></td>` : ''}
          <td class="cell-student"><a class="kid-row__name" href="${routes.page('family', { id: f.id })}">${esc(f.name)}</a>${f.households.length > 1 ? `<small class="fam-sub">${f.households.length} homes</small>` : ''}</td>
          <td data-label="Guardians"><span class="fam-people">${stack(f.guardians, { max: 2, kind: 'guardian' })}<span class="fam-names">${esc(f.guardians.slice(0, 2).map(g => g.name).join(', '))}${f.guardians.length > 2 ? ` +${f.guardians.length - 2}` : ''}</span></span></td>
          <td data-label="Children"><span class="fam-people">${stack(f.children, { max: 3 })}<span class="fam-names fam-names--kids">${esc(f.children.map(c => c.firstName).join(', '))}</span></span></td>
          <td data-label="Primary contact">${f.primary?.phone ? `<a href="tel:${esc(f.primary.phone.replace(/[^\d+]/g, ''))}">${esc(f.primary.phone)}</a><small class="fam-sub">${esc(f.primary.name)}</small>` : '<span class="cp-muted">Not provided</span>'}</td>
          <td data-label="Parent app">${statusBadge(f.appStatus)}</td>
          ${billOk ? `<td data-label="Balance">${f.balance > 0 ? `<span class="fam-due">${money(f.balance)}</span>` : '<span class="badge badge--success">Settled</span>'}</td>` : ''}
          <td class="cell-action">${rowMenu(f)}</td></tr>`).join('')}</tbody></table></div>`;
      res.querySelectorAll('[data-ind]').forEach(i => { i.indeterminate = true; });
      renderBulk();
    }
    function renderBulk() {
      const n = state.selected.size;
      $('[data-bulk]').hidden = !n;
      $('[data-bulk-n]').textContent = n;
      $('[data-bulk-merge]').disabled = n !== 2;
    }

    const toolbar = main.querySelector('.kids-toolbar');
    toolbar.addEventListener('input', e => { if (e.target.matches('[data-q]')) { state.q = e.target.value; draw(); } });
    toolbar.addEventListener('change', e => {
      const f = e.target.dataset.f;
      if (!f) return;
      if (f === 'bal') state.bal = e.target.value;
      else if (e.target.value) state[f].add(e.target.value);
      if (f !== 'bal') e.target.value = '';
      draw();
    });
    const clearFilters = () => { state.cls.clear(); state.app.clear(); state.bal = ''; const b = $('[data-f="bal"]'); if (b) b.value = ''; draw(); };
    main.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('[data-add]')) { addDialog(user); return; }
      const chip = t.closest('[data-chip]');
      if (chip) { const k = chip.dataset.chip; if (k === 'bal') { state.bal = ''; $('[data-f="bal"]').value = ''; } else state[k].delete(chip.dataset.value); draw(); $('[data-q]').focus(); return; }
      if (t.closest('[data-clear-all]') || t.closest('[data-clear-filters]')) { if (t.closest('[data-clear-filters]')) { state.q = ''; $('[data-q]').value = ''; } clearFilters(); return; }
      if (t.closest('[data-bulk-clear]')) { state.selected.clear(); draw(); return; }
      if (t.closest('[data-bulk-invite]')) { inviteDialog(user, [...state.selected], () => { state.selected.clear(); draw(); }); return; }
      if (t.closest('[data-bulk-merge]')) { if (state.selected.size === 2) mergeDialog(user, [...state.selected], () => { state.selected.clear(); draw(); }); return; }
    });

    let openMenu = null;
    const closeMenu = (focus = false) => { if (!openMenu) return; openMenu.querySelector('.menu').hidden = true; const b = openMenu.querySelector('[data-menu]'); b.setAttribute('aria-expanded', 'false'); if (focus) b.focus(); openMenu.closest('tr')?.classList.remove('has-menu'); openMenu = null; };
    res.addEventListener('change', e => {
      const one = e.target.closest('[data-select]');
      if (one) { one.checked ? state.selected.add(one.dataset.select) : state.selected.delete(one.dataset.select); one.closest('tr').classList.toggle('is-selected', one.checked); const visible = [...res.querySelectorAll('[data-select]')]; const all = res.querySelector('[data-select-all]'); const n = visible.filter(i => i.checked).length; all.checked = n === visible.length; all.indeterminate = n > 0 && n < visible.length; renderBulk(); return; }
      const allBox = e.target.closest('[data-select-all]');
      if (allBox) { res.querySelectorAll('[data-select]').forEach(i => (allBox.checked ? state.selected.add(i.dataset.select) : state.selected.delete(i.dataset.select))); draw(); res.querySelector('[data-select-all]')?.focus(); }
    });
    res.addEventListener('click', e => {
      const t = e.target;
      const mb = t.closest('[data-menu]');
      if (mb) {
        const wrap = mb.closest('.menu-wrap');
        if (openMenu === wrap) { closeMenu(); return; }
        closeMenu();
        const menu = wrap.querySelector('.menu');
        menu.hidden = false;
        menu.classList.toggle('is-up', mb.getBoundingClientRect().bottom + 200 > innerHeight);
        mb.setAttribute('aria-expanded', 'true');
        wrap.closest('tr')?.classList.add('has-menu');
        openMenu = wrap;
        menu.querySelector('button').focus();
        return;
      }
      const act = t.closest('[data-act]');
      if (act) {
        const fid = act.closest('.menu-wrap').querySelector('[data-menu]').dataset.menu;
        closeMenu();
        const fam = store.familyById(fid);
        if (act.dataset.act === 'view') location.href = routes.page('family', { id: fid });
        if (act.dataset.act === 'edit') editDialog(user, fam);
        if (act.dataset.act === 'invite') inviteDialog(user, [fid]);
        if (act.dataset.act === 'merge') {
          // Merge needs exactly two: this family plus one other selected family.
          const others = [...state.selected].filter(id => id !== fid);
          if (others.length === 1) mergeDialog(user, [fid, others[0]], () => { state.selected.clear(); draw(); });
          else { state.selected = new Set([fid]); draw(); window.NexoraToast?.show('Choose the second family', 'Tick one more family, then use Merge families in the selection bar.', 'info'); }
        }
        return;
      }
      // The row opens S16 unless the click was on a control.
      const row = t.closest('.fam-row');
      if (row && !t.closest('a, button, input, label, .menu')) location.href = routes.page('family', { id: row.dataset.id });
    });
    res.addEventListener('keydown', e => {
      if (!openMenu) return;
      const items = [...openMenu.querySelectorAll('.menu button')];
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); }
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
      if (e.key === 'Tab') closeMenu();
    });
    document.addEventListener('click', e => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); });

    function load() {
      res.setAttribute('aria-busy', 'true');
      res.innerHTML = `<p class="sr-only">Loading families…</p><div class="table-shell" aria-hidden="true">${Array.from({ length: 6 }, () => '<div class="sk-row fam-sk"><span class="skeleton sk-circle"></span><span class="sk-stack"><span class="skeleton sk-line w-40"></span><span class="skeleton sk-line w-60"></span></span></div>').join('')}</div>`;
      setTimeout(() => {
        try {
          if (failOnce) { failOnce = false; throw new Error('demo'); }
          store.listFamilies();
          loaded = true;
          draw();
        } catch {
          res.removeAttribute('aria-busy');
          res.innerHTML = `<div class="kids-empty" role="alert"><span class="state-icon state-icon--error" aria-hidden="true">${icon('alert-circle')}</span><h2 class="kids-empty__title">Something went wrong</h2><p>We couldn’t load the families. Nothing has changed.</p><button class="btn btn--secondary" type="button" data-retry>${icon('refresh', 'icon--sm')}Try again</button></div>`;
          res.querySelector('[data-retry]').addEventListener('click', load);
        }
      }, reduceMotion.matches ? 0 : 350);
    }
    let queued = false;
    store.subscribe(({ key }) => {
      if (!loaded || (key && !/^nexora-(families|households|guardians|children|parent-app|invoices|payments|school-plan)/.test(key))) return;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; draw(); });
    });
    takeFlash();
    load();
    return true;
  }

  /* ------------------------------------------------------------------ S16 family detail */

  function detailPage(main, user) {
    const id = params.get('id');
    const manage = store.canManageFamilies(user);
    const billOk = canSeeBalance(user);
    const scope = store.classScope(user);
    const draw = () => {
      const f = id ? store.familyById(id) : null;
      if (f?.merged) {
        main.innerHTML = `<article class="panel record"><div class="kids-empty"><h1 class="kids-empty__title">${esc(f.name)} was merged</h1><p>This family is now part of another family record.</p><a class="btn btn--primary" href="${routes.page('family', { id: f.mergedInto })}">Open the merged family</a></div></article>`;
        return;
      }
      if (!f || (user.role === 'Teacher' && !f.children.some(c => scope.includes(c.cls)))) {
        main.innerHTML = `<article class="panel record"><div class="kids-empty"><h1 class="kids-empty__title" id="page-title" tabindex="-1">We couldn’t find that family</h1><p>It may have been removed, or it isn’t one of your classes’ families.</p><a class="btn btn--primary" href="${routes.page('families')}">All families</a></div></article>`;
        return;
      }
      const app = store.getParentApp();
      const history = app.invitations.filter(inv => inv.familyIds.includes(f.id) || (f.mergedFrom || []).some(m => inv.familyIds.includes(m)));
      const lines = billOk ? store.feeLedger().filter(l => f.invoiceIds.includes(l.id)) : [];
      document.title = `${f.name} · Nexora`;
      main.innerHTML = `<div class="cp">
        <nav class="kids-crumbs" aria-label="Breadcrumb"><a href="${routes.page('families')}">Families</a> / <span aria-current="page">${esc(f.name)}</span></nav>
        <header class="panel cp-head fam-head">
          <div class="cp-head__id"><span class="fam-av fam-av--lg" aria-hidden="true">${esc(initials(f.name))}</span><div class="cp-head__names"><h1 class="cp-head__name" id="page-title" tabindex="-1">${esc(f.name)}</h1><p class="cp-head__class">${statusBadge(f.appStatus)}<span class="cp-muted">${f.households.length} ${f.households.length === 1 ? 'home' : 'homes'} · ${f.guardians.length} guardian${f.guardians.length === 1 ? '' : 's'} · ${f.children.length} child${f.children.length === 1 ? '' : 'ren'}</span></p></div></div>
          <div class="cp-head__actions">${manage ? `<button class="btn btn--secondary" type="button" data-invite>${icon('mail', 'icon--sm')}Invite to parent app</button><button class="btn btn--primary kids-yellow" type="button" data-edit>${icon('pencil', 'icon--sm')}Edit family</button>` : ''}</div>
        </header>
        <div class="cp-grid">
          ${f.households.map((h, i) => `<section class="cp-card" aria-labelledby="fh-${i}"><header class="cp-card__head"><h2 class="cp-card__title" id="fh-${i}">${esc(h.label)}</h2>${f.households.length > 1 ? `<span class="badge">Home ${i + 1}</span>` : ''}</header>
            <ul class="cp-people">${h.guardianIds.map(gid => f.guardians.find(g => g.id === gid)).filter(Boolean).map(g => `<li><b>${esc(g.name)}${g.id === f.primary?.id ? ' <span class="badge badge--primary">Primary contact</span>' : ''}</b><span>${g.phone ? `<a href="tel:${esc(g.phone.replace(/[^\d+]/g, ''))}">${esc(g.phone)}</a>` : 'No phone'}${g.email ? ` · ${esc(g.email)}` : ''}</span><span>Parent app: ${esc(store.APP_STATUS[g.account.status])}${g.account.invitedAt ? ` · invited ${esc(when(g.account.invitedAt))}` : ''}</span></li>`).join('')}</ul></section>`).join('')}
          <section class="cp-card" aria-labelledby="fc"><header class="cp-card__head"><h2 class="cp-card__title" id="fc">Children</h2></header>
            ${f.children.length ? `<ul class="cp-people">${f.children.map(c => `<li><b><a href="${routes.record(c.id)}">${esc(c.name)}</a></b><span>${esc(c.cls)} · ${esc(store.CHILD_STATUSES[c.status])}</span></li>`).join('')}</ul>` : '<p class="cp-muted">No children linked.</p>'}</section>
          ${billOk ? `<section class="cp-card" aria-labelledby="fb"><header class="cp-card__head"><h2 class="cp-card__title" id="fb">Billing</h2></header>${lines.length ? `<p class="fam-big">${money(f.balance)} <span class="cp-muted">outstanding</span></p><ul class="cp-mini">${lines.map(l => `<li><b>${esc(l.student?.name || '')} · ${esc(l.term)}</b><span>${money(l.amount)} · paid ${money(l.paid)}${l.overdue ? ' · overdue' : ''}</span></li>`).join('')}</ul>` : '<p class="cp-muted">No invoices for this family’s children.</p>'}</section>` : ''}
          <section class="cp-card" aria-labelledby="fi"><header class="cp-card__head"><h2 class="cp-card__title" id="fi">Parent-app invitations</h2></header>${history.length ? `<ul class="cp-mini">${history.map(inv => `<li><b>${esc(when(inv.at))} · ${esc(inv.by)}</b><span>${inv.recipients.filter(r => r.ok).length} invited${inv.recipients.some(r => !r.ok) ? `, ${inv.recipients.filter(r => !r.ok).length} failed` : ''}${inv.skipped.length ? ` · ${inv.skipped.length} skipped` : ''} · prototype, not delivered</span></li>`).join('')}</ul>` : '<p class="cp-muted">No invitations sent from Nexora yet.</p>'}</section>
          ${f.notes || (f.mergedFrom || []).length ? `<section class="cp-card" aria-labelledby="fn"><header class="cp-card__head"><h2 class="cp-card__title" id="fn">Notes & history</h2></header>${f.notes ? `<p>${esc(f.notes)}</p>` : ''}${(f.history || []).filter(h => h.event === 'merged').map(h => `<p class="cp-muted">${esc(when(h.at))}: ${esc(h.detail)} (${esc(h.by)})</p>`).join('')}</section>` : ''}
        </div></div>`;
    };
    main.classList.add('kids-page');
    draw();
    main.addEventListener('click', e => {
      const f = store.familyById(id);
      if (!f || f.merged) return;
      if (e.target.closest('[data-invite]')) inviteDialog(user, [f.id]);
      if (e.target.closest('[data-edit]')) editDialog(user, f);
    });
    store.subscribe(({ key }) => { if (!key || /^nexora-(families|households|guardians|children|parent-app)/.test(key)) draw(); });
    main.querySelector('#page-title')?.focus();
    return true;
  }

  function render(key, main, user) {
    if (key === 'families') return listPage(main, user);
    if (key === 'family') return detailPage(main, user);
    return false;
  }

  window.NexoraFamilies = { render };
})();
