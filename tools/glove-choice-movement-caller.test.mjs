import test from 'node:test';
import { withRts } from './register-forms/rts-forms.mjs';
import assert from 'node:assert/strict';
import { assertFrozenRun, useLiftVectors } from './lift-function-harness.mjs';
import { compareRun } from './member-menu-caller-harness.mjs';
import * as directLifted from '../src/game/glove-target.mjs';
const direct = withRts(directLifted);
import * as W from '../src/data/wram.mjs';

useLiftVectors(import.meta.url);

function runChoice(name, budget, target, pads, request = 0, far = false) {
  return compareRun(
    (h, events, renderer) => direct[name](h, events, renderer),
    true,
    ({ put }) => {
      put(W.PLAYER_OBJECT, 0);
      put(0, 4);
      for (const slot of [0, 2, 4]) {
        put(W.OBJECT_X + slot, 0x500);
        put(W.OBJECT_DIAGONAL + slot, 0xa00);
      }
      put(W.OBJECT_HEIGHT + 2, far ? 0x81 : 0);
      put(W.OBJECT_DIAGONAL + 2, far ? 0x97f : 0xa00);
      put(W.GLOVE_TARGET_TAG, 0xffff);
      put(W.GLOVE_NAME_WINDOW, 0xffff);
      put(W.DRAW_LIST_INDEX, target ? 0 : 0xffff);
      put(W.DRAW_LIST, 2);
      put(W.OBJECT_ACTION_DIRECTIONS + 2, 1);
      put(W.OBJECT_KIND + 2, 0);
      put(W.OBJECT_FLAGS + 2, 0x8000);
      put(W.OBJECT_NUMBER + 2, 0x1234);
      put(W.OBJECT_BOX_X2 + 2, 16);
      put(W.OBJECT_BOX_HEIGHT + 2, 16);
      put(W.TEXT_MAP_UPLOAD, request);
      for (let n = 0; n <= W.NOTICE_WINDOW_LAST; n += 2) put(W.NOTICE_WINDOWS + n, 0xffff);
    },
    budget,
    pads,
    true,
    ({ h, events, mem, calls }) => {
      events.frameJobs = () => assert.fail('fixture services every wait');
      const service = events.interrupts.textWait;
      let prepared = false;
      events.interrupts.textWait = (callee, frameEvents, status, pc) => {
        if (
          !prepared &&
          request !== 0xffff &&
          pc === 0x81acb2 &&
          (name === 'spellGloveTargetSequence' || name === 'choosePlaceWithGloveSequence')
        ) {
          prepared = true;
          assert.equal(h.ctx.s, 0x1c7, 'preparation keeps only the outer native frame');
          assert.equal(h.ctx.programBank, 0x80);
          calls.push([
            'prepare upload',
            mem.read16(W.WINDOW_FIRST_INDEX),
            mem.read16(W.WINDOW_LAST_INDEX),
          ]);
        }
        return service(callee, frameEvents, status, pc);
      };
    },
  );
}

const choices = [
  'chooseObjectUnderGloveSequence',
  'chooseObjectNumberSequence',
  'scriptChooseObjectNumberSequence',
  'scriptChooseObjectSequence',
  'spellGloveTargetSequence',
  'choosePlaceWithGloveSequence',
];
for (const budget of [1, 7])
  for (const name of choices)
    for (const target of [false, true])
      for (const request of [0, 0xffff])
        for (const pads of [[0x8000], [0, 0x8000], [0x100, 0x200, 0, 0x8000]])
          test(`choice with actual movement: ${name}, target ${target}, request ${request}, pads ${pads}, budget ${budget}`, () => {
            const actual = runChoice(name, budget, target, pads, request);
            assertFrozenRun(actual);
            assert.equal(actual.input, pads.length);
            assert.equal(actual.wram[W.GLOVE_KIND], 0);
            if (name === 'spellGloveTargetSequence' || name === 'choosePlaceWithGloveSequence')
              assert.deepEqual(
                actual.calls.filter((call) => call[0] === 'prepare upload'),
                request === 0xffff ? [] : [['prepare upload', 0, 0]],
              );
            if (name === 'choosePlaceWithGloveSequence')
              assert.equal(actual.wram[W.MOTION_ACTIVE + 4], 1);
            else
              assert.equal(
                actual.wram[0] | (actual.wram[1] << 8),
                target ? (name.includes('Number') ? 0x1234 : 2) : 0xffff,
              );
            if (target) assert.ok(actual.uploads.length > 0, 'real name and glyph uploads');
          });
for (const budget of [1, 7])
  for (const name of choices.slice(1, 4))
    test(`choice with actual movement rejects far height: ${name}, budget ${budget}`, () => {
      const actual = runChoice(name, budget, true, [0x8000], 0, true);
      assertFrozenRun(actual);
      assert.equal(actual.wram[0] | (actual.wram[1] << 8), 0xffff);
      assert.ok(actual.uploads.length > 0);
    });
