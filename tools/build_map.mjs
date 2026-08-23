/* build_map.mjs — draws assets/img/map.svg, the street plan in #place.
 *
 *   node tools/build_map.mjs                 # uses the cached OSM extract
 *   node tools/build_map.mjs --refresh       # re-queries Overpass first
 *
 * Run by hand, like the other tools here. Nothing in the site build depends
 * on it and it has no dependencies of its own — node 18+ only.
 *
 * WHY THIS AND NOT A MAP TILE OR AN EMBED
 * ---------------------------------------
 * An iframe embed would be the page's first third-party request and would
 * hand every guest's IP to a mapping provider on load; a raster tile
 * screenshot lands a bright multi-hue rectangle in the middle of a blush and
 * gold invitation, and no amount of tinting stops it reading as a screenshot
 * pasted on. So the plan is drawn from OpenStreetMap vector data into one
 * static SVG in the page's own palette: gold hairlines, a rose wash for
 * water, the venue's real footprint sealed in crimson. It is a few kilobytes,
 * it is crisp at any size, it makes no request at runtime, and it belongs to
 * the artwork rather than sitting on top of it.
 *
 * THE SVG CARRIES NO TEXT, DELIBERATELY.
 * An SVG loaded through <img> cannot fetch anything — fonts included — so any
 * <text> in here would set in the browser's default sans and blow the type
 * system apart. Labels are HTML in index.html instead, absolutely positioned
 * over the map box in percentages, which is the same arrangement the lanterns
 * use over painting.webp: one flat image plus overlay elements that still get
 * the page's fonts, colours and clamps. This tool prints the percentage
 * coordinates for every named feature it drew (see LABELS at the end of its
 * output) so a label can be moved without measuring anything by hand.
 *
 * ROAD WIDTHS AND ALPHAS ARE A HIERARCHY, not a set of guesses: trunk roads
 * carry the frame, primaries the structure, and the service lanes and
 * footways are barely there — they exist so the block shapes read. Flatten
 * the hierarchy and the plan turns into a net.
 *
 * The venue is centred, so the pin in index.html sits at 50%/50%. If you move
 * CENTRE you must move the pin.
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';

/* ---------- what we are drawing ---------- */

const CENTRE = { lat: 6.9252080, lon: 79.8477396 };   // Cinnamon Life, from Nominatim
const GROUND_W = 2600;                                 // metres across the frame
const W = 1600, H = 1067;                              // svg units, 3:2 — a plate, not a letterbox strip
const VENUE_WAY = 1348853552;                          // the footprint to seal in crimson
const OUT = new URL('../assets/img/map.svg', import.meta.url);
const CACHE = new URL('./build_map.osm.json', import.meta.url);

/* The page's tokens, repeated here because an <img>-loaded SVG cannot see
   :root. Keep them in step with css/styles.css. */
const C = {
  paper:   '#FFF8F5',   // --porcelain: the plate the plan is printed on
  water:   '#F7DED8',   // a deeper blush, not a blue — this palette has no blue
  waterIn: '#EBC9C2',
  park:    'rgba(190,136,56,.14)',
  gold:    '#BE8838',
  ink:     '#432A28',
  crimson: '#8E2230',
};

/* stroke width, alpha — drawn in this order, so the last is on top */
const ROADS = [
  [['service', 'footway'],                            0.8, 0.24],
  [['residential', 'unclassified', 'living_street'],  1.5, 0.50],
  [['pedestrian'],                                    1.5, 0.30],
  [['tertiary'],                                      2.2, 0.62],
  [['primary'],                                       3.4, 0.78],
  [['motorway', 'trunk'],                             4.4, 0.92],
];

const BBOX_PAD = 1.35;   // query wider than the frame so clipped edges are clean

/* ---------- geography ---------- */

const R = 6378137, rad = Math.PI / 180;
const mercX = lon => R * lon * rad;
const mercY = lat => R * Math.log(Math.tan(Math.PI / 4 + lat * rad / 2));

/* Mercator stretches by 1/cos(lat), so a frame that is GROUND_W metres wide
   on the ground is wider than that in projected metres. */
const spanX = GROUND_W / Math.cos(CENTRE.lat * rad);
const spanY = spanX * H / W;
const cx = mercX(CENTRE.lon), cy = mercY(CENTRE.lat);
const k = W / spanX;

const project = (lat, lon) => [
  (mercX(lon) - (cx - spanX / 2)) * k,
  ((cy + spanY / 2) - mercY(lat)) * k,
];

/* The query box, in degrees, from the frame plus padding. */
const halfLat = (spanY / 2 * BBOX_PAD) / (R * rad);
const halfLon = (spanX / 2 * BBOX_PAD) / (R * rad);
const BBOX = [
  CENTRE.lat - halfLat, CENTRE.lon - halfLon,
  CENTRE.lat + halfLat, CENTRE.lon + halfLon,
].map(n => n.toFixed(5));

/* ---------- the extract ---------- */

const QUERY = `[out:json][timeout:90];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian|footway|service)$"](${BBOX});
  way["natural"~"^(water|coastline)$"](${BBOX});
  way["waterway"~"^(riverbank|canal|river)$"](${BBOX});
  way["leisure"~"^(park|garden)$"](${BBOX});
  way["railway"~"^(rail|light_rail)$"](${BBOX});
  relation["natural"="water"](${BBOX});
  way(${VENUE_WAY});
);
out geom;`;

async function extract() {
  if (existsSync(CACHE) && !process.argv.includes('--refresh')) {
    return JSON.parse(readFileSync(CACHE, 'utf8'));
  }
  process.stderr.write('querying overpass…\n');
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded',
               'user-agent': 'homecoming-rsvp/1.0 (one-off static map build)' },
    body: new URLSearchParams({ data: QUERY }),
  });
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  const json = await res.json();
  writeFileSync(CACHE, JSON.stringify(json));
  return json;
}

/* ---------- clipping ---------- */

/* Sutherland–Hodgman, for the filled things. */
function clipPoly(pts) {
  const edges = [
    p => p[0] >= 0, p => p[0] <= W, p => p[1] >= 0, p => p[1] <= H,
  ];
  const cut = [
    (a, b) => lerpX(a, b, 0), (a, b) => lerpX(a, b, W),
    (a, b) => lerpY(a, b, 0), (a, b) => lerpY(a, b, H),
  ];
  let out = pts;
  for (let e = 0; e < 4 && out.length; e++) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length];
      const ain = edges[e](a), bin = edges[e](b);
      if (ain) out.push(a);
      if (ain !== bin) out.push(cut[e](a, b));
    }
  }
  return out;
}
const lerpX = (a, b, x) => [x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])];
const lerpY = (a, b, y) => [a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y];

/* Liang–Barsky per segment, for the lines — a road that leaves the frame and
   comes back must break into two polylines rather than take a shortcut. */
function clipLine(pts) {
  const runs = []; let run = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = clipSeg(pts[i], pts[i + 1]);
    if (!seg) { if (run.length > 1) runs.push(run); run = []; continue; }
    if (!run.length) run.push(seg[0]);
    else if (dist(run[run.length - 1], seg[0]) > 0.01) { if (run.length > 1) runs.push(run); run = [seg[0]]; }
    run.push(seg[1]);
  }
  if (run.length > 1) runs.push(run);
  return runs;
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function clipSeg(a, b) {
  let t0 = 0, t1 = 1;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0]], [dx, W - a[0]], [-dy, a[1]], [dy, H - a[1]]]) {
    if (p === 0) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
    else       { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return [[a[0] + t0 * dx, a[1] + t0 * dy], [a[0] + t1 * dx, a[1] + t1 * dy]];
}

/* ---------- simplify + serialise ---------- */

function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  let far = 0, idx = 0;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const len = Math.hypot(bx - ax, by - ay);
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const d = len === 0 ? Math.hypot(px - ax, py - ay)
      : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
    if (d > far) { far = d; idx = i; }
  }
  if (far <= eps) return [pts[0], pts[pts.length - 1]];
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
}

const n = v => (Math.round(v * 10) / 10).toString();
const d = (pts, close) =>
  'M' + pts.map(p => `${n(p[0])} ${n(p[1])}`).join('L') + (close ? 'Z' : '');

/* ---------- draw ---------- */

const json = await extract();
const els = json.elements.filter(e => (e.geometry || e.members));
const geom = e => (e.geometry || []).map(p => project(p.lat, p.lon));
const tags = e => e.tags || {};

const layers = { sea: [], water: [], hole: [], park: [], rail: [], venue: [] };
const roads = ROADS.map(() => []);
const labels = [];

/* A named thing worth labelling gets its centroid handed back to me in
   per cent, so index.html can carry the words — and, for a road, the angle to
   set them at. Guessing that angle by eye is how you end up with a street
   name running across the grain of its own street; this is measured from the
   geometry. Normalised to keep the words upright rather than mirrored. */
function note(name, kind, pts) {
  if (!name || !pts.length) return;
  const inside = pts.filter(p => p[0] > -20 && p[0] < W + 20 && p[1] > -20 && p[1] < H + 20);
  if (!inside.length) return;
  const x = inside.reduce((s, p) => s + p[0], 0) / inside.length;
  const y = inside.reduce((s, p) => s + p[1], 0) / inside.length;

  /* The bearing of the run through the centroid, weighted by segment length
     so a kink at one end does not swing it. */
  let sx = 0, sy = 0;
  for (let i = 0; i < inside.length - 1; i++) {
    let dx = inside[i + 1][0] - inside[i][0], dy = inside[i + 1][1] - inside[i][1];
    if (dx < 0) { dx = -dx; dy = -dy; }          // one half-plane, so opposites do not cancel
    const w = Math.hypot(dx, dy);
    sx += dx * w; sy += dy * w;
  }
  let rot = Math.round(Math.atan2(sy, sx) * 180 / Math.PI);
  if (rot > 90) rot -= 180; else if (rot < -90) rot += 180;

  labels.push({ name, kind, left: (x / W * 100).toFixed(1), top: (y / H * 100).toFixed(1), rot });
}

/* The coastline is an open line with the land on its left. To wash the sea in
   I close it into a ring far off the west side, then clip that to the frame. */
const coast = [];
for (const e of els) if (tags(e).natural === 'coastline') coast.push(e);
if (coast.length) {
  const chain = joinChains(coast.map(e => (e.geometry || []).map(p => [p.lat, p.lon])));
  for (const c of chain) {
    if (c.length < 2) continue;
    const far = CENTRE.lon - halfLon * 4;
    const ring = [[c[0][0], far], ...c, [c[c.length - 1][0], far]]
      .map(([lat, lon]) => project(lat, lon));
    const cl = clipPoly(ring);
    if (cl.length > 2) layers.sea.push(rdp(cl, 0.5));
  }
}

/* Head-to-tail joining, so a coastline split across four ways is one ring. */
function joinChains(ways) {
  const out = [];
  const left = ways.filter(w => w.length > 1);
  while (left.length) {
    let cur = left.shift();
    let joined = true;
    while (joined) {
      joined = false;
      for (let i = 0; i < left.length; i++) {
        const w = left[i], a = cur[0], b = cur[cur.length - 1];
        const same = (p, q) => p[0] === q[0] && p[1] === q[1];
        if (same(b, w[0]))                       { cur = [...cur, ...w.slice(1)]; }
        else if (same(b, w[w.length - 1]))       { cur = [...cur, ...w.slice(0, -1).reverse()]; }
        else if (same(a, w[w.length - 1]))       { cur = [...w.slice(0, -1), ...cur]; }
        else if (same(a, w[0]))                  { cur = [...w.slice(1).reverse(), ...cur]; }
        else continue;
        left.splice(i, 1); joined = true; break;
      }
    }
    out.push(cur);
  }
  return out;
}

for (const e of els) {
  const t = tags(e);

  if (e.type === 'relation' && t.natural === 'water') {
    for (const m of e.members || []) {
      const pts = (m.geometry || []).map(p => project(p.lat, p.lon));
      if (pts.length < 3) continue;
      const cl = clipPoly(pts);
      if (cl.length > 2) layers[m.role === 'inner' ? 'hole' : 'water'].push(rdp(cl, 0.5));
    }
    note(t.name, 'water', (e.members || [])
      .filter(m => m.role === 'outer')
      .flatMap(m => (m.geometry || []).map(p => project(p.lat, p.lon))));
    continue;
  }

  const pts = geom(e);
  if (pts.length < 2) continue;

  if (e.id === VENUE_WAY) { const cl = clipPoly(pts); if (cl.length > 2) layers.venue.push(cl); continue; }
  if (t.natural === 'water' || t.waterway === 'riverbank') {
    const cl = clipPoly(pts); if (cl.length > 2) layers.water.push(rdp(cl, 0.5));
    note(t.name, 'water', pts); continue;
  }
  if (t.leisure === 'park' || t.leisure === 'garden') {
    const cl = clipPoly(pts); if (cl.length > 2) layers.park.push(rdp(cl, 0.6));
    note(t.name, 'park', pts); continue;
  }
  /* Sidings and crossovers are the Fort marshalling yard — three dozen
     parallel dashes that read as a scribble at this scale. Running lines
     only. */
  if (t.railway) {
    if (!t.service) for (const r of clipLine(pts)) layers.rail.push(rdp(r, 0.5));
    continue;
  }
  if (t.waterway === 'canal' || t.waterway === 'river') continue;   // drawn as lines, below

  const hw = t.highway;
  if (hw) {
    const band = ROADS.findIndex(([kinds]) => kinds.includes(hw));
    if (band < 0) continue;
    for (const r of clipLine(pts)) roads[band].push(rdp(r, 0.35));
    if (band >= 3) note(t.name, hw, pts);
    continue;
  }
}
/* canals, as lines rather than areas */
const canals = [];
for (const e of els) {
  const t = tags(e);
  if (t.waterway === 'canal' || t.waterway === 'river') {
    for (const r of clipLine(geom(e))) canals.push(rdp(r, 0.5));
  }
}

/* ---------- write ---------- */

const path = (ds, attrs) => ds.length
  ? `  <path ${attrs} d="${ds.join('')}"/>\n` : '';

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">
  <rect width="${W}" height="${H}" fill="${C.paper}"/>
`;

svg += path(layers.sea.map(p => d(p, true)), `fill="${C.water}"`);
svg += layers.water.length || layers.hole.length
  ? `  <path fill="${C.water}" fill-rule="evenodd" d="${
      [...layers.water, ...layers.hole].map(p => d(p, true)).join('')}"/>\n` : '';
svg += path(layers.park.map(p => d(p, true)), `fill="${C.park}"`);
svg += path([...layers.sea, ...layers.water].map(p => d(p, true)),
  `fill="none" stroke="${C.waterIn}" stroke-width="1.4"`);
svg += path(canals.map(p => d(p)), `fill="none" stroke="${C.waterIn}" stroke-width="2.6" stroke-linecap="round"`);

svg += `  <g fill="none" stroke="${C.gold}" stroke-linecap="round" stroke-linejoin="round">\n`;
ROADS.forEach(([, w, a], i) => {
  if (!roads[i].length) return;
  svg += `    <path stroke-width="${w}" stroke-opacity="${a}" d="${roads[i].map(p => d(p)).join('')}"/>\n`;
});
svg += `  </g>\n`;

svg += path(layers.rail.map(p => d(p)),
  `fill="none" stroke="${C.ink}" stroke-opacity=".2" stroke-width="1.3" stroke-dasharray="6 7"`);

svg += path(layers.venue.map(p => d(p, true)),
  `fill="${C.crimson}" fill-opacity=".16" stroke="${C.crimson}" stroke-opacity=".75" stroke-width="2"`);

svg += `</svg>\n`;

writeFileSync(OUT, svg);

const kb = (svg.length / 1024).toFixed(1);
process.stdout.write(`assets/img/map.svg — ${kb} kB, ${GROUND_W} m across, centred on the venue\n`);
process.stdout.write(`  roads ${roads.map(r => r.length).join('/')}  water ${layers.water.length}  sea ${layers.sea.length}  park ${layers.park.length}  rail ${layers.rail.length}  venue ${layers.venue.length}\n\nLABELS (left%, top%)\n`);
const seen = new Set();
for (const l of labels.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))) {
  const key = l.kind + l.name; if (seen.has(key)) continue; seen.add(key);
  const r = `${l.rot > 0 ? '' : ''}${l.rot}deg`;
  process.stdout.write(`  --x:${(l.left + '%').padEnd(7)} --y:${(l.top + '%').padEnd(7)} --r:${r.padEnd(7)}  ${l.kind.padEnd(9)} ${l.name}\n`);
}
