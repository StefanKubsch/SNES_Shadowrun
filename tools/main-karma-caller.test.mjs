import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRun } from './member-menu-caller-harness.mjs';
import * as directMain from '../src/game/main-menu.mjs';
import * as formerMain from '../proof/caller/main-menu.mjs';
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
    },
    budget,
    pads,
    realDrawing,
    ({ routines, calls }) => {
      services = routines;
      for (const target of [0x80cdd6, 0x80ee57])
        routines.set(target, (h) => {
          calls.push(['submenu', target]);
          return h.rts();
        });
    },
  );
}

for (const budget of [1, 7])
  for (const [name, pads, submenus] of [
    ['Exit', [0x8000], 0],
    ['cancel', [0x2000], 0],
    ['save', [0x400, 0, 0x8000, 0, 0x8000], 1],
    ['karma', [0x400, 0, 0x400, 0, 0x8000, 0, 0x8000], 1],
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
