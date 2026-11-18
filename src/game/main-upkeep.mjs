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
} from '../system/native-call-continuation.mjs';
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
import { noticeRoutineSequence, showNoticeSequence } from './notice-show.mjs';
import {
  putGloveAwayCallSequence,
  releaseNoticeWindowsCallSequence,
  releaseWindowSequence,
} from './window-release.mjs';
import { closeDialogSequence, talkSequence } from './dialog-talk.mjs';
import { chooseDialogActionSequence, chooseDialogTopicSequence } from './dialog-menus.mjs';
import {
  printTopicTextSequence,
  printWindowTextSequence,
  showDialogTextSequence,
} from './dialog-text.mjs';
import { closePortraitWindowSequence, openPortraitWindowSequence } from './portrait-window.mjs';
import {
  uploadFirstPortraitSequence,
  uploadSecondPortraitSequence,
  uploadPortraitTilesSequence,
} from './portrait-upload.mjs';
import { reloadObjectTilesSequence } from './object-tiles.mjs';
import { printNumberSequence } from './window-text.mjs';
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
import { gloveMoveSequence } from './glove-move.mjs';
import {
  shootAtGloveTargetSequence,
  shootAtObjectSequence,
  shootWithOwnWeaponSequence,
} from './object-shoot.mjs';
import { hitObjectsInBlastSequence } from './object-blast.mjs';
import { chooseSpellSequence } from './spell-choice.mjs';
import { openSpellMenuSequence } from './member-spell-menu.mjs';
import { controlPlayerSequence } from './player-control.mjs';
import { partyStatusSequence } from './party-status.mjs';
import { equipmentRowsSequence } from './equipment-window.mjs';
import { memberPortraitSequence } from './member-portrait.mjs';
import { NATIVE_ENTRY, statusScreenSequence } from './status-screen.mjs';
import { mainMenuSequence } from './main-menu.mjs';
import { playerZonesSequence } from './player-zones.mjs';
import { moveAndAnimate } from './object-motion.mjs';
import { buildSprites } from './sprite-list.mjs';
import { frameWaitCallSequence } from '../system/live-input-calls.mjs';
export { runFrameWait, runPadPresses } from '../system/live-input-calls.mjs';

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
export function runShowNotice(h, events) {
  return drainNativeSequence(noticeRoutineSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runShowNotice, {
  run: runShowNotice,
  create: ({ h, events }) => new NativeCallContinuation(h.a, noticeRoutineSequence(h, events)),
});
// The lifted notice as the script native 80:FEC1 runs it with lag-free frames
// (src/vm/special-natives.mjs), with this module's window, text and release.
export const liftedNoticeSequence = (h, events) => showNoticeSequence(h, events);
// 80:BCB2, called with JSR; its name window release waits for the NMI.
export function runPutGloveAway(h, events) {
  return drainNativeSequence(putGloveAwayCallSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runPutGloveAway, {
  run: runPutGloveAway,
  create: ({ h, events }) => new NativeCallContinuation(h.a, putGloveAwayCallSequence(h, events)),
});
// 80:FD80, called with JSR; its text buffer 80:FB39 waits for the NMI.
export function runPrintNumber(h, events) {
  return drainNativeSequence(printNumberSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runPrintNumber, {
  run: runPrintNumber,
  create: ({ h, events }) => new NativeCallContinuation(h.a, printNumberSequence(h, events)),
});
// 80:FE69, called with JSR; its text buffer 80:FB39 waits for the NMI.
export function runPrintText(h, events) {
  return drainNativeSequence(printTextSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runPrintText, {
  run: runPrintText,
  create: ({ h, events }) => new NativeCallContinuation(h.a, printTextSequence(h, events)),
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
export function runChooseAction(h, events) {
  return drainNativeSequence(chooseActionSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runChooseAction, {
  run: runChooseAction,
  create: ({ h, events }) => new NativeCallContinuation(h.a, chooseActionSequence(h, events)),
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
// 80:FA67, a window's tile clear as its callers run it with JSR (the item list's and
// the karma line's redraw).
export function runTileClear(h, events) {
  return drainNativeSequence(requestTileClearSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runTileClear, {
  run: runTileClear,
  create: ({ h, events }) => new NativeCallContinuation(h.a, requestTileClearSequence(h, events)),
});
// 80:F953, the confirm key wait as the menus run it with JSR.
export function runConfirmKey(h, events) {
  return drainNativeSequence(liftedConfirmKeySequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runConfirmKey, {
  run: runConfirmKey,
  create: ({ h, events }) => new NativeCallContinuation(h.a, liftedConfirmKeySequence(h, events)),
});
// 80:91E2 and 80:9215 compose their live menus with the text renderer.
export function runDialogMenu(h, events) {
  return drainNativeSequence(chooseDialogActionSequence(h, events, drawTextBufferSequence));
}
export function runDialogTopics(h, events) {
  return drainNativeSequence(chooseDialogTopicSequence(h, events, drawTextBufferSequence));
}
// 80:9178 composes live clearing, cursor, text and topic task actions.
export function runDialogText(h, events) {
  return drainNativeSequence(showDialogTextSequence(h, events, drawTextBufferSequence));
}
for (const [run, sequence] of [
  [runDialogMenu, chooseDialogActionSequence],
  [runDialogTopics, chooseDialogTopicSequence],
  [runDialogText, showDialogTextSequence],
])
  NATIVE_CALL_CONTINUATIONS.set(run, {
    run,
    create: ({ h, events }) =>
      new NativeCallContinuation(h.a, sequence(h, events, drawTextBufferSequence)),
  });
// 80:8F3A and 80:8F97, the portrait window opened and closed over frames.
export function runOpenPortraitWindow(h, events) {
  return drainNativeSequence(openPortraitWindowSequence(h, events));
}
export function runClosePortraitWindow(h, events) {
  return drainNativeSequence(closePortraitWindowSequence(h, events));
}
// 80:9022 and 80:905E, the portraits' uploads; the DMA job 80:8FF5 waits for the NMI.
export function runUploadFirstPortrait(h, events) {
  return drainNativeSequence(uploadFirstPortraitSequence(h, events));
}
export function runUploadSecondPortrait(h, events) {
  return drainNativeSequence(uploadSecondPortraitSequence(h, events));
}
// 80:ADF4, the objects' tiles requested again after the dialog; it waits for the NMI.
export function runReloadObjectTiles(h, events) {
  return drainNativeSequence(reloadObjectTilesSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runReloadObjectTiles, {
  run: runReloadObjectTiles,
  create: ({ h, events }) => new NativeCallContinuation(h.a, reloadObjectTilesSequence(h, events)),
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
    create: ({ h, events }) => new NativeCallContinuation(h.a, sequence(h, events)),
  });
// Dialog composition owns its complete call graph.
// The lifted action menu as the script native 80:9BA0 runs it with lag-free frames.
export const liftedScriptActionSequence = (h, events) => chooseScriptActionSequence(h, events);
// The lifted text natives 80:935B and 80:933A as the script runs them with lag-free
// frames.
export const liftedWindowTextSequence = (h, events) =>
  printWindowTextSequence(h, events, drawTextBufferSequence);
export const liftedTopicTextSequence = (h, events) =>
  printTopicTextSequence(h, events, drawTextBufferSequence);
// The lifted dialog as the script native 80:936C runs it with lag-free frames
// (src/vm/special-natives.mjs).
export const liftedTalkSequence = (h, events) => talkSequence(h, events);
// 80:92C5 (the dialog closed), called with JSR; its portrait window waits for the NMI.
function* closeDialogCallSequence(h, events) {
  return yield* closeDialogSequence(h, events);
}
export function runCloseDialog(h, events) {
  return drainNativeSequence(closeDialogCallSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runCloseDialog, {
  run: runCloseDialog,
  create: ({ h, events }) => new NativeCallContinuation(h.a, closeDialogCallSequence(h, events)),
});
export function runTalk(h, events) {
  return drainNativeSequence(talkSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runTalk, {
  run: runTalk,
  create: ({ h, events }) => new NativeCallContinuation(h.a, talkSequence(h, events)),
});
// Shared register helpers for callers that still dispatch their dependencies.
// The live Yes/No question and spell choice compose their menu and window directly.
export const liftedQuestionSequence = (h, events) => askYesNoSequence(h, events);
export const liftedSpellChoiceSequence = (h, events) => chooseSpellSequence(h, events);
// The lifted equipment rows 80:E9C5 with the lifted cursor, text and number.
export function runEquipmentRows(h, events) {
  return drainNativeSequence(equipmentRowsSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runEquipmentRows, {
  run: runEquipmentRows,
  create: ({ h, events }) => new NativeCallContinuation(h.a, equipmentRowsSequence(h, events)),
});
// The lifted member portrait 80:E4B3 with the lifted word wait and the dialog's lifted
// portrait unpack 80:9F6D, row shift 80:8F20, first upload 80:9022 and DMA job 80:8FF5
// (src/game/portrait-upload.mjs; the same register interface as the register-level ones).
export function runMemberPortrait(h, events) {
  return drainNativeSequence(memberPortraitSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runMemberPortrait, {
  run: runMemberPortrait,
  create: ({ h, events }) => new NativeCallContinuation(h.a, memberPortraitSequence(h, events)),
});
// The lifted spell menu 80:F254 with the lifted window, plain menu, releases, portrait,
// equipment window, key wait, window list and script append; the visit 80:C1CA is the
// script VM's nested round.
export const liftedSpellMenuSequence = (h, events) => openSpellMenuSequence(h, events);
// The lifted party status 80:ED3C with the lifted glove and window releases, window,
// text, cursor, number and key wait.
export function runPartyStatus(h, events) {
  return drainNativeSequence(partyStatusSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runPartyStatus, {
  run: runPartyStatus,
  create: ({ h, events }) => new NativeCallContinuation(h.a, partyStatusSequence(h, events)),
});
// The lifted item submenus 80:E572, 80:E577 and 80:E57F with the lifted item use
// 80:E4F3, window, releases, portrait, equipment rows, numbered menu, window redraw and
// key wait; object creation, the nested visit and the window list use lifted callees.
// The lifted status screen 80:EA6E, 80:EA89 and 80:EA8E with the lifted submenus (the
// spell menu's entry 80:E68E too), notice and window releases, glove, window and
// plain menu, cursor, text, numbers, equipment rows, portrait, sound command 81:F007,
// colour reset 81:886A and the closing 80:92C5.
// The lifted status screen as the script native 80:EA6E runs it with lag-free frames.
export const liftedStatusScreenSequence = (h, events) =>
  statusScreenSequence(h, events, NATIVE_ENTRY);
// Main/save/karma menus compose windows, text, selection, sound and refills directly.
// The lifted main menu as the script native 80:CE6D runs it with lag-free frames.
export const liftedMainMenuSequence = (h, events) => mainMenuSequence(h, events);
// The lifted player control 80:E014 with the lifted party status, window, text,
// release, glove release, turn, animation selection 80:A985, status screen and key
// wait.
export const liftedPlayerControlSequence = (h, events) => controlPlayerSequence(h, events);
// The lifted fight list removal 80:855E as the script native runs it with lag-free
// frames: the lifted notice, cursor, number, text, sound effect and music mode.
export const liftedFightListRemoveSequence = (h, events) => removeFromFightListSequence(h, events);
// The lifted magic point spending 80:8B43 with the lifted notice, as the script native
// runs it with lag-free frames.
export const liftedSpendMagicSequence = (h, events) => spendMagicPointsSequence(h, events);
// The lifted glove release 80:CD9D with the lifted glove and window list, as the
// script native runs it with lag-free frames.
export const liftedReleaseGloveSequence = (h, events) => releaseGloveSequence(h, events);
// The lifted confirm key wait 80:F953 with the lifted word wait and pad word, as the
// script native runs it with lag-free frames.
export const liftedConfirmKeySequence = (h, events) => waitForConfirmKeySequence(h, events);
// The lifted choice of the object under the glove 80:8D0B, as the script native runs it
// with lag-free frames.
export const liftedChooseUnderGloveSequence = (h, events) =>
  chooseObjectUnderGloveSequence(h, events);
// The lifted choices in reach 80:9BC6, 80:9BB9 and 80:9C33, as the script natives run
// them with lag-free frames.
export const liftedChooseNumberSequence = (h, events) => chooseObjectNumberSequence(h, events);
export const liftedScriptChooseNumberSequence = (h, events) =>
  scriptChooseObjectNumberSequence(h, events);
export const liftedScriptChooseObjectSequence = (h, events) =>
  scriptChooseObjectSequence(h, events);
// The lifted spell glove target 80:9BD3, as the script native runs it with lag-free
// frames.
export const liftedSpellGloveTargetSequence = (h, events) => spellGloveTargetSequence(h, events);
// The lifted place choice 80:C724, as the script native runs it with lag-free frames.
export const liftedChoosePlaceSequence = (h, events) => choosePlaceWithGloveSequence(h, events);
// The lifted shooting natives 80:8AB5, 80:8A51 and 80:8A8C, as the script natives run
// them with lag-free frames.
export const liftedShootAtObjectSequence = (h, events) => shootAtObjectSequence(h, events);
export const liftedShootAtGloveTargetSequence = (h, events) =>
  shootAtGloveTargetSequence(h, events);
export const liftedShootWithOwnWeaponSequence = (h, events) =>
  shootWithOwnWeaponSequence(h, events);
// The lifted blast 80:8E36 with the lifted hit, as the script native runs it with
// lag-free frames.
export const liftedBlastSequence = (h, events) => hitObjectsInBlastSequence(h, events);
// 80:E270, called with JSR; its notice and text wait for the NMI of their uploads, so
// it is a native call continuation of the main loop.
export function runTimeLimit(h, events) {
  return drainNativeSequence(timeLimitSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(0x80e270, {
  run: runTimeLimit,
  create: ({ h, events }) => new NativeCallContinuation(h.a, timeLimitSequence(h, events)),
});
// 80:BF3B, called with JSR; its notice, menu, dialog and input wait for the NMI, so it
// is a native call continuation of the main loop.
export function runGloveAction(h, events) {
  return drainNativeSequence(gloveActionSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(0x80bf3b, {
  run: runGloveAction,
  create: ({ h, events }) => new NativeCallContinuation(h.a, gloveActionSequence(h, events)),
});

// 80:BE6D, called with JSR; its object search and release wait for the NMI, so it is
// a native call continuation of the main loop. The glove natives bind the register-level
// version to the same target, so this continuation is found by its run function.
// The object search opens the name window with the lifted 80:F963 and prints the name
// with the lifted text 80:FE69 and text buffer 80:FB39.
export function runGloveMove(h, events) {
  return drainNativeSequence(gloveMoveSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runGloveMove, {
  run: runGloveMove,
  create: ({ h, events }) => new NativeCallContinuation(h.a, gloveMoveSequence(h, events)),
});
// 80:8000, called with JSR; its scene change waits for the NMI, so it is a native
// call continuation of the main loop. The register-level reference keeps the target's
// registration, so this one is found by its run function.
// The zones append their script tasks with the lifted task append 80:C34A.
export function runPlayerZones(h, events) {
  return drainNativeSequence(playerZonesSequence(h, events));
}
NATIVE_CALL_CONTINUATIONS.set(runPlayerZones, {
  run: runPlayerZones,
  create: ({ h, events }) => new NativeCallContinuation(h.a, playerZonesSequence(h, events)),
});
// 80:AFC4, called with JSR; nothing in it waits.
export function runObjectMotion(h, events) {
  return moveAndAnimate(h, events);
}
// 80:B8DE, called with JSR; nothing in it waits.
export function runSpriteList(h) {
  return buildSprites(h);
}

// Direct sequences for the live main-loop caller. The wrappers above still serve
// register-level helper tables; these bodies need no continuation registry lookup.
export const mainLoopNoticeSequence = noticeTimeoutCallSequence;
export const mainLoopFrameWaitSequence = frameWaitCallSequence;
export const mainLoopTimeLimitSequence = (h, events) => timeLimitSequence(h, events);
export const mainLoopGloveActionSequence = (h, events) => gloveActionSequence(h, events);
export const mainLoopGloveMoveSequence = (h, events) => gloveMoveSequence(h, events);
export const mainLoopPlayerZonesSequence = (h, events) => playerZonesSequence(h, events);
