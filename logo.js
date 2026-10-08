/* Montessori logo: two abstract figures reaching toward a star. Inline SVG so tokens colour it
   and the star can animate. Fills any element with [data-logo="mark"] or [data-logo="lockup"]. */
(() => {
  'use strict';

  const MARK = `
    <svg class="logo-mark" viewBox="0 0 48 48" focusable="false" aria-hidden="true">
      <circle class="lm-halo" cx="25" cy="8" r="6.6"/>
      <g class="lm-star-wrap"><path class="lm-star" d="M25 3.2l1.45 2.95 3.25.47-2.35 2.29.55 3.24L25 10.62l-2.9 1.53.55-3.24-2.35-2.29 3.25-.47z"/></g>
      <path class="lm-ground" d="M7 44.5h34"/>
      <circle class="lm-a" cx="14.5" cy="19" r="4.2"/>
      <path class="lm-a" d="M8.5 44.5c0-11.2 2.2-17.4 6-17.4s6 6.2 6 17.4z"/>
      <path class="lm-a-arm" d="M18.2 28.8 22.4 15.4"/>
      <circle class="lm-b" cx="34" cy="25.4" r="3.5"/>
      <path class="lm-b" d="M29 44.5c0-8.6 1.8-13.4 5-13.4s5 4.8 5 13.4z"/>
      <path class="lm-b-arm" d="M31.4 33.4 28.2 20.2"/>
    </svg>`;

  function lockup(el) {
    const tag = el.dataset.tagline !== 'false';
    el.classList.add('lockup');
    el.innerHTML = `${MARK}<span class="lockup__text"><span class="lockup__word">Montessori</span>${tag ? '<span class="lockup__tag">Learning with wonder</span>' : ''}</span>`;
  }

  function render(root = document) {
    root.querySelectorAll('[data-logo="mark"]').forEach(el => { el.innerHTML = MARK; });
    root.querySelectorAll('[data-logo="lockup"]').forEach(lockup);
  }

  window.MontessoriLogo = { MARK, render };
  render();
})();
