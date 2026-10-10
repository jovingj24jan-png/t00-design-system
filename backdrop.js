/* Shared page background: midnight navy, aurora light and flowing light-trail ribbons.
   Pages may include the .backdrop markup; if they don't, it is created here. */
(() => {
  'use strict';

  /* ------------------------------------------------- Liquid-metal wave */

  // Ribbon edges in a 1600×900 box: gentle dip → deep central curve → rise → twist toward the right.
  const WAVE_TOP = [[-200, 250], [150, 235], [320, 330], [600, 450], [830, 560], [990, 580], [1160, 420], [1300, 300], [1480, 300], [1800, 262]];
  const WAVE_BOT = [[-200, 300], [150, 300], [340, 450], [640, 640], [860, 780], [1040, 740], [1190, 540], [1330, 340], [1480, 232], [1800, 282]];

  function initWave() {
    const NS = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs, parent) => {
      const n = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
      if (parent) parent.appendChild(n);
      return n;
    };
    const f = n => Math.round(n * 10) / 10;
    const pt = p => `${f(p[0])} ${f(p[1])}`;
    const curve = P => `M${pt(P[0])} C${pt(P[1])} ${pt(P[2])} ${pt(P[3])} C${pt(P[4])} ${pt(P[5])} ${pt(P[6])} C${pt(P[7])} ${pt(P[8])} ${pt(P[9])}`;
    const body = (A, B) => `${curve(A)} L${pt(B[9])} C${pt(B[8])} ${pt(B[7])} ${pt(B[6])} C${pt(B[5])} ${pt(B[4])} ${pt(B[3])} C${pt(B[2])} ${pt(B[1])} ${pt(B[0])} Z`;
    const mix = (A, B, t) => A.map((p, i) => [p[0] + (B[i][0] - p[0]) * t, p[1] + (B[i][1] - p[1]) * t]);
    const gradient = (defs, id, attrs, stops) => {
      const g = el('linearGradient', { id, ...attrs }, defs);
      stops.forEach(([offset, tone, alpha]) => el('stop', { offset, class: `ws-${tone}`, 'stop-opacity': alpha }, g));
    };

    // tone 'pink' swaps the bright highlights for the pink trail colour.
    function ribbon(svg, id, A, B, { strands, fill = 0.55, strength = 1, shadow = false, tMax = 1, tone = 'white' }) {
      const defs = el('defs', {}, svg);
      gradient(defs, `${id}-body`, { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, tone, 0.42], [0.14, 'silver', 0.34], [0.38, 'gray', 0.26], [0.72, 'dark', 0.55], [1, 'black', 0.85]]);
      gradient(defs, `${id}-strand`, { gradientUnits: 'userSpaceOnUse', x1: -200, y1: 0, x2: 1800, y2: 0 }, [[0, 'silver', 0.35], [0.28, tone, 1], [0.46, 'gray', 0.75], [0.6, tone, 1], [0.8, 'silver', 0.65], [1, 'gray', 0.4]]);
      gradient(defs, `${id}-fade`, { gradientUnits: 'userSpaceOnUse', x1: -200, y1: 0, x2: 1800, y2: 0 }, [[0, 'mask', 0], [0.16, 'mask', 1], [0.84, 'mask', 1], [1, 'mask', 0]]);
      const mask = el('mask', { id: `${id}-mask`, maskUnits: 'userSpaceOnUse', x: -400, y: -400, width: 2600, height: 1800 }, defs);
      el('rect', { x: -400, y: -400, width: 2600, height: 1800, fill: `url(#${id}-fade)` }, mask);
      const g = el('g', { mask: `url(#${id}-mask)` }, svg);

      if (shadow) {
        const blur = el('filter', { id: `${id}-blur`, x: '-20%', y: '-40%', width: '140%', height: '180%' }, defs);
        el('feGaussianBlur', { stdDeviation: 24 }, blur);
        el('path', { d: body(A, B), class: 'wave__shadow', filter: `url(#${id}-blur)`, transform: 'translate(0 38)', opacity: 0.9 }, g);
      }
      if (fill > 0) el('path', { d: body(A, B), fill: `url(#${id}-body)`, opacity: fill }, g);

      for (let i = 0; i < strands; i++) {
        const t = (i / (strands - 1)) * tMax;
        const edge = Math.exp(-(((t - 0.07) / 0.08) ** 2));
        const crest = 0.55 * Math.exp(-(((t - 0.42) / 0.15) ** 2));
        const alpha = Math.min(1, (0.1 + edge + crest) * (1 - 0.6 * t)) * strength;
        el('path', { d: curve(mix(A, B, t)), class: 'wave__strand', stroke: `url(#${id}-strand)`, 'stroke-width': f(0.6 + edge * 0.8), opacity: alpha.toFixed(3) }, g);
      }
    }

    ensureMarkup();
    const back = document.querySelector('[data-wave="back"]');
    const front = document.querySelector('[data-wave="front"]');
    const sheen = document.querySelector('[data-wave="sheen"]');
    if (!back || !front || !sheen) return;

    // Two quieter ribbons behind: one higher and flatter, one lower and fainter.
    ribbon(back, 'wb1', WAVE_TOP.map(([x, y]) => [x + 80, y * 0.7 - 40]), WAVE_BOT.map(([x, y]) => [x + 80, y * 0.66 - 10]), { strands: 34, fill: 0.45, strength: 0.8 });
    ribbon(back, 'wb2', WAVE_TOP.map(([x, y]) => [x - 60, y * 0.85 + 250]), WAVE_BOT.map(([x, y]) => [x - 60, y * 0.8 + 300]), { strands: 22, fill: 0.3, strength: 0.5, tone: 'pink' });
    ribbon(front, 'wf', WAVE_TOP, WAVE_BOT, { strands: 60, fill: 0.55, shadow: true });
    ribbon(sheen, 'wsh', WAVE_TOP, WAVE_BOT, { strands: 26, fill: 0, strength: 1, tMax: 0.5 });
  }

  function ensureMarkup() {
    let host = document.querySelector('[data-backdrop]');
    if (!host) {
      host = document.createElement('div');
      host.className = 'backdrop';
      host.setAttribute('aria-hidden', 'true');
      host.dataset.backdrop = '';
      host.innerHTML = ['back', 'front', 'sheen'].map(k => `<svg class="wave wave--${k}" data-wave="${k}" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" focusable="false"></svg>`).join('');
      document.body.prepend(host);
    }
    let aurora = host.querySelector('.backdrop__aurora');
    if (!aurora) {
      aurora = document.createElement('div');
      aurora.className = 'backdrop__aurora';
      host.prepend(aurora);
    }
    // Layered parallax (ScrollTransform in motion.js): far layers drift less than near ones.
    const speeds = { aurora: '-0.04', back: '-0.08', front: '-0.14', sheen: '-0.14' };
    aurora.dataset.scrollSpeed = speeds.aurora;
    host.querySelectorAll('[data-wave]').forEach(svg => { svg.dataset.scrollSpeed = speeds[svg.dataset.wave]; });
  }

  initWave();
})();
