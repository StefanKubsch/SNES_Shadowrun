// Random per-function tests of the lifted intro (src/intro) against the
// register-level reference (proof/intro-reference, proof/intro-reference/intro-setup.mjs)
// for the edge cases the live sessions of tools/intro-lift.test.mjs do not reach
// (docs/MATRIX-LIFT.md): every animation offset of the frame list, free and taken
// slots, positions off screen and at the word wrap, every frame counter phase, and
// both sound directories.
import { DialogTestMemory, prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { INTRO_IGNORED_WRAM } from './live-intro-plan.mjs';
import { sceneRuntime } from '../src/system/scene-runtime.mjs';
import { tableEntries } from '../src/data/named-tables.mjs';
import {
  addNearObject,
  clearIntroObjects,
  placeFirstNearObjects,
} from '../src/intro/intro-objects.mjs';
import {
  handleIntroNmi,
  setUpGameAudio,
  setUpIntroWindow,
  setUpTitleAudio,
} from '../src/intro/intro-scene.mjs';
import { loadSoundDirectory } from '../src/apu/music-mode.mjs';
import { INTRO_REFERENCE_ROUTINES } from '../proof/intro-reference/intro-scene.mjs';

const WRAM_BYTES = 0x20000,
  NEAR_ANIMATIONS = 0x113e,
  NEAR_X = 0x115e,
  NEAR_Y = 0x117e,
  SLOT_WORDS = 16,
  FRAME_COUNTER = 0x11a2,
  ROM = new DialogTestMemory(new Uint8Array(WRAM_BYTES)),
  // The offsets into the frame list 81:DF77 a slot can hold: those of picture words
  // (a negative word frees the slot or restarts its animation before it is drawn).
  FRAME_OFFSETS = tableEntries(ROM, 'intro_frames_df77').flatMap((frame, n) =>
    frame & 0x8000 ? [] : [n * 2],
  ),
  // The sound directory pointer the game keeps at 7E:008C (from 98:FFFA, 81:F092).
  SOUND_DIRECTORY = [0, 1, 2].map((n) => ROM.read8(0x98fffa + n));

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
  const position = () =>
    pick([0, 1, 0x40, 0x80, 0xf8, 0xff, 0x100, 0x108, 0xfff0, 0xfff8, 0xffff, rnd(0x140)]);
  // Slots: free (negative), or an even offset into the frame list, mostly drawn on screen.
  for (let slot = 0; slot < SLOT_WORDS; slot++) {
    word(
      NEAR_ANIMATIONS + slot * 2,
      rnd(3) === 0 ? pick([0xffff, 0x8000, 0xfffe]) : pick(FRAME_OFFSETS),
    );
    word(NEAR_X + slot * 2, position());
    word(NEAR_Y + slot * 2, position());
  }
  word(FRAME_COUNTER, pick([0, 3, 4, 0x63, 0x64, 0xffff, rnd(65536)]));
  wram.set(SOUND_DIRECTORY, 0x8c);
  wram[0x1ce6] = pick([0, 0, 0xff]);
  return { seed, wram, rnd, pick };
}

const CASES = [
  {
    name: 'handleIntroNmi 81:DF0E',
    entry: 0x81df0e,
    long: true,
    samples: 600,
    lifted: (m) => handleIntroNmi(m.h),
  },
  {
    name: 'addNearObject 81:E900',
    entry: 0x81e900,
    long: true,
    prepare: (s) => ({
      a: s.pick([0, 0x40, 0x100, 0xffff, s.rnd(65536)]),
      x: s.pick([0, 0x30, 0x80, 0xc0, 0xffc0, s.rnd(65536)]),
      y: s.rnd(65536),
    }),
    lifted: (m, r) => addNearObject(m, r.x, r.y, r.a),
  },
  {
    name: 'placeFirstNearObjects 81:DC43',
    entry: 0x81dc43,
    lifted: (m) => placeFirstNearObjects(m),
  },
  {
    name: 'clearIntroObjects 81:E8E5',
    entry: 0x81e8e5,
    long: true,
    lifted: (m) => clearIntroObjects(m.wram),
  },
  { name: 'setUpIntroWindow 81:D642', entry: 0x81d642, lifted: (m) => setUpIntroWindow(m) },
  {
    name: 'setUpTitleAudio 81:DDB1',
    entry: 0x81ddb1,
    long: true,
    lifted: (m) => setUpTitleAudio(m),
  },
  {
    // The whole sound upload of a directory, so few samples.
    name: 'loadSoundDirectory 81:F092',
    entry: 0x81f092,
    long: true,
    samples: 8,
    events: () => ({ calls: [] }),
    prepare: (s) => ({ a: s.pick([0, 3]) }),
    lifted: (m, r) => loadSoundDirectory(m.mem, m.port, r.a),
  },
  {
    name: 'setUpGameAudio 81:EF63',
    entry: 0x81ef63,
    long: true,
    samples: 4,
    events: () => ({ calls: [] }),
    lifted: (m) => setUpGameAudio(m),
  },
];

registerCases(CASES, {
  sample,
  side: (s) => createSide(s, INTRO_REFERENCE_ROUTINES),
  runtime: sceneRuntime,
  ignored: INTRO_IGNORED_WRAM,
  outside: new Set(['intro_table_index_frontier', 'intro_oam_frontier']),
});
