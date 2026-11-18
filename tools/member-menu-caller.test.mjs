import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareRun,
  configureMemberPortrait,
  configureScriptVisit,
} from './member-menu-caller-harness.mjs';
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
import { runResetWindowList } from '../proof/caller/window-list.mjs';
import { tasksOf } from '../src/script/task-api.mjs';
import { appendScriptTaskCall } from '../proof/caller/task-append-call.mjs';
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
  return compareRun(
    (h, events, renderer) =>
      module.spellMenuSequence(h, events, ...(direct ? [entry, renderer] : [renderer, entry])),
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
    (side) => {
      const { h, events, routines, bind, put, calls } = side;
      if (script) {
        tasksOf(h.a).reset();
        routines.set(0x80c34a, (callee) => appendScriptTaskCall(callee.a));
        for (const target of [0x80c1ca])
          routines.set(target, (callee) => {
            // The visit reads task state, not registers (user decision 2026-11-17).
            calls.push(['service', target]);
            if (target === 0x80c1ca) {
              put(W.DIALOG_END, script.end ? 0xffff : 0);
              put(W.MEMBER_PORTRAIT_REDRAW, script.redraw ? 1 : 0);
              if (script.notice) put(W.NOTICE_WINDOWS, 0);
            }
            return target === 0x81aeb0 ? callee.rtl() : callee.rts();
          });
      }
      if (script) configureScriptVisit(side, budget === 1);
      bind(0x80e9c5, () => equipmentRowsSequence(h, events, routines));
      routines.set(0x81aeb0, runResetWindowList);
      const finish = configureMemberPortrait(side);
      return finish;
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
      assert.equal(actual.calls.filter((c) => c[0] === 'service').length, 1);
      assert.equal(
        actual.calls.filter((c) => c[0] === 'portrait upload').length,
        !script.end && script.redraw ? 2 : 0,
      );
      assert.equal(
        actual.calls.filter((c) => c[0] === 'portrait frame').length,
        !script.end && script.redraw ? 11 : 0,
      );
    });

function runOpenMember(module, direct, levels, pads, budget, realDrawing) {
  return compareRun(
    (h, e, r) => module.openSpellMenuSequence(h, e, r),
    direct,
    ({ put, mem }) => {
      put(0, 2);
      put(W.PLAYER_OBJECT, 2);
      put(W.OBJECT_NUMBER + 2, mem.read16(0x809700));
      const record = mem.read16(0x80971a);
      mem.wram.set(levels, record + 12);
    },
    budget,
    pads,
    realDrawing,
  );
}
for (const budget of [1, 7])
  for (const [name, levels, pads] of [
    ['empty', [0, 0, 0, 0, 0, 0], []],
    ['Exit', [1, 0, 0, 0, 0, 0], [0x8000]],
    ['select', [1, 0, 0, 0, 0, 0], [0x400, 0, 0x8000]],
    ['cancel', [1, 2, 3, 0, 0, 0], [0x2000]],
  ])
    for (const realDrawing of [false, true])
      test(`member native entry: ${name}, budget ${budget}, real drawing ${realDrawing}`, () => {
        const actual = runOpenMember(directMember, true, levels, pads, budget, realDrawing);
        assert.deepEqual(
          actual,
          runOpenMember(formerMember, false, levels, pads, budget, realDrawing),
        );
        assert.equal(actual.input, pads.length);
        assert.equal(
          actual.wram[W.MEMBER_MENU_ACTIVE] | (actual.wram[W.MEMBER_MENU_ACTIVE + 1] << 8),
          0,
        );
        assert.equal(actual.wram[W.MEMBER_INDEX] | (actual.wram[W.MEMBER_INDEX + 1] << 8), 0);
      });

for (const budget of [1, 7])
  test(`member spell redraw with live glyphs, budget ${budget}`, () => {
    const pads = [0x400, 0, 0x8000, 0, 0x8000],
      script = { redraw: true, notice: true };
    const actual = runMember(
      directMember,
      true,
      0x80e693,
      [1, 0, 0, 0, 0, 0],
      false,
      pads,
      budget,
      true,
      script,
    );
    assert.deepEqual(
      actual,
      runMember(
        formerMember,
        false,
        0x80e693,
        [1, 0, 0, 0, 0, 0],
        false,
        pads,
        budget,
        true,
        script,
      ),
    );
    assert.ok(actual.uploads.some(([pc]) => pc === 0x81accc));
    assert.equal(actual.calls.filter((c) => c[0] === 'portrait upload').length, 2);
  });
