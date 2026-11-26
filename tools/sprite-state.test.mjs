// The game's sprite list as typed state (src/state/sprites.mjs, docs/FRAME-DESCRIPTION.md
// step 7): the OAM buffer bytes have one owner, byte writers reach the fields, the
// projection keeps the WRAM layout, and the picture back end takes the list from the
// fields as the SNES back end takes it from memory.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SPRITE_FIELDS, detachSprites, spriteBytes, spriteTable } from '../src/state/sprites.mjs';
import { COMBAT_FIELDS } from '../src/state/combat.mjs';
import { SCENE_ROOM_FIELDS } from '../src/state/scene-room.mjs';
import { FRONTEND_FIELDS } from '../src/state/frontend.mjs';
import { MATRIX_FIELDS } from '../src/state/matrix.mjs';
import { storageContract, blankMemory, WRAM } from './state-storage-contract.mjs';
import { toWram } from './to-wram.mjs';
import { PictureVideo } from '../src/video/picture-video.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { ROM_SIZE } from '../src/vm/memory.mjs';
import { OAM_BUFFER, OAM_HIGH_TABLE } from '../src/data/wram.mjs';

const OAM_BYTES = 544,
  PRIORITY_ROTATION_WORD = 0x8000;

test('sprite fields own the OAM buffer without overlapping other subsystems', () => {
  storageContract(SPRITE_FIELDS, detachSprites, [
    COMBAT_FIELDS,
    SCENE_ROOM_FIELDS,
    FRONTEND_FIELDS,
    MATRIX_FIELDS,
  ]);
});

test('byte writers reach the sprite fields and the projection keeps the buffer layout', () => {
  const reference = blankMemory(),
    live = blankMemory(),
    table = detachSprites(live.wram);
  for (const mem of [reference, live]) {
    mem.write8(WRAM + OAM_BUFFER + 4 * 5, 0x40);
    mem.write8(WRAM + OAM_BUFFER + 4 * 5 + 1, 0x50);
    mem.write16(WRAM + OAM_BUFFER + 4 * 5 + 2, 0x3123);
    mem.write16(WRAM + OAM_HIGH_TABLE, 0xaaaa);
  }
  assert.deepEqual(
    [table.x[5], table.y[5], table.name[5], table.attributes[5]],
    [0x40, 0x50, 0x23, 0x31],
  );
  assert.deepEqual([table.sizes[0], table.sizes[1]], [0xaa, 0xaa]);
  assert.equal(live.wram[OAM_BUFFER + 4 * 5], 0, 'the raw buffer stays untouched');
  assert.deepEqual(toWram(live), reference.wram);
  assert.deepEqual(spriteBytes(table), reference.wram.subarray(OAM_BUFFER, OAM_BUFFER + OAM_BYTES));
});

test('the picture back end takes the sprite table as it takes the bytes', () => {
  const mem = blankMemory(),
    table = detachSprites(mem.wram);
  const sent = Uint8Array.from({ length: OAM_BYTES }, (_, n) => (n * 37 + 11) & 0xff);
  sent.forEach((value, n) => mem.write8(WRAM + OAM_BUFFER + n, value));
  const fromTable = new PictureVideo(mem),
    fromBytes = new PictureVideo(mem);
  for (const v of [fromTable, fromBytes]) {
    v.setDisplay(0x80);
    v.setUpDma([[2, { to: 'oam', source: WRAM }]], ['mode', 'target', 'bank']);
  }
  const sites = {};
  fromTable.sendOamBuffer(OAM_BUFFER, OAM_BYTES, PRIORITY_ROTATION_WORD, sites, table);
  fromBytes.sendOamBuffer(OAM_BUFFER, OAM_BYTES, PRIORITY_ROTATION_WORD, sites);
  assert.deepEqual(fromTable.oam, sent);
  assert.deepEqual(fromBytes.oam, sent);
  assert.deepEqual(fromTable.settings(), fromBytes.settings());
  assert.equal(fromTable.oamByte, fromBytes.oamByte);
});

test('only the normal live loop keeps the sprite list as typed state', () => {
  assert.equal(spriteTable(blankMemory().wram), undefined);
  const game = new LiveGame(new Uint8Array(ROM_SIZE));
  spriteTable(game.memory.wram).y[3] = 0xf0;
  assert.equal(game.memory.read8(WRAM + OAM_BUFFER + 4 * 3 + 1), 0xf0);
});
