# Strategy: faster to the finished port

Decided 2026-10-13. Applies to all models and takes precedence over older
handoff entries. The concrete next block is in
[PROJECT-STATUS.json](PROJECT-STATUS.json) (`npm run status:next`).

## Target premise (unchanged)

Shadowrun (SNES) runs as a native browser port without CPU emulation in the
product. Behaviour demonstrably follows the original; nothing is invented (no
made-up initial values, timings, scenes or terminations).

## Why the change of course

Up to 3A2 every original script body was proved on its own: its own spec with
original bytes, its own stack, alias and return contracts, its own fixtures.
One block aimed at 100 bodies and delivered one (45 bytes). Each block still
cost a full release (about 10 min), large commits and a lot of documentation.
Boot/SPC, scene initialization, visible output and the rest of the game were
still open.

Script bodies are **data**, however. Code are only the opcode handlers of the
interpreter ($80:F389, table $80:F2B4, about 90 opcodes) and the natives behind
`call_native` (0x58). Whoever proves those has every body that uses them.

## 1. A general interpreter instead of single bodies

- A body runs when every opcode it reaches has a proved handler and every
  native target it reaches is covered natively. Otherwise the run stops with
  `taskStop` and names the missing target as the frontier. No whitelist, no
  body list, no byte comparison per body.
- The basis is the existing runner `runTaskOpcodeSequence`
  ([opcode-sequence.mjs](../proof/task/opcode-sequence.mjs)) with its handler table.
- The existing body specs (`src/task/script-body-*-specs.mjs`) stay as
  regression tests. No new single specs are created.
- A scanner reads all scripts from the ROM, determines the opcodes and natives
  each script uses and computes which scripts already run completely. It ranks
  the missing natives by how many scripts they unlock. This ranking sets the
  order of the native work.
- Progress measure: proved handlers, proved natives, runnable scripts
  (computed automatically, not counted by hand).

### Quality requirements for the interpreter

The interpreter is the core of the finished game and must be built cleanly:

- **Readability:** one handler per opcode with a speaking name and a comment
  with the original address. The dispatch table is a simple list. Proof and
  check logic (frontiers, stack and alias checks) is kept apart from the
  execution path, so that the game flow stays readable.
- **Performance:** the execution path allocates nothing per opcode. No objects,
  closures, arrays or strings per step; no `JSON`, Set or Map operations in the
  loop. Memory access through typed arrays (`Uint8Array`/`DataView`) for WRAM
  and ROM. Dispatch through an array of functions indexed by opcode, no
  `switch` over strings.
- **Memory:** one contiguous WRAM buffer (128 KiB) and the ROM as a
  `Uint8Array`. No copying per task or frame. Traces only when explicitly
  switched on (test or oracle).
- **Checkable:** diagnosis and proof mode by option. In game mode it costs
  nothing. A benchmark (opcodes per second, memory) belongs to the block and
  is recorded in the handoff.

## 2. Emulator only as a test oracle

- An emulator is used **only in tests and tools**, never imported in `src/`
  and never shipped. That keeps the premise.
- For a defined start state it records traces (WRAM writes, register states at
  synchronization points such as F390, frames). The native port is compared
  against them automatically.
- Decided (2026-10-13): **Mesen2** (very accurate, Lua scripting, headless test
  runner). First oracle case: original 252/217 up to D9.
- Mesen lies outside the repository (path in the environment variable
  `MESEN_PATH`); tests without Mesen are reported explicitly as skipped, never
  as passed. Mesen is GPL-3.0; the repository does not distribute it.
- Difference comparisons replace manual stack and alias proofs where they cover
  the case. Static source analysis remains for understanding, limits and cases
  the oracle does not reach.

## 3. Milestones by visible result

|     | Milestone                                       | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M1  | General interpreter + script scanner/ranking    | Existing body specs green through the general path. **Completed 2026-10-13:** all 1503 body cases identical ([VM-INTERPRETER.md](VM-INTERPRETER.md)); further missing natives by ranking (M1d)                                                                                                                                                                                                                                                                                                                                                                                 |
| M2  | Oracle harness (Mesen2) + first difference test | 252/217 identical to the emulator trace. **Part 1 delivered 2026-10-13:** harness and opcode comparison against a real game trace ([MESEN-ORACLE.md](MESEN-ORACLE.md)). **Part 2:** whole scheduler rounds and special natives with device reads; 252/217 open                                                                                                                                                                                                                                                                                                                 |
| M3  | Boot and first scene initialization             | **Completed 2026-10-19:** cold original comparison 00:E382 to 80:96AB, all registers, WRAM, SRAM, 636 NMIs and CPU/DMA device bytes identical ([BOOT-ORACLE.md](BOOT-ORACLE.md)). Evidence for this new game path                                                                                                                                                                                                                                                                                                                                                              |
| M4  | First visible picture in the browser            | **Completed 2026-10-19:** cold native logo start run; whole PPU memory and all 57,344 pixels including the real browser canvas identical ([PPU-BROWSER.md](PPU-BROWSER.md)); static start picture                                                                                                                                                                                                                                                                                                                                                                              |
| M5  | Control and movement in the first room          | Input sequence, oracle comparison. **Part 1 2026-10-20:** lag-free frame events (user decision: NMI only at blocking waits, no lag) continue the first room with a live pad ([NATIVE-CONTINUATION.md](NATIVE-CONTINUATION.md)). **Oracle comparison 2026-10-20:** 85 live rounds with the D-pad against Mesen, registers, WRAM/SRAM, PPU memory and picture identical; lag frames (the first at live NMI 95 in the unpacker) are reported, not reproduced. **Completed 2026-10-20:** browser live mode with keyboard, canvas in the real Edge equal to the native live picture |
| M6  | Dialogs, menus, audio                           | Oracle comparison, audible output. **Sound driver part 2026-10-20:** driver, IPL and DSP envelopes native, identical to the original commands and Mesen ([SOUND-DRIVER.md](SOUND-DRIVER.md)). **Sound output 2026-10-20:** DSP with BRR, interpolation, noise, PMON and echo, inner state and echo buffer identical to Mesen; audible in the browser through an AudioWorklet                                                                                                                                                                                                   |
| M7  | Whole game                                      | Play-through sequences against the oracle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

### Limit of the running probe series

User decision of 2026-10-18: carry the continuous source comparison on the same
cold owner up to the first complete fight in the alley. Completion means: fight
start, target choice and shots, the actual end of the enemy task and the end of
the fight with the return to player control are connected and checked. The
number of rounds or delivery groups is no completion quota.

After that this series of route probes ends. Next compare the boot state with
the original (M3), then work on the visible browser picture output with a frame
comparison (M4). Further route probes only for a concretely named contract or
regression gap, with their scope and completion fixed beforehand. The pause of
additional Mesen route coverage applied until the fight was complete; after
that the targeted original comparisons for M3/M4 belong to the task.

## Live mode and decisions of 2026-10-20

- **Frames:** lag-free. An NMI arises only at a blocking wait loop; lag frames
  of the original are reported in the oracle comparison, not reproduced
  ([NATIVE-CONTINUATION.md](NATIVE-CONTINUATION.md)).
- **Randomness:** the random routine C51F/C560 combines two bytes of the H/V
  counter (213C, 213D). In live mode they come from a fixed substitute
  generator, not from a CPU timing model. Oracle comparisons give the native
  run the counter bytes the original actually reads, and so stay bit-exact.
  Live comparisons can go the other way: Mesen reads the substitute bytes
  (tools/mesen/explore.lua `counter`, tools/live-matrix.test.mjs); in rooms with
  lag `clock` also gives the random the lag-free frame count
  (tools/live-alley-bus.test.mjs).
- **Sound:** the sound driver the game loads into the sound processor is ported
  natively like the code of the main CPU (JS equations, no SPC700
  interpretation in the product). The sound chip (DSP: voices, samples,
  envelopes, echo) is hardware and is built as a device model after Book I.
- **Target without the ROM:** later the product shall no longer need a ROM. All
  data (scripts, graphics, maps, texts, music and samples) are kept natively.
  Until then the product reads them from the user's ROM; new modules shall
  encapsulate data access so that the source can be exchanged later. Brought
  forward on 2026-10-30 (section below, [ROM-FREE.md](ROM-FREE.md)).

### Standing model assumptions (reversible)

Fixed where the lag-free model has no hardware answer. Every Mesen comparison
runs under the same assumptions, so they do not cause differences there.

- **Power-on WRAM:** all zero, as Mesen with `ramPowerOnState=AllZeros`
  (tools/mesen.mjs, src/video/live-game.mjs). A real console starts with
  arbitrary contents; this only matters if game code reads WRAM before writing it.
- **VBlank poll 81:EEC2** (LDA 4212 with the NMI disabled): reads "outside
  VBlank", because without an NMI the model has no picture position (Book I
  PDF 146, 2-28-7; [NATIVE-CONTINUATION.md](NATIVE-CONTINUATION.md)).
- **Sound driver waits** with the NMI disabled (the title after loading): each
  return of the wait loop advances one audio sample (32 kHz) and no NMI; the
  CPU work itself takes no time (`APU_WAITS`, NATIVE-CONTINUATION.md).

The picture assumptions of the tube filter (underscan, DAC, residual contrast)
are listed with their open points in [CRT-FILTER.md](CRT-FILTER.md).

## Decision of 2026-10-30: technique before route comparisons

- The game is not played through as a whole against Mesen (M7 not as a live
  comparison over all areas). All scripts and natives are covered statically;
  the live comparisons mainly check shared technique, and in combat areas the
  randomness separates original and port anyway.
- The series of closed live plans ends with the purchase of the Lone Star badge
  (`BADGE_BUY_LIVE_PLAN`). New route comparisons only for a concretely named
  fault or contract gap, scope and completion fixed beforehand.
- Technique and product have priority, in this order (user):
  1. Cold start live from the reset to "New Game" in the browser, without the
     original's observation files (boot-logo-observations.json,
     room-observations.json.gz); picture comparison against the original.
     Delivered 2026-10-30 (`LiveGame`, NATIVE-CONTINUATION.md).
  2. Control: gamepad and rebindable keys. User rule 2026-10-30: WASD, mouse
     for the glove (position set directly, a keyboard direction closes it),
     mouse buttons L/R, F=A, X, Y, E=Start, G=Select, menus with the mouse
     wheel, left click and Esc. Delivered 2026-10-30
     ([CONTROLS.md](CONTROLS.md)).
  3. Saving: SRAM kept in the browser, export and import as `.srm`. Delivered
     2026-10-30 ([SAVING.md](SAVING.md)).
  4. Recording for the test run (see below). Delivered 2026-11-01
     ([RECORDING.md](RECORDING.md)).
     Open limits (audio time, text DMA read-back) only when they disturb the game.
- User rule (2026-10-30), permanent: as little input delay as possible, in all
  situations and input screens (intro, title, menus, game). The browser reads
  the pad word where the game reads it and computes at most two pictures ahead
  of the display (40 ms).
- Faults in later areas are found by a test run of the user. For that a
  recording in the browser comes early (inputs per frame and regular state
  checks), so that every report can be replayed natively and, where possible,
  in Mesen, and kept as a regression test. Delivered 2026-11-01: inputs per pad
  read and a WRAM hash every 1000 NMIs, native replay
  ([RECORDING.md](RECORDING.md)).

## Decision of 2026-10-30: game without the ROM brought forward

- The user brings the "target without the ROM" forward before the recording:
  the product no longer needs the original ROM, all content is native.
- Route (user choice): original format first, then decoded. Step 1 stores all
  data bytes without the executed code as a data package, step 2 converts
  category by category into editable formats with a lossless way back. Plan,
  findings and status: [ROM-FREE.md](ROM-FREE.md).
- The recording (point 4 above) follows after that (delivered 2026-11-01).

## Decision of 2026-11-01: test run moved to the end

- The user test run with recordings moves to the very end of the project;
  the recording tools stay available ([RECORDING.md](RECORDING.md)).
- The CRT output-area integration stays as delivered, including its added
  GPU time (about 0.37 ms at 4K on the measured RTX 4070); a cheaper
  approximation is not pursued for now.

## 4. Less checking effort (own follow-up blocks)

- Incremental generators: a hash over inputs and generator code; unchanged
  generators are skipped. The double determinism run remains for changed
  generators and runs completely at regular intervals.
- Generated artifacts stayed versioned at first (user decision 2026-10-13).
  Finding then: from a fresh checkout without them 204 of 622 generators failed,
  also with repetition. Their reports read each other in cycles (for example
  `render-bf3b` reads `render-9f6d`/`render-8f20`, both read `render-bf3b`), plus
  268 backward dependencies against the order in `package.json`. They were
  reproducible only as a fixed point of the checked-in state. Later cleanup
  block: resolve the cycles (derive cross references from the ROM instead of
  other reports), order the generators by dependencies (graph from
  `.cache/release/generators`), after that the artifacts can leave Git.
  Since the user decision of 2026-10-31 the generated `analysis/` reports are
  no longer versioned (`npm run rebuild:artifacts` in a fresh checkout);
  `assets/` stays versioned.
- `verify:release` remains mandatory before every delivery.

## Decision of 2026-11-10: lifted code

For `src` and `assets` (not `proof`): code readable for humans, portable to
other languages and platforms (for example C or Amiga), resources addressed
by name and detached from the SNES layout, with attention to speed and
memory. `src` may give up instruction-level fidelity as long as the result
stays the same; the register-level version moves to `proof` as reference
and a differential test compares both. Work goes step by step, starting
with video and audio interfaces in front of the existing PPU and APU
models. The matrix is the pilot: [MATRIX-LIFT.md](MATRIX-LIFT.md) defines
what is compared (game state, picture, sound) and what is no longer
produced (stack, direct page scratch, leftover registers). The cutscenes,
the intro and the title followed ([CUTSCENE-LIFT.md](CUTSCENE-LIFT.md),
[INTRO-LIFT.md](INTRO-LIFT.md), [TITLE-LIFT.md](TITLE-LIFT.md),
[START-MENU-LIFT.md](START-MENU-LIFT.md),
[TITLE-CYCLE-LIFT.md](TITLE-CYCLE-LIFT.md), [GAME-START-LIFT.md](GAME-START-LIFT.md),
[AUDIO-ROUTINES-LIFT.md](AUDIO-ROUTINES-LIFT.md), [GAME-SCREEN-LIFT.md](GAME-SCREEN-LIFT.md),
[ROOM-ENTRY-LIFT.md](ROOM-ENTRY-LIFT.md),
[SCENE-REQUEST-LIFT.md](SCENE-REQUEST-LIFT.md), [MAIN-LOOP-LIFT.md](MAIN-LOOP-LIFT.md),
[BOOT-SCREENS-LIFT.md](BOOT-SCREENS-LIFT.md)).

## Decision of 2026-11-14: game state, not bytes

The aim is not a byte-exact reconstruction but a 1:1 game in look, sound and
behaviour. Apart from audio, `src` moves as far from the SNES as possible; later targets
may be other languages and systems (for example Amiga). Lifted code and its tests
therefore compare game state: WRAM outside the CPU stacks and the direct page scratch,
VRAM, CGRAM, OAM, PPU registers, device writes and the sound RAM, frame by frame. They
do not compare the stack pointer, stack bytes, saved interrupt registers or registers
and flags left over, unless a caller or callee reads them as an argument or result
(then they are part of the routine's interface and are named as such). Existing tests
that compare more stay valid and are relaxed when their module is next worked on; the
rules are in [MATRIX-LIFT.md](MATRIX-LIFT.md) and [MAIN-LOOP-LIFT.md](MAIN-LOOP-LIFT.md).

## Later quality-of-life changes and other platforms

The interpreter route blocks none of these, it rather makes them easier:

- **Control (WASD/mouse):** the game reads a SNES joypad word (native input
  building blocks such as `proof/render/input-9e0b.mjs`). A keyboard and mouse
  mapping in front of it is independent of the interpreter.
- **Save anywhere / state outside the game:** the whole state exists as
  explicit JS data (WRAM image, tasks, heap). A snapshot as in an emulator is a
  serialization of it. Additional save points in the game are script or native
  additions behind an option switch.
- **Marking items:** the render layer can read the known object data and draw
  in addition, optionally switched off. Delivered 2026-11-04 as a periodic
  flash ([OBJECT-MARKERS.md](OBJECT-MARKERS.md)); saving anywhere and four
  save slots in [SAVING.md](SAVING.md).
- **Bug fixes:** either as a patch of single script bytes (data) or in the
  native handler or native, each behind a switch for the original behaviour.
- **Slowdowns:** they arise on the SNES CPU. A native port does not have them,
  unless the original timing is reproduced on purpose.
- **Debug room:** through known flags and script entries, optionally reachable.
  Unverified hints: [TCRF-NOTES.md](TCRF-NOTES.md).
- **Other languages and systems:** what has to be ported is a small, clearly
  defined core (interpreter, handlers, natives, render, audio and input layer).
  The game logic stays unchanged as script data. That is much less than
  thousands of single body implementations. The oracle tests can be reused in
  the new language.

Limit: game logic in scripts stays bytecode and is no readable JS code. For
larger content changes a decompiler or annotator makes sense later (basis:
[SCRIPT-LANGUAGE.md](SCRIPT-LANGUAGE.md), `decode:scripts`).
