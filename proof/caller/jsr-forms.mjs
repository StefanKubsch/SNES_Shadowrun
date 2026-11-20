// The RTS forms of lifted routines for register-level call tables and caller harnesses
// (moved from src/, whose live callers run the routines without their JSR frames). Each
// runs the lifted sequence or function, then returns through the caller's JSR frame.
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
export function moveAndAnimateJsr(h, events) {
  moveAndAnimateInPlace(h, events);
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
