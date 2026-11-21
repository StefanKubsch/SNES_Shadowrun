// The lifted sequences the script natives run with lag-free frames. The main loop
// composes its own callees directly (src/game/frame-loop.mjs); their RTS and RTL forms for
// register-level tables are in proof/caller/live-loop-routines.mjs and
// proof/caller/jsr-forms.mjs, their register-level references in
// proof/game-reference/main-upkeep.mjs (MAIN_UPKEEP_REFERENCE_ENTRIES).
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

// The lifted notice as the script native 80:FEC1 runs it with lag-free frames
// (src/vm/special-natives.mjs), with this module's window, text and release.
export const liftedNoticeSequence = (h, events, outerReturn = true) =>
  showNoticeSequence(h, events, undefined, undefined, outerReturn);
// Dialog composition owns its complete call graph.
// The lifted action menu as the script native 80:9BA0 runs it with lag-free frames.
export const liftedScriptActionSequence = (h, events, outerReturn = true) =>
  chooseScriptActionSequence(h, events, undefined, outerReturn);
// The lifted text natives 80:935B and 80:933A as the script runs them with lag-free
// frames.
export const liftedWindowTextSequence = (h, events, outerReturn = true) =>
  printWindowTextSequence(h, events, drawTextBufferSequence, outerReturn);
export const liftedTopicTextSequence = (h, events, outerReturn = true) =>
  printTopicTextSequence(h, events, drawTextBufferSequence, outerReturn);
// The lifted dialog as the script native 80:936C runs it with lag-free frames
// (src/vm/special-natives.mjs).
export const liftedTalkSequence = (h, events, outerReturn = true) =>
  talkSequence(h, events, undefined, outerReturn);
// Shared register helpers for callers that still dispatch their dependencies.
// The live Yes/No question and spell choice compose their menu and window directly.
export const liftedQuestionSequence = (h, events, outerReturn = true) =>
  askYesNoSequence(h, events, undefined, outerReturn);
export const liftedSpellChoiceSequence = (h, events, outerReturn = true) =>
  chooseSpellSequence(h, events, undefined, outerReturn);
// The lifted spell menu 80:F254 with the lifted window, plain menu, releases, portrait,
// equipment window, key wait, window list and script append; the visit 80:C1CA is the
// script VM's nested round.
export const liftedSpellMenuSequence = (h, events, outerReturn = true) =>
  openSpellMenuSequence(h, events, undefined, outerReturn);
// The lifted item submenus 80:E572, 80:E577 and 80:E57F with the lifted item use
// 80:E4F3, window, releases, portrait, equipment rows, numbered menu, window redraw and
// key wait; object creation, the nested visit and the window list use lifted callees.
// The lifted status screen 80:EA6E, 80:EA89 and 80:EA8E with the lifted submenus (the
// spell menu's entry 80:E68E too), notice and window releases, glove, window and
// plain menu, cursor, text, numbers, equipment rows, portrait, sound command 81:F007,
// colour reset 81:886A and the closing 80:92C5.
// The lifted status screen as the script native 80:EA6E runs it with lag-free frames.
export const liftedStatusScreenSequence = (h, events, outerReturn = true) =>
  statusScreenSequence(h, events, NATIVE_ENTRY, undefined, outerReturn);
// Main/save/karma menus compose windows, text, selection, sound and refills directly.
// The lifted main menu as the script native 80:CE6D runs it with lag-free frames.
export const liftedMainMenuSequence = (h, events, outerReturn = true) =>
  mainMenuSequence(h, events, undefined, outerReturn);
// The lifted player control 80:E014 with the lifted party status, window, text,
// release, glove release, turn, animation selection 80:A985, status screen and key
// wait.
export const liftedPlayerControlSequence = (h, events, outerReturn = true) =>
  controlPlayerSequence(h, events, undefined, outerReturn);
// The lifted fight list removal 80:855E as the script native runs it with lag-free
// frames: the lifted notice, cursor, number, text, sound effect and music mode.
export const liftedFightListRemoveSequence = (h, events, outerReturn = true) =>
  removeFromFightListSequence(h, events, undefined, outerReturn);
// The lifted magic point spending 80:8B43 with the lifted notice, as the script native
// runs it with lag-free frames.
export const liftedSpendMagicSequence = (h, events, outerReturn = true) =>
  spendMagicPointsSequence(h, events, undefined, outerReturn);
// The lifted glove release 80:CD9D with the lifted glove and window list, as the
// script native runs it with lag-free frames.
export const liftedReleaseGloveSequence = (h, events, outerReturn = true) =>
  releaseGloveSequence(h, events, outerReturn);
// The lifted confirm key wait 80:F953 with the lifted word wait and pad word, as the
// script native runs it with lag-free frames.
export const liftedConfirmKeySequence = (h, events, outerReturn = true) =>
  waitForConfirmKeySequence(h, events, outerReturn);
// The lifted choice of the object under the glove 80:8D0B, as the script native runs it
// with lag-free frames.
export const liftedChooseUnderGloveSequence = (h, events, outerReturn = true) =>
  chooseObjectUnderGloveSequence(h, events, undefined, outerReturn);
// The lifted choices in reach 80:9BC6, 80:9BB9 and 80:9C33, as the script natives run
// them with lag-free frames.
export const liftedChooseNumberSequence = (h, events, outerReturn = true) =>
  chooseObjectNumberSequence(h, events, undefined, outerReturn);
export const liftedScriptChooseNumberSequence = (h, events, outerReturn = true) =>
  scriptChooseObjectNumberSequence(h, events, undefined, outerReturn);
export const liftedScriptChooseObjectSequence = (h, events, outerReturn = true) =>
  scriptChooseObjectSequence(h, events, undefined, outerReturn);
// The lifted spell glove target 80:9BD3, as the script native runs it with lag-free
// frames.
export const liftedSpellGloveTargetSequence = (h, events, outerReturn = true) =>
  spellGloveTargetSequence(h, events, undefined, outerReturn);
// The lifted place choice 80:C724, as the script native runs it with lag-free frames.
export const liftedChoosePlaceSequence = (h, events, outerReturn = true) =>
  choosePlaceWithGloveSequence(h, events, undefined, outerReturn);
// The lifted shooting natives 80:8AB5, 80:8A51 and 80:8A8C, as the script natives run
// them with lag-free frames.
export const liftedShootAtObjectSequence = (h, events, outerReturn = true) =>
  shootAtObjectSequence(h, events, undefined, outerReturn);
export const liftedShootAtGloveTargetSequence = (h, events, outerReturn = true) =>
  shootAtGloveTargetSequence(h, events, undefined, outerReturn);
export const liftedShootWithOwnWeaponSequence = (h, events, outerReturn = true) =>
  shootWithOwnWeaponSequence(h, events, undefined, outerReturn);
// The lifted blast 80:8E36 with the lifted hit, as the script native runs it with
// lag-free frames.
export const liftedBlastSequence = (h, events, outerReturn = true) =>
  hitObjectsInBlastSequence(h, events, undefined, outerReturn);
