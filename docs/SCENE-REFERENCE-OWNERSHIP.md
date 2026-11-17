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
