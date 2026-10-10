/* S13 child profile (record.html?id=<childId>#tab=<section>): NexoraProfile.render(main, childId).
   Header card, a page-level safety banner that sits outside the tab panel (so no tab can hide it),
   11 tabs, one editor per section, print summary. Every section checks the role (store.canView /
   canEditSection) before it renders or saves, and module tabs check the school's plan. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const kids = window.NexoraChildren;
  const { routes } = store;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const day = d => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const when = iso => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const money = n => `₹${Math.round(n).toLocaleString('en-IN')}`;
  const toast = (t, x) => window.NexoraToast?.show(t, x);
  const SAVED = 'Changes saved successfully';

  const TABS = [
    { id: 'overview', label: 'Overview', access: 'overview' },
    { id: 'family', label: 'Family & Guardians', access: 'family' },
    { id: 'emergency', label: 'Emergency & Pickup', access: 'emergency' },
    { id: 'medical', label: 'Medical & Dietary', access: 'medical' },
    { id: 'attendance', label: 'Attendance', access: 'attendance' },
    { id: 'diary', label: 'Daily Diary', access: 'diary' },
    { id: 'learning', label: 'Learning & Portfolio', access: 'learning' },
    { id: 'incidents', label: 'Incidents', access: 'incidents' },
    { id: 'documents', label: 'Documents', access: 'documents' },
    { id: 'consents', label: 'Consents', access: 'consents' },
    { id: 'billing', label: 'Billing', access: 'billing' }
  ];
  const STATUS_BADGE = { active: 'badge--success', starting: 'badge--info', withdrawn: 'badge--error', graduated: '' };
  const SEVERITY = { severe: 'Severe', moderate: 'Moderate', mild: 'Mild' };
  const CONSENT_BADGE = { granted: 'badge--success', pending: 'badge--warning', declined: 'badge--error', expired: '' };
  const PREFERS = { phone: 'Phone call', whatsapp: 'WhatsApp', email: 'Email' };
  const RELATIONS = ['Mother', 'Father', 'Guardian', 'Grandparent', 'Aunt', 'Uncle', 'Carer', 'Sibling (18+)', 'Family friend'];

  function render(main, childId) {
    const user = store.currentUser();
    let tab = 'overview';
    let revealTimer = null;
    let revealed = '';

    const child = () => store.childProfile(childId);
    const can = section => store.canView(user, section);
    const canEdit = section => store.canEditSection(user, section);
    const manage = store.canManageChildren(user);
    const canMessage = () => store.canAccess(user, 'communication') && store.isEntitled('communication');
    const fromHash = () => { const m = /tab=([a-z]+)/.exec(location.hash); return m && TABS.some(t => t.id === m[1]) ? m[1] : 'overview'; };

    /* ----------------------------------------------------------- Building blocks */

    const photo = (c, cls = '') => c.photo
      ? `<img class="kid-photo ${cls}" src="${esc(c.photo)}" alt="Photo of ${esc(store.childName(c))}">`
      : `<span class="kid-photo kid-photo--initials ${cls}" role="img" aria-label="${esc(store.childName(c))}">${esc((c.firstName[0] || '') + (c.lastName[0] || ''))}</span>`;
    const pencil = (section, title, extra = '') => `<button class="btn btn--icon-ghost cp-edit" type="button" data-edit="${section}"${extra} aria-label="Edit ${esc(title)}">${icon('pencil')}</button>`;
    const card = (title, body, { edit = null, editGuard = edit, id = '', action = '', cls = '' } = {}) => `
      <section class="cp-card ${cls}"${id ? ` aria-labelledby="${id}"` : ''}>
        <header class="cp-card__head">
          <h2 class="cp-card__title"${id ? ` id="${id}"` : ''}>${esc(title)}</h2>
          <div class="cp-card__tools">${action}${edit && canEdit(editGuard) ? pencil(edit, title) : ''}</div>
        </header>
        ${body}
      </section>`;
    const dl = rows => `<dl class="cp-dl">${rows.filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v || '<span class="cp-muted">Not recorded</span>'}</dd></div>`).join('')}</dl>`;
    const empty = (title, text, action = '') => `<div class="cp-empty"><p class="cp-empty__title">${esc(title)}</p><p>${esc(text)}</p>${action}</div>`;
    const restricted = label => `<div class="cp-state" role="note">${icon('lock')}<div><p class="cp-state__title">${esc(label)} is restricted</p><p>Your role doesn’t include this section. Ask a school leader if you need it.</p></div></div>`;
    function locked(section, label) {
      const key = store.sectionModule(section);
      const plan = store.requiredPlanFor(key);
      return `<div class="cp-state cp-state--locked" role="note">${icon('lock')}<div><p class="cp-state__title">${esc(label)} is on the ${esc(plan.name)} plan</p><p>${esc(store.school.name)} is on ${esc(store.currentPlan().name)}. Safety alerts above are always shown on every plan.</p><a class="btn btn--sm btn--secondary" href="${routes.plans({ plan: plan.id, module: key })}">Compare plans</a></div></div>`;
    }
    // Sensitive sections are gated here, before any of their data is read into the page.
    function gate(section, label, build) {
      if (!can(section)) return restricted(label);
      const key = store.sectionModule(section);
      if (key && (!store.canAccess(user, key) || !store.isEntitled(key))) return store.canAccess(user, key) ? locked(section, label) : restricted(label);
      return build();
    }
    const tel = p => `<a href="tel:${esc(String(p).replace(/[^\d+]/g, ''))}">${esc(p)}</a>`;

    /* ----------------------------------------------------------- Header + safety banner */

    function headerHtml(c) {
      const age = store.ageParts(c.dob);
      const closed = ['withdrawn', 'graduated'].includes(c.status);
      return `
        <div class="cp-head__id">
          ${photo(c, 'cp-head__photo')}
          <div class="cp-head__names">
            <h1 class="cp-head__name" id="record-title" tabindex="-1">${esc(store.childName(c))}</h1>
            ${c.preferredName ? `<p class="cp-head__pref">Prefers “${esc(c.preferredName)}”</p>` : ''}
            <p class="cp-head__class"><span>${esc(c.cls)}</span><span class="badge ${STATUS_BADGE[c.status]}">${esc(store.CHILD_STATUSES[c.status])}</span></p>
          </div>
        </div>
        <dl class="cp-head__facts">
          <div><dt>Age</dt><dd>${age.years}y ${age.months}m</dd></div>
          <div><dt>Date of birth</dt><dd>${esc(day(c.dob))}</dd></div>
          <div><dt>Key teacher</dt><dd>${esc(c.keyTeacher || 'Not assigned')}</dd></div>
          <div><dt>Start date</dt><dd>${esc(day(c.startDate))}</dd></div>
        </dl>
        <div class="cp-head__actions">
          ${canMessage() && !closed ? `<a class="btn btn--secondary" href="${routes.page('compose', { children: c.id, family: 'all' })}">${icon('message', 'icon--sm')}Message family</a>` : ''}
          <button class="btn btn--secondary" type="button" data-print>${icon('printer', 'icon--sm')}Print summary</button>
          ${canEdit('identity') ? `<button class="btn btn--primary kids-yellow" type="button" data-edit="identity">${icon('pencil', 'icon--sm')}Edit</button>` : ''}
          ${manage && !closed ? `
            <div class="menu-wrap">
              <button class="btn btn--icon" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="More actions for ${esc(store.childName(c))}" data-menu-btn>${icon('more-v')}</button>
              <div class="menu" role="menu" hidden>
                <button type="button" role="menuitem" data-act="wizard">${icon('pencil', 'icon--sm')}Edit all details</button>
                <button type="button" role="menuitem" data-act="move">${icon('move', 'icon--sm')}Move class</button>
                <hr><button class="is-danger" type="button" role="menuitem" data-act="withdraw">${icon('user-minus', 'icon--sm')}Withdraw</button>
              </div>
            </div>` : ''}
        </div>`;
    }

    // Allergy and severe medical first, then other medical, custody, dietary.
    const RANK = a => (a.type === 'allergy' ? (a.severity === 'severe' ? 0 : 1) : a.type === 'medical' ? 2 : a.type === 'custody' ? 3 : 4);
    function alertsHtml(c) {
      if (!c.alerts.length) return '';
      const medOk = can('medical');
      const custodyOk = can('custody');
      const items = [...c.alerts].sort((a, b) => RANK(a) - RANK(b)).map(a => {
        if (a.type === 'custody') {
          return `<li class="cp-alert cp-alert--custody">${icon('shield')}<div class="cp-alert__body"><p class="cp-alert__type">Custody restriction</p>${custodyOk
            ? `${a.restrictedPerson ? `<p class="cp-alert__main">Do not release to: ${esc(a.restrictedPerson)}</p>` : ''}<p>${esc(a.detail)}</p>`
            : '<p class="cp-alert__main">Restriction on file. Details are limited to class staff and school leaders.</p>'}</div>${custodyOk ? `<button class="btn btn--sm cp-alert__go" type="button" data-goto="emergency">Pickup details</button>` : ''}</li>`;
        }
        const label = { allergy: 'Allergy', medical: 'Medical', dietary: 'Dietary' }[a.type];
        const ic = { allergy: 'allergy', medical: 'medical', dietary: 'leaf' }[a.type];
        return `<li class="cp-alert cp-alert--${a.type}${a.severity === 'severe' ? ' is-severe' : ''}">${icon(ic)}<div class="cp-alert__body"><p class="cp-alert__type">${label}${medOk && a.severity ? ` · ${esc(SEVERITY[a.severity])}` : ''}</p>${medOk
          ? `<p class="cp-alert__main">${esc(a.detail)}</p>${a.instructions ? `<p>${esc(a.instructions)}</p>` : ''}`
          : `<p class="cp-alert__main">${label} alert on file. Details are limited to class staff and school leaders.</p>`}</div>${medOk ? `<button class="btn btn--sm cp-alert__go" type="button" data-goto="medical">Medical details</button>` : ''}</li>`;
      });
      return `<h2 class="sr-only" id="cp-alerts-title">Safety alerts</h2><ul class="cp-alerts__list">${items.join('')}</ul>`;
    }

    /* ----------------------------------------------------------- Tabs */

    const PANELS = {
      overview(c) {
        const age = store.ageParts(c.dob);
        const att = can('attendance') && store.isEntitled('attendance') ? store.attendanceFor(c.id) : null;
        const diary = can('diary') ? store.getDiary(c.id).slice(0, 2) : null;
        const learning = can('learning') && store.isEntitled('classroom-tracker') ? store.getLearning(c.id) : null;
        const consents = can('consents') ? store.getConsents(c.id) : null;
        const billOk = can('billing') && store.canAccess(user, 'fees') && store.isEntitled('fees');
        const bill = billOk ? store.feeLedger().filter(l => l.studentId === c.id) : null;
        const go = (tabId, text) => `<button class="btn btn--sm btn--tertiary" type="button" data-goto="${tabId}">${esc(text)}${icon('arrow-right', 'icon--sm')}</button>`;
        const primary = c.guardians.find(g => g.primary) || c.guardians[0];
        return `<div class="cp-grid">
          ${card('Child details', dl([['Preferred name', esc(c.preferredName)], ['Age', `${age.years} years, ${age.months} months`], ['Class', esc(c.cls)], ['Key teacher', esc(c.keyTeacher)], ['Start date', esc(day(c.startDate))], ['Schedule', c.schedule?.days?.length ? esc(`${c.schedule.days.map(d => d[0].toUpperCase() + d.slice(1)).join(', ')} · ${store.SESSIONS[c.schedule.session] || ''}`) : ''], ['Home languages', esc((c.languages || []).join(', '))], ['Gender', esc(store.GENDERS.find(([k]) => k === c.gender)?.[1] && c.gender ? store.GENDERS.find(([k]) => k === c.gender)[1] : '')], ['Nationality', esc(c.nationality)], ['Status', `<span class="badge ${STATUS_BADGE[c.status]}">${esc(store.CHILD_STATUSES[c.status])}</span>`]]), { edit: 'identity', id: 'ov-child' })}
          ${card('Family contact', primary ? dl([['Primary guardian', `${esc(primary.name)} <span class="cp-muted">(${esc(primary.relation)})</span>`], ['Phone', tel(primary.phone)], ['Contact', esc(store.guardianChannels(primary).map(ch => store.CHANNELS[ch]).join(', '))], ['Other guardians', esc(c.guardians.filter(g => g !== primary).map(g => g.name).join(', '))]]) : empty('No guardian on record', 'Add a guardian in Family & Guardians.'), { edit: primary ? 'guardian' : null, editGuard: 'family', id: 'ov-family', action: go('family', 'All guardians') }).replace('data-edit="guardian"', `data-edit="guardian" data-guardian="${esc(primary?.id || '')}"`)}
          ${card('Safety', c.alerts.length ? `<p class="cp-muted">${c.alerts.length} active ${c.alerts.length === 1 ? 'alert' : 'alerts'} — shown above every tab.</p>` : '<p class="cp-muted">No safety alerts on record.</p>', { id: 'ov-safety', action: can('medical') ? go('medical', 'Medical & Dietary') : '' })}
          ${att ? card('Attendance', att.length ? dl([['Latest', `${esc(day(att[0].date))} · ${esc(att[0].mark[0].toUpperCase() + att[0].mark.slice(1))}`], ['Registers on record', String(att.length)]]) : '<p class="cp-muted">No registers recorded for this child yet.</p>', { id: 'ov-att', action: go('attendance', 'Attendance') }) : ''}
          ${diary ? card('Recent diary', diary.length ? `<ul class="cp-mini">${diary.map(e => `<li><b>${esc(e.title)}</b><span>${esc(day(e.date))} · ${esc(e.author)}</span></li>`).join('')}</ul>` : '<p class="cp-muted">No diary entries yet.</p>', { id: 'ov-diary', action: go('diary', 'Daily Diary') }) : ''}
          ${learning ? card('Learning progress', learning.length ? dl(Object.entries(store.LEARNING_STAGES).map(([k, v]) => [v, String(learning.filter(l => l.stage === k).length)])) : '<p class="cp-muted">No presentations recorded yet.</p>', { id: 'ov-learn', action: go('learning', 'Learning & Portfolio') }) : ''}
          ${consents ? card('Consents', `<p>${consents.filter(x => x.status === 'pending').length} pending · ${consents.filter(x => x.status === 'granted').length} granted · ${consents.filter(x => ['declined', 'expired'].includes(x.status)).length} declined or expired</p>`, { id: 'ov-consent', action: go('consents', 'Consents') }) : ''}
          ${bill ? card('Billing', bill.length ? dl([['Outstanding', money(bill.reduce((s, l) => s + l.balance, 0))], ['Overdue', bill.some(l => l.overdue) ? '<span class="badge badge--error">Overdue</span>' : 'No']]) : '<p class="cp-muted">No invoices for this child.</p>', { id: 'ov-bill', action: go('billing', 'Billing') }) : ''}
        </div>`;
      },

      family: c => gate('family', 'Family & Guardians', () => `
        <div class="cp-toolbar">${canEdit('family') ? `<button class="btn btn--secondary" type="button" data-edit="guardian">${icon('user-plus', 'icon--sm')}Add guardian</button>` : ''}</div>
        <div class="cp-grid">${c.guardians.map(g => card(`${g.name}`, `
          <p class="cp-tags"><span class="badge">${esc(g.relation)}</span>${g.primary ? '<span class="badge badge--primary">Primary guardian</span>' : ''}</p>
          ${dl([['Phone', tel(g.phone)], ['Email', g.email ? `<a href="mailto:${esc(g.email)}">${esc(g.email)}</a>` : ''], ['Contact', esc(store.guardianChannels(g).map(ch => store.CHANNELS[ch]).join(', '))], ['Language', esc(store.GUARDIAN_LANGUAGES[store.guardianLanguage(g)])]])}
          ${canEdit('family') && c.guardians.length > 1 ? `<button class="btn btn--sm btn--ghost cp-unlink" type="button" data-unlink="${esc(g.id)}">Remove from this child</button>` : ''}`,
          { edit: 'guardian', editGuard: 'family' }).replace('data-edit="guardian"', `data-edit="guardian" data-guardian="${esc(g.id)}"`)).join('')}</div>`),

      emergency: c => gate('emergency', 'Emergency & Pickup', () => {
        const custody = c.alerts.filter(a => a.type === 'custody');
        const passOk = can('passcode');
        return `<div class="cp-grid">
          ${card('Emergency contacts', c.emergency.length ? `<ul class="cp-people">${c.emergency.map(e => `<li><b>${esc(e.name)}</b><span>${esc(e.relation)}</span>${tel(e.phone)}</li>`).join('')}</ul>` : empty('No emergency contacts', 'Add at least one person to call if guardians can’t be reached.'), { edit: 'emergency', id: 'em-contacts' })}
          ${card('Authorised to collect', `${c.pickup.authorised.length ? `<ul class="cp-people">${c.pickup.authorised.map(p => `<li><b>${esc(p.name)}</b><span>${esc(p.relation)}${p.idRef ? ` · ID ref ${esc(p.idRef)}` : ''}</span>${p.phone ? tel(p.phone) : ''}<span class="badge ${p.status === 'authorised' ? 'badge--success' : 'badge--warning'}">${esc(store.PICKUP_STATUS[p.status || 'authorised'])}</span></li>`).join('')}</ul>` : empty('Nobody authorised yet', 'Only people on this list may collect the child.')}
            ${c.pickup.verification ? `<p class="cp-note">${icon('info', 'icon--sm')}${esc(c.pickup.verification)}</p>` : ''}`, { edit: 'pickup', editGuard: 'emergency', id: 'em-pickup' })}
          ${card('Pickup restrictions', (custody.length ? `<ul class="cp-restrict">${custody.map(a => `<li>${icon('shield')}<div>${a.restrictedPerson ? `<b>Do not release to: ${esc(a.restrictedPerson)}</b>${a.relation ? ` (${esc(a.relation)})` : ''}` : ''}<p>${esc(a.detail)}${a.effective ? ` · from ${esc(day(a.effective))}` : ''}</p></div></li>`).join('')}</ul>` : `<p class="cp-muted">${c.restrictionsDeclared === 'none' ? 'No restrictions — confirmed with the family.' : 'No restrictions recorded. Not yet confirmed with the family.'}</p>`) + ((c.liftedRestrictions || []).length ? `<p class="cp-muted">Lifted: ${c.liftedRestrictions.map(r => esc(r.name)).join(', ')}</p>` : ''), { edit: 'custody', id: 'em-restrict' })}
          ${card('Pickup passcode', passOk && !c.pickup.passcode ? `<p class="cp-muted">No passcode set yet.${canEdit('passcode') ? ' Use the pencil to set one and tell the family in person.' : ' A school leader can set one.'}</p>` : passOk ? `
            <div class="cp-pass">
              <span class="cp-pass__value" data-pass aria-live="polite">${revealed ? `<span class="sr-only">Passcode </span>${esc(revealed.split('').join(' '))}` : '<span aria-label="Passcode hidden">••••</span>'}</span>
              <button class="btn btn--sm btn--secondary" type="button" data-reveal aria-pressed="${revealed ? 'true' : 'false'}">${icon(revealed ? 'eye-off' : 'eye', 'icon--sm')}${revealed ? 'Hide' : 'Reveal'}</button>
            </div>
            <p class="cp-muted">Each reveal is recorded in the audit log with your name and the time. The code hides again after 30 seconds.</p>` : restricted('The pickup passcode'), { edit: 'passcode', id: 'em-pass' })}
        </div>`;
      }),

      medical: c => gate('medical', 'Medical & Dietary', () => {
        const of = t => c.alerts.filter(a => a.type === t);
        const declared = k => ({ none: 'None — confirmed by family.', unknown: 'Not yet collected.', recorded: 'None recorded.' }[c.healthDeclared?.[k] || 'unknown']);
        const alertList = (list, emptyText) => list.length ? `<ul class="cp-med">${list.map(a => `<li class="cp-med__item cp-med__item--${a.type}">${icon({ allergy: 'allergy', medical: 'medical', dietary: 'leaf' }[a.type])}<div><p class="cp-med__main">${esc(a.detail)}${a.severity ? ` <span class="badge ${a.severity === 'severe' ? 'badge--error' : 'badge--warning'}">${esc(SEVERITY[a.severity])}</span>` : ''}</p>${a.reaction ? `<p><b>Reaction:</b> ${esc(a.reaction)}</p>` : ''}${a.instructions ? `<p>${esc(a.instructions)}</p>` : ''}</div></li>`).join('')}</ul>` : `<p class="cp-muted">${emptyText}</p>`;
        return `<div class="cp-grid">
          ${card('Allergies', alertList(of('allergy'), declared('allergies')), { edit: 'allergies', editGuard: 'medical', id: 'md-allergy' })}
          ${card('Medical conditions', alertList(of('medical'), declared('conditions')), { edit: 'conditions', editGuard: 'medical', id: 'md-cond' })}
          ${card('Medication', c.medications.length ? `<ul class="cp-people">${c.medications.map(m => `<li><b>${esc(m.name)}</b><span>${esc(m.dose)}${m.schedule ? ` · ${esc(m.schedule)}` : ''}</span><span>${esc(m.storedAt ? `Kept in: ${m.storedAt}` : '')}</span><span class="badge ${m.consent === 'given' ? 'badge--success' : 'badge--warning'}">${esc(store.MED_CONSENT[m.consent || 'pending'])}</span></li>`).join('')}</ul>` : `<p class="cp-muted">${declared('medications')}</p>`, { edit: 'medications', editGuard: 'medical', id: 'md-meds' })}
          ${card('Dietary needs', alertList(of('dietary'), 'No dietary needs recorded.'), { edit: 'dietary', editGuard: 'medical', id: 'md-diet' })}
          ${card('Doctor', c.doctor?.name || c.doctor?.clinic ? dl([['Name', esc(c.doctor.name)], ['Clinic', esc(c.doctor.clinic)], ['Phone', c.doctor.phone ? tel(c.doctor.phone) : ''], ['Notes', esc(c.doctor.notes)]]) : '<p class="cp-muted">No doctor recorded.</p>', { id: 'md-doc' })}
          ${card('Immunisations', (c.immunisations || []).length ? `<ul class="cp-mini">${c.immunisations.map(m => `<li><b>${esc(m.vaccine)}</b><span>${m.date ? esc(day(m.date)) : 'Date not given'}${m.notes ? ` · ${esc(m.notes)}` : ''}</span></li>`).join('')}</ul>` : '<p class="cp-muted">No immunisation records provided. This doesn’t mean a vaccine was given or missed.</p>', { id: 'md-imm' })}
          ${card('Emergency instructions & care notes', dl([['Emergency instructions', esc(c.emergencyInstructions)], ['Care notes', esc(c.careNotes)]]), { edit: 'care', editGuard: 'medical', id: 'md-care', cls: 'cp-card--wide' })}
        </div>`;
      }),

      attendance: c => gate('attendance', 'Attendance', () => {
        store.getRegister();
        const rows = store.attendanceFor(c.id);
        const n = m => rows.filter(r => r.mark === m).length;
        return `<div class="cp-stack">
          <div class="cp-stats">${['present', 'late', 'absent'].map(m => `<div class="cp-stat"><span class="cp-stat__n">${n(m)}</span><span>${m[0].toUpperCase() + m.slice(1)}</span></div>`).join('')}</div>
          ${card('Register history', rows.length ? `<div class="table-shell"><table class="data-table cp-table"><thead><tr><th scope="col">Date</th><th scope="col">Class</th><th scope="col">Mark</th><th scope="col">Recorded by</th></tr></thead><tbody>${rows.map(r => `<tr><td data-label="Date">${esc(day(r.date))}</td><td data-label="Class">${esc(r.cls)}</td><td data-label="Mark"><span class="badge ${r.mark === 'present' ? 'badge--success' : r.mark === 'late' ? 'badge--warning' : 'badge--error'}">${esc(r.mark[0].toUpperCase() + r.mark.slice(1))}</span></td><td data-label="Recorded by">${esc(r.takenBy)} · ${esc(when(r.takenAt))}</td></tr>`).join('')}</tbody></table></div>` : empty('No registers yet', 'Registers taken for this child’s class appear here.'),
            { id: 'at-hist', action: `<a class="btn btn--sm btn--tertiary" href="${routes.page('attendance', { cls: c.cls })}">Class register${icon('arrow-right', 'icon--sm')}</a>` })}
          <p class="cp-muted">Only registers saved in Nexora are shown; there is no imported history.</p>
        </div>`;
      }),

      diary: c => gate('diary', 'Daily Diary', () => {
        const list = store.getDiary(c.id);
        const add = canEdit('diary') && ['active', 'starting'].includes(c.status) ? `<button class="btn btn--secondary" type="button" data-edit="diary">${icon('plus', 'icon--sm')}Add entry</button>` : '';
        return `<div class="cp-toolbar">${add}</div>${list.length ? `<ol class="cp-feed">${list.map(e => `<li class="cp-card">
          <header class="cp-card__head"><div><h2 class="cp-card__title">${esc(e.title)}</h2><p class="cp-muted">${esc(day(e.date))} · ${esc(e.author)}</p></div>${canEdit('diary') ? pencil('diary', e.title, ` data-entry="${esc(e.id)}"`) : ''}</header>
          ${dl([e.meals && ['Meals', esc(e.meals)], e.rest && ['Rest', esc(e.rest)], e.notes && ['Notes', esc(e.notes)]])}</li>`).join('')}</ol>` : empty('No diary entries yet', 'Meals, rest and the day’s highlights appear here once staff add them.')}`;
      }),

      learning: c => gate('learning', 'Learning & Portfolio', () => {
        const list = store.getLearning(c.id);
        const legacy = store.students.find(s => s.id === c.id)?.note;
        const add = canEdit('learning') ? `<button class="btn btn--secondary" type="button" data-edit="learning">${icon('plus', 'icon--sm')}Record presentation</button>` : '';
        return `<div class="cp-toolbar">${add}</div>
          ${legacy ? card('Latest class observation', `<p>${esc(legacy)}</p>`, { id: 'ln-obs' }) : ''}
          ${list.length ? `<div class="table-shell"><table class="data-table cp-table"><thead><tr><th scope="col">Date</th><th scope="col">Area</th><th scope="col">Activity or material</th><th scope="col">Stage</th><th scope="col">Observation</th><th scope="col" class="cell-action"><span class="sr-only">Edit</span></th></tr></thead><tbody>${list.map(l => `<tr>
            <td data-label="Date">${esc(day(l.date))}</td><td data-label="Area">${esc(l.area)}</td><td data-label="Material">${esc(l.material)}</td>
            <td data-label="Stage"><span class="badge ${l.stage === 'mastered' ? 'badge--success' : l.stage === 'practising' ? 'badge--info' : ''}">${esc(store.LEARNING_STAGES[l.stage])}</span></td>
            <td data-label="Observation">${esc(l.observation || '—')} <span class="cp-muted">· ${esc(l.author)}</span></td>
            <td class="cell-action">${canEdit('learning') ? pencil('learning', l.material, ` data-entry="${esc(l.id)}"`) : ''}</td></tr>`).join('')}</tbody></table></div>`
            : empty('No presentations recorded yet', 'Record each presentation as Introduced, Practising or Mastered to build the child’s portfolio.')}`;
      }),

      incidents: c => gate('incidents', 'Incidents', () => {
        const list = store.getIncidents().filter(i => i.studentId === c.id).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
        return list.length ? `<ol class="cp-feed">${list.map(i => `<li class="cp-card"><header class="cp-card__head"><div><h2 class="cp-card__title">${esc(i.type)} · ${esc(i.severity)}</h2><p class="cp-muted">${esc(when(i.occurredAt))} · logged by ${esc(i.createdBy)}</p></div><span class="badge ${i.status === 'open' ? 'badge--warning' : 'badge--success'}">${i.status === 'open' ? 'Open' : 'Resolved'}</span></header>${dl([['What happened', esc(i.description)], ['Action taken', esc(i.action)], ['Parent informed', i.parentInformed ? 'Yes' : 'Not yet']])}</li>`).join('')}</ol>`
          : empty('No incidents recorded', 'Incidents logged for this child will appear here.');
      }),

      documents: c => gate('documents', 'Documents', () => {
        const list = store.getDocuments(c.id);
        return `<div class="cp-toolbar">${canEdit('documents') ? `<button class="btn btn--secondary" type="button" data-edit="document">${icon('upload', 'icon--sm')}Upload document</button>` : ''}</div>
          ${list.length ? `<div class="table-shell"><table class="data-table cp-table"><thead><tr><th scope="col">Document</th><th scope="col">Category</th><th scope="col">Uploaded</th><th scope="col">Expires</th><th scope="col">Status</th><th scope="col" class="cell-action"><span class="sr-only">Actions</span></th></tr></thead><tbody>${list.map(d => `<tr>
            <td data-label="Document"><b>${esc(d.name)}</b> <span class="cp-muted">${esc(store.DOC_TYPES[d.mime])} · ${Math.max(1, Math.round(d.size / 1024))} KB</span></td>
            <td data-label="Category">${esc(d.category)}</td><td data-label="Uploaded">${esc(day(d.uploadedAt))} · ${esc(d.uploadedBy)}</td>
            <td data-label="Expires">${d.expiry ? `${esc(day(d.expiry))}${d.expiry < store.today() ? ' <span class="badge badge--error">Expired</span>' : ''}` : '—'}</td>
            <td data-label="Status"><span class="badge ${d.status === 'verified' ? 'badge--success' : 'badge--warning'}">${d.status === 'verified' ? 'Verified' : 'Not verified'}</span></td>
            <td class="cell-action cp-doc-actions"><button class="btn btn--sm btn--ghost" type="button" data-open-doc="${esc(d.id)}">${icon('eye', 'icon--sm')}View</button>${canEdit('documents') ? `<button class="btn btn--sm btn--ghost" type="button" data-verify="${esc(d.id)}" data-to="${d.status === 'verified' ? '0' : '1'}">${d.status === 'verified' ? 'Unverify' : 'Verify'}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
            : empty('No documents yet', 'Upload PDFs or photos of records such as the birth certificate or immunisation card (1 MB max).')}`;
      }),

      consents: c => gate('consents', 'Consents', () => `
        <p class="cp-muted cp-lead">A consent with no recorded response is Pending — it is never treated as granted.</p>
        <ul class="cp-consents">${store.getConsents(c.id).map(x => `<li class="cp-consent">
          <div><p class="cp-consent__label">${esc(x.label)}</p><p class="cp-muted">${x.status === 'pending' ? 'No response recorded' : `${esc(x.respondedBy)} · ${esc(day(x.date))}${x.expires ? ` · expires ${esc(day(x.expires))}` : ''}`}</p></div>
          <span class="badge ${CONSENT_BADGE[x.status]}">${esc(store.CONSENT_STATUSES[x.status])}</span>
          ${canEdit('consents') ? pencil('consent', x.label, ` data-consent="${esc(x.type)}"`) : ''}</li>`).join('')}</ul>`),

      billing: c => gate('billing', 'Billing', () => {
        const lines = store.feeLedger().filter(l => l.studentId === c.id);
        const pays = store.getPayments().filter(p => p.studentId === c.id).sort((a, b) => b.date.localeCompare(a.date));
        const due = lines.reduce((s, l) => s + l.balance, 0);
        return `<div class="cp-stack">
          <div class="cp-stats"><div class="cp-stat"><span class="cp-stat__n">${money(due)}</span><span>Outstanding</span></div><div class="cp-stat"><span class="cp-stat__n">${money(lines.reduce((s, l) => s + l.paid, 0))}</span><span>Paid this term</span></div></div>
          ${card('Invoices', lines.length ? `<div class="table-shell"><table class="data-table cp-table"><thead><tr><th scope="col">Term</th><th scope="col">Amount</th><th scope="col">Paid</th><th scope="col">Balance</th><th scope="col">Due</th></tr></thead><tbody>${lines.map(l => `<tr><td data-label="Term">${esc(l.term)}</td><td data-label="Amount">${money(l.amount)}</td><td data-label="Paid">${money(l.paid)}</td><td data-label="Balance">${money(l.balance)} ${l.overdue ? '<span class="badge badge--error">Overdue</span>' : l.balance ? '' : '<span class="badge badge--success">Paid</span>'}</td><td data-label="Due">${esc(day(l.dueDate))}</td></tr>`).join('')}</tbody></table></div>` : empty('No invoices', 'Invoices for this child will appear here.'), { id: 'bl-inv', action: `<a class="btn btn--sm btn--tertiary" href="${routes.page('fees')}">Fees${icon('arrow-right', 'icon--sm')}</a>` })}
          ${card('Recent payments', pays.length ? `<ul class="cp-mini">${pays.slice(0, 5).map(p => `<li><b>${money(p.amount)}</b><span>${esc(day(p.date))} · ${esc(p.method)} · ${esc(p.recordedBy)}</span></li>`).join('')}</ul>` : '<p class="cp-muted">No payments recorded.</p>', { id: 'bl-pay' })}
        </div>`;
      })
    };

    /* ----------------------------------------------------------- Shell */

    function frame() {
      main.innerHTML = `
        <div class="cp">
          <nav class="kids-crumbs" aria-label="Breadcrumb"><a href="${routes.page('children')}">Children</a> / <span aria-current="page" data-crumb></span></nav>
          <header class="panel cp-head" data-head></header>
          <section class="cp-alerts" aria-labelledby="cp-alerts-title" data-alerts></section>
          <div class="cp-tabs">
            <div class="tabs cp-tabs__bar" role="tablist" aria-label="Child profile sections">${TABS.map(t => `<button class="tab" type="button" role="tab" id="tab-${t.id}" aria-controls="cp-panel" aria-selected="false" tabindex="-1" data-tab="${t.id}">${esc(t.label)}${store.sectionModule(t.access) && !store.isEntitled(store.sectionModule(t.access)) ? icon('lock', 'icon--sm cp-tab-lock') : ''}</button>`).join('')}</div>
            <div class="field cp-tabs__select"><label class="field__label" for="cp-section">Section</label><select class="input" id="cp-section" data-section>${TABS.map(t => `<option value="${t.id}">${esc(t.label)}</option>`).join('')}</select></div>
          </div>
          <section class="cp-panel" id="cp-panel" role="tabpanel" tabindex="-1" data-panel></section>
          <div class="cp-print" data-print-area></div>
        </div>`;
    }

    function paint({ focusPanel = false } = {}) {
      const c = child();
      if (!c) { window.NexoraNotFound?.render(main); return; }
      document.title = `${store.childName(c)} · Nexora`;
      main.querySelector('[data-crumb]').textContent = store.childName(c);
      main.querySelector('[data-head]').innerHTML = headerHtml(c);
      const alerts = main.querySelector('[data-alerts]');
      alerts.innerHTML = alertsHtml(c);
      alerts.hidden = !c.alerts.length;
      main.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === tab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
      main.querySelector('[data-section]').value = tab;
      const panel = main.querySelector('[data-panel]');
      panel.setAttribute('aria-labelledby', `tab-${tab}`);
      panel.innerHTML = PANELS[tab](c);
      panel.classList.remove('is-entering');
      void panel.offsetWidth;
      panel.classList.add('is-entering');
      if (focusPanel) panel.focus({ preventScroll: true });
    }

    function selectTab(id, { focus = false } = {}) {
      if (!TABS.some(t => t.id === id)) return;
      tab = id;
      history.replaceState(null, '', `#tab=${id}`);
      hidePass(false);
      paint({ focusPanel: focus });
    }

    /* ----------------------------------------------------------- Editors (one per section) */

    const field = kids.field;
    const input = (name, value, attrs = '') => `<input class="input" id="kd-${name}" name="${name}" value="${esc(value)}" ${attrs}>`;
    const select = (name, value, options, attrs = '') => `<select class="input" id="kd-${name}" name="${name}" ${attrs}>${options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
    const textarea = (name, value, attrs = '') => `<textarea class="input" id="kd-${name}" name="${name}" rows="3" ${attrs}>${esc(value)}</textarea>`;
    const fail = r => ({ ...r, message: { forbidden: 'Your role can’t change this section. Nothing was saved.', storage: r.message || 'This couldn’t be saved on this device. Nothing was changed.' }[r.reason] || r.message });
    const done = r => { if (r.ok) toast(SAVED); return r.ok ? r : fail(r); };

    // Repeating rows (contacts, allergies…): rows get names rows.<i>.<field>, so store errors land on the right input.
    function rowsEditor({ section, title, cols, rows, max = 8, addLabel, extra = '', collect = () => ({}) }) {
      const rowHtml = (r = {}) => `
        <fieldset class="cp-row">
          <legend class="sr-only">Entry</legend>
          ${cols.map(col => {
            const ctl = col.options
              ? `<select class="input" data-key="${col.key}">${col.options.map(([v, l]) => `<option value="${esc(v)}"${(r[col.key] ?? col.default ?? '') === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`
              : `<input class="input" data-key="${col.key}" value="${esc(r[col.key] || '')}"${col.type ? ` type="${col.type}"` : ''}${col.placeholder ? ` placeholder="${esc(col.placeholder)}"` : ''}>`;
            return `<div class="field cp-row__${col.key}"><label class="field__label">${esc(col.label)}${col.required ? ' <span class="field__req" aria-hidden="true">*</span>' : ''}</label>${ctl}<p class="field__hint field__hint--error" hidden></p></div>`;
          }).join('')}
          <button class="btn btn--sm btn--ghost cp-row__remove" type="button" data-row-remove>${icon('x', 'icon--sm')}Remove</button>
        </fieldset>`;
      const d = kids.dialog({
        label: `Child profile / ${title}`,
        title: `Edit ${title.toLowerCase()}`,
        desc: '',
        body: `<div class="cp-rows" data-rows>${rows.map(rowHtml).join('')}</div>
          <p class="cp-muted" data-rows-empty${rows.length ? ' hidden' : ''}>Nothing recorded. Saving with no entries clears this section.</p>
          <button class="btn btn--sm btn--secondary" type="button" data-row-add>${icon('plus', 'icon--sm')}${esc(addLabel)}</button>${extra}`,
        submit: 'Save',
        async onSubmit(form) {
          const list = [...form.querySelectorAll('.cp-row')].map(row => Object.fromEntries([...row.querySelectorAll('[data-key]')].map(i => [i.dataset.key, i.value])));
          return done(await store.updateChildSection(store.currentUser(), childId, section, { rows: list, ...collect(form) }));
        }
      });
      d.el.classList.add('cp-modal');
      const box = d.form.querySelector('[data-rows]');
      const reindex = () => {
        box.querySelectorAll('.cp-row').forEach((row, i) => row.querySelectorAll('.field').forEach(f => {
          const ctl = f.querySelector('[data-key]');
          const id = `kd-rows-${i}-${ctl.dataset.key}`;
          ctl.id = id; ctl.name = `rows.${i}.${ctl.dataset.key}`;
          f.querySelector('label').htmlFor = id;
          const hint = f.querySelector('.field__hint--error');
          hint.dataset.errorFor = `rows.${i}.${ctl.dataset.key}`;
          hint.id = `${id}-error`;
          ctl.setAttribute('aria-describedby', hint.id);
        }));
        d.form.querySelector('[data-row-add]').hidden = box.children.length >= max;
        d.form.querySelector('[data-rows-empty]').hidden = box.children.length > 0;
      };
      reindex();
      d.form.addEventListener('click', e => {
        if (e.target.closest('[data-row-add]')) { box.insertAdjacentHTML('beforeend', rowHtml()); reindex(); box.lastElementChild.querySelector('[data-key]').focus(); }
        const rm = e.target.closest('[data-row-remove]');
        if (rm) { const next = rm.closest('.cp-row').nextElementSibling || rm.closest('.cp-row').previousElementSibling; rm.closest('.cp-row').remove(); reindex(); (next?.querySelector('[data-key]') || d.form.querySelector('[data-row-add]')).focus(); }
      });
    }

    const readPhoto = file => new Promise((resolve, reject) => {
      if (!file) { resolve(undefined); return; }
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { reject(new Error('Use a PNG, JPEG or WebP image.')); return; }
      if (file.size > 500 * 1024) { reject(new Error('Use an image under 500 KB.')); return; }
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('That image couldn’t be read.'));
      r.readAsDataURL(file);
    });

    const EDITORS = {
      identity() {
        const c = child();
        const teachers = store.educators.map(e => [e.name, `${e.name} · ${e.cls}`]);
        kids.dialog({
          label: 'Child profile / Child details', title: 'Edit child details', desc: 'Class changes use Move class, so registers and ratios stay correct.',
          body: `<div class="kids-form__grid">
            ${field('kd-firstName', 'First name', input('firstName', c.firstName, 'required'), { required: true })}
            ${field('kd-lastName', 'Last name', input('lastName', c.lastName, 'required'), { required: true })}
            ${field('kd-preferredName', 'Preferred name', input('preferredName', c.preferredName), { hint: 'Optional. What the child likes to be called.' })}
            ${field('kd-dob', 'Date of birth', input('dob', c.dob, `type="date" max="${store.today()}" required`), { required: true })}
            ${field('kd-startDate', 'Start date', input('startDate', c.startDate, 'type="date" required'), { required: true })}
            ${field('kd-keyTeacher', 'Key teacher', select('keyTeacher', c.keyTeacher, [['', 'Not assigned'], ...teachers]))}
            ${field('kd-photo', 'Photo', `<input class="input" type="file" id="kd-photo" name="photo" accept="image/png,image/jpeg,image/webp">`, { hint: 'PNG, JPEG or WebP, under 500 KB.' })}
            ${c.photo ? `<label class="check"><input type="checkbox" name="removePhoto">Remove current photo</label>` : ''}
          </div>`,
          submit: 'Save details',
          async onSubmit(form) {
            const v = Object.fromEntries(['firstName', 'lastName', 'preferredName', 'dob', 'startDate', 'keyTeacher'].map(k => [k, form.elements[k].value]));
            try {
              const pic = await readPhoto(form.elements.photo.files[0]);
              if (pic !== undefined) v.photo = pic;
              else if (form.elements.removePhoto?.checked) v.photo = '';
            } catch (err) { return { ok: false, errors: { photo: err.message } }; }
            return done(await store.updateChildSection(store.currentUser(), childId, 'identity', v));
          }
        });
      },
      guardian(btn) {
        const c = child();
        const g = c.guardians.find(x => x.id === btn?.dataset.guardian);
        kids.dialog({
          label: 'Child profile / Family', title: g ? `Edit ${g.name}` : 'Add guardian', desc: g ? 'Contact details are shared with any siblings linked to this guardian.' : '',
          body: `<div class="kids-form__grid">
            ${field('kd-name', 'Full name', input('name', g?.name || '', 'required autocomplete="off"'), { required: true })}
            ${field('kd-relation', 'Relationship to child', select('relation', g?.relation || '', [['', 'Choose'], ...RELATIONS.map(r => [r, r])], 'required'), { required: true })}
            ${field('kd-phone', 'Phone', input('phone', g?.phone || '', 'type="tel" inputmode="tel" required'), { required: true })}
            ${field('kd-email', 'Email', input('email', g?.email || '', 'type="email"'), { hint: 'Optional unless email is the preferred contact.' })}
            ${field('kd-prefers', 'Preferred contact', select('prefers', g?.prefers || 'phone', Object.entries(PREFERS)))}
            <label class="check"><input type="checkbox" name="primary"${g?.primary ? ' checked disabled' : ''}>Primary guardian</label>
          </div>`,
          submit: g ? 'Save guardian' : 'Add guardian',
          async onSubmit(form) {
            const v = Object.fromEntries(['name', 'relation', 'phone', 'email', 'prefers'].map(k => [k, form.elements[k].value]));
            v.primary = g?.primary || form.elements.primary.checked;
            return done(await store.saveGuardianLink(store.currentUser(), childId, v, g?.id || null));
          }
        });
      },
      emergency() { const c = child(); rowsEditor({ section: 'emergency', title: 'Emergency contacts', rows: c.emergency, max: 4, addLabel: 'Add contact', cols: [{ key: 'name', label: 'Name', required: true }, { key: 'relation', label: 'Relationship', required: true }, { key: 'phone', label: 'Phone', type: 'tel', required: true }] }); },
      pickup() {
        const c = child();
        rowsEditor({ section: 'pickup', title: 'Authorised pickup', rows: c.pickup.authorised, max: 8, addLabel: 'Add person', cols: [{ key: 'name', label: 'Name', required: true }, { key: 'relation', label: 'Relationship', required: true }, { key: 'phone', label: 'Phone', type: 'tel', required: true }, { key: 'idRef', label: 'ID reference' }, { key: 'status', label: 'Status', required: true, options: Object.entries(store.PICKUP_STATUS), default: 'authorised' }],
          extra: field('kd-verification', 'Identity check instructions', textarea('verification', c.pickup.verification)), collect: form => ({ verification: form.elements.verification.value }) });
      },
      custody() { const c = child(); rowsEditor({ section: 'custody', title: 'Pickup restrictions', rows: c.alerts.filter(a => a.type === 'custody'), max: 4, addLabel: 'Add restriction', cols: [{ key: 'restrictedPerson', label: 'Do not release to', placeholder: 'Name, if the order names a person' }, { key: 'relation', label: 'Relationship' }, { key: 'detail', label: 'Restriction or court-order note', required: true }, { key: 'effective', label: 'Effective from', type: 'date' }] }); },
      passcode() {
        kids.dialog({
          label: 'Child profile / Pickup passcode', title: 'Set a new pickup passcode', desc: 'The current code is never shown here. Tell the family the new code in person or by phone.',
          body: field('kd-passcode', 'New passcode', input('passcode', '', 'type="password" inputmode="numeric" autocomplete="off" required'), { required: true, hint: '4 to 8 digits.' }),
          submit: 'Save passcode',
          async onSubmit(form) { return done(await store.updateChildSection(store.currentUser(), childId, 'passcode', { passcode: form.elements.passcode.value })); }
        });
      },
      allergies() { rowsEditor({ section: 'allergies', title: 'Allergies', rows: child().alerts.filter(a => a.type === 'allergy'), addLabel: 'Add allergy', cols: [{ key: 'detail', label: 'Allergy', required: true, placeholder: 'e.g. Peanuts — EpiPen in office' }, { key: 'severity', label: 'Severity', required: true, options: [['', 'Choose'], ...Object.entries(SEVERITY)] }, { key: 'reaction', label: 'Reaction' }, { key: 'instructions', label: 'What staff should do' }] }); },
      conditions() { rowsEditor({ section: 'conditions', title: 'Medical conditions', rows: child().alerts.filter(a => a.type === 'medical'), addLabel: 'Add condition', cols: [{ key: 'detail', label: 'Condition', required: true }, { key: 'instructions', label: 'What staff should do' }] }); },
      medications() { rowsEditor({ section: 'medications', title: 'Medication', rows: child().medications, addLabel: 'Add medication', cols: [{ key: 'name', label: 'Medication', required: true }, { key: 'dose', label: 'Dose and instructions', required: true }, { key: 'schedule', label: 'Schedule' }, { key: 'storedAt', label: 'Kept in' }, { key: 'consent', label: 'Consent to administer', required: true, options: Object.entries(store.MED_CONSENT), default: 'pending' }] }); },
      dietary() { rowsEditor({ section: 'dietary', title: 'Dietary needs', rows: child().alerts.filter(a => a.type === 'dietary'), addLabel: 'Add dietary need', cols: [{ key: 'detail', label: 'Dietary need', required: true }] }); },
      care() {
        const c = child();
        kids.dialog({
          label: 'Child profile / Care notes', title: 'Edit emergency instructions and care notes', desc: '',
          body: `${field('kd-emergencyInstructions', 'Emergency instructions', textarea('emergencyInstructions', c.emergencyInstructions))}${field('kd-careNotes', 'Care notes', textarea('careNotes', c.careNotes))}`,
          submit: 'Save notes',
          async onSubmit(form) { return done(await store.updateChildSection(store.currentUser(), childId, 'care', { emergencyInstructions: form.elements.emergencyInstructions.value, careNotes: form.elements.careNotes.value })); }
        });
      },
      diary(btn) {
        const e = store.getDiary(childId).find(x => x.id === btn?.dataset.entry);
        kids.dialog({
          label: 'Child profile / Daily diary', title: e ? 'Edit diary entry' : 'Add diary entry', desc: '',
          body: `<div class="kids-form__grid">
            ${field('kd-date', 'Date', input('date', e?.date || store.today(), `type="date" max="${store.today()}" required`), { required: true })}
            ${field('kd-title', 'Title', input('title', e?.title || '', 'required placeholder="e.g. Garden morning"'), { required: true })}
            ${field('kd-meals', 'Meals', input('meals', e?.meals || ''))}
            ${field('kd-rest', 'Rest', input('rest', e?.rest || ''))}</div>
            ${field('kd-notes', 'Notes', textarea('notes', e?.notes || ''))}`,
          submit: 'Save entry',
          async onSubmit(form) { return done(await store.saveDiaryEntry(store.currentUser(), childId, Object.fromEntries(['date', 'title', 'meals', 'rest', 'notes'].map(k => [k, form.elements[k].value])), e?.id)); }
        });
      },
      learning(btn) {
        const l = store.getLearning(childId).find(x => x.id === btn?.dataset.entry);
        kids.dialog({
          label: 'Child profile / Learning', title: l ? 'Edit presentation' : 'Record a presentation', desc: '',
          body: `<div class="kids-form__grid">
            ${field('kd-date', 'Date', input('date', l?.date || store.today(), `type="date" max="${store.today()}" required`), { required: true })}
            ${field('kd-area', 'Learning area', select('area', l?.area || '', [['', 'Choose'], ...store.LEARNING_AREAS.map(a => [a, a])], 'required'), { required: true })}
            ${field('kd-material', 'Activity or material', input('material', l?.material || '', 'required placeholder="e.g. Pink tower"'), { required: true })}
            ${field('kd-stage', 'Stage', select('stage', l?.stage || '', [['', 'Choose'], ...Object.entries(store.LEARNING_STAGES)], 'required'), { required: true })}</div>
            ${field('kd-observation', 'Observation', textarea('observation', l?.observation || ''))}`,
          submit: 'Save',
          async onSubmit(form) { return done(await store.saveLearningEntry(store.currentUser(), childId, Object.fromEntries(['date', 'area', 'material', 'stage', 'observation'].map(k => [k, form.elements[k].value])), l?.id)); }
        });
      },
      document() {
        kids.dialog({
          label: 'Child profile / Documents', title: 'Upload a document', desc: 'PDF, JPEG or PNG, up to 1 MB. Files stay on this device in the prototype.',
          body: `${field('kd-file', 'File', '<input class="input" type="file" id="kd-file" name="file" accept="application/pdf,image/jpeg,image/png" required>', { required: true })}
            <div class="kids-form__grid">
            ${field('kd-name', 'Document name', input('name', '', 'required'), { required: true })}
            ${field('kd-category', 'Category', select('category', '', [['', 'Choose'], ...store.DOC_CATEGORIES.map(x => [x, x])], 'required'), { required: true })}
            ${field('kd-expiry', 'Expiry date', input('expiry', '', 'type="date"'), { hint: 'Optional.' })}</div>`,
          submit: 'Upload',
          async onSubmit(form) {
            const file = form.elements.file.files[0];
            const v = { name: form.elements.name.value || file?.name || '', category: form.elements.category.value, expiry: form.elements.expiry.value, fileName: file?.name, mime: file?.type, size: file?.size };
            if (file && store.DOC_TYPES[file.type] && file.size <= store.DOC_MAX) v.data = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(''); r.readAsDataURL(file); });
            else if (file) v.data = 'rejected';
            return done(await store.addDocument(store.currentUser(), childId, v));
          }
        });
      },
      consent(btn) {
        const x = store.getConsents(childId).find(k => k.type === btn.dataset.consent);
        const guardians = child().guardians.map(g => [g.name, `${g.name} (${g.relation})`]);
        kids.dialog({
          label: 'Child profile / Consents', title: x.label, desc: 'Record the guardian’s response exactly as given.',
          body: `<div class="kids-form__grid">
            ${field('kd-status', 'Response', select('status', x.status === 'expired' ? 'granted' : x.status, [['pending', 'Pending (no response)'], ['granted', 'Granted'], ['declined', 'Declined']]), { required: true })}
            ${field('kd-respondedBy', 'Guardian', select('respondedBy', x.respondedBy, [['', 'Choose'], ...guardians]))}
            ${field('kd-date', 'Response date', input('date', x.date || store.today(), `type="date" max="${store.today()}"`))}
            ${field('kd-expires', 'Expires', input('expires', x.expires || '', 'type="date"'), { hint: 'Optional.' })}</div>`,
          submit: 'Save response',
          async onSubmit(form) { return done(await store.saveConsent(store.currentUser(), childId, { type: x.type, ...Object.fromEntries(['status', 'respondedBy', 'date', 'expires'].map(k => [k, form.elements[k].value])) })); }
        });
      }
    };
    const EDIT_GUARD = { identity: 'identity', guardian: 'family', emergency: 'emergency', pickup: 'emergency', custody: 'custody', passcode: 'passcode', allergies: 'medical', conditions: 'medical', medications: 'medical', dietary: 'medical', care: 'medical', diary: 'diary', learning: 'learning', document: 'documents', consent: 'consents' };

    /* ----------------------------------------------------------- Passcode reveal */

    function hidePass(repaint = true) {
      clearTimeout(revealTimer);
      revealTimer = null;
      if (!revealed) return;
      revealed = '';
      if (repaint && tab === 'emergency') paint();
    }
    async function reveal() {
      if (revealed) { hidePass(); main.querySelector('[data-reveal]')?.focus(); return; }
      const r = await store.revealPasscode(store.currentUser(), childId);
      if (!r.ok) { toast('Passcode not available', 'Your role can’t reveal pickup passcodes.'); return; }
      revealed = r.passcode;
      paint();
      main.querySelector('[data-reveal]')?.focus();
      revealTimer = setTimeout(() => { hidePass(); }, 30000);
    }

    /* ----------------------------------------------------------- Print summary (no passcode, only permitted sections) */

    function printSummary() {
      const c = child();
      const age = store.ageParts(c.dob);
      const medOk = can('medical');
      const custody = c.alerts.filter(a => a.type === 'custody');
      const list = rows => `<table>${rows.filter(Boolean).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v || '—'}</td></tr>`).join('')}</table>`;
      const sec = (title, body) => `<section class="cpp-sec"><h2>${esc(title)}</h2>${body}</section>`;
      main.querySelector('[data-print-area]').innerHTML = `
        <header class="cpp-head"><div><p class="cpp-school">${esc(store.school.name)} · Nexora</p><h1>Child summary</h1></div><p class="cpp-meta">Printed ${esc(when(new Date().toISOString()))} by ${esc(user.name)}<br>Confidential — keep securely</p></header>
        <section class="cpp-id">${c.photo ? `<img src="${esc(c.photo)}" alt="">` : `<span class="cpp-initials">${esc((c.firstName[0] || '') + (c.lastName[0] || ''))}</span>`}
          <div><p class="cpp-name">${esc(store.childName(c))}${c.preferredName ? ` <span>(“${esc(c.preferredName)}”)</span>` : ''}</p>
          ${list([['Date of birth', `${esc(day(c.dob))} · ${age.years}y ${age.months}m`], ['Class', esc(c.cls)], ['Key teacher', esc(c.keyTeacher)], ['Status', esc(store.CHILD_STATUSES[c.status])], ['Start date', esc(day(c.startDate))]])}</div></section>
        ${medOk && c.alerts.some(a => a.type !== 'custody') ? sec('Allergies, medical and dietary', `<ul class="cpp-alerts">${c.alerts.filter(a => a.type !== 'custody').map(a => `<li><b>${esc({ allergy: 'Allergy', medical: 'Medical', dietary: 'Dietary' }[a.type])}${a.severity ? ` (${esc(SEVERITY[a.severity])})` : ''}:</b> ${esc(a.detail)}${a.instructions ? ` — ${esc(a.instructions)}` : ''}</li>`).join('')}</ul>${c.medications.length ? `<p><b>Medication:</b> ${c.medications.map(m => esc(`${m.name}${m.dose ? ` (${m.dose})` : ''}${m.storedAt ? `, kept in ${m.storedAt}` : ''}`)).join('; ')}</p>` : ''}${c.emergencyInstructions ? `<p><b>Emergency instructions:</b> ${esc(c.emergencyInstructions)}</p>` : ''}`) : ''}
        ${!medOk && c.alerts.some(a => a.type !== 'custody') ? sec('Allergies, medical and dietary', '<p>Alerts are on file. Your role can’t print their details.</p>') : ''}
        ${can('custody') && custody.length ? sec('Pickup restrictions', `<ul class="cpp-alerts">${custody.map(a => `<li>${a.restrictedPerson ? `<b>Do not release to: ${esc(a.restrictedPerson)}.</b> ` : ''}${esc(a.detail)}</li>`).join('')}</ul>`) : ''}
        ${sec('Family contacts', list(c.guardians.map(g => [`${g.name} (${g.relation}${g.primary ? ', primary' : ''})`, esc(`${g.phone}${g.email ? ` · ${g.email}` : ''}`)])))}
        ${can('emergency') ? sec('Emergency contacts', c.emergency.length ? list(c.emergency.map(e => [`${e.name} (${e.relation})`, esc(e.phone)])) : '<p>None recorded.</p>') : ''}
        ${can('emergency') ? sec('Authorised to collect', `${c.pickup.authorised.length ? list(c.pickup.authorised.map(p => [`${p.name} (${p.relation})`, esc(p.phone)])) : '<p>Nobody authorised yet.</p>'}${c.pickup.verification ? `<p>${esc(c.pickup.verification)}</p>` : ''}<p class="cpp-small">The pickup passcode is never printed.</p>`) : ''}`;
      document.body.classList.add('is-printing-child');
      const cleanup = () => { document.body.classList.remove('is-printing-child'); removeEventListener('afterprint', cleanup); };
      addEventListener('afterprint', cleanup);
      window.print();
      // Some browsers don't fire afterprint for a cancelled dialog.
      setTimeout(() => { if (!matchMedia('print').matches) cleanup(); }, 1000);
    }

    /* ----------------------------------------------------------- Events */

    frame();
    tab = fromHash();
    paint();

    let openMenu = null;
    const closeMenu = (focus = false) => {
      if (!openMenu) return;
      openMenu.querySelector('.menu').hidden = true;
      const b = openMenu.querySelector('[data-menu-btn]');
      b.setAttribute('aria-expanded', 'false');
      if (focus) b.focus();
      openMenu = null;
    };

    main.addEventListener('click', e => {
      const t = e.target;
      const tabBtn = t.closest('[data-tab]');
      if (tabBtn) { selectTab(tabBtn.dataset.tab); return; }
      const goto = t.closest('[data-goto]');
      if (goto) { selectTab(goto.dataset.goto, { focus: true }); main.querySelector('.cp-tabs').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return; }
      const edit = t.closest('[data-edit]');
      if (edit) {
        const kind = edit.dataset.edit;
        // Checked again here: a pencil only exists for permitted roles, but the action never trusts the markup.
        if (!store.canEditSection(store.currentUser(), EDIT_GUARD[kind])) { toast('Not available', 'Your role can’t edit this section.'); return; }
        EDITORS[kind](edit);
        return;
      }
      if (t.closest('[data-print]')) { printSummary(); return; }
      if (t.closest('[data-reveal]')) { reveal(); return; }
      const menuBtn = t.closest('[data-menu-btn]');
      if (menuBtn) {
        const wrap = menuBtn.closest('.menu-wrap');
        if (openMenu === wrap) { closeMenu(); return; }
        wrap.querySelector('.menu').hidden = false;
        menuBtn.setAttribute('aria-expanded', 'true');
        openMenu = wrap;
        wrap.querySelector('.menu button').focus();
        return;
      }
      const act = t.closest('[data-act]');
      if (act) {
        closeMenu();
        const c = store.childById(childId);
        if (act.dataset.act === 'wizard') { location.href = routes.page('enrol', { id: childId }); return; }
        if (act.dataset.act === 'move') kids.moveDialog(user, [c]);
        if (act.dataset.act === 'withdraw') kids.withdrawDialog(user, c);
        return;
      }
      const unlink = t.closest('[data-unlink]');
      if (unlink) {
        const g = child().guardians.find(x => x.id === unlink.dataset.unlink);
        kids.dialog({
          label: 'Child profile / Family', title: `Remove ${g.name} from ${store.childName(child())}?`,
          desc: `${esc(g.name)} stays on record for any other children they’re linked to. Only this link is removed.`,
          body: '', submit: 'Remove', danger: true,
          async onSubmit() { return done(await store.unlinkGuardian(store.currentUser(), childId, g.id)); }
        });
        return;
      }
      const openDoc = t.closest('[data-open-doc]');
      if (openDoc) {
        const d = store.getDocuments(childId).find(x => x.id === openDoc.dataset.openDoc);
        if (!d || !store.canView(store.currentUser(), 'documents')) return;
        // Real file data only: open it as a blob so the browser shows or downloads it.
        const bytes = atob(d.data.split(',')[1]);
        const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes, ch => ch.charCodeAt(0))], { type: d.mime }));
        const a = Object.assign(document.createElement('a'), { href: url, target: '_blank', rel: 'noopener', download: d.fileName || d.name });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        return;
      }
      const verify = t.closest('[data-verify]');
      if (verify) { store.verifyDocument(store.currentUser(), childId, verify.dataset.verify, verify.dataset.to === '1').then(r => (r.ok ? toast(SAVED) : toast('Not saved', fail(r).message))); }
    });
    main.addEventListener('change', e => { if (e.target.closest('[data-section]')) selectTab(e.target.value, { focus: true }); });
    main.addEventListener('keydown', e => {
      const tabBtn = e.target.closest('[data-tab]');
      if (tabBtn && ['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        const i = TABS.findIndex(x => x.id === tabBtn.dataset.tab);
        const n = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
        selectTab(TABS[n].id);
        main.querySelector(`[data-tab="${TABS[n].id}"]`).focus();
      }
      if (openMenu) {
        const items = [...openMenu.querySelectorAll('.menu button')];
        const i = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); }
        if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
        if (e.key === 'Tab') closeMenu();
      }
    });
    document.addEventListener('click', e => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); });
    addEventListener('hashchange', () => { const h = fromHash(); if (h !== tab) selectTab(h); });

    // Any saved change to this child (here, in S12 or in another tab) repaints header, alerts and the open tab.
    let queued = false;
    store.subscribe(({ key }) => {
      if (key && !/^nexora-(children|guardians|diary|learning|child-docs|consents|register|invoices|payments|incidents|school-plan|demo-role)/.test(key)) return;
      if (key === 'nexora-demo-role') { location.reload(); return; }
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const active = document.activeElement;
        const sel = active && main.contains(active) ? (active.dataset.tab ? `[data-tab="${active.dataset.tab}"]` : active.dataset.edit ? `[data-edit="${active.dataset.edit}"]` : null) : null;
        paint();
        if (sel) main.querySelector(sel)?.focus();
      });
    });
    main.querySelector('#record-title').focus({ preventScroll: true });
    return true;
  }

  window.NexoraProfile = { render, TABS };
})();
