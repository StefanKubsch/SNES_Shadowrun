// Random per-function tests of the lifted title (src/frontend/title.mjs and the
// title objects of src/intro/intro-objects.mjs) against the register-level reference
// (proof/frontend-reference/title.mjs) for the edge cases the live sessions of
// tools/title-lift.test.mjs do not reach (docs/MATRIX-LIFT.md): prologue lines of
// every length and position, the window at its limits, every blend step, positions
// at and around the upload table entries and the pan end, speeds at saturation,
// object slots and event lists at every phase.
import { DialogTestMemory, prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { TITLE_IGNORED_WRAM } from './live-title-plan.mjs';
import { sceneRuntime } from '../src/system/scene-runtime.mjs';
import { tableEntries } from '../src/data/named-tables.mjs';
import { startFarObject } from '../src/intro/intro-objects.mjs';
import {
  drawPrologueLine,
  fadeTitleBlend,
  handlePanObjects,
  handlePrologueNmi,
  handleTitleObjectsNmi,
  handleTitlePanNmi,
  handleTitleScrollNmi,
  moveTitleWindow,
} from '../src/frontend/title.mjs';
import { TITLE_REFERENCE_ROUTINES } from '../proof/frontend-reference/title.mjs';

const WRAM_BYTES = 0x20000,
  ROM = new DialogTestMemory(new Uint8Array(WRAM_BYTES)),
  NEAR_ANIMATIONS = 0x113e,
  NEAR_X = 0x115e,
  NEAR_Y = 0x117e,
  SLOT_WORDS = 16,
  NEAR_EVENT = 0x119e,
  FAR_EVENT = 0x11a0,
  FRAME_COUNTER = 0x11a2,
  PROLOGUE_TEXT = 0x62a8,
  WINDOW = 0x8ea8,
  DP_DELAY = 0x1c,
  DP_READ = 0x18,
  DP_SCROLL = 0x1e,
  DP_FRACTION = 0x1a,
  DP_SPEED = 0x1c,
  DP_POSITION = 0x1e,
  DP_UPLOAD = 0x18,
  // Offsets a slot can hold: those of picture words of the frame list 81:DADD.
  FRAME_OFFSETS = tableEntries(ROM, 'intro_frames').flatMap((frame, n) =>
    frame & 0x8000 ? [] : [n * 2],
  ),
  PAN_UPLOADS = tableEntries(ROM, 'frontend_vram_copies'),
  SCROLL_UPLOADS = tableEntries(ROM, 'frontend_vram_uploads'),
  NEAR_EVENTS = tableEntries(ROM, 'intro_events_e900'),
  FAR_EVENTS = tableEntries(ROM, 'intro_events_e971');

function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    pick = (list) => list[rnd(list.length)],
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(256);
  const word = (at, v) => {
    wram[at] = v & 255;
    wram[at + 1] = (v >>> 8) & 255;
  };
  // Prologue text: lines of printable characters ending with 00, some empty.
  let at = PROLOGUE_TEXT;
  for (let line = 0; line < 40; line++) {
    for (let n = rnd(4) ? rnd(31) : 0; n > 0; n--) wram[at++] = 0x20 + rnd(0x5f);
    wram[at++] = 0;
  }
  word(DP_READ, pick([0, 0, rnd(200), rnd(400)]));
  word(DP_SCROLL, pick([0, 8, 0xf8, 0xfff8, rnd(65536)]));
  word(DP_DELAY, rnd(65536));
  // The window H-DMA table: line counts at and near their limits.
  wram[WINDOW] = pick([0, 1, 2, 0x50, 0xff, rnd(256)]);
  wram[WINDOW + 3] = pick([0, 0xfe, 0xff, rnd(256)]);
  // Pan and scroll: positions at the upload entries and the pan end, speeds near the
  // saturation, upload offsets of every entry.
  const panPositions = PAN_UPLOADS.filter((_, n) => n % 3 === 0 && !(PAN_UPLOADS[n] & 0x8000));
  const scrollPositions = SCROLL_UPLOADS.filter((_, n) => n % 3 === 0);
  word(
    DP_POSITION,
    pick([0x401, 0x400, 0x3ff, 0, 0xffff, pick(panPositions), pick(scrollPositions), rnd(65536)]),
  );
  word(DP_SPEED, pick([0, 0xb0, 0xf82f, 0xf830, 0xffff, rnd(65536)]));
  word(DP_FRACTION, pick([0, 0xb0, 0xffff, rnd(65536)]));
  word(DP_UPLOAD, pick([0, 6, 12, 18, 24, 30, 36]));
  // Object slots and their events.
  for (let slot = 0; slot < SLOT_WORDS; slot++) {
    word(NEAR_ANIMATIONS + slot * 2, rnd(3) === 0 ? pick([0xffff, 0xfffe]) : pick(FRAME_OFFSETS));
    word(NEAR_X + slot * 2, pick([0, 0x80, 0x100, 0x1ff, 0xfff8, rnd(65536)]));
    word(NEAR_Y + slot * 2, rnd(0x100));
  }
  const nearEvent = rnd(NEAR_EVENTS.length / 3) * 6,
    farEvent = rnd(FAR_EVENTS.length / 3) * 6;
  word(NEAR_EVENT, nearEvent);
  word(FAR_EVENT, farEvent);
  word(
    FRAME_COUNTER,
    pick([NEAR_EVENTS[nearEvent / 2], FAR_EVENTS[farEvent / 2], 0, 3, 7, rnd(65536)]),
  );
  wram.set(
    [0, 1, 2].map((n) => ROM.read8(0x98fffa + 3 + n)),
    0x8c,
  );
  return { seed, wram, rnd, pick };
}

const CASES = [
  {
    name: 'drawPrologueLine 81:DE93',
    entry: 0x81de93,
    samples: 600,
    prepare: () => ({ bank: 0x7e }),
    lifted: (m) => drawPrologueLine(m.mem),
  },
  { name: 'moveTitleWindow 81:D81F', entry: 0x81d81f, lifted: (m) => moveTitleWindow(m.wram) },
  {
    name: 'fadeTitleBlend 81:D8E5',
    entry: 0x81d8e5,
    prepare: (s) => ({ x: s.rnd(0x18) }),
    lifted: (m, r) => fadeTitleBlend(m, r.x),
  },
  {
    name: 'handlePrologueNmi 81:DD54',
    entry: 0x81dd54,
    long: true,
    lifted: (m) => handlePrologueNmi(m.h),
  },
  {
    name: 'handleTitleObjectsNmi 81:DAD6',
    entry: 0x81dad6,
    long: true,
    samples: 600,
    lifted: (m) => handleTitleObjectsNmi(m.h),
  },
  {
    name: 'handlePanObjects 81:D9D5',
    entry: 0x81d9d5,
    long: true,
    lifted: (m) => handlePanObjects(m.h),
  },
  {
    name: 'handleTitlePanNmi 81:D93E',
    entry: 0x81d93e,
    long: true,
    samples: 600,
    lifted: (m) => handleTitlePanNmi(m.h),
  },
  {
    name: 'handleTitleScrollNmi 81:DCAC',
    entry: 0x81dcac,
    long: true,
    samples: 600,
    lifted: (m) => handleTitleScrollNmi(m.h),
  },
  {
    name: 'startFarObject 81:E971',
    entry: 0x81e971,
    long: true,
    prepare: (s) => ({ x: s.rnd(65536), y: s.rnd(65536) }),
    lifted: (m, r) => startFarObject(m, r.x, r.y),
  },
];

registerCases(CASES, {
  sample,
  side: (s) => createSide(s, TITLE_REFERENCE_ROUTINES),
  runtime: sceneRuntime,
  ignored: TITLE_IGNORED_WRAM,
  outside: new Set([
    'intro_table_index_frontier',
    'intro_oam_frontier',
    'title_table_index_frontier',
  ]),
});
