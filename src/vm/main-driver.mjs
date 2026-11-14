// Explicit execution from the return at 80:96C3 or original start 9688 to
// JSR 96C0, then through C1E3 back to 96C3. No clock, boot state or interrupt
// timing is inferred. The owner supplies one observation set for the main
// interval; NativeCalls consumes its own subsequent sets inside the round.
import { VmFault, boundaryFault } from './memory.mjs';
import { interruptEventsOf, appendRoundInterrupts } from './devices.mjs';
import { TaskAccessor } from './task-accessor.mjs';
import { TaskScheduler, STOP_RETURNED } from './scheduler.mjs';
import {
  runMainLoop,
  MainLoopContinuation,
  MAIN_LOOP_RESUME,
  MAIN_LOOP_ROUND,
  MAIN_LOOP_ROUTINES,
} from './main-loop.mjs';
import { WAIT_PAUSED } from '../task/native-wait-continuation.mjs';
import { finishInterruptObservations } from '../task/main-wait-interrupt.mjs';
import {
  MAIN_START,
  MAIN_START_ROUTINES,
  runMainStart,
  mainStartContinuation,
} from '../task/main-start.mjs';
import {
  FRONTEND_ROUTINES,
  runMainOwnerStart,
  mainOwnerContinuation,
  MAIN_OWNER_ENTRY,
  MAIN_OWNER_RESUME,
} from '../task/main-frontend.mjs';
import {
  MAIN_STARTUP_ENTRY,
  MAIN_STARTUP_ROUTINES,
  runMainStartup,
  MainStartupContinuation,
} from '../task/main-startup.mjs';
import { runMainReset, runMainSoftwareReset } from '../task/main-reset.mjs';
import { NativeCallContinuation } from '../task/native-call-continuation.mjs';
import { BYTE_BITS, WORD_BITS, BANK_SIZE } from '../constants/bits.mjs';
import {
  FLAG_ZERO,
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_DECIMAL,
} from '../constants/cpu-flags.mjs';
import { CODE_BANK, CODE_BANK_BASE } from '../constants/memory-map.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';

// Reset entries: power-on reset 00:E382, and the software reset that the BEQ
// at 80:9E2F selects (entry 9E3D) when the pad word in A is SOFT_RESET_BUTTONS
// (Select, Start, L and R; pad bits Book I PDF 148).
const RESET_ENTRY = 0xe382,
  SOFT_RESET_BRANCH = 0x9e2f,
  SOFT_RESET_ENTRY = 0x9e3d,
  SOFT_RESET_BUTTONS = 0x3030;
// $C1E3: scheduler round over all tasks (src/vm/scheduler.mjs).
const SCHEDULER_ROUND = 0xc1e3;

export const MAIN_OBSERVATION_TARGET = 0x800000 | MAIN_LOOP_RESUME;
export const MAIN_START_OBSERVATION_TARGET = 0x800000 | MAIN_START;
export const MAIN_ROUND_RETURN_WORD = MAIN_LOOP_ROUND + 2;
export const STOP_MAIN_OWNER_RETURN = 5; // original main RTS returned to A157; run() continues its menu owner
export const STOP_MAIN_WAIT = 6; // original main helper frame remains live; resume() continues it
const budgetRequired = (budget) => {
  if (budget !== Infinity && (!Number.isSafeInteger(budget) || budget < 0))
    throw new VmFault('main_round_budget_required');
};
export class MainLoopDriver {
  constructor(
    vm,
    {
      devices = vm.natives?.devices ?? null,
      routines = MAIN_LOOP_ROUTINES,
      startRoutines = MAIN_START_ROUTINES,
      frontendRoutines = FRONTEND_ROUTINES,
      startupRoutines = MAIN_STARTUP_ROUTINES,
      resetProgramBank = CODE_BANK,
    } = {},
  ) {
    if (![0, CODE_BANK].includes(resetProgramBank))
      throw new VmFault('main_reset_program_bank_required');
    this.vm = vm;
    this.devices = devices;
    this.routines = routines;
    this.startRoutines = startRoutines;
    this.resetProgramBank = resetProgramBank;
    this.frontendRoutines = frontendRoutines;
    this.ownsGame = false;
    this.startupRoutines = startupRoutines;
    // Reuse NativeCalls' accessor so its proved nested-round adapter saves and
    // restores the actual outer main caller, including its current IO cursor.
    this.accessor = vm.natives?.accessor ?? new TaskAccessor(vm);
    this.scheduler = new TaskScheduler(vm);
    this.pending = false;
    this.mainPending = null;
    this.roundsCompleted = 0;
  }
  run(budget = Infinity, { mainBudget = Infinity } = {}) {
    budgetRequired(budget);
    budgetRequired(mainBudget);
    const vm = this.vm,
      a = this.accessor;
    const branch = vm.pc === SOFT_RESET_BRANCH,
      software = branch || vm.pc === SOFT_RESET_ENTRY,
      reset = software || vm.pc === RESET_ENTRY;
    if (
      (this.pending && !reset) ||
      (this.mainPending &&
        (!reset || (branch && (!(vm.p & FLAG_ZERO) || vm.a !== SOFT_RESET_BUTTONS))))
    )
      throw new VmFault('main_round_active');
    if (
      ![
        MAIN_LOOP_RESUME,
        MAIN_START,
        MAIN_OWNER_ENTRY,
        MAIN_OWNER_RESUME,
        MAIN_STARTUP_ENTRY,
        RESET_ENTRY,
        SOFT_RESET_ENTRY,
        SOFT_RESET_BRANCH,
      ].includes(vm.pc) ||
      vm.d !== 0 ||
      (reset ? ![0, CODE_BANK].includes(vm.dbr) : vm.dbr !== CODE_BANK) ||
      (vm.e ?? 0) !== (reset && !software ? 1 : 0) ||
      (reset && !software
        ? (vm.p & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)) !== (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT) ||
          vm.s >>> BYTE_BITS !== 1 ||
          vm.x > BYTE_MASK ||
          vm.y > BYTE_MASK
        : vm.p & (FLAG_DECIMAL | FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)) ||
      (branch && (!(vm.p & FLAG_ZERO) || vm.a !== SOFT_RESET_BUTTONS))
    )
      throw new VmFault('main_driver_entry_required', MAIN_OBSERVATION_TARGET);
    if (vm.natives && (a !== vm.natives.accessor || this.devices !== vm.natives.devices))
      throw new VmFault('main_driver_owner_required');
    const target = ((reset && !software ? this.resetProgramBank : CODE_BANK) << WORD_BITS) | vm.pc,
      start = vm.pc === MAIN_START,
      startup = reset || vm.pc === MAIN_STARTUP_ENTRY,
      owner = reset || [MAIN_OWNER_ENTRY, MAIN_OWNER_RESUME, MAIN_STARTUP_ENTRY].includes(vm.pc),
      set = this.devices?.peek(target);
    if (!set) throw new VmFault('main_loop_observations_required', target);
    const interruptEvents = interruptEventsOf(set, target);
    this.devices.take(target);
    if (reset) {
      this.pending = false;
      this.mainPending = null;
      this.ownsGame = false;
    }
    const mainContext = { owned: true };
    let ownerReturned = false,
      paused = false;
    const e = {
      mode: 'record-observations',
      values: set.wait,
      waitIndex: 0,
      waitEvents: [],
      calls: [],
      inputMode: 'record-observations',
      inputs: set.input,
      inputIndex: 0,
      ...interruptEvents,
      round: vm.natives
        ? (entry) => {
            let returned = false,
              more;
            try {
              more = vm.natives.round(entry);
              returned = true;
            } finally {
              if (!returned) mainContext.owned = false;
            }
            appendRoundInterrupts(e, more, target);
            return more;
          }
        : null,
      // A pausable round for owners that hold their frame across pauses (96C0 in 9699).
      nestedRound: vm.natives ? (entry) => vm.natives.nestedRound(entry) : null,
    };
    a.load();
    a.entry = target;
    a.devices = this.devices;
    a.io = set.io;
    a.ioIndex = 0;
    a.ctx.e = vm.e ?? 0;
    try {
      if (mainBudget !== Infinity) {
        const continuation =
          start || owner
            ? new NativeCallContinuation(
                a,
                this.mainIntervalSequence(a, e, { reset, software, branch, startup, owner, start }),
              )
            : new MainLoopContinuation(a, {
                events: e,
                routines: this.routines,
                returnToOwner: this.ownsGame,
              });
        if (!start && !owner) a.resetAccessBudget(a.ctx.programBank * BANK_SIZE + a.ctx.pc);
        paused = continuation.run(mainBudget) === WAIT_PAUSED;
        if (paused)
          this.mainPending = { continuation, e, target, mainContext, io: a.io, ioIndex: a.ioIndex };
      } else {
        if (reset) {
          if (software) {
            if (branch) a.ctx.pc = SOFT_RESET_ENTRY;
            runMainSoftwareReset(a, e, this.startupRoutines);
          } else {
            a.ctx.programBank = this.resetProgramBank;
            runMainReset(a);
          }
        }
        if (startup) {
          a.resetAccessBudget(CODE_BANK_BASE | MAIN_STARTUP_ENTRY);
          runMainStartup(a, e, this.startupRoutines);
        }
        if (owner) {
          a.resetAccessBudget(CODE_BANK_BASE | a.ctx.pc);
          const returnS = a.ctx.s;
          runMainOwnerStart(a, e, this.frontendRoutines);
          this.ownerReturnS = returnS;
          this.ownsGame = true;
        }
        if (start || owner) {
          a.resetAccessBudget(CODE_BANK_BASE | MAIN_START);
          runMainStart(a, e, this.startRoutines);
        }
        a.resetAccessBudget(a.ctx.programBank * BANK_SIZE + a.ctx.pc);
        runMainLoop(a, e, this.routines, this.ownsGame);
      }
      if (!paused) ownerReturned = this.checkMainInterval(e);
    } catch (error) {
      throw boundaryFault(error, 'main_loop_boundary', target);
    } finally {
      // A failed nested round still owns vm's live context. Do not overwrite
      // that frontier with the outer accessor's interrupted main registers.
      try {
        if (mainContext.owned) {
          a.store();
          if (reset) vm.e = a.ctx.e;
        }
      } finally {
        a.io = null;
      }
    }
    if (paused) return STOP_MAIN_WAIT;
    return this.beginRound(budget, ownerReturned, mainBudget);
  }
  *mainIntervalSequence(a, e, { reset, software, branch, startup, owner, start }) {
    if (reset)
      yield () => {
        if (software) {
          if (branch) a.ctx.pc = SOFT_RESET_ENTRY;
          runMainSoftwareReset(a, e, this.startupRoutines);
        } else {
          a.ctx.programBank = this.resetProgramBank;
          runMainReset(a);
        }
        this.vm.e = a.ctx.e;
      };
    if (startup) {
      yield () => a.resetAccessBudget(CODE_BANK_BASE | MAIN_STARTUP_ENTRY);
      yield { continuation: new MainStartupContinuation(a, e, this.startupRoutines) };
    }
    if (owner) {
      let returnS;
      yield () => {
        a.resetAccessBudget(CODE_BANK_BASE | a.ctx.pc);
        returnS = a.ctx.s;
      };
      yield { continuation: mainOwnerContinuation(a, e, this.frontendRoutines) };
      yield () => {
        this.ownerReturnS = returnS;
        this.ownsGame = true;
      };
    }
    if (start || owner) {
      yield () => a.resetAccessBudget(CODE_BANK_BASE | MAIN_START);
      yield { continuation: mainStartContinuation(a, e, this.startRoutines) };
    }
    yield () => a.resetAccessBudget(a.ctx.programBank * BANK_SIZE + a.ctx.pc);
    yield {
      continuation: new MainLoopContinuation(a, {
        events: e,
        routines: this.routines,
        returnToOwner: this.ownsGame,
      }),
    };
    return a.ctx.pc;
  }
  checkMainInterval(e) {
    const a = this.accessor;
    let ownerReturned = false;
    if (this.ownsGame && a.ctx.pc !== MAIN_LOOP_ROUND) {
      if (
        a.ctx.pc !== MAIN_OWNER_RESUME ||
        a.ctx.programBank !== CODE_BANK ||
        a.ctx.s !== this.ownerReturnS
      )
        throw new VmFault('main_owner_return_context', CODE_BANK_BASE | a.ctx.pc, {
          s: a.ctx.s,
          expectedS: this.ownerReturnS,
        });
      ownerReturned = true;
    }
    if (e.interrupts !== undefined) finishInterruptObservations(e);
    if (e.waitIndex !== (e.values?.length ?? 0))
      throw new VmFault('main_loop_wait_observation_unused');
    if (e.inputIndex !== (e.inputs?.length ?? 0))
      throw new VmFault('main_loop_input_observation_unused');
    if (a.ioIndex !== a.io.length) throw new VmFault('main_loop_io_observation_unused');
    return ownerReturned;
  }
  beginRound(budget, ownerReturned, mainBudget = Infinity) {
    const vm = this.vm;
    if (ownerReturned) {
      this.ownsGame = false;
      return STOP_MAIN_OWNER_RETURN;
    }
    // The pinned original JSR $C1E3 at 96C0 pushes WORD 96C2, without a bank
    // byte. C1E3 owns that frame across all budget/Native/frontier exits.
    this.returnS = vm.s;
    vm.push16(MAIN_ROUND_RETURN_WORD);
    this.pending = true;
    return this.finish(
      this.withNativeBudget(mainBudget, () => this.scheduler.call(SCHEDULER_ROUND, budget)),
    );
  }
  // The main budget also bounds a resumable special native inside the round.
  // Its pause keeps the bridge frame; nested rounds stay synchronous.
  withNativeBudget(mainBudget, run) {
    const natives = this.vm.natives;
    if (!natives) return run();
    natives.workBudget = mainBudget;
    try {
      return run();
    } finally {
      natives.workBudget = Infinity;
    }
  }
  resume(budget = Infinity, { mainBudget = Infinity } = {}) {
    budgetRequired(budget);
    budgetRequired(mainBudget);
    if (this.mainPending) return this.resumeMain(budget, mainBudget);
    if (!this.pending) throw new VmFault('main_round_not_active');
    return this.finish(this.withNativeBudget(mainBudget, () => this.scheduler.resume(budget)));
  }
  resumeMain(budget, mainBudget) {
    const state = this.mainPending,
      a = this.accessor,
      vm = this.vm;
    // Do not reload the accessor: it retains the actual native PBR, frame,
    // baseline, saved flags and device cursors. A foreign VM owner is rejected.
    if (
      a.io !== null ||
      a.ioIndex !== state.ioIndex ||
      (vm.natives && (a !== vm.natives.accessor || this.devices !== vm.natives.devices)) ||
      ['a', 'x', 'y', 's', 'd', 'pc'].some((key) => vm[key] !== a.ctx[key]) ||
      vm.dbr !== a.ctx.bank ||
      vm.p !== a.ctx.status ||
      (vm.e ?? 0) !== a.ctx.e
    )
      throw new VmFault('main_driver_owner_required');
    a.io = state.io;
    a.ioIndex = state.ioIndex;
    let paused,
      ownerReturned = false;
    try {
      paused =
        state.continuation.run(mainBudget === Infinity ? Number.MAX_SAFE_INTEGER : mainBudget) ===
        WAIT_PAUSED;
      if (paused) state.ioIndex = a.ioIndex;
      else {
        ownerReturned = this.checkMainInterval(state.e);
        this.mainPending = null;
      }
    } catch (error) {
      // Failed callees retain their frontier and cannot be replayed by resume.
      state.continuation.failed = true;
      throw boundaryFault(error, 'main_loop_boundary', state.target);
    } finally {
      state.ioIndex = a.ioIndex;
      try {
        if (state.mainContext.owned) a.store();
      } finally {
        a.io = null;
      }
    }
    return paused ? STOP_MAIN_WAIT : this.beginRound(budget, ownerReturned, mainBudget);
  }
  finish(stop) {
    if (stop === STOP_RETURNED) {
      this.pending = false;
      const vm = this.vm;
      if (
        vm.pc !== MAIN_LOOP_RESUME ||
        vm.s !== this.returnS ||
        vm.d !== 0 ||
        vm.dbr !== CODE_BANK ||
        vm.p & (FLAG_DECIMAL | FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
      )
        throw new VmFault('main_round_return_context', CODE_BANK_BASE | vm.pc, {
          s: vm.s,
          expectedS: this.returnS,
          d: vm.d,
          bank: vm.dbr,
          status: vm.p,
        });
      this.roundsCompleted++;
    }
    return stop;
  }
}
