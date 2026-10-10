/* S14 enrol / edit child (app.html?page=enrol[&id=<childId>][&draft=<draftId>]) — a five-step wizard
   over the shared store — plus the pages it feeds: S09 waitlist, S15 families, S18 class rosters.
   NexoraEnrol.render(key, main, user) → true when handled. The final save goes through
   store.enrolChild(), which re-validates everything (duplicates, capacity, pickup conflicts). */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const kids = window.NexoraChildren;
  const { routes } = store;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const day = d => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const when = iso => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const params = new URLSearchParams(location.search);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const DAY_LABEL = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
  const RELATIONS = ['Mother', 'Father', 'Guardian', 'Grandparent', 'Aunt', 'Uncle', 'Carer', 'Sibling (18+)', 'Family friend', 'Other'];
  const FLASH_KEY = 'nexora-children-flash';
  const ageLong = dob => { const a = store.ageParts(dob); return `${a.years} year${a.years === 1 ? '' : 's'}, ${a.months} month${a.months === 1 ? '' : 's'}`; };
  const initialsOf = n => String(n || '').trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase() || '?';

  const STEPS = [
    { id: 'child', title: 'Child details', desc: 'Who the child is. Only first name, last name and date of birth are required.', keys: ['child'] },
    { id: 'family', title: 'Guardians & households', desc: 'Link an existing family or add new guardians. Each guardian belongs to one household.', keys: ['guardians'] },
    { id: 'safety', title: 'Emergency & pickup', desc: 'Who to call, who may collect the child, and anyone who must not.', keys: ['emergency', 'pickup', 'restrictions', 'restrictionsDeclared'] },
    { id: 'health', title: 'Health', desc: 'Answer each question explicitly. “Not yet collected” is never treated as “none”.', keys: ['health'] },
    { id: 'class', title: 'Class & schedule', desc: 'Class, start date and the days and session the child attends.', keys: ['classSchedule'] }
  ];

  /* ------------------------------------------------------------------ Form state ⇄ child record */

  const blank = () => ({
    householdIds: [], secondHousehold: false,
    child: { firstName: '', lastName: '', preferredName: '', dob: '', gender: '', languages: [], nationality: '', photo: undefined },
    guardians: [{ guardianId: null, name: '', relation: '', phone: '', email: '', household: 1, primary: true, livesWith: false, responsibility: false }],
    emergency: [], pickup: [], restrictionsDeclared: '', restrictions: [],
    health: { allergiesDeclared: '', allergies: [], conditionsDeclared: '', conditions: [], medicationsDeclared: '', medications: [], dietary: [], dietaryNotes: '', immunisations: [], doctor: { name: '', clinic: '', phone: '', notes: '' } },
    classSchedule: { cls: '', startDate: store.today(), days: [...store.schoolDays()], session: '' }
  });

  function fromChild(id) {
    const c = store.childProfile(id);
    if (!c) return null;
    const hh = [...new Set(c.guardianLinks.map(l => l.householdId).filter(Boolean))];
    const custody = c.alerts.filter(a => a.type === 'custody');
    const dietary = c.alerts.filter(a => a.type === 'dietary').map(a => a.detail);
    const chips = dietary.filter(d => store.DIETARY_OPTIONS.includes(d));
    const other = dietary.filter(d => !store.DIETARY_OPTIONS.includes(d));
    return {
      householdIds: hh, secondHousehold: hh.length > 1,
      child: { firstName: c.firstName, lastName: c.lastName, preferredName: c.preferredName || '', dob: c.dob, gender: c.gender || '', languages: [...(c.languages || [])], nationality: c.nationality || '', photo: undefined, existingPhoto: c.photo || null },
      guardians: c.guardians.map(g => {
        const link = c.guardianLinks.find(l => l.guardianId === g.id);
        return { guardianId: g.id, linked: true, name: g.name, relation: link.relation, phone: g.phone, email: g.email, household: Math.max(1, hh.indexOf(link.householdId) + 1), primary: link.primary, livesWith: link.livesWith === true, responsibility: link.responsibility === true };
      }),
      emergency: c.emergency.map(e => ({ ...e })),
      pickup: c.pickup.authorised.map(p => ({ name: p.name, relation: p.relation, phone: p.phone || '', idRef: p.idRef || '', status: p.status || 'authorised' })),
      restrictionsDeclared: c.restrictionsDeclared || (custody.length ? 'recorded' : ''),
      restrictions: [
        ...custody.map(a => ({ name: a.restrictedPerson || '', relation: a.relation || '', reason: a.detail, effective: a.effective || '', status: 'active', docId: a.docId || null })),
        ...(c.liftedRestrictions || []).map(r => ({ name: r.name, relation: r.relation, reason: r.reason, effective: r.effective, status: 'lifted', docId: r.docId || null }))
      ],
      health: {
        allergiesDeclared: c.healthDeclared?.allergies || '',
        allergies: c.alerts.filter(a => a.type === 'allergy').map(a => ({ allergen: a.detail, severity: a.severity || '', reaction: a.reaction || '', instructions: a.instructions || '', planDocId: a.planDocId || null })),
        conditionsDeclared: c.healthDeclared?.conditions || '',
        conditions: c.alerts.filter(a => a.type === 'medical').map(a => ({ name: a.detail, notes: a.instructions || '' })),
        medicationsDeclared: c.healthDeclared?.medications || '',
        medications: c.medications.map(m => ({ name: m.name, dose: m.dose || '', schedule: m.schedule || '', notes: m.notes || '', storedAt: m.storedAt || '', consent: m.consent || 'pending', docId: m.docId || null })),
        dietary: other.length ? [...chips, 'Other'] : chips, dietaryNotes: c.dietaryNotes || other.join('; '),
        immunisations: (c.immunisations || []).map(i => ({ ...i })), doctor: { name: '', clinic: '', phone: '', notes: '', ...(c.doctor || {}) }
      },
      classSchedule: { cls: c.cls, startDate: c.startDate, days: c.schedule?.days ? [...c.schedule.days] : [], session: c.schedule?.session || '' }
    };
  }
  // "Not yet collected" ('unknown') is a real answer and is shown as such when editing.
  const toPayload = s => {
    const p = JSON.parse(JSON.stringify({ ...s, child: { ...s.child, existingPhoto: undefined } }));
    if (s.child.photo !== undefined) p.child.photo = s.child.photo;
    return p;
  };

  // Paths like "guardians.0.name" read and write nested state.
  const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  const setPath = (obj, path, value) => { const ks = path.split('.'); const last = ks.pop(); const t = ks.reduce((o, k) => o[k], obj); t[last] = value; };

  /* ------------------------------------------------------------------ S14 wizard */

  function wizard(main, user) {
    const childId = params.get('id');
    let draftId = params.get('draft');
    let draft = draftId ? store.getDrafts().find(d => d.id === draftId) : null;
    if (draftId && !draft) draftId = null;
    if (childId && !store.childById(childId)) {
      main.innerHTML = `<article class="panel record"><div class="kids-empty"><h1 class="kids-empty__title">We couldn’t find that child</h1><p>The record may have been removed, or the link is incomplete.</p><a class="btn btn--primary" href="${routes.page('children')}">All children</a></div></article>`;
      return true;
    }
    const edit = Boolean(childId);
    // An edit with a saved draft offers to resume it; a draft link resumes straight away.
    const editDraft = edit && !draft ? store.getDrafts().find(d => d.childId === childId) : null;
    let state = draft ? draft.data : edit ? fromChild(childId) : blank();
    let step = draft ? Math.min(draft.step, STEPS.length - 1) : 0;
    let errors = {};
    let dirty = false;
    let attempted = new Set();
    let busy = false;
    let override = false;
    const name = () => `${state.child.firstName} ${state.child.lastName}`.trim() || 'New child';

    const allErrors = () => store.validateEnrolment(toPayload(state), { childId }).errors;
    const stepErrors = (i, all = allErrors()) => Object.fromEntries(Object.entries(all).filter(([k]) => STEPS[i].keys.some(p => k === p || k.startsWith(`${p}.`))));

    document.title = `${edit ? `Edit ${name()}` : 'Enrol child'} · Nexora`;
    main.classList.add('wiz-page');
    main.innerHTML = `
      <div class="wiz">
        <nav class="kids-crumbs" aria-label="Breadcrumb"><a href="${routes.page('children')}">Children</a>${edit ? ` / <a href="${routes.record(childId)}">${esc(name())}</a>` : ''} / <span aria-current="page">${edit ? 'Edit' : 'Enrol child'}</span></nav>
        <header class="wiz-top">
          <h1 class="kids-head__title" id="page-title" tabindex="-1">${edit ? `Edit ${esc(name())}` : 'Enrol child'}</h1>
          <p class="kids-head__sub" data-saved aria-live="polite">${draft ? `Draft saved ${esc(when(draft.updatedAt))}` : ''}</p>
        </header>
        <div class="wiz-resume" data-resume hidden></div>
        <div class="wiz-body">
          <nav class="wiz-steps" aria-label="Enrolment steps"><ol data-steps></ol></nav>
          <div class="wiz-mobile" data-mobile>
            <p class="wiz-mobile__label" data-mobile-label></p>
            <div class="wiz-progress" role="progressbar" aria-valuemin="1" aria-valuemax="5" data-progress><span></span></div>
          </div>
          <form class="panel wiz-card" novalidate data-form>
            <header class="wiz-card__head"><p class="wiz-card__n" data-step-n></p><h2 class="wiz-card__title" id="wiz-title" tabindex="-1" data-step-title></h2><p class="wiz-card__desc" data-step-desc></p></header>
            <div class="wiz-dupes" data-dupes hidden></div>
            <div class="wiz-fields" data-fields></div>
            <p class="field__hint field__hint--error" data-form-error role="alert" hidden></p>
          </form>
        </div>
        <footer class="wiz-foot">
          <button class="btn btn--secondary wiz-foot__back" type="button" data-back>${icon('arrow-left', 'icon--sm')}Back</button>
          <span class="wiz-foot__spacer"></span>
          <button class="btn btn--secondary" type="button" data-draft>Save draft</button>
          <button class="btn btn--primary kids-yellow" type="button" data-next></button>
        </footer>
      </div>`;
    const $ = s => main.querySelector(s);
    const formEl = $('[data-form]');

    /* ----------------------------- Field helpers */

    const hint = path => `<p class="field__hint field__hint--error" id="e-${path.replace(/\./g, '-')}" data-error-for="${path}"${errors[path] ? '' : ' hidden'}>${errors[path] ? `${icon('info')}${esc(errors[path])}` : ''}</p>`;
    const inv = path => (errors[path] ? ' aria-invalid="true"' : '');
    const fid = path => `f-${path.replace(/\./g, '-')}`;
    const text = (path, label, { req = false, type = 'text', help = '', attrs = '', readonly = false } = {}) => `
      <div class="field">
        <label class="field__label" for="${fid(path)}">${esc(label)}${req ? ' <span class="field__req" aria-hidden="true">*</span>' : ' <span class="field__extra">Optional</span>'}</label>
        <input class="input" id="${fid(path)}" name="${path}" type="${type}" value="${esc(getPath(state, path) ?? '')}" aria-describedby="e-${path.replace(/\./g, '-')}"${req ? ' required' : ''}${readonly ? ' readonly' : ''}${inv(path)} ${attrs}>
        ${help ? `<p class="field__hint">${esc(help)}</p>` : ''}${hint(path)}
      </div>`;
    const area = (path, label, { help = '' } = {}) => `
      <div class="field"><label class="field__label" for="${fid(path)}">${esc(label)} <span class="field__extra">Optional</span></label>
      <textarea class="input" id="${fid(path)}" name="${path}" rows="2">${esc(getPath(state, path) ?? '')}</textarea>${help ? `<p class="field__hint">${esc(help)}</p>` : ''}${hint(path)}</div>`;
    const select = (path, label, options, { req = false } = {}) => `
      <div class="field"><label class="field__label" for="${fid(path)}">${esc(label)}${req ? ' <span class="field__req" aria-hidden="true">*</span>' : ''}</label>
      <select class="input" id="${fid(path)}" name="${path}" aria-describedby="e-${path.replace(/\./g, '-')}"${inv(path)}>${options.map(([v, l]) => `<option value="${esc(v)}"${String(getPath(state, path) ?? '') === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>${hint(path)}</div>`;
    const toggle = (path, label) => `<label class="check wiz-toggle"><input type="checkbox" name="${path}" data-bool${getPath(state, path) ? ' checked' : ''}>${esc(label)}</label>`;
    const chips = (path, options, label) => `
      <fieldset class="wiz-chips"><legend class="field__label">${esc(label)}</legend>
        <div class="chip-row">${options.map(([v, l]) => `<button class="chip" type="button" aria-pressed="${(getPath(state, path) || []).includes(v)}" data-chip="${path}" data-value="${esc(v)}">${icon('check', 'icon--sm')}${esc(l)}</button>`).join('')}</div>${hint(path)}</fieldset>`;
    const radios = (path, label, options, { req = true } = {}) => `
      <fieldset class="wiz-radios"${inv(path)}><legend class="field__label">${esc(label)}${req ? ' <span class="field__req" aria-hidden="true">*</span>' : ''}</legend>
        <div class="wiz-radios__opts">${options.map(([v, l]) => `<label class="radio"><input type="radio" name="${path}" value="${esc(v)}"${getPath(state, path) === v ? ' checked' : ''}>${esc(l)}</label>`).join('')}</div>${hint(path)}</fieldset>`;
    const fileInput = (path, label, accept, existing) => `
      <div class="field"><label class="field__label" for="${fid(path)}">${esc(label)} <span class="field__extra">Optional</span></label>
      <input class="input" type="file" id="${fid(path)}" data-file="${path}" accept="${accept}">
      <p class="field__hint">${existing ? `${icon('file', 'icon--sm')}${esc(existing)}` : 'PDF, JPEG or PNG, up to 1 MB.'}</p>${hint(path)}</div>`;
    const rowTools = (list, i, n, { reorder = false, label = 'entry' } = {}) => `
      <div class="wiz-row__tools">
        ${reorder ? `<button class="btn btn--icon-ghost" type="button" data-move="${list}" data-i="${i}" data-dir="-1" aria-label="Move ${esc(label)} up"${i === 0 ? ' disabled' : ''}>${icon('arrow-left', 'icon--sm wiz-rot-up')}</button><button class="btn btn--icon-ghost" type="button" data-move="${list}" data-i="${i}" data-dir="1" aria-label="Move ${esc(label)} down"${i === n - 1 ? ' disabled' : ''}>${icon('arrow-left', 'icon--sm wiz-rot-down')}</button>` : ''}
        <button class="btn btn--sm btn--ghost" type="button" data-remove="${list}" data-i="${i}">${icon('x', 'icon--sm')}Remove</button>
      </div>`;

    /* ----------------------------- Steps */

    const STEP_HTML = [
      // 1 — Child details
      () => {
        const c = state.child;
        const photo = c.photo !== undefined ? c.photo : c.existingPhoto;
        return `
          <div class="wiz-photo">
            ${photo ? `<img class="kid-photo wiz-photo__img" src="${esc(photo)}" alt="Photo preview">` : `<span class="kid-photo kid-photo--initials wiz-photo__img" aria-hidden="true" data-initials>${esc(initialsOf(`${c.firstName} ${c.lastName}`))}</span>`}
            <div class="wiz-photo__ctl">
              <label class="btn btn--secondary btn--sm" for="f-photo">${icon('upload', 'icon--sm')}${photo ? 'Replace photo' : 'Upload photo'}</label>
              <input class="sr-only" type="file" id="f-photo" accept="image/png,image/jpeg,image/webp" data-photo>
              ${photo ? '<button class="btn btn--sm btn--ghost" type="button" data-photo-remove>Remove photo</button>' : ''}
              <p class="field__hint">PNG, JPEG or WebP, under 500 KB. Optional.</p>${hint('child.photo')}
            </div>
          </div>
          <div class="wiz-grid">
            ${text('child.firstName', 'First name', { req: true, attrs: 'autocomplete="off"' })}
            ${text('child.lastName', 'Last name', { req: true, attrs: 'autocomplete="off"' })}
            ${text('child.preferredName', 'Preferred name', { attrs: 'autocomplete="off"' })}
            <div class="field">
              <label class="field__label" for="f-child-dob">Date of birth <span class="field__req" aria-hidden="true">*</span></label>
              <input class="input" id="f-child-dob" name="child.dob" type="date" max="${store.today()}" value="${esc(c.dob)}" required aria-describedby="e-child-dob wiz-age"${inv('child.dob')}>
              <p class="wiz-age" id="wiz-age" aria-live="polite" data-age>${c.dob && c.dob <= store.today() ? `Age today: ${esc(ageLong(c.dob))}` : ''}</p>${hint('child.dob')}
            </div>
            ${select('child.gender', 'Gender (optional)', store.GENDERS)}
            ${text('child.nationality', 'Nationality', { attrs: 'list="wiz-countries" autocomplete="off"', help: 'Start typing to search.' })}
          </div>
          <datalist id="wiz-countries">${store.COUNTRIES.map(x => `<option value="${esc(x)}"></option>`).join('')}</datalist>
          ${chips('child.languages', store.LANGUAGES.map(l => [l, l]), 'Home languages (choose all that apply)')}`;
      },
      // 2 — Guardians & households
      () => {
        const linked = state.householdIds.length ? store.families().filter(f => state.householdIds.includes(f.id)) : [];
        return `
          <section class="wiz-section" aria-labelledby="wiz-find">
            <h3 class="wiz-section__title" id="wiz-find">Find an existing family</h3>
            <div class="input-wrap input-wrap--lead">${icon('search')}<label class="sr-only" for="wiz-family-q">Search families by guardian, phone or child name</label><input class="input" id="wiz-family-q" type="search" placeholder="Search by guardian, phone or child name" autocomplete="off" data-family-q></div>
            <ul class="wiz-families" data-families aria-live="polite"></ul>
            ${linked.length ? `<p class="wiz-note">${icon('check-circle', 'icon--sm')}Linked to ${linked.map(f => `<b>${esc(f.label)}</b>`).join(' and ')}. Linked guardians’ contact details are kept as they are.</p>` : ''}
          </section>
          <section class="wiz-section" aria-labelledby="wiz-gs">
            <h3 class="wiz-section__title" id="wiz-gs">Guardians</h3>${hint('guardians')}
            <div class="wiz-cards">${state.guardians.map((g, i) => `
              <details class="wiz-card-item" open>
                <summary><span class="wiz-avatar" aria-hidden="true">${esc(initialsOf(g.name))}</span><span class="wiz-card-item__name">${esc(g.name || `Guardian ${i + 1}`)}</span>${g.primary ? '<span class="badge badge--primary">Primary contact</span>' : ''}${state.secondHousehold ? `<span class="badge">Household ${g.household}</span>` : ''}${g.linked ? '<span class="badge badge--info">Linked record</span>' : ''}</summary>
                <div class="wiz-grid">
                  ${text(`guardians.${i}.name`, 'Full name', { req: true, readonly: g.linked })}
                  ${select(`guardians.${i}.relation`, 'Relationship to child', [['', 'Choose'], ...RELATIONS.map(r => [r, r])], { req: true })}
                  ${text(`guardians.${i}.phone`, 'Phone', { req: true, type: 'tel', readonly: g.linked })}
                  ${text(`guardians.${i}.email`, 'Email', { type: 'email', readonly: g.linked })}
                  ${state.secondHousehold ? select(`guardians.${i}.household`, 'Household', [[1, 'Household 1'], [2, 'Household 2']], { req: true }) : ''}
                </div>
                <div class="wiz-toggles">
                  <label class="radio"><input type="radio" name="guardians.primary" value="${i}"${g.primary ? ' checked' : ''}>Primary contact</label>
                  ${toggle(`guardians.${i}.livesWith`, 'Lives with child')}
                  ${toggle(`guardians.${i}.responsibility`, 'Has parental responsibility')}
                </div>
                ${state.guardians.length > 1 ? rowTools('guardians', i, state.guardians.length, { label: g.name || 'guardian' }) : ''}
              </details>`).join('')}</div>
            <div class="wiz-adds">
              <button class="btn btn--secondary btn--sm" type="button" data-add="guardians">${icon('plus', 'icon--sm')}Add guardian</button>
              ${state.secondHousehold ? '' : `<button class="btn btn--secondary btn--sm" type="button" data-second-household>${icon('plus', 'icon--sm')}Add second household</button>`}
            </div>
            <p class="field__hint">Parental responsibility is only recorded when you tick it — it isn’t assumed from the relationship.</p>
          </section>`;
      },
      // 3 — Emergency & pickup
      () => {
        const barred = state.restrictions.filter(r => r.status === 'active').map(r => r.name.trim().toLowerCase()).filter(Boolean);
        const clashes = state.pickup.filter(p => p.status === 'authorised' && barred.includes(p.name.trim().toLowerCase()));
        const passSet = Boolean(store.childById(childId)?.pickup?.passcode);
        return `
          <section class="wiz-section" aria-labelledby="wiz-em">
            <h3 class="wiz-section__title" id="wiz-em">Emergency contacts <span class="field__req" aria-hidden="true">*</span></h3>
            <p class="field__hint">Called in this order. Drag a card or use the arrows to reorder.</p>${hint('emergency')}
            <ol class="wiz-cards" data-sortable="emergency">${state.emergency.map((c, i) => `
              <li class="wiz-card-item wiz-card-item--row" draggable="true" data-drag="${i}">
                <span class="wiz-order" aria-hidden="true">${i + 1}</span>
                <div class="wiz-grid wiz-grid--3">
                  ${text(`emergency.${i}.name`, i === 0 ? 'Name (called first)' : 'Name', { req: true })}
                  ${text(`emergency.${i}.relation`, 'Relationship', { req: true })}
                  ${text(`emergency.${i}.phone`, 'Phone', { req: true, type: 'tel' })}
                </div>
                ${rowTools('emergency', i, state.emergency.length, { reorder: true, label: c.name || `contact ${i + 1}` })}
              </li>`).join('')}</ol>
            <button class="btn btn--secondary btn--sm" type="button" data-add="emergency">${icon('plus', 'icon--sm')}Add emergency contact</button>
          </section>
          <section class="wiz-section" aria-labelledby="wiz-pk">
            <h3 class="wiz-section__title" id="wiz-pk">Authorised to collect <span class="field__req" aria-hidden="true">*</span></h3>
            <p class="field__hint">Guardians are not added automatically. Pickup passcode: ${passSet ? 'set (reveal it from the child’s profile)' : 'not set yet — set it from the child’s profile after saving'}.</p>${hint('pickup')}
            ${state.guardians.some(g => g.name) ? `<div class="wiz-adds">${state.guardians.filter(g => g.name && !state.pickup.some(p => p.name.trim().toLowerCase() === g.name.trim().toLowerCase())).map(g => `<button class="btn btn--sm btn--ghost" type="button" data-pickup-from="${esc(g.name)}" data-rel="${esc(g.relation)}" data-phone="${esc(g.phone)}">${icon('plus', 'icon--sm')}Add ${esc(g.name)}</button>`).join('')}</div>` : ''}
            <div class="wiz-cards">${state.pickup.map((p, i) => `
              <div class="wiz-card-item wiz-card-item--row${p.status === 'authorised' ? '' : ' is-muted'}">
                <span class="wiz-avatar" aria-hidden="true">${esc(initialsOf(p.name))}</span>
                <div class="wiz-grid wiz-grid--3">
                  ${text(`pickup.${i}.name`, 'Full name', { req: true })}
                  ${text(`pickup.${i}.relation`, 'Relationship', { req: true })}
                  ${text(`pickup.${i}.phone`, 'Phone', { type: 'tel' })}
                  ${text(`pickup.${i}.idRef`, 'ID reference', { help: 'e.g. last 4 digits of the photo ID checked. Never the full number.' })}
                  ${select(`pickup.${i}.status`, 'Status', Object.entries(store.PICKUP_STATUS), { req: true })}
                </div>
                ${rowTools('pickup', i, state.pickup.length, { label: p.name || 'person' })}
              </div>`).join('')}</div>
            <button class="btn btn--secondary btn--sm" type="button" data-add="pickup">${icon('plus', 'icon--sm')}Add person</button>
          </section>
          <section class="wiz-section wiz-section--restrict" aria-labelledby="wiz-rs">
            <h3 class="wiz-section__title" id="wiz-rs">${icon('shield', 'icon--sm')}Restricted persons</h3>
            ${radios('restrictionsDeclared', 'Must anyone be stopped from collecting or contacting this child?', [['none', 'No — confirmed with the family'], ['recorded', 'Yes — record them below'], ['unknown', 'Not yet known']])}
            ${clashes.length ? `<div class="wiz-alert wiz-alert--danger" role="alert">${icon('alert-triangle')}<p><b>Conflict:</b> ${clashes.map(c => esc(c.name)).join(', ')} ${clashes.length === 1 ? 'is' : 'are'} authorised to collect <b>and</b> restricted. Remove the pickup authorisation or lift the restriction before saving.</p></div>` : ''}
            ${hint('restrictions')}
            ${state.restrictionsDeclared === 'recorded' || state.restrictions.length ? `<div class="wiz-cards">${state.restrictions.map((r, i) => `
              <div class="wiz-card-item wiz-restrict${r.status === 'active' ? ' is-active' : ''}">
                <div class="wiz-grid">
                  ${text(`restrictions.${i}.name`, 'Person’s name', { req: true })}
                  ${text(`restrictions.${i}.relation`, 'Relationship (if known)')}
                  ${text(`restrictions.${i}.reason`, 'Reason', { req: true, help: 'e.g. Court order dated 12 Mar 2026 — no contact.' })}
                  ${text(`restrictions.${i}.effective`, 'Effective from', { type: 'date' })}
                  ${select(`restrictions.${i}.status`, 'Status', Object.entries(store.RESTRICTION_STATUS), { req: true })}
                  ${fileInput(`restrictions.${i}.file`, 'Supporting document', 'application/pdf,image/jpeg,image/png', r.file?.fileName || (r.docId ? 'Document on file' : ''))}
                </div>
                ${rowTools('restrictions', i, state.restrictions.length, { label: r.name || 'restriction' })}
              </div>`).join('')}</div>
              <button class="btn btn--secondary btn--sm" type="button" data-add="restrictions">${icon('plus', 'icon--sm')}Add restricted person</button>` : ''}
          </section>`;
      },
      // 4 — Health
      () => {
        const h = state.health;
        const decl = (k, label) => radios(`health.${k}Declared`, label, Object.entries(store.DECLARATIONS));
        const list = (k, items, addLabel, body) => h[`${k}Declared`] === 'recorded' ? `${hint(`health.${k}`)}<div class="wiz-cards">${h[k].map((x, i) => `<div class="wiz-card-item">${body(x, i)}${rowTools(`health.${k}`, i, h[k].length)}</div>`).join('')}</div><button class="btn btn--secondary btn--sm" type="button" data-add="health.${k}">${icon('plus', 'icon--sm')}${addLabel}</button>` : '';
        return `
          <section class="wiz-section" aria-labelledby="wiz-al"><h3 class="wiz-section__title" id="wiz-al">Allergies</h3>
            ${decl('allergies', 'Does the child have any allergies?')}
            ${list('allergies', h.allergies, 'Add allergy', (a, i) => `<div class="wiz-grid${a.severity === 'severe' ? ' wiz-severe' : ''}">
              ${text(`health.allergies.${i}.allergen`, 'Allergen', { req: true })}
              ${select(`health.allergies.${i}.severity`, 'Severity', [['', 'Choose'], ['severe', 'Severe'], ['moderate', 'Moderate'], ['mild', 'Mild']], { req: true })}
              ${text(`health.allergies.${i}.reaction`, 'Reaction', { req: a.severity === 'severe', help: a.severity === 'severe' ? 'Required for a severe allergy.' : '' })}
              ${text(`health.allergies.${i}.instructions`, 'What staff should do', { help: 'Copy from the action plan — don’t paraphrase.' })}
              ${fileInput(`health.allergies.${i}.planFile`, 'Action plan', 'application/pdf,image/jpeg,image/png', a.planFile?.fileName || (a.planDocId ? 'Action plan on file' : ''))}</div>`)}
          </section>
          <section class="wiz-section" aria-labelledby="wiz-mc"><h3 class="wiz-section__title" id="wiz-mc">Medical conditions</h3>
            ${decl('conditions', 'Does the child have any medical conditions?')}
            ${list('conditions', h.conditions, 'Add condition', (c, i) => `<div class="wiz-grid">${text(`health.conditions.${i}.name`, 'Condition', { req: true })}${text(`health.conditions.${i}.notes`, 'Notes / what staff should do')}</div>`)}
          </section>
          <section class="wiz-section" aria-labelledby="wiz-md"><h3 class="wiz-section__title" id="wiz-md">Medications</h3>
            ${decl('medications', 'Does the child take any medication at school?')}
            ${list('medications', h.medications, 'Add medication', (m, i) => `<div class="wiz-grid">${text(`health.medications.${i}.name`, 'Medication', { req: true })}${text(`health.medications.${i}.dose`, 'Dose / instructions', { req: true })}${text(`health.medications.${i}.schedule`, 'Schedule')}${text(`health.medications.${i}.storedAt`, 'Kept in')}${select(`health.medications.${i}.consent`, 'Consent to administer', Object.entries(store.MED_CONSENT), { req: true })}${text(`health.medications.${i}.notes`, 'Notes')}${fileInput(`health.medications.${i}.file`, 'Prescription or consent form', 'application/pdf,image/jpeg,image/png', m.file?.fileName || (m.docId ? 'Document on file' : ''))}</div>`)}
            <p class="field__hint">Staff only give medication when written consent is on file.</p>
          </section>
          <section class="wiz-section" aria-labelledby="wiz-dt"><h3 class="wiz-section__title" id="wiz-dt">Dietary needs</h3>
            ${chips('health.dietary', store.DIETARY_OPTIONS.map(d => [d, d]), 'Choose all that apply (optional)')}
            ${area('health.dietaryNotes', 'Dietary notes', { help: 'Required if you chose Other.' })}
          </section>
          <section class="wiz-section" aria-labelledby="wiz-im"><h3 class="wiz-section__title" id="wiz-im">Immunisations</h3>
            <p class="field__hint">Record only what the family has provided. No record here does not mean a vaccine was skipped or given.</p>
            <div class="wiz-cards">${h.immunisations.map((m, i) => `<div class="wiz-card-item"><div class="wiz-grid wiz-grid--3">${text(`health.immunisations.${i}.vaccine`, 'Vaccine', { req: true })}${text(`health.immunisations.${i}.date`, 'Date given', { type: 'date' })}${text(`health.immunisations.${i}.notes`, 'Notes')}</div>${rowTools('health.immunisations', i, h.immunisations.length)}</div>`).join('')}</div>
            <button class="btn btn--secondary btn--sm" type="button" data-add="health.immunisations">${icon('plus', 'icon--sm')}Add immunisation</button>
          </section>
          <section class="wiz-section" aria-labelledby="wiz-dr"><h3 class="wiz-section__title" id="wiz-dr">Doctor</h3>
            <div class="wiz-grid">${text('health.doctor.name', 'Doctor’s name')}${text('health.doctor.clinic', 'Clinic or practice')}${text('health.doctor.phone', 'Phone', { type: 'tel' })}${text('health.doctor.notes', 'Notes')}</div>
          </section>`;
      },
      // 5 — Class & schedule
      () => {
        const cs = state.classSchedule;
        const info = store.classesInfo(childId);
        const sel = info.find(c => c.name === cs.cls);
        const current = edit ? store.childById(childId) : null;
        const blocked = sel?.full && !(current && current.cls === sel.name && ['active', 'starting'].includes(current.status));
        return `
          <fieldset class="wiz-classes"${inv('classSchedule.cls')}><legend class="field__label">Class <span class="field__req" aria-hidden="true">*</span></legend>
            <div class="wiz-class-list">${info.map(c => {
              const pct = c.capacity ? Math.min(100, Math.round((c.occupancy / c.capacity) * 100)) : 0;
              return `<label class="wiz-class${c.full ? ' is-full' : ''}">
                <input type="radio" name="classSchedule.cls" value="${esc(c.name)}"${cs.cls === c.name ? ' checked' : ''}>
                <span class="wiz-class__top"><b>${esc(c.name)}</b><span>${c.capacity == null ? 'Capacity not set' : `${c.occupancy} of ${c.capacity} seats`}</span></span>
                <span class="wiz-class__meta">${esc(c.teacher || 'No teacher assigned')}${c.capacity == null ? '' : ` · ${c.full ? 'Full' : `${c.remaining} left`}`}</span>
                <span class="wiz-bar" aria-hidden="true"><span style="width:${pct}%"></span></span>
              </label>`;
            }).join('')}</div>${hint('classSchedule.cls')}
          </fieldset>
          ${blocked ? `<div class="wiz-alert wiz-alert--warn" role="status">${icon('alert-triangle')}<div><p><b>${esc(sel.name)} is full</b> (${sel.occupancy} of ${sel.capacity} seats). A child can’t be enrolled above capacity.</p><button class="btn btn--sm btn--secondary" type="button" data-waitlist>${icon('plus', 'icon--sm')}Add to waitlist</button></div></div>` : ''}
          <div class="wiz-grid">
            ${text('classSchedule.startDate', 'Start date', { req: true, type: 'date', help: edit ? '' : 'Up to 30 days ago, or any date in the next year.' })}
          </div>
          ${chips('classSchedule.days', store.schoolDays().map(d => [d, DAY_LABEL[d]]), 'Days attending *')}
          ${radios('classSchedule.session', 'Session', Object.entries(store.SESSIONS))}`;
      }
    ];

    /* ----------------------------- Rendering */

    function renderSteps(all = allErrors()) {
      $('[data-steps]').innerHTML = STEPS.map((s, i) => {
        const errs = Object.keys(stepErrors(i, all)).length;
        const done = !errs;
        const showBad = errs && attempted.has(i);
        return `<li><button class="wiz-step${i === step ? ' is-current' : ''}${done ? ' is-done' : ''}${showBad ? ' is-bad' : ''}" type="button" data-goto="${i}"${i === step ? ' aria-current="step"' : ''}>
          <span class="wiz-step__dot" aria-hidden="true">${done ? icon('check', 'icon--sm') : showBad ? '!' : i + 1}</span>
          <span class="wiz-step__text"><span class="wiz-step__title">${esc(s.title)}</span><span class="wiz-step__state">${done ? 'Complete' : showBad ? `${errs} to fix` : 'Not complete'}</span></span>
        </button></li>`;
      }).join('');
      $('[data-mobile-label]').textContent = `Step ${step + 1} of ${STEPS.length} — ${STEPS[step].title}`;
      const bar = $('[data-progress]');
      bar.setAttribute('aria-valuenow', String(step + 1));
      bar.setAttribute('aria-label', `Step ${step + 1} of ${STEPS.length}`);
      bar.querySelector('span').style.width = `${((step + 1) / STEPS.length) * 100}%`;
    }

    function render({ focus = null } = {}) {
      const s = STEPS[step];
      $('[data-step-n]').textContent = `Step ${step + 1} of ${STEPS.length}`;
      $('[data-step-title]').textContent = s.title;
      $('[data-step-desc]').textContent = s.desc;
      $('[data-fields]').innerHTML = STEP_HTML[step]();
      $('[data-back]').disabled = step === 0;
      const last = step === STEPS.length - 1;
      $('[data-next]').innerHTML = last ? (edit ? 'Save changes' : 'Save child') : `Next${icon('arrow-right', 'icon--sm')}`;
      renderSteps();
      renderDupes();
      if (step === 1) drawFamilies();
      formEl.classList.remove('is-entering');
      void formEl.offsetWidth;
      formEl.classList.add('is-entering');
      if (focus === 'title') $('#wiz-title').focus();
      else if (focus) main.querySelector(`[name="${focus}"], [data-error-for="${focus}"]`)?.focus();
    }

    // Reads every field on the current step back into state.
    function collect() {
      const fields = $('[data-fields]');
      fields.querySelectorAll('[name]').forEach(el => {
        const path = el.name;
        if (path === 'guardians.primary') { if (el.checked) state.guardians.forEach((g, i) => { g.primary = String(i) === el.value; }); return; }
        if (el.type === 'radio') { if (el.checked) setPath(state, path, path.endsWith('household') ? Number(el.value) : el.value); return; }
        if (el.dataset.bool !== undefined) { setPath(state, path, el.checked); return; }
        if (el.readOnly) return;
        setPath(state, path, path.endsWith('.household') ? Number(el.value) : el.value);
      });
    }

    function showErrors(errs) {
      errors = errs;
      render();
      const first = Object.keys(errs)[0];
      const target = first && (main.querySelector(`[name="${first}"]:not([type=radio])`) || main.querySelector(`[name="${first}"]`) || main.querySelector(`[data-error-for="${first}"]`));
      if (target) { target.focus?.(); if (!target.matches('input, select, textarea, button')) target.scrollIntoView({ block: 'center' }); }
    }

    function go(to, { validate = false } = {}) {
      collect();
      if (validate) {
        attempted.add(step);
        const errs = stepErrors(step);
        if (Object.keys(errs).length) { showErrors(errs); return; }
      }
      errors = to < step ? {} : errors;
      step = to;
      errors = {};
      render({ focus: 'title' });
      main.querySelector('.wiz-card').scrollIntoView({ block: 'start', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }

    /* ----------------------------- Duplicates */

    function renderDupes() {
      const box = $('[data-dupes]');
      const dupes = store.findDuplicates(state.child, childId);
      box.hidden = !dupes.length;
      box.innerHTML = dupes.length ? `<div class="wiz-alert wiz-alert--warn" role="status">${icon('alert-triangle')}<div><p><b>Possible duplicate:</b> ${dupes.map(d => `<a href="${routes.record(d.id)}" target="_blank" rel="noopener">${esc(d.name)} (${esc(d.cls)}${d.status !== 'active' ? `, ${esc(store.CHILD_STATUSES[d.status])}` : ''})</a>`).join(', ')}. Same name and date of birth. Check the existing record before enrolling again.</p></div></div>` : '';
    }

    /* ----------------------------- Family search */

    function drawFamilies() {
      const q = $('[data-family-q]')?.value.trim() || '';
      const list = $('[data-families]');
      if (!list) return;
      if (q.length < 2) { list.innerHTML = ''; return; }
      const found = store.families(q).slice(0, 6);
      list.innerHTML = found.length ? found.map(f => `<li class="wiz-family">
          <div><p class="wiz-family__name">${esc(f.label)}</p><p class="cp-muted">${f.guardians.map(g => `${esc(g.name)} · ${esc(g.phone)}`).join('<br>')}</p>${f.children.length ? `<p class="cp-muted">Children: ${f.children.map(c => esc(`${c.name} (${c.cls})`)).join(', ')}</p>` : ''}</div>
          <button class="btn btn--sm btn--secondary" type="button" data-link-family="${esc(f.id)}"${state.householdIds.includes(f.id) ? ' disabled' : ''}>${state.householdIds.includes(f.id) ? 'Linked' : 'Link this family'}</button>
        </li>`).join('') : `<li class="cp-muted">No family matches “${esc(q)}”. Add the guardians below to create a new family.</li>`;
    }

    function linkFamily(id) {
      collect();
      const f = store.families().find(x => x.id === id);
      if (!f) return;
      const slot = state.householdIds.length ? 2 : 1;
      if (slot === 2) state.secondHousehold = true;
      state.householdIds = slot === 1 ? [f.id] : [state.householdIds[0], f.id];
      // Replace only blank, unlinked guardian cards; never overwrite what was typed.
      state.guardians = state.guardians.filter(g => g.linked || g.name.trim() || g.phone.trim());
      f.guardians.forEach(g => {
        if (state.guardians.some(x => x.guardianId === g.id)) return;
        state.guardians.push({ guardianId: g.id, linked: true, name: g.name, relation: '', phone: g.phone, email: g.email, household: slot, primary: false, livesWith: false, responsibility: false });
      });
      if (!state.guardians.some(g => g.primary) && state.guardians.length) state.guardians[0].primary = true;
      markDirty();
      render();
      window.NexoraToast?.show('Family linked', `${f.label}: choose each guardian’s relationship to this child.`);
    }

    /* ----------------------------- Draft, dirty state, leaving */

    const savedLabel = $('[data-saved]');
    function markDirty() { dirty = true; savedLabel.textContent = 'Unsaved changes'; }
    async function saveDraft({ quiet = false } = {}) {
      collect();
      const r = await store.saveDraft(user, { id: draftId, childId, step, data: state });
      if (!r.ok) { window.NexoraToast?.show('Draft not saved', r.message || 'This couldn’t be saved on this device. Your entries are still here.', 'info'); return false; }
      draftId = r.draft.id;
      dirty = false;
      savedLabel.textContent = `Draft saved ${when(r.draft.updatedAt)}`;
      const q = new URLSearchParams(location.search);
      q.set('draft', draftId);
      history.replaceState(null, '', `${location.pathname}?${q}`);
      if (!quiet) window.NexoraToast?.show('Draft saved', `${name()} — step ${step + 1} of 5. Resume it from Children.`);
      return true;
    }
    addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
    // In-app links: ask before leaving with unsaved changes.
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href]');
      if (!a || !dirty || a.target === '_blank' || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      const d = kids.dialog({
        label: 'Enrol child / Unsaved changes', title: 'Leave without saving?', desc: 'You have changes that aren’t saved yet.',
        body: '', submit: 'Save draft and leave',
        async onSubmit() { const ok = await saveDraft({ quiet: true }); if (ok) location.href = a.href; return ok ? { ok: true } : { ok: false, message: 'The draft couldn’t be saved.' }; }
      });
      const foot = d.form.querySelector('.modal__foot');
      foot.querySelector('[data-close]').textContent = 'Keep editing';
      foot.insertAdjacentHTML('beforeend', '<button class="btn btn--ghost" type="button" data-leave>Leave without saving</button>');
      foot.querySelector('[data-leave]').addEventListener('click', () => { dirty = false; location.href = a.href; });
    }, true);

    /* ----------------------------- Final save */

    async function finish() {
      collect();
      STEPS.forEach((_, i) => attempted.add(i));
      const all = allErrors();
      const firstBad = STEPS.findIndex((_, i) => Object.keys(stepErrors(i, all)).length);
      if (firstBad >= 0) {
        step = firstBad;
        showErrors(stepErrors(firstBad, all));
        $('[data-form-error]').hidden = false;
        $('[data-form-error]').innerHTML = `${icon('info')}Some required details are missing or invalid. Fix them here, then save again.`;
        return;
      }
      if (busy) return;
      busy = true;
      const btn = $('[data-next]');
      const label = btn.innerHTML;
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>Saving…';
      btn.setAttribute('aria-busy', 'true');
      btn.disabled = true;
      const r = await store.enrolChild(user, toPayload(state), { childId, draftId, overrideDuplicate: override });
      busy = false;
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.innerHTML = label;
      if (r.ok) {
        dirty = false;
        try { sessionStorage.setItem(FLASH_KEY, JSON.stringify(r.created ? { title: `${store.childName(r.child)} enrolled`, text: `${r.child.cls} · starts ${day(r.child.startDate)}.` } : { title: 'Changes saved successfully', text: `${store.childName(r.child)}’s record is up to date.` })); } catch { /* toast optional */ }
        location.href = routes.record(r.child.id);
        return;
      }
      if (r.reason === 'duplicate') {
        const d = kids.dialog({
          label: 'Enrol child / Possible duplicate', title: 'This child may already be on record',
          desc: `Same name and date of birth: ${r.duplicates.map(x => `<a href="${routes.record(x.id)}" target="_blank" rel="noopener">${esc(x.name)} (${esc(x.cls)})</a>`).join(', ')}.`,
          body: '<label class="check"><input type="checkbox" name="confirm" required>I’ve checked the existing record and this is a different child.</label><p class="field__hint field__hint--error" data-error-for="confirm" hidden></p>',
          submit: 'Enrol as a different child',
          async onSubmit(form) {
            if (!form.elements.confirm.checked) return { ok: false, errors: { confirm: 'Tick the box to confirm, or review the existing record.' } };
            override = true;
            setTimeout(finish, 0);
            return { ok: true };
          }
        });
        void d;
        return;
      }
      if (r.reason === 'full') { step = 4; render(); $('[data-form-error]').hidden = false; $('[data-form-error]').innerHTML = `${icon('info')}${esc(r.info.name)} filled up before you saved. Choose another class or add the child to the waitlist.`; return; }
      if (r.errors) { const first = STEPS.findIndex((_, i) => Object.keys(stepErrors(i, r.errors)).length); step = first >= 0 ? first : step; showErrors(r.errors); if (r.errors.files) { $('[data-form-error]').hidden = false; $('[data-form-error]').innerHTML = `${icon('info')}${esc(r.errors.files)}`; } return; }
      $('[data-form-error]').hidden = false;
      $('[data-form-error]').innerHTML = `${icon('info')}${esc(r.message || (r.reason === 'forbidden' ? 'Your role can’t enrol children.' : 'This couldn’t be saved. Your entries are still here.'))}`;
    }

    /* ----------------------------- Events */

    const readFile = (file, { image = false } = {}) => new Promise((resolve, reject) => {
      if (!file) { resolve(null); return; }
      const ok = image ? /^image\/(png|jpeg|webp)$/.test(file.type) && file.size <= 500 * 1024 : store.DOC_TYPES[file.type] && file.size <= store.DOC_MAX;
      if (!ok) { reject(new Error(image ? 'Use a PNG, JPEG or WebP image under 500 KB.' : 'Use a PDF, JPEG or PNG file of 1 MB or less.')); return; }
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('That file couldn’t be read.'));
      r.readAsDataURL(file);
    });

    const blankRow = {
      guardians: () => ({ guardianId: null, name: '', relation: '', phone: '', email: '', household: state.secondHousehold ? 2 : 1, primary: !state.guardians.length, livesWith: false, responsibility: false }),
      emergency: () => ({ name: '', relation: '', phone: '' }),
      pickup: () => ({ name: '', relation: '', phone: '', idRef: '', status: 'authorised' }),
      restrictions: () => ({ name: '', relation: '', reason: '', effective: '', status: 'active', docId: null }),
      'health.allergies': () => ({ allergen: '', severity: '', reaction: '', instructions: '', planDocId: null }),
      'health.conditions': () => ({ name: '', notes: '' }),
      'health.medications': () => ({ name: '', dose: '', schedule: '', notes: '', storedAt: '', consent: 'pending', docId: null }),
      'health.immunisations': () => ({ vaccine: '', date: '', notes: '' })
    };

    main.addEventListener('input', e => {
      if (!formEl.contains(e.target) || e.target.type === 'file' || e.target.matches('[data-family-q]')) { if (e.target.matches('[data-family-q]')) drawFamilies(); return; }
      markDirty();
      if (e.target.name === 'child.dob') {
        const v = e.target.value;
        $('[data-age]').textContent = v && v <= store.today() ? `Age today: ${ageLong(v)}` : v ? 'Date of birth can’t be in the future.' : '';
      }
      if (['child.firstName', 'child.lastName', 'child.dob'].includes(e.target.name)) {
        collect();
        renderDupes();
        const ini = $('[data-initials]');
        if (ini) ini.textContent = initialsOf(`${state.child.firstName} ${state.child.lastName}`);
      }
    });
    main.addEventListener('change', async e => {
      const t = e.target;
      if (t.matches('[data-photo]')) {
        try { const data = await readFile(t.files[0], { image: true }); if (data) { collect(); state.child.photo = data; markDirty(); errors = {}; render(); } }
        catch (err) { errors = { 'child.photo': err.message }; render(); }
        return;
      }
      if (t.matches('[data-file]')) {
        const path = t.dataset.file;
        try {
          const f = t.files[0];
          const data = await readFile(f);
          collect();
          setPath(state, path, data ? { data, mime: f.type, size: f.size, fileName: f.name, name: f.name } : null);
          markDirty();
          delete errors[path];
          render();
        } catch (err) { collect(); errors = { ...errors, [path]: err.message }; render(); }
        return;
      }
      if (formEl.contains(t) && (t.type === 'radio' || t.tagName === 'SELECT' || t.type === 'checkbox')) {
        collect();
        markDirty();
        // Choices that change which fields are shown re-render the step.
        if (/Declared$|^restrictionsDeclared$|\.severity$|\.status$|^classSchedule\.cls$/.test(t.name)) render({ focus: t.name });
        else renderSteps();
      }
    });
    main.addEventListener('click', e => {
      const t = e.target;
      const goto = t.closest('[data-goto]');
      if (goto) { const to = Number(goto.dataset.goto); if (to !== step) go(to, { validate: to > step }); return; }
      const chip = t.closest('[data-chip]');
      if (chip) {
        collect();
        const arr = getPath(state, chip.dataset.chip) || [];
        const v = chip.dataset.value;
        setPath(state, chip.dataset.chip, arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
        chip.setAttribute('aria-pressed', String(!arr.includes(v)));
        markDirty();
        renderSteps();
        return;
      }
      const add = t.closest('[data-add]');
      if (add) {
        collect();
        const path = add.dataset.add;
        getPath(state, path).push(blankRow[path]());
        markDirty();
        render();
        const items = main.querySelectorAll('.wiz-card-item');
        items[items.length - 1]?.querySelector('input:not([readonly]), select')?.focus();
        return;
      }
      const rm = t.closest('[data-remove]');
      if (rm) {
        collect();
        const path = rm.dataset.remove;
        const i = Number(rm.dataset.i);
        const item = getPath(state, path)[i];
        const removeIt = () => {
          getPath(state, path).splice(i, 1);
          if (path === 'guardians' && !state.guardians.some(g => g.primary) && state.guardians[0]) state.guardians[0].primary = true;
          markDirty();
          render();
        };
        // A linked guardian is a shared record: confirm, and only the link to this child goes.
        if (path === 'guardians' && item.linked) {
          kids.dialog({
            label: 'Enrol child / Guardians', title: `Remove ${item.name} from this child?`, desc: `${esc(item.name)} stays on record for any other children in the family. Only the link to this child is removed when you save.`,
            body: '', submit: 'Remove', danger: true, async onSubmit() { removeIt(); return { ok: true }; }
          });
        } else removeIt();
        return;
      }
      const mv = t.closest('[data-move]');
      if (mv) {
        collect();
        const list = getPath(state, mv.dataset.move);
        const i = Number(mv.dataset.i);
        const j = i + Number(mv.dataset.dir);
        if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
        markDirty();
        render();
        main.querySelector(`[data-move="${mv.dataset.move}"][data-i="${j}"][data-dir="${mv.dataset.dir}"]`)?.focus() || main.querySelector(`[data-move="${mv.dataset.move}"][data-i="${j}"]`)?.focus();
        return;
      }
      if (t.closest('[data-second-household]')) { collect(); state.secondHousehold = true; state.guardians.push(blankRow.guardians()); state.guardians[state.guardians.length - 1].household = 2; markDirty(); render(); return; }
      const fam = t.closest('[data-link-family]');
      if (fam) { linkFamily(fam.dataset.linkFamily); return; }
      const fromG = t.closest('[data-pickup-from]');
      if (fromG) { collect(); state.pickup.push({ name: fromG.dataset.pickupFrom, relation: fromG.dataset.rel, phone: fromG.dataset.phone, idRef: '', status: 'authorised' }); markDirty(); render(); return; }
      if (t.closest('[data-photo-remove]')) { collect(); state.child.photo = ''; state.child.existingPhoto = null; markDirty(); render(); return; }
      if (t.closest('[data-waitlist]')) { waitlist(); return; }
      if (t.closest('[data-back]')) { if (step > 0) go(step - 1); return; }
      if (t.closest('[data-draft]')) { saveDraft(); return; }
      if (t.closest('[data-next]')) { if (step === STEPS.length - 1) finish(); else go(step + 1, { validate: true }); }
    });

    // Drag-and-drop reordering for emergency contacts (the arrow buttons do the same from the keyboard).
    let dragFrom = null;
    main.addEventListener('dragstart', e => { const li = e.target.closest('[data-drag]'); if (!li) return; collect(); dragFrom = Number(li.dataset.drag); e.dataTransfer.effectAllowed = 'move'; li.classList.add('is-dragging'); });
    main.addEventListener('dragover', e => { if (dragFrom != null && e.target.closest('[data-drag]')) e.preventDefault(); });
    main.addEventListener('drop', e => {
      const li = e.target.closest('[data-drag]');
      if (dragFrom == null || !li) return;
      e.preventDefault();
      const to = Number(li.dataset.drag);
      const [m] = state.emergency.splice(dragFrom, 1);
      state.emergency.splice(to, 0, m);
      dragFrom = null;
      markDirty();
      render();
    });
    main.addEventListener('dragend', () => { dragFrom = null; main.querySelectorAll('.is-dragging').forEach(x => x.classList.remove('is-dragging')); });

    async function waitlist() {
      collect();
      const g = state.guardians.find(x => x.primary) || state.guardians[0] || {};
      const r = await store.addToWaitlist(user, { firstName: state.child.firstName, lastName: state.child.lastName, dob: state.child.dob, cls: state.classSchedule.cls, startDate: state.classSchedule.startDate, guardianName: g.name, guardianPhone: g.phone });
      if (!r.ok) {
        const missing = r.errors ? Object.values(r.errors).join(' ') : 'This couldn’t be saved.';
        window.NexoraToast?.show('Not added to the waitlist', missing, 'info');
        if (r.errors?.name || r.errors?.dob) { step = 0; showErrors({ 'child.firstName': r.errors.name, 'child.dob': r.errors.dob }); }
        return;
      }
      dirty = false;
      if (draftId) store.deleteDraft(user, draftId);
      try { sessionStorage.setItem(FLASH_KEY, JSON.stringify({ title: `Added to the ${r.entry.cls} waitlist`, text: `${r.entry.firstName} ${r.entry.lastName} is number ${r.position}. Not enrolled.` })); } catch { /* toast optional */ }
      location.href = routes.page('waitlist', { focus: r.entry.id });
    }

    // Edit with a saved draft: offer to resume it.
    if (editDraft) {
      const box = $('[data-resume]');
      box.hidden = false;
      box.innerHTML = `<div class="wiz-alert wiz-alert--info">${icon('info')}<div><p>You have a draft of these changes from ${esc(when(editDraft.updatedAt))} (step ${editDraft.step + 1}).</p><div class="wiz-adds"><button class="btn btn--sm btn--secondary" type="button" data-resume-yes>Resume draft</button><button class="btn btn--sm btn--ghost" type="button" data-resume-no>Discard draft</button></div></div></div>`;
      box.addEventListener('click', e => {
        if (e.target.closest('[data-resume-yes]')) { draftId = editDraft.id; state = editDraft.data; step = editDraft.step; box.hidden = true; render({ focus: 'title' }); }
        if (e.target.closest('[data-resume-no]')) { store.deleteDraft(user, editDraft.id); box.hidden = true; window.NexoraToast?.show('Draft discarded'); }
      });
    }

    render();
    $('#page-title').focus();
    return true;
  }

  /* ------------------------------------------------------------------ S09 Waitlist */

  function waitlistPage(main, user) {
    const focus = params.get('focus');
    const draw = () => {
      const list = store.getWaitlist().filter(w => w.status === 'waiting');
      const byClass = store.rosterClasses.map(c => ({ ...store.classInfo(c.name), entries: list.filter(w => w.cls === c.name) })).filter(c => c.entries.length);
      main.innerHTML = `<div class="kids">
        <header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Waitlist <span class="kids-head__count">(${list.length})</span></h1><p class="kids-head__sub">Children waiting for a seat. A waitlisted child is not enrolled.</p></div></header>
        ${byClass.length ? byClass.map(c => `<section class="cp-card" aria-labelledby="wl-${esc(c.name.replace(/\s/g, ''))}">
          <header class="cp-card__head"><h2 class="cp-card__title" id="wl-${esc(c.name.replace(/\s/g, ''))}">${esc(c.name)}</h2><span class="cp-muted">${c.capacity == null ? '' : `${c.occupancy} of ${c.capacity} seats${c.full ? ' · full' : ` · ${c.remaining} free`}`}</span></header>
          <ol class="wl-list">${c.entries.map((w, i) => `<li class="wl-row${w.id === focus ? ' is-focus' : ''}" id="wl-${esc(w.id)}"><span class="wl-pos">${i + 1}</span><div><p><b>${esc(w.firstName)} ${esc(w.lastName)}</b> · ${esc(store.ageParts(w.dob).years)}y ${esc(store.ageParts(w.dob).months)}m</p><p class="cp-muted">Wants to start ${esc(day(w.startDate))}${w.guardianName ? ` · ${esc(w.guardianName)} ${esc(w.guardianPhone)}` : ''} · added ${esc(day(w.createdAt))} by ${esc(w.addedBy)}</p></div></li>`).join('')}</ol>
        </section>`).join('') : '<div class="kids-empty"><h2 class="kids-empty__title">Nobody is waiting</h2><p>Children added from a full class during enrolment appear here.</p></div>'}
      </div>`;
    };
    document.title = 'Waitlist · Nexora';
    main.classList.add('kids-page');
    draw();
    try { const f = JSON.parse(sessionStorage.getItem(FLASH_KEY)); sessionStorage.removeItem(FLASH_KEY); if (f) window.NexoraToast?.show(f.title, f.text); } catch { /* none */ }
    (focus && main.querySelector(`#wl-${CSS.escape(focus)}`))?.scrollIntoView({ block: 'center' });
    store.subscribe(({ key }) => { if (!key || /^nexora-(waitlist|children)/.test(key)) draw(); });
    void user;
    return true;
  }

  /* ------------------------------------------------------------------ S15 Families */

  function familiesPage(main, user) {
    const scope = store.classScope(user);
    let q = '';
    const draw = () => {
      // Teachers see only families with a child in their classes.
      const list = store.families(q).filter(f => user.role !== 'Teacher' || f.children.some(c => scope.includes(c.cls)));
      main.querySelector('[data-list]').innerHTML = list.length ? list.map(f => `<li class="cp-card fam-card">
        <h2 class="cp-card__title">${esc(f.label)}</h2>
        <ul class="cp-people">${f.guardians.map(g => `<li><b>${esc(g.name)}</b><span>${esc(g.phone)}${g.email ? ` · ${esc(g.email)}` : ''}</span></li>`).join('')}</ul>
        <p class="cp-muted">${f.children.length ? f.children.map(c => `<a href="${routes.record(c.id)}">${esc(c.name)}</a> (${esc(c.cls)}${c.status !== 'active' ? `, ${esc(store.CHILD_STATUSES[c.status])}` : ''})`).join(', ') : 'No children linked'}</p>
      </li>`).join('') : '<li class="kids-empty"><p class="kids-empty__title">No families match</p></li>';
      main.querySelector('[data-count]').textContent = `(${list.length})`;
    };
    document.title = 'Families · Nexora';
    main.classList.add('kids-page');
    main.innerHTML = `<div class="kids">
      <header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Families <span class="kids-head__count" data-count></span></h1><p class="kids-head__sub">Households and their guardians. Siblings share one family record.</p></div></header>
      <div class="input-wrap input-wrap--lead kids-search">${icon('search')}<label class="sr-only" for="fam-q">Search families</label><input class="input" id="fam-q" type="search" placeholder="Search by guardian, phone or child name" data-q></div>
      <ul class="cp-grid" data-list></ul></div>`;
    main.querySelector('[data-q]').addEventListener('input', e => { q = e.target.value; draw(); });
    draw();
    store.subscribe(({ key }) => { if (!key || /^nexora-(households|guardians|children)/.test(key)) draw(); });
    return true;
  }

  /* ------------------------------------------------------------------ S18 Class rosters */

  function rosterPage(main, user) {
    const scope = store.classScope(user);
    const cls = params.get('cls');
    const draw = () => {
      const classes = store.classesInfo().filter(c => scope.includes(c.name));
      const pick = classes.find(c => c.name === cls) || null;
      const kidsIn = pick ? store.getChildren().filter(k => k.cls === pick.name && ['active', 'starting'].includes(k.status)).sort((a, b) => a.firstName.localeCompare(b.firstName)) : [];
      const sched = k => (k.schedule?.days?.length ? `${k.schedule.days.map(d => DAY_LABEL[d]).join(', ')} · ${store.SESSIONS[k.schedule.session] || ''}` : 'Schedule not recorded');
      main.innerHTML = `<div class="kids">
        <header class="kids-head"><div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">${pick ? `${esc(pick.name)} roster` : 'Class rosters'}</h1><p class="kids-head__sub">${pick ? `${esc(pick.teacher || 'No teacher')} · ${pick.capacity == null ? 'capacity not set' : `${pick.occupancy} of ${pick.capacity} seats`}` : 'Occupancy is counted from enrolled and starting-soon children.'}</p></div>${pick ? `<a class="btn btn--secondary" href="${routes.page('roster')}">All classes</a>` : ''}</header>
        ${pick ? (kidsIn.length ? `<div class="table-shell"><table class="data-table cp-table" aria-label="${esc(pick.name)} roster"><thead><tr><th scope="col">Child</th><th scope="col">Start date</th><th scope="col">Schedule</th><th scope="col">Status</th></tr></thead><tbody>${kidsIn.map(k => `<tr><td data-label="Child"><a href="${routes.record(k.id)}">${esc(store.childName(k))}</a></td><td data-label="Start date">${esc(day(k.startDate))}</td><td data-label="Schedule">${esc(sched(k))}</td><td data-label="Status"><span class="badge ${k.status === 'active' ? 'badge--success' : 'badge--info'}">${esc(store.CHILD_STATUSES[k.status])}</span></td></tr>`).join('')}</tbody></table></div>` : '<div class="kids-empty"><p class="kids-empty__title">No children in this class yet</p></div>')
          : `<ul class="cp-grid">${classes.map(c => { const pct = c.capacity ? Math.min(100, Math.round((c.occupancy / c.capacity) * 100)) : 0; return `<li class="cp-card"><h2 class="cp-card__title"><a href="${routes.page('roster', { cls: c.name })}">${esc(c.name)}</a></h2><p class="cp-muted">${esc(c.teacher || 'No teacher')}</p><p>${c.capacity == null ? `${c.occupancy} children · capacity not set` : `${c.occupancy} of ${c.capacity} seats${c.full ? ' · <span class="badge badge--warning">Full</span>' : ` · ${c.remaining} free`}`}</p><span class="wiz-bar" aria-hidden="true"><span style="width:${pct}%"></span></span></li>`; }).join('')}</ul>`}
      </div>`;
    };
    document.title = 'Class rosters · Nexora';
    main.classList.add('kids-page');
    draw();
    store.subscribe(({ key }) => { if (!key || /^nexora-(children|class-config|classes)/.test(key)) draw(); });
    return true;
  }

  function render(key, main, user) {
    if (key === 'enrol') return wizard(main, user);
    if (key === 'waitlist') return waitlistPage(main, user);
    if (key === 'families') return familiesPage(main, user);
    if (key === 'roster') return rosterPage(main, user);
    return false;
  }

  window.NexoraEnrol = { render };
})();
