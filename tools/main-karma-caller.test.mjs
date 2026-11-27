import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFrozenRun, useLiftVectors } from './lift-function-harness.mjs';
import { compareRun } from './member-menu-caller-harness.mjs';
import { liftedMainMenuSequence } from '../src/game/main-upkeep.mjs';
import { raiseStateCountSequence } from '../proof/caller/runner-state-call.mjs';
import { raiseMemberMagicPointsReference } from '../proof/game-reference/runner-state.mjs';
import * as liftedMain from '../src/game/main-menu.mjs';
import { installPortExtension } from '../src/data/port-extension.mjs';
import { occupiedSlots } from '../src/game/save-slots.mjs';
import * as liftedKarma from '../src/game/karma-menu.mjs';
import { requestTileClearSequence } from '../proof/caller/window-open.mjs';
import { KARMA_LISTS } from '../src/system/native-main-menu.mjs';
import {
  buyStepJsr,
  karmaLineJsr,
  karmaListJsr,
  karmaMenuJsr,
  saveMenuJsr,
} from './register-forms/jsr-forms.mjs';

useLiftVectors(import.meta.url);

// The lifted menus with their RTS forms (tools/register-forms/jsr-forms.mjs), named as the former.
const directMain = { ...liftedMain, saveMenuSequence: saveMenuJsr };
const directKarma = {
  ...liftedKarma,
  buyStepSequence: buyStepJsr,
  karmaLineSequence: karmaLineJsr,
  karmaListSequence: karmaListJsr,
  karmaMenuSequence: karmaMenuJsr,
};

import * as W from '../src/data/wram.mjs';

function prepareLeader({ put, mem }) {
  const number = mem.read16(0x809700),
    record = mem.read16(0x80971a);
  put(W.PLAYER_OBJECT, 2);
  put(W.OBJECT_NUMBER + 2, number);
  put(W.OBJECT_RECORD + 2, 0x6200);
  put(W.GROUP_INDEX, 0);
  put(W.GROUP_NUMBERS, number);
  mem.wram[record + 1] = 3;
  mem.wram[record + 5] = 40;
  mem.wram[0x6202] = 2;
  mem.wram[W.MAGIC_POINTS] = 1;
}

function runMain(budget, pads, realDrawing = false, liveEntry = false) {
  return compareRun(
    (h, events, renderer) =>
      liveEntry
        ? liftedMainMenuSequence(h, events)
        : directMain.mainMenuSequence(h, events, renderer),
    true,
    ({ put, mem }) => {
      prepareLeader({ put, mem });
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
    ({ routines, bind, h, events }) => {
      bind(0x80fa67, () => requestTileClearSequence(h, events));
      bind(0x80cecb, () => raiseStateCountSequence(h, events));
      routines.set(0x80cf2e, (callee) => raiseMemberMagicPointsReference(callee.a, false));
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
      const actual = runMain(budget, pads);
      assertFrozenRun(actual);
      assert.equal(actual.input, pads.length);
      assert.equal(actual.calls.filter((c) => c[0] === 'submenu').length, submenus);
    });

for (const budget of [1, 7])
  test(`main default glyphs, budget ${budget}`, () => {
    const pads = [0x8000];
    const actual = runMain(budget, pads, true);
    assertFrozenRun(actual);
    assert.ok(actual.uploads.length > 2);
  });

function runBlocked(budget, timer, realDrawing = false) {
  return compareRun(
    (h, events, renderer) => directMain.saveMenuSequence(h, events, renderer),
    true,
    ({ put }) => put(W.TIMER, timer),
    budget,
    [0, 0x8000],
    realDrawing,
  );
}
for (const budget of [1, 7])
  for (const timer of [0, 1, 0x7fff])
    test(`blocked save: timer ${timer}, budget ${budget}`, () => {
      const actual = runBlocked(budget, timer);
      assertFrozenRun(actual);
      assert.equal(actual.input, 2);
      assert.equal(actual.calls.filter((c) => c[0] === 'text').length, 1);
    });
for (const budget of [1, 7])
  test(`blocked save default glyphs, budget ${budget}`, () => {
    const actual = runBlocked(budget, 0, true);
    assertFrozenRun(actual);
    assert.ok(actual.uploads.length > 2);
  });

function runSave(budget, slot, four = false, realDrawing = false, voices = 0, token = 0) {
  let sram, saveSound;
  const pads =
    slot < 0 ? [0x2000] : [...Array.from({ length: slot }, () => [0x400, 0]).flat(), 0x8000];
  const result = compareRun(
    (h, e, r) => directMain.saveMenuSequence(h, e, r),
    true,
    ({ put, mem, a }) => {
      put(W.TIMER, 0x8000);
      mem.wram[W.SOUND_VOICE_MASK] = voices;
      mem.wram[W.APU_COMMAND_TOKEN] = token;
      saveSound = mem.read16(0x80c4b3 + 0x36) & 0xff;
      mem.sram = new Uint8Array(four ? 0x4000 : 0x2000).fill(0xa5);
      sram = mem.sram;
      a.vm.gameplay = { fourSaveSlots: four };
      if (four) installPortExtension(mem);
      for (let n = 0; n < 0xf28; n++) mem.wram[W.SAVE_STATE_START + n] = (n * 17 + 3) & 0xff;
    },
    budget,
    pads,
    realDrawing,
  );
  return { ...result, sram: sram.slice(), saveSound };
}
for (const budget of [1, 7])
  for (const four of [false, true])
    for (const slot of [-1, 0, 1, 2, ...(four ? [3, 4] : [])])
      test(`save slots: ${slot}, four ${four}, budget ${budget}`, () => {
        const actual = runSave(budget, slot, four);
        assertFrozenRun(actual);
        assert.deepEqual(
          occupiedSlots(actual.sram),
          Array.from({ length: four ? 4 : 2 }, (_, n) => n === slot - 1),
        );
        assert.equal(actual.writes.includes(`8514,${0xff00 | actual.saveSound},2`), slot > 0);
        if (slot <= 0) assert.ok(actual.sram.every((v) => v === 0xa5));
      });
for (const budget of [1, 7])
  test(`save slots default glyphs, budget ${budget}`, () => {
    const actual = runSave(budget, 4, true, true);
    assertFrozenRun(actual);
    assert.equal(occupiedSlots(actual.sram)[3], true);
  });

function runKarma(name, budget, prepare, pads = [], realDrawing = false, entry) {
  return compareRun(
    (h, e, r) =>
      name === 'karmaListSequence' ? directKarma[name](h, e, entry, r) : directKarma[name](h, e, r),
    true,
    (side) => {
      prepareLeader(side);
      prepare(side);
    },
    budget,
    pads,
    realDrawing,
    ({ routines, bind, h, events }) => {
      bind(0x80fa67, () => requestTileClearSequence(h, events));
      bind(0x80cecb, () => raiseStateCountSequence(h, events));
      routines.set(0x80cf2e, (callee) => raiseMemberMagicPointsReference(callee.a, false));
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
      const actual = runKarma('karmaLineSequence', budget, prepare);
      assertFrozenRun(actual);
      assert.equal(
        actual.wram[W.DP_KARMA_DISPLAY] | (actual.wram[W.DP_KARMA_DISPLAY + 1] << 8),
        karma >>> 3,
      );
    });
for (const budget of [1, 7])
  test(`karma balance default glyphs, budget ${budget}`, () => {
    const prepare = ({ put }) => put(W.KARMA, 0xffff);
    const actual = runKarma('karmaLineSequence', budget, prepare, [], true);
    assertFrozenRun(actual);
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
        const actual = runKarma('buyStepSequence', budget, prepare, pads);
        assertFrozenRun(actual);
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
    const actual = runKarma('buyStepSequence', budget, prepare, [0x8000], true);
    assertFrozenRun(actual);
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
        const actual = runKarma('karmaListSequence', budget, prepare, pads, false, entry);
        assertFrozenRun(actual);
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
      const actual = runKarma('karmaListSequence', budget, prepare, [0x8000], true, entry);
      assertFrozenRun(actual);
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
        const actual = runKarma('karmaListSequence', budget, prepare, pads, false, entry);
        assertFrozenRun(actual);
        assert.equal(actual.wram[pointer], oldValue + (paid ? 1 : 0));
        assert.equal(
          actual.wram[W.KARMA] | (actual.wram[W.KARMA + 1] << 8),
          paid ? 0 : oldValue * 8 - 1,
        );
        assert.equal(actual.wram[0x6202], paid && pointer === W.JAKE_BODY ? 4 : 2);
        assert.equal(actual.wram[W.JAKE_COUNT_MAX], paid && pointer === W.JAKE_BODY ? 4 : 250);
        assert.equal(actual.input, pads.length);
      });
for (const budget of [1, 7])
  test(`karma list purchase default glyphs, budget ${budget}`, () => {
    const entry = 0x80f0f3,
      prepare = listFixture(entry, 'all'),
      pads = [0x400, 0, 0x8000, 0, 0x2000];
    const actual = runKarma('karmaListSequence', budget, prepare, pads, true, entry);
    assertFrozenRun(actual);
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
        const actual = runKarma('karmaMenuSequence', budget, prepare, pads);
        assertFrozenRun(actual);
        assert.equal(actual.wram[0x6202], 40);
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
      const actual = runKarma('karmaMenuSequence', budget, prepare, pads);
      assertFrozenRun(actual);
      assert.equal(actual.input, pads.length);
    });
for (const budget of [1, 7])
  test(`karma windows default glyphs, budget ${budget}`, () => {
    const prepare = karmaMenuFixture('both'),
      pads = [0x8000];
    const actual = runKarma('karmaMenuSequence', budget, prepare, pads, true);
    assertFrozenRun(actual);
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
        const actual = runKarma('karmaMenuSequence', budget, prepare, pads);
        assertFrozenRun(actual);
        assert.equal(actual.wram[pointer], paid ? 2 : 1);
        assert.equal(actual.wram[W.KARMA] | (actual.wram[W.KARMA + 1] << 8), paid ? 0 : 7);
        assert.equal(actual.input, pads.length);
        assert.equal(actual.wram[0x6202], paid && row === 1 ? 50 : 40);
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
      const actual = runKarma('karmaMenuSequence', budget, prepare, pads, true);
      assertFrozenRun(actual);
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
      const actual = runMain(budget, pads, true);
      assertFrozenRun(actual);
    });

for (const budget of [1, 7])
  for (const row of [0, 1, 2])
    test(`main live entry: row ${row}, budget ${budget}`, () => {
      const pads = [
        ...Array.from({ length: row }, () => [0x400, 0]).flat(),
        0x8000,
        ...(row ? [0, 0x8000, 0, 0x8000] : []),
      ];
      const actual = runMain(budget, pads, true, true);
      assertFrozenRun(actual);
      if (row === 2) {
        assert.equal(actual.wram[0x6202], 40);
        assert.equal(actual.wram[W.MAGIC_POINTS], 30);
      }
    });

for (const budget of [1, 7])
  for (const magic of [0, 1, 25, 26, 255])
    for (const points of [0, 250, 255])
      test(`karma magic refill: magic ${magic}, points ${points}, budget ${budget}`, () => {
        const prepare = (side) => {
          karmaMenuFixture()(side);
          const record = side.mem.read16(0x80971a);
          side.mem.wram[record + 1] = magic;
          side.mem.wram[W.MAGIC_POINTS] = points;
        };
        const actual = runKarma('karmaMenuSequence', budget, prepare, [0x2000]);
        assertFrozenRun(actual);
        assert.equal(actual.wram[W.MAGIC_POINTS], Math.min(points + 255, magic * 10) & 0xff);
      });

for (const budget of [1, 7])
  for (const maximum of [0, 4, 40, 255])
    for (const count of [0, 39, 40, 250, 255])
      for (const hasRecord of [false, true])
        test(`karma health refill: max ${maximum}, count ${count}, record ${hasRecord}, budget ${budget}`, () => {
          const prepare = (side) => {
            karmaMenuFixture()(side);
            const record = side.mem.read16(0x80971a);
            side.mem.wram[record + 5] = maximum;
            side.mem.wram[0x6202] = count;
            if (!hasRecord) side.put(W.OBJECT_RECORD + 2, 0);
          };
          const actual = runKarma('karmaMenuSequence', budget, prepare, [0x2000]);
          assertFrozenRun(actual);
          assert.equal(actual.wram[0x6202], hasRecord ? maximum : count);
        });

for (const budget of [1, 7])
  for (const voices of [0, 255])
    for (const token of [0xfe, 0xff])
      test(`save sound: voices ${voices}, token ${token}, budget ${budget}`, () => {
        const actual = runSave(budget, 1, false, false, voices, token);
        assertFrozenRun(actual);
        assert.ok(actual.writes.includes(`8514,${0xff00 | actual.saveSound},2`));
        const commands = actual.writes.filter((write) => write.startsWith('8512,')).length;
        assert.equal(actual.wram[W.APU_COMMAND_TOKEN], (token + commands) & 0xff);
        assert.equal(actual.wram[W.SOUND_VOICE_MASK], 255);
      });
