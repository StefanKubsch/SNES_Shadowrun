// Synthetic picture fixtures for the manual-contract video tests: the register-free
// picture back end (src/video/picture-video.mjs) over a flat 24-bit memory, written
// through its register interface, and rendered by src/video/frame-renderer.mjs.
import { PictureVideo } from '../src/video/picture-video.mjs';
import { renderFrame } from '../src/video/frame-renderer.mjs';
import { SCREEN_WIDTH } from '../src/constants/ppu.mjs';

const ADDRESS_SPACE = 1 << 24,
  OAM_BYTES = 544,
  OAM_HIGH_TABLE = 512,
  SPRITE_PARTS = ['x', 'y', 'name', 'attributes'],
  OAM_PART_MASK = 3,
  OAM_ENTRY_SHIFT = 2,
  RGBA_BYTES = 4;

// The DMA channel set-up of live play as [mode, B-bus port, bank] per channel (measured
// on the golden scenarios 2026-11-26): channels 2-7 keep the set-up of the font upload
// 81:AB2C and the scene lists (OAM, VRAM, CGRAM, the text read-back, the fixed fill from
// bank 81, VRAM); 0 and 1 change with each transfer.
const LIVE_CHANNELS = [
  [0x01, 0x2118, 0x7e],
  [0x01, 0x2118, 0x7e],
  [0x00, 0x2104, 0x7e],
  [0x01, 0x2118, 0x7e],
  [0x00, 0x2122, 0x8d],
  [0x81, 0x2139, 0x7e],
  [0x09, 0x2118, 0x81],
  [0x01, 0x2118, 0x7e],
];
// Gives a picture the channel set-up of live play: lifted code relies on the channels the
// game set up earlier.
export function setLiveChannels(picture) {
  LIVE_CHANNELS.forEach(([mode, port, bank], n) =>
    Object.assign(picture.channels[n], { mode, port, bank }),
  );
  return picture;
}

// A flat 24-bit address space as CPU memory.
export function flatMemory() {
  const bytes = new Uint8Array(ADDRESS_SPACE);
  return { bytes, read8: (a) => bytes[a], write8: (a, v) => (bytes[a] = v) };
}

// A picture back end over memory (a flat one by default), with the CPU register
// hardware write ignored.
export function newPicture(memory = flatMemory()) {
  const picture = new PictureVideo(memory);
  picture.system = () => {};
  return picture;
}

// Register bytes as [port, value] pairs, in order.
export function writeRegisters(picture, pairs) {
  for (const [port, value] of pairs) picture.writeRegister(port, value);
}

// The sprite fields as writable OAM bytes: the low table's four bytes per sprite, then
// the size bytes (the layout the OAM port writes).
export function oamBytes(picture) {
  const s = picture.sprites,
    slot = (n) =>
      n >= OAM_HIGH_TABLE
        ? [s.sizes, n - OAM_HIGH_TABLE]
        : [s[SPRITE_PARTS[n & OAM_PART_MASK]], n >>> OAM_ENTRY_SHIFT];
  const put = (n, value) => {
    const [array, at] = slot(n);
    array[at] = value;
  };
  const methods = {
    length: OAM_BYTES,
    set(values, offset = 0) {
      Array.from(values).forEach((value, n) => put(offset + n, value));
    },
    fill(value, start = 0, end = OAM_BYTES) {
      for (let n = start; n < end; n++) put(n, value);
    },
  };
  const index = (key) => (typeof key === 'string' && /^\d+$/.test(key) ? Number(key) : -1);
  return new Proxy(methods, {
    get(target, key) {
      const n = index(key);
      if (n < 0) return target[key];
      const [array, at] = slot(n);
      return array[at];
    },
    set(target, key, value) {
      const n = index(key);
      if (n < 0) throw new Error(`oamBytes has no property ${String(key)}`);
      put(n, value);
      return true;
    },
  });
}

// The picture as RGBA pixels.
export const frameOf = (picture) => renderFrame(picture.describe());
export const pixel = (frame, x, y) => {
  const at = (y * SCREEN_WIDTH + x) * RGBA_BYTES;
  return Array.from(frame.subarray(at, at + RGBA_BYTES));
};
