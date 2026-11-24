# Scheduler service composition

The live main game and attract demo request a scheduler round by name. Dialog,
item and spell actions request a head visit by name. These callbacks take no
original entry address, caller context or CPU stack workspace. Their generators
and the native work budget retain pauses and results directly.

The original numeric round and head-visit callbacks remain compatibility
adapters for recorded comparisons. Their bank and entry checks, borrowed stack
workspace and missing-callback frontiers are retained. The live event interface
does not expose these address selectors.

Focused contracts reject CPU workspace access through the ordinary GameLoop
round/head methods and nested script-visit composition. They cover zero budgets,
pauses, completion, failures, reentry and restoration of the enclosing native work
budget. Existing attract, owner, dialog and task comparisons and the five golden
traces retain their state, video, audio, SRAM and device assertions.
The frozen task observer retains its memory guards and projection; the test
counts actual scheduler rounds independently of the callback name. The test-only
scheduler frame adapter explicitly replaces named callbacks with its numeric
return adapters before running frozen callers. No proof module is changed.

This completes the ordinary scheduler/native service boundary. Boot/reset and
recorded instruction adapters still retain explicit register contexts; phase 4
remains unfinished until those remaining control-flow dependencies are removed.
