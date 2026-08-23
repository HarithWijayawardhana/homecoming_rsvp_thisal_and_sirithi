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
assets/img/couple.webp   the wedding portrait, edge feathered into its alpha
assets/img/bench.webp    the other five story watercolours, same treatment.
assets/img/first-date.webp   file names say what is *in* each picture, not
assets/img/graduation.webp   which chapter shows it: chapters 1-4 are bench,
assets/img/proposal.webp     first-date, graduation, proposal, then chapter 5
assets/img/homecoming.webp   ("Husband and wife") is homecoming.webp and
                         chapter 6 ("The homecoming") is couple.webp. bench and
                         graduation are landscape (.tl__art--wide), the rest
                         portrait
assets/img/orn-arch.webp    the five floral ornaments, keyed off one sheet:
assets/img/orn-garland.webp   arch, garland, bloom, spray, corner band
assets/img/orn-bloom.webp
assets/img/orn-spray.webp
assets/img/orn-foot.webp
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
tools/feather_portrait.mjs bakes the soft edge into all six story images
tools/extract_ornaments.mjs keys the five ornaments off their sheet
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
Loaded from Google Fonts in `index.html`. The one numeral Italiana does *not*
set is the countdown — see below; every other figure on the page is still its.

The curtain has its own palette in `css/curtain.css` (`--cur-*`): a deeper
blush for the velvet, against the same gold, plus `--cur-lining` for the pale
reverse the cloth turns back on at its inner edge. It is deliberately not
theatre red — it has to look like it belongs to the painting behind it. Its
title card uses the page's own faces: Jost for the eyebrow and the date,
Italiana for the names — the names in full, not initials: a splash screen a
guest has to decode is a splash screen that has failed. They set on one line
above 700px and stack `Thisal / & / Sirithi` below it, where sixteen letters
of Italiana on one line would be 26px type carrying the whole card.

Structural motif is the ogee arch from the painting, as inline SVG — never as
a card. Keep using that language rather than adding boxes, drop shadows or
rounded cards.

**The ogee cannot frame a block of text.** It is used two ways and only two:
as a small ornament at its own aspect (`.tl__plate` in a story chapter,
`orn-arch.webp` above the invitation, and `.crest` before it — see below),
and clipped as a shape. It is *not* wrapped
around copy. `preserveAspectRatio="none"` ties the crown's height to the
block's height, so the taller the copy the deeper the spike, and on a narrow
screen the shoulders cut straight through the first two lines. This was tried
and reverted; do not try it again.

**Three grounds, and the page's rhythm depends on all three.** `--blush` is
the page, `--porcelain` is a raised panel (`.bleed.ground--pale`), and
`--velvet`/`--velvet-2` is the one dark band (`.bleed.ground--velvet`), used
exactly once, for the countdown. The velvet is borrowed from the curtain's
palette so the dark moment reads as the same world the splash came from. Four
sections all on one ground with one `--sp` rhythm is what made the page read as
blocks stacked up rather than as a sequence — the alternation is the fix and
should not be flattened back out.

Section order is hero, invitation (pale), story, countdown (velvet), **RSVP
(pale), then the place** — the ask comes before the directions, and `#place`
closes the page. Two rules in `css/styles.css` name that adjacency by hand,
because a sibling selector cannot be written any other way:
`#rsvp:has(#partyshell[hidden]) + #place` tightens the gap under step one, and
`#place:has(+ footer)` drops its bottom padding so its rhythm and the footer's
do not stack into a void — they share a ground, so there is no seam to explain
330px of blush. Move a section and both need looking at.

`.bleed` breaks out of `.wrap` with `margin-inline:calc(50% - 50vw)` and pays
it back as `padding-inline`. It stays *inside* `.wrap` on purpose: `#petals` is
at `z-index:3` and `.wrap` at `4`, and moving the bands out would put their
backgrounds behind the petal canvas.

**The five painted ornaments are a rhythm, not a texture.** They were keyed
off one sheet of watercolour florals and each is used *exactly once*, at a
seam: `orn-arch` opens the invitation, `orn-garland` opens the story,
`orn-bloom` closes it, `orn-spray` opens the RSVP, `orn-foot` closes the page.
The rule is one per section — a second one in the same section is what turns a
motif into a floral sampler — and each replaced something plainer rather than
being added on top of it: the arch took over from the drawn `.crest`, and the
bloom and the corner band from the two centred `.rule`s. `.orn` gives them
`max-width` and nothing else; the soft edge is in each file's alpha, the way
the story photographs and the lantern sprites carry theirs, and the intrinsic
`width`/`height` are on the tags because all five sit directly above copy.

Getting them off their sheet was most of the work, and
`tools/extract_ornaments.mjs` has the long version in its header: the haze they
were painted on runs from black to near-white, so no brightness test finds it,
and the key is the distance from the one colour curve the haze traces through
RGB, plus an edge term for the pale petals the colour term cannot tell from
the glow behind them. Re-run it only against the original sheet in
`new_image/`; the crops and the thresholds were tuned by eye.

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
  viewport, visibly off-centre under a centred title.
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
  animate the names early and they play in a fallback serif or, during the
  block period, in nothing at all.
- `hold` sits at 1.5s because that is where Act 1 finishes. Move it earlier and
  the gate freezes a half-drawn card for as long as the guest takes to press.
- The button lives *inside* `.curtain__title` so Act 2's fade and blur carry it
  off with the card, and it is the one child that takes pointer events back.
  Under 700px the card stops being centred on its own box and is pinned at
  33% — otherwise every pixel the button is pushed down to clear the tiebacks
  lifts the names by half of one, and the two never separate. 33% rather than
  the 38% the initials sat at, because the stacked names are three lines where
  `T & S` was one.
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
- **"Our story" is a scroll-drawn timeline, and it is still pure CSS.** Six
  chapters (`.tl__ch`) hang off a gold thread that draws itself as the guest
  descends, each with a node that lights as the tip reaches it. Nothing in
  `js/main.js` knows this section exists and it must stay that way: the thread
  and the nodes run on CSS `view()` timelines and the chapters ride the page's
  own `.reveal` observer. The portrait is `loading="lazy"` inside an
  `aspect-ratio` box, so it costs nothing at load and shifts nothing when it
  arrives.

  **The fallback is the primary design, not a consolation.** `animation-timeline`
  is Chrome 115+, Safari 26+, Firefox 157+ — about 85% globally, and the 15%
  without it is mostly iPhones still on iOS 18, which for this guest list is
  more like one in six. So every plain rule is written as the *finished* state
  and only the `@supports (animation-timeline: view())` block starts from the
  unfinished one: thread at `scaleY(1)`, every node gold. A browser with no
  support gets a complete static timeline. **Never write an animation whose
  keyframes end at the finished state without that guard** — a browser that
  does not know `animation-timeline` runs it on the document timeline and plays
  the whole draw once, instantly, on load.

  **The thread is a scaled element, not an SVG path.** A path whose geometry
  has to match a container sized by however long the copy happens to be is out
  of register the moment anyone edits a sentence. `scaleY` has no coordinates
  to keep in sync, composites on the GPU, and is right at any height. Its
  gradient caps are `--tl-cap` **lengths, not percentages**: `scaleY` squashes
  the painted gradient rather than revealing more of a long line, so a 5% cap
  is 5% of the *drawn* length at every moment and the feather grows as you
  scroll.

  **`--tl-lead` is the one invariant.** It governs both the thread's range and
  every node's ignition, so the tip and the node it is reaching cannot drift
  apart. The arithmetic matters, because the obvious ranges are both wrong:
  - The thread is *taller* than the viewport, so `entry`/`exit` resolve to
    viewport-sized distances rather than to anything proportional to the
    section. `cover 0%`→`contain 100%` is the one named pair whose span is
    exactly the subject's height, which is what pins the tip: with span = S,
    `tip = (V - d) + p*S = V - lead`, a constant. Hence
    `cover var(--tl-lead) contain calc(100% + var(--tl-lead))`. If that
    `calc` past 100% is ever rejected the whole declaration drops *silently*
    and you inherit `cover 0%`→`cover 100%`; check the computed value, not the
    rendering. (It parses in Chrome today — verified.)
  - The node is 11px, so it is a *small* subject and `entry` resolves to
    `[0, 11px]`. `entry 88%` fired 9.7px in — the instant the node cleared the
    bottom of the screen, a full viewport early. `cover var(--tl-lead)` is
    correct because a small subject's screen position is `V - d`, which crosses
    the tip's line at `d = lead`.

  `animation-timeline` and `animation-range` are **reset-only sub-properties of
  the `animation` shorthand**: the shorthand wipes both. They must come after
  it, always.

  Three traps in the layout, all of which have already bitten once:
  - **`.tl__copy` and `.tl__art` both need an explicit `grid-row`.** Sparse
    auto-placement never moves the cursor backwards, so on an even chapter the
    copy is placed at row 1 column 3 first and the art — asking for column 1 —
    drops to row 2. Desktop pins both to `grid-row:1`; the ≤760px block must
    then put the art on `grid-row:2`, or the single column stacks copy and
    picture in the same cell.
  - **`:nth-of-type(even)` drives the zig-zag, and `.tl__thread` is a `<span>`
    for exactly that reason.** Add any `<div>` as a direct child of `.tl` and
    the whole alternation inverts.
  - **`.reveal` must never go on `.tl`.** The shared observer's `threshold:.16`
    is unreachable for an element taller than about 6.25 viewports, so the
    section would sit at `opacity:0` forever with no error anywhere. The
    chapters are the reveal units.

  The pre-reveal offsets on mobile slide **inward** (`translateX(-12px)`). A
  single column already fills the width to within its own padding, so a
  positive offset pushes an unrevealed chapter past the viewport and the page
  scrolls sideways by a few pixels until the observer fires — invisible on a
  desktop, and a real defect at 360px.

  All six chapters carry a watercolour now, so no plate is in the markup. The
  `.tl__plate` rules stay in the stylesheet regardless: they are the documented
  treatment for a chapter with no picture — a small ogee plate carrying a gold
  lozenge, deliberately ornament-sized, because a plate scaled up to fill the
  column reads as a hole waiting for an image. It does **not** repeat the year
  — `.tl__year` is already showing it two columns away at up to 58px, and the
  echo read as a mistake rather than a motif. A photo simply replaces the
  plate, and `aria-hidden` comes off the slot when it does: a plate is
  ornament, a picture is content and carries real `alt`.

  Two of the six are landscape, and `.tl__art--wide` gives them 360px against
  the portraits' 320. In the plain 300px slot a landscape draws 300×200 against
  a portrait's 300×465 — under half the visual mass, and the zig-zag limps. It
  is desktop-only by construction: the `max-width:760px` block sets `.tl__art`
  to `min(100%,300px)` at equal specificity but later in the file, so on one
  column every picture fills the column. Nothing to keep in sync.

  The last chapter's node is `--crimson`, not gold: it is the story's seal, and
  it ties the end of the timeline to the seal in the RSVP.
- **Every story picture's soft edge lives in its alpha channel, not in CSS.**
  The wash they were painted on is close to `--blush` but, unlike
  `painting.webp`, not the
  same, so an unfaded rectangle reads as a photograph pasted onto the
  invitation. Feathering all four sides in CSS needs two mask layers
  intersected, and `mask-composite` is the one corner of masking the engines
  still disagree about — some spellings blank the element outright in Chrome,
  and a mask on the `<img>` inside a masked wrapper blanks it too. So the file
  carries its own alpha, the way the lantern sprites do.
  `tools/feather_portrait.mjs` regenerates them from the originals
  (`npm i --no-save sharp` first — it is not a project dependency, and the
  originals are not in the repo; `.gitignore` keeps `new_image/` local). Note
  that sharp drops the alpha silently if you join the channel onto a reused
  pipeline — the tool asserts `hasAlpha` on the way out for that reason.

  Its header comment holds **the exact command for each of the six**; keep them
  there, because the crops and fades were tuned by eye and are not re-derivable.
  Two positional args (`SRC`, `OUT`) plus `--width` / `--fade` / `--crop`, whose
  defaults are the wedding portrait's — so the bare two-argument call still
  reproduces `couple.webp` byte for byte, which is worth re-checking if you
  touch the tool. The other five are `--width=640`: the slot is at most 360px,
  so 640 is the 2× and 960 would be bytes nothing can show. `--crop` exists for
  the proposal alone: it is the one source painted on a warm beige wash rather
  than blush, and its composition runs to all four edges — foreground table,
  plates, balloons on the floor — so feathered whole the fade cuts a vignette
  straight through the tablecloth. Cropped to the figures, the cake and the
  banner, the fade lands on flat wall wash. That beige also means it sits a
  shade warmer than the other five on the page; that is the artwork, not the
  code, and tinting it would be a change to the art.
- It is deliberately **not** clipped into an ogee arch: that path is down to a
  quarter of its width by a fifth of its height, which cuts straight through
  both heads.
- Petals are a canvas: 22 particles, 12 on narrow screens. `new Petal(true)`
  is the upward burst used on a successful yes.
- Countdown target: `new Date('2026-09-26T19:00:00+05:30')` — Sri Lanka time.
  It lives in the velvet band now, and a changed digit rises into place rather
  than snapping (`.roll`, dropped under reduced motion). **The clip is on the
  `.mask` wrapper, not on `.n`** — an element cannot clip its own content while
  it is the thing being translated — and the *font-size* has to be on the mask
  too: `height:1.06em` resolves against the element's own font-size, so a mask
  at the inherited 16px clipped a 60px numeral to a sliver. `#count` must stay
  an ancestor of `.n[data-c]` and the keys stay exactly `d`/`h`/`m`/`s`.
  **These numerals are Marcellus, not Italiana** — the display face's 4 closes
  up and its 7 trails a swash, and this is the one set of figures on the page
  that has to be read rather than admired. The `min-width:1.7em` on the mask
  goes with it: none of the three faces has tabular figures, so the Days cell
  was resizing from 71px to 40px as its digits changed and shoving its
  neighbours sideways once a second. It is an em so it holds at every step of
  the clamp, and it is a floor, not a width — a third digit still grows past
  it.
- **The nav rail costs the page no scroll listener.** Its progress hairline is
  `animation-timeline: scroll(root)`; it appears on `body.ready` (which
  `revealHero()` already set and which had no rule until now) plus an `.is-past`
  class from one IntersectionObserver on the hero. The active link is a single
  winner chosen by nearest-to-mid-viewport, not by "is intersecting" — a band
  narrow enough to be useful can still hold two sections at a boundary, and two
  underlined links read as a bug.
- **In-page anchors scroll and then strip the hash.** `if(location.hash)
  revealHero()` means any hash in the URL skips the curtain outright, so a guest
  who clicked "Our story" and then forwarded the link would be handing on a page
  with no curtain. The `href`s stay real for the keyboard and for no-JS; a
  document-level click handler calls `scrollIntoView` and then
  `history.replaceState`.
- `sendResponse()` posts as `text/plain`. That was to dodge a CORS preflight
  Apps Script could not answer; it is same-origin now so it no longer has to,
  but `api/rsvp.js` reads the raw body either way. Left alone deliberately —
  changing it buys nothing and risks the one path that matters.
- The hero carries no buttons and the page has no "the evening" section: the
  running order was invented copy standing in for times nobody had confirmed,
  and the two hero CTAs were a second way of saying what the nav rail and the
  scroll cue already say. The lookup's submit button is `btn--solid` now, so
  the gold sweep is the page's one call to action; `btn--ink` is gone with it.
  The date and the room have left it too: `.factline` and `.venue` live in
  `#invitation` now, said once, in the document that exists to say them, and
  the hero is the painting, the names and the scroll cue. Two consequences.
  `.factline` was built as a wrapping row for the hero's left-aligned column,
  so `.invite .factline` has to stack it — in a centred column an unstacked
  row puts the date and the hour shoulder to shoulder on one baseline and the
  lockup stops reading as one. And moving anything out of `.hero` shrinks the
  set `js/main.js` staggers, so the `data-d` on what is left has to be
  renumbered to stay contiguous: that ladder is the path reduced motion and a
  missing GSAP both take.
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
3. Replace placeholder copy. Respond-by is 31 August 2026.
   ~~The map~~ — done, and it is now a **Google iframe**, not a drawn plate.
   It is the page's one third-party request; everything else, GSAP included,
   is vendored. The trade was deliberate: a guest wants to pan, zoom and get
   directions, and a static image cannot do any of that. Consequences worth
   knowing:
   - It paints in Google's palette and there is no honest way to tint it.
     The gold hairline around the plate is the only thing tying it to the
     page. Do not try to filter or blend it into the blush.
   - `.map__plate` is a fixed `aspect-ratio:3/2` box and `.map` is
     `width:100%`. Both are load-bearing: an iframe has no intrinsic size, so
     without the box the section shifts when the map arrives, and without the
     width it collapses to the iframe's 300px default inside
     `.column`'s `align-items:center`.
   - "Open in Maps" moved into the caption. Over an interactive frame it
     would either swallow the guest's drag or need `pointer-events:none`,
     which would stop it being a link.
   - The static plan is still `assets/img/map.svg` and `tools/build_map.mjs`
     still draws it, if the frame ever has to come back out.
   ~~Photographs for the story chapters~~ — done. All six chapters carry a
   feathered watercolour now.
4. ~~Add Open Graph and Twitter tags~~ — done. They point at `painting.webp`
   on the `.vercel.app` origin; update the absolute URLs if a custom domain
   lands (item 7).
5. Self-host the three fonts in `assets/fonts/` to drop the external request.
6. Decide on a favicon.
7. Point a real domain at the Vercel project — the `.vercel.app` URL works, but
   a short custom domain reads better in a WhatsApp message.

## How I want you to work

Make the change, keep the diff tight, and tell me what you changed in a
sentence or two. Ask before restructuring files, adding a dependency, or
altering the lantern coordinates. If a change would affect the artwork itself,
say so first — the sprites and the erased painting have to stay in sync.
