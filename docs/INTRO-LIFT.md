# Intro lift

Note (2026-11-25): the register-level frontend reference (proof/frontend-reference/)
and the intro set-up reference (proof/intro-reference/) were retired with their ROM
proofs and lift comparisons, after the recorded Mesen replays through the title were cut
(user decision, [STATE-MODEL-REBUILD.md](STATE-MODEL-REBUILD.md), Progress). The golden
traces attract, new-game and intro cover the lifted frontend. Where the text below says
that a reference stays or a test checks it, it describes the state before that date.

The intro 81:DFE7 (cutscene 14) is the third scene lifted from register-level
65816 equations to plain code, after the matrix and the cutscenes (user
direction 2026-11-10, [STRATEGY.md](STRATEGY.md) "Lifted code"; method and
shared routines in [MATRIX-LIFT.md](MATRIX-LIFT.md), the cutscene entry in
[CUTSCENE-LIFT.md](CUTSCENE-LIFT.md)). The register-level reference of 81:DFE7 and
its NMI callback 81:DF0E (proof/intro-reference/intro-scene.mjs) was retired on
2026-11-25 (user decision: ROM proofs may go where golden traces cover the lifted
path), with tools/intro-lift.test.mjs; the golden traces intro and attract cover the
path ([STATE-MODEL-REBUILD.md](STATE-MODEL-REBUILD.md)). Its set-up routines (81:D60F,
81:D83E, 81:DC43, 81:D642, 81:DDB1, 81:E8E5, 81:E900, 81:EF63, 81:F092), the sprite
grid 81:E83A and the far object start 81:E971 stay as register-level references in
proof/intro-reference/ (removed) (intro-setup.mjs,
intro-sprites.mjs; table entries in intro-routines.mjs): the frontend references
(title, start menu, title cycle) call them, and the recorded Mesen chronologies of the
boot place NMIs inside their unpack calls, which a lifted entry cannot replay (an
attempt with lifted adapters on 2026-11-25 failed 22 release tests). The ROM proofs
tools/main-scene-intro.test.mjs and tools/main-intro-nmi.test.mjs and the random tests
of tools/intro-lift-functions.test.mjs keep checking them. Live, only the outer owner 80:A141 still calls
81:EF63, through the lifted `setUpGameAudio` (`setUpGameAudioRoutine`). The title was lifted next ([TITLE-LIFT.md](TITLE-LIFT.md)).

## Modules

| Module                                              | Content                                                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| [intro-scene.mjs](../src/intro/intro-scene.mjs)     | Scene 81:DFE7 as a generator, its screen (81:D60F, 81:D83E), window (81:D642), title and game audio (81:DDB1, 81:EF63), NMI 81:DF0E. |
| [intro-objects.mjs](../src/intro/intro-objects.mjs) | The object slots (81:E8E5, 81:DC43, 81:E900), the sprite grid 81:E83A, the NMI drawing and the frame step of the intro loop.         |
| [music-mode.mjs](../src/apu/music-mode.mjs)         | Also `loadSoundDirectory` (81:F092): the directory pointer and the upload of its block list.                                         |

The intro tables of bank 81 (sprite grids, the frame list 81:DF77, the first
objects, the spawn positions, sound levels and pans, the X bit 8 of the high
table, the packed streams, the window table) are read by their `LOOKUP_TABLES`
names; an index past a table stops at the frontier `intro_table_index_frontier`.
The window copy reads fourteen bytes as the original does, the thirteen of
`intro_window_hdma` and the first code byte of 81:D694 behind it
([ROM-CODE-AUDIT.md](ROM-CODE-AUDIT.md)).

## Boundaries

- The cutscene entry 81:CDF8 passes scene 14 on to the intro (a tail call) and
  the intro calls the cutscene again for scene 5 mirrored, both through the
  routine tables, so either side may be lifted or reference.
- The original saves the status, sets the data bank to 81 and runs with 16-bit
  registers; it returns with its status and with the data bank 80 that 81:EF63
  leaves. The lifted intro sets the same status and data bank around its work;
  the stack frame of PHP/PLP is not reproduced.
- Scene 5 takes the X register as its argument, which the original does not set
  before the call: it is the 8-bit X the fade out counted down to FF, so the
  lifted intro passes FF.
- The sprite grid sets the X bit 8 of an object in the high table byte of the
  low byte of its OAM offset, as the original does: objects 64 to 127 would set
  the bits of objects 0 to 63. The intro draws at most 90 objects (nine grids of
  at most ten), so this never shows. An OAM offset past the low table stops at
  the frontier `intro_oam_frontier`, where the original would write on into the
  high table and beyond.
- Frame wait, input, fades and NMI delivery are the lifted shared routines
  (lag-free frames); with recorded interrupt observations the intro keeps the
  register-level wait and input.

## What is compared

Until 2026-11-25, tools/intro-lift.test.mjs compared the sessions of
[tools/live-intro-plan.mjs](../tools/live-intro-plan.mjs) (from the apartment save,
request 7E:1CE9 = 14: one intro over its 300 frames with spawns and the departure of
the far object, one ended with A after about 60 frames, each followed by the credits
of scene 5) NMI by NMI with the register-level reference, and
tools/intro-lift-functions.test.mjs ran the callback 81:DF0E on random states against
it (its set-up cases remain). The same sessions are now the golden trace intro
([tools/golden/](../tools/golden/)): picture, game state, audio and SRAM hashes per
frame, recorded from the proved lifted code.
