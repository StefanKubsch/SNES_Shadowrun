import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRun } from './member-menu-caller-harness.mjs';
import * as directStatus from '../src/game/status-screen.mjs';
import * as formerStatus from '../proof/caller/status-screen.mjs';
import { decimalNumberSequence } from '../proof/caller/decimal-number.mjs';
import { equipmentRowsSequence } from '../proof/caller/equipment-window.mjs';
import { clearFixedColourRoutine } from '../src/game/dialog-talk.mjs';
import * as W from '../src/data/wram.mjs';
function runStatus(module, direct, entry, runner, variant, budget, realDrawing = false) {
  let services;
  const pads =
    entry === 0x80ea8e
      ? []
      : variant === 'submenu'
        ? [0x400, 0, 0x8000]
        : [variant === 'cancel' ? 0x2000 : 0x8000];
  return compareRun(
    (h, e, r) =>
      module.statusScreenSequence(h, e, direct ? services : r, entry, direct ? r : undefined),
    direct,
    ({ put, mem }) => {
      const number = mem.read16(0x809700 + 2 * runner),
        jake = mem.read16(0x809700),
        record = mem.read16(0x80971a);
      put(0, variant === 'fallback' ? 6 : 2);
      put(W.PLAYER_OBJECT, 2);
      put(W.GLOVE_TARGET_TAG, 0xffff);
      put(W.OBJECT_NUMBER + 2, number);
      put(W.OBJECT_NUMBER + 6, 0x1234);
      put(W.OBJECT_RECORD + 2, 0x6200);
      put(W.OBJECT_RECORD + 6, 0x6220);
      mem.wram[0x6202] = 255;
      put(W.GROUP_INDEX, 0);
      put(W.GROUP_NUMBERS, number);
      put(W.GLOVE_KIND, 3);
      for (let n = 0; n <= W.NOTICE_WINDOW_LAST; n += 2) put(W.NOTICE_WINDOWS + n, 0xffff);
      mem.wram.set([2, 3, 99, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 0, 0, 0, 0, 0], record);
      put(W.KARMA, 0xffff);
      put(W.NUYEN, 0xffff);
      put(W.NUYEN + 2, 0xffff);
      put(W.SELECTED_SPELL_NAME, 0x714d);
      for (let n = 0; n < 26; n += 2) {
        put(W.RUNNER_WEAPON + n, 0xffff);
        put(W.RUNNER_ARMOUR + n, 0xffff);
      }
      assert.ok(jake, 'real runner table');
    },
    budget,
    pads,
    realDrawing,
    ({ h, mem, events, put, routines, bind, calls }) => {
      services = routines;
      routines.set(0x81886a, clearFixedColourRoutine);
      for (const target of [0x81f007, 0x8092c5, 0x80e4b3])
        routines.set(target, (callee) => {
          calls.push(['service', target, callee.ctx.a, callee.ctx.x]);
          return target === 0x81f007 ? callee.rtl() : callee.rts();
        });
      bind(0x80fdcf, () => decimalNumberSequence(h, events, routines));
      bind(0x80e9c5, () => equipmentRowsSequence(h, events, routines));
      for (let row = 1; row <= 6; row++) {
        const target = 0x800000 | mem.read16(0x80ed2e + 2 * row);
        routines.set(target, (callee) => {
          calls.push(['submenu', target]);
          if (entry !== 0x80ea8e) put(W.DIALOG_END, 0xffff);
          return callee.rts();
        });
      }
    },
  );
}
for (const budget of [1, 7])
  for (const runner of [0, 1])
    for (const [entry, variant] of [
      [0x80ea6e, 'Exit'],
      [0x80ea89, 'Exit'],
      [0x80ea8e, 'items'],
      [0x80ea6e, 'fallback'],
      [0x80ea89, 'cancel'],
      [0x80ea89, 'submenu'],
    ])
      test(`status caller: entry ${entry}, runner ${runner}, ${variant}, budget ${budget}`, () => {
        const actual = runStatus(directStatus, true, entry, runner, variant, budget);
        assert.deepEqual(actual, runStatus(formerStatus, false, entry, runner, variant, budget));
        assert.equal(actual.input, entry === 0x80ea8e ? 0 : variant === 'submenu' ? 3 : 1);
        assert.equal(
          actual.wram[W.MEMBER_MENU_ACTIVE] | (actual.wram[W.MEMBER_MENU_ACTIVE + 1] << 8),
          0,
        );
        assert.equal(actual.calls.filter((c) => c[0] === 'service' && c[1] === 0x81f007).length, 2);
      });

for (const budget of [1, 7])
  for (const runner of [0, 1])
    test(`status default glyphs: runner ${runner}, budget ${budget}`, () => {
      const actual = runStatus(directStatus, true, 0x80ea89, runner, 'Exit', budget, true);
      assert.deepEqual(
        actual,
        runStatus(formerStatus, false, 0x80ea89, runner, 'Exit', budget, true),
      );
      assert.ok(actual.uploads.some(([pc]) => pc === 0x81accc));
    });
