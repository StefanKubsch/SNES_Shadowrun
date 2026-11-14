// The main loop's entries of its lifted upkeep routines: each runs the lifted
// function and returns to the main loop as the original (RTL from bank 81, RTS in
// bank 80). The register-level versions are references in
// proof/game-reference/main-upkeep.mjs (MAIN_UPKEEP_REFERENCE_ENTRIES).
//
// The main loop reads none of the registers the routines leave, but a wait of a later
// callee takes its NMI with them, which saves X and Y on the NMI stack (7E:1CB6-1CB9)
// that the Mesen oracle compares. So the entries leave X and Y as the original; A and
// the flags besides the width are not produced, every next callee loads its own A.
import {
  NativeCallContinuation,
  NATIVE_CALL_CONTINUATIONS,
  drainNativeSequence,
} from '../task/native-call-continuation.mjs';
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { noticeTimeoutSequence } from './notice-timeout.mjs';
import { applyColourEffect } from './fixed-colour.mjs';
import { advancePaletteCycles } from './palette-cycles.mjs';
import { shakeHitPlayer } from './player-hit.mjs';
import { followPlayerWithCamera } from './camera-follow.mjs';
import { updateTileBuffers } from './camera-scroll.mjs';
import { recordFormationStep } from './formation-trail.mjs';
import { timeLimitSequence } from './time-limit.mjs';
import { gloveActionSequence } from './glove-action.mjs';
import { showNoticeSequence } from './notice-show.mjs';
import {
  putGloveAwayCallSequence,
  releaseNoticeWindowsCallSequence,
  releaseWindowSequence,
} from './window-release.mjs';
import {
  clearFixedColourRoutine,
  closeDialogSequence,
  setWindowTextWidthRoutine,
  talkSequence,
} from './dialog-talk.mjs';
import { TALK_ROUTINES } from '../task/native-dialog.mjs';
import { chooseDialogActionSequence, chooseDialogTopicSequence } from './dialog-menus.mjs';
import {
  printTopicTextSequence,
  printWindowTextSequence,
  showDialogTextSequence,
} from './dialog-text.mjs';
import { closePortraitWindowSequence, openPortraitWindowSequence } from './portrait-window.mjs';
import {
  shiftPortraitRowsRoutine,
  unpackPortraitRoutine,
  uploadFirstPortraitSequence,
  uploadSecondPortraitSequence,
  uploadPortraitTilesSequence,
} from './portrait-upload.mjs';
import { reloadObjectTilesSequence } from './object-tiles.mjs';
import { printNumberSequence, setTextCursorRoutine } from './window-text.mjs';
import { printTextSequence } from './text-print.mjs';
import { drawTextBufferSequence } from './text-draw.mjs';
import { openWindowSequence, requestTileClearSequence } from './window-open.mjs';
import { chooseActionSequence, chooseScriptActionSequence } from './action-menu.mjs';
import { askYesNoSequence } from './yes-no-question.mjs';
import { removeFromFightListSequence } from './fight-list.mjs';
import { spendMagicPointsSequence } from './magic-points.mjs';
import { releaseGloveSequence } from './glove-release.mjs';
import { waitForConfirmKeySequence } from './confirm-key.mjs';
import {
  chooseObjectNumberSequence,
  chooseObjectUnderGloveSequence,
  choosePlaceWithGloveSequence,
  scriptChooseObjectNumberSequence,
  scriptChooseObjectSequence,
  spellGloveTargetSequence,
} from './glove-target.mjs';
import {
  runDrawWindowList,
  runRequestUpload,
  runResetWindowList,
  runUnpackWindowMap,
} from './window-list.mjs';
import { createObject } from './object-create.mjs';
import { chooseFromMenuSequence } from './menu-choice.mjs';
import { playSoundEffectRoutine } from '../apu/sound-effect.mjs';
import { sendApuCommandRoutine, setMusicModeRoutine } from '../apu/audio-routines.mjs';
import { gloveMoveSequence } from './glove-move.mjs';
import {
  shootAtGloveTargetSequence,
  shootAtObjectSequence,
  shootWithOwnWeaponSequence,
} from './object-shoot.mjs';
import { selectAnimationRoutine, turnObjectRoutine } from './object-turn.mjs';
import { hitObjectSequence } from './object-hit.mjs';
import { hitObjectsInBlastSequence } from './object-blast.mjs';
import { chooseSpellSequence } from './spell-choice.mjs';
import { openSpellMenuSequence, spellMenuSequence, STATUS_ENTRY } from './member-spell-menu.mjs';
import { controlPlayerSequence } from './player-control.mjs';
import { partyStatusSequence } from './party-status.mjs';
import { equipmentRowsSequence } from './equipment-window.mjs';
import { memberPortraitSequence } from './member-portrait.mjs';
import { PLAYER_CONTROL_ROUTINES } from '../task/native-player-control.mjs';
import { ITEMS_ENTRY, NATIVE_ENTRY, START_ENTRY, statusScreenSequence } from './status-screen.mjs';
import { notesSequence, skillsSequence } from './status-submenus.mjs';
import { itemMenuSequence, useItemSequence } from './item-menu.mjs';
import { decimalNumberSequence } from './decimal-number.mjs';
import { WEAPON_MENU_ROUTINES } from '../task/native-member-spell-menu.mjs';
import { KARMA_LISTS, MAIN_MENU_ROUTINES } from '../task/native-main-menu.mjs';
import {
  buyStepSequence,
  karmaLineSequence,
  karmaListSequence,
  karmaMenuSequence,
} from './karma-menu.mjs';
import { mainMenuSequence, saveMenuSequence } from './main-menu.mjs';
import { playerZonesSequence } from './player-zones.mjs';
import { appendScriptTaskCall } from './task-append.mjs';
import { moveAndAnimate } from './object-motion.mjs';
import { walkTowardsTarget } from './object-target.mjs';
import { stepAnimation } from './object-animation.mjs';
import { buildSprites } from './sprite-list.mjs';
import { MAIN_MOTION_ROUTINES } from '../task/main-loop-motion.mjs';
import { GATE_ROUTINES } from '../task/main-zone-gate.mjs';
import { GLOVE_ROUTINES } from '../task/native-glove-target-support.mjs';
import { MAIN_UPKEEP_ROUTINES } from '../task/main-loop-upkeep.mjs';
import { BYTE_BITS } from '../constants/bits.mjs';
import { lagFree } from '../task/main-wait-interrupt.mjs';
import { waitForCounterWord } from '../system/frame-wait.mjs';
import { takePadPresses } from '../system/joypad.mjs';
import { PAD_HELD } from '../task/wram.mjs';
import { FLAG_CARRY, FLAG_NEGATIVE, FLAG_ZERO } from '../constants/cpu-flags.mjs';

// 81:8877, called with JSL.
export function runColourEffect(h) {
  const phase = applyColourEffect(sceneRuntime(h));
  if (phase !== undefined) h.ctx.x = phase;
  return h.rtl();
}
// 81:8076, called with JSL.
export function runPaletteCycles(h) {
  h.ctx.x = advancePaletteCycles(h.a.mem.wram);
  return h.rtl();
}
// 80:DE94, called with JSR.
export function runHitShake(h) {
  h.ctx.x = shakeHitPlayer(h.a.mem.wram);
  return h.rts();
}
// 80:FF14, called with JSR; its window releases wait for the NMI of their uploads, so
// it is a native call continuation of the main loop.
function* noticeTimeoutCallSequence(h, events) {
  yield* noticeTimeoutSequence(h, events);
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
export function runNoticeTimeouts(h, events) {
  return drainNativeSequence(noticeTimeoutCallSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(0x80ff14, {
  run: runNoticeTimeouts,
  create: ({ h, events }) => new NativeCallContinuation(h.a, noticeTimeoutCallSequence(h, events)),
});
// 80:BAD5, called with JSR.
export function runFormationStep(h) {
  const { ctx } = h,
    registers = recordFormationStep(h.a.mem.wram, ctx.x, ctx.y);
  ctx.x = registers.x;
  ctx.y = registers.y;
  return h.rts();
}
// 81:8C2E, called with JSL.
export function runCameraFollow(h) {
  h.ctx.y = followPlayerWithCamera(h.a.mem, h.a.mem.wram);
  return h.rtl();
}
// 81:8A91, called with JSL.
export function runTileBuffers(h) {
  const registers = updateTileBuffers(h.a.mem.wram, h.ctx.y);
  h.ctx.x = registers.x;
  h.ctx.y = registers.y;
  return h.rtl();
}
// 80:FEC1, called with JSR; its window, text and release wait for the NMI, so it is a
// native call continuation. The register-level notice keeps the target's registration,
// so this one is found by its run function.
export function runShowNotice(h, events, routines = TEXT_ROUTINES) {
  return drainNativeSequence(showNoticeSequence(h, events, routines));
}
NATIVE_CALL_CONTINUATIONS.set(runShowNotice, {
  run: runShowNotice,
  create: ({ h, events, routines = TEXT_ROUTINES }) =>
    new NativeCallContinuation(h.a, showNoticeSequence(h, events, routines)),
});
// The lifted notice as the script native 80:FEC1 runs it with lag-free frames
// (src/vm/special-natives.mjs), with this module's window, text and release.
export const liftedNoticeSequence = (h, events) => showNoticeSequence(h, events, TEXT_ROUTINES);
// 80:BCB2, called with JSR; its name window release waits for the NMI.
export function runPutGloveAway(h, events) {
  return drainNativeSequence(putGloveAwayCallSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runPutGloveAway, {
  run: runPutGloveAway,
  create: ({ h, events }) => new NativeCallContinuation(h.a, putGloveAwayCallSequence(h, events)),
});
// 80:FD80, called with JSR; its text buffer 80:FB39 waits for the NMI.
export function runPrintNumber(h, events, routines = TEXT_ROUTINES) {
  return drainNativeSequence(printNumberSequence(h, events, routines));
}
NATIVE_CALL_CONTINUATIONS.set(runPrintNumber, {
  run: runPrintNumber,
  create: ({ h, events, routines = TEXT_ROUTINES }) =>
    new NativeCallContinuation(h.a, printNumberSequence(h, events, routines)),
});
// 80:FE69, called with JSR; its text buffer 80:FB39 waits for the NMI.
export function runPrintText(h, events, routines = TEXT_ROUTINES) {
  return drainNativeSequence(printTextSequence(h, events, routines));
}
NATIVE_CALL_CONTINUATIONS.set(runPrintText, {
  run: runPrintText,
  create: ({ h, events, routines = TEXT_ROUTINES }) =>
    new NativeCallContinuation(h.a, printTextSequence(h, events, routines)),
});
// 80:FB39, called with JSR; its upload requests wait for the NMI.
export function runDrawTextBuffer(h, events) {
  return drainNativeSequence(drawTextBufferSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runDrawTextBuffer, {
  run: runDrawTextBuffer,
  create: ({ h, events }) => new NativeCallContinuation(h.a, drawTextBufferSequence(h, events)),
});
// 80:F963, called with JSR; its tile request and map upload wait for the NMI.
export function runOpenWindow(h, events) {
  return drainNativeSequence(openWindowSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runOpenWindow, {
  run: runOpenWindow,
  create: ({ h, events }) => new NativeCallContinuation(h.a, openWindowSequence(h, events)),
});
// 80:99EB, called with JSR; its window, menu and release wait for the NMI.
export function runChooseAction(h, events, routines = TEXT_ROUTINES) {
  return drainNativeSequence(chooseActionSequence(h, events, routines));
}
NATIVE_CALL_CONTINUATIONS.set(runChooseAction, {
  run: runChooseAction,
  create: ({ h, events, routines = TEXT_ROUTINES }) =>
    new NativeCallContinuation(h.a, chooseActionSequence(h, events, routines)),
});
// 80:FA3E, called with JSR; its window list waits for the NMI of its upload.
function* releaseWindowCallSequence(h, events) {
  yield* releaseWindowSequence(h, events);
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
export function runReleaseWindow(h, events) {
  return drainNativeSequence(releaseWindowCallSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runReleaseWindow, {
  run: runReleaseWindow,
  create: ({ h, events }) => new NativeCallContinuation(h.a, releaseWindowCallSequence(h, events)),
});
// 80:936C, called with JSR; the dialog waits for the pad and the NMI over many frames.
// Its callees: the register-level dialog parts (and the portraits' DMA job 80:8FF5) with
// the lifted portrait rows, uploads and window, text, main
// menu, topic choice,
// colour clear, glove release, notice windows, window opening, text width, window
// release, word wait and sprite list (the glove action's table is not passed on).
export function runReleaseNoticeWindows(h, events) {
  return drainNativeSequence(releaseNoticeWindowsCallSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runReleaseNoticeWindows, {
  run: runReleaseNoticeWindows,
  create: ({ h, events }) =>
    new NativeCallContinuation(h.a, releaseNoticeWindowsCallSequence(h, events)),
});
// The menu choice 80:A6A5 to 80:A6C7 with its callees: the lifted word wait, pad word,
// sound effect and text buffer.
const MENU_ROUTINES = new Map([
  [0x81b0a1, runFrameWait],
  [0x809e1a, runPadPresses],
  [0x80c46e, playSoundEffectRoutine],
  [0x80fb39, runDrawTextBuffer],
]);
function menuChoice(entry) {
  const run = (h, events) =>
    drainNativeSequence(chooseFromMenuSequence(h, events, MENU_ROUTINES, entry));
  NATIVE_CALL_CONTINUATIONS.set(run, {
    run,
    create: ({ h, events }) =>
      new NativeCallContinuation(h.a, chooseFromMenuSequence(h, events, MENU_ROUTINES, entry)),
  });
  return run;
}
// 80:A6A5, the menu with hotkeys of the action menu 80:99EB.
export const runMenuWithHotkeys = menuChoice(0x80a6a5);
// 80:A6C7, the plain menu of the Yes/No question 80:CD43.
export const runPlainMenu = menuChoice(0x80a6c7);
// 80:A6AD and 80:A6B8, the numbered menus of the item list and the karma lists.
export const runNumberedMenu = menuChoice(0x80a6ad),
  runNumberedMenuAt = menuChoice(0x80a6b8);
// 80:FA67, a window's tile clear as its callers run it with JSR (the item list's and
// the karma line's redraw).
export function runTileClear(h, events) {
  return drainNativeSequence(requestTileClearSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runTileClear, {
  run: runTileClear,
  create: ({ h, events }) => new NativeCallContinuation(h.a, requestTileClearSequence(h, events)),
});
// 80:A835, the object creation as the item use runs it with JSR (nothing in it waits).
export function runCreateObject(h) {
  const { mem, wram } = sceneRuntime(h);
  createObject(mem, wram, h.a);
  return h.rts();
}
// 80:F953, the confirm key wait as the menus run it with JSR.
export function runConfirmKey(h, events) {
  return drainNativeSequence(liftedConfirmKeySequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runConfirmKey, {
  run: runConfirmKey,
  create: ({ h, events }) => new NativeCallContinuation(h.a, liftedConfirmKeySequence(h, events)),
});
// 80:91E2 and 80:9215, the dialog's main menu and topic choice with the dialog's text
// routines (events.text); with the standard ones their menu 80:A6C7 runs lifted.
export function runDialogMenu(h, events) {
  return drainNativeSequence(chooseDialogActionSequence(h, events, events.text, MENU_ROUTINES));
}
export function runDialogTopics(h, events) {
  return drainNativeSequence(chooseDialogTopicSequence(h, events, events.text, MENU_ROUTINES));
}
// 80:9178, the dialog's text; its window request and text wait for the NMI. With the
// standard text routines its request, cursor and text run lifted, the text drawn by the
// lifted 80:FB39 of TEXT_ROUTINES.
export function runDialogText(h, events) {
  return drainNativeSequence(showDialogTextSequence(h, events, events.text, TEXT_ROUTINES));
}
for (const [run, sequence] of [
  [runDialogMenu, chooseDialogActionSequence],
  [runDialogTopics, chooseDialogTopicSequence],
  [runDialogText, showDialogTextSequence],
])
  NATIVE_CALL_CONTINUATIONS.set(run, {
    run,
    create: ({ h, events }) =>
      new NativeCallContinuation(
        h.a,
        sequence(h, events, events.text, run === runDialogText ? TEXT_ROUTINES : MENU_ROUTINES),
      ),
  });
// 80:8F3A and 80:8F97, the portrait window opened and closed over frames.
export function runOpenPortraitWindow(h, events) {
  return drainNativeSequence(openPortraitWindowSequence(h, events, DIALOG_ROUTINES));
}
export function runClosePortraitWindow(h, events) {
  return drainNativeSequence(closePortraitWindowSequence(h, events, DIALOG_ROUTINES));
}
// 80:9022 and 80:905E, the portraits' uploads; the DMA job 80:8FF5 waits for the NMI.
export function runUploadFirstPortrait(h, events) {
  return drainNativeSequence(uploadFirstPortraitSequence(h, events, DIALOG_ROUTINES));
}
export function runUploadSecondPortrait(h, events) {
  return drainNativeSequence(uploadSecondPortraitSequence(h, events, DIALOG_ROUTINES));
}
// 80:ADF4, the objects' tiles requested again after the dialog; it waits for the NMI.
export function runReloadObjectTiles(h, events) {
  return drainNativeSequence(reloadObjectTilesSequence(h, events, DIALOG_ROUTINES));
}
NATIVE_CALL_CONTINUATIONS.set(runReloadObjectTiles, {
  run: runReloadObjectTiles,
  create: ({ h, events }) =>
    new NativeCallContinuation(h.a, reloadObjectTilesSequence(h, events, DIALOG_ROUTINES)),
});
// 80:8FF5, the portraits' DMA job; it waits for the NMI's transfer.
export function runPortraitTiles(h, events) {
  return drainNativeSequence(uploadPortraitTilesSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runPortraitTiles, {
  run: runPortraitTiles,
  create: ({ h, events }) =>
    new NativeCallContinuation(h.a, uploadPortraitTilesSequence(h, events)),
});
for (const [run, sequence] of [
  [runOpenPortraitWindow, openPortraitWindowSequence],
  [runClosePortraitWindow, closePortraitWindowSequence],
  [runUploadFirstPortrait, uploadFirstPortraitSequence],
  [runUploadSecondPortrait, uploadSecondPortraitSequence],
])
  NATIVE_CALL_CONTINUATIONS.set(run, {
    run,
    create: ({ h, events }) =>
      new NativeCallContinuation(h.a, sequence(h, events, DIALOG_ROUTINES)),
  });
// 81:EF47, the dialog's music change and its restore, called with JSL. The lag-free frame
// model delivers no NMI in its sound driver handshakes, so it runs lifted; with recorded
// interrupt observations the register-level routine replays them.
function runMusicMode(h, events) {
  if (!lagFree(events)) return TALK_ROUTINES.get(0x81ef47)(h, events);
  return setMusicModeRoutine(h);
}
const DIALOG_ROUTINES = new Map(TALK_ROUTINES)
  .set(0x808f3a, runOpenPortraitWindow)
  .set(0x808f97, runClosePortraitWindow)
  .set(0x809f6d, unpackPortraitRoutine)
  .set(0x808f20, shiftPortraitRowsRoutine)
  .set(0x809022, runUploadFirstPortrait)
  .set(0x80905e, runUploadSecondPortrait)
  .set(0x808ff5, runPortraitTiles)
  .set(0x80adf4, runReloadObjectTiles)
  .set(0x809e1a, runPadPresses)
  .set(0x8091e2, runDialogMenu)
  .set(0x809215, runDialogTopics)
  .set(0x809178, runDialogText)
  .set(0x81886a, clearFixedColourRoutine)
  .set(0x80ff79, runReleaseNoticeWindows)
  .set(0x80fa92, setWindowTextWidthRoutine)
  .set(0x80b8de, runSpriteList)
  .set(0x80bcb2, runPutGloveAway)
  .set(0x80f963, runOpenWindow)
  .set(0x80fa3e, runReleaseWindow)
  .set(0x81b0a1, runFrameWait)
  .set(0x81ef47, runMusicMode);
// The lifted action menu as the script native 80:9BA0 runs it with lag-free frames.
export const liftedScriptActionSequence = (h, events) =>
  chooseScriptActionSequence(h, events, TEXT_ROUTINES);
// The lifted text natives 80:935B and 80:933A as the script runs them with lag-free
// frames.
export const liftedWindowTextSequence = (h, events) =>
  printWindowTextSequence(h, events, TEXT_ROUTINES);
export const liftedTopicTextSequence = (h, events) =>
  printTopicTextSequence(h, events, TEXT_ROUTINES);
// The lifted dialog as the script native 80:936C runs it with lag-free frames
// (src/vm/special-natives.mjs).
export const liftedTalkSequence = (h, events) => talkSequence(h, events, DIALOG_ROUTINES);
// 80:92C5 (the dialog closed), called with JSR; its portrait window waits for the NMI.
function* closeDialogCallSequence(h, events) {
  return yield* closeDialogSequence(h, events, DIALOG_ROUTINES);
}
export function runCloseDialog(h, events) {
  return drainNativeSequence(closeDialogCallSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runCloseDialog, {
  run: runCloseDialog,
  create: ({ h, events }) => new NativeCallContinuation(h.a, closeDialogCallSequence(h, events)),
});
export function runTalk(h, events) {
  return drainNativeSequence(talkSequence(h, events, DIALOG_ROUTINES));
}
NATIVE_CALL_CONTINUATIONS.set(runTalk, {
  run: runTalk,
  create: ({ h, events }) =>
    new NativeCallContinuation(h.a, talkSequence(h, events, DIALOG_ROUTINES)),
});
// The callees of the lifted notice, number, text and action menu: the lifted window
// opening 80:F963, text 80:FE69 and text buffer 80:FB39 (callers that do not pass their
// table on get these), and the register-level menu 80:A6A5.
const TEXT_ROUTINES = new Map(MAIN_UPKEEP_ROUTINES)
  .set(0x80f963, runOpenWindow)
  .set(0x80fe69, runPrintText)
  .set(0x80fb39, runDrawTextBuffer)
  .set(0x80a6a5, runMenuWithHotkeys);
// The lifted Yes/No question 80:CD43 and spell choice 80:E1CF with the lifted window,
// plain menu and release.
const MENU_WINDOW_ROUTINES = new Map(TEXT_ROUTINES)
  .set(0x80a6c7, runPlainMenu)
  .set(0x80fa3e, runReleaseWindow);
export const liftedQuestionSequence = (h, events) =>
  askYesNoSequence(h, events, MENU_WINDOW_ROUTINES);
export const liftedSpellChoiceSequence = (h, events) =>
  chooseSpellSequence(h, events, MENU_WINDOW_ROUTINES);
// The lifted equipment rows 80:E9C5 with the lifted cursor, text and number.
const EQUIPMENT_ROUTINES = new Map([
  [0x80faac, setTextCursorRoutine],
  [0x80fe69, runPrintText],
  [0x80fd80, runPrintNumber],
]);
export function runEquipmentRows(h, events) {
  return drainNativeSequence(equipmentRowsSequence(h, events, EQUIPMENT_ROUTINES));
}
NATIVE_CALL_CONTINUATIONS.set(runEquipmentRows, {
  run: runEquipmentRows,
  create: ({ h, events }) =>
    new NativeCallContinuation(h.a, equipmentRowsSequence(h, events, EQUIPMENT_ROUTINES)),
});
// The lifted member portrait 80:E4B3 with the lifted word wait and the dialog's lifted
// portrait unpack 80:9F6D, row shift 80:8F20, first upload 80:9022 and DMA job 80:8FF5
// (src/game/portrait-upload.mjs; the same register interface as the register-level ones).
const PORTRAIT_ROUTINES = new Map(WEAPON_MENU_ROUTINES)
  .set(0x81b0a1, runFrameWait)
  .set(0x809f6d, unpackPortraitRoutine)
  .set(0x808f20, shiftPortraitRowsRoutine)
  .set(0x809022, runUploadFirstPortrait)
  .set(0x808ff5, runPortraitTiles);
export function runMemberPortrait(h, events) {
  return drainNativeSequence(memberPortraitSequence(h, events, PORTRAIT_ROUTINES));
}
NATIVE_CALL_CONTINUATIONS.set(runMemberPortrait, {
  run: runMemberPortrait,
  create: ({ h, events }) =>
    new NativeCallContinuation(h.a, memberPortraitSequence(h, events, PORTRAIT_ROUTINES)),
});
// The lifted spell menu 80:F254 with the lifted window, plain menu, releases, portrait,
// equipment window, key wait, window list and script append; the visit 80:C1CA is the
// script VM's nested round.
const SPELL_MENU_ROUTINES = new Map(WEAPON_MENU_ROUTINES)
  .set(0x80f963, runOpenWindow)
  .set(0x80a6c7, runPlainMenu)
  .set(0x80fa3e, runReleaseWindow)
  .set(0x80ff79, runReleaseNoticeWindows)
  .set(0x80e4b3, runMemberPortrait)
  .set(0x80e9c5, runEquipmentRows);
export const liftedSpellMenuSequence = (h, events) =>
  openSpellMenuSequence(h, events, SPELL_MENU_ROUTINES);
// The lifted party status 80:ED3C with the lifted glove and window releases, window,
// text, cursor, number and key wait.
const PARTY_STATUS_ROUTINES = new Map(PLAYER_CONTROL_ROUTINES)
  .set(0x80bcb2, runPutGloveAway)
  .set(0x80ff79, runReleaseNoticeWindows)
  .set(0x80f963, runOpenWindow)
  .set(0x80fe69, runPrintText)
  .set(0x80faac, setTextCursorRoutine)
  .set(0x80fd80, runPrintNumber)
  .set(0x80fa3e, runReleaseWindow);
export function runPartyStatus(h, events) {
  return drainNativeSequence(partyStatusSequence(h, events, PARTY_STATUS_ROUTINES));
}
NATIVE_CALL_CONTINUATIONS.set(runPartyStatus, {
  run: runPartyStatus,
  create: ({ h, events }) =>
    new NativeCallContinuation(h.a, partyStatusSequence(h, events, PARTY_STATUS_ROUTINES)),
});
// The lifted skills and notes submenus 80:E834 and 80:E8C8 with the lifted window,
// cursor, text, number, release and key wait.
const SUBMENU_ROUTINES = new Map(PLAYER_CONTROL_ROUTINES)
  .set(0x80f963, runOpenWindow)
  .set(0x80faac, setTextCursorRoutine)
  .set(0x80fe69, runPrintText)
  .set(0x80fd80, runPrintNumber)
  .set(0x80fa3e, runReleaseWindow);
const sequenceRun = (sequence) => {
  const run = (h, events) => drainNativeSequence(sequence(h, events));
  NATIVE_CALL_CONTINUATIONS.set(run, {
    run,
    create: ({ h, events }) => new NativeCallContinuation(h.a, sequence(h, events)),
  });
  return run;
};
export const runSkills = sequenceRun((h, events) => skillsSequence(h, events, SUBMENU_ROUTINES)),
  runNotes = sequenceRun((h, events) => notesSequence(h, events, SUBMENU_ROUTINES));
// The lifted item submenus 80:E572, 80:E577 and 80:E57F with the lifted item use
// 80:E4F3, window, releases, portrait, equipment rows, numbered menu, window redraw and
// key wait; the object, visit and window list stay register-level.
const ITEM_ROUTINES = new Map(PLAYER_CONTROL_ROUTINES)
  .set(0x80f963, runOpenWindow)
  .set(0x80fa3e, runReleaseWindow)
  .set(0x80ff79, runReleaseNoticeWindows)
  .set(0x80e4b3, runMemberPortrait)
  .set(0x80e9c5, runEquipmentRows);
ITEM_ROUTINES.set(
  0x80e4f3,
  sequenceRun((h, events) => useItemSequence(h, events, ITEM_ROUTINES)),
);
// The lifted decimal number 80:FDCF with the lifted text buffer.
const DECIMAL_ROUTINES = new Map([[0x80fb39, runDrawTextBuffer]]);
// The lifted status screen 80:EA6E, 80:EA89 and 80:EA8E with the lifted submenus (the
// spell menu's entry 80:E68E too), notice and window releases, glove, window and
// plain menu, cursor, text, numbers, equipment rows, portrait, sound command 81:F007,
// colour reset 81:886A and the closing 80:92C5.
const STATUS_SCREEN_LIFT_ROUTINES = new Map(PLAYER_CONTROL_ROUTINES)
  .set(0x81f007, sendApuCommandRoutine)
  .set(0x81886a, clearFixedColourRoutine)
  .set(0x8092c5, runCloseDialog)
  .set(0x80ff79, runReleaseNoticeWindows)
  .set(0x80bcb2, runPutGloveAway)
  .set(0x80f963, runOpenWindow)
  .set(0x80faac, setTextCursorRoutine)
  .set(0x80fe69, runPrintText)
  .set(0x80fd80, runPrintNumber)
  .set(0x80e9c5, runEquipmentRows)
  .set(0x80e4b3, runMemberPortrait)
  .set(0x80a6c7, runPlainMenu)
  .set(0x80fa3e, runReleaseWindow)
  .set(
    STATUS_ENTRY,
    sequenceRun((h, events) => spellMenuSequence(h, events, SPELL_MENU_ROUTINES, STATUS_ENTRY)),
  )
  .set(0x80e834, runSkills)
  .set(0x80e8c8, runNotes)
  .set(
    0x80fdcf,
    sequenceRun((h, events) => decimalNumberSequence(h, events, DECIMAL_ROUTINES)),
  );
for (const entry of [0x80e572, 0x80e577, 0x80e57f])
  STATUS_SCREEN_LIFT_ROUTINES.set(
    entry,
    sequenceRun((h, events) => itemMenuSequence(h, events, ITEM_ROUTINES, entry)),
  );
const runStatusScreen = sequenceRun((h, events) =>
    statusScreenSequence(h, events, STATUS_SCREEN_LIFT_ROUTINES, START_ENTRY),
  ),
  runItemList = sequenceRun((h, events) =>
    statusScreenSequence(h, events, STATUS_SCREEN_LIFT_ROUTINES, ITEMS_ENTRY),
  );
// The lifted status screen as the script native 80:EA6E runs it with lag-free frames.
export const liftedStatusScreenSequence = (h, events) =>
  statusScreenSequence(h, events, STATUS_SCREEN_LIFT_ROUTINES, NATIVE_ENTRY);
// The lifted main menu 80:CE6D with the lifted save menu 80:CDD6, karma menu 80:EE57,
// its lists, line and purchase, window, text, cursor, number, releases, glove and plain
// menu, window redraw, key wait and numbered menu; the state count and magic points
// run their lifted bodies (src/game/runner-state.mjs), the save 81:B17D is saveGame of
// src/game/save-slots.mjs.
const MAIN_MENU_LIFT_ROUTINES = new Map(MAIN_MENU_ROUTINES)
  .set(0x80f963, runOpenWindow)
  .set(0x80fe69, runPrintText)
  .set(0x80faac, setTextCursorRoutine)
  .set(0x80fd80, runPrintNumber)
  .set(0x80fa3e, runReleaseWindow)
  .set(0x80a6c7, runPlainMenu)
  .set(0x80ff79, runReleaseNoticeWindows)
  .set(0x80bcb2, runPutGloveAway);
MAIN_MENU_LIFT_ROUTINES.set(
  0x80ef82,
  sequenceRun((h, events) => karmaLineSequence(h, events, MAIN_MENU_LIFT_ROUTINES)),
)
  .set(
    0x80f006,
    sequenceRun((h, events) => buyStepSequence(h, events, MAIN_MENU_LIFT_ROUTINES)),
  )
  .set(
    0x80ee57,
    sequenceRun((h, events) => karmaMenuSequence(h, events, MAIN_MENU_LIFT_ROUTINES)),
  )
  .set(
    0x80cdd6,
    sequenceRun((h, events) => saveMenuSequence(h, events, MAIN_MENU_LIFT_ROUTINES)),
  );
for (const entry of Object.keys(KARMA_LISTS).map(Number))
  MAIN_MENU_LIFT_ROUTINES.set(
    entry,
    sequenceRun((h, events) => karmaListSequence(h, events, MAIN_MENU_LIFT_ROUTINES, entry)),
  );
// The menus' callees that are lifted on their own: the numbered menus, the tile clear,
// the confirm key wait, the window list from the first window, the object creation and
// the script task append 80:C34A (the spell menu's; it leaves A the new task, which
// the visit 80:C1CA reads).
for (const table of [
  SPELL_MENU_ROUTINES,
  PARTY_STATUS_ROUTINES,
  SUBMENU_ROUTINES,
  ITEM_ROUTINES,
  STATUS_SCREEN_LIFT_ROUTINES,
  MAIN_MENU_LIFT_ROUTINES,
])
  table
    .set(0x80a6ad, runNumberedMenu)
    .set(0x80a6b8, runNumberedMenuAt)
    .set(0x80fa67, runTileClear)
    .set(0x80f953, runConfirmKey)
    .set(0x81aeb0, runResetWindowList)
    .set(0x80a835, runCreateObject)
    .set(0x80c34a, (h) => appendScriptTaskCall(h.a));
// The lifted main menu as the script native 80:CE6D runs it with lag-free frames.
export const liftedMainMenuSequence = (h, events) =>
  mainMenuSequence(h, events, MAIN_MENU_LIFT_ROUTINES);
// The lifted player control 80:E014 with the lifted party status, window, text,
// release, glove release, turn, animation selection 80:A985, status screen and key
// wait.
const PLAYER_CONTROL_LIFT_ROUTINES = new Map(PLAYER_CONTROL_ROUTINES)
  .set(0x80ed3c, runPartyStatus)
  .set(0x80ea89, runStatusScreen)
  .set(0x80ea8e, runItemList)
  .set(0x80f963, runOpenWindow)
  .set(0x80fe69, runPrintText)
  .set(0x80fa3e, runReleaseWindow)
  .set(0x80bcb2, runPutGloveAway)
  .set(0x80aaaf, turnObjectRoutine)
  .set(0x80a985, selectAnimationRoutine)
  .set(0x80f953, runConfirmKey);
export const liftedPlayerControlSequence = (h, events) =>
  controlPlayerSequence(h, events, PLAYER_CONTROL_LIFT_ROUTINES);
// The time limit's and the glove action's callees: the lifted notice, glove release,
// text cursor 80:FAAC (nothing in it waits), number, action menu, dialog, pad word 80:9E1A (lifted
// with lag-free frames, as at the top of the loop), window, text and text buffer, the
// others register-level. The notice gets this table too.
const UPKEEP_ROUTINES = new Map(TEXT_ROUTINES)
  .set(0x80fec1, runShowNotice)
  .set(0x80bcb2, runPutGloveAway)
  .set(0x80faac, setTextCursorRoutine)
  .set(0x80fd80, runPrintNumber)
  .set(0x8099eb, runChooseAction)
  .set(0x809e1a, runPadPresses)
  .set(0x80936c, runTalk);
// The lifted fight list removal 80:855E as the script native runs it with lag-free
// frames: the lifted notice, cursor, number, text, sound effect and music mode.
export const liftedFightListRemoveSequence = (h, events) =>
  removeFromFightListSequence(
    h,
    events,
    new Map(UPKEEP_ROUTINES).set(0x80c46e, playSoundEffectRoutine).set(0x81ef47, runMusicMode),
  );
// The lifted magic point spending 80:8B43 with the lifted notice, as the script native
// runs it with lag-free frames.
export const liftedSpendMagicSequence = (h, events) =>
  spendMagicPointsSequence(h, events, UPKEEP_ROUTINES);
// The lifted glove release 80:CD9D with the lifted glove and window list, as the
// script native runs it with lag-free frames.
export const liftedReleaseGloveSequence = (h, events) =>
  releaseGloveSequence(
    h,
    events,
    new Map([
      [0x80bcb2, runPutGloveAway],
      [0x81ad92, runDrawWindowList],
    ]),
  );
// The lifted confirm key wait 80:F953 with the lifted word wait and pad word, as the
// script native runs it with lag-free frames.
export const liftedConfirmKeySequence = (h, events) =>
  waitForConfirmKeySequence(
    h,
    events,
    new Map([
      [0x81b0a1, runFrameWait],
      [0x809e1a, runPadPresses],
    ]),
  );
// The callees of the lifted glove choices, each with its own table: the lifted word
// wait, pad word, glove movement, glove release, notice, window list, window map, its
// upload and the dialog's close.
const GLOVE_CHOICE_ROUTINES = new Map([
  [0x81b0a1, runFrameWait],
  [0x809e1a, runPadPresses],
  [0x80be6d, runGloveMove],
  [0x80bcb2, runPutGloveAway],
  [0x80fec1, runShowNotice],
  [0x81ad92, runDrawWindowList],
  [0x81a9b2, runUnpackWindowMap],
  [0x81acb5, runRequestUpload],
  [0x8092c5, runCloseDialog],
]);
// The lifted choice of the object under the glove 80:8D0B, as the script native runs it
// with lag-free frames.
export const liftedChooseUnderGloveSequence = (h, events) =>
  chooseObjectUnderGloveSequence(h, events, GLOVE_CHOICE_ROUTINES);
// The lifted choices in reach 80:9BC6, 80:9BB9 and 80:9C33, as the script natives run
// them with lag-free frames.
export const liftedChooseNumberSequence = (h, events) =>
  chooseObjectNumberSequence(h, events, GLOVE_CHOICE_ROUTINES);
export const liftedScriptChooseNumberSequence = (h, events) =>
  scriptChooseObjectNumberSequence(h, events, GLOVE_CHOICE_ROUTINES);
export const liftedScriptChooseObjectSequence = (h, events) =>
  scriptChooseObjectSequence(h, events, GLOVE_CHOICE_ROUTINES);
// The lifted spell glove target 80:9BD3, as the script native runs it with lag-free
// frames.
export const liftedSpellGloveTargetSequence = (h, events) =>
  spellGloveTargetSequence(h, events, GLOVE_CHOICE_ROUTINES);
// The lifted place choice 80:C724, as the script native runs it with lag-free frames.
export const liftedChoosePlaceSequence = (h, events) =>
  choosePlaceWithGloveSequence(h, events, GLOVE_CHOICE_ROUTINES);
// The lifted hit 80:8691 (src/game/object-hit.mjs), called with JSR by the shooting
// natives and the blast: its notices' window, text, word wait, confirm key and release
// and the player hit's window list run lifted through their frames.
const HIT_ROUTINES = new Map([
  [0x80f963, runOpenWindow],
  [0x80fe69, runPrintText],
  [0x81b0a1, runFrameWait],
  [0x80f953, runConfirmKey],
  [0x80fa3e, runReleaseWindow],
  [0x81ad92, runDrawWindowList],
]);
export const runHitObject = sequenceRun((h, events) => hitObjectSequence(h, events, HIT_ROUTINES));
// The callee of the lifted shooting natives that runs through its frame: the hit, whose
// notices wait for frames (the sight, random numbers, object slot, turn and sound run
// lifted inside src/game/object-shoot.mjs).
const SHOOT_ROUTINES = new Map([[0x808691, runHitObject]]);
// The lifted shooting natives 80:8AB5, 80:8A51 and 80:8A8C, as the script natives run
// them with lag-free frames.
export const liftedShootAtObjectSequence = (h, events) =>
  shootAtObjectSequence(h, events, SHOOT_ROUTINES);
export const liftedShootAtGloveTargetSequence = (h, events) =>
  shootAtGloveTargetSequence(h, events, SHOOT_ROUTINES);
export const liftedShootWithOwnWeaponSequence = (h, events) =>
  shootWithOwnWeaponSequence(h, events, SHOOT_ROUTINES);
// The lifted blast 80:8E36 with the lifted hit, as the script native runs it with
// lag-free frames.
export const liftedBlastSequence = (h, events) =>
  hitObjectsInBlastSequence(h, events, SHOOT_ROUTINES);
// 80:E270, called with JSR; its notice and text wait for the NMI of their uploads, so
// it is a native call continuation of the main loop.
export function runTimeLimit(h, events, routines = UPKEEP_ROUTINES) {
  return drainNativeSequence(timeLimitSequence(h, events, routines));
}
NATIVE_CALL_CONTINUATIONS.set(0x80e270, {
  run: runTimeLimit,
  create: ({ h, events, routines = UPKEEP_ROUTINES }) =>
    new NativeCallContinuation(h.a, timeLimitSequence(h, events, routines)),
});
// 80:BF3B, called with JSR; its notice, menu, dialog and input wait for the NMI, so it
// is a native call continuation of the main loop.
export function runGloveAction(h, events, routines = UPKEEP_ROUTINES) {
  return drainNativeSequence(gloveActionSequence(h, events, routines));
}
NATIVE_CALL_CONTINUATIONS.set(0x80bf3b, {
  run: runGloveAction,
  create: ({ h, events, routines = UPKEEP_ROUTINES }) =>
    new NativeCallContinuation(h.a, gloveActionSequence(h, events, routines)),
});

// 81:B0A1 (called with JSL) and 80:9E1A (JSR) at the top of the main loop. With the
// lag-free frame model the NMI arrives only at the word wait's blocking branch, so
// both run lifted: the word wait (src/system/frame-wait.mjs) and the newly pressed
// buttons (src/system/joypad.mjs). With recorded interrupt observations an NMI may
// fall between any two instructions; then the register-level routines run (the main
// loop continuation steps them instruction by instruction).
function* frameWaitCallSequence(h, events) {
  yield* waitForCounterWord(h, events);
  let result;
  yield () => {
    result = h.rtl();
  };
  return result;
}
export function runFrameWait(h, events) {
  if (!lagFree(events)) return MAIN_UPKEEP_ROUTINES.get(0x81b0a1)(h, events);
  return drainNativeSequence(frameWaitCallSequence(h, events));
}
// Other tables bind the register-level wait to 81:B0A1, so this continuation is found
// by its run function.
NATIVE_CALL_CONTINUATIONS.set(runFrameWait, {
  run: runFrameWait,
  // Without lag-free frames the register-level wait's own continuation runs.
  create: (call) =>
    lagFree(call.events)
      ? new NativeCallContinuation(call.h.a, frameWaitCallSequence(call.h, call.events))
      : NATIVE_CALL_CONTINUATIONS.get(0x81b0a1).create(call),
});
// The pad word: the original leaves A with its four low bits, sign clear, zero when
// they are, and the carry of its comparison with the soft reset buttons 3030; the
// glove movement 80:BE6D follows.
const SOFT_RESET_BUTTONS = 0x3030,
  INVALID_PAD_BITS = 0x000f;
export function runPadPresses(h, events) {
  if (!lagFree(events)) return MAIN_UPKEEP_ROUTINES.get(0x809e1a)(h, events);
  const { ctx } = h,
    { wram } = h.a.mem,
    held = wram[PAD_HELD] | (wram[PAD_HELD + 1] << BYTE_BITS);
  takePadPresses(wram);
  ctx.a = held & INVALID_PAD_BITS;
  ctx.status &= ~(FLAG_NEGATIVE | FLAG_ZERO | FLAG_CARRY);
  if (!ctx.a) ctx.status |= FLAG_ZERO;
  if (held >= SOFT_RESET_BUTTONS) ctx.status |= FLAG_CARRY;
  return h.rts();
}
// 80:BE6D, called with JSR; its object search and release wait for the NMI, so it is
// a native call continuation of the main loop. The glove natives bind the register-level
// version to the same target, so this continuation is found by its run function.
// The object search opens the name window with the lifted 80:F963 and prints the name
// with the lifted text 80:FE69 and text buffer 80:FB39.
const MOVE_ROUTINES = new Map(GLOVE_ROUTINES)
  .set(0x80f963, runOpenWindow)
  .set(0x80fe69, runPrintText)
  .set(0x80fb39, runDrawTextBuffer);
export function runGloveMove(h, events, routines = MOVE_ROUTINES) {
  return drainNativeSequence(gloveMoveSequence(h, events, routines));
}
NATIVE_CALL_CONTINUATIONS.set(runGloveMove, {
  run: runGloveMove,
  create: ({ h, events, routines = MOVE_ROUTINES }) =>
    new NativeCallContinuation(h.a, gloveMoveSequence(h, events, routines)),
});
// 80:8000, called with JSR; its scene change waits for the NMI, so it is a native
// call continuation of the main loop. The register-level reference keeps the target's
// registration, so this one is found by its run function.
// The zones append their script tasks with the lifted task append 80:C34A.
const ZONE_ROUTINES = { ...GATE_ROUTINES, c34a: appendScriptTaskCall };
export function runPlayerZones(h, events, routines = ZONE_ROUTINES) {
  return drainNativeSequence(playerZonesSequence(h, events, routines));
}
NATIVE_CALL_CONTINUATIONS.set(runPlayerZones, {
  run: runPlayerZones,
  create: ({ h, events, gateRoutines = ZONE_ROUTINES }) =>
    new NativeCallContinuation(h.a, playerZonesSequence(h, events, gateRoutines)),
});
// The motion pass's register-level callees with the lifted walk towards a target
// (80:C9E0, src/game/object-target.mjs, with the lifted turn) and the lifted animation
// (80:AC2F, src/game/object-animation.mjs).
const MOTION_ROUTINES = new Map(MAIN_MOTION_ROUTINES)
  .set(0x80c9e0, (h) => walkTowardsTarget(h))
  .set(0x80ac2f, stepAnimation);
// 80:AFC4, called with JSR; nothing in it waits.
export function runObjectMotion(h, events, routines = MOTION_ROUTINES) {
  return moveAndAnimate(h, events, routines);
}
// 80:B8DE, called with JSR; nothing in it waits.
export function runSpriteList(h) {
  return buildSprites(h);
}
