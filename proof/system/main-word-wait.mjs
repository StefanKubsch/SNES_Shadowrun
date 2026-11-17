// Register-level text and window upload waits 81:ACAF/ACBD/ACC3/ACC9 and their
// request entries 81:ACB5/AEF4/AEFC with explicit interrupt steps. Only the
// register-level window, text and menu references call them; the game waits for
// these uploads through its lifted window and text code.
import {
  TEXT_MAP_UPLOAD,
  TEXT_TILE_UPLOAD,
  TEXT_BUFFER_UPLOAD,
  TEXT_BUFFER_READBACK,
} from '../../src/data/wram.mjs';
import { taskStop } from '../../src/system/task-stop.mjs';
import {
  NativeCallContinuation,
  drainNativeSequence,
} from '../../src/system/native-call-continuation.mjs';
import { waitEntry } from './main-wait-interrupt.mjs';
import {
  InterruptStepContinuation,
  WAIT_CODE_BANK,
} from '../../src/system/main-wait-interrupt.mjs';
import { FLAG_ZERO } from '../../src/constants/cpu-flags.mjs';
import { WORD_MASK, BANK_SIZE } from '../../src/constants/bits.mjs';

// LDA abs / BNE / RTL, or INC abs / JSL wait / RTL.
const ABSOLUTE_INSTRUCTION_BYTES = 3,
  WORD_WAIT_RETURN_OFFSET = 5;
const REQUEST_WAIT_RETURN_WORD_OFFSET = 6,
  REQUEST_WAIT_RESUME_OFFSET = 7;

const wordWaits = new Map([
  [0x81acaf, TEXT_MAP_UPLOAD],
  [0x81acbd, TEXT_TILE_UPLOAD],
  [0x81acc3, TEXT_BUFFER_UPLOAD],
  [0x81acc9, TEXT_BUFFER_READBACK],
]);
const wordRequests = new Map([
  [0x81acb5, 0x81acaf],
  [0x81aef4, 0x81acc3],
  [0x81aefc, 0x81acc9],
]);
// The original LDA/BNE/RTL graph. No external writer is injected. A zero
// already in memory can return without an NMI; unchanged polls require records.
export function runInterruptWordWait(h, events, pc) {
  return drainNativeSequence(wordWaitSequence(h, events, pc));
}
export class WordWaitContinuation extends NativeCallContinuation {
  constructor(h, events, pc) {
    super(h.a, wordWaitSequence(h, events, pc));
  }
}
function* wordWaitSequence(h, events, pc) {
  waitEntry(h, WAIT_CODE_BANK);
  const offset = wordWaits.get(pc);
  if (offset === undefined) taskStop('wait_interrupt_word_entry_required', { pc });
  let polls = 0,
    again;
  do {
    yield { continuation: new InterruptStepContinuation(h, events, pc) };
    yield () => {
      h.load(h.read(h.abs(offset)));
      polls++;
    };
    yield {
      continuation: new InterruptStepContinuation(h, events, pc + ABSOLUTE_INSTRUCTION_BYTES),
    };
    yield () => {
      again = !(h.ctx.status & FLAG_ZERO);
    };
  } while (again);
  yield { continuation: new InterruptStepContinuation(h, events, pc + WORD_WAIT_RETURN_OFFSET) };
  let rawReturnWord;
  yield () => {
    rawReturnWord = h.rtl();
  };
  return {
    rawReturnWord,
    returnBank: h.ctx.programBank,
    returnTarget: h.ctx.programBank * BANK_SIZE + h.ctx.pc,
    outcome: 'wait_complete',
    polls,
    waitObservationsUsed: 0,
    nmiWords: 0,
  };
}
export function runInterruptRequestWait(h, events, pc) {
  return drainNativeSequence(requestWaitSequence(h, events, pc));
}
export class RequestWaitContinuation extends NativeCallContinuation {
  constructor(h, events, pc) {
    super(h.a, requestWaitSequence(h, events, pc));
  }
}
function* requestWaitSequence(h, events, pc) {
  waitEntry(h, WAIT_CODE_BANK);
  const target = wordRequests.get(pc);
  if (target === undefined) taskStop('wait_interrupt_word_entry_required', { pc });
  let requestCounter, rawReturnWord;
  yield { continuation: new InterruptStepContinuation(h, events, pc) };
  yield () => {
    requestCounter = h.modify(h.abs(wordWaits.get(target)), 'inc');
  };
  yield { continuation: new InterruptStepContinuation(h, events, pc + ABSOLUTE_INSTRUCTION_BYTES) };
  yield () => {
    h.pushByte(h.ctx.programBank);
    h.a.pushWord((pc + REQUEST_WAIT_RETURN_WORD_OFFSET) & WORD_MASK);
    h.ctx.pc = target & WORD_MASK;
  };
  const result = yield { continuation: new WordWaitContinuation(h, events, target) };
  yield () => {
    if (
      result.rawReturnWord !== ((pc + REQUEST_WAIT_RETURN_WORD_OFFSET) & WORD_MASK) ||
      h.ctx.programBank !== WAIT_CODE_BANK ||
      h.ctx.pc !== ((pc + REQUEST_WAIT_RESUME_OFFSET) & WORD_MASK)
    )
      taskStop('task_native_helper_return_required', {
        pc: pc + ABSOLUTE_INSTRUCTION_BYTES,
        target,
        bank: h.ctx.programBank,
        returnPc: h.ctx.pc,
      });
  };
  yield { continuation: new InterruptStepContinuation(h, events, pc + REQUEST_WAIT_RESUME_OFFSET) };
  yield () => {
    rawReturnWord = h.rtl();
  };
  return {
    ...result,
    rawReturnWord,
    returnBank: h.ctx.programBank,
    returnTarget: h.ctx.programBank * BANK_SIZE + h.ctx.pc,
    outcome: 'request_wait_prepared',
    requestCounter,
  };
}
