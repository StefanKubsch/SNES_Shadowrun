// The CPU accessor of the register forms and frozen tests (moved from src/vm on
// 2026-11-27): a register context, stack and access budget over VmMemory. The game
// itself runs on DeviceAccess (src/vm/device-access.mjs) without a CPU context.
import { VmFault } from '../../src/vm/memory.mjs';
import { DeviceAccess } from '../../src/vm/device-access.mjs';
import { OPCODE_LOOP } from '../../src/vm/layout.mjs';
import { FLAG_ZERO, FLAG_NEGATIVE } from '../../src/constants/cpu-flags.mjs';
import {
  LONG_MASK,
  BYTE_BITS,
  BYTE_MASK,
  BANK_WRAP,
  WORD_MASK,
  LONG_WRAP,
  BANK_SIZE,
} from '../../src/constants/bits.mjs';
import { CODE_BANK } from '../../src/constants/memory-map.mjs';

// Upper limit of memory accesses per native call. Real natives stay far
// below it; cyclic data thus lead to an error instead of a hang.
export const NATIVE_ACCESS_LIMIT = 4_000_000;

// Register transfer between the VM and an accessor context (prepareTaskPlan
// format: bank = DBR, status = P). The program counter is copied separately.
export function vmToContext(vm, ctx) {
  ctx.a = vm.a;
  ctx.x = vm.x;
  ctx.y = vm.y;
  ctx.s = vm.s;
  ctx.d = vm.d;
  ctx.bank = vm.dbr;
  ctx.status = vm.p;
  ctx.pc = vm.pc;
}
export function contextToVm(ctx, vm) {
  vm.a = ctx.a;
  vm.x = ctx.x;
  vm.y = ctx.y;
  vm.s = ctx.s;
  vm.d = ctx.d;
  vm.dbr = ctx.bank;
  vm.p = ctx.status;
}

export class TaskAccessor extends DeviceAccess {
  constructor(vm) {
    super(vm);
    this.entry = 0;
    this.accesses = 0;
    // Reused register object in the format of prepareTaskPlan.
    this.ctx = {
      e: 0,
      programBank: CODE_BANK,
      pc: 0,
      a: 0,
      x: 0,
      y: 0,
      s: 0,
      d: 0,
      bank: 0,
      status: 0,
    };
    const mem = this.mem,
      ctx = this.ctx;
    // The services' data bank (src/system/data-bank.mjs) is the context's.
    Object.defineProperty(this, 'dataBank', {
      get: () => ctx.bank,
      set: (bank) => {
        ctx.bank = bank;
      },
      configurable: true,
    });
    // Create the methods once as bound arrow functions; the modules call them detached.
    const count = () => {
      if (++this.accesses > NATIVE_ACCESS_LIMIT)
        throw new VmFault('native_access_limit', this.entry);
    };
    this.read = (address) => {
      count();
      return mem.read8(address & LONG_MASK);
    };
    this.write = (address, value) => {
      count();
      mem.write8(address & LONG_MASK, value);
    };
    this.readWord = (address, wrap = LONG_WRAP) => {
      const mask = wrap === BANK_WRAP ? WORD_MASK : LONG_MASK;
      count();
      return mem.read8(address & mask) | (mem.read8((address + 1) & mask) << BYTE_BITS);
    };
    this.writeWord = (address, value, wrap = LONG_WRAP) => {
      const mask = wrap === BANK_WRAP ? WORD_MASK : LONG_MASK;
      count();
      mem.write8(address & mask, value & BYTE_MASK);
      mem.write8((address + 1) & mask, value >>> BYTE_BITS);
    };
    this.stackWord = (offset = 1) => this.readWord((ctx.s + offset) & WORD_MASK, BANK_WRAP);
    this.pullWord = () => {
      const value = this.stackWord(1);
      ctx.s = (ctx.s + 2) & WORD_MASK;
      return value;
    };
    this.pushWord = (value) => {
      mem.write8(ctx.s, value >>> BYTE_BITS);
      ctx.s = (ctx.s - 1) & WORD_MASK;
      mem.write8(ctx.s, value & BYTE_MASK);
      ctx.s = (ctx.s - 1) & WORD_MASK;
    };
    this.streamWord = () =>
      this.readWord(
        (ctx.bank * BANK_SIZE + this.readWord(ctx.d, BANK_WRAP) + ctx.y) & LONG_MASK,
        LONG_WRAP,
      );
    this.fetch = () => {
      const opcodeWord = this.streamWord();
      ctx.y = (ctx.y + 1) & WORD_MASK;
      ctx.a = ctx.x = opcodeWord & BYTE_MASK;
      ctx.status = (ctx.status & ~(FLAG_ZERO | FLAG_NEGATIVE)) | (ctx.a === 0 ? FLAG_ZERO : 0);
      ctx.pc = OPCODE_LOOP;
      return { opcodeWord, frontier: '80:F390' };
    };
    this.tick = () => {};
    // Absolute accesses: WRAM/ROM and the arithmetic unit via VmMemory, other
    // hardware registers via the observations (never computed or invented).
    this.absoluteRead = (offset, width, pc) =>
      this.busRead((ctx.bank * BANK_SIZE + offset) & LONG_MASK, width, pc);
    this.absoluteWrite = (offset, value, width, pc) =>
      this.busWrite((ctx.bank * BANK_SIZE + offset) & LONG_MASK, value, width, pc);
  }

  // A new source-bounded outer composition shares context, memory and device
  // cursors, but owns its own finite host access budget.
  resetAccessBudget(entry = this.entry) {
    this.accesses = 0;
    this.entry = entry;
  }

  load() {
    const vm = this.vm,
      ctx = this.ctx;
    this.accesses = 0;
    ctx.programBank = CODE_BANK;
    vmToContext(vm, ctx);
  }
  store() {
    const vm = this.vm,
      ctx = this.ctx;
    if (
      ![ctx.a, ctx.x, ctx.y, ctx.s, ctx.d].every(
        (v) => Number.isInteger(v) && v >= 0 && v <= WORD_MASK,
      )
    )
      throw new VmFault('native_context_invalid');
    contextToVm(ctx, vm);
    vm.pc = ctx.pc;
  }
}
