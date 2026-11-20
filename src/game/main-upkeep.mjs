// The main loop's entries of its lifted upkeep routines: each runs the lifted
// function and returns to the main loop as the original (RTL from bank 81, RTS in
// bank 80). The register-level versions are references in
// proof/game-reference/main-upkeep.mjs (MAIN_UPKEEP_REFERENCE_ENTRIES).
//
// The main loop reads none of the registers the routines leave, but a wait of a later
// callee takes its NMI with them, which saves X and Y on the NMI stack (7E:1CB6-1CB9)
// that the Mesen oracle compares. So the entries leave X and Y as the original; A and
// the flags besides the width are not produced, every next callee loads its own A.
import { sceneRuntime } from '../system/scene-runtime.mjs';
import { noticeTimeoutSequence } from './notice-timeout.mjs';
import { applyColourEffect } from './fixed-colour.mjs';
import { advancePaletteCycles } from './palette-cycles.mjs';
import { followPlayerWithCamera } from './camera-follow.mjs';
import { updateTileBuffers } from './camera-scroll.mjs';
import { timeLimitSequence } from './time-limit.mjs';
import { gloveActionSequence } from './glove-action.mjs';
import { showNoticeSequence } from './notice-show.mjs';
import { talkSequence } from './dialog-talk.mjs';
import { printTopicTextSequence, printWindowTextSequence } from './dialog-text.mjs';
import { drawTextBufferSequence } from './text-draw.mjs';
import { chooseScriptActionSequence } from './action-menu.mjs';
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
import { gloveMove } from './glove-move.mjs';
import {
  shootAtGloveTargetSequence,
  shootAtObjectSequence,
  shootWithOwnWeaponSequence,
} from './object-shoot.mjs';
import { hitObjectsInBlastSequence } from './object-blast.mjs';
import { chooseSpellSequence } from './spell-choice.mjs';
import { openSpellMenuSequence } from './member-spell-menu.mjs';
import { controlPlayerSequence } from './player-control.mjs';
import { NATIVE_ENTRY, statusScreenSequence } from './status-screen.mjs';
import { mainMenuSequence } from './main-menu.mjs';
import { playerZonesSequence } from './player-zones.mjs';
import { moveAndAnimate } from './object-motion.mjs';
import { buildSprites } from './sprite-list.mjs';
import { frameWaitCallSequence } from '../system/live-input-calls.mjs';
export { takePadWord } from '../system/live-input-calls.mjs';

// The main loop's upkeep routines below work on game state only (user decision
// 2026-11-17): the X and Y the originals leave (the colour phase, the palette cycle and
// shake indices, the formation, camera and tile buffer counters) are not produced; the
// next routine of the loop sets its own.

// 81:8877, called with JSL.
export function runColourEffect(h) {
  applyColourEffect(sceneRuntime(h));
  return h.rtl();
}
// 81:8076, called with JSL.
export function runPaletteCycles(h) {
  advancePaletteCycles(h.a.mem.wram);
  return h.rtl();
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
// 81:8C2E, called with JSL.
export function runCameraFollow(h) {
  followPlayerWithCamera(h.a.mem, h.a.mem.wram);
  return h.rtl();
}
// 81:8A91, called with JSL.
export function runTileBuffers(h) {
  updateTileBuffers(h.a.mem.wram);
  return h.rtl();
}
// The lifted notice as the script native 80:FEC1 runs it with lag-free frames
// (src/vm/special-natives.mjs), with this module's window, text and release.
export const liftedNoticeSequence = (h, events) => showNoticeSequence(h, events);
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
// Shared register helpers for callers that still dispatch their dependencies.
// The live Yes/No question and spell choice compose their menu and window directly.
export const liftedQuestionSequence = (h, events) => askYesNoSequence(h, events);
export const liftedSpellChoiceSequence = (h, events) => chooseSpellSequence(h, events);
// The lifted spell menu 80:F254 with the lifted window, plain menu, releases, portrait,
// equipment window, key wait, window list and script append; the visit 80:C1CA is the
// script VM's nested round.
export const liftedSpellMenuSequence = (h, events) => openSpellMenuSequence(h, events);
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
// The glove move runs without its JSR frame (its return word lies only in free stack
// bytes).
export const mainLoopGloveMoveSequence = (h, events) => gloveMove(h, events);
export const mainLoopPlayerZonesSequence = (h, events, zones) =>
  playerZonesSequence(h, events, zones);
