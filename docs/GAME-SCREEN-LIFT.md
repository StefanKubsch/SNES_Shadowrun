# Game screen lift

The game screen set-up 80:9629, which the room start calls before it enters a
room, is lifted from register-level 65816 equations to plain code, after the game
start ([GAME-START-LIFT.md](GAME-START-LIFT.md)) and the audio routines
([AUDIO-ROUTINES-LIFT.md](AUDIO-ROUTINES-LIFT.md)); method in
[MATRIX-LIFT.md](MATRIX-LIFT.md). The register-level version stays as reference
in [proof/game-reference/game-screen.mjs](../proof/game-reference/game-screen.mjs)
(`GAME_SCREEN_REFERENCE_ENTRIES`, `withGameScreenReference`; also part of
`FRONTEND_REFERENCE_ENTRIES` and so of the ROM proof tests and the scene
reference table).

## Modules

| Module                                                     | Content                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [game-screen.mjs](../src/game/game-screen.mjs)             | `setUpGameScreen` (80:9629) with the video mode 81:B064, the portrait request 80:8FB3, the glove 80:BC1A, the camera 81:891A, the palettes 81:8CB9/81:8000/81:A840, the object slots 81:A772, the font 81:AB2C, the window style 81:AA9C, the window map 81:A9B2 and the text uploads 81:A9E1. |
| [state-bar.mjs](../src/game/state-bar.mjs)                 | `drawJakeStateBar` (81:AF1F): Jake's state bar in the window map, with the three divisions on the hardware divider through the port and the original loop counts (quotient 0 draws 65536 frame segments; a value above the maximum counts the middle loop down from up to 65535).              |
| [main-initialize.mjs](../src/task/main-initialize.mjs)     | The table entry `setUpGameScreenRoutine` (80:9629) and the register-level callees, which other callers still use.                                                                                                                                                                              |
| [game-screen.mjs](../proof/game-reference/game-screen.mjs) | The register-level 80:9629 (`initializeGameScreen`), moved from main-initialize.mjs.                                                                                                                                                                                                           |

## Boundaries

- The set-up writes the CPU registers MEMSEL, NMITIMEN and HDMAEN through the
  hardware port at their original sites; NMITIMEN goes to the hardware only, its
  shadow is not touched. PPU and DMA registers go through the video port with
  the original widths and order.
- Jake's state bar 81:AF1F is lifted (src/game/state-bar.mjs). The divider
  writes (dividend word, divisor byte 20) and the quotient and remainder reads go
  through the hardware port at their original sites, as the multiplier of the
  sound effect (src/apu/sound-effect.mjs). The direct page words A2, A5 and A8
  are written as in the original (the caller's direct page is 0); the JSL frame
  of 81:A9DB, the pushed X and the registers are not produced. The register-level
  version (src/task/native-bar-tiles.mjs) stays for its other callers.
- The window style's packed tiles give the DMA length as the stream's output
  length, read from the stream the language selects (src/data/language.mjs).
- The window map words get the tile bias 2017 with the carry of the previous
  addition, as in the original; the window maps of the cartridge never carry.
- The window map 81:A9B2 unpacks with `unpackLong` (src/system/unpack.mjs), which
  leaves the unpacker's direct page state 00DB-00F2 as the original; the room
  entry's window list calls it too (ROOM-ENTRY-LIFT.md).
- Not produced: direct page scratch (7E:000E), the other unpacks' state, the stack
  bytes of the original JSL frames and the registers A, X, Y and the flags
  other than the 16-bit modes. The direct page word D8 (window style) and 82
  (VRAM upload index) are written as in the original.
- The room start 80:9699 (src/game/game-start.mjs) calls `setUpGameScreen`
  directly; the scene return 80:CC83 still calls 80:9629 through its table
  entry and original frame.

## What is compared

[tools/game-screen-lift-functions.test.mjs](../tools/game-screen-lift-functions.test.mjs)
runs 80:9629 against the reference on 60 random states with the game's stack
(7E:1EF0; the harness's own stack lies on the screen shadows) and Jake's state
bar absent, empty or drawn (maxima with and without remainder and below 20, values
0, small, below and above the maximum): WRAM outside the scratch, device writes, S, PC, the
banks and the 16-bit modes must be equal. Planted differences (the object VRAM
chain, the colour count, BG3 on the main screen, the style word; in the state bar
the small value bias, the tile above the value, a quotient 0 drawn as one segment
and a skipped partial tile) fail it.

[tools/game-screen-lift.test.mjs](../tools/game-screen-lift.test.mjs) runs
sessions 2 (new game) and 4 (attract game, then a new game) of
[tools/live-title-cycle-plan.mjs](../tools/live-title-cycle-plan.mjs); every NMI
must be equal. Its reference side also runs the register-level start of a game
(`withGameStartReference`), which calls the reference set-up through its
original frame. A planted difference (the colour count) fails both.

[tools/main-initialize.test.mjs](../tools/main-initialize.test.mjs) and
[tools/main-game-nmi.test.mjs](../tools/main-game-nmi.test.mjs) keep proving the
reference against the ROM.
