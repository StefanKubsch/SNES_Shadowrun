import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRun } from './member-menu-caller-harness.mjs';
import { decimalNumberSequence as directDecimal } from '../src/game/decimal-number.mjs';
import { decimalNumberSequence as formerDecimal } from '../proof/caller/decimal-number.mjs';
for (const budget of [1, 7])
  for (const value of [0, 9, 10, 999, 1000, 999999, 1000000, 1000000000, 0xffffffff])
    for (const realDrawing of [false, true])
      test(`decimal caller: ${value}, budget ${budget}, real drawing ${realDrawing}`, () => {
        const prepare = ({ put }) => {
          put(2, value & 0xffff);
          put(4, value >>> 16);
        };
        const actual = compareRun(directDecimal, true, prepare, budget, [], realDrawing);
        assert.deepEqual(
          actual,
          compareRun(formerDecimal, false, prepare, budget, [], realDrawing),
        );
        if (realDrawing) assert.ok(actual.uploads.some(([pc]) => pc === 0x81accc));
        else {
          const bytes = actual.calls[0][2];
          assert.equal(
            String.fromCharCode(...bytes.subarray(0, bytes.indexOf(13))),
            value.toLocaleString('en-US'),
          );
        }
      });

import * as directMember from '../src/game/member-spell-menu.mjs';
import * as formerMember from '../proof/caller/member-spell-menu.mjs';
import { equipmentRowsSequence } from '../proof/caller/equipment-window.mjs';
import * as W from '../src/data/wram.mjs';
function runMember(module, direct, entry, levels, leader, pads, budget, realDrawing = false) {
  let services;
  return compareRun(
    (h, events, renderer) =>
      module.spellMenuSequence(
        h,
        events,
        direct ? services : renderer,
        entry,
        direct ? renderer : undefined,
      ),
    direct,
    ({ put, mem }) => {
      put(W.DP_MEMBER_RECORD, 0x6000);
      mem.wram[W.DP_MEMBER_RECORD_BANK] = 0x7e;
      mem.wram.set(levels, 0x6006);
      put(W.PLAYER_OBJECT, 2);
      put(W.MEMBER_OBJECT, leader ? 2 : 4);
      put(W.STATUS_WINDOW, 0);
      put(W.RUNNER_WEAPON, 0xffff);
      put(W.RUNNER_ARMOUR, 0xffff);
      put(W.SELECTED_SPELL_NAME, 0x714d);
    },
    budget,
    pads,
    realDrawing,
    ({ h, events, routines, bind }) => {
      services = routines;
      bind(0x80e9c5, () => equipmentRowsSequence(h, events, routines));
    },
  );
}
for (const budget of [1, 7])
  for (const [name, levels, leader, pads, entry] of [
    ['empty', [0, 0, 0, 0, 0, 0], true, [], 0x80e693],
    ['status empty', [0, 0, 0, 0, 0, 0], true, [], 0x80e68e],
    ['Exit', [1, 0, 2, 0, 0, 3], true, [0x8000], 0x80e693],
    ['leader selection', [1, 0, 2, 0, 0, 3], true, [0x400, 0, 0x400, 0, 0x8000], 0x80e693],
    ['cancel', [1, 2, 3, 1, 2, 3], false, [0x2000], 0x80e693],
    ['status runner selection', [1, 0, 0, 0, 0, 0], false, [0x400, 0, 0x8000], 0x80e68e],
  ])
    for (const realDrawing of [false, true])
      test(`member menu: ${name}, budget ${budget}, real drawing ${realDrawing}`, () => {
        const actual = runMember(
          directMember,
          true,
          entry,
          levels,
          leader,
          pads,
          budget,
          realDrawing,
        );
        assert.deepEqual(
          actual,
          runMember(formerMember, false, entry, levels, leader, pads, budget, realDrawing),
        );
        assert.equal(actual.input, pads.length);
        if (name === 'leader selection')
          assert.notEqual(
            actual.wram[W.SELECTED_SPELL_SCRIPT] | (actual.wram[W.SELECTED_SPELL_SCRIPT + 1] << 8),
            0,
          );
      });
