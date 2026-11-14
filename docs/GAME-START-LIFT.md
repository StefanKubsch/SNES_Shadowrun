# Game start lift

The start of a game is lifted from
register-level 65816 equations to plain code, after the title cycle and the
outer game owner ([TITLE-CYCLE-LIFT.md](TITLE-CYCLE-LIFT.md)); method in
[MATRIX-LIFT.md](MATRIX-LIFT.md). The register-level versions stay as reference
in [proof/game-reference/game-start.mjs](../proof/game-reference/game-start.mjs);
`withGameStartReference` and `withFrontendReference` put them into the ROM proof
tests and recorded replays.

## Modules

| Module                                             | Content                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [game-start.mjs](../src/game/game-start.mjs)       | The main start 80:9688, the room start 80:9699, the new game 80:960D and its state 80:98E9, the save load 81:B198. |
| [main-start.mjs](../src/task/main-start.mjs)       | The routine table and the main driver's entry (`runMainStart`, `mainStartContinuation`).                           |
| [fixed-colour.mjs](../src/game/fixed-colour.mjs)   | The fixed colour reset 81:8861 with its tail 81:886A (fixed colour black, colour math off).                        |
| [main-frontend.mjs](../src/task/main-frontend.mjs) | The attract game's rounds 80:9699: the lifted room start, then the main loop's rounds (driver glue).               |

## Boundaries

- The main start is the routine table's entry 80:9688, so the reference can
  replace it. It reads the menu's choice from direct page word 0: FFFF (any
  negative word) starts a new game in room 3, a slot number loads that slot and
  its saved room.
- The room start calls the lifted game screen set-up 80:9629
  (src/game/game-screen.mjs), room entry 80:A4BF (src/game/room-entry.mjs,
  [ROOM-ENTRY-LIFT.md](ROOM-ENTRY-LIFT.md)) and fixed colour reset 81:8861
  (src/game/fixed-colour.mjs) directly,
  clears the main loop's reload and exit words and ends before the main loop's
  first call at 80:96AB.
- The new game state unpacks 8B:FBD2 with the lifted unpacker
  (src/system/unpack.mjs), copies the runners' starting equipment and magic
  points from bank 80 and sets Jake's record; the bulletproof vest fix
  (src/game/bugfixes.mjs) applies after the new game state and after a load.
- The save load copies 0F28 bytes from the slot's SRAM offset (81:B124, or the
  four-slot offsets of src/game/save-slots.mjs) to 7E:2DE0. The caller has
  checked the slot before.
- Not produced: the save slot in direct page 7E:000E, the unpacker state, the
  room word the reference pushes around 80:9629, the stack frames of 80:9629
  and 81:8861, the registers they leave, and the registers the MVN copies leave
  (A, X, Y; the data bank is restored in both). The fixed colour registers
  COLDATA and CGADSUB go through the video port.
- The entry check (80:9688, direct page 0, data bank 80, 16-bit registers)
  runs before the accessor is built, so an invalid entry reports
  `main_start_entry_required`.

## What is compared

[tools/game-start-lift.test.mjs](../tools/game-start-lift.test.mjs) runs the
new game, saved game and attract game sessions of
[tools/live-title-cycle-plan.mjs](../tools/live-title-cycle-plan.mjs); every
NMI must be equal. A planted difference (Jake's Computer skill) fails it.

[tools/game-start-lift-functions.test.mjs](../tools/game-start-lift-functions.test.mjs)
runs 98E9, 960D, B198 (both slots, random status and data bank) and 9688 (both
choices) against the reference on random states on the game's stack (7E:1EF0),
with recorded stubs for the routines the room entry calls through their frames;
the reference's own callees, the register-level 9629, A4BF and 8861 included,
are references too. WRAM outside
the scratch, SRAM, device writes and the read registers must be equal; planted
differences (one magic point row, one save byte, the colour phase, the colour
math layers, the music reset of the game screen) fail it.

[tools/main-start.test.mjs](../tools/main-start.test.mjs) keeps proving the
reference against the ROM.
