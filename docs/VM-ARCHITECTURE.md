# VM architecture

Current module layout of the native event interpreter in [src/vm/](../src/vm/).
The delivery history and proofs are in [VM-INTERPRETER.md](VM-INTERPRETER.md)
(German, historical).

## Modules

| Module                                               | Role                                                                                                                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [memory.mjs](../src/vm/memory.mjs)                   | `VmMemory`: WRAM (128 KiB), LoROM (1 MiB), optional SRAM, arithmetic unit `$4202-$4217`. `VmFault`, and `boundaryFault()` for proof module boundaries.            |
| [layout.mjs](../src/vm/layout.mjs)                   | Named original addresses: task tables, heap, interpreter work area, entry points (`OPCODE_LOOP` = `$F390`) and ROM tables in bank `$82`.                          |
| [cpu.mjs](../src/vm/cpu.mjs)                         | 65816 building blocks shared by scheduler and native bridge: `nz`, `plb`, `bank80`.                                                                               |
| [interpreter.mjs](../src/vm/interpreter.mjs)         | `ScriptInterpreter`: registers, operand stack, `fetch()` as `$F389-$F390`, `run(maxOpcodes)`.                                                                     |
| [handlers.mjs](../src/vm/handlers.mjs)               | One handler per opcode family with its original address; `OPCODE_TABLE` lists all even opcodes `$00-$C2`.                                                         |
| [scheduler.mjs](../src/vm/scheduler.mjs)             | `TaskScheduler`: task lists, heap, rounds, script call `$F488`, native wait `$C401`, resumptions `$F495`/`$F509`.                                                 |
| [native-call.mjs](../src/vm/native-call.mjs)         | Bridge `$F4F6`, dispatch `$F52F`, resume `$F509`; `NativeCalls` binds admitted, oracle and special natives and runs nested scheduler rounds.                      |
| [task-accessor.mjs](../src/vm/task-accessor.mjs)     | `TaskAccessor`: the accessor interface of the proven task modules directly on `VmMemory`; `vmToContext()`/`contextToVm()` move registers between VM and accessor. |
| [special-natives.mjs](../src/vm/special-natives.mjs) | Natives with hardware values: target to proven module, synchronous and resumable.                                                                                 |
| [devices.mjs](../src/vm/devices.mjs)                 | Address classes (`isIoAddress`, `isArithmeticRegister`) and interrupt cursors of observation sets (`interruptEventsOf`, `appendRoundInterrupts`).                 |
| [frame-events.mjs](../src/vm/frame-events.mjs)       | `LagFreeFrames` and `LiveDevices`: the game's live device answers (NMI at blocking wait loops, pad, APU ports, PPU bus, counter bytes).                           |
| [main-loop.mjs](../src/vm/main-loop.mjs)             | Main loop `$80:96AB-$96F2` between scheduler rounds, synchronous and as a continuation.                                                                           |
| [main-driver.mjs](../src/vm/main-driver.mjs)         | `MainLoopDriver`: reset, startup, menu owner, game start, main loop and the round `$C1E3` on one VM.                                                              |

Tests and Mesen oracles replay recorded observation sets with
[proof/vm/observed-devices.mjs](../proof/vm/observed-devices.mjs)
(`ObservedDevices`, `observationSet`); the game never loads it.

The native routines themselves live in `src/task/` under descriptive names;
[NATIVE-MODULES.md](NATIVE-MODULES.md) maps each former address-based name
to its module. Named WRAM addresses of the game state (object arrays, glove,
group, progress) are in [src/task/wram.mjs](../src/task/wram.mjs); task
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
- The main loop and special native tables import task modules by ROM address
  names (`processSceneRequest`, `hitObjectsInBlastObserved`); speaking names follow
  with the src/task group.
