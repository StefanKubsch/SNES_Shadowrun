// Waiting for a confirming key (lifted from the script native 80:F953; register-level
// version in src/task/native-input-wait.mjs, which recorded waits and inputs replay):
// each frame the word wait 81:B0A1 and the newly pressed buttons 80:9E1A, until one of
// B, Y, Select, A or X is pressed.
import { nativeCallSequence } from '../task/native-call-continuation.mjs';
import { PAD_PRESSED } from '../task/wram.mjs';
import { BYTE_BITS } from '../constants/bits.mjs';

// B, Y and Select in the high byte, A and X in the low byte.
const CONFIRM_BUTTONS = 0xe0c0,
  WAIT_CALL = [0x80f953, 0x81b0a1],
  PAD_CALL = [0x80f957, 0x809e1a];

// 80:F953, a sequence that ends with the native's RTS; routines holds the word wait
// (JSL) and the pad word (JSR). Leaves A the confirming buttons pressed.
export function* waitForConfirmKeySequence(h, events, routines) {
  const { ctx } = h,
    { wram } = h.a.mem;
  let pressed = 0;
  do {
    yield* nativeCallSequence(h, events, routines, ...WAIT_CALL, true);
    yield* nativeCallSequence(h, events, routines, ...PAD_CALL);
    yield () => {
      pressed = (wram[PAD_PRESSED] | (wram[PAD_PRESSED + 1] << BYTE_BITS)) & CONFIRM_BUTTONS;
      ctx.a = pressed;
    };
  } while (pressed === 0);
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
