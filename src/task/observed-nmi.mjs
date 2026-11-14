import { taskStop } from './plan.mjs';
import { dialogAccess } from './native-dialog-support.mjs';
import { NativeCallContinuation, drainNativeSequence } from './native-call-continuation.mjs';
import {
  RANDOM_STATE,
  WRAM,
  NMI_CALLBACK,
  NMI_CALLBACK_BANK,
  NMI_SAVED_A,
  NMI_SAVED_STACK,
  NMI_STACK_TOP,
} from './wram.mjs';
import { RDNMI } from '../constants/hardware-registers.mjs';
import {
  FLAG_ZERO,
  FLAG_NEGATIVE,
  FLAG_DECIMAL,
  FLAG_IRQ_DISABLE,
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
} from '../constants/cpu-flags.mjs';
import {
  BANK_WRAP,
  WORD_BITS,
  WORD_MASK,
  BYTE_BITS,
  BYTE_MASK,
  WORD_SIGN,
} from '../constants/bits.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';

// Native vector and the fixed entry/long-call return sites in 00:C112.
const NATIVE_NMI_VECTOR = 0xffea,
  NMI_ENTRY = 0xc112;
const CALLBACK_RETURN_WORD = 0xc13a,
  CALLBACK_RESUME = 0xc13b,
  CALLBACK_DISPATCH = 0xc14f;
export const CALLBACKS = new Set([
  0x81bec3, 0x81dad6, 0x81df0e, 0x81d479, 0x80c152, 0x81e6ae, 0x81dd54, 0x81d93e, 0x81dcac,
  0x81e839,
]);

// Explicitly invoked, observed native-mode NMI. The caller supplies the actual
// interrupted state and chronological device reads. No clock or wait schedules
// this function. Only the separately proved callback roots above are admitted.
export function runObservedNmi(a, events = null, routines) {
  return drainNativeSequence(observedNmiSequence(a, events, routines));
}

export class ObservedNmiContinuation extends NativeCallContinuation {
  constructor(a, events, routines, continuations) {
    super(a, observedNmiSequence(a, events, routines), continuations);
  }
}

function* observedNmiSequence(a, events, routines) {
  const { ctx } = a;
  if (ctx.e !== 0 || a.readWord(NATIVE_NMI_VECTOR, BANK_WRAP) !== NMI_ENTRY)
    taskStop('observed_nmi_entry_required');
  const target = a.readWord(NMI_CALLBACK, BANK_WRAP) | (a.read(NMI_CALLBACK_BANK) << WORD_BITS);
  if (!CALLBACKS.has(target) || !routines?.has(target))
    taskStop('observed_nmi_callback_frontier', { target });
  // Native interrupt hardware frame: PB, PC, P. The handler executes in bank 00.
  const pushByte = (v) => {
    a.write(ctx.s, v);
    ctx.s = (ctx.s - 1) & WORD_MASK;
  };
  const pushWord = (v) => {
    pushByte(v >>> BYTE_BITS);
    pushByte(v & BYTE_MASK);
  };
  const load = (v) => {
    ctx.a = v & WORD_MASK;
    ctx.status =
      (ctx.status & ~(FLAG_ZERO | FLAG_NEGATIVE)) |
      (ctx.a & WORD_SIGN ? FLAG_NEGATIVE : 0) |
      (ctx.a === 0 ? FLAG_ZERO : 0);
  };
  let h, fresh, result;
  yield () => {
    pushByte(ctx.programBank);
    pushWord(ctx.pc);
    pushByte(ctx.status);
    ctx.status = (ctx.status | FLAG_IRQ_DISABLE) & ~FLAG_DECIMAL;
    ctx.programBank = 0;
    ctx.pc = NMI_ENTRY;
    ctx.status &= ~(FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT);
    a.writeWord(WRAM + NMI_SAVED_A, ctx.a);
    load(a.absoluteRead(RDNMI, 2, 0x00c118));
    load(ctx.s);
    a.writeWord(WRAM + NMI_SAVED_STACK, ctx.a);
    load(NMI_STACK_TOP);
    ctx.s = ctx.a;
    load(a.readWord(WRAM + NMI_SAVED_A));
    pushWord(ctx.a);
    pushWord(ctx.x);
    pushWord(ctx.y);
    pushByte(ctx.bank);
    pushWord(ctx.d);
    load(0);
    ctx.d = ctx.a;
    h = dialogAccess(a);
    h.pushByte(0);
    h.plb();
    h.modify(h.abs(RANDOM_STATE), 'inc');
    h.php();
    // JSL 80:C14F / JML [006E]: the callback owns that one long frame.
    h.pushByte(0);
    a.pushWord(CALLBACK_RETURN_WORD);
    ctx.programBank = CODE_BANK;
    ctx.pc = CALLBACK_DISPATCH;
    fresh = h.pointer(NMI_CALLBACK);
    if (!CALLBACKS.has(fresh) || !routines.has(fresh))
      taskStop('observed_nmi_callback_frontier', { target: fresh });
    ctx.programBank = fresh >>> WORD_BITS;
    ctx.pc = fresh & WORD_MASK;
  };
  yield { target: fresh, run: routines.get(fresh), h, events, routines };
  yield () => {
    if (ctx.programBank !== 0 || ctx.pc !== CALLBACK_RESUME)
      taskStop('task_native_helper_return_required', {
        pc: 0x00c137,
        target: 0x80c14f,
        bank: ctx.programBank,
        returnPc: ctx.pc,
      });
    h.plp();
    ctx.d = h.pull(2);
    h.nz(ctx.d, 2);
    h.plb();
    h.ply();
    h.plx();
    h.pla();
    h.write(WRAM + NMI_SAVED_A, ctx.a, 2);
    h.load(h.read(WRAM + NMI_SAVED_STACK, 2));
    ctx.s = ctx.a;
    h.load(h.read(WRAM + NMI_SAVED_A, 2));
    // RTI restores P, PC and PB directly, with no RTS increment.
    h.plp();
    ctx.pc = h.pull(2);
    ctx.programBank = h.pullByte();
    result = ctx.pc;
  };
  return result;
}
