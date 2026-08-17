# CLAUDE.md — project context

Read this before changing anything. It exists so a fresh session can pick the
project up without re-deriving how it works.

## What this is

A one-page RSVP site for the homecoming reception of **Thisal & Sirithi**,
26 September 2026, 7.00 p.m. onwards, The Lumina Ballroom, Cinnamon Life at
City of Dreams. The page's single job is to get a guest to respond.

Plain HTML, CSS and JS. **No framework, no build step, no dependencies, no
package.json.** Do not introduce any of these unless I explicitly ask. Serve it
with Live Server or `npx serve` and it runs.

```
index.html               markup + all copy
css/styles.css           design tokens at :root, then sections in order
js/main.js               ignition, petals, countdown, RSVP submit
assets/img/painting.webp the artwork with the lamps erased
assets/img/lantern-0N.webp  the four lamps as transparent sprites
server/apps-script.gs    optional Google Sheets backend
tools/extract_lanterns.py  regenerates the art if the illustration changes
```

## Design system — do not drift from this

Palette (defined in `:root`, use the variables, never raw hex in rules):

```
--blush   #FCE3DE   page ground; deliberately identical to the painting's
                    background so the artwork dissolves into the page
--gold    #BE8838   hairlines, ampersands, focus accents
--crimson #8E2230   taken from the lehenga; used sparingly — the seal and
                    selected states only
--ink     #432A28   body text
```

Type: **Italiana** for display (names, section headings, numerals),
**Marcellus** for serif body, **Jost** for uppercase tracked labels.
Loaded from Google Fonts in `index.html`.

Structural motif is the ogee arch from the painting — the three detail panels
are inline SVG arches, not cards. Keep using that language rather than adding
boxes, drop shadows or rounded cards.

Rules of thumb: hairline rules over borders, blush space over dividers, one
accent colour, no gradients except the gold button sweep.

## How the lanterns work — read before touching them

The lamps were painted into the illustration, so they could not move. Each one
was cut out along with the lower part of its chain, and the background behind it
was reconstructed. That reconstruction is `painting.webp`. The four sprites are
laid back on top at the exact spot they came from.

**Consequence: if you move a `.lantern`'s `left`/`top`, you expose the hole it
came from.** Position values are load-bearing.

Structure:

```
.artwrap                aspect-ratio 1024/1536, sets the coordinate space
  └ .artmask            radial mask fading the artwork's edges into the page
      ├ img             painting.webp
      └ .lantern ×4     absolutely positioned, pivots at its chain anchor
          ├ img         the sprite
          ├ .cone       light beam (upper two lamps only)
          └ .glow       flame halo + core, mix-blend-mode: screen
```

Per-lamp CSS variables on each `.lantern`:

| var | meaning |
| --- | --- |
| `--sw` | swing angle either side of centre |
| `--t`  | seconds for one full swing |
| `--dl` | negative delay, keeps the four out of step |
| `--gd` | offset for the flame flicker |

Current values: `5.6deg/2.15s`, `5deg/2.45s`, `4.2deg/2.9s`, `3.4deg/3.35s`.
Shorter chain swings faster and further — that relationship is what makes the
group read as physical. Preserve it if you retune.

`transform-origin` is the pivot, expressed as a percentage across the sprite.
`.glow` and `.cone` sit inside the lamp so the light travels with it. All
positions are percentages of the artwork, so alignment holds at any width.

**The client asked for no additional lights.** Only these four animate. Don't
add decorative lamps, sparkles, or bokeh.

## JavaScript notes

`js/main.js` is one IIFE. `RSVP_ENDPOINT` is a top-level var above it —
empty means responses are only logged.

- `reduce` — every animation branch checks `prefers-reduced-motion`. Any new
  motion must respect it too.
- Reveals use one IntersectionObserver over `.reveal`; stagger via `data-d="1..5"`.
- Petals are a canvas: 22 particles, 12 on narrow screens. `new Petal(true)`
  is the upward burst used on a successful yes.
- Countdown target: `new Date('2026-09-26T19:00:00+05:30')` — Sri Lanka time.
- `sendResponse()` posts as `text/plain` on purpose; Google Apps Script cannot
  answer a CORS preflight.
- **No localStorage or sessionStorage anywhere.** Keep it that way.

## Quality floor

Responsive to 360px, visible keyboard focus, semantic labels on every input,
reduced motion honoured, no layout shift on load. Check these on any change.

## Still to do

1. Set `RSVP_ENDPOINT` and confirm a real submission lands in the sheet.
2. Replace placeholder copy: the attire panel, the respond-by date
   (5 September 2026), and the Google Maps link (needs the exact pin).
3. Add Open Graph and Twitter tags so the link unfurls with the artwork on
   WhatsApp — this is how most guests will receive it.
4. Self-host the three fonts in `assets/fonts/` to drop the external request.
5. Decide on a favicon.

## How I want you to work

Make the change, keep the diff tight, and tell me what you changed in a
sentence or two. Ask before restructuring files, adding a dependency, or
altering the lantern coordinates. If a change would affect the artwork itself,
say so first — the sprites and the erased painting have to stay in sync.
