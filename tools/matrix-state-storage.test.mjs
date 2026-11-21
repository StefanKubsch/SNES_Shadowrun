import test from 'node:test';
import assert from 'node:assert/strict';
import { MATRIX_FIELDS, matrixState, detachMatrix } from '../src/state/matrix.mjs';
import { COMBAT_FIELDS } from '../src/state/combat.mjs';
import { SCENE_ROOM_FIELDS } from '../src/state/scene-room.mjs';
import { storageContract, blankMemory, WRAM } from './state-storage-contract.mjs';
import { detachObjectStorage, objectTable } from '../src/state/objects.mjs';
import { toWram } from '../proof/state/to-wram.mjs';
import { queueVramCopy, sendVramCopies } from '../src/matrix/matrix-runtime.mjs';
import { queueText, resetTextWindow } from '../src/matrix/matrix-text.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { ROM_SIZE } from '../src/vm/memory.mjs';
import * as W from '../src/data/wram.mjs';

test('matrix fields import and project every independent entry without overlapping prior owners', () => {
  storageContract(MATRIX_FIELDS, detachMatrix, [COMBAT_FIELDS, SCENE_ROOM_FIELDS]);
});

test('matrix speed and position fragments keep their object aliases and odd boundary words', () => {
  const mem = blankMemory();
  detachObjectStorage(mem.wram);
  const state = detachMatrix(mem.wram),
    objects = objectTable(mem.wram);
  mem.write16(WRAM + W.DRAW_LIST_INDEX - 1, 0xabcd);
  assert.equal(objects.flags.at(-1), 0xcd00);
  assert.equal(state.speedXTail[0], 0xab);
  mem.write16(WRAM + W.OBJECT_NUMBER - 1, 0x1234);
  assert.equal(state.speedYHead.at(-1), 0x3400);
  assert.equal(objects.number[0], 0x12);
  mem.write16(WRAM + W.MATRIX_SPEED_Y + W.MATRIX_OBJECT_END - 2, 0x5678);
  assert.equal(
    objects.number[(W.MATRIX_SPEED_Y + W.MATRIX_OBJECT_END - 2 - W.OBJECT_NUMBER) / 2],
    0x5678,
  );
  mem.write16(WRAM + W.MATRIX_ANIMATION - 1, 0x9abc);
  assert.equal(state.personaY.at(-1), 0xbc00);
  assert.equal(state.animation[0], 0x9a);
  assert.equal(mem.wram[W.DRAW_LIST_INDEX], 0);
});

test('ordinary draw-list and NMI/VRAM queues use the same matrix-owned bytes', () => {
  const mem = blankMemory(),
    state = detachMatrix(mem.wram);
  mem.write16(W.DRAW_LIST_INDEX, 6);
  mem.write16(W.NMI_JOB_LISTS, 3);
  mem.write16(W.VRAM_UPLOAD_BANKS, 0x7e);
  mem.write16(W.VRAM_UPLOAD_ADDRESSES, 0x5678);
  assert.equal(state.speedXTail[0], 6);
  assert.equal(state.personaXTail[0], 3);
  assert.equal(state.animationClock[(W.VRAM_UPLOAD_BANKS - W.MATRIX_ANIMATION_CLOCK) / 2], 0x7e);
  assert.equal(state.health[0], 0x5678);
  mem.write16(W.VRAM_UPLOAD_SOURCES + 0x20, 0x9abc);
  assert.equal(state.nodeColumns[1], 0x9abc);
  assert.equal(mem.wram[W.VRAM_UPLOAD_ADDRESSES], 0);
});

test('matrix DMA records retain their object overlay, order and NMI reset', () => {
  const reference = blankMemory(),
    live = blankMemory(),
    sent = [];
  detachObjectStorage(live.wram);
  detachMatrix(live.wram);
  for (const mem of [reference, live]) {
    queueVramCopy(mem.wram, 0x20, 0x7f015a, 0x800);
    queueVramCopy(mem.wram, 4, 0x7e1234, 0x1000);
    mem.write16(W.MATRIX_DMA_RECORDS, 1);
    const copies = [];
    sendVramCopies(mem.wram, {
      copyToVram(next) {
        for (let record; (record = next());) copies.push({ ...record });
      },
    });
    sent.push(copies);
  }
  assert.deepEqual(sent[1], sent[0]);
  assert.deepEqual(
    sent[1].map((v) => [v.bytes, v.source, v.address]),
    [
      [0x20, 0x7f015a, 0x800],
      [4, 0x7e1234, 0x1000],
    ],
  );
  assert.deepEqual(toWram(live), reference.wram);
  assert.equal(matrixState(live.wram).dmaEnd[0], 0);
  assert.equal(matrixState(live.wram).dmaRecords[0], 0);
  assert.equal(live.wram[W.DMA_RECORD_COUNT], 0);
});

test('matrix text ring preserves bank words and wraps through the independent queue', () => {
  const reference = blankMemory(),
    live = blankMemory();
  detachObjectStorage(live.wram);
  const state = detachMatrix(live.wram);
  for (const mem of [reference, live]) {
    const m = { mem, wram: mem.wram };
    resetTextWindow(m);
    for (let n = 0; n < 9; n++) queueText(m, 0x7f4000 + 2 * n, 0x567f);
  }
  assert.deepEqual(toWram(live), reference.wram);
  assert.equal(state.textQueueEnd[0], 4);
  assert.equal(state.textQueueAddresses[0], 0x4010);
  assert.ok(state.textQueueBanks.every((v) => v === 0x567f));
  assert.equal(objectTable(live.wram).task[0], 0x802);
  assert.equal(live.wram[W.MATRIX_TEXT_QUEUE], 0);
});

test('decker byte fields retain odd health/skill and download/data word aliases', () => {
  const mem = blankMemory(),
    state = detachMatrix(mem.wram);
  mem.write16(0x800000 + W.DECKER_HEALTH, 0x5678);
  mem.write16(0x800000 + W.DECKER_DOWNLOAD_BITS, 0x1234);
  mem.write16(0x800000 + W.DECKER_RECORD, 0x9abc);
  assert.equal(state.deckerHealth[0], 0x78);
  assert.equal(state.computerSkill[0], 0x56);
  assert.equal(state.deckerDownloads[0], 0x34);
  assert.equal(state.deckerData[0], 0x12);
  assert.equal(state.deckerRecord[0], 0x9abc);
  assert.equal(state.deckerMemory[0], 0);
  assert.equal(mem.wram[W.DECKER_HEALTH], 0);
});

test('only the normal live loop detaches matrix storage', () => {
  assert.equal(matrixState(blankMemory().wram), undefined);
  const game = new LiveGame(new Uint8Array(ROM_SIZE));
  matrixState(game.memory.wram).health[0] = 30;
  assert.equal(game.memory.read16(W.MATRIX_HEALTH), 30);
  assert.equal(game.memory.wram[W.MATRIX_HEALTH], 0);
});
