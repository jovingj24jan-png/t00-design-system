/* Nexora motion primitives. Load last on every page; markup opts in with data attributes,
   so pages never wire their own observers.

   FadeUp / FadeIn / SlideIn / BlurReveal  data-motion="fade-up | fade-in | slide-in | slide-in-end | blur"
   CharacterReveal                         data-motion="chars" (English) — other languages reveal by word
   StaggerGroup                            data-stagger on a parent: its [data-motion] children (or, with
                                           data-stagger="fade-up", every direct child) enter in sequence
   NumberFlow                              data-number-flow="<key>": the first number in the element counts
                                           from its last shown value (0 the first time) when revealed
   ScrollTransform                         data-scroll-speed="0.15": parallax drift while the page scrolls
   PricingAccordion                        <details data-accordion>: height animates open and closed
   VerticalMarquee                         data-marquee on a list: loops upward, pauses on hover/focus

   Elements inserted more than SETTLE_MS after load (re-renders, live updates) appear at once,
   so live data never replays its entrance. prefers-reduced-motion turns all of it off. */
(() => {
  'use strict';

  const SETTLE_MS = 1600;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const startedAt = performance.now();
  const lastValues = new Map();
  root.classList.add('motion');

  const settled = () => performance.now() - startedAt > SETTLE_MS;
  const show = el => el.classList.add('is-in');

  /* ------------------------------------------------- CharacterReveal */

  function split(el) {
    if (el.dataset.motionSplit) return;
    el.dataset.motionSplit = '1';
    const lang = (el.closest('[lang]')?.getAttribute('lang') || 'en').slice(0, 2);
    // Characters only for Latin script: Tamil clusters and joined Arabic letters must stay whole.
    const byChar = lang === 'en';
    const seg = byChar && 'Segmenter' in Intl ? new Intl.Segmenter(lang, { granularity: 'grapheme' }) : null;
    const reader = document.createElement('span');
    reader.className = 'sr-only';
    reader.textContent = el.textContent.replace(/\s+/g, ' ').trim();
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    visual.append(...el.childNodes);
    let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE) { walk(child); return; }
        if (child.nodeType !== Node.TEXT_NODE || !child.textContent.trim()) return;
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const word = document.createElement('span');
          word.className = 'mo-word';
          const pieces = byChar ? (seg ? [...seg.segment(part)].map(s => s.segment) : [...part]) : [part];
          pieces.forEach(p => {
            const s = document.createElement('span');
            s.className = 'mo-char';
            s.style.setProperty('--c', i++);
            s.textContent = p;
            word.append(s);
          });
          frag.append(word);
        });
        child.replaceWith(frag);
      });
    };
    walk(visual);
    el.append(reader, visual);
  }

  /* ------------------------------------------------- NumberFlow */

  function numberFlow(el, { animate = true } = {}) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => /\d/.test(n.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP });
    const node = walker.nextNode();
    if (!node) return;
    const match = node.textContent.match(/-?\d[\d,]*(\.\d+)?/);
    if (!match) return;
    const key = el.dataset.numberFlow || '';
    const to = parseFloat(match[0].replace(/,/g, ''));
    const from = lastValues.has(key) ? lastValues.get(key) : 0;
    lastValues.set(key, to);
    if (!animate || reduced.matches || from === to) return;
    const decimals = (match[1] || '').length ? match[1].length - 1 : 0;
    const grouped = match[0].includes(',');
    const fmt = n => grouped ? n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : n.toFixed(decimals);
    const before = node.textContent.slice(0, match.index);
    const after = node.textContent.slice(match.index + match[0].length);
    const duration = 900;
    const t0 = performance.now();
    el.classList.add('is-counting');
    const tick = now => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      node.textContent = before + fmt(from + (to - from) * eased) + after;
      if (p < 1) requestAnimationFrame(tick);
      else { node.textContent = before + match[0] + after; el.classList.remove('is-counting'); }
    };
    requestAnimationFrame(tick);
  }

  /* ------------------------------------------------- Reveal observer */

  const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      reveal(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) : null;

  function reveal(el) {
    if (el.matches('[data-number-flow]')) numberFlow(el);
    show(el);
  }

  function prepare(el) {
    if (el.dataset.motionReady) return;
    el.dataset.motionReady = '1';
    if (el.dataset.motion === 'chars') split(el);
    if (reduced.matches || settled() || !io) {
      // A live update flows from the old value; a first render just shows the number.
      if (el.matches('[data-number-flow]')) numberFlow(el, { animate: settled() && !!io });
      show(el);
      return;
    }
    io.observe(el);
  }

  function stagger(group) {
    const step = Number(group.dataset.staggerStep) || 70;
    const auto = group.dataset.stagger;
    const kids = auto && auto !== 'true' ? [...group.children] : [...group.querySelectorAll(':scope > [data-motion], :scope > * > [data-motion]')];
    kids.forEach((kid, i) => {
      if (auto && auto !== 'true' && !kid.dataset.motion) kid.dataset.motion = auto;
      if (!kid.style.getPropertyValue('--motion-delay')) kid.style.setProperty('--motion-delay', `${Math.min(i, 10) * step}ms`);
    });
  }

  /* ------------------------------------------------- Site choreography
     Shared page structures opt in here, so every page that uses them moves the same way.
     [selector, primitive, ms between siblings that match in the same render] */

  const CHOREOGRAPHY = [
    ['.nf__title, .denied__title, .pr-hero__title, .pp-head__title, .nc-head__title, .auth__title', 'chars'],
    ['.dash-head__date, .dash-head__chips', 'fade-in'],
    ['.dash-head__greet', 'blur', 0, 80],
    ['.dash-head__tagline', 'fade-up', 0, 200],
    ['.auth__brand', 'slide-in'],
    ['.auth__wrap, .wz-steps', 'fade-up', 0, 160],
    ['.auth__art', 'blur', 0, 260],
    ['.nf__code', 'blur'],
    ['.nf__text, .nf__actions, .nf__options, .nf__search', 'fade-up', 70, 120],
    ['.panel.record, .panel.denied, .pp-head, .nc-head', 'fade-up'],
    ['.pp-card, .pr-feature, .pr-plan', 'fade-up', 80, 120]
  ];
  const FLOWS = '.kpi__value';

  function choreograph(scope) {
    CHOREOGRAPHY.forEach(([selector, primitive, step = 0, base = 0]) => {
      const found = [...(scope.matches?.(selector) ? [scope] : []), ...scope.querySelectorAll(selector)];
      found.forEach((el, i) => {
        if (el.dataset.motion) return;
        el.dataset.motion = primitive;
        const delay = base + Math.min(i, 8) * step;
        if (delay) el.style.setProperty('--motion-delay', `${delay}ms`);
      });
    });
    [...(scope.matches?.(FLOWS) ? [scope] : []), ...scope.querySelectorAll(FLOWS)].forEach(el => {
      if (el.dataset.numberFlow === undefined) el.dataset.numberFlow = el.closest('[data-widget]')?.dataset.widget || el.textContent;
    });
  }

  function scan(scope = document) {
    choreograph(scope);
    if (scope.matches?.('[data-stagger]')) stagger(scope);
    scope.querySelectorAll('[data-stagger]').forEach(stagger);
    if (scope.matches?.('[data-motion], [data-number-flow]')) prepare(scope);
    scope.querySelectorAll('[data-motion], [data-number-flow]').forEach(prepare);
    scope.querySelectorAll('[data-scroll-speed]').forEach(el => parallax.add(el));
    scope.querySelectorAll('details[data-accordion]').forEach(accordion);
    scope.querySelectorAll('[data-marquee]').forEach(marquee);
  }

  /* ------------------------------------------------- ScrollTransform */

  const parallax = new Set();
  let ticking = false;
  function drift() {
    ticking = false;
    const y = window.scrollY;
    parallax.forEach(el => {
      if (!el.isConnected) { parallax.delete(el); return; }
      el.style.translate = reduced.matches ? '' : `0 ${(y * Number(el.dataset.scrollSpeed || 0)).toFixed(1)}px`;
    });
  }
  window.addEventListener('scroll', () => { if (!ticking && parallax.size) { ticking = true; requestAnimationFrame(drift); } }, { passive: true });

  /* ------------------------------------------------- PricingAccordion */

  function accordion(details) {
    if (details.dataset.motionReady) return;
    details.dataset.motionReady = '1';
    const summary = details.querySelector('summary');
    const body = summary?.nextElementSibling;
    if (!summary || !body) return;
    let anim = null;
    summary.addEventListener('click', e => {
      if (reduced.matches || !body.animate) return;
      e.preventDefault();
      anim?.cancel();
      const opening = !details.open;
      details.classList.toggle('is-closing', !opening);
      if (opening) details.open = true;
      const full = body.scrollHeight;
      anim = body.animate(
        opening ? [{ height: '0px', opacity: 0 }, { height: `${full}px`, opacity: 1 }] : [{ height: `${full}px`, opacity: 1 }, { height: '0px', opacity: 0 }],
        { duration: 240, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
      );
      body.style.overflow = 'hidden';
      anim.onfinish = () => { if (!opening) details.open = false; body.style.overflow = ''; details.classList.remove('is-closing'); anim = null; };
    });
  }

  /* ------------------------------------------------- VerticalMarquee */

  function marquee(list) {
    if (list.dataset.motionReady) return;
    list.dataset.motionReady = '1';
    // The copy keeps the loop seamless; screen readers hear the list once.
    const copy = list.cloneNode(true);
    copy.removeAttribute('data-marquee');
    copy.setAttribute('aria-hidden', 'true');
    copy.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    const track = document.createElement('div');
    track.className = 'marquee__track';
    list.replaceWith(track);
    track.append(list, copy);
    track.style.setProperty('--marquee-duration', `${Math.max(18, list.children.length * 4)}s`);
  }

  /* ------------------------------------------------- Boot */

  function boot() {
    scan();
    drift();
    new MutationObserver(records => {
      records.forEach(r => r.addedNodes.forEach(n => { if (n.nodeType === Node.ELEMENT_NODE) scan(n); }));
    }).observe(document.body, { childList: true, subtree: true });
  }

  window.NexoraMotion = Object.freeze({ scan, numberFlow, split, get reduced() { return reduced.matches; } });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
