(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const isDesktop = matchMedia('(min-width: 1024px)');
  const isMobile = matchMedia('(max-width: 767px)');
  const wait = ms => new Promise(resolve => setTimeout(resolve, reduceMotion.matches ? Math.min(ms, 400) : ms));
  const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Fixed "today" keeps the prototype's date filters deterministic.
  const TODAY = new Date('2026-10-08T00:00:00');

  const srStatus = document.createElement('p');
  srStatus.className = 'sr-only';
  srStatus.setAttribute('role', 'status');
  document.body.appendChild(srStatus);
  const announce = msg => { srStatus.textContent = ''; requestAnimationFrame(() => { srStatus.textContent = msg; }); };

  /* ---------------------------------------------------------------- Toasts */

  const toastRegion = $('#toast-region');
  const TOAST_ICONS = { success: 'check-circle', warning: 'alert-triangle', error: 'alert-circle', info: 'info' };

  function toast({ type = 'info', title, text = '' }) {
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `
      ${icon(TOAST_ICONS[type] || 'info', 'toast__icon')}
      <div class="toast__body"><p class="toast__title">${escapeHtml(title)}</p>${text ? `<p class="toast__text">${escapeHtml(text)}</p>` : ''}</div>
      <button class="btn btn--icon-ghost" type="button" aria-label="Dismiss notification">${icon('x')}</button>
      <span class="toast__timer" aria-hidden="true"></span>`;

    let remaining = 5000;
    let startedAt = Date.now();
    let timer = setTimeout(dismiss, remaining);

    function dismiss() {
      clearTimeout(timer);
      if (el.classList.contains('is-leaving')) return;
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), reduceMotion.matches ? 0 : 200);
    }
    const pause = () => { clearTimeout(timer); remaining -= Date.now() - startedAt; };
    const resume = () => { startedAt = Date.now(); timer = setTimeout(dismiss, Math.max(remaining, 1200)); };

    el.addEventListener('mouseenter', pause);
    el.addEventListener('mouseleave', resume);
    el.addEventListener('focusin', pause);
    el.addEventListener('focusout', e => { if (!el.contains(e.relatedTarget)) resume(); });
    $('button', el).addEventListener('click', dismiss);

    toastRegion.appendChild(el);
    const toasts = $$('.toast:not(.is-leaving)', toastRegion);
    if (toasts.length > 3) toasts[0].remove();
  }

  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-toast]');
    if (!trigger) return;
    toast({ type: trigger.dataset.toast, title: trigger.dataset.toastTitle, text: trigger.dataset.toastText });
    if (trigger.hasAttribute('data-close-after')) closeDialog(trigger.closest('dialog'));
  });

  /* ------------------------------------------------------ Sidebar drawer */

  function initNav() {
    const sidebar = $('#sidebar');
    const toggle = $('#nav-toggle');
    const backdrop = $('.nav-backdrop');
    const inertTargets = [$('#main'), $('.fab--fixed')];
    let open = false;

    function setOpen(value, { restoreFocus = true } = {}) {
      if (open === value) return;
      open = value;
      sidebar.classList.toggle('is-open', value);
      backdrop.classList.toggle('is-visible', value);
      toggle.setAttribute('aria-expanded', String(value));
      document.documentElement.classList.toggle('is-locked', value);
      inertTargets.forEach(el => { el.inert = value; });
      if (value) {
        sidebar.setAttribute('role', 'dialog');
        sidebar.setAttribute('aria-modal', 'true');
        requestAnimationFrame(() => $('.nav-link[aria-current="page"]', sidebar).focus());
      } else {
        sidebar.removeAttribute('role');
        sidebar.removeAttribute('aria-modal');
        if (restoreFocus) toggle.focus();
      }
    }

    toggle.addEventListener('click', () => setOpen(true));
    $$('[data-nav-close]').forEach(el => el.addEventListener('click', () => setOpen(false)));
    $$('.nav-link', sidebar).forEach(link => link.addEventListener('click', () => {
      if (!isDesktop.matches) setOpen(false, { restoreFocus: false });
    }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) setOpen(false); });
    isDesktop.addEventListener('change', e => { if (e.matches) setOpen(false, { restoreFocus: false }); });
  }

  /* ------------------------------------------------- Header: search, bell */

  function initHeader() {
    const mobileToggle = $('#mobile-search-toggle');
    const mobileBar = $('#mobile-search');
    const mobileInput = $('#mobile-search-input');

    function setMobileSearch(open) {
      mobileBar.hidden = !open;
      mobileToggle.setAttribute('aria-expanded', String(open));
      if (open) mobileInput.focus();
    }
    mobileToggle.addEventListener('click', () => setMobileSearch(mobileBar.hidden));
    mobileInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') { setMobileSearch(false); mobileToggle.focus(); }
    });

    focusSearch = () => {
      if (isMobile.matches) setMobileSearch(true);
      else $('#global-search').focus();
    };

    document.addEventListener('keydown', e => {
      const typing = e.target.closest('input, textarea, select, [contenteditable="true"]');
      if (e.key === '/' && !typing && !document.querySelector('dialog[open]')) {
        e.preventDefault();
        focusSearch();
      }
    });

    const targets = $$('.ds-section').map(section => ({
      id: section.id,
      text: [section.id, $('.ds-section__title', section)?.textContent, $('.eyebrow', section)?.textContent].join(' ').toLowerCase()
    }));
    $$('[data-search]').forEach(form => form.addEventListener('submit', e => {
      e.preventDefault();
      const input = $('input', form);
      const q = input.value.trim().toLowerCase();
      if (!q) return;
      const hit = targets.find(t => t.text.includes(q));
      if (hit) {
        location.hash = hit.id;
        input.value = '';
        if (form.closest('#mobile-search')) setMobileSearch(false);
      } else {
        toast({ type: 'info', title: `No match for "${input.value.trim()}"`, text: 'Try a component name like table, modal or chips.' });
      }
    }));

    $$('[data-focus-search]').forEach(btn => btn.addEventListener('click', () => focusSearch()));

    const bell = $('#notif-toggle');
    const panel = $('#notif-panel');
    function setPanel(open) {
      panel.hidden = !open;
      bell.setAttribute('aria-expanded', String(open));
    }
    bell.addEventListener('click', () => setPanel(panel.hidden));
    document.addEventListener('click', e => {
      if (!panel.hidden && !e.target.closest('.has-popover')) setPanel(false);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !panel.hidden) { setPanel(false); bell.focus(); }
    });
    panel.addEventListener('click', e => { if (e.target.closest('a')) setPanel(false); });
  }
  let focusSearch = () => {};

  /* ------------------------------------------------------------ Scroll spy */

  function initScrollSpy() {
    const list = $('#section-nav');
    const links = new Map($$('a', list).map(a => [a.hash.slice(1), a]));
    let current = null;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const link = links.get(entry.target.id);
        if (!link || link === current) return;
        current?.classList.remove('is-current');
        current?.removeAttribute('aria-current');
        link.classList.add('is-current');
        link.setAttribute('aria-current', 'location');
        current = link;
        list.scrollTo({ left: link.offsetLeft - list.clientWidth / 2 + link.offsetWidth / 2, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      });
    }, { rootMargin: '-140px 0px -55% 0px' });

    $$('.ds-section').forEach(section => observer.observe(section));
  }

  /* ------------------------------------------------------- Colour swatches */

  const COLORS = [
    { group: 'Brand' },
    { name: 'Primary · Ember', token: '--color-primary', cls: 'bg-primary', purpose: 'Primary actions, links, focus rings and key highlights.' },
    { name: 'Secondary · Graphite', token: '--color-secondary', cls: 'bg-secondary', purpose: 'Secondary emphasis, dark chips and toast surfaces.' },
    { name: 'Accent · Saffron', token: '--color-accent', cls: 'bg-accent', purpose: 'Highlights, active nav marker, badges. Never for body text.' },
    { group: 'Status' },
    { name: 'Success', token: '--color-success', cls: 'bg-success', purpose: 'Completed, saved, healthy. Paired with a check icon.' },
    { name: 'Warning', token: '--color-warning', cls: 'bg-warning', purpose: 'Needs attention soon. Paired with a triangle icon.' },
    { name: 'Error', token: '--color-error', cls: 'bg-error', purpose: 'Failed or destructive. Paired with a circle icon.' },
    { name: 'Info', token: '--color-info', cls: 'bg-info', purpose: 'Neutral news, tips and system messages.' },
    { group: 'Surfaces' },
    { name: 'Background', token: '--color-bg', cls: 'bg-bg', purpose: 'The page canvas behind every surface.' },
    { name: 'Surface', token: '--color-surface', cls: 'bg-surface', purpose: 'Cards, tables, inputs and panels.' },
    { name: 'Elevated surface', token: '--color-surface-elevated', cls: 'bg-elevated', purpose: 'Modals, drawers, menus and popovers.' },
    { name: 'Border', token: '--color-border', cls: 'bg-border', purpose: 'Dividers and resting card outlines.' },
    { group: 'Text' },
    { name: 'Primary text', token: '--color-text', cls: 'bg-text', purpose: 'Headings, body copy and values.' },
    { name: 'Secondary text', token: '--color-text-secondary', cls: 'bg-text-secondary', purpose: 'Descriptions and supporting copy.' },
    { name: 'Muted text', token: '--color-text-muted', cls: 'bg-text-muted', purpose: 'Captions, meta and placeholders.' }
  ];

  function luminance(hex) {
    const v = hex.replace('#', '');
    const rgb = [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  }
  const contrast = (a, b) => {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };

  function initSwatches() {
    const root = $('[data-swatches]');
    const styles = getComputedStyle(document.documentElement);
    const surface = styles.getPropertyValue('--color-surface').trim();
    root.innerHTML = COLORS.map(c => {
      if (c.group) return `<p class="swatch-group-title">${c.group}</p>`;
      const value = styles.getPropertyValue(c.token).trim();
      const ratio = /^#[0-9a-f]{6}$/i.test(value) ? contrast(value, surface) : null;
      let rating = '';
      if (ratio !== null && ratio >= 1.4) {
        const level = ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA large' : 'Decorative';
        rating = ` · ${ratio.toFixed(1)}:1 ${level}`;
      }
      return `
        <div class="swatch">
          <span class="swatch__chip ${c.cls}" aria-hidden="true"></span>
          <div class="swatch__body">
            <p class="swatch__name">${c.name}</p>
            <p class="swatch__token">${c.token}</p>
            <p class="swatch__purpose">${c.purpose}</p>
            <p class="swatch__value">${value}${rating}</p>
          </div>
        </div>`;
    }).join('');
  }

  /* ----------------------------------------------------- Type measurements */

  function measureType() {
    $$('[data-type-sample]').forEach(el => {
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize);
      const family = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
      const lh = cs.lineHeight === 'normal' ? 'normal' : `${Math.round(parseFloat(cs.lineHeight))}px`;
      const ls = cs.letterSpacing === 'normal' ? '0' : `${(parseFloat(cs.letterSpacing) / size).toFixed(3).replace(/\.?0+$/, '')}em`;
      const meta = el.closest('.type-row').querySelector('.type-row__meta');
      meta.innerHTML = [family, `${Math.round(size * 10) / 10}px`, `W ${cs.fontWeight}`, `LH ${lh}`, `LS ${ls}`]
        .map(v => `<span>${escapeHtml(v)}</span>`).join('');
    });
  }

  /* ------------------------------------------------------ Button demos */

  function setButtonBusy(btn, label) {
    btn.style.minWidth = `${btn.offsetWidth}px`;
    btn.dataset.original = btn.innerHTML;
    btn.classList.add('is-loading');
    btn.setAttribute('aria-busy', 'true');
    btn.setAttribute('aria-disabled', 'true');
    btn.innerHTML = `<span class="spinner spinner--sm btn__spinner" aria-hidden="true"></span><span class="btn__label">${escapeHtml(label)}</span>`;
  }
  function setButtonSuccess(btn, label) {
    btn.classList.remove('is-loading');
    btn.removeAttribute('aria-busy');
    btn.classList.add('is-success');
    btn.innerHTML = `${icon('check', 'icon--sm')}<span class="btn__label">${escapeHtml(label)}</span>`;
  }
  function resetButton(btn) {
    btn.classList.remove('is-loading', 'is-success');
    btn.removeAttribute('aria-busy');
    btn.removeAttribute('aria-disabled');
    if (btn.dataset.original) btn.innerHTML = btn.dataset.original;
    btn.style.minWidth = '';
  }
  const isBusy = btn => btn.getAttribute('aria-disabled') === 'true';

  function initAsyncButtons() {
    $$('[data-async-btn]').forEach(btn => btn.addEventListener('click', async () => {
      if (isBusy(btn)) return;
      setButtonBusy(btn, btn.dataset.loadingLabel);
      announce(btn.dataset.loadingLabel);
      await wait(1400);
      setButtonSuccess(btn, btn.dataset.successLabel);
      announce(btn.dataset.successLabel);
      await wait(1800);
      resetButton(btn);
    }));
  }

  /* --------------------------------------------------- Form validation */

  function initInviteForm() {
    const form = $('#invite-form');
    const fields = $$('.input', form);
    let submitted = false;

    fields.forEach(input => {
      const hint = $(`#${input.getAttribute('aria-describedby')}`);
      hint.dataset.default = hint.textContent;
    });

    const rules = {
      name: v => (v.trim() ? '' : 'Enter a name so teammates recognise them'),
      email: v => (!v.trim() ? 'Enter a work email address'
        : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter a full email, like name@company.com')
    };

    function check(input) {
      const hint = $(`#${input.getAttribute('aria-describedby')}`);
      const message = rules[input.name](input.value);
      input.setAttribute('aria-invalid', String(Boolean(message)));
      input.classList.toggle('is-success', !message && submitted);
      hint.className = `field__hint${message ? ' field__hint--error' : submitted ? ' field__hint--success' : ''}`;
      hint.innerHTML = message ? `${icon('alert-circle')}${message}` : submitted ? `${icon('check')}Looks good` : escapeHtml(hint.dataset.default);
      return !message;
    }

    fields.forEach(input => input.addEventListener('input', () => { if (submitted) check(input); }));

    form.addEventListener('submit', async e => {
      e.preventDefault();
      submitted = true;
      const results = fields.map(check);
      const firstInvalid = fields[results.indexOf(false)];
      if (firstInvalid) {
        firstInvalid.focus();
        announce('Please fix the highlighted fields');
        return;
      }
      const btn = $('button[type="submit"]', form);
      setButtonBusy(btn, 'Sending…');
      await wait(1000);
      resetButton(btn);
      toast({ type: 'success', title: 'Invite ready', text: `Prototype — no email was sent to ${fields[1].value.trim()}.` });
      form.reset();
    });

    form.addEventListener('reset', () => {
      submitted = false;
      requestAnimationFrame(() => fields.forEach(input => {
        const hint = $(`#${input.getAttribute('aria-describedby')}`);
        input.removeAttribute('aria-invalid');
        input.classList.remove('is-success');
        hint.className = 'field__hint';
        hint.textContent = hint.dataset.default;
      }));
    });
  }

  /* ---------------------------------------------------- Select / listbox */

  const optionLabel = o => o.dataset.label || Array.from(o.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();

  function initSelect(root) {
    const trigger = $('.select__trigger', root);
    const menu = $('.select__menu', root);
    const valueEl = $('.select__value', root);
    const options = $$('[role="option"]', menu).filter(o => o.getAttribute('aria-disabled') !== 'true');
    let active = -1;
    let typed = '';
    let typedTimer;

    const isOpen = () => root.classList.contains('is-open');

    function setActive(i) {
      active = Math.max(0, Math.min(options.length - 1, i));
      options.forEach((o, j) => o.classList.toggle('is-active', j === active));
      const opt = options[active];
      menu.setAttribute('aria-activedescendant', opt.id);
      if (opt.offsetTop < menu.scrollTop) menu.scrollTop = opt.offsetTop - 6;
      else if (opt.offsetTop + opt.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = opt.offsetTop + opt.offsetHeight - menu.clientHeight + 6;
    }

    function open() {
      $$('.select.is-open[data-select]').forEach(other => other !== root && other._select.close(false));
      root.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      const selected = options.findIndex(o => o.getAttribute('aria-selected') === 'true');
      setActive(selected >= 0 ? selected : 0);
      menu.focus({ preventScroll: true });
    }

    function close(returnFocus = true) {
      if (!isOpen()) return;
      root.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      menu.removeAttribute('aria-activedescendant');
      if (returnFocus) trigger.focus();
    }

    function choose(i, { silent = false } = {}) {
      const opt = options[i];
      options.forEach(o => o.setAttribute('aria-selected', String(o === opt)));
      const value = opt.dataset.value ?? optionLabel(opt);
      valueEl.textContent = optionLabel(opt);
      valueEl.classList.toggle('is-placeholder', value === '' && Boolean(root.dataset.placeholder));
      const swatch = $('[data-swatch]', trigger);
      if (swatch && opt.dataset.swatch) swatch.className = `select__swatch ${opt.dataset.swatch}`;
      if (root.classList.contains('is-error') && value !== '') {
        root.classList.remove('is-error');
        trigger.removeAttribute('aria-invalid');
        const err = $('[data-select-error]', root.parentElement);
        if (err) {
          err.className = 'field__hint field__hint--success';
          err.innerHTML = `${icon('check')}Team selected`;
        }
      }
      root.value = value;
      if (!silent) root.dispatchEvent(new CustomEvent('select-change', { bubbles: true, detail: { value, label: optionLabel(opt) } }));
    }

    function setValue(value) {
      const i = options.findIndex(o => (o.dataset.value ?? optionLabel(o)) === value);
      if (i >= 0) choose(i, { silent: true });
    }

    trigger.addEventListener('click', () => (isOpen() ? close() : open()));
    trigger.addEventListener('keydown', e => {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        open();
        if (e.key === 'ArrowUp') setActive(options.length - 1);
      }
    });

    menu.addEventListener('keydown', e => {
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); setActive(active + 1); break;
        case 'ArrowUp': e.preventDefault(); setActive(active - 1); break;
        case 'Home': e.preventDefault(); setActive(0); break;
        case 'End': e.preventDefault(); setActive(options.length - 1); break;
        case 'Enter':
        case ' ': e.preventDefault(); choose(active); close(); break;
        case 'Escape': e.preventDefault(); e.stopPropagation(); close(); break;
        case 'Tab': close(false); break;
        default:
          if (e.key.length === 1 && /\S/.test(e.key)) {
            clearTimeout(typedTimer);
            typed += e.key.toLowerCase();
            typedTimer = setTimeout(() => { typed = ''; }, 600);
            const hit = options.findIndex(o => optionLabel(o).toLowerCase().startsWith(typed));
            if (hit >= 0) setActive(hit);
          }
      }
    });

    options.forEach((opt, i) => {
      opt.addEventListener('click', () => { choose(i); close(); });
      opt.addEventListener('mousemove', () => { if (active !== i) setActive(i); });
    });

    menu.addEventListener('focusout', e => { if (!root.contains(e.relatedTarget)) close(false); });
    document.addEventListener('pointerdown', e => { if (isOpen() && !root.contains(e.target)) close(false); });

    root._select = { open, close, setValue };
    const initial = options.find(o => o.getAttribute('aria-selected') === 'true');
    root.value = initial ? (initial.dataset.value ?? optionLabel(initial)) : '';
  }

  /* ------------------------------------------------------------------ Tabs */

  function initTabs(root) {
    const tabs = $$('[role="tab"]', root);
    const enabled = () => tabs.filter(t => t.getAttribute('aria-disabled') !== 'true');

    function select(tab, focus = true) {
      tabs.forEach(t => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        $(`#${t.getAttribute('aria-controls')}`).hidden = !on;
      });
      if (focus) tab.focus();
    }

    tabs.forEach(tab => tab.addEventListener('click', () => {
      if (tab.getAttribute('aria-disabled') === 'true') {
        toast({ type: 'info', title: `${tab.textContent.trim()} is locked`, text: tab.title });
        return;
      }
      select(tab);
    }));

    root.addEventListener('keydown', e => {
      const current = e.target.closest('[role="tab"]');
      if (!current) return;
      const list = enabled();
      let i = list.indexOf(current);
      if (i < 0) i = 0;
      const moves = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: list.length - 1 };
      if (!(e.key in moves)) return;
      e.preventDefault();
      select(list[(moves[e.key] + list.length) % list.length]);
    });
  }

  /* ----------------------------------------------------------------- Chips */

  function initChips() {
    $$('[data-chip-toggle]').forEach(chip => chip.addEventListener('click', () => {
      const pressed = chip.getAttribute('aria-pressed') !== 'true';
      chip.setAttribute('aria-pressed', String(pressed));
      const count = $('.chip__count', chip);
      if (count) count.hidden = !pressed;
    }));

    $$('[data-chip-remove]').forEach(btn => btn.addEventListener('click', () => {
      const chip = btn.closest('.chip');
      const label = chip.firstChild.textContent.trim();
      chip.hidden = true;
      const undo = document.createElement('button');
      undo.type = 'button';
      undo.className = 'btn btn--tertiary btn--sm';
      undo.innerHTML = `${icon('refresh', 'icon--sm')}Undo`;
      undo.setAttribute('aria-label', `Restore filter ${label}`);
      undo.addEventListener('click', () => { chip.hidden = false; undo.remove(); btn.focus(); });
      chip.after(undo);
      undo.focus();
      announce(`Removed filter ${label}`);
    }));
  }

  /* ------------------------------------------------------------ Mock data */

  const CUSTOMERS = [
    { id: 'c01', name: 'Joving', email: 'joving@northwind.studio', plan: 'Business', status: 'Active', created: '2026-10-07', seats: 12 },
    { id: 'c02', name: 'Aisha Rahman', email: 'aisha@lumen.co', plan: 'Team', status: 'Active', created: '2026-10-02', seats: 8 },
    { id: 'c03', name: 'Marcus Kim', email: 'marcus@fieldnotes.io', plan: 'Starter', status: 'Trial', created: '2026-09-29', seats: 3 },
    { id: 'c04', name: 'Lina Petrova', email: 'lina@arcstudio.eu', plan: 'Business', status: 'Overdue', created: '2026-09-18', seats: 24 },
    { id: 'c05', name: 'Kofi Mensah', email: 'kofi@sunbird.africa', plan: 'Team', status: 'Active', created: '2026-09-11', seats: 6 },
    { id: 'c06', name: 'Priya Natarajan', email: 'priya@kolam.in', plan: 'Business', status: 'Active', created: '2026-08-30', seats: 40 },
    { id: 'c07', name: 'Diego Alvarez', email: 'diego@puerto.mx', plan: 'Starter', status: 'Paused', created: '2026-08-21', seats: 2 },
    { id: 'c08', name: 'Hana Sato', email: 'hana@kumo.jp', plan: 'Team', status: 'Trial', created: '2026-08-14', seats: 5 },
    { id: 'c09', name: 'Omar Haddad', email: 'omar@cedar.dev', plan: 'Team', status: 'Overdue', created: '2026-07-30', seats: 9 },
    { id: 'c10', name: 'Elena Rossi', email: 'elena@verde.it', plan: 'Business', status: 'Active', created: '2026-07-12', seats: 18 },
    { id: 'c11', name: 'Samuel Okafor', email: 'sam@harbor.ng', plan: 'Starter', status: 'Active', created: '2026-06-26', seats: 1 },
    { id: 'c12', name: 'Mei Lin', email: 'mei@paperkite.sg', plan: 'Team', status: 'Paused', created: '2026-06-03', seats: 7 }
  ];
  const STATUS_BADGE = { Active: 'badge--success', Trial: 'badge--info', Overdue: 'badge--warning', Paused: '' };
  const AVATAR_TONES = ['avatar--primary', 'avatar--info', 'avatar--success', ''];
  const initials = name => name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() + (name.includes(' ') ? '' : name[1].toUpperCase());
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formatDate = iso => { const [y, m, d] = iso.split('-'); return `${d} ${MONTHS[Number(m) - 1]} ${y}`; };
  const avatarTone = c => AVATAR_TONES[parseInt(c.id.slice(1), 10) % AVATAR_TONES.length];
  const badge = status => `<span class="badge ${STATUS_BADGE[status]}">${status}</span>`;
  const customerById = id => CUSTOMERS.find(c => c.id === id);

  /* ----------------------------------------------------------------- Table */

  function initTable() {
    const root = $('[data-table]');
    const body = $('[data-table-body]', root);
    const table = $('table', root);
    const range = $('[data-table-range]', root);
    const pager = $('[data-pager]', root);
    const selectAll = $('[data-select-all]', root);
    const bulk = $('[data-bulk]', root);
    const mobileSort = $('[data-mobile-sort]', root);
    const PAGE_SIZE = 5;
    const DEFAULT_DIR = { name: 'asc', status: 'asc', created: 'desc' };
    const state = { key: 'created', dir: 'desc', page: 1, mode: 'default', selected: new Set() };

    const sorted = () => [...CUSTOMERS].sort((a, b) => {
      const r = a[state.key].localeCompare(b[state.key]);
      return state.dir === 'asc' ? r : -r;
    });
    const pageCount = () => Math.max(1, Math.ceil(CUSTOMERS.length / PAGE_SIZE));

    function rowHtml(c) {
      const sel = state.selected.has(c.id);
      return `
        <tr class="${sel ? 'is-selected' : ''}" data-id="${c.id}">
          <td class="cell-check" data-label="Select"><label class="check check--touch"><input type="checkbox" ${sel ? 'checked' : ''} aria-label="Select ${escapeHtml(c.name)}"></label></td>
          <td class="cell-person" data-label="Customer"><div class="person"><span class="avatar avatar--sm ${avatarTone(c)}" aria-hidden="true">${initials(c.name)}</span><div><p class="person__name">${escapeHtml(c.name)}</p><p class="person__mail">${escapeHtml(c.email)}</p></div></div></td>
          <td class="col-plan" data-label="Plan">${c.plan}</td>
          <td data-label="Status">${badge(c.status)}</td>
          <td class="cell-muted" data-label="Created"><time datetime="${c.created}">${formatDate(c.created)}</time></td>
          <td class="cell-actions" data-label="Actions"><div class="btn-row">
            <button class="btn btn--ghost btn--sm" type="button" data-view aria-label="View ${escapeHtml(c.name)}">${icon('eye', 'icon--sm')}View</button>
            <button class="btn btn--icon-ghost" type="button" data-delete aria-label="Delete ${escapeHtml(c.name)}">${icon('trash')}</button>
          </div></td>
        </tr>`;
    }

    const skeletonRow = () => `
      <tr aria-hidden="true">
        <td class="cell-check" data-label=""><span class="skeleton" style="width:18px;height:18px"></span></td>
        <td class="cell-person" data-label=""><div class="sk-row" style="width:100%"><span class="skeleton skeleton--circle" style="width:28px;height:28px;flex-shrink:0"></span><div class="sk-stack" style="flex:1"><span class="skeleton skeleton--line w-60"></span><span class="skeleton skeleton--line w-80"></span></div></div></td>
        <td class="col-plan" data-label="Plan"><span class="skeleton skeleton--line" style="width:64px"></span></td>
        <td data-label="Status"><span class="skeleton" style="width:72px;height:24px;border-radius:999px"></span></td>
        <td data-label="Created"><span class="skeleton skeleton--line" style="width:84px"></span></td>
        <td class="cell-actions" data-label="Actions"><span class="skeleton" style="width:72px;height:32px;margin-left:auto"></span></td>
      </tr>`;

    const emptyRow = () => `
      <tr class="row-span"><td class="cell-span" colspan="6">
        <div class="empty empty--compact table-state">
          <span class="empty__icon" aria-hidden="true">${icon('user')}</span>
          <h3 class="empty__title">No customers yet</h3>
          <p class="empty__text">When someone signs up, they'll appear here with their plan and status.</p>
          <div class="empty__actions">
            <button class="btn btn--primary btn--sm" type="button" data-modal="default">${icon('plus', 'icon--sm')}Add customer</button>
            <button class="btn btn--secondary btn--sm" type="button" data-table-sample>Show sample data</button>
          </div>
        </div>
      </td></tr>`;

    function render() {
      table.setAttribute('aria-busy', String(state.mode === 'loading'));
      $$('th[data-sort-key]', table).forEach(th => {
        th.setAttribute('aria-sort', th.dataset.sortKey === state.key ? (state.dir === 'asc' ? 'ascending' : 'descending') : 'none');
      });
      mobileSort.value = `${state.key}:${state.dir}`;
      $('[data-table-count]', root).textContent = state.mode === 'empty' ? '0' : CUSTOMERS.length;

      if (state.mode === 'loading') {
        body.innerHTML = Array.from({ length: PAGE_SIZE }, skeletonRow).join('');
        range.textContent = 'Loading customers…';
        pager.innerHTML = '';
        selectAll.disabled = true;
        bulk.hidden = true;
        return;
      }
      if (state.mode === 'empty' || CUSTOMERS.length === 0) {
        body.innerHTML = emptyRow();
        range.textContent = 'No customers to show';
        pager.innerHTML = '';
        selectAll.disabled = true;
        bulk.hidden = true;
        return;
      }

      state.page = Math.min(state.page, pageCount());
      const start = (state.page - 1) * PAGE_SIZE;
      const rows = sorted().slice(start, start + PAGE_SIZE);
      body.innerHTML = rows.map(rowHtml).join('');
      range.textContent = `Showing ${start + 1}–${start + rows.length} of ${CUSTOMERS.length}`;

      const pages = pageCount();
      pager.innerHTML = `
        <button class="btn btn--icon" type="button" data-page="${state.page - 1}" aria-label="Previous page" ${state.page === 1 ? 'disabled' : ''}>${icon('chevron-left')}</button>
        ${Array.from({ length: pages }, (_, i) => `<button class="pager__page" type="button" data-page="${i + 1}" aria-label="Page ${i + 1}" ${i + 1 === state.page ? 'aria-current="page"' : ''}>${i + 1}</button>`).join('')}
        <button class="btn btn--icon" type="button" data-page="${state.page + 1}" aria-label="Next page" ${state.page === pages ? 'disabled' : ''}>${icon('chevron-right')}</button>`;

      const ids = rows.map(r => r.id);
      const chosen = ids.filter(id => state.selected.has(id)).length;
      selectAll.disabled = false;
      selectAll.checked = chosen > 0 && chosen === ids.length;
      selectAll.indeterminate = chosen > 0 && chosen < ids.length;
      bulk.hidden = state.selected.size === 0;
      $('[data-bulk-count]', root).textContent = state.selected.size;
    }

    $$('th[data-sort-key] .sort-btn', table).forEach(btn => btn.addEventListener('click', () => {
      const key = btn.closest('th').dataset.sortKey;
      if (state.key === key) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
      else { state.key = key; state.dir = DEFAULT_DIR[key]; }
      state.page = 1;
      render();
      announce(`Sorted by ${key}, ${state.dir === 'asc' ? 'ascending' : 'descending'}`);
    }));

    mobileSort.addEventListener('change', () => {
      [state.key, state.dir] = mobileSort.value.split(':');
      state.page = 1;
      render();
    });

    selectAll.addEventListener('change', () => {
      $$('tbody tr[data-id]', table).forEach(tr => {
        if (selectAll.checked) state.selected.add(tr.dataset.id);
        else state.selected.delete(tr.dataset.id);
      });
      render();
      selectAll.focus();
    });

    body.addEventListener('change', e => {
      const box = e.target.closest('input[type="checkbox"]');
      if (!box) return;
      const id = box.closest('tr').dataset.id;
      if (box.checked) state.selected.add(id); else state.selected.delete(id);
      render();
      $(`tr[data-id="${id}"] input[type="checkbox"]`, body)?.focus();
    });

    body.addEventListener('click', e => {
      const tr = e.target.closest('tr[data-id]');
      if (e.target.closest('[data-table-sample]')) { setMode('default'); return; }
      if (!tr) return;
      const customer = customerById(tr.dataset.id);
      if (e.target.closest('[data-view]')) openCustomerDrawer(customer, e.target.closest('button'));
      if (e.target.closest('[data-delete]')) {
        openModal('destructive', e.target.closest('button'), {
          title: `Delete ${customer.name}?`,
          desc: `Their workspace, ${customer.seats} seats and billing history will be removed. This can't be undone.`,
          confirmLabel: 'Delete customer',
          onConfirm: () => {
            CUSTOMERS.splice(CUSTOMERS.indexOf(customer), 1);
            state.selected.delete(customer.id);
            render();
            filtersApi?.refresh();
            toast({ type: 'success', title: `${customer.name} deleted`, text: 'Prototype — reload the page to restore.' });
          }
        });
      }
    });

    pager.addEventListener('click', e => {
      const btn = e.target.closest('[data-page]');
      if (!btn || btn.disabled) return;
      state.page = Number(btn.dataset.page);
      render();
      const focusTarget = $(`[data-page="${state.page}"][aria-current]`, pager);
      focusTarget?.focus();
      announce(range.textContent);
    });

    $('[data-bulk-clear]', root).addEventListener('click', () => { state.selected.clear(); render(); selectAll.focus(); });

    const stateButtons = $$('[data-table-state]', root);
    function setMode(mode) {
      state.mode = mode;
      stateButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tableState === mode)));
      render();
    }
    stateButtons.forEach(b => b.addEventListener('click', () => setMode(b.dataset.tableState)));

    render();
  }

  /* --------------------------------------------------------------- Filters */

  let filtersApi = null;

  function initFilters() {
    const root = $('[data-filters]');
    const q = $('[data-filter-q]', root);
    const selects = Object.fromEntries($$('[data-filter]', root).map(s => [s.dataset.filter, s]));
    const chipsEl = $('[data-filter-chips]', root);
    const resultsEl = $('[data-filter-results]', root);
    const countEl = $('[data-filter-count]', root);
    const applyDot = $('[data-apply-dot]', root);
    const applyPending = $('[data-apply-pending]', root);
    const LABELS = { status: 'Status', plan: 'Plan', date: 'Created' };
    const DATE_LABELS = { 7: 'Last 7 days', 30: 'Last 30 days', 90: 'Last 90 days' };

    const applied = { status: '', plan: '', date: '' };
    const pending = { ...applied };

    const isDirty = () => Object.keys(applied).some(k => applied[k] !== pending[k]);
    function syncDirty() {
      const dirty = isDirty();
      applyDot.hidden = !dirty;
      applyPending.textContent = dirty ? ' (unapplied changes)' : '';
    }

    function matches(c) {
      const term = q.value.trim().toLowerCase();
      if (term && !`${c.name} ${c.email}`.toLowerCase().includes(term)) return false;
      if (applied.status && c.status !== applied.status) return false;
      if (applied.plan && c.plan !== applied.plan) return false;
      if (applied.date) {
        const days = (TODAY - new Date(`${c.created}T00:00:00`)) / 86400000;
        if (days > Number(applied.date)) return false;
      }
      return true;
    }

    function chip(label, key) {
      return `<span class="chip chip--removable chip--selected">${escapeHtml(label)}<button class="chip__remove" type="button" data-remove-filter="${key}" aria-label="Remove filter ${escapeHtml(label)}">${icon('x')}</button></span>`;
    }

    function render() {
      const active = [];
      if (q.value.trim()) active.push(chip(`"${q.value.trim()}"`, 'q'));
      Object.keys(applied).forEach(k => {
        if (!applied[k]) return;
        active.push(chip(`${LABELS[k]}: ${k === 'date' ? DATE_LABELS[applied[k]] : applied[k]}`, k));
      });
      chipsEl.innerHTML = active.length
        ? `${active.join('')}<button class="btn btn--tertiary btn--sm" type="button" data-clear-all>Clear all</button>`
        : '<span class="filter-active__none">None — showing every customer</span>';

      const results = CUSTOMERS.filter(matches);
      countEl.textContent = results.length;
      if (!results.length) {
        resultsEl.innerHTML = `
          <li class="empty empty--compact" style="border:0">
            <span class="empty__icon" aria-hidden="true">${icon('filter')}</span>
            <h3 class="empty__title">No customers match</h3>
            <p class="empty__text">Try removing a filter or searching a shorter name.</p>
            <div class="empty__actions"><button class="btn btn--secondary btn--sm" type="button" data-clear-all>Clear filters</button></div>
          </li>`;
        return;
      }
      const shown = results.slice(0, 5);
      resultsEl.innerHTML = shown.map(c => `
        <li class="result-item">
          <div class="person"><span class="avatar avatar--sm ${avatarTone(c)}" aria-hidden="true">${initials(c.name)}</span><div><p class="person__name">${escapeHtml(c.name)}</p><p class="person__mail">${c.plan} · ${formatDate(c.created)}</p></div></div>
          <div class="result-item__meta">${badge(c.status)}</div>
        </li>`).join('') + (results.length > shown.length
        ? `<li class="result-item"><span class="t-body-sm" style="color:var(--color-text-muted)">and ${results.length - shown.length} more</span></li>` : '');
    }

    function clearAll() {
      q.value = '';
      Object.keys(applied).forEach(k => { applied[k] = ''; pending[k] = ''; selects[k]._select.setValue(''); });
      syncDirty();
      render();
      announce('All filters cleared');
    }

    Object.entries(selects).forEach(([key, el]) => el.addEventListener('select-change', e => {
      pending[key] = e.detail.value;
      syncDirty();
    }));

    let debounce;
    q.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(render, 150); });

    $('[data-filter-apply]', root).addEventListener('click', () => {
      Object.assign(applied, pending);
      syncDirty();
      render();
      announce(`${countEl.textContent} customers match`);
    });
    $('[data-filter-clear]', root).addEventListener('click', clearAll);

    root.addEventListener('click', e => {
      if (e.target.closest('[data-clear-all]')) { clearAll(); q.focus(); return; }
      const remove = e.target.closest('[data-remove-filter]');
      if (!remove) return;
      const key = remove.dataset.removeFilter;
      if (key === 'q') q.value = '';
      else { applied[key] = ''; pending[key] = ''; selects[key]._select.setValue(''); }
      syncDirty();
      render();
      ($('[data-remove-filter]', chipsEl) || q).focus();
    });

    render();
    filtersApi = { refresh: render };
  }

  /* --------------------------------------------------- Dialogs (shared) */

  function openDialog(dlg, opener) {
    dlg._opener = opener || document.activeElement;
    dlg.classList.remove('is-closing');
    dlg.showModal();
    const first = $('[autofocus]', dlg) || $('.modal__body input, .drawer__body input', dlg) || $('[data-action]', dlg) || $('[data-close]', dlg);
    first?.focus();
  }

  function closeDialog(dlg) {
    if (!dlg || !dlg.open || dlg.classList.contains('is-closing')) return;
    dlg.classList.add('is-closing');
    const finish = () => {
      dlg.classList.remove('is-closing');
      dlg.close();
      if (dlg._opener && document.contains(dlg._opener)) dlg._opener.focus();
    };
    if (reduceMotion.matches) finish(); else setTimeout(finish, 190);
  }

  function initDialogs() {
    $$('dialog').forEach(dlg => {
      dlg.addEventListener('cancel', e => { e.preventDefault(); closeDialog(dlg); });
      dlg.addEventListener('click', e => {
        if (e.target === dlg || e.target.closest('[data-close]')) closeDialog(dlg);
      });
    });

    document.addEventListener('click', e => {
      const drawerBtn = e.target.closest('[data-drawer]');
      if (drawerBtn) openDialog($(`#${drawerBtn.dataset.drawer}`), drawerBtn);
      const modalBtn = e.target.closest('[data-modal]');
      if (modalBtn) openModal(modalBtn.dataset.modal, modalBtn);
    });
  }

  function openCustomerDrawer(c, opener) {
    const d = $('#drawer-right');
    $('[data-d-initials]', d).textContent = initials(c.name);
    $('[data-d-name]', d).textContent = c.name;
    $('[data-d-email]', d).textContent = c.email;
    $('[data-d-status]', d).innerHTML = badge(c.status);
    $('[data-d-plan]', d).textContent = c.plan;
    $('[data-d-created]', d).textContent = formatDate(c.created);
    $('[data-d-seats]', d).textContent = c.seats;
    openDialog(d, opener);
  }

  /* ---------------------------------------------------------------- Modal */

  const modal = $('#modal');
  const MODALS = {
    default: {
      eyebrow: 'Create', icon: 'pencil', tone: 'primary',
      title: 'New component',
      desc: 'Give it a role-based name. You can rename it later.',
      extra: `
        <div class="field">
          <label class="field__label" for="m-name">Component name <span class="field__req" aria-hidden="true">*</span></label>
          <input class="input" id="m-name" type="text" placeholder="e.g. Card / Pricing" autocomplete="off" required aria-describedby="m-name-hint" autofocus>
          <p class="field__hint" id="m-name-hint">Use Role / Variant, like Button / Secondary.</p>
        </div>`,
      actions: [{ label: 'Cancel', kind: 'secondary', close: true }, { label: 'Create component', kind: 'primary', id: 'create' }]
    },
    confirm: {
      eyebrow: 'Confirm', icon: 'info', tone: 'info',
      title: 'Publish version 2.5?',
      desc: '48 screens will switch to the new tokens. Each team gets a changelog by email.',
      extra: `<div class="callout">${icon('clock', 'icon--sm')}<span>Takes about a minute. You can keep working while it publishes.</span></div>`,
      actions: [{ label: 'Not now', kind: 'secondary', close: true }, { label: 'Publish', kind: 'primary', id: 'publish' }]
    },
    error: {
      eyebrow: 'Error', icon: 'alert-triangle', tone: 'error',
      title: "Couldn't publish changes",
      desc: "The token server didn't respond. Nothing was lost — your changes are saved as a draft.",
      extra: `<div class="callout callout--error">${icon('alert-circle', 'icon--sm')}<span>Error <span class="mono">ERR_TIMEOUT</span> · 08 Oct 2026, 10:42</span></div>`,
      actions: [{ label: 'Close', kind: 'secondary', close: true }, { label: 'Try again', kind: 'primary', id: 'retry' }]
    },
    success: {
      eyebrow: 'Done', icon: 'check', tone: 'success',
      title: 'Version 2.5 is live',
      desc: "48 screens now use the new tokens. We've emailed the changelog to 4 teams.",
      actions: [{ label: 'Close', kind: 'secondary', close: true }, { label: 'View changelog', kind: 'primary', id: 'changelog' }]
    },
    upgrade: {
      eyebrow: 'Business plan', icon: 'lock', tone: 'primary',
      title: 'Unlock the audit log',
      desc: 'Only workspace owners can change the plan. We can ask Aisha (owner) to upgrade for you.',
      extra: `<div class="callout">${icon('info', 'icon--sm')}<span>Business adds 12 months of history and CSV export.</span></div>`,
      actions: [{ label: 'Not now', kind: 'secondary', close: true }, { label: 'Ask Aisha to upgrade', kind: 'primary', id: 'request' }]
    },
    destructive: {
      eyebrow: 'Delete', icon: 'trash', tone: 'danger',
      title: 'Delete "Button / Legacy"?',
      desc: "It's used on 6 screens. Those screens will fall back to Button / Primary. This can't be undone.",
      extra: `<label class="check"><input type="checkbox" id="m-confirm">I understand this can't be undone</label>`,
      actions: [{ label: 'Cancel', kind: 'secondary', close: true, autofocus: true }, { label: 'Delete', kind: 'danger', id: 'delete', disabled: true }]
    }
  };

  function fillModal(type, overrides = {}) {
    const cfg = { ...MODALS[type], ...overrides };
    const actions = cfg.actions.map(a => (a.id === 'delete' && overrides.confirmLabel ? { ...a, label: overrides.confirmLabel } : a));
    modal.dataset.type = type;
    $('#modal-eyebrow').textContent = cfg.eyebrow;
    const iconWrap = $('#modal-icon');
    iconWrap.className = `modal__icon modal__icon--${cfg.tone}`;
    iconWrap.innerHTML = icon(cfg.icon);
    $('#modal-title').textContent = cfg.title;
    $('#modal-desc').textContent = cfg.desc;
    $('#modal-extra').innerHTML = cfg.extra || '';
    $('#modal-extra').hidden = !cfg.extra;
    $('#modal-foot').innerHTML = actions.map(a => `
      <button class="btn btn--${a.kind}" type="button" ${a.close ? 'data-close' : ''} ${a.id ? `data-action="${a.id}"` : ''} ${a.autofocus ? 'autofocus' : ''} ${a.disabled ? 'disabled' : ''}>
        <span class="spinner spinner--sm btn__spinner" aria-hidden="true"></span><span class="btn__label">${a.label}</span>
      </button>`).join('');
    modal._onConfirm = overrides.onConfirm || null;
  }

  function openModal(type, opener, overrides) {
    fillModal(type, overrides);
    if (modal.open) {
      ($('[autofocus]', modal) || $('[data-action]', modal))?.focus();
      return;
    }
    openDialog(modal, opener);
  }

  function initModal() {
    modal.addEventListener('change', e => {
      if (e.target.id === 'm-confirm') $('[data-action="delete"]', modal).disabled = !e.target.checked;
    });

    modal.addEventListener('input', e => {
      if (e.target.id !== 'm-name') return;
      e.target.removeAttribute('aria-invalid');
      const hint = $('#m-name-hint');
      hint.className = 'field__hint';
      hint.textContent = 'Use Role / Variant, like Button / Secondary.';
    });

    modal.addEventListener('click', async e => {
      const btn = e.target.closest('[data-action]');
      if (!btn || isBusy(btn)) return;
      const action = btn.dataset.action;

      if (action === 'create') {
        const input = $('#m-name');
        if (!input.value.trim()) {
          input.setAttribute('aria-invalid', 'true');
          const hint = $('#m-name-hint');
          hint.className = 'field__hint field__hint--error';
          hint.innerHTML = `${icon('alert-circle')}Enter a name to create the component`;
          input.focus();
          return;
        }
        closeDialog(modal);
        toast({ type: 'success', title: `${input.value.trim()} created`, text: 'Prototype — added to this session only.' });
      }

      if (action === 'publish' || action === 'retry') {
        setButtonBusy(btn, action === 'publish' ? 'Publishing…' : 'Retrying…');
        await wait(1200);
        fillModal('success');
        $('[data-action]', modal).focus();
        announce('Version 2.5 is live');
      }

      if (action === 'request') {
        closeDialog(modal);
        toast({ type: 'success', title: 'Request sent', text: 'Prototype — Aisha would get an email.' });
      }

      if (action === 'changelog') {
        closeDialog(modal);
        toast({ type: 'info', title: 'Changelog', text: 'Prototype — the changelog page is not part of this file.' });
      }

      if (action === 'delete') {
        const onConfirm = modal._onConfirm;
        setButtonBusy(btn, 'Deleting…');
        await wait(900);
        closeDialog(modal);
        if (onConfirm) onConfirm();
        else toast({ type: 'success', title: 'Button / Legacy deleted', text: 'Prototype — nothing was removed.' });
      }
    });
  }

  /* --------------------------------------------------------------- Alerts */

  function initAlerts() {
    const stack = $('[data-alerts]');
    const restore = $('[data-alerts-restore]', stack);

    stack.addEventListener('click', e => {
      const btn = e.target.closest('[data-dismiss]');
      if (!btn) return;
      const alert = btn.closest('.alert');
      alert.hidden = true;
      announce(`Dismissed: ${$('.alert__title', alert).textContent}`);
      restore.hidden = false;
      const next = $$('.alert:not([hidden]) [data-dismiss]', stack)[0];
      (next || $('[data-restore-alerts]', restore)).focus();
    });

    $('[data-restore-alerts]', restore).addEventListener('click', () => {
      $$('.alert', stack).forEach(a => { a.hidden = false; });
      restore.hidden = true;
      $('[data-dismiss]', stack).focus();
    });
  }

  /* -------------------------------------------------------- Retry demos */

  function initRetry() {
    $$('[data-retry-card]').forEach(card => {
      const original = card.innerHTML;

      card.addEventListener('click', async e => {
        const retry = e.target.closest('[data-retry]');
        const reset = e.target.closest('[data-reset]');
        if (reset) {
          card.innerHTML = original;
          card.classList.add('card--error');
          $('[data-retry]', card).focus();
          return;
        }
        if (!retry || isBusy(retry)) return;
        setButtonBusy(retry, 'Retrying…');
        await wait(1200);
        card.classList.remove('card--error');
        card.innerHTML = `
          <div>
            <span class="card__icon card__icon--success" aria-hidden="true">${icon('check-circle')}</span>
            <h3 class="card__title" style="margin-top:var(--space-3)">Loaded</h3>
            <p class="card__text">Everything is up to date.</p>
          </div>
          <div class="card__foot"><span>Updated just now</span><button class="btn btn--tertiary btn--sm" type="button" data-reset>Reset demo</button></div>`;
        $('[data-reset]', card).focus();
        announce('Loaded successfully');
      });
    });

    const page = $('[data-page-error]');
    const body = $('[data-page-error-body]', page);
    const code = $('.page-error__code', page);
    const original = body.innerHTML;

    page.addEventListener('click', async e => {
      if (e.target.closest('[data-page-reset]')) {
        body.innerHTML = original;
        code.hidden = false;
        $('[data-page-retry]', page).focus();
        return;
      }
      const btn = e.target.closest('[data-page-retry]');
      if (!btn || isBusy(btn)) return;
      setButtonBusy(btn, 'Reconnecting…');
      await wait(1500);
      code.hidden = true;
      body.innerHTML = `
        <div class="success-hero" style="align-items:flex-start;text-align:left">
          <span class="success-hero__ring" aria-hidden="true">${icon('check')}</span>
          <p class="eyebrow" style="color:var(--color-success)">Recovered</p>
          <h3>Back online</h3>
          <p>The workspace loaded. Anything you were editing is exactly where you left it.</p>
          <div class="page-error__actions"><a class="btn btn--primary" href="#overview">Go to workspace</a><button class="btn btn--tertiary" type="button" data-page-reset>Reset demo</button></div>
        </div>`;
      $('[data-page-reset]', page).focus();
      announce('Back online');
    });
  }

  /* ---------------------------------------------------------------- Icons */

  function initIcons() {
    const names = $$('symbol').map(s => s.id.replace(/^i-/, ''));
    $('[data-icon-count]').textContent = `${names.length} icons`;
    const grid = $('[data-icon-grid]');
    grid.innerHTML = names.map(n => `
      <button class="icon-tile" type="button" data-icon="${n}">
        ${icon(n)}<span>${n}</span><span class="sr-only">— copy name</span>
      </button>`).join('');
    grid.addEventListener('click', e => {
      const tile = e.target.closest('[data-icon]');
      if (!tile) return;
      const ref = `#i-${tile.dataset.icon}`;
      navigator.clipboard?.writeText(ref).catch(() => {});
      toast({ type: 'success', title: `Copied ${ref}`, text: 'Use it with <use href="…">.' });
    });
  }

  /* ----------------------------------------------------- Viewport readout */

  function initViewport() {
    const name = $('[data-vp-name]');
    const width = $('[data-vp-width]');
    const devices = $$('[data-device]');
    const update = () => {
      const w = window.innerWidth;
      const mode = w >= 1024 ? 'desktop' : w >= 768 ? 'tablet' : 'mobile';
      name.textContent = mode[0].toUpperCase() + mode.slice(1);
      width.textContent = `${w}px`;
      devices.forEach(d => d.classList.toggle('is-current', d.dataset.device === mode));
    };
    update();
    let raf;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { update(); measureType(); });
    });
  }

  /* ------------------------------------------------------------------ Boot */

  initNav();
  initHeader();
  initScrollSpy();
  initSwatches();
  measureType();
  if (document.fonts) document.fonts.ready.then(measureType);
  initAsyncButtons();
  initInviteForm();
  $$('[data-select]').forEach(initSelect);
  $$('[data-tabs]').forEach(initTabs);
  initChips();
  initTable();
  initFilters();
  initDialogs();
  initModal();
  initAlerts();
  initRetry();
  initIcons();
  initViewport();
})();
