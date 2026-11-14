// Main loop $80:96AB–$96F2 outside the scheduler round: one pass from the return of the round
// ($96C3, after JSR $C1E3 at $96C0) to the next JSR $C1E3. Its own instructions are plain code:
// the calls with their frames, the carry tests after 80:8000 and 80:CC4B and the two exit
// words; the called routines come from a table (target -> run(h, events), ends with rts/rtl).
// Missing routines remain named limits. The RTS at $96EC/$96F2 are executed only for the explicitly
// bound game or demo owner; without this owner they remain a limit.
import { taskStop } from '../task/plan.mjs';
import { dialogAccess } from '../task/native-dialog-support.mjs';
import {
  runCameraFollow,
  runColourEffect,
  runFormationStep,
  runTileBuffers,
  runHitShake,
  runNoticeTimeouts,
  runPaletteCycles,
  runTimeLimit,
  runGloveAction,
  runGloveMove,
  runPlayerZones,
  runObjectMotion,
  runSpriteList,
  runFrameWait,
  runPadPresses,
} from '../game/main-upkeep.mjs';
import { processSceneRequest } from '../game/scene-request.mjs';
import {
  NativeWaitContinuation,
  WAIT_PAUSED,
  WAIT_RETURNED,
} from '../task/native-wait-continuation.mjs';
import { InterruptStepContinuation, lagFree } from '../task/main-wait-interrupt.mjs';
import { NATIVE_CALL_CONTINUATIONS } from '../task/native-call-continuation.mjs';
import { BYTE_BITS, WORD_BITS, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import {
  FLAG_DECIMAL,
  FLAG_INDEX_8BIT,
  FLAG_MEMORY_8BIT,
  FLAG_CARRY,
  FLAG_NEGATIVE,
  FLAG_ZERO,
} from '../constants/cpu-flags.mjs';
import { MAIN_LOOP_EXIT, MAIN_LOOP_RELOAD } from '../task/wram.mjs';
import { MAIN_UPKEEP_ROUTINES } from '../task/main-loop-upkeep.mjs';
import { CODE_BANK } from '../constants/memory-map.mjs';

export const MAIN_LOOP_RESUME = 0x96c3; // return from the round
export const MAIN_LOOP_ROUND = 0x96c0; // JSR $C1E3
const MAIN_LOOP_START = 0x96ab; // first pass after 9688
// Original call sites in 80:96AB-96E4, named by the routine they call.
const CALL_PC = Object.freeze({
  GATE_8000: MAIN_LOOP_RESUME,
  CC4B: 0x96c8,
  DE94: 0x96cd,
  AFC4: 0x96d0,
  BAD5: 0x96d3,
  CAMERA_8C2E: 0x96d6,
  CAMERA_8A91: 0x96da,
  SPRITES_B8DE: 0x96de,
  FF14: 0x96e1,
  TIMER_E270: 0x96e4,
  WAIT_B0A1: MAIN_LOOP_START,
  ANIMATION_8877: 0x96af,
  PALETTE_8076: 0x96b3,
  INPUT_9E1A: 0x96b7,
  GLOVE_BE6D: 0x96ba,
  BF3B: 0x96bd,
});
const MAIN_LOOP_EXIT_PC = 0x96ec,
  MAIN_LOOP_RELOAD_PC = 0x96f2;
// The return word points at the last operand byte of JSR/JSL, before RTS/RTL adds one.
const JSR_RETURN_OFFSET = 2,
  JSL_RETURN_OFFSET = 3;

// Bound subroutines of the main loop (grows with the deliveries).
export const MAIN_LOOP_ROUTINES = new Map([
  [0x808000, runPlayerZones], // zones around the player figure: append a task or change the scene
  [0x80cc4b, processSceneRequest],
  [0x80de94, runHitShake],
  [0x80afc4, runObjectMotion],
  [0x80bad5, runFormationStep],
  [0x818c2e, runCameraFollow],
  [0x818a91, runTileBuffers],
  [0x80b8de, runSpriteList],
  [0x80ff14, runNoticeTimeouts],
  [0x80e270, runTimeLimit],
  [0x81b0a1, MAIN_UPKEEP_ROUTINES.get(0x81b0a1)],
  [0x818877, runColourEffect],
  [0x818076, runPaletteCycles],
  [0x809e1a, MAIN_UPKEEP_ROUTINES.get(0x809e1a)],
  [0x80be6d, runGloveMove],
  [0x80bf3b, runGloveAction],
]);

// The word wait 81:B0A1 and the pad word 80:9E1A: tables shared with the menus bind
// their register-level routines, which the menus keep; the main loop runs its lifted
// entries in their place (src/game/main-upkeep.mjs; register-level again without
// lag-free frames). Any other binding, such as a proof reference, runs as bound.
// Exported so that a proof can bind the register-level routines here (tools/lift-compare.mjs).
export const MAIN_LOOP_LIFTED_TOP = new Map([
  [0x81b0a1, runFrameWait],
  [0x809e1a, runPadPresses],
]);
function mainLoopRun(routines, target) {
  const run = routines.get(target);
  return MAIN_LOOP_LIFTED_TOP.has(target) && run === MAIN_UPKEEP_ROUTINES.get(target)
    ? MAIN_LOOP_LIFTED_TOP.get(target)
    : run;
}

// Runs from $96C3 or the first $96AB up to before JSR $96C0. Loaded TaskAccessor.
export function runMainLoop(
  a,
  events = null,
  routines = MAIN_LOOP_ROUTINES,
  returnToOwner = false,
) {
  const sequence = mainLoopSequence(a, events, routines, returnToOwner);
  for (let next = sequence.next(); ; next = sequence.next()) {
    if (next.done) return next.value;
    const call = next.value;
    call.run(call.h, call.events);
  }
}

// The same caller equations serve both synchronous observation replay and
// finite continuation. A yielded callee already owns its original stack frame.
function* mainLoopSequence(a, events, routines, returnToOwner) {
  const { ctx } = a,
    { wram } = a.mem;
  // The bound movement routines compute in binary. Reject invalid inputs before any WRAM effect.
  if (
    ctx.programBank !== CODE_BANK ||
    ![MAIN_LOOP_RESUME, MAIN_LOOP_START].includes(ctx.pc) ||
    ctx.d !== 0 ||
    ctx.status & (FLAG_DECIMAL | FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT)
  )
    taskStop('main_loop_entry_required', { pc: ctx.pc });
  const h = dialogAccess(a);
  events ??= {
    mode: 'record-observations',
    values: Object.freeze([]),
    waitIndex: 0,
    calls: [],
    waitEvents: [],
    inputs: [],
    inputIndex: 0,
  };
  const call = function* (pc, target, long = false) {
    const run = mainLoopRun(routines, target);
    if (!run) taskStop('main_loop_frontier', { target });
    const bank = ctx.programBank,
      raw = pc + (long ? JSL_RETURN_OFFSET : JSR_RETURN_OFFSET);
    if (long) h.pushByte(bank);
    a.pushWord(raw);
    ctx.programBank = target >>> WORD_BITS;
    ctx.pc = target & WORD_MASK;
    yield { target, run, h, events };
    if (ctx.programBank !== bank || ctx.pc !== ((raw + 1) & WORD_MASK))
      taskStop('task_native_helper_return_required', {
        pc,
        target,
        bank: ctx.programBank,
        returnPc: ctx.pc,
      });
    if (ctx.status & (FLAG_INDEX_8BIT | FLAG_MEMORY_8BIT))
      taskStop('main_loop_return_width_required', { target });
  };
  const carry = () => (ctx.status & FLAG_CARRY) !== 0;
  if (ctx.pc === MAIN_LOOP_START) return yield* top();
  // $96C3–$96E4
  yield* call(CALL_PC.GATE_8000, 0x808000);
  if (carry()) return yield* top();
  yield* call(CALL_PC.CC4B, 0x80cc4b);
  if (carry()) return yield* top();
  yield* call(CALL_PC.DE94, 0x80de94);
  yield* call(CALL_PC.AFC4, 0x80afc4);
  yield* call(CALL_PC.BAD5, 0x80bad5);
  yield* call(CALL_PC.CAMERA_8C2E, 0x818c2e, true);
  yield* call(CALL_PC.CAMERA_8A91, 0x818a91, true);
  yield* call(CALL_PC.SPRITES_B8DE, 0x80b8de);
  yield* call(CALL_PC.FF14, 0x80ff14);
  yield* call(CALL_PC.TIMER_E270, 0x80e270);
  // The game leaves the loop to its owner when it ends (7E:1FDA) or reloads (7E:1FD8);
  // the original loads each word, so A and its sign and zero are left as the original.
  for (const [request, pc] of [
    [MAIN_LOOP_EXIT, MAIN_LOOP_EXIT_PC],
    [MAIN_LOOP_RELOAD, MAIN_LOOP_RELOAD_PC],
  ]) {
    const value = wram[request] | (wram[request + 1] << BYTE_BITS);
    ctx.a = value;
    ctx.status &= ~(FLAG_ZERO | FLAG_NEGATIVE);
    if (!value) ctx.status |= FLAG_ZERO;
    if (value & WORD_SIGN) ctx.status |= FLAG_NEGATIVE;
    if (!value) continue;
    if (returnToOwner) return h.rts();
    taskStop('main_loop_exit', { pc });
  }
  return yield* top();

  // $96AB–$96BD, then the loop stands before JSR $C1E3.
  function* top() {
    yield* call(CALL_PC.WAIT_B0A1, 0x81b0a1, true);
    yield* call(CALL_PC.ANIMATION_8877, 0x818877, true);
    yield* call(CALL_PC.PALETTE_8076, 0x818076, true);
    yield* call(CALL_PC.INPUT_9E1A, 0x809e1a);
    yield* call(CALL_PC.GLOVE_BE6D, 0x80be6d);
    yield* call(CALL_PC.BF3B, 0x80bf3b);
    ctx.pc = MAIN_LOOP_ROUND;
    return ctx.pc;
  }
}

const ownerRegisters = ['e', 'programBank', 'pc', 'a', 'x', 'y', 's', 'd', 'bank', 'status'];
export class MainLoopContinuation {
  constructor(a, { events = null, routines = MAIN_LOOP_ROUTINES, returnToOwner = false } = {}) {
    this.a = a;
    this.context = a.ctx;
    this.sequence = mainLoopSequence(a, events, routines, returnToOwner);
    this.saved = ownerRegisters.map((key) => a.ctx[key]);
    this.done = false;
    this.failed = false;
    this.current = null;
    this.work = 0;
  }
  // Budget units are caller segments or individual wait instructions.
  // Other helper graphs remain synchronous and retain their observation
  // contracts. This is cooperative work scheduling, not a CPU/PAL clock.
  run(budget) {
    const initialBudget = budget;
    if (!Number.isSafeInteger(budget) || budget < 0) taskStop('main_continuation_budget_required');
    if (this.failed) taskStop('main_continuation_failed');
    if (
      this.a.ctx !== this.context ||
      ownerRegisters.some((key, n) => this.context[key] !== this.saved[n])
    )
      taskStop('main_continuation_owner_required');
    try {
      while (budget > 0 && !this.done) {
        if (!this.current) {
          const next = this.sequence.next();
          if (next.done) {
            this.done = true;
            this.result = next.value;
            break;
          }
          this.current = next.value;
          // Recorded interrupt observations step the word wait and the pad word
          // instruction by instruction, as do their register-level routines; with
          // lag-free frames the lifted entries run as calls.
          const { target, run, events } = this.current;
          if (
            [0x81b0a1, 0x809e1a].includes(target) &&
            !([runFrameWait, runPadPresses].includes(run) && lagFree(events))
          )
            this.wait = new NativeWaitContinuation(this.a, this.current.target);
          else {
            // By target, or by the run function for a proof reference.
            const factory = NATIVE_CALL_CONTINUATIONS.get(this.current.target);
            if (factory?.run === this.current.run) this.callee = factory.create(this.current);
            else
              this.callee = NATIVE_CALL_CONTINUATIONS.get(this.current.run)?.create(this.current);
          }
        }
        if (this.wait) {
          const events = this.current.events;
          if (events?.interrupts !== undefined && !this.interruptDone) {
            this.interrupt ??= new InterruptStepContinuation(this.current.h, events, this.wait.pc);
            const before = this.interrupt.work,
              status = this.interrupt.run(budget);
            budget -= this.interrupt.work - before;
            if (status === WAIT_PAUSED) break;
            this.interrupt = null;
            this.interruptDone = true;
          }
          if (budget === 0) break;
          const status = this.wait.run(1);
          budget--;
          this.interruptDone = false;
          if (status === WAIT_PAUSED) continue;
          this.wait = null;
        } else if (this.callee) {
          const before = this.callee.work,
            status = this.callee.run(budget);
          budget -= this.callee.work - before;
          if (status === WAIT_PAUSED) break;
          this.callee = null;
        } else {
          const call = this.current;
          call.run(call.h, call.events);
          budget--;
        }
        this.current = null;
      }
    } catch (error) {
      this.failed = true;
      throw error;
    } finally {
      this.work += initialBudget - budget;
      for (let n = 0; n < ownerRegisters.length; n++)
        this.saved[n] = this.context[ownerRegisters[n]];
    }
    return this.done ? WAIT_RETURNED : WAIT_PAUSED;
  }
}
