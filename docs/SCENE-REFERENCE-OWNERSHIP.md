# Scene reference ownership

The live start calls `gameStartSequence` directly. It does not own a helper
address table. The former tables remain independently in
[the caller](../proof/caller/main-start.mjs) and
[the replay](../proof/replay/main-start.mjs).

The consumer inventory starts at `FRONTEND_ROUTINES`, passed to `LiveDevices`
as interrupt bindings. The former start spread reaches the transition table;
the frontend text spread reaches the same table through the scene table.
Transitions then include scene graphics, collision and scene loading, whose
layer helpers form a cycle with the loader. These imports alone do not mean
that the live game dispatches those routines: room entry, scene loading,
collision and tile uploads already have direct game implementations.

Removal proceeds from consumers toward dependencies. Each remaining live
consumer must retain its required callbacks or get a direct implementation
before its reference moves. Register-level originals and former caller
compositions stay available for independent comparisons. Source windows,
recorded observations, scratch masks and hardware assumptions do not change.

[Owner caller tests](../tools/main-owner-caller.test.mjs) compare actual starts,
owner returns, reloads and main-loop entry with the retained dispatched callers.
Existing source and scene comparisons continue to own their original evidence.
Moving a reference creates no new hardware, route or timing evidence.

The frontend NMI table binds the start-menu callback directly. It no longer
includes settings helper entries. Their byte-for-byte
equations and frontend call helpers already remain in
[the replay frontend helpers](../proof/replay/main-frontend-text.mjs), so the
unused duplicate game module is removed rather than copied again.
The live start menu still calls the save-slot checksum through a fixed helper;
the frontend table therefore binds that helper explicitly.

The actual interrupt consumer is `LiveDevices.interruptRoutines`, handed to
the NMI dispatcher in `nmi-call.mjs`. Its admitted callback set consists of
the matrix, title objects, intro, cutscene, game, start menu, title prologue,
title pan, title scroll and boot-screen return. A callback may still require
its own internal helper table for recorded observations. Such dependencies
must stay explicit; the broader start, room and scene entry tables are not
part of the callback interface.

The live frontend now composes its interrupt bindings from the intro and game
NMI helpers plus the actual matrix, cutscene, menu and title callbacks. It does
not spread the scene entry table. The former live frontend uses its independent
replay NMI table, preserving helper dependencies for dispatched caller tests.

The register entry adapters and their broad helper table now live in
[scene-entries.mjs](../proof/caller/scene-entries.mjs). The game invokes the actual
cutscene, intro and matrix sequences directly. Existing entry fixture and original
frame comparisons still use those same adapters to call the actual game sequences;
their physical frames and observation handling have not changed.

The menu credits were a remaining live consumer of the scene table: their fixed
cutscene and music-stop calls now compose directly through the same long frames.
The stop still marks the music absent, sends volume target zero and preserves
the nested sound-command frame. The former title cycle remains independent in
`proof/frontend-caller/title-cycle.mjs` for the owner comparisons.

The upkeep helper table and the register-level random routines became unreachable
from the game after removing the scene spread. They now live in `proof/caller/`
and `proof/replay/`; the game keeps its existing lifted random equations.

The register-level game NMI owns its map-edge uploader (81:8954) itself; the
transition module imports it from there for its own routine table. The routine
body, its port-write PCs and its unpack step are unchanged. With that last live
import gone, the transition, scene graphics, collision, loading, layer and loop
camera references, the dialog routine table and the status flags were no longer
loaded by the game. They now live in `proof/system/` and `proof/script/`;
their callers and original comparisons import them from there unchanged.
The register-level text upload 81:A9E1 lives in
[main-text-upload.mjs](../proof/system/main-text-upload.mjs), shared by the
register-level game NMI and initialization references. The instant text option
runs the lifted job of `src/game/game-nmi.mjs` instead, which the existing
lift comparisons check against the reference. The reference's port-write PCs,
chunking and observed channel-5 readback are unchanged. The scene initialization routines (font, window styles, object and
palette resets) were then no longer loaded by the game and moved to
`proof/system/main-initialize.mjs`.

The live game always runs lag-free frames, so its frontend interrupt table now
binds the lifted game NMI jobs of `src/game/game-nmi.mjs` directly. The
composition that falls back to the register-level jobs in recorded runs moved
to [game-nmi-jobs.mjs](../proof/replay/game-nmi-jobs.mjs), together with the
handler's recorded joypad-wait continuation. The register-level game NMI was
then no longer loaded by the game and moved to
`proof/system/main-game-nmi.mjs`; its comparisons are unchanged.

The live intro NMI table likewise binds only the lifted title-object and intro
callbacks (81:DAD6, 81:DF0E). The register-level helpers that recorded runs and
the register-level reference loop reach through the interrupt table (81:D9D5,
81:ED8B, 81:EDD7, 81:EE0C, 80:F290, 81:F007) are composed in
[intro-nmi-routines.mjs](../proof/replay/intro-nmi-routines.mjs). The reference
loop (`proof/script/register-level-loop.mjs`) builds its own interrupt devices
on the same lag-free frames with those helpers added, so the shared live
interrupt table is not mutated.

The register-level scene video routines (81:EB7B to 81:F2A4: NMI enables, screen
registers, OAM, VRAM clear, register reset, palette copy, scene list interpreter
and bank-81 unpack entries) were reached by the game only for three reset
constants. Those constants now live in `src/system/main-reset.mjs`, their live
user, and the routines moved to `proof/system/main-scene-video.mjs`; the lifted
versions remain in `src/system/nmi.mjs`, `src/system/scene-list.mjs` and
`src/video/scene-screen.mjs`.

The register-level dialog portrait routines (fixed colour clear 81:886A, text
width 80:FA92, row shift 80:8F20, portrait uploads 80:9022 and 80:905E, window
edges, open and close 80:8EFE to 80:8F97) and their private tables moved to
`proof/system/native-dialog-portrait.mjs`. The game runs their lifted versions;
the live module keeps only the waits, unpacking, tile upload, glove release
and the constants that lifted code shares.

The register-level text prerequisites (bit read, geometry, mask close and text
waits) and their private constants moved to
`proof/system/native-text-prerequisites.mjs`. The live module keeps only the
task text accessor that the lifted unpack, render and APU helpers share.

The register-level leaf helpers for object record fields, actor state and kind,
and kind values moved to `proof/system/native-leaf-support.mjs`; the live module
keeps the shared leaf frame, argument and result helpers.

The register-level object turn natives (80:A985, 80:AAAF, 80:D15C and their
selection support) moved to `proof/script/native-object-turn.mjs`. The game
binds only the lifted 80:D15C adapter, now in
`src/script/native-object-action-direction.mjs`.

The register-level scene sprite helpers (direct page and field access, occlusion
grid direct page, visible area and high bit table) moved to
`proof/script/native-sprite-helpers.mjs`. The OAM buffer offset word they share
with the lifted sprite list is now defined in `src/game/sprite-list.mjs` and
re-exported by the reference.

The live owner takes the start address from `src/game/game-start.mjs` directly.
The register-level start entry (`runMainStart`, `mainStartContinuation`) moved
to `proof/system/main-start.mjs` for the owner caller tests. The unused src
copies of `runMainLoop` and `drawWindowListJslSequence` were removed; their
callers already use the independent versions in `proof/caller/`.

The run wrappers of the main start, new game state and save load for register-level
routine tables moved to `proof/caller/game-start-runs.mjs`. The live title cycle
keeps its new-game wrapper in `src/game/game-start.mjs`.

The register-level APU command 81:F007 and sound pan natives moved to
`proof/system/native-input-apu.mjs`; the live module keeps the pad read and the
shared native return helper. The observed channel-5 text readback moved to
`proof/system/main-dma-readback.mjs`; live devices perform that transfer from the
PPU, and the live module keeps only the end-of-run observation check. Files whose
import paths grew during this batch were reformatted with Prettier.

The routine-table call sequences used only by register-level references (the
unlabelled call frame and the original tail jump) moved to
`proof/system/native-call-sequences.mjs`. The live continuation module keeps the
continuation class, the labelled call frame and the shared return offsets.

The register-level entries of the game's audio set-up 81:EF63 and the title pan
objects 81:D9D5 entered on their own moved to
`proof/caller/scene-routine-adapters.mjs`. They still call the live bodies, so
the routine tables of the scene references keep exercising the shipped code.

The register-level object tile reload 80:ADF4 with its direct page words and job
list increment moved to `proof/system/native-scene-tiles.mjs`; the live module
exports the frame bank, stream, picture banks, slot addresses and tile queue it
shares. The script opcode with its argument prefix and the argument reader moved
to `proof/system/script-yield.mjs` and `proof/system/script-arguments.mjs`.

The register-level LSR and CLC helpers of the swarm references and the glove
limit stores of 80:BC36 moved to `proof/game-reference/register-helpers.mjs`; the
game sets glove limits and bobs objects through its lifted code.

The register-level form of the default weapon correction moved to
`proof/game-reference/bugfixes.mjs` (the game applies the correction in
`src/game/runner-equipment.mjs`), and the nested-round interrupt extension of the
register-level drivers moved to `proof/vm/round-interrupts.mjs`. An unused empty
constant was removed from `src/vm/devices.mjs`.

The register-level portrait tile upload 80:8FF5 and the random-state frame wait
81:B0A1 of the dialog references moved to `proof/system/native-dialog-portrait.mjs`;
the game uploads portraits through `src/game/portrait-upload.mjs`. The live module
keeps the inline NMI waits, the portrait unpacker and the shared portrait constants.

The register-level glove release 80:BCB2 and name window release 80:BE5B with
their address-keyed continuations moved to `proof/system/native-glove-release.mjs`;
the game releases the glove and its name window through `src/game/window-release.mjs`.

With the glove release gone from the live portrait module, the register-level window
list 81:AD92, window drawing 81:ACCF, upload request 81:ACB5 and window release
80:FA3E had no live importer left. The module moved unchanged to
`proof/system/native-render-compose.mjs`, together with its address-keyed
continuations; the game draws and releases windows through `src/game/window-list.mjs`
and `src/game/window-release.mjs`. Source generator labels and documentation links
follow the new path.

The register-level random-state wait 81:B0A1 lost its last live importer with the
window module above and moved unchanged to `proof/system/native-frame-wait.mjs`; the
game waits for frames through `src/system/frame-wait.mjs`.

The register-level window map unpack 81:A9B2 served only the window module above,
the initialization reference and the A9B2 proof; it moved unchanged to
`proof/system/native-render-unpack.mjs`. The game unpacks the window map in
`src/game/game-screen.mjs`.

The register-level state bar 81:AF1F with its register helper moved unchanged to
`proof/script/native-bar-tiles.mjs`; only the window map reference and the action,
slot release and list redraw references call it. The game draws the bar through
`src/game/state-bar.mjs`.
