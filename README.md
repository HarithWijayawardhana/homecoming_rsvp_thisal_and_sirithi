# Thisal &amp; Sirithi — Homecoming Reception

A single-page RSVP site. No build step, no framework, no dependencies — open
`index.html` and it runs.

```
.
├── index.html                  all the markup and copy
├── CLAUDE.md                   project context and house rules
├── css/
│   └── styles.css              design tokens at the top, sections below
├── js/
│   └── main.js                 lantern ignition, petals, countdown, RSVP
├── assets/img/
│   ├── painting.webp           the artwork with the lamps erased
│   └── lantern-01..04.webp     the four lamps, cut out as sprites
├── server/
│   └── apps-script.gs          optional: collect RSVPs in a Google Sheet
├── tools/
│   └── extract_lanterns.py     optional: regenerate the art if it changes
└── netlify.toml                publish root + long cache on /assets
```

---

## 1. Run it locally

Open the folder in VS Code, then either:

- install the **Live Server** extension (Ritwick Dey), right-click `index.html`
  → *Open with Live Server*, or
- run `npx serve` in the terminal, or `python3 -m http.server 5173`.

Use a server rather than double-clicking the file. Opening it as `file://`
works, but some browsers block the WebP assets and the fonts under that scheme.

Recommended extensions: Live Server, Prettier, and *HTML CSS Support*.

---

## 2. How the lanterns work

This is the part worth understanding before you edit anything.

The lamps were painted into the illustration, so they could not move. Each one
was cut out along with the lower part of its chain, and the background behind
it was rebuilt — that rebuilt version is `painting.webp`. The four sprites are
then laid back on top at exactly the right spot, and each pivots around the
point where its chain meets the arch.

Every lamp is one element in `index.html`:

```html
<div class="lantern"
     style="left:29.102%; top:16.146%; width:8.594%;
            transform-origin:48.86% 0;
            --sw:5.6deg; --t:2.15s; --gd:0s; --dl:-0.4s">
  <img src="assets/img/lantern-01.webp" alt="">
  <span class="cone" style="left:48.86%; top:65.61%"></span>
  <span class="glow" style="left:48.86%; top:62.61%"></span>
</div>
```

| Variable | Meaning |
| --- | --- |
| `--sw` | swing angle either side of centre |
| `--t`  | seconds for one complete swing |
| `--dl` | negative delay, so the lamps start out of step |
| `--gd` | offset for the flame flicker |

Positions are percentages of the artwork, so everything stays aligned at any
screen size. `transform-origin` is the pivot; `.glow` and `.cone` sit at the
flame, inside the lamp, so the light travels with it.

Shorter chain → faster swing. Keep that relationship if you retune the numbers,
or the group stops looking physical.

---

## 3. Make the RSVP form actually send

Right now responses are validated and logged to the console. Pick one route:

### Google Sheets (free, no account beyond Google)

1. Create a sheet with headers: `Received | Name | Contact | Attending | Seats | Song | Notes | Message`
2. **Extensions → Apps Script**, paste `server/apps-script.gs`, save.
3. **Deploy → New deployment → Web app**. Execute as *Me*, access *Anyone*.
4. Copy the `/exec` URL into the top of `js/main.js`:

```js
var RSVP_ENDPOINT = 'https://script.google.com/macros/s/AKfy.../exec';
```

The request is sent as `text/plain` on purpose — Apps Script cannot answer a
CORS preflight, and this avoids one.

### Formspree / Netlify Forms / your own API

Set `RSVP_ENDPOINT` to the endpoint and, in `sendResponse()`, switch the header
to `application/json` (Formspree also wants `Accept: application/json`). The
payload shape is:

```json
{ "name": "", "contact": "", "attending": "yes|no", "seats": "1",
  "song": "", "notes": "", "message": "", "sentAt": "ISO date" }
```

Test with a real submission before the invitations go out, and check that a row
actually appears.

---

## 4. Content to change before launch

Search `index.html` for these:

- **Attire panel** — currently "Formal & traditional / Wear the colour you feel
  best in". Placeholder.
- **Respond-by date** — "5 September 2026" in the RSVP intro. Placeholder.
- **Directions link** — points at a Google Maps search for the venue. Swap in
  the exact map pin.
- **Countdown target** — in `js/main.js`, `new Date('2026-09-26T19:00:00+05:30')`.
  The offset is Sri Lanka time.
- **Page title and description** — used by Google and by WhatsApp previews.

Consider adding an Open Graph image so the link unfurls with the artwork:

```html
<meta property="og:title" content="Thisal &amp; Sirithi — Homecoming Reception">
<meta property="og:description" content="26 September 2026 · The Lumina Ballroom">
<meta property="og:image" content="https://yourdomain.com/assets/img/painting.webp">
```

---

## 5. Design tokens

At the top of `css/styles.css`:

```css
--blush:#FCE3DE;   /* page ground — matches the painting's background exactly */
--gold:#BE8838;    /* hairlines, ampersands */
--crimson:#8E2230; /* from the lehenga; used once, on the seal and selections */
--ink:#432A28;
```

Type is Italiana (display), Marcellus (serif), Jost (labels), loaded from Google
Fonts. To self-host, download the three families into `assets/fonts/` and swap
the `<link>` for `@font-face` rules — one less external request, and it works
offline.

---

## 6. Deploy

Any static host. No build command, publish directory is the project root.

- **Netlify** — drag the folder onto the dashboard, or connect the repo.
- **Vercel** — import the repo, framework preset *Other*.
- **GitHub Pages** — push to `main`, Settings → Pages → deploy from `main` / root.
- **Cloudflare Pages** — connect the repo, leave the build command empty.

Then point your domain at it and send the link.

---

## 7. If you change the artwork

Run the extraction tool with the new illustration and update `COORDS` inside it
to match where the lamps sit:

```bash
pip install pillow numpy scipy
python tools/extract_lanterns.py path/to/new-artwork.png
```

It rewrites the images in `assets/img/` and prints the CSS values to paste into
the `.lantern` elements.

---

## Notes

- Everything respects `prefers-reduced-motion` — the swinging, petals, opening
  fade and reveals all stop, and the lamps rest upright.
- Images are WebP. Every browser since 2020 supports it; if you must support
  older ones, export PNG/JPEG copies and use `<picture>`.
- The petal canvas is capped at 12 petals on narrow screens to keep phones cool.
