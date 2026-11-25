# Window caller composition

The live window chain uses lag-free frames. Recorded observations retain the
former caller composition independently in [proof/caller/window-list.mjs](../proof/caller/window-list.mjs)
and [proof/caller/window-release.mjs](../proof/caller/window-release.mjs).
The original equations and hardware contracts remain in
[ROOM-ENTRY-LIFT.md](ROOM-ENTRY-LIFT.md). This work changes caller composition;
it introduces no new hardware effects or timing assumptions.

## State model composition (2026-11-21)

Drawing/resetting the window list, requesting its map upload, opening a window
and clearing its text tiles now compose directly without internal CPU call frames
or temporary banks. Window, notice and glove-name releases use the same graph.
Redraw consumers no longer pass original call-site addresses. The glove cleanup
entry composes name release directly and consumes only its caller's outer RTS.
Other RTS/RTL entry wrappers remain for native and frozen comparison callers.

[window-lifecycle-flow.test.mjs](../tools/window-lifecycle-flow.test.mjs) checks
every CPU register and stack byte at single-step boundaries and serviced waits,
zero budgets, request-word wrap, single servicing and repeated completion. Tile
and map failures preserve the caller context and reject replay. Existing isolated
comparisons still check drawing, allocation, release, device writes and upload
payloads. Relocated CPU stacks are excluded explicitly; glove preparation tests
still assert the retained enclosing caller words at their new stack offsets.

Text rendering and glove list preparation retain their own compatibility entry
frames. The dated delivery phases below record the earlier separation from
recorded observations; the current batch cadence is defined in
[STATE-MODEL-REBUILD.md](STATE-MODEL-REBUILD.md).

## Delivery phases

1. Window list and map upload: separate recorded observations from live drawing,
   reset and upload waits. Retain existing register and NMI interfaces.
2. Window release: separate the live release, glove name and notice paths from
   recorded observations, keeping their independent reference callers.
3. Window opening: separate the live tile-clear and map-upload sequence from
   recorded observations and retain the previous opening for comparisons.
4. Menu selection: compose the live frame, input and sound calls directly,
   keeping the former menu caller and its helper injection in proof.

These historical phases each had their own release check, handoff, commit and push.

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
transition-caller.test.mjs (removed) retains the
room/cutscene/matrix comparisons with real NMIs, devices and sound, and
script-native-lift.test.mjs (removed) retains the
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

## Phase 3: window opening (2026-11-15)

[window-open.mjs](../src/game/window-open.mjs) requests tile clearing and map
upload directly, always through the live waits. It no longer imports a tile
routine table or selects recorded observations. The previous opening and
standalone tile-clear entry remain in
[proof/caller/window-open.mjs](../proof/caller/window-open.mjs), importing the
retained list rather than the live upload implementation.

Four additional isolated comparisons cover opening and standalone tile clearing
at budgets one and seven, using 40 states and the three request counter words.
Opening states include a full window table, map-edge clamps, zero/negative
positions and tile allocation near its wrap. The product device supplies the
known dimensions' product on both sides; this tests composition, not multiplier
hardware. Each upload payload, device write and final game state is compared.
The existing 800 opening samples against the register-level original and the
dialog/menu integration comparisons retain their separate hardware coverage.

The recorded random menu comparisons also retain their former caller in
[proof/caller/menu-choice.mjs](../proof/caller/menu-choice.mjs), which imports the
retained tile-clear entry. Its four recorded menu variants continue to compare
against the register-level original. Live menu caller simplification follows in
phase 4; recorded polls no longer pass through live tile clearing.

## Phase 4: menu controls (2026-11-16)

[menu-choice.mjs](../src/game/menu-choice.mjs) composes its frame wait, input and
confirmation sound directly. The caller now supplies only the text-buffer
renderer through the existing table. The main loop and menus share the unchanged
live frame/input entries in
[live-input-calls.mjs](../src/system/live-input-calls.mjs); main-upkeep re-exports
the register entry points for existing consumers. No input, sound, save or frame
policy changes. Other caller tables and register/NMI interfaces remain.

[menu-caller.test.mjs](../tools/menu-caller.test.mjs) compares all four live menu
variants against the retained dispatched caller, at budgets one and seven:
navigation and held-button repeat followed by confirmation or cancellation, and
hotkey confirmation. The direct side receives a table containing only the text
buffer helper. Page-crossing tile requests, decoded texts, sound/device writes,
the input consumed, results and game state must match. The text-buffer renderer
is a stand-in; waits are serviced at their blocking branches. The test asserts
actual page crossing and immediate hotkey return. Zero budget changes no memory.
The existing recorded random menu comparisons remain against the original, and
the room/transition, dialog and script-native comparisons retain real NMIs and
devices. The isolated tests exclude CPU stacks and saved interrupt registers;
they continue to compare direct-page bytes.

The four caller delivery groups are complete. Remaining work includes text
rendering and its helper interfaces, further caller tables and eventually the
shared register/NMI boundary. Shape editing and S-MIX remain deferred.
