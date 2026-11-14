# Start menu lift

The start menu 81:E14A (with its fallthrough 81:E1B4 and input 81:E29F) is the
second frontend delivery group lifted from register-level 65816 equations to
plain code, after the title ([TITLE-LIFT.md](TITLE-LIFT.md); method in
[MATRIX-LIFT.md](MATRIX-LIFT.md)). The register-level versions stay as reference
in [proof/frontend-reference/start-menu.mjs](../proof/frontend-reference/start-menu.mjs)
and [start-menu-text.mjs](../proof/frontend-reference/start-menu-text.mjs);
[frontend.mjs](../proof/frontend-reference/frontend.mjs) (`withFrontendReference`)
puts title and menu references into a routine table for the ROM proof tests and
the replays of recorded chronologies.

## Modules

| Module                                                       | Content                                                                                                                                                                                       |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [start-menu.mjs](../src/frontend/start-menu.mjs)             | The menu 81:E14A/E1B4/E29F as a generator, its texts (81:D531, D555, E32F, E343, E354, E371, E38D, E3DA, E446), settings (D5E4, EF36), the title start (E50C, E57E, E5DB, E623) and NMI E6AE. |
| [main-frontend-text.mjs](../src/task/main-frontend-text.mjs) | Still register-level: the settings routines the startup 80:A133 calls (D5D0, D5E4, D5EC, D5F4, EF36), the save checksum 81:B1AB entry and the frontend call frames.                           |

The texts are read from bank 81 or from their translation or edit
(`languageMenuText`), as before ([EDITABLE-TEXT.md](EDITABLE-TEXT.md));
[tools/frontend-text-edits.test.mjs](../tools/frontend-text-edits.test.mjs) now
runs the lifted functions. The menu tables (stripe VRAM words, animation sounds,
fade tables, title objects) are read by their `LOOKUP_TABLES` names; an index past
a table stops at `menu_table_index_frontier`.

## Boundaries

- The menu is called by JSL from the title cycle 80:A18C (lifted since, see
  [TITLE-CYCLE-LIFT.md](TITLE-CYCLE-LIFT.md)) with A
  nonzero right after the title (the shorter timeout) and returns with RTL: A is
  the save slot, FFFF for a new game or FFFE for a cancel; the status comes back
  from the entry. The original's 8-bit fade out leaves X at FF and clears the
  high byte of Y; the lifted menu returns them so as well.
- The saved games menu checks each slot with the save code's checksum 81:B1AB,
  called register-level from its original site 81:E3E5 (`validSaveSlot`).
- The menu's state stays in the direct page where the original keeps it
  (cursor 0E, text 10, choice 16, text XOR 18, timeout 1C, title colours 0E and
  1E).
- The random restart of an animation in the NMI 81:E6AE takes the carry of the
  interrupted code into its first addition, as the original does: the lifted
  callback reads it from the status at its entry.
- The objects' frame counter is counted by an 8-bit INC in 81:E57E (only its low
  byte) and by a 16-bit INC in the NMI, as in the original.
- The port additions keep working: the Credits row (`startMenuCredits`), the
  four-slot option, menu text edits and translations.

## What is compared

[tools/start-menu-lift.test.mjs](../tools/start-menu-lift.test.mjs) runs the four
sessions of [tools/live-start-menu-plan.mjs](../tools/live-start-menu-plan.mjs)
from power-on: all options and the saved games menu with Exit before loading a
game, a new game, the Credits row, and the timeout after the whole title. Every
NMI must be equal; a planted difference (an animation frame in the 200th menu
NMI) fails it at NMI 1427.

The timeout session runs on into the attract game. It first showed a frame
counted twice there, at a point that depended on where the live steps ended,
with the register-level menu as well: the attract game's nested scheduler
rounds resumed after a pause with the main loop's registers in the shared VM
and started a second round in the same frame. NestedRoundContinuation
(src/vm/native-call.mjs) now keeps its own registers between work pieces;
[tools/live-step-budget.test.mjs](../tools/live-step-budget.test.mjs) checks that
the attract game gives the same frames with small step budgets.

[tools/start-menu-lift-functions.test.mjs](../tools/start-menu-lift-functions.test.mjs)
runs the text writer (600 samples), tilemap clear, highlight, settings checksum,
animation sources, colour fade and the NMI callback (600 samples, either carry)
against the reference on random states;
[tools/lift-function-harness.mjs](../tools/lift-function-harness.mjs) now also
compares SRAM.
