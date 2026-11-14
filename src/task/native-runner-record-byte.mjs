import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { taskSelectionSupport } from './native-object-turn.mjs';
import { OBJECT_NUMBER, DP_SELECTION_POINTER, DP_SELECTION_POINTER_BANK } from './wram.mjs';
import {
  RUNNER_LAST_INDEX,
  RUNNER_OBJECT_NUMBERS,
  RUNNER_RECORD_POINTERS,
  RUNNER_RECORD_BANKS,
} from '../data/runners.mjs';
import { WORD_MASK, BANK_WRAP, LONG_MASK, BYTE_MASK } from '../constants/bits.mjs';
import { FLAG_ZERO, FLAG_NEGATIVE } from '../constants/cpu-flags.mjs';
const RECORD_LOOKUP_RETURN_WORD = 0xd06e,
  STRENGTH_BYTE = 2;
// D02F: byte DP02 of the record of object DP00. Its number 150A+Y is searched in the words 9700+X from
// X = 18 down (DEX DEX, BPL: a miss ends with X = FFFE, read with bank carry); the record pointer
// 971A+X WORD and 9734+X BYTE go to DPA2/DPA4 (SEP #20 keeps the high byte of A), [A2]+DP02 BYTE to DP00.
function readRunnerRecordByte(h, k) {
  const { a, ctx } = h;
  h.index('y', h.dp(FIRST_ARGUMENT));
  h.index('x', RUNNER_LAST_INDEX);
  h.load(h.longRead(h.abs(OBJECT_NUMBER) + ctx.y));
  for (;;) {
    k.compare(ctx.a, h.longRead(h.abs(RUNNER_OBJECT_NUMBERS) + ctx.x));
    if (ctx.status & FLAG_ZERO) break;
    h.index('x', (ctx.x - 1) & WORD_MASK);
    h.index('x', (ctx.x - 1) & WORD_MASK);
    if (ctx.status & FLAG_NEGATIVE) break;
  }
  h.load(h.longRead(h.abs(RUNNER_RECORD_POINTERS) + ctx.x));
  a.writeWord(DP_SELECTION_POINTER, ctx.a, BANK_WRAP, 'd02f-DPA2');
  h.load(a.read((h.abs(RUNNER_RECORD_BANKS) + ctx.x) & LONG_MASK, 'd02f-9734-BYTE'), 1);
  a.write(DP_SELECTION_POINTER_BANK, ctx.a & BYTE_MASK, 'd02f-DPA4-BYTE');
  h.index('y', h.dp(SECOND_ARGUMENT));
  h.load(k.indirect(DP_SELECTION_POINTER, ctx.y));
  h.load(ctx.a & BYTE_MASK);
  a.writeWord(FIRST_ARGUMENT, ctx.a, BANK_WRAP, 'd02f-DP00');
}
// 80:D067: return the Strength (record byte 2, src/data/runners.mjs) of the runner object
// (first argument): D02F with DP02 = 2 (real JSR frame).
export const getRunnerStrength = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const k = taskSelectionSupport(h);
      h.load(STRENGTH_BYTE);
      a.writeWord(SECOND_ARGUMENT, h.ctx.a, BANK_WRAP, 'd067-DP02');
      k.call(RECORD_LOOKUP_RETURN_WORD, () => readRunnerRecordByte(h, k));
    },
    outerReturn,
  );
