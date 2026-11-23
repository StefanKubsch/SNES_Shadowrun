import { readStateByte } from '../state/objects.mjs';
// Waiting for a confirming key (lifted from the script native 80:F953; register-level
// version in proof/replay/native-input-wait.mjs, which recorded waits and inputs replay):
// each frame the word wait 81:B0A1 and the newly pressed buttons 80:9E1A, until one of
// B, Y, Select, A or X is pressed. Game state only (user decision 2026-11-17): the
// confirming buttons the original leaves in A are not kept; no caller reads them, and
// the script interpreter loads its next opcode into A after the native.
import { segmentSequence } from '../system/native-call-continuation.mjs';
import { takePad } from '../system/live-input-calls.mjs';
import { waitForCounterWord } from '../system/frame-wait.mjs';
import { PAD_PRESSED } from '../data/wram.mjs';
import { BYTE_BITS } from '../constants/bits.mjs';

// B, Y and Select in the high byte, A and X in the low byte.
const CONFIRM_BUTTONS = 0xe0c0;

// 80:F953 composes the live word wait through its frame and reads the pad directly.
export function* waitForConfirmKey(h, events) {
  const { wram } = h.a.mem;
  let pressed = 0;
  do {
    yield* waitForCounterWord(h, events);
    yield* segmentSequence(() => takePad(h, events));
    yield () => {
      pressed =
        (readStateByte(wram, PAD_PRESSED) | (readStateByte(wram, PAD_PRESSED + 1) << BYTE_BITS)) &
        CONFIRM_BUTTONS;
    };
  } while (pressed === 0);
  return pressed;
}

// Compatibility entry consumes only the supplied outer native frame.
export function* waitForConfirmKeySequence(h, events, outerReturn = true) {
  yield* waitForConfirmKey(h, events);
  let result;
  yield () => {
    if (outerReturn) result = h.rts();
  };
  return result;
}
