/* Daily Diary & Care Log (app.html?page=diary[&cls=<class>][&date=YYYY-MM-DD][&view=grid|timeline][&child=<id>])
   Reads store.diaryDay (S19 roster + the diary records S13 shows) and writes through store.saveDiaryEntries /
   startNaps / stopNaps / updateDiaryEntry / publishDiaryEntries / addDiaryPhoto. Every bulk action creates one
   record per child; the store re-checks permissions, attendance, allergy acknowledgement, nap overlap and photo
   consent. Today only for new entries; past days can be viewed and existing entries corrected. Test hook: ?fail=1. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const kids = window.NexoraChildren;
  const { routes } = store;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const params = new URLSearchParams(location.search);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const initials = n => String(n || '').trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const timeOf = iso => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '');
  const hhmm = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const dayLabel = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const requestId = () => `req-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const elapsed = start => { const m = Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / 60000)); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

  const TYPES = [['meal', 'Meal', 'utensils'], ['nap', 'Nap', 'moon'], ['toilet', 'Toileting', 'droplet'], ['mood', 'Mood', 'smile'], ['activity', 'Activity', 'shapes'], ['note', 'Note', 'note'], ['photo', 'Photo', 'camera']];
  const TYPE = Object.fromEntries(TYPES.map(([k, label, ic]) => [k, { label, icon: ic }]));
  const ATTEND = { 'not-arrived': 'Not checked in', out: 'Collected', absent: 'Absent' };
  const FAIL = {
    forbidden: 'Your role can’t add diary entries for this class. Nothing was saved.',
    past: 'New entries can only be added for today. Past days can be corrected entry by entry.',
    closed: 'The school is closed today, so no diary entries can be added.',
    none: 'None of the selected children could have this entry — see the reasons below.',
    missing: 'This entry no longer exists. Refresh the page.',
    consent: 'A pictured child’s family hasn’t given photo consent.',
    storage: 'This couldn’t be saved on this device. Nothing was saved. Please try again.'
  };

  function render(key, main, user) {
    if (key !== 'diary') return false;
    page(main, user);
    return true;
  }

  function page(main, user) {
    const scope = store.classScope(user);
    const today = store.today();
    let cls = scope.includes(params.get('cls')) ? params.get('cls') : scope[0] || '';
    let date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') && params.get('date') <= today ? params.get('date') : today;
    let view = params.get('view') === 'timeline' ? 'timeline' : 'grid';
    let timelineChild = params.get('child') || '';
    const selected = new Set();
    let loaded = false;
    let failOnce = params.get('fail') === '1';
    const canEdit = store.canEditSection(user, 'diary');

    main.classList.add('kids-page');
    document.title = 'Daily Diary · Nexora';
    const state = (iconName, title, text, action = '', tone = '') => `<div class="kids-empty dy-state"${tone === 'error' ? ' role="alert"' : ''}><span class="state-icon${tone ? ` state-icon--${tone}` : ''}" aria-hidden="true">${icon(iconName)}</span><h2 class="kids-empty__title">${title}</h2><p>${text}</p>${action}</div>`;

    main.innerHTML = `
      <div class="kids dy">
        <header class="kids-head">
          <div class="kids-head__text"><h1 class="kids-head__title" id="page-title" tabindex="-1">Daily Diary <span class="att-mode" data-mode></span></h1><p class="kids-head__sub">Record meals, naps, toileting, mood, activities, notes and photos — then share them with families.</p></div>
          <div class="kids-head__actions" data-publish></div>
        </header>
        <section class="panel dy-bar" aria-label="Class, date and view">
          <div class="att-bar__pick">
            <div class="field"><label class="field__label" for="dy-cls">Class</label><select class="input" id="dy-cls" data-cls ${scope.length ? '' : 'disabled'}>${scope.length ? scope.map(c => `<option${c === cls ? ' selected' : ''}>${esc(c)}</option>`).join('') : '<option>No classes</option>'}</select></div>
            <div class="field"><label class="field__label" for="dy-date">Date</label><input class="input" id="dy-date" type="date" max="${today}" value="${date}" data-date></div>
          </div>
          <div class="dy-bar__view">
            <div class="segmented dy-toggle" role="group" aria-label="View"><button type="button" data-view="grid" aria-pressed="${view === 'grid'}">${icon('grid', 'icon--sm')}Grid</button><button type="button" data-view="timeline" aria-pressed="${view === 'timeline'}">${icon('list', 'icon--sm')}Timeline</button></div>
            <p class="dy-sel" data-sel aria-live="polite"></p>
          </div>
        </section>
        <div class="dy-quick" data-quick role="toolbar" aria-label="Add to the diary"></div>
        <p class="dy-prompt" data-prompt role="alert" hidden></p>
        <section class="dy-body" aria-labelledby="page-title" aria-busy="true" data-results><span class="skeleton" style="height:240px;border-radius:var(--radius-lg)"></span></section>
      </div>`;
    const $ = s => main.querySelector(s);
    const day = () => store.diaryDay(cls, date);
    const syncUrl = () => {
      const u = new URL(location.href);
      u.searchParams.set('cls', cls);
      if (date === today) u.searchParams.delete('date'); else u.searchParams.set('date', date);
      if (view === 'grid') { u.searchParams.delete('view'); u.searchParams.delete('child'); } else { u.searchParams.set('view', 'timeline'); if (timelineChild) u.searchParams.set('child', timelineChild); }
      history.replaceState(null, '', u);
    };
    const avatar = (child, cls2 = '') => child.photo ? `<img class="dy-av ${cls2}" src="${esc(child.photo)}" alt="">` : `<span class="dy-av ${cls2}" aria-hidden="true">${esc(initials(store.childName(child)))}</span>`;
    const statusBadge = e => (e.status === 'published' ? '' : `<span class="dy-st dy-st--${esc(e.status)}">${esc(e.status === 'draft' ? 'Draft' : 'Staff only')}</span>`);

    function summary(e) {
      const d = e.data || {};
      switch (e.type) {
        case 'meal': return `${store.MEAL_TYPES[d.mealType] || 'Meal'} · ${store.MEAL_AMOUNTS[d.amount] || ''}`;
        case 'nap': { if (!d.end) return 'Sleeping'; const m = Math.max(0, Math.round((new Date(d.end) - new Date(d.start)) / 60000)); return `Slept ${m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`}`; }
        case 'toilet': return store.TOILET_TYPES[d.kind] || 'Toileting';
        case 'mood': return store.MOODS[d.mood] || 'Mood';
        case 'activity': return d.title || 'Activity';
        case 'note': return d.text || e.title || 'Note';
        case 'photo': return d.caption || 'Photo';
        default: return e.title || '';
      }
    }

    /* ---------------------------------------------------------------- Header, quick-add */

    function headerBits(dd) {
      $('[data-mode]').innerHTML = date === today ? '<span class="att-live"><i aria-hidden="true"></i>Today</span>' : '<span class="att-hist">Past day</span>';
      const drafts = dd.rows.flatMap(r => r.entries).filter(e => e.status === 'draft' && !(e.type === 'nap' && !e.data?.end));
      $('[data-publish]').innerHTML = canEdit && drafts.length ? `<button class="btn btn--secondary btn--sm" type="button" data-share-all>${icon('message', 'icon--sm')}Share ${plural(drafts.length, 'draft')} with families</button>` : '';
      const live = dd.live && dd.day.open && canEdit;
      $('[data-sel]').innerHTML = dd.rows.length && live ? `${selected.size ? `<b>${plural(selected.size, 'child', 'children')} selected</b>` : 'Tap children to select them'} · <button class="btn btn--tertiary btn--sm" type="button" data-select-all>Select all here</button>${selected.size ? `<button class="btn btn--tertiary btn--sm" type="button" data-clear>Clear</button>` : ''}` : '';
      $('[data-quick]').innerHTML = live && dd.rows.length
        ? TYPES.map(([k, label, ic]) => `<button class="dy-qbtn" type="button" data-add="${k}">${icon(ic)}<span>${label}</span></button>`).join('')
        : '';
      $('[data-quick]').hidden = !(live && dd.rows.length);
      main.classList.toggle('dy-has-quick', Boolean(live && dd.rows.length));
    }

    /* ---------------------------------------------------------------- Grid (table ≥768, cards <768) */

    function cell(r, type, dd) {
      const e = r.latest[type];
      const live = dd.live && dd.day.open && canEdit;
      const off = r.attendance === 'absent';
      if (type === 'nap' && r.activeNap) {
        return `<button class="dy-cell dy-cell--nap is-running" type="button" data-entry="${esc(r.activeNap.id)}" aria-label="${esc(`${r.child.firstName}: sleeping since ${timeOf(r.activeNap.data.start)}. Open to stop the nap.`)}"><span class="dy-cell__main">${icon('moon', 'icon--sm')}Sleeping</span><span class="dy-cell__time" data-elapsed="${esc(r.activeNap.data.start)}">${elapsed(r.activeNap.data.start)}</span></button>`;
      }
      if (e) return `<button class="dy-cell" type="button" data-entry="${esc(e.id)}" aria-label="${esc(`${r.child.firstName}, ${TYPE[type].label}: ${summary(e)} at ${timeOf(e.at)}${e.status === 'draft' ? ', draft' : e.status === 'internal' ? ', staff only' : ''}. Open entry.`)}"><span class="dy-cell__main">${esc(summary(e))}</span><span class="dy-cell__time">${esc(timeOf(e.at))}${statusBadge(e)}</span></button>`;
      if (off) return `<span class="dy-cell dy-cell--off">Absent</span>`;
      if (!live) return `<span class="dy-cell dy-cell--empty">—<span class="sr-only">Nothing recorded</span></span>`;
      return `<button class="dy-cell dy-cell--empty" type="button" data-quick-one="${esc(r.child.id)}" data-type="${type}" aria-label="${esc(`${r.child.firstName}: no ${TYPE[type].label.toLowerCase()} recorded yet. Add one.`)}"><span class="dy-cell__plus">${icon('plus', 'icon--sm')}</span><span class="sr-only">Add</span></button>`;
    }
    function pick(r, dd) {
      const live = dd.live && dd.day.open && canEdit;
      const can = live && r.attendance !== 'absent';
      return `<button class="dy-pick${selected.has(r.child.id) ? ' is-selected' : ''}" type="button" data-pick="${esc(r.child.id)}" aria-pressed="${selected.has(r.child.id)}" ${can ? '' : 'disabled'} aria-label="${esc(`${can ? 'Select' : ''} ${store.childName(r.child)}${r.attendance && ATTEND[r.attendance] ? ` (${ATTEND[r.attendance]})` : ''}`.trim())}">
        <span class="dy-pick__av">${avatar(r.child)}<span class="dy-pick__tick" aria-hidden="true">${icon('check', 'icon--sm')}</span></span>
        <span class="dy-pick__name"><b>${esc(r.child.preferredName || r.child.firstName)} ${esc(r.child.lastName.slice(0, 1))}.</b>${r.attendance && ATTEND[r.attendance] ? `<small class="dy-att dy-att--${esc(r.attendance)}">${esc(ATTEND[r.attendance])}</small>` : ''}${r.child.alerts.some(a => ['allergy', 'dietary'].includes(a.type)) ? `<small class="dy-food">${icon('allergy', 'icon--sm')}Food alert</small>` : ''}</span>
      </button>`;
    }
    function gridHtml(dd) {
      const head = `<thead><tr><th scope="col" class="dy-th-child">Child</th>${TYPES.map(([k, label, ic]) => `<th scope="col">${icon(ic, 'icon--sm')}${label}</th>`).join('')}</tr></thead>`;
      const table = `<div class="dy-table-wrap"><table class="dy-table"><caption class="sr-only">Diary for ${esc(cls)}, ${esc(dayLabel(date))}. Rows are children; columns show the latest entry of each type.</caption>${head}<tbody>${dd.rows.map(r => `<tr class="${selected.has(r.child.id) ? 'is-selected' : ''}${r.attendance === 'absent' ? ' is-absent' : ''}"><th scope="row">${pick(r, dd)}</th>${TYPES.map(([k]) => `<td>${cell(r, k, dd)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      const cards = `<ul class="dy-cards">${dd.rows.map(r => `<li class="dy-card${selected.has(r.child.id) ? ' is-selected' : ''}">${pick(r, dd)}<ul class="dy-card__list">${TYPES.map(([k, label, ic]) => `<li><span class="dy-card__type">${icon(ic, 'icon--sm')}<span class="sr-only">${label}</span></span>${cell(r, k, dd)}</li>`).join('')}</ul></li>`).join('')}</ul>`;
      return table + cards;
    }

    /* ---------------------------------------------------------------- Timeline */

    function timelineHtml(dd) {
      if (!dd.rows.some(r => r.child.id === timelineChild)) timelineChild = [...selected][0] || dd.rows[0].child.id;
      const i = dd.rows.findIndex(r => r.child.id === timelineChild);
      const r = dd.rows[i];
      const nav = `<div class="dy-tl-nav">
          <button class="btn btn--icon-ghost" type="button" data-tl-step="-1" aria-label="Previous child" ${i > 0 ? '' : 'disabled'}>${icon('arrow-left')}</button>
          <div class="field dy-tl-pick"><label class="sr-only" for="dy-child">Child</label><select class="input" id="dy-child" data-tl-child>${dd.rows.map(x => `<option value="${esc(x.child.id)}"${x.child.id === timelineChild ? ' selected' : ''}>${esc(store.childName(x.child))}</option>`).join('')}</select></div>
          <button class="btn btn--icon-ghost" type="button" data-tl-step="1" aria-label="Next child" ${i < dd.rows.length - 1 ? '' : 'disabled'}>${icon('arrow-right')}</button>
        </div>`;
      const head = `<div class="dy-tl-head">${avatar(r.child, 'dy-av--lg')}<div><p class="dy-tl-name">${esc(store.childName(r.child))}</p><p class="cp-muted">${esc(dayLabel(date))}${r.attendance && ATTEND[r.attendance] ? ` · ${esc(ATTEND[r.attendance])}` : ''}</p></div>
        ${dd.live && dd.day.open && canEdit && r.attendance !== 'absent' ? `<button class="btn btn--secondary btn--sm" type="button" data-pick="${esc(r.child.id)}" aria-pressed="${selected.has(r.child.id)}">${selected.has(r.child.id) ? `${icon('check', 'icon--sm')}Selected` : 'Select'}</button>` : ''}</div>`;
      const list = r.entries.length
        ? `<ol class="dy-tl">${r.entries.map(e => `<li class="dy-tl__item${e.type === 'nap' && !e.data?.end ? ' is-running' : ''}"><span class="dy-tl__time">${esc(timeOf(e.at))}</span>
            <button class="dy-tl__card" type="button" data-entry="${esc(e.id)}" aria-label="${esc(`${timeOf(e.at)} ${TYPE[e.type]?.label || 'Entry'}: ${summary(e)}. Open entry.`)}">
              <span class="dy-tl__type">${icon(TYPE[e.type]?.icon || 'note', 'icon--sm')}${esc(TYPE[e.type]?.label || 'Entry')}${statusBadge(e)}</span>
              <span class="dy-tl__sum">${esc(summary(e))}${e.type === 'nap' && !e.data?.end ? ` · <b data-elapsed="${esc(e.data.start)}">${elapsed(e.data.start)}</b>` : ''}</span>
              ${e.data?.note ? `<span class="dy-tl__note">${esc(e.data.note)}</span>` : ''}
              <span class="dy-tl__by">${esc(e.author || '')}</span>
            </button></li>`).join('')}</ol>`
        : state('book', 'Nothing recorded yet', `${esc(r.child.firstName)}’s entries for ${esc(dayLabel(date))} will appear here in time order.`);
      return `<section class="panel dy-tl-wrap">${nav}${head}${list}</section>`;
    }

    function paint() {
      if (!loaded) return;
      const res = $('[data-results]');
      res.removeAttribute('aria-busy');
      if (!scope.length) {
        res.innerHTML = state('grid', 'No class to show', user.role === 'Teacher' ? 'You aren’t assigned to a class yet. Ask the school office.' : 'Add a class first.');
        $('[data-quick]').hidden = true;
        return;
      }
      const dd = day();
      [...selected].forEach(id => { const r = dd.rows.find(x => x.child.id === id); if (!r || r.attendance === 'absent') selected.delete(id); });
      headerBits(dd);
      main.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
      if (!dd.rows.length) {
        res.innerHTML = !dd.day.open
          ? state('calendar-check', dd.day.kind === 'holiday' ? esc(dd.day.name) : `School closed on ${esc(dd.day.name)}s`, `No children are expected on ${esc(dayLabel(date))}, so there’s no diary for this day.`)
          : state('users', 'No children in this class', 'Children appear here once they’re enrolled and expected today.');
        return;
      }
      const intro = !dd.live ? `<p class="dy-note">${icon('info', 'icon--sm')}${esc(dayLabel(date))} is a past day. You can open and correct entries; new entries can only be added for today.</p>` : '';
      res.innerHTML = intro + (view === 'grid' ? gridHtml(dd) : timelineHtml(dd));
    }

    function load() {
      loaded = false;
      setTimeout(() => {
        try {
          if (failOnce) { failOnce = false; throw new Error('test failure'); }
          loaded = true;
          if (cls) syncUrl();
          paint();
        } catch {
          $('[data-results]').removeAttribute('aria-busy');
          $('[data-results]').innerHTML = state('alert-circle', 'Something went wrong', 'We couldn’t load the diary. Nothing has changed.', `<button class="btn btn--secondary" type="button" data-retry>${icon('refresh', 'icon--sm')}Try again</button>`, 'error');
        }
      }, reduceMotion.matches ? 0 : 300);
    }

    /* ---------------------------------------------------------------- Shared form pieces */

    const chosen = ids => ids.map(id => store.childById(id)).filter(Boolean);
    const whoHtml = list => `<div class="dy-who"><span class="field__label">${list.length === 1 ? 'Child' : `${list.length} children — one entry each`}</span><ul class="dy-who__list">${list.map(c => `<li>${avatar(c, 'dy-av--sm')}${esc(c.preferredName || c.firstName)}</li>`).join('')}</ul></div>`;
    const timeField = (value = hhmm()) => kids.field('kd-time', 'Time', `<input class="input" id="kd-time" name="time" type="time" required value="${value}">`, { required: true });
    const noteField = (value = '') => kids.field('kd-note', 'Note', `<textarea class="input" id="kd-note" name="note" rows="2" maxlength="500" placeholder="Optional">${esc(value)}</textarea>`);
    const statusField = (allowInternal = false, value = 'draft') => `<fieldset class="field dy-status"><legend class="field__label">Family sharing</legend><div class="dy-chips">
        <label class="cls-pick"><input type="radio" name="st" value="draft"${value === 'draft' ? ' checked' : ''}><span><b>Save as draft</b><small>Staff can see it</small></span></label>
        <label class="cls-pick"><input type="radio" name="st" value="published"${value === 'published' ? ' checked' : ''}><span><b>Share with family</b><small>Appears in their diary</small></span></label>
        ${allowInternal ? `<label class="cls-pick"><input type="radio" name="st" value="internal"${value === 'internal' ? ' checked' : ''}><span><b>Staff only</b><small>Never shared</small></span></label>` : ''}
      </div><p class="field__hint field__hint--error" data-error-for="status" hidden></p></fieldset>`;
    const chips = (name, options, errKey, value = '', withIcons = null) => `<div class="dy-chips" role="radiogroup">${Object.entries(options).map(([k, label]) => `<label class="cls-pick dy-chip"><input type="radio" name="${name}" value="${k}"${value === k ? ' checked' : ''}><span>${withIcons ? icon(withIcons(k)) : ''}<b>${esc(label)}</b></span></label>`).join('')}</div><p class="field__hint field__hint--error" data-error-for="${errKey}" hidden></p>`;
    const radio = (form, name) => form.querySelector(`[name="${name}"]:checked`)?.value || '';
    function afterSave(res, label) {
      const n = res.entries?.length || 0;
      const skipped = res.skipped?.length ? ` Skipped: ${res.skipped.map(s => `${s.name} (${s.reason.toLowerCase()})`).join(', ')}.` : '';
      window.NexoraToast?.show(res.repeated ? 'Already saved' : `${label} saved`, `${n === 1 ? 'Saved for 1 child.' : `Saved for ${n} children — one entry each.`}${skipped}`);
    }
    function failure(res) {
      if (res.errors) return { ok: false, errors: res.errors };
      if (res.reason === 'none') return { ok: false, message: `Nothing was saved. ${res.skipped.map(s => `${s.name}: ${s.reason}`).join('; ')}.` };
      return { ok: false, message: FAIL[res.reason] || FAIL.storage };
    }
    const defaultMeal = () => { const m = new Date().getHours() * 60 + new Date().getMinutes(); return m < 600 ? 'breakfast' : m < 690 ? 'morning-snack' : m < 840 ? 'lunch' : 'afternoon-snack'; };

    /* ---------------------------------------------------------------- Meal (with allergy check) */

    function mealDialog(ids) {
      const list = chosen(ids);
      const menu = store.menuFor(date);
      let sig = '';
      const d = kids.dialog({
        label: `${cls} / Diary`,
        title: 'Meal',
        desc: '',
        body: `<div class="dy-form">${whoHtml(list)}
          <fieldset class="field"><legend class="field__label">Meal <span class="field__req" aria-hidden="true">*</span></legend>${chips('mt', store.MEAL_TYPES, 'mealType', defaultMeal())}</fieldset>
          <fieldset class="field dy-menu"><legend class="field__label">What was served <span class="field__req" aria-hidden="true">*</span></legend>
            ${menu.available ? '<div class="dy-items" data-items></div>' : `<p class="dy-warn dy-warn--info">${icon('info', 'icon--sm')}${esc(menu.reason)}. Describe the food below — it can’t be checked against allergies automatically.</p>`}
            <label class="field__label dy-other" for="kd-otherFood">${menu.available ? 'Something else (optional)' : 'Food served'}</label>
            <input class="input" id="kd-otherFood" name="otherFood" maxlength="120" autocomplete="off" placeholder="${menu.available ? 'e.g. extra fruit' : 'e.g. rice and dal'}">
            <p class="field__hint field__hint--error" data-error-for="items" hidden></p>
          </fieldset>
          <fieldset class="field"><legend class="field__label">Amount eaten <span class="field__req" aria-hidden="true">*</span></legend>${chips('amt', store.MEAL_AMOUNTS, 'amount')}</fieldset>
          <div class="dy-allergy" data-allergy aria-live="polite"></div>
          <div class="cls-form__row">${timeField()}${statusField()}</div>
          ${noteField()}
        </div>`,
        submit: 'Save meal',
        async onSubmit(form) {
          const ack = form.querySelector('[data-ack]');
          const res = await store.saveDiaryEntries(store.currentUser(), {
            cls, date, type: 'meal', childIds: ids, time: form.elements.time.value, status: radio(form, 'st'), requestId: form.dataset.req,
            mealType: radio(form, 'mt'), amount: radio(form, 'amt'), itemIds: [...form.querySelectorAll('[name="item"]:checked')].map(i => i.value),
            otherFood: form.elements.otherFood.value, note: form.elements.note.value, allergyAck: ack?.checked ? ack.dataset.sig : ''
          });
          if (res.ok) { afterSave(res, 'Meal'); return res; }
          form.dataset.req = requestId();
          if (res.reason === 'allergy-ack') { drawAllergy(); return { ok: false, message: 'Allergy information changed or wasn’t confirmed. Check the warning and tick “Checked and safe”.' }; }
          return failure(res);
        }
      });
      const form = d.form;
      form.dataset.req = requestId();
      function drawItems() {
        const box = form.querySelector('[data-items]');
        if (!box) return;
        const mt = radio(form, 'mt');
        const checked = new Set([...form.querySelectorAll('[name="item"]:checked')].map(i => i.value));
        const items = menu.items.filter(i => i.meal === mt);
        box.innerHTML = items.length
          ? items.map(i => `<label class="cls-pick dy-item"><input type="checkbox" name="item" value="${esc(i.id)}"${checked.has(i.id) ? ' checked' : ''}><span><b>${esc(i.name)}</b><small>${Array.isArray(i.allergens) ? (i.allergens.length || i.tags.length ? `Contains: ${[...i.allergens, ...i.tags].map(a => store.ALLERGENS[a] || a).join(', ')}` : 'No listed allergens') : '<span class="dy-unknown">Ingredients not recorded</span>'}</small></span></label>`).join('')
          : `<p class="cp-muted">Nothing on today’s menu for ${esc(store.MEAL_TYPES[mt] || 'this meal').toLowerCase()}. Describe it below.</p>`;
      }
      function drawAllergy() {
        const box = form.querySelector('[data-allergy]');
        const itemIds = [...form.querySelectorAll('[name="item"]:checked')].map(i => i.value);
        const check = store.mealCheck(user, { childIds: ids, itemIds, date });
        const prevChecked = form.querySelector('[data-ack]')?.checked && sig === check.signature;
        sig = check.signature;
        const lines = [
          ...check.conflicts.filter(c => c.kind === 'allergy').map(c => `<li class="dy-warn dy-warn--allergy">${icon('alert-triangle', 'icon--sm')}<span><b>Allergy warning: ${esc(c.name)} — ${esc(c.label)}</b>${c.severe ? ' (severe)' : ''} · ${esc(c.items.join(', '))}</span></li>`),
          ...check.conflicts.filter(c => c.kind === 'dietary').map(c => `<li class="dy-warn dy-warn--diet">${icon('leaf', 'icon--sm')}<span><b>Dietary: ${esc(c.name)} — no ${esc(c.label.toLowerCase())}</b> · ${esc(c.items.join(', '))}</span></li>`),
          ...check.conflicts.filter(c => c.kind === 'check').map(c => `<li class="dy-warn dy-warn--diet">${icon('info', 'icon--sm')}<span><b>Check: ${esc(c.name)} — ${esc(c.label)}</b> · ${esc(c.items.join(', '))}</span></li>`),
          ...check.unknownItems.map(n => `<li class="dy-warn dy-warn--unknown">${icon('alert-circle', 'icon--sm')}<span><b>Safety can’t be verified:</b> ingredients aren’t recorded for ${esc(n)}.</span></li>`),
          ...check.unmatched.map(u => `<li class="dy-warn dy-warn--unknown">${icon('alert-circle', 'icon--sm')}<span><b>Check by hand: ${esc(u.name)}</b> — “${esc(u.detail)}” can’t be matched to ingredients automatically.</span></li>`),
          ...(check.hidden ? [`<li class="dy-warn dy-warn--allergy">${icon('alert-triangle', 'icon--sm')}<span><b>${plural(check.hidden, 'food warning')}</b> for the selected children. Ask the class teacher before serving.</span></li>`] : [])
        ];
        if (!check.needsAck) {
          box.innerHTML = itemIds.length ? `<p class="dy-ok">${icon('check-circle', 'icon--sm')}No allergy or dietary matches found in the records for these children and items.</p>` : '';
          return;
        }
        box.innerHTML = `<ul class="dy-warns">${lines.join('')}</ul>
          <label class="dy-ack"><input type="checkbox" data-ack data-sig="${esc(check.signature)}"${prevChecked ? ' checked' : ''}><span><b>Checked and safe</b> — I’ve checked these warnings for the children and food selected. This records my check; it doesn’t mark any food as safe.</span></label>`;
      }
      form.addEventListener('change', e => {
        if (e.target.name === 'mt') { drawItems(); drawAllergy(); }
        if (e.target.name === 'item') drawAllergy();
      });
      drawItems();
      drawAllergy();
    }

    /* ---------------------------------------------------------------- Nap */

    function napDialog(ids) {
      const dd = day();
      const list = chosen(ids);
      const sleeping = list.filter(c => dd.rows.find(r => r.child.id === c.id)?.activeNap);
      const awake = list.filter(c => !sleeping.includes(c));
      let mode = awake.length ? 'start' : 'stop';
      const d = kids.dialog({
        label: `${cls} / Diary`,
        title: 'Nap',
        desc: '',
        body: `<div class="dy-form">${whoHtml(list)}
          <ul class="dy-napstate">${list.map(c => { const n = dd.rows.find(r => r.child.id === c.id)?.activeNap; return `<li>${esc(c.preferredName || c.firstName)}: ${n ? `<b>sleeping since ${esc(timeOf(n.data.start))}</b> (<span data-elapsed="${esc(n.data.start)}">${elapsed(n.data.start)}</span>)` : 'awake'}</li>`; }).join('')}</ul>
          <details class="dy-manual"><summary>Enter times instead (a nap that already happened)</summary>
            <div class="cls-form__row">${kids.field('kd-start', 'Fell asleep', '<input class="input" id="kd-start" name="start" type="time">')}${kids.field('kd-end', 'Woke up', '<input class="input" id="kd-end" name="end" type="time">')}</div>
            ${noteField()}${statusField()}
          </details>
        </div>`,
        submit: awake.length ? `Start nap${awake.length > 1 ? ` for ${awake.length}` : ''}` : `Stop nap${sleeping.length > 1 ? ` for ${sleeping.length}` : ''}`,
        async onSubmit(form) {
          const f = form.elements;
          let res;
          if (form.querySelector('.dy-manual').open && (f.start.value || f.end.value)) {
            res = await store.saveDiaryEntries(store.currentUser(), { cls, date, type: 'nap', childIds: awake.map(c => c.id), start: f.start.value, end: f.end.value, note: f.note.value, status: radio(form, 'st'), requestId: form.dataset.req });
            if (res.ok) { afterSave(res, 'Nap'); return res; }
          } else if (mode === 'start') {
            res = await store.startNaps(store.currentUser(), { cls, childIds: awake.map(c => c.id), requestId: form.dataset.req });
            if (res.ok) { window.NexoraToast?.show('Nap started', `${plural(res.entries.length, 'child', 'children')} · ${timeOf(res.entries[0].data.start)}.${res.skipped.length ? ` Skipped: ${res.skipped.map(s => `${s.name} (${s.reason.toLowerCase()})`).join(', ')}.` : ''}`); return res; }
          } else {
            res = await store.stopNaps(store.currentUser(), { cls, childIds: sleeping.map(c => c.id) });
            if (res.ok) { window.NexoraToast?.show('Nap stopped', res.entries.map(e => `${store.childById(e.childId)?.firstName}: ${e.title.replace('Nap · ', '')}`).join(' · ')); return res; }
          }
          form.dataset.req = requestId();
          return failure(res);
        }
      });
      d.form.dataset.req = requestId();
      if (awake.length && sleeping.length) {
        const foot = d.form.querySelector('.modal__foot');
        foot.insertAdjacentHTML('beforeend', `<button class="btn btn--secondary" type="button" data-stop-too>${icon('moon', 'icon--sm')}Stop nap for ${sleeping.map(c => c.firstName).join(', ')}</button>`);
        foot.querySelector('[data-stop-too]').addEventListener('click', () => { mode = 'stop'; d.form.querySelector('.dy-manual').open = false; d.form.requestSubmit(); });
      }
      if (!awake.length) d.form.querySelector('.dy-manual').hidden = true;
    }

    /* ---------------------------------------------------------------- Toileting, mood, activity, note */

    function simpleDialog(type, ids) {
      const list = chosen(ids);
      const body = {
        toilet: () => `<fieldset class="field"><legend class="field__label">Type <span class="field__req" aria-hidden="true">*</span></legend>${chips('tk', store.TOILET_TYPES, 'kind')}</fieldset>`,
        mood: () => `<fieldset class="field"><legend class="field__label">Mood <span class="field__req" aria-hidden="true">*</span></legend>${chips('md', store.MOODS, 'mood', '', k => `mood-${k}`)}<p class="field__hint">How the child seemed — a quick observation, not an assessment.</p></fieldset>`,
        activity: () => `${kids.field('kd-title', 'Activity', '<input class="input" id="kd-title" name="title" maxlength="80" autocomplete="off" required placeholder="e.g. Pouring water">', { required: true })}
          ${kids.field('kd-area', 'Learning area', `<select class="input" id="kd-area" name="area"><option value="">Not set</option>${store.LEARNING_AREAS.map(a => `<option>${esc(a)}</option>`).join('')}</select>`)}
          ${kids.field('kd-description', 'What happened', '<textarea class="input" id="kd-description" name="description" rows="3" maxlength="1000" placeholder="Optional observation"></textarea>')}
          ${list.length > 1 ? `<details class="dy-manual"><summary>Write a different observation for each child</summary>${list.map(c => kids.field(`kd-pc-${c.id}`, c.preferredName || c.firstName, `<textarea class="input" id="kd-pc-${esc(c.id)}" data-per="${esc(c.id)}" rows="2" maxlength="1000" placeholder="Leave blank to use the shared text"></textarea>`)).join('')}</details>` : ''}`,
        note: () => kids.field('kd-text', 'Note', '<textarea class="input" id="kd-text" name="text" rows="4" maxlength="1000" required></textarea>', { required: true })
      }[type]();
      const d = kids.dialog({
        label: `${cls} / Diary`,
        title: TYPE[type].label,
        desc: '',
        body: `<div class="dy-form">${whoHtml(list)}${body}<div class="cls-form__row">${timeField()}${statusField(type === 'note')}</div>${type === 'note' || type === 'activity' ? '' : noteField()}</div>`,
        submit: `Save ${TYPE[type].label.toLowerCase()}`,
        async onSubmit(form) {
          const f = form.elements;
          const input = { cls, date, type, childIds: ids, time: f.time.value, status: radio(form, 'st'), requestId: form.dataset.req, note: f.note?.value || '' };
          if (type === 'toilet') input.kind = radio(form, 'tk');
          if (type === 'mood') input.mood = radio(form, 'md');
          if (type === 'activity') { Object.assign(input, { title: f.title.value, area: f.area.value, description: f.description.value }); input.perChild = Object.fromEntries([...form.querySelectorAll('[data-per]')].filter(t => t.value.trim()).map(t => [t.dataset.per, t.value])); }
          if (type === 'note') input.text = f.text.value;
          const res = await store.saveDiaryEntries(store.currentUser(), input);
          if (res.ok) { afterSave(res, TYPE[type].label); return res; }
          form.dataset.req = requestId();
          return failure(res);
        }
      });
      d.form.dataset.req = requestId();
    }

    /* ---------------------------------------------------------------- Photo */

    // Downscales on this device before saving (longest side 1280 px, JPEG), so photos fit device storage.
    function shrink(file) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          const data = canvas.toDataURL('image/jpeg', 0.82);
          resolve({ data, mime: 'image/jpeg', size: Math.round((data.length - 23) * 0.75) });
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
        img.src = url;
      });
    }
    function photoDialog(ids) {
      const list = chosen(ids);
      const consent = id => store.getConsents(id).find(x => x.type === 'photos-gallery')?.status === 'granted';
      const missing = list.filter(c => !consent(c.id));
      let photo = null;
      const d = kids.dialog({
        label: `${cls} / Diary`,
        title: 'Photo',
        desc: '',
        body: `<div class="dy-form">${whoHtml(list)}
          <div class="field"><label class="field__label" for="kd-file">Photo <span class="field__req" aria-hidden="true">*</span></label>
            <input class="input" id="kd-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required>
            <p class="field__hint">JPEG, PNG or WebP. It’s resized and kept on this device only in this prototype.</p>
            <p class="field__hint field__hint--error" data-error-for="file" hidden></p></div>
          <div class="dy-preview" data-preview hidden></div>
          ${kids.field('kd-caption', 'Caption', '<input class="input" id="kd-caption" name="caption" maxlength="200" autocomplete="off" placeholder="Optional — what’s happening">')}
          ${list.length > 1 ? `<label class="dy-ack"><input type="checkbox" name="confirmMulti"><span><b>This photo shows all ${list.length} selected children.</b> It will be added to each child’s diary.</span></label><p class="field__hint field__hint--error" data-error-for="confirmMulti" hidden></p>` : ''}
          ${missing.length ? `<p class="dy-warn dy-warn--info">${icon('info', 'icon--sm')}No photo consent on file for ${esc(missing.map(c => c.firstName).join(', '))}. You can save a draft for staff, but it can’t be shared with families.</p>` : ''}
          <div class="cls-form__row">${timeField()}${statusField()}</div>
        </div>`,
        submit: 'Save photo',
        async onSubmit(form) {
          if (!photo) return { ok: false, errors: { file: 'Choose a photo.' } };
          const res = await store.addDiaryPhoto(store.currentUser(), { cls, date, childIds: ids, ...photo, caption: form.elements.caption.value, time: form.elements.time.value, status: radio(form, 'st'), confirmMulti: Boolean(form.elements.confirmMulti?.checked), requestId: form.dataset.req });
          if (res.ok) { afterSave(res, 'Photo'); return res; }
          form.dataset.req = requestId();
          return failure(res);
        }
      });
      const form = d.form;
      form.dataset.req = requestId();
      const btn = form.querySelector('[type="submit"]');
      form.elements.file.addEventListener('change', async () => {
        const file = form.elements.file.files[0];
        const box = form.querySelector('[data-preview]');
        const err = form.querySelector('[data-error-for="file"]');
        photo = null;
        err.hidden = true;
        if (!file) { box.hidden = true; return; }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { err.textContent = 'Choose a JPEG, PNG or WebP photo.'; err.hidden = false; box.hidden = true; return; }
        btn.disabled = true;
        box.hidden = false;
        box.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>Preparing photo…</span>`;
        try {
          photo = await shrink(file);
          if (photo.size > 1024 * 1024) { photo = null; throw new Error('large'); }
          box.innerHTML = `<img src="${photo.data}" alt="Preview of the selected photo"><span>${Math.round(photo.size / 1024)} KB · ready to save</span>`;
        } catch (e) {
          box.innerHTML = '';
          box.hidden = true;
          err.textContent = e.message === 'large' ? 'This photo is too large even after resizing. Choose a smaller one.' : 'This file couldn’t be read as a photo. Choose another.';
          err.hidden = false;
        } finally { btn.disabled = false; }
      });
    }

    /* ---------------------------------------------------------------- Open / edit an entry */

    function entryDialog(entryId) {
      const dd = day();
      const r = dd.rows.find(x => x.entries.some(e => e.id === entryId));
      const e = r?.entries.find(x => x.id === entryId);
      if (!e) { window.NexoraToast?.show('Entry not found', FAIL.missing, 'info'); paint(); return; }
      const child = r.child;
      const d0 = e.data || {};
      const editable = canEdit && !e.legacy;
      const running = e.type === 'nap' && !d0.end;
      const fields = !editable ? '' : {
        meal: () => `<fieldset class="field"><legend class="field__label">Amount eaten</legend>${chips('amt', store.MEAL_AMOUNTS, 'amount', d0.amount)}</fieldset>${timeField(hhmm(new Date(e.at)))}${noteField(d0.note)}`,
        nap: () => `<div class="cls-form__row">${kids.field('kd-start', 'Fell asleep', `<input class="input" id="kd-start" name="start" type="time" required value="${hhmm(new Date(d0.start))}">`, { required: true })}${kids.field('kd-end', running ? 'Woke up (leave empty while sleeping)' : 'Woke up', `<input class="input" id="kd-end" name="end" type="time" value="${d0.end ? hhmm(new Date(d0.end)) : ''}">`)}</div>${noteField(d0.note)}`,
        toilet: () => `<fieldset class="field"><legend class="field__label">Type</legend>${chips('tk', store.TOILET_TYPES, 'kind', d0.kind)}</fieldset>${timeField(hhmm(new Date(e.at)))}${noteField(d0.note)}`,
        mood: () => `<fieldset class="field"><legend class="field__label">Mood</legend>${chips('md', store.MOODS, 'mood', d0.mood, k => `mood-${k}`)}</fieldset>${timeField(hhmm(new Date(e.at)))}${noteField(d0.note)}`,
        activity: () => `${kids.field('kd-title', 'Activity', `<input class="input" id="kd-title" name="title" maxlength="80" required value="${esc(d0.title)}">`, { required: true })}${kids.field('kd-area', 'Learning area', `<select class="input" id="kd-area" name="area"><option value="">Not set</option>${store.LEARNING_AREAS.map(a => `<option${a === d0.area ? ' selected' : ''}>${esc(a)}</option>`).join('')}</select>`)}${kids.field('kd-description', 'What happened', `<textarea class="input" id="kd-description" name="description" rows="3" maxlength="1000">${esc(d0.description)}</textarea>`)}${timeField(hhmm(new Date(e.at)))}`,
        note: () => `${kids.field('kd-text', 'Note', `<textarea class="input" id="kd-text" name="text" rows="4" maxlength="1000" required>${esc(d0.text)}</textarea>`, { required: true })}${timeField(hhmm(new Date(e.at)))}`,
        photo: () => kids.field('kd-caption', 'Caption', `<input class="input" id="kd-caption" name="caption" maxlength="200" value="${esc(d0.caption)}">`)
      }[e.type]();
      const img = e.type === 'photo' ? store.diaryPhoto(user, d0.photoId) : null;
      const meta = [
        ['Type', TYPE[e.type]?.label || 'Entry'], ['Time', timeOf(e.at)], ['Status', store.DIARY_STATUS[e.status]],
        e.type === 'meal' && ['Food', [...(d0.items || []).map(i => i.name), d0.otherFood].filter(Boolean).join(', ') || '—'],
        e.type === 'meal' && e.allergyCheck?.acknowledged && ['Allergy check', `Warnings checked by ${e.allergyCheck.by} at ${timeOf(e.allergyCheck.at)}`],
        e.type === 'nap' && ['Nap', running ? `Sleeping since ${timeOf(d0.start)}` : `${timeOf(d0.start)}–${timeOf(d0.end)}`],
        ['Recorded by', `${e.author || '—'}${e.updatedBy ? ` · edited by ${e.updatedBy}` : ''}`]
      ].filter(Boolean);
      const dlg = kids.dialog({
        label: `${child.firstName} / ${dayLabel(e.date)}`,
        title: `${TYPE[e.type]?.label || 'Entry'} · ${child.preferredName || child.firstName}`,
        desc: e.legacy ? 'Added from the child’s profile. Edit it there.' : '',
        body: `<div class="dy-form">
          ${img ? `<img class="dy-photo" src="${img}" alt="${esc(d0.caption || `Photo of ${child.firstName}`)}">` : e.type === 'photo' ? '<p class="dy-warn dy-warn--info">The photo file isn’t available on this device.</p>' : ''}
          <dl class="token-sheet">${meta.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
          ${!editable && e.type !== 'photo' ? `<p>${esc(summary(e))}</p>` : ''}
          ${fields}
          ${editable && e.status !== 'internal' && !running ? statusField(false, e.status) : ''}
          ${(e.history || []).length > 1 ? `<details class="dy-manual"><summary>History (${e.history.length})</summary><ul class="dy-hist">${e.history.map(h => `<li><b>${esc(timeOf(h.at))}</b> ${esc(h.by)} · ${esc(h.action)}${h.detail ? ` — ${esc(h.detail)}` : ''}</li>`).join('')}</ul></details>` : ''}
        </div>`,
        submit: editable ? 'Save changes' : 'Close',
        async onSubmit(form) {
          if (!editable) return { ok: true };
          const f = form.elements;
          const patch = { status: radio(form, 'st') || undefined, note: f.note?.value };
          if (e.type !== 'nap' && e.type !== 'photo') patch.time = f.time.value;
          if (e.type === 'meal') patch.amount = radio(form, 'amt');
          if (e.type === 'toilet') patch.kind = radio(form, 'tk');
          if (e.type === 'mood') patch.mood = radio(form, 'md');
          if (e.type === 'activity') Object.assign(patch, { title: f.title.value, area: f.area.value, description: f.description.value });
          if (e.type === 'note') patch.text = f.text.value;
          if (e.type === 'nap') Object.assign(patch, { start: f.start.value, end: f.end.value });
          if (e.type === 'photo') patch.caption = f.caption.value;
          const res = await store.updateDiaryEntry(store.currentUser(), e.id, patch);
          if (res.ok) { window.NexoraToast?.show('Entry updated', `${child.firstName} · ${TYPE[e.type].label}`); return res; }
          return failure(res);
        }
      });
      if (editable && running && dd.live) {
        const foot = dlg.form.querySelector('.modal__foot');
        foot.insertAdjacentHTML('afterbegin', `<button class="btn btn--primary kids-yellow" type="button" data-stop-now>${icon('moon', 'icon--sm')}Stop nap now</button>`);
        const stop = foot.querySelector('[data-stop-now]');
        stop.addEventListener('click', async () => {
          stop.disabled = true;
          const res = await store.stopNaps(store.currentUser(), { cls, childIds: [child.id] });
          stop.disabled = false;
          if (res.ok) { window.NexoraToast?.show('Nap stopped', `${child.firstName}: ${res.entries[0].title.replace('Nap · ', '')}`); dlg.close(); }
          else window.NexoraToast?.show('Not saved', FAIL[res.reason] || FAIL.storage, 'info');
        });
      }
    }

    /* ---------------------------------------------------------------- Events */

    function quickAdd(type, ids = [...selected]) {
      const prompt = $('[data-prompt]');
      if (!ids.length) {
        prompt.innerHTML = `${icon('info', 'icon--sm')}Select one or more children first — tap their names.`;
        prompt.hidden = false;
        main.querySelector('.dy-pick:not([disabled])')?.focus();
        return;
      }
      prompt.hidden = true;
      if (type === 'meal') mealDialog(ids);
      else if (type === 'nap') napDialog(ids);
      else if (type === 'photo') photoDialog(ids);
      else simpleDialog(type, ids);
    }

    main.addEventListener('change', e => {
      if (e.target.matches('[data-cls]')) { cls = e.target.value; selected.clear(); timelineChild = ''; syncUrl(); paint(); return; }
      if (e.target.matches('[data-date]')) {
        const v = e.target.value;
        if (!v || v > today) { e.target.value = date; return; }
        date = v; selected.clear(); syncUrl(); paint(); return;
      }
      if (e.target.matches('[data-tl-child]')) { timelineChild = e.target.value; syncUrl(); paint(); main.querySelector('[data-tl-child]')?.focus(); }
    });
    main.addEventListener('click', async e => {
      if (e.target.closest('[data-retry]')) { load(); return; }
      const v = e.target.closest('[data-view]');
      if (v) { view = v.dataset.view; syncUrl(); paint(); main.querySelector(`[data-view="${view}"]`)?.focus(); return; }
      const p = e.target.closest('[data-pick]');
      if (p && !p.disabled) {
        const id = p.dataset.pick;
        selected.has(id) ? selected.delete(id) : selected.add(id);
        $('[data-prompt]').hidden = true;
        paint();
        main.querySelector(`[data-pick="${CSS.escape(id)}"]`)?.focus();
        return;
      }
      if (e.target.closest('[data-select-all]')) { day().rows.filter(r => r.attendance !== 'absent').forEach(r => selected.add(r.child.id)); paint(); return; }
      if (e.target.closest('[data-clear]')) { selected.clear(); paint(); return; }
      const a = e.target.closest('[data-add]');
      if (a) { quickAdd(a.dataset.add); return; }
      const one = e.target.closest('[data-quick-one]');
      if (one) { quickAdd(one.dataset.type, [one.dataset.quickOne]); return; }
      const en = e.target.closest('[data-entry]');
      if (en) { entryDialog(en.dataset.entry); return; }
      const step = e.target.closest('[data-tl-step]');
      if (step) {
        const rows = day().rows;
        const i = rows.findIndex(r => r.child.id === timelineChild) + Number(step.dataset.tlStep);
        if (rows[i]) { timelineChild = rows[i].child.id; syncUrl(); paint(); main.querySelector(`[data-tl-step="${step.dataset.tlStep}"]`)?.focus(); }
        return;
      }
      if (e.target.closest('[data-share-all]')) {
        const drafts = day().rows.flatMap(r => r.entries).filter(x => x.status === 'draft' && !(x.type === 'nap' && !x.data?.end));
        kids.dialog({
          label: `${cls} / Diary`, title: `Share ${plural(drafts.length, 'draft')} with families?`,
          desc: 'Each child’s family sees only their own child’s entries. Staff-only notes stay private, and photos need every pictured child’s consent.',
          body: '', submit: 'Share now',
          async onSubmit() {
            const res = await store.publishDiaryEntries(store.currentUser(), drafts.map(x => x.id));
            if (!res.ok) return { ok: false, message: FAIL[res.reason] || FAIL.storage };
            window.NexoraToast?.show(res.published.length ? `${plural(res.published.length, 'entry', 'entries')} shared` : 'Nothing shared', res.skipped.length ? `Not shared: ${res.skipped.map(s => `${s.name || 'entry'} (${s.reason.toLowerCase()})`).join(', ')}.` : 'Families can see them now.', res.published.length ? 'check-circle' : 'info');
            return res;
          }
        });
      }
    });

    // Running nap clocks: recomputed from the saved start time, so reloads and hidden tabs stay correct (no writes).
    setInterval(() => main.querySelectorAll('[data-elapsed]').forEach(el => { el.textContent = elapsed(el.dataset.elapsed); }), 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) main.querySelectorAll('[data-elapsed]').forEach(el => { el.textContent = elapsed(el.dataset.elapsed); }); });
    let queued = false;
    store.subscribe(({ key }) => {
      if (!loaded || (key && !/^nexora-(diary|register|attendance|children|class-registry|menus|consents|settings|holidays)/.test(key))) return;
      if (queued) return;
      queued = true;
      setTimeout(() => {
        queued = false;
        const f = document.activeElement?.dataset || {};
        paint();
        const sel = f.pick ? `[data-pick="${CSS.escape(f.pick)}"]` : f.entry ? `[data-entry="${CSS.escape(f.entry)}"]` : f.add ? `[data-add="${f.add}"]` : '';
        if (sel) main.querySelector(sel)?.focus();
      }, 0);
    });
    load();
  }

  window.NexoraDiary = { render };
})();
