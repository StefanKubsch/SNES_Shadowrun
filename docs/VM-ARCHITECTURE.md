# VM architecture

Current module layout of the native event interpreter and its proof references.
Reference contracts and the verification map are in
[VM-INTERPRETER.md](VM-INTERPRETER.md). Earlier delivery logs remain in Git history.

Since the script VM lift phase 5 ([SCRIPT-VM-LIFT.md](SCRIPT-VM-LIFT.md)) the game runs
its scripts on the JS interpreter, scheduler and native bridge in
[src/script/](../src/script/), driven by the plain game loop
([game-loop.mjs](../src/script/game-loop.mjs)). The register-level modules below that
the game no longer loads (cpu, interpreter, handlers, scheduler, native-call,
main-driver) live in [proof/vm/](../proof/vm/) as references for the differentials and
the replays with recorded observations. Phase 6 separates the recorded special
natives and main interval into `proof/vm/`, with their register-level forms and
reference call tables in [proof/replay/](../proof/replay/). The game binds lifted
native sequences directly and uses only lag-free frames.

Phase 7 removes `src/task/`. Game constants live in `src/data/`, native argument
and result adapters in `src/script/`, and shared caller, wait and NMI support in
`src/system/`. The shared boundary is `src/system/task-stop.mjs`. These adapters
still use the existing register access interface where lifted callees require it;
they do not restore the register-level interpreter or scheduler to the game.

## Modules

| Module                                               | Role                                                                                                                                                                                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [memory.mjs](../src/vm/memory.mjs)                   | `VmMemory`: WRAM (128 KiB), LoROM (1 MiB), optional SRAM, arithmetic unit `$4202-$4217`. `VmFault`; the register-level drivers convert task stops with `boundaryFault()` from [boundary-fault.mjs](../proof/vm/boundary-fault.mjs). |
| [layout.mjs](../src/vm/layout.mjs)                   | Named original addresses: task tables, heap, interpreter work area, entry points (`OPCODE_LOOP` = `$F390`) and ROM tables in bank `$82`.                                                                                            |
| [cpu.mjs](../proof/vm/cpu.mjs)                       | 65816 building blocks shared by scheduler and native bridge: `nz`, `plb`, `bank80`.                                                                                                                                                 |
| [interpreter.mjs](../proof/vm/interpreter.mjs)       | `ScriptInterpreter`: registers, operand stack, `fetch()` as `$F389-$F390`, `run(maxOpcodes)`.                                                                                                                                       |
| [handlers.mjs](../proof/vm/handlers.mjs)             | One handler per opcode family with its original address; `OPCODE_TABLE` lists all even opcodes `$00-$C2`.                                                                                                                           |
| [scheduler.mjs](../proof/vm/scheduler.mjs)           | `TaskScheduler`: task lists, heap, rounds, script call `$F488`, native wait `$C401`, resumptions `$F495`/`$F509`.                                                                                                                   |
| [native-call.mjs](../proof/vm/native-call.mjs)       | Bridge `$F4F6`, dispatch `$F52F`, resume `$F509`; `NativeCalls` binds admitted, oracle and special natives and runs nested scheduler rounds.                                                                                        |
| [task-accessor.mjs](../src/vm/task-accessor.mjs)     | `TaskAccessor`: the accessor interface of the proven task modules directly on `VmMemory`; `vmToContext()`/`contextToVm()` move registers between VM and accessor.                                                                   |
| [special-natives.mjs](../src/vm/special-natives.mjs) | Lifted natives with live hardware values, synchronous and resumable; replay forms are in `proof/vm/special-natives.mjs`.                                                                                                            |
| [devices.mjs](../src/vm/devices.mjs)                 | Address classes (`isIoAddress`, `isArithmeticRegister`) and interrupt cursors of observation sets (`interruptEventsOf`, `appendRoundInterrupts`).                                                                                   |
| [frame-events.mjs](../src/vm/frame-events.mjs)       | `LagFreeFrames` and `LiveDevices`: the game's live device answers (NMI at blocking wait loops, pad, APU ports, PPU bus, counter bytes).                                                                                             |
| main-frame-adapter.mjs (removed)                     | Lag-free main interval between scheduler rounds; recorded intervals use `proof/vm/main-loop.mjs`.                                                                                                                                   |
| main-driver.mjs (removed)                            | `MainLoopDriver`: reset, startup, menu owner, game start, main loop and the round `$C1E3` on one VM.                                                                                                                                |

Tests and Mesen oracles replay recorded observation sets with
`proof/vm/observed-devices.mjs` (removed)
(`ObservedDevices`, `observationSet`); the game never loads it.

The lifted native routines live in `src/game/`, `src/frontend/` and the other game
subsystems. Their register-level special native forms live in `proof/replay/`;
[NATIVE-MODULES.md](NATIVE-MODULES.md) maps each former address-based name
to its module. Named WRAM addresses of the game state (object arrays, glove,
group, progress) are in [src/data/wram.mjs](../src/data/wram.mjs); task
modules write `h.abs(OBJECT_FLAGS)` and `WRAM + OBJECT_ARMOUR` instead of
raw literals.

## Rules

- The opcode path allocates nothing; module-level constants and handler
  functions are created once.
- Original addresses stay visible: routine entries remain hexadecimal case
  labels with their address in a comment, data addresses use the names in
  `layout.mjs`.
- `tools/vm-benchmark.mjs` measures opcodes per second and heap growth
  (`node --expose-gc tools/vm-benchmark.mjs`).
- `tools/live-benchmark.mjs` (`npm run benchmark:live`) measures the product
  frame path from reset into the morgue: milliseconds per NMI for picture,
  audio time and the rest (VM, natives, devices), plus heap use.

## Open

- `MainLoopDriver.run()` spells out the reset, startup, owner and start
  sequence twice: synchronously and as `mainIntervalSequence()` for a finite
  budget. Folding both into one sequence needs a proof that the synchronous
  run* functions and their continuations consume observations identically.
- The game still uses address-keyed callee tables in several caller adapters.
