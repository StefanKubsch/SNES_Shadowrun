// Random per-function tests of the lifted cutscenes (src/cutscene) against the
// register-level reference (proof/cutscene-reference) for the edge cases the live
// sessions of tools/cutscene-lift.test.mjs do not reach (docs/MATRIX-LIFT.md).
// The cutscene words are drawn from wide domains: every scene and its mirror,
// rarely a scene past the tables, positions, speeds and counters including word
// wrap values, credit pages of random text, portrait steps and brightness.
import { DialogTestMemory, prng } from './task-native-dialog-harness.mjs';
import { createSide, registerCases } from './lift-function-harness.mjs';
import { CUTSCENE_IGNORED_WRAM } from './live-cutscene-plan.mjs';
import { sceneRuntime } from '../src/system/scene-runtime.mjs';
import {
  animateCutscene,
  drawSprites,
  fillTextMap,
  sendMirroredPicture,
} from '../src/cutscene/cutscene-animation.mjs';
import { handleCutsceneNmi } from '../src/cutscene/cutscene-scene.mjs';
import { startSong } from '../src/apu/music-mode.mjs';
import { setSceneScreen } from '../src/video/scene-screen.mjs';
import { startSong as startSongReference } from '../proof/apu-reference/audio-routines.mjs';
import { setSceneScreenRegisters } from '../src/task/main-scene-video.mjs';
import { CUTSCENE_REFERENCE_ROUTINES } from '../proof/cutscene-reference/cutscene-scene.mjs';

const WRAM_BYTES = 0x20000,
  CREDITS_TEXT = 0x62a8,
  // The sound directory pointer the game keeps at 7E:008C (from 98:FFFA, 81:F092).
  ROM = new DialogTestMemory(new Uint8Array(WRAM_BYTES)),
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
  // The scene (bit 15 mirrors), rarely past the six scenes of the tables.
  const scene = rnd(25) === 0 ? 6 + rnd(10) : rnd(6);
  word(0x1e, scene | (rnd(2) ? 0x8000 : 0));
  word(0x1c, pick([0, 0x7f, 0x80, 0xff80, rnd(65536)]));
  word(0x16, pick([0, 1, 5, 6, 7, 0x40, 0x3c0, 0x7fff, 0xffff, rnd(65536)]));
  word(0x18, pick([0, 1, 4, 0x10, rnd(65536)]));
  word(0x1a, pick([0, 0x40, 0x100, rnd(65536)]));
  word(0x14, rnd(65536));
  // Credits: the page counter and the text offset of the next page.
  word(0x11a0, pick([0, 0, 1, 0x1f4, 0x1b5, 0x1b4, 0x1b3, 0x40, 0x3f, 0x1d, rnd(65536)]));
  word(0x119e, pick([0, rnd(0x100), 0x80, 0x7f, 0xff, rnd(65536)]));
  word(0x115e, rnd(65536));
  word(0x1160, rnd(65536));
  wram[0x11a3] = pick([0, 1, 15, rnd(256)]);
  wram[0x11a2] = pick([0, 15, rnd(256)]);
  // Credit pages: a line count, then lines of characters, each ending with 00.
  let at = CREDITS_TEXT;
  for (let page = 0; page < 20; page++) {
    const lines = rnd(6) ? 1 + rnd(8) : 0;
    wram[at++] = lines;
    for (let line = 0; line < lines; line++) {
      for (let n = rnd(36); n > 0; n--) wram[at++] = 0x20 + rnd(0x5f);
      wram[at++] = 0;
    }
  }
  return { seed, wram, rnd, pick };
}

const CASES = [
  {
    name: 'animateCutscene 81:CF72',
    entry: 0x81cf72,
    samples: 1200,
    lifted: (m) => animateCutscene(m),
  },
  {
    name: 'drawSprites 81:D4E8',
    entry: 0x81d4e8,
    prepare: (s) => ({ a: s.pick([0, 0xc0, 0xff, 0x8080, s.rnd(65536)]) }),
    lifted: (m, r) => drawSprites(m, r.a),
  },
  { name: 'fillTextMap 81:D37D', entry: 0x81d37d, lifted: (m) => fillTextMap(m) },
  { name: 'sendMirroredPicture 81:CF79', entry: 0x81cf79, lifted: (m) => sendMirroredPicture(m) },
  {
    name: 'handleCutsceneNmi 81:D479',
    entry: 0x81d479,
    long: true,
    lifted: (m) => handleCutsceneNmi(m.h),
  },
  {
    // Songs with the cartridge's sound directory.
    name: 'startSong 81:F229',
    entry: 0x81f229,
    long: true,
    events: () => ({ calls: [] }),
    reference: (h, e, r) => startSongReference(h, e, r),
    prepare: (s) => {
      s.wram.set(SOUND_DIRECTORY, 0x8c);
      s.wram[0x1ce6] = s.pick([0, 0, 0xff]);
      return { a: s.pick([0, 0, 1, 8, s.rnd(16), s.rnd(65536)]) };
    },
    lifted: (m, r) => startSong(m.mem, m.port, r.a),
  },
  {
    name: 'setSceneScreen 81:EBE9',
    entry: 0x81ebe9,
    long: true,
    reference: (h) => setSceneScreenRegisters(h),
    lifted: (m) => setSceneScreen(m.video),
  },
];

registerCases(CASES, {
  sample,
  side: (s) => createSide(s, CUTSCENE_REFERENCE_ROUTINES),
  runtime: sceneRuntime,
  ignored: CUTSCENE_IGNORED_WRAM,
  outside: new Set(['cutscene_table_index_frontier']),
});
