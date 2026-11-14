# Script calls, wait conditions and native game actions

Proof-era contract of the semantic script runner (`proof/script/`), state
2026-10-03. Source is only the local European ROM (SHA-256
`91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690`). These
JavaScript modules run game bytecode, not SNES machine instructions; CPU
addresses are provenance. The product VM scheduler is described in
[VM-INTERPRETER.md](VM-INTERPRETER.md); heap, frames and task list in
[task-system.md](reference/task-system.md). Translated and condensed from the
former German version (git commit 20c7b6c9).

## Proven call flow

Opcode `$52` at `$80:F460` reads the script ID, loads the argument byte count
from `$82:E9CC` and pops the argument words into the shared workspace from
`$0000`. The allocator at `$80:C30F` copies them in reverse order onto the
downward-growing new stack, so the child gets the same bottom-to-top order the
parent had; the parent's stack below stays. At `$80:C36D–C385` the child is
inserted after its parent in the task list; the parent status becomes `$FFFF`
and its continuation stays stored. `$80:C239` starts the child; after its end
`$80:C396` removes the task; `$80:C221–C22C` clears the negative parent status
and jumps straight to the continuation (no extra wait period). `$80:F4A9–F4B5`
pushes the return value onto the parent stack for a word return profile.

`proof/script/task.mjs` maps **one such call chain**: each script has its own
locals, a word stack and local subroutine continuations.
`proof/script/scheduler.mjs` manages the proven outer order of independent
tasks and their children. The original heap is a [data module](reference/task-system.md#taskallokation)
connected through the optional [running heap binding](reference/task-system.md#laufender-heap);
[frame initialisation](reference/task-system.md#frameinitialisierung) uses it
for payload writes and original slot allocation. `maxDepth` is a safety limit
of the new runtime, not a claim about original task capacity.

## Outer list and saved cursor

| Field / routine       | Origin and function                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `$024C`               | List tail, not list head                                                                                    |
| `$0250`               | Current traversal cursor                                                                                    |
| `$0312,X` / `$0372,X` | Predecessor / successor of an active task                                                                   |
| `$80:C1A6–C1C9`       | Tail and cursor start at `$FFFF`; free slots chained separately                                             |
| `$80:C34A–C365`       | Append an independent task at the tail without moving the cursor                                            |
| `$80:C1CA–C1E2`       | Save the cursor, visit the tail once, restore the cursor                                                    |
| `$80:C1E3–C1F8`       | Walk backwards from the saved cursor to the negative sentinel; only then set the cursor to the current tail |
| `$80:C22F–C238`       | Task not ready: cursor to its predecessor                                                                   |
| `$80:C3A0–C3C8`       | Unlink a finished task from both chains; fix the tail if needed                                             |

The sweep therefore does **not restart at the tail on every call**. After init
its first call can only set the empty cursor to the tail. A newly appended task
is considered in the running traversal only after it completes; its first run
happens immediately in the proven callers (e.g. `$80:91D1` calls `$C34A`, then
`$80:91D4` the single visit `$C1CA`). Children are inserted after their parent
and run at once. If a child yields at a wait, the cursor is on its parent, whose
negative status prevents a second child visit in the same sweep; the previous
independent task follows. If a child ends instead, the parent continues at once;
a new wait or another waiting child is checked only on a later visit.

Scheduler API:

- `addTask(scriptId, args)`: append an independent root; returns a host task
  ID (not an original RAM slot index).
- `visitTail()`: start a freshly appended ready root at once and keep the outer
  cursor (limited to the proven creation flow).
- `sweep()`: traverse backwards from the saved cursor including skipped
  blocked parents; when exhausted prepare the tail for the next call.
- `signalEvents(taskId, bits)`: deliver events to the waiting leaf of this
  chain without checking the counter or resuming.
- `completeNative(taskId, requestId, value)`: complete an implemented host
  action; after a halted sweep the next `sweep()` continues at the remaining
  cursor without rechecking earlier tasks.
- `snapshot()`: copied state with cursor, call chains, last visits and a
  pending native action.

The representation groups connected parent/child nodes as call chains and
addresses the cursor by task ID and frame depth; it maps no general RAM heap.
Unknown native actions suspend the **whole** scheduler (the original would run
their effect synchronously before other tasks; skipping one could corrupt
shared state). Repeated sweeps acknowledge nothing; the snapshot shows
`native_call`.

## Native calls: opcode `$58`

`$80:F4D6` loads the argument word count from `$82:DA4C`; `$80:F4E3–F4EA` pops
them in order to `$0000`, `$0002` and so on, so a native argument list runs
**from the top stack word to the bottom** (unlike script calls). The pointer
comes from `$82:D7B8`, the return size from `$82:D970`; `$80:F526–F529` pushes
`$0000` onto the script stack for a word return. Unknown natives give `status:
'native_call'`; the task stays halted with continuation and arguments; `run()`
alone does not continue it. A game action adapter must implement the real
effect and then call `completeNative(requestId, value)`; the runtime checks the
current request ID and null/word return. No built-in adapter acknowledges
unknown actions.

## European function `$9F`: wait

| Property           | Evidence                              |
| ------------------ | ------------------------------------- |
| Entry              | `$80:C401`, ROM `$004401`             |
| Arguments          | Two words in pop order: mask, counter |
| Return             | One word                              |
| Status / wait mask | `$0BA2,X`                             |
| 16-bit counter     | `$0C02,X`                             |
| Occurred events    | `$0C62,X`                             |
| Readiness check    | `$80:C3C9–C400`                       |

Registration stores mask and counter, clears earlier events and yields. For a
non-zero mask the later check forms `mask & $6FFE & events`; with mask bit 0
set the counter is also decremented (16-bit wrap) and reaching zero adds result
bit 0; both causes can be set together. Only a non-zero result resumes the
script and is pushed as return word. Mask bit 15 or 12 skips the whole check
(counter stands still). An initial counter of zero becomes `$FFFF` and reaches
zero again only after **65,536 checks** (no immediate resume). **Mask zero
removes the current script frame at once** without a readiness check (path
below; it replaced the earlier stop `shared_workspace_required`).

`tick(events)` is one readiness check of the current waiting child; event bits
accumulate for this registration. With heap binding they are in the shared
allocator as event word `$0C62+slot`, cleared by the `$9F` registration at
`$C40E` (including mask zero). The native motion helper
[C9E0](reference/movement.md#c9e0) can set bit 4 on its proven stop path
(visible in the snapshot, evaluated at the next explicit wait check); other
producers (animations, other actions) stay open. No fixed duration per check
follows. Outer scheduler limit: `$80:C211` branches on **every negative status
after a run** to the child successor path, so a script that sets a bit-15 mask
itself can do more than block; the isolated task runner skips its later checks
correctly, but the outer scheduler aborts this not fully derived variant
explicitly; bit 12 is supported as a proven blocking mask.

## Mask zero: frame removal instead of native resume

| Step                            | Evidence / effect                                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Pass arguments                  | `$80:F4E3–F4EA` pops the mask to global `$0000` (explicitly zero); the counter follows at `$0002`                                |
| Register the wait               | `$80:C401–C415` writes status zero, stores the native continuation and yields                                                    |
| Check the end status            | `$80:C219–C21E` detects zero and calls `$C396` to remove                                                                         |
| Free memory and repair the list | `$80:C2BD–C2C7`, `$80:C3A0–C3C8`: busy flag and links change, `$0000` is not written                                             |
| Resume the parent               | `$80:C221–C22C` clears its negative status and resumes it at once                                                                |
| Take the script return          | `$80:F4A9–F4B5` checks the removed child's profile; for a word the parent reads zero from global `$0000`, else nothing is pushed |

The continuation **inside the removed script** never runs (also not its local
subroutines, the code after `call_native $9F` or its later `END`). A child can
still resume its parent in the same visit: a script call takes the shared word
proven by the argument passing; leftover child stack values are no return
values. A directly removed root reports `status: 'removed'`, `result: null`
and empty frames; `removedFrames` holds origin PC, script ID, reason
`zero_mask_wait`, `workspaceWord: 0` and the return profile for the parent. A
resumed root that later reaches a real `END` still reports `ended` with the
child's removal in the log. The scheduler removes such roots and keeps the
correct rest cursor; no host request and no wait check arise.

The zero is **not an assumed start value** of the workspace: the ABI writes it
right before each such registration, and no foreign task visit lies between in
the derived synchronous path, so no general shared memory model is needed for
this cut. Other workspace write paths stay separate limits:

| Workspace path                                          | State                                                                                                                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Script arguments `$80:F477–F47E`                        | Pop order into the shared argument area and reversal on child stack creation proven; overwritten again before a mask-zero registration                                                           |
| Readiness `$80:C3D5–C3F6`                               | Sets `$0000` to zero, forms masked events and timeout bit; no change for blocking bits                                                                                                           |
| Word `END` `$80:F4BE–F4CA`                              | Writes the stack word to global `$0000` and passes it to the parent call                                                                                                                         |
| `END` without return profile                            | The original still pops a word; its possibly uninitialised stack source and general scratch side effect are not implemented here (see [task-system.md](reference/task-system.md#laufender-heap)) |
| Other native actions                                    | Stop until effect and return are really implemented                                                                                                                                              |
| Status zero set by others with an existing continuation | Readiness does not rewrite `$0000`; the status change and foreign last write must be proven first                                                                                                |

Direct page addresses in normal bytecode handlers refer to the script frame,
not to the global argument/return workspace after the switch to direct page 0.
The analysis maps synchronous game language operations; NMI interruptions
between machine instructions and callback effects are not reconstructed here.
The reproducible scan in `analyze:tasks` finds 1,413 static `$9F` call sites in
the 937 script graphs and none with an immediately preceding literal zero push
(a bounded pattern report; computed masks or other paths are not excluded); the
mask-zero tests use explicitly synthetic scripts with expectations derived from
the European machine code.

## Time source: a proven sync point, no browser clock yet

The real NMI entry in bank 00 increments the 16-bit counter `$1C76` at
`$00:C133`. Its indirect callback stays changeable via `$006E`: `$80:C109`
registers address/bank from X/Y and `$80:C14F` jumps through it. In the init
path `$80:9663–9669` selects callback `$80:C152`, then `$80:9671` writes `$81`
to `$4200`. Its [local source contract and manual atomic plan](reference/render-routines.md#c152)
are delivered; the [VM binding](VM-INTERPRETER.md#spiel-nmi-c152) covers an
explicitly observed interrupt call with all eleven children to RTI. Automatic
device, DMA, interrupt and frame chronology stays open.

The [native manual counter wait](reference/render-routines.md#b0a1) keeps
baseline and compare flags with explicit real observations (no
interrupt/callback/input pairing proven). `$81:B0A1–B0AB` reads `$7E:1C76`
once and waits until a later compare gives a different value; in the main loop
path `$80:96AB` calls it. The [main/input flow](reference/render-routines.md#input-flow)
proves the two calls 8877/8076 before 9E1A and the separate held-word/edge
consumers BE6D/BF3B; the NMI counter increments before the callback, which is
no input/callback completion. After further subsystem calls `$80:96C0` runs
the task sweep `$C1E3`; the continuation at `$80:96C6` branches back to `$96AB`
depending on the result of `$80:8000`. So the code has a concrete NMI sync
point before a repeated task sweep (continuations after calls use explicitly
assumed E/M/X modes in the listing). The wait computes **no difference** of
counter values and does not catch up missed NMIs; immediate task visits happen
outside this sweep. Consequence for the port: `sweep()` stays an explicit game
loop pass, without `requestAnimationFrame`, a blanket 50 Hz clock or
millisecond conversion; five checks are not generally five PAL frames or
100 ms.

## Original script `$04B`

CPU `$83:FD61`, ROM `$01FD61`, no arguments or return, header `00 08`.

```text
0000  push_u8 5
0002  push_u8 1
0004  call_native $9F
0006  drop
0007  push_u8 3
0009  push_u8 $FF
000B  push_u8 $38
000D  push_i8 $FF
000F  call_native $4C
0011  end
```

It waits with mask 1 and counter 5; after five checks it drops result word 1
and reaches `$4C` with pop arguments `[$FFFF, $0038, $00FF, $0003]`. `$4C` has
four argument words, no return and entry `$80:C46E`; it picks a table value at
`$80:C4B3`, calls a loader if needed and creates commands for `$81:F007`, which
writes arguments, command and an acknowledgement byte via APU ports `$2142`,
`$2141`, `$2140` (audio link proven; meaning of all arguments, sequence data and
samples open). The task stops at the sound call and reports **no script end**;
no substitute sound is played.

```powershell
npm run analyze:tasks
node tools/run-task.mjs 04B 4
node tools/run-task.mjs 04B 5
node tools/run-scheduler.mjs 5
```

With four checks the status is `waiting`, with five `native_call` for `$4C`.
Execution reads only the extracted `assets/scripts.json`;
`analysis/task-flow.asm.txt` holds the provenance listings (E/M/X after machine
calls are explicit assumptions). `run-scheduler.mjs` appends two original
instances and starts them at once; a separate first `sweep()` prepares the empty
cursor; then up to five sweeps run; in the fifth the newer task reaches `$4C`
while the older still has counter 1 after four checks; the scheduler stops with
both states.

## Tests and remaining limits

- Task tests: the original script up to the sound call, calls of original
  quantity test `$197` from an explicitly synthetic parent, argument order,
  kept parent variables, waiting children, return values, combined
  event/timer readiness, all 65,536 counter wrap steps, fault limits; ROM
  signatures pin the wait and ABI routines.
- Scheduler tests: order of several roots, initial cursor, later appends,
  removed tail nodes, blocked parents, child end in the same visit, a new
  waiting child after a return, event/timeout combinations, bit 12, counter
  wrap, native resumes without double checks, explicit fault limits; two
  `$04B` instances check the audio limit together; list traversal and NMI sync
  pinned by ROM bytes.
- Mask-zero tests: immediate root removal for both return profiles, counter
  limits, skipped unimplemented continuations, local subroutines, kept parent
  state, both child return profiles, removal after a positive waiter, intact
  request IDs, snapshot copies, traversal to the older root; release and parent
  return paths pinned by ROM signatures.
- The first five native state actions run their real effect through a host
  adapter before the request is completed ([state actions](reference/task-system.md#zustandsaktionen));
  the adapter continues the rest cursor and acknowledges no unknown action.
  With a slot state it also runs `$B9`: shared slot releases of two original
  `$060` instances on fixtures keep order, cursor and exactly one check of
  another waiting root ([slot state](reference/slots.md#slotzustand)). The
  `$A9` paths without an extra task are implemented: two independent creators
  occupy slots `$56/$54` in backward task order without checking the other
  waiter again (not an insertion during a pending request). [Task creation by
  `$A9`](reference/task-system.md#a9-taskerzeugung) adds the heap-mode path;
  without allocator `slot_task_creation_required` stays
  ([slot creation](reference/slots.md#sloterzeugung)).
- The full routines of `$B9`/`$80:AA4C` are statically captured: they reset
  fields and change two further data lists, without direct access to the
  ported script task list. The positive script word path of `$A9` with its
  workspace writes and insertion via `$80:C366` is implemented through task
  creation by `$A9`.
- Native `$56` sets two proven words; `$10A/$10B` end after one check each
  without extra scheduler passes. Open: general workspace, further task
  creation/abort actions, negative wait masks and a fully proven browser timing.
  For audio the proven `$4C` path leads to loader, sound tables and APU driver,
  whose data must go into an own sequencer/mixer.

These are code proofs and host tests, no hardware trace comparison or browser
run; the modules need neither Node APIs nor an emulator.
