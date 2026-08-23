/* Bakes the soft edge of an "our story" picture into its alpha channel.
 *
 *   npm i --no-save sharp        # not a project dependency; see CLAUDE.md
 *
 * Every one of the six story images was produced by this tool. The commands,
 * so they stay reproducible:
 *
 *   node tools/feather_portrait.mjs new_image/IMG_5677.JPG.jpeg
 *   node tools/feather_portrait.mjs new_image/IMG_5383.PNG assets/img/first-date.webp --width=640
 *   node tools/feather_portrait.mjs new_image/IMG_5382.PNG assets/img/homecoming.webp --width=640
 *   node tools/feather_portrait.mjs new_image/IMG_5747.PNG assets/img/bench.webp      --width=640 --fade=0.08,0.16
 *   node tools/feather_portrait.mjs new_image/IMG_5380.PNG assets/img/graduation.webp --width=640 --fade=0.08,0.16
 *   node tools/feather_portrait.mjs new_image/IMG_5384.PNG assets/img/proposal.webp \
 *     --width=640 --fade=0.06,0.12 --crop=120,40,903,1090
 *
 * The three with a stretched y fade are the three whose bottom edge is content
 * rather than wash — the two landscapes and the proposal. See the note on FADE
 * below; judged against the blush, not against white.
 *
 * Why the file carries the fade rather than css/styles.css: feathering all
 * four sides in CSS needs two mask layers intersected, and mask-composite is
 * the one part of CSS masking the engines still disagree about — Chrome
 * blanks the element outright for some of the spelling variants. The lantern
 * sprites already solve exactly this problem by shipping their own alpha, so
 * this does the same. The wash these are painted on is a shade off --blush,
 * and the fade is what stops the rectangle reading as a photograph pasted
 * onto the invitation.
 *
 * FADE is a fraction of each axis, applied independently. Keep it clear of the
 * figures: on the wedding portrait 0.08 stops just short of the groom's hair,
 * and widening it starts to eat him.
 *
 * The defaults below are the wedding portrait's, so the bare two-argument
 * invocation above still reproduces couple.webp byte for byte. Worth
 * re-checking with shasum if you ever touch this file.
 *
 *   --width=  output width in px           (default 960)
 *   --fade=   fraction, or x,y             (default 0.08)
 *   --crop=x,y,w,h  extract before resize  (default: none)
 *
 * --crop earns its place on IMG_5384, the proposal. It is the one source that
 * does not behave like the others: its wash is warm beige rather than blush,
 * and its composition runs to all four edges — foreground table, plates,
 * balloons on the floor. Feathered whole, the fade cuts a vignette straight
 * through the tablecloth. Cropped to the figures, the cake and the banner,
 * the fade lands on the flat wall wash where it belongs.
 */
import sharp from 'sharp';

const argv  = process.argv.slice(2);
const flag  = n => argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const pos   = argv.filter(a => !a.startsWith('--'));

const SRC   = pos[0] || 'new_image/IMG_5677.JPG.jpeg';
const OUT   = pos[1] || 'assets/img/couple.webp';
const WIDTH = Number(flag('width') ?? 960);   // ~2x the size the page draws it at
const FADE  = (flag('fade') ?? '0.08').split(',').map(Number);
const CROP  = flag('crop')?.split(',').map(Number);
const Q     = 72;

/* One number fades both axes; two are x,y. Two exist because FADE is a
   *fraction* of each axis, so a short axis gets a small absolute band: at 0.08
   the 1487px-tall portrait fades over 119px and a 452px-tall landscape over 36.
   Where the bottom of the frame is content rather than wash — the graduation
   gowns run straight off it — 36px cannot take a solid black down to nothing
   and you get a hard dark line, which is the exact "pasted on" failure the
   feather exists to prevent. The fix is a longer fade down that axis only;
   widening both would eat into the figures at the sides. */
const [FX, FY] = FADE.length === 1 ? [FADE[0], FADE[0]] : FADE;

if (!Number.isFinite(WIDTH) || WIDTH <= 0) throw new Error('--width must be a positive number');
if (FADE.length > 2) throw new Error('--fade takes one number or two: x,y');
for (const f of [FX, FY])
  if (!Number.isFinite(f) || f <= 0 || f >= 0.5) throw new Error('--fade must be between 0 and 0.5');
if (CROP && (CROP.length !== 4 || CROP.some(n => !Number.isFinite(n))))
  throw new Error('--crop must be four numbers: x,y,w,h');

/* smoothstep — a linear ramp leaves a visible crease where it meets the
   opaque middle, because the eye picks up the discontinuity in the slope. */
const ramp = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/* Resize to a buffer first and open that buffer for the join. Reusing one
   pipeline across clone()/toBuffer() and then joining onto it produced a
   plain VP8 file with the fade burnt into the RGB against white — the edge
   went pale instead of transparent, which over a blush page is a halo. */
let pipe = sharp(SRC);
if (CROP) {
  const [left, top, width, height] = CROP;
  pipe = pipe.extract({ left, top, width, height });
}
const { data, info } = await pipe
  .resize({ width: WIDTH })
  .toBuffer({ resolveWithObject: true });

const { width, height } = info;
const fx = Math.max(1, Math.round(width  * FX));
const fy = Math.max(1, Math.round(height * FY));
const alpha = Buffer.allocUnsafe(width * height);

for (let y = 0; y < height; y++) {
  const ay = ramp(Math.min(y, height - 1 - y) / fy);
  for (let x = 0; x < width; x++) {
    const ax = ramp(Math.min(x, width - 1 - x) / fx);
    alpha[y * width + x] = Math.round(ax * ay * 255);
  }
}

const out = sharp(data)
  .joinChannel(alpha, { raw: { width, height, channels: 1 } })
  .webp({ quality: Q, alphaQuality: 90, effort: 6 });

const written = await out.toFile(OUT);
if (!(await sharp(OUT).metadata()).hasAlpha) {
  throw new Error('no alpha channel in ' + OUT + ' — the fade did not survive');
}
console.log(`${OUT}  ${width}x${height}  fade ${fx}x${fy}px  ${(written.size / 1024).toFixed(0)}KB`);
