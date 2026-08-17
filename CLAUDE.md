# CLAUDE.md — project context

Read this before changing anything. It exists so a fresh session can pick the
project up without re-deriving how it works.

## What this is

A one-page RSVP site for the homecoming reception of **Thisal & Sirithi**,
26 September 2026, 7.00 p.m. onwards, The Lumina Ballroom, Cinnamon Life at
City of Dreams. The page's single job is to get a guest to respond.

Plain HTML, CSS and JS. **No framework and no build step.** The page itself has
no dependencies; do not give it any. There is now a `package.json`, but it exists
only for the serverless functions in `api/`, and it holds exactly one entry —
`@neondatabase/serverless`. Do not add a second, and do not add a build script.

The page still opens straight from disk with Live Server or `npx serve`; the
lookup and the RSVP just need `vercel dev` instead, because they talk to `api/`.

```
index.html               markup + all copy
css/styles.css           design tokens at :root, then sections in order
js/main.js               ignition, petals, countdown, RSVP flow
js/guests.js             the guest list, one entry per envelope — local only,
                         never deployed (see .vercelignore)
assets/img/painting.webp the artwork with the lamps erased
assets/img/lantern-0N.webp  the four lamps as transparent sprites
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
- Reveals use one IntersectionObserver over `.reveal`; stagger via `data-d="1..5"`.
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
