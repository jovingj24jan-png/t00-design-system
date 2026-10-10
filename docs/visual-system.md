# Visual system — midnight theme and motion primitives

Status: **prototype**. Everything is CSS, SVG and vanilla JavaScript. No animation library,
no CDN, works offline.

## Files

| File | Role |
| --- | --- |
| `styles.css` (`:root`) | Every colour, glow, shadow and duration token. Pages never contain hex values |
| `backdrop.js` | Shared background: aurora layer + light-trail ribbons. Creates the `.backdrop` markup on pages that don't include it (sign-in, recovery, setup) |
| `motion.js` | Motion primitives and the site choreography map. Load it last on every page |
| `design-system.html` | Master reference: swatches (incl. light-trail tokens) and a playable tile for each primitive |

## Colour roles

| Token | Role |
| --- | --- |
| `--color-bg`, `--color-bg-raised`, `--color-surface(-2,-3)` | Midnight navy into indigo |
| `--color-surface-glass`, `--color-surface-glass-strong`, `--color-glass` | Translucent panels over the backdrop (with `backdrop-filter`) |
| `--color-primary` (= T00 yellow) | Every primary action, focus ring, active nav marker |
| `--color-electric`, `--color-violet`, `--color-pink` | Light only: trails, glows, marquee rails. Never a button |
| `--color-wave-*`, `--color-glow-*` | Backdrop ribbon gradients and aurora |

The former light form surfaces (sign-in, password recovery, setup wizard, plan cards) now use
the shared dark tokens. `--color-light-*` remains only for the design-system playground's
"paper" preview.

## Motion primitives (`motion.js`)

| Primitive | Markup |
| --- | --- |
| FadeUp / FadeIn / SlideIn / BlurReveal | `data-motion="fade-up \| fade-in \| slide-in \| slide-in-end \| blur \| scale"` |
| CharacterReveal | `data-motion="chars"`. English splits by grapheme; Tamil and Arabic by word so clusters and joined letters stay intact. Screen readers get one `.sr-only` copy |
| StaggerGroup | `data-stagger` on a parent (its `[data-motion]` children), or `data-stagger="fade-up"` to animate every direct child. `data-stagger-step` sets the gap (ms) |
| NumberFlow | `data-number-flow="<key>"`: the first number counts from its last shown value for that key |
| ScrollTransform | `data-scroll-speed="-0.1"`: parallax via the CSS `translate` property (composes with existing transforms) |
| PricingAccordion | `<details data-accordion>`: height animates; without JS it's a normal `<details>` |
| VerticalMarquee | `data-marquee` on a list inside `.marquee`; loops, pauses on hover/focus |

Shared page structures (headings, the auth split panels, 404 parts, plan cards, KPI values)
opt in through the `CHOREOGRAPHY` list in `motion.js`, so templates don't carry motion attributes.

Rules:

- Hidden states only apply under `html.motion`, set by `motion.js`. Without JS nothing is hidden.
- Elements inserted more than 1.6s after load (re-renders, live store updates) appear at once,
  so live data never replays its entrance; NumberFlow still flows between old and new values.
- `prefers-reduced-motion: reduce` shows everything immediately and stops the aurora, ribbons
  and marquee.
