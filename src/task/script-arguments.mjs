import {
  OUTER_STACK,
  SCRIPT_CALL,
  SCRIPT_ARGUMENT_BYTES,
  FRAME_PC,
  FRAME_CALL_ID,
  FRAME_OPERAND_STACK,
} from '../vm/layout.mjs';
import { FLAG_CARRY, FLAG_ZERO, FLAG_NEGATIVE } from '../constants/cpu-flags.mjs';
import {
  WORD_MASK,
  BANK_WRAP,
  LONG_WRAP,
  BYTE_MASK,
  BANK_SIZE,
  WORD_SIGN,
} from '../constants/bits.mjs';

export function runTaskScriptArguments(a) {
  const id = a.streamWord('script-ID-WORD');
  a.ctx.y = (a.ctx.y + 2) & WORD_MASK;
  a.writeWord((a.ctx.d + FRAME_PC) & WORD_MASK, a.ctx.y, BANK_WRAP, 'saved-PC');
  a.writeWord((a.ctx.d + FRAME_CALL_ID) & WORD_MASK, id, BANK_WRAP, 'saved-ID');
  a.ctx.x = id;
  const argumentWord = a.readWord(SCRIPT_ARGUMENT_BYTES + id, LONG_WRAP, 'argument-metadata-WORD'),
    low = argumentWord & BYTE_MASK;
  let wordPops = 0;
  if (low) {
    a.ctx.status = (a.ctx.status & ~FLAG_CARRY) | (low & 1);
    a.ctx.y = low >>> 1;
    a.ctx.x = 0;
    do {
      a.ctx.a = a.pullWord('argument-PLA');
      a.writeWord(a.ctx.bank * BANK_SIZE + a.ctx.x, a.ctx.a, LONG_WRAP, 'argument-workspace');
      a.ctx.x = (a.ctx.x + 2) & WORD_MASK;
      a.ctx.y = (a.ctx.y - 1) & WORD_MASK;
      wordPops++;
    } while (a.ctx.y !== 0);
  }
  a.ctx.x = a.readWord(
    (a.ctx.d + FRAME_CALL_ID) & WORD_MASK,
    BANK_WRAP,
    'fresh-ID-after-workspace',
  );
  a.ctx.a = a.ctx.s;
  a.writeWord((a.ctx.d + FRAME_OPERAND_STACK) & WORD_MASK, a.ctx.a, BANK_WRAP, 'saved-operand-S');
  a.ctx.a = a.readWord(a.ctx.bank * BANK_SIZE + OUTER_STACK, LONG_WRAP, 'fresh-outer-S');
  a.ctx.status =
    (a.ctx.status & ~(FLAG_ZERO | FLAG_NEGATIVE)) |
    (a.ctx.a & WORD_SIGN ? FLAG_NEGATIVE : 0) |
    (a.ctx.a === 0 ? FLAG_ZERO : 0);
  a.ctx.pc = SCRIPT_CALL;
  return {
    id,
    argumentWord,
    wordPops,
    frontier: '80:F488',
    scope: 'manual-script-argument-prefix-before-TCS',
    stackMigrationExecuted: false,
    dynamicDispatchExecuted: false,
  };
}
