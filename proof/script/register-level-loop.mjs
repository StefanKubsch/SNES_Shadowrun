// The live game's register-level game loop, the reference of the plain game loop
// (src/script/game-loop.mjs, docs/SCRIPT-VM-LIFT.md phase 5): the main driver
// (proof/vm/main-driver.mjs) runs the boot, the owner and the main loop from ROM addresses
// with the register-level interpreter, scheduler and native bridge (src/vm/), and the
// task tables and heap in WRAM. Pass it as LiveGame's `loop` option:
//
//   new LiveGame(cartridge, { loop: registerLevelLoop })
//
// game.vm becomes the register-level interpreter, with the game's settings copied to it.
import { VmFault } from '../../src/vm/memory.mjs';
import { ScriptInterpreter } from '../vm/interpreter.mjs';
import { NativeCalls } from '../vm/native-call.mjs';
import { NATIVE_POINTERS } from '../../src/vm/layout.mjs';
import { MainLoopDriver, STOP_MAIN_WAIT, STOP_MAIN_OWNER_RETURN } from '../vm/main-driver.mjs';
import { STOP_RETURNED, STOP_BUDGET, STOP_NATIVE_WAIT } from '../vm/scheduler.mjs';
import { nativeOpcodeTargets } from '../../src/data/native-opcode-targets.mjs';
import { nativeTarget } from '../../src/script/native-targets.mjs';
// This reference runs live frames on the game's lifted caller tables; recorded
// replays use the driver's register-level defaults in proof/replay/.
import { MAIN_STARTUP_ROUTINES } from '../../src/system/main-startup.mjs';
import { WramTasks } from '../../src/script/task-api.mjs';
import { CODE_BANK_BASE } from '../../src/constants/memory-map.mjs';

const RESET_CONTEXT = Object.freeze({
  a: 0,
  x: 0,
  y: 0,
  s: 0x1ff,
  d: 0,
  bank: 0,
  status: 0x34,
  programBank: 0,
  pc: 0xe382,
  e: 1,
});
const STOPS = [
  STOP_RETURNED,
  STOP_BUDGET,
  STOP_MAIN_WAIT,
  STOP_NATIVE_WAIT,
  STOP_MAIN_OWNER_RETURN,
];

export function registerLevelLoop(game) {
  const vm = new ScriptInterpreter(game.memory);
  Object.assign(vm, game.vm);
  game.vm = vm;
  vm.setContext(RESET_CONTEXT);
  vm.pc = RESET_CONTEXT.pc;
  vm.e = RESET_CONTEXT.e;
  const devices = game.devices;
  vm.natives = new NativeCalls(vm, {
    admitted: nativeOpcodeTargets,
    implementation: nativeTarget,
    devices,
  });
  vm.natives.accessor.devices = devices;
  const driver = new MainLoopDriver(vm, {
    devices,
    routines: MAIN_STARTUP_ROUTINES,
    startRoutines: MAIN_STARTUP_ROUTINES,
    frontendRoutines: MAIN_STARTUP_ROUTINES,
    startupRoutines: MAIN_STARTUP_ROUTINES,
    resetProgramBank: 0,
  });
  const loop = {
    driver,
    onNative: null,
    tasks: new WramTasks({ mem: game.memory }),
    get rounds() {
      return driver.roundsCompleted;
    },
    get ownsGame() {
      return driver.ownsGame;
    },
    // One main interval or its resumption and the round after it; the opcode budget of
    // the round is the work budget.
    step(budget) {
      const stop =
        driver.pending || driver.mainPending
          ? driver.resume(budget, { mainBudget: budget })
          : driver.run(budget, { mainBudget: budget });
      if (!STOPS.includes(stop)) throw new VmFault('live_round_return_required');
    },
  };
  const natives = vm.natives,
    call = natives.call.bind(natives);
  natives.call = () => {
    loop.onNative?.(CODE_BANK_BASE | game.memory.read16(NATIVE_POINTERS + vm.x));
    return call();
  };
  return loop;
}
