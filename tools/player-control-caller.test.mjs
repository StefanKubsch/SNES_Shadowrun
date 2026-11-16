import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRun } from './member-menu-caller-harness.mjs';
import { controlPlayerSequence as directControl } from '../src/game/player-control.mjs';
import { controlPlayerSequence as formerControl } from '../proof/caller/player-control.mjs';
import { partyStatusSequence } from '../proof/caller/party-status.mjs';
import * as W from '../src/data/wram.mjs';

function runPlayer(direct, variant, budget, realDrawing = false, members = 1, leaderOnly = false) {
  let services;
  return compareRun(
    (h, events, renderer) =>
      direct ? directControl(h, events, services, renderer) : formerControl(h, events, renderer),
    direct,
    ({ put, mem }) => {
      put(W.PLAYER_OBJECT, 2);
      put(W.PAD_PRESSED, variant === 'party' ? 0x2000 : variant === 'weapon notice' ? 0x80 : 0x40);
      put(W.PAD_HELD, 0);
      put(W.GLOVE_KIND, 0);
      put(W.GROUP_INDEX, 2 * (members - 1));
      put(W.GROUP_LEADER_ONLY, leaderOnly ? 1 : 0);
      put(W.RUNNER_WEAPON, 0xffff);
      put(W.SELECTED_SPELL_SCRIPT, 0);
      for (let member = 0; member < members; member++) {
        const slot = 2 * (member + 1),
          record = 0x6200 + 0x20 * member;
        put(W.GROUP_SLOTS + 2 * member, slot);
        put(W.GROUP_NUMBERS + 2 * member, mem.read16(0x809700 + 2 * member));
        put(W.OBJECT_RECORD + slot, record);
        mem.wram[record + 2] = member ? 0 : 255;
        mem.wram[W.MAGIC_POINTS + member] = member ? 255 : 0;
      }
      for (let n = 0; n <= W.NOTICE_WINDOW_LAST; n += 2) put(W.NOTICE_WINDOWS + n, 0xffff);
    },
    budget,
    [0x8000],
    realDrawing,
    ({ h, mem, events, routines, bind, calls }) => {
      routines.set(0x80a985, (callee) => {
        calls.push(['action', mem.read16(0), mem.read16(2)]);
        return callee.rts();
      });
      bind(0x80ed3c, () => partyStatusSequence(h, events, routines));
      services = new Map(
        [...routines].filter(([target]) =>
          [0x80a985, 0x80aaaf, 0x80bcb2, 0x80ea89, 0x80ea8e].includes(target),
        ),
      );
    },
  );
}

for (const budget of [1, 7])
  for (const members of [1, 3])
    for (const leaderOnly of [false, true])
      for (const realDrawing of [false, true])
        test(`player party status: ${members} members, leader only ${leaderOnly}, budget ${budget}, glyphs ${realDrawing}`, () => {
          const actual = runPlayer(true, 'party', budget, realDrawing, members, leaderOnly);
          assert.deepEqual(
            actual,
            runPlayer(false, 'party', budget, realDrawing, members, leaderOnly),
          );
          assert.equal(actual.input, 1);
          assert.equal(actual.wram[0] | (actual.wram[1] << 8), 0);
          if (realDrawing) assert.ok(actual.uploads.some(([pc]) => pc === 0x81accc));
        });

for (const budget of [1, 7])
  for (const variant of ['weapon notice', 'spell notice'])
    for (const realDrawing of [false, true])
      test(`player ${variant}, budget ${budget}, glyphs ${realDrawing}`, () => {
        const actual = runPlayer(true, variant, budget, realDrawing);
        assert.deepEqual(actual, runPlayer(false, variant, budget, realDrawing));
        assert.equal(actual.input, 1);
        assert.deepEqual(
          actual.calls.filter((c) => c[0] === 'action'),
          [['action', 2, 0]],
        );
        assert.equal(actual.wram[0] | (actual.wram[1] << 8), 0);
        if (realDrawing) assert.ok(actual.uploads.some(([pc]) => pc === 0x81accc));
      });
