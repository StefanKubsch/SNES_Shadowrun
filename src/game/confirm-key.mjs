// Waiting for a confirming key (lifted from the script native 80:F953; register-level
// version in proof/replay/native-input-wait.mjs, which recorded waits and inputs replay):
// each frame the word wait 81:B0A1 and the newly pressed buttons 80:9E1A, until one of
// B, Y, Select, A or X is pressed. Game state only (user decision 2026-11-17): the
// confirming buttons the original leaves in A are not kept; no caller reads them, and
// the script interpreter loads its next opcode into A after the native.
import { dialogCallBody, segmentSequence } from '../system/native-call-continuation.mjs';
import { frameWaitCallSequence, runPadPresses } from '../system/live-input-calls.mjs';
import { PAD_PRESSED } from '../data/wram.mjs';
import { BYTE_BITS } from '../constants/bits.mjs';

// B, Y and Select in the high byte, A and X in the low byte.
const CONFIRM_BUTTONS = 0xe0c0,
  WAIT_CALL = [0x80f953, 0x81b0a1],
  PAD_CALL = [0x80f957, 0x809e1a];

// 80:F953 composes the live word wait and pad read directly through their frames.
export function* waitForConfirmKeySequence(h, events) {
  const { wram } = h.a.mem;
  let pressed = 0;
  do {
    yield* dialogCallBody(h, ...WAIT_CALL, () => frameWaitCallSequence(h, events), true);
    yield* dialogCallBody(h, ...PAD_CALL, () => segmentSequence(() => runPadPresses(h, events)));
    yield () => {
      pressed = (wram[PAD_PRESSED] | (wram[PAD_PRESSED + 1] << BYTE_BITS)) & CONFIRM_BUTTONS;
    };
  } while (pressed === 0);
  let result;
  yield () => {
    result = h.rts();
  };
  return result;
}
