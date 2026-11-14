# Scene request lift

The scene request 80:CC4B, which the main loop calls in every pass after the zone
gate 80:8000 (80:96C8), is lifted from register-level 65816 equations to plain
code, after the room entry ([ROOM-ENTRY-LIFT.md](ROOM-ENTRY-LIFT.md)); method in
[MATRIX-LIFT.md](MATRIX-LIFT.md). The register-level version stays as reference in
[proof/game-reference/scene-request.mjs](../proof/game-reference/scene-request.mjs)
(`SCENE_REQUEST_REFERENCE_ENTRIES`).

Script code asks for a new scene through the request word 7E:1CE9: FFFF asks for
nothing, 7FFF for the room in 7E:2DE2 only (the debug room's "Open",
[src/browser/debug-room.mjs](../src/browser/debug-room.mjs)), FFFE for the matrix
and any other value for that cutscene, with its argument in 7E:1CEB. A scene
blanks the screen, waits for the frame and plays; after the matrix the decker's
health 7E:1D8B goes back into the count byte of the decker's record (7E:1D93).
Then the game screen is set up again and, as for a room only, the request is
cleared and the room entered. The request returns with the carry set when it took
a request, and the main loop then starts its next pass at its top (80:96AB).

## Modules

| Module                                                         | Content                                                                                                                                                                          |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [scene-request.mjs](../src/game/scene-request.mjs)             | `sceneRequestSequence` (80:CC4B) and its run wrapper `processSceneRequest`, which the main loop's routine table (src/vm/main-loop.mjs) binds, with its native call continuation. |
| [room-entry.mjs](../src/game/room-entry.mjs)                   | The forced blank 81:B0BD, the frame wait 81:B0A1 (`waitForFrameCall`) and the room entry 80:A4BF, which the request calls directly.                                              |
| [game-screen.mjs](../src/game/game-screen.mjs)                 | The game screen set-up 80:9629, called directly.                                                                                                                                 |
| [main-loop-motion.mjs](../src/task/main-loop-motion.mjs)       | `MAIN_MOTION_ROUTINES` keeps the register-level callees of the reference: 81:B0BD, 81:B0A1, 80:9629 and 80:A4BF.                                                                 |
| [scene-request.mjs](../proof/game-reference/scene-request.mjs) | The register-level 80:CC4B (`processSceneRequestReference`), moved from main-loop-motion.mjs.                                                                                    |

## Boundaries

- The cutscene 81:CDF8 and the matrix 81:C3CA are lifted scenes (src/cutscene,
  src/matrix). The request calls them through the original's JSL frames (return
  words CC6E and CC74 in bank 80) with their own routine tables, as the main loop
  does, because their frame waits take NMIs on that stack.
- The frame wait 81:B0A1 runs lifted for the lag-free frame model below the
  original's JSL frame (return word CC5F), as in the room entry; with recorded
  interrupt observations the register-level wait runs through its frame.
- The forced blank 81:B0BD and the game screen set-up 80:9629 wait for nothing;
  their frames (JSL and JSR return words) are not reproduced. The room entry runs
  below the return word of the original's JSR (CC92), as the waits inside it take
  NMIs on that stack.
- The request is read again after the frame wait, as the original's second load
  does. The decker's health byte is stored long and indexed (7E:0002 plus the
  record word), so a record near FFFF reaches into bank 7F, as in the original.
- Not produced (as in [MATRIX-LIFT.md](MATRIX-LIFT.md)): the registers the
  original leaves besides the carry (A holds FFFF on the empty request, X the
  argument or the decker's record before the game screen set-up), and the 8-bit
  accumulator around the health store.
- The main loop's continuation (`MainLoopContinuation`, src/vm/main-loop.mjs)
  finds a callee's continuation by its target, or by its run function for a proof
  reference, as `NativeCallContinuation` does, so the reference request also
  resumes across frames.

## Tests

[tools/scene-request-lift.test.mjs](../tools/scene-request-lift.test.mjs) compares
the lifted request with the reference request, game screen set-up and room entry
(all register-level through their frames) in three live sessions: the matrix
sessions of tools/live-matrix-plan.mjs, the cutscene sessions of
tools/live-cutscene-plan.mjs, and three room changes only (7FFF) from the
apartment save into the debug room entry D2, back to entry 159 and into room 3.
Every NMI is equal. A planted difference (the decker's health byte flipped in its
lowest bit) fails the matrix session. The empty request runs in every main loop
pass of all sessions. [tools/lift-compare.mjs](../tools/lift-compare.mjs) now also
swaps references into the routine tables of src/vm (the main loop's).

The room entry's matrix session moved here from tools/room-entry-lift.test.mjs:
the lifted request calls the lifted entry directly, so only a reference request
reaches the reference entry.

[tools/main-loop-motion.test.mjs](../tools/main-loop-motion.test.mjs),
[tools/main-transition.test.mjs](../tools/main-transition.test.mjs),
[tools/main-initialize.test.mjs](../tools/main-initialize.test.mjs) and
[tools/main-loop.test.mjs](../tools/main-loop.test.mjs) keep proving the reference
against the ROM, alone and inside the main loop.
