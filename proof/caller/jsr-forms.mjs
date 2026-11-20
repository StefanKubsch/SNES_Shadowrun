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
