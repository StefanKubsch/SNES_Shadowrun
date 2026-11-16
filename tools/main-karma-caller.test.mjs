import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRun } from './member-menu-caller-harness.mjs';
import * as directMain from '../src/game/main-menu.mjs';
import * as formerMain from '../proof/caller/main-menu.mjs';
import { installPortExtension } from '../src/data/port-extension.mjs';
import { occupiedSlots } from '../src/game/save-slots.mjs';
import * as formerKarma from '../proof/caller/karma-menu.mjs';
import { requestTileClearSequence } from '../proof/caller/window-open.mjs';
import * as W from '../src/data/wram.mjs';

function runMain(direct, budget, pads, realDrawing = false) {
  let services;
  return compareRun(
    (h, events, renderer) =>
      (direct ? directMain : formerMain).mainMenuSequence(
        h,
        events,
        services,
        direct ? renderer : undefined,
      ),
    direct,
    ({ put }) => {
      put(W.TIMER, 0xffff);
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
