"""
Regenerate the swinging-lantern assets from the source illustration.

You only need this if you swap the artwork or change which lamps move.

    pip install pillow numpy scipy
    python tools/extract_lanterns.py path/to/original.png

What it does
------------
The lamps are painted into the illustration, so they cannot move on their own.
This script:
  1. erases each lamp and the lower part of its chain from the painting,
     rebuilding the background behind it (vertical interpolation keeps the
     pillars and gold lines intact, horizontal interpolation heals the chains),
  2. cuts each lamp out as a transparent sprite, using the difference between
     the original and the rebuilt background as the alpha channel,
  3. writes assets/img/painting.webp and assets/img/lantern-01..04.webp,
  4. prints the CSS positions to paste back into index.html.

COORDS below are in pixels of the 1024x1536 source image:
  cx  - x of the chain, i.e. the point the lamp pivots around
  py  - y where the chain meets the arch (the pivot / top of the sprite)
  x0,x1,y0,y1 - box that fully contains the lamp
  flame - x,y of the flame, where the glow is anchored
"""

import sys, os, json
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

IW, IH = 1024, 1536
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'img')

COORDS = {
    'lantern-01': dict(cx=341, py=248, x0=298, x1=386, y0=284, y1=478,  flame=(341, 392)),
    'lantern-02': dict(cx=709, py=248, x0=666, x1=754, y0=284, y1=478,  flame=(709, 392)),
    'lantern-03': dict(cx=152, py=545, x0=104, x1=212, y0=628, y1=848,  flame=(155, 735)),
    'lantern-04': dict(cx=933, py=498, x0=880, x1=990, y0=768, y1=1028, flame=(932, 912)),
}
CHAIN_HALF_WIDTH = 12


def main(src_path):
    src = Image.open(src_path).convert('RGB')
    if src.size != (IW, IH):
        print(f'note: source is {src.size}, coordinates assume {(IW, IH)}')
    A = np.array(src).astype(np.float64)
    plate = A.copy()

    # 1a. heal the chain segments (thin vertical strips -> interpolate sideways)
    for v in COORDS.values():
        x0, x1 = v['cx'] - CHAIN_HALF_WIDTH, v['cx'] + CHAIN_HALF_WIDTH
        y0, y1 = v['py'], v['y0']
        left = plate[y0:y1, x0 - 5:x0 - 1].mean(1)
        right = plate[y0:y1, x1 + 1:x1 + 5].mean(1)
        t = np.linspace(0, 1, x1 - x0)[None, :, None]
        plate[y0:y1, x0:x1] = left[:, None, :] * (1 - t) + right[:, None, :] * t

    # 1b. heal the lamp boxes (interpolate downwards -> vertical structure survives)
    for v in COORDS.values():
        x0, x1, y0, y1 = v['x0'], v['x1'], v['y0'], v['y1']
        top = plate[y0 - 8:y0 - 2, x0:x1].mean(0)
        bot = plate[y1 + 2:y1 + 8, x0:x1].mean(0)
        t = np.linspace(0, 1, y1 - y0)[:, None, None]
        plate[y0:y1, x0:x1] = top[None, :, :] * (1 - t) + bot[None, :, :] * t

    # soften the seams so the patch melts into the watercolour
    plate_img = Image.fromarray(plate.clip(0, 255).astype(np.uint8))
    blur = np.array(plate_img.filter(ImageFilter.GaussianBlur(2.4))).astype(np.float64)
    m = np.zeros(A.shape[:2])
    for v in COORDS.values():
        m[v['py']:v['y1'] + 5, v['cx'] - CHAIN_HALF_WIDTH - 5:v['cx'] + CHAIN_HALF_WIDTH + 5] = 1
        m[v['y0'] - 5:v['y1'] + 5, v['x0'] - 5:v['x1'] + 5] = 1
    m = ndimage.gaussian_filter(m, 3.2)[:, :, None]
    plate = plate * (1 - m * 0.6) + blur * (m * 0.6)

    os.makedirs(OUT, exist_ok=True)
    pi = Image.fromarray(plate.clip(0, 255).astype(np.uint8))
    pi.resize((920, round(920 * IH / IW)), Image.LANCZOS).save(
        os.path.join(OUT, 'painting.webp'), 'WEBP', quality=84, method=6)

    # 2. cut the sprites
    for name, v in COORDS.items():
        x0, x1, y0, y1 = v['x0'], v['x1'], v['py'], v['y1']
        orig, bg = A[y0:y1, x0:x1], plate[y0:y1, x0:x1]
        d = np.abs(orig - bg).sum(2)
        alpha = np.clip((d - 14) / 58, 0, 1)
        solid = ndimage.binary_fill_holes(ndimage.binary_closing(alpha > 0.28, np.ones((5, 5))))
        solid = ndimage.binary_dilation(solid, np.ones((3, 3)))
        alpha = ndimage.gaussian_filter(np.maximum(alpha, solid.astype(float)), 0.9)
        sp = Image.fromarray(np.dstack([orig, np.clip(alpha, 0, 1) * 255]).astype(np.uint8), 'RGBA')
        sp = sp.resize((round(sp.width * 1.5), round(sp.height * 1.5)), Image.LANCZOS)
        sp.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=88, method=6)

    # 3. print the markup values
    print('\nPaste these into the .lantern elements in index.html:\n')
    for name, v in COORDS.items():
        bw, bh = v['x1'] - v['x0'], v['y1'] - v['py']
        print(f"  {name}: left:{v['x0']/IW*100:.3f}%; top:{v['py']/IH*100:.3f}%; "
              f"width:{bw/IW*100:.3f}%; transform-origin:{(v['cx']-v['x0'])/bw*100:.2f}% 0")
        print(f"      glow: left:{(v['flame'][0]-v['x0'])/bw*100:.2f}%; "
              f"top:{(v['flame'][1]-v['py'])/bh*100:.2f}%")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
