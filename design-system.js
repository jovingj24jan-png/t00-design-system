(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const isDesktop = matchMedia('(min-width: 1024px)');
  const rootStyle = () => getComputedStyle(document.documentElement);
  const token = name => rootStyle().getPropertyValue(name).trim();
  const ms = name => parseFloat(token(name)) || 300;
  const wait = t => new Promise(r => setTimeout(r, reduceMotion.matches ? Math.min(t, 300) : t));

  const srStatus = document.createElement('p');
  srStatus.className = 'sr-only';
  srStatus.setAttribute('role', 'status');
  document.body.appendChild(srStatus);
  const announce = msg => { srStatus.textContent = ''; requestAnimationFrame(() => { srStatus.textContent = msg; }); };

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
      return ok;
    }
  }

  /* ---------------------------------------------------------------- Toasts */

  const toastRegion = $('#toast-region');
  function toast(title, text = '', kind = 'check-circle') {
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
    $('button', el).addEventListener('click', dismiss);
    toastRegion.appendChild(el);
    const all = $$('.toast:not(.is-leaving)', toastRegion);
    if (all.length > 3) all[0].remove();
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-toast]');
    if (!t || document.body.classList.contains('is-inspecting')) return;
    toast(t.dataset.toast, t.dataset.toastText || '');
    if (t.hasAttribute('data-close-after')) closeDialog(t.closest('dialog'));
  });

  /* ------------------------------------------------- Page load + reveals */

  function countUp(el) {
    const target = Number(el.dataset.count);
    const pad = Number(el.dataset.pad || 0);
    const suffix = el.dataset.suffix || '';
    const fmt = n => String(Math.round(n)).padStart(pad, '0') + suffix;
    if (reduceMotion.matches) { el.textContent = fmt(target); return; }
    const duration = 1100;
    const start = performance.now();
    const step = now => {
      const p = Math.min(1, (now - start) / duration);
      el.textContent = fmt(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = fmt(0);
    requestAnimationFrame(step);
  }

  function initLoad() {
    requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('is-loaded')));
    const metricBars = $$('.metric__bar span');
    metricBars.forEach(b => { b.dataset.fill = b.style.getPropertyValue('--fill'); b.style.setProperty('--fill', '0'); });
    setTimeout(() => {
      $$('.metric [data-count]').forEach(countUp);
      metricBars.forEach(b => b.style.setProperty('--fill', b.dataset.fill));
    }, reduceMotion.matches ? 0 : 520);

    const reveals = $$('.reveal');
    if (!('IntersectionObserver' in window)) { reveals.forEach(r => r.classList.add('is-in')); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        $$('[data-count]', entry.target).forEach(countUp);
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    reveals.forEach(r => io.observe(r));
  }

  /* ------------------------------------------- Cursor spotlight + panel glow */

  function initAmbient() {
    const backdrop = $('[data-backdrop]');
    let lit = null;
    let raf = 0;
    let last = null;
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      last = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        backdrop.style.setProperty('--cx', `${last.clientX}px`);
        backdrop.style.setProperty('--cy', `${last.clientY}px`);
        backdrop.classList.add('has-pointer');
        const panel = last.target.closest?.('.panel');
        if (lit && lit !== panel) lit.classList.remove('is-lit');
        if (panel) {
          const r = panel.getBoundingClientRect();
          panel.style.setProperty('--mx', `${last.clientX - r.left}px`);
          panel.style.setProperty('--my', `${last.clientY - r.top}px`);
          panel.classList.add('is-lit');
        }
        lit = panel;
      });
    }, { passive: true });
    document.addEventListener('pointerleave', () => { backdrop.classList.remove('has-pointer'); lit?.classList.remove('is-lit'); lit = null; });
  }

  /* ------------------------------------------------- Navigation + spy */

  function initNav() {
    const sidebar = $('#sidebar');
    const toggle = $('#nav-toggle');
    const backdrop = $('.nav-backdrop');
    const inertTargets = [$('#main'), $('.fab--fixed')];
    let open = false;

    function setOpen(value, restore = true) {
      if (open === value) return;
      open = value;
      sidebar.classList.toggle('is-open', value);
      backdrop.classList.toggle('is-visible', value);
      toggle.setAttribute('aria-expanded', String(value));
      inertTargets.forEach(el => { el.inert = value; });
      document.documentElement.style.overflow = value ? 'hidden' : '';
      if (value) {
        sidebar.setAttribute('role', 'dialog');
        sidebar.setAttribute('aria-modal', 'true');
        requestAnimationFrame(() => $('.nav-link', sidebar).focus());
      } else {
        sidebar.removeAttribute('role');
        sidebar.removeAttribute('aria-modal');
        if (restore) toggle.focus();
      }
    }
    toggle.addEventListener('click', () => setOpen(true));
    $$('[data-nav-close]').forEach(el => el.addEventListener('click', () => setOpen(false)));
    $$('.nav-link', sidebar).forEach(a => a.addEventListener('click', () => { if (!isDesktop.matches) setOpen(false, false); }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) setOpen(false); });
    isDesktop.addEventListener('change', e => { if (e.matches) setOpen(false, false); });

    const links = new Map($$('.nav-link', sidebar).map(a => [a.hash.slice(1), a]));
    let current = null;
    const spy = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const link = links.get(entry.target.id);
        if (!link || link === current) return;
        current?.classList.remove('is-current');
        current?.removeAttribute('aria-current');
        link.classList.add('is-current');
        link.setAttribute('aria-current', 'location');
        current = link;
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    $$('.panel').forEach(p => spy.observe(p));
  }

  /* ------------------------------------------------------- Token inspector */

  const C = name => `--color-${name}`;
  const INSPECT = {
    'button-primary': { component: 'Button', variant: 'Primary', background: C('primary'), text: C('on-primary'), border: 'none', radius: '--radius-md', shadow: '--shadow-sm', spacing: '--space-4 · 40px tall', typography: '--fs-button · 600', motion: '--duration-fast · --ease-standard' },
    'button-secondary': { component: 'Button', variant: 'Secondary', background: C('surface-2'), text: C('text'), border: C('border-strong'), radius: '--radius-md', shadow: 'none', spacing: '--space-4 · 40px tall', typography: '--fs-button · 600', motion: '--duration-fast · --ease-standard' },
    'button-tertiary': { component: 'Button', variant: 'Tertiary', background: 'transparent', text: C('primary'), border: 'none', radius: '--radius-md', shadow: 'none', spacing: '--space-3 · 40px tall', typography: '--fs-button · 600', motion: '--duration-fast · --ease-standard' },
    'button-icon': { component: 'Icon button', variant: 'Default', background: C('surface-2'), text: C('text-secondary'), border: C('border-strong'), radius: '--radius-md', shadow: 'none', spacing: '40 × 40 · 44 on touch', typography: 'icon 20 · stroke 1.75', motion: '--duration-fast · --ease-standard' },
    fab: { component: 'Floating action', variant: 'Primary', background: C('primary'), text: C('on-primary'), border: 'none', radius: '--radius-full', shadow: '--shadow-md', spacing: '56 × 56 · --space-4 inset', typography: 'icon 24 · stroke 2.2', motion: '--duration-fast · --ease-standard' },
    input: { component: 'Input', variant: 'Default', background: C('bg-raised'), text: C('text'), border: C('border-strong'), radius: '--radius-md', shadow: '--shadow-focus on focus', spacing: '14px inline · 44px tall', typography: '15px · --font-sans', motion: '--duration-fast · --ease-standard' },
    'input-success': { component: 'Input', variant: 'Success', background: C('bg-raised'), text: C('text'), border: C('success'), radius: '--radius-md', shadow: 'none', spacing: '14px inline · 44px tall', typography: 'hint 12.5px · 500', motion: '--duration-fast · --ease-standard' },
    'input-error': { component: 'Input', variant: 'Error', background: C('bg-raised'), text: C('text'), border: C('error'), radius: '--radius-md', shadow: '--shadow-focus-error', spacing: '14px inline · 44px tall', typography: 'hint 12.5px · 500', motion: '--duration-normal · fade-up' },
    select: { component: 'Select', variant: 'Listbox', background: C('surface-2'), text: C('text-secondary'), border: C('border-strong'), radius: '--radius-lg', shadow: '--shadow-lg', spacing: '6px menu · 38px options', typography: '--fs-small', motion: '--duration-fast · --ease-standard' },
    checkbox: { component: 'Checkbox / Radio', variant: 'Checked', background: C('primary'), text: C('on-primary'), border: C('border-strong'), radius: '6px · 50%', shadow: 'none', spacing: '20 × 20 · --space-3 gap', typography: '--fs-small', motion: '--duration-fast · --ease-emphasized' },
    toggle: { component: 'Toggle', variant: 'On', background: C('primary'), text: C('on-primary'), border: C('primary'), radius: '--radius-full', shadow: '--shadow-sm', spacing: '42 × 24 track', typography: '--fs-small', motion: '--duration-normal · --ease-emphasized' },
    'card-student': { component: 'Card', variant: 'Student progress', background: C('bg-raised'), text: C('text'), border: C('border'), radius: '--radius-lg', shadow: '--shadow-md on hover', spacing: '--space-4', typography: '15px · 650', motion: '--duration-normal · translateY(-3px)' },
    'card-stat': { component: 'Card', variant: 'Statistic', background: C('bg-raised'), text: C('text'), border: C('border'), radius: '--radius-lg', shadow: '--shadow-md on hover', spacing: '--space-4', typography: '34px · --font-display · tabular', motion: '--duration-slow · count-up' },
    'card-image': { component: 'Card', variant: 'Image', background: C('primary-light'), text: C('text'), border: C('border'), radius: '--radius-lg', shadow: '--shadow-md on hover', spacing: '--space-4 body', typography: '15px · 650', motion: '--duration-normal · --ease-emphasized' },
    'badge-status': { component: 'Badge', variant: 'Status', background: C('success-light'), text: C('success'), border: 'none', radius: '--radius-full', shadow: 'none', spacing: '24px tall · 9px inline', typography: '12px · 600', motion: 'none' },
    tag: { component: 'Tag', variant: 'Class', background: C('primary-light'), text: C('primary'), border: C('primary-line'), radius: '--radius-sm', shadow: 'none', spacing: '26px tall · 10px inline', typography: '12px · --font-mono', motion: 'none' },
    avatar: { component: 'Avatar', variant: 'Initials', background: C('primary-light'), text: C('primary'), border: C('primary-line'), radius: '50%', shadow: 'none', spacing: '30 · 36 · 52', typography: '12.5px · 700', motion: 'none' },
    'table-row': { component: 'Table', variant: 'Row', background: C('bg-raised'), text: C('text'), border: C('border'), radius: '--radius-lg (mobile card)', shadow: 'none', spacing: '--space-3 · --space-4', typography: '--fs-small', motion: '--duration-normal · fade-up' },
    tab: { component: 'Tabs', variant: 'Active', background: 'transparent', text: C('text'), border: C('primary'), radius: '2px indicator', shadow: 'none', spacing: '--space-3 · 44px tall', typography: '--fs-small · 600', motion: '--duration-normal · translateX' },
    'filter-chip': { component: 'Chip', variant: 'Filter, selected', background: C('primary-light'), text: C('primary'), border: C('primary'), radius: '--radius-full', shadow: 'none', spacing: '--space-3 · 34px tall', typography: '13px · 500', motion: '--duration-fast' },
    modal: { component: 'Modal', variant: 'Confirm', background: C('surface'), text: C('text'), border: C('border-strong'), radius: '--radius-xl', shadow: '--shadow-lg', spacing: '--space-6', typography: '24px · --font-display', motion: '--duration-normal · scale / sheet' },
    drawer: { component: 'Drawer', variant: 'Right', background: C('surface'), text: C('text'), border: C('border'), radius: '0', shadow: '--shadow-lg', spacing: '--space-5', typography: '18px · --font-display', motion: '--duration-normal · translateX' },
    skeleton: { component: 'Skeleton', variant: 'Shimmer', background: C('surface-2'), text: 'n/a', border: 'none', radius: '--radius-sm', shadow: 'none', spacing: '10px lines · 8px gap', typography: 'n/a', motion: '1.6s shimmer · off when reduced' }
  };
  const PICKER = ['button-primary', 'button-secondary', 'fab', 'input', 'input-error', 'select', 'toggle', 'card-stat', 'badge-status', 'table-row', 'tab', 'modal'];
  const FIELDS = ['background', 'text', 'border', 'radius', 'shadow', 'spacing', 'typography', 'motion'];
  let currentSpec = INSPECT['button-primary'];
  let currentKey = 'button-primary';

  function sheetHtml(spec) {
    const rows = FIELDS.map(f => {
      const v = spec[f];
      const dot = v && v.startsWith('--color-') ? `<span class="token-dot" style="background:var(${v})"></span>` : '';
      return `<div><dt>${f[0].toUpperCase() + f.slice(1)}</dt><dd>${dot}${esc(v)}</dd></div>`;
    }).join('');
    return `<p class="token-sheet__title">${esc(spec.component)} / <span>${esc(spec.variant)}</span></p>${rows}`;
  }
  const specText = spec => [`${spec.component} / ${spec.variant}`, ...FIELDS.map(f => `${f}: ${spec[f]}`)].join('\n');

  const floatPanel = $('#inspector');
  function showSpec(key, { float = false } = {}) {
    const spec = typeof key === 'string' ? INSPECT[key] : key;
    if (!spec) return;
    currentSpec = spec;
    if (typeof key === 'string') currentKey = key;
    $('[data-dock-sheet]').innerHTML = sheetHtml(spec);
    $$('[data-picker] button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.key === currentKey && typeof key === 'string')));
    if (float) {
      $('[data-float-sheet]').innerHTML = sheetHtml(spec);
      floatPanel.classList.remove('is-leaving');
      floatPanel.hidden = false;
      $('.fab--fixed').hidden = true;
    }
    announce(`${spec.component} ${spec.variant} tokens shown`);
  }
  function hideFloat() {
    if (floatPanel.hidden) return;
    floatPanel.classList.add('is-leaving');
    setTimeout(() => { floatPanel.hidden = true; floatPanel.classList.remove('is-leaving'); $('.fab--fixed').hidden = false; }, reduceMotion.matches ? 0 : 180);
  }

  function initInspector() {
    $('[data-picker]').innerHTML = PICKER.map(k => `<button type="button" aria-pressed="false" data-key="${k}">${esc(INSPECT[k].component)}<span>${esc(INSPECT[k].variant)}</span></button>`).join('');
    $('[data-picker]').addEventListener('click', e => {
      const b = e.target.closest('[data-key]');
      if (b) showSpec(b.dataset.key);
    });
    showSpec('button-primary');

    const toggles = $$('[data-inspect-toggle]');
    const setInspecting = on => {
      document.body.classList.toggle('is-inspecting', on);
      toggles.forEach(t => t.setAttribute('aria-pressed', String(on)));
      announce(on ? 'Inspect mode on. Click any component to see its tokens.' : 'Inspect mode off');
      if (on) toast('Inspect mode on', 'Click any component to see its tokens. Press Escape to stop.', 'target');
      else hideFloat();
    };
    toggles.forEach(t => t.addEventListener('click', () => setInspecting(t.getAttribute('aria-pressed') !== 'true')));

    document.addEventListener('click', e => {
      if (!document.body.classList.contains('is-inspecting')) return;
      if (e.target.closest('[data-inspect-toggle], #inspector, .sidebar, .mobilebar, dialog')) return;
      const target = e.target.closest('[data-inspect]');
      if (!target) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      showSpec(target.dataset.inspect, { float: true });
    }, true);

    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (!floatPanel.hidden) hideFloat();
      else if (document.body.classList.contains('is-inspecting')) setInspecting(false);
    });
    $('[data-inspector-close]').addEventListener('click', hideFloat);

    $$('[data-copy-tokens]').forEach(btn => btn.addEventListener('click', async () => {
      const ok = await copyText(specText(currentSpec));
      toast(ok ? 'Tokens copied' : 'Copy blocked', ok ? `${currentSpec.component} / ${currentSpec.variant}` : 'Your browser blocked clipboard access.', ok ? 'check-circle' : 'info');
    }));
  }

  /* ------------------------------------------------------------- Colours */

  const SWATCHES = [
    ['Primary', 'primary', 'Actions, focus, highlights'],
    ['Primary hover', 'primary-hover', 'Hover on primary'],
    ['Primary light', 'primary-light', 'Selected rows, tints'],
    ['Secondary', 'secondary', 'Steel accents, icons'],
    ['Accent', 'accent', 'Locks, highlights'],
    ['Background', 'bg', 'Page canvas'],
    ['Surface', 'surface', 'Panels and cards'],
    ['Border', 'border', 'Dividers, outlines'],
    ['Success', 'success', 'Present, saved'],
    ['Warning', 'warning', 'Late, due soon'],
    ['Error', 'error', 'Absent, failed'],
    ['Info', 'info', 'Neutral news'],
    ['Text', 'text', 'Headings, values'],
    ['Text muted', 'text-muted', 'Meta and captions']
  ];

  const PAIRS = [
    ['Text on surface', 'text', 'surface'],
    ['Secondary text on surface', 'text-secondary', 'surface'],
    ['Muted text on surface', 'text-muted', 'surface'],
    ['Dark text on primary', 'on-primary', 'primary'],
    ['Success on its tint', 'success', 'success-light'],
    ['Error on its tint', 'error', 'error-light']
  ];
  function luminance(hex) {
    const v = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }
  function renderContrast() {
    $('[data-contrast]').innerHTML = PAIRS.map(([name, fg, bg]) => {
      const ratio = contrast(token(`--color-${fg}`), token(`--color-${bg}`));
      const level = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA large' : 'Fail';
      return `<li><span class="pairs__sample" style="color:var(--color-${fg});background:var(--color-${bg})" aria-hidden="true">Aa</span><span class="pairs__name">${name}</span><span class="pairs__ratio">${ratio.toFixed(1)}:1</span><span class="badge ${level === 'Fail' ? 'badge--error' : 'badge--success'} badge--plain">${level}</span></li>`;
    }).join('');
  }

  function initSwatches() {
    renderContrast();
    const grid = $('[data-swatches]');
    grid.innerHTML = SWATCHES.map(([name, key, purpose]) => `
      <button class="swatch" type="button" aria-pressed="false" data-token="--color-${key}" title="${esc(purpose)}">
        <span class="swatch__chip bg-${key}" aria-hidden="true"></span>
        <span class="swatch__body">
          <span class="swatch__name">${name}</span>
          <span class="swatch__token">--color-${key}</span>
          <span class="swatch__value">${esc(token(`--color-${key}`))}</span>
        </span>
        <span class="swatch__copied" aria-hidden="true">${icon('check', 'icon--sm')}Copied</span>
      </button>`).join('');

    grid.addEventListener('click', async e => {
      const sw = e.target.closest('.swatch');
      if (!sw) return;
      $$('.swatch', grid).forEach(s => s.setAttribute('aria-pressed', String(s === sw)));
      const name = sw.dataset.token;
      await copyText(`var(${name}) /* ${token(name)} */`);
      sw.classList.remove('is-copied');
      void sw.offsetWidth;
      sw.classList.add('is-copied');
      clearTimeout(sw._t);
      sw._t = setTimeout(() => sw.classList.remove('is-copied'), 1600);
      $('[data-swatch-status]').textContent = `Copied ${name}`;
      showSpec({ component: 'Token', variant: name.replace('--color-', ''), background: name, text: '—', border: '—', radius: '—', shadow: '—', spacing: '—', typography: '—', motion: '—' });
    });
  }

  /* ---------------------------------------------------------- Typography */

  function measureType() {
    $$('[data-type-sample]').forEach(el => {
      const cs = getComputedStyle(el);
      const meta = el.parentElement.querySelector('.type-row__meta');
      meta.textContent = `${Math.round(parseFloat(cs.fontSize))}px · ${cs.fontWeight} · LH ${cs.lineHeight === 'normal' ? 'normal' : Math.round(parseFloat(cs.lineHeight)) + 'px'}`;
    });
  }

  function initType() {
    const group = $('[data-type-size]');
    const preview = $('[data-type-preview]');
    const tamilCard = $('.tamil-card');
    group.addEventListener('click', e => {
      const b = e.target.closest('[data-scale]');
      if (!b) return;
      $$('[data-scale]', group).forEach(x => x.setAttribute('aria-checked', String(x === b)));
      preview.style.setProperty('--type-scale', b.dataset.scale);
      tamilCard.style.setProperty('--type-scale', b.dataset.scale);
      setTimeout(measureType, reduceMotion.matches ? 0 : ms('--duration-normal') + 20);
    });
    radioKeys(group, '[data-scale]');
    measureType();
    if (document.fonts) document.fonts.ready.then(measureType);
  }

  // Arrow-key support for segmented radiogroups.
  function radioKeys(group, sel) {
    group.addEventListener('keydown', e => {
      const items = $$(sel, group);
      const i = items.indexOf(document.activeElement);
      if (i < 0) return;
      const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      const target = items[(next + items.length) % items.length];
      target.focus();
      target.click();
    });
    const sync = () => $$(sel, group).forEach(b => { b.tabIndex = b.getAttribute('aria-checked') === 'true' ? 0 : -1; });
    sync();
    group.addEventListener('click', () => requestAnimationFrame(sync));
  }

  /* ------------------------------------------------------------- Buttons */

  async function runLoading(btn, label = 'Loading…', duration = 1500) {
    if (btn.classList.contains('is-loading')) return;
    const original = btn.innerHTML;
    btn.style.minWidth = `${btn.offsetWidth}px`;
    btn.classList.add('is-loading');
    btn.setAttribute('aria-busy', 'true');
    btn.setAttribute('aria-disabled', 'true');
    const iconOnly = btn.classList.contains('btn--icon') || btn.classList.contains('fab');
    btn.innerHTML = `<span class="spinner" aria-hidden="true"></span>${iconOnly ? '' : esc(label)}`;
    announce(label);
    await wait(duration);
    btn.innerHTML = original;
    btn.classList.remove('is-loading');
    btn.removeAttribute('aria-busy');
    btn.removeAttribute('aria-disabled');
    btn.style.minWidth = '';
    announce('Done');
  }

  function initButtons() {
    $$('[data-run-loading]').forEach(btn => btn.addEventListener('click', () => runLoading(btn)));
  }

  /* --------------------------------------------------------------- Forms */

  function initSelect(root) {
    const trigger = $('.select__trigger', root);
    const menu = $('.select__menu', root);
    const valueEl = $('.select__value', root);
    const options = $$('[role="option"]', menu);
    let active = 0;
    const isOpen = () => root.classList.contains('is-open');
    const label = o => o.dataset.value;

    function setActive(i) {
      active = (i + options.length) % options.length;
      options.forEach((o, j) => o.classList.toggle('is-active', j === active));
      menu.setAttribute('aria-activedescendant', options[active].id);
    }
    function open() {
      root.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      const sel = options.findIndex(o => o.getAttribute('aria-selected') === 'true');
      setActive(sel >= 0 ? sel : 0);
      menu.focus({ preventScroll: true });
    }
    function close(focus = true) {
      if (!isOpen()) return;
      root.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      menu.removeAttribute('aria-activedescendant');
      if (focus) trigger.focus();
    }
    function choose(i) {
      options.forEach((o, j) => o.setAttribute('aria-selected', String(j === i)));
      valueEl.textContent = label(options[i]);
      valueEl.classList.remove('is-placeholder');
      announce(`${label(options[i])} selected`);
    }
    trigger.addEventListener('click', () => (isOpen() ? close() : open()));
    trigger.addEventListener('keydown', e => {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); open(); }
    });
    menu.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
      else if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); close(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'Tab') close(false);
    });
    options.forEach((o, i) => {
      o.addEventListener('click', () => { choose(i); close(); });
      o.addEventListener('mousemove', () => { if (active !== i) setActive(i); });
    });
    menu.addEventListener('focusout', e => { if (!root.contains(e.relatedTarget)) close(false); });
    document.addEventListener('pointerdown', e => { if (isOpen() && !root.contains(e.target)) close(false); });
    root._select = { open, close };
  }

  const SEARCHABLE = ['Button / Primary', 'Button / Secondary', 'Button / Tertiary', 'Icon button', 'Floating action button', 'Input / Text', 'Input / Error', 'Select', 'Search', 'Textarea', 'Checkbox', 'Radio', 'Toggle', 'Card / Statistic', 'Card / Image', 'Card / Student progress', 'Badge / Status', 'Tag', 'Avatar', 'Table', 'Tabs', 'Filter chip', 'Modal', 'Drawer'];

  function initForms() {
    $$('[data-select]').forEach(initSelect);

    const errInput = $('[data-error-input]');
    const errHint = $('[data-error-hint]');
    const revealError = () => {
      if (errHint.classList.contains('field__hint--error')) return;
      errHint.className = 'field__hint field__hint--error is-revealing';
      errHint.innerHTML = `${icon('alert-circle')}Enter a 10-digit mobile number, like 98765 43210`;
    };
    errInput.addEventListener('focus', revealError);
    errInput.addEventListener('click', revealError);
    errInput.addEventListener('input', () => {
      const digits = errInput.value.replace(/\D/g, '');
      const ok = digits.length === 10;
      errInput.setAttribute('aria-invalid', String(!ok));
      errInput.classList.toggle('is-success', ok);
      errInput.nextElementSibling.innerHTML = `<use href="#i-${ok ? 'check-circle' : 'alert-circle'}"/>`;
      errInput.nextElementSibling.setAttribute('class', `icon input-status ${ok ? 'icon--success' : 'icon--error'}`);
      errHint.className = `field__hint ${ok ? 'field__hint--success' : 'field__hint--error'}`;
      errHint.innerHTML = ok ? `${icon('check')}Looks good` : `${icon('alert-circle')}Enter a 10-digit mobile number, like 98765 43210`;
    });

    const search = $('[data-search-input]');
    const results = $('[data-search-results]');
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      if (!q) { results.innerHTML = ''; return; }
      const hits = SEARCHABLE.filter(s => s.toLowerCase().includes(q)).slice(0, 4);
      results.innerHTML = hits.length
        ? hits.map(h => {
          const i = h.toLowerCase().indexOf(q);
          return `<li><span>${esc(h.slice(0, i))}<mark>${esc(h.slice(i, i + q.length))}</mark>${esc(h.slice(i + q.length))}</span><span class="tech-label tech-label--plain">Component</span></li>`;
        }).join('')
        : `<li class="suggest__empty">No component matches “${esc(search.value.trim())}”</li>`;
    });

    const note = $('[data-char-input]');
    const count = $('[data-char-count]');
    note.addEventListener('input', () => { count.textContent = `${note.value.length} / 200`; });

    $$('[data-switch]').forEach(sw => sw.addEventListener('click', () => {
      const on = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', String(on));
      $('.switch__state', sw).textContent = on ? 'ON' : 'OFF';
    }));
  }

  /* ---------------------------------------------------------------- Table */

  const STUDENTS = [
    { id: 's1', name: 'Aarav Sharma', cls: 'Montessori A', status: 'Present', attendance: 96, progress: 82, guardian: 'Neha Sharma', note: 'Built the pink tower on his own and counted every cube aloud.' },
    { id: 's2', name: 'Diya Patel', cls: 'UKG B', status: 'Present', attendance: 92, progress: 74, guardian: 'Rakesh Patel', note: 'Read three-letter words with sandpaper letters.' },
    { id: 's3', name: 'Rohan Kumar', cls: 'LKG A', status: 'Late', attendance: 85, progress: 61, guardian: 'Anitha Kumar', note: 'Enjoyed pouring work; needs help finishing the cycle.' },
    { id: 's4', name: 'Meera Singh', cls: 'Nursery', status: 'Absent', attendance: 78, progress: 55, guardian: 'Harpreet Singh', note: 'Absent today. Last session: sorted colours with confidence.' },
    { id: 's5', name: 'Kabir Khan', cls: 'UKG A', status: 'Present', attendance: 99, progress: 90, guardian: 'Sana Khan', note: 'Helped a friend with the number rods.' }
  ];
  const STATUS_CLASS = { Present: 'badge--success', Absent: 'badge--error badge--absent', Late: 'badge--warning badge--late' };
  const AVATAR_TONE = ['', 'avatar--info', 'avatar--success', 'avatar--accent', 'avatar--neutral'];
  const initials = n => n.split(' ').map(p => p[0]).join('').slice(0, 2);
  const tone = s => AVATAR_TONE[(Number(s.id.slice(1)) - 1) % AVATAR_TONE.length];
  const progressTone = v => (v >= 80 ? 'progress--success' : v >= 60 ? '' : 'progress--warning');
  let tableApi = null;
  let nextId = 6;

  function initTable() {
    const root = $('[data-table]');
    const body = $('[data-table-body]', root);
    const range = $('[data-table-range]', root);
    const pager = $('[data-pager]', root);
    const selectAll = $('[data-select-all]', root);
    const bulk = $('[data-bulk]', root);
    const sortSelect = $('[data-sort-select]');
    const statusGroup = $('[data-status-filter]');
    const PAGE = 3;
    const state = { key: 'name', dir: 'asc', status: '', page: 1, selected: new Set() };

    const rows = () => STUDENTS
      .filter(s => !state.status || s.status === state.status)
      .sort((a, b) => {
        const r = typeof a[state.key] === 'number' ? a[state.key] - b[state.key] : a[state.key].localeCompare(b[state.key]);
        return state.dir === 'asc' ? r : -r;
      });

    function render() {
      const all = rows();
      const pages = Math.max(1, Math.ceil(all.length / PAGE));
      state.page = Math.min(state.page, pages);
      const start = (state.page - 1) * PAGE;
      const view = all.slice(start, start + PAGE);

      $$('th[data-sort-key]', root).forEach(th => th.setAttribute('aria-sort', th.dataset.sortKey === state.key ? (state.dir === 'asc' ? 'ascending' : 'descending') : 'none'));
      const opt = `${state.key}:${state.dir}`;
      if ([...sortSelect.options].some(o => o.value === opt)) sortSelect.value = opt;

      if (!view.length) {
        body.innerHTML = `<tr class="row-span"><td class="cell-span" colspan="7"><div class="state-tile__body state-tile__center" style="padding:var(--space-10) var(--space-4)"><span class="state-icon" aria-hidden="true">${icon('inbox')}</span><h3 class="card__title">No ${esc(state.status.toLowerCase())} students</h3><p class="card__meta">Nobody matches this filter today.</p></div></td></tr>`;
      } else {
        body.innerHTML = view.map((s, i) => {
          const sel = state.selected.has(s.id);
          return `
          <tr class="${sel ? 'is-selected' : ''}" data-id="${s.id}" data-inspect="table-row" style="animation-delay:${i * 50}ms">
            <td class="cell-check" data-label="Select"><label class="check"><input type="checkbox" ${sel ? 'checked' : ''} aria-label="Select ${esc(s.name)}"></label></td>
            <td class="cell-student" data-label="Student"><div class="person"><span class="avatar avatar--sm ${tone(s)}" aria-hidden="true">${initials(s.name)}</span><div><p class="person__name">${esc(s.name)}</p><p class="person__sub cls-inline">${esc(s.cls)}</p></div></div></td>
            <td class="col-class" data-label="Class"><span class="tag">${esc(s.cls)}</span></td>
            <td data-label="Status"><span class="badge ${STATUS_CLASS[s.status]}">${s.status}</span></td>
            <td data-label="Attendance"><span class="mono">${s.attendance}%</span></td>
            <td class="cell-progress" data-label="Progress"><div class="progress-cell"><div class="progress ${progressTone(s.progress)}" role="progressbar" aria-label="${esc(s.name)} progress" aria-valuenow="${s.progress}" aria-valuemin="0" aria-valuemax="100"><span style="--value:${s.progress / 100}"></span></div>${s.progress}%</div></td>
            <td class="cell-action" data-label="Actions"><div class="menu-wrap"><button class="btn btn--icon-ghost" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(s.name)}" data-menu-btn>${icon('more')}</button></div></td>
          </tr>`;
        }).join('');
      }

      range.textContent = all.length ? `Showing ${start + 1}–${start + view.length} of ${all.length}` : 'No students';
      pager.innerHTML = `
        <button class="btn btn--icon" type="button" data-page="${state.page - 1}" aria-label="Previous page" ${state.page === 1 ? 'disabled' : ''}>${icon('chevron-left')}</button>
        ${Array.from({ length: pages }, (_, i) => `<button class="pager__page" type="button" data-page="${i + 1}" aria-label="Page ${i + 1}" ${i + 1 === state.page ? 'aria-current="page"' : ''}>${i + 1}</button>`).join('')}
        <button class="btn btn--icon" type="button" data-page="${state.page + 1}" aria-label="Next page" ${state.page === pages ? 'disabled' : ''}>${icon('chevron-right')}</button>`;

      const ids = view.map(s => s.id);
      const n = ids.filter(id => state.selected.has(id)).length;
      selectAll.checked = n > 0 && n === ids.length;
      selectAll.indeterminate = n > 0 && n < ids.length;
      selectAll.disabled = !ids.length;
      bulk.hidden = state.selected.size === 0;
      $('[data-bulk-count]', root).textContent = state.selected.size;
    }

    $$('th[data-sort-key] .sort-btn', root).forEach(b => b.addEventListener('click', () => {
      const key = b.closest('th').dataset.sortKey;
      if (state.key === key) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
      else { state.key = key; state.dir = key === 'name' ? 'asc' : 'desc'; }
      state.page = 1;
      render();
      announce(`Sorted by ${key}`);
    }));
    sortSelect.addEventListener('change', () => { [state.key, state.dir] = sortSelect.value.split(':'); state.page = 1; render(); });
    statusGroup.addEventListener('click', e => {
      const b = e.target.closest('[data-status]');
      if (!b) return;
      $$('[data-status]', statusGroup).forEach(x => x.setAttribute('aria-checked', String(x === b)));
      state.status = b.dataset.status;
      state.page = 1;
      render();
      announce(range.textContent);
    });
    radioKeys(statusGroup, '[data-status]');

    selectAll.addEventListener('change', () => {
      $$('tr[data-id]', body).forEach(tr => (selectAll.checked ? state.selected.add(tr.dataset.id) : state.selected.delete(tr.dataset.id)));
      render();
      selectAll.focus();
    });
    body.addEventListener('change', e => {
      const box = e.target.closest('input[type="checkbox"]');
      if (!box) return;
      const id = box.closest('tr').dataset.id;
      box.checked ? state.selected.add(id) : state.selected.delete(id);
      render();
      $(`tr[data-id="${id}"] input`, body)?.focus();
    });
    pager.addEventListener('click', e => {
      const b = e.target.closest('[data-page]');
      if (!b || b.disabled) return;
      state.page = Number(b.dataset.page);
      render();
      $(`[data-page="${state.page}"][aria-current]`, pager)?.focus();
    });
    $('[data-bulk-clear]', root).addEventListener('click', () => { state.selected.clear(); render(); selectAll.focus(); });
    $('[data-bulk-present]', root).addEventListener('click', () => {
      const n = state.selected.size;
      STUDENTS.forEach(s => { if (state.selected.has(s.id)) s.status = 'Present'; });
      state.selected.clear();
      render();
      toast(`${n} marked present`, 'Prototype: changes stay on this page.');
    });

    // Row action menu
    let openMenu = null;
    function closeMenu(focusBtn = false) {
      if (!openMenu) return;
      const btn = openMenu.previousElementSibling;
      btn.setAttribute('aria-expanded', 'false');
      openMenu.remove();
      openMenu = null;
      if (focusBtn) btn.focus();
    }
    body.addEventListener('click', e => {
      const btn = e.target.closest('[data-menu-btn]');
      if (btn) {
        const wasOpen = openMenu && openMenu.previousElementSibling === btn;
        closeMenu();
        if (wasOpen) return;
        const s = STUDENTS.find(x => x.id === btn.closest('tr').dataset.id);
        const menu = document.createElement('div');
        menu.className = 'menu';
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', `Actions for ${s.name}`);
        menu.innerHTML = `
          <button type="button" role="menuitem" data-act="view">${icon('eye', 'icon--sm')}View details</button>
          <button type="button" role="menuitem" data-act="present">${icon('check', 'icon--sm')}Mark present</button>
          <hr>
          <button type="button" role="menuitem" class="is-danger" data-act="delete">${icon('trash', 'icon--sm')}Delete student</button>`;
        btn.after(menu);
        if (btn.getBoundingClientRect().bottom + 180 > innerHeight) menu.classList.add('is-up');
        btn.setAttribute('aria-expanded', 'true');
        openMenu = menu;
        $('button', menu).focus();
        menu.addEventListener('keydown', ev => {
          const items = $$('[role="menuitem"]', menu);
          const i = items.indexOf(document.activeElement);
          if (ev.key === 'ArrowDown') { ev.preventDefault(); items[(i + 1) % items.length].focus(); }
          else if (ev.key === 'ArrowUp') { ev.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
          else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closeMenu(true); }
          else if (ev.key === 'Tab') closeMenu();
        });
        menu.addEventListener('click', ev => {
          const act = ev.target.closest('[data-act]')?.dataset.act;
          if (!act) return;
          closeMenu();
          if (act === 'view') openStudent(s, btn);
          if (act === 'present') { s.status = 'Present'; render(); toast(`${s.name} marked present`, 'Prototype: changes stay on this page.'); }
          if (act === 'delete') openConfirm(s, btn);
        });
      }
    });
    document.addEventListener('pointerdown', e => { if (openMenu && !e.target.closest('.menu-wrap')) closeMenu(); });

    render();
    tableApi = {
      remove(id) {
        const i = STUDENTS.findIndex(s => s.id === id);
        if (i >= 0) STUDENTS.splice(i, 1);
        state.selected.delete(id);
        render();
      },
      add(name, cls) {
        STUDENTS.push({ id: `s${nextId++}`, name, cls, status: 'Present', attendance: 100, progress: 0, guardian: 'Not added yet', note: 'New student. No observations yet.' });
        render();
      }
    };
  }

  /* --------------------------------------------------------- Tabs/filters */

  const LESSONS = [
    { title: 'Practical life: pouring water', cls: 'Montessori', status: 'Active', teacher: 'Ms. Lakshmi' },
    { title: 'Phonics: letter sounds s, a, t', cls: 'UKG', status: 'Active', teacher: 'Mr. Arjun' },
    { title: 'Number rods 1–10', cls: 'Montessori', status: 'Pending', teacher: 'Ms. Lakshmi' },
    { title: 'உயிர் எழுத்துகள் · Tamil vowels', cls: 'Tamil', status: 'Active', teacher: 'Ms. Kavitha' },
    { title: 'Shapes and colours walk', cls: 'Nursery', status: 'Archived', teacher: 'Ms. Priya' },
    { title: 'Story circle: The Lion and the Mouse', cls: 'LKG', status: 'Pending', teacher: 'Mr. Arjun' },
    { title: 'Sandpaper letters', cls: 'Montessori', status: 'Archived', teacher: 'Ms. Lakshmi' },
    { title: 'நிலா நிலா · Tamil rhymes', cls: 'Tamil', status: 'Pending', teacher: 'Ms. Kavitha' },
    { title: 'Counting beads to 20', cls: 'LKG', status: 'Active', teacher: 'Ms. Priya' },
    { title: 'Sensory bins: textures', cls: 'Nursery', status: 'Active', teacher: 'Ms. Priya' }
  ];
  const LESSON_BADGE = { Active: 'badge--success', Pending: 'badge--warning badge--late', Archived: '' };

  function initTabs() {
    const tablist = $('[data-tabs]');
    const tabs = $$('[role="tab"]', tablist);
    const indicator = $('[data-tab-indicator]');
    const chips = $$('[data-class]');
    const search = $('[data-lesson-search]');
    const list = $('[data-lesson-list]');
    const clear = $('[data-lesson-clear]');
    const state = { tab: 'all', classes: new Set(), q: '' };

    const base = () => LESSONS.filter(l => (!state.classes.size || state.classes.has(l.cls)) && (!state.q || `${l.title} ${l.teacher}`.toLowerCase().includes(state.q)));

    function moveIndicator() {
      const t = tabs.find(x => x.getAttribute('aria-selected') === 'true');
      indicator.style.transform = `translateX(${t.offsetLeft}px) scaleX(${t.offsetWidth})`;
    }

    function render() {
      const pool = base();
      tabs.forEach(t => {
        const key = t.dataset.tab;
        $('[data-tab-count]', t).textContent = key === 'all' ? pool.length : pool.filter(l => l.status === key).length;
      });
      const items = state.tab === 'all' ? pool : pool.filter(l => l.status === state.tab);
      $('[data-lesson-count]').textContent = items.length;
      clear.hidden = !state.classes.size && !state.q;
      list.innerHTML = items.length
        ? items.map((l, i) => `
          <li class="result" style="animation-delay:${i * 40}ms">
            <div class="result__main"><p class="result__title"${/[஀-௿]/.test(l.title) ? ' lang="ta" style="font-family:var(--font-tamil);line-height:1.6"' : ''}>${esc(l.title)}</p><div class="result__sub"><span class="tag${l.cls === 'Montessori' ? ' tag--primary' : ''}">${l.cls}</span><span class="card__meta">${esc(l.teacher)}</span></div></div>
            <span class="badge ${LESSON_BADGE[l.status]}">${l.status}</span>
          </li>`).join('')
        : `<li class="state-tile__body state-tile__center" style="padding:var(--space-8) 0"><span class="state-icon" aria-hidden="true">${icon('search')}</span><h3 class="card__title">No lesson plans match</h3><p class="card__meta">Try another class or a shorter search.</p></li>`;
      moveIndicator();
    }

    function select(tab, focus) {
      tabs.forEach(t => { const on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
      state.tab = tab.dataset.tab;
      if (focus) tab.focus();
      render();
    }
    tabs.forEach(t => t.addEventListener('click', () => select(t, false)));
    tablist.addEventListener('keydown', e => {
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault();
      select(tabs[(n + tabs.length) % tabs.length], true);
    });
    chips.forEach(c => c.addEventListener('click', () => {
      const on = c.getAttribute('aria-pressed') !== 'true';
      c.setAttribute('aria-pressed', String(on));
      on ? state.classes.add(c.dataset.class) : state.classes.delete(c.dataset.class);
      render();
    }));
    let deb;
    search.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(() => { state.q = search.value.trim().toLowerCase(); render(); }, 120); });
    clear.addEventListener('click', () => {
      state.classes.clear();
      state.q = '';
      search.value = '';
      chips.forEach(c => c.setAttribute('aria-pressed', 'false'));
      render();
      search.focus();
    });
    window.addEventListener('resize', moveIndicator);
    if (document.fonts) document.fonts.ready.then(moveIndicator);
    render();
  }

  /* -------------------------------------------------------------- Dialogs */

  function openDialog(dlg, opener) {
    dlg._opener = opener || document.activeElement;
    dlg.classList.remove('is-closing');
    dlg.showModal();
    ($('[autofocus]', dlg) || $('.drawer__body input', dlg) || $('[data-close]', dlg))?.focus();
  }
  function closeDialog(dlg) {
    if (!dlg || !dlg.open || dlg.classList.contains('is-closing')) return;
    dlg.classList.add('is-closing');
    const done = () => {
      dlg.classList.remove('is-closing');
      dlg.close();
      if (dlg._opener && document.contains(dlg._opener)) dlg._opener.focus();
    };
    reduceMotion.matches ? done() : setTimeout(done, 170);
  }

  const modal = $('#modal-confirm');
  let pendingDelete = null;
  function openConfirm(student, opener) {
    pendingDelete = student;
    $('[data-modal-initials]', modal).textContent = initials(student.name);
    $('[data-modal-name]', modal).textContent = student.name;
    $('[data-modal-class]', modal).textContent = student.cls;
    openDialog(modal, opener);
  }
  function openStudent(s, opener) {
    const d = $('#drawer-student');
    $('[data-d-initials]', d).textContent = initials(s.name);
    $('[data-d-initials]', d).className = `avatar avatar--lg ${tone(s)}`;
    $('[data-d-name]', d).textContent = s.name;
    $('[data-d-class]', d).textContent = s.cls;
    $('[data-d-status]', d).innerHTML = `<span class="badge ${STATUS_CLASS[s.status]}">${s.status}</span>`;
    $('[data-d-attendance]', d).textContent = `${s.attendance}%`;
    $('[data-d-progress]', d).textContent = `${s.progress}%`;
    $('[data-d-guardian]', d).textContent = s.guardian;
    $('[data-d-note]', d).textContent = s.note;
    openDialog(d, opener);
  }

  function initDialogs() {
    $$('dialog').forEach(dlg => {
      dlg.addEventListener('cancel', e => { e.preventDefault(); closeDialog(dlg); });
      dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-close]')) closeDialog(dlg); });
    });
    document.addEventListener('click', e => {
      if (document.body.classList.contains('is-inspecting')) return;
      const dr = e.target.closest('[data-drawer]');
      if (dr) openDialog($(`#${dr.dataset.drawer}`), dr);
      const m = e.target.closest('[data-modal-open]');
      if (m) openConfirm(STUDENTS.find(s => s.name === m.dataset.student) || STUDENTS[0], m);
      const v = e.target.closest('[data-view-student]');
      if (v) openStudent(STUDENTS.find(s => s.name === v.dataset.viewStudent) || STUDENTS[0], v);
    });
    $('[data-confirm-delete]', modal).addEventListener('click', async e => {
      const btn = e.currentTarget;
      await runLoading(btn, 'Deleting…', 700);
      closeDialog(modal);
      if (pendingDelete && STUDENTS.includes(pendingDelete)) {
        tableApi.remove(pendingDelete.id);
        toast(`${pendingDelete.name} deleted`, 'Prototype: reload the page to restore.');
      }
    });

    const form = $('[data-add-form]');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const name = form.elements.name;
      const hint = $('#add-name-hint');
      if (!name.value.trim()) {
        name.setAttribute('aria-invalid', 'true');
        hint.className = 'field__hint field__hint--error is-revealing';
        hint.innerHTML = `${icon('alert-circle')}Enter the student's full name`;
        name.focus();
        return;
      }
      tableApi.add(name.value.trim(), form.elements.class.value);
      toast(`${name.value.trim()} added`, 'Prototype: added to this page only.');
      form.reset();
      name.removeAttribute('aria-invalid');
      hint.className = 'field__hint';
      hint.textContent = 'As it appears on the birth certificate.';
      closeDialog(form.closest('dialog'));
    });
  }

  /* ---------------------------------------------------------------- States */

  function initStates() {
    const tile = $('[data-retry-tile]');
    const body = $('[data-retry-body]', tile);
    const original = body.innerHTML;
    tile.addEventListener('click', async e => {
      if (e.target.closest('[data-reset]')) { body.innerHTML = original; $('[data-retry]', tile).focus(); return; }
      const btn = e.target.closest('[data-retry]');
      if (!btn) return;
      await runLoading(btn, 'Retrying…', 1200);
      body.innerHTML = `<svg class="check-draw is-playing" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><path d="m20 33 8 8 16-17"/></svg><h3>Attendance loaded</h3><p>Back online. Everything is up to date.</p><button class="btn btn--ghost btn--sm" type="button" data-reset>Reset demo</button>`;
      $('[data-reset]', tile).focus();
      announce('Attendance loaded');
    });
    const check = $('[data-check-draw]');
    const play = () => { check.classList.remove('is-playing'); void check.getBoundingClientRect(); check.classList.add('is-playing'); };
    $('[data-replay-success]').addEventListener('click', play);
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { play(); io.disconnect(); } }), { threshold: 0.6 });
    io.observe(check);
  }

  /* --------------------------------------------------------- Responsive */

  function initViewport() {
    const name = $('[data-vp-name]');
    const width = $('[data-vp-width]');
    const cards = $$('[data-bp]');
    const update = () => {
      const w = innerWidth;
      const mode = w >= 1024 ? 'desktop' : w >= 768 ? 'tablet' : 'mobile';
      name.textContent = mode[0].toUpperCase() + mode.slice(1);
      width.textContent = `· ${w}px`;
      cards.forEach(c => c.classList.toggle('is-current', c.dataset.bp === mode));
    };
    update();
    let raf;
    addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { update(); measureType(); }); });
  }

  /* ----------------------------------------------------------- Playground */

  function initPlayground() {
    const root = $('[data-playground]');
    const stage = $('[data-pg-stage]', root);
    const btn = $('[data-pg-button]', root);
    const code = $('[data-pg-code]', root);
    const label = $('[data-pg-label]', root);
    const sheetWrap = $('#pg-sheet');
    const sheet = $('[data-pg-sheet]', root);
    const buildBtn = $('[data-pg-build]', root);
    const s = { variant: 'primary', size: 'md', theme: 'dark', state: 'default', radius: 'medium' };
    const cap = v => v[0].toUpperCase() + v.slice(1);

    function spec() {
      const bg = {
        primary: { default: C('primary'), hover: C('primary-hover'), active: C('primary-pressed'), loading: C('primary'), disabled: C('disabled-bg') },
        secondary: { default: C('surface-2'), hover: C('surface-3'), active: C('surface'), loading: C('surface-2'), disabled: C('disabled-bg') },
        tertiary: { default: 'transparent', hover: C('primary-light'), active: C('primary-light'), loading: 'transparent', disabled: 'transparent' }
      }[s.variant][s.state];
      const text = s.state === 'disabled' ? C('disabled-fg') : { primary: C('on-primary'), secondary: C('text'), tertiary: C('primary') }[s.variant];
      return {
        component: 'Button', variant: `${cap(s.variant)} · ${cap(s.state)}`,
        background: bg, text,
        border: s.variant === 'secondary' ? C('border-strong') : 'none',
        radius: { sharp: '--radius-sharp', medium: '--radius-md', round: '--radius-full' }[s.radius],
        shadow: s.variant === 'primary' ? (s.state === 'hover' ? '--shadow-accent' : s.state === 'default' ? '--shadow-sm' : 'none') : 'none',
        spacing: { sm: '--space-3 · 32px tall', md: '--space-4 · 40px tall', lg: '--space-6 · 48px tall' }[s.size],
        typography: { sm: '13px · 600', md: '--fs-button · 600', lg: '15px · 600' }[s.size],
        motion: `--duration-fast · --ease-standard · ${s.theme} theme`
      };
    }

    function render() {
      stage.dataset.themePreview = s.theme;
      const cls = ['btn', `btn--${s.variant}`, s.size === 'sm' ? 'btn--sm' : s.size === 'lg' ? 'btn--lg' : '', `r-${s.radius}`, s.state === 'hover' ? 'is-hover' : '', s.state === 'active' ? 'is-active' : '', s.state === 'loading' ? 'is-loading' : ''].filter(Boolean);
      btn.className = cls.join(' ');
      btn.disabled = s.state === 'disabled';
      btn.toggleAttribute('aria-busy', s.state === 'loading');
      btn.innerHTML = s.state === 'loading' ? '<span class="spinner" aria-hidden="true"></span>Loading…' : 'Mark attendance';
      label.textContent = `Button / ${cap(s.variant)}`;
      code.innerHTML = `&lt;button class="<b>${cls.filter(c => c.startsWith('btn') || c.startsWith('r-')).join(' ')}</b>"${s.state === 'disabled' ? ' disabled' : ''}&gt;Mark attendance&lt;/button&gt;`;
      if (!sheetWrap.hidden) sheet.innerHTML = sheetHtml(spec());
    }

    $$('[data-pg]', root).forEach(group => {
      group.addEventListener('click', e => {
        const b = e.target.closest('[data-value]');
        if (!b) return;
        $$('[data-value]', group).forEach(x => x.setAttribute('aria-checked', String(x === b)));
        s[group.dataset.pg] = b.dataset.value;
        render();
      });
      radioKeys(group, '[data-value]');
    });

    btn.addEventListener('click', () => { if (s.state === 'default') runLoading(btn, 'Loading…', 1200); });

    buildBtn.addEventListener('click', () => {
      const open = sheetWrap.hidden;
      sheetWrap.hidden = !open;
      buildBtn.setAttribute('aria-expanded', String(open));
      if (open) {
        const sp = spec();
        sheet.innerHTML = sheetHtml(sp);
        showSpec(sp);
      }
    });
    render();
  }

  /* --------------------------------------------------------------- Motion */

  function animate(el, frames, dur = '--duration-normal', { delay = 0, easing = '--ease-emphasized', fill = 'both' } = {}) {
    if (!el.animate) return null;
    if (reduceMotion.matches) {
      return el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, fill });
    }
    return el.animate(frames, { duration: ms(dur), delay, easing: token(easing) || 'ease-out', fill });
  }

  const MOTIONS = [
    { name: 'Fade in', time: '300ms', stage: '<span class="m-box"></span>', play: st => animate($('.m-box', st), [{ opacity: 0 }, { opacity: 1 }], '--duration-normal', { easing: '--ease-standard' }) },
    { name: 'Fade up', time: '300ms', stage: '<span class="m-box"></span>', play: st => animate($('.m-box', st), [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }]) },
    { name: 'Slide in', time: '300ms', stage: '<span class="m-box"></span>', play: st => animate($('.m-box', st), [{ transform: 'translateX(-90px)', opacity: 0 }, { transform: 'none', opacity: 1 }]) },
    { name: 'Scale in', time: '180ms', stage: '<span class="m-box"></span>', play: st => animate($('.m-box', st), [{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'none' }], '--duration-fast') },
    { name: 'Stagger', time: '300ms + 60ms', stage: '<span class="m-bars"><i></i><i></i><i></i><i></i></span>', play: st => $$('.m-bars i', st).forEach((b, i) => animate(b, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], '--duration-normal', { delay: i * 60 })) },
    { name: 'Modal enter', time: '300ms', stage: '<span class="m-scrim"></span><span class="m-dialog"></span>', play: st => { animate($('.m-scrim', st), [{ opacity: 0 }, { opacity: 1 }], '--duration-normal', { easing: '--ease-standard' }); animate($('.m-dialog', st), [{ opacity: 0, transform: 'scale(0.92)' }, { opacity: 1, transform: 'none' }]); } },
    { name: 'Drawer enter', time: '300ms', stage: '<span class="m-drawer"></span>', play: st => animate($('.m-drawer', st), [{ transform: 'translateX(100%)' }, { transform: 'none' }]) },
    { name: 'Toast', time: '300ms', stage: '<span class="m-toast"></span>', play: st => animate($('.m-toast', st), [{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'none' }]) },
    { name: 'Skeleton', time: '1.2s loop', stage: '<span class="m-sk"><span class="skeleton sk-line w-90"></span><span class="skeleton sk-line w-70"></span><span class="skeleton sk-line w-40"></span></span>', play: st => { const sk = $('.m-sk', st); sk.classList.remove('is-playing'); void sk.offsetWidth; sk.classList.add('is-playing'); } },
    { name: 'Progress', time: '600ms', stage: '<span class="m-progress"><span style="transform:scaleX(.72)"></span></span>', play: st => animate($('.m-progress span', st), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(0.72)' }], '--duration-slow') },
    { name: 'Number count', time: '600ms', stage: '<span class="m-count">128</span>', play: st => { const el = $('.m-count', st); el.dataset.count = '128'; countUp(el); } },
    { name: 'Tab indicator', time: '300ms', stage: '<span class="m-tabs"><span>All</span><span>Active</span><span>Done</span><i></i></span>', play: st => animate($('.m-tabs i', st), [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)', offset: 0.45 }, { transform: 'translateX(200%)' }], '--duration-slow') },
    { name: 'Accordion', time: '300ms', stage: '<span class="m-acc"><span class="m-acc__head"><span>Term 1</span><span>+</span></span><span class="m-acc__body"><span><i></i><i></i></span></span></span>', play: st => $('.m-acc', st).classList.toggle('is-open') }
  ];

  function initMotion() {
    const grid = $('[data-motion-grid]');
    grid.innerHTML = MOTIONS.map((m, i) => `
      <button class="motion-tile" type="button" data-motion="${i}" aria-label="Play ${m.name} animation">
        <span class="motion-tile__stage" aria-hidden="true">${m.stage}</span>
        <span class="motion-tile__meta"><span class="motion-tile__name">${m.name}</span><span class="motion-tile__play">${icon('play', 'icon--sm')}Play</span></span>
        <span class="motion-tile__time">${m.time}</span>
      </button>`).join('');
    // The accordion demo needs a block-level wrapper inside its body.
    $$('.m-acc__body > span', grid).forEach(s => { s.style.display = 'block'; s.style.overflow = 'hidden'; });
    grid.addEventListener('click', e => {
      const t = e.target.closest('[data-motion]');
      if (!t || document.body.classList.contains('is-inspecting')) return;
      MOTIONS[t.dataset.motion].play($('.motion-tile__stage', t));
    });
    $('[data-play-all]').addEventListener('click', () => {
      $$('[data-motion]', grid).forEach((t, i) => setTimeout(() => MOTIONS[i].play($('.motion-tile__stage', t)), reduceMotion.matches ? 0 : i * 90));
    });
  }

  /* ------------------------------------------------------------------ Boot */

  initLoad();
  initAmbient();
  initNav();
  initInspector();
  initSwatches();
  initType();
  initButtons();
  initForms();
  initTable();
  initTabs();
  initDialogs();
  initStates();
  initViewport();
  initPlayground();
  initMotion();
})();
