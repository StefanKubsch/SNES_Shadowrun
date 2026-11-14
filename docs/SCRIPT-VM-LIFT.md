# Script VM lift

User decisions of 2026-11-14 (see [STRATEGY.md](STRATEGY.md)):

1. The bytecode interpreter and the task scheduler are lifted to plain JS state. Tasks,
   their frames, operand stacks and continuations are JS objects, not 65816 stack words
   and heap blocks in WRAM. A conversion layer produces the original layout (task
   tables, heap, frames) where something still needs it.
2. `src/task` disappears. The game in `src` knows only the lag-free frame model;
   replays with recorded interrupt observations (Mesen replays, the cold boot replay)
   run only against the register-level references in `proof/`.
3. The game code stays as clean and simple as possible.

Saves are not affected: a save slot holds 7E:2DE0-3D07 ([SAVING.md](SAVING.md)), no
task state.

## Starting point (2026-11-14)

- Every script native runs lifted code (docs/MAIN-LOOP-LIFT.md, blocks up to 115), and
  every special native has a lifted sequence for lag-free frames.
- Register-level are still: the interpreter ([src/vm/interpreter.mjs](../src/vm/interpreter.mjs),
  [handlers.mjs](../src/vm/handlers.mjs): D = frame, S = operand stack, DBR = script
  bank, all in emulated memory), the scheduler
  ([scheduler.mjs](../src/vm/scheduler.mjs): C1A6 init, C1CA head, C1E3 round, C1F9 visit,
  C20B tail, C242/C2C8 heap and frame, C34A append, C36A child, C396 release, C3C9
  ready, C401 native wait, F378 enter, F488/F495 script call), the native bridge
  ([native-call.mjs](../src/vm/native-call.mjs), nested rounds from natives such as
  the dialog's JSR C1CA), and the drivers
  ([main-driver.mjs](../src/vm/main-driver.mjs),
  [live-game.mjs](../src/video/live-game.mjs)), which run the boot, the owner and the
  main loop from ROM addresses with routine tables keyed by address and opcode
  budgets.
- All 235 files of `src/task` are still imported from the rest of `src`. Their roles:
  (a) the scheduler and interpreter bridge and the register-level natives' tables;
  (b) the register-level forms of the special natives, used only with recorded
  observations; (c) shared infrastructure the lifted code uses (`wram.mjs` constants,
  `plan.mjs` `taskStop`, `native-call-continuation.mjs` sequences,
  `main-wait-interrupt.mjs`); (d) register-level routine tables that lifted tables
  extend.
- Code outside the scheduler that reads task tables directly: the halt natives
  (object-halt.mjs), object hits, the glove action, the object animation and target,
  the main motion target, the scene tiles, mouse control (src/browser), the game screen
  and main initialization (C1A6), bug fixes and object fields (the task cursor), and the
  lifted task append and object creation.

## Target structure

- `src/script/`: the task model (tasks, frames as byte arrays of the original size,
  operand stack, local return pointer, wait mask, counter, events, continuation as a
  JS value), the bytecode interpreter over a task, the scheduler round, nested rounds
  and the native table (script native ID to lifted function).
- A task API for game code: create a task for a script (C34A), release, halt and
  resume, the wait and event fields, the task of an object, the current task.
- One plain game loop (boot, owner, title, game, main loop per frame) with direct calls
  instead of ROM-address tables and budgets.
- The conversion layer lives in `proof/`: it projects the JS task state to the original
  WRAM layout (task tables, heap blocks and frames at the addresses the original heap
  allocator gives, replayed from the allocation and release order) and reads it back,
  for the Mesen oracles and the register-level references. The game needs no heap.

## Phases

Each phase is a delivery group with its own differential tests; release check after
each group as before (four lift blocks per release check).

1. **Task model and interpreter.** `src/script/tasks.mjs` and
   `src/script/interpreter.mjs` run one task's bytecode on its JS frame. Differential:
   the existing script corpus (tools/vm-interpreter.test.mjs scenarios) on the old VM
   and on the new interpreter with the frame projected, comparing game WRAM, the
   frame's live bytes, PC and exits.
2. **Scheduler.** Round, head visit, ready check, child tasks and resumption, release,
   native wait, nested rounds. Differential: tools/vm-scheduler-differential.mjs
   scenarios with the conversion layer.
3. **Natives on the new interpreter.** Arguments and result through the frame of the
   task as now through the direct page words 00.. (unchanged lifted natives first;
   natives taking JS arguments later). Paused natives (sequences) become the task's
   continuation.
4. **Task API for game code.** Replace the direct task table accesses listed above.
5. **Game loop.** Replace MainLoopDriver and the address-keyed tables of the live game
   with the plain loop; LiveGame keeps its interface (step, frames, saves).
6. **Replay mode to proof.** The drivers with recorded observations, the register-level
   special native forms and their tables move to `proof/`; the Mesen and cold boot
   replays run there.
7. **Dissolve `src/task`.** Constants to `src/data`, `taskStop` and sequences to
   `src/system`, the rest to `proof/`. Done when `src/task` is empty.

## Open points

- Opcode use (2026-11-14, the decoded corpus analysis/event-scripts.txt of
  `npm run decode:scripts`): no script uses opcode 54, the status return prefixes 90,
  98, A0 and A8 or any unused opcode (all return through F927 with an RTS from the
  operand stack), nor division and remainder (68 to 76), XOR (82), multiply 64/66 or the
  comparisons 8E, 96, 9E, A2, A4, A6, AE and B6. The JS interpreter implements the used
  opcodes and the cheap arithmetic ones; F927 becomes the frontier `script_opcode_unused`
  instead of a return through the operand stack.
- Frame residue: C2C8 does not clear a new frame, so locals start with the residue of
  earlier frames. [tools/probe-fresh-script-locals.mjs](../tools/probe-fresh-script-locals.mjs)
  found no local load of an unwritten byte (12000 NMIs of the benchmark route: 32
  frames, 21023 local loads in 6000 NMIs, none fresh). All 937 scripts of the corpus
  index only their declared locals. So JS frames start zeroed; the phase 1
  differential keeps the fresh read check as a guard, and the conversion layer masks the
  dead frame bytes.
- Heap and slot exhaustion stay frontiers (`task_heap_required`, `task_slot_required`);
  the JS model keeps the original's 48 slots and the frame sizes so that the
  conversion layer reproduces the original heap.
