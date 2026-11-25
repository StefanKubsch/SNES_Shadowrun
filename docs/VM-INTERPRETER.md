# Native event interpreter: reference contracts

This document describes the register-level interpreter and recorded replay
contracts retained for verification. The product's current module layout is in
[VM-ARCHITECTURE.md](VM-ARCHITECTURE.md); active work is in
[STATE-MODEL-REBUILD.md](STATE-MODEL-REBUILD.md) and
[PROJECT-STATUS.json](PROJECT-STATUS.json). CPU-frame requirements below apply
to the proof/replay path, not to new game code.

The former per-native delivery log and route results remain in Git history.
[NATIVE-MODULES.md](NATIVE-MODULES.md) and [reference/](reference/README.md)
provide routine lookup. References to src/task/ in older reports describe the
earlier layout; current adapters are in src/script/ and frozen equations in
proof/.

## Structure

| File                                                 | Content                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [memory.mjs](../src/vm/memory.mjs)                   | `VmMemory`: WRAM (128 KiB, one `Uint8Array`), LoROM (1 MiB), arithmetic unit `$4202–$4217`. Mapping like `renderAddress`. Unmapped accesses throw `VmFault`. Optional SRAM (8 KiB, banks `$70–$7D`/`$F0–$FD` below `$8000`, mirrored); without supplied content accesses stay faults. |
| [handlers.mjs](../proof/vm/handlers.mjs)             | One handler per opcode family with original address. `OPCODE_TABLE` lists all 98 even opcodes `$00–$C2` with original target.                                                                                                                                                         |
| [native-call.mjs](../proof/vm/native-call.mjs)       | Bridge `$F4F6`, jump via DP `$A2`, resume `$F509` (native, flag-exact); `NativeCalls` binds admitted targets.                                                                                                                                                                         |
| [task-accessor.mjs](../src/vm/task-accessor.mjs)     | Thin adapter: the accessor interface of the proven modules directly on `VmMemory`, without a log; access limit per native against cyclic data.                                                                                                                                        |
| [scheduler.mjs](../proof/vm/scheduler.mjs)           | `TaskScheduler`: task management, heap, scheduler, script call `$F488` (child task), native wait `$C401`, resume `$F495`/`$F509`.                                                                                                                                                     |
| [devices.mjs](../src/vm/devices.mjs)                 | Hardware environment of the natives: `ObservedDevices` supplies one observation set per native call (device reads, wait and input words).                                                                                                                                             |
| [special-natives.mjs](../src/vm/special-natives.mjs) | Special natives with hardware values: target → proven module.                                                                                                                                                                                                                         |
| [interpreter.mjs](../proof/vm/interpreter.mjs)       | `ScriptInterpreter`: registers `a x y s d dbr p pc`, stack/stream helpers, `fetch()` like `$F389–$F390`, `run(maxOpcodes)`.                                                                                                                                                           |

State between two opcodes as in the original at `$80:F390`: X = A = opcode,
Y = offset in the bytecode, D = task frame (`[D]` = bytecode pointer, locals
from D+$13, local return pointer D+5), DBR = script bank, S = operand stack.
The constructor checks the ROM jump table `$80:F2B4` against `OPCODE_TABLE`
once. `run()` ends with an exit code:

| Code                 | Meaning                                                         | State afterwards             |
| -------------------- | --------------------------------------------------------------- | ---------------------------- |
| `EXIT_END`           | `$56`: result to DBR:0000, outer stack from DBR:01F2            | PC = outer return + 1, D = 0 |
| `EXIT_STATUS_RETURN` | `$F927` (unused opcodes and JMP prefixes `$54/$90/$98/$A0/$A8`) | Bit 2 in DBR:01BE/01C0, RTS  |
| `EXIT_NATIVE_CALL`   | `$58` up to before TCS at `$F4F6`; `exitId` = native ID         | Arguments in the workspace   |
| `EXIT_SCRIPT_CALL`   | `$52` up to before TCS at `$F488`; `exitId` = script ID         | Arguments in the workspace   |
| `EXIT_BUDGET`        | Opcode budget used up                                           | At `$F390`, resumable        |

Faults (`VmFault.reason`): `decimal_mode` (like the oracle), `opcode_unknown`,
`unmapped_read`/`unmapped_write`, `opcode_table_mismatch` and
`original_endless_loop` (the remainder calculation `$70–$76` doubles endlessly
in the original when A drops to 0 through divisor 0 or overflow; the VM core
reports this instead of hanging).

## Native calls (M1c, part 1)

With `vm.natives = new NativeCalls(vm, {admitted, implementation})` a `$58`
with an admitted target continues without exit: bridge, proven native module
(`nativeTarget` from `src/script/native-targets.mjs`) via `TaskAccessor`, RTS to
`$F509`, resume with the task frame from `DBR:0250/0252`, result to
`DBR:0000` and next opcode. Admitted are the `nativeOpcodeTargets`. Targets
not admitted end with `EXIT_NATIVE_CALL`; `$C401` (suspension) is continued by
the scheduler; special natives with hardware values run with an observation
set (part 3).

Frame layout: `[D+0..2]` is a 24-bit pointer (bytecode, script bank), `D+3`
saved PC, `D+7` saved operand stack, `D+9` native/script ID. Module errors
(`taskStop`) become `VmFault('native_boundary:<reason>')`; more than 4 million
memory accesses in one native become `native_access_limit`.

## Task management and scheduler (M1c, part 2)

`new TaskScheduler(vm).call(entry, budget)` calls an original routine as if
by JSR (return word at S+1) and runs until it returns:

| Entry            | Original                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| `$C1A6`          | Init: free list 0 → 2 → … → `$5E`, empty task list, one free heap block `$7CC`                       |
| `$C34A`          | Create a task for script X (frame via `$C2C8`/heap `$C242`) and link it as list head                 |
| `$C1E3`          | Round: visit all tasks from the cursor, then cursor = list head                                      |
| `$C1CA`          | Visit only the head task, restore the cursor                                                         |
| `$C1F9`          | Visit task X: readiness `$C3C9`, saved continuation or entry `$F378`                                 |
| `$C20B`          | Post-run: start a new child task at once, release a finished task (`$C396`), resume a waiting parent |
| `$C396`, `$C3C9` | Release a task, check readiness                                                                      |

Inside a task the interpreter runs; the scheduler continues its exits: `$52`
via `$F488` and `$C36A` (child task before the parent, parent waits with
`$0BA2 = $FFFF` and continuation `$F494`), `$58` with target `$C401` via the
bridge (wait mask/counter from the arguments, continuation `$F508`), END and
status return via the RTS to `$C20B`. Continuations run via `$F495` (script,
result from `$82E623`) or `$F509` (native, `$82D970`).

Task tables (index X = 2 × slot, 48 slots, DBR = `$80`): `$0252` frame,
`$02B2` continuation, `$0312` next, `$0372` previous, `$0BA2` wait mask,
`$0C02` counter, `$0C62` events; `$024C` list head, `$024E` free list, `$0250`
cursor. Heap from `$03D2` with block header [size | `$8000` busy, next], data
from +4. Details of heap and list semantics: [task-system.md](reference/task-system.md).

The scheduler keeps no own flow state: all returns are on the 65816 stack as
in the original, `vm.pc` names the location. Results of `call`/`resume`:
`STOP_RETURNED` (back at the caller), `STOP_BUDGET` (at `$F390`, resumable),
`STOP_NATIVE` (native without implementation, VM at `$F4F6`), `STOP_FRONTIER`
(continuation outside the scheduler). Cyclic lists hang endlessly in the
original; the VM core reports `original_endless_loop`.

After a native stop the owner can supply the missing observation set and call
`resume()` directly. The scheduler checks the target freshly and runs its
bridge, native and F509 from F4F6; arguments and opcode are already consumed.
With budget zero this continuation ends before the next opcode at F390;
without a matching set the stop stays unchanged.

## Special natives and hardware observations (M1c, part 3)

Some natives read values the VM core does not compute: PPU counters
`$2137/$213C/$213D` (random), PPU product `$2134/$2135`, APU ports
`$2140–$2143`, the NMI-counted frame counter `$01F6/$01F8` in wait loops and
the joypad word `$01CA`. They come only as observations from
`NativeCalls({devices})`, one set `{target, io, wait, input}` per native call
in call order (`ObservedDevices`). The arithmetic unit `$4202–$4217` stays part
of `VmMemory`.

| Target                             | IDs                        | Content                                 |
| ---------------------------------- | -------------------------- | --------------------------------------- |
| `$FEC1`                            | `$C8`                      | Hint/note (text window, wait for frame) |
| `$FF79`                            | `$A7`                      | Clear text window                       |
| `$F953`                            | `$A3`                      | Wait for a button (counter, joypad)     |
| `$9BA0`                            | `$13`                      | Action menu                             |
| `$C46E`                            | `$4C`                      | Sound (APU handshake)                   |
| `$C51F`, `$C560`                   | `$3E`, `$63`               | Random (PPU counters)                   |
| `$8E36`                            | `$7C`                      | Slot loop with random                   |
| `$933A`, `$BBA0`                   | `$9A`, `$1A`               | Selection                               |
| `$935B`, `$CBF7`, `$CD20`, `$CD43` | `$D7`, `$74`, `$BF`, `$72` | Modal dialogs                           |

The implementations are the proven modules (`src/task/native-*.mjs`) via
`TaskAccessor`. The accessor checks device reads against PC, address and width
of the next observation (`device_observation_required`; leftovers
`device_observation_unused`); device writes go to `devices.write` (no effect
without a device model). Without a set for the target the native does not run:
the interpreter ends with `EXIT_NATIVE_CALL`, the scheduler with `STOP_NATIVE`.
Mesen recordings (M2) or device models supply these sets.
`TaskScheduler.stopAt` is an optional breakpoint (`STOP_BREAK`) for tests; in
the game it costs one comparison per scheduler step.

## Evidence

Reference differentials compare registers, flags and all 131,072 WRAM bytes
from the same start state; faults must agree. Arithmetic/device observations
carry the original PC. A native-bridge comparison checks the binding, not an
independent implementation of the callee. Equation/source tests and Mesen
comparisons provide that separate evidence.

| Layer                                                  | Evidence                                                                                                                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opcodes and admitted natives                           | [vm-differential.mjs](../tools/vm-differential.mjs), [vm-interpreter.test.mjs](../tools/vm-interpreter.test.mjs)                                                             |
| Scheduler, child calls, readiness and parent resume    | [vm-scheduler-differential.mjs](../tools/vm-scheduler-differential.mjs), [vm-scheduler.test.mjs](../tools/vm-scheduler.test.mjs)                                             |
| Hardware-dependent natives and observation consumption | [vm-special-natives-differential.mjs](../tools/vm-special-natives-differential.mjs), [vm-special-natives.test.mjs](../tools/vm-special-natives.test.mjs)                     |
| Earlier individual bodies                              | [vm-body-specs.mjs](../tools/vm-body-specs.mjs): 1,503 cases of 219 specs matched once (682 complete, 821 to suspension); some fixtures use synthetic bytes and observations |
| Original game runs                                     | [MESEN-ORACLE.md](MESEN-ORACLE.md), [BOOT-ORACLE.md](BOOT-ORACLE.md)                                                                                                         |

The 2026-10-14 static result was 937/937 scripts with no missing native.
Run npm run analyze:vm-coverage to rebuild the reachable-native ranking in
[vm-coverage.json](../analysis/vm-coverage.json). Static suitability is not a
runtime or playthrough claim. No new individual body specs are needed.

## Source qualification

"Against the original" means equation tests against
[w65c816-reference.mjs](../tools/w65c816-reference.mjs), a test-only evaluator
for the instructions exercised by the contract. Comparisons cover registers,
flags, WRAM, arithmetic and hardware accesses with the original PC. "Mesen"
means an actual emulator run; synthetic device answers are different evidence.

Static stack proofs admit explicit lemmas only: dataPulls, indexPulls,
externalReturns, peiWordPushes, pullKinds, indirectTargets and interruptReturns.
They describe allowed stack sources, counted external returns, pinned jumps
and interrupt returns. They grant no scene, caller or timing authority beyond
the relevant contract.

## Main loop and scene references

The recorded main interval connects 80:96AB with the real scheduler round
80:C1E3 through [main-driver.mjs](../proof/vm/main-driver.mjs). Budgets,
missing natives, unknown continuations and breakpoints preserve reached state.
A changed return word is not repaired. Entry/owner/budget checks precede
observation consumption; execution after entry is not an atomic transaction.
See [main-driver.test.mjs](../tools/main-driver.test.mjs).

The direct live caller and its lag-free contract are in
[MAIN-LOOP-LIFT.md](MAIN-LOOP-LIFT.md). Scene selection, Matrix and cutscenes
are documented in [SCENE-REQUEST-LIFT.md](SCENE-REQUEST-LIFT.md) and
[MATRIX-LIFT.md](MATRIX-LIFT.md). Whole-scene recorded tests use the callback
installed by the actual scene data program. Completing a local routine proves
neither a whole scene nor an automatic frame clock.

## Explicitly called Matrix and intro NMIs

[main-matrix-nmi.mjs](../proof/matrix-reference/main-matrix-nmi.mjs) follows the native
vector `$00:FFEA = C112`. `runObservedMatrixNmi` receives the really
interrupted register state and pushes PB, PC and P onto its stack through the
shared flow in [observed-nmi.mjs](../src/system/nmi-call.mjs). The handler
runs in program bank **00**. Its first WORD read of `$4210` still uses the
interrupted DBR and needs that observation. Only after the stack switch to
`$1CBB` and saving A, X, Y, DBR and D does it set D = 0 and DBR = **00** via
PHK. It increments `$1C76` **before** the callback, so a changed wait counter
is no proof of a finished callback. `JSL $80:C14F` and `JML [$006E]` share one
long return frame. Callback `$81:BEC3` enters with S = `$1CAE`, D = 0, DBR = 0
and WORD registers; it uses the existing `$ED8B` OAM request, writes palette
and scroll registers, clears the original text line and calls `$B1E2`, then
text cursor and the original input read via `$F290/$9E0B`. The outer handler
restores the saved registers and the stack freshly read from `$7E:1C7A`; RTI
pulls P, PC and PB without RTS increment. Foreign callback targets, emulation
mode and a different vector are rejected before writes. Only an explicit call
runs this path; poll values never schedule an interrupt.

`$B1E2` saves P, forces WORD A and BYTE indices and checks `$174A`. Zero leaves
queue and DMA registers untouched. Otherwise it saves S in `$0032`, sets S to
`$113D` and pulls eight-byte jobs from `$113E`: WORD length, BYTE VRAM mode,
BYTE source bank, WORD source address, WORD VRAM address. Each non-zero length
creates the original channel 0 request at `$420B`; a zero word ends the list.
Then it reads the saved S freshly, clears `$1748/$174A`, writes BYTE 0 to
`$420B` and restores P. Neither the producer counter nor an invented maximum
bounds the reading (missing termination reaches the diagnostic access guard);
no source data are copied and no DMA effects computed.
[main-matrix-nmi-source.mjs](../tools/main-matrix-nmi-source.mjs) pins three
graphs with 168 instructions and 407 bytes plus vector and palette table; the
normal stack proof holds for `$BEC3` under its three helper contracts; separate
source lemmas describe the two TCS flows and their stack areas (no general
stack alias or ownership guarantee).
[main-matrix-nmi.test.mjs](../tools/main-matrix-nmi.test.mjs): 192
callback/queue cases and 96 NMI cases vs. original, all own instructions; stack
wrap with a valid hardware frame, counter wrap, fresh DP32, changed follow-up
jobs, wrong vector, real shared text/map producers. Device answers and
interrupt occurrences are synthetic.

The intro callbacks in [main-intro-nmi.mjs](../src/system/main-intro-nmi.mjs) (the sprite
grid `$E83A`, `$E971` and `$DF0E` lifted in src/intro; their register-level
reference was retired on 2026-11-25) use the same outer NMI flow:

- `$DAD6` first requests the current OAM buffer via `$ED8B` and jumps on the
  existing long frame to `$D9D5`, where PHK sets DBR `$81`. Two lists of eight
  animation places each use the original tables `$DADD`, a quarter or eighth
  of DP1E as horizontal subtraction and the low two or three bits of `$11A2`
  as stepping condition. The first `$FFFE` end resets to offset `$3C`; the
  second list takes negative end words unchanged. After `$EE0C` the two time
  lists `$DB8B/$DBE1` are read freshly up to the first different time; equal
  time words can trigger several creations. `$E900` uses the sound helper
  `$F007`; `$E971` allocates the first negative place of the second list
  backwards; a full list changes no animation or coordinate words.
- `$DF0E` also sets DBR `$81` and processes nine places from X = `$10` to 0;
  place X = 4 gets sprite flags `$2200`, the others `$2000`; after stepping by
  two negative follow words are taken; `$FFFE` resets to offset `$36`.
- Both callbacks increment `$11A2` and read input via `$F290` at the end;
  because of DBR 81 these device observations belong to `$81:4212/$81:4218`
  (the Matrix variant reads in DBR 00); the outer NMI still restores the
  interrupted DBR fully.
- Shared sprite helper `$E83A` reads five WORD tables (tile flags, columns,
  rows, coordinate corrections), builds the original grid in the OAM buffer
  and adds the BYTE high-X mask for negative X. Branch `$E8C4–$E8DF` runs with
  M1 and X0 (`LDA #0` at `$E8C6` and `AND #3` at `$E8D1` are BYTE
  instructions); PHB/PLB keeps the incoming DBR; loop counters and scratch
  words stay fresh; OAM writes aliasing across banks are not cached; zero
  counters keep the WORD do-loops; no invented OAM capacity limit.

[main-intro-nmi-source.mjs](../tools/main-intro-nmi-source.mjs) pins four
graphs with 284 instructions and 568 code bytes plus four data windows with
964 bytes; own stack areas 3–9 bytes under separate helper contracts (the
whole NMI stack ownership stays open).
[main-intro-nmi.test.mjs](../tools/main-intro-nmi.test.mjs): 240 synthetic
cases each plus animation end cases, 80 callback comparisons with real
helpers, 48 NMI comparisons to RTI, BYTE masks, full allocation, missing or
misaddressed device values, an OAM/DP20 alias across the bank boundary, and a
case where the hardware frame overwrites the callback pointer (the later JML
reads and checks the fresh target). The real `$D60F` scene build installs
`$DAD6`; 16 explicitly given NMI calls then work on the same memory including
both fade-in lists.

## Scene initialisation 9629

[main-initialize.mjs](../proof/system/main-initialize.mjs) binds the complete
original init call `$80:9629`. Entry E0/M0/X0, D0, binary arithmetic and the
real DBR with valid memory/device addresses. It first writes BYTE `$420D=1`,
`$4200=0`, `$420C=0`; then display defaults `$B064`, portrait reset `$8FB3`,
glove reset `$BC1A`, camera lists `$891A`, palette list `$8CB9/$81:8000`,
sprite allocations `$A840/$A772`, font build `$AB2C`, task/heap reset `$C1A6`,
scene markers `$CC44`, menu markers `$E41B`, music markers `$EF26`. Task init
discards the previous task list (no running tasks resume). `$A840` is reused
by sprite build `$B8DE`.

- `$A772` sets the original free tile chains including ADC without a new CLC
  in the loop; the DMA request with source `$81:A7FB` does not clear a host
  OAM buffer.
- `$AB2C` requests the original graphics/palette data `$95:F160/$95:F140`
  and loads the ROM font streams via `$AA9C`, the existing `$9F49` and `$A9B2`
  into the same WRAM buffer; then clears the request markers and calls `$A9E1`
  directly (no invented NMI).
- `$AA9C` first checks the fresh cache value `$0214`; the active path sets it
  before unpacking. Its table index uses the ASL carry; the saved index is read
  freshly from the stack after unpacking. The palette bank word is masked to
  `$00FF` and selected via XBA/PHA/PLB/PLB; six BYTE reads and write requests
  follow with this real DBR; `$01FE` is also written before the caller DBR is
  restored.
- `$A9E1` keeps the four original phases `$01F6/$01F8/$01FA/$01FC`, chunk
  limit `$1401`, fresh parameters and late marker clears. The BYTE read `$213A`
  at `$81:AA8E` needs a matching device observation; register addresses in DBR
  `$7E` are WRAM instead.
- Only after all returns does `$C109` install callback `$80:C152` in DP
  `$6E/$70`; then BYTE `$4200=$81`, TSB `$01BE` with `$13` and two zero
  requests each to `$2112/$2111`. RTS keeps M0/X0 and the incoming DBR. The
  registration runs no interrupt.

[main-initialize-source.mjs](../tools/main-initialize-source.mjs) pins 16
graphs, 490 instructions and 1,275 code bytes; own protected stack areas 2–6
bytes, the connected graph needs 11 bytes under the separate unpack/render
contracts (no global stack or termination guarantee).
[main-initialize.test.mjs](../tools/main-initialize.test.mjs): 80 synthetic
cases each with all own instructions, 16 connected runs with real ROM font
streams; counter-probes for missing device values, wrong bank/width, ASL
carry, a changed saved index and the callback pointer as alias of the outer
return word (both executions take the fresh word; the calling return contract
rejects the changed target). `$CC4B` reaches the real init and then the fully
bound transition `$A4BF`.

<a id="spiel-nmi-c152"></a>

## Game NMI C152

[main-game-nmi.mjs](../proof/replay/main-game-nmi.mjs) binds the installed
callback `$80:C152` with its eleven original children to the shared VM memory
and real JSR/JSL frames. Order: `$8949`, `$A9E1`, `$999A`, `$80C4`, `$A919`,
`$A958`, `$A98E`, `$8FBA`, `$9E0B`, `$C06B`, `$B0D1`.

- `$8949` checks camera lock `$0CD8` and sprite job `$1562` before running
  the proven tail `$8954`; `$A9E1` and `$9E0B` are reused.
- Palette and tile jobs see `$1562` before it is cleared in `$A98E`. `$999A`
  keeps the carry of the fifth ASL for the source offset; `$A919` keeps the
  carry for the WORD source offset and the BYTE palette index. Lists,
  parameters, direct page pointers and register shadows are read freshly;
  WORD loops keep their wraps, even after an initial ASL to zero.
- `$C06B` distinguishes the three graphics sources and writes its OAM tail
  even without a graphics job. `$B0D1` decrements the WORD counter including
  wrap and re-reads the fade job; both brightness end points clear the job.
- The C152 tail reads five single shadow bytes right before their port
  requests (it sees the just changed brightness). The final WORD A keeps the
  high byte and N/Z of the last BYTE LDA. All routines keep the real DBR; port
  offsets in bank `$7E` are memory accesses.

`runObservedGameNmi()` uses handler `$00:C112` with vector check, hardware
frame, separate handler stack, fresh indirect callback pointer and RTI; the
handler sets D0/DBR00 for C152 and restores the interrupted registers including
D, DBR and status. Device reads need the real PC, address and width: `$4210`
before the DBR switch, optional BYTE `$213A`, WORD `$4212` until bit 0 is
clear, then WORD `$4218`. Missing values stay limits; direct VM execution keeps
earlier effects at such a limit (not an atomic plan).
[main-game-nmi-source.mjs](../tools/main-game-nmi-source.mjs) pins the same
complete graph as the [C152 source contract](reference/render-routines.md#c152):
1,027 bytes, 419 instructions, six protected return bytes, no external return
assumption (a local stack proof; handler and hardware frames have their own
contract). [main-game-nmi.test.mjs](../tools/main-game-nmi.test.mjs) compares
own equations, the whole callback and full NMI calls to RTI with the original
instructions; the real init installs C152, and original palette and fade
producers then create consumed jobs on the same memory. Interrupt occurrences
and device values are synthetic inputs.

## Waits and input with explicitly given interrupts

[main-wait-interrupt.mjs](../src/system/main-wait-interrupt.mjs) connects
`$81:B0A1`, `$80:9E1A` and `$81:EEBB` with the NMI handler up to RTI. A shared
`events` object holds `interrupts` as a frozen array of frozen `{pc, nmi}`
records, `interruptIndex: 0` and `interruptRoutines` as explicitly chosen
callback table (for example `GAME_NMI_ROUTINES`). Every reached original
instruction of these routines consumes exactly one record: `nmi: false` states
that no interrupt occurs before this instruction; `nmi: true` calls the handler
before it with the real interrupted registers.

- Device values are in the accessor's chronological IO list. The handler
  changes the shared WORD counter and C152 reads the joypad via `$9E0B`; the
  wait and input routines inject no counter or input observations in this
  mode.
- `$B0A1` saves its WORD start value and compares freshly each time. `$9E1A`
  reads input separately for edge and copy (an NMI between the reads can give
  different values); flags between compare and branch stay original. Exactly
  `$3030` stops after the earlier direct writes at the open reset limit
  `$9E2F`.
- `$EEBB` saves P, sets M1 and polls BYTE `$4212` or compares the low counter
  byte depending on DP `$30`; A's high byte and the PHP/PLP frame stay. The NMI
  still increments the whole WORD counter, also at `$00FF` and `$FFFF`. Its
  RTI must restore all interrupted registers; if a stack alias changes the
  return, the native continuation stops with `wait_interrupt_return_required`
  (effects already executed stay in VM memory).
- The shared B0A1/9E1A bindings of main loop, scenes, `TALK_ROUTINES`
  and the wait in `$CC4B` choose this flow as soon as `events.interrupts`
  exists; the older APIs with single wait and input values keep their
  contracts. The array is no general interrupt plan for all game code. At the
  end of a bounded job `finishInterruptObservations(events)` rejects unused
  records; missing, mutable, misordered or exhausted records stop at the named
  original PC without invented progress.

[main-wait-interrupt.test.mjs](../tools/main-wait-interrupt.test.mjs) uses the
pinned source and stack contracts of the three roots; the reference side runs
the full original handler and C152 to RTI; registers, shared WRAM and all
device accesses compared with interrupts at every reachable instruction, WORD
wraps, M/X widths, fresh input reads and unchanged polls. A synthetic main loop
pass checks both original call frames and the shared interrupt stream (other
helpers stubs). No automatic clock, DMA effect or frame chronology.

## WORD job polls and transfer limit

The four original WORD loops `$81:ACAF` (`$01F8`), `$ACBD` (`$01F6`), `$ACC3`
(`$01FA`) and `$ACC9` (`$01FC`) use the same interrupt stream. Each LDA reads
shared memory freshly; the following BNE keeps its flags even after an NMI. An
already zero job returns without invented interrupt; while non-zero each
further instruction needs its own record. The request routines `$ACB5`,
`$AEF4`, `$AEFC` run INC, real JSL and RTL (WORD wrap `$FFFF` → 0 kept).
[main-word-wait-interrupt-source.mjs](../tools/main-word-wait-interrupt-source.mjs)
pins 48 bytes and 21 instructions; closed local stack proofs with three
protected return bytes for a poll and six for request plus poll (the interrupt
keeps its separate frame contract).

`waitForTextMapUpload` and `requestTextMapUpload` choose the new mode directly;
`runTaskTextWait` gets the shared set via `interruptEvents`; `$FE69/$FB39` and
all six adapters to `$F963` pass it on, so the full window allocation consumes
its `$ACBD` and `$ACB5/$ACAF` frames on the same memory as C152. Its return
adapter distinguishes real executed RTL returns from the older helper
equations whose frames it removes itself. Single wait values and their
counters are neither written nor consumed in this mode. On the text path
`$AEFC/$ACC9` a cleared `$01FC` alone is not enough: `$A9E1` also requests 16
bytes from VRAM to `$7E2AE0`; the former limit before RTL at `$81:ACCE` is
closed by the observed transfer contract below. An already zero job or an INC
wrap returns without invented transfer and reads existing memory.
[main-word-wait-interrupt.test.mjs](../tools/main-word-wait-interrupt.test.mjs):
252 synthetic poll/request cases and twelve complete F963 allocations vs.
original including the whole NMI handler and C152 to RTI (instruction
positions, DBR, flags, INC wraps, multi-part `$01F6` jobs, unchanged polls; two
consecutive real requests share one record/IO stream; both text paths run
their real RTL and stop inside the NMI at the transfer start instruction when a
required transfer is missing).

## Observed DMA masks and further wait callers

[main-dma-readback.mjs](../proof/system/main-dma-readback.mjs) takes exactly one
observed channel 5 transfer at the original BYTE STA `$81:AA93`. The shared set
holds `dmaTransfers` and the running `dmaIndex`; array, records and each
`bytes` array must be frozen. A record has `pc: 0x81AA93`, `address:
DBR:420B`, `width: 1`, `value: 0x20`, `dmap: 0x81`, `bbad: 0x39`, `a1b: 0x7E`,
`a1t: 0x2AE0`, `das: 16`, `vmain: 0x80`, `vmadd` and exactly 16 BYTE values in
`bytes`.

- DMAP, BBAD and A1B are observed, persisting device state; their original
  values are proven by the pinned init instructions in `$AB2C` but not assumed
  as current state. A9E1 writes the other registers right before. `vmadd` must
  equal the fresh WORD from `$020E` really written to `$2116`, including its
  high byte. DMAP `$81` means direction B to A, mode 1, increasing A address:
  alternating BYTE sources `$2139/$213A`, targets `$7E2AE0..$7E2AEF`. The
  original BYTE read `$213A` at `$AA8E` stays its own earlier IO record (not
  one of the 16 bytes).
- Only a fully checked record writes its bytes in order to shared WRAM,
  without changing CPU registers, flags or stack; then the original REP and
  WORD clear of `$01FC`. Missing, wrong or mutable records stop with
  `text_dma_observation_required` at `$AA93` (the port request and earlier
  effects stay; mask bytes, record index and clear do not happen). Unused
  transfers are rejected by `finishInterruptObservations`. A DBR port alias in
  WRAM performs only the original memory writes and consumes no transfer.
  Without interrupt/transfer mode the older A9E1 request ledgers stay; the
  manually atomic render plans get no automatic DMA effect.
- The direct counter adapters in portrait animations, `$8691`, menu and
  `$F953` pass the same set via `interruptEvents`; F953 and menu then read
  input via the real `$9E1A` without writing old input values; F254 and 8691
  pass the set on to F953; the return of `$9E1A` contains the real removed
  return bytes for the callers; the menu adapter `$FA67/$ACBD` uses the shared
  WORD poll.
- The three inline loops `$80:901C` (`$0140`, BPL), `$AE0C` and `$AE5E`
  (`$1562`, BNE) consume records before LDA and branch; the real callback sets
  `$0140` negative and empties tile jobs; the following DP $82 and `$1562`
  reads use this memory; old extra `nmiWords` are not written in this mode.

[main-dma-readback.test.mjs](../tools/main-dma-readback.test.mjs) compares the
original A9E1 register stores with an independent synthetic transfer device,
checks every physical BYTE target address, clear order, register, direction
and width faults, unchanged neighbour bytes and several occurrences; full
FE69/FB39 and menu abort runs use the pinned original instructions including
NMI and RTI; extended wait tests cover whole F953/portrait flows, menu requests
and inline tile polls. The hardware basis of this readback is recorded in
[BOOT-ORACLE.md](BOOT-ORACLE.md#nintendo-sources).

## BYTE fade poll with the installed callback

The inline poll `$81:CF4C/$CF4F` in `$CDF8` consumes one record before BYTE
LDA and one before BNE in interrupt mode. It reads `$DBR:11A3` freshly and
keeps A's high byte and the existing caller frame. An NMI between LDA and BNE
does not change the loaded flags: even if `$D479` sets the brightness byte to
zero, the original branch is taken. Without interrupt mode the separate BYTE
observation API stays valid. The locally proven callback `$81:D479` is now an
admitted target of the shared `runObservedNmi`: its real ED8B call, scroll and
brightness progress and F290/9E0B run on the same memory; it ends with M1 and
only the surrounding handler restores P, A, X, Y, DBR and D and returns by RTI.
[main-fade-interrupt.test.mjs](../tools/main-fade-interrupt.test.mjs) uses the
pinned original CDF8, D479, ED8B, NMI and input instructions: full NMI return
in BYTE/WORD modes, DBR variants, stack wrap, non-zero interrupted DP and
different scroll branches; the inline poll checks brightness up to `$FF`,
unchanged neighbour bytes, earlier LDA flags and missing records/device values.
Eight whole CDF8 cases use the callback installed by the real data program
(four selections with and without early button press); the audio helpers get
the original directory pointer as precondition and synthetic matching APU
answers.

## Observation stream through native and VM entries

The observed adapters for hints, windows, menus, dialogs, target choice,
player control and combat pass `options.interruptEvents` on.
[observed-native-events.mjs](../proof/replay/observed-native-events.mjs) binds the
interrupt/DMA lists, their running indices and the chosen callback table to the
local event set; indices stay live references to the same outer set (a
sub-call replays no earlier occurrence). The old wait/input lists keep their
own counters and contracts; in interrupt mode they are not used as writers, and
unconsumed old values are still rejected at the limit.

`observationSet(target, {io, interrupts, interruptRoutines, dmaTransfers})`
freezes the optional interrupt and transfer records including transfer bytes.
`NativeCalls` creates one consumption set per special native, passes it into
the real helpers and checks at the end that all interrupt, transfer and IO
values are consumed; transfers without an interrupt set are rejected. After a
nested round further IO, interrupt and transfer records may be appended to the
existing set (consumed positions stay). The outer round's accessor gets its own
registers and IO position back while inner natives use their separate sets.
Direct observed callers close their shared set with
`finishInterruptObservations`. Speculative `prepareTaskPlan` calls reject a
live interrupt set before execution with
`task_interrupt_direct_execution_required` (no external cursor may be consumed
before a successful outer commit); atomic render plans keep their separate
request API.
[vm-interrupt-observations.test.mjs](../tools/vm-interrupt-observations.test.mjs)
compares F953 via the VM bridge and resume with the proven Native58
composition, including two real NMIs with fresh joypad; hint windows with mask
DMA, window clearing, window lists, glove switch-off and ammunition display
agree via the observed entries with their direct helper compositions; further
cases check missing and unused records and the rejection of speculative
execution; an explicitly synthetic outer native with two real B0A1/NMI calls
checks appending after a round and the kept consumption index.

## Connected boot, owner and route coverage

The reference chain uses [main-reset.mjs](../proof/replay/main-reset.mjs),
[main-startup.mjs](../proof/replay/main-startup.mjs),
[main-frontend.mjs](../proof/replay/main-frontend.mjs) and
[main-start.mjs](../proof/replay/main-start.mjs) for reset, prelude, menu owner
and new/load entry before the first scheduler round. These are proof/replay
contracts; current frontend composition is documented separately.

[main-boot-connected.test.mjs](../tools/main-boot-connected.test.mjs) connects
the same owner through boot, menu selection, task rounds, morgue movement,
object selection, actions, pickup, inventory, doors, street dialog and the
alley fight. [main-boot-round-reference.mjs](../tools/main-boot-round-reference.mjs)
and [main-boot-reference-view.mjs](../tools/main-boot-reference-view.mjs) keep
comparison state private, publish successful visits only and preserve work,
output and stack ownership checks. The narrow DEC7 SRAM contract reads camera
word 70:1FFD/1FFE from a fresh copy; other SRAM reads/writes remain boundaries.
These synthetic connected runs are separate from the actual cold original
comparison in [BOOT-ORACLE.md](BOOT-ORACLE.md).

[main-boot-native-observations.mjs](../tools/main-boot-native-observations.mjs)
builds each call's frozen chronology on a private reached state. Synthetic PPU
product, counters, busy status, APU answers and text-readback bytes are device
inputs, not measured frame timings. Readiness, task state, counters and time
are not injected to force progress. NativeWaitResume checks fresh readiness,
counters, events and continuation. Missing special-native sets leave F4F6
repeatable; a supplied set resumes without repeating arguments or the opcode.
Budget zero finishes the native return and stops before F390.

[main-scene-interrupt.test.mjs](../tools/main-scene-interrupt.test.mjs) tests
whole scene calls with their really installed callbacks and synthetic device
answers. Every supplied NMI must follow actual enable. This does not model
device time or prove untested story routes.

The direction bits are checked against [book1_text.pdf](../Ressources/book1_text.pdf),
Book I, chapter 28, PDF page 148 (printed 2-28-9, STD CNTRL1H): bits 3 to 0 of
the high byte mean up, down, left, right; WORD masks 0800, 0400, 0200, 0100.
ROM table 80:DF4B maps the eight valid combinations to eight different even
direction indices; 0300 and 0C00 each select index 10 hex like no direction
(separate from the hardware finding). Enable, real start window and device time
remain the limits of the
[controller spot check](MANUAL-SPOT-CHECKS.md#automatic-controller-polling).

## Performance and limits

The historical Node 24 measurement (2026-10-13) was about 26 million opcodes/s
with constant heap growth; it is not a current performance guarantee.
Run node --expose-gc tools/vm-benchmark.mjs to reproduce the benchmark. Native
adapters may allocate per call even though the opcode loop does not.

Hardware values require explicit observations or the selected live device
model. Static closure, a source test or a synthetic route is not a hardware
measurement, universal timing proof or full playthrough. Game mode does not
add proof stack/write-window checks; those belong to reference tests and
original comparisons. Follow the rebuild rules before changing frozen proof
code.
