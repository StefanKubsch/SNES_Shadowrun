// Native event interpreter. State between two opcodes as in the original at
// $80:F390: X = A = current opcode, Y = offset in the bytecode, D = task frame,
// DBR = script bank, S = operand stack in WRAM.
// run() executes opcodes until an exit is reached (END, status return,
// native or script call) or the budget is spent.
import { VmFault } from './memory.mjs';
import { OPCODE_TABLE, CONTINUE, EXIT_NATIVE_CALL } from './handlers.mjs';
import { OPCODE_LOOP, OPCODE_TARGETS } from './layout.mjs';
import {
  FLAG_ZERO,
  FLAG_NEGATIVE,
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
} from '../constants/cpu-flags.mjs';
import { BYTE_BITS, WORD_MASK, BYTE_MASK, LONG_MASK, WORD_BITS } from '../constants/bits.mjs';

export {
  CONTINUE,
  EXIT_END,
  EXIT_STATUS_RETURN,
  EXIT_NATIVE_CALL,
  EXIT_SCRIPT_CALL,
} from './handlers.mjs';
export const EXIT_BUDGET = 5;
export const EXIT_NATIVE_WAIT = 6; // resumable native paused; NativeCalls.pending owns the frame

// One handler per opcode byte value.
const handlers = new Array(BYTE_MASK + 1).fill(null);
for (const [opcode, , handler] of OPCODE_TABLE) handlers[opcode] = handler;

// Checks once that the ROM's jump table contains exactly the reproduced targets.
export function verifyOpcodeTable(memory) {
  for (const [opcode, target] of OPCODE_TABLE)
    if (memory.read16(OPCODE_TARGETS + opcode) !== target)
      throw new VmFault('opcode_table_mismatch', OPCODE_TARGETS + opcode);
}

export class ScriptInterpreter {
  constructor(memory) {
    verifyOpcodeTable(memory);
    this.mem = memory;
    this.a = 0;
    this.x = 0;
    this.y = 0;
    this.s = 0;
    this.d = 0;
    this.dbr = 0;
    this.p = 0;
    this.pc = OPCODE_LOOP;
    this.exitId = 0; // script or native ID at the respective call exit
    this.opcodesRun = 0; // handlers counted since the last run()
    this.natives = null; // optional: NativeCalls; permitted natives run without an exit
  }

  // Set registers; expects the state at $F390 (X = opcode).
  setContext({ a, x, y, s, d, bank, status }) {
    this.a = a;
    this.x = x;
    this.y = y;
    this.s = s;
    this.d = d;
    this.dbr = bank;
    this.p = status;
    this.pc = OPCODE_LOOP;
  }
  context() {
    return {
      a: this.a,
      x: this.x,
      y: this.y,
      s: this.s,
      d: this.d,
      bank: this.dbr,
      status: this.p,
      pc: this.pc,
    };
  }

  // Operand stack and byte stream (all addresses wrapped as in the original).
  push16(value) {
    this.mem.write8(this.s, value >>> BYTE_BITS);
    this.s = (this.s - 1) & WORD_MASK;
    this.mem.write8(this.s, value & BYTE_MASK);
    this.s = (this.s - 1) & WORD_MASK;
  }
  peek16(offset) {
    return this.mem.read16Bank0((this.s + offset) & WORD_MASK);
  }
  poke16(offset, value) {
    this.mem.write16Bank0((this.s + offset) & WORD_MASK, value);
  }
  pull16() {
    const value = this.peek16(1);
    this.s = (this.s + 2) & WORD_MASK;
    return value;
  }
  stream16() {
    const pointer = this.mem.read16Bank0(this.d);
    return this.mem.read16(((this.dbr << WORD_BITS) + pointer + this.y) & LONG_MASK);
  }

  // $F389-$F390: fetch the next opcode word, A = X = opcode, Z set at 0.
  fetch() {
    const opcode = this.stream16() & BYTE_MASK;
    this.y = (this.y + 1) & WORD_MASK;
    this.a = opcode;
    this.x = opcode;
    this.p = (this.p & ~(FLAG_ZERO | FLAG_NEGATIVE)) | (opcode === 0 ? FLAG_ZERO : 0);
    this.pc = OPCODE_LOOP;
  }

  run(maxOpcodes) {
    if (this.pc !== OPCODE_LOOP || this.p & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT))
      throw new VmFault('interpreter_context_required');
    let n = 0;
    while (n < maxOpcodes) {
      const handler = this.x <= BYTE_MASK ? handlers[this.x] : null;
      if (handler === null) throw new VmFault('opcode_unknown', this.x);
      n++;
      const exit = handler(this);
      if (exit === CONTINUE) {
        this.fetch();
        continue;
      }
      // Permitted native: bridge, native and resumption end at $F390 by themselves.
      if (exit === EXIT_NATIVE_CALL && this.natives !== null && this.natives.canCall()) {
        if (this.natives.call()) {
          this.opcodesRun = n;
          return EXIT_NATIVE_WAIT;
        }
        continue;
      }
      this.opcodesRun = n;
      return exit;
    }
    this.opcodesRun = n;
    return EXIT_BUDGET;
  }
}
