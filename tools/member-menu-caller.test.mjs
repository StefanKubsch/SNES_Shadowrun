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
function runMember(
  module,
  direct,
  entry,
  levels,
  leader,
  pads,
  budget,
  realDrawing = false,
  script = null,
) {
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
      for (let n = 0; n <= W.NOTICE_WINDOW_LAST; n += 2) put(W.NOTICE_WINDOWS + n, 0xffff);
    },
    budget,
    pads,
    realDrawing,
    ({ h, events, routines, bind, put, calls }) => {
      services = routines;
      if (script) {
        for (const target of [0x80c34a, 0x80c1ca, 0x81aeb0, 0x80e4b3])
          routines.set(target, (callee) => {
            calls.push(['service', target, callee.ctx.a, callee.ctx.x]);
            if (target === 0x80c1ca) {
              put(W.DIALOG_END, script.end ? 0xffff : 0);
              put(W.MEMBER_PORTRAIT_REDRAW, script.redraw ? 1 : 0);
              if (script.notice) put(W.NOTICE_WINDOWS, 0);
            }
            return target === 0x81aeb0 ? callee.rtl() : callee.rts();
          });
      }
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

for (const budget of [1, 7])
  for (const script of [
    {},
    { end: true },
    { redraw: true },
    { notice: true },
    { redraw: true, notice: true },
    { end: true, redraw: true, notice: true },
  ])
    test(`member spell script cleanup: ${JSON.stringify(script)}, budget ${budget}`, () => {
      const pads = [0x400, 0, 0x8000, ...(!script.end && script.notice ? [0, 0x8000] : [])];
      const run = (module, direct) =>
        runMember(module, direct, 0x80e693, [1, 0, 0, 0, 0, 0], false, pads, budget, false, script);
      const actual = run(directMember, true);
      assert.deepEqual(actual, run(formerMember, false));
      assert.equal(actual.input, pads.length);
      assert.equal(
        actual.calls.filter((c) => c[0] === 'service').length,
        2 + (!script.end && script.redraw ? 2 : 0),
      );
    });
