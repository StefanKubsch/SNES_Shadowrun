// Natives with hardware values: waits for interrupts (frame counter $01F6/$01F8),
// joypad word, PPU counter and product, and APU ports. They run through the same
// bridge as the other natives, but only with an observation set
// (src/vm/devices.mjs). The implementations are the proven modules; their
// opcode compositions (Native58 up to $F390) serve as oracles in the tests.
//
// Waiting for the scheduler ($C401) is not a native of this kind; it suspends the
// task and lives in TaskScheduler.
import { showNoticeObserved, createShowNoticeObserved } from '../task/native-notice.mjs';
import {
  liftedFightListRemoveSequence,
  liftedConfirmKeySequence,
  liftedChooseUnderGloveSequence,
  liftedChooseNumberSequence,
  liftedScriptChooseNumberSequence,
  liftedScriptChooseObjectSequence,
  liftedSpellGloveTargetSequence,
  liftedChoosePlaceSequence,
  liftedNoticeSequence,
  liftedReleaseGloveSequence,
  liftedSpendMagicSequence,
  liftedQuestionSequence,
  liftedScriptActionSequence,
  liftedTopicTextSequence,
  liftedWindowTextSequence,
  liftedTalkSequence,
  liftedShootAtObjectSequence,
  liftedShootAtGloveTargetSequence,
  liftedShootWithOwnWeaponSequence,
  liftedBlastSequence,
  liftedSpellChoiceSequence,
  liftedSpellMenuSequence,
  liftedPlayerControlSequence,
  liftedStatusScreenSequence,
  liftedMainMenuSequence,
} from '../game/main-upkeep.mjs';
import { redrawDialogWindowListSequence } from '../game/window-list.mjs';
import { releaseNoticeWindowsCallSequence } from '../game/window-release.mjs';
import {
  releaseNoticeWindowsObserved,
  createReleaseNoticeWindowsObserved,
} from '../task/native-slot-release.mjs';
import { waitForConfirmKey, createWaitForConfirmKey } from '../task/native-input-wait.mjs';
import { lagFree } from '../task/main-wait-interrupt.mjs';
import { dialogAccess } from '../task/native-dialog-support.mjs';
import { drainNativeSequence, observedContinuation } from '../task/native-call-continuation.mjs';
import { runTaskActionsObserved, createActionsObserved } from '../task/native-actions.mjs';
import {
  appendToFightListNative,
  panSongLevelToObject,
  playSoundEffectNative,
  randomBelowNative,
  randomByteNative,
  moveObjectTowardsObject,
  jumpObjectTowardsObject,
  jumpObjectTowardsPoint,
  chooseEnemyTargetNative,
  payNuyenNative,
  faceRoomDirectionNative,
  setActorStateHolderNative,
  findNearestVisibleMemberNative,
  chooseRandomFightTargetNative,
  canAttackNative,
} from '../task/native-script-leaves.mjs';
import {
  hitObjectsInBlastObserved,
  createHitObjectsInBlastObserved,
} from '../task/native-object-hit.mjs';
import { runTaskSelectionObserved, createSelectionObserved } from '../task/native-selection.mjs';
import { runTaskModalObserved, createModalObserved } from '../task/native-modal.mjs';
import {
  redrawWindowListObserved,
  createRedrawWindowListObserved,
} from '../task/native-window-list-redraw.mjs';
import {
  shootAtObjectObserved,
  shootAtGloveTargetObserved,
  shootWithOwnWeaponObserved,
} from '../task/native-object-shoot.mjs';
import {
  removeFromFightListObserved,
  createRemoveFromFightListObserved,
} from '../task/native-fight-list-remove.mjs';
import { talkWithObjectObserved, createTalkWithObjectObserved } from '../task/native-dialog.mjs';
import {
  chooseObjectNumberWithGloveObserved,
  chooseObjectUnderGloveObserved,
  targetWithSpellGloveObserved,
  scriptChooseObjectWithGloveObserved,
  scriptChooseObjectNumberWithGloveObserved,
  createChooseObjectNumberWithGloveObserved,
  createChooseObjectUnderGloveObserved,
  createTargetWithSpellGloveObserved,
  createScriptChooseObjectWithGloveObserved,
  createScriptChooseObjectNumberWithGloveObserved,
  createChoosePlaceWithGloveObserved,
} from '../task/native-glove-target.mjs';
import { releaseGloveObserved, createReleaseGloveObserved } from '../task/native-glove-release.mjs';
import {
  raiseMemberStateCountObserved,
  createRaiseMemberStateCountObserved,
} from '../task/native-state-count-raise.mjs';
import {
  openWeaponMenuObserved,
  createOpenWeaponMenuObserved,
} from '../task/native-member-spell-menu.mjs';
import {
  restoreAllRunnersObserved,
  createRestoreAllRunnersObserved,
} from '../task/native-runners-restore.mjs';
import { choosePlaceWithGloveObserved } from '../task/native-glove-target.mjs';
import {
  showStatusScreenObserved,
  createShowStatusScreenObserved,
} from '../task/native-status-screen.mjs';
import { openMainMenuObserved, createOpenMainMenuObserved } from '../task/native-main-menu.mjs';
import {
  controlPlayerObserved,
  createControlPlayerObserved,
} from '../task/native-player-control.mjs';
import { chooseSpellObserved, createChooseSpellObserved } from '../task/native-spell-choice.mjs';
import { spendMagicPointsObserved } from '../task/native-combat.mjs';

// The notice 80:FEC1, lifted with lag-free frames (src/game/notice-show.mjs); recorded
// waits replay the register-level notice.
export const showNoticeNative = (a, o) =>
  showNoticeObserved(a, o, false, false, liftedNoticeSequence);
export const createShowNoticeNative = (a, o) =>
  createShowNoticeObserved(a, o, liftedNoticeSequence);

// The notice windows' release 80:FF79, lifted with lag-free frames (src/game/window-release.mjs).
export const releaseNoticeWindowsNative = (a, o) =>
  releaseNoticeWindowsObserved(a, o, false, false, releaseNoticeWindowsCallSequence);
export const createReleaseNoticeWindowsNative = (a, o) =>
  createReleaseNoticeWindowsObserved(a, o, releaseNoticeWindowsCallSequence);

// The dialog window list's redraw 80:CDA8 (src/game/window-list.mjs) and the dialog
// 80:936C (src/game/dialog-talk.mjs), lifted with lag-free frames.
export const redrawWindowListNative = (a, o) =>
  redrawWindowListObserved(a, o, false, false, redrawDialogWindowListSequence);
export const createRedrawWindowListNative = (a, o) =>
  createRedrawWindowListObserved(a, o, redrawDialogWindowListSequence);
export const talkWithObjectNative = (a, o) =>
  talkWithObjectObserved(a, o, false, liftedTalkSequence);
export const createTalkWithObjectNative = (a, o) =>
  createTalkWithObjectObserved(a, o, liftedTalkSequence);

// The action menu 80:9BA0 (src/game/action-menu.mjs), lifted with lag-free frames.
export const chooseActionNative = (a, o) =>
  runTaskActionsObserved(a, o, 0x809ba0, false, false, liftedScriptActionSequence);
export const createChooseActionNative = (a, o) =>
  createActionsObserved(a, o, liftedScriptActionSequence);

// The text natives 80:935B and 80:933A (src/game/dialog-text.mjs), lifted with lag-free
// frames.
export const printWindowTextNative = (a, o) =>
  runTaskModalObserved(a, o, 0x80935b, false, false, liftedWindowTextSequence);
export const createPrintWindowTextNative = createModalObserved(0x80935b, liftedWindowTextSequence);
export const printTopicTextNative = (a, o) =>
  runTaskSelectionObserved(a, o, 0x80933a, false, false, liftedTopicTextSequence);
export const createPrintTopicTextNative = createSelectionObserved(
  0x80933a,
  liftedTopicTextSequence,
);

// The Yes/No question 80:CD43 (src/game/yes-no-question.mjs), lifted with lag-free frames.
export const askYesNoNative = (a, o) =>
  runTaskModalObserved(a, o, 0x80cd43, false, false, liftedQuestionSequence);
export const createAskYesNoNative = createModalObserved(0x80cd43, liftedQuestionSequence);

// The fight list removal 80:855E (src/game/fight-list.mjs), lifted with lag-free frames.
export const removeFromFightListNative = (a, o) =>
  removeFromFightListObserved(a, o, false, liftedFightListRemoveSequence);
export const createRemoveFromFightListNative = (a, o) =>
  createRemoveFromFightListObserved(a, o, liftedFightListRemoveSequence);

// The confirm key wait 80:F953 (src/game/confirm-key.mjs), lifted with lag-free frames;
// recorded waits and inputs replay the register-level native.
export const waitForConfirmKeyNative = (a, o) =>
  lagFree(o?.interruptEvents)
    ? {
        rawReturnWord: drainNativeSequence(
          liftedConfirmKeySequence(dialogAccess(a), o.interruptEvents),
        ),
      }
    : waitForConfirmKey(a, o, false);
export const createWaitForConfirmKeyNative = (a, o) =>
  lagFree(o?.interruptEvents)
    ? observedContinuation(a, {
        sequence: liftedConfirmKeySequence(dialogAccess(a), o.interruptEvents),
        finish: (result) => result,
      })
    : createWaitForConfirmKey(a, o);

// Target -> run(accessor, options); options contains the wait and input observations
// in the format of the modules. Return as for all natives by RTS to $F509.
export const SPECIAL_NATIVES = new Map([
  [0x80fec1, showNoticeNative], // notice or note (lifted with lag-free frames)
  [0x80ff79, releaseNoticeWindowsNative], // clear the text window (lifted with lag-free frames)
  [0x80f953, waitForConfirmKeyNative], // wait for a key (lifted with lag-free frames)
  [0x809ba0, chooseActionNative], // action menu (lifted with lag-free frames)
  [0x80c46e, (a) => playSoundEffectNative(a, false)], // sound (lifted)
  [0x80c51f, (a) => randomBelowNative(a, false)], // random number up to a limit (lifted)
  [0x80c560, (a) => randomByteNative(a, false)], // random byte (lifted)
  [0x808e36, (a, o) => hitObjectsInBlastObserved(a, o, false, false, liftedBlastSequence)], // hit the objects in a blast (lifted with lag-free frames)
  [0x80933a, printTopicTextNative], // the topic menu's text (lifted with lag-free frames)
  [0x80bba0, (a) => faceRoomDirectionNative(a, false)], // a member faces the room's direction (lifted)
  [0x80935b, printWindowTextNative], // a text in the dialog window (lifted with lag-free frames)
  [0x80cbf7, (a) => setActorStateHolderNative(a, false)], // an actor's state holder (lifted)
  [0x80cd20, (a) => payNuyenNative(a, false)], // pay nuyen (lifted)
  [0x80cd43, askYesNoNative], // Yes/No question (lifted with lag-free frames)
  [0x80cda8, redrawWindowListNative], // draw the window list ($AD92; lifted with lag-free frames)
  [0x808ab5, (a, o) => shootAtObjectObserved(a, o, false, liftedShootAtObjectSequence)], // enemy shoots (line of sight, hit $8691; lifted with lag-free frames)
  [0x808a51, (a, o) => shootAtGloveTargetObserved(a, o, false, liftedShootAtGloveTargetSequence)], // Jake shoots at the object under the glove (weapon $8860; lifted with lag-free frames)
  [0x808a8c, (a, o) => shootWithOwnWeaponObserved(a, o, false, liftedShootWithOwnWeaponSequence)], // object shoots at an object with its own weapon (lifted with lag-free frames)
  [0x808bc5, (a) => chooseEnemyTargetNative(a, false)], // target choice of an enemy (random, line of sight; lifted)
  [0x808521, (a) => appendToFightListNative(a, false)], // combat list, first entry: combat music ($EF47; lifted)
  [0x80855e, removeFromFightListNative], // leave the combat list, end of combat with notice and music (lifted with lag-free frames)
  [0x80936c, talkWithObjectNative], // dialog with portraits, menu Exit/Talk/Ask about (lifted with lag-free frames)
  [
    0x809bc6,
    (a, o) => chooseObjectNumberWithGloveObserved(a, o, false, liftedChooseNumberSequence),
  ], // choose a target with the action glove (lifted with lag-free frames)
  [0x80e1cf, (a, o) => chooseSpellObserved(a, o, false, liftedSpellChoiceSequence)], // choose a spell (window, menu A6C7; lifted with lag-free frames)
  [0x80c461, (a) => panSongLevelToObject(a, false)], // sound command 0D with stereo position (lifted)
  [0x80cd9d, (a, o) => releaseGloveObserved(a, o, false, liftedReleaseGloveSequence)], // glove off, draw the window list (lifted with lag-free frames)
  [0x80cecb, (a, o) => raiseMemberStateCountObserved(a, o, false)], // state count up to the runner maximum, window list
  [0x80e014, (a, o) => controlPlayerObserved(a, o, false, liftedPlayerControlSequence)], // player control per frame with menu keys (lifted with lag-free frames)
  [0x80ce6d, (a, o) => openMainMenuObserved(a, o, false, liftedMainMenuSequence)], // main menu: save and karma (lifted with lag-free frames)
  [0x80ea6e, (a, o) => showStatusScreenObserved(a, o, false, liftedStatusScreenSequence)], // status screen with submenus (lifted with lag-free frames)
  [0x80c724, (a, o) => choosePlaceWithGloveObserved(a, o, false, liftedChoosePlaceSequence)], // choose a place with the action glove (lifted with lag-free frames)
  [0x80d079, (a, o) => restoreAllRunnersObserved(a, o, false)], // restore state count and magic points of all runners, window list
  [0x80f254, (a, o) => openWeaponMenuObserved(a, o, false, liftedSpellMenuSequence)], // a member's spell menu with a script call as a nested round (lifted with lag-free frames)
  [0x809bd3, (a, o) => targetWithSpellGloveObserved(a, o, false, liftedSpellGloveTargetSequence)], // target with the spell glove (lifted with lag-free frames)
  [
    0x809c33,
    (a, o) => scriptChooseObjectWithGloveObserved(a, o, false, liftedScriptChooseObjectSequence),
  ], // target choice 9C40 with flag $1D6D (lifted with lag-free frames)
  [
    0x809bb9,
    (a, o) =>
      scriptChooseObjectNumberWithGloveObserved(a, o, false, liftedScriptChooseNumberSequence),
  ], // target choice 9BC6 with flag $1D6D (lifted with lag-free frames)
  [0x808d0b, (a, o) => chooseObjectUnderGloveObserved(a, o, false, liftedChooseUnderGloveSequence)], // target with the glove without a distance check (lifted with lag-free frames)
  [0x808b43, (a, o) => spendMagicPointsObserved(a, o, false, liftedSpendMagicSequence)], // spend magic points, else a notice (lifted with lag-free frames)
  [0x808c08, (a) => findNearestVisibleMemberNative(a, false)], // next visible party member (lifted)
  [0x808c8d, (a) => chooseRandomFightTargetNative(a, false)], // random visible target of the combat list (lifted)
  [0x808ccf, (a) => canAttackNative(a, false)], // can DP00 attack DP02 (line of sight; lifted)
  [0x808d7f, (a) => moveObjectTowardsObject(a, false)], // movement to the object (hardware division; lifted)
  [0x808d3f, (a) => jumpObjectTowardsObject(a, false)], // jump to the object (lifted)
  [0x808d4e, (a) => jumpObjectTowardsPoint(a, false)], // jump to the point of the list [$F3] (lifted)
]);

// Special natives with a resumable sequence: target -> create(accessor, options) returns
// {continuation, finish}. The same equations as above; only a finite work
// budget of the native bridge selects this path.
export const SPECIAL_NATIVE_CONTINUATIONS = new Map([
  [0x80fec1, createShowNoticeNative],
  [0x80ff79, createReleaseNoticeWindowsNative],
  [0x80cda8, createRedrawWindowListNative],
  [0x80cd9d, (a, o) => createReleaseGloveObserved(a, o, liftedReleaseGloveSequence)],
  [0x80cecb, createRaiseMemberStateCountObserved],
  [0x80d079, createRestoreAllRunnersObserved],
  [0x80f953, createWaitForConfirmKeyNative],
  [0x80933a, createPrintTopicTextNative],
  [0x80935b, createPrintWindowTextNative],
  [0x80cd43, createAskYesNoNative],
  [0x80855e, createRemoveFromFightListNative],
  [0x80e1cf, (a, o) => createChooseSpellObserved(a, o, liftedSpellChoiceSequence)],
  [0x80936c, createTalkWithObjectNative],
  [0x809bc6, (a, o) => createChooseObjectNumberWithGloveObserved(a, o, liftedChooseNumberSequence)],
  [0x808d0b, (a, o) => createChooseObjectUnderGloveObserved(a, o, liftedChooseUnderGloveSequence)],
  [0x809bd3, (a, o) => createTargetWithSpellGloveObserved(a, o, liftedSpellGloveTargetSequence)],
  [
    0x809c33,
    (a, o) => createScriptChooseObjectWithGloveObserved(a, o, liftedScriptChooseObjectSequence),
  ],
  [
    0x809bb9,
    (a, o) =>
      createScriptChooseObjectNumberWithGloveObserved(a, o, liftedScriptChooseNumberSequence),
  ],
  [0x80c724, (a, o) => createChoosePlaceWithGloveObserved(a, o, liftedChoosePlaceSequence)],
  [0x80e014, (a, o) => createControlPlayerObserved(a, o, liftedPlayerControlSequence)],
  [0x80ea6e, (a, o) => createShowStatusScreenObserved(a, o, liftedStatusScreenSequence)],
  [0x80f254, (a, o) => createOpenWeaponMenuObserved(a, o, liftedSpellMenuSequence)],
  [0x80ce6d, (a, o) => createOpenMainMenuObserved(a, o, liftedMainMenuSequence)],
  [0x809ba0, createChooseActionNative],
  [0x808e36, (a, o) => createHitObjectsInBlastObserved(a, o, liftedBlastSequence)],
]);
