import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareRun,
  configureMemberPortrait,
  configureScriptVisit,
} from './member-menu-caller-harness.mjs';
import * as directItem from '../src/game/item-menu.mjs';
import * as formerItem from '../proof/caller/item-menu.mjs';
import { equipmentRowsSequence } from '../proof/caller/equipment-window.mjs';
import * as W from '../src/data/wram.mjs';
import { runResetWindowList } from '../proof/caller/window-list.mjs';
import { createObject } from '../proof/script/native-object-create.mjs';
import { tasksOf } from '../src/script/task-api.mjs';
function runUse(module, direct, actor, effect, budget, realDrawing = false) {
  const pads = !effect.end && effect.notice ? [0x8000] : [];
  return compareRun(
    // The lifted item use takes the actor as a parameter (X in the original).
    (h, e, r) => module.useItemSequence(h, e, r, actor),
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
    (side) => {
      const { h, events, put, routines, bind, calls } = side;
      tasksOf(h.a).reset();
      put(W.OBJECT_KIND + 4, 0xffff);
      routines.set(0x80a835, (callee) => createObject(callee.a));
      for (const target of [0x80c1ca])
        routines.set(target, (callee) => {
          // The visit reads task state, not registers (user decision 2026-11-17).
          calls.push(['service', target]);
          if (target === 0x80a835) put(0, 4);
          if (target === 0x80c1ca) {
            put(W.DIALOG_END, effect.end ? 0xffff : 0);
            put(W.MEMBER_PORTRAIT_REDRAW, effect.redraw ? 1 : 0);
          }
          return target === 0x81aeb0 ? callee.rtl() : callee.rts();
        });
      bind(0x80e9c5, () => equipmentRowsSequence(h, events, routines));
      routines.set(0x81aeb0, runResetWindowList);
      configureScriptVisit(side, budget === 1);
      const finish = configureMemberPortrait(side);
      return finish;
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
        assert.equal(actual.calls.filter((c) => c[0] === 'service').length, 1);
        assert.equal(
          actual.calls.filter((c) => c[0] === 'portrait upload').length,
          !effect.end && effect.redraw ? 2 : 0,
        );
        assert.equal(
          actual.calls.filter((c) => c[0] === 'portrait frame').length,
          !effect.end && effect.redraw ? 11 : 0,
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

import {
  ACTOR_TABLE,
  ACTOR_BYTES,
  LAST_ACTOR,
  STATE_HOLDER,
  STATE_COUNT,
} from '../src/data/actors.mjs';
import { chooseFromMenuSequence } from '../proof/caller/menu-choice.mjs';
import { requestTileClearSequence } from '../proof/caller/window-open.mjs';
function runItemMenu(module, direct, entry, variant, budget, realDrawing = false) {
  const selected = variant === 'use' || variant === 'rebuild';
  const pads =
    variant === 'empty'
      ? []
      : variant === 'cancel'
        ? [0x2000]
        : selected
          ? [0x400, 0, 0x8000, ...(variant === 'rebuild' ? [0, 0x8000] : [])]
          : [0x8000];
  let heldRecord;
  return compareRun(
    (h, e, r) => module.itemMenuSequence(h, e, ...(direct ? [entry, r] : [r, entry])),
    direct,
    ({ put, mem }) => {
      put(W.MEMBER_NUMBER, 0x1234);
      put(W.MEMBER_OBJECT, 2);
      put(W.PLAYER_OBJECT, 2);
      put(W.STATUS_WINDOW, 0);
      put(W.RUNNER_WEAPON, 0xffff);
      put(W.RUNNER_ARMOUR, 0xffff);
      put(W.SELECTED_SPELL_NAME, 0x714d);
      put(W.STORY_STAGE, 0xffff);
      put(W.STATUS_ITEMS_AT_ONCE, variant === 'empty' ? 0 : 0xffff);
      for (let n = 0; n <= W.NOTICE_WINDOW_LAST; n += 2) put(W.NOTICE_WINDOWS + n, 0xffff);
      if (selected) {
        const itemClass = directItem.ITEM_ENTRIES[entry];
        for (let actor = LAST_ACTOR; actor >= 0; actor -= ACTOR_BYTES) {
          const at = ACTOR_TABLE + actor,
            record = mem.read16(at + 1),
            kind = mem.read16(at + 3);
          if (
            record &&
            mem.read16(0x8cefb0 + 6 * kind) !== 0xffff &&
            mem.read8(at) & 0x7f &&
            (mem.read16(0x8cefb4 + 6 * kind) & 3) === itemClass
          ) {
            heldRecord = record;
            put(record + STATE_HOLDER, 0x1234);
            mem.wram[record + STATE_COUNT] = 255;
            break;
          }
        }
        assert.ok(heldRecord, 'a real item record for this class');
      }
    },
    budget,
    pads,
    realDrawing,
    (side) => {
      const { h, events, put, routines, bind, calls } = side;
      tasksOf(h.a).reset();
      put(W.OBJECT_KIND + 4, 0xffff);
      bind(0x80a6ad, () => chooseFromMenuSequence(h, events, routines, 0x80a6ad));
      bind(0x80fa67, () => requestTileClearSequence(h, events));
      bind(0x80e9c5, () => equipmentRowsSequence(h, events, routines));
      bind(0x80e4f3, () => formerItem.useItemSequence(h, events, routines));
      routines.set(0x80a835, (callee) => createObject(callee.a));
      routines.set(0x80c1ca, (callee) => {
        // The visit reads no registers (user decision 2026-11-17).
        calls.push(['visit']);
        if (variant === 'use') put(W.DIALOG_END, 0xffff);
        else put(heldRecord + STATE_HOLDER, 0);
        return callee.rts();
      });
      configureScriptVisit(side, budget === 1);
    },
  );
}
for (const budget of [1, 7])
  for (const entry of [0x80e572, 0x80e577, 0x80e57f])
    for (const variant of ['empty', 'Exit', 'cancel', 'use', 'rebuild'])
      test(`item menu: entry ${entry}, ${variant}, budget ${budget}`, () => {
        const actual = runItemMenu(directItem, true, entry, variant, budget);
        assert.deepEqual(actual, runItemMenu(formerItem, false, entry, variant, budget));
        assert.equal(
          actual.input,
          variant === 'empty' ? 0 : variant === 'rebuild' ? 5 : variant === 'use' ? 3 : 1,
        );
        assert.equal(
          actual.calls.filter((c) => c[0] === 'visit').length,
          variant === 'use' || variant === 'rebuild' ? 1 : 0,
        );
      });
for (const budget of [1, 7])
  test(`item menu default glyphs, budget ${budget}`, () => {
    const actual = runItemMenu(directItem, true, 0x80e572, 'rebuild', budget, true);
    assert.deepEqual(actual, runItemMenu(formerItem, false, 0x80e572, 'rebuild', budget, true));
    assert.ok(actual.uploads.some(([pc]) => pc === 0x81accc));
  });

for (const budget of [1, 7])
  test(`item redraw with live glyphs, budget ${budget}`, () => {
    const effect = { redraw: true, notice: true };
    const actual = runUse(directItem, true, 7, effect, budget, true);
    assert.deepEqual(actual, runUse(formerItem, false, 7, effect, budget, true));
    assert.ok(actual.uploads.some(([pc]) => pc === 0x81accc));
    assert.equal(actual.calls.filter((c) => c[0] === 'portrait upload').length, 2);
  });
