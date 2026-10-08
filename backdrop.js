/* Constellation background — "learning connections". One lightweight canvas engine used by the
   page backdrop, hero, playground preview and footer. Colours come from CSS custom properties on
   each canvas (--cn-node, --cn-line, --cn-glow, --cn-accent), which point at design tokens. */
(() => {
  'use strict';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)');

  // Per-placement tuning: node density, line/node strength, glow and parallax.
  const PRESETS = {
    page: { density: 1, lineAlpha: 0.16, nodeAlpha: 0.32, glow: true, parallax: 14, link: 150 },
    hero: { density: 0.9, lineAlpha: 0.28, nodeAlpha: 0.75, glow: true, parallax: 22, link: 140 },
    footer: { density: 0.55, lineAlpha: 0.2, nodeAlpha: 0.55, glow: true, parallax: 10, link: 130 },
    preview: { density: 0.45, lineAlpha: 0.14, nodeAlpha: 0.35, glow: false, parallax: 8, link: 110 }
  };

  function toRgb(value) {
    const v = value.trim();
    if (v.startsWith('#')) {
      const h = v.length === 4 ? v.slice(1).split('').map(c => c + c).join('') : v.slice(1, 7);
      return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    }
    const m = v.match(/(\d+(\.\d+)?)/g);
    return m ? m.slice(0, 3).map(Number) : [7, 94, 91];
  }
  const rgba = (rgb, a) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;

  function mount(canvas, preset) {
    const o = { ...PRESETS.page, ...(PRESETS[preset] || {}) };
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let w = 0, h = 0, nodes = [], raf = 0, visible = true, t0 = performance.now();
    const pointer = { x: 0.5, y: 0.5, sx: 0.5, sy: 0.5 };
    let colors;

    function readColors() {
      const cs = getComputedStyle(canvas);
      colors = {
        node: toRgb(cs.getPropertyValue('--cn-node')),
        line: toRgb(cs.getPropertyValue('--cn-line')),
        glow: toRgb(cs.getPropertyValue('--cn-glow')),
        accent: toRgb(cs.getPropertyValue('--cn-accent'))
      };
    }

    function build() {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, rect.width); h = Math.max(1, rect.height);
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const vw = innerWidth;
      const base = vw >= 1024 ? 52 : vw >= 768 ? 32 : 20;
      const areaFactor = Math.min(1, (w * h) / (vw * innerHeight));
      const count = Math.max(10, Math.round(base * o.density * (0.55 + 0.45 * areaFactor)));
      // Small clusters read as "groups of ideas"; the rest drift freely.
      const clusters = Array.from({ length: 4 }, () => ({ x: Math.random() * w, y: Math.random() * h }));
      nodes = Array.from({ length: count }, (_, i) => {
        const c = clusters[i % clusters.length];
        const inCluster = Math.random() < 0.55;
        const z = 0.35 + Math.random() * 0.65;
        return {
          x: inCluster ? c.x + (Math.random() - 0.5) * w * 0.22 : Math.random() * w,
          y: inCluster ? c.y + (Math.random() - 0.5) * h * 0.3 : Math.random() * h,
          vx: (Math.random() - 0.5) * 0.12 * z, vy: (Math.random() - 0.5) * 0.12 * z,
          z, r: 0.7 + z * 1.3,
          kind: Math.random() < 0.12 ? 'glow' : Math.random() < 0.06 ? 'accent' : 'node',
          phase: Math.random() * Math.PI * 2
        };
      });
    }

    function draw(now, still) {
      const cheap = coarse.matches || innerWidth < 768;
      ctx.clearRect(0, 0, w, h);
      pointer.sx += (pointer.x - pointer.sx) * 0.05;
      pointer.sy += (pointer.y - pointer.sy) * 0.05;
      const par = cheap || still ? 0 : o.parallax;
      const pts = nodes.map(n => {
        if (!still) {
          n.x += n.vx; n.y += n.vy;
          if (n.x < -30) n.x = w + 30; else if (n.x > w + 30) n.x = -30;
          if (n.y < -30) n.y = h + 30; else if (n.y > h + 30) n.y = -30;
        }
        return { n, x: n.x + (pointer.sx - 0.5) * par * n.z, y: n.y + (pointer.sy - 0.5) * par * n.z };
      });
      const link = Math.min(o.link, Math.max(w, h) * 0.22);
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > link) continue;
          const a = Math.pow(1 - d / link, 1.6) * o.lineAlpha * Math.min(pts[i].n.z, pts[j].n.z);
          ctx.strokeStyle = rgba(colors.line, a);
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
        }
      }
      const time = (now - t0) / 1000;
      for (const p of pts) {
        const { n } = p;
        if (n.kind !== 'node' && o.glow && !cheap) {
          const pulse = still ? 0.7 : 0.55 + 0.45 * Math.sin(time * 0.9 + n.phase);
          const col = n.kind === 'accent' ? colors.accent : colors.glow;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, n.r * 7);
          g.addColorStop(0, rgba(col, 0.32 * pulse * o.nodeAlpha * 1.4));
          g.addColorStop(1, rgba(col, 0));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, n.r * 7, 0, Math.PI * 2); ctx.fill();
        }
        const col = n.kind === 'glow' ? colors.glow : n.kind === 'accent' ? colors.accent : colors.node;
        ctx.fillStyle = rgba(col, o.nodeAlpha * (0.45 + 0.55 * n.z));
        ctx.beginPath(); ctx.arc(p.x, p.y, n.kind === 'node' ? n.r : n.r + 0.6, 0, Math.PI * 2); ctx.fill();
      }
    }

    let frame = 0;
    function loop(now) {
      // Re-read colours about once a second so theme switches (e.g. the playground) recolour it.
      if (++frame % 60 === 0) readColors();
      draw(now, false);
      raf = requestAnimationFrame(loop);
    }
    function start() {
      cancelAnimationFrame(raf);
      if (reduce.matches) { draw(performance.now(), true); return; }
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    }

    readColors();
    build();
    start();

    new ResizeObserver(() => { build(); if (reduce.matches || !visible) draw(performance.now(), true); }).observe(canvas);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); else cancelAnimationFrame(raf); }).observe(canvas);
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else start(); });
    reduce.addEventListener('change', start);
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      pointer.x = e.clientX / innerWidth; pointer.y = e.clientY / innerHeight;
    }, { passive: true });
  }

  // Older pages still carry the previous wave SVGs in .backdrop — swap them for a canvas.
  document.querySelectorAll('.backdrop').forEach(b => {
    if (!b.querySelector('canvas[data-constellation]')) b.innerHTML = '<canvas data-constellation="page"></canvas>';
  });
  document.querySelectorAll('canvas[data-constellation]').forEach(c => mount(c, c.dataset.constellation));

  window.MontessoriConstellation = { mount };
})();
