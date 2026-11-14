# Room entry lift

The room entry 80:A4BF, which the room start, the scene return of the main loop
(80:CC90) and the zone exits (80:80AD) call, is lifted from register-level 65816
equations to plain code, after the game screen set-up
([GAME-SCREEN-LIFT.md](GAME-SCREEN-LIFT.md)); method in
[MATRIX-LIFT.md](MATRIX-LIFT.md). The register-level version stays as reference
in [proof/game-reference/room-entry.mjs](../proof/game-reference/room-entry.mjs)
(`ROOM_ENTRY_REFERENCE_ENTRIES`, `withRoomEntryReference`).

## Modules

| Module                                                   | Content                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [room-entry.mjs](../src/game/room-entry.mjs)             | `enterRoomSequence` (80:A4BF) with the room banks 80:A44D, the brightness fade 81:B0AC, the forced blank 81:B0BD, the camera start 80:A464, the palette request 81:8D05, the fight list 80:8511, the formation trail 80:BABB and the room lists.                                                |
| [room-actors.mjs](../src/game/room-actors.mjs)           | The group 80:A2FA and the room's actors 80:A3B6 as sequences; the group calls the lifted turn.                                                                                                                                                                                                  |
| [object-create.mjs](../src/game/object-create.mjs)       | The object creation 80:A835 with the script task append 80:C34A, the task frame allocation 80:C2C8 and the heap 80:C242; the script VM and the other callers keep the register-level versions.                                                                                                  |
| [camera-scroll.mjs](../src/game/camera-scroll.mjs)       | The tile buffers 81:8A91 and the map edges 81:8954 of the camera jump; the main loop and the game NMI keep the register-level versions.                                                                                                                                                         |
| [object-turn.mjs](../src/game/object-turn.mjs)           | The turn 80:AAAF with the animation selection 80:A985 as the turn calls it; the other callers keep the register-level versions in src/task/native-object-turn.mjs.                                                                                                                              |
| [camera-box.mjs](../src/game/camera-box.mjs)             | The camera box clamp 81:8A05, which the camera start calls; the main loop camera 81:8C2E still calls the register-level version.                                                                                                                                                                |
| [collision-grid.mjs](../src/game/collision-grid.mjs)     | The static collision grid 81:8756 with 81:83FB, 81:840E, 81:84CF, 81:84DE and 81:8701: the boxes of the scene objects and the room lists, linked into the 16 x 16 cells.                                                                                                                        |
| [scene-tiles.mjs](../src/game/scene-tiles.mjs)           | The scene tiles 81:9AE6 with the tile cache 81:A1BC, 81:A1E1, 81:A243 and the overlay 81:9490: each tile stack entry composed and written to VRAM from word address 1000; the unpacker 80:9E7E runs through its frame.                                                                          |
| [scene-load.mjs](../src/game/scene-load.mjs)             | The scene load 81:A117 with the shapes 81:8DE2-8DC0, the tile stack interning 81:8E57 and resets 81:8FC2/8FF0, the clears 81:9022/902D, the grid blocks 81:8EDF with 81:8CE0/801A, the wall tiles 81:940A and the layer stacks 81:903E.                                                         |
| [window-list.mjs](../src/game/window-list.mjs)           | The window list 81:AD92 with the window drawing 81:ACCF and the upload request 81:ACB5 with its wait 81:ACAF, in bank 81 below its JSL frame; the window map 81:A9B2 comes from game-screen.mjs. The glove and runner menus keep the register-level list in src/task/native-render-compose.mjs. |
| [unpack.mjs](../src/system/unpack.mjs)                   | The long entries of the unpacker (`unpackLong`): 80:9F49 into bank 7E with the language's stream, 80:9E7E with 128 bytes, 80:9F69 (80:9F6D) into bank 7F; each leaves the direct page fields 7E:00DB-00F2 as the original.                                                                      |
| [window-release.mjs](../src/game/window-release.mjs)     | The glove 80:BCB2 with the name window release 80:BE5B and the notice windows 80:FF79, both through the window release 80:FA3E, which redraws the lifted window list; the other callers keep the register-level versions.                                                                       |
| [game-screen.mjs](../src/game/game-screen.mjs)           | The task scheduler reset 80:C1A6, the object slots 81:A772 and the window map 81:A9B2 with Jake's state bar 81:AF1F, exported for the entry and the window list.                                                                                                                                |
| [main-transition.mjs](../src/task/main-transition.mjs)   | The table entry `enterRoom` (80:A4BF, the room in A) for register-level callers, and the register-level callees, which other callers still use.                                                                                                                                                 |
| [game-start.mjs](../src/game/game-start.mjs)             | The room start 80:9699 calls `enterRoomSequence` directly.                                                                                                                                                                                                                                      |
| [room-entry.mjs](../proof/game-reference/room-entry.mjs) | The register-level 80:A4BF (`enterRoomReference`), moved from main-transition.mjs.                                                                                                                                                                                                              |

## Boundaries

- Every callee of the entry is lifted. The scene load, the camera jump and the
  window list wait over frames, so the entry is a sequence for a native call
  continuation. Register-level versions remain only where recorded interrupts must
  be replayed (below).
- The unpackers 80:9F69 (scene record into bank 7F), 80:9E7E (tile streams, 128
  bytes) and 80:9F49 (window map, through 81:A9B2) run lifted
  ([unpack.mjs](../src/system/unpack.mjs), `unpackLong`). They leave the direct
  page fields 00DB to 00F2 as the original: the limit, start, cursor, source
  pointer and bank word (Y as passed, the whole word: 01F4 for the window map), bit
  stream and literal offsets, output count, the last run (a reference's gamma value
  plus one), the literal words left (always 0), the bits left and the bit buffer.
  Later game code reads none of them, but the Mesen oracle compares the direct page.
  9F49 and 9E7E read the translation of a stream, as their register-level versions
  (the pointer and the whole bank word are then replaced); 9F6D reads the stream as
  it is. Not reproduced: their stack frames (the JSL and JSR return words, PHP and
  PHB bytes, the pushed limit and the bit routine's pushed A), which lie below the
  caller and are overwritten before anything reads them.
- The window map 81:A9B2 is the lifted one of the game screen, with Jake's state bar
  81:AF1F; its frames are not reproduced (it waits for nothing). The Mesen cold boot
  replay, which records interrupts inside the unpacker, keeps the register-level
  map through its frame. The list leaves Y as the original map does (the Mesen oracle
  compares it later in the main loop): the remainder word of the state bar when the
  bar is drawn, otherwise the unpacker's, the literal offset after a final literal run
  or the cursor after a final reference. A drawn window replaces it with the map
  offset of its bottom right border cell (the last window drawn), as the original
  81:ACCF leaves it, and the loop over the windows ends with X past the last window
  and the carry set, with which the upload wait takes its NMI (both found with the
  notice time limits, MAIN-LOOP-LIFT.md: the Mesen cold boot replay compares the
  registers at that NMI).
- The upload request 81:ACB5 counts the text map upload word 01F8 up and waits in
  81:ACAF until the NMI clears it. With the lag-free frame model it runs lifted below
  the original's JSL frames (ADB5 in the list, ACB8 in the request), with the request
  word in A and the NMI delivered at the branch 81:ACB2 in 16-bit mode with Z clear
  and N from bit 15, as the original. With recorded interrupt observations (the
  Mesen replays, the function tests) the register-level request runs through its
  frame.
- The frame wait 81:B0A1 (twice: after the scene load and in the camera jump) is
  lifted in [frame-wait.mjs](../src/system/frame-wait.mjs) (`waitForCounterWord`)
  for the lag-free frame model, as the matrix, cutscene, title and intro waits:
  it waits until the NMI changes the counter word 7E:1C76. The entry runs it below
  the original's JSL frame in bank 81 (return words A522 and 8BDF), with the
  counter in A and the NMI delivered at the branch 81:B0A9 with the compare equal
  in 16-bit mode, as the original. With recorded interrupt observations (the Mesen
  replays, the function tests) the register-level wait runs through its frame.
- The glove and the notice windows push the return words of their JSRs (A4E3,
  A52A, BCBC, BE62, FF87) and the notice slot index around each release, as the
  original: each release redraws the window list, whose upload request waits for an
  NMI below them. The window indices are game-sized, so the window tables are read
  in bank 7E.
- The camera jump 81:8BD9 is part of room-entry.mjs. It runs in bank 81 below its
  JSL frame, as the original, with the camera box word and the step count pushed
  around its calls: its frame wait takes an NMI, which writes onto that stack.
  Its tile buffers 81:8A91 and map edges 81:8954 (camera-scroll.mjs) wait for
  nothing, so their frames (the JSL return words and the data bank bytes 8A91
  pushes) are not reproduced. They write the direct page words 0E to 20 as the
  original; with the clamped camera positions none of the original's additions
  carries. The map edges read the upload words in bank 7E below 2000, as the
  original's data bank 80 does, and set the DMA channel 3 address, length and
  start only; its mode, B-bus register and source bank come from the game screen.
- The scene load, the scene tiles, the camera jump, the collision grid and the
  window map run lifted except in the Mesen cold
  boot replay (`events.startupInterrupts`, tools/mesen-boot-prefix.mjs): it
  records interrupts inside them (81:9B17, 81:9CFA, 81:9D10, 81:9F4F, 81:A1FC,
  81:A21D, 81:842A), which only the register-level versions replay, so the entry
  then calls 81:A117, 81:9AE6, 81:8BD9 and 81:8756 (and the window list 81:A9B2)
  through their frames (as the matrix keeps
  its register-level frame wait with recorded interrupts, MATRIX-LIFT.md). The
  grid writes its direct page locals (A0, 0E-10, 11, 14, 17, 1A, 1D, 20, 3E-47,
  5C, 5F, 6B) as the original; it reproduces no stack residue of its inner calls.
  The scene load runs in bank 81 with data bank 7E below its JSL frame and data
  bank byte, as the original, for the callees it still calls through frames, and
  writes the original's direct page words (0E-20, 23-5F, 62, 65, 68, 6B, 77-79, A2) and the graphic depth mode 0D14. The scene palette reset 81:8CB9 is the lifted one of the game screen; with the data bank 7E of the scene load its DMA channel set-up writes WRAM 7E:4340 and 7E:4341 instead of the hardware, as in the original. The scene tiles write theirs too (26, 7A, 7C, 7E, 80 and the quarter offset
  0D16). The cache list keeps the original's layout: the word before the keys is
  the last entry's link. A list without end, which only a damaged cache gives and
  on which the original loops forever, stops at `tile_cache_end_required`.
- The object creation keeps the original's stack: the return words of its JSL
  (A8EE) and JSRs (C368, C34C, C2F7) and the next word the heap pushes while it
  splits a block. It writes the direct page words 00, 02 and 71 to 75 as the
  original. The object, task and heap tables and the frames are game-sized and lie
  in bank 7E below 2000, where the original's data bank 80 reads them; the
  argument copy reads the direct page words through 80:FFFE plus the count, as the
  original. A full heap or no free task slot, after which the original writes
  through a meaningless frame or slot, stops at the frontiers `task_heap_required`
  and `task_slot_required`; an odd count of argument bytes (no actor's script has
  one; the copy never ends) at `script_arguments_required`.
- The turn keeps the return words of its JSR (A342) and of its JSR to the selection
  (AADC) on the stack, as the original. It writes the direct page words of the
  original: the frame pointer 08 and its bank word 0A, and on the selection path
  the list entry 00, the record 04 and the bank words 02, 06 and 0A. The records
  lie in bank 8C; a pointer into 2000-7FFF that hits no register reads the open
  bus (the bank byte, as native-object-turn.mjs records from Mesen), which only a
  damaged object reaches. Its data bank 80 fields lie in bank 7E below 2000 for
  the game's slots; a slot past them stops at `object_slot_required`. Not
  visible and left out: the original's set of the selection to none before the
  selection replaces it, the selection's check for an unchanged one and the bit
  its doubling shifts out (the turn clears bit 15).
- The group and the actors pass their arguments to the object creation and the
  turn in the direct page words 00 to 08 and read the new slot back from word
  00 after each call, as the original (the turn's selection path writes word 00
  too; for a slot fresh from the creation it does not run). Only a creation that
  found no free slot (the entry frees all before) leaves the kind as the slot; when
  the turn then takes the selection path, the slot read back is a list pointer whose
  fields the original reaches in ROM through its data bank 80, and the group stops
  at the frontier `object_slot_required`. The group's search for
  the runner row of a member goes on as the original's index wraps when the number
  is no runner (only a loaded foreign save holds one), and stops at the frontier
  `group_runner_required` after every index. The direct page words the original
  uses as locals (the member index 26, the actor flags 20, record 23 and the
  actors left 29, and the clamp's words 3E to 4A) are written as in the original:
  the Mesen oracle (tools/mesen-oracle.test.mjs, leaving the morgue) compares them.
- The entry writes the direct page words those callees and later game code read,
  as in the original: the header pointer 86-88, the list banks 9C, 9F, F5 and FE,
  the start direction and position 11, 14, 17 and 1A, the camera words 0E and 11,
  and the point and sight lists F3 and FC. The caller's direct page is 0.
- The original's quirks are kept: room \* 9 is formed as room \* 8 + room with
  the carry of the last shift (bit 13 of the room); the camera row subtracts one
  more when the start x exceeds 0488; the formation trail clears only the first
  X and Y words; the music branch starts mode 0 when the option to keep the music
  is off.
- The stack below the callees is as in the original: the table offset pushed
  (PHX) from the fade out to the object slots, the return words A54D and A550 of
  the JSRs to the group and the actors, and the words they push around the object
  creation (the member's kind; the header offset and the actor). The lifted camera
  box clamp calls nothing, so its frame is not reproduced. The Mesen cold boot oracle
  (tools/mesen-boot-prefix.test.mjs) compares the stack pointer at the NMIs that
  interrupt the scene load. Not produced: the registers the entry leaves (X is
  the table offset up to the object slots, as in the original).
- The proof and replay references (`withGameStartReference` in
  proof/game-reference/game-start.mjs and `FRONTEND_REFERENCE_ENTRIES` in
  proof/frontend-reference/frontend.mjs) include the reference entry, so the
  Mesen oracles and the connected boot replay keep comparing original
  instructions.
- The music stop 81:EF94 (no music in 1CDE, the volume target command with 0) and
  the music change 81:EF47 (src/apu/music-mode.mjs) run lifted with the lag-free
  frame model, which delivers no NMI in their sound driver handshakes. A recorded
  game run (tools/frame-events.test.mjs, tools/live-game-over.test.mjs) can deliver
  one there, which only the register-level versions replay, so with recorded
  interrupt observations they still run through their frames (call sites 80:A506
  and 80:A580); [AUDIO-ROUTINES-LIFT.md](AUDIO-ROUTINES-LIFT.md) keeps EF47 in the
  table for this caller. The entry decides, as the original, whether to call them
  and with which mode.
- The zone exit 80:8000 (src/task/main-zone-gate.mjs) takes the A4BF entry from
  its gate routines (`a4bf`, a routine table entry), so the proofs can put the
  reference in.

## What is compared

[tools/room-entry-lift-functions.test.mjs](../tools/room-entry-lift-functions.test.mjs)
runs 80:A4BF against the reference on 200 random states with the game's stack
(7E:1EF0), with the unpacker's direct page state 00DB to 00F2 compared: rooms of the table and any word (which reads past the table and so
reaches the carry of room \* 9 and the camera row borrow), both music branches.
The routines called through their frames are stubs that record each call with
its return address, data bank and inputs (A for the scene load). The object
creation and the turn run for real on both sides: object
slots half free or only one (often the first), a draw list of up to 20 objects,
a heap of random free and used blocks over the game's 07CC bytes, task slots
mostly free (rarely none) and a task list head; at most 10 % of the samples stop
at the heap or slot frontier. It is also compared alone (400 samples, any kind,
any script of the table or none) with the stack: 20 planted differences fail it
(the merge size and link, the split bound, size and pushed word, the data
address, the argument copy, the operand stack, the script pointer and PC, the
wait word, the list head check, the kind carry, the diagonal, the frame repeats,
the three return words, the JSL bank, kind times two in word 02, the first slot).
Not visible: the carry of the header counts, as no script's two counts exceed
2C. Groups of up to four
runners with and without Jake's figure and dermal armour, story stages of zero
and any value, and camera boxes in bank 7F with any limits are drawn. WRAM
outside the scratch, device writes and the calls must be equal. The camera box
clamp (400 samples), the group (300) and the actors (400, on a synthetic header
with up to eight actors of the whole table, the only actor with zero flags
often) and the collision grid (300, two synthetic object lists with objects of
every type, flipped or without boxes, and three room lists) and the scene tiles (60, tile stacks of 80 real streams,
any tile, either flip, up to two overlays) are also compared alone, with the
direct page locals; so is the scene load (330 random scenes). The room entry
runs the real scene load, grid, tiles, camera jump steps and window list on
both sides (the window map of window style 0, up to eight game-sized windows and
one recorded poll of the upload wait), and the frame wait stub records the three stack words
below its return. Planted differences (the fade frames, the list
offset, the kept music, the camera box, the formation trail, the camera limits,
the room carry, the camera borrow; the clamp's maximum and position, the depth
order bits, the holder and story stage checks, the dermal armour, the class
bits, the player figure, the actor height bits, the room list start, the
pushed header offset; 14 in the grid: the column and row ends, the signed start,
the flipped axes, the data word, the script list, the object and height checks,
the counters, the definition bank, the part offset and the height shift; 10 in
the tiles: the bit reversal, the row swap, the flipped row order, the overlay
mask, the third overlay, the free-list link, the empty tile words, the VRAM
byte order, the stack entry and the quarter offset; 6 in the camera jump: the
direction, the step sign, the camera box, the upload hold, the frame's bank
and the step count) fail it. 38 in the scene load fail it but eight, each unreachable with the game's scenes or equivalent: a cell bound that only odd cells reach, a rectangle starting exactly at grid offset 80, the sign of a layer row above the top, a column above FF, a negative object height, a palette branch the height loop already took, and two scratch words overwritten later. 8 in the window list (borders, the tile count, its wrap, the first index, the
last window, the window word, the columns) fail it. The glove and the notice
windows release real windows on both sides (a glove target or none, used and free
notice slots, the last window often among them; one recorded upload poll per
redraw); 8 planted differences fail it (the next tile, the new last index, the
active word, the freed slot, the first index, the glove target and kind, the first
slot). Alone, with the stack from the upload wait's frame (1EE2) up compared (below
it lies the residue of the register-level window map, the low byte A9DE of its JSL
to the state bar at 1EE1, and of the window drawing 81:ACCF, whose frames the lifted
list does not reproduce), 6 more fail them: the pushed slot index, the return words
of the four JSRs and the JSL, and the window argument. 6 planted differences in the
unpacker's direct page state fail the room entry, the scene load, the scene tiles or
the releases: the last run, a reference's run, the bits left, the bit stream offset,
the literal words and the bank word's high byte (the window map passes the whole
word 01F4). The turn is compared alone (500 samples) with the stack: game slots (sometimes
odd or past the slots), directions or any word, kinds of the action table or any
word, short animations (or 0 or 80 frames) on a real record's direction offsets or
any frame count, selections of the kind's list, none or any word; 19 planted
differences fail it (the unchanged direction, the frame count bounds, no
selection, bit 15, the return word, the bank word 0A, the old direction's offset,
the open bus, the sum's carry, the loop flag, the signed box, the frame repeats,
the entry word, the bank words, the new direction's offset, the box height, the
picture change, the kind's wrap). The group alone mostly has four free slots or
more. The tile buffers (400 samples) and the map edges (300) are compared alone too:
camera positions in range, on the limits or any word, speeds of the jump and the
main loop camera or any word, often a step that lands exactly on a limit, marked
and unmarked edges; 17 planted differences fail them (the column and row lead,
the copy starts and their wrap, the row copy's end word, the limit check, the
stopped speed, the old row step, the row VRAM shift, the DMA increment and second
address, the scroll shift and high byte, the cleared mark). Not visible to it
either: the jump's forced blank (the
entry blanked the screen already) and the pushed step word (free stack).

[tools/room-entry-lift.test.mjs](../tools/room-entry-lift.test.mjs) runs the
title cycle sessions 2, 3 and 4 (a new game, a saved game, the attract game; the
reference side also runs the register-level start of a game) and the matrix
sessions (each return enters the room through the main loop; since moved to
[tools/scene-request-lift.test.mjs](../tools/scene-request-lift.test.mjs)); every NMI must be
equal. A planted difference (the fade frames) fails all four. The lifted frame wait, upload
wait and music run there: a wrong branch address hangs the delivery; an upload
request that does not wait for the NMI and another music mode fail all four.
Not visible to the sessions: the accumulator, the JSL return word and the 16-bit
status the wait leaves at the NMI: the handler saves them on the stack, which lies
at 0137 to 0138 there, inside the scratch 0100 to 01CA that the comparison leaves
out.

[tools/game-start-lift-functions.test.mjs](../tools/game-start-lift-functions.test.mjs)
now runs the room start with the reference entry and stubs for its frame callees.

[tools/main-transition.test.mjs](../tools/main-transition.test.mjs) keeps
proving the reference against the ROM, alone and inside its callers 80:8000 and
80:CC4B. The scene request 80:CC4B is lifted too and calls the lifted entry
directly ([SCENE-REQUEST-LIFT.md](SCENE-REQUEST-LIFT.md)); the session after the
matrix moved to its test.
