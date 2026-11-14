# Intro lift

The intro 81:DFE7 (cutscene 14) is the third scene lifted from register-level
65816 equations to plain code, after the matrix and the cutscenes (user
direction 2026-11-10, [STRATEGY.md](STRATEGY.md) "Lifted code"; method and
shared routines in [MATRIX-LIFT.md](MATRIX-LIFT.md), the cutscene entry in
[CUTSCENE-LIFT.md](CUTSCENE-LIFT.md)). The register-level versions of 81:DFE7
and of its NMI callback 81:DF0E stay as reference in
[proof/intro-reference/](../proof/intro-reference/); the ROM proof tests
(`tools/main-scene-intro.test.mjs`, `tools/main-intro-nmi.test.mjs`) keep
checking them against the original instructions. Its set-up routines (81:D60F,
81:D83E, 81:DC43, 81:D642, 81:DDB1, 81:E8E5, 81:E900, 81:EF63, 81:F092) and the
sprite grid 81:E83A with the far object start 81:E971 are references in
[proof/intro-reference/](../proof/intro-reference/) as well (intro-setup.mjs,
intro-sprites.mjs; table entries in intro-routines.mjs), since the title, start
menu and title cycle are lifted too; the frontend references call them, and they are
the reference of the random tests. Live, only the outer owner 80:A141 still calls
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

[tools/intro-lift.test.mjs](../tools/intro-lift.test.mjs) runs the sessions of
[tools/live-intro-plan.mjs](../tools/live-intro-plan.mjs) (from the apartment
save, request 7E:1CE9 = 14: one intro over its 300 frames with spawns and the
departure of the far object, one ended with A after about 60 frames, each
followed by the credits of scene 5, about 20,000 NMIs) once lifted and once with
the reference, through [tools/lift-compare.mjs](../tools/lift-compare.mjs).
Every NMI must be equal: WRAM outside the ignored scratch of the cutscenes and
the word 7E:0016, the scratch of the sprite grid (the following cutscene sets
it before reading it); VRAM, CGRAM, OAM, PPU registers and scroll, PPU write
count and sound RAM. A planted difference (one OAM byte in the 200th intro NMI)
fails it at NMI 5201.

[tools/intro-lift-functions.test.mjs](../tools/intro-lift-functions.test.mjs)
runs the NMI callback (600 samples), the near object with its sound, the first
objects, the clearing of the slots, the window, the title and game audio and
both sound directory uploads on random states against the reference
([tools/lift-function-harness.mjs](../tools/lift-function-harness.mjs)): every
frame offset that holds a picture, free and taken slots, positions off screen
and at the word wrap, every phase of the frame counter. The scene generator and
the frame step are covered by the live sessions.
