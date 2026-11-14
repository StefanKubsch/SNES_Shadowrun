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

## Phase 1 result (2026-11-14)

- [src/script/tasks.mjs](../src/script/tasks.mjs): a task is plain JS state: script ID,
  code address, PC, local bytes (header byte 0 of the script, zeroed), operand stack
  (words, bottom first; the script's arguments are its first content, as 80:C2C8 copies
  them to the top of the frame), local return stack and the pending call.
  `createTask(mem, id, args)` takes the arguments in the order the caller pulled them;
  `finishCall(mem, task, result)` pushes a call's result when the tables 82:D970 (native)
  or 82:E623 (script) say it has one (80:F509, 80:F495).
- [src/script/interpreter.mjs](../src/script/interpreter.mjs): `runTask(mem, task,
budget)` runs opcodes until END (`{kind: 'end', result}`), a native or script call
  (`{kind, id, args}`, args in pull order, as the original passes them in the words 00..)
  or the budget. State words are reached through `mem` in bank 7E.
- Bounds the original does not check are frontiers: a push into the locals
  (`script_operand_stack_overflow`; capacity header byte 1 plus 4 bytes), a pull above
  the frame (`script_operand_stack_underflow`), a fifth local call
  (`script_local_call_depth`: its return word would overwrite the call ID at +09), a
  return without a call (`script_local_return_empty`), a local outside the declared
  bytes (`script_local_outside`), an odd argument byte count
  (`script_argument_bytes_odd`) and the unused opcodes including division and remainder
  (`script_opcode_unused`).
- Findings of the differential:
  - Many scripts end with an empty operand stack; 80:F4BE then returns the word above
    the frame (the next heap block's header). The JS result is null; a caller whose
    table entry takes the result stops at `script_result_undefined`. No such pair
    appeared in the corpus runs.
  - The multiply 80:F584 is not the true product: it writes the right factor's high
    byte to WRMPYA before the third 8x8 product, so the result is
    `ll*rl + ((ll*rh + lh*rh) << 8)` in 16 bits (for example 12Ch x 12Ch = 3490h, not
    5F90h). The JS interpreter reproduces it; the signed variants multiply the
    magnitudes and negate for one negative factor.
- [tools/script-interpreter.test.mjs](../tools/script-interpreter.test.mjs) runs all 937
  scripts from two random states each on both interpreters, with random native and
  script results so the runs go deep (up to 1000 opcodes), and compares PC, operand
  stack, local returns and written locals after every opcode and the game WRAM at the
  end. All runs are equal up to the fresh read sites below. A synthetic test compares
  every implemented arithmetic, logic and comparison opcode at edge values.

## Phase 2 result (2026-11-14)

- [src/script/scheduler.mjs](../src/script/scheduler.mjs): `Scheduler` keeps the 48 slots
  as plain records (task, next, previous, wait mask, counter, events, continuation
  `null`/`child`/`wait`); the free list reuses `next` as in the original, so slots are
  assigned in the original order. `append` (C34A), `round` (C1E3), `visitHead` (C1CA, the
  nested visit of natives), `visit` (C1F9), `ready` (C3C9), `resume` (C1FE with the tail
  C20B), `child` (C36A), `allocate` (C2C8) and `release` (C396). The wait native C401 (ID
  9F, the only one) runs inside the scheduler; every other native goes to the `native`
  callback with its arguments in pull order and returns the result word.
- A reused slot keeps its counter and events, as the original does. The ready check
  returns the word the original leaves at 7E:0000 (met events, bit 0 for the counter);
  it becomes the result of the waiting native. The END result of a child task becomes
  the result of its parent's script call.
- The game needs no heap: the optional observers `onCreate` and `onRelease` let the
  conversion layer replay it.
  [proof/script/task-layout.mjs](../proof/script/task-layout.mjs) reads a state the
  original left in WRAM into a JS scheduler, replays the allocator 80:C242/C2BD on a copy
  of the heap and projects the live bytes back: the task tables, the headers of the heap
  chain and each frame's code pointer, PC, return pointer, operand stack pointer, call ID
  (while a call is pending), return words, locals and operand stack. Table words C1A6
  leaves stale (previous and continuation of unused slots) are projected once the slot
  is allocated.
- New frontiers: `task_slot_required` (a 49th task; the original goes on with slot
  FFFFh), `task_heap_required` (conversion layer only; the original writes a frame at
  7E:0000), `task_reentered` (a nested visit reaches a task whose bytecode runs; the
  original would resume it through its stale continuation), `task_ended_waiting` (a task
  ends while a native set its wait mask; the original keeps it and would resume it after
  its last call), `task_list_end_resume` (the last task of the list ends while slot 0's
  wait mask has bit 7 set, for example while slot 0 waits for a child: 80:C224 reads the
  word at 7E:0BA1 past the wait table and jumps through stale table words) and
  `task_wait_arguments`.
- [tools/script-scheduler.test.mjs](../tools/script-scheduler.test.mjs): 300 scenarios
  from random WRAM with one to four ROM scripts, twelve rounds each, on the register-level
  scheduler and on the JS scheduler loaded through the conversion layer. Natives return
  the same random result on both sides and may append a task and visit it at once, send
  events to a task or toggle its halt bit. After every round the native calls, the
  projected bytes and the rest of the WRAM (outside the interpreter's work bytes) are
  equal: 297 scenarios run all rounds; one stops at `task_list_end_resume` and two at
  the known fresh reads of phase 1 (23D at FE, 3A3 at 54). Every flow occurs: child
  tasks and their resumption, ends and releases, counter and event wakeups, waits,
  halts, appends and nested visits.
- The test's outer stack lies below the game stack top 7E:1CBB: scripts write state
  words at 7E:1D09-1F60, which a stack at 7E:1FE0 overlaps.

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
- Fresh reads found by the phase 1 differential (random native results): eight sites.
  Seven follow a chain of equality tests that writes a local for a fixed set of values
  only (directions, the result of native 57) and need a value outside that set. Script
  DD at 84 is a real path: the loop 71-8D writes local 4 only when the wait native 9F
  (mask 0801h, counter 5 frames) ends by event 0800h. After a timeout it pushes local 4
  unwritten, ORs it with the distance test (native 0A, `< 100`) and leaves the loop when
  the result is not zero. In the original a nonzero heap residue there ends the loop
  after the first five frames, whatever the distance; zeroed JS frames keep waiting for
  the event or the approach, which is what the code evidently intends. User decision 2026-11-14: zeroed frames, recorded as a port correction in [BUGFIXES.md](BUGFIXES.md#uninitialized-local-in-script-dd). Until phase 3 loads the new modules, tools/production-boundary.test.mjs exempts them (user decision 2026-11-14).
- For phase 3: the JS scheduler writes no word 7E:0000 (the original leaves the END
  result and the ready check's word there) and its round has no opcode budget. Natives
  that read 7E:0000 after a nested visit, and natives that pause across frames (their
  sequences), must take these from the task state instead.
- Heap and slot exhaustion stay frontiers (`task_heap_required`, `task_slot_required`);
  the JS model keeps the original's 48 slots and the frame sizes so that the
  conversion layer reproduces the original heap.
