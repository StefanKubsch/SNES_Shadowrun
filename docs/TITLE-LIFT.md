# Title lift

The title 81:D694 with the prologue 81:DDDB is the fourth part lifted from
register-level 65816 equations to plain code, after the matrix, the cutscenes
and the intro (user direction 2026-11-10, [STRATEGY.md](STRATEGY.md) "Lifted
code"; method and shared routines in [MATRIX-LIFT.md](MATRIX-LIFT.md)). It is
the first of two delivery groups of the frontend; the start menu followed
([START-MENU-LIFT.md](START-MENU-LIFT.md)), then the title cycle 80:A18C
([TITLE-CYCLE-LIFT.md](TITLE-CYCLE-LIFT.md)). The register-level
versions stay as reference in
[proof/frontend-reference/title.mjs](../proof/frontend-reference/title.mjs); the
ROM proof tests (`tools/main-frontend-menu.test.mjs`,
`tools/main-frontend-nmi.test.mjs`, `tools/main-intro-nmi.test.mjs`, the
connected boot and frontend tests) run with it through `withTitleReference` and
[proof/scene-reference-routines.mjs](../proof/scene-reference-routines.mjs).

## Modules

| Module                                              | Content                                                                                                                                                                                      |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [title.mjs](../src/frontend/title.mjs)              | Title 81:D694 as a generator with the prologue 81:DDDB and its line renderer 81:DE93, window 81:D81F, picture 81:D927, blend 81:D87C/D8E5; NMI callbacks 81:DD54, 81:DAD6, 81:D93E, 81:DCAC. |
| [intro-objects.mjs](../src/intro/intro-objects.mjs) | Also the title objects 81:D9D5 (both lists, scrolled, with their event lists) and 81:E971.                                                                                                   |
| [frame-wait.mjs](../src/system/frame-wait.mjs)      | `nmiAtBranch` now also serves the music beat polls: it pauses only after a delivered NMI.                                                                                                    |

The upload tables (`frontend_vram_copies`, `frontend_vram_uploads`), the blend
fade tables and the object frame and event lists are read by their
`LOOKUP_TABLES` names; an index past a table stops at the frontier
`title_table_index_frontier` or `intro_table_index_frontier`.

## Boundaries

- The title is called by JSL from the title cycle 80:A18C and
  returns with RTL, A = 0 after the whole title or 1 after a held button, and
  the zero flag of that load, which A18C tests. As in the original the status
  comes back from the entry (the whole title clears M), and the data bank is 81
  once the intro screen 81:D60F has run (its 81:D83E leaves it there).
- The held button's exit writes the word 0 to HDMAEN (and 420D), the normal end
  a byte, as the original does.
- The blend 81:D8E5 ANDs its mask with zero, so it writes black into colours
  16-63 of the title palette; the tables are still read.
- The music beat polls (LDA 2142 / BNE) take their lag-free NMI at the BNE, and
  with the NMI disabled audio time (src/vm/frame-events.mjs); with recorded
  interrupt observations they only read the port, as the reference does. A
  button pressed during such a poll is lost, as in the original.
- With recorded interrupt observations the title keeps the register-level
  frame wait and input; the recorded boot proofs, which also record every
  instruction of the prologue fill, use the reference.

## What is compared

[tools/title-lift.test.mjs](../tools/title-lift.test.mjs) runs the six sessions
of [tools/live-title-plan.mjs](../tools/live-title-plan.mjs) from power-on: the
whole prologue and title, and a held Start in the prologue, the first title
frames, the pan, the vertical scroll and the blend. Every NMI must be equal
through [tools/lift-compare.mjs](../tools/lift-compare.mjs), with the ignored
WRAM of the intro. A planted difference (the speed word in the 100th scroll NMI)
fails it at NMI 2615.

`lift-compare` now cuts each run at the end of its last plan command: the NMIs
the last live step runs past it depend on the work units the code uses, which
differ between lifted and reference code (the title sessions ended up to 28
NMIs apart behind identical frames).

[tools/title-lift-functions.test.mjs](../tools/title-lift-functions.test.mjs)
runs the line renderer (600 samples), window, blend step, all NMI callbacks and
81:E971 on random states against the reference: prologue lines of every length,
the window at its limits, positions at the upload entries and the pan end,
speeds at saturation, object slots and event lists at their times. The title
generator is covered by the live sessions.
