import test from 'node:test';
import assert from 'node:assert/strict';
import { matrixNmiSpecs } from './main-matrix-nmi-source.mjs';
import { sceneAnimationSpecs, proveSceneAnimation } from './main-scene-animation-source.mjs';
import { sceneVideoSpecs } from './main-scene-video-source.mjs';
import { decodeWindows, DialogTestMemory, rom } from './task-native-dialog-harness.mjs';
import { assertPinnedTaskSource } from './pinned-task-source.mjs';
import { TaskAccessor } from '../src/vm/task-accessor.mjs';
import { dialogAccess } from '../src/system/native-dialog-support.mjs';
import { runInterruptFadePoll } from '../proof/system/main-wait-interrupt.mjs';
import { SCENE_REFERENCE_ROUTINES as MAIN_SCENE_ROUTINES } from '../proof/scene-reference-routines.mjs';

const fadeWindow = {
  start: 0x81cf4c,
  hex: 'ADA311D0FB',
  initialM: 1,
  initialX: 0,
  finalM: 1,
  finalX: 0,
};
const callback = sceneAnimationSpecs.find((s) => s.name === 'd479');
const nmiWindows = [
  ...matrixNmiSpecs[2].windows,
  ...callback.windows,
  ...sceneVideoSpecs.find((s) => s.name === 'ed8b').windows,
];
const nmi = decodeWindows(nmiWindows),
  poll = decodeWindows([fadeWindow]);
const freeze = (list) => Object.freeze(list.map((o) => Object.freeze({ ...o })));
function side({
  dbr = 0x80,
  p = 0x61,
  brightness = 2,
  target = 0,
  s = 0x1ef0,
  scroll = 3,
  step = 2,
  goal = 9,
  position = 0xfffe,
  direction = 0,
} = {}) {
  const mem = new DialogTestMemory(new Uint8Array(0x20000), null, rom);
  for (const [at, value] of [
    [0x6e, 0xd479],
    [0x14, 0x1234],
    [0x16, scroll],
    [0x18, step],
    [0x1a, goal],
    [0x1c, position],
    [0x1e, direction],
    [0x1c76, 0xffff],
  ])
    mem.write16(at, value);
  mem.write8(0x70, 0x81);
  mem.write8(0x11a2, target);
  mem.write8(0x11a3, brightness);
  mem.write8(0x11a4, 0xb9);
  const a = new TaskAccessor({ mem, a: 0xa55a, x: 0xdead, y: 0xbeef, s, d: 0, dbr, p, pc: 0xcf4c });
  a.load();
  if (p & 0x10) {
    a.ctx.x &= 255;
    a.ctx.y &= 255;
  }
  a.ctx.programBank = 0x81;
  a.trace = [];
  a.io = [];
  a.devices = { write() {} };
  return { mem, a, h: dialogAccess(a) };
}
test('fade poll and full callback retain pinned original BYTE loop, helper frames and NMI vector graph', () => {
  assertPinnedTaskSource(poll, [fadeWindow]);
  assertPinnedTaskSource(nmi, nmiWindows);
  proveSceneAnimation(decodeWindows(callback.windows), callback);
  assert.equal(poll.get(0x81cf4c).mnemonic, 'LDA');
  assert.equal(poll.get(0x81cf4f).target, 0x81cf4c);
});
test('fade refuses absent occurrences and device values without accepting old BYTE writers', () => {
  const v = side({ p: 0x20 });
  const old = freeze([{ pc: 0x81cf4c, address: 0x8011a3, width: 1, value: 0 }]);
  for (const interrupts of [
    undefined,
    [],
    freeze([{ pc: 0x81cf4f, nmi: true }]),
    [{ pc: 0x81cf4c, nmi: false }],
  ]) {
    const e = { interrupts, interruptIndex: 0, values: old, waitIndex: 0, waitEvents: [] };
    assert.throws(
      () => runInterruptFadePoll(v.h, e),
      (error) => error.reason === 'wait_interrupt_observation_required',
    );
    assert.equal(v.mem.read8(0x11a3), 2);
  }
  assert.throws(
    () =>
      runInterruptFadePoll(v.h, {
        interrupts: freeze([{ pc: 0x81cf4c, nmi: true }]),
        interruptIndex: 0,
        interruptRoutines: MAIN_SCENE_ROUTINES,
      }),
    (e) => e.reason === 'device_observation_required',
  );
  assert.equal(v.mem.read8(0x11a3), 2);
});
