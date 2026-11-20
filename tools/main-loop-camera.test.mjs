import test from 'node:test';
import assert from 'node:assert/strict';
import { mainCameraSpecs, proveMainCameraSource } from './main-loop-camera-source.mjs';
import { compareDialog, decodeWindows, prng } from './task-native-dialog-harness.mjs';
import { dialogAccess } from '../src/system/native-dialog-support.mjs';
import { clampToCameraBox, updateCameraTileBuffers } from '../proof/system/main-loop-camera.mjs';
import { projectPlayerAndMoveCamera } from '../proof/game-reference/main-camera.mjs';
import { passGloveActionToTask } from '../proof/game-reference/main-glove-action.mjs';
import { updateTimeLimit } from '../proof/game-reference/main-timer.mjs';
import {
  applyColourRequest,
  animatePalettes,
  releaseExpiredWindows,
} from '../proof/game-reference/main-upkeep.mjs';
import { runFrameWait, runPadPresses } from '../proof/caller/input-routines.mjs';
import {
  runNoticeTimeouts,
  runTimeLimit,
  runGloveAction,
  runColourEffect,
  runPaletteCycles,
  runCameraFollow,
  runTileBuffers,
} from '../proof/caller/live-loop-routines.mjs';
import { MAIN_LOOP_ROUTINES } from '../proof/caller/live-loop-routines.mjs';
import {
  MAIN_LOOP_ROUTINES as REPLAY_LOOP_ROUTINES,
  MAIN_LOOP_LIFTED_TOP,
} from '../proof/vm/main-loop.mjs';
import { MAIN_UPKEEP_ROUTINES } from '../proof/replay/main-loop-upkeep.mjs';
import '../proof/system/dialog-register-helpers.mjs';

// The camera, the colour effect, the palette cycles, the notice time limits, the time limit and the glove action are proven as references; the main loop
// binds their lifted entries (src/game/main-upkeep.mjs).
const bound = [
  null,
  runCameraFollow,
  runTileBuffers,
  runColourEffect,
  runPaletteCycles,
  runNoticeTimeouts,
  runTimeLimit,
  runGloveAction,
];
const functions = [
  clampToCameraBox,
  projectPlayerAndMoveCamera,
  updateCameraTileBuffers,
  applyColourRequest,
  animatePalettes,
  releaseExpiredWindows,
  updateTimeLimit,
  passGloveActionToTask,
];
const maps = mainCameraSpecs.map((s) => decodeWindows(s.windows));
test('camera and upkeep pin every own original instruction, return width, DBR and local stack', () => {
  mainCameraSpecs.forEach((s, i) => {
    const p = proveMainCameraSource(maps[i], s);
    assert.equal(p.reachable_instructions, [79, 142, 164, 77, 34, 41, 64, 132][i]);
    if (i > 0) assert.equal(MAIN_LOOP_ROUTINES.get(s.entry), bound[i]);
  });
  // The table keeps the register-level word wait and pad word; the loop runs its lifted
  // entries in their place (lifted with lag-free frames, else register-level).
  for (const t of [0x81b0a1, 0x809e1a])
    assert.equal(REPLAY_LOOP_ROUTINES.get(t), MAIN_UPKEEP_ROUTINES.get(t));
  assert.equal(MAIN_LOOP_LIFTED_TOP.get(0x81b0a1), runFrameWait);
  assert.equal(MAIN_LOOP_LIFTED_TOP.get(0x809e1a), runPadPresses);
  for (const t of [0x80b8de, 0x80be6d])
    assert.equal(typeof REPLAY_LOOP_ROUTINES.get(t), 'function');
  assert.equal(REPLAY_LOOP_ROUTINES.get(0x80ff14), releaseExpiredWindows);
  assert.equal(REPLAY_LOOP_ROUTINES.get(0x80e270), updateTimeLimit);
  assert.equal(REPLAY_LOOP_ROUTINES.get(0x80bf3b), passGloveActionToTask);
});

function scenario(entry, seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(0x20000);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(256);
  const word = (at, v) => {
    wram[at] = v & 255;
    wram[at + 1] = (v >>> 8) & 255;
  };
  const x = 0x20,
    choice = (a) => a[seed % a.length];
  // Valid camera pointer into shared WRAM; each early exit and clamp is varied independently.
  word(0xcda, 0);
  word(0xcdb, 0);
  if (seed % 3) {
    word(0xcda, 0x6000);
    word(0xcdb, 0x7e60);
  }
  for (const [i, v] of [
    choice([0, 0x20, 0xffff]),
    choice([0xff, 0x100, 0x400]),
    choice([0, 0x100, 0x200]),
    choice([0x300, 0x400, 0x7ff]),
  ].entries())
    word(0x6001 + i * 2, v);
  word(0xcc2, seed % 17 === 0 ? 0xffff : x);
  word(0xcc4, choice([0, 0x20, 0x3ff, 0x400, 0x7ff, 0x800, 0x8001, rnd(0x1000)]));
  word(0xcc6, choice([0, 0x20, 0x23f, 0x240, 0x47b, 0x47c, 0x8001, rnd(0x1000)]));
  word(0xcc8, choice([0, 4, 0x20, 0xfffc, 0xffe0, 0x8000, 0x7fff]));
  word(0xcca, choice([0, 0xffe0, 0xfffc, 0x20, 4, 0x8000, 0x7fff]));
  word(0xe28 + x, choice([0, 0x400, 0x500, rnd(65536)]));
  word(0xe80 + x, choice([0, 0x400, 0x500, rnd(65536)]));
  word(0xf30 + x, choice([0x10, 0x20, 0x40, rnd(65536)]));
  word(0xed8 + x, choice([0, 0x200, 0x800, rnd(65536)]));
  word(0x1fdc, choice([0, 1, 2, 4, 8, 0x8000, 0xffff, 6]));
  word(0x1fde, choice([0x140, 0x1f0, 0x100, 0xffff, rnd(65536)]));
  for (let slot = 0; slot < 4; slot++) {
    word(0x1cbe + slot * 2, choice([0, 1, 0x80, 0x8000, 0xffff]));
    word(0x1cc6 + slot * 2, choice([0, 0xffff]));
    word(0x1cd6 + slot * 2, choice([0, 1, 0xffff, 0x8000]));
    word(0x1cd2 + slot * 2, choice([0, 2, 0x8000]));
    word(0x216 + slot * 2, (seed + slot) % 3 ? slot : 0xffff);
    word(0x21e + slot * 2, (seed + slot) % 3);
  }
  word(0x202, seed % 2);
  if (entry === 0x818076 && seed % 11 === 0) {
    word(0x1cbe, 0x80);
    word(0x1cc2, 0);
    word(0x1cc6, 0);
    word(0x1cd6, 1);
    word(0x1cd2, 2);
  }
  word(0x1d89, choice([0xffff, 0, 1, 2, 0x10]));
  word(0x1d87, choice([0, 1, 0x21, 0x41, 0xe00, 0xe10, 0xe41]));
  // A finite task chain, optional resumed child, valid target and controlled distance.
  word(0x1d5d, seed % 19 === 0 ? 1 : 0);
  word(0x1d5f, seed % 23 === 0 ? 1 : 0);
  word(0x1da, seed % 13 === 0 ? 0xffff : 0x10);
  word(0x1de, 0x10);
  word(0x1ce, choice([0, 0x10, 0x20, 0x8000, 0x8010, 0x8020]));
  word(0x1350 + 0x10, seed % 29 === 0 ? 0xffff : 0x40);
  word(0xba2 + 0x40, seed % 2 ? 0x8000 : choice([0, 2, 0x600, 0x80, 0x67f2]));
  word(0x372 + 0x40, 0x60);
  word(0xba2 + 0x60, choice([0, 2, 0x600, 0x80, 0x67f2]));
  word(0x4450 + 0x10, seed % 2 ? 0 : 0x1234);
  if (entry === 0x80bf3b) {
    word(0xcc2, x);
    for (const [i, at] of [0xe28, 0xe80, 0xed8].entries()) {
      const v = rnd(0x800);
      word(at + x, v);
      word(
        at + 0x10,
        v +
          (i === 2
            ? choice([0, 0x80, 0x81, 0xa0, 0xa1, -0x200, 0x10000 - 0x80])
            : [0, 1, -1][Math.floor(seed / 7) % 3]),
      );
    }
  }
  return {
    entry,
    wram,
    a: rnd(65536),
    x,
    y: rnd(65536),
    dbr: choice([0x80, 0, 0x7e]),
    p: rnd(256) & 0xc7,
    seed,
    word,
  };
}
// Separate callee proofs are not repeated here. The same stubs on both sides vary registers,
// flags and shared scratch while retaining the original frame/return type.
function stubs(h, seed) {
  return new Map(
    mainCameraSpecs
      .flatMap((s) => s.externalReturns)
      .map(([target]) => [
        target,
        () => {
          h.dpWrite(0x70, (h.dp(0x70) + h.ctx.a + h.ctx.x + h.ctx.y) & 65535);
          if (target === 0x80c560) h.dpWrite(0, [0, 0x3332, 0x3333, 0xffff][seed % 4]);
          if (target === 0x80c51f) h.dpWrite(0, seed % 3);
          h.load(target === 0x8099eb ? [0, 2, 0x80, 0x600][Math.floor(seed / 6) % 4] : seed * 13);
          h.index('x', seed * 2);
          h.index('y', seed * 3);
          h.ctx.status ^= 0x41;
          return { rawReturnWord: h.rts() };
        },
      ]),
  );
}
mainCameraSpecs.forEach((spec, i) =>
  test(`${spec.name}: native equations match the original and cover every own instruction`, () => {
    const covered = new Set();
    for (let seed = 1; seed <= 1000; seed++) {
      const s = scenario(spec.entry, seed);
      const result = compareDialog(maps[i], s, {
        root: spec.rootReturn,
        native: (h, e) => {
          const routines = new Map([...stubs(h, seed)].map(([t, run]) => [t, () => run()]));
          return functions[i](h, e, routines);
        },
        calls: (a) => stubs(dialogAccess(a), seed),
      });
      assert.deepEqual(result.differences, [], `seed ${seed}`);
      for (const pc of result.visited) covered.add(pc);
    }
    assert.deepEqual(
      [...maps[i].keys()].filter((pc) => !covered.has(pc)).map((pc) => pc.toString(16)),
      [],
    );
  }),
);
