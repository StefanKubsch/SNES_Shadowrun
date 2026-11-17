import { taskStop } from './task-stop.mjs';
import { taskTextAccess } from './native-text-prerequisites.mjs';

import { PAD_HELD, PAD_PRESSED, PAD_PREVIOUS } from '../data/wram.mjs';
import { FLAG_ZERO } from '../constants/cpu-flags.mjs';
import { BANK_WRAP, WORD_MASK, BANK_SIZE } from '../constants/bits.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';

const SOFT_RESET_BUTTONS = 0x3030,
  INVALID_PAD_BITS = 0x000f;
// Return of an input or APU native: the RTS or RTL frame (shared with the references).
export function finish(a, long, outerReturn) {
  const { ctx } = a,
    rawReturnWord = a.readWord(
      (ctx.s + 1) & WORD_MASK,
      BANK_WRAP,
      'input-apu-return-WORD',
      outerReturn,
    );
  ctx.s = (ctx.s + 2) & WORD_MASK;
  let returnBank = ctx.programBank;
  if (long) {
    returnBank = a.read((ctx.s + 1) & WORD_MASK, 'input-apu-return-bank', outerReturn);
    ctx.s = (ctx.s + 1) & WORD_MASK;
  }
  ctx.programBank = returnBank;
  ctx.pc = (rawReturnWord + 1) & WORD_MASK;
  return {
    rawReturnWord,
    returnBank,
    returnTarget: returnBank * BANK_SIZE + ctx.pc,
    returnTargetExecuted: false,
    dynamicDispatchExecuted: false,
    frontier: long ? 'observed-outer-RTL-target' : 'observed-outer-RTS-target',
  };
}

// Complete normal return paths. Exact3030 abandons the root frame through
// reset/startup; the outer plan withholds every preceding edge/copy write.
// 80:9E1A: take the joypad word of the NMI and derive the newly pressed buttons.
export function readInput(a, outerReturn = true) {
  const h = taskTextAccess(a),
    { ctx } = h;
  if (ctx.programBank !== CODE_BANK) taskStop('task_input_entry_required');
  h.load(h.read(h.abs(PAD_HELD)));
  const first = ctx.a,
    previous = h.read(h.abs(PAD_PREVIOUS));
  h.load(ctx.a ^ previous);
  h.load(ctx.a & h.read(h.abs(PAD_HELD)));
  const edge = ctx.a;
  h.write(h.abs(PAD_PRESSED), ctx.a);
  h.load(h.read(h.abs(PAD_HELD)));
  const current = ctx.a;
  h.write(h.abs(PAD_PREVIOUS), ctx.a);
  h.compare(ctx.a, SOFT_RESET_BUTTONS);
  if (ctx.status & FLAG_ZERO)
    taskStop('task_reset_source_required', {
      pc: 0x809e2f,
      target: 0x809e3d,
      startupTarget: 0x80e382,
    });
  h.load(ctx.a & INVALID_PAD_BITS);
  const filtered = ctx.a !== 0;
  if (filtered) {
    h.write(h.abs(PAD_HELD), 0);
    h.write(h.abs(PAD_PRESSED), 0);
  }
  return {
    ...finish(a, false, outerReturn),
    outcome: filtered ? 'input_filtered' : 'input_preserved',
    first,
    previous,
    edge,
    current,
  };
}
