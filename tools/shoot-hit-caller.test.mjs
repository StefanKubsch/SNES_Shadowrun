import { compareRun } from './member-menu-caller-harness.mjs';
import * as V from '../src/vm/layout.mjs';
import * as S from '../src/data/native-object-shoot.mjs';

useLiftVectors(import.meta.url);

// Real sight, random draws, hit effects, task allocation, notices and window lists.
// Upload completion and pad input are serviced by the shared caller fixture.
function runShot(sequence, direct, options) {
  const { kind, notice, outcome, distance, request, budget } = options;
  return compareRun(
    sequence,
    direct,
    ({ h, put, mem }) => {
      put(0, 0);
      put(2, outcome === 'none' ? 0xffff : 2);
      put(4, outcome === 'miss' ? 0 : 0xff);
      put(6, kind);
      put(8, 1);
      put(0x0a, outcome === 'miss' ? 0xff80 : 0x7f);
      put(W.PLAYER_OBJECT, outcome === 'player' ? 2 : 0);
      put(W.GLOVE_TARGET_TAG, outcome === 'none' ? 0xffff : 0);
      put(W.GLOVE_TARGET_OBJECT, 2);
      put(W.OBJECT_SELECTION, 0xffff);
      put(W.OBJECT_FLAGS + 2, notice ? W.OBJECT_HITTABLE : W.OBJECT_DAMAGEABLE);
      put(W.OBJECT_X, 0x500);
      put(W.OBJECT_Y, 0x500);
      put(W.OBJECT_X + 2, 0x500 + distance);
      put(W.OBJECT_Y + 2, 0x500);
      put(W.OBJECT_RECORD + 2, 0x3000);
      put(W.OBJECT_TASK + 2, 6);
      mem.wram[W.RECORD_COUNT + 0x3000] = 2;
      put(W.HARMLESS_HITS, notice === 'penalty' ? 7 : 3);
      put(W.KARMA, 8);
      put(W.TEXT_MAP_UPLOAD, request);
      put(W.OBJECT_KIND + W.OBJECT_LAST_SLOT, 0xffff);
      put(W.OBJECT_KIND + W.OBJECT_LAST_SLOT - 2, 0xffff);
      put(V.TASK_FREE_LIST, 0);
      put(V.TASK_NEXT, 2);
      put(V.TASK_NEXT + 2, 0xffff);
      put(V.TASK_LIST_HEAD, 0xffff);
      put(V.HEAP_SIZE_WORD, 0x700);
      put(V.HEAP_NEXT_WORD, 0);
      put(0xfc, 0x4000);
      mem.wram[0xfe] = 0x7f;
      if (outcome === 'blocked') {
        mem.wram[0x14000] = 1;
        for (const [at, value] of [
          [0, 0],
          [2, 0],
          [4, 0],
          [6, 0x400],
          [8, 0x400],
          [10, 0x400],
        ])
          put(0x14001 + at, value);
      }
      const owner = S.WEAPON_OWNERS_END - 2;
      const shooter =
        outcome === 'player' && sequence.name === 'shootAtGloveTargetSequence' ? 2 : 0;
      put(W.OBJECT_NUMBER + shooter, mem.read16(0x800000 | (S.WEAPON_OWNERS + owner)));
      mem.wram[W.RUNNER_WEAPON_KIND + owner * 4] = kind;
      mem.wram[S.WEAPON_DAMAGE + owner * 4] = 1;
      mem.wram[W.RUNNER_WEAPON_RANGE + owner * 4] = outcome === 'miss' ? 0x80 : 0x7f;
      h.ctx.status = 0;
    },
    budget,
    notice ? [0, 0x8000] : [],
    true,
    ({ mem, put, events, calls }) => {
      const service = events.interrupts.textWait;
      let noticeWaits = 0;
      events.interrupts.textWait = (callee, frameEvents, status, pc) => {
        // A notice delays thirty counter changes before its first pad read.
        if (notice && pc === 0x81b0a9 && noticeWaits < 30) {
          noticeWaits++;
          // Game state only (user decision 2026-11-17): no X (the original's wait count).
          calls.push(['notice count']);
          put(W.RANDOM_STATE, mem.read16(W.RANDOM_STATE) + 1);
          return true;
        }
        return service(callee, frameEvents, status, pc);
      };
    },
  );
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFrozenRun, useLiftVectors } from './lift-function-harness.mjs';
import * as actual from '../src/game/object-shoot.mjs';
import * as W from '../src/data/wram.mjs';

const entries = [
  'shootAtObjectSequence',
  'shootAtGloveTargetSequence',
  'shootWithOwnWeaponSequence',
];
for (const name of entries)
  for (const budget of [1, 7])
    for (const kind of [0, 1, 2, 3, 4, 5, 6, 7])
      for (const scenario of [
        { notice: 'warning', outcome: 'hit', distance: 8 },
        { notice: 'penalty', outcome: 'hit', distance: 8 },
        { notice: false, outcome: 'hit', distance: 8 },
        { notice: false, outcome: 'player', distance: 8 },
        { notice: false, outcome: 'miss', distance: 8 },
        { notice: false, outcome: 'hit', distance: 0x3f },
        { notice: false, outcome: 'hit', distance: 0x40 },
        { notice: false, outcome: 'blocked', distance: 8 },
        { notice: false, outcome: 'none', distance: 8 },
      ])
        for (const request of [0, 0xffff])
          if (name !== 'shootWithOwnWeaponSequence' || scenario.outcome !== 'none')
            test(`actual shot/hit: ${name}, kind ${kind}, ${JSON.stringify(scenario)}, request ${request}, budget ${budget}`, () => {
              const options = { kind, budget, request, ...scenario };
              const got = runShot(actual[name], true, options);
              assertFrozenRun(got);
              if (scenario.notice) {
                assert.equal(got.input, 2);
                assert.equal(got.calls.length, 30);
              }
              if (scenario.outcome === 'blocked')
                assert.equal(
                  got.wram[0] | (got.wram[1] << 8),
                  name === 'shootAtGloveTargetSequence' ? 1 : 0xffff,
                );
              if (scenario.outcome === 'none') assert.equal(got.wram[W.HARMLESS_HITS], 3);
            });
