// Oracle for the live cold start (tools and tests only): Mesen starts cold (AllZeros as
// in tools/mesen.mjs), takes one pad word per NMI from pads and returns the picture at
// the end of the frame before NMI k for each k in shots. The original's NMI count
// includes its lag NMIs, so the comparison with the lag-free native run
// (src/video/live-game.mjs) goes through the order of pictures.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { prepareScript, runMesen } from './mesen.mjs';

const ROM_PATH = fileURLToPath(new URL('../Shadowrun (E).smc', import.meta.url));
const WIDTH = 256,
  HEIGHT = 224,
  BORDERED_HEIGHT = 239,
  BORDER = 7,
  RGB = 3,
  RGBA = 4,
  OPAQUE = 255,
  ALPHA = 3,
  DEFAULT_TIMEOUT_MS = 900000,
  PAD_WORD_MAX = 0xffff,
  // The low four pad bits are the signature, never pressed buttons.
  PAD_SIGNATURE_BITS = 0xf,
  SHOT_PREFIX = 'SHOT ',
  HEX = 16,
  COLOUR_DIGITS = 2;
// A SHOT record: NMI, scanline, width, height and the RGB hex string.
const [SHOT_NMI, SHOT_SCANLINE, SHOT_WIDTH, SHOT_HEIGHT, SHOT_RGB] = [0, 1, 2, 3, 4]; // magic-number-ok: field positions
const rgbOf = (hex) =>
  Uint8Array.from(
    hex
      .match(/.{6}/g)
      .flatMap((h) =>
        [0, 1, 2].map((c) => parseInt(h.slice(c * COLOUR_DIGITS, (c + 1) * COLOUR_DIGITS), HEX)),
      ),
  );
// Mesen's video settings for unfiltered pictures (as for the former boot prefix capture).
const PICTURE_OVERRIDES = [
  '--video.videoFilter=None',
  '--video.brightness=0',
  '--video.contrast=0',
  '--video.hue=0',
  '--video.saturation=0',
  '--video.scanlineIntensity=0',
  '--video.screenRotation=None',
  '--snes.forceFixedResolution=false',
  '--snes.highResBlendMode=None',
];

export async function recordColdPictures(
  exe,
  { pads = [], shots, timeoutMs = DEFAULT_TIMEOUT_MS },
) {
  assert.ok(shots.length > 0 && shots.every((k) => Number.isSafeInteger(k) && k > 0));
  assert.ok(
    pads.every(
      (w) => Number.isInteger(w) && w >= 0 && w <= PAD_WORD_MAX && !(w & PAD_SIGNATURE_BITS),
    ),
    'standard pad words',
  );
  const script = prepareScript('trace-cold-pictures.lua', {
    PADS: '{' + pads.join(',') + '}',
    SHOTS: '{' + shots.map((k) => '[' + k + ']=true').join(',') + '}',
  });
  const pictures = new Map();
  let received = 0,
    announced = null,
    damage = null;
  const result = await runMesen(
    exe,
    ROM_PATH,
    script,
    (raw) => {
      if (damage || announced !== null) return;
      if (raw.startsWith('N ')) {
        announced = Number(raw.slice(2));
        return;
      }
      if (!raw.startsWith(SHOT_PREFIX)) return;
      try {
        const match = / #(\d+)$/.exec(raw);
        assert.ok(match, 'unsequenced picture record');
        assert.equal(Number(match[1]), ++received, 'damaged picture sequence');
        const t = raw.slice(SHOT_PREFIX.length, match.index).split(' ');
        pictures.set(Number(t[SHOT_NMI]), {
          k: Number(t[SHOT_NMI]),
          scanline: Number(t[SHOT_SCANLINE]),
          width: Number(t[SHOT_WIDTH]),
          height: Number(t[SHOT_HEIGHT]),
          rgb: rgbOf(t[SHOT_RGB]),
        });
      } catch (error) {
        damage = error;
      }
    },
    {
      timeoutMs,
      overrides: PICTURE_OVERRIDES,
      keep: () => !damage && announced !== null && announced === received,
    },
  );
  if (damage) throw damage;
  assert.equal(result.code, 0, 'Mesen cold picture run');
  assert.equal(announced, received, 'complete picture record');
  assert.deepEqual(
    [...pictures.keys()].sort((x, y) => x - y),
    [...shots].sort((x, y) => x - y),
    'every requested picture',
  );
  return pictures;
}

// An original picture as RGBA pixels of the 224 visible lines (a 239-line picture has
// black borders of 7 lines above and 8 below).
export function originalPixels(video) {
  assert.equal(video.width, WIDTH);
  assert.ok([HEIGHT, BORDERED_HEIGHT].includes(video.height), 'original noninterlaced frame');
  const top = video.height === BORDERED_HEIGHT ? BORDER : 0,
    pixels = new Uint8ClampedArray(WIDTH * HEIGHT * RGBA);
  if (top) {
    assert.ok(
      video.rgb.subarray(0, top * WIDTH * RGB).every((v) => v === 0),
      'original top border',
    );
    assert.ok(
      video.rgb.subarray((top + HEIGHT) * WIDTH * RGB).every((v) => v === 0),
      'original bottom border',
    );
  }
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      const src = ((y + top) * WIDTH + x) * RGB,
        dst = (y * WIDTH + x) * RGBA;
      pixels[dst] = video.rgb[src];
      pixels[dst + 1] = video.rgb[src + 1];
      pixels[dst + 2] = video.rgb[src + 2];
      pixels[dst + ALPHA] = OPAQUE;
    }
  return pixels;
}
