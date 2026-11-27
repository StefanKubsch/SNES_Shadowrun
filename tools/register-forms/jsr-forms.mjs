// The RTS and RTL forms of lifted routines for register-level call tables and caller
// harnesses (moved from src/, whose live callers run the routines without their JSR and
// JSL frames). Each runs the lifted sequence or function, then returns through the
// caller's frame (suffix Jsr for RTS, Jsl for RTL).
import { playSoundEffectCall } from '../../src/apu/sound-effect.mjs';
import { printText } from '../../src/game/text-print.mjs';
import { sortDrawListInPlace } from '../../src/game/depth-sort.mjs';
import { paletteSlotInPlace } from '../../src/game/palette-slots.mjs';
import { selectObjectAnimation } from '../../src/game/object-turn.mjs';
import { enterRoomSequence } from '../../src/game/room-entry.mjs';
import { printNumber, setTextCursor } from '../../src/game/window-text.mjs';
import { decimalNumber } from '../../src/game/decimal-number.mjs';
import { hitObject } from '../../src/game/object-hit.mjs';
import { objectSearch } from '../../src/game/object-search.mjs';
import { startNewGame } from '../../src/game/game-start.mjs';
import { gloveMove } from '../../src/game/glove-move.mjs';
import { buildSpritesInPlace } from '../../src/game/sprite-list.mjs';
import { moveAndAnimateInPlace } from '../../src/game/object-motion.mjs';
import { noticeTimeoutSequence } from '../../src/game/notice-timeout.mjs';
import { timeLimitSequence } from '../../src/game/time-limit.mjs';
import { gloveActionSequence } from '../../src/game/glove-action.mjs';
import { playerZonesSequence } from '../../src/game/player-zones.mjs';
import { sceneRequestSequence } from '../../src/game/scene-request.mjs';
import { drawTextBufferSequence } from '../../src/game/text-draw.mjs';
import {
  clearFixedColourInPlace,
  setWindowTextWidthInPlace,
  closeDialog,
} from '../../src/game/dialog-talk.mjs';
import {
  shiftPortraitRowsInPlace,
  uploadFirstPortrait,
  uploadSecondPortrait,
} from '../../src/game/portrait-upload.mjs';
import { openPortraitWindow, closePortraitWindow } from '../../src/game/portrait-window.mjs';
import { buyStep, karmaLine, karmaList, karmaMenu } from '../../src/game/karma-menu.mjs';
import { saveMenu } from '../../src/game/main-menu.mjs';
import { equipmentRows } from '../../src/game/equipment-window.mjs';
import { partyStatus } from '../../src/game/party-status.mjs';
import { notes, skills } from '../../src/game/status-submenus.mjs';
import { itemMenu, useItem } from '../../src/game/item-menu.mjs';
import { spellMenu } from '../../src/game/member-spell-menu.mjs';
import { memberPortrait } from '../../src/game/member-portrait.mjs';
import { chooseAction } from '../../src/game/action-menu.mjs';
import { chooseDialogAction, chooseDialogTopic } from '../../src/game/dialog-menus.mjs';
import { showDialogText } from '../../src/game/dialog-text.mjs';
import { openWindow, requestTileClear } from '../../src/game/window-open.mjs';
import { resetWindowList } from '../../src/game/window-list.mjs';

function* rts(h) {
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// The text print 80:FE69; renderBuffer is the renderer sequence (the live one by default).
export function* printTextJsr(h, events, renderBuffer = drawTextBufferSequence) {
  yield* printText(h, events, renderBuffer);
  return yield* rts(h);
}

// The number print 80:FD80; renderBuffer as for the text print.
export function* printNumberJsr(h, events, renderBuffer = drawTextBufferSequence) {
  yield* printNumber(h, events, renderBuffer);
  return yield* rts(h);
}

// The text cursor 80:FAAC.
export function setTextCursorJsr(h) {
  setTextCursor(h);
  return h.rts();
}

// The sound effect 80:C46E.
export function playSoundEffectJsr(h) {
  playSoundEffectCall(h);
  return h.rts();
}

// The room entry 80:A4BF, the room given as a value.
export function* enterRoomJsr(h, events, room) {
  yield* enterRoomSequence(h, events, room);
  return yield* rts(h);
}

// The depth sort 80:AFFC.
export function sortDrawListJsr(h) {
  sortDrawListInPlace(h);
  return h.rts();
}

// The palette slot 80:AB0A: returns the slot after its RTS.
export function paletteSlotJsr(h, palette) {
  const slot = paletteSlotInPlace(h.a.mem.wram, palette);
  h.rts();
  return slot;
}

// The animation selection 80:A985: it reads the WRAM words at 0 and checks no direct
// page register (user decision 2026-11-17); it leaves no registers.
export function selectAnimationJsr(h) {
  const { mem } = h.a;
  selectObjectAnimation(mem, mem.wram);
  return h.rts();
}

// The decimal number 80:FDCF; renderBuffer as for the text print.
export function* decimalNumberJsr(h, events, renderBuffer = drawTextBufferSequence) {
  yield* decimalNumber(h, events, renderBuffer);
  return yield* rts(h);
}

// The hit 80:8691: the damage, target and shooter as parameters (A, X and Y in the
// original); renderBuffer as for the text print (undefined for the live renderer).
export function* hitObjectJsr(h, events, renderBuffer, damage, target, shooter) {
  yield* hitObject(h, events, renderBuffer, damage, target, shooter);
  return yield* rts(h);
}

// The glove's object search 80:BCBE; renderBuffer as for the text print.
export function* objectSearchJsr(h, events, renderBuffer = drawTextBufferSequence) {
  yield* objectSearch(h, events, renderBuffer);
  return yield* rts(h);
}

// A new game 80:960D. Game state only (user decision 2026-11-17): the first room the
// original returns in A is not kept.
export function startNewGameJsr(h) {
  startNewGame(h.a);
  return h.rts();
}

// The glove movement 80:BE6D; renderBuffer as for the text print.
export function* gloveMoveJsr(h, events, renderBuffer = drawTextBufferSequence) {
  yield* gloveMove(h, events, renderBuffer);
  return yield* rts(h);
}

// The sprite list 80:B8DE; nothing in it waits.
export function buildSpritesJsr(h) {
  buildSpritesInPlace(h);
  return h.rts();
}

// The motion pass 80:AFC4; nothing in it waits.
export function moveAndAnimateJsr(h) {
  moveAndAnimateInPlace(h);
  return h.rts();
}

// The notice timeouts 80:FF14; their window releases wait for the NMI of their uploads.
export function* noticeTimeoutJsr(h, events) {
  yield* noticeTimeoutSequence(h, events);
  return yield* rts(h);
}

// The time limit 80:E270; its notice and text wait for the NMI of their uploads.
export function* timeLimitJsr(h, events, renderBuffer = drawTextBufferSequence) {
  yield* timeLimitSequence(h, events, renderBuffer);
  return yield* rts(h);
}

// The glove action 80:BF3B; its notice, menu, dialog and input wait for the NMI.
export function* gloveActionJsr(h, events, renderBuffer = drawTextBufferSequence) {
  yield* gloveActionSequence(h, events, renderBuffer);
  return yield* rts(h);
}

// The player zones 80:8000; zones.changed reports a scene change, whose room entry
// waits for the NMI.
export function* playerZonesJsr(h, events, zones = {}) {
  yield* playerZonesSequence(h, events, zones);
  return yield* rts(h);
}

// The scene request 80:CC4B; request.taken reports a taken request, whose scenes and room
// entry wait for the NMI.
export function* sceneRequestJsr(h, events, request = {}) {
  yield* sceneRequestSequence(h, events, request);
  return yield* rts(h);
}

// 81:886A as called with JSL; returns with its RTL.
export function clearFixedColourJsl(h) {
  clearFixedColourInPlace(h);
  return h.rtl();
}

// 80:FA92 as called with JSR; returns with its RTS.
export function setWindowTextWidthJsr(h) {
  setWindowTextWidthInPlace(h);
  return h.rts();
}

// The dialog close as called with JSR (80:92C5); returns with its RTS.
export function* closeDialogJsr(h, events) {
  yield* closeDialog(h, events);
  return yield* rts(h);
}

// 80:8F20 as called with JSR; returns with its RTS.
export function shiftPortraitRowsJsr(h) {
  shiftPortraitRowsInPlace(h);
  return h.rts();
}

// The first upload as called with JSR (80:9022); returns with its RTS.
export function* uploadFirstPortraitJsr(h, events) {
  yield* uploadFirstPortrait(h, events);
  return yield* rts(h);
}

// The second upload as called with JSR (80:905E); returns with its RTS.
export function* uploadSecondPortraitJsr(h, events) {
  yield* uploadSecondPortrait(h, events);
  return yield* rts(h);
}

// The opening as called with JSR (80:8F3A); returns with its RTS.
export function* openPortraitWindowJsr(h, events) {
  yield* openPortraitWindow(h, events);
  return yield* rts(h);
}

// The closing as called with JSR (80:8F97); returns with its RTS.
export function* closePortraitWindowJsr(h, events) {
  yield* closePortraitWindow(h, events);
  return yield* rts(h);
}

// The step bought as called with JSR (80:F006); returns with its RTS.
export function* buyStepJsr(h, events, renderBuffer = drawTextBufferSequence) {
  yield* buyStep(h, events, renderBuffer);
  return yield* rts(h);
}

// The karma line as called with JSR (80:EF82); returns with its RTS.
export function* karmaLineJsr(h, events, renderBuffer = drawTextBufferSequence) {
  yield* karmaLine(h, events, renderBuffer);
  return yield* rts(h);
}

// The karma list as called with JSR; returns with its RTS.
export function* karmaListJsr(h, events, entry, renderBuffer = drawTextBufferSequence) {
  yield* karmaList(h, events, entry, renderBuffer);
  return yield* rts(h);
}

// The karma menu as called with JSR (80:EE57); returns with its RTS.
export function* karmaMenuJsr(h, events, renderBuffer = drawTextBufferSequence) {
  yield* karmaMenu(h, events, renderBuffer);
  return yield* rts(h);
}

// The save menu as called with JSR (80:CDD6); returns with its RTS.
export function* saveMenuJsr(h, events, renderBuffer = drawTextBufferSequence) {
  yield* saveMenu(h, events, renderBuffer);
  return yield* rts(h);
}

// The rows as called with JSR (80:E9C5); returns with its RTS.
export function* equipmentRowsJsr(h, events, renderBuffer = drawTextBufferSequence) {
  yield* equipmentRows(h, events, renderBuffer);
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// The party status as called with JSR (80:ED3C); returns with its RTS.
export function* partyStatusJsr(h, events, renderBuffer = drawTextBufferSequence) {
  yield* partyStatus(h, events, renderBuffer);
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// The notes as called with JSR (80:E8C8); return with their RTS.
export function* notesJsr(h, events, renderBuffer = drawTextBufferSequence) {
  yield* notes(h, events, renderBuffer);
  return yield* rts(h);
}

// The skills as called with JSR (80:E834); return with their RTS.
export function* skillsJsr(h, events, renderBuffer = drawTextBufferSequence) {
  yield* skills(h, events, renderBuffer);
  return yield* rts(h);
}

// The item submenu as called with JSR; returns with its RTS.
export function* itemMenuJsr(h, events, entry, renderBuffer = drawTextBufferSequence) {
  yield* itemMenu(h, events, entry, renderBuffer);
  return yield* rts(h);
}

// The item use as called with JSR (80:E4F3); returns with its RTS.
export function* useItemJsr(h, events, renderBuffer, actor) {
  yield* useItem(h, events, renderBuffer, actor);
  return yield* rts(h);
}

// The spell menu as called with JSR; returns with its RTS.
export function* spellMenuJsr(
  h,
  events,
  entry, // undefined: the menu entry 80:E693
  renderBuffer = drawTextBufferSequence,
) {
  yield* spellMenu(h, events, entry, renderBuffer);
  return yield* rts(h);
}

// The portrait as called with JSR (80:E4B3); returns with its RTS.
export function* memberPortraitJsr(h, events) {
  yield* memberPortrait(h, events);
  return yield* rts(h);
}

// The action menu as called with JSR (80:99EB); returns with its RTS.
export function* chooseActionJsr(
  h,
  events,
  renderBuffer = drawTextBufferSequence,
  accepted,
  choice = {},
) {
  yield* chooseAction(h, events, renderBuffer, accepted, choice);
  return yield* rts(h);
}

// The main menu as called with JSR (80:91E2), a sequence for a native call
// continuation; returns with its RTS.
export function* chooseDialogActionJsr(h, events, renderBuffer = drawTextBufferSequence) {
  yield* chooseDialogAction(h, events, renderBuffer);
  return yield* rts(h);
}

// The topic choice as called with JSR (80:9215), a sequence for a native call
// continuation; returns with its RTS.
export function* chooseDialogTopicJsr(h, events, renderBuffer = drawTextBufferSequence) {
  yield* chooseDialogTopic(h, events, renderBuffer);
  return yield* rts(h);
}

// The dialog text as called with JSR (80:9178), a sequence for a native call
// continuation; returns with its RTS.
export function* showDialogTextJsr(h, events, renderBuffer = drawTextBufferSequence, key) {
  yield* showDialogText(h, events, renderBuffer, key);
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}

// The window opening as called with JSR (80:F963), a sequence for a native call
// continuation whose caller has pushed the frame; returns with its RTS.
export function* openWindowJsr(h, events) {
  yield* openWindow(h, events);
  return yield* rts(h);
}

// The tile request as other routines call it with JSR (their sequence pushes the
// frame); the existing JSR frame is consumed.
export function* requestTileClearJsr(h, events) {
  yield* requestTileClear(h, events);
  return yield* rts(h);
}

// 81:AEB0 as called with JSL; returns with its RTL (which takes the bank from the stack).
export function* resetWindowListJsl(h, events) {
  yield* resetWindowList(h, events);
  let result;
  yield () => {
    result = h.rtl();
  };
  return result;
}
