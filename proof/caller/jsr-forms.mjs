// The RTS forms of lifted routines for register-level call tables and caller harnesses
// (moved from src/, whose live callers run the routines without their JSR frames). Each
// runs the lifted sequence or function, then returns through the caller's JSR frame.
import { printText } from '../../src/game/text-print.mjs';
import { printNumber } from '../../src/game/window-text.mjs';
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
