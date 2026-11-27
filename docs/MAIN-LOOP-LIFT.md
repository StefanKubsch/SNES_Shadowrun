# Main loop lift

Note (2026-11-25): the register-level game loop (proof/vm/main-driver.mjs,
proof/script/register-level-loop.mjs), the address-dispatched owner and title cycle
(proof/frontend-caller/), the register-level startup and reset references and the
recorded Mesen boot replays were retired (user decision,
[STATE-MODEL-REBUILD.md](STATE-MODEL-REBUILD.md), Progress). The lockstep and lift
comparisons this document names (tools/game-loop.test.mjs, tools/lift-compare.mjs and
its tests, the owner and transition caller tests) went with them; the golden traces
are the reference. Where the text below names them, it describes the state before
that date.

Contract and evidence map for the main-loop lifts. Current work is maintained
in [PROJECT-STATUS.json](PROJECT-STATUS.json); active rebuild rules and remaining
phases are in [STATE-MODEL-REBUILD.md](STATE-MODEL-REBUILD.md). The earlier
routine-by-routine delivery log remains in Git history. Historical CPU-stack
comparisons describe reference coverage, not requirements for new game code.

## Direct live caller

The main loop 80:96AB–96F2 composes sixteen callees directly through
main-frame-adapter.mjs (removed). Synchronous entries
run as segments; zone gates, scene requests, notices, time limits, waits and
glove actions delegate to named sequences. The caller does not select them
through a ROM-address map. Work budgets and nested waits use the shared
NativeCallContinuation. Preserve the first pass, upkeep order, both carry
short circuits and exit-before-reload priority.

The live routine table holds NMI callbacks. Former caller and return-frame
bindings remain in [live-loop-routines.mjs](../proof/caller/live-loop-routines.mjs),
[jsr-forms.mjs](../tools/register-forms/jsr-forms.mjs) and
[input-routines.mjs](../tools/register-forms/input-routines.mjs).
proof/caller/main-loop.mjs (removed) preserves the former
live dispatch; `proof/vm/main-loop.mjs` (removed) preserves
instruction-based recorded replay. These references are frozen under the rebuild
rules.

Room initialization and window lifecycle now compose without internal CPU
frames. Deeper matrix, cutscene, text, glove-list and device call graphs still
need composition. Their compatibility workspace and outer return wrappers
remain until those callers have been converted. This document does not mark
phase 4 complete. See [SCENE-ENTRY-COMPOSITION.md](SCENE-ENTRY-COMPOSITION.md)
and the current rebuild plan for subsystem contracts.

## Lifted so far

This entry map retains implementation and compatibility names from the earlier
lift. The active phase-4 composition contracts supersede historical inner-frame
requirements. [NATIVE-MODULES.md](NATIVE-MODULES.md) maps the other script natives;
[SCRIPT-VM-LIFT.md](SCRIPT-VM-LIFT.md) describes their adapters.

- **81:8877**: [fixed-colour.mjs](../src/game/fixed-colour.mjs). `applyColourEffect` (table entry `runColourEffect` in proof/caller/live-loop-routines.mjs)
- **81:8076**: [palette-cycles.mjs](../src/game/palette-cycles.mjs). `advancePaletteCycles` (table entry `runPaletteCycles` in proof/caller/live-loop-routines.mjs)
- **80:DE94**: [player-hit.mjs](../src/game/player-hit.mjs). `shakeHitPlayer` (table entry `runHitShake` in proof/caller/live-loop-routines.mjs)
- **80:FF14**: [notice-timeout.mjs](../src/game/notice-timeout.mjs). `noticeTimeoutSequence` (RTS form `noticeTimeoutJsr` in tools/register-forms/jsr-forms.mjs)
- **80:BAD5**: [formation-trail.mjs](../src/game/formation-trail.mjs). `recordFormationStep` (table entry `runFormationStep` in proof/caller/live-loop-routines.mjs)
- **81:8C2E**: [camera-follow.mjs](../src/game/camera-follow.mjs). `followPlayerWithCamera` (table entry `runCameraFollow` in proof/caller/live-loop-routines.mjs)
- **81:8A91**: [camera-scroll.mjs](../src/game/camera-scroll.mjs). `updateTileBuffers` (table entry `runTileBuffers` in proof/caller/live-loop-routines.mjs), lifted with the room entry, now also called by the main loop.
- **80:E270**: [time-limit.mjs](../src/game/time-limit.mjs). `timeLimitSequence` (RTS form `timeLimitJsr` in tools/register-forms/jsr-forms.mjs)
- **80:BF3B**: [glove-action.mjs](../src/game/glove-action.mjs). `gloveActionSequence` (RTS form `gloveActionJsr` in tools/register-forms/jsr-forms.mjs)
- **81:B0A1**: [frame-wait.mjs](../src/system/frame-wait.mjs). `waitForCounterWord` (table entry `runFrameWait` in tools/register-forms/input-routines.mjs)
- **80:9E1A**: [joypad.mjs](../src/system/joypad.mjs). `takePadPresses` (table entry `runPadPresses` in tools/register-forms/input-routines.mjs)
- **80:BE6D**: [glove-move.mjs](../src/game/glove-move.mjs). `gloveMove` (RTS form `gloveMoveJsr` in tools/register-forms/jsr-forms.mjs; table entry `runGloveMove` in proof/caller/live-loop-routines.mjs)
- **80:8000**: [player-zones.mjs](../src/game/player-zones.mjs). `playerZonesSequence` (RTS form `playerZonesJsr` in tools/register-forms/jsr-forms.mjs; table entry `runPlayerZones` in proof/caller/live-loop-routines.mjs)
- **80:AFC4**: [object-motion.mjs](../src/game/object-motion.mjs). `moveAndAnimateInPlace` (RTS form `moveAndAnimateJsr` in tools/register-forms/jsr-forms.mjs)
- **80:AB26**: [object-move.mjs](../src/game/object-move.mjs). `moveObject`
- **80:C9E0**: [object-target.mjs](../src/game/object-target.mjs). `walkTowardsTarget`
- **80:80B2 to 80:82BC**: [object-collision.mjs](../src/game/object-collision.mjs). `upperXEdge`, `lowerXEdge`, `upperYEdge`, `lowerYEdge`, `heightCells` (register forms `searchUpperXEdge` and the others in tools/register-forms/object-collision.mjs)
- **80:B8DE**: [sprite-list.mjs](../src/game/sprite-list.mjs). `buildSpritesInPlace` (RTS form `buildSpritesJsr` in tools/register-forms/jsr-forms.mjs)
- **80:AFFC**: [depth-sort.mjs](../src/game/depth-sort.mjs). `sortDrawListInPlace` (RTS form `sortDrawListJsr` in tools/register-forms/jsr-forms.mjs)
- **80:AB0A, 81:A840**: [palette-slots.mjs](../src/game/palette-slots.mjs). `paletteSlotInPlace` (RTS form `paletteSlotJsr` in tools/register-forms/jsr-forms.mjs), `clearPaletteSlots` (in [game-screen.mjs](../src/game/game-screen.mjs))
- **80:BCBE**: [object-search.mjs](../src/game/object-search.mjs). `objectSearch` (RTS form `objectSearchJsr` in tools/register-forms/jsr-forms.mjs)
- **80:C34A**: [task-append.mjs](../src/game/task-append.mjs). `appendScriptTask`, `appendTask`, `appendScriptReturn` (register-level call form in tools/register-forms/task-append-call.mjs)
- **80:AAAF**: [object-turn.mjs](../src/game/object-turn.mjs). `turnObjectCall`
- **80:AC2F**: [object-animation.mjs](../src/game/object-animation.mjs). `stepAnimation`
- **80:B20A**: [object-sprites.mjs](../src/game/object-sprites.mjs). `enterObjectSprites`
- **80:FEC1**: [notice-show.mjs](../src/game/notice-show.mjs). `showNoticeSequence` (`runShowNotice`)
- **80:BCB2**: [window-release.mjs](../src/game/window-release.mjs). `putGloveAwayCallSequence` (`runPutGloveAway`)
- **80:FAAC, 80:FD80**: [window-text.mjs](../src/game/window-text.mjs). `setTextCursor`, `printNumber` (RTS forms `setTextCursorJsr` and `printNumberJsr` in tools/register-forms/jsr-forms.mjs, `runPrintNumber`)
- **80:FE69, 81:AF04**: [text-print.mjs](../src/game/text-print.mjs). `printText` (RTS form `printTextJsr` in tools/register-forms/jsr-forms.mjs, `runPrintText`)
- **80:FB39**: [text-draw.mjs](../src/game/text-draw.mjs). `drawTextBufferSequence` (`runDrawTextBuffer`)
- **80:F963**: [window-open.mjs](../src/game/window-open.mjs). `openWindow` (RTS form `openWindowJsr` in tools/register-forms/jsr-forms.mjs; `runOpenWindow`)
- **80:99EB**: [action-menu.mjs](../src/game/action-menu.mjs). `chooseAction` (RTS form `chooseActionJsr` in tools/register-forms/jsr-forms.mjs; `runChooseAction`)
- **80:FADD, 80:FB2A**: [text-width.mjs](../src/game/text-width.mjs). `measureTextWidth` (register form `measureTextWidthRoutine` in tools/register-forms/text-width.mjs)
- **80:936C, 80:92C5**: [dialog-talk.mjs](../src/game/dialog-talk.mjs). `talkSequence` (`runTalk`), `closeDialog` (RTS form `closeDialogJsr` in tools/register-forms/jsr-forms.mjs)
- **81:886A, 80:FA92**: [dialog-talk.mjs](../src/game/dialog-talk.mjs). `clearFixedColourInPlace`, `setWindowTextWidthInPlace` (RTL and RTS forms `clearFixedColourJsl` and `setWindowTextWidthJsr` in tools/register-forms/jsr-forms.mjs)
- **80:FF79**: [window-release.mjs](../src/game/window-release.mjs). `releaseNoticeWindowsCallSequence` (`runReleaseNoticeWindows`)
- **81:AD92, 80:FA3E (script natives)**: [window-list.mjs](../src/game/window-list.mjs), [window-release.mjs](../src/game/window-release.mjs). `drawWindowListJslSequence` (`runDrawWindowList`), `releaseWindowJsrSequence` (`runReleaseWindowCall`)
- **80:91E2, 80:9215**: [dialog-menus.mjs](../src/game/dialog-menus.mjs). `chooseDialogAction` (RTS form `chooseDialogActionJsr` in tools/register-forms/jsr-forms.mjs; `runDialogMenu`), `chooseDialogTopic` (RTS form `chooseDialogTopicJsr`; `runDialogTopics`)
- **80:9178, 80:908C**: [dialog-text.mjs](../src/game/dialog-text.mjs). `showDialogText` (RTS form `showDialogTextJsr` in tools/register-forms/jsr-forms.mjs; `runDialogText`)
- **80:FA67**: [window-open.mjs](../src/game/window-open.mjs). `requestTileClear` (RTS form `requestTileClearJsr` in tools/register-forms/jsr-forms.mjs)
- **80:8F3A, 80:8F97**: [portrait-window.mjs](../src/game/portrait-window.mjs). `openPortraitWindow`, `closePortraitWindow` (RTS forms `openPortraitWindowJsr` and `closePortraitWindowJsr` in tools/register-forms/jsr-forms.mjs; `runOpenPortraitWindow`, `runClosePortraitWindow`)
- **80:9F6D, 80:8F20, 80:9022, 80:905E, 80:8FF5**: [portrait-upload.mjs](../src/game/portrait-upload.mjs). `unpackPortrait`, `shiftPortraitRowsInPlace`, `uploadFirstPortrait`, `uploadSecondPortrait`, `uploadPortraitTiles` (RTS forms `shiftPortraitRowsJsr`, `uploadFirstPortraitJsr` and `uploadSecondPortraitJsr` in tools/register-forms/jsr-forms.mjs; register forms `unpackPortraitRoutine` and `uploadPortraitTilesSequence` in tools/register-forms/portrait-routines.mjs) (`runPortraitTiles`)
- **80:ADF4, 80:AE12**: [object-tiles.mjs](../src/game/object-tiles.mjs). `reloadObjectTiles` (RTS form and `runReloadObjectTiles` in proof/caller/upkeep-routines.mjs)
- **80:A617, 80:A5F9, 80:A5DB**: [menu-list.mjs](../src/game/menu-list.mjs). `drawListSequence`, `markRowSequence` (`MARK`, `UNMARK`)
- **80:A6A5 to 80:A845**: [menu-choice.mjs](../src/game/menu-choice.mjs). `chooseFromMenuSequence` (`runMenuWithHotkeys`)
- **80:C152 with its jobs**: [game-nmi.mjs](../src/game/game-nmi.mjs). `uploadScenePalettes`, `uploadPaletteCycleStep`, `uploadObjectPalettes`, `uploadVramRecords`, `uploadOam`, `stepBrightnessFade`, `uploadPortraitGraphics`, `uploadGlove`, `uploadReadyMapEdges`, `clearTextTiles`, `handleGameNmi` (the live routine table binds the handler only; the jobs' table entries `GAME_NMI_LIFTED_ROUTINES` are in tools/register-forms/game-nmi-jobs.mjs; the entries of `GAME_NMI_LIFTED_JOBS`, bound in MAIN_SCENE_ROUTINES of proof/replay/main-scene.mjs, run them with lag-free frames and the register-level jobs for recorded runs; proof/scene-reference-routines.mjs keeps the register-level jobs for the ROM proofs)
- **80:96AB**: main-frame-adapter.mjs (removed). The loop's own instructions
- **entries**: [main-upkeep.mjs](../src/game/main-upkeep.mjs). The main loop's table entries (RTL or RTS as the original) and the native call continuation of 80:FF14.

Register-level palette equations are in
`palette-cycles-equations.mjs` (removed).
Original routine contracts remain in [reference/](reference/README.md).

## Free stack bytes

Game state is authoritative. Reworked routines need not reproduce CPU
registers, flags, stack bytes or an NMI's saved registers unless a caller or
callee reads them as an argument or result. Internal JSR/JSL frames and
values temporarily parked on the stack can become local variables.
Compatibility wrappers consume their documented outer return only; recorded
instruction paths retain their own frame contracts.

A wait whose deeper callee still inspects the stack retains its required
workspace until that complete call graph is composed. Do not remove a frame
solely because another lift removed one. Matrix/cutscene entry, menu choices,
confirmation, portrait/tile uploads, task visits and glove-list preparation
have had such dependencies; consult the current subsystem contract.

The lift harness ignores CPU stacks and free bytes below entry S. Random
samples whose result depends on ignored bytes are outside the lifted domain;
these and frontier stops are capped at 10% of samples. This exclusion does not
authorize ignoring game data. Native waits can leave a different saved stack
pointer at 7E:01F2; the corresponding script comparison masks that diagnostic
word. The current policy is in [STRATEGY.md](STRATEGY.md).

## Boundaries

- Live waits use lag-free frames. Recorded replay permits interrupts between
  original instructions and uses the register-level wait/input path. These
  paths are not interchangeable. NMI job order, shared state, device requests
  and upload payloads remain observable.
- Preserve fresh field/table reads, ordered writes, WORD wraps, signed tests,
  carry/overflow where consumed and original list order. Bank-80 tables and
  low-WRAM fields must not acquire hardware-port effects through an
  out-of-domain pointer. Formation indices still wrap in the low WRAM mirror.
- Game-sized object/task slots and finite lists are explicit domains. Invalid
  data stops at the relevant frontier: object_slot_required,
  task_slot_required, task_chain_required, draw_list_required,
  task_heap_required, collision_box_required, depth_rule_required,
  notice_text_required or nmi_list_required. Preserve each module's narrower
  checks. A stopped synthetic fixture proves no ordinary story route.
- A local routine comparison proves its tested inputs and observations.
  Static closure, synthetic device values and mutation sensitivity are separate
  from actual original-game route coverage and hardware evidence. The old
  per-native sample counts and machine timings are not release requirements.

## Tests

main-owner-caller.test.mjs (removed) compares direct
and former live callers at each NMI and owner/game-start boundary, with finite
budgets and exit/reload fixtures. Those fixtures do not prove a game-over story
route. game-loop.test.mjs (removed) retains independent
comparisons for movement, the saved-game badge route and attract mode.

Function differentials cover edge and random inputs against frozen equations;
source tests compare references with original instructions. Their fixtures and
assertions maintain the precise tested values and mutation checks. Use the
automatic selection from npm run test:block; slow live/Mesen sessions belong
to the shared release check.

The alley session has no portrait; the dialog comparison covers portrait
output. The NMI function harness compares writes, so omission of the VRAM
latch read at 81:AA8E could pass it, and the live sessions did not request that
readback. The read remains required by the original and the separate
[readback contract](VM-INTERPRETER.md#observed-dma-masks-and-further-wait-callers).
Session coverage alone also did not expose every fade counter or register
result; function and source comparisons remain necessary.

The following index preserves the test links from the former delivery log.
It is a lookup aid, not a hand-maintained block-test selection:

- main-owner-caller.test.mjs (removed)
- game-loop.test.mjs (removed)
- main-boot-connected.test.mjs (removed)
- script-native-lift.test.mjs (removed)
- [text-caller.test.mjs](../tools/text-caller.test.mjs)
- task-native-dialog.test.mjs (removed)
- mesen-live-room.test.mjs (removed)
- [script-leaves-lift-functions.test.mjs](../tools/script-leaves-lift-functions.test.mjs)
- [object-fields-lift-functions.test.mjs](../tools/object-fields-lift-functions.test.mjs)
- [script-timer-lift-functions.test.mjs](../tools/script-timer-lift-functions.test.mjs)
- [swarm-setup-lift-functions.test.mjs](../tools/swarm-setup-lift-functions.test.mjs)
- [kind-values-lift-functions.test.mjs](../tools/kind-values-lift-functions.test.mjs)
- [script-requests-lift-functions.test.mjs](../tools/script-requests-lift-functions.test.mjs)
- [room-story-lift-functions.test.mjs](../tools/room-story-lift-functions.test.mjs)
- [party-funds-lift-functions.test.mjs](../tools/party-funds-lift-functions.test.mjs)
- [motion-targets-lift-functions.test.mjs](../tools/motion-targets-lift-functions.test.mjs)
- [script-measures-lift-functions.test.mjs](../tools/script-measures-lift-functions.test.mjs)
- [topic-list-lift-functions.test.mjs](../tools/topic-list-lift-functions.test.mjs)
- [fight-list-queries-lift-functions.test.mjs](../tools/fight-list-queries-lift-functions.test.mjs)
- [group-members-lift-functions.test.mjs](../tools/group-members-lift-functions.test.mjs)
- [action-box-collision-lift-functions.test.mjs](../tools/action-box-collision-lift-functions.test.mjs)
- [object-halt-lift-functions.test.mjs](../tools/object-halt-lift-functions.test.mjs)
- [matrix-enter-lift-functions.test.mjs](../tools/matrix-enter-lift-functions.test.mjs)
- [object-release-lift-functions.test.mjs](../tools/object-release-lift-functions.test.mjs)
- [runner-record-lift-functions.test.mjs](../tools/runner-record-lift-functions.test.mjs)
- [room-entry-lift-functions.test.mjs](../tools/room-entry-lift-functions.test.mjs)
- [swarm-motion-lift-functions.test.mjs](../tools/swarm-motion-lift-functions.test.mjs)
- [formation-place-lift-functions.test.mjs](../tools/formation-place-lift-functions.test.mjs)
- [runner-equipment-lift-functions.test.mjs](../tools/runner-equipment-lift-functions.test.mjs)
- [object-facing-lift-functions.test.mjs](../tools/object-facing-lift-functions.test.mjs)
- [object-bob-lift-functions.test.mjs](../tools/object-bob-lift-functions.test.mjs)
- [script-queries-lift-functions.test.mjs](../tools/script-queries-lift-functions.test.mjs)
- [script-variables-lift-functions.test.mjs](../tools/script-variables-lift-functions.test.mjs)
- [actor-state-lift-functions.test.mjs](../tools/actor-state-lift-functions.test.mjs)
- [fight-list-remove-lift-functions.test.mjs](../tools/fight-list-remove-lift-functions.test.mjs)
- [magic-points-lift-functions.test.mjs](../tools/magic-points-lift-functions.test.mjs)
- [glove-release-lift-functions.test.mjs](../tools/glove-release-lift-functions.test.mjs)
- `confirm-key-lift.test.mjs` (removed)
- [glove-target-lift-functions.test.mjs](../tools/glove-target-lift-functions.test.mjs)
- [object-shoot-lift-functions.test.mjs](../tools/object-shoot-lift-functions.test.mjs)
- [object-blast-lift-functions.test.mjs](../tools/object-blast-lift-functions.test.mjs)
- [object-hit-lift-functions.test.mjs](../tools/object-hit-lift-functions.test.mjs)
- [spell-choice-lift-functions.test.mjs](../tools/spell-choice-lift-functions.test.mjs)
- [member-spell-menu-lift-functions.test.mjs](../tools/member-spell-menu-lift-functions.test.mjs)
- live-nested-round.test.mjs (removed)
- [player-control-lift-functions.test.mjs](../tools/player-control-lift-functions.test.mjs)
- [equipment-window-lift-functions.test.mjs](../tools/equipment-window-lift-functions.test.mjs)
- [member-portrait-lift-functions.test.mjs](../tools/member-portrait-lift-functions.test.mjs)
- [status-submenus-lift-functions.test.mjs](../tools/status-submenus-lift-functions.test.mjs)
- [item-menu-lift-functions.test.mjs](../tools/item-menu-lift-functions.test.mjs)
- [decimal-number-lift-functions.test.mjs](../tools/decimal-number-lift-functions.test.mjs)
- [live-mouse.test.mjs](../tools/live-mouse.test.mjs)
- [status-screen-lift-functions.test.mjs](../tools/status-screen-lift-functions.test.mjs)
- [karma-menu-lift-functions.test.mjs](../tools/karma-menu-lift-functions.test.mjs)
- [main-menu-lift-functions.test.mjs](../tools/main-menu-lift-functions.test.mjs)
- [party-status-lift-functions.test.mjs](../tools/party-status-lift-functions.test.mjs)
- [runner-state-lift-functions.test.mjs](../tools/runner-state-lift-functions.test.mjs)
- task-native-m1d.test.mjs (removed)
- [sight-lift-functions.test.mjs](../tools/sight-lift-functions.test.mjs)
- [main-upkeep-lift-functions.test.mjs](../tools/main-upkeep-lift-functions.test.mjs)
- [game-nmi-lift-functions.test.mjs](../tools/game-nmi-lift-functions.test.mjs)
- game-nmi-lift.test.mjs (removed)
- main-upkeep-lift.test.mjs (removed)
- main-loop-camera.test.mjs (removed)
- `main-motion-helpers.test.mjs` (removed)
- `main-loop-motion.test.mjs` (removed)
- `main-text-continuation.test.mjs` (removed)
