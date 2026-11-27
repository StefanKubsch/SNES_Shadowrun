import test from 'node:test';
import { withRts } from './register-forms/rts-forms.mjs';
import assert from 'node:assert/strict';
import { assertFrozenRun, useLiftVectors } from './lift-function-harness.mjs';
import { compareRun } from './member-menu-caller-harness.mjs';
import * as directLifted from '../src/game/runner-state-call.mjs';
const direct = withRts(directLifted);
import * as W from '../src/data/wram.mjs';
import { ACTOR_TABLE, ACTOR_RECORD } from '../src/data/actors.mjs';

useLiftVectors(import.meta.url);

function run(module, name, budget, amount, request, hasRecord) {
  let stateRecord;
  const result = compareRun(
    (h, events) => module[name](h, events),
    true,
    ({ mem, put }) => {
      const number = mem.read16(0x809700),
        second = mem.read16(0x809702),
        record = mem.read16(0x80971a),
        secondRecord = mem.read16(ACTOR_TABLE + ACTOR_RECORD + second);
      stateRecord = mem.read16(ACTOR_TABLE + ACTOR_RECORD + number);
      assert.ok(stateRecord && secondRecord);
      put(0, 2);
      put(2, amount);
      put(W.PLAYER_OBJECT, 2);
      put(W.OBJECT_NUMBER + 2, number);
      put(W.OBJECT_NUMBER + 4, second);
      put(W.OBJECT_RECORD + 2, hasRecord ? stateRecord : 0);
      put(W.OBJECT_RECORD + 4, secondRecord);
      put(W.GROUP_INDEX, 2);
      put(W.GROUP_NUMBERS, number);
      put(W.GROUP_NUMBERS + 2, second);
      mem.wram[record + 5] = 40;
      mem.wram[record + 1] = 3;
      mem.wram[stateRecord + 2] = 2;
      mem.wram[secondRecord + 2] = 1;
      mem.wram[W.MAGIC_POINTS] = 1;
      mem.wram[W.MAGIC_POINTS + 1] = 1;
      put(W.TEXT_MAP_UPLOAD, request);
    },
    budget,
  );
  return { ...result, count: result.wram[stateRecord + 2] };
}
for (const budget of [1, 7])
  for (const name of ['raiseStateCountSequence', 'restoreRunnersSequence'])
    for (const amount of [0, 1, 10, 255, 65535])
      for (const request of [0, 0xfffe, 0xffff])
        for (const hasRecord of [false, true])
          test(`runner resource caller: ${name}, amount ${amount}, request ${request}, record ${hasRecord}, budget ${budget}`, () => {
            const actual = run(direct, name, budget, amount, request, hasRecord);
            assertFrozenRun(actual);
            assert.equal(actual.uploads.length, request === 0xffff ? 0 : 1);
            assert.equal(
              actual.count,
              name === 'restoreRunnersSequence'
                ? 40
                : hasRecord
                  ? Math.min((2 + amount) & 0xffff, 40)
                  : 2,
            );
            if (name === 'restoreRunnersSequence') assert.equal(actual.wram[W.MAGIC_POINTS], 30);
          });
