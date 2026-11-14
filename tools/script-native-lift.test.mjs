// Live comparison of the script natives that run lifted code with lag-free frames
// (src/vm/special-natives.mjs) against their register-level versions, docs/MAIN-LOOP-LIFT.md:
// the notice 80:FEC1 (src/game/notice-show.mjs) and the notice windows' release 80:FF79
// (src/game/window-release.mjs), the dialog window list's redraw 80:CDA8
// (src/game/window-list.mjs), the dialog 80:936C (src/game/dialog-talk.mjs) and the
// action menu 80:9BA0 (src/game/action-menu.mjs) and the text natives 80:935B and
// 80:933A (src/game/dialog-text.mjs) and the Yes/No question 80:CD43
// (src/game/yes-no-question.mjs) and the shooting natives 80:8AB5, 80:8A51 and 80:8A8C
// (src/game/object-shoot.mjs, without a continuation form), the player control
// 80:E014 (src/game/player-control.mjs) with the status screen
// (src/game/status-screen.mjs), the status screen native 80:EA6E and the main menu
// 80:CE6D (src/game/main-menu.mjs). The route of BADGE_OFFER_LIVE_PLAN from the title
// through the alley to the club (three notices, one release) runs once with the lifted
// natives and once with the register-level ones in SPECIAL_NATIVES and SPECIAL_NATIVE_CONTINUATIONS; every NMI
// must be equal (tools/lift-compare.mjs), and the lifted natives must have run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLift } from './lift-compare.mjs';
import { PLAN } from './live-alley-plan.mjs';
import { BADGE_OFFER_LIVE_PLAN } from './live-plans.mjs';
import { CUTSCENE_IGNORED_WRAM } from './live-cutscene-plan.mjs';
import {
  SPECIAL_NATIVES,
  SPECIAL_NATIVE_CONTINUATIONS,
  showNoticeNative,
  createShowNoticeNative,
  releaseNoticeWindowsNative,
  createReleaseNoticeWindowsNative,
  redrawWindowListNative,
  createRedrawWindowListNative,
  talkWithObjectNative,
  createTalkWithObjectNative,
  chooseActionNative,
  createChooseActionNative,
  printWindowTextNative,
  createPrintWindowTextNative,
  printTopicTextNative,
  createPrintTopicTextNative,
  askYesNoNative,
  createAskYesNoNative,
} from '../src/vm/special-natives.mjs';
import { runTaskModalObserved, createModalObserved } from '../src/task/native-modal.mjs';
import {
  runTaskSelectionObserved,
  createSelectionObserved,
} from '../src/task/native-selection.mjs';
import { runTaskActionsObserved, createActionsObserved } from '../src/task/native-actions.mjs';
import {
  redrawWindowListObserved,
  createRedrawWindowListObserved,
} from '../src/task/native-window-list-redraw.mjs';
import {
  talkWithObjectObserved,
  createTalkWithObjectObserved,
} from '../src/task/native-dialog.mjs';
import { showNoticeObserved, createShowNoticeObserved } from '../src/task/native-notice.mjs';
import {
  releaseNoticeWindowsObserved,
  createReleaseNoticeWindowsObserved,
} from '../src/task/native-slot-release.mjs';
import {
  shootAtGloveTargetObserved,
  shootAtObjectObserved,
  shootWithOwnWeaponObserved,
} from '../src/task/native-object-shoot.mjs';
import {
  controlPlayerObserved,
  createControlPlayerObserved,
} from '../src/task/native-player-control.mjs';
import { openMainMenuObserved, createOpenMainMenuObserved } from '../src/task/native-main-menu.mjs';
import {
  showStatusScreenObserved,
  createShowStatusScreenObserved,
} from '../src/task/native-status-screen.mjs';
import {
  liftedPlayerControlSequence,
  liftedStatusScreenSequence,
  liftedMainMenuSequence,
  liftedShootAtGloveTargetSequence,
  liftedShootAtObjectSequence,
  liftedShootWithOwnWeaponSequence,
} from '../src/game/main-upkeep.mjs';

// A native without a continuation form: its lifted and register-level runs.
const withoutContinuation = (observed, lifted) => [
  (a, o) => observed(a, o, false, lifted),
  null,
  (a, o) => observed(a, o, false),
  null,
];
// Target, lifted run and continuation, register-level run and continuation.
const NATIVES = [
  [
    0x80e014,
    (a, o) => controlPlayerObserved(a, o, false, liftedPlayerControlSequence),
    (a, o) => createControlPlayerObserved(a, o, liftedPlayerControlSequence),
    (a, o) => controlPlayerObserved(a, o, false),
    createControlPlayerObserved,
  ],
  [
    0x80ea6e,
    (a, o) => showStatusScreenObserved(a, o, false, liftedStatusScreenSequence),
    (a, o) => createShowStatusScreenObserved(a, o, liftedStatusScreenSequence),
    (a, o) => showStatusScreenObserved(a, o, false),
    createShowStatusScreenObserved,
  ],
  [
    0x80ce6d,
    (a, o) => openMainMenuObserved(a, o, false, liftedMainMenuSequence),
    (a, o) => createOpenMainMenuObserved(a, o, liftedMainMenuSequence),
    (a, o) => openMainMenuObserved(a, o, false),
    createOpenMainMenuObserved,
  ],
  [0x808ab5, ...withoutContinuation(shootAtObjectObserved, liftedShootAtObjectSequence)],
  [0x808a51, ...withoutContinuation(shootAtGloveTargetObserved, liftedShootAtGloveTargetSequence)],
  [0x808a8c, ...withoutContinuation(shootWithOwnWeaponObserved, liftedShootWithOwnWeaponSequence)],
  [
    0x80fec1,
    showNoticeNative,
    createShowNoticeNative,
    (a, o) => showNoticeObserved(a, o, false),
    createShowNoticeObserved,
  ],
  [
    0x80ff79,
    releaseNoticeWindowsNative,
    createReleaseNoticeWindowsNative,
    (a, o) => releaseNoticeWindowsObserved(a, o, false),
    createReleaseNoticeWindowsObserved,
  ],
  [
    0x80cda8,
    redrawWindowListNative,
    createRedrawWindowListNative,
    (a, o) => redrawWindowListObserved(a, o, false),
    createRedrawWindowListObserved,
  ],
  [
    0x80936c,
    talkWithObjectNative,
    createTalkWithObjectNative,
    (a, o) => talkWithObjectObserved(a, o, false),
    createTalkWithObjectObserved,
  ],
  [
    0x809ba0,
    chooseActionNative,
    createChooseActionNative,
    (a, o) => runTaskActionsObserved(a, o, 0x809ba0, false),
    createActionsObserved,
  ],
  [
    0x80935b,
    printWindowTextNative,
    createPrintWindowTextNative,
    (a, o) => runTaskModalObserved(a, o, 0x80935b, false),
    createModalObserved(0x80935b),
  ],
  [
    0x80933a,
    printTopicTextNative,
    createPrintTopicTextNative,
    (a, o) => runTaskSelectionObserved(a, o, 0x80933a, false),
    createSelectionObserved(0x80933a),
  ],
  [
    0x80cd43,
    askYesNoNative,
    createAskYesNoNative,
    (a, o) => runTaskModalObserved(a, o, 0x80cd43, false),
    createModalObserved(0x80cd43),
  ],
];

// Not reached on the route: 80:935B, whose text print is 80:933A's last part
// (printTextNumber in src/game/dialog-text.mjs), and the player's and an object's shots
// with their weapons 80:8A51 and 80:8A8C (tools/object-shoot-lift-functions.test.mjs),
// the status screen native 80:EA6E (tools/status-screen-lift-functions.test.mjs) and the
// main menu 80:CE6D (tools/main-menu-lift-functions.test.mjs); the
// player control's Y opens the lifted status screen's item list (80:EA8E) on the route.
const NOT_ON_ROUTE = new Set([0x80935b, 0x808a51, 0x808a8c, 0x80ea6e, 0x80ce6d]);
// The line of sight's direct page working bytes 7E:000E-006C, which the lifted shooting
// natives do not produce (user decision 2026-11-13, game state only 2026-11-14); what a
// later routine derives from them would still show in the compared state.
const SIGHT_SCRATCH = [0x000e, 0x006d];
// From the title into the apartment save (as the alley plan), then the club route.
const ROUTE = [...PLAN.slice(0, 5), ...BADGE_OFFER_LIVE_PLAN.slice(3)];

test(
  'script natives: the lifted natives give the same frames as the register-level ones',
  { timeout: 1800000 },
  async () => {
    const saved = NATIVES.map(([target]) => [
        SPECIAL_NATIVES.get(target),
        SPECIAL_NATIVE_CONTINUATIONS.get(target),
      ]),
      calls = { lifted: {}, reference: {} };
    // Bind each target's runs (column 1 and 2 lifted, 3 and 4 register-level), counted.
    const bind = (mode, column) =>
      NATIVES.forEach((native) => {
        const [target] = native,
          run = native[column],
          create = native[column + 1];
        SPECIAL_NATIVES.set(target, (a, o) => {
          calls[mode][target] = (calls[mode][target] ?? 0) + 1;
          return run(a, o);
        });
        if (create)
          SPECIAL_NATIVE_CONTINUATIONS.set(target, (a, o) => {
            calls[mode][target] = (calls[mode][target] ?? 0) + 1;
            return create(a, o);
          });
      });
    const restore = () =>
      NATIVES.forEach(([target], n) => {
        SPECIAL_NATIVES.set(target, saved[n][0]);
        if (saved[n][1]) SPECIAL_NATIVE_CONTINUATIONS.set(target, saved[n][1]);
      });
    bind('lifted', 1);
    let result;
    try {
      result = await compareLift({
        plan: ROUTE,
        ignored: [...CUTSCENE_IGNORED_WRAM, SIGHT_SCRATCH],
        swap: () => {
          bind('reference', 3);
          return restore;
        },
      });
    } finally {
      restore();
    }
    // Every native ran (but those the route does not reach), as often in both runs.
    for (const [target] of NATIVES)
      if (!NOT_ON_ROUTE.has(target)) assert.ok(calls.lifted[target] > 0, JSON.stringify(calls));
    assert.deepEqual(calls.lifted, calls.reference);
    assert.equal(result.first, -1, JSON.stringify(result));
    assert.equal(result.frames, result.referenceFrames);
  },
);
