# Resumable wait and input points

The next work block is in the [porting status](PORTIERUNGSSTAND.md), group
`main-loop-96ab`. This contract complements the
[cold task owner](BOOT-ORACLE.md#cold-owner-task-rounds-and-native-nmi) and the [room output](PPU-ROOM.md).

## Original sources and continuation

[NativeWaitContinuation](../src/task/native-wait-continuation.mjs) holds fixed
JavaScript equations for four existing ROM routines. It decodes no CPU
instructions. One step executes exactly one original instruction and keeps PC,
registers, flags and the real return frame on the same owner.

| Entry   | Pinned source                                                                                          | Kept contract                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 81:B0A1 | [counterWindows](../tools/render-task-native-counter-b0a1-source-proof.mjs), 11 bytes / 4 instructions | WORD base in A, fresh long CMP at 7E:1C76, BEQ from the flags already set, actual RTL                     |
| 81:EEBB | [sceneAnimationSpecs, eebb](../tools/main-scene-animation-source.mjs)                                  | PHP/SEP20, BYTE counter or HVBJOY bit 7, kept high A, PLP before RTL                                      |
| 80:9E0B | [gameNmiSpecs](../tools/main-game-nmi-source.mjs), 15 bytes / 6 instructions                           | WORD reads of 4212 until busy bit 0 is clear, then WORD of 4218, store to DBR:01CA, actual RTS            |
| 80:9E1A | [inputApuWindows](../tools/render-task-native-input-apu-source-proof.mjs), normal 35 bytes             | Three fresh input word reads, edge and previous state, reset compare 3030 and the original low bit filter |

`run(budget)` returns `WAIT_PAUSED` or `WAIT_RETURNED`. Budget zero has no
effect. The budget unit is a measure of work, not CPU time. Any number of
pauses changes neither the NMI counter nor the joypad, readiness or device
replies. A later CMP reads fresh; a BEQ already reached keeps using the flags
of the CMP before it. RTS/RTL read the real stack only when they execute. An
owner that has returned does not return a second time. Changed register owners
are refused before further effects; a failed call cannot be repeated by
calling `run` again.

The observed synchronous B0A1/EEBB/9E1A adapters use the same equations. Their
instruction hook still consumes every original record and runs an explicitly
observed NMI through the complete handler with RTI. Without a matching record
there is no assumed absence. 9E0B also has an interface of its own that can be
resumed; the game NMI can meanwhile pass the nested call through to the outer
main loop driver (see below).

## Original main loop owner

[main-loop.mjs](../src/vm/main-loop.mjs) shares its call equations between the
synchronous run and `MainLoopContinuation`. Every helper first gets the
original JSR/JSL frame. Across a pause in B0A1, in particular, the WORD 96AE
with bank 80 stays on the stack. Only the real RTL allows the continuation at
96AF. Input edges at 9E1A can pause in the same way. Both carry shortcuts and
the two original returns to the game owner are kept.

The main loop budget counts direct helpers, single wait instructions and the
NMI, boot and scene caller segments described below. Other helper graphs are
still atomic synchronous calls with their previous source contracts. A budget
therefore does not limit the running time of such a helper.

[MainLoopDriver](../src/vm/main-driver.mjs) optionally accepts
`run(opcodeBudget, {mainBudget})` and `resume(opcodeBudget, {mainBudget})`.
`STOP_MAIN_WAIT` keeps the same accessor, PBR, context, device and interrupt
cursor. The observation set is taken exactly once. Only after it is used up
completely does the original JSR at 96C0 with WORD 96C2 follow; after that the
separate opcode budget of the scheduler applies as before. `resume` does not
reload the paused accessor and discards no prefix already executed. Foreign VM
registers or a second `run` during the pause fail.

The room worker uses finite main loop and opcode budgets of 4096 work units
each. Between both pictures it keeps the same cold owner. These values only
choose the size of the pieces processed synchronously.

## Nested NMI callbacks and joypad completion

[NativeCallContinuation](../src/task/native-call-continuation.mjs) assembles
fixed JavaScript caller segments. The synchronous and resumable paths of
[00:C112](../src/task/observed-nmi.mjs) and
[80:C152](../src/task/main-game-nmi.mjs) use the same equations. The pinned
sources remain [matrixNmiSpecs, nmi](../tools/main-matrix-nmi-source.mjs) with
the hardware/handler stack lemma and [gameNmiSpecs](../tools/main-game-nmi-source.mjs)
with all eleven actual child calls and their closed stack proof. No
instructions are decoded. The routines register their own continuations in a
neutral module. Wait adapters therefore import no callback or scene graph; the
existing scene tables can initialise in their original order. Choosing a
continuation requires both the target address and the same bound routine
function; configured replacement routines are not bypassed.

An explicit NMI record at the direct B0A1/9E1A wait point is consumed exactly
once. `InterruptStepContinuation` keeps the interrupted state, while
`ObservedNmiContinuation` keeps the real hardware stack and the separate
handler stack. The PHP and the JSL at 00:C137 stay until the actual callback
return. In the game callback, the JSR at 80:C179 owns the WORD C17B across any
pause in 9E0B. Only its RTS allows the further callback calls, its RTL the
handler epilogue and only its RTI the interrupted wait instruction. The RTI
registers are checked against the original state before that instruction.

The further joypad callbacks pass their pause through the shared caller
80:F290. Its PHP keeps the actual M/X flags; REP30 establishes the WORD base for
9E0B. The JSR at F293 keeps F295 on the stack. Only RTS, the original PLP and
RTL lead back to the callback. There are fixed segments for D479, BEC3,
DAD6/D9D5, DF0E, DD54, D93E, DCAC and E6AE. The original jump from D93E to D9D5
passes on the same frame and the real return value; it creates no further
JSR/JSL frame.

The sources of these callers are in
[sceneAnimationSpecs, d479](../tools/main-scene-animation-source.mjs),
[matrixNmiSpecs, bec3](../tools/main-matrix-nmi-source.mjs),
[introNmiSpecs](../tools/main-intro-nmi-source.mjs) and
[frontendSpecs](../tools/main-frontend-source.mjs). The existing proofs of path
widths, PHK banks, stack pointer changes and indirect jumps still hold. The
unchanged graphics, data and audio helpers before F290 each stay synchronous
segments with their existing observation contracts.

`STOP_MAIN_WAIT` thereby also passes a pause in the joypad busy poll through to
the `MainLoopDriver`. The device cursor and the NMI record are not reset.
Budget zero has no effects, produces no finished pad value and consumes no
further record. Foreign register owners and an owner started again after a
failure are refused before further effects. A changed real return word stays
visible at the PC that follows from it.

The new budget units cover caller segments, frame and return checks and single
wait instructions. The ten other child routines of C152 each stay synchronous;
in particular no duration of DMA or graphics work is computed. Further text
and native callers stay synchronous. The following matrix, boot and scene paths
meanwhile have callers of their own. The hardware check below stays unchanged:
neither the NMI entry nor a work budget proves the moment of the joypad
completion. Busy and pad values stay explicit device observations.

## Matrix wait owner up to the main loop

`ObservedWaitContinuation` connects a single original wait instruction with its
`InterruptStepContinuation`. While the NMI owns its own context, the wait
instruction stays unexecuted. Only after the complete NMI/RTI does the same
instruction follow. This holds for EEBB including its BYTE HVBJOY path and for
the input evaluation 9E1A. Missing interrupt records stay errors; old
composition calls without an interrupt set still use their separate explicit
wait and input observations.

The two brightness loops EEDD/EEF1 keep PHP, the actual BYTE indexes, every
JSL EEBB return and PLP/RTL. The matrix callers BFD8/BFF8 and C029 also pass
their own EEBB pauses through. F298 keeps its PHP, REP30, the real JSR word
F29D and PLP/RTL across an interruption in 9E1A. Sources are
[sceneAnimationSpecs](../tools/main-scene-animation-source.mjs),
[matrixSetupSpecs](../tools/main-scene-matrix-source.mjs) and
[mainSceneSpecs, f298/c3ca](../tools/main-scene-source.mjs).

The complete original C3CA caller keeps its JSL/JSR frames across these
pauses, including both matrix control paths and their real queue, graphics and
data helpers. [CC4B](../src/task/main-loop-motion.mjs) passes the original
C3CA frame to CC71 and continues with the record copy, initialisation and scene
takeover only after its RTL. Its separate child routine tables are kept; a
child gets no foreign table from the CC4B caller. Source:
[mainLoopMotionSpecs](../tools/main-loop-motion-source.mjs).
`MainLoopContinuation` can thereby also budget registered direct callers and
passes the matrix wait owner through to `STOP_MAIN_WAIT`.

Unchanged subroutines stay synchronous segments. The matrix composition proves
neither general time nor a dynamic frame.

## Boot, intro and scene changes

[E7BC/A15C/A133](../src/task/main-startup.mjs) and
[EED5](../src/task/main-scene-wait.mjs) use fixed caller segments. PHP, the
actual BYTE/WORD widths, all JSL wait calls and the original return words are
kept across pauses. `MainStartupContinuation` ends only at the original A139.
Sources are the unchanged pinned [startupSpecs](../tools/main-startup-source.mjs)
and [sceneAnimationSpecs](../tools/main-scene-animation-source.mjs). The SPC
transfer stays a synchronous segment with its single original observations; a
work budget replaces no APU reply.

[CDF8](../src/task/main-scene.mjs) keeps both original wait phases, the input
evaluation and its direct BYTE fade poll at CF4C/CF4F. `FadePollContinuation`
lets the NMI return completely up to RTI before the same LDA or BNE
instruction follows. The jump to DFE7 ([reference](../proof/intro-reference/intro-scene.mjs),
lifted in [src/intro](../src/intro/intro-scene.mjs))
passes on the existing frame; only the original JSL at E120 creates the frame
of the nested CDF8. The D479/DF0E callbacks actually installed and the
existing source proof are kept: [mainSceneSpecs](../tools/main-scene-source.mjs),
[sceneIntroSpecs](../tools/main-scene-intro-source.mjs).

[A4BF and 8BD9](../src/task/main-transition.mjs) pass their B0A1 pauses on
through both main loop callers: [8000/803B](../src/task/main-zone-gate.mjs)
keeps the real JSR frame 802B, CC4B still its own scene frame. Sources:
[transitionSpecs](../tools/main-transition-source.mjs),
[mainGate8000Spec](../tools/main-gate-8000-source.mjs) and the existing CC4B
proof. The B0A1 adapter is the same bound function for movement, scene changes
and the rest of the main loop. Configured replacement routines stay decisive.

[9688/9699](../src/task/main-start.mjs) also segments the scene transition with
the original frames 969C/96A0. The finite driver now keeps the whole prelude
A133 up to the first main loop interval in the same observation set. A cold
reset stays a synchronous segment of its own; its actual change from E1 to E0 is
kept across later pauses. The outer menu call stays synchronous.
`MainLoopContinuation.work` counts the work units really used in this nested
use too. Sources are [mainStartSpecs](../tools/main-start-source.mjs) and the
existing reset and menu owner contracts; no new initial state is introduced.

## WORD wait requests

`WordWaitContinuation` and `RequestWaitContinuation` in
[main-wait-interrupt.mjs](../src/task/main-wait-interrupt.mjs) share the same
equations with the synchronous adapters. They cover ACAF, ACBD, ACC3, ACC9 as
well as ACB5, AEF4 and AEFC: a fresh WORD LDA, BNE from its flags, the actual RTL
and, for requests, the INC around it with the real nested JSL. Every
instruction reached still needs its explicit interrupt record. An NMI between
LDA and BNE changes no value already read. The original text mask DMA stays an
observation of its own before Clear01FC. Source:
[wordInterruptWindows](../tools/main-word-wait-interrupt-source.mjs), 48 bytes
and 21 instructions with a closed stack proof.

The following window render chain, the window allocation, the text
composition and the notice meanwhile have callers of their own. Native owners
inside the scheduler round stay continuation boundaries of their own. Device
handshakes stay synchronous.

## Window cleanup and render request

[BCB2/BE5B](../src/task/native-dialog-portrait.mjs) and
[FF79](../src/task/native-slot-release.mjs) keep their own JSR frames, and PHX
frames where present, across the whole chain
[FA3E/AD92](../src/task/native-render-compose.mjs) down to ACB5/ACAF. The
original INC/JSL request uses `RequestWaitContinuation`; an unchanged WORD poll
stays unchanged without an outer writer. An observed NMI can in turn pause in
9E0B and must return completely up to RTI. Only the real RTL of the request
allows the return to AD92, then to FA3E and finally to the caller. Native
return objects keep their previous results; the synchronous adapters share the
same equations.

Sources are the closed graphs
[renderComposeWindows](../tools/task-native-render-compose-source.mjs) and
[clearFF79Windows](../tools/task-native-clear-ff79-source.mjs) with the existing
mixed stack proofs and the BCB2/BE5B windows of
[motion-reset-bcb2](../tools/analyze-motion-reset-bcb2.mjs). The actual list
compares, the backward search, the scratch words and the marker order are
kept. A9B2 with unpacking/AF1F and ACCF stay synchronous segments with their
previous source and observation contracts.

The complete original comparison corrects an older FF79 error: the JSR is at
**80:FF85**, pushes the word **FF87** and returns to **80:FF88**. The previous
task adapter used FF83/FF84. The source qualification and the current porting
status are corrected; the corresponding statements in earlier handoff sections
are historically outdated. Stack bytes read after the return now also match the
original.

A4BF uses the same bound adapters for BCB2, FF79 and AD92 and passes the render
pause through its existing outer callers to the driver. The glove choice also
uses the same adapters and the shared BE5B code, but as an outer native caller
it stays synchronous for now. Configured replacement routines stay decisive.
The leaf access equations and their RTS are shared unchanged in `leafAccess`
and `finishLeaf`; this lets FF79 keep its original WORD and index access across
pauses.

## Window allocation, text composition and notice

[F963](../src/task/native-window-open.mjs) keeps the real frames JSR FA32 (WORD FA34)
for the request FA67, its JSL FA84 (WORD FA87, bank 80) for the WORD poll
ACBD, JSL FA35 for ACCF and JSL FA39 for ACB5. With an interrupt set, ACBD and
ACB5 use `WordWaitContinuation` and `RequestWaitContinuation`; the observation
mode only replaces the wait poll by its previous explicit equation. ACCF stays
a synchronous segment.

[FE69/FB39](../src/task/native-text-compose.mjs) share their call equations
between both paths. FB39 pauses at its three requests AEFC (FB5B) and AEF4
(FBDF, FD7B) and, in start mode, at the instruction FD21 between the two mask
stores of a glyph row. The JSR FEBC keeps WORD FEBE until the RTS of FB39 uses
it; then PLB and RTS of FE69 follow. Geometry, AEC8 and AF04 stay synchronous
segments.

[FEC1](../src/task/native-notice.mjs) embeds the sequences of F963, FE69 and FA3E
through its real JSR frames FECE, FEDD and FF04. The PHA/PHX bytes of
allocation, minimum and slot stay on the stack across pauses. The main loop
owners FF14, E270 and BF3B (lifted in [src/game/main-upkeep.mjs](../src/game/main-upkeep.mjs),
MAIN-LOOP-LIFT.md) use `nativeCallSequence` and pass pauses in FA3E, FEC1, BCB2 and 9E1A through to
`STOP_MAIN_WAIT`. The actions 99EB and the dialog 936C are registered
continuations (see below). FAAC/FD80, the random helpers and C46E stay
synchronous segments.

The source contracts are unchanged the pinned graphs
[fec1Windows](../tools/task-native-fec1-source.mjs),
[textComposeWindows](../tools/task-native-text-compose-source.mjs),
[taskNativeRenderSpec](../tools/task-native-render-spec.mjs) and
[mainCameraSpecs](../tools/main-loop-camera-source.mjs). The same bound adapters
serve the native tables of 936C, 9BC6 and F254; configured replacement routines
stay decisive.

## Special natives in the scheduler round

[NativeCalls](../src/vm/native-call.mjs) has a work budget. With `Infinity` the
synchronous path stays unchanged. With a finite budget, the bridge chooses for
the targets in `SPECIAL_NATIVE_CONTINUATIONS`
([special-natives.mjs](../src/vm/special-natives.mjs)) the same observed
sequence as a continuation: FEC1, FF79, CDA8, CD9D, CECB and D079. The
observation set is taken exactly once; the device cursor, interrupt set and
text DMA stay with the native across pauses. The original bridge F4F6 has
already pushed the WORD F508 and the VM stands at F52F. Only after the real
native return do the previous use checks, the store, F509 and the next opcode
follow.

The [interpreter](../src/vm/interpreter.mjs) then reports `EXIT_NATIVE_WAIT`,
the [TaskScheduler](../src/vm/scheduler.mjs) `STOP_NATIVE_WAIT`. Its `resume`
first continues the paused native; a foreign VM PC or foreign registers are
refused before any effect. The [MainLoopDriver](../src/vm/main-driver.mjs) uses
its main loop budget during the round also as the native work budget and sets it
back to `Infinity` afterwards. A scheduler round nested from a native stays
synchronous, because its caller has no pause frame. CD9D, CECB and D079 use
`dialogCallSequence` with the same unlabelled frames as before.

Also resumable are the input wait [F953](../src/task/native-input-wait.mjs)
with JSL B0A1 (WORD F956) and JSR 9E1A (WORD F959), whose wait instructions
pause as `ObservedWaitContinuation` with an interrupt set, the
[modal roots](../src/task/native-modal.mjs) 935B/CBF7/CD20/CD43, the
[selection](../src/task/native-selection.mjs) 933A/BBA0 and the
[combat end](../src/task/native-fight-list-remove.mjs) 855E. They embed F963, FE69, FA3E and
FEC1 as sequences. FAAC, FD80, D15C and the APU helpers C46E/EF47 stay segments;
routines replaced by tests stay decisive.

The [menu composition A6C7](../src/task/native-menu-compose.mjs) keeps in every
round the JSL B0A1 (WORD A6EC) and the JSR 9E1A (WORD A6EF); with an interrupt
set both pause as `ObservedWaitContinuation`. Confirming, cancelling, the
shortcut and paging keep their real PHY/PEI/PLA frames; the scroll request FA67
pauses in the WORD poll ACBD. List helpers and the confirmation sound C46E stay
segments. CD43 and 933A embed these sequences, as does the
[spell choice E1CF](../src/task/native-spell-choice.mjs) through `dialogTextSequences`,
the parallel sequence object of `dialogTextRoutines`. The
[dialog 936C](../src/task/native-dialog.mjs) is a sequence over its routine table.
Table calls use `dialogCallSequence`; registered continuations for F963, FF79,
BCB2, FA3E, B0A1, 9E1A and the dialog parts
[9178/91E2/9215](../src/task/native-dialog-text.mjs) and the closing 92C5 apply
only with an identical table function. The dialog parts use
`dialogTextSequences` only for the standard routines; replaced test routines
stay segments. The topic action with a nested scheduler round stays
synchronous. 936C is resumable both as a special native and through BF3B in the
main loop.

The [glove choice](../src/task/native-glove-target.mjs) 9BC6, 9BD3, 9C33, 9BB9, 8D0B and
C724 keeps in every frame the real frames of JSL B0A1, JSR 9E1A and JSR BE6D.
BE6D calls BCBE when standing still (the object under the glove with a name
window through FADD, F963 and FE69) and BE5B when moving; both are sequences.
The window list AEB0/AEB8 embeds AD92 or A9B2/ACB5. FADD and BC36/BC67/BC99
stay segments. BE6D is also registered as a direct main loop helper. The
[player control E014](../src/task/native-player-control.mjs) decides per frame in one
segment (DEC7, DF6B, glove on, A985/AAAF). Only the group overview ED3C, the
notices without a weapon or spell (F963, FE69, F953, FA3E) and the glove release
BCB2 keep their frames across pauses. The shared tables of F254, EA6E and E014
use registered adapters for A6C7, A6AD, FA67, F953, AEB0 and FB39.

The [status screen EA6E](../src/task/native-status-screen.mjs) with the entries
EA89/EA8E from E014 is a sequence. Every table call keeps its real frame; the
code between two calls runs in one piece as before. The item lists
E572/E577/E57F with E4F3, the attributes E834, the notes E8C8, the number FDCF,
the submenu dispatch JMP (ED2E,X) and the closing are sequences. The APU
command F007 stays a segment; the nested round in E4F3 stays synchronous.

The [weapon menu F254](../src/task/native-member-spell-menu.mjs) with E693, the portrait E4B3,
the second channel E48D, the fade-in E433 (eleven JSL B0A1), the weapon window
E9C5 and the item text E9A8, and the [main menu CE6D](../src/task/native-main-menu.mjs)
with saving CDD6, karma EE57/EF82, buying F006 and the three karma lists are
generators in the same way. EA6E now embeds E4B3, E9C5 and E693 too. The SRAM
save B17D, E41F, A954 and C46E stay segments.

The [actions](../src/task/native-actions.mjs) 9BA0/99EB are a sequence: the
window allocation F963 (JSR 9B5B), the menu A6A5 (JSR 9B7D) and the release
FA3E (JSR 9B94) keep their real frames with the previous access markers; 9BA0
calls 99EB through JSR 9BA5. 99EB is registered as a table adapter, so that
BF3B passes the pauses through to `STOP_MAIN_WAIT`.
[8E36](../src/task/native-object-hit.mjs) with 8691 and 881C is a sequence too. The
notices in 8691 embed F963, FE69, thirty JSL B0A1 (as
`ObservedWaitContinuation` with an interrupt set), F953 and FA3E, 881C the
render request AD92. The random C51F, A835 and the APU handshake C46E stay
segments; 8AB5 still uses 8691 synchronously. With that all special natives
with wait points are resumable. The source contracts stay the pinned graphs of
the actions and of 8E36/8691/881C.

### Pausable nested round (2026-10-21)

A resumable special native that visits the task just appended with `JSR $C1CA`
now lets this round itself pause. This concerns the weapon menu F254/E693 at
80:E78E, also embedded in the status screen EA6E and E014, and the topic action
9178 of the dialog 936C. Before, every free live control that reached this way
ended at `task_f254_visit_open`; a synchronous round would not have returned
texts and input in the visited script to the browser.
`NativeCalls.nestedRound(entry)` ([native-call.mjs](../src/vm/native-call.mjs))
returns a continuation (`NestedRoundContinuation`). It runs on the same VM with
its own `TaskScheduler` and gets the registers from the accessor like
`NativeCalls.round`. For its duration it puts the pending slot of the outer
native aside and keeps the pending native, accessor counter, device cursor and
VM registers of the round separate between the work pieces (the driver loads
the main loop's registers into the shared VM while the round pauses; until
2026-11-11 the round then resumed at `$C1E3` as a second round and ran its
scripts twice in one frame, depending on where the live steps ended;
[live-step-budget.test.mjs](../tools/live-step-budget.test.mjs)). After the return it restores the
VM of the outer native (at `$F52F`). If the round pauses, `nested` marks the
outer native, so that the next continuation does not demand `$F52F`. The
options of the special natives contain `nestedRound` for that;
`NATIVE_CALL_CONTINUATIONS` binds the C1CA call of F254, the dialog sequence uses
`dialogTopicSequence`. With its own `rounds` (oracle) or without a budget the
round stays synchronous; it now also puts the outer pending slot aside and
restores the VM. The nested round of the main loop (main-frontend) and E4F3 stay
synchronous.

Check: [live-nested-round.test.mjs](../tools/live-nested-round.test.mjs) plays a
fixed random input in live mode. Six weapon menu rounds run through, the sixth
waits from live NMI 1584 on. With the pausable and with the synchronous round,
WRAM, PPU memory, picture and APU port are the same at the NMIs 1580, 1588, 1600
and 1650. [vm-nested-round.test.mjs](../tools/vm-nested-round.test.mjs) runs the
topic action as a continuation in pieces of 40 opcodes against the direct
scheduler run (all registers, WRAM) for all action scripts. Random input over
3000 live NMIs then runs without a limit in five of six sequences.

### Open bus in D15C (2026-10-21)

Random sequence 8 (eleven times right, R, B) leads in round 13 through E014 and
A985 to D15C. There the record pointer from the table 8C:ED8A points to
8C:6AA1, where nothing lies below $8000 in LoROM bank 8C. Mesen shows: the
original reads both bytes at 80:A9BF (`LDA [$00]`) as 8C, that is the open bus
with the byte read last, the bank of the pointer. `taskSelectionSupport.indirect`
([native-d15c.mjs](../src/task/native-object-turn.mjs)) returns this pointer bank per
byte for targets in $6000-$7FFF of the banks 00-3F/80-BF instead of stopping
with `unmapped_read`. Other read paths keep the limit; there is no general bus
model. Check: Mesen live comparison over 40 rounds with this input; registers,
WRAM except hardware frames, SRAM, PPU memory and picture equal
([mesen-live-room.test.mjs](../tools/mesen-live-room.test.mjs)). Afterwards 14
random sequences ran over 3000 live NMIs each without a limit.

## Lag-free frame events

User decision of 2026-10-20. In the original recording of the first room (1587
rounds, 2273 NMIs) about 96 % of the NMIs fall into pure wait loops (B0A1,
EEBB, WORD waits); about 80 hit work code in the middle while loading (lag
frames). Without a CPU timing model their position cannot be proven. Live mode
therefore does not reproduce lag (see [STRATEGY.md](STRATEGY.md), slowdowns);
recorded runs keep their records.

[LagFreeFrames](../src/vm/frame-events.mjs) replaces the record list in the
interrupt channel. `takeInterruptStep` asks before every wait instruction it
reaches whether an NMI is due. That is the case exactly when the instruction is
a back jump of the following loops and its condition would jump back again with
the flags of the read before:

| Back jump                       | Loop                                      | Condition |
| ------------------------------- | ----------------------------------------- | --------- |
| 81:B0A9                         | B0A1, CMP 7E1C76 / BEQ                    | Z set     |
| 81:EED1                         | EEBB BYTE counter, CMP / BEQ              | Z set     |
| 81:ACB2, ACC0, ACC6, ACCC       | WORD waits 01F8/01F6/01FA/01FC, LDA / BNE | Z clear   |
| 81:CF4F                         | fade poll 11A3 in CDF8, LDA / BNE         | Z clear   |
| 80:901F                         | LDA 0140 / BPL                            | N clear   |
| 80:AE0F, AE61                   | LDA 1562 / BNE                            | Z clear   |
| 81:E1BB, E515                   | music beat 2142, LDA / CMP #2 or #3 / BNE | Z clear   |
| 81:D6BD, D785, D7A1, D7BA, D7FA | title, LDA 2142 / BNE                     | Z clear   |

The test reads the opcode (F0/D0/10), the negative distance and the target
(LDA/CMP) of every entry from the ROM. The back jump uses the old flags, the
next read sees the value after RTI. If the NMI callback runs longer than one
frame, the next NMI follows in the next pass. Non-blocking reads, the input
evaluation 9E1A and all instructions outside these loops get no NMI. An NMI in
the NMI is a limit.

In the NMI the source answers exactly three WORD device reads; all others stay
observation limits (`device_observation_required`), also outside the NMI.
Recorded reads are always used first.

| PC      | Register    | Reply and evidence                                                            |
| ------- | ----------- | ----------------------------------------------------------------------------- |
| 00:C118 | 4210 RDNMI  | 0; the value is dead, the following TSC at C11B (ROM 3B) overwrites A and N/Z |
| 80:9E0B | 4212 HVBJOY | 0; AND #0001 at 9E0E only evaluates bit 0, the pad read is complete           |
| 80:9E13 | 4218 pad 1  | the word of the live source, latched once per NMI                             |

Outside the NMI, `LiveDevices` answers two more reads of the title:

| PC      | Register         | Reply and evidence                                                                                                                                                                                                                                                                                                     |
| ------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 81:D7DA | 213E/213F (WORD) | 0x1000; AND #1000 at D7DD keeps only STAT78 bit 4 (1 = PAL, Book I PDF 137, 2-27-23); the European ROM runs on PAL                                                                                                                                                                                                     |
| 81:EEC2 | 4212 HVBJOY      | 0, only with the NMI disabled; EEBB with the shadow $30 bit 7 clear waits with BMI until the VBlank is over (PDF 146, 2-28-7). Without an NMI the lag-free model has no picture position, the timeless CPU reads outside the VBlank. The byte stays in A; at the caller reached, 81:D737, EB7B (LDA $30) overwrites it |

The seven music beat waits are also sound driver waits (`APU_WAITS`): if the
NMI is disabled there (the title after loading, NMITIMEN 01), each back jump
advances one sample (32 kHz) of audio time and no NMI. The original polls there
without an interrupt until the driver replies; the CPU work stays timeless.

The pad word holds only the twelve buttons named in Book I PDF 148 (2-28-9)
(mask FFF0); the manual names no low four bits, and 9E1A rejects input with
those bits set. NMITIMEN (PDF 140, 2-28-1) follows the run's writes to 4200; in
the room run the original itself last writes 0x81 at 80:9671. An unknown NMI
enable, a disabled NMI at a blocking wait and a disabled automatic pad read at
9E13 are limits.

[LiveDevices](../src/vm/frame-events.mjs) gives every main and native call an
empty observation set with this source and also passes writes on to the PPU.
`ObservedRoom.live` continues the cold room owner with it after the complete
recording. A picture is the PPU state at the NMI entry; PPU writes outside the
NMI since the previous picture have no known line and are counted per picture.
Reading back the text mask through channel 5 stays a limit in live mode.

[frame-events.test.mjs](../tools/frame-events.test.mjs) compares B0A1 with the
lag-free source against the same wait with records at the same place (DBR
00/80/81/7E, deliberately other dead bits in 4210/4212): registers, the whole
WRAM and the device write order are equal. An NMI at the CMP instead of the BEQ
differs only in the four bytes of the hardware frame below S. Further cases
check the non-blocking WORD wait without an NMI, the inline wait 901C with 8FBA,
the resumable owner with budget one, all limits and the priority of recorded
reads. The room case continues the complete recording by 160 pictures: twice
identical, without raster writes, with the D-pad down from picture 40 on other
pictures than without input, 01CA holds the pad word. In 300 pictures Jake went
down and the game showed "Where am I? Who am I?".

Extension 2026-10-30 (live finding in the crosshair, with the mouse layer of
that day): with the Beretta Jake shoots, then B follows at once. E014, A985 and
D15C read the record from the open bus as above (8C:6A56, so 8C8C); the counter
access `[$08],Y` carries Y across the bank boundary to 8D:35B3. That lies in the
register area $2000-$5FFF (Book I PDF 93: S-PPU, DMA and so on there), but on no
register (2100-21FF, 4016/4017, 4200-421F, 4300-437F). There too `indirect` now
returns the pointer bank as open bus; the registers themselves stay excluded.
Counter check: without the extension the run stopped with
`unmapped_read at $8D35B3`. Checked against Mesen on 2026-11-01
([live-alley-bus.test.mjs](../tools/live-alley-bus.test.mjs)): with that input
replayed and the same random draws, the original reads 8C at 8C:6A56/6A57 and
at 8D:35B3/35B4. The same B reads the code words 80:9906 and 80:9A66 as data,
which were missing in the data package until then ([ROM-FREE.md](ROM-FREE.md)).

### Original comparison (M5)

[trace-live-room.lua](../tools/mesen/trace-live-room.lua) plays the same input
plan as the room recording in Mesen up to its stop point (80:96C3, 2273 NMIs,
frame 2475) and then gives one pad word per NMI. Mesen polls pad k in the frame
of NMI k right before that NMI; `pad(k)` of the live source gets the same index.
The interruption point and S of every live NMI are logged. The comparison is at
the R-th return to 80:96C3 after the stop point, that is at the same
instruction boundary, together with the picture of the following NMI.
[alignLiveNmis](../tools/mesen-live-room.mjs) allows another point only within
the same wait loop and then shows its four frame bytes; every other difference
counts as lag.

[mesen-live-room.test.mjs](../tools/mesen-live-room.test.mjs): 15 frames without
a button, 30 down, 20 right, 20 left, 85 rounds. Without a lag frame all
registers, the NMI count (85), the whole WRAM, SRAM, VRAM, CGRAM, OAM and all
pixels of picture 85 are identical; 29 NMIs came in the original at the CMP
B0A5 instead of the BEQ B0A9, and their frame bytes are overwritten later. 01CA
holds the last pad word.

Limit of the model: even without input the original takes live NMI 95 in the
middle of the unpacker at 80:9F34 (S 0125); the lag-free model reaches it at the
WORD wait ACB2. After that the original is one frame behind (after 120 rounds
121 instead of 120 NMIs). The second test case records exactly this lag instead
of hiding it. A comparison beyond this lag is not bit-exact in the lag-free
model.

## Nintendo hardware sources

Primary source: [Nintendo Development Manual Book I](../Ressources/book1_text.pdf),
chapters 27/28. PDF pages count from one, the printed identifier in brackets.

| Subject                    | Location                    | Result and limit                                                                                                                                           |
| -------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PAL detection              | PDF 137 (2-27-23), STAT78   | PAL/NTSC is device information; no frame period follows from it yet                                                                                        |
| NMI and automatic pad read | PDF 140 (2-28-1), NMITIMEN  | The NMI is tied to the start of the VBlank; the automatic pad read then needs about three or four lines. This approximation fixes no exact completion time |
| NMI flag                   | PDF 145 (2-28-6), RDNMI     | VBlank flag, cleared by reading; a set flag does not mean a completed joypad read                                                                          |
| Busy flag                  | PDF 146 (2-28-7), HVBJOY    | Bit 0 marks a running automatic pad read; V/H blank are separate bits                                                                                      |
| Pad word                   | PDF 148 (2-28-9), 4218/4219 | A/X/L/R in the high nibble of the low byte; B/Y/Select/Start and the D-pad in the high byte                                                                |

The actual WORD accesses and the order busy check, pad read, store come
separately from the Shadowrun ROM. Complete device words stay explicit inputs;
undetermined side bits are not invented from these bit definitions. The local
Book II scan does not contain the announced timing appendix (after PDF 405/406
the index follows at PDF 407). This block fixes no exact PAL period, CPU or DMA
time or position of an NMI between other native equations.

## Checks and limits

[native-wait-continuation.test.mjs](../tools/native-wait-continuation.test.mjs)
compares every instruction boundary reached and the complete memory against the
pinned original instructions. Independently executed original NMI/RTI check all
possible interruption points, BYTE/WORD wraparound, DBR 00/80/81/7E, both EEBB
paths, high device bits and fresh joypad reads. Additional counter checks cover
an unchanged wait without an external writer, budget zero, foreign owners,
failed helpers, changed real return bytes, PC wraparound and the reset path
that does not return. These cases are synthetic.

[main-loop.test.mjs](../tools/main-loop.test.mjs) and
[main-driver.test.mjs](../tools/main-driver.test.mjs) check call frames, carry
shortcuts, the owner return and the interplay of both budgets. The
[cold original test](../tools/mesen-cold-rounds.test.mjs) additionally uses a
main loop budget of 1024 for its existing budget counter check. It checks the
same complete original record including all registers, WRAM/SRAM and the CPU
and DMA chronology. The real browser now compares both room canvases over the
productive continuation path. No new route probe.

[native-nmi-continuation.test.mjs](../tools/native-nmi-continuation.test.mjs)
compares the new nested path against the complete original NMI up to RTI: every
joypad wait boundary reached, both caller frames, all registers and the whole
WRAM as well as device bytes. The synthetic cases cover DBR 00/80/81/7E,
M/X/decimal flags at the interrupted entry, stack wraparound, several busy
polls, an unchanged pad value while busy, real changed return bytes, missing
device data, foreign owners and configured callbacks. A further parameterised
comparison runs all eight F290 callbacks with their original instructions up to
RTI and checks every joypad wait boundary, including saved BYTE flags and the
D93E jump without a new frame. Unchanged external graphics and data helpers keep
their separate proofs there. The driver test also checks budget zero, all eight
F290 callbacks and pauses in the active NMI before the first C1E3 round. The
existing cold original and browser counter check covers the changed productive
path; there is no new route probe.

[main-scene-interrupt.test.mjs](../tools/main-scene-interrupt.test.mjs) checks
both complete C3CA paths with finite budgets against the same original
instructions and actual matrix helpers. All captured states after NMI/RTI at the
wait and input points, the complete WRAM and the device bytes match. An extra
NMI at 9E26 checks the input continuation. Both brightness loops are also
compared with 48 fresh BYTE hardware polls each and an explicitly observed NMI
absence. The [CC4B test](../tools/main-loop-motion.test.mjs) checks all original
scene branches with their real frames; the main loop test uses the real CC4B
entry. These additional cases stay synthetic.

The extended [boot comparisons](../tools/main-startup-connected.test.mjs) check
E7BC, A15C and A133 including both reset paths also with single work units.
After every captured NMI all registers and the whole WRAM match the original
instructions; the final comparison also covers SRAM and all device bytes. The
driver test keeps EED5 and A133/A15C across more than 10,000 pauses up to the
real A156/96C2 frames. Unchanged helper calls of this driver case are
explicitly replaced synthetically. The intro and fade comparisons check DFE7
with the nested CDF8 and the other CDF8 choices including early input with their
actual callbacks and devices. A4BF, 8000 and CC4B are also compared with finite
budgets against the complete original transition. A separate case checks both
B0A1 frames in A4BF/8BD9 with an observed NMI; other helpers stay synthetic
replacement routines there with their separate original proofs.
[WORD contract tests](../tools/main-word-wait-interrupt.test.mjs) also compare
all seven continuations across DBR, flags, INC wraparound and every
interruption phase with the complete original NMI/RTI and text DMA.

[Render continuation tests](../tools/main-render-continuation.test.mjs) run the
whole original graphs of BCB2, BE5B, FF79, FA3E and AD92. 60 synthetic cases
check DBR 00/80/81/7E, different saved flags, empty and used slots, the backward
search, INC wraparound and an NMI at the request, LDA and BNE. All captured NMI
return states and the final result match in all registers, the whole WRAM and
the device bytes. The comparison contains the complete original game NMI with
busy polls and RTI. Further counter checks cover budget zero, foreign owners and
the failed request, which allows no second execution. The FF79 case covers all
four used slots and also checks the previously wrong return bytes.

The [WORD contract test](../tools/main-word-wait-interrupt.test.mjs) also runs
the complete F963 allocation with budget one against the original instructions
and compares every NMI return state with all registers and the whole WRAM. The
[text continuation test](../tools/main-text-continuation.test.mjs) runs FEC1,
FE69, E270 and FF14 with their real helpers once synchronously and once with
budget one. Interrupt, device and DMA records are synthetic; the busy poll
alternates, so that every NMI taken pauses in 9E0B. Registers, WRAM, the device
chronology and the use of all records match. The own instructions of
FF14/E270/BF3B stay checked against the original by the
[camera test](../tools/main-loop-camera.test.mjs) with 1000 cases per routine.

The [bridge test](../tools/vm-native-continuation.test.mjs) calls FEC1, FF79,
CDA8, CD9D, D079, F953, E1CF, 936C, 8D0B, 9BC6, E014, F254, CE6D, 9BA0, 8E36 and
935B through F4F6 with an explicit F509 task frame, once synchronously and once
with budget one through `TaskScheduler.resume`. Registers, WRAM, the access
order and the device cursor match; every NMI taken pauses in 9E0B. The
[driver test](../tools/main-driver.test.mjs) runs FF79 from a synthetic script
inside the real round with main budget one up to the original return 96C3.
Records stay synthetic.

An 855E case with synthetic APU port values does not end, because the C46E
handshake waits for a real reply; this limit stays synchronous.

The E1CF case cancels the real menu with the synthetic pad word 2000, because
the confirmation sound C46E needs a real APU reply.

The 936C case runs dialog 0 with both portraits, the greeting, 60 counter waits,
the main menu (cancelled with the synthetic pad word 2000) and the closing 92C5;
the music stays unchanged, so no APU handshake arises.

The glove cases end the choice with the synthetic pad word 8000 without an
object under the glove.

The E014 case opens the group overview with Select; F953 ends with the synthetic
pad word 8000. For E1CF, E014 and 936C the test also checks that the wait points
of F963 and of the input are actually reached.

There is no bridge case for EA6E: the entry starts with the APU command F007,
whose handshake needs a real APU reply. The existing Mesen comparison of the
status screen checks the same equations.

The F254 and CE6D cases cancel the real menu with the synthetic pad word 2000
and reach F963 and the menu input on the way.

The 9BA0 case cancels the action menu A6A5 with the synthetic pad word 2000. The
8E36 case lets an admitted slot 1FD4 count to four; the notice 74BA reaches
F963, thirty counter waits B0A1 and F953 up to B.

The browser live mode uses the same path ([PPU-ROOM.md](PPU-ROOM.md)).

### PPU replies in live mode

With a PPU bus, `LiveDevices` answers two more device reads from the PPU model,
independent of time:

| Read                                        | Source                                                                                                                                                                                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2134-2136, for example F963 at 80:FA01/FA19 | product from [PpuState](../src/video/ppu-state.mjs): Book I PDF 124 (2-27-10), 16 bits at 211B in two writes low/high, 8 bits once at 211C; PDF 134 (2-27-20), 24-bit result in two's complement. Another M7 write between low and high is a limit |
| 213A at 81:AA8E (BYTE)                      | VRAM prefetch of A9E1 from the PPU model                                                                                                                                                                                                           |

The channel 5 DMA of the text mask (A9E1, 2139/213A to 7E2AE0) is carried out by
the PPU bus in live mode and writes the 16 bytes to WRAM; A9E1 then uses no
transfer observation. Without a PPU bus this DMA is a limit. In the recorded
room run `ObservedRoom` checks every observed read of 2134 against the product
model; all 8 original reads at FA01 match. A lag-free live picture resets the
access limit of the running owner, so that a native that waits many pictures
for a button does not count as an endless loop; within a picture the limit
holds unchanged.

The Mesen case for this opens the group overview with Select (E014/ED3C, F963,
text composition FB39 with the mask read back) and closes it with B: 60 live
rounds with 131 NMIs, without a lag frame, identical in registers, WRAM, SRAM,
VRAM, CGRAM, OAM and picture 131.

### Randomness in live mode

User decision of 2026-10-20 ([STRATEGY.md](STRATEGY.md)). C560 reads 2137 at
80:C566 (dead: LDA C58D,Y at C569 replaces A and N/Z) and mixes exactly two
counter bytes per call: EOR 213C at 80:C572 and EOR 213D at 80:C57F. Their value
depends on the CPU time. `LiveDevices` returns them from `counter(port, pc)`,
by default `counterBytes()` (xorshift32, fixed seed); the browser draws a seed
per session. That is explicitly no original value. The low byte of a draw comes
from 1CE8 and the frame counter; the counter bytes go into the high byte and the
next state 1CE8 and thereby change the following draws. Oracle comparisons give
the native run the bytes the original reads through `counter`; in the recorded
room run that already happens through the observations (191 reads in the
prelude). In the first room no simple input reaches the random (walking, glove
and aiming checked); a Mesen live case followed with the first fight. The test
checks the ROM bytes, that only these two reads arise, repeatability per seed
and a chain of draws.

Live comparisons can also go the other way (2026-11-01): Mesen returns the
native substitute bytes from a read callback (tools/mesen/explore.lua
`counter`), and `clock` makes the random read the frame counter 1C76 as the
count of NMIs in wait loops, the NMIs of the lag-free port
([live-matrix.test.mjs](../tools/live-matrix.test.mjs),
[live-alley-bus.test.mjs](../tools/live-alley-bus.test.mjs)). This supports the
guess below: the frame counter 1C76, which the random mixes in, counts the
original's lag NMIs.

APU: since 2026-10-20 the native audio unit (docs/SOUND-DRIVER.md) answers
2140-2143 live; it runs along in the room replay and gets one frame of audio
time per NMI. The Y item list thereby runs beyond 81:F00E; since HDMA, windows
and OBJ line limits ([PPU-ROOM.md](PPU-ROOM.md)) up to the closing, with the
picture. Live continuation with an open menu needs finite budgets
(`stepLive({mainBudget, opcodeBudget})`), because the main loop returns only
after the closing.

### Game Over and the menu owner live (2026-10-21)

If Jake dies, the main loop returns with a real RTS to 80:A157
(`STOP_MAIN_OWNER_RETURN`); `ObservedRoom.stepLive` allows that, and the next
step continues the menu owner. `mainOwnerContinuation`
([main-frontend.mjs](../src/task/main-frontend.mjs)) runs A139/A157 (the lifted
owner [game-owner.mjs](../src/frontend/game-owner.mjs), or its proof reference
from the routine table) up to the JSR 9688 frame with a budget; A18C, E14A with the fallthrough E1B4, E29F, E354, E50C,
the title D694, DDDB and D87C are sequences of the same equations
([main-frontend-menu.mjs](../src/task/main-frontend-menu.mjs),
[main-frontend-text.mjs](../src/task/main-frontend-text.mjs); since 2026-11-11 lifted
in src/frontend, see [TITLE-LIFT.md](TITLE-LIFT.md) and
[START-MENU-LIFT.md](START-MENU-LIFT.md)); their synchronous
form runs the sequence to the end. They pause in EEBB, F298, EEDD and EEF1 and
at every pass of the port 2 waits. The attract game A168 is a sequence too
(lifted with A18C, [TITLE-CYCLE-LIFT.md](TITLE-CYCLE-LIFT.md)): 96F3
keeps the JSR 9699 frame, 9699 runs live as `MainLoopContinuation` with a return
to the owner, and every round JSR C1E3 at 96C0 is a pausable nested round
(`nestedRound` of the main loop driver, `NestedRoundContinuation`). Recorded and
isolated runs keep the synchronous loop and round.

[live-game-over.test.mjs](../tools/live-game-over.test.mjs): `ALLEY_PLAN` live,
Game Over at live NMI 8996, main menu, Start at NMI 9166, new game from 9219.
Mesen plays the same pad words up to NMI 8900 and Start at 10400 (the original
dies later because of its lag frames): all menu pictures 10340-10430 and all
pictures 10560-10620 of the new game occur pixel for pixel and in order in the
native sequence (offset about 1230-1280 NMIs). Without input the menu times out;
the title D694 runs through the sound driver waits without an NMI and EEC2,
skyline (HDMA) and fades (colour math, docs/PPU-ROOM.md) back into the menu; all
36 title pictures 13750-15500 of the original occur pixel for pixel in order.
After the second timeout the attract game runs in steps below 200 NMIs; of the
original, selected demo pictures (18100-18300, 19250-19500) match in order,
others differ because of the demo's lag frames.

"Start saved game" after the Game Over: the same save game
(`tools/mesen/saves/apartment.srm`) replaces the SRAM natively and in Mesen
(`recordLiveRoom(..., {liveSram})`, `LIVE_SRAM` in trace-live-room.lua) at the
live start. Down, Start, B in the menu (native NMI 9166, original 10400) load
save game 1; the load choice and the apartment occur pixel for pixel in order
except for two transition pictures.

### Closed live plans from the save game (2026-10-21)

Mesen routes with duration commands ("hold" for n NMIs) shift in live mode: the
walking speed is the same on both sides, but the original loses loading NMIs
(lag) at every scene change and then reaches other places with the same
duration; after a few scenes Jake got stuck at the club counter natively.
[live-plan-driver.mjs](../tools/live-plan-driver.mjs) and `LIVE_PLAN` in
trace-live-room.lua therefore know closed commands, with the same rules on each
side's own WRAM:

- `walk`: steers the player character (slot 0CC2, word 0E28/0E80+slot divided by 4) exactly to a pixel position. The D-pad moves it on isometric world axes
  (up+left +x, down+right -x, up+right +y, down+left -y).
- `exit`: holds the buttons until a position jump above 32 (scene change).
- `wait`/`press` with a round count: end after that many returns to 80:96C3
  instead of after NMIs (game time in the field). Menus and the glove choice run
  hardly any rounds and keep their NMI duration.

Since 2026-11-01 tools/mesen/explore.lua knows the same round counts for `press`
and `wait`, and [explore-live.mjs](../tools/explore-live.mjs) runs explore plans
natively through livePlanDriver.

[live-plan-close.mjs](../tools/live-plan-close.mjs) translates a duration route:
the original plays it, every "hold" becomes a `walk` to its end position (with
an `exit` before or after it if the position jumps in the command or in the
following "wait"); a second run counts the rounds per command (round based from
10 rounds on). Result in [live-plans.mjs](../tools/live-plans.mjs):
`BADGE_OFFER_LIVE_PLAN` from the menu after the Game Over (load the save game
apartment, Grim Reaper Club, Iced Tea to the guest, topic Lone Star, the business
man, the money check fails at 20 nuyen), 127 commands.

[live-game-over.test.mjs](../tools/live-game-over.test.mjs) plays the plan
natively (about 18,400 live NMIs) and in the original, which evaluates it on its
own WRAM (`recordLiveRoom(..., {livePlan, shotEnds})`): all 127 commands end on
both sides at the same pixel position. At the end of the commands 37 pictures
are pixel equal, among them the whole Lone Star conversation and the offer up to
"You ain't got enough cash, chum!". Walking pictures differ: passers-by draw the
random substitute natively instead of the H/V counter bytes. An attempt with the
original's counter bytes fed in stayed equal in rounds and random calls up to
command 18; after that the original calls a random one call earlier than
natively after a scene setup with 44 loading NMIs. A timer running on the NMI
counter that also counts the loading NMIs is likely (the frame counter 1C76,
see "Randomness in live mode"); the lag-free model does not reproduce lag
(limit). The test therefore feeds no counter bytes.

### Money for the Lone Star badge (2026-10-30)

The save game apartment has 20 nuyen and no weapon. The business man buys the
Beretta for 200 nuyen (walkthrough lines 1427-1430); that needs no fight and no
random loot. `badgeBuySource` in [live-plan-close.mjs](../tools/live-plan-close.mjs)
assembles the route from `BADGE_OFFER_LIVE_PLAN`: in the south-west it turns into
the alley, Jake picks up the Beretta (object $4C) next to the dead man with R and
goes back without a fight while the orc keeps shooting. Then the club and Lone
Star follow as before. In the office: Start, Weapon, Beretta Pistol, Give to the
business man, Yes ("I'll give ya… 200"); Ask about Lone Star, Yes (150 nuyen,
"Impersonating a cop is risky"); Y, LoneStar Badge, Use ("I'll tack it onto my
pocket…"). The alley points were explored with `walk` in
[explore.lua](../tools/mesen/explore.lua); the glove hits the Beretta at 146/140
in this run, not at 149/131 as on the new game route.
`node tools/live-plan-close.mjs badge-buy` gives `BADGE_BUY_LIVE_PLAN` (165
commands, two Mesen runs, about 5 minutes).

[live-game-over.test.mjs](../tools/live-game-over.test.mjs) replaces the offer
test by this route: natively about 20,700 live NMIs, at the end 70 nuyen in
$7E3C0D. In the original all commands end at the same pixel position except
command 45 (B straight after the walk to 327/280 in the alley): there Jake stands
at 326/281 in the original, and at the next command at the same place again.
That fits the recoil of an orc hit; the test allows at most four such ends with
up to 2 pixels in the alley. 45 of 165 pictures at the command ends are equal,
among them the conversation with the guest and the selling and buying
conversation. The other pictures in the office differ only in Jake's health
(the status line "Body", y 103-108, and the health gauge at the top right, x
around 232, y 15-22): the orc's hits depend on the random, and the native run
draws the random substitute (limit as with the walking pictures). The case "not
enough money" stays checked in the oracle window `badge`.

### Cold start live (2026-10-30)

[live-game.mjs](../src/video/live-game.mjs) (`LiveGame`) starts the native owner
at the reset 00:E382 and runs with lag-free frames, live pad, native APU and PPU
from the start. There is no observation of the original and no state taken over;
the browser no longer needs `boot-logo-observations.json` and
`room-observations.json.gz`. The existing building blocks were enough:
`MainLoopDriver` with the reset entry (program bank 0), `LiveDevices` with APU
and PPU bus, `LagFreeFrames` without an initial NMITIMEN (the boot writes it
itself). Logo, SPC transfer, intro text, skyline, title, menu and "New Game" run
without a limit into the main loop of the morgue.

Power-on state as in the original comparison (Mesen `AllZeros`): WRAM zero, A,
X and Y zero, S 01FF, P 34, E 1. The boot does not clear the whole WRAM. With 00,
FF or 55 as the power-on content all pictures up to NMI 3000 are equal; from NMI
4829 on (the morgue after "New Game") Jake's pose differs; the original
apparently reads a place there that is never set. On the hardware the content is
not fixed; zero is a reversible assumption ([STRATEGY.md](STRATEGY.md),
"Standing model assumptions").

Outside the NMI, with the display on, the cold start writes only registers
(2100, 2101, 2107, 210B, 2110, 211B/211C, 212C/212D, 2130/2131), never VRAM,
CGRAM or OAM; their data may only be written in the VBlank (CGRAM also in the
HBlank) or in forced blank (Book I PDF 116, 2-27-2, OAM 2104; PDF 121 VRAM
2118/2119; PDF 125 CGRAM 2122). `LiveGame.dataOutsideBlank` counts such data
accesses, and the tests demand zero.

Original comparison ([live-cold-start.test.mjs](../tools/live-cold-start.test.mjs),
recorder [trace-cold-pictures.lua](../tools/mesen/trace-cold-pictures.lua)):
Mesen starts cold without input and returns the picture before every 40th NMI up
to NMI 3440. The original counts its lag NMIs too, so the comparison goes by the
picture sequence: every original picture must have a native picture in the same
order. In the reference run that was missing only twice (2720 and 2920, fade-in
steps of the title); the native run is only a few NMIs beside the original
there. The route from the title through the menu into the new game is already
checked against the original by live-game-over.test.mjs (the same menu owner).

After the title the scene "Jake is shot" plays in the game graphics. There the
pictures differ: the gang moves after the random substitute (pictures 3800/3900
depend on the seed), and the flying object stops in the original as natively,
but at another place (x 163-191, y 82-97); that does not depend on the random and
fits a timer counted by NMIs after loading lag (limit, not investigated
further).

Boot, intro and title run as synchronous sections: one step of the driver covers
up to about 140 NMIs there (in the game mostly one or two). The browser worker
([game-worker.mjs](../src/browser/game-worker.mjs)) therefore sends every picture
with its sound pairs to the page while it computes; the page buffers them itself
and shows them at 50 Hz. A first version in which the page fetched the pictures
from the worker on request let the scrolling text and the sound stop every few
pictures in the intro (user test): during a section the worker takes no message.
The second version computed as far ahead as the last section was long; in the
title menu buttons then felt very delayed (user test). Now the local server
delivers the page with cross-origin isolation (COOP/COEP,
tools/serve-browser.mjs), and page and worker share two Int32 words: the held
pad word and the number of pictures shown. The worker reads the pad word at 9E13
in the NMI like the game and waits at every NMI with `Atomics.wait` until at most
two pictures (40 ms) lie ahead of the display, also in the middle of a
synchronous section. User requirement: as little input delay as possible in all
situations. Without isolation (another server) the version with messages and a
large lead stays as a fallback.
[live-game-browser.test.mjs](../tools/live-game-browser.test.mjs) starts in the
real Edge, checks the shared memory, stops after NMI 900 and compares canvas and
sound pairs with the native run; in the reference run the page missed not a
single picture up to there (`data-stalls` 0).
