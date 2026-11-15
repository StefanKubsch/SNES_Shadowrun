# Window caller composition

The live window chain uses lag-free frames. Recorded observations retain the
former caller composition independently in [proof/caller/window-list.mjs](../proof/caller/window-list.mjs)
and [proof/caller/window-release.mjs](../proof/caller/window-release.mjs).
The original equations and hardware contracts remain in
[ROOM-ENTRY-LIFT.md](ROOM-ENTRY-LIFT.md). This work changes caller composition;
it introduces no new hardware effects or timing assumptions.

## Delivery phases

1. Window list and map upload: separate recorded observations from live drawing,
   reset and upload waits. Retain existing register and NMI interfaces.
2. Window release: separate the live release, glove name and notice paths from
   recorded observations, keeping their independent reference callers.
3. Window opening: separate the live tile-clear and map-upload sequence from
   recorded observations and retain the previous opening for comparisons.
4. Menu selection: compose the live frame, input and sound calls directly,
   keeping the former menu caller and its helper injection in proof.

Each phase has its own release check, handoff, commit and push.

## Phase 1: window list (2026-11-15)

[window-list.mjs](../src/game/window-list.mjs) unpacks the map directly and always
uses the live upload wait. It no longer imports a render routine table or selects
startup/recorded observations. Existing register callers still enter through
their JSL frame, and the shared continuation registry remains an interface.
Recorded drivers and function comparisons import the retained callers in proof;
the retained release also imports the retained list, so it cannot silently follow
future changes to live drawing.

[window-caller.test.mjs](../tools/window-caller.test.mjs) compares map upload,
drawing and list reset against the former composition on 40 deterministic window
states, with budgets one and seven and request words 0, FFFE and FFFF. The last
request wraps to zero without waiting. Zero budget has no memory effects. A
service stand-in captures the whole upload payload; it does not model an NMI.
[transition-caller.test.mjs](../tools/transition-caller.test.mjs) retains the
room/cutscene/matrix comparisons with real NMIs, devices and sound, and
[script-native-lift.test.mjs](../tools/script-native-lift.test.mjs) retains the
dialog and script-native comparisons. CPU stacks and saved interrupt registers
are excluded from the new isolated comparison; direct-page state is compared.

The existing random upkeep comparisons now service the live tile/map requests at
their blocking branches through `liveWindowEvents`; the reference still consumes
recorded polls. They continue to compare the real drawing, allocation and release
against the register-level reference, including their previous register assertions.

## Phase 2: window release (2026-11-15)

[window-release.mjs](../src/game/window-release.mjs) always redraws through the
live window list. Its JSR entry and continuation factory no longer select a
recorded reference. The glove name and notice paths retain their direct calls,
slot order, last-active-window search, tile allocation and upload waits.
Shared register-level dialog text and portrait helpers explicitly call the
register-level render release; they no longer enter a live wrapper to select
their recorded implementation. Their eventual lifting is a separate boundary.

The isolated comparison now includes seven release/name/glove/notice sequences,
with the same 40 states, two budgets and three request words. It covers releasing
the last window, holes and no-target glove states, with zero-budget memory
stability and comparisons of each upload payload and the final game state.
The retained release imports the retained list, independently of the live path.
