import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRun } from './member-menu-caller-harness.mjs';
import { liftedMainMenuSequence } from '../src/game/main-upkeep.mjs';
import { raiseStateCountSequence } from '../src/game/runner-state-call.mjs';
import { raiseMemberMagicPoints } from '../src/script/native-magic-points-raise.mjs';
import * as directMain from '../src/game/main-menu.mjs';
import * as formerMain from '../proof/caller/main-menu.mjs';
import { installPortExtension } from '../src/data/port-extension.mjs';
import { occupiedSlots } from '../src/game/save-slots.mjs';
import * as directKarma from '../src/game/karma-menu.mjs';
import * as formerKarma from '../proof/caller/karma-menu.mjs';
import { requestTileClearSequence } from '../proof/caller/window-open.mjs';
import { chooseFromMenuSequence as formerChoose } from '../proof/caller/menu-choice.mjs';
import { KARMA_LISTS } from '../src/system/native-main-menu.mjs';

import * as W from '../src/data/wram.mjs';

function runMain(direct, budget, pads, realDrawing = false, liveEntry = false) {
  let services;
  return compareRun(
    (h, events, renderer) =>
      liveEntry && direct
        ? liftedMainMenuSequence(h, events)
        : (direct ? directMain : formerMain).mainMenuSequence(
            h,
            events,
            services,
            direct ? renderer : undefined,
          ),
    direct,
    ({ put, mem }) => {
      put(W.TIMER, 0xffff);
      if (liveEntry) {
        const number = mem.read16(0x809700),
          record = mem.read16(0x80971a);
        put(W.PLAYER_OBJECT, 2);
        put(W.OBJECT_NUMBER + 2, number);
        put(W.OBJECT_RECORD + 2, 0x6200);
        mem.wram[record + 5] = 40;
        mem.wram[record + 1] = 3;
        mem.wram[0x6202] = 2;
        mem.wram[W.MAGIC_POINTS] = 1;
        put(W.GROUP_INDEX, 0);
        put(W.GROUP_NUMBERS, number);
        mem.wram[record + 1] = 3;
        mem.wram[record + 5] = 40;
        mem.wram[0x6202] = 1;
        mem.wram[W.MAGIC_POINTS] = 1;
      }
      put(W.GLOVE_KIND, 3);
      for (let n = 0; n <= W.NOTICE_WINDOW_LAST; n += 2) put(W.NOTICE_WINDOWS + n, 0xffff);
    },
    budget,
    pads,
    realDrawing,
    ({ routines, calls, bind, h, events }) => {
      services = routines;
      bind(0x80cdd6, () => formerMain.saveMenuSequence(h, events, routines));
      bind(0x80ee57, () => formerKarma.karmaMenuSequence(h, events, routines));
      bind(0x80fa67, () => requestTileClearSequence(h, events));
      bind(0x80ef82, () => formerKarma.karmaLineSequence(h, events, routines));
      for (const target of [0x80cecb, 0x80cf2e])
        routines.set(target, (callee) => {
          calls.push(['refill', target, callee.a.mem.read16(0), callee.a.mem.read16(2)]);
          return callee.rts();
        });
      if (liveEntry) {
        bind(0x80cecb, () => raiseStateCountSequence(h, events));
        routines.set(0x80cf2e, (callee) => raiseMemberMagicPoints(callee.a, false));
      }
      if (direct)
        services = new Map(
          [...routines].filter(([target]) => [0x80c46e, 0x80cecb, 0x80cf2e].includes(target)),
        );
    },
  );
}

for (const budget of [1, 7])
  for (const [name, pads, submenus] of [
    ['Exit', [0x8000], 0],
    ['cancel', [0x2000], 0],
    ['save', [0x400, 0, 0x8000, 0, 0x8000, 0, 0x8000], 0],
    ['karma', [0x400, 0, 0x400, 0, 0x8000, 0, 0x8000, 0, 0x8000], 0],
  ])
    test(`main windows: ${name}, budget ${budget}`, () => {
      const actual = runMain(true, budget, pads);
      assert.deepEqual(actual, runMain(false, budget, pads));
      assert.equal(actual.input, pads.length);
      assert.equal(actual.calls.filter((c) => c[0] === 'submenu').length, submenus);
    });

for (const budget of [1, 7])
  test(`main default glyphs, budget ${budget}`, () => {
    const pads = [0x8000];
    const actual = runMain(true, budget, pads, true);
    assert.deepEqual(actual, runMain(false, budget, pads, true));
    assert.ok(actual.uploads.length > 2);
  });

function runBlocked(direct, budget, timer, realDrawing = false) {
  let services;
  return compareRun(
    (h, events, renderer) =>
      (direct ? directMain : formerMain).saveMenuSequence(
        h,
        events,
        services,
        direct ? renderer : undefined,
      ),
    direct,
    ({ put }) => put(W.TIMER, timer),
    budget,
    [0, 0x8000],
    realDrawing,
    ({ routines }) => {
      services = routines;
    },
  );
}
for (const budget of [1, 7])
  for (const timer of [0, 1, 0x7fff])
    test(`blocked save: timer ${timer}, budget ${budget}`, () => {
      const actual = runBlocked(true, budget, timer);
      assert.deepEqual(actual, runBlocked(false, budget, timer));
      assert.equal(actual.input, 2);
      assert.equal(actual.calls.filter((c) => c[0] === 'text').length, 1);
    });
for (const budget of [1, 7])
  test(`blocked save default glyphs, budget ${budget}`, () => {
    const actual = runBlocked(true, budget, 0, true);
    assert.deepEqual(actual, runBlocked(false, budget, 0, true));
    assert.ok(actual.uploads.length > 2);
  });

function runSave(direct, budget, slot, four = false, realDrawing = false) {
  let services, sram;
  const pads =
    slot < 0 ? [0x2000] : [...Array.from({ length: slot }, () => [0x400, 0]).flat(), 0x8000];
  const result = compareRun(
    (h, e, r) =>
      (direct ? directMain : formerMain).saveMenuSequence(h, e, services, direct ? r : undefined),
    direct,
    ({ put, mem, a }) => {
      put(W.TIMER, 0x8000);
      mem.sram = new Uint8Array(four ? 0x4000 : 0x2000).fill(0xa5);
      sram = mem.sram;
      a.vm.gameplay = { fourSaveSlots: four };
      if (four) installPortExtension(mem);
      for (let n = 0; n < 0xf28; n++) mem.wram[W.SAVE_STATE_START + n] = (n * 17 + 3) & 0xff;
    },
    budget,
    pads,
    realDrawing,
    ({ routines }) => {
      services = routines;
    },
  );
  return { ...result, sram: sram.slice() };
}
for (const budget of [1, 7])
  for (const four of [false, true])
    for (const slot of [-1, 0, 1, 2, ...(four ? [3, 4] : [])])
      test(`save slots: ${slot}, four ${four}, budget ${budget}`, () => {
        const actual = runSave(true, budget, slot, four);
        assert.deepEqual(actual, runSave(false, budget, slot, four));
        assert.deepEqual(
          occupiedSlots(actual.sram),
          Array.from({ length: four ? 4 : 2 }, (_, n) => n === slot - 1),
        );
        if (slot <= 0) assert.ok(actual.sram.every((v) => v === 0xa5));
      });
for (const budget of [1, 7])
  test(`save slots default glyphs, budget ${budget}`, () => {
    const actual = runSave(true, budget, 4, true, true);
    assert.deepEqual(actual, runSave(false, budget, 4, true, true));
    assert.equal(occupiedSlots(actual.sram)[3], true);
  });

function runKarma(name, direct, budget, prepare, pads = [], realDrawing = false, entry) {
  let services;
  return compareRun(
    (h, e, r) => {
      const m = direct ? directKarma : formerKarma;
      return name === 'karmaMenuSequence' || name === 'karmaListSequence'
        ? m[name](
            h,
            e,
            services,
            ...(name === 'karmaListSequence'
              ? [entry, direct ? r : undefined]
              : [direct ? r : undefined]),
          )
        : m[name](h, e, direct ? r : services);
    },
    direct,
    prepare,
    budget,
    pads,
    realDrawing,
    ({ routines, bind, h, events, calls }) => {
      services = routines;
      bind(0x80fa67, () => requestTileClearSequence(h, events));
      bind(0x80a6b8, () => formerChoose(h, events, routines, 0x80a6b8));
      bind(0x80ef82, () => formerKarma.karmaLineSequence(h, events, routines));
      bind(0x80f006, () => formerKarma.buyStepSequence(h, events, routines));
      for (const entry of Object.keys(KARMA_LISTS).map(Number))
        bind(entry, () => formerKarma.karmaListSequence(h, events, routines, entry));
      for (const target of [0x80cecb, 0x80cf2e])
        routines.set(target, (callee) => {
          calls.push(['refill', target, callee.a.mem.read16(0), callee.a.mem.read16(2)]);
          return callee.rts();
        });
      if (direct)
        services = new Map(
          [...routines].filter(([target]) => [0x80cecb, 0x80cf2e].includes(target)),
        );
    },
  );
}
for (const budget of [1, 7])
  for (const karma of [0, 7, 8, 79, 80, 799, 800, 0xffff])
    test(`karma balance: ${karma}, budget ${budget}`, () => {
      const prepare = ({ put }) => {
        put(W.KARMA, karma);
        put(W.KARMA_BALANCE_WINDOW, 0);
      };
      const actual = runKarma('karmaLineSequence', true, budget, prepare);
      assert.deepEqual(actual, runKarma('karmaLineSequence', false, budget, prepare));
      assert.equal(
        actual.wram[W.DP_KARMA_DISPLAY] | (actual.wram[W.DP_KARMA_DISPLAY + 1] << 8),
        karma >>> 3,
      );
    });
for (const budget of [1, 7])
  test(`karma balance default glyphs, budget ${budget}`, () => {
    const prepare = ({ put }) => put(W.KARMA, 0xffff);
    const actual = runKarma('karmaLineSequence', true, budget, prepare, [], true);
    assert.deepEqual(actual, runKarma('karmaLineSequence', false, budget, prepare, [], true));
    assert.ok(actual.uploads.length > 1);
  });

for (const budget of [1, 7])
  for (const bank of [0x7e, 0x7f])
    for (const [value, karma] of [
      [0, 0],
      [1, 7],
      [1, 8],
      [1, 9],
      [255, 2039],
      [255, 2040],
      [255, 0xffff],
    ])
      test(`karma purchase: value ${value}, karma ${karma}, bank ${bank}, budget ${budget}`, () => {
        const address = bank * 0x10000 + 0x6000,
          paid = karma >= value * 8;
        const prepare = ({ put, mem }) => {
          put(W.KARMA, karma);
          put(W.DP_KARMA_VALUE_POINTER, 0x6000);
          put(W.DP_KARMA_VALUE_BANK, bank);
          mem.write8(address, value);
        };
        const pads = paid ? [] : [0, 0x8000];
        const actual = runKarma('buyStepSequence', true, budget, prepare, pads);
        assert.deepEqual(actual, runKarma('buyStepSequence', false, budget, prepare, pads));
        assert.equal(actual.wram[address - 0x7e0000], paid ? (value + 1) & 255 : value);
        assert.equal(
          actual.wram[W.KARMA] | (actual.wram[W.KARMA + 1] << 8),
          paid ? karma - value * 8 : karma,
        );
        assert.equal(
          actual.wram[W.DP_KARMA_VALUE_POINTER] | (actual.wram[W.DP_KARMA_VALUE_POINTER + 1] << 8),
          paid ? 0x6000 : 0,
        );
      });
for (const budget of [1, 7])
  test(`karma purchase default glyphs, budget ${budget}`, () => {
    const prepare = ({ put, mem }) => {
      put(W.DP_KARMA_VALUE_POINTER, 0x6000);
      put(W.DP_KARMA_VALUE_BANK, 0x7e);
      mem.wram[0x6000] = 1;
    };
    const actual = runKarma('buyStepSequence', true, budget, prepare, [0x8000], true);
    assert.deepEqual(actual, runKarma('buyStepSequence', false, budget, prepare, [0x8000], true));
    assert.ok(actual.uploads.length > 2);
  });

function listFixture(entry, variant, karma = 0xffff) {
  return ({ put, mem }) => {
    put(W.KARMA, karma);
    put(W.KARMA_BALANCE_WINDOW, 0);
    put(W.KARMA_LIST_WINDOW, 2);
    put(0, 0);
    put(W.WINDOW_COLUMNS + 2, 16);
    put(W.WINDOW_ROWS + 2, 9);
    put(W.WINDOW_TILE_START + 2, 0x2070);
    put(W.WINDOW_CURSOR_TILE + 2, 0x2070);
    put(W.WINDOW_TILE_COUNT + 2, 98);
    put(W.WINDOW_LAST_INDEX, 2);
    const list = KARMA_LISTS[entry];
    for (let index = 0; index < list.end; index += 2) {
      const pointer = mem.read16(0x800000 + list.pointers + index),
        limit = mem.read16(0x800000 + list.limits + index);
      mem.wram[pointer] =
        variant === 'empty'
          ? 0
          : variant === 'limit'
            ? limit
            : variant === 'sparse' && index % 4
              ? 0
              : 1;
    }
  };
}
for (const budget of [1, 7])
  for (const entry of Object.keys(KARMA_LISTS).map(Number))
    for (const variant of ['empty', 'limit', 'sparse', 'all'])
      test(`karma list rendering: ${entry}, ${variant}, budget ${budget}`, () => {
        const prepare = listFixture(entry, variant),
          pads = [0x8000];
        const actual = runKarma('karmaListSequence', true, budget, prepare, pads, false, entry);
        assert.deepEqual(
          actual,
          runKarma('karmaListSequence', false, budget, prepare, pads, false, entry),
        );
        const list = KARMA_LISTS[entry],
          count = ['empty', 'limit'].includes(variant)
            ? 0
            : variant === 'all'
              ? list.end / 2
              : Math.ceil(list.end / 4);
        assert.equal(
          actual.wram[W.KARMA_ROW_NAMES + 2 * count] |
            (actual.wram[W.KARMA_ROW_NAMES + 2 * count + 1] << 8),
          0,
        );
        assert.equal(actual.input, 1);
      });
for (const budget of [1, 7])
  for (const entry of Object.keys(KARMA_LISTS).map(Number))
    test(`karma list rendering default glyphs: ${entry}, budget ${budget}`, () => {
      const prepare = listFixture(entry, 'all');
      const actual = runKarma('karmaListSequence', true, budget, prepare, [0x8000], true, entry);
      assert.deepEqual(
        actual,
        runKarma('karmaListSequence', false, budget, prepare, [0x8000], true, entry),
      );
      assert.ok(actual.uploads.length > 2);
    });

for (const budget of [1, 7])
  for (const entry of Object.keys(KARMA_LISTS).map(Number))
    for (const variant of ['paid', 'insufficient', 'limit'])
      test(`karma list purchase: ${entry}, ${variant}, budget ${budget}`, () => {
        const list = KARMA_LISTS[entry];
        let pointer, oldValue;
        const paid = variant !== 'insufficient';
        const prepare = (side) => {
          listFixture(entry, 'empty')(side);
          const { put, mem } = side;
          pointer = mem.read16(0x800000 + list.pointers);
          oldValue = variant === 'limit' ? mem.read16(0x800000 + list.limits) - 1 : 1;
          mem.wram[pointer] = oldValue;
          mem.wram[W.JAKE_COUNT_MAX] = 250;
          put(W.KARMA, paid ? oldValue * 8 : oldValue * 8 - 1);
        };
        const pads = [0x400, 0, 0x8000, ...(paid ? [] : [0, 0x8000]), 0, 0x2000];
        const actual = runKarma('karmaListSequence', true, budget, prepare, pads, false, entry);
        assert.deepEqual(
          actual,
          runKarma('karmaListSequence', false, budget, prepare, pads, false, entry),
        );
        assert.equal(actual.wram[pointer], oldValue + (paid ? 1 : 0));
        assert.equal(
          actual.wram[W.KARMA] | (actual.wram[W.KARMA + 1] << 8),
          paid ? 0 : oldValue * 8 - 1,
        );
        assert.equal(
          actual.calls.filter((c) => c[0] === 'refill').length,
          paid && pointer === W.JAKE_BODY ? 1 : 0,
        );
        assert.equal(actual.wram[W.JAKE_COUNT_MAX], paid && pointer === W.JAKE_BODY ? 4 : 250);
        assert.equal(actual.input, pads.length);
      });
for (const budget of [1, 7])
  test(`karma list purchase default glyphs, budget ${budget}`, () => {
    const entry = 0x80f0f3,
      prepare = listFixture(entry, 'all'),
      pads = [0x400, 0, 0x8000, 0, 0x2000];
    const actual = runKarma('karmaListSequence', true, budget, prepare, pads, true, entry);
    assert.deepEqual(
      actual,
      runKarma('karmaListSequence', false, budget, prepare, pads, true, entry),
    );
  });

function karmaMenuFixture(variant = 'none') {
  return ({ put }) => {
    put(W.KARMA, 0xffff);
    put(W.GLOVE_KIND, 3);
    put(W.GLOVE_TARGET_TAG, 0xffff);
    for (let n = 0; n <= W.NOTICE_WINDOW_LAST; n += 2) put(W.NOTICE_WINDOWS + n, 0xffff);
    if (variant === 'notice' || variant === 'both') put(W.NOTICE_WINDOWS, 0);
    if (variant === 'glove' || variant === 'both') {
      const window = variant === 'both' ? 2 : 0;
      put(W.GLOVE_TARGET_TAG, 0);
      put(W.GLOVE_NAME_WINDOW, window);
      if (window) {
        put(W.WINDOW_ACTIVE + window, 0xffff);
        put(W.WINDOW_LAST_INDEX, window);
        for (const [field, value] of [
          [W.WINDOW_COLUMNS, 14],
          [W.WINDOW_ROWS, 8],
          [W.WINDOW_TILE_START, 0x2070],
          [W.WINDOW_CURSOR_TILE, 0x2070],
        ])
          put(field + window, value);
      }
    }
  };
}
for (const budget of [1, 7])
  for (const variant of ['none', 'notice', 'glove', 'both'])
    for (const pads of [[0x8000], [0x2000]])
      test(`karma windows: ${variant}, pad ${pads[0]}, budget ${budget}`, () => {
        const prepare = karmaMenuFixture(variant);
        const actual = runKarma('karmaMenuSequence', true, budget, prepare, pads);
        assert.deepEqual(actual, runKarma('karmaMenuSequence', false, budget, prepare, pads));
        assert.equal(actual.calls.filter((c) => c[0] === 'refill').length, 2);
        assert.equal(actual.wram[W.GLOVE_KIND], 0);
        assert.equal(actual.input, pads.length);
      });
for (const budget of [1, 7])
  for (const row of [1, 2, 3])
    test(`karma windows detail: row ${row}, budget ${budget}`, () => {
      const pads = [
        ...Array.from({ length: row }, () => [0x400, 0]).flat(),
        0x8000,
        0,
        0x8000,
        0,
        0x8000,
      ];
      const prepare = karmaMenuFixture();
      const actual = runKarma('karmaMenuSequence', true, budget, prepare, pads);
      assert.deepEqual(actual, runKarma('karmaMenuSequence', false, budget, prepare, pads));
      assert.equal(actual.input, pads.length);
    });
for (const budget of [1, 7])
  test(`karma windows default glyphs, budget ${budget}`, () => {
    const prepare = karmaMenuFixture('both'),
      pads = [0x8000];
    const actual = runKarma('karmaMenuSequence', true, budget, prepare, pads, true);
    assert.deepEqual(actual, runKarma('karmaMenuSequence', false, budget, prepare, pads, true));
  });

for (const budget of [1, 7])
  for (const row of [1, 2, 3])
    for (const paid of [false, true])
      test(`karma orchestration: row ${row}, paid ${paid}, budget ${budget}`, () => {
        let pointer;
        const prepare = (side) => {
          karmaMenuFixture()(side);
          const { put, mem } = side,
            entry = row === 1 ? 0x80f0f3 : row === 2 ? 0x80f054 : 0x80f1b5;
          for (const list of Object.values(KARMA_LISTS))
            for (let n = 0; n < list.end; n += 2)
              mem.wram[mem.read16(0x800000 + list.pointers + n)] = 0;
          pointer = mem.read16(0x800000 + KARMA_LISTS[entry].pointers);
          mem.wram[pointer] = 1;
          put(W.KARMA, paid ? 8 : 7);
        };
        const pads = [
          ...Array.from({ length: row }, () => [0x400, 0]).flat(),
          0x8000,
          0,
          0x400,
          0,
          0x8000,
          ...(paid ? [] : [0, 0x8000]),
          0,
          0x2000,
          0,
          0x8000,
        ];
        const actual = runKarma('karmaMenuSequence', true, budget, prepare, pads);
        assert.deepEqual(actual, runKarma('karmaMenuSequence', false, budget, prepare, pads));
        assert.equal(actual.wram[pointer], paid ? 2 : 1);
        assert.equal(actual.wram[W.KARMA] | (actual.wram[W.KARMA + 1] << 8), paid ? 0 : 7);
        assert.equal(actual.input, pads.length);
        assert.equal(
          actual.calls.filter((c) => c[0] === 'refill').length,
          paid && row === 1 ? 3 : 2,
        );
      });
for (const budget of [1, 7])
  for (const row of [1, 2, 3])
    test(`karma orchestration default glyphs: row ${row}, budget ${budget}`, () => {
      const prepare = karmaMenuFixture(),
        pads = [
          ...Array.from({ length: row }, () => [0x400, 0]).flat(),
          0x8000,
          0,
          0x8000,
          0,
          0x8000,
        ];
      const actual = runKarma('karmaMenuSequence', true, budget, prepare, pads, true);
      assert.deepEqual(actual, runKarma('karmaMenuSequence', false, budget, prepare, pads, true));
    });
for (const budget of [1, 7])
  for (const row of [1, 2])
    test(`main orchestration default glyphs: row ${row}, budget ${budget}`, () => {
      const pads = [
        ...Array.from({ length: row }, () => [0x400, 0]).flat(),
        0x8000,
        0,
        0x8000,
        0,
        0x8000,
      ];
      const actual = runMain(true, budget, pads, true);
      assert.deepEqual(actual, runMain(false, budget, pads, true));
    });

for (const budget of [1, 7])
  for (const row of [0, 1, 2])
    test(`main live entry: row ${row}, budget ${budget}`, () => {
      const pads = [
        ...Array.from({ length: row }, () => [0x400, 0]).flat(),
        0x8000,
        ...(row ? [0, 0x8000, 0, 0x8000] : []),
      ];
      const actual = runMain(true, budget, pads, true, true);
      assert.deepEqual(actual, runMain(false, budget, pads, true, true));
      if (row === 2) {
        assert.equal(actual.wram[0x6202], 40);
        assert.equal(actual.wram[W.MAGIC_POINTS], 30);
      }
    });
