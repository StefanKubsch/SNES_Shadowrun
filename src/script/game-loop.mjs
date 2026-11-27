// The plain game loop of the live game (docs/SCRIPT-VM-LIFT.md, phase 5). It replaces the
// register-level driver (proof/vm/main-driver.mjs) with one sequence of direct calls:
//
//   reset 00:E382, start-up 80:A133 (boot screens), then for ever:
//     the owner 80:A139 / A157 (title cycle, menus, attract demo),
//     the game's main start 80:9688,
//     the main loop 80:96AB-96E4 and the round 80:C1E3 at 96C0, once per frame,
//     until the main loop returns to the owner (game over, quit, reload).
//
// The script tasks live in one JS scheduler (src/script/scheduler.mjs) for the whole
// game: no task tables or heap in WRAM. Game code reaches them through the task API
// (src/script/task-api.mjs), which the loop attaches to its accessor and the natives
// attach to theirs. The rounds run on that scheduler with the natives of
// src/script/natives.mjs; the attract demo's rounds (the owner's 96C0) as well.
//
// Lag-free frames (src/vm/frame-events.mjs) give the NMIs; the loop pauses where the
// game waits for one. step(budget) runs up to `budget` work units (caller segments and
// wait instructions); the state at each NMI does not depend on where steps end.
import { taskStop } from '../system/task-stop.mjs';
import { TaskAccessor } from '../vm/task-accessor.mjs';
import { Scheduler } from './scheduler.mjs';
import { ScriptNatives, nativeTarget } from './natives.mjs';
import { JsTasks } from './task-api.mjs';
import { interruptEventsOf } from '../vm/devices.mjs';
import { SequenceRunner, NATIVE_CALL_CONTINUATIONS } from '../system/sequence-runner.mjs';
import { resetHardware } from '../system/main-reset.mjs';
import { accessorPort } from '../system/hardware-port.mjs';
import { mainStartupSequence } from '../system/main-startup.mjs';
import { gameOwnerSequence, GAME_OWNER_RESUME } from '../frontend/game-owner.mjs';
import { gameStartSequence } from '../game/game-start.mjs';
import { update, endOfFrame } from '../game/frame-loop.mjs';
import { CODE_BANK, CODE_BANK_BASE } from '../constants/memory-map.mjs';

// The power-on registers (as after reset: E=1, P=34, S=01FF) at the reset entry 00:E382:
// the seed of recorded callers that run the register-level reset on this accessor.
// Live play never reads or writes the accessor's CPU context.
const RESET_CONTEXT = Object.freeze({
  e: 1,
  programBank: 0,
  pc: 0xe382,
  a: 0,
  x: 0,
  y: 0,
  s: 0x1ff,
  d: 0,
  bank: 0,
  status: 0x34,
});
const ROUND_RESUME = 0x8096c3;

export class GameLoop {
  // host: the game's settings as the accessors see them (a.vm: mem, gameplay, cheats,
  // startMenuCredits); devices: LiveDevices; routines: the NMI callbacks
  // (src/system/main-frontend.mjs FRONTEND_ROUTINES);
  // admitted and implementation: the lifted natives without devices.
  constructor(host, { devices, routines, admitted, implementation }) {
    const mem = host.mem;
    this.devices = devices;
    this.routines = routines;
    this.natives = new ScriptNatives(mem, { admitted, implementation, devices, host });
    // onNative(target) sees every native call before it runs (the browser's mouse control).
    this.onNative = null;
    this.scheduler = new Scheduler(mem, {
      native: (id, args, scheduler, slot) => {
        this.onNative?.(nativeTarget(mem, id));
        return this.natives.native(id, args, scheduler, slot);
      },
    });
    this.tasks = this.scheduler.tasks = new JsTasks(this.scheduler);
    const a = (this.accessor = new TaskAccessor(host));
    a.devices = devices;
    a.tasks = this.tasks;
    Object.assign(a.ctx, RESET_CONTEXT);
    // The game services of live play (docs/LIVE-LOOP-SERVICES.md): no CPU context.
    this.services = Object.freeze({ a });
    // Main loop rounds since the reset; the owner's rounds (attract demo) do not count.
    this.rounds = 0;
    // The game's main loop runs (from its main start until it returns to the owner).
    this.ownsGame = false;
    this.work = new SequenceRunner(this.game(), NATIVE_CALL_CONTINUATIONS);
  }

  // Runs up to `budget` work units; a native that pauses inside a round pauses the loop.
  step(budget) {
    this.accessor.resetAccessBudget();
    this.work.run(budget);
  }

  // The events of one main interval: the lag-free devices and the owner's rounds.
  interval(target) {
    const set = this.devices.take(target),
      events = {
        mode: 'record-observations',
        values: set.wait,
        waitIndex: 0,
        waitEvents: [],
        calls: [],
        inputMode: 'record-observations',
        inputs: set.input,
        inputIndex: 0,
        ...interruptEventsOf(set, target),
        schedulerRound: () => this.schedulerRound(),
        nestedHeadVisit: () => this.headVisit(),
        valueRounds: true,
      };
    if (!events.frameJobs) taskStop('game_loop_frame_jobs_required', { target });
    const a = this.accessor;
    a.resetAccessBudget(target);
    a.io = set.io;
    a.ioIndex = 0;
    return events;
  }

  // Rounds and head visits have no entry selector or CPU workspace.
  schedulerRound() {
    return this.budgetedVisit(this.natives.roundContinuation(this.scheduler));
  }
  headVisit() {
    return this.budgetedVisit(this.natives.headContinuation(this.scheduler));
  }

  budgetedVisit(visit) {
    const natives = this.natives;
    return {
      get work() {
        return visit.work;
      },
      get result() {
        return visit.result;
      },
      run(budget) {
        const previousBudget = natives.workBudget;
        natives.workBudget = budget;
        try {
          return visit.run(budget);
        } finally {
          natives.workBudget = previousBudget;
        }
      },
    };
  }

  *game() {
    const a = this.accessor,
      routines = this.routines;
    let events = this.interval(CODE_BANK_BASE | RESET_CONTEXT.pc);
    // Live play takes game services only and never touches the accessor's CPU
    // context: game code reads the data bank 80 as a value (docs/LIVE-LOOP-SERVICES.md).
    yield () => {
      resetHardware(accessorPort(a), a.mem);
      a.dataBank = CODE_BANK;
    };
    yield* mainStartupSequence(this.services, events);
    let showTitle = true;
    for (;;) {
      const h = this.services,
        choice = yield* gameOwnerSequence(h, events, routines, showTitle);
      showTitle = false;
      this.ownsGame = true;
      yield* gameStartSequence(h, events, choice);
      for (;;) {
        yield* endOfFrame(h, events);
        this.closeInterval();
        yield { continuation: this.schedulerRound() };
        this.rounds++;
        events = this.interval(ROUND_RESUME);
        if (yield* update(h, events)) {
          this.closeInterval();
          break;
        }
      }
      this.ownsGame = false;
      events = this.interval(CODE_BANK_BASE | GAME_OWNER_RESUME);
    }
  }

  // The end of a main interval: every device read of its lag-free set is used.
  closeInterval() {
    const a = this.accessor;
    if (a.ioIndex !== a.io.length) taskStop('main_loop_io_observation_unused');
    a.io = null;
  }
}
