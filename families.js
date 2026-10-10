/* S15 families (app.html?page=families), S16 family detail (app.html?page=family&id=<familyId>),
   family statement (?page=statement&family=) and family messages (?page=messages&family=[&msg=]).
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

  const day = d => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const telHref = p => `tel:${String(p).replace(/[^\d+]/g, '')}`;
  const section = (id, title, body, { tools = '', cls = '' } = {}) => `
    <details class="fd-section ${cls}" open data-section="${id}">
      <summary class="fd-section__head"><h2 class="fd-section__title" id="fd-${id}">${esc(title)}</h2><span class="fd-section__chev" aria-hidden="true"></span></summary>
      ${tools ? `<div class="fd-section__tools">${tools}</div>` : ''}
      <div class="fd-section__body">${body}</div>
    </details>`;

  function guardianDialog(user, fam, guardian = null) {
    const all = store.getGuardians();
    const famIds = new Set(fam.guardians.map(g => g.id));
    const g = guardian;
    const channels = g ? store.guardianChannels(g) : ['sms'];
    const langSel = `<select class="input" id="kd-language" name="language">${Object.entries(store.GUARDIAN_LANGUAGES).map(([k, l]) => `<option value="${k}"${(g ? store.guardianLanguage(g) : store.schoolLanguage()) === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const chanBoxes = `<fieldset class="wiz-chips"><legend class="field__label">Preferred contact channels *</legend><div class="fd-checks">${Object.entries(store.CHANNELS).map(([k, l]) => `<label class="check"><input type="checkbox" name="channels" value="${k}"${channels.includes(k) ? ' checked' : ''}>${esc(l)}</label>`).join('')}</div><p class="field__hint">Preferred channels are saved even when the school can’t use them yet. Only an active parent-app account can receive messages in this prototype.</p><p class="field__hint field__hint--error" data-error-for="channels" hidden></p></fieldset>`;
    const d = kids.dialog({
      label: 'Family / Guardians', title: g ? `Edit ${g.name}` : 'Add guardian',
      desc: g ? 'Changes apply everywhere this guardian appears, including siblings in other families.' : 'Add someone new, or link a guardian who is already on record so they aren’t duplicated.',
      body: `${g ? '' : `<fieldset class="wiz-radios"><legend class="field__label">Who is this?</legend><div class="wiz-radios__opts"><label class="radio"><input type="radio" name="mode" value="new" checked>Someone new</label><label class="radio"><input type="radio" name="mode" value="link">Link an existing guardian</label></div></fieldset>
        <div class="field" data-link-row hidden><label class="field__label" for="kd-linkId">Existing guardian</label><select class="input" id="kd-linkId" name="linkId"><option value="">Choose</option>${all.filter(x => !famIds.has(x.id)).map(x => `<option value="${esc(x.id)}">${esc(x.name)} · ${esc(x.phone)}</option>`).join('')}</select><p class="field__hint field__hint--error" data-error-for="linkId" hidden></p></div>`}
        <div class="kids-form__grid" data-person>
          ${kids.field('kd-name', 'Full name', `<input class="input" id="kd-name" name="name" value="${esc(g?.name || '')}" required autocomplete="off">`, { required: true })}
          ${kids.field('kd-phone', 'Phone', `<input class="input" type="tel" id="kd-phone" name="phone" value="${esc(g?.phone || '')}" required>`, { required: true })}
          ${kids.field('kd-email', 'Email', `<input class="input" type="email" id="kd-email" name="email" value="${esc(g?.email || '')}">`, { hint: 'Needed to use email as a channel.' })}
          ${kids.field('kd-language', 'Preferred language', langSel, { required: true, hint: 'Template messages to this guardian use this language.' })}
        </div>
        <div data-person>${chanBoxes}</div>
        ${g ? '' : `<div class="kids-form__grid">
          ${kids.field('kd-relation', 'Relationship to the children', `<select class="input" id="kd-relation" name="relation"><option value="">Choose</option>${RELATIONS.map(r => `<option>${r}</option>`).join('')}</select>`, { required: true })}
          ${kids.field('kd-householdId', 'Household', `<select class="input" id="kd-householdId" name="householdId"><option value="">Choose</option>${fam.households.map(h => `<option value="${esc(h.id)}">${esc(h.label)}</option>`).join('')}</select>`, { required: true, hint: 'They’re linked to the children of this household.' })}
        </div>`}
        <label class="check"><input type="checkbox" name="primary"${g && fam.primary?.id === g.id ? ' checked disabled' : ''}>Primary contact for the family</label>`,
      submit: g ? 'Save guardian' : 'Add guardian',
      async onSubmit(form) {
        const link = form.elements.mode?.value === 'link';
        const input = {
          linkId: link ? form.elements.linkId.value : '', name: form.elements.name.value, phone: form.elements.phone.value, email: form.elements.email.value,
          language: form.elements.language.value, channels: [...form.querySelectorAll('[name="channels"]:checked')].map(i => i.value),
          relation: form.elements.relation?.value || '', householdId: form.elements.householdId?.value || '', primary: form.elements.primary.checked
        };
        if (link && !input.linkId) return { ok: false, errors: { linkId: 'Choose a guardian.' } };
        const r = await store.saveFamilyGuardian(store.currentUser(), fam.id, input, g?.id || null);
        if (r.ok) window.NexoraToast?.show('Changes saved successfully', `${r.guardian.name}${g ? ' updated' : ' added to the family'}.`);
        return r.ok ? r : { ...r, message: r.errors ? null : FAIL[r.reason] };
      }
    });
    d.el.classList.add('cp-modal');
    d.form.addEventListener('change', e => {
      if (e.target.name !== 'mode') return;
      const link = e.target.value === 'link';
      d.form.querySelector('[data-link-row]').hidden = !link;
      d.form.querySelectorAll('[data-person]').forEach(x => { x.hidden = link; });
    });
  }

  function householdDialog(user, fam, hh = null) {
    const members = hh ? fam.guardians.filter(g => hh.guardianIds.includes(g.id)) : [];
    const opts = (sel) => `<option value="">Not set</option>${members.map(g => `<option value="${esc(g.id)}"${sel === g.id ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}`;
    kids.dialog({
      label: 'Family / Households', title: hh ? `Edit ${hh.label}` : 'Add household', desc: hh ? 'Each household can have its own invoice and report recipient.' : 'Add a second home for separated or shared arrangements. Then add its guardians and children.',
      body: `${kids.field('kd-label', 'Household name', `<input class="input" id="kd-label" name="label" value="${esc(hh?.label || '')}" required placeholder="e.g. Mum’s home">`, { required: true })}
        ${kids.field('kd-address', 'Address', `<textarea class="input" id="kd-address" name="address" rows="2">${esc(hh?.address || '')}</textarea>`)}
        ${hh ? `<div class="kids-form__grid">${kids.field('kd-invoiceRecipientId', 'Receives invoices', `<select class="input" id="kd-invoiceRecipientId" name="invoiceRecipientId">${opts(hh.invoiceRecipientId)}</select>`)}${kids.field('kd-reportRecipientId', 'Receives reports', `<select class="input" id="kd-reportRecipientId" name="reportRecipientId">${opts(hh.reportRecipientId)}</select>`)}</div>` : ''}`,
      submit: hh ? 'Save household' : 'Add household',
      async onSubmit(form) {
        const r = await store.saveFamilyHousehold(store.currentUser(), fam.id, { label: form.elements.label.value, address: form.elements.address.value, invoiceRecipientId: form.elements.invoiceRecipientId?.value || '', reportRecipientId: form.elements.reportRecipientId?.value || '' }, hh?.id || null);
        if (r.ok) window.NexoraToast?.show('Changes saved successfully', r.household.label);
        return r.ok ? r : { ...r, message: r.errors ? null : FAIL[r.reason] };
      }
    });
  }

  function householdChildrenDialog(user, fam, hh) {
    const members = fam.guardians.filter(g => hh.guardianIds.includes(g.id));
    const kidsHere = new Set(store.getChildren().filter(c => c.guardianLinks?.some(l => l.householdId === hh.id)).map(c => c.id));
    kids.dialog({
      label: 'Family / Households', title: `Children in ${hh.label}`, desc: 'Ticking a child links them to this household’s guardians. Unticking removes only this household’s links.',
      body: `<fieldset class="wiz-chips"><legend class="field__label">Children</legend><div class="fd-checks">${fam.children.map(c => `<label class="check"><input type="checkbox" name="childIds" value="${esc(c.id)}"${kidsHere.has(c.id) ? ' checked' : ''}>${esc(c.name)}</label>`).join('')}</div><p class="field__hint field__hint--error" data-error-for="childIds" hidden></p></fieldset>
        ${members.length ? `<p class="field__hint">For children you add, record each guardian’s relationship:</p><div class="kids-form__grid">${members.map(g => kids.field(`kd-rel-${g.id}`, g.name, `<select class="input" id="kd-rel-${esc(g.id)}" name="relations.${esc(g.id)}"><option value="">Choose</option>${RELATIONS.map(r => `<option>${r}</option>`).join('')}</select>`).replace(`data-error-for="rel-${g.id}"`, `data-error-for="relations.${g.id}"`)).join('')}</div>` : ''}`,
      submit: 'Save children',
      async onSubmit(form) {
        const relations = Object.fromEntries(members.map(g => [g.id, form.elements[`relations.${g.id}`]?.value || '']));
        const r = await store.setHouseholdChildren(store.currentUser(), fam.id, hh.id, { childIds: [...form.querySelectorAll('[name="childIds"]:checked')].map(i => i.value), relations });
        if (r.ok) window.NexoraToast?.show('Changes saved successfully', hh.label);
        return r.ok ? r : { ...r, message: r.errors ? null : FAIL[r.reason] };
      }
    });
  }

  function legalDialog(user, fam, note = null) {
    kids.dialog({
      label: 'Family / Restricted', title: note ? 'Edit legal note' : 'Add legal note', desc: 'Restricted — visible to Director and Safeguarding lead. Never copied into messages or notifications.',
      body: `${kids.field('kd-title', 'Title', `<input class="input" id="kd-title" name="title" value="${esc(note?.title || '')}" required placeholder="e.g. Residence order">`, { required: true })}
        ${kids.field('kd-detail', 'Order or arrangement', `<textarea class="input" id="kd-detail" name="detail" rows="3" required>${esc(note?.detail || '')}</textarea>`, { required: true })}
        <div class="kids-form__grid">${kids.field('kd-effective', 'Effective from', `<input class="input" type="date" id="kd-effective" name="effective" value="${esc(note?.effective || '')}">`)}${kids.field('kd-review', 'Review by', `<input class="input" type="date" id="kd-review" name="review" value="${esc(note?.review || '')}">`)}</div>
        ${kids.field('kd-instructions', 'Handling instructions', `<textarea class="input" id="kd-instructions" name="instructions" rows="2">${esc(note?.instructions || '')}</textarea>`)}
        ${kids.field('kd-docRef', 'Document reference', `<input class="input" id="kd-docRef" name="docRef" value="${esc(note?.docRef || '')}" placeholder="e.g. Court order no. / filing cabinet ref.">`, { hint: 'A reference only. Upload the document on the child’s profile.' })}`,
      submit: 'Save note',
      async onSubmit(form) {
        const r = await store.saveLegalNote(store.currentUser(), fam.id, Object.fromEntries(['title', 'detail', 'effective', 'review', 'instructions', 'docRef'].map(k => [k, form.elements[k].value])), note?.id || null);
        if (r.ok) window.NexoraToast?.show('Changes saved successfully', 'Restricted note saved.');
        return r.ok ? r : { ...r, message: r.errors ? null : FAIL[r.reason] };
      }
    });
  }

  function detailPage(main, user) {
    const id = params.get('id');
    const manage = store.canManageFamilies(user);
    const billOk = canSeeBalance(user);
    const legalOk = store.canSeeLegal(user);
    const msgOk = store.canAccess(user, 'communication') && store.isEntitled('communication');
    const scope = store.classScope(user);
    let failOnce = params.get('fail') === '1';
    let loaded = false;

    const childCard = c => {
      const full = store.childById(c.id);
      const age = store.ageParts(full.dob);
      const med = store.canView(user, 'medical') ? full.alerts.filter(a => a.type !== 'custody') : [];
      return `<li class="fd-child"><a class="fd-child__link" href="${routes.record(c.id)}">
        ${full.photo ? `<img class="fam-av fam-av--md" src="${esc(full.photo)}" alt="">` : `<span class="fam-av fam-av--md fam-av--child" aria-hidden="true">${esc(initials(c.name))}</span>`}
        <span class="fd-child__main"><b>${esc(c.name)}</b>${full.preferredName ? `<span class="cp-muted">“${esc(full.preferredName)}”</span>` : ''}<span class="cp-muted">${age.years}y ${age.months}m · ${esc(full.cls)}${full.keyTeacher ? ` · ${esc(full.keyTeacher)}` : ''}</span></span>
        <span class="fd-child__end"><span class="badge ${full.status === 'active' ? 'badge--success' : full.status === 'starting' ? 'badge--info' : ''}">${esc(store.CHILD_STATUSES[full.status])}</span>${med.length ? `<span class="fd-flags" aria-label="Safety alerts: ${esc(med.map(a => store.ALERT_TYPES[a.type]).join(', '))}">${[...new Set(med.map(a => a.type))].map(t => `<span class="kid-alert kid-alert--${t} fd-flag" aria-hidden="true">${icon({ allergy: 'allergy', medical: 'medical', dietary: 'leaf' }[t], 'icon--sm')}</span>`).join('')}</span>` : ''}</span>
      </a></li>`;
    };

    const draw = () => {
      if (!loaded) return;
      const f = id ? store.familyById(id) : null;
      if (f?.merged) {
        main.innerHTML = `<article class="panel record"><div class="kids-empty"><h1 class="kids-empty__title" id="page-title" tabindex="-1">${esc(f.name)} was merged</h1><p>This family is now part of another family record.</p><a class="btn btn--primary" href="${routes.page('family', { id: f.mergedInto })}">Open the merged family</a></div></article>`;
        return;
      }
      if (!f || (user.role === 'Teacher' && !f.children.some(c => scope.includes(c.cls)))) {
        main.innerHTML = `<article class="panel record"><div class="kids-empty"><h1 class="kids-empty__title" id="page-title" tabindex="-1">We couldn’t find that family</h1><p>It may have been removed, or it isn’t one of your classes’ families.</p><a class="btn btn--primary" href="${routes.page('families')}">All families</a></div></article>`;
        return;
      }
      document.title = `${f.name} · Nexora`;
      const app = store.getParentApp();
      const addresses = f.households.filter(h => h.address).map(h => `${h.label}: ${h.address}`);
      const relationsOf = gid => [...new Set(store.getChildren().flatMap(c => c.guardianLinks?.filter(l => l.guardianId === gid && f.children.some(k => k.id === c.id)).map(l => l.relation) || []))];
      const legal = legalOk ? store.getLegalNotes(user, f.id) : null;
      const threads = msgOk ? store.familyThreads(f.id, 5) : [];
      const acct = billOk ? store.familyAccount(f.id) : null;
      const p = f.primary;
      const open = id2 => main.querySelector(`[data-section="${id2}"]`)?.open ?? true;
      const prevOpen = Object.fromEntries([...main.querySelectorAll('[data-section]')].map(s => [s.dataset.section, s.open]));

      const guardiansHtml = f.guardians.length ? `<ul class="fd-cards">${f.guardians.map(g => {
        const isPrimary = g.id === p?.id;
        const chans = store.guardianChannels(g);
        return `<li class="fd-card"><div class="fd-card__top">
            <span class="fam-av fam-av--md fam-av--guardian" aria-hidden="true">${esc(initials(g.name))}</span>
            <div class="fd-card__id"><b>${esc(g.name)}</b><span class="cp-muted">${esc(relationsOf(g.id).join(', ') || 'Relationship not recorded')}</span></div>
            ${manage ? `<button class="btn btn--icon-ghost fd-star${isPrimary ? ' is-on' : ''}" type="button" data-star="${esc(g.id)}" aria-pressed="${isPrimary}" aria-label="${isPrimary ? `${esc(g.name)} is the primary contact` : `Make ${esc(g.name)} the primary contact`}"${isPrimary ? ' disabled' : ''}>${icon('star')}</button>` : isPrimary ? `<span class="fd-star is-on" role="img" aria-label="Primary contact">${icon('star')}</span>` : ''}
          </div>
          ${isPrimary ? '<span class="badge badge--primary">Primary contact</span>' : ''}
          <dl class="cp-dl">
            <div><dt>Phone</dt><dd>${g.phone ? `<a href="${telHref(g.phone)}">${esc(g.phone)}</a>` : '<span class="cp-muted">Not provided</span>'}</dd></div>
            <div><dt>Email</dt><dd>${g.email ? `<a href="mailto:${esc(g.email)}">${esc(g.email)}</a>` : '<span class="cp-muted">Not provided</span>'}</dd></div>
            <div><dt>Language</dt><dd>${esc(store.GUARDIAN_LANGUAGES[store.guardianLanguage(g)])}${g.language ? '' : ' <span class="cp-muted">(school default)</span>'}</dd></div>
            <div><dt>Parent app</dt><dd>${statusBadge(g.account.status)}</dd></div>
          </dl>
          <ul class="fd-chans" aria-label="Contact preferences for ${esc(g.name)}">${chans.map(ch => { const st = store.channelState(g, ch, app); return `<li class="fd-chan${st.ok ? ' is-ok' : ''}">${icon(st.ok ? 'check-circle' : 'info', 'icon--sm')}<span><b>${esc(store.CHANNELS[ch])}</b> · preferred${st.ok ? ', available' : ` — ${esc(st.note)}`}</span></li>`; }).join('')}</ul>
          ${manage ? `<button class="btn btn--sm btn--secondary" type="button" data-edit-g="${esc(g.id)}">${icon('pencil', 'icon--sm')}Edit</button>` : ''}
        </li>`;
      }).join('')}</ul>` : '<div class="kids-empty"><p class="kids-empty__title">No guardians linked</p></div>';

      const householdsHtml = `<ul class="fd-cards">${f.households.map(h => {
        const members = f.guardians.filter(g => h.guardianIds.includes(g.id));
        const kidsHere = store.getChildren().filter(c => c.guardianLinks?.some(l => l.householdId === h.id) && f.children.some(k => k.id === c.id));
        const nameOf = gid => f.guardians.find(g => g.id === gid)?.name;
        return `<li class="fd-card"><div class="fd-card__top"><span class="fam-av fam-av--md" aria-hidden="true">${icon('home', 'icon--sm')}</span><div class="fd-card__id"><b>${esc(h.label)}</b><span class="cp-muted">${h.address ? esc(h.address) : 'No address recorded'}</span></div></div>
          <dl class="cp-dl">
            <div><dt>Guardians</dt><dd>${members.length ? members.map(g => `<span class="fd-member">${esc(g.name)}${manage && h.guardianIds.length ? ` <button class="btn btn--sm btn--ghost fd-unlink" type="button" data-unlink-g="${esc(g.id)}" data-hh="${esc(h.id)}" aria-label="Remove ${esc(g.name)} from ${esc(h.label)}">${icon('x', 'icon--sm')}</button>` : ''}</span>`).join('') : '<span class="cp-muted">None yet</span>'}</dd></div>
            <div><dt>Children</dt><dd>${kidsHere.length ? kidsHere.map(c => esc(store.childName(c))).join(', ') : '<span class="cp-muted">None linked</span>'}</dd></div>
            <div><dt>Receives invoices</dt><dd>${esc(nameOf(h.invoiceRecipientId) || '') || '<span class="cp-muted">Not set</span>'}</dd></div>
            <div><dt>Receives reports</dt><dd>${esc(nameOf(h.reportRecipientId) || '') || '<span class="cp-muted">Not set</span>'}</dd></div>
          </dl>
          ${manage ? `<div class="wiz-adds"><button class="btn btn--sm btn--secondary" type="button" data-edit-h="${esc(h.id)}">${icon('pencil', 'icon--sm')}Edit</button><button class="btn btn--sm btn--secondary" type="button" data-kids-h="${esc(h.id)}">${icon('users', 'icon--sm')}Children</button></div>` : ''}
        </li>`;
      }).join('')}</ul>${f.households.length === 1 ? '<p class="cp-muted">One household. Add another for separated or shared arrangements.</p>' : ''}`;

      const legalHtml = legal?.ok ? `<p class="fd-restricted">${icon('lock', 'icon--sm')}Restricted — visible to Director and Safeguarding lead</p>
        ${legal.custody.length ? `<ul class="cp-restrict">${legal.custody.map(a => `<li>${icon('shield')}<div><b>${esc(a.child)}${a.restrictedPerson ? ` — do not release to ${esc(a.restrictedPerson)}` : ''}</b><p>${esc(a.detail)}${a.effective ? ` · from ${esc(day(a.effective))}` : ''}</p></div></li>`).join('')}</ul>` : '<p class="cp-muted">No custody restrictions on the children’s records.</p>'}
        ${legal.notes.length ? `<ul class="cp-mini fd-notes">${legal.notes.map(n => `<li><b>${esc(n.title)}</b><span>${esc(n.detail)}</span><span class="cp-muted">${n.effective ? `From ${esc(day(n.effective))}` : ''}${n.review ? ` · review by ${esc(day(n.review))}` : ''}${n.docRef ? ` · ref ${esc(n.docRef)}` : ''}</span>${n.instructions ? `<span>Handling: ${esc(n.instructions)}</span>` : ''}<button class="btn btn--sm btn--ghost" type="button" data-edit-note="${esc(n.id)}">${icon('pencil', 'icon--sm')}Edit</button></li>`).join('')}</ul>` : '<p class="cp-muted">No legal notes recorded.</p>'}` : '';

      const msgsHtml = threads.length ? `<ul class="cp-mini fd-threads">${threads.map(m => `<li><a href="${routes.page('messages', { family: f.id, msg: m.id })}"><b>${esc(m.subject)}</b></a><span>${esc(m.recipients.filter(r => f.guardians.some(g => g.id === r.guardianId) || !r.guardianId).map(r => r.name).join(', '))} · from ${esc(m.createdBy)} · ${esc(when(m.createdAt))}</span><span class="cp-muted">${m.status === 'queued' ? 'Saved to outbox — prototype, not delivered' : esc(m.status)}</span></li>`).join('')}</ul><a class="btn btn--sm btn--tertiary" href="${routes.page('messages', { family: f.id })}">View all messages${icon('arrow-right', 'icon--sm')}</a>` : '<div class="kids-empty"><p class="kids-empty__title">No messages yet</p><p>Messages sent to this family’s guardians appear here.</p></div>';

      // Invitation history includes families merged into this one; merge events and notes stay visible.
      const invites = app.invitations.filter(inv => inv.familyIds.includes(f.id) || (f.mergedFrom || []).some(m => inv.familyIds.includes(m)));
      const merges = (f.history || []).filter(x => x.event === 'merged');
      const historyHtml = `${invites.length ? `<ul class="cp-mini">${invites.map(inv => `<li><b>Parent-app invitations · ${esc(when(inv.at))}</b><span>${inv.recipients.filter(x => x.ok).length} invited${inv.recipients.some(x => !x.ok) ? `, ${inv.recipients.filter(x => !x.ok).length} failed` : ''}${inv.skipped.length ? ` · ${inv.skipped.length} skipped` : ''} · by ${esc(inv.by)} · prototype, not delivered</span></li>`).join('')}</ul>` : '<p class="cp-muted">No parent-app invitations sent from Nexora yet.</p>'}${merges.map(x => `<p class="cp-muted">Merged ${esc(when(x.at))}: ${esc(x.detail)} (${esc(x.by)})</p>`).join('')}${f.notes ? `<p>${esc(f.notes)}</p>` : ''}`;
      const acctHtml = acct ? (acct.invoices.length ? `<div class="cp-stats"><div class="cp-stat"><span class="cp-stat__n">${money(acct.balance)}</span><span>${acct.balance > 0 ? 'Outstanding' : 'Settled'}</span></div><div class="cp-stat"><span class="cp-stat__n">${acct.lastPayment ? money(acct.lastPayment.amount) : '—'}</span><span>${acct.lastPayment ? `Last payment · ${esc(day(acct.lastPayment.date))}` : 'No payment recorded in Nexora'}</span></div></div><a class="btn btn--sm btn--tertiary" href="${routes.page('statement', { family: f.id })}">View statement${icon('arrow-right', 'icon--sm')}</a>` : '<div class="kids-empty"><p class="kids-empty__title">No billing records</p><p>Invoices for this family’s children will appear here.</p></div>') : '';

      main.innerHTML = `<div class="cp fd">
        <nav class="kids-crumbs" aria-label="Breadcrumb"><a href="${routes.page('families')}">Families</a> / <span aria-current="page">${esc(f.name)}</span></nav>
        <header class="panel cp-head fd-head">
          <div class="cp-head__id"><span class="fam-av fam-av--lg" aria-hidden="true">${esc(initials(f.name))}</span>
            <div class="cp-head__names"><h1 class="cp-head__name" id="page-title" tabindex="-1">${esc(f.name)}</h1>
              <p class="cp-head__class">${statusBadge(f.appStatus)}<span class="cp-muted">${f.households.length} ${f.households.length === 1 ? 'home' : 'homes'} · ${f.children.length} child${f.children.length === 1 ? '' : 'ren'}</span></p>
              ${addresses.length ? addresses.map(a => `<p class="fd-addr">${icon('home', 'icon--sm')}${esc(a)}</p>`).join('') : '<p class="cp-muted">No address recorded</p>'}
              <p class="fd-primary">Primary contact: <b>${esc(p?.name || 'Not set')}</b>${p?.phone ? ` · <a href="${telHref(p.phone)}">${esc(p.phone)}</a>` : ''}</p>
            </div></div>
          <div class="cp-head__actions fd-actions">
            ${msgOk ? `<a class="btn btn--secondary fd-act" href="${routes.page('compose', { family: f.id })}" aria-label="Message ${esc(f.name)}">${icon('message', 'icon--sm')}<span>Message</span></a>` : ''}
            ${p?.phone ? `<a class="btn btn--secondary fd-act" href="${telHref(p.phone)}" aria-label="Call ${esc(p.name)} on ${esc(p.phone)}">${icon('phone', 'icon--sm')}<span>Call</span></a>` : `<button class="btn btn--secondary fd-act" type="button" disabled aria-describedby="fd-nocall">${icon('phone', 'icon--sm')}<span>Call</span></button><span class="sr-only" id="fd-nocall">The primary contact has no phone number.</span>`}
            ${billOk ? `<a class="btn btn--secondary fd-act" href="${routes.page('statement', { family: f.id })}" aria-label="Statement for ${esc(f.name)}">${icon('wallet', 'icon--sm')}<span>Statement</span></a>` : ''}
            ${manage ? `<button class="btn btn--secondary" type="button" data-invite>${icon('mail', 'icon--sm')}Invite to app</button><button class="btn btn--primary kids-yellow" type="button" data-edit>${icon('pencil', 'icon--sm')}Edit family</button>` : ''}
          </div>
          ${!p?.phone ? '<p class="fd-nocall cp-muted">Call is unavailable: the primary contact has no phone number.</p>' : ''}
        </header>
        <div class="fd-grid">
          <div class="fd-main">
            ${section('guardians', `Guardians (${f.guardians.length})`, guardiansHtml, { tools: manage ? `<button class="btn btn--sm btn--secondary" type="button" data-add-g>${icon('user-plus', 'icon--sm')}Add guardian</button>` : '' })}
            ${section('households', `Households (${f.households.length})`, householdsHtml, { tools: manage ? `<button class="btn btn--sm btn--secondary" type="button" data-add-h>${icon('plus', 'icon--sm')}Add household</button>` : '' })}
            ${section('children', `Children (${f.children.length})`, f.children.length ? `<ul class="fd-children">${f.children.map(childCard).join('')}</ul>` : `<div class="kids-empty"><p class="kids-empty__title">No children linked</p>${manage ? `<a class="btn btn--sm btn--secondary" href="${routes.page('enrol')}">Enrol a child</a>` : ''}</div>`)}
            ${legal?.ok ? section('legal', 'Custody & Legal Notes', legalHtml, { tools: `<button class="btn btn--sm btn--secondary" type="button" data-add-note>${icon('plus', 'icon--sm')}Add note</button>`, cls: 'fd-section--legal' }) : ''}
          </div>
          <div class="fd-side">
            ${acct ? section('account', 'Account summary', acctHtml) : ''}
            ${msgOk ? section('messages', 'Messages', msgsHtml) : ''}
            ${section('history', 'Parent app & history', historyHtml)}
          </div>
        </div></div>`;
      main.querySelectorAll('[data-section]').forEach(s => { if (prevOpen[s.dataset.section] === false) s.open = false; });
      void open;
    };

    function skeleton() {
      main.innerHTML = `<div class="cp" aria-busy="true"><p class="sr-only">Loading family…</p><div class="panel cp-head"><span class="skeleton sk-title"></span><span class="skeleton sk-line w-60"></span><span class="skeleton sk-line w-40"></span></div><div class="fd-grid"><div class="fd-main">${Array.from({ length: 3 }, () => '<div class="cp-card"><span class="skeleton sk-line w-40"></span><div class="sk-row"><span class="skeleton sk-circle"></span><span class="sk-stack"><span class="skeleton sk-line w-70"></span><span class="skeleton sk-line w-40"></span></span></div></div>').join('')}</div></div></div>`;
    }
    function load() {
      skeleton();
      setTimeout(() => {
        try {
          if (failOnce) { failOnce = false; throw new Error('demo'); }
          loaded = true;
          draw();
          main.querySelector('#page-title')?.focus();
        } catch {
          main.innerHTML = `<article class="panel record" role="alert"><div class="kids-empty"><span class="state-icon state-icon--error" aria-hidden="true">${icon('alert-circle')}</span><h1 class="kids-empty__title" id="page-title" tabindex="-1">Something went wrong</h1><p>We couldn’t load this family. Nothing has changed.</p><button class="btn btn--secondary" type="button" data-retry>${icon('refresh', 'icon--sm')}Try again</button></div></article>`;
          main.querySelector('[data-retry]').addEventListener('click', load);
        }
      }, reduceMotion.matches ? 0 : 250);
    }

    main.classList.add('kids-page');
    main.addEventListener('click', e => {
      const t = e.target;
      const f = store.familyById(id);
      if (!f || f.merged) return;
      if (t.closest('[data-invite]')) inviteDialog(user, [f.id]);
      else if (t.closest('[data-edit]')) editDialog(user, f);
      else if (t.closest('[data-add-g]')) guardianDialog(user, f);
      else if (t.closest('[data-edit-g]')) guardianDialog(user, f, f.guardians.find(g => g.id === t.closest('[data-edit-g]').dataset.editG));
      else if (t.closest('[data-add-h]')) householdDialog(user, f);
      else if (t.closest('[data-edit-h]')) householdDialog(user, f, f.households.find(h => h.id === t.closest('[data-edit-h]').dataset.editH));
      else if (t.closest('[data-kids-h]')) householdChildrenDialog(user, f, f.households.find(h => h.id === t.closest('[data-kids-h]').dataset.kidsH));
      else if (t.closest('[data-add-note]')) legalDialog(user, f);
      else if (t.closest('[data-edit-note]')) { const r = store.getLegalNotes(user, f.id); if (r.ok) legalDialog(user, f, r.notes.find(n => n.id === t.closest('[data-edit-note]').dataset.editNote)); }
      else if (t.closest('[data-star]')) {
        const g = f.guardians.find(x => x.id === t.closest('[data-star]').dataset.star);
        kids.dialog({
          label: 'Family / Primary contact', title: `Make ${g.name} the primary contact?`,
          desc: `${esc(f.primary?.name || 'Nobody')} is the primary contact now. The family header, the Families list and calls from this page will use ${esc(g.name)}. Guardians and children stay linked as they are.`,
          body: '', submit: 'Make primary contact',
          async onSubmit() { const r = await store.setFamilyPrimary(store.currentUser(), f.id, g.id); if (r.ok) window.NexoraToast?.show('Changes saved successfully', `${g.name} is now the primary contact.`); return r.ok ? r : { ...r, message: r.message || FAIL[r.reason] }; }
        });
      } else if (t.closest('[data-unlink-g]')) {
        const b = t.closest('[data-unlink-g]');
        const g = f.guardians.find(x => x.id === b.dataset.unlinkG);
        const hh = f.households.find(x => x.id === b.dataset.hh);
        kids.dialog({
          label: 'Family / Households', title: `Remove ${g.name} from ${hh.label}?`,
          desc: `${esc(g.name)} is unlinked from this household and its children. Their record stays, along with links to children in other households.`,
          body: '', submit: 'Remove', danger: true,
          async onSubmit() { const r = await store.unlinkHouseholdGuardian(store.currentUser(), f.id, hh.id, g.id); if (r.ok) window.NexoraToast?.show('Changes saved successfully', `${g.name} removed from ${hh.label}.`); return r.ok ? r : { ...r, message: r.message || FAIL[r.reason] }; }
        });
      }
    });
    let queued = false;
    store.subscribe(({ key }) => {
      if (!loaded || (key && !/^nexora-(families|households|guardians|children|parent-app|family-messages|legal-notes|invoices|payments|school-plan)/.test(key))) return;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const active = document.activeElement;
        const sel = active && main.contains(active) ? ['data-edit-g', 'data-star', 'data-edit-h', 'data-kids-h', 'data-add-g', 'data-add-h'].map(a => (active.hasAttribute(a) ? `[${a}="${active.getAttribute(a)}"]` : null)).find(Boolean) : null;
        draw();
        if (sel) main.querySelector(sel)?.focus();
      });
    });
    load();
    return true;
  }

  /* ------------------------------------------------------------------ Family statement */

  function statementPage(main, user) {
    const f = store.familyById(params.get('family'));
    main.classList.add('kids-page');
    if (!canSeeBalance(user)) { main.innerHTML = `<article class="panel record"><div class="kids-empty"><h1 class="kids-empty__title" id="page-title">Statements aren’t available</h1><p>${store.isEntitled('fees') ? 'Your role doesn’t include billing.' : `Billing is on the ${esc(store.requiredPlanFor('fees').name)} plan.`}</p><a class="btn btn--secondary" href="${routes.page('families')}">Families</a></div></article>`; return true; }
    if (!f || f.merged) { main.innerHTML = `<article class="panel record"><div class="kids-empty"><h1 class="kids-empty__title" id="page-title">We couldn’t find that family</h1><a class="btn btn--primary" href="${routes.page('families')}">All families</a></div></article>`; return true; }
    const a = store.familyAccount(f.id);
    document.title = `Statement · ${f.name} · Nexora`;
    main.innerHTML = `<div class="cp">
      <nav class="kids-crumbs" aria-label="Breadcrumb"><a href="${routes.page('families')}">Families</a> / <a href="${routes.page('family', { id: f.id })}">${esc(f.name)}</a> / <span aria-current="page">Statement</span></nav>
      <header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Statement · ${esc(f.name)}</h1><p class="kids-head__sub">${a.balance > 0 ? `${money(a.balance)} outstanding` : 'Account settled'} · ${a.invoices.length} invoice${a.invoices.length === 1 ? '' : 's'}, ${a.payments.length} payment${a.payments.length === 1 ? '' : 's'}</p></div></header>
      ${a.entries.length ? `<div class="table-shell"><table class="data-table cp-table" aria-label="Statement"><thead><tr><th scope="col">Date</th><th scope="col">Item</th><th scope="col">Charge</th><th scope="col">Payment</th><th scope="col">Balance</th></tr></thead><tbody>${a.entries.map(e => `<tr><td data-label="Date">${esc(day(e.date))}</td><td data-label="Item">${e.kind === 'invoice' ? 'Invoice' : 'Payment'} · ${esc(e.label)}</td><td data-label="Charge">${e.amount > 0 ? money(e.amount) : ''}</td><td data-label="Payment">${e.amount < 0 ? money(-e.amount) : ''}</td><td data-label="Balance">${money(e.balance)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="kids-empty"><p class="kids-empty__title">No billing records</p></div>'}
    </div>`;
    return true;
  }

  /* ------------------------------------------------------------------ Family messages (all threads / one thread) */

  function messagesPage(main, user) {
    const f = store.familyById(params.get('family'));
    const msgId = params.get('msg');
    main.classList.add('kids-page');
    if (!f || f.merged) { main.innerHTML = `<article class="panel record"><div class="kids-empty"><h1 class="kids-empty__title" id="page-title">We couldn’t find that family</h1><a class="btn btn--primary" href="${routes.page('families')}">All families</a></div></article>`; return true; }
    const threads = store.familyThreads(f.id);
    const m = msgId ? threads.find(x => x.id === msgId) : null;
    const famIds = new Set(f.guardians.map(g => g.id));
    document.title = `${m ? m.subject : 'Messages'} · ${f.name} · Nexora`;
    main.innerHTML = `<div class="cp">
      <nav class="kids-crumbs" aria-label="Breadcrumb"><a href="${routes.page('families')}">Families</a> / <a href="${routes.page('family', { id: f.id })}">${esc(f.name)}</a> / ${m ? `<a href="${routes.page('messages', { family: f.id })}">Messages</a> / <span aria-current="page">${esc(m.subject)}</span>` : '<span aria-current="page">Messages</span>'}</nav>
      ${m ? `<article class="panel cp-card"><header class="cp-card__head"><div><h1 class="cp-card__title" id="page-title" tabindex="-1">${esc(m.subject)}</h1><p class="cp-muted">From ${esc(m.createdBy)} · ${esc(when(m.createdAt))} · saved to outbox (prototype, not delivered)</p></div></header>
          <ul class="fd-msg-list">${m.recipients.filter(r => !r.guardianId || famIds.has(r.guardianId)).map(r => `<li class="cp-card"><p><b>To ${esc(r.name)}</b>${r.language ? ` · ${esc(store.GUARDIAN_LANGUAGES[r.language] || r.language)}${r.fallback ? ` <span class="cp-muted">(translation unavailable — sent in ${esc(store.GUARDIAN_LANGUAGES[r.usedLanguage] || r.usedLanguage)})</span>` : ''}` : ''}</p>${r.subject ? `<p><b>${esc(r.subject)}</b></p>` : ''}<p class="fd-msg-body">${esc(r.body || m.body)}</p></li>`).join('')}</ul></article>`
        : `<header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Messages · ${esc(f.name)}</h1><p class="kids-head__sub">${threads.length} message${threads.length === 1 ? '' : 's'}</p></div>${store.canAccess(user, 'communication') ? `<a class="btn btn--primary kids-yellow" href="${routes.page('compose', { family: f.id })}">${icon('message', 'icon--sm')}New message</a>` : ''}</header>
          ${threads.length ? `<ul class="cp-mini fd-threads">${threads.map(t => `<li class="cp-card"><a href="${routes.page('messages', { family: f.id, msg: t.id })}"><b>${esc(t.subject)}</b></a><span>${esc(when(t.createdAt))} · from ${esc(t.createdBy)} · ${t.recipients.length} recipient${t.recipients.length === 1 ? '' : 's'}</span></li>`).join('')}</ul>` : '<div class="kids-empty"><p class="kids-empty__title">No messages yet</p></div>'}`}
    </div>`;
    return true;
  }

  function render(key, main, user) {
    if (key === 'families') return listPage(main, user);
    if (key === 'family') return detailPage(main, user);
    if (key === 'statement') return statementPage(main, user);
    if (key === 'messages') return messagesPage(main, user);
    return false;
  }

  window.NexoraFamilies = { render };
})();
