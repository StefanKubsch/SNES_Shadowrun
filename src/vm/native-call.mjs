// Native call from the interpreter: bridge $F4F6, jump via DP $A2 ($F52F),
// RTS of the native to $F509 and resumption up to the next opcode.
// Bridge and resumption are reproduced natively (semantics from
// proof/task/native-bridge.mjs and native-resume.mjs); the natives themselves are
// the proven modules, connected through TaskAccessor.
import { VmFault, boundaryFault } from './memory.mjs';
import { TaskAccessor, vmToContext, contextToVm } from './task-accessor.mjs';
import { interruptEventsOf, appendRoundInterrupts } from './devices.mjs';
import { nz, plb, bank80 } from './cpu.mjs';
import { SPECIAL_NATIVES, SPECIAL_NATIVE_CONTINUATIONS } from './special-natives.mjs';
import { WAIT_PAUSED, WAIT_RETURNED } from '../task/native-wait-continuation.mjs';
import { finishInterruptObservations } from '../task/main-wait-interrupt.mjs';
import {
  NATIVE_DISPATCH,
  NATIVE_POINTERS,
  NATIVE_RESUME,
  NATIVE_RETURN_BYTES,
  OUTER_STACK,
  TASK_CURSOR,
  TASK_FRAME,
  FRAME_BANK_WORD,
  FRAME_CALL_ID,
  FRAME_OPERAND_STACK,
  FRAME_PC,
} from './layout.mjs';
// Cyclic import (scheduler.mjs uses the bridge); both sides use the bindings only at run time.
import { TaskScheduler, STOP_RETURNED, STOP_BUDGET, STOP_NATIVE_WAIT } from './scheduler.mjs';
import { FLAG_INDEX_8BIT, FLAG_MEMORY_8BIT } from '../constants/cpu-flags.mjs';
import { WORD_BITS, WORD_MASK, BYTE_MASK } from '../constants/bits.mjs';
import { CODE_BANK_BASE, CODE_BANK } from '../constants/memory-map.mjs';

// $F4F6: switch to the outer stack, DBR=$80, pointer to DP $A2, JSR $F52F
// (pushes the return address $F508).
const NATIVE_POINTER_DP = 0xa2,
  NATIVE_BRIDGE_RETURN = 0xf508;
export function nativeBridge(vm) {
  vm.s = vm.a;
  vm.a = nz(vm, 0);
  vm.d = nz(vm, 0);
  bank80(vm);
  const pointer = vm.mem.read16(NATIVE_POINTERS + vm.x);
  vm.a = nz(vm, pointer);
  vm.mem.write16Bank0(NATIVE_POINTER_DP, pointer);
  vm.push16(NATIVE_BRIDGE_RETURN);
  vm.pc = NATIVE_DISPATCH;
  return CODE_BANK_BASE | vm.mem.read16Bank0(NATIVE_POINTER_DP); // $F52F reads the pointer afresh
}

// $F509 (native) and $F495 (script, after the child task): fetch the task frame from
// DBR:0250/0252, restore bank and stack, store the result, next opcode.
export function nativeResume(vm, returnBytes = NATIVE_RETURN_BYTES) {
  const mem = vm.mem;
  vm.x = nz(vm, mem.read16((vm.dbr << WORD_BITS) + TASK_CURSOR));
  vm.a = nz(vm, mem.read16((vm.dbr << WORD_BITS) + TASK_FRAME + vm.x));
  vm.d = nz(vm, vm.a);
  vm.push16(mem.read16Bank0((vm.d + FRAME_BANK_WORD) & WORD_MASK));
  plb(vm);
  plb(vm);
  vm.a = nz(vm, vm.s);
  mem.write16((vm.dbr << WORD_BITS) + OUTER_STACK, vm.a);
  vm.a = nz(vm, mem.read16Bank0((vm.d + FRAME_OPERAND_STACK) & WORD_MASK));
  vm.s = vm.a;
  vm.x = nz(vm, mem.read16Bank0((vm.d + FRAME_CALL_ID) & WORD_MASK));
  vm.a = nz(vm, mem.read16(returnBytes + vm.x) & BYTE_MASK);
  if (vm.a !== 0) {
    vm.a = nz(vm, mem.read16(vm.dbr << WORD_BITS));
    vm.push16(vm.a);
  }
  vm.y = nz(vm, mem.read16Bank0((vm.d + FRAME_PC) & WORD_MASK));
  vm.fetch();
}

const nativeFault = (error, target) => boundaryFault(error, 'native_boundary', target);
const vmRegisters = (vm) => ({
  a: vm.a,
  x: vm.x,
  y: vm.y,
  s: vm.s,
  d: vm.d,
  dbr: vm.dbr,
  p: vm.p,
  pc: vm.pc,
});

// Binds permitted native targets to an interpreter. Special natives
// (src/vm/special-natives.mjs) run only with an observation set from devices,
// oracle-checked natives (proof/vm/oracle-natives.mjs) only on their implemented paths
// and only when oracle passes them explicitly.
export class NativeCalls {
  constructor(vm, { admitted, implementation, devices = null, oracle = null, rounds = null }) {
    this.vm = vm;
    this.admitted = new Set(admitted);
    this.implementation = implementation; // target -> run(accessor, outerReturn)
    this.devices = devices;
    this.oracle = oracle; // target -> {supports(memory), run(accessor, outerReturn)}
    // Nested scheduler round: rounds(entry) runs it on the VM and optionally returns
    // further observations {io, wait, input} for the rest of the calling native (oracle).
    this.customRounds = rounds !== null;
    this.rounds =
      rounds ??
      ((entry) => {
        const stop = new TaskScheduler(this.vm).call(entry);
        if (stop !== STOP_RETURNED)
          throw new VmFault('nested_round_stop', CODE_BANK_BASE | entry, {
            stop,
            pc: this.vm.pc,
            exitId: this.vm.exitId,
          });
        return null;
      });
    this.accessor = new TaskAccessor(vm);
    this.accessor.devices = devices;
    this.calls = 0;
    // Finite work budget: special natives with a continuation pause at their
    // own limits. Infinity keeps the synchronous path unchanged.
    this.workBudget = Infinity;
    this.pending = null;
  }
  // Is the native of the current ID (state at $F4F6) permitted and implemented?
  canCall() {
    const target = CODE_BANK_BASE | this.vm.mem.read16(NATIVE_POINTERS + this.vm.x);
    if (this.admitted.has(target)) return typeof this.implementation(target) === 'function';
    if (this.oracle !== null && this.oracle.has(target)) {
      return this.oracle.get(target).supports(this.vm.mem);
    }
    return (
      this.devices !== null && SPECIAL_NATIVES.has(target) && this.devices.peek(target) !== null
    );
  }
  // Runs bridge, native and resumption; afterwards the VM is at $F390.
  // true: the native paused with a live frame; continuePending() continues it.
  call() {
    const vm = this.vm,
      target = nativeBridge(vm),
      accessor = this.accessor;
    accessor.load();
    accessor.entry = target;
    accessor.ctx.pc = target & WORD_MASK;
    const create =
      this.workBudget === Infinity || this.admitted.has(target) || this.oracle?.has(target)
        ? undefined
        : SPECIAL_NATIVE_CONTINUATIONS.get(target);
    if (create) {
      this.pending = this.beginSpecial(target, create);
      return this.continuePending();
    }
    try {
      if (this.admitted.has(target)) this.implementation(target)(accessor, false);
      else if (this.oracle !== null && this.oracle.has(target)) this.callOracle(target);
      else this.callSpecial(target);
    } catch (error) {
      throw nativeFault(error, target);
    }
    this.finishCall(target);
    return false;
  }
  finishCall(target) {
    const vm = this.vm;
    this.accessor.store();
    if (
      vm.pc !== NATIVE_RESUME ||
      vm.d !== 0 ||
      vm.dbr !== CODE_BANK ||
      vm.p & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
    )
      throw new VmFault('native_return_context', target);
    nativeResume(vm);
    this.calls++;
  }
  // The observation set is taken exactly once; the device cursor stays with the native across pauses.
  beginSpecial(target, create) {
    const accessor = this.accessor,
      set = this.devices.take(target),
      interruptEvents = interruptEventsOf(set, target);
    let made;
    try {
      // A nested round runs here as its own continuation (nestedRound), otherwise synchronously (round).
      made = create(accessor, {
        waitMode: 'record-observations',
        waitObservations: set.wait,
        inputMode: 'record-observations',
        inputObservations: set.input,
        interruptEvents,
        round: (entry) => this.round(entry),
        nestedRound: this.customRounds ? null : (entry) => this.nestedRound(entry),
      });
    } catch (error) {
      throw nativeFault(error, target);
    }
    return {
      target,
      continuation: made.continuation,
      io: set.io,
      ioIndex: 0,
      finish: () => {
        made.finish();
        if (interruptEvents) finishInterruptObservations(interruptEvents);
        if (accessor.ioIndex !== accessor.io.length)
          throw new VmFault('device_observation_unused', target, {
            observationIndex: accessor.ioIndex,
          });
      },
    };
  }
  // Continues the paused native with the current work budget. Only after its
  // real return do the store, $F509 and the next opcode follow.
  continuePending() {
    const p = this.pending,
      vm = this.vm,
      accessor = this.accessor;
    // During a paused nested round the VM stands in that round.
    if ((vm.pc !== NATIVE_DISPATCH && !p.nested) || vm.natives !== this)
      throw new VmFault('native_pending_owner_required', p.target);
    accessor.io = p.io;
    accessor.ioIndex = p.ioIndex;
    let paused;
    try {
      paused =
        p.continuation.run(
          this.workBudget === Infinity ? Number.MAX_SAFE_INTEGER : this.workBudget,
        ) === WAIT_PAUSED;
      if (!paused) p.finish();
    } catch (error) {
      throw nativeFault(error, p.target);
    } finally {
      p.ioIndex = accessor.ioIndex;
      accessor.io = null;
    }
    if (paused) return true;
    this.pending = null;
    this.finishCall(p.target);
    return false;
  }
  // Oracle-checked native (transition for partial paths, without devices).
  callOracle(target) {
    this.oracle.get(target).run(this.accessor, false);
  }
  // Scheduler round from a running native (dialog: JSR $C1CA at $91D4). The JSR frame is already on
  // the stack. Registers go from the accessor to the VM and back after the return. The round can call
  // natives itself; the accessor and device set of the calling native are saved for this. Additional
  // observations from rounds() are appended to the set of the calling native (device reads here; the
  // result passes waits and input on to the native).
  round(entry) {
    const vm = this.vm,
      accessor = this.accessor,
      ctx = accessor.ctx;
    const saved = {
      entry: accessor.entry,
      accesses: accessor.accesses,
      io: accessor.io,
      ioIndex: accessor.ioIndex,
      programBank: ctx.programBank,
    };
    const outerVm = vmRegisters(vm);
    contextToVm(ctx, vm);
    vm.pc = entry & WORD_MASK;
    // A nested round stays synchronous: its caller has no pause frame.
    // A paused outer native does not belong to the round (its slot is set aside).
    const budget = this.workBudget,
      outer = this.pending;
    this.workBudget = Infinity;
    this.pending = null;
    let more;
    try {
      more = this.rounds(entry & WORD_MASK);
    } finally {
      this.workBudget = budget;
      this.pending = outer;
    }
    accessor.entry = saved.entry;
    accessor.accesses = saved.accesses;
    accessor.ioIndex = saved.ioIndex;
    accessor.io = more?.io?.length ? Object.freeze([...(saved.io ?? []), ...more.io]) : saved.io;
    ctx.programBank = saved.programBank;
    vmToContext(vm, ctx);
    // Restore the VM of the calling native (at $F52F); its state lives in the accessor.
    Object.assign(vm, outerVm);
    return {
      wait: more?.wait ?? [],
      input: more?.input ?? [],
      interrupts: more?.interrupts,
      dmaTransfers: more?.dmaTransfers,
    };
  }
  // The same round as a pausable continuation (see NestedRoundContinuation).
  nestedRound(entry) {
    return new NestedRoundContinuation(this, entry);
  }
  callSpecial(target) {
    const accessor = this.accessor,
      set = this.devices.take(target);
    accessor.io = set.io;
    accessor.ioIndex = 0;
    try {
      const interruptEvents = interruptEventsOf(set, target);
      SPECIAL_NATIVES.get(target)(accessor, {
        waitMode: 'record-observations',
        waitObservations: set.wait,
        inputMode: 'record-observations',
        inputObservations: set.input,
        interruptEvents,
        round: (entry) => {
          const more = this.round(entry);
          appendRoundInterrupts(interruptEvents ?? {}, more, target);
          return more;
        },
      });
      if (interruptEvents) finishInterruptObservations(interruptEvents);
      if (accessor.ioIndex !== accessor.io.length)
        throw new VmFault('device_observation_unused', target, {
          observationIndex: accessor.ioIndex,
        });
    } finally {
      accessor.io = null;
    }
  }
}

// JSR $C1CA from a resumable native as a pausable scheduler round: the same
// VM, its own TaskScheduler, the pending slot of the outer native saved.
// Registers and accessor state as in NativeCalls.round; the frame of the round
// (pending native, accessor counter) is kept between the work pieces.
class NestedRoundContinuation {
  constructor(calls, entry) {
    this.calls = calls;
    this.entry = entry & WORD_MASK;
    this.scheduler = new TaskScheduler(calls.vm);
    this.work = 0;
    this.started = false;
    this.inner = null;
    this.result = undefined;
  }
  run(budget) {
    const calls = this.calls,
      vm = calls.vm,
      accessor = calls.accessor,
      ctx = accessor.ctx,
      outer = calls.pending;
    const saved = {
      entry: accessor.entry,
      accesses: accessor.accesses,
      io: accessor.io,
      ioIndex: accessor.ioIndex,
    };
    let stop;
    if (!this.started) {
      // The VM of the paused outer native (at $F52F) returns after the round.
      this.outerVm = vmRegisters(vm);
      this.programBank = ctx.programBank;
      contextToVm(ctx, vm);
      this.inner = { pending: null, entry: saved.entry, accesses: saved.accesses };
    }
    calls.pending = this.inner.pending;
    accessor.entry = this.inner.entry;
    accessor.accesses = this.inner.accesses;
    // The VM is shared: while the round pauses, the driver loads the main loop's
    // registers into it. The round resumes with its own registers (without them it
    // started a second scheduler round at $C1E3 in the same frame).
    if (this.started) Object.assign(vm, this.inner.vm);
    try {
      stop = this.started ? this.scheduler.resume(budget) : this.scheduler.call(this.entry, budget);
      this.started = true;
    } finally {
      this.inner = {
        pending: calls.pending,
        entry: accessor.entry,
        accesses: accessor.accesses,
        vm: vmRegisters(vm),
      };
      calls.pending = outer;
      accessor.entry = saved.entry;
      accessor.accesses = saved.accesses;
      accessor.io = saved.io;
      accessor.ioIndex = saved.ioIndex;
    }
    this.work += Math.max(1, this.scheduler.opcodesRun);
    if (stop === STOP_BUDGET || stop === STOP_NATIVE_WAIT) {
      if (outer) outer.nested = true;
      return WAIT_PAUSED;
    }
    if (stop !== STOP_RETURNED)
      throw new VmFault('nested_round_stop', CODE_BANK_BASE | this.entry, {
        stop,
        pc: vm.pc,
        exitId: vm.exitId,
      });
    if (outer) outer.nested = false;
    ctx.programBank = this.programBank;
    vmToContext(vm, ctx);
    Object.assign(vm, this.outerVm);
    this.result = { wait: [], input: [] };
    return WAIT_RETURNED;
  }
}
