# Script VM lift

Note (2026-11-25): the register-level game loop (proof/vm/main-driver.mjs,
proof/script/register-level-loop.mjs), the address-dispatched owner and title cycle
(proof/frontend-caller/), the register-level startup and reset references and the
recorded Mesen boot replays were retired (user decision,
[STATE-MODEL-REBUILD.md](STATE-MODEL-REBUILD.md), Progress). The lockstep and lift
comparisons this document names (tools/game-loop.test.mjs, tools/lift-compare.mjs and
its tests, the owner and transition caller tests) went with them; the golden traces
are the reference. Where the text below names them, it describes the state before
that date.

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
- Register-level are still: the interpreter (`proof/vm/interpreter.mjs` (removed),
  `handlers.mjs` (removed): D = frame, S = operand stack, DBR = script
  bank, all in emulated memory), the scheduler
  (`scheduler.mjs` (removed): C1A6 init, C1CA head, C1E3 round, C1F9 visit,
  C20B tail, C242/C2C8 heap and frame, C34A append, C36A child, C396 release, C3C9
  ready, C401 native wait, F378 enter, F488/F495 script call), the native bridge
  (`native-call.mjs` (removed), nested rounds from natives such as
  the dialog's JSR C1CA), and the drivers
  (main-driver.mjs (removed),
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

Each phase is a delivery group with its own differential tests and one release check
after the complete group, following AGENTS.md.

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
7. **Dissolve `src/task`.** Constants to `src/data`, `taskStop` and shared execution
   support to `src/system`, script native adapters to `src/script`, and reference-only
   code to `proof/`. Done when `src/task` is empty.
8. **Simplify caller composition.** Replace address-keyed caller adapters with direct
   calls in bounded groups, retaining the former paths in proof for game-state
   comparisons. Start with the startup, then the owner and its title cycle. Shared
   register interfaces are simplified only after their consumers are separated.

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
  [tools/task-layout.mjs](../tools/task-layout.mjs) reads a state the
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

## Phase 3 result (2026-11-14)

- [src/script/scheduler.mjs](../src/script/scheduler.mjs): the round (`rounds`), the head
  visit (`headVisit`), the visit, the resumption and the task run are generators. The
  native callback may return a pending call (`resume()` returns true once the native has
  returned, its word in `result`); it stays the slot's `native` until then, and the
  generators yield while it pauses. `round()` and `visitHead()` run to the end (a pause
  there stops at `script_native_paused_synchronously`); `beginRound()` and
  `continueRound()` hand each pause to the caller. The round has no opcode budget: it
  pauses only where a native pauses.
- [src/script/natives.mjs](../src/script/natives.mjs): `ScriptNatives` is the bridge F4F6
  to F509 over a JS task. The argument words go to the direct page words 00.. (args[0] at
  00, as call_native F4CB leaves them); the native runs with A = its pointer, X = 2 * ID,
  Y = the task's PC, D = 0, DBR = 80 and S = the stack F378 saved at 01F2, with the
  return word F508 pushed; after its RTS to F509 on that stack the result is the word at
  7E:0000. The natives are the lifted modules of the register-level bridge: the admitted
  natives and the special natives with live devices, unchanged. A native's JSR 80:C1CA
  (topic action, spell menu) is a nested head visit of the JS scheduler on the native's
  stack less six bytes (C1CA saves the cursor, the visit and the task push their
  returns; C1E3 is four bytes), ending as the original with DBR = 80 and its RTS. The
  A the original leaves (the restored cursor of C1CA, the list head of C1E3) is read by
  no caller and left out (user decision 2026-11-17). With a finite work budget the special
  natives with a resumable sequence pause, and a nested visit inside one pauses with it.
- proof/script/js-rounds.mjs (replaced in phase 5 by live-tasks.mjs (removed)) attaches the JS rounds to a
  live game: the driver's round C1E3 after the main interval and the owner's resumable
  round 96C0 (attract demo). Until phase 4 the rest of the game keeps the task tables and
  the heap in WRAM, so each round loads the JS scheduler through the conversion layer and
  stores its projection at the end, and the projection is stored before each native; when
  register-level code inside a native changed the tables or the heap, the conversion
  layer reads them back in place (`reload`, tasks with unchanged frames keep their
  objects), also before a nested visit.
- tools/script-natives.test.mjs (since phase 5 tools/game-loop.test.mjs (removed)) runs two live games in
  lockstep from the reset, one with the register-level rounds and one with the JS rounds,
  and compares the WRAM (task bytes through the projection), VRAM, CGRAM and OAM at every
  NMI: the benchmark route for 6000 NMIs with synchronous natives, the closed badge route
  from the apartment save (16348 NMIs: 8882 rounds, 42549 native calls, 2942 native
  pauses across steps, five nested visits of topic dialogs, projectiles appended by
  80:8AB5) with pausing natives, and 6000 NMIs of the attract demo with the owner's
  rounds. All are equal. Exploratory runs: the benchmark route for 9000 NMIs (5570
  rounds, 51792 native calls) in both modes and the attract demo for 12000 NMIs (1452
  rounds) are equal as well.
- Findings:
  - No native on these routes reads the word 7E:0000 after a nested visit: the topic
    dialogs continue equal although the JS scheduler leaves neither the END result nor
    the ready check's word there. The JS scheduler keeps not writing it.
  - The original's scheduler leaves its return words on the main program's stack in page
    1 (S near 013Ah during the game); they are dead, and the JS rounds do not write them.
  - Register-level code inside natives that changes the task state on these routes (the
    callers of the task API of phase 4): the topic action's append 80:C34A before the
    nested visit, the projectiles of 80:8AB5, the scene object of a group member 80:A1E6
    and the object creation 80:A835 (attract demo).
  - The live game never runs a synchronous owner round; js-rounds stops there
    (`js_rounds_synchronous_owner`).

## Phase 4 result (2026-11-14)

- [src/script/task-api.mjs](../src/script/task-api.mjs): the task API of game code. A task
  is named by its task word (twice the slot, negative for none), the value objects keep in
  7E:1350; any other word stops at `task_slot_required`. Calls: `current()`, `wait`,
  `setWait`, `events`, `setEvents`, `previous`, `code` (the bytecode address),
  `append(script, args)` (C34A) and `reset()` (C1A6), with the helpers `waitingTask` (the
  task that runs for a parent waiting for its child; a chain longer than the 48 slots
  stops at `task_chain_unbounded`), `sendEvents` and `argumentWords` (the words a caller
  leaves at 7E:0000 for C34A). `JsTasks` implements it over the JS scheduler (new
  `Scheduler.reset()` with the observer `onReset`, which the conversion layer uses for
  its heap), `WramTasks` over the original's tables and heap for the register-level
  scheduler that still drives the game. `tasksOf(a)` gives an accessor's tasks: the JS
  scheduler's when one is attached (`a.tasks`), else the WRAM tables;
  `appendScriptCall(a, script)` is C34A as lifted callers call it with JSR on either,
  leaving no registers; the register-level call form `appendScriptTaskCall(a)` lives in
  [tools/register-forms/task-append-call.mjs](../tools/register-forms/task-append-call.mjs).
- Game code on the API: the halt natives (object-halt.mjs), object hits, the glove
  action, the object animation and motion target (events), the task bind 80:A926, the
  Akimi bug fix (the current task's script), the game screen and room entry (reset), the
  object creation, the spell start, the menus' and zones' C34A, the dialog's topic action
  (native-dialog-text.mjs on the JS scheduler) and the mouse control (`LiveGame.tasks`).
  The register-level forms in `src/task` (main-initialize, main-motion-target,
  native-object-hit, native-scene-tiles, script-yield, task-append, native-object-create,
  the member spell menu and the zone gate) keep their direct table accesses; they run
  only with recorded observations and move to `proof/` in phase 6.
- [src/script/natives.mjs](../src/script/natives.mjs) attaches the JS scheduler's API to
  each native's accessor. proof/script/js-rounds.mjs (replaced in phase 5 by live-tasks.mjs (removed)) no
  longer stores the projection before natives or reads the tables back after them: while
  a round is open (also while it is paused across steps) any read or write of
  7E:0246-0CC1 through the memory stops with `RegisterLevelTaskAccess`; `sync()` stores
  the projection of an open round for the comparison at an NMI. Rounds still load from
  and store to the WRAM, as the main loop between rounds stays on the WRAM tables until
  phase 5.
- tools/script-natives.test.mjs (since phase 5 tools/game-loop.test.mjs (removed)): all three routes are
  equal with the trap armed; on the badge route the projectiles of 80:8AB5 and the topic
  tasks are appended through the API inside natives.
  [tools/task-api.test.mjs](../tools/task-api.test.mjs): 200 random sequences of 120 API
  calls on both implementations give the same results and frontiers, and the projection
  of the JS side equals the WRAM side's tables and heap after every call.
- The lifted functions now stop at `task_slot_required` for a task word that names no
  slot, where the original read garbage table words; the halt test samples such words
  rarely (game state only).

## Phase 5 result (2026-11-15)

- [src/script/game-loop.mjs](../src/script/game-loop.mjs): `GameLoop` is the live game's
  loop, one sequence of direct calls: the reset 00:E382, the start-up 80:A133, then for
  ever the owner (`gameOwnerSequence`, A139 and A157), the game's main start
  (`gameStartSequence`, 9688) and per frame the main loop (`MainLoopContinuation`)
  followed by the round C1E3 at 96C0, until the main loop returns to the owner. No entry
  dispatch by ROM address, no opcode budget: `step(budget)` runs work units (caller
  segments and wait instructions), and a native that pauses pauses the loop. The owner's
  rounds (attract demo) are pausable visits of the same scheduler.
- One JS scheduler lives for the whole game; the game keeps no task tables and no heap
  in WRAM. The loop's accessor and every native's accessor carry its task API
  (`JsTasks`), so the main loop, the owner and the natives reach the tasks only through
  it. `ScriptNatives` takes the game's settings host (`a.vm`: gameplay options,
  cheats, the start menu's credits entry), which its accessors had lacked.
- [LiveGame](../src/video/live-game.mjs) keeps its interface: `step({budget})`,
  `frames`, `nmis`, the saves in `memory`, `tasks` (now the JS task API),
  `controlNmi` and `choosing` (from the loop's `onNative` hook). `game.loop` replaces
  `game.driver` (`rounds`, `ownsGame`); `game.vm` is the plain settings host. The
  option `loop(game)` makes the loop.
- The register-level modules the game no longer loads moved to `proof/vm/`: the
  interpreter, its handlers and CPU helpers, the scheduler, the native bridge and the
  main driver. proof/script/register-level-loop.mjs (removed)
  builds the former live loop on them (`new LiveGame(cartridge, {loop:
registerLevelLoop})`); the observed rooms and boot replays keep the driver directly.
  tools/production-boundary.test.mjs has no exemption left.
- [tools/task-layout.mjs](../tools/task-layout.mjs) `followScheduler` follows
  a live JS scheduler from the start and replays the original heap from the first C1A6
  on (nothing is projected before it; PREVIOUS of slots 1-47 is projected once the slot
  is allocated). proof/script/live-tasks.mjs (removed) replaces
  js-rounds: the projection, the locals guard and the statistics, with the trap on
  7E:0246-0CC1 armed for every read and write of the whole run.
- tools/game-loop.test.mjs (removed) (formerly script-natives) runs the
  register-level loop and the plain loop in lockstep from the reset and compares WRAM,
  VRAM, CGRAM, OAM and the projected task bytes at every NMI: the benchmark route (6000
  NMIs), the closed badge route from the apartment save (pausing natives, nested topic
  visits, projectiles appended inside natives) and 6000 NMIs of the attract demo (owner
  rounds only). All are equal; no code touches the original's task bytes on the plain
  loop.
- Still keyed by address: the call graph inside the owner, the start and the main loop
  (`MAIN_STARTUP_ROUTINES` and the tables it merges), through which the lifted sequences
  call their callees, and the power-on reset `runMainReset` and start-up
  `MainStartupContinuation` from src/task. They dissolve with src/task (phases 6 and 7).

## Phase 6 result (2026-11-15)

- Recorded replay code lives in [proof/replay/](../proof/replay/): the register-level
  special native forms, their reference routine tables, boot sound transfer and
  startup, software reset, and the reference-only sprite, sight and observation
  helpers. Mixed modules retain only the constants and shared helpers the game
  imports in `src/task/`. The recorded main interval is
  `proof/vm/main-loop.mjs` (removed); the existing recorded drivers,
  Mesen tools and cold boot comparisons import these proof modules.
- The recorded main interval binds the zone, scene request, notice timeout, timer
  and glove references directly, so direct oracle table calls also stay on the
  replay path. `registerLevelLoop` is a separate live-frame differential: it uses
  the game's lifted caller tables with the register-level interpreter and scheduler.
- [src/vm/special-natives.mjs](../src/vm/special-natives.mjs) binds the lifted game
  sequences directly, with one adapter for synchronous and pausing calls. Its
  sequence adapter rejects recorded observations before accessing game state.
  `proof/vm/special-natives.mjs` (removed) preserves the former
  register-level forms and their observation validation for replay tests.
- The live main interval and attract rounds no longer select register-level waits.
  The live startup uses the lifted boot screens; the reference startup retains the
  original instruction observations and sound handshakes. Live menu and dialog
  tables bind lifted functions directly instead of inheriting replay routines.
- The runner resource natives use [runner-state-call.mjs](../src/game/runner-state-call.mjs):
  their existing lifted state bodies, the redraw's real JSL frame, and their RTS.
  A differential checks both complete call sequences against the register-level
  references across single-work-unit pauses and resource amount boundaries.
- Live and reference tables can coexist in a test process. Their registration adapter
  [continuations.mjs](../tools/register-forms/continuations.mjs) preserves both factories by
  function identity when they share a ROM target. This avoids replacing a live
  continuation with a different reference function and accidentally running a
  title wait synchronously. The lift comparison discovers tables in both source
  and proof directories.
- Verification includes the game-loop benchmark, badge and attract routes, native
  differential, replay target coverage, rejection of recorded waits in the live
  adapter, continuation registration, and the production import boundary. The
  release check also selects the affected Mesen and cold boot comparisons.
- At the end of phase 6, phase 7 remained: dissolve `src/task/`. Shared wait/NMI execution support, constants,
  reset and caller adapters still live there; this phase does not rename or redesign
  those shared modules. Save data and the frame model are unchanged.

## Phase 7 result (2026-11-15)

- `src/task/` is removed. Its remaining 215 game modules are grouped by purpose:
  constants in [src/data/](../src/data/), script native argument/result adapters and
  their bindings in [src/script/](../src/script/), and shared caller, reset, wait, NMI,
  text, unpacking and rendering support in [src/system/](../src/system/).
  [task-stop.mjs](../src/system/task-stop.mjs) defines the common `taskStop` boundary;
  `nmi-call.mjs` (removed) retains the shared interrupt call frame.
- The reference-only modules moved in phases 5 and 6 stay in `proof/`. Proof and game
  consumers import the same shared constants and execution helpers directly, without
  compatibility re-exports. Shared helpers retain the observation checks that their
  register-level proof callers use; the live loop still supplies only lag-free frames.
- Imports, source-contract paths, historical inventory bindings and documentation links
  follow the new locations. The text-reference inventory names the actual reference
  modules where the recorded text operands are implemented.
- The lift comparison discovers caller tables in `src/system/`, `src/script/` and
  `src/vm/` as well as the proof tables. The production boundary also rejects a return
  of `src/task/`. Live/reference factory identity, save data and the frame model stay
  unchanged.

## Phase 8, startup caller composition (2026-11-15)

- [main-startup.mjs](../src/system/main-startup.mjs) composes the boot screens
  directly: startup A133, its A15C wrapper and the E7BC screen sequence no longer
  select callees through a ROM-address map or continuation registry. The game loop
  delegates to this sequence directly. Entry validation and the lag-free requirement
  remain explicit.
- The original JSR/JSL frames, PHP/PLP and data-bank restoration remained at first
  because shared boot and NMI helpers still use the register accessor. Since
  2026-11-20 the frames go (their return words lie only in free stack bytes); the
  status and the data bank 80 are restored in the context, and
  main-startup-lift.test.mjs (removed) compares game state
  only, as main-owner-caller.test.mjs does. This block simplifies
  caller composition; it does not remove those register interfaces or change frame
  timing, save data or hardware behaviour.
- The address-dispatched live path is retained independently in
  proof/script/live-startup.mjs (removed). The register-level
  game-loop differential uses it; recorded boot replays keep their separate
  proof/replay/main-startup.mjs (removed). The game uses
  the frontend's routine table for its remaining callers and interrupt adapters;
  the boot screen's immediate-return NMI callback (81:E839) now belongs to
  main-frontend-nmi.mjs. Lift comparisons discover the retained live startup table
  in proof/script as well.
- main-startup-lift.test.mjs (removed) compares every
  WRAM byte (including the stack), SRAM, PPU memories and registers, scroll, PPU write
  count, sound RAM and CPU context at every NMI and on return. Cases cover valid and
  invalid settings, work budgets of one and seven, cold boot and startup after the
  unchanged reference software reset on populated state. The existing game-loop
  comparisons retain the benchmark, badge and attract-demo routes.
- The software reset itself remains reference code; this block checks its resulting
  startup state and does not add a software-reset entry to the live game. At this
  boundary, the owner, title cycle and main-loop caller tables remained for later groups.

## Phase 8, owner and title-cycle composition (2026-11-15)

- [game-owner.mjs](../src/frontend/game-owner.mjs) calls the title cycle directly.
  [title-cycle.mjs](../src/frontend/title-cycle.mjs) directly composes the title,
  start menu, attract game, demo owner and new-game setup. The demo enters the room
  and runs its rounds through [attract-rounds.mjs](../src/frontend/attract-rounds.mjs),
  extracted from the former frontend adapter. These calls no longer select a routine
  or continuation factory by ROM address.
- The original call frames and return checks remain for shared register and NMI
  consumers. The credits cutscene and music-stop calls retain their shared adapters;
  the main game start, main-loop routine table and lower scene/audio helpers remain
  later groups. Save data, sound behavior and lag-free frames are unchanged.
- The former callers live in proof/frontend-caller/ (removed).
  Recorded replays bind those retained callers, while the register-level live loop
  uses live-frontend.mjs (removed) and
  live-frontend-menu.mjs (removed). Existing per-function
  and register-level lift comparisons continue to test that independent path.
  Title and start-menu table wrappers now belong only to proof; the live NMI table
  inherits the shared text helpers directly. Its proof counterpart binds the same
  wrapper identities as the existing title/menu lift comparisons, so their reference
  swaps also reach the retained live table.
- main-owner-caller.test.mjs (removed) compares the old
  dispatched callers with the direct callers on the same JS scheduler and devices.
  Five input sessions cover the whole title, interrupted title, menu timeouts,
  repeated attract demos, menu credits, New Game and a saved game, at work budgets
  of one and seven. Every NMI and each owner boundary compares full WRAM including
  stack bytes, SRAM, CPU context, PPU memories/registers/scroll, PPU write count and
  sound RAM, with no scratch masks.
- Each session also enters the selected game, runs its first main-loop round and
  requests an exit through the loop's actual RTS to A157 before selecting another
  game from the resumed menu. The exit request is a test fixture; this does not
  establish a new game-over story route or resolve the reported menu-audio issues.

## Phase 8, game start and main-loop composition (2026-11-15)

- The register-level entry in main-start.mjs (removed)
  invokes the game-start body directly; the live owner enters the lifted start
  itself (moved to proof on 2026-11-17). main-frame-adapter.mjs (removed) composes its
  upkeep entries and waiting sequences directly, using the common continuation
  instead of its former dispatch-specific continuation. The game and attract
  loops no longer forward a routine table to the per-frame caller.
- The former live callers remain in [proof/caller/](../proof/caller/) and the
  retained frontend uses their independent dispatch. Shared helper tables and
  register/NMI frames remain; saves and the lag-free frame model are unchanged.
  Lower callee graphs still use their established helper tables.
- The owner caller differential now also selects the old and new game starts
  and main loops independently. It checks the completed start and both exit and
  reload requests through the real return to the owner. The requests are fixtures;
  this adds no game-over route evidence. Details in
  [GAME-START-LIFT.md](GAME-START-LIFT.md) and [MAIN-LOOP-LIFT.md](MAIN-LOOP-LIFT.md).

## Phase 9, room entry and scene transition composition (2026-11-15)

- The live room entry uses direct composition without recorded-interrupt branches
  or a caller routine table. The scene request directly composes the cutscene,
  matrix and room entry, retaining the shared call frames for nested waits.
- The previous room, scene-request and game-start composition remains in
  proof/caller/. Recorded drivers and existing reference comparisons use it.
  Lower helper tables, saves and the lag-free frame model remain unchanged.
- transition-caller.test.mjs (removed) checks the old
  and direct transitions on the JS scheduler, frame by frame at budgets one and
  seven, for room changes, cutscenes and matrix entry/return. Contracts:
  [ROOM-ENTRY-LIFT.md](ROOM-ENTRY-LIFT.md) and
  [SCENE-REQUEST-LIFT.md](SCENE-REQUEST-LIFT.md).

## Open points

- Opcode use (2026-11-14, the decoded corpus analysis/event-scripts.txt of
  `npm run decode:scripts`): no script uses opcode 54, the status return prefixes 90,
  98, A0 and A8 or any unused opcode (all return through F927 with an RTS from the
  operand stack), nor division and remainder (68 to 76), XOR (82), multiply 64/66 or the
  comparisons 8E, 96, 9E, A2, A4, A6, AE and B6. The JS interpreter implements the used
  opcodes and the cheap arithmetic ones; F927 becomes the frontier `script_opcode_unused`
  instead of a return through the operand stack.
- Frame residue: C2C8 does not clear a new frame, so locals start with the residue of
  earlier frames. tools/probe-fresh-script-locals.mjs (removed)
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
  the event or the approach, which is what the code evidently intends. User decision 2026-11-14: zeroed frames, recorded as a port correction in [BUGFIXES.md](BUGFIXES.md#uninitialized-local-in-script-dd). Since phase 5 the game runs on the JS interpreter, scheduler and native bridge, and tools/production-boundary.test.mjs no longer exempts any module.
- The JS scheduler writes no word 7E:0000 (the original leaves the END result and the
  ready check's word there). No native read it after a nested visit in the phase 3
  differential; a native on another path that does would diverge there.
- Heap and slot exhaustion stay frontiers (`task_heap_required`, `task_slot_required`);
  the JS model keeps the original's 48 slots and the frame sizes so that the
  conversion layer reproduces the original heap.

## Window caller phases (2026-11-15)

The four bounded window and menu delivery groups are completed: live drawing,
release and opening have no recorded-observation branches, and menu frame/input/
sound calls compose directly. Independent former callers and recorded comparisons
remain in proof. Contracts: [WINDOW-CALLER-LIFT.md](WINDOW-CALLER-LIFT.md).
