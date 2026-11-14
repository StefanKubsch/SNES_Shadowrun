# Native event interpreter (M1)

Part of [STRATEGY.md](STRATEGY.md), milestone M1. Code in [src/vm/](../src/vm/).
Translated and condensed from the former German version (git commit
20c7b6c9 has the original wording).

## Structure

| File                                                 | Content                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [memory.mjs](../src/vm/memory.mjs)                   | `VmMemory`: WRAM (128 KiB, one `Uint8Array`), LoROM (1 MiB), arithmetic unit `$4202–$4217`. Mapping like `renderAddress`. Unmapped accesses throw `VmFault`. Optional SRAM (8 KiB, banks `$70–$7D`/`$F0–$FD` below `$8000`, mirrored); without supplied content accesses stay faults. |
| [handlers.mjs](../src/vm/handlers.mjs)               | One handler per opcode family with original address. `OPCODE_TABLE` lists all 98 even opcodes `$00–$C2` with original target.                                                                                                                                                         |
| [native-call.mjs](../src/vm/native-call.mjs)         | Bridge `$F4F6`, jump via DP `$A2`, resume `$F509` (native, flag-exact); `NativeCalls` binds admitted targets.                                                                                                                                                                         |
| [task-accessor.mjs](../src/vm/task-accessor.mjs)     | Thin adapter: the accessor interface of the proven modules directly on `VmMemory`, without a log; access limit per native against cyclic data.                                                                                                                                        |
| [scheduler.mjs](../src/vm/scheduler.mjs)             | `TaskScheduler`: task management, heap, scheduler, script call `$F488` (child task), native wait `$C401`, resume `$F495`/`$F509`.                                                                                                                                                     |
| [devices.mjs](../src/vm/devices.mjs)                 | Hardware environment of the natives: `ObservedDevices` supplies one observation set per native call (device reads, wait and input words).                                                                                                                                             |
| [special-natives.mjs](../src/vm/special-natives.mjs) | Special natives with hardware values: target → proven module.                                                                                                                                                                                                                         |
| [interpreter.mjs](../src/vm/interpreter.mjs)         | `ScriptInterpreter`: registers `a x y s d dbr p pc`, stack/stream helpers, `fetch()` like `$F389–$F390`, `run(maxOpcodes)`.                                                                                                                                                           |

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
(`nativeTarget` from `src/task/native-targets.mjs`) via `TaskAccessor`, RTS to
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

The proven handlers (`proof/task/opcode-sequence.mjs`) serve as oracle
([vm-differential.mjs](../tools/vm-differential.mjs)): same start state, then
comparison of all registers, flags and **all** 131,072 WRAM bytes; faults must
occur on both sides. Arithmetic unit values go to the oracle as observations
with original PC.

| Differential                                                                                          | Scope and one-time full result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opcodes                                                                                               | Every arithmetic/stack/compare opcode with edge values; random programs with jumps, local calls and all exits (when the oracle refuses an exit only because of a stack alias, the state before it is compared); original scripts from the ROM: every fourth in the test, all 937 identical once (36.5 s, 2026-10-13).                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Natives                                                                                               | Every admitted native with edge arguments against the proven native composition (`prepareTaskNativeOpcodeSequence`). All 937 scripts with bound natives once (82 s): 156 identical with executed natives, 360 identical up to the first non-admitted native, 150 with the same fault on both sides, 271 identical without natives. The arithmetic unit is tested against the hardware specification (8×8 product, 16/8 division, division by 0).                                                                                                                                                                                                                                                                                                                           |
| Scheduler ([vm-scheduler-differential.mjs](../tools/vm-scheduler-differential.mjs))                   | Random WRAM, init `$C1A6`, 1–3 original scripts via `$C34A`, then per round `$C1CA` and `$C1F9` with up to 40 opcodes against `prepareTaskVisitStatusOpcodes` (opcodes, natives, script calls, post-run, parent resume `$F495`), `$C34A` against `prepareTaskAppendC34A`, native wait against `prepareTaskNativeWaitOpcode`, resume `$F509` against `prepareTaskNativeWaitResume`; state evolves with real `$C1E3` rounds. 300 scenarios once (2026-10-13, ~6 min): 300 appends, 1,200 visits with opcodes, 235 without, 328 native waits, 62 `$F509` resumes identical (544 script calls, 192 task ends, 736 post-runs, 96 parent resumes). The oracle composes a `$F508` continuation only without further opcodes; such cases are compared from `$C1F9` without opcode. |
| Special natives ([vm-special-natives-differential.mjs](../tools/vm-special-natives-differential.mjs)) | Random WRAM, edge arguments, one `$58` from `$F390` against the native's opcode composition (`prepareTaskNativeOpcodeFEC1` etc.). Observations are test inputs: when the VM asks for one, a random value is added and the call repeated; the oracle gets the same set and arithmetic reads. Registers, flags, all WRAM bytes and device writes compared. 100 scenarios per ID once (14 IDs, 2026-10-13, 303 s): 902 identical, 490 same fault, 8 at oracle proof limits.                                                                                                                                                                                                                                                                                                   |
| Body specs ([vm-body-specs.mjs](../tools/vm-body-specs.mjs))                                          | All 1,503 cases of the 219 proven body specs run with their fixtures via `TaskScheduler` (entry `$F390` or `$C1CA`, stop at `$C20B` or handler budget), interpreter and all natives and match the body plan (`prepareTaskScriptBody`): 682 complete, 821 up to suspension. Fixtures partly set synthetic ROM bytes and arithmetic values; the VM gets the same (`TaskAccessor.observeArithmetic`). This completes the M1 evidence.                                                                                                                                                                                                                                                                                                                                         |
| Mesen2 (M2)                                                                                           | Every opcode with bound, oracle-checked natives against the real game run, see [MESEN-ORACLE.md](MESEN-ORACLE.md); since part 2 also whole scheduler rounds and special natives with device reads; frames 900–4000: 204,075 intervals, no deviation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

Tests: [vm-interpreter.test.mjs](../tools/vm-interpreter.test.mjs),
[vm-scheduler.test.mjs](../tools/vm-scheduler.test.mjs),
[vm-special-natives.test.mjs](../tools/vm-special-natives.test.mjs).

## Performance

`node --expose-gc tools/vm-benchmark.mjs [opcodes]` (loop of local load,
addition, store, multiplication, compare, jump), 2026-10-13, Node 24:
about 26 million opcodes/s; heap growth constant at about 125 KB for 2, 20 and
100 million opcodes (one-time JIT, no allocation per opcode). Scheduler with
eight original scripts that wait and resume permanently, in `$C1E3` rounds:
about 79,000 rounds/s (21.4 million opcodes and 1.6 million native calls in
200,000 rounds, 2.5 s), heap growth about 27 KB; the game needs 60 rounds/s.
Unchanged after part 3 (about 26 million opcodes/s, about 86,000 rounds/s).

## Missing natives (M1d)

Each native below is an equation module in `src/task/` with pinned original
bytes; "vs. original" means a comparison of the equations against the
original instructions with the test-only instruction evaluator
[w65c816-reference.mjs](../tools/w65c816-reference.mjs) (only the
instructions used here, never in `src/`), all reachable instructions hit and
registers, flags, WRAM, arithmetic unit and hardware accesses with original
PC identical. Native58 compositions are checked in the special native
differential. "Mesen" means identical against the real game run
([MESEN-ORACLE.md](MESEN-ORACLE.md)). The bridge differential checks only the
binding (VM against the native composition of the same module), not the
equation itself.

Proof lemmas used by the static stack proof (`static-word-stack-proof.mjs`,
`proveExternalSource` passes them through): `dataPulls` (PLY/PLX takes the
word of a 16-bit PHA), `indexPulls` (PLA takes the 16-bit word of a PHY),
`externalReturns` (calls of proven routines as counted external returns),
`peiWordPushes` (PLA takes words pushed by PEI), `pullKinds` (allowed stack
kinds of one PLA, e.g. PHA or `PEA $0000`), `indirectTargets` (jump targets
of indirect jumps via pinned table entries), `interruptReturns` (BRK/COP;
without it they are now rejected).

### Groups 1–4 and early specials (2026-10-13/14)

| ID / target            | Module                                                                         | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Proof and comparison                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$7D`/`$E30F`          | group 1 leaf                                                                   | Slot and position bytes, two table searches (ROM `$9700`, `$7E2DF0`), record fields                                                                                                                                                                                                                                                                                                                                                                                                        | [task-native-m1d-specs.mjs](../tools/task-native-m1d-specs.mjs), [task-native-m1d.test.mjs](../tools/task-native-m1d.test.mjs); bridge differential 300 scenarios per group-1 ID (1,800, ~3 min): 1,486 identical with executed native, 311 same fault, 3 at oracle limits                                                                                                                               |
| `$7F`/`$CCB9`          | group 1 leaf                                                                   | Table value for `$7E2DE2` × 9 (ASL/ADC with carry)                                                                                                                                                                                                                                                                                                                                                                                                                                         | as above                                                                                                                                                                                                                                                                                                                                                                                                 |
| `$6F`/`$9D6A`          | group 1 leaf                                                                   | `$7E2DF0` into record field 3                                                                                                                                                                                                                                                                                                                                                                                                                                                              | as above                                                                                                                                                                                                                                                                                                                                                                                                 |
| `$96`/`$CAA2`          | group 1 leaf                                                                   | Byte into record field 1                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | as above                                                                                                                                                                                                                                                                                                                                                                                                 |
| `$83`/`$D14A`          | group 1 leaf                                                                   | Three words to `$0E28/$0E80/$0ED8`+X                                                                                                                                                                                                                                                                                                                                                                                                                                                       | as above; see [slots.md](reference/slots.md#slotaktion-83)                                                                                                                                                                                                                                                                                                                                               |
| `$98`/`$9159`          | group 1 leaf                                                                   | Search in byte list `$7E3CA3` (end `$FF`)                                                                                                                                                                                                                                                                                                                                                                                                                                                  | as above                                                                                                                                                                                                                                                                                                                                                                                                 |
| `$C4`/`$E262`          | [native-timer-running.mjs](../src/task/native-timer-running.mjs)               | `$1D87 \| $1D89`, non-zero becomes `$FFFF`, result to DP00 (one of the two gaps of the first-room Mesen recording)                                                                                                                                                                                                                                                                                                                                                                         | Mesen identical in all calls                                                                                                                                                                                                                                                                                                                                                                             |
| `$B2`/`$8371`          | [native-object-collision.mjs](../src/task/native-object-collision.mjs)         | Collision of an object against the object boxes of up to four map cells; closed helper graph `$8371/$8486/$81:8686` with real JSR and JSL/RTL, PHB and DBR `$7E` (reached by opening the morgue door)                                                                                                                                                                                                                                                                                      | Lemma `dataPulls` (`$81:86C3`); behaviour tests with hit, no hit, own object, player rule, height check; Mesen identical                                                                                                                                                                                                                                                                                 |
| `$88`/`$DE7E`          | [native-player-control-reset.mjs](../src/task/native-player-control-reset.mjs) | Scene change sets control markers `$1D5B` = `$FFFF`, `$1D5D/$1D5F/$1D65/$1D6B/$1D6D` = 0                                                                                                                                                                                                                                                                                                                                                                                                   | leaf (way out of the morgue)                                                                                                                                                                                                                                                                                                                                                                             |
| `$78`/`$A1E6`          | [native-scene-object-add.mjs](../src/task/native-scene-object-add.mjs)         | Create a scene object on every scene build; closed helper graph from own windows and the proven windows of `$A835` (create slot) and `$AAAF`/`$A985`                                                                                                                                                                                                                                                                                                                                       | Static proof with 15 local stack bytes and pinned PLY data word; Mesen identical                                                                                                                                                                                                                                                                                                                         |
| `$81A25F` (sight line) | [task-sight-a25f-source.mjs](../tools/task-sight-a25f-source.mjs)              | Three pinned windows (`$A60B` and `$A62B` with `initialM: 1`), closed graph of 716 instructions, only internal JSR/RTS, two local stack bytes, three RTL exits with M0/X0 and entry DBR                                                                                                                                                                                                                                                                                                    | [task-sight-a25f.test.mjs](../tools/task-sight-a25f.test.mjs): 4,000 fixed-seed scenarios reach all 716 instructions. Found a bug: the cell loop read its counter outside the block (ReferenceError once a cell does not block sight; never on Mesen paths)                                                                                                                                              |
| `$10`/`$8AB5`          | [native-object-shoot.mjs](../src/task/native-object-shoot.mjs)                 | Enemy shoots: DP00 shooter, DP02 target, DP04 hit bonus, DP06 kind, DP08 damage, DP0A distance penalty; result DP00 (`$FFFF` on blocked sight, else DPB4). Own code `$8AB5/$8A43/$8497/$8904` (234 instructions); hit via proven `hitObject` from [native-object-hit.mjs](../src/task/native-object-hit.mjs) (damage, text window `$8778` with wait and button, player hit `$881C` with `$C46E` and `$81AD92`); plus `$81A25F`, `$C51F`, `$A835`, `$AAAF`; observations like `$7C`/`$8E36` | [task-native-8ab5-source.mjs](../tools/task-native-8ab5-source.mjs), [task-native-8ab5.test.mjs](../tools/task-native-8ab5.test.mjs) (`$8691` as the same stub on both sides); five deliberate equation faults detected including distance limit `$40`; device promise of `$A25F` (`lineOfSightDevices`, 38 read sites) checked against the pinned source; Mesen: alley, all 8 shots of frames 7650–8600 |
| `$07`/`$8BC5`          | [enemy-target-choice.mjs](../proof/game-reference/enemy-target-choice.mjs)   | Target choice: 32 own instructions, random `$C51F`, sight line `$81A25F`                                                                                                                                                                                                                                                                                                                                                                                                                   | [task-native-8bc5-source.mjs](../tools/task-native-8bc5-source.mjs) (lemma `indexPulls`: PLA at `$8BE9` takes the PHY word of `$8BCF`), [task-native-8bc5.test.mjs](../tools/task-native-8bc5.test.mjs); shared source proof [task-native-external-source.mjs](../tools/task-native-external-source.mjs); Mesen: south-west                                                                              |
| `$C2`/`$CDA8`          | [native-window-list-redraw.mjs](../src/task/native-window-list-redraw.mjs)     | `LDA $1D61`, `STA $00`, `JSL $81AD92` via the proven AD92 composition (A9B2, ACCF, ACB5/ACAF with waits)                                                                                                                                                                                                                                                                                                                                                                                   | pinned bytes in `tools/task-native-cda8.test.mjs`; Mesen identical                                                                                                                                                                                                                                                                                                                                       |

`$8AB5` and `$8BC5` were first oracle-checked and are now regularly bound
(user decision 2026-10-14: oracle-checked natives do not become a category of
their own; `proof/vm/oracle-natives.mjs` stays a transition mechanism). The
Native58 compositions `native-8ab5-opcode.mjs`/`native-8bc5-opcode.mjs` are in
the special native differential.

### Alley fight and fight end (2026-10-14)

| ID / target   | Module                                                                           | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Proof and comparison                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `$59`/`$866F` | [native-fight-list-any-active.mjs](../src/task/native-fight-list-any-active.mjs) | Searches fight list `$1FB2` from `$1FB0` down for an object with bit 2 and without bit 12 in `$1458`; hit `$FFFF`, else 0 to DP00                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | leaf; Mesen alley frames 7800–8600: 649 calls                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `$1B`/`$CF93` | [native-object-face-object.mjs](../src/task/native-object-face-object.mjs)       | Object DP00 turns to object DP02 (low byte `$FF`: return at once). Magnitudes of the `$0E28`/`$0E80` differences to DPA2/DPA5, negative raw values to DPA8/DPAB; an axis dominates when half of the other is not below it; direction 0–7 (+dy 0, +dx 2, −dy 4, −dx 6) to DP02, then proven `$AAAF` via real JSR                                                                                                                                                                                                                                                                                                                                                                                                                            | Closed helper graph with the `$AAAF`/`$A985` windows (four local stack bytes); Mesen 8 calls                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `$AC`/`$8521` | [native-fight-list-append.mjs](../src/task/native-fight-list-append.mjs)         | Append DP00 to the fight list (`$1FB0` += 2, no capacity check). First entry: `$7E3C11` >> 3 to `$1FCC`, `$FFFF` to `$1FCA`; with bit 0 of `$1FD6` and `$1CDE` ≠ 6 the old mode to `$1FCA` and fight music via `JSL $81EF47` with A = 6. `$EF47`, `$F25A`, `$F1FA` are task compositions in [native-audio-compose.mjs](../src/task/native-audio-compose.mjs) (with existing `$F130`, `$F03A`, `$F007`; APU ports as observations like `$C46E`). Own code 25 instructions with external return `$81EF47`                                                                                                                                                                                                                                    | [task-native-8521-source.mjs](../tools/task-native-8521-source.mjs); [task-native-8521.test.mjs](../tools/task-native-8521.test.mjs) (2,000 scenarios; `$F007`/`$F130` as modules on both sides; the evaluator knows PHP/PLP and checks the mode promise only for mode-dependent operands; `$F206` is reached with M0 and M1); `native-8521-opcode.mjs`; Mesen once (no native unbound in the alley); data contract in [task-system.md](reference/task-system.md#ac-datenzustand)                                                                |
| `$C0`/`$855E` | [native-fight-list-remove.mjs](../src/task/native-fight-list-remove.mjs)         | Searches DP00 in fight list `$1FB2` from `$1FB0` down (missing: return) and removes it; entries above move down. On the first removal (`$1FCE` = 0, DEC to `$FFFF`), when `$1D6B` and `$7E2DE6` are not negative, the non-zero words `$7E2DF8+X` for X = `$7E2DE6` down to 0 are decremented. Then `$1FB0` −= 2; non-empty list returns. Empty list (fight end): `$7E3C11` >> 3 minus `$1FCC`; a non-zero gain is stored in `$1FCC` and shown: hint `$FEC1` (DP 0A, 02, height 9 or from 10 then 10, 03, 00, 04, 78), `$FAAC`, number `$FD80`, text `$FE69` with `$7117`, sound `$C46E` with `$32`. With bit 1 of `$1FD6` a non-negative `$1FCA` restores the old music via `JSL $81EF47` (negative: return); without the bit music mode 0 | Six sub-routines run as their modules with real JSR/JSL frames (`FIGHT_LIST_REMOVE_ROUTINES`); own code 89 instructions, six external returns ([task-native-855e-source.mjs](../tools/task-native-855e-source.mjs)); [task-native-855e.test.mjs](../tools/task-native-855e.test.mjs) (4,000 scenarios, all six exits; sub-routines as recording stubs); `native-855e-opcode.mjs`; Mesen: orc death in the alley (frame 9755, `ALLEY_FIGHT_PLAN`), path without hint with music change `$EF47`; the hint path is so far only checked vs. original |

### Dialog `$95`/`$936C` (2026-10-14)

[native-dialog.mjs](../src/task/native-dialog.mjs). Flow: CGWSEL (`81:886A`),
glove off (`BCB2`/`BE5B`), record DP02 via table `80:94F7` (bank `$8D`), clear
window (`FF79`), conversation music from the flag byte (`80:94E8`, `EF47`; old
music on the stack), two windows via `F963` (`FA92` moves the portrait frame),
portraits of Jake (record `$4E`, with `$7E3C17` `$4F`) and the partner unpacked
(`9F6D`/`9E65`), moved (`8F20`) and sent by DMA (`9022`, `905E`, `8FF5` waits
for `$0140`), windows opened (`8F3A`/`8EFE`). Greeting (`9178` with key
`$FFFF`), one second wait, menu Exit/Talk/Ask about (`91E2`, `A6C7`), Talk
(`9178` with `$FFFE`), Ask about (`9215`, topic list `$7E3CA3`/`$7E3CD6`, then
`9178` with the topic ID). Close (`92C5`): windows shut (`8F97`), object tiles
requested again (`ADF4`/`AE12`/`AC2F`), font VRAM by DMA, input (`9E1A`),
sprites rebuilt (`B8DE`), both windows freed (`FA3E`), old music back.

- Task compositions: [native-dialog-portrait.mjs](../src/task/native-dialog-portrait.mjs)
  (windows and portraits), [native-dialog-text.mjs](../src/task/native-dialog-text.mjs)
  (text and selection; `908C` sorts topics in),
  [native-scene-tiles.mjs](../src/task/native-scene-tiles.mjs) (object tile
  management), [native-scene-sprites.mjs](../src/task/native-scene-sprites.mjs)
  (depth sort, map occlusion, OAM build); shared equations in
  [native-dialog-support.mjs](../src/task/native-dialog-support.mjs).
- Topic action of `9178` (flag bit 7 in the entry): `JSR $C34A` appends the
  script task from the action word (proven `appendScriptTask`, argument DP26
  in DP00), `JSR $C1CA` visits the new head task at once. This visit is a
  **nested scheduler round** from the native: `NativeCalls.round`
  ([native-call.mjs](../src/vm/native-call.mjs)) hands the registers from the
  accessor to the VM, runs its own `TaskScheduler` until the return to `$91D7`
  and takes the registers back. Accessor and device set of the calling native
  are saved because the round calls natives itself (special natives take the
  following sets). Without a round (pure task modules) the limit
  `task_dialog_topic_visit_open` stays. Special native options contain
  `round(entry)`; a result with more observations is appended to the native's
  set (oracle). Resumable special natives also get `nestedRound(entry)`, the
  same round as a pausable continuation
  ([NATIVE-CONTINUATION.md](NATIVE-CONTINUATION.md#pausable-nested-round-2026-10-21)).
  [vm-nested-round.test.mjs](../tools/vm-nested-round.test.mjs): for all 57
  action scripts of the dialog table two scenarios each, round from the native
  against `C34A` and `C1CA` directly on the scheduler (all registers, whole
  WRAM, natives in the round with observations, same faults on both sides).
- Source proof [task-native-936c-source.mjs](../tools/task-native-936c-source.mjs):
  15 groups, 5,048 bytes / 2,211 instructions with stack and mode proof
  (external returns into the proven modules); new lemmas: jump targets of
  indirect jumps (tables `80:B0E3`/`B126`, unrolled sequence from `80:B936`)
  and allowed stack kinds of a PLA (`$94E2` after PHY or `PEA $FFFF`).
- Vs. original in [task-native-dialog.test.mjs](../tools/task-native-dialog.test.mjs)
  (real portrait data, picture headers and animation streams from the ROM).
  The evaluator now knows PHB/PLB/PEA, MVN/MVP, ROL/ROR, memory shifts,
  TSB/TRB, TXA/TYA, `JMP (abs)`/`(abs,X)` and stores wait loop values before
  the instruction (`before`). `native-936c-opcode.mjs` in the differential.
- Observations: wait loops (`ACAF`/`ACBD`/`ACC3`/`ACC9`, `901C`, `AE0C`/`AE5E`
  with the NMI-set DP82), counter `B0A1` and joypad `9E1A`, all in call order.
- Mesen: punk dialog frames 5904–6160 (greeting, exit with B, scene rebuild)
  and dog dialog in the alley (dialog 0, frames 10451–11025) with topic action:
  Ask about with topic `$17` falls back to entry `FD`, whose action script
  `$396` (growl via `$C46E`) runs in the nested round.

### Small natives, glove targeting and Jake's shot (2026-10-14)

Leafs compared vs. original with 3,000 scenarios each in
[task-native-m1d.test.mjs](../tools/task-native-m1d.test.mjs) unless stated.

| ID / target                  | Module                                                                             | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Proof and comparison                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$92`/`$C694`                | [native-object-distance-direct.mjs](../src/task/native-object-distance-direct.mjs) | Distance of objects DP00 and DP02: after `LDY $02` the same body `$C696` that `$0A`/`$C68D` calls by JSR (shared `runDistanceC696` in [native-object-distance.mjs](../src/task/native-object-distance.mjs)): larger magnitude of dx (`$0E28`) and dy (`$0E80`), shifted right twice, to DP00                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | leaf                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `$D5`/`$D134`                | leaf                                                                               | `$7E2DE4` AND `$00FF` to DP00                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | leaf                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `$B1`/`$C6F8`                | leaf                                                                               | For object DP00 words 1, 0, DP02, 1 to `$7E4138`, `$7E4190`, `$7E41E8`, `$7E40E0` (+X)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | leaf                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `$29`/`$D1DD`                | leaf                                                                               | Direction from player object `$0CC2` to object DP00 via proven `$D1E3` (real JSR like `$6C`/`$D1D2`), to DP00                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | leaf                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `$C716`                      | correction                                                                         | Reads `$0CC2` (player object), not `$0CD2`; found by the Mesen oracle on entering the street (synthetic tests had confirmed the typo)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | —                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `$D8`/`$9BC6`                | [native-glove-target.mjs](../src/task/native-glove-target.mjs)                     | No argument, result DP00. `$9C40` puts the glove over the player (`$BC67`/`$BC36`) and runs every frame (`$B0A1`) with input (`$9E1A`) and movement (`$BE6D`) until A, B, X or Y is newly pressed (`$01CE` AND `$C0C0`). `$BE6D`: the d-pad accelerates `$01D0`/`$01D2` by `$30` up to ±`$300`; position `$01D4`/`$01D6` stays in `$0300`..`$EF00` resp. `$CE00`; at rest `$BCBE` finds the first scene object whose box contains the glove and shows its name bottom right (width via `$FADD`/`$FB2A` with bit stream `$AF04`, window `$F963`, text `$FE69`); the same object again snaps the glove relative to it; movement frees the window (`$BE5B`). Result: no object `FFFF`; object farther than `$80` from the player (sum of x/z distances or height difference from `$81`) shows hint `$FEC1` and also gives `FFFF`; else place `$01DE`. Then `$BCB2`, window list `$81:AEB0` (`$AD92`) except with `$1F62`, and `$9E1A`; `$9BC6` turns the place into object number `$150A`+place | [task-native-9bc6-source.mjs](../tools/task-native-9bc6-source.mjs): 434 instructions, 12 local stack bytes, nine external returns; `$FAF2` (REP) is a width union; the reset path of `$9E1A` (L+R+Select+Start) ends with `taskStop`. [task-native-9bc6.test.mjs](../tools/task-native-9bc6.test.mjs) (`$BC67`, `$FADD`, `$BE6D` with `$BCBE`, whole `$9BC6` with inputs and frame counter). No Mesen case yet at that time |
| `$58`/`$8A51`, `$5A`/`$8A8C` | [native-object-shoot.mjs](../src/task/native-object-shoot.mjs)                     | Shared with `$8AB5` (`shooterParts`: sight line, `$8A43`, `$8497`, `$8904`). `$8860` reads the weapon of shooter Y: object number `$150A,Y` in table `$9700` (13 words from X = `$18` down; an unknown number loops endlessly in the original, the equation stops after one full round with `taskStop`), record via `$971A`/`$9734` (byte 7 to DPAE, byte 8 halved and rounded up to DPB1, byte 6 to DPAB; Jake's record is in WRAM at `$7E3BFB`), weapon entry `$7E3C33`+4X (kind DPA2, damage DPA5, signed range DPA8). Kinds 0, 1, 6 play shot sound `$0C`, `$40`, `$0E` via `$88EB` (`$C46E`, DP00/DP02 saved with PEI). `$8A51`: player `$0CC2` at the object under the glove (`$01DA`, place `$01DE`); no object DP00 = 0, blocked sight 1, else `$8A43`, bit 4 in the target's `$1458` and hit roll `$8904`, DP00 = DPB4. `$8A8C`: DP00 at DP02, blocked `$FFFF`, else with facing `$8497`                                                                                            | [task-native-8ab5-source.mjs](../tools/task-native-8ab5-source.mjs): 243/297 instructions, 10 local stack bytes, lemma `peiWordPushes` (PEI at `$88EB`/`$88ED`, the two PLA take these words); [task-native-8a51.test.mjs](../tools/task-native-8a51.test.mjs): 2,500 scenarios each, four deliberate faults (sound ID, sign, bit 4, rounding) detected; [native-8a51-opcode.mjs](../proof/task/native-8a51-opcode.mjs)      |
| `$0F`/`$D067`                | [native-runner-record-byte.mjs](../src/task/native-runner-record-byte.mjs)         | Record byte 2 via `$D02F`, search bounded by BPL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | leaf                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `$B8`/`$BC83`, `$6B`/`$BC9C` | [native-glove-crosshair-limits.mjs](../src/task/native-glove-crosshair-limits.mjs) | Limits and kind of crosshair and spell glove (same equations as in `$E014`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | leaf                                                                                                                                                                                                                                                                                                                                                                                                                         |

Mesen: alley fight frames 8600–9800 without unbound natives (`$8A51`, `$E014`
with crosshair, aiming and active glove, `$D067`).

### Combat natives `$808B43–$808EDA` (2026-10-14)

Special natives in [native-combat.mjs](../src/task/native-combat.mjs) (source
[task-native-combat-source.mjs](../tools/task-native-combat-source.mjs),
composition [native-combat-opcode.mjs](../proof/task/native-combat-opcode.mjs));
vs. original in [task-native-combat.test.mjs](../tools/task-native-combat.test.mjs)
(2,500 scenarios each, five deliberate faults detected; the evaluator now
knows `dp,X`, `(dp)`, `(dp),Y`). No Mesen case (not in the alley fight).

| ID / target                                 | Behaviour                                                                                                                                                                                                                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$AB`/`$8B43`                               | Decrement counter `$7E3C96` of member `$1F60`/2 by DP00, hint `$FEC1` on underflow; REP at `$8B5F` is a width union                                                                                                                                                              |
| `$86`/`$8C08`                               | Next visible party member from `$1FA8` (sum of axis distances)                                                                                                                                                                                                                   |
| `$4E`/`$8C8D`                               | Random visible target of fight list `$1FB2` (lemma `indexPulls` for PLA at `$8CA8`)                                                                                                                                                                                              |
| `$69`/`$8CCF`                               | Can DP00 attack DP02                                                                                                                                                                                                                                                             |
| `$73`/`$8D7F`, `$62`/`$8D3F`, `$D9`/`$8D4E` | Speed towards an object or a point of list `[$F3]` via hardware division `$4204`/`$4206`/`$4214`, shared body `$8D84`/`$8D95`; `$8DDB` is dead for `$8D3F`/`$8D4E` because both run `STZ $04` first (D9 data contract: [task-system.md](reference/task-system.md#d9-arithmetik)) |
| `$A6`/`$8D0B`                               | Glove target choice without distance check; in [native-glove-target.mjs](../src/task/native-glove-target.mjs), shares its windows; tested in [task-native-9bc6.test.mjs](../tools/task-native-9bc6.test.mjs)                                                                     |
| `$8C`/`$8B8A`                               | Leaf: increment counter                                                                                                                                                                                                                                                          |
| `$64`/`$8E96`, `$9E`/`$8EB8`                | Leafs: set or clear bit 10 in `$1458`, bit 12 in the first non-negative `$0BA2` of chain `$1350`/`$0372`; an endless chain stops after 65,536 links with `taskStop` (the original would hang)                                                                                    |
| `$94`/`$8EDA`                               | Leaf: append a task via proven `$C34A` with the `$C2C8`/`$C242` windows (tests with heaps of busy, merged and tightly fitting blocks)                                                                                                                                            |

### BRK, small leafs and the ranking list (2026-10-14)

| ID / target                  | Module                                                                       | Behaviour                                                                                                                                                                                                                                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$00`/`$D186`                | [native-player-object-break.mjs](../src/task/native-player-object-break.mjs) | `LDA $00`, then `BRK #$00`. Native BRK vector `00:FFE6` points to `00:F2B3`, a plain RTI: BRK pushes PB `$80`, PC `$D18A` and P below S (the four bytes stay in WRAM), sets I and clears D; RTI restores all; then DP00 = `$0CC2` like `$D18A`. Lemma `interruptReturns`; the evaluator really runs BRK, vector and RTI |
| `$45`/`$CD9D`                | [native-glove-release.mjs](../src/task/native-glove-release.mjs)             | `STZ $1D61`, `$BCB2`, `JSL $81AD92`; no result word (composition supports `result: false`)                                                                                                                                                                                                                              |
| `$9C`/`$A977`                | leaf                                                                         | Height plus DP02 × 4                                                                                                                                                                                                                                                                                                    |
| `$AE`/`$C71D`                | leaf                                                                         | DP02 = `$0CC2`, then the body of `$C6F8`                                                                                                                                                                                                                                                                                |
| `$CB`/`$CF2E`                | leaf                                                                         | Increment counter `$7E3C96` by DP02, at most ten times record byte 1; if the object is missing in group `$7E2DF0` the original continues with the player and would hang if that is missing too (then `taskStop`)                                                                                                        |
| `$8A`/`$E1CF`                | [native-spell-choice.mjs](../src/task/native-spell-choice.mjs)               | Choose a spell from `$7E3C1C`, window `$F963`, names `$D9B8`, menu `$A6C7`, release `$FA3E`; without spells the original frees the unset DP0E; PLA at `$E24A` takes PHA or `PEA $0000` (lemma `pullKinds`); vs. original in [task-native-e1cf.test.mjs](../tools/task-native-e1cf.test.mjs)                             |
| `$52`/`$C461`                | [native-sound-stereo.mjs](../src/task/native-sound-stereo.mjs)               | Stereo position `$C416`, APU command `$0D` via `$81F007`, no result; compositions with `$CD9D` in [native-small-opcode.mjs](../proof/task/native-small-opcode.mjs)                                                                                                                                                      |
| `$71`/`$90EB`                | leaf                                                                         | Insert a topic sorted like `$908C` (the end marker's flag is not shifted along)                                                                                                                                                                                                                                         |
| `$48`/`$8631`, `$5F`/`$8656` | leafs                                                                        | Predecessor in the fight list; is in the fight list                                                                                                                                                                                                                                                                     |
| `$BA`/`$C7A1`                | leaf                                                                         | Record words 1, DP02 × 4, DP04 × 4, 1                                                                                                                                                                                                                                                                                   |

**ROM writes** (user decision 2026-10-14): writes to the ROM have no effect,
as on hardware. `VmMemory` ([memory.mjs](../src/vm/memory.mjs)) counts them
(`romWrites`) and logs addresses only in diagnostic mode (`romWriteLog = []`;
free in game mode). Task plans ([plan.mjs](../proof/task/plan.mjs)) record
them as access `rom-write` without effect. In bank `$00` they only arise from
stack or direct page overflows and stay a proof limit; above the 32 LoROM
banks and in banks with bit 6 writes stay faults. The `$C401` test expects
`rom-write` for indices whose last write lands in ROM.

| ID / target                  | Module                                                                                         | Behaviour                                                                                                                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$75`/`$9D15`                | [native-object-record-property-equip.mjs](../src/task/native-object-record-property-equip.mjs) | DP02 into the record, then the equipment entry from ROM table `$97A9`/`$97AC` to `$7E3C2E`/`$7E3C31`; the original `STA $97AE,X` and `STA $97B0,X` (probably meant as LDA) write to ROM without effect; the equation omits them |
| `$BD`/`$9BD3`                | module of `$9BC6`                                                                              | Spell glove `$BC99`; an open dialog is first closed via `$92C5` (extracted from `$936C` as `closeDialog`); window list `$81AEB8` with `$A9B2`/`$ACB5`; an object without bit 15 in `$1458` lets the choice continue             |
| `$C1`/`$9C33`, `$8F`/`$9BB9` | module of `$9BC6`                                                                              | `$9C40` resp. `$9BC6` with marker `$1D6D` (proofs in [task-native-9bc6-source.mjs](../tools/task-native-9bc6-source.mjs), all instructions vs. original including re-choosing; compositions in native-small-opcode.mjs)         |

### Weapons, ammunition and pendulum movements

| ID / target                                 | Module                                                                   | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$27`/`$CECB`                               | [native-state-count-raise.mjs](../src/task/native-state-count-raise.mjs) | State count of member DP00 + DP02, at most the maximum from its runner record (`$9700`, pointer `$971A+5`/`$9734`), then window list `$81:AD92`. Without a hit in group `$7E2DF0` the original continues with player `$0CC2`; if that is missing it loops endlessly (limit `task_cecb_endless_search`). A number outside `$9700` reads entry `$FFFE` behind the table identically on both sides. Test [task-native-cecb.test.mjs](../tools/task-native-cecb.test.mjs)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `$01`/`$F254`                               | [native-member-spell-menu.mjs](../src/task/native-member-spell-menu.mjs) | Weapon menu `$E693` with window `$F963`, menu `$A6C7` and columns `$1E2D`..`$1F31` from `$E804`/`$E810`/`$E81C`. If the player is chosen the values go to `$7E3C13`/`$3C1A`/`$3C15`; otherwise script `$1E2D` is appended via `$C34A` and visited at once by `$C1CA` as nested round (`events.round`). `$E9C5` (weapon window) is reachable only if the round clears `$1F68` (`$E693` sets `$FFFF` itself), `$E4B3` (portrait via `$9F6D`/`$8F20`/`$9022`, HDMA `$E433` with `$E41F`) only if it sets `$1F58` (`$9BB9`). Proof: 328 instructions, 16 external returns ([task-native-f254-source.mjs](../tools/task-native-f254-source.mjs)); the RTS after PLP in `$E41F` is in its own window because linear decoding does not restore the PHP width. Tests [task-native-f254.test.mjs](../tools/task-native-f254.test.mjs); the nested round link is checked by [vm-nested-round.test.mjs](../tools/vm-nested-round.test.mjs) with the six scripts of column `$E804` |
| `$20`/`$D079`                               | [native-runners-restore.mjs](../src/task/native-runners-restore.mjs)     | Restore the state count and magic points of all 13 runner entries (helper `$D08A`, magic points `$7E3C96` equal to ten times the record byte, byte arithmetic), then `$81:AD92`; PLX at `$D0C7` takes a PHA data word (`dataPulls`). Test [task-native-d079.test.mjs](../tools/task-native-d079.test.mjs)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `$5E`/`$D714`, `$65`/`$D73B`                | leafs                                                                    | Height from sine table `$D3D1`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `$31`/`$32`/`$35`..`$3A` (`$D769`..`$D793`) | leafs                                                                    | Phase place Y into shared body `$D796`, height and position                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `$2B`/`$9DC8`                               | leaf                                                                     | Count a record counter down                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `$84`/`$A2B5`                               | leaf                                                                     | Remove a member from the group (the last entry stays as a copy)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `$55`/`$D9AD`                               | leaf                                                                     | With a real JSL frame to `$81:B0AC`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### Formation, swarm and location choice

| ID / target                                                                              | Module                                                       | Behaviour                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$0B`/`$BB2C`                                                                            | leaf                                                         | Object to its recorded formation place (`$AAAF`/`$A985` with real frames and PEI)                                                                                                                                                                                                                                                        |
| `$BC`/`$9CE4`                                                                            | leaf                                                         | Equipment entry like `$9D15` via helpers `$9D3D`/`$9D50`; their writes to `$97AE`/`$97B0` stay as accesses and have no effect with DBR `$80`                                                                                                                                                                                             |
| `$6E`/`$BB90`, `$D6`/`$A297`, `$AD`/`$D604` (with `$D622`), `$1E`/`$D85B`, `$AA`/`$D2E7` | leafs                                                        | Swarm movements via sine table `$D3D1`                                                                                                                                                                                                                                                                                                   |
| `$77`/`$D7DD`, `$09`/`$D260`, `$8D`/`$D63C`                                              | [native-swarm-start.mjs](../src/task/native-swarm-start.mjs) | Swarm with object creation, with the whole graph of proven `$A835` (and `$AAAF`) like `$A1E6`; vs. original in [task-native-swarm.test.mjs](../tools/task-native-swarm.test.mjs) with the same stubs for `$A835`/`$AAAF` on both sides. `$D63C` clamps speed `$1D35` with two unsigned compares that always give `$FFEC` in the original |
| `$A8`/`$C724`                                                                            | module of `$9BC6`                                            | Location with the action glove: record fields `$7E41E8`/`$7E4190` from glove and camera; BRA at `$C727` skips the entry `$C729`, so the source has two windows                                                                                                                                                                           |

### Status screen

`$B0`/`$EA6E` ([native-status-screen.mjs](../src/task/native-status-screen.mjs)):
status screen of a party member (replaced by the player while the number is not
in the party; without the player endless: limit `task_ea6e_endless_search`),
attributes, ammunition, counters, Jake's lines with 32-bit number `$FDCF`,
`$E9C5` and portrait `$E4B3`. Menu `$ED1E` picks sub-menus via `JMP ($ED2E,X)`
at `$ECEA`: `$E572`/`$E577`/`$E57F` (items of kind 0/1/2; `$E4F3` creates the
object via `$A835` and visits its task at once as nested round), `$E68E`
(weapon menu `$E693` with `$1F68 = 0`; `runE693` has an entry for it), `$E834`
(attribute window) and `$E8C8` (notes). The proof
([task-native-ea6e-source.mjs](../tools/task-native-ea6e-source.mjs), 936
instructions) takes only reachable instructions and proves the indirect jump
via the table entries (`indirectTargets`). Dead from `$EA6E`: `$E788`–`$E7B4`
(needs `$1F68 ≠ 0`) and `$ECDB` (needs `$1F64`, set only by entry `$EA89` of
native `$1C`); [task-native-ea6e.test.mjs](../tools/task-native-ea6e.test.mjs)
covers all other instructions. Finding: too many matching items let list
`$1EAF` run into the stack (also in the original); the scenario keeps the list
short. The harness shows trace deviations from the first difference.

### Main menu: saving and karma

`$3C`/`$CE6D` ([native-main-menu.mjs](../src/task/native-main-menu.mjs)): menu
`$CEC3`; save `$CDD6` (slot menu `$CE65`, `$81:B17D` copies `$7E:2DE0` with MVN
into SRAM `$70`, checksum `$B12C` with carry feedback `$B174`, sound 36; with
`$1D89` not negative only hint `$7058`) and karma `$EE57` (`$EF82`, purchase
`$F006`, the three lists `$F054`/`$F0F3`/`$F1B5` with their different re-entries,
`$F0F3` refilling ammunition via `$CECB`; at the end `$CECB`/`$CF2E` for the
player as real JSR). Proof over 551 reachable instructions
([task-native-ce6d-source.mjs](../tools/task-native-ce6d-source.mjs)); vs.
original in [task-native-ce6d.test.mjs](../tools/task-native-ce6d.test.mjs)
with optional SRAM (scenario field `sram`, compared like WRAM).

### Player control `$E014` proven statically

`$D0`/`$E014` started as the only **oracle-checked native**
([oracle-natives.mjs](../proof/vm/oracle-natives.mjs), run only when
`NativeCalls` gets it via option `oracle`; not counted by static differentials
or coverage; `supports()` checked before the call without writes whether the
path was implemented, otherwise the call ended like an unbound native). Its
call graph reaches into menu, text and input routines. Oracle-era steps
(2026-10-13/14), each checked against Mesen2:

- Group 2: path without buttons except the d-pad and without open menu:
  `$DEC7` (facing from `$01CA`, table `$DF4B`, camera rotation `$70:1FFD` from
  SRAM) with proven sub-routines `$A985` and `$AAAF` via real JSR/RTS.
- Group 4: action glove: B/L/R without glove (`$E050`, `$BC67` with `$BC36`,
  `$A985`) and glove active (`$DF6B` facing towards the glove with `$AAAF`;
  without an object under the glove and with B/L/R `$E1A2`/`$BCB2` off).
- Jake shoots: A without glove with weapon (`$E0B0`: `$BC80` crosshair,
  `$1D5D` = `$FFFF`, `$A985` with 4, or from damage 7 with 7, `$1D69`), X with
  spell (`$E111`: `$BC99`, `$1D5F`, `$A985` with 3) and aiming (`$E136`): held
  A/X gives DP00 (`$E13E`: newly pressed A, with weapon kind 1 held A or X,
  target with bit 15 in `$1458` to `$1D67`) and returns without `STZ $00`;
  B/L/R ends aiming (`$E19A`).

Now `$E014` is a regular special native
([native-player-control.mjs](../src/task/native-player-control.mjs)) with the
whole graph (1,391 instructions,
[task-native-e014-source.mjs](../tools/task-native-e014-source.mjs)): Select
shows the party overview `$ED3C`, Start the status screen via `$EA89`, Y its
item list via `$EA8E` (both entries are in `runStatus` of
[native-status-screen.mjs](../src/task/native-status-screen.mjs)); without
weapon or spell hints `$753E` resp. `$7479` appear; switching the glove off
with an object under it runs via proven `$BCB2`/`$BE5B`. The oracle-checked
equations of `$DEC7`, `$BC36`, the glove limits and `$DF6B` were taken over;
their `$A985`/`$AAAF` calls go through the routine table. `ORACLE_NATIVES` is
empty; the mechanism stays. Vs. original with all own instructions in
[task-native-e014.test.mjs](../tools/task-native-e014.test.mjs) (windows
shared with `$EA6E` are checked by its test); the evaluator now knows
stack-relative addressing (`ORA $01,S`).

Mesen cases ([mesen-oracle.test.mjs](../tools/mesen-oracle.test.mjs)), all
identical:

| Case                                     | Frames      | Content                                                                                                                                                                                                                             |
| ---------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start in the fight plan                  | 8480–9100   | `$E014`/`$EA89` opens the status screen (frame 8497); Weapon, Beretta Pistol, Use runs via `$E585`/`$E4F3` to `$A835` and the nested round at `$E545` (frame 8739); round start and end included                                    |
| Select (`$ED3C`)                         | 11130–11380 | After the `$01FC` wait in `$FB39` takes the eight mask words `$7E2AE0`–`$7E2AEE` read by the NMI from VRAM by DMA as observations (`runTaskTextWait` in [native-text-prerequisites.mjs](../src/task/native-text-prerequisites.mjs)) |
| Y (item list via `JSR $EA8E` at `$E037`) | 11130–11400 | —                                                                                                                                                                                                                                   |
| `$CE6D` at the bed in apartment 6        | 12060–12800 | Save to slot 1 with SRAM comparison, karma menu                                                                                                                                                                                     |
| Apartment 6                              | —           | Pick up (`$D16D`) and use shades (round at `$E545`), filing cabinet (`$CCDB`), note (`$E1B3`), video phone                                                                                                                          |

## Main loop between scheduler rounds

Since the user decision of 2026-10-16 the extension of Mesen windows rests;
the next work branch was `wait-interrupt-main`.
[main-loop.mjs](../src/vm/main-loop.mjs) runs the 25 own instructions from
`$96C3` (return of the round) up to before the next `JSR $C1E3` at `$96C0` as
equations. Called routines are in `MAIN_LOOP_ROUTINES`; a missing target
reports `main_loop_frontier`; the two original exits at `$96EC`/`$96F2` report
`main_loop_exit`. [main-loop.test.mjs](../tools/main-loop.test.mjs) compares
call frames, carry shortcuts and exit words against the pinned original
instructions.

Common rules for all groups below: equations work directly on VM WRAM with
real stack frames, DBR switches, WORD accesses and fresh reads after writes;
separately proven external helpers run as identical stubs with real frames in
the differential tests (their own proofs stay required); a DMA request or a
callback pointer never performs a transfer or NMI; observation objects are
immutable and unused device, wait or input observations prevent an equal
verdict; synthetic BYTE wait, input, APU and PPU values in connected cases are
no original scene or NMI flow and give no new equal R→C intervals.

| Routines                                                           | Module                                                             | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Proof                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$8000/$803B`, `$CC4B`, `$DE94`, `$AFC4`, `$BAD5`                  | [main-loop-motion.mjs](../src/task/main-loop-motion.mjs)           | Zones around the player (append a task via `$C34A`); scene check with `$81:B0BD` and observed wait `$81:B0A1`; alternating movement while counter `$1D65` runs; `$AFC4` first builds the spatial search list via `$81:8799/$80F7/$846E` in VM WRAM, runs movement `$AB26` and in a second pass the proven animation `$AC2F` (DBR `$7E`); `$BAD5` stores player position and direction in the formation ring buffer (31 call-free instructions). The older plans in `src/state` stay separate APIs | [main-loop-motion-source.mjs](../tools/main-loop-motion-source.mjs) (three older entries, 700 cases each)                                                                                                                                                                                                                                                                  |
| `$80B2/$8133/$81B4/$8238/$82BC`, list check `$81:85FE/$8686/$86E5` | [main-motion-collision.mjs](../src/task/main-motion-collision.mjs) | The five collision helpers read the original WRAM lists with fresh WORD accesses; `$82BC` skips duplicate cells and ends the search only after a whole cell with result                                                                                                                                                                                                                                                                                                                           | [main-motion-helpers-source.mjs](../tools/main-motion-helpers-source.mjs), [main-motion-helpers.test.mjs](../tools/main-motion-helpers.test.mjs): 1,800 cases per helper, 120 for `$BAD5`, 240 for the connected motion graph. The whole own `$AFC4` graph has 1,242 instructions and at most 19 local stack bytes; only `$AC2F` and `$AAAF` are external return contracts |
| `$C9E0/$C84D/$C913/$C80C`                                          | [main-motion-target.mjs](../src/task/main-motion-target.mjs)       | Target motion graph; uses proven `$AAAF` for direction changes                                                                                                                                                                                                                                                                                                                                                                                                                                    | as above                                                                                                                                                                                                                                                                                                                                                                   |
| `$81:8C2E`, `$8A05`, `$8A91`                                       | [main-loop-camera.mjs](../src/task/main-loop-camera.mjs)           | `$8C2E` projects the player, clamps via `$8A05` and sets speed in steps of four up to ±32; `$8A91` clamps the camera position and copies 32 words into each of the two tile buffers on a cell change; the request at `$0CD0/$0CD6` performs no DMA. Graphs of 142/164 instructions, 8/6 protected stack bytes with the RTL frame                                                                                                                                                                  | [main-loop-camera-source.mjs](../tools/main-loop-camera-source.mjs) (eight contracts: bytes, mode, DBR, frames, external returns); [main-loop-camera.test.mjs](../tools/main-loop-camera.test.mjs): 1,000 synthetic cases each, every own instruction                                                                                                                      |
| `$FF14`, `$E270`, `$81:8877`, `$81:8076`, `$BF3B`                  | [main-upkeep.mjs](../src/game/main-upkeep.mjs) (lifted)            | Timed windows and random sound; remaining time with hint and warning sound; colour request; palette equations; new glove action to task, menu or dialog. Reuses proven sprites `$B8DE`, observed wait `$81:B0A1`, input `$9E1A`, glove movement `$BE6D`. With this all normal calls of the loop pass are bound                                                                                                                                                                                    | as camera                                                                                                                                                                                                                                                                                                                                                                  |

In the existing Mesen window `arch` all five R→C intervals run fully identical
for the first time (`equal-main-loop`), including observed wait and input.
Counter-probes falsify a camera result and add an unused observation. An
observed breakpoint is still no equality proof for a prefix.

### Scenes called from `$CC4B`

| Routines                                                                | Module                                                                                                                   | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Proof                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `$81:CDF8` (cut scene), `$81:C3CA` (Matrix)                             | [main-scene.mjs](../src/task/main-scene.mjs)                                                                             | 158/117 pinned instructions with real PHP/PHB/PHK frames and conditional external return contracts; 9/7 protected stack bytes for own code only. The JML special path of `$CDF8` with selection `$14` runs the bound `$81:DFE7` flow on the same return frame and returns with DBR `$80`; the normal CDF8 path restores the incoming data bank. After shared init the normal flows use the animation dispatcher `$81:CF72` or the Matrix build with text queue. Observation-bound scene flows do not count as equal main loop intervals                                                                                                                                                         | [main-scene-source.mjs](../tools/main-scene-source.mjs), [main-scene.test.mjs](../tools/main-scene.test.mjs): 60 synthetic cases for each of six flows; separate cases run the real init and unpacker graphs up to the required BYTE observation. The stack proof admits PHK, table-bound `JSR (abs,X)` and the external JML path only with their source lemmas                                                                                                                                                                                                                                        |
| `$EB97` + six sub-calls, `$C109`, `$EE4F/$EE22/$ED8B`, `$EDB6`, `$ECF2` | [main-scene-video.mjs](../src/task/main-scene-video.mjs)                                                                 | Closed shared init: 144 instructions, no external return assumptions, 8 protected stack bytes. `$C109` only sets the callback pointer; `$EE4F/$EE22/$ED8B` record PPU/DMA requests; `$EDB6` initialises the OAM buffer; `$EB97/$ECF2` write palette data                                                                                                                                                                                                                                                                                                                                                                                                                                        | [main-scene-video-source.mjs](../tools/main-scene-video-source.mjs), [main-scene-video.test.mjs](../tools/main-scene-video.test.mjs): 180 cases for each of 13 graphs including both original ROM unpack streams, self-modified data commands and unknown table targets                                                                                                                                                                                                                                                                                                                                |
| `$EC16`, `$F2A0/$F2A4`, `$CF79/$D4E8/$D37D`, `$9F4D`                    | main-scene-video.mjs                                                                                                     | `$EC16` reads its own ROM data command stream; its eight handler targets are pinned from `$81:EC2F`; 129 instructions, 12 protected stack bytes, only the proven unpacker `$80:F2A0` as external routine; unknown table targets stop before the indirect JSR frame; commands are re-read after writes. `$9F4D` uses the same proven unpacker code as `$9F49` with its original RTS frame                                                                                                                                                                                                                                                                                                        | as above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| six targets of `$CF72`                                                  | [cutscene-animation.mjs](../proof/cutscene-reference/cutscene-animation.mjs)                                             | Real table `$81:D41F` pinned; the indirect JMP uses the program bank without another return frame; 437 instructions, 8 protected stack bytes under separate return contracts for `$F007`, `$D4E8`, `$D37D`. Scroll tables, portrait movement and text output on shared WRAM; text routines `$D336/$D351` run with BYTE A and WORD indices (real JSR, PHY/PLY, PHX/PLX frames); the REP merge `$D2DB` sets both incoming A widths to WORD                                                                                                                                                                                                                                                        | [main-scene-animation-source.mjs](../tools/main-scene-animation-source.mjs) (seven graphs), [main-scene-animation.test.mjs](../tools/main-scene-animation.test.mjs): 528 cases each for animation and `$F229`, 360 callback cases, 40 per wait graph, counter-probes for limits and BYTE modes; twelve connected cases run back through `$CDF8` (audio a stub; without callback execution `$16/$1C` stay zero)                                                                                                                                                                                         |
| `$EEBB`, `$EED5`, `$EEDD/$EEF1`, `$F229`                                | [main-scene-wait.mjs](../src/task/main-scene-wait.mjs)                                                                   | With the NMI marker off, `$EEBB` reads BYTE `$4212` freshly while bit 7 is set; else it compares the saved low counter byte with fresh BYTE observations of `$7E1C76` (no counter word or assumed frame count replaces them). `$CDF8` polls `$11A3` only with validated immutable BYTE observations; missing or invalid values stop at the poll. `$F229` (23 instructions) is bound to the proven APU/audio helpers                                                                                                                                                                                                                                                                             | as above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Callback `$81:D479`                                                     | cutscene-animation.mjs                                                                                                   | Installed by the six real data programs; 64 instructions with `$F290/$9E0B`, 9 protected stack bytes, separate `$ED8B` contract: writes scroll registers, moves `$16/$1C`, outputs brightness and moves `$11A3` exactly one step towards `$11A2`; then real WORD reads of the joypad ports; returns with BYTE A. The ROM NMI bracket `$00:C136..C13B` saves the status around the call via `$80:C14F`; the handler then restores registers and the interrupted stack and ends with RTI. This chronology forbids running the callback automatically from a counter observation; in particular the zero observation at `$CF4C` is required before the last `$EEBB` and the switch-off via `$EB89` | as above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `$DFE7` (reference of src/intro), `$EF63`                               | [intro-scene.mjs](../proof/intro-reference/intro-scene.mjs), [intro-setup.mjs](../proof/intro-reference/intro-setup.mjs) | `$DFE7` sets up the scene, runs up to 300 iterations or leaves on a non-zero joypad word, fades out and calls `$CDF8` with pinned value `$8005` (normal path, no repeated DFE7 call). `$EF63` sets the data bank to `$80` before the original status and the shared RTL frame are taken back; 137 instructions, 9 protected stack bytes                                                                                                                                                                                                                                                                                                                                                         | [main-scene-intro-source.mjs](../tools/main-scene-intro-source.mjs) (ten graphs, six data tables; a new external JML bank lemma admits only the separately proven DBR exit of an admitted external tail; CDF8 and DFE7 contracts agree for DBR `$80`); [main-scene-intro.test.mjs](../tools/main-scene-intro.test.mjs): 360 synthetic cases each, pointer/counter aliases, both full zero-count loops, bank carries, missing APU answers; two connected cases (early button press and all 300 iterations) run the special path on the unchanged outer frame back to the return with real audio modules |
| `$D60F`, `$D83E`, `$DC43`, `$D642`, `$E8E5`, `$E900`, `$DDB1`           | intro-setup.mjs                                                                                                          | `$D60F` uses display init, the EC16 data program and the five unpacker entries behind `$D83E`, whose PHP-free PHK/PLB entry sets DBR `$81`; a WORD PLA takes the saved X back after unpacking. `$DC43` builds the four original position entries; `$D642` copies exactly the original 14 bytes of the HDMA table and records register requests; `$E8E5` clears the slot list, `$E900` searches backwards for a free entry and computes the sound parameter from ROM tables; `$DDB1` and `$EF63` use the audio helpers                                                                                                                                                                           | as above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `$F092`                                                                 | intro-setup.mjs                                                                                                          | Loads the audio directory and the original raw/repeat stream via proven `$F007/$F03A/$F100/$F122` (fresh DP pointers and counters after sub-calls). Raw counter 0 runs 65,536 BYTE steps, repeat counter 0 65,536 WORD steps; 70 instructions, 6 protected stack bytes; APU answers stay required device observations. Directory entries `$00/$03` hold streams with length words 49,541 and 29,055                                                                                                                                                                                                                                                                                             | both original audio streams run through the real APU helpers with an explicitly synthetic, immediately matching acknowledgement                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

The data programs `$F6EF/$F79F` first install callbacks `$81:DAD6/$81:DF0E`
before the nested cut scene sets `$D479` (the intro NMI group below adds
these callbacks). The Matrix control graphs from `$81:BD44` and `$9629` are
bound by the groups below. Open: `$A4BF`, the original loop exits and nested
action rounds outside the compared R→C intervals; NMI, DMA, device, scene and
automatic frame binding are separate limits.

### Matrix

| Routines                                                                                                                     | Module                                                                       | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Proof                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `$B4D3/$B4B9`, `$B259/$B282/$B2A0/$C39F`, `$B2D1`, `$B3D3/$B473/$B485`, `$B818/$B84A/$BD62`, `$B228/$BFD8/$BFF8/$C029`       | [main-scene-matrix.mjs](../proof/matrix-reference/main-scene-matrix.mjs)     | 32 × 32 map words and seven markers; text queue; text commands 1–6 via four handler targets; scroll display; display build. Graphics writes are requests with original PCs; the routines create and change the original WRAM records (a DMA request does not empty the WRAM queue). `$B282` takes the saved X/Y back with two WORD PLA; the ring index advances only after these writes. `$B2D1` reads pointer and counter freshly; its source pointer increments as WORD without an invented bank carry; byte 0 ends the text, bytes from 32 are glyphs; commands 1–6 have pinned table targets; 7–31 stop with `matrix_text_command_frontier` before the indirect JSR frame (their table accesses would reach into following instruction bytes; no invented handler)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | [main-scene-matrix-source.mjs](../tools/main-scene-matrix-source.mjs) (21 graphs, 2–6 own stack bytes); [main-scene-matrix.test.mjs](../tools/main-scene-matrix.test.mjs): 72 cases each, ring overflows, pointer wrap, source/output alias; all six original start texts end through the real helpers (queue emptying between them synthetic). A connected `$C3CA` case with selection 0 returns via real unpacker, audio, map and text helpers (the audio directory pointer is set from ROM as precondition); selection 1 runs through the real `$C029` build and checks the deliberate removal of `$B56F` without its frame. Data program `$CDB2` installs `$81:BEC3` |
| `$B56F/$B54C/$B8C8/$B1C6`, `$BD7C/$BD99/$EDD7/$EE0C`, `$B66A/$B696/$B69D/$B6A6/$B90F`                                        | [main-matrix-objects.mjs](../proof/matrix-reference/main-matrix-objects.mjs) | Markers, object creation and sound calls; movement, animation data and OAM buffer; map words and object removal. The original list has 33 entries; with a full list `$B8C8` returns without record or sound; `$B56F` counts its candidates before that call (not reinterpreted as created objects). `$BD99` keeps the original CLC before the vertical SBC and so the extra minus one, including all visibility limits; animation word `$FFFF` resets the index to 0 and reads again, `$FFFE` clears the active bit; a repeated restart without another data word gets no invented exit (the diagnostic access guard stops). Negative X coordinates and original high-bit masks stay. `$EDD7/$EE0C` only build the OAM buffer; `$B6A6` fills the original map word ring and the DMA request record                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | [main-matrix-objects-source.mjs](../tools/main-matrix-objects-source.mjs): 13 graphs, 384 instructions (825 bytes), five data windows, 2–8 own stack bytes; [main-matrix-objects.test.mjs](../tools/main-matrix-objects.test.mjs): 120 synthetic cases each, full lists, candidate counting before failed allocation, fresh saved WORD values, clipping limits, animation ends, an infinite restart, incoming BYTE/WORD modes of the OAM helpers, real APU compositions with counter-probes                                                                                                                                                                              |
| `$BD44` with all state routines, `$C111/$C28C`, `$B1B5`, `$B609/$B71F`, `$B8AD`, `$B959/$B9D0`, `$C108`, `$C25C`, `$80:F2A8` | [main-matrix-control.mjs](../proof/matrix-reference/main-matrix-control.mjs) | Rotation, movement, feedback and the two action flows. Three indirect call sites read WORD targets freshly from the program bank: `$BD56` for states 0–10 in steps of two, `$BB56` for the four input bits, `$BC1B` for rail directions 0, 4, 8, 12 (zero words between them are no handlers); invalid indices or targets stop with `matrix_control_dispatch_frontier` before the inner frame. `$B1B5` subtracts costs saturating at 0; `$B609/$B71F` search map neighbours or the bounded room with the existing object allocation (no invented termination; unbounded data reach the access guard); `$B8AD` changes animation only for another pointer; `$B959/$B9D0` connect proximity, feedback and damage with the map, text and audio helpers; `$C108` jumps on the existing frame to `$B282`; `$C25C` reads its saved X freshly from the stack and rejects a cost level that reaches capacity or is at least 64. The BYTE cost lists behind `$C330/$C396` are read as WORD and limited to the low byte only in the cost helper; marker writes before a failed capacity check stay. `$80:F2A8` sets DBR 0 before the original `$C51F` call and restores the saved bank; the random helper needs explicit BYTE observations at `$00:2137/$00:213C/$00:213D` (missing, wrong width or bank stops; no PPU state derived from scene or wait time) | [main-matrix-control-source.mjs](../tools/main-matrix-control-source.mjs): twelve graphs, 696 instructions, 1,687 code bytes including the proven `$B282` tail (15 instructions), eleven data windows, 2–8 own stack bytes; [main-matrix-control.test.mjs](../tools/main-matrix-control.test.mjs): 720 synthetic cases each plus direction/rotation cases; a connected `$C3CA` case runs build, control, actions and teardown to the original return with identical WRAM, registers and device log (the callback `$BEC3` and its `$B1E2` were not run in that earlier case; the earlier limit test now removes `$BD44` from the routine table explicitly)                |

### Explicitly called Matrix and intro NMIs

[main-matrix-nmi.mjs](../proof/matrix-reference/main-matrix-nmi.mjs) follows the native
vector `$00:FFEA = C112`. `runObservedMatrixNmi` receives the really
interrupted register state and pushes PB, PC and P onto its stack through the
shared flow in [observed-nmi.mjs](../src/task/observed-nmi.mjs). The handler
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

The intro callbacks in [main-intro-nmi.mjs](../src/task/main-intro-nmi.mjs) (the sprite
grid `$E83A` and `$E971` as reference in
[intro-sprites.mjs](../proof/intro-reference/intro-sprites.mjs))
(`$DF0E` as reference in [intro-scene.mjs](../proof/intro-reference/intro-scene.mjs),
lifted in src/intro) use the same outer NMI flow:

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

[main-initialize.mjs](../src/task/main-initialize.mjs) binds the complete
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

[main-game-nmi.mjs](../src/task/main-game-nmi.mjs) binds the installed
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

[main-wait-interrupt.mjs](../src/task/main-wait-interrupt.mjs) connects
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

[main-dma-readback.mjs](../src/task/main-dma-readback.mjs) takes exactly one
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
[observed-native-events.mjs](../src/task/observed-native-events.mjs) binds the
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

## Whole scene calls with their really installed NMI targets

[main-scene-interrupt.test.mjs](../tools/main-scene-interrupt.test.mjs)
connects scene and interrupt contracts up to the original return. The
reference side runs the original instructions of the scene roots, their
wait/input calls and the full NMI to RTI; separately proven helpers use their
native equations. Caller frames, registers, whole WRAM and all device accesses
agree.

- The special path starts with the real JML from CDF8 to DFE7 and keeps the
  outer frame until after the nested CDF8 sequence and EF63. The data programs
  install DAD6, DF0E and D479 in this order; DAD6 is replaced by DF0E while
  the NMI is off, so the case invents no DAD6 execution. Explicit occurrences
  at the wait instructions first run DF0E and later D479. The intro callbacks
  read the joypad after their DBR switch from bank 81, D479 from bank 00. One
  case ends the DFE7 loop after a button press in its first iteration, the
  other runs all 300 iterations.
- Both C3CA variants use the original map, object, control, audio and text
  helpers with the really installed BEC3. The text producers create the queue
  that B1E2 consumes and empties in the explicitly run NMI via its moved stack;
  BFD8, BFF8 and C029 run their own original waits. The Matrix game variant
  reaches the control/action calls and the final fade; the original audio
  directory is its explicit precondition.

Every given NMI occurrence lies after the program's real NMI enable; the lists
hold only the supported wait/input sites. BYTE wait values, joypad words or
queue emptying are not injected from outside.

## Main loop and real scheduler round on the same VM

[main-driver.mjs](../src/vm/main-driver.mjs) connects the return at `80:96C3`
via `runMainLoop` with the next original `JSR C1E3` at `96C0`: it pushes the
real WORD `96C2` on the existing stack and uses `TaskScheduler` on the same VM.
`run(budget)` takes exactly one observation set for `80:96C3`; natives in the
round take their own following sets; the accessor belongs to the same
`NativeCalls` so nested rounds keep the outer registers and IO positions.

- Budget, missing native, unknown continuation and explicit breakpoint keep
  the scheduler stop codes and the live JSR frame. `resume(budget)` continues
  only this round without re-running the main loop section or observations.
  Only the real return to `96C3` with original S, D0, DBR80 and WORD/binary
  mode increments `roundsCompleted`.
- The first original entry `80:9688` is also accepted and consumes a set for
  `80:9688` (start prefix and first `96AB` section, no `96C3` post-run).
- A changed return word stays visible as real VM state and is not repaired.
  The caller requests every round explicitly; wait counters run only on real
  visits, NMI progress only through supplied occurrences.
- Entry, owner and budget are checked before the set is consumed; after a
  started direct run effects stay visible at missing records or frontiers (no
  atomic plan). Unconsumed interrupt, DMA, old wait/input and IO records are
  rejected. An inner round stopping with an exception keeps its VM frontier.
  The two original main loop RTS at `96EC`/`96F2` take the menu owner's real
  frame (below); without owner they are a named limit.

[main-driver.test.mjs](../tools/main-driver.test.mjs) pins the JSR and compares
its whole outer instruction sequence with the original code; further cases
check all stop kinds, resume, real F953/NMI calls with separate observation
sets, C401 over three requested rounds, both loop exits and damaged frames and
fault states (independent main loop helpers synthetic in these integration
tests).

## Original new-game and load entry before the first round

[main-start.mjs](../src/task/main-start.mjs) maps `80:9688` up to the first
`96AB`. The WORD loaded from DP00 selects `960D`/`98E9` when negative, else
`81:B198`. The new-game helper unpacks the original stream `8B:FBD2`, runs both
original MVN and writes the original values for characters and scene. B198
loads exactly `0F28` bytes from the SRAM offset determined by B11A to
`7E:2DE0..3D07`; PHP/PHB and PLB/PLP keep the original status and fresh stack
bytes; the SRAM mapping stays active, also for the four pinned table entries.
The validity decision of the outer menu is not part of this entry. The load
path takes the scene word from `7E:2DE2`; the original PHA/PLA keeps it across
`9629`; then the real A4BF scene transition, both STZ exit words and
`81:8861`. A changed stored WORD is read freshly. `runMainLoop` accepts the
first entry `96AB`; the driver then builds the same real `96C2` frame for C1E3.
No earlier boot state, SRAM content, interrupt time or device values are
created. [main-start-source.mjs](../tools/main-start-source.mjs) pins all new
instructions, the original character/slot data and the stream header; the
proof for 9688 covers the whole following main loop with both real RTS instead
of inserting a return at the prefix end; 960D, 98E9 and B198 with B11A have
their own stack/mode proofs. [main-start.test.mjs](../tools/main-start.test.mjs)
compares the helpers including original unpack instructions, bank return and
SRAM mirroring; both paths with pinned scene address 2DE2, fresh PHA/PLA,
missing SRAM and helpers; whole start cases use real init, scene and observed
C152 NMIs on the same memory (the load case uses an SRAM set produced by the
original helper B17D) and agree in registers, WRAM, SRAM, device accesses and
outer frame up to before `96AB`.

## Original menu owner and return from the game

[main-frontend.mjs](../src/task/main-frontend.mjs) binds the endless original
owner `80:A139..A15A`. A18C picks new game or a load slot after title sequence
and menu; B1AB checks the original checksum. The owner reads the original WORD
from `70:1FFE` to `1FD6`, calls EF63 and E24E and pushes at A154 the real
return value A156 for 9688. The driver keeps this frame over budgeted C1E3
rounds; both main loop RTS really take it and stop at A157
(`STOP_MAIN_OWNER_RETURN`); the next `run()` runs the original LDA 0 and the
next menu choice. A changed return word stays visible at the target really read
and is reported as owner fault. On menu timeout A168 calls a demo game via
`96F3`: the original JSR 96FC enters `9699` with scene AB (same scene build as
9688); its own frame stays on the stack until one of the two main loop RTS,
then RTL 96FF takes the long A16C frame back. A18C, A168 and 96F3 are lifted
since 2026-11-11 ([TITLE-CYCLE-LIFT.md](TITLE-CYCLE-LIFT.md)), and so is the
owner A139/A157 itself (src/frontend/game-owner.mjs, the routine table's entry
80:A139; same document).

[main-frontend-menu.mjs](../src/task/main-frontend-menu.mjs),
[main-frontend-text.mjs](../src/task/main-frontend-text.mjs) and
[main-frontend-nmi.mjs](../src/task/main-frontend-nmi.mjs) map title sequence
D694/DDDB and selection E14A/E29F (both lifted in src/frontend, reference in
proof/frontend-reference/), text tiles, locked load rows and SRAM settings.
The original data programs install DD54, D93E with D9D5, DCAC and E6AE as NMI
callbacks, using the same observed C112/RTI composition; DCAC and E6AE can
return X8 or X16 and the outer NMI restores the saved status.
[main-frontend-source.mjs](../tools/main-frontend-source.mjs) pins 42 source
contracts, including the endless owner without invented RTS, the shared scene
continuation, data programs and menu/palette tables; the stack proof keeps
path-specific widths at pinned width-independent control/BYTE stack
instructions and separate DBR returns; the dialog inventory takes M1 explicitly
from the canonical progress for the three BYTE checksum roots (default roots
stay M0/X0). Frontend tests compare own equations with original instructions
including all menu and title callback instructions; connected cases use real
text, audio, save and NMI helpers: new game, invalid slots, settings, title
exit and a valid slot 1 created by original B17D; owner/demo cases check the
real frames and both main loop exits.

## Logo/hint prelude and SPC transfer before the first menu

[main-startup.mjs](../src/task/main-startup.mjs) maps the original prelude
`80:A133` via A15C and `81:E7BC` up to the first A139. A15C keeps its real A135
frame and the status and sets DBR 80 via PEA/PLB; only the original LDA 1 falls
into the menu owner. The driver accepts A133 as further explicit entry with its
own observation set. E7BC runs both original data programs for logo and hint
with real unpacking and PPU/DMA requests; both install the empty RTL callback
`81:E839`; observed NMIs use the C112/RTI frame; wait/fade helpers use really
advanced counters. The prelude masks the original WORD from `70:1FFC` with
0180, checks the BYTE checksum and keeps valid settings or runs the default
routine D5F4. EF07/F07F transfer the original SPC stream `97:8000`, length
0C55, via EFA5/EFFA/F001: AA/BB handshake, the real INC read/write of 2141, CC
acknowledgement, every single byte acknowledgement and the final CA poll need
chronological port observations (the original transfer flow, no SPC processor
or audio device model). Zero in WORD X means exactly 65,536 iterations; source
pointer and port values are read freshly. The first audio requests and the
settings follow via F007 without invented acknowledgements.
[main-startup-source.mjs](../tools/main-startup-source.mjs) pins nine source
contracts and both data programs;
[main-startup-connected.test.mjs](../tools/main-startup-connected.test.mjs)
compares whole preludes with real logo/hint/audio helpers, SPC bytes, valid and
invalid SRAM settings and installed E839 NMIs; the A133 case ends correctly
before A139.

## Reset and software restart with the original mode switches

[main-reset.mjs](../src/task/main-reset.mjs) runs the cold vector entry
`00:E382` and its alias `80:E382` bank-exactly; ROM vector 00:FFFC holds E382.
E1, M1/X1, D0, BYTE indices and a stack in page 01 are explicit entry
observations; no reset registers, WRAM/SRAM contents or device time are
invented. Early PPU/APU requests use the real DBR; PEA/PLB then sets 80;
CLC/XCE switches to E0, CLD clears D, REP30 sets WORD widths, TCD sets DP 0000,
TCS sets the real stack 013F; JML enters A133 without a return frame. The
software branch `80:9E3D` runs its real F007 call, sets E1 and a page-01 stack
via SEC/XCE and jumps to 80:E382; old call frames are abandoned by the original
TCS, not artificially popped. The driver accepts an explicit E1 entry at
80:E382 or the proven software branch; an original comparison stopped at
`9E2F` with A3030 and Z set can continue with a new observation set; only after
a successful entry/owner/observation check is an old pending round abandoned;
the new menu/game frame then lies on the original 013F stack. The input adapter
still reports the reset as a clear frontier; the owner takes it on the next
explicit driver call. [main-reset-source.mjs](../tools/main-reset-source.mjs)
pins both physical bank windows and the software branch; its proof follows
control edges, E/M/X, both carry/E swaps, DBR, the PEA/PLB bytes and the real
D/S values up to the non-returning JML. The dialog inventory takes E1/M1/X1
explicitly from the progress and still stops at the unknown XCE. The test
reference treats XCE and CLD by their instruction effects; comparisons with
differently pre-filled memory keep SRAM and all WRAM bytes the original does
not write; whole cold and warm preludes then run real logo/hint/SPC helpers and
observed E839 NMIs up to before A139.

## Continuous reset, menu and task owner

[main-boot-connected.test.mjs](../tools/main-boot-connected.test.mjs) runs on
the same ScriptInterpreter VM the explicitly given E1 context through the
original reset, both logo/hint programs, the real SPC transfer, title sequence,
menu choice, new game and scene init into the task round. All helpers are the
real separately proven modules; the test evaluator runs the pinned own original
instructions and shares only these helper contracts and the same chronological
observation set.

- The first real C1E3 round returns without opcodes: the initially negative
  cursor is set to the real list head. The next round reaches F390 with budget
  0, opcode 2C, D06F6, S070F and DBR83; no tasks are written ready. Registers,
  whole WRAM and SRAM and all device accesses agree at the real limits. Outer
  return words A156 and 96C2 stay on the original 013F stack while the task
  uses its own operand stack.
- Another path reaches the real input frontier through observed 3030 on the
  same owner; a new set takes over at 9E2F, runs the original BEQ and software
  restart and reaches the same task again. F007, SEC/XCE, CLC/XCE and TCS
  really abandon the old frames; the driver consumes two or four separate sets;
  no return between them is invented.
- Both paths continue the reached task with finite budgets of 16 and 7
  opcodes; 20 and 47 budget interruptions keep the real outer frames. The
  round runs 331 opcodes, 52 real leaf native calls, 19 C401 wait calls and 11
  script calls with child task, then really returns to 96C3 with S013D, D0 and
  DBR80; A156 stays for the menu owner; no extra device or interrupt
  observations are consumed.
- [main-boot-round-reference.mjs](../tools/main-boot-round-reference.mjs) runs
  the pinned original C1E3 instructions; its C1F9 calls compose the existing
  visit, opcode, leaf, Native9F, child and post-run contracts on an overlay.
  Inner C20A frames are acquired only by the original push occurrences and
  consumed at the fresh return. Native9F is chosen only after the real argument
  and bridge writes from the fresh DP A2; its real F508 word is stored as later
  continuation without calling it at once. The reference uses no
  ScriptInterpreter or TaskScheduler; all registers and whole WRAM/SRAM agree
  at round end, as do opcode and native counts. The earlier connected state of
  60 full task rounds (6,655 opcodes) ended before FEC1 in round 61; this limit
  is closed: the source composition connects C8/FEC1, 4C/C46E, C2/CDA8 and
  D0/E014 via their own complete contracts with arguments, real bridge, fresh
  DP A2, real RTS to F509 and original continuation; the original metadata
  distinguish the two natives without result from CDA8 and E014 with a really
  pushed result. No leaf admission.
- On the same cold owner 1,600 full task rounds are compared up to player
  control: eight hints, four sound calls, two window lists, 18 calls of E014.
  Then eight rounds each for all eight directions, two combinations of opposite
  buttons and release: 1,688 full rounds in total (the first rounds after the
  software restart included). At every round end all registers, whole
  WRAM/SRAM and device accesses agree. The direction block runs 153,765
  opcodes, 14,152 wait resumes and 120 special native calls; 256 read camera
  bytes cover all eight directions; the menu frame A156 stays.

### Connected route blocks on the cold owner

Each block continues the same owner without new initialisation; after every
full round both flow owners agree in registers, whole WRAM/SRAM and device
accesses; the input word at round end is compared with the last really consumed
controller read (including native-owned NMIs). Scene changes initialise the task
list themselves; the first C1E3 round of a new scene returns without opcodes
because of the negative cursor and takes the real list head (the observation
construction accepts this real empty round besides the budget stop; other stops
stay faults; no cursor is written). Checks of old scene objects refer to their
lifecycle at that time because new scenes reuse object and task places. Start
memory, device answers and chronology stay synthetic; no visible picture,
original frame/time equality, original boot oracle comparison or M3 completion
follows from these blocks.

| Block                  | Route and findings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Totals after the block                                                                                                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Glove (short way)      | Eight rounds each of B, release, right, down, release, A, release run E014/BC67/BC36, movement via BE6D and closing via E014/BCB2. Type 01D8 first FFFF, after A zero; X 01D4 rises C000 → C6C0, Y 01D6 6D00 → 73C0. No object is marked (01DA stays FFFF), so this does not count as name window or action menu                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 1,744 rounds, 158,978 opcodes, 14,567 wait resumes, 176 special native calls (162 E014)                                                                                                                                       |
| First scene objects    | Twelve rounds left move the player, release stops; B puts the glove over the new position; without coordinate writes BCBE finds the type 13 object on place 54 (picture present, name 6AA2, task 2, script 133); FADD measures the real ROM text, F963/FE69 open the name window (its main interval set holds the real text/wait/C152 NMI/DMA occurrences; the 16 mask bytes are synthetic like for hints). L runs BF3B to event 0080 on task 2 with wait mask 0480; the scheduler checks readiness itself and resumes via real F508/F509; script 133 shows two hints (own FEC1 sets) and returns to waiting after 60 more rounds; no task events or readiness written by the test                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | —                                                                                                                                                                                                                             |
| Action menu            | A type 51 object on place 3A becomes visible; the next B glove marks it by the fresh scene list order; its task 1C waits for child 2A (script 2AB) and BF3B follows the real predecessor chain. B opens the action menu via 99EB/A6A5: one case cancels (event 0, wait mask 0090); another navigates down and confirms A for examine (event 0080 at the real child, hint, real return to mask 0090). Menu inputs are supplied only at the controller read of the C152 NMI; saved hardware PC B0A5 and the real long caller A6EC/80 map given inputs to menu polls; other window/text NMIs keep their given base key; only fully frozen IO/interrupt/DMA sets are replayed on both owners; missing or extra menu inputs fail on private copies without touching the live owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | —                                                                                                                                                                                                                             |
| Pick-up                | B marks the same object again and R sends event 0010 via the child chain; script 058 takes the record via native 6F/9D6A for the real leader 7E2DF0; its call of script 04B waits five rounds and plays the original sound via C46E; the real child/parent return ends both tasks (gone from the active list, object picture zero); the owner in the record is checked                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | —                                                                                                                                                                                                                             |
| Inventory              | Y reaches the status screen with item list via E014/EA8E; the real record and ROM name are in menu tables 1E2D/1DA9. One case shows and cancels; another picks the item with down/A: E4F3 builds the original action task via A835, sets its record fields and visits it with real JSR C1CA at E545 (the waiting main owner stays). The nested round reaches native 13/9BA0 (metadata 0201, result word); its own action menu has its own NMI/IO/DMA set; down/A chooses examine, then its own FEC1 hint; bridge, fresh DP A2, F509, result, child/parent return and return from C1CA run for real; the outer inventory menu is cancelled. No consumable effect is claimed (the inner action is examine). The source reference also runs the pinned own C1CA instructions (the C1F9 frame returns to C1D9 there, in the outer C1E3 round to C1EB); private visits publish writes only through the budget and stack checks of the parent private view and only after the whole outer visit succeeds; the inner view gets only the admitted camera word as private snapshot (four provider cases). Portrait and scene tiles wait at the real inline polls 901C, AE0C, AE5E for the C152 NMI (the callback writes 0140/1562 itself); the two outer E014 calls own 590 and 823 interrupt occurrences and 32 and 45 mask DMA sets                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | six additional full rounds equal                                                                                                                                                                                              |
| Inner door             | 70 rounds left, 55 up, release (real collision limits the movement); B, 16 rounds left and release mark the door object type 18 on place 4E; original task 8 waits with mask 0200; R sets event 0200 via BF3B and real readiness/F509 continue the door flow. After 30 rounds task 8 waits for child 1C with mask 0400 and picture word 1090 changed 9422 → 93FE; object boxes change with the animation, so B and six glove rounds left reach the opened door part; R sets event 0400 at the real child (parent not written ready; both events checked before the scheduler). Closing runs the counter and animation waits of script 074, its sound, real END and parent resume; after 30 more rounds picture word 9422 again, hierarchy 8/1C/2A waits with mask 0200. Two more FEC1 hints and four C46E calls with own sets; name windows before opening and closing have their own mask DMA sets. Tasks 1C/2A of the pick-up are later really reused for the door (not confused); scene value stays 3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | —                                                                                                                                                                                                                             |
| Exit to the corridor   | The inner door is opened again via fresh chain 8/1C/2A; a given route with real direction buttons passes the open wing and the passage; the exit door type 18 on place 50 is marked by B and glove movement (own name window); R sends event 0200 via original chain 6/36, whose child accepts with mask 0200 and then waits for 0400. The route around room obstacles reaches the original exit zone: in round 2,677 the scene value changes 03 → 1F. 2,003 opcodes then run in the new room including two CDA8 window lists; the transition set has twelve device reads and 29 explicit interrupt occurrences                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 2,765 rounds                                                                                                                                                                                                                  |
| Street and punk dialog | 400 rounds right through the corridor, 150 down, release; round 3,179 builds scene 01. Native63/C560 gets its own set per call: three BYTE reads at 80:C566/C572/C57F observe 80:2137/213C/213D with synthetic zero (the discarded latch byte included; no interrupt or DMA; metadata 0100, result word 0002). 85 rounds up reach the punk on place 40; his task 16 checks the distance, runs its 25-round wait and calls Native95/936C in round 3,344 with object 40 and record 007F (metadata 0202, no result stored). The dialog composition runs portraits, greeting, menu and close; only its real A6E9/B0A1 menu polls get release/B for Exit, other text polls B. The dialog owns 1,972 device observations, 517 interrupt observations and six mask readbacks; real C152 NMIs serve the waits 901C, AE0C, AE5E. After the scene rebuild and the return via F509 the original script moves the punk on and ends its task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 3,622 rounds, 259,772 opcodes, 21,507 wait resumes, 2,092 special native calls (11,089 opcodes in the corridor, 20,552 on the street)                                                                                         |
| South-west and alley   | 700 rounds down, 700 rounds left-up: round 4,601 changes scene 01 → 04; after release left-down through the exit zone reaches alley 02 in round 5,229. Native3E/C51F (metadata 0201, result word 0002): each executed attempt consumes own BYTE observations for latch, horizontal and vertical counter at 2137/213C/213D (synthetic zero, not a PPU timing model); five calls: the first with three attempts and nine reads, the other four with one attempt each; real masks 000F and 0007. The block stopped at the last full round before the new fight (a separate route probe reached NativeAC/8521, not counted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 5,449 rounds, 325,019 opcodes, 25,268 wait resumes, 3,984 special native calls (14,451 opcodes south-west, 6,523 in the alley)                                                                                                |
| Fight                  | Connects NativeAC/8521 with fight list and music change via EF47, target choice 07/8BC5, enemy shots 10/8AB5, Jake's shots 58/8A51 and fight end C0/855E. The original tables are checked for target, argument word and result byte; C0 has return word 0200: only the low byte decides about a result (the high byte belongs to the next native), so an empty result no longer requires a fully empty table word. Constant zero values can trap an enemy's C51F discard loop; the fight sets use cyclic synthetic horizontal bytes 00–FF at C572, restarting per call (latch and vertical byte zero; no PPU model, no random result or WRAM word set). The Beretta on place 4C is reached with the glove and picked up with R; Start opens the status menu and the weapon item is used via its real action task (a second nested C1CA round runs the action menu); equipping and direction/A inputs reach the orc on place 52 (input follows only the current cursor and the BC36 projection; no game coordinates written). Cancel marker 1D63 left by the weapon menu stays original FFFF while the menu is closed via 1F62. The enemy has two lifecycles: parent script 1D5 (9B:D0D2, body D0D4) on task 4 calls fight script 251 at bytecode A4; its real task place 0E with frame 04FF runs END in round 6,488 (observed independently from the VM exit and the original source flow at exactly this task/frame); only the real F495 parent resume reaches native C0 at bytecode AD; then 1D5 runs its corpse flow and waits at saved PC C8 with mask 0080 and continuation F508 for examination. This parent has no END and stays active (its presence is neither an ongoing fight nor a missing child end). The crosshair is closed, the old music restored and real direction input moves Jake again; this ends the route probe series | 6,549 rounds, 347,988 opcodes, 27,028 resumes, 4,679 special native calls, two nested rounds; the five fight contracts ran 1/35/17/15/1 times with 4,516 IO reads, 18 interrupt observations, no DMA inside these native sets |

[main-boot-native-observations.mjs](../tools/main-boot-native-observations.mjs)
builds every set on a private copy of the really reached state; only the frozen
chronology is replayed on the live owners; every main call and special native
has its own set. FEC1 waits via real C152 NMIs; the 16-byte readback to
7E:2AE0 is supplied as its own DMA set with original registers and explicitly
synthetic zero bytes. PPU product, counters, busy and APU answers are synthetic
device answers, not measured frames; readiness, task data, counters and time are
never injected.

The direction bits are checked against [book1_text.pdf](../Ressources/book1_text.pdf),
Book I, chapter 28, PDF page 148 (printed 2-28-9, STD CNTRL1H): bits 3 to 0 of
the high byte mean up, down, left, right; WORD masks 0800, 0400, 0200, 0100.
ROM table 80:DF4B maps the eight valid combinations to eight different even
direction indices; 0300 and 0C00 each select index 10 hex like no direction
(separate from the hardware finding). Enable, real start window and device time
remain the limits of the
[controller spot check](MANUAL-SPOT-CHECKS.md#automatic-controller-polling).

[main-boot-reference-view.mjs](../tools/main-boot-reference-view.mjs) copies
the whole current WRAM into a private typed buffer before each visit and shares
only the immutable original ROM; it keeps stack owners, work and output budgets,
real WORD wraps and later fresh pointers; only a successful visit publishes its
writes and observation cursors. The pinned DEC7 contract reads only camera word
70:1FFD/1FFE from a fresh private SRAM copy; other SRAM reads and all SRAM
writes stay limits. Three tests compare the provider with the five-handler
composition and check budgets, owners, private fault effects and the narrow
SRAM contract. The diagnostic counter of the outer reference restarts per
interval like the driver's; the access limit is unchanged. NativeWaitResume
still checks C3C9 readiness, fresh counters, events and the real continuation
itself; a stored F508 only selects this contract. With a missing special native
set F4F6 stays repeatable; supplied sets run via the normal resume without
re-running arguments or opcode; budget zero ends the native return and stops
before the next opcode at F390. The first original comparison of the cold boot
start is described in [BOOT-ORACLE.md](BOOT-ORACLE.md).

## Coverage

`npm run analyze:vm-coverage` writes [vm-coverage.json](../analysis/vm-coverage.json):
scripts whose reachable natives (directly and via script calls) are all proven,
and missing natives sorted by the number of scripts they alone unlock. State
2026-10-14: 937/937 statically suitable, no native missing. Static suitability
is no runtime statement.

## Limits (next steps)

- All natives reachable from the 937 scripts are statically proven; the
  boundary to the original main loop is handled via the routine table above.
- Hardware values exist only as given observations; the game needs recordings
  (M2, Mesen2) or models of NMI, joypad, PPU counters and APU.
- The native adapter allocates per native call (module return objects, special
  native options); frequent natives can become allocation-free VM functions
  when needed.
- No stack/write window check in game mode; these are proof tasks of the
  oracle and the Mesen comparisons.
