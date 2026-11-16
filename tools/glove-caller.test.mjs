import { chooseFromMenuSequence } from '../proof/caller/menu-choice.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRun } from './member-menu-caller-harness.mjs';
import { gloveActionSequence as directAction } from '../src/game/glove-action.mjs';
import { gloveActionSequence as formerAction } from '../proof/caller/glove-action.mjs';
import { showNoticeSequence } from '../proof/caller/notice-show.mjs';
import { chooseActionSequence } from '../proof/caller/action-menu.mjs';
import * as W from '../src/data/wram.mjs';
import { TASK_WAIT, TASK_EVENTS, TASK_PREVIOUS } from '../src/vm/layout.mjs';

function runAction(direct, budget, variant, glyphs) {
  let services;
  const far = variant === 'far' || variant === 'offer';
  const menu = variant === 'menu' || variant === 'offer';
  return compareRun(
    (h, events, render) =>
      direct ? directAction(h, events, services, render) : formerAction(h, events, services),
    true,
    ({ put }) => {
      put(W.PLAYER_OBJECT, 0);
      put(W.GLOVE_TARGET_OBJECT, 2);
      put(W.GLOVE_TARGET_TAG, 0);
      put(W.GLOVE_KIND, 0xffff);
      put(W.GLOVE_NAME_WINDOW, 0xffff);
      put(W.OBJECT_TASK + 2, 0);
      put(W.OBJECT_X + 2, far ? 0xa1 : 0xa0);
      put(W.OBJECT_HEIGHT + 2, variant === 'height' ? 0x81 : 0x80);
      put(W.PAD_PRESSED, menu ? W.PAD_B : variant === 'right' ? W.PAD_R : W.PAD_L);
      put(TASK_WAIT, variant === 'child' ? 0xffff : menu ? 0x6082 : 0x690);
      put(TASK_PREVIOUS, 2);
      put(TASK_WAIT + 2, 0x80);
      put(TASK_EVENTS, 0x1000);
      put(TASK_EVENTS + 2, 1);
      for (let n = 0; n <= W.NOTICE_WINDOW_LAST; n += 2) put(W.NOTICE_WINDOWS + n, 0xffff);
    },
    budget,
    menu ? [0, W.PAD_B] : [],
    glyphs,
    ({ h, events, routines, bind }) => {
      services = routines;
      bind(0x80a6a5, () => chooseFromMenuSequence(h, events, routines, 0x80a6a5));
      bind(0x80fec1, () => showNoticeSequence(h, events, routines));
      bind(0x8099eb, () => chooseActionSequence(h, events, routines));
    },
  );
}

for (const budget of [1, 7])
  for (const glyphs of [false, true])
    for (const variant of ['far', 'height', 'left', 'right', 'child', 'menu', 'offer'])
      test(`glove action actual caller: ${variant}, glyphs ${glyphs}, budget ${budget}`, () => {
        const actual = runAction(true, budget, variant, glyphs);
        assert.deepEqual(actual, runAction(false, budget, variant, glyphs));
        assert.equal(actual.wram[W.GLOVE_KIND] | (actual.wram[W.GLOVE_KIND + 1] << 8), 0);
        const at = TASK_EVENTS + (variant === 'child' ? 2 : 0);
        assert.equal(
          actual.wram[at] | (actual.wram[at + 1] << 8),
          variant === 'child'
            ? 0x81
            : variant === 'left'
              ? 0x1080
              : variant === 'right'
                ? 0x1610
                : 0x1000,
        );
      });
