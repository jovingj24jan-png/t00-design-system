/* Homepage (index.html): translated copy, sections filled from the school's own data, mobile menu and the visit
   request form, which creates a website enquiry in the admissions pipeline (S06). */
(() => {
  const store = window.NexoraStore;
  const i18n = window.NexoraI18n;
  if (!store || !i18n) return;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const school = store.school;
  const signedIn = Boolean(store.session?.isSignedIn?.());
  const AREA_KEYS = { 'Practical life': 'h_area_practical', Sensorial: 'h_area_sensorial', Language: 'h_area_language', Mathematics: 'h_area_maths', Culture: 'h_area_culture' };
  const ERROR_KEYS = { parent: 'h_errParent', phone: 'h_errPhone', email: 'h_errEmail', child: 'h_errChild', programme: 'h_errProgramme', preferredStart: 'h_errStart', dob: 'h_errDob' };

  const classes = store.activeClasses();
  const ages = classes.length ? { min: Math.min(...classes.map(c => c.ageMin)), max: Math.max(...classes.map(c => c.ageMax)) } : null;
  const vars = () => ({ school: school.name, email: school.email, phone: school.phone.replace(/ /g, ' '), min: ages?.min ?? '', max: ages?.max ?? '', name: signedIn ? store.currentUser().name : '' });
  const t = (key, extra = {}) => i18n.t(key, { ...vars(), ...extra });

  // Activity titles and class names are the school's own content: they stay as entered, marked as English.
  const contentLang = () => (i18n.locale() === 'en' ? '' : ' lang="en" dir="ltr"');

  function renderAreas() {
    const acts = store.getActivities().filter(a => a.status === 'active');
    $('[data-areas]').innerHTML = store.LEARNING_AREAS.map((area, i) => {
      const list = acts.filter(a => a.area === area).slice(0, 3);
      return `<li class="hm-area hm-area--${i + 1}">
        <span class="hm-area__n" aria-hidden="true">0${i + 1}</span>
        <h3>${esc(t(AREA_KEYS[area]))}</h3>
        ${list.length ? `<ul class="hm-area__acts"${contentLang()}>${list.map(a => `<li><strong>${esc(a.title)}</strong><span>${esc(a.objectives)}</span></li>`).join('')}</ul>` : ''}
      </li>`;
    }).join('');
  }

  function renderProgrammes() {
    const el = $('[data-programmes]');
    if (!classes.length) { el.innerHTML = `<li class="hm-empty">${esc(t('h_programmesEmpty'))}</li>`; return; }
    const sorted = [...classes].sort((a, b) => a.ageMin - b.ageMin || a.name.localeCompare(b.name));
    el.innerHTML = sorted.map(c => `<li class="panel hm-prog">
      <p class="hm-prog__ages">${esc(t('h_ages', { min: c.ageMin, max: c.ageMax }))}</p>
      <h3${contentLang()}>${esc(c.name)}</h3>
      <p class="hm-prog__meta">${c.mixedAge ? `<span class="hm-tag">${esc(t('h_mixedAge'))}</span>` : ''}${c.room ? `<span${contentLang()}>${esc(c.room)}</span>` : ''}</p>
    </li>`).join('');
  }

  function applyText() {
    $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$('[data-school-name]').forEach(el => { el.textContent = school.name; });
    $$('[data-school-email]').forEach(el => { el.textContent = school.email; el.href = `mailto:${school.email}`; });
    $$('[data-school-phone]').forEach(el => { el.textContent = school.phone; el.href = `tel:${school.phone.replace(/[^\d+]/g, '')}`; });
    const note = $('[data-hero-note]');
    note.textContent = signedIn ? t('h_signedIn') : ages ? t('h_heroNote') : `${school.email} · ${school.phone}`;
    if (signedIn) $$('[data-cta]').forEach(a => { a.href = store.routes.landing; a.textContent = t('h_openDashboard'); });
    const menu = $('[data-menu]');
    $('.sr-only', menu).textContent = t(menu.getAttribute('aria-expanded') === 'true' ? 'h_close' : 'h_menu');
    const select = $('[data-levels]');
    const chosen = select.value;
    select.innerHTML = `<option value="">${esc(t('h_fChoose'))}</option>` + store.CLASS_LEVELS.map(l => `<option value="${esc(l)}"${contentLang()}>${esc(l)}</option>`).join('');
    select.value = chosen;
    $$('[data-error-for]').forEach(p => { if (p.dataset.key) p.textContent = t(p.dataset.key); });
    const err = $('[data-form-error]');
    if (!err.hidden) err.textContent = t('h_errGeneric');
    if (sending) $('[data-send] span').textContent = t('h_sending');
    renderAreas();
    renderProgrammes();
    document.title = `${school.name} · ${t('h_eyebrow').split(' · ')[0]}`;
  }

  function setupLanguage() {
    const select = $('#hm-lang');
    select.innerHTML = i18n.languages.map(l => `<option value="${l.code}" lang="${l.code}">${esc(l.name)}</option>`).join('');
    select.value = i18n.locale();
    select.addEventListener('change', () => { i18n.setLocale(select.value); applyText(); fitNav(); });
  }

  function setupMenu() {
    const btn = $('[data-menu]');
    const links = $('#hm-links');
    const set = open => {
      btn.setAttribute('aria-expanded', String(open));
      links.classList.toggle('is-open', open);
      $('.sr-only', btn).textContent = t(open ? 'h_close' : 'h_menu');
    };
    btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
    links.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { set(false); btn.focus(); } });
    document.addEventListener('click', e => { if (btn.getAttribute('aria-expanded') === 'true' && !e.target.closest('.hm-float')) set(false); });
  }

  // The links collapse into the menu below 1024px, or when they'd wrap or overflow the pill in the current language.
  const wide = window.matchMedia('(min-width: 1024px)');
  function fitNav() {
    const nav = $('.hm-float');
    const links = $('#hm-links');
    nav.classList.remove('is-compact');
    const crowded = !wide.matches || links.getBoundingClientRect().height > 52 || nav.scrollWidth > nav.clientWidth + 1;
    nav.classList.toggle('is-compact', crowded);
    if (!crowded) { links.classList.remove('is-open'); $('[data-menu]').setAttribute('aria-expanded', 'false'); }
  }

  // Marks the nav link for the section currently on screen.
  function setupActiveLink() {
    const anchors = $$('#hm-links a[href^="#"]');
    const sections = anchors.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
    if (!('IntersectionObserver' in window)) return;
    const seen = new Map();
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => seen.set(e.target.id, e.isIntersecting));
      const current = sections.find(s => seen.get(s.id)) || sections[0];
      anchors.forEach(a => { if (a.getAttribute('href') === `#${current.id}`) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(s => io.observe(s));
  }

  let sending = false;
  function setupVisitForm() {
    const form = $('[data-visit-form]');
    const done = $('[data-visit-done]');
    const send = $('[data-send]');
    const err = $('[data-form-error]');
    const start = form.elements.preferredStart;
    const dob = form.elements.dob;
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    start.min = store.today();
    start.max = iso(new Date(Date.now() + 730 * 864e5));
    dob.max = store.today();
    const newClientId = () => `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    let clientId = newClientId();

    const showErrors = errors => {
      $$('[data-error-for]', form).forEach(p => {
        const key = errors[p.dataset.errorFor];
        const input = form.elements[p.dataset.errorFor];
        p.dataset.key = key || '';
        p.textContent = key ? t(key) : '';
        p.hidden = !key;
        if (input) { if (key) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
      });
      const first = Object.keys(ERROR_KEYS).find(k => errors[k]);
      if (first) form.elements[first].focus();
    };

    const validate = v => {
      const e = {};
      if (!v.parent.trim()) e.parent = 'h_errParent';
      const digits = v.phone.replace(/\D/g, '');
      if (!/^\+?[\d\s().-]+$/.test(v.phone.trim()) || digits.length < 7 || digits.length > 15) e.phone = 'h_errPhone';
      if (v.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) e.email = 'h_errEmail';
      if (!v.child.trim()) e.child = 'h_errChild';
      if (!v.programme) e.programme = 'h_errProgramme';
      if (!v.preferredStart || v.preferredStart < start.min) e.preferredStart = 'h_errStart';
      else if (v.preferredStart > start.max) e.preferredStart = 'h_errStartFar';
      if (v.dob && v.dob > dob.max) e.dob = 'h_errDob';
      return e;
    };

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (sending) return;
      err.hidden = true;
      const v = Object.fromEntries(['parent', 'phone', 'email', 'child', 'dob', 'programme', 'preferredStart', 'message'].map(k => [k, form.elements[k].value]));
      const errors = validate(v);
      showErrors(errors);
      if (Object.keys(errors).length) return;
      sending = true;
      send.disabled = true;
      send.setAttribute('aria-busy', 'true');
      send.classList.add('is-loading');
      $('span', send).textContent = t('h_sending');
      let r;
      try {
        // ?fail=visit shows the error state in the demo.
        r = new URLSearchParams(location.search).get('fail') === 'visit' ? await store.settle({ ok: false }) : await store.websiteEnquiry(v, { clientId });
      } catch { r = { ok: false }; }
      sending = false;
      send.disabled = false;
      send.removeAttribute('aria-busy');
      send.classList.remove('is-loading');
      $('span', send).textContent = t('h_send');
      if (r.ok) {
        form.hidden = true;
        done.hidden = false;
        done.focus();
        return;
      }
      if (r.errors) {
        showErrors(Object.fromEntries(Object.keys(r.errors).filter(k => ERROR_KEYS[k]).map(k => [k, ERROR_KEYS[k]])));
        if (Object.keys(r.errors).some(k => ERROR_KEYS[k])) return;
      }
      err.textContent = t('h_errGeneric');
      err.hidden = false;
      err.focus?.();
    });

    $('[data-again]').addEventListener('click', () => {
      form.reset();
      showErrors({});
      clientId = newClientId();
      done.hidden = true;
      form.hidden = false;
      form.elements.parent.focus();
    });
  }

  // Any app page registered in the store but missing from the map is listed under "More pages".
  function fillMorePages() {
    const listed = new Set($$('.hm-group a[href^="app.html?page="]').map(a => new URLSearchParams(a.getAttribute('href').split('?')[1]).get('page')));
    const detail = new Set(['family', 'class', 'statement', 'compose', 'notification-settings']);
    const extra = [...store.moduleKeys, 'children', 'families', 'roster', 'waitlist', 'enrol', 'classes', 'diary', 'calendar', 'lessons', 'resources', 'messages', 'forms', 'meetings', 'notifications', 'settings']
      .filter((k, i, a) => a.indexOf(k) === i && !listed.has(k) && !detail.has(k) && store.pageByKey(k));
    if (!extra.length) return;
    $('[data-more-list]').innerHTML = extra.map(k => `<li><a href="${store.routes.page(k)}"${contentLang()}>${esc(store.pageByKey(k).name)}</a></li>`).join('');
    $('[data-more]').hidden = false;
  }

  setupLanguage();
  setupMenu();
  setupVisitForm();
  applyText();
  fitNav();
  window.addEventListener('resize', fitNav);
  document.fonts?.ready.then(fitNav);
  fillMorePages();
  setupActiveLink();
})();
