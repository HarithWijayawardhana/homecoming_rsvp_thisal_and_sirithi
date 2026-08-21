# CLAUDE.md — project context

Read this before changing anything. It exists so a fresh session can pick the
project up without re-deriving how it works.

## What this is

A one-page RSVP site for the homecoming reception of **Thisal & Sirithi**,
26 September 2026, 7.00 p.m. onwards, The Lumina Ballroom, Cinnamon Life at
City of Dreams. The page's single job is to get a guest to respond.

Plain HTML, CSS and JS. **No framework and no build step.** The page has exactly
one front-end dependency, GSAP, which drives the curtain reveal and nothing else.
It is **vendored** at `assets/js/gsap.min.js` and loaded with a plain script tag:
no CDN, no npm entry, no bundler. Do not add a second front-end dependency, and
do not reach for a build step to manage this one. There is also a `package.json`,
but it exists only for the serverless functions in `api/`, and it holds exactly
one entry — `@neondatabase/serverless`. Do not add a second there either.

The page still opens straight from disk with Live Server or `npx serve`; the
lookup and the RSVP just need `vercel dev` instead, because they talk to `api/`.

```
index.html               markup + all copy
css/styles.css           design tokens at :root, then sections in order
css/curtain.css          the splash curtain: fabric, swag, cords, title card
js/curtain.js            ES module — the splash curtain, self-contained
js/main.js               the hero reveal, petals, countdown, RSVP flow
js/guests.js             the guest list, one entry per envelope — local only,
                         never deployed (see .vercelignore)
assets/img/painting.webp the artwork with the lamps erased
assets/img/lantern-0N.webp  the four lamps as transparent sprites
assets/js/gsap.min.js    GSAP 3.13.0, vendored — the only front-end dependency
api/lookup.js            GET  /api/lookup?q=  — finds a party
api/rsvp.js              POST /api/rsvp       — stores a response
api/responses.js         GET  /api/responses?key= — CSV export
api/_db.js  api/_guests.js   helpers; the _ keeps Vercel from routing them
scripts/schema.mjs       creates the tables
scripts/seed-guests.mjs  pushes js/guests.js into the database
scripts/check.mjs        prints what is in the database
vercel.json              cache headers; framework null, no build step
.vercelignore            what must not reach the internet
server/apps-script.gs    the old Google Sheets backend, unused, kept as a fallback
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

The curtain has its own palette in `css/curtain.css` (`--cur-*`): a deeper
blush for the velvet, against the same gold, plus `--cur-lining` for the pale
reverse the cloth turns back on at its inner edge. It is deliberately not
theatre red — it has to look like it belongs to the painting behind it. Its
title card uses the page's own faces: Jost for the eyebrow and the date,
Italiana for the monogram.

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

`js/main.js` is one IIFE. `RSVP_ENDPOINT` and `LOOKUP_ENDPOINT` are top-level
vars above it — empty means responses are only logged and the guest list is
read from `js/guests.js` in the browser.

- `reduce` — every animation branch checks `prefers-reduced-motion`. Any new
  motion must respect it too.
- Reveals use one IntersectionObserver over `.reveal:not([data-g])`; stagger via
  `data-d="1..5"`. `data-g` means "the reveal timeline owns this element" — it is
  set by `claim()` on the hero copy and the lookup form, which GSAP staggers
  instead, and `.reveal[data-g]{transition:none}` keeps the CSS transition from
  dragging behind the tween. Only elements GSAP drives may carry it.
- **The curtain lives in `js/curtain.js` and nothing else knows how it works.**
  It is an ES module exporting `initCurtain({mount, onReveal, onComplete})`, it
  injects all its own markup, and it speaks to the page through two events:
  `curtain:reveal` (the arch is open — `js/main.js` brings the hero up on this)
  and `curtain:complete` (the splash is gone and out of the document). Keep
  that seam. Anything that reaches into `.curtain__*` from outside the module
  is a bug.
- **It is a splash screen: it leaves.** The overlay is removed from the DOM at
  the end and the page owes it no clearance — no side inset, no padding under
  a pelmet. Do not reintroduce `--cur-frame`/`--cur-arch` insets in
  `css/styles.css`; the invitation is meant to be unframed once the curtain
  has gone.
- **The guest opens it.** The timeline holds at the `hold` label with the
  title card up and `.curtain__enter` ("Open the invitation") focused, and
  nothing past Act 1 plays until that button is pressed. The gate is a guarded
  callback (`if(!opened) tl.pause()`), *not* GSAP's `addPause`: a real pause
  point re-arms itself under the tween `runOut()` uses to drive `progress`, and
  Escape during the title card freezes the sequence a third of a second in.
- Five acts on one GSAP timeline with labels (`title` / `hold` / `cue` /
  `draw` / `reveal` / `exit` / `end`), 4.53s, scaled to 3.3s under 700px —
  which is the same ~2.2s of motion after the gate as before it existed; the
  part that got longer is the card, and its length is the guest's now. Four nested
  elements carry four jobs: `.curtain__panel` translates and rotates,
  `.curtain__gather` does the `scaleX` from the panel's outer edge,
  `.curtain__sheet` carries the overhang, `.curtain__cloth` is cut by the
  arch. Only the tassels are allowed a springy ease — heavy cloth does not
  bounce.
- The draw's ease is `power2.out`, not an `inOut`. An `inOut` over a second and
  a half spends its first third almost motionless, which reads as the sequence
  having stalled rather than as weight. Act 2 supplies the effort; from the
  moment the cloth lets go it should be moving.
- **The cut is not a tween.** One proxy value (`cut.t`) drives it, and
  `drawCut()` rebuilds the inner edge every frame and writes it to two places:
  the cloth's `clip-path` and the gold braid's path `d`. Same numbers, so the
  trim cannot drift off the cloth — which is exactly what went wrong when the
  swag was a clipped div plus a stroked overlay. Keep them on one source.
- The rows of the edge open on a stagger (`LAG`), head first and hem last.
  Cloth is heavy and is being pulled from the top; opening every row in
  lockstep is the one thing that makes a drawn curtain look like a sliding
  door.
- **It is a tied-back curtain, and the silhouette is the whole point.** The
  cloth is fullest at the head, is pulled in to a waist where the cord grips
  it, and falls away again below into a flare. That pinch is what reads as
  "tied back" rather than "slid aside". It comes from the `EDGE` vertex table,
  which stores an explicit `x open` per row rather than a distance travelled,
  because the edge reverses direction at the waist. `SPLINE` densifies that
  table through Catmull-Rom so the edge is not visibly faceted; `EDGE` stays
  the only place the shape is written down.
- The waist row of `EDGE` is load-bearing beyond its own shape: it is what
  `.curtain__tie`'s `top` is set from. Move one without the other and the cord
  floats off the pinch it is supposed to explain.
- `CLOSED` is 96.6, not 100. The clip is expressed in percent of the bleed box,
  which runs past the panel — a closed edge at 100 puts the seam at 52% of the
  viewport, visibly off-centre under a centred monogram.
- The tie hangs inside `.curtain__gather` and outside `.curtain__sheet`.
  Inside, because the gather is what pulls the cloth in at the waist and a cord
  that does not come in with it ends up hanging in the opening with its tassels
  over the page. Outside the sheet, because that is the thing being clipped.
- The swag is a festoon — one SVG in `swagSVG()`, fill and hem and folds
  together, for the same reason the braid shares the cut's numbers.
- `TRAVEL.narrow.rot` is small for a reason. The panel turns about its top
  outer corner, so the tilt narrows the drape by sin(rot) × *height* as it
  descends, and height is what does not shrink on a phone. Retune it against
  the drape at the **waist and hem**, not the head.
- The timeline is built paused and Act 1 starts on `document.fonts.ready`
  (capped at 1.2s); the rest starts on the button. The title card is the only
  thing that earns a guest's attention, and Italiana arrives over the network —
  animate the monogram early and it plays in a fallback serif or, during the
  block period, in nothing at all.
- `hold` sits at 1.5s because that is where Act 1 finishes. Move it earlier and
  the gate freezes a half-drawn card for as long as the guest takes to press.
- The button lives *inside* `.curtain__title` so Act 2's fade and blur carry it
  off with the card, and it is the one child that takes pointer events back.
  Under 700px the card stops being centred on its own box and is pinned at
  38% — otherwise every pixel the button is pushed down to clear the tiebacks
  lifts the monogram by half of one, and the two never separate.
- Focus moves to the button as the card lands. Script-moved focus does not
  match `:focus-visible`, so the ring is painted from `data-cued` instead,
  suppressed on `pointer: coarse` and dropped on the first pointer event.
- `#curtain-root[data-cover]` paints velvet from the stylesheet on the first
  frame, so the invitation never flashes past before the module has parsed.
  The module drops the attribute as soon as the panels are in the document —
  not at the end, or the arch opens onto the cover instead of the page — and
  `js/main.js`'s safety net drops it too.
- It runs once per page session (`window.__homecoming.revealed`, never
  localStorage) and is skipped outright on a back/forward restore. A repeat run
  and a browser without GSAP are both dismissed on the spot — no gate, nothing
  to press; reduced motion gets the title card, the same button, and a
  cross-fade when it is pressed, with no travel and no parting. All three still
  fire both events.
- `js/main.js` holds the hero back at load and has a 4.5s safety net that also
  strips the cover: a module that fails to load fails silently, and nothing
  about the page may depend on the decoration in front of it. It tests
  `window.__homecoming.curtainArmed`, which `js/curtain.js` sets the moment its
  markup is in the document — with a gate in the sequence the hero may
  legitimately stay hidden for minutes, and the net must be able to tell "still
  waiting to be opened" from "never arrived".
- Checking this in headless Chrome: old `--headless` composites a stale frame,
  so a screenshot can show a curtain that the DOM says is half open. Use
  `--headless=new`, and drive it over CDP if you want a specific pose —
  `gsap.globalTimeline.getChildren(false,false,true)` finds the timeline
  without touching the page, and `Emulation.setDeviceMetricsOverride` gives a
  real 360px viewport where `--window-size` is clamped by macOS.
- Petals are a canvas: 22 particles, 12 on narrow screens. `new Petal(true)`
  is the upward burst used on a successful yes.
- Countdown target: `new Date('2026-09-26T19:00:00+05:30')` — Sri Lanka time.
- `sendResponse()` posts as `text/plain`. That was to dodge a CORS preflight
  Apps Script could not answer; it is same-origin now so it no longer has to,
  but `api/rsvp.js` reads the raw body either way. Left alone deliberately —
  changing it buys nothing and risks the one path that matters.
- RSVP is two steps: `#lookupview` (name on the envelope) then `#partyshell`
  (one Attending/Unable pair per person). `lookupParty()` is the only seam
  between the flow and the guest list — swap the source there, nothing else
  changes. `norm()` now exists in **three** places — `js/main.js`,
  `api/_guests.js` and `apps-script.gs` — and all three must stay identical or
  the browser and the server disagree about who a guest is.
- Names from the list are written with `textContent`, never `innerHTML`.
- **No localStorage or sessionStorage anywhere.** Keep it that way.

## The backend — Vercel and Neon Postgres

Deployed as Vercel project `homecoming-rsvp-thisal-and-sirithi` in team
`harytw456-2764s-projects`, live at
<https://homecoming-rsvp-thisal-and-sirithi.vercel.app>. The GitHub repo is
connected, so a push to `main` deploys on its own.

There is no framework and no build. Vercel serves the repo root as static files
and turns each `api/*.js` into a function. `vercel.json` only sets cache headers.

Three endpoints, all matching the contract the Sheets backend used, which is why
wiring them up cost `js/main.js` two variables and nothing else:

| route | does |
| --- | --- |
| `GET /api/lookup?q=` | `{parties:[{id,party,people}]}`. Aliases match but are never returned. |
| `POST /api/rsvp` | validates, then one row in `responses` plus one per person in `response_people`. |
| `GET /api/responses?key=` | CSV of everything, newest first. `ADMIN_KEY`. Never link to it. |

`/api/rsvp` trusts nothing the browser says about itself: the party is fetched
by id, the submitted names must match that party's people exactly, and `seats`
and `invited` are recounted server-side. One invitation is capped at 20
submissions. Every submission is kept — a party that answers twice keeps both,
and the export marks the older one `superseded` rather than hiding it.

Env vars, all set in production, preview and development:
`DATABASE_URL` (injected by the Neon marketplace integration) and `ADMIN_KEY`
(the export password — ask me for it, it is not in the repo).

Working on the database:

```
vercel env pull .env.local   # after any env change
npm run db:schema            # create tables; safe to re-run
npm run db:seed              # push js/guests.js into the database
npm run db:check             # what is in there now
vercel dev                   # the page with api/ working, on :3000
```

**The guest list is not deployed.** `js/guests.js` is still the one place it is
written by hand, but `.vercelignore` keeps it off the internet and `index.html`
no longer loads it — so edit the file, run `npm run db:seed`, and the lookup
follows. If you ever put that script tag back you must also drop the line from
`.vercelignore`, or the lookup breaks.

Note that preview and production share one Neon database. Test writes show up in
the real responses; clear them when you are done.

## Quality floor

Responsive to 360px, visible keyboard focus, semantic labels on every input,
reduced motion honoured, no layout shift on load. Check these on any change.

## Still to do

1. ~~Set `RSVP_ENDPOINT`~~ — done. Points at `/api/rsvp`, and a real submission
   was confirmed landing in Postgres and coming back out of the CSV export.
2. Replace the placeholder guest list in `js/guests.js` with the real one, then
   run `npm run db:seed`. **Until this is done the site will not find any real
   guest.** This is the last thing standing between here and sending it out.
3. Replace placeholder copy: the attire panel and the Google Maps link
   (needs the exact pin). Respond-by is 31 August 2026.
4. Add Open Graph and Twitter tags so the link unfurls with the artwork on
   WhatsApp — this is how most guests will receive it.
5. Self-host the three fonts in `assets/fonts/` to drop the external request.
6. Decide on a favicon.
7. Point a real domain at the Vercel project — the `.vercel.app` URL works, but
   a short custom domain reads better in a WhatsApp message.

## How I want you to work

Make the change, keep the diff tight, and tell me what you changed in a
sentence or two. Ask before restructuring files, adding a dependency, or
altering the lantern coordinates. If a change would affect the artwork itself,
say so first — the sprites and the erased painting have to stay in sync.
