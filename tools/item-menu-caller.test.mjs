import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRun } from './member-menu-caller-harness.mjs';
import * as directItem from '../src/game/item-menu.mjs';
import * as formerItem from '../proof/caller/item-menu.mjs';
import { equipmentRowsSequence } from '../proof/caller/equipment-window.mjs';
import * as W from '../src/data/wram.mjs';
function runUse(module, direct, actor, effect, budget, realDrawing = false) {
  let services;
  const pads = !effect.end && effect.notice ? [0x8000] : [];
  return compareRun(
    (h, e, r) => module.useItemSequence(h, e, direct ? services : r, direct ? r : undefined),
    direct,
    ({ h, mem, put }) => {
      h.ctx.x = actor;
      put(W.MEMBER_OBJECT, 2);
      put(W.PLAYER_OBJECT, 2);
      for (const field of [W.OBJECT_X, W.OBJECT_Y, W.OBJECT_HEIGHT]) put(field + 2, 0xffff);
      put(W.RUNNER_WEAPON, 0xffff);
      put(W.RUNNER_ARMOUR, 0xffff);
      put(W.STATUS_WINDOW, 0);
      put(W.SELECTED_SPELL_NAME, 0x714d);
      for (let n = 0; n <= W.NOTICE_WINDOW_LAST; n += 2) put(W.NOTICE_WINDOWS + n, 0xffff);
      if (effect.notice) {
        put(W.NOTICE_WINDOWS, 0);
        mem.wram[W.WINDOW_ACTIVE] = 1;
      }
    },
    budget,
    pads,
    realDrawing,
    ({ h, events, put, routines, bind, calls }) => {
      services = routines;
      for (const target of [0x80a835, 0x80c1ca, 0x81aeb0, 0x80e4b3])
        routines.set(target, (callee) => {
          calls.push(['service', target, callee.ctx.a, callee.ctx.x, callee.ctx.y]);
          if (target === 0x80a835) put(0, 4);
          if (target === 0x80c1ca) {
            put(W.DIALOG_END, effect.end ? 0xffff : 0);
            put(W.MEMBER_PORTRAIT_REDRAW, effect.redraw ? 1 : 0);
          }
          return target === 0x81aeb0 ? callee.rtl() : callee.rts();
        });
      bind(0x80e9c5, () => equipmentRowsSequence(h, events, routines));
    },
  );
}
for (const budget of [1, 7])
  for (const actor of [0, 7, 14])
    for (const effect of [
      {},
      { end: true },
      { redraw: true },
      { notice: true },
      { redraw: true, notice: true },
      { end: true, redraw: true, notice: true },
    ])
      test(`item use: actor ${actor}, effect ${JSON.stringify(effect)}, budget ${budget}`, () => {
        const actual = runUse(directItem, true, actor, effect, budget);
        assert.deepEqual(actual, runUse(formerItem, false, actor, effect, budget));
        assert.equal(actual.input, !effect.end && effect.notice ? 1 : 0);
        assert.equal(
          actual.calls.filter((c) => c[0] === 'service').length,
          2 + (!effect.end && effect.redraw ? 2 : 0),
        );
        assert.equal(
          actual.wram[W.OBJECT_NUMBER + 4] | (actual.wram[W.OBJECT_NUMBER + 5] << 8),
          actor,
        );
      });
for (const budget of [1, 7])
  test(`item use default glyphs, budget ${budget}`, () => {
    const actual = runUse(directItem, true, 0, {}, budget, true);
    assert.deepEqual(actual, runUse(formerItem, false, 0, {}, budget, true));
    assert.ok(actual.uploads.some(([pc]) => pc === 0x81accc));
  });
