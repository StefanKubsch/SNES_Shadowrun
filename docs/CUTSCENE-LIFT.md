# Cutscene lift

The cutscenes 81:CDF8 are the second scene lifted from register-level 65816
equations to plain code, after the matrix (user direction 2026-11-10,
[STRATEGY.md](STRATEGY.md) "Lifted code"; the method and the shared routines
are described in [MATRIX-LIFT.md](MATRIX-LIFT.md)). The register-level reference
(proof/cutscene-reference/) was retired on 2026-11-25 (user decision: ROM proofs may go
where golden traces cover the lifted path); see "What is compared".

## Modules

| Module                                                           | Content                                                                                                           |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [cutscene-scene.mjs](../src/cutscene/cutscene-scene.mjs)         | Scene 81:CDF8 as a generator (set-up, frame loop, skip, end, fade poll) and the NMI callback 81:D479.             |
| [cutscene-animation.mjs](../src/cutscene/cutscene-animation.mjs) | The six animations of 81:CF72 (engine, pitch, line scroll, portrait forward and back, credits), sprites, picture. |
| [scene-runtime.mjs](../src/system/scene-runtime.mjs)             | The runtime of a lifted scene (memory, video, hardware, sound, random); the matrix runtime builds on it.          |
| [scene-screen.mjs](../src/video/scene-screen.mjs)                | The scene screen registers 81:EBE9.                                                                               |
| [music-mode.mjs](../src/apu/music-mode.mjs)                      | Also `startSong` (81:F229) and `loadSampleSet` (81:F130).                                                         |

The scene tables of bank 81 (audio modes, sounds, speeds, frame counts, sprite
bases and parts, animation calls, window H-DMA, displacements) are read by
their `LOOKUP_TABLES` names; a scene past the tables stops at the frontier
`cutscene_table_index_frontier`. The scene lists 81:F48D are read as words.

## Boundaries

- Scene 14 is the intro 81:DFE7; the lifted scene passes it on as the original
  does (tail call). The intro is lifted too ([INTRO-LIFT.md](INTRO-LIFT.md)).
- The scene state stays in the direct page 7E:0014-001F (BG1 scroll, BG2 speed,
  step, target and position, scene), where the NMI callback reads it.
- With lag-free frames the frame wait and the fade poll 81:CF4C take their NMI
  through `nmiAtBranch` (src/system/frame-wait.mjs) at the original's blocking
  branch (81:EED1 and 81:CF4F). With recorded interrupt observations the scene
  keeps the register-level wait, input and fade poll. The fade poll presents the
  state after LDA of a nonzero byte (Z clear): with a Z left set by earlier code
  the frame model would deliver no NMI and the poll would never end (found by
  the German menu credits, which end with B).
- The credits keep the packed text edit of their pages around the unpacking and
  the port addition that lets B or Start end the menu's credits
  (src/game/credits.mjs).
- The original's PHP/PHB/PLB/PLP boundary pair is not reproduced; the scene
  returns with RTL.

## What is compared

Since 2026-11-25 the golden traces cutscenes and intro (tools/golden/scenarios.mjs,
[STATE-MODEL-REBUILD.md](STATE-MODEL-REBUILD.md)) fix the behaviour: the sessions of
[tools/live-cutscene-plan.mjs](../tools/live-cutscene-plan.mjs) (scenes 0-4 to their end,
two mirrored, one with an argument, one ended with B, the credits) and of
[tools/live-intro-plan.mjs](../tools/live-intro-plan.mjs), with picture, game state,
video memory, audio and SRAM hashes per frame. Before, tools/cutscene-lift.test.mjs had
proved these sessions equal to the register-level reference at every NMI, and
tools/cutscene-lift-functions.test.mjs had compared the animation, sprites, text map,
picture, NMI callback and screen registers on random states; both were retired with the
reference, as were tools/main-scene-animation.test.mjs and the CDF8, D479 and nested
DFE7 cases of the ROM proofs (main-scene, main-scene-interrupt, main-fade-interrupt,
main-scene-intro). The ROM graph proofs of the cutscene entries remain
(tools/main-scene.test.mjs), and the credits text contracts
(tools/packed-text-contract.test.mjs: centring, 32-column stride, page overflow, high
character bytes) now run the lifted credits animation. src/cutscene functions reached by
the golden traces: 34 of 36 (the two missed are the register-level entries).
