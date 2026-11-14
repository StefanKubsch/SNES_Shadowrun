// Lean adapter: provides the accessor interface of the proven modules
// (proof/task/plan.mjs, prepareTaskPlan) directly over VmMemory, without an
// access log, labels or budgets. This way the proven native
// implementations run unchanged in the VM core. Interim solution: frequently used
// natives can later follow as allocation-free VM functions of their own.
import { VmFault } from './memory.mjs';
import { isIoAddress, isArithmeticRegister } from './devices.mjs';
import { OPCODE_LOOP } from './layout.mjs';
import { FLAG_ZERO, FLAG_NEGATIVE } from '../constants/cpu-flags.mjs';
import {
  LONG_MASK,
  BYTE_BITS,
  BYTE_MASK,
  BANK_WRAP,
  WORD_MASK,
  LONG_WRAP,
  BANK_SIZE,
} from '../constants/bits.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';

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

export class TaskAccessor {
  constructor(vm) {
    this.vm = vm;
    this.mem = vm.mem;
    this.entry = 0;
    this.accesses = 0;
    // Hardware: device reads from the observation set of the running call
    // (src/vm/devices.mjs), writes to devices.write.
    this.devices = null;
    this.io = null;
    this.ioIndex = 0;
    // Optional (test or oracle): all hardware accesses with the original PC.
    this.trace = null;
    // Test: read values of the arithmetic unit also from the observations (fixtures with synthetic values).
    this.observeArithmetic = false;
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
    // A read at a full bus address, independent of the data bank: the hardware
    // interface of lifted code (src/system/hardware-port.mjs) reads here with
    // anyBank set. Every bank with a system area reaches the same register
    // (Book I 21.2, src/constants/memory-map.mjs), so its reads (00:2140) match a
    // recording of the original's (80:2140) by register; register-level reads keep
    // the recorded address, which also attests their data bank.
    this.busRead = (address, width, pc = 0, anyBank = false) => {
      if (!isIoAddress(address))
        return width === 1 ? mem.read8(address) : this.readWord(address, LONG_WRAP);
      let value;
      if (isArithmeticRegister(address, false) && !this.observeArithmetic)
        value = width === 1 ? mem.read8(address) : mem.read16(address);
      else {
        const observation = this.io === null ? undefined : this.io[this.ioIndex];
        // Live devices (src/vm/frame-events.mjs) answer only after all recorded reads.
        if (observation === undefined && this.io !== null && this.devices?.read !== undefined)
          value = this.devices.read(address, width, pc);
        else if (
          observation !== undefined &&
          observation.pc === pc &&
          (observation.address === address ||
            (anyBank &&
              isIoAddress(observation.address) &&
              (observation.address & WORD_MASK) === (address & WORD_MASK))) &&
          observation.width === width
        ) {
          this.ioIndex++;
          value = observation.value;
        }
        if (value === undefined)
          throw new VmFault('device_observation_required', address, {
            pc,
            width,
            observationIndex: this.ioIndex,
          });
      }
      if (this.trace !== null) this.trace.push({ kind: 'read', pc, address, width, value });
      return value;
    };
    this.absoluteWrite = (offset, value, width, pc) =>
      this.busWrite((ctx.bank * BANK_SIZE + offset) & LONG_MASK, value, width, pc);
    // A write at a full bus address, independent of the data bank: the video
    // and sound interfaces (src/video/video-port.mjs) reach the devices here.
    // anyBank marks the hardware port of lifted code, as for busRead.
    // eslint-disable-next-line no-unused-vars
    this.busWrite = (address, value, width, pc = 0, anyBank = false) => {
      if (!isIoAddress(address)) {
        if (width === 1) mem.write8(address, value & BYTE_MASK);
        else this.writeWord(address, value, LONG_WRAP);
        return;
      }
      if (this.trace !== null) this.trace.push({ kind: 'write', pc, address, width, value });
      if (isArithmeticRegister(address, true)) {
        if (width === 1) mem.write8(address, value & BYTE_MASK);
        else mem.write16(address, value);
        return;
      }
      if (this.devices === null) throw new VmFault('device_write_unbound', address, { pc, width });
      this.devices.write(pc, address, value, width);
    };
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
