import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FRONTEND_FIELDS, frontendState, detachFrontend } from '../src/state/frontend.mjs';
import { MATRIX_FIELDS } from '../src/state/matrix.mjs';
import { COMBAT_FIELDS } from '../src/state/combat.mjs';
import { SCENE_ROOM_FIELDS, sceneRoomState } from '../src/state/scene-room.mjs';
import { CAMERA_MAP_FIELDS, cameraMaps } from '../src/state/camera-maps.mjs';
import { COLLISION_FIELDS } from '../src/state/collision.mjs';
import { WINDOW_TEXT_FIELDS, windowsText } from '../src/state/windows-text.mjs';
import { OBJECT_FIELDS, OBJECT_SLOTS, objectTable } from '../src/state/objects.mjs';
import { storageContract, blankMemory, WRAM } from './state-storage-contract.mjs';
import { toWram } from './to-wram.mjs';
import { takePadPresses } from '../src/system/joypad.mjs';
import { stepBrightnessFade } from '../src/game/game-nmi.mjs';
import { scriptStateAddresses } from './script-state-addresses.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { ROM_SIZE } from '../src/vm/memory.mjs';
import * as W from '../src/data/wram.mjs';

test('frontend and shared script fields own independent disjoint bytes and restore every entry', () => {
  storageContract(FRONTEND_FIELDS, detachFrontend, [
    COMBAT_FIELDS,
    SCENE_ROOM_FIELDS,
    MATRIX_FIELDS,
  ]);
});

test('intro, title and cutscene buffers keep their existing object, map and wall aliases', () => {
  const game = new LiveGame(new Uint8Array(ROM_SIZE)),
    mem = game.memory;
  mem.write16(WRAM + W.INTRO_NEAR_ANIMATIONS, 0x1234);
  assert.equal(objectTable(mem.wram).frameCount.at(-1), 0x1234);
  mem.write16(WRAM + W.SCENE_ARGUMENT, 0x5678);
  assert.equal(
    objectTable(mem.wram).pictureChange[(W.SCENE_ARGUMENT - W.OBJECT_PICTURE_CHANGE) / 2],
    0x5678,
  );
  mem.write16(WRAM + W.FRONTEND_FRAME_COUNTER, 0x9abc);
  assert.equal(
    objectTable(mem.wram).direction[(W.FRONTEND_FRAME_COUNTER - W.OBJECT_DIRECTION) / 2],
    0x9abc,
  );
  mem.write16(W.TITLE_PALETTE, 0x1357);
  assert.equal(
    cameraMaps(mem.wram).layerLow[(W.TITLE_PALETTE - WRAM - W.SCENE_LAYER_LOW) / 2],
    0x1357,
  );
  mem.write16(W.FRONTEND_RANDOM, 0x2468);
  assert.equal(sceneRoomState(mem.wram).wallMap[0], 0x2468);
  mem.write16(WRAM + W.RANDOM_STATE, 0xabcd);
  assert.equal(frontendState(mem.wram).randomState[0], 0xabcd);
  assert.equal(sceneRoomState(mem.wram).wallMap[0], 0x2468);
  assert.equal(mem.wram[W.FRONTEND_FRAME_COUNTER], 0);
  assert.equal(mem.wram[W.FRONTEND_RANDOM - WRAM], 0);
});

for (const [held, previous] of [
  [0x0400, 0x0800],
  [0, 0xffff],
  [0x8000, 0x8000],
])
  test('pad edge computation keeps detached words for input ' + held, () => {
    const reference = blankMemory(),
      live = blankMemory();
    reference.write16(W.PAD_HELD, held);
    reference.write16(W.PAD_PREVIOUS, previous);
    live.wram.set(reference.wram);
    detachFrontend(live.wram);
    const before = live.wram.slice();
    takePadPresses(reference.wram);
    takePadPresses(live.wram);
    assert.deepEqual(toWram(live), reference.wram);
    assert.deepEqual(live.wram, before);
  });

for (const [fade, brightness] of [
  [2, 14],
  [0xfffe, 1],
  [2, 15],
  [0xfffe, 0],
])
  test(
    'display fade reads detached shadows and preserves their high byte at ' + [fade, brightness],
    () => {
      const reference = blankMemory(),
        live = blankMemory();
      for (const [at, value] of [
        [W.BRIGHTNESS_FADE, fade],
        [W.BRIGHTNESS_FADE_FRAMES, 1],
        [W.INIDISP_SHADOW, 0xab00 | brightness],
      ])
        reference.write16(at, value);
      live.wram.set(reference.wram);
      detachFrontend(live.wram);
      const before = live.wram.slice();
      stepBrightnessFade(reference.wram);
      stepBrightnessFade(live.wram);
      assert.deepEqual(toWram(live), reference.wram);
      assert.deepEqual(live.wram, before);
      assert.equal(frontendState(live.wram).brightness[0] & 0xff00, 0xab00);
    },
  );

test('scripted path, wave and circle state shares its odd word workspace', () => {
  const game = new LiveGame(new Uint8Array(ROM_SIZE)),
    mem = game.memory,
    state = frontendState(mem.wram);
  mem.write16(W.PATH_PHASE_XY, 0x1234);
  assert.equal(mem.read16(W.WAVE_MEMBER_SECOND_PHASE), 0x1234);
  assert.equal(
    state.scriptedMotion[(W.PATH_PHASE_XY - FRONTEND_FIELDS.scriptedMotion.base) / 2],
    0x1234,
  );
  mem.write16(W.SCRIPT_GLOVE_CHOICE + 3, 0xabcd);
  assert.deepEqual([...state.sharedScriptBytes], [0, 0xcd, 0xab, 0]);
  mem.write16(W.SPELL_CHOICE_HEADER - 1, 0x5678);
  assert.equal(state.sharedScriptBytes[3], 0x78);
  assert.equal(windowsText(mem.wram).spellChoices[0], 0x56);
  mem.write16(W.RANDOM_BYTE, 0x9abc);
  assert.equal(state.randomByte[0], 0xbc);
  assert.equal(sceneRoomState(mem.wram).request[0], 0x9a);
  assert.equal(mem.wram[W.PATH_PHASE_XY], 0);
});

test('all direct script operands and every saved byte have an independent owner', () => {
  const owned = new Set();
  for (const base of Object.values(OBJECT_FIELDS))
    for (let i = 0; i < OBJECT_SLOTS * 2; i++) owned.add(base + i);
  for (const schema of [
    COLLISION_FIELDS,
    CAMERA_MAP_FIELDS,
    WINDOW_TEXT_FIELDS,
    COMBAT_FIELDS,
    SCENE_ROOM_FIELDS,
    MATRIX_FIELDS,
    FRONTEND_FIELDS,
  ])
    for (const { base, count, bytes = 2, stride = bytes } of Object.values(schema))
      for (let i = 0; i < count; i++)
        for (let n = 0; n < bytes; n++) owned.add(base + i * stride + n);
  const { scripts } = JSON.parse(
    readFileSync(new URL('../assets/scripts.json', import.meta.url), 'utf8'),
  );
  const addresses = scriptStateAddresses(scripts);
  assert.equal(addresses.length, 41);
  for (const { address, bytes } of addresses)
    for (let n = 0; n < bytes; n++)
      assert.ok(owned.has(address + n), 'script ' + (address + n).toString(16));
  for (let at = W.SAVE_STATE_START; at < W.OAM_BUFFER; at++)
    assert.ok(owned.has(at), 'saved ' + at.toString(16));
});

test('test fixtures keep raw frontend bytes; only the normal live loop detaches', () => {
  const mem = blankMemory();
  assert.equal(frontendState(mem.wram), undefined);
  mem.write16(W.PAD_HELD, 0x1234);
  assert.equal(mem.wram[W.PAD_HELD], 0x34);
  const game = new LiveGame(new Uint8Array(ROM_SIZE));
  frontendState(game.memory.wram).padHeld[0] = 0x5678;
  assert.equal(game.memory.read16(W.PAD_HELD), 0x5678);
  assert.equal(game.memory.wram[W.PAD_HELD], 0);
});
