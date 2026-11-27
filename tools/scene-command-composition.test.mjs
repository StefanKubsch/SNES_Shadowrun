import test from 'node:test';
import assert from 'node:assert/strict';
import { runSceneList as direct } from '../src/system/scene-list.mjs';
import { sceneListCommands } from '../src/data/scene-commands.mjs';
import { DialogTestMemory, rom } from './task-native-dialog-harness.mjs';
import { cpuToOffset } from './rom.mjs';
import { assertFrozenRun, pictureState, useLiftVectors } from './lift-function-harness.mjs';
import { newPicture, setLiveChannels } from './picture-fixture.mjs';

useLiftVectors(import.meta.url);

function run(execute, bytes, target, list = 0x7e2000) {
  const image = rom.slice();
  if (target !== undefined) {
    const slot = cpuToOffset(0x81ec31);
    image[slot] = target & 255;
    image[slot + 1] = target >>> 8;
  }
  const mem = new DialogTestMemory(new Uint8Array(0x20000), null, image),
    writes = [],
    reads = [];
  bytes.forEach((value, n) => mem.write8((list + n) & 0xffffff, value));
  const read = mem.read8.bind(mem);
  mem.read8 = (at) => {
    reads.push(at);
    return read(at);
  };
  // The picture back end with the live channel set-up; data counts its VRAM, CGRAM and
  // OAM data bytes.
  const video = setLiveChannels(newPicture(mem));
  let data = 0;
  video.onData = () => data++;
  const port = {
    write: (...args) => {
      writes.push(['port', ...args]);
      mem.write8(args[0], args[1]);
    },
  };
  let stop;
  try {
    execute(mem, video, port, list);
  } catch (error) {
    if (!error.taskBoundary) throw error;
    stop = { reason: error.reason, target: error.target, commandIndex: error.commandIndex };
  }
  return { wram: mem.wram, writes, reads, stop, picture: pictureState(video), data };
}

const CALLBACK = [0x34, 0x12, 0x81, 0xab],
  PALETTE = [2, 0xfe, 0x9d, 0xff, 0xfe, 0xff],
  PACKED = [0, 0x20, 0x38, 0xfd, 0x85, 0xab, 0, 8],
  REGISTER = [0, 0x21, 0x8f];

for (const [target, args] of [
  [0xec41, []],
  [0xec42, CALLBACK],
  [0xec4f, PALETTE],
  [0xec68, PACKED],
  [0xecb7, REGISTER],
  [0xecce, []],
  [0xeccf, []],
  [0xecd0, []],
])
  test(`scene command alias resolves established target ${target.toString(16)}`, () => {
    const bytes = [1, ...args, 0];
    const actual = run(direct, bytes, target);
    assertFrozenRun(actual);
    assert.equal(actual.stop, undefined);
  });

test('mixed scene commands retain argument order, packed uploads and word callback bank', () => {
  const bytes = [1, 2, ...CALLBACK, 3, ...PACKED, 4, ...PALETTE, 5, ...REGISTER, 6, 7, 8, 0];
  const actual = run(direct, bytes);
  assertFrozenRun(actual);
  assert.equal(actual.wram[0x70], 0x81);
  assert.equal(actual.wram[0x71], 0xab);
  assert.ok(actual.data > 0, 'the packed upload and the palette reach the picture');
});

test('zero palette count retains the full wrapping byte transfer', () => {
  const bytes = [4, 0, 0xff, 0x7f, 0, 0, 0, 0],
    actual = run(direct, bytes);
  assertFrozenRun(actual);
  assert.equal(actual.data, 65536);
});

for (const [bytes, target] of [
  [[1, 0], 0x8000],
  [[9, 0], undefined],
  [[255, 0], undefined],
])
  test(`scene command frontier retains target and command index ${bytes[0]}`, () => {
    const actual = run(direct, bytes, target);
    assertFrozenRun(actual);
    assert.deepEqual(actual.stop, {
      reason: 'main_scene_command_frontier',
      target: target === undefined ? null : 0x810000 | target,
      commandIndex: bytes[0] * 2,
    });
    assert.equal(actual.writes.length, 0);
    assert.equal(actual.data, 0);
  });

test('list arguments remain live across register writes into the list itself', () => {
  const bytes = [5, 7, 0x18, 0x80, 5, 0, 0x21, 0x0f, 0],
    actual = run(direct, bytes, undefined, 0x7e1800);
  assertFrozenRun(actual);
  assert.deepEqual(actual.writes[0], ['port', 0x801807, 0x80, 1, 0x81ecc7]);
  assert.deepEqual(actual.writes[1], ['port', 0x802100, 0x80, 1, 0x81ecc7]);
});

test('resolved command tables belong to their image and are reused within it', () => {
  const first = new DialogTestMemory(new Uint8Array(0x20000), null, rom.slice()),
    second = new DialogTestMemory(new Uint8Array(0x20000), null, rom.slice());
  const a = sceneListCommands(first),
    b = sceneListCommands(second);
  assert.strictEqual(a, sceneListCommands(first));
  assert.notStrictEqual(a, b);
  assert.deepEqual(a, b);
});
