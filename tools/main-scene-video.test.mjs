import test from 'node:test';
import assert from 'node:assert/strict';
import * as video from '../proof/system/main-scene-video.mjs';
import { sceneVideoSpecs, proveSceneVideo } from './main-scene-video-source.mjs';
import { compareDialog, decodeWindows, prng, rom } from './task-native-dialog-harness.mjs';
import { dialogAccess } from '../src/system/native-dialog-support.mjs';
import { encodedStream, lengthBits, fixedBits } from './task-native-unpack-fixtures.mjs';
import { unpackPortrait } from '../src/system/native-dialog-portrait.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import { readFileSync } from 'node:fs';
const originalStreams = JSON.parse(
  readFileSync(new URL('../assets/render-unpack-data.json', import.meta.url)),
).sources;
// Export names of the register-level scene video routines 81:EB7B to 81:F2A4.
const functions = [
  'enableNmiAndJoypad',
  'setNmiEnable',
  'setSceneScreenRegisters',
  'sendOamBuffer',
  'hideAllSprites',
  'clearVram',
  'resetPpuRegisters',
  'copyPalette',
  'setNmiCallback',
  'installSceneNmiAndClearPalette',
  'interpretSceneList',
  'unpackStreamForBank81',
  'unpackPortraitForBank81',
];
const maps = sceneVideoSpecs.map((s) => decodeWindows(s.windows));
test('shared scene video graphs pin all original instructions, modes, stack and the eight command targets', () => {
  sceneVideoSpecs.forEach((s, i) => {
    const p = proveSceneVideo(maps[i], s);
    assert.equal(p.reachable_instructions, s.instructions);
  });
  const s = sceneVideoSpecs.find((s) => s.name === 'ec16'),
    at = 0xec2f;
  assert.equal(
    Buffer.from(rom.subarray(at, at + 18))
      .toString('hex')
      .toUpperCase(),
    s.table.hex,
  );
  assert.equal(rom[at] | (rom[at + 1] << 8), 0);
  assert.deepEqual(
    Array.from(
      { length: 8 },
      (_, i) => 0x810000 | (rom[at + 2 + i * 2] | (rom[at + 3 + i * 2] << 8)),
    ).sort(),
    [...video.SCENE_VIDEO_COMMANDS.keys()].sort(),
  );
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
  let a = 0x7600,
    x = ((seed % 16) << 8) | ((seed % 8) + 1),
    y = 0x7e;
  let stream = encodedStream(4, [1, 2, 3, 4], lengthBits(4));
  if ([0x80f2a0, 0x80f2a4].includes(entry)) {
    const mode = seed % 7,
      size = [1, 2, 3, 17, 255, 256, 512][mode];
    if (mode === 0) stream = encodedStream(1, [0x81], [1]);
    else if (mode < 3) stream = encodedStream(5, [0xa7], [1, 0, ...lengthBits(3)]);
    else
      stream = encodedStream(
        size + 3,
        Array.from({ length: size }, (_, i) => i & 255),
        [...lengthBits(size), ...fixedBits(size - 1, size.toString(2).length), 1],
      );
    x = 0x9000;
    a = 0x7400;
    if (seed % 9 >= 7) {
      const address = originalStreams[(seed % 9) - 7].address;
      a = address & 65535;
      y = address >>> 16;
    }
  }
  wram.set(stream, 0x7400);
  if (entry === 0x81ec16) {
    x = 0x6800;
    const bytes = [],
      byte = (v) => bytes.push(v & 255),
      wordOut = (v) => {
        byte(v);
        byte(v >>> 8);
      };
    for (let n = 0; n < 1 + (seed % 20); n++) {
      const command = ((seed + n) % 8) + 1;
      byte(command);
      if (command === 2) {
        wordOut(0xf300);
        wordOut(0x0080);
      }
      if (command === 3) {
        for (const v of [0x400, 0x7400, 0x7e, 4]) wordOut(v);
      }
      if (command === 4) {
        for (const v of [((seed % 16) << 8) | ((seed % 8) + 1), 0x7e, 0x7600]) wordOut(v);
      }
      if (command === 5) {
        wordOut(0x1800 + (seed % 16));
        byte(seed);
      }
    }
    byte(0);
    byte(0xa1);
    wram.set(bytes, 0x6800);
  }
  return { entry, wram, a, x, y, dbr: [0x80, 0x81, 0, 0x7e][seed % 4], p: rnd(256) & 0xc7, word };
}
sceneVideoSpecs.forEach((s, i) =>
  test(`${s.name}: native scene video equations match every own original instruction`, () => {
    const covered = new Set();
    for (let seed = 1; seed <= 180; seed++) {
      const sample = scenario(s.entry, seed),
        result = compareDialog(maps[i], sample, {
          root: s.rootReturn,
          native: (h) => video[functions[i]](h),
          calls: (a) => {
            const h = dialogAccess(a);
            return new Map([
              [0x80f2a0, () => ({ rawReturnWord: video.unpackStreamForBank81(h) })],
              [0x809f6d, () => ({ rawReturnWord: unpackPortrait(h) })],
            ]);
          },
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
test('EC16 refetches self-modified command bytes and stops at an unproved program-bank table target', () => {
  const s = scenario(0x81ec16, 1);
  s.x = 0x1800;
  s.y = 0x7e;
  s.wram.set([5, 4, 0x18, 0, 1, 0], 0x1800);
  const i = sceneVideoSpecs.findIndex((s) => s.name === 'ec16');
  assert.deepEqual(
    compareDialog(maps[i], s, { root: 'RTL', native: (h) => video.interpretSceneList(h) })
      .differences,
    [],
  );
  const mem = new VmMemory(rom, new Uint8Array(0x20000)),
    a = new TaskAccessor({
      mem,
      a: 0,
      x: 0x1800,
      y: 0x7e,
      s: 0x1ef0,
      d: 0,
      dbr: 0x7e,
      p: 0,
      pc: 0xec16,
    });
  mem.write8(0x1800, 9);
  a.load();
  a.ctx.programBank = 0x81;
  const h = dialogAccess(a);
  assert.throws(
    () => video.interpretSceneList(h),
    (e) => e.taskBoundary && e.reason === 'main_scene_command_frontier' && e.target === 0x81b760,
  );
  assert.equal(a.ctx.s, 0x1eef); // PHP only; the unproved JSR frame is not created.
});
