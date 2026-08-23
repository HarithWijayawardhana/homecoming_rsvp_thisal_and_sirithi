/* Cuts the five floral ornaments out of the sheet they were painted on.
 *
 *   npm i --no-save sharp        # not a project dependency; see CLAUDE.md
 *   node tools/extract_ornaments.mjs "new_image/ChatGPT Image Aug 22, 2026, 10_59_38 AM.png"
 *
 * That one command writes all five of assets/img/orn-*.webp. There are no
 * options: every number here is tied to this one 1536x1024 sheet.
 *
 * The problem. The sheet is five ornaments painted on a haze that runs from
 * black in the corners, through a smoky brown, to a near-white pink behind
 * each ornament — and the page they have to live on is --blush. So the haze
 * has to become alpha, and no single test finds it:
 *
 *   - Brightness fails. The haze behind the middle spray is (204,164,134),
 *     brighter than half the leaves anywhere else on the sheet.
 *   - "Brighter than its surroundings" fails too: the haze's own gradient is
 *     steep enough that it is locally brighter than its surroundings as well.
 *   - Colour gets most of the way there. Sampled over the sheet's empty strips
 *     (HAZE below) the haze traces one tight curve through RGB — G/R holds at
 *     .75 and B/R climbs from .35 in the darks to .62 in the brights, with no
 *     second branch anywhere — so distance from that curve keys the flowers,
 *     the sage leaves and the gold with no spatial term to be fooled by a
 *     gradient. What it cannot do is the pale petals of the big blooms: in the
 *     bright middle of the sheet a white-pink petal and the white-pink glow
 *     behind it are the same colour to within a few levels.
 *   - Structure finishes the job. The haze and its glow are smooth (|I-blur|
 *     runs 0.6 through the darks and 1.7 in the glow); watercolour never is
 *     (15 across a petal, 6 across a leaf). So an edge term catches what the
 *     colour term misses, and a hole fill solidifies what both leave hollow.
 *
 * Then: rebuild the haze behind the elements by diffusion from the pixels the
 * mask does not claim, and unpremultiply it off the colour — without that the
 * cut-out carries the brown it was painted against and reads muddy. Finally
 * push the solid colour outwards into the soft rims: dividing by a small alpha
 * there amplifies noise into fireflies, and clamping the divisor instead
 * leaves a dark halo, which on a light page is the one artefact you cannot
 * miss.
 *
 * Two things that cost an afternoon, in case they come up again:
 *   - Blurring is done here (`box`) and not by sharp. `sharp(raw).blur(s)
 *     .raw()` hands back a buffer that is 70% zeros — it writes a PNG fine,
 *     but the raw path out of it is not usable, and a corrupt blur shows up as
 *     comb-stripe artefacts across the finished ornament.
 *   - The hole fill is capped by area (CAP). The ogee arch is a closed gold
 *     outline, so an uncapped fill floods its inside and hands you a solid
 *     gold tombstone.
 *
 * The bands are separated by empty rows, so PIECES only has to be roughly
 * right — the trim finds the real edges. Widths are 2x the max-width each
 * .orn--* modifier gets in css/styles.css; nothing here is upscaled.
 */

import sharp from 'sharp';
import { existsSync } from 'node:fs';

const SRC = process.argv[2];
if (!SRC || !existsSync(SRC)) {
  console.error('usage: node tools/extract_ornaments.mjs <sheet.png>');
  process.exit(1);
}

/* empty strips of the sheet, x,y,w,h — the haze and nothing but the haze */
const HAZE = [
  [40, 190, 1450, 30], [40, 360, 1450, 20], [60, 560, 160, 60],
  [40, 700, 300, 40], [900, 660, 400, 60], [60, 960, 1400, 50],
  [600, 180, 300, 40],
];

/* x0,y0,x1,y1 of each band, generous; out = file, w = output width */
const PIECES = [
  { out: 'orn-spray.webp',   box: [ 20,   4, 1516,  190], w: 1120 },
  { out: 'orn-arch.webp',    box: [ 55, 196, 1478,  368], w: 1040 },
  { out: 'orn-garland.webp', box: [ 35, 380, 1498,  542], w: 1240 },
  { out: 'orn-bloom.webp',   box: [215, 552, 1316,  664], w:  840 },
  { out: 'orn-foot.webp',    box: [ 10, 645, 1520, 1012], w: 1200 },
];

const KEY   = [10, 32];    /* distance from the haze curve -> alpha */
const EDGE  = [2, 8];      /* |I - blur(I)| -> alpha */
const CLOSE = 2;           /* px, knits the two masks into one contour */
const CAP   = 4000;        /* px, the largest hole worth filling */
const SPECK = 260;         /* px, the largest island worth dropping */
const RIM   = 4;           /* px, how far solid colour is pushed outwards */
const S     = 8;           /* the haze is rebuilt at 1/8 scale */
const QUAL  = 80;

const { data: I, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const N = W * H;

/* three box passes ~ one gaussian; see the note above on sharp's blur */
const box = (src, ch, r, passes = 3) => {
  let a = Float32Array.from(src), b = new Float32Array(src.length);
  const cl = (v, hi) => Math.min(hi, Math.max(0, v));
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++) for (let c = 0; c < ch; c++) {
      const row = y * W; let s = 0;
      for (let x = -r; x <= r; x++) s += a[(row + cl(x, W - 1)) * ch + c];
      for (let x = 0; x < W; x++) {
        b[(row + x) * ch + c] = s / (2 * r + 1);
        s += a[(row + cl(x + r + 1, W - 1)) * ch + c] - a[(row + cl(x - r, W - 1)) * ch + c];
      }
    }
    [a, b] = [b, a];
    for (let x = 0; x < W; x++) for (let c = 0; c < ch; c++) {
      let s = 0;
      for (let y = -r; y <= r; y++) s += a[(cl(y, H - 1) * W + x) * ch + c];
      for (let y = 0; y < H; y++) {
        b[(y * W + x) * ch + c] = s / (2 * r + 1);
        s += a[(cl(y + r + 1, H - 1) * W + x) * ch + c] - a[(cl(y - r, H - 1) * W + x) * ch + c];
      }
    }
    [a, b] = [b, a];
  }
  return a;
};

/* ---- 1. the haze curve ---- */
const acc = Array.from({ length: 256 }, () => [0, 0, 0]);
for (const [x, y, bw, bh] of HAZE)
  for (let yy = y; yy < y + bh; yy++)
    for (let xx = x; xx < x + bw; xx++) {
      const i = (yy * W + xx) * 3, a = acc[I[i]];
      a[0]++; a[1] += I[i + 1]; a[2] += I[i + 2];
    }
const cg = new Float32Array(256), cb = new Float32Array(256);
let last = -1;
for (let r = 0; r < 256; r++) {
  if (acc[r][0] < 40) continue;
  cg[r] = acc[r][1] / acc[r][0]; cb[r] = acc[r][2] / acc[r][0];
  for (let k = last + 1; k < r; k++) {                /* bridge the empty bins */
    const g0 = last < 0 ? 0 : cg[last], b0 = last < 0 ? 0 : cb[last];
    const t = last < 0 ? 1 : (k - last) / (r - last);
    cg[k] = g0 + t * (cg[r] - g0); cb[k] = b0 + t * (cb[r] - b0);
  }
  last = r;
}
for (let r = last + 1; r < 256; r++) {                /* extend past the brightest sample */
  const s = r - last;
  cg[r] = Math.min(255, cg[last] + s * (cg[last] - cg[last - 20]) / 20);
  cb[r] = Math.min(255, cb[last] + s * (cb[last] - cb[last - 20]) / 20);
}
const smooth = a => {
  const o = Float32Array.from(a);
  for (let r = 3; r < 253; r++) o[r] = (a[r-3]+a[r-2]+a[r-1]+a[r]+a[r+1]+a[r+2]+a[r+3]) / 7;
  return o;
};
const CG = smooth(smooth(cg)), CB = smooth(smooth(cb));

/* ---- 2. colour term, edge term, and the mask they make together ---- */
const BL = box(I, 3, 2);
let A = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const r = I[i*3], g = I[i*3+1], b = I[i*3+2];
  let best = Infinity;
  for (let k = Math.max(0, r - 90); k < 256; k++) {   /* the curve is monotone in R */
    const d = (k - r) ** 2 + (CG[k] - g) ** 2 + (CB[k] - b) ** 2;
    if (d < best) best = d;
  }
  let e = 0;
  for (let c = 0; c < 3; c++) e = Math.max(e, Math.abs(I[i*3+c] - BL[i*3+c]));
  const col = (Math.sqrt(best) - KEY[0]) / (KEY[1] - KEY[0]);
  const edg = (e - EDGE[0]) / (EDGE[1] - EDGE[0]);
  A[i] = Math.min(1, Math.max(0, Math.max(col, edg)));
}

const morph = (src, r, fn) => {
  const t = new Float32Array(N), o = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = src[y*W+x];
    for (let d = -r; d <= r; d++) v = fn(v, src[y*W + Math.min(W-1, Math.max(0, x+d))]);
    t[y*W+x] = v;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = t[y*W+x];
    for (let d = -r; d <= r; d++) v = fn(v, t[Math.min(H-1, Math.max(0, y+d))*W + x]);
    o[y*W+x] = v;
  }
  return o;
};
A = morph(morph(A, CLOSE, Math.max), CLOSE, Math.min);

/* one flood fill over the mask's complement and over the mask itself: the
   first solidifies the hollows inside a petal, the second drops the specks
   the sheet's own grain leaves behind — a pink dot floating beside a divider
   is the artefact that reads as a mistake rather than as watercolour */
const flood = (inside, visit) => {
  const seen = new Uint8Array(N), stack = new Int32Array(N);
  for (let start = 0; start < N; start++) {
    if (seen[start] || !inside(A[start])) continue;
    const cells = []; let top = 0, border = false;
    stack[top++] = start; seen[start] = 1;
    while (top) {
      const p = stack[--top]; cells.push(p);
      const x = p % W, y = (p - x) / W;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) border = true;
      for (const q of [x > 0 ? p-1 : -1, x < W-1 ? p+1 : -1, y > 0 ? p-W : -1, y < H-1 ? p+W : -1])
        if (q >= 0 && !seen[q] && inside(A[q])) { seen[q] = 1; stack[top++] = q; }
    }
    visit(cells, border);
  }
};
flood(a => a < 0.5, (cells, border) => {
  if (!border && cells.length <= CAP) for (const p of cells) A[p] = 1;
});
flood(a => a > 0.02, cells => {
  let sum = 0, max = 0;
  for (const p of cells) { sum += A[p]; if (A[p] > max) max = A[p]; }
  const mean = sum / cells.length;
  const junk = cells.length <= SPECK          /* a speck */
    || max < 0.25                              /* a ghost */
    || (mean < 0.3 && cells.length < 20000);   /* a wash with nothing in it */
  if (junk) for (const p of cells) A[p] = 0;
});

/* ---- 3. rebuild the haze behind the elements ---- */
const w = (W / S) | 0, h = (H / S) | 0;
const { data: small } = await sharp(SRC).removeAlpha()
  .resize({ width: w, height: h, fit: 'fill', kernel: 'lanczos3' })
  .raw().toBuffer({ resolveWithObject: true });
const unknown = new Uint8Array(w * h);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
  if (A[y*W+x] > 0.03) unknown[((y/S)|0) * w + ((x/S)|0)] = 1;
for (let k = 0; k < 2; k++) {                         /* slack for the soft rims */
  const t = new Uint8Array(unknown);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    if (!unknown[y*w+x] && [[1,0],[-1,0],[0,1],[0,-1]].some(([a, b]) =>
        x+a >= 0 && y+b >= 0 && x+a < w && y+b < h && unknown[(y+b)*w + x+a])) t[y*w+x] = 1;
  unknown.set(t);
}
const haze = Float32Array.from(small);
for (let it = 0; it < 3000; it++) {
  const next = Float32Array.from(haze);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!unknown[y*w+x]) continue;
    const x0 = Math.max(0,x-1), x1 = Math.min(w-1,x+1), y0 = Math.max(0,y-1), y1 = Math.min(h-1,y+1);
    for (let c = 0; c < 3; c++)
      next[(y*w+x)*3+c] = (haze[(y*w+x0)*3+c] + haze[(y*w+x1)*3+c]
                         + haze[(y0*w+x)*3+c] + haze[(y1*w+x)*3+c]) / 4;
  }
  haze.set(next);
}
const { data: B } = await sharp(Buffer.from(Uint8Array.from(haze, v => Math.round(v))),
  { raw: { width: w, height: h, channels: 3 } })
  .resize({ width: W, height: H, fit: 'fill', kernel: 'cubic' })
  .raw().toBuffer({ resolveWithObject: true });

/* ---- 4. unpremultiply, then push the colour out into the rims ---- */
const SOLID = 0.55;
const inner = new Float32Array(N * 3), wt = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const a = A[i];
  wt[i] = a >= SOLID ? 1 : 0;
  for (let c = 0; c < 3; c++) {
    const v = a > 0.02 ? (I[i*3+c] - (1 - a) * B[i*3+c]) / a : 0;
    inner[i*3+c] = Math.min(255, Math.max(0, v));
  }
}
const prem = new Float32Array(N * 3);
for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) prem[i*3+c] = inner[i*3+c] * wt[i];
const pb = box(prem, 3, RIM), wb = box(wt, 1, RIM);
const RGBA = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  const den = wb[i];
  for (let c = 0; c < 3; c++) {
    const outer = den > 0.004 ? pb[i*3+c] / den : inner[i*3+c];
    RGBA[i*4+c] = Math.round(Math.min(255, Math.max(0, wt[i] ? inner[i*3+c] : outer)));
  }
  RGBA[i*4+3] = Math.round(A[i] * 255);
}

/* ---- 5. crop, trim to the alpha, write ---- */
for (const { out, box: [x0, y0, x1, y1], w: outw } of PIECES) {
  let [tx0, ty0, tx1, ty1] = [Infinity, Infinity, -1, -1];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++)
    if (RGBA[(y*W+x)*4+3] > 24) {
      if (x < tx0) tx0 = x; if (x > tx1) tx1 = x;
      if (y < ty0) ty0 = y; if (y > ty1) ty1 = y;
    }
  const pad = 3;
  tx0 = Math.max(x0, tx0 - pad); ty0 = Math.max(y0, ty0 - pad);
  tx1 = Math.min(x1 - 1, tx1 + pad); ty1 = Math.min(y1 - 1, ty1 + pad);
  const cw = tx1 - tx0 + 1, ch = ty1 - ty0 + 1;
  const meta = await sharp(RGBA, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: tx0, top: ty0, width: cw, height: ch })
    .resize({ width: Math.min(outw, cw) })
    .webp({ quality: QUAL, alphaQuality: 92, effort: 6 })
    .toFile(`assets/img/${out}`);
  console.log(`${out.padEnd(18)} crop ${cw}x${ch} @ ${tx0},${ty0} -> ${meta.width}x${meta.height}`);
}
