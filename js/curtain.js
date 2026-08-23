/* =============================================================
   THE SPLASH CURTAIN — choreography

   A splash screen, not a frame. The curtain owns the whole
   viewport, holds a title card until the guest opens it, is drawn
   open on its tieback cords, and then flies out and is removed from
   the document. The page it opens onto is left completely clear.

   Four acts, with a gate between the first and the second:

     title    the house is closed. Monogram, hairline, date, and
              the button that opens it.
     hold     the timeline pauses here and waits. Nothing moves
              until the guest presses the button — the invitation
              is opened, not played at them.
     cue      the cords take up slack and the panels lean in —
              the breath before the pull
     draw     the panels are drawn diagonally toward their own
              upper outer corners, gathering into the wings and
              leaving a tall pointed arch behind them
     exit     the same motion, accelerating, off the stage; the
              swag flies out; the overlay fades and is removed

   Three nested elements carry three different motions, which is
   what stops the draw reading as a rigid slide:

     .curtain__panel    travels and tilts  — translate + rotation
     .curtain__gather   gathers the cloth  — scaleX, outer origin
     .curtain__cloth    is cut by the arch — clip-path

   The cut is not a tween. One proxy value drives it, and on every
   frame the inner edge is rebuilt from the vertex table below and
   written to two places at once: the cloth's `clip-path` and the
   gold braid's path `d`. They are the same numbers, so the trim
   cannot drift off the cloth it is sewn to — which is exactly what
   went wrong when the swag was a clipped div plus a stroked
   overlay.

   Self-contained by design: this module injects its own markup
   into a mount point and needs no HTML of its own. It talks to
   the page it opens onto only through events —

     curtain:reveal    the arch is wide enough to show the page
     curtain:complete  the splash is gone and out of the document

   — so a host page can ignore it entirely and still work.

   Requires GSAP on window (vendored at assets/js/gsap.min.js).
   Without it, or on a repeat view, the splash is dismissed on the
   spot and both events still fire — no gate, nothing to press.
   ============================================================= */

/* --- geometry -------------------------------------------------
   The open silhouette of a tied-back curtain, as a table of
   vertices down the panel's inner edge, in percent of the panel's
   own box.

   The shape is the whole point. A tieback does not leave a straight
   vertical edge: the cloth is widest at the head, is pulled in to a
   waist where the cord grips it, and falls away again below into a
   flare that rests on the floor. That pinch is what says "tied
   back" rather than "slid aside", and it is why the open column
   below is not monotonic — it narrows to the waist and widens after
   it.

   `x open` is an explicit position rather than a distance
   travelled, because the edge reverses direction at the waist and a
   single travel fraction cannot describe that. */
const EDGE = [
  /* y closed, y open, x open */
  [  0,   1.8, 43.0 ],   // the head, behind the swag: the fullest cloth
  [ 11,  14.0, 41.9 ],   // the swag's hem — from here down it is visible
  [ 22,  21.0, 38.5 ],
  [ 33,  28.1, 35.5 ],   // drawing in toward the cord
  [ 44,  41.2, 31.2 ],
  [ 55,  52.6, 28.0 ],   // THE WAIST — where the tieback grips. The tie
                         //   is positioned off this row; move one and
                         //   the cord floats off the pinch it explains.
  [ 66,  58.8, 28.6 ],
  [ 77,  64.9, 31.2 ],   // and falling away again below it
  [ 88,  77.2, 34.4 ],
  [100,  89.5, 36.5 ],   // the hem, below the fold
];

/* Ten vertices describe the silhouette but they do not draw it: joined
   by straight lines the edge is visibly faceted, and the braid running
   along it shows every corner. Catmull-Rom through the same rows gives
   a smooth edge without inventing a second shape — the curve passes
   through all ten, so the table stays the single source of truth.

   Splining the whole row (closed y, open y, open x together) rather
   than the finished points is what keeps the two ends interpolable:
   every densified row still carries a matched closed and open state. */
function densify(rows, sub){
  const n = rows.length, out = [];
  const at = (i) => rows[i < 0 ? 0 : i > n - 1 ? n - 1 : i];
  for(let i = 0; i < n - 1; i++){
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for(let s = 0; s < sub; s++){
      const t = s / sub, t2 = t * t, t3 = t2 * t;
      out.push(p1.map((_, k) => 0.5 * (
        2 * p1[k] +
        (-p0[k] + p2[k]) * t +
        (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
        (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3
      )));
    }
  }
  out.push(rows[n - 1].slice());
  return out;
}
const SPLINE = densify(EDGE, 4);

/* Where the inner edge sits when the curtain is shut, in percent of the
   panel's bleed box. Not 100: the box runs past the panel to carry the
   overhang, and a closed edge written at 100 puts the seam at 52% of
   the viewport — visibly off-centre on a screen whose whole subject is
   a monogram centred under it. This value lands both leading edges
   within a couple of pixels of the middle, still overlapping, so the
   join is a seam rather than a gap. */
const CLOSED = 96.6;

/* The whole open profile, scaled. Narrow screens get a slimmer drape
   from the same silhouette rather than a different one, so the arch
   is wide enough to actually show a phone-width page through it. */
const PROFILE = {wide: 1, narrow: 0.82};

/* How far the hem trails the head, as a fraction of the draw.
   Cloth is heavy and it is being pulled from the top: the head
   comes away first and the floor lets go last. A single clip-path
   tween opens every row in lockstep, which is the one thing that
   makes a drawn curtain look like a sliding door. */
const LAG = 0.26;

/* The draw, as travel of the panel itself.

   `rot` is the number to be careful with. The panel turns about its top
   outer corner, so the tilt narrows the drape by sin(rot) × *height* as
   it descends — and height is exactly what does not shrink on a phone.
   At 360×700 four and a half degrees eats 55px of a drape that is only
   about 42px wide at the hem, and the cloth below the tieback stops
   existing while the curtain is still meant to be closed. Everything in
   the narrow row is smaller for that reason rather than for taste. If
   you retune it, measure the drape at the hem, not at the head. */
const TRAVEL = {
  wide:   {x: -5,   y: -3, rot: 3.2, gather: 0.90},
  narrow: {x: -2.5, y: -2, rot: 1.6, gather: 0.94},
};

/* And off. The exit is deliberately the same diagonal as the draw,
   carried further and faster: a new direction at the end would read as
   a second, unrelated animation stapled on. */
const EXIT = {
  wide:   {x: -108, y: -24, rot: 9,   gather: 0.74},
  narrow: {x: -112, y: -18, rot: 5.5, gather: 0.80},
};

const NARROW = '(max-width: 700px)';

/* easeInOutCubic, by hand: this runs per row per frame, inside the
   ticker, and does not want a lookup through GSAP's parser. */
function ease(u){
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

/* The inner edge at draw progress `t`, in percent of the panel box.
   Row i starts late and finishes with the rest, which is the lag. */
function edgeAt(profile, t, mirror){
  const n = SPLINE.length, pts = [];
  for(let i = 0; i < n; i++){
    const row = SPLINE[i];
    let u = (t - (i / (n - 1)) * LAG) / (1 - LAG);
    u = u < 0 ? 0 : u > 1 ? 1 : ease(u);
    const x = CLOSED + (row[2] * profile - CLOSED) * u;
    const y = row[0] + (row[1] - row[0]) * u;
    pts.push([mirror ? 100 - x : x, y]);
  }
  return pts;
}

/* The cut: the edge, closed off round the panel's outer side. */
function clipOf(pts, mirror){
  const o = mirror ? 100 : 0;
  const body = pts.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(',');
  return `polygon(${o}% 0%,${body},${o}% 100%)`;
}

/* The braid: the edge alone, as an open path. Same numbers. */
function braidOf(pts){
  return 'M' + pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L');
}

/* --- the drawn parts ------------------------------------------
   Cord, knot and tassels, in one SVG per panel. The whole group
   swings from the top of the loop, so the tassels lag the cloth
   rather than being welded to it. */
function tassel(x, y, scale){
  return `
    <g transform="translate(${x} ${y}) scale(${scale})">
      <ellipse cx="0" cy="1" rx="8.4" ry="7.4" fill="url(#curBead)"/>
      <path d="M-8.6 5 C-10.5 19 -8 29 -5.4 33 L5.4 33 C8 29 10.5 19 8.6 5 Z" fill="url(#curSkirt)"/>
      <g stroke="rgba(74,28,38,.45)" stroke-width=".8">
        <path d="M-5.6 9 L-4.2 32"/><path d="M-2 9.6 L-1.6 33"/>
        <path d="M2 9.6 L1.6 33"/><path d="M5.6 9 L4.2 32"/>
      </g>
      <path d="M-5.4 33 L5.4 33" stroke="rgba(244,225,176,.5)" stroke-width="1.1" fill="none"/>
    </g>`;
}

function tieSVG(){
  /* The cord passes round the cloth: it bows across the front and its two
     ends simply stop, which is what running behind the fabric looks like.
     A closed ring drawn on top reads as a hoop lying on the surface.

     Only the knot and its tassels swing, and they swing from the knot —
     the cord itself is held by the panel it is tied around. */
  return `
  <svg class="curtain__tie" viewBox="0 0 120 200" fill="none" aria-hidden="true">
    <g class="curtain__tie-cord">
      <path d="M-6 22 C18 48 102 48 126 22" stroke="url(#curCordFade)" stroke-width="8.5"/>
      <path d="M-6 22 C18 48 102 48 126 22" stroke="url(#curCordSheen)" stroke-width="2.6"/>
    </g>
    <g class="curtain__tie-swing">
      <ellipse cx="60" cy="40" rx="12.5" ry="9.5" fill="url(#curBead)"/>
      <path d="M60 40 C56 62 52 82 50 100" stroke="url(#curCord)" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M60 40 C66 58 70 72 73 88"  stroke="url(#curCord)" stroke-width="3.6" stroke-linecap="round"/>
      ${tassel(50, 126, 1.05)}
      ${tassel(73, 112, 0.9)}
    </g>
  </svg>`;
}

/* The swag hangs as a festoon: caught at both ends and sagging under
   its own weight in the middle. Its folds do not run vertically — they
   fan from the two catches toward the belly of the sag, which is what
   a gathered swag does and what a comb of upright pleats cannot fake.

   The whole thing is one SVG, fill and hem and folds together, because
   the gold trim has to sit exactly on the edge of the cloth. Drawn as
   a clipped div plus a stroked overlay they are two coordinate systems
   agreeing by luck, and they drift apart at the ends. */
const SWAG_W = 1000, SWAG_H = 220;
const SWAG_HEM = `M0 ${SWAG_H * 0.3} C${SWAG_W * 0.2} ${SWAG_H * 0.99}, ${SWAG_W * 0.8} ${SWAG_H * 0.99}, ${SWAG_W} ${SWAG_H * 0.3}`;

function swagSVG(){
  /* the fan: every fold leaves one of the two catches and dies into
     the hem, so the gathering reads from both ends inward */
  let folds = '';
  for(let i = 1; i < 17; i++){
    const t = i / 17;
    const fromLeft = t < 0.5;
    const x0 = fromLeft ? 6 : SWAG_W - 6;
    const x1 = t * SWAG_W;
    const y1 = SWAG_H * (0.3 + Math.sin(t * Math.PI) * 0.69);
    const cx = fromLeft ? x1 * 0.42 : SWAG_W - (SWAG_W - x1) * 0.42;
    folds += `<path d="M${x0} 4 Q${cx.toFixed(0)} ${(y1 * 0.46).toFixed(0)} ${x1.toFixed(0)} ${y1.toFixed(0)}"/>`;
  }
  return `
  <svg class="curtain__swag" viewBox="0 0 ${SWAG_W} ${SWAG_H}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="curSwagFace" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0"   stop-color="#8B3A48"/>
        <stop offset=".18" stop-color="#6F2F3C"/>
        <stop offset=".62" stop-color="#5A2331"/>
        <stop offset="1"   stop-color="#320F18"/>
      </linearGradient>
      <pattern id="curSwagPleats" width="31" height="${SWAG_H}" patternUnits="userSpaceOnUse">
        <rect width="31" height="${SWAG_H}" fill="rgba(41,14,20,.34)"/>
        <rect x="7"  width="8" height="${SWAG_H}" fill="rgba(215,154,162,.16)"/>
      </pattern>
      <!-- folds are shading, not wires: drawn wide and blurred so they
           read as the cloth turning, the way a gathered swag looks -->
      <filter id="curSwagSoft" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur stdDeviation="3.5"/>
      </filter>
      <clipPath id="curSwagClip">
        <path d="M0 0 H${SWAG_W} V${SWAG_H * 0.3} C${SWAG_W * 0.8} ${SWAG_H * 0.99}, ${SWAG_W * 0.2} ${SWAG_H * 0.99}, 0 ${SWAG_H * 0.3} Z"/>
      </clipPath>
    </defs>
    <g clip-path="url(#curSwagClip)">
      <rect width="${SWAG_W}" height="${SWAG_H}" fill="url(#curSwagFace)"/>
      <rect width="${SWAG_W}" height="${SWAG_H}" fill="url(#curSwagPleats)"/>
      <g stroke="rgba(30,9,15,.34)" stroke-width="9" fill="none"
         stroke-linecap="round" filter="url(#curSwagSoft)">${folds}</g>
      <g stroke="rgba(226,176,178,.20)" stroke-width="4" fill="none"
         stroke-linecap="round" filter="url(#curSwagSoft)"
         transform="translate(11 0)">${folds}</g>
    </g>
    <path d="${SWAG_HEM}" fill="none" stroke="rgba(211,171,99,.85)" stroke-width="2.4"
          vector-effect="non-scaling-stroke"/>
    <path d="${SWAG_HEM}" fill="none" stroke="rgba(244,225,176,.4)" stroke-width="1"
          vector-effect="non-scaling-stroke" transform="translate(0 -3)"/>
  </svg>`;
}

/* One panel. The bleed box carries the overhang, the cloth is cut
   inside it, and the braid is a sibling of the cloth rather than a
   child: the cloth's drop-shadows would otherwise print a second,
   ghosted trim thirteen pixels inboard of the real one.

   The tie goes inside the gather and outside the bleed box. Inside,
   because the gather is what pulls the cloth in at the waist and a
   cord that does not come in with it ends up hanging in the opening
   with its tassels over the page. Outside the bleed box, because that
   is the thing being clipped, and a cord clipped to the arch would be
   cut in half by the edge it is supposed to be gripping. */
function panel(side){
  return `
  <div class="curtain__panel curtain__panel--${side}" aria-hidden="true">
    <div class="curtain__gather">
      <div class="curtain__sheet">
        <div class="curtain__cloth"><span class="curtain__sheen"></span></div>
        <svg class="curtain__braid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path fill="none" stroke="url(#curBraid)" stroke-width="1.7"
                vector-effect="non-scaling-stroke" stroke-linecap="round"
                stroke-opacity=".62"/>
        </svg>
      </div>
      ${tieSVG()}
    </div>
  </div>`;
}

function markup(){
  return `
  <div class="curtain__bloom" aria-hidden="true"></div>

  <svg class="curtain__defs" aria-hidden="true"><defs>
    <linearGradient id="curCord" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0"   stop-color="#A97F3C"/>
      <stop offset=".38" stop-color="#F4E1B0"/>
      <stop offset=".72" stop-color="#D3AB63"/>
      <stop offset="1"   stop-color="#8E6529"/>
    </linearGradient>
    <radialGradient id="curBead" cx=".34" cy=".28" r=".82">
      <stop offset="0"   stop-color="#F4E1B0"/>
      <stop offset=".52" stop-color="#D3AB63"/>
      <stop offset="1"   stop-color="#8E6529"/>
    </radialGradient>
    <!-- the cord runs behind the cloth at both ends, so it fades out
         rather than stopping at a visible cut -->
    <linearGradient id="curCordFade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0"    stop-color="#8E6529" stop-opacity="0"/>
      <stop offset=".16"  stop-color="#A97F3C"/>
      <stop offset=".42"  stop-color="#F4E1B0"/>
      <stop offset=".74"  stop-color="#D3AB63"/>
      <stop offset=".88"  stop-color="#8E6529"/>
      <stop offset="1"    stop-color="#8E6529" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="curCordSheen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0"   stop-color="#F4E1B0" stop-opacity="0"/>
      <stop offset=".4"  stop-color="#F4E1B0" stop-opacity=".46"/>
      <stop offset="1"   stop-color="#F4E1B0" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="curSkirt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0"   stop-color="#E7C889"/>
      <stop offset=".46" stop-color="#D3AB63"/>
      <stop offset="1"   stop-color="#8A611F"/>
    </linearGradient>
    <!-- the braid down the leading edge. Darkest at the head, where the
         swag shades it, brightest at the waist where the cord is. -->
    <linearGradient id="curBraid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0"   stop-color="#8A611F"/>
      <stop offset=".14" stop-color="#C79B52"/>
      <stop offset=".46" stop-color="#F4E1B0"/>
      <stop offset=".72" stop-color="#D3AB63"/>
      <stop offset="1"   stop-color="#8A611F"/>
    </linearGradient>
  </defs></svg>

  ${panel('l')}
  ${panel('r')}

  ${swagSVG()}

  <div class="curtain__vig" aria-hidden="true"></div>

  <div class="curtain__title">
    <p class="curtain__eyebrow">Homecoming Reception</p>
    <p class="curtain__names"><b>Thisal</b> <i>&amp;</i> <b>Sirithi</b></p>
    <span class="curtain__rule"><i></i><b></b><i></i></span>
    <p class="curtain__date">26 September 2026</p>
    <button class="curtain__enter" type="button">Open the invitation</button>
  </div>`;
}

/* --- frame guard ----------------------------------------------
   Rewriting a clip-path over two full-screen surfaces is the one
   thing here that can miss frames on a mid-range phone. Rather
   than let the whole sequence judder, sample the first stretch of
   the draw and, if it is struggling, snap the cut open and let the
   travel alone carry it. A transform-only draw is a lesser curtain
   than a stuttering one is a broken page. */
function guardFrames(gsap, onDegrade){
  let frames = 0, late = 0, last = performance.now();
  function tick(){
    const now = performance.now(), dt = now - last;
    last = now;
    frames++;
    if(dt > 34) late++;                      // two frames' worth at 60Hz
    if(frames >= 14 && late >= 5){ stop(); onDegrade(); return; }
    if(frames >= 45) stop();                 // sampled long enough to trust it
  }
  function stop(){ gsap.ticker.remove(tick); }
  gsap.ticker.add(tick);
  return stop;
}

/* --- the module ----------------------------------------------- */
export function initCurtain(options = {}){
  const {mount, onReveal, onComplete, force = false} = options;

  const host = (typeof mount === 'string' ? document.querySelector(mount) : mount)
             || document.getElementById('curtain-root')
             || document.body;

  const gsap = window.gsap;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = window.matchMedia(NARROW).matches;
  const profile = narrow ? PROFILE.narrow : PROFILE.wide;
  const travel = narrow ? TRAVEL.narrow : TRAVEL.wide;
  const exit = narrow ? EXIT.narrow : EXIT.wide;

  /* Once per session, and never on a back/forward restore. The flag is
     a property on a shared namespace — no localStorage, no
     sessionStorage, nothing left on the guest's device — which also
     means a re-render finds it set while a genuine reload does not. */
  const state = window.__homecoming || (window.__homecoming = {});
  const returning = state.revealed
    || (performance.getEntriesByType('navigation')[0] || {}).type === 'back_forward';

  let revealed = false, finished = false;

  /* The mount carries a full-screen velvet backdrop in CSS, so the
     splash is painted on the very first frame rather than after this
     module has parsed. It is dropped as soon as the panels are in the
     document — and js/main.js's safety net drops it too, so a module
     that never loads cannot leave the invitation behind a blank
     screen. */
  function uncover(){ host.removeAttribute('data-cover'); }

  /* Focus the button and say so. Focus moved by script does not match
     :focus-visible, so the ring is painted from an attribute instead and
     dropped again the moment a pointer shows up. */
  function cue(btn){
    if(!btn) return;
    btn.focus({preventScroll: true});
    /* The ring is for someone who is going to press a key. On a touch
       screen there is no keyboard to reassure and the outline just reads
       as a second border around the button. */
    if(window.matchMedia('(pointer: coarse)').matches) return;
    btn.setAttribute('data-cued', '');
    const drop = () => btn.removeAttribute('data-cued');
    window.addEventListener('pointerdown', drop, {once: true});
    window.addEventListener('pointermove', drop, {once: true});
  }

  function fireReveal(el){
    if(revealed) return;
    revealed = true;
    if(el){
      el.classList.add('is-open');           // hand pointer events back
      const btn = el.querySelector('.curtain__enter');
      if(btn) btn.remove();
    }
    document.dispatchEvent(new CustomEvent('curtain:reveal'));
    if(typeof onReveal === 'function') onReveal();
  }

  function fireComplete(el){
    if(finished) return;
    finished = true;
    state.revealed = true;
    fireReveal(el);
    document.body.classList.remove('curtain-up');
    uncover();
    if(el) el.remove();                      // a splash screen leaves
    document.dispatchEvent(new CustomEvent('curtain:complete'));
    if(typeof onComplete === 'function') onComplete();
  }

  /* No GSAP, or the guest has already watched it this session: there is
     nothing to play, so do not flash a curtain at them on the way past. */
  if(!gsap || (returning && !force)){
    fireComplete(null);
    return null;
  }

  const el = document.createElement('div');
  el.className = 'curtain';
  el.id = 'curtain';
  /* The drape itself is scenery and each piece of it says so, but the
     container must stay in the accessibility tree: it holds the button
     that opens the curtain, and a focusable element inside an
     aria-hidden subtree is unreachable to a screen reader and invalid
     besides. */
  el.innerHTML = markup();
  host.appendChild(el);
  /* The curtain is alive and on screen. js/main.js's safety net reads
     this: with a gate in the sequence the hero may legitimately stay
     hidden for as long as the guest leaves the card up, so the net has
     to be able to tell "still waiting to be opened" from "the module
     never loaded". A module that fails never gets this far. */
  state.curtainArmed = true;
  /* Straight away, not at the end. The cover exists only to bridge the
     gap between first paint and this line; left in place it sits behind
     the panels as an opaque backdrop, and the arch opens onto velvet
     instead of onto the invitation. */
  uncover();
  document.body.classList.add('curtain-up');

  const q = (s) => el.querySelector(s);
  const all = (s) => Array.from(el.querySelectorAll(s));
  const panelL = q('.curtain__panel--l'), panelR = q('.curtain__panel--r');
  const sides = [
    {cloth: panelL.querySelector('.curtain__cloth'),
     braid: panelL.querySelector('.curtain__braid path'), mirror: false},
    {cloth: panelR.querySelector('.curtain__cloth'),
     braid: panelR.querySelector('.curtain__braid path'), mirror: true},
  ];

  /* One value drives the cut. Both the cloth's clip-path and the braid's
     path come out of the same call, so the trim is on the edge by
     construction rather than by agreement. */
  const cut = {t: 0};
  function drawCut(){
    for(const s of sides){
      const pts = edgeAt(profile, cut.t, s.mirror);
      s.cloth.style.clipPath = clipOf(pts, s.mirror);
      s.braid.setAttribute('d', braidOf(pts));
    }
  }
  drawCut();

  /* Reduced motion gets the title card and a cross-fade and nothing
     else: no travel, no parting, no scale. The invitation is still
     introduced, but nothing moves across the screen. */
  if(reduce){
    el.classList.add('is-still');
    const stillBtn = q('.curtain__enter');
    let leaving = false;

    /* The same gate as the animated path, minus the machinery: the card
       arrives and then waits. A guest who has asked for less motion has
       not asked to be moved along on a timer. */
    gsap.fromTo(q('.curtain__title'), {opacity: 0}, {
      opacity: 1, duration: 0.5,
      onComplete: () => cue(stillBtn),
    });

    const leave = () => {
      if(leaving) return;
      leaving = true;
      /* The button goes first: fireReveal removes it, and a control that
         vanishes on the first frame of a cross-fade reads as a glitch. */
      const out = gsap.timeline({onComplete: () => fireComplete(el)});
      if(stillBtn){
        stillBtn.disabled = true;
        out.to(stillBtn, {opacity: 0, duration: 0.3, ease: 'power1.out'});
      }
      out.add(() => fireReveal(el))
         .to(el, {opacity: 0, duration: 0.6, ease: 'power1.inOut'});
    };
    if(stillBtn) stillBtn.addEventListener('click', leave);
    else leave();                            // no button, no way to wait
    return null;
  }

  el.classList.add('is-drawing');
  gsap.set([panelL, panelR], {xPercent: 0, yPercent: 0, rotation: 0});

  const btn = q('.curtain__enter');

  let degraded = false, opened = false;

  /* Built paused, and only Act 1 plays on its own. The title card is the
     only reason a splash screen is worth a guest's time, and Italiana
     arrives over the network — animate the names before the face
     lands and it plays in
     a fallback serif, or, during the block period, in nothing at all.
     Waiting costs nothing: the velvet is already painted. The cap is
     there because a font that never arrives must not hold the door. */
  /* power2.out, not an inOut. The cords are pulled, not eased: an inOut
     spends the first third of the draw almost motionless, which on a
     screen reads as the sequence having stalled rather than as weight.
     The anticipation in Act 2 is what supplies the effort; from the
     moment the cloth lets go it should be moving, and settle at the
     end. It then hands over to an exit that accelerates, so the
     sequence breathes out and then leaves. */
  const tl = gsap.timeline({defaults: {ease: 'power2.out'}, paused: true});
  const typeReady = document.fonts && document.fonts.ready
    ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1200))])
    : Promise.resolve();

  /* Labels rather than hardcoded offsets, so a phase can be retimed
     without recomputing every delay after it.

     `hold` is the gate, and it cannot sit any earlier: the monogram is
     still settling at 1.42s and the button lands at 1.5s, and a pause
     inside Act 1 would freeze a half-drawn card for as long as the guest
     took to press it. Everything from `cue` on is the old timing moved
     down by the 0.55s that buys — the acts themselves are untouched. */
  tl.addLabel('title',  0)
    .addLabel('hold',   1.50)
    .addLabel('cue',    1.50)
    .addLabel('draw',   1.90)
    .addLabel('reveal', 2.40)
    .addLabel('exit',   3.60)
    .addLabel('end',    4.53);

  /* Act 1 — the title card. Tracking settles rather than opening out:
     letters that spread apart read as a logo animation, letters that
     draw together read as type finding its place. */
  tl.fromTo(q('.curtain__eyebrow'),
        {opacity: 0, letterSpacing: '0.78em'},
        {opacity: .82, letterSpacing: '0.42em', duration: 1.1, ease: 'power2.out'}, 'title+=0.1')
    .fromTo(q('.curtain__names'),
        {opacity: 0, y: 14, letterSpacing: '0.20em'},
        {opacity: 1, y: 0, letterSpacing: '0.045em', duration: 1.2, ease: 'power3.out'}, 'title+=0.22')
    .fromTo(q('.curtain__rule'),
        {scaleX: 0, opacity: 0},
        {scaleX: 1, opacity: 1, duration: 0.9, ease: 'power2.out'}, 'title+=0.5')
    .fromTo(q('.curtain__date'),
        {opacity: 0}, {opacity: .74, duration: 0.7, ease: 'power2.out'}, 'title+=0.66')
    .fromTo(q('.curtain__bloom'),
        {opacity: .10}, {opacity: .24, duration: 1.4, ease: 'sine.inOut'}, 'title')
    /* Last of the card to arrive, and the only part of it the guest can
       touch: the card has to have finished saying what it says before it
       asks for anything. */
    .fromTo(btn,
        {opacity: 0, y: 12}, {opacity: 1, y: 0, duration: 0.55, ease: 'power2.out'},
        'title+=0.95');

  /* The gate. The timeline stops dead here and waits to be let go: the
     curtain is opened by the guest, not played at them.

     A guarded callback rather than addPause. GSAP's own pause point
     cannot be crossed by the run-out below — it re-arms itself under
     the tween that is driving progress, and the sequence freezes a
     third of a second in. This asks a question instead: pause only if
     nobody has opened the gate yet. A guest who hits Escape during the
     title card has opened it, so the run-out sails straight through.

     Focus moves to the button as the card lands, so the keyboard path is
     Tab-free: the names arrive, Enter or Space opens it. */
  tl.add(() => {
    cue(btn);
    if(!opened) tl.pause();
  }, 'hold');

  /* Act 2 — the cue. The card recedes into the light behind the cloth,
     the cords take up their slack, and the panels lean *inward* a few
     pixels: the breath before the pull, and the thing that makes the
     draw itself read as effort. */
  tl.to(q('.curtain__title'), {
        opacity: 0, y: -18, scale: 1.06, filter: 'blur(7px)',
        duration: 0.6, ease: 'power2.in',
      }, 'cue')
    .to(all('.curtain__tie-swing'), {
        rotation: (i) => i === 0 ? 2.6 : -2.6,
        duration: 0.3, ease: 'sine.inOut', yoyo: true, repeat: 1,
      }, 'cue')
    .to(all('.curtain__tie-cord'), {scaleY: 0.965, duration: 0.3, ease: 'power2.in'}, 'cue+=0.18')
    .to(panelL, {x: 7,  duration: 0.5, ease: 'power2.inOut'}, 'cue')
    .to(panelR, {x: -7, duration: 0.5, ease: 'power2.inOut'}, 'cue');

  /* A raking light crosses both panels once, from one side, as the cloth
     starts to move. One source, one pass — a highlight that sweeps back
     is a shader effect, not a room. */
  tl.fromTo(all('.curtain__sheen'),
        {xPercent: -170, opacity: 0},
        {xPercent: 300, opacity: 1, duration: 2.1, ease: 'sine.inOut'}, 'cue+=0.1')
    .to(all('.curtain__sheen'), {opacity: 0, duration: 0.5}, 'cue+=1.7');

  /* Act 3 — the draw. The cut, the travel and the gather share one
     duration and one ease, so the cloth cannot be seen to arrive in
     pieces; nothing springy goes anywhere near it. Ending a quarter of
     a second before the exit is deliberate — the tied-back silhouette
     is the best frame in the sequence and it is worth holding still
     long enough to be seen. */
  const DRAW = 1.45;
  tl.to(cut, {t: 1, duration: DRAW, onUpdate: drawCut}, 'draw')
    .to(panelL, {
        x: 0, xPercent: travel.x, yPercent: travel.y, rotation: travel.rot,
        duration: DRAW,
      }, 'draw')
    .to(panelR, {
        x: 0, xPercent: -travel.x, yPercent: travel.y, rotation: -travel.rot,
        duration: DRAW,
      }, 'draw')
    .to(all('.curtain__gather'), {scaleX: travel.gather, duration: DRAW}, 'draw')
    .to(q('.curtain__vig'), {opacity: 0, duration: 1.0, ease: 'power2.out'}, 'draw')
    .to(q('.curtain__bloom'), {opacity: .52, duration: 0.85, ease: 'power2.out'}, 'draw+=0.05')
    .to(q('.curtain__bloom'), {opacity: 0, duration: 0.9, ease: 'power2.in'}, 'draw+=0.95');

  /* the tiebacks travel with their panel, and lag it */
  tl.to(panelL.querySelector('.curtain__tie-swing'), {
        rotation: -8, duration: 1.0, ease: 'power2.out',
      }, 'draw+=0.14')
    .to(panelR.querySelector('.curtain__tie-swing'), {
        rotation: 8, duration: 1.0, ease: 'power2.out',
      }, 'draw+=0.2');

  /* Act 4 — the reveal, fired a third of the way into the draw. The page
     needs about a second to bring its artwork up, and the two have to
     overlap: fire this at the end of the draw and the arch opens onto an
     empty blush field that the invitation then fades into. Fired here,
     the cloth parts on a picture that is already there. */
  tl.add(() => fireReveal(el), 'reveal');

  /* Act 5 — the exit. Same diagonal, now accelerating, and the swag
     flies out with it. The overlay fades over the last stretch, by
     which point the panels are most of the way off anyway — it takes
     the edge off two large shapes leaving at speed. */
  tl.to(panelL, {
        xPercent: exit.x, yPercent: exit.y, rotation: exit.rot,
        duration: 0.92, ease: 'power2.in',
      }, 'exit')
    .to(panelR, {
        xPercent: -exit.x, yPercent: exit.y, rotation: -exit.rot,
        duration: 0.92, ease: 'power2.in',
      }, 'exit')
    .to(all('.curtain__gather'), {scaleX: exit.gather, duration: 0.92, ease: 'power2.in'}, 'exit')
    .to(all('.curtain__tie-swing'), {
        rotation: (i) => i === 0 ? -19 : 19, duration: 0.9, ease: 'power2.in',
      }, 'exit')
    .to(q('.curtain__swag'), {yPercent: -118, duration: 0.85, ease: 'power2.in'}, 'exit+=0.04')
    .to(el, {opacity: 0, duration: 0.5, ease: 'power1.in'}, 'exit+=0.42');

  tl.set({}, {}, 'end');   // hold the timeline open to its full length

  /* Narrow screens get the same choreography, run faster: about 3.3s
     against 4.5s. Scaling the whole timeline keeps every phase in
     proportion, which retiming each tween by hand would not. The target
     moved with the gate — it is the same ~1.37x speed-up as before, and
     the part that got longer is the card, whose length is now the
     guest's to decide anyway. */
  if(narrow) tl.timeScale(tl.duration() / 3.3);

  typeReady.then(() => { if(!finished) tl.play(); });

  /* If rewriting the cut cannot hold frame rate, snap it open and let
     the travel carry the draw on transforms alone. The sampling starts
     with the draw rather than with the module: the title card is two
     opacity tweens and says nothing about whether this machine can
     rewrite two full-screen clip paths sixty times a second. */
  let stopGuard = null;
  tl.add(() => {
    stopGuard = guardFrames(gsap, () => {
      if(degraded) return;
      degraded = true;
      gsap.killTweensOf(cut);
      cut.t = 1;
      drawCut();
      el.classList.add('is-degraded');
    });
  }, 'draw');

  /* Letting the gate go. Once only: the button is disabled on the way
     through, so a second press cannot restart a timeline that is already
     running. */
  function open(){
    if(opened || finished) return;
    opened = true;
    if(btn) btn.disabled = true;
    tl.play();
  }
  if(btn){
    btn.addEventListener('click', open);
    btn.setAttribute('aria-label', 'Open the invitation');
  }

  /* Escape runs the sequence out rather than cutting it: whatever is
     mid-flight still lands, just sooner. It has to open the gate first —
     a paused timeline still renders when its progress is written from
     outside, but leaving it paused would strand the pause callback. */
  function runOut(){
    if(finished) return;
    open();
    gsap.to(tl, {progress: 1, duration: 0.5, ease: 'power2.inOut', overwrite: true});
  }
  /* On the document, not the curtain: the guest may have clicked the
     button and moved the mouse away, and a listener on the element would
     then never hear the key. */
  function onKey(e){ if(e.key === 'Escape') runOut(); }
  document.addEventListener('keydown', onKey);

  tl.eventCallback('onComplete', () => {
    if(stopGuard) stopGuard();
    document.removeEventListener('keydown', onKey);
    fireComplete(el);
  });

  return tl;
}

export default initCurtain;
