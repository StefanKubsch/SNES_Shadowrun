# Matrix lift (pilot)

The matrix is the first part of `src` lifted from register-level 65816
equations to plain code (user direction 2026-11-10, [STRATEGY.md](STRATEGY.md)
"Lifted code"). The register-level version stays as reference in
[proof/matrix-reference/](../proof/matrix-reference/); the ROM proof tests
(`tools/main-matrix-*.test.mjs`, `tools/main-scene-matrix.test.mjs` and the
interrupt tests) keep checking it against the original instructions.

## Modules

| Module                                                 | Content                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| [matrix-scene.mjs](../src/matrix/matrix-scene.mjs)     | Scene 81:C3CA as a generator (pauses at frame waits), screen set-up, fades, NMI callback 81:BEC3. |
| [matrix-world.mjs](../src/matrix/matrix-world.mjs)     | Map upload and tiles, objects and sprites, persona states, actions of A and B on the node ahead.  |
| [matrix-text.mjs](../src/matrix/matrix-text.mjs)       | Message ring, typing and text commands, language edits of matrix texts, gauges.                   |
| [matrix-runtime.mjs](../src/matrix/matrix-runtime.mjs) | Word access to WRAM and cartridge tables, VRAM copy queue, bridge to shared routines.             |
| [matrix-tables.mjs](../src/matrix/matrix-tables.mjs)   | The control tables of bank 81 and the animation lists as named data (`m.tables`).                 |
| [video-port.mjs](../src/video/video-port.mjs)          | Video interface: VRAM words and copies, OAM copy, colours, scroll, layers, colour math, H-DMA.    |
| [hardware-port.mjs](../src/system/hardware-port.mjs)   | Hardware interface: system register reads and writes, each with the site of the original.         |
| [joypad.mjs](../src/system/joypad.mjs)                 | Joypad word after the automatic read (80:9E0B), newly pressed buttons (80:9E1A).                  |
| [nmi.mjs](../src/system/nmi.mjs)                       | NMI enable and disable, NMI callback, hidden sprites, scene screen start (81:EB97).               |
| [unpack.mjs](../src/system/unpack.mjs)                 | The unpacker of packed streams (80:9E9B-A032).                                                    |
| [random.mjs](../src/system/random.mjs)                 | Random numbers below a range (80:C51F, 80:C560).                                                  |
| [apu-command.mjs](../src/apu/apu-command.mjs)          | Sound driver command through the port handshake (81:F007).                                        |
| [music-mode.mjs](../src/apu/music-mode.mjs)            | Music modes and the sample loader with its byte pairs (81:EF47, 81:F130, 81:F03A).                |
| [scene-list.mjs](../src/system/scene-list.mjs)         | Scene command lists (81:EC16) and the palette copy (81:ECF2).                                     |
| [fades.mjs](../src/video/fades.mjs)                    | Fade in and out, one brightness step per frame (81:EEDD, 81:EEF1).                                |

Functions take parameters and return values; no register, flag, stack frame
or direct page scratch word is modelled. Persistent game state stays at its
WRAM address (other code, saves and cheats read it).

The control tables of bank 81 (headings, sides, nodes, track, damage,
amounts, neighbours, OAM bits, blink colours) and the animation lists are
named data: [matrix-tables.mjs](../src/matrix/matrix-tables.mjs) decodes them
once per loaded image under the names of `LOOKUP_TABLES` in
[src/data/tables.mjs](../src/data/tables.mjs), so edited table assets still
apply. Code takes an entry by index (`t.pushX(entryOf(direction))`), not a
byte at an address. An index outside a table stops at the frontier
`matrix_table_index_frontier`, where the original reads on into the bytes
behind the table: an odd heading, or a node cell without a side of value 07
in B56F. The game reaches neither (the live sessions pass). One such read is
part of the game and is kept by name: B on a taken data node (40) indexes
`matrix_bits` with 30 and ORs the word at 81:C334, entries 4 and 5 of
`matrix_amounts_10`, into the data bits.

Not named data, on purpose: the message lists 81:C515 (the original stores
the byte after each entry as the bank word in the WRAM text ring), the text
addresses of the ring, the list words kept in WRAM, and the DMA and H-DMA
sources the hardware reads (81:B258, 81:C101).

## Boundaries

- The scene is entered by JSL from the scene request of the main loop (80:CC4B,
  lifted in [SCENE-REQUEST-LIFT.md](SCENE-REQUEST-LIFT.md))
  with 16-bit registers and returns with RTL; it changes neither the status
  nor the data bank, so the original's PHP/PHB/PLB/PLP pair and the SEI of
  81:EB97 (undone by that PLP) are not reproduced. The NMI callback ends with
  RTL to the NMI dispatcher.
- Shared routines lifted so far: OAM transfer 81:ED8B (`VideoPort.copyToOam`),
  joypad 80:F290, sound command 81:F007, random 80:F2A8, unpacking 80:F2A4
  (and the stream form 80:F2A0 with its language redirection), input
  80:F298, scene screen start 81:EB97 (with `VideoPort.resetRegisters` and
  `clearVram`), NMI enable 81:EB7B, the scene command list 81:EC16 and the
  music mode 81:EF47 with its sample loader, and the fades 81:EEDD/EEF1
  (around the frame wait). The matrix calls the lifted
  versions; the register-level versions in `src/task` stay for the scenes
  that are not lifted yet and are the reference of the random tests.
- The frame wait 81:EEBB is lifted too ([frame-wait.mjs](../src/system/frame-wait.mjs)).
  The lag-free frame model delivers an NMI only at a blocking loop branch of
  the original (`LagFreeFrames.nmiAt`); for the delivery the wait presents the
  original's state there (PC 81:EED1, 8-bit accumulator, compare equal), and
  puts the caller's context back afterwards. It loops until the NMI has
  changed the frame counter 7E:1C76; with the NMI disabled in the NMITIMEN
  shadow it polls HVBJOY instead. After each NMI the native call pauses once, so
  a live step ends with its frame as with the original, whose polling
  instructions use up the step budget; without the pause one step ran hundreds
  of lifted frames (seen in tools/credits.test.mjs, which measures per step). With recorded interrupt observations
  instead of lag-free frames the scene keeps the register-level wait.
- The lifted command list runs with 16-bit registers, as the matrix requires:
  its callback command then stores the bank as a word (7E:0070-0071).
- A soft reset (Select, Start, L and R) still stops at the reset frontier
  `task_reset_source_required`.
- `HardwarePort` passes each read with the address of the original
  instruction (its site): the live device model tells the joypad latch and
  the beam counter bytes of the random draw apart by it. Another platform
  answers by register.
- `VideoPort` emits the original register writes in the original order, so
  the PPU model, the raster write count and recordings see the same stream.
  Another platform implements the same methods on its own display.
- Sound goes through `runtime.sound(command, parameter)`, random numbers
  through `runtime.random(range)`.

## What "the same result" means

[tools/matrix-lift.test.mjs](../tools/matrix-lift.test.mjs) runs the seven
sessions of [tools/live-matrix.test.mjs](../tools/live-matrix.test.mjs)
(combat won and lost, data, CPU and download nodes, gates, datajack path,
death and Game Over, each with the return to the apartment) once with the
lifted and once with the reference code. At every NMI (about 26,000) these
must be equal: WRAM, VRAM, CGRAM, OAM, PPU registers and scroll, the number
of PPU writes and the sound RAM. Not compared, because the lifted code no
longer produces them:

- the main stack 7E:0100-01C9 and the NMI stack 7E:1C7C-1CBB,
- the interrupted A and S saved by the NMI (7E:1C78-1C7B),
- direct page scratch 7E:0000-0033 (routine locals and register parameters;
  the text pointer 7E:0034-0037 is persistent and compared),
- the unpacker state 7E:00DB-00F2 and the sample loader state 7E:0089-008B
  and 008F-0099: every call sets each field before it reads it, and no other
  code reads them (the lifted versions keep it in locals; the sound directory
  pointer 7E:008C-008E stays compared),
- registers left over at the return to 80:CC4B (the caller and 80:9629
  overwrite or ignore them on the tested paths; the later frames match).

### Random per-function tests

[tools/matrix-lift-functions.test.mjs](../tools/matrix-lift-functions.test.mjs)
covers the edge cases the sessions do not reach. Each of the 16 exported
functions, the NMI copy queue and the lifted shared routines run on random WRAM images against their
reference routine at the same address: 300 samples each, 1000 for the persona
step and the A and B node actions. The matrix words are drawn from wide domains (all object kinds,
real animation lists, states including invalid ones, word wrap values,
synthetic texts with every command, language edits and edit streams already
queued). Both sides must leave the same WRAM outside the scratch above, the
same device writes (sound commands included: the test device echoes the
command token on APU port 0) and the same result, or stop at
the same frontier. Both see the same beam counter reads for the random draw.
Since 2026-11-14 ([STRATEGY.md](STRATEGY.md)) this is the rule for every lift: the
harness [tools/lift-function-harness.mjs](../tools/lift-function-harness.mjs) masks both
CPU stacks, and a stand-in records with `calleeRecord` only its target and the direct
page words and registers it reads as arguments, not the stack pointer or leftover
registers. Older tests that record more are relaxed when their module is next worked
on.
Line coverage of `matrix-world.mjs` and `matrix-text.mjs` is 100 %.

Domain limits, each a case where the reference reads back its own direct
page scratch, which the lifted code does not have:

- A map from 7F:F800 on runs past the bank end into the low RAM mirror
  (80:0000 = 7E:0000). The game's maps lie at 7F:0216 + 800 n.
- A shown gauge value wider than its gauge (shown health above CF, shown
  memory above 47) runs the empty-tile loop through all of bank 7F into the
  low RAM mirror and over the direct page counters. The game keeps health at
  most C8 and memory at most 40.
- Samples where the reference accessor exceeds its access budget
  (`NATIVE_ACCESS_LIMIT`, a random room without an edge row) are counted as
  unmeasured, at most 2 % per function.
- Samples where the lifted code stops at the table frontier (see above) are
  counted as outside the lifted domain, at most 10 % per function; a separate
  test pins the frontier for an odd heading.
- Unpacking takes the nine packed streams of the cartridge and random WRAM
  bytes from 7E:2000 as streams. A stream read in the system area (banks
  00-3F and 80-BF, 0000-7FFF: the low RAM mirror with the reference's own
  unpacker state, and the hardware registers) is outside the lifted domain;
  real streams stay in their bank.

The command list takes the matrix list 81:CDB2 or synthetic lists of every
command (including unknown bytes, which stop at the frontier on both sides).
The music mode takes the cartridge's sound directory, or a synthetic
directory in WRAM with raw and repeated-word blocks.

The random tests of the unpacker found three original details the lifted
version now follows: a literal run of 0 (the gamma value wraps) still copies
one byte; a literal word written at offset FFFF puts its second byte into
the next bank; and each literal word is read whole before it is written,
which matters when the stream overlaps the output.

The random tests found one difference, now fixed: when the persona slot 0 is
free (only in random states), the first gate of a CPU node moves the
persona, and the original reads the persona position again for each further
side (81:B609); the lifted code had read it once.

## Measurements (2026-11-10)

Seven sessions, 12,028 NMIs with the matrix callback installed, including
picture and audio: lifted 1.167 ms per NMI, reference 1.418 ms per NMI.
`npm run benchmark:live` (no matrix on its path) was unchanged: 3.741 ms
per NMI after, 4.426 ms before (noise of the run).

## Next steps

- The matrix runs as plain code apart from its JSL/RTL boundary to the main
  loop and the interrupt delivery inside the frame wait. The cutscenes, the intro
  and the title followed ([CUTSCENE-LIFT.md](CUTSCENE-LIFT.md),
  [INTRO-LIFT.md](INTRO-LIFT.md), [TITLE-LIFT.md](TITLE-LIFT.md),
  [START-MENU-LIFT.md](START-MENU-LIFT.md),
  [TITLE-CYCLE-LIFT.md](TITLE-CYCLE-LIFT.md), [GAME-START-LIFT.md](GAME-START-LIFT.md),
  [AUDIO-ROUTINES-LIFT.md](AUDIO-ROUTINES-LIFT.md), [GAME-SCREEN-LIFT.md](GAME-SCREEN-LIFT.md),
  [ROOM-ENTRY-LIFT.md](ROOM-ENTRY-LIFT.md));
  further scenes reuse the lifted shared
  routines (src/system, src/apu, src/video) and the comparison tools
  (tools/lift-compare.mjs, tools/lift-function-harness.mjs).
