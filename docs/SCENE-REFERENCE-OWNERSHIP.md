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
