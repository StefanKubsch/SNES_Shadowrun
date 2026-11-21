import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENE_ROOM_FIELDS, sceneRoomState, detachSceneRoom } from '../src/state/scene-room.mjs';
import { COMBAT_FIELDS, detachCombat } from '../src/state/combat.mjs';
import { detachCollisionStorage, collisionTable } from '../src/state/collision.mjs';
import { storageContract, blankMemory, WRAM } from './state-storage-contract.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { toWram } from '../proof/state/to-wram.mjs';
import { requestRoomChange } from '../src/game/script-requests.mjs';
import { warpToDebugRoom, DEBUG_ROOM_ENTRY } from '../src/browser/debug-room.mjs';
import { saveGame } from '../src/game/save-slots.mjs';
import { loadSavedGame, setUpNewGameState } from '../src/game/game-start.mjs';
import { cartridge } from './cartridge-harness.mjs';
import { VmMemory } from '../src/vm/memory.mjs';
import * as W from '../src/data/wram.mjs';

test('scene, room and saved fields own disjoint independent bytes and restore every entry', () => {
  storageContract(SCENE_ROOM_FIELDS, detachSceneRoom, [COMBAT_FIELDS]);
});

test('wall maps retain frontend random, matrix text and system map aliases', () => {
  const mem = blankMemory(),
    state = detachSceneRoom(mem.wram);
  for (const at of [
    W.FRONTEND_RANDOM,
    W.MATRIX_IC_TEXT_BUFFER,
    0x7f0216,
    W.WALL_HEIGHTS,
    W.WALL_TILES,
  ]) {
    mem.write16(at, 0x1234);
    assert.equal(mem.read16(at), 0x1234);
    assert.equal(mem.wram[at - WRAM], 0);
  }
  assert.equal(state.wallMap[0], 0x1234);
  assert.equal(state.wallMap[(W.MATRIX_IC_TEXT_BUFFER - W.WALL_MAP) / 2], 0x1234);
});

test('odd grid and record boundary words share their next owner', () => {
  const mem = blankMemory();
  detachCollisionStorage(mem.wram);
  const state = detachSceneRoom(mem.wram);
  mem.write16(W.SCENE_RECORD - 1, 0x1234);
  assert.equal(state.shapeGrid.at(-1), 0x3400);
  assert.equal(state.record[0], 0x12);
  mem.write16(W.COLLISION_BOX_OBJECT - 1, 0xabcd);
  assert.equal(state.record.at(-1), 0xcd);
  assert.equal(collisionTable(mem.wram).owners[0], 0xab);
});

test('room requests and debug warps update room and saved script variables together', () => {
  const mem = blankMemory(),
    state = detachSceneRoom(mem.wram);
  requestRoomChange(mem, 0x159);
  assert.equal(state.room[0], 0x159);
  assert.equal(state.request[0], W.SCENE_REQUEST_ROOM_ONLY);
  warpToDebugRoom(mem.wram);
  assert.equal(state.room[0], DEBUG_ROOM_ENTRY);
  assert.equal(state.scriptVariables[0x1a / 2], 0x159);
  assert.equal(mem.wram[W.ROOM], 0);
  assert.equal(mem.wram[W.SCRIPT_VARIABLES + 0x1a], 0);
});

test('saved topics keep their overflow into flags and the following OAM bytes', () => {
  const mem = blankMemory(),
    state = detachSceneRoom(mem.wram);
  mem.write8(WRAM + W.TOPIC_LIST + state.topics.length, 0x77);
  assert.equal(state.topicFlags[0], 0x77);
  mem.write16(WRAM + W.OAM_BUFFER - 1, 0x1234);
  assert.equal(state.topicFlags.at(-1), 0x34);
  assert.equal(mem.wram[W.OAM_BUFFER], 0x12);
  mem.write16(WRAM + W.SPELL_LIST + state.spells.length * 2 - 1, 0x5678);
  assert.equal(state.spells.at(-1), 0x7800);
  assert.equal(mem.wram[W.RUNNER_ARMOUR], 0x56);
});

test('the whole fixed save block is serialized from independent scene and combat storage', () => {
  const reference = new VmMemory(
      cartridge.rom,
      undefined,
      new Uint8Array(0x2000),
      cartridge.present,
    ),
    live = new VmMemory(cartridge.rom, undefined, new Uint8Array(0x2000), cartridge.present);
  detachCombat(live.wram);
  detachSceneRoom(live.wram);
  for (let at = W.SAVE_STATE_START; at < W.OAM_BUFFER; at++) {
    const value = (at * 13 + 7) & 255;
    reference.write8(WRAM + at, value);
    live.write8(WRAM + at, value);
  }
  assert.ok(live.wram.subarray(W.SAVE_STATE_START, W.OAM_BUFFER).every((v) => v === 0));
  saveGame(reference, 0, false);
  saveGame(live, 0, false);
  assert.deepEqual(live.sram, reference.sram);
  sceneRoomState(live.wram).scriptVariables.fill(0);
  loadSavedGame({ mem: reference }, 0);
  loadSavedGame({ mem: live }, 0);
  assert.deepEqual(toWram(live), reference.wram);
});

test('new-game unpacking and script variable clearing reach the independent saved state', () => {
  const reference = new VmMemory(cartridge.rom, undefined, undefined, cartridge.present),
    live = new VmMemory(cartridge.rom, undefined, undefined, cartridge.present);
  detachCombat(live.wram);
  detachSceneRoom(live.wram);
  sceneRoomState(live.wram).scriptVariables.fill(0xffff);
  setUpNewGameState({ mem: reference });
  setUpNewGameState({ mem: live });
  assert.deepEqual(toWram(live), reference.wram);
  assert.ok(live.wram.subarray(W.SAVE_STATE_START, W.OAM_BUFFER).every((v) => v === 0));
});

test('only the normal live loop detaches scenes and rooms', () => {
  assert.equal(sceneRoomState(blankMemory().wram), undefined);
  const game = new LiveGame(cartridge);
  sceneRoomState(game.memory.wram).room[0] = 3;
  assert.equal(game.memory.read16(WRAM + W.ROOM), 3);
  assert.equal(game.memory.wram[W.ROOM], 0);
});
