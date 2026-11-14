# Main loop lift

The main loop 80:96AB to 80:96F2 calls its routines once per pass
([src/vm/main-loop.mjs](../src/vm/main-loop.mjs)). They are lifted from
register-level 65816 equations to plain code one group at a time, after the scene
request 80:CC4B ([SCENE-REQUEST-LIFT.md](SCENE-REQUEST-LIFT.md)); method in
[MATRIX-LIFT.md](MATRIX-LIFT.md). The register-level versions stay as references in
[proof/game-reference/main-upkeep.mjs](../proof/game-reference/main-upkeep.mjs)
(`MAIN_UPKEEP_REFERENCE_ENTRIES`),
[proof/game-reference/main-camera.mjs](../proof/game-reference/main-camera.mjs)
(`MAIN_CAMERA_REFERENCE_ENTRIES`),
[proof/game-reference/main-timer.mjs](../proof/game-reference/main-timer.mjs)
(`MAIN_TIMER_REFERENCE_ENTRIES`) and
[proof/game-reference/main-glove-action.mjs](../proof/game-reference/main-glove-action.mjs)
(`MAIN_GLOVE_ACTION_REFERENCE_ENTRIES`). The register-level routines the lifted
callees still call through their frames stay in
[src/task/main-loop-upkeep.mjs](../src/task/main-loop-upkeep.mjs) (`MAIN_UPKEEP_ROUTINES`).

## Lifted so far

| Routine                                     | Module                                                                                               | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 81:8877                                     | [fixed-colour.mjs](../src/game/fixed-colour.mjs)                                                     | `applyColourEffect`: the colour effect request 7E:1FDC (reset, flash, fast and slow ramps over the phase 7E:1FDE and the ramp 80:D3D1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 81:8076                                     | [palette-cycles.mjs](../src/game/palette-cycles.mjs)                                                 | `advancePaletteCycles`: the two palette cycles and their upload request.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 80:DE94                                     | [player-hit.mjs](../src/game/player-hit.mjs)                                                         | `shakeHitPlayer`: the player figure's shake while its hit frames run down.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 80:FF14                                     | [notice-timeout.mjs](../src/game/notice-timeout.mjs)                                                 | `noticeTimeoutSequence`: the notice windows' frames, their release (window-release.mjs) and the notice effect sounds with the lifted random numbers and sound effect.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 80:BAD5                                     | [formation-trail.mjs](../src/game/formation-trail.mjs)                                               | `recordFormationStep`: the ring of the player figure's last 64 positions that the group follows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 81:8C2E                                     | [camera-follow.mjs](../src/game/camera-follow.mjs)                                                   | `followPlayerWithCamera`: the projected aim at the player figure, clamped by the camera box (camera-box.mjs), and the camera speeds.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 81:8A91                                     | [camera-scroll.mjs](../src/game/camera-scroll.mjs)                                                   | `updateTileBuffers`, lifted with the room entry, now also called by the main loop.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 80:E270                                     | [time-limit.mjs](../src/game/time-limit.mjs)                                                         | `timeLimitSequence`: the Cortex bomb's hours and frames, the hourly notice with the hours left and the warning sound in the last hour.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 80:BF3B                                     | [glove-action.mjs](../src/game/glove-action.mjs)                                                     | `gloveActionSequence`: B, L or R on the glove's object passes an action on to the waiting task (action menu, dialog), or the out-of-reach notice.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 81:B0A1                                     | [frame-wait.mjs](../src/system/frame-wait.mjs)                                                       | `waitForCounterWord` (`runFrameWait`): the word wait at the top of the loop, with lag-free frames.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 80:9E1A                                     | [joypad.mjs](../src/system/joypad.mjs)                                                               | `takePadPresses` (`runPadPresses`): the newly pressed buttons, with lag-free frames.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 80:BE6D                                     | [glove-move.mjs](../src/game/glove-move.mjs)                                                         | `gloveMoveSequence` (`runGloveMove`): the glove's speed and position from the pad; at rest the object search 80:BCBE (object-search.mjs), moving the release 80:BE5B (window-release.mjs).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 80:8000                                     | [player-zones.mjs](../src/game/player-zones.mjs)                                                     | `playerZonesSequence` (`runPlayerZones`): the player figure against the room's two zone lists; a task append (80:C34A, task-append.mjs) or a scene change (80:A4BF, register-level).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 80:AFC4                                     | [object-motion.mjs](../src/game/object-motion.mjs)                                                   | `moveAndAnimate` (`runObjectMotion`): the moving part of the collision grid (81:8799, 81:80F7, 81:846E), then the movement 80:AB26 (object-move.mjs) and the animation 80:AC2F (object-animation.mjs) of each object not halted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 80:AB26                                     | [object-move.mjs](../src/game/object-move.mjs)                                                       | `moveObject`: the walk towards a motion target (80:C9E0, object-target.mjs), the steps along x and y with the edge tests, climbing below 5 or blocking, the fall to the floor 0100 with the height test, and the diagonal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 80:C9E0                                     | [object-target.mjs](../src/game/object-target.mjs)                                                   | `walkTowardsTarget`: the frames to the next step, the distance to the target point or object (80:C80C), arrival with the task event 4, and the direction axis by axis (80:C84D) or straight (80:C913) with the turn 80:AAAF (object-turn.mjs) and the step tables.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 80:80B2 to 80:82BC                          | [object-collision.mjs](../src/game/object-collision.mjs)                                             | `searchUpperXEdge`, `searchLowerXEdge`, `searchUpperYEdge`, `searchLowerYEdge`, `searchHeightCells`: the largest height the static and moving boxes of the edge cells offer (cell search 81:86E5, lists 81:85FE and 81:8686).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 80:B8DE                                     | [sprite-list.mjs](../src/game/sprite-list.mjs)                                                       | `buildSprites` (`runSpriteList`): the OAM high table, the draw list into the OAM (sort 80:AFFC in depth-sort.mjs, palette slots in palette-slots.mjs, the OAM entry 80:B20A in object-sprites.mjs), the hidden rest and the NMI job count.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 80:AFFC                                     | [depth-sort.mjs](../src/game/depth-sort.mjs)                                                         | `sortDrawList`: one bubble pass of the draw list down and, with more than two objects, back up, by the diagonal and the depth rules 1 to 4 with their bias (comparisons 80:B0A5 and 80:B0ED).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 80:AB0A, 81:A840                            | [palette-slots.mjs](../src/game/palette-slots.mjs)                                                   | `paletteSlot`, `resetPaletteSlots`: an object palette's slot, appended to the upload list when unset, and the reset of all slots each pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 80:BCBE                                     | [object-search.mjs](../src/game/object-search.mjs)                                                   | `objectSearchSequence`: the draw list from its end for an object with a picture and a name whose projected box holds the glove; it is marked with its name window, the same one pulls the glove to the recorded offset, none releases (80:BE5B, window-release.mjs).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 80:C34A                                     | [task-append.mjs](../src/game/task-append.mjs)                                                       | `appendScriptTask`, `appendScriptTaskCall`: a script task at the head of the task list, its frame from the heap (80:C242) with the arguments (80:C2C8); also used by the object creation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 80:AAAF                                     | [object-turn.mjs](../src/game/object-turn.mjs)                                                       | `turnObjectRoutine`: the lifted turn (with the selection 80:A985) as the walk calls it, with the registers of the original.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 80:AC2F                                     | [object-animation.mjs](../src/game/object-animation.mjs)                                             | `stepAnimation`: the picture change or the clock, the frame stream (repeats, loop, once, end with the task event 8), the picture's VRAM slots and upload jobs, its shadow rule and depth bias.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 80:B20A                                     | [object-sprites.mjs](../src/game/object-sprites.mjs)                                                 | `enterObjectSprites`: one object's projection, the wall map walk (map cells against the depth), the occlusion grids A to D with the wall sprites 80:B130, the parts into the OAM and the cells met into the object's flags.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 80:FEC1                                     | [notice-show.mjs](../src/game/notice-show.mjs)                                                       | `showNoticeSequence` (`runShowNotice`): the notice window (80:F963), its text (80:FE69) and the notice slot, the last free one or the one with the fewest frames left, whose window is released (80:FA3E).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 80:BCB2                                     | [window-release.mjs](../src/game/window-release.mjs)                                                 | `putGloveAwayCallSequence` (`runPutGloveAway`): the glove put away with the registers of the original, as the glove action calls it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 80:FAAC, 80:FD80                            | [window-text.mjs](../src/game/window-text.mjs)                                                       | `setTextCursorRoutine`, `printNumberSequence` (`runPrintNumber`): a window's text cursor from row and column (hardware multiplier), and a number's decimal digits (hardware divider) drawn at it by 80:FB39 (register-level).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 80:FE69, 81:AF04                            | [text-print.mjs](../src/game/text-print.mjs)                                                         | `printTextSequence` (`runPrintText`): a text number decoded bit by bit (81:AF04) through the Huffman code tree 9D:8000 into the text buffer, or a language or port text, drawn by 80:FB39 (register-level).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 80:FB39                                     | [text-draw.mjs](../src/game/text-draw.mjs)                                                           | `drawTextBufferSequence` (`runDrawTextBuffer`): the text buffer drawn glyph by glyph into a window's mask with word wrap and styles, the cursor geometry 81:ADBA, 81:AE14 and 81:AE4D, the mask close 81:AEC8 and the upload requests 81:AEF4 and 81:AEFC.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 80:F963                                     | [window-open.mjs](../src/game/window-open.mjs)                                                       | `openWindowSequence` (`runOpenWindow`): the next window index, the position clamped to the map, the fields, the text tiles (PPU multiplier, wrap at 2400), the tile clear request 80:FA67 with its wait 81:ACBD, the window drawing 81:ACCF and the map upload 81:ACB5 of window-list.mjs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 80:99EB                                     | [action-menu.mjs](../src/game/action-menu.mjs)                                                       | `chooseActionSequence` (`runChooseAction`): the accepted actions listed in their fixed order with texts and hotkeys, the window (80:F963), the menu 80:A6A5 (menu-choice.mjs) and the release (80:FA3E); A the chosen flag.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 80:FADD, 80:FB2A                            | [text-width.mjs](../src/game/text-width.mjs)                                                         | `measureTextWidthRoutine`: a text's pixel width, decoded as by the text print and summed from the glyph widths (with the original's high byte quirk for the second character of a node).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 80:936C, 80:92C5                            | [dialog-talk.mjs](../src/game/dialog-talk.mjs)                                                       | `talkSequence` (`runTalk`), `closeDialogSequence`: the dialog's course (glove, notices, music, portrait frame and text window, both portraits, greeting, the menu with talk and topics until Exit or the end word) and its close (portrait window, object tiles, font blocks by DMA, pad, sprites).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 81:886A, 80:FA92                            | [dialog-talk.mjs](../src/game/dialog-talk.mjs)                                                       | `clearFixedColourRoutine`, `setWindowTextWidthRoutine`: the fixed colour cleared without colour math, and a window's left text pixel and pixel width (or its columns plus a non-positive change less two).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 80:FF79                                     | [window-release.mjs](../src/game/window-release.mjs)                                                 | `releaseNoticeWindowsCallSequence` (`runReleaseNoticeWindows`): the notice windows released with the registers of the original, as the dialog calls it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 81:AD92, 80:FA3E (script natives)           | [window-list.mjs](../src/game/window-list.mjs), [window-release.mjs](../src/game/window-release.mjs) | `drawWindowListJslSequence` (`runDrawWindowList`), `releaseWindowJsrSequence` (`runReleaseWindowCall`): the window list and the window release as the register-level script natives call them (object hit, window list redraw 80:CDA8, glove release, glove target, runner restore, state count, action list, modal dialogs, notice, dialog text, portrait dialog, notice slots), lifted with lag-free frames.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 80:91E2, 80:9215                            | [dialog-menus.mjs](../src/game/dialog-menus.mjs)                                                     | `chooseDialogActionSequence` (`runDialogMenu`), `chooseDialogTopicSequence` (`runDialogTopics`): the dialog's main menu (Exit, Talk, Ask about) and the topic choice from the unflagged topics of the list, each with its menu 80:A6C7 (register-level), the topic window opened and released lifted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 80:9178, 80:908C                            | [dialog-text.mjs](../src/game/dialog-text.mjs)                                                       | `showDialogTextSequence` (`runDialogText`): the text window cleared and its cursor set, the record's entry for the key (or FFFD), its topics added to the sorted topic list (80:908C), its text and its action.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 80:FA67                                     | [window-open.mjs](../src/game/window-open.mjs)                                                       | `requestTileClearSequence`: a window's text tiles cleared by the NMI's next upload (81:ACBD), on its own as the dialog text calls it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 80:8F3A, 80:8F97                            | [portrait-window.mjs](../src/game/portrait-window.mjs)                                               | `openPortraitWindowSequence`, `closePortraitWindowSequence` (`runOpenPortraitWindow`, `runClosePortraitWindow`): the portrait window's HDMA table and channel, widened or narrowed by 3 every frame with the window edges 80:8EFE.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 80:9F6D, 80:8F20, 80:9022, 80:905E, 80:8FF5 | [portrait-upload.mjs](../src/game/portrait-upload.mjs)                                               | `unpackPortraitRoutine`, `shiftPortraitRowsRoutine`, `uploadFirstPortraitSequence`, `uploadSecondPortraitSequence`, `uploadPortraitTilesSequence` (`runPortraitTiles`): a portrait unpacked into bank 7F by the lifted unpacker (src/system/unpack.mjs), its rows moved apart, and each portrait to VRAM by the DMA job 80:8FF5 (channel 0, the request 7E:0140 and its NMI wait) with its palette start, HDMA entries and OAM high table words.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 80:ADF4, 80:AE12                            | [object-tiles.mjs](../src/game/object-tiles.mjs)                                                     | `reloadObjectTilesSequence` (`runReloadObjectTiles`): after the dialog the tiles of each object of the draw list queued for the NMI's upload again, a waiting picture change taken by the animation step 80:AC2F a frame apart, and the waits for the job lists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 80:A617, 80:A5F9, 80:A5DB                   | [menu-list.mjs](../src/game/menu-list.mjs)                                                           | `drawListSequence`, `markRowSequence` (`MARK`, `UNMARK`): a menu's page of rows (texts, numbers after a blank, the more and previous marks) and a row's mark or its removal, with the cursor 80:FAAC, the text 80:FE69 and the number 80:FD80 lifted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 80:A6A5 to 80:A845                          | [menu-choice.mjs](../src/game/menu-choice.mjs)                                                       | `chooseFromMenuSequence` (`runMenuWithHotkeys`): the four menu entries (hotkeys, numbers, numbers with a preselected row, plain), each frame the word wait and the pad word, the repeat of a held direction, moves, pages (the tile request 80:FA67 and the list drawn again), hotkeys, confirm with its sound and cancel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 80:C152 with its jobs                       | [game-nmi.mjs](../src/game/game-nmi.mjs)                                                             | `uploadScenePalettes`, `uploadPaletteCycleStep`, `uploadObjectPalettes`, `uploadVramRecords`, `uploadOam`, `stepBrightnessFade`, `uploadPortraitGraphics`, `uploadGlove`, `uploadReadyMapEdges`, `clearTextTiles`, `handleGameNmi` (`GAME_NMI_LIFTED_ROUTINES`; the entries of `GAME_NMI_LIFTED_JOBS`, bound in MAIN_SCENE_ROUTINES of src/task/main-scene.mjs, run them with lag-free frames and the register-level jobs for recorded runs; proof/scene-reference-routines.mjs keeps the register-level jobs for the ROM proofs): the game NMI handler 80:C152 (forced blank, the jobs in the original order with the joypad 80:9E0B of src/system/joypad.mjs, the screen shadows to INIDISP, TM, TS, TMW and HDMAEN) and its jobs (80:999A, 81:80C4, 81:A919, 81:A958, 81:A98E, 81:B0D1, 80:8FBA, 80:C06B, 81:8949, 81:A9E1): the scene palettes and the backdrop colour, the palette cycle step by DMA on channel 0, the object palettes of the upload list by DMA on channel 4, the VRAM upload records on channel 1, the OAM buffer by DMA on channel 2 with the job lists closed, one step of the brightness fade in the INIDISP shadow, the requested portrait characters and colours, the glove picture after a change with the glove as OAM entry 0, the map edges unless held (with `uploadMapEdges` of camera-scroll.mjs), and the text uploads (tile clear in chunks, window map, text buffer mask and its read back from VRAM). |
| 80:96AB                                     | [main-loop.mjs](../src/vm/main-loop.mjs)                                                             | The loop's own instructions: the calls with their frames, the carry tests after 80:8000 and 80:CC4B and the exit words 7E:1FDA and 7E:1FD8.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| entries                                     | [main-upkeep.mjs](../src/game/main-upkeep.mjs)                                                       | The main loop's table entries (RTL or RTS as the original) and the native call continuation of 80:FF14.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

The register-level palette equations moved from src/render to
[proof/render/palette-cycles-equations.mjs](../proof/render/palette-cycles-equations.mjs),
which the render proof of 81:8076 keeps using.

## Boundaries

- User decision (2026-11-14, [STRATEGY.md](STRATEGY.md)): game state, not bytes. New and
  reworked lifts need not reproduce the stack pointer, stack bytes, the NMI's saved
  registers or leftover registers and flags; only values a caller or callee reads as an
  argument or result are kept, and the code names them as such. The function harness
  masks both CPU stacks, the Mesen comparisons of
  [tools/mesen-live-room.test.mjs](../tools/mesen-live-room.test.mjs) no longer count a
  wait at another S as a lag frame and compare the context without A, X, Y and P, and
  the f390 oracle treats the NMI stack 7E:1C7C-1CBB as free. The entries below record
  how the earlier lifts reproduced X, Y and stack depth; that remains valid but is no
  model for new work.
- User decision (2026-11-13): unread bytes below the stack pointer may differ from the
  original. These are the frames and pushes of inner calls that the lifted code does not
  reproduce (return words, pushed registers); nothing reads them, and a later push or
  NMI overwrites them. Registers, flags and every byte the game reads stay as the
  original, as do the bytes above the stack pointer and those an NMI saves.
- The main loop reads none of the registers the routines leave, but a wait of a
  later callee takes its NMI with them, and the NMI saves X and Y on its stack
  (7E:1CB6-1CB9), which the Mesen oracle compares. So the routines leave X and Y as
  the original: 81:8877 the phase on a ramp, 81:8076 the slot offset it ended at,
  80:DE94 the player slot, 80:BAD5 the ring index and the player slot (both kept
  during a hit), 81:8C2E the player slot in Y, 81:8A91 the horizontal speed in X
  without a copy, else the layer offset after its last copy and the buffer offset
  it started at, 80:FF14 FFFE after its loop, the low byte of it and the
  random table index after a random draw, and the sound word with FF in its high
  byte and the effect offset after a sound. A and the other flags are not produced.
  The first release run without them failed the Mesen oracle (1CB8-1CB9); the second
  failed the cold boot replay at the upload wait 81:ACAF of a notice release, where
  the lifted window list now leaves X and the carry of its loop as the original
  (ROOM-ENTRY-LIFT.md). They write the direct
  page words the original writes: 80:FF14 leaves the random word in 00 without a
  sound, the sound's arguments in 00 to 07 with one.
- The time limit and the glove action call their register-level callees (notice
  80:FEC1, text cursor 80:FAAC, number 80:FD80, text 80:FE69, glove release 80:BCB2,
  input 80:9E1A, action menu 80:99EB, dialog 80:936C) through their frames with the A,
  X and Y the original passes; only the action menu reads A (the accepted actions).
  The glove action pushes the object slot around the menu and the dialog as the
  original. Its push of the action around the task search is not reproduced: nothing
  waits there and the glove release's frame overwrites it. The time limit sets
  neither X nor Y; its warning sound is the lifted sound effect, its frame not
  reproduced. The glove action's object, player and task fields are read below 2000
  (`object_slot_required`, `task_slot_required`), and a task chain that never ends,
  where the original would hang, stops at `task_chain_required`. The register-level
  reference called the pressed buttons in DP 6B a parent task; it now names them.
- The glove action is the last callee before the scheduler round 80:C1E3, which starts
  with its A and flags (the cold boot replay and the Mesen oracle compare them; the
  first release run failed there). So where no callee runs last it leaves A, sign and
  zero as the original, and the carry and overflow of the height distance after a near
  object. Out of reach, the object has offered actions, which are accepted ones, so a
  callee runs last; the carry and overflow there are not produced. The time limit
  leaves the carry of its comparison with E10 in the last hour, which outlives the
  main loop's own loads. The stand-ins of the function tests leave random flags, as
  none of the callees reads them on entry.
- The word wait 81:B0A1 and the pad word 80:9E1A run lifted only with the lag-free
  frame model, where the NMI arrives at the wait's blocking branch alone; with recorded
  interrupt observations an NMI may fall between any two instructions, so the entries
  run the register-level routines, which the main loop continuation steps by
  instruction (it tells the two apart by the run function). The pad word leaves A with
  the four low bits, sign clear, zero and the carry of its 3030 comparison.
- The live game's routine table (FRONTEND_ROUTINES in src/task/main-frontend.mjs)
  merges menu and transition tables after the main loop's, which bound 81:B0A1, 80:9E1A
  and 81:8A91 register-level again; so until now the live session ran the
  register-level tile buffers. The lifted tile buffers now come last there. The menus
  keep their register-level word wait and pad word (a first release run that gave them
  the lifted entries moved the new game after a Game Over by three frames, as the
  lifted wait ends its live step after the NMI, and ran the lifted wait in the cold boot
  replay); the main loop runs its lifted entries in place of exactly those routines
  (MAIN_LOOP_LIFTED_TOP in src/vm/main-loop.mjs, which the live comparison binds back to
  them for the reference). A count of the calls in the alley session found about 5070
  for each, in the lifted run only.
- The glove movement 80:BE6D is followed by the glove action, whose early returns
  pass X, Y, carry and overflow on to the scheduler round. So it leaves them as the
  original where no callee runs last: X the directions shifted right once, the
  overflow of the position addition down and the carry of its comparison with CE01,
  and A with its sign and zero; the object search reads that carry too. The search
  80:BCBE and the release 80:BE5B are lifted and run through their frames; the glove
  natives (9BC6) keep the register-level 80:BE6D and 80:BCBE, which
  are the references ([src/task/native-glove.mjs](../src/task/native-glove.mjs)
  `moveGlove`, `bcbeSequence`).
- The object search 80:BCBE leaves A, X, Y and all flags as the original where no
  callee runs last (the target tag with its sign and zero, the last object slot, the
  draw list index after its last step and the carry and overflow of the last failed
  test, or the snapped glove word); it passes its release, text width, window and
  text calls the A, X, Y and flags of the original, pushes the object slot around the
  release of another object and the name pointer around the window, and writes the
  direct page words 0E, 11, 14, 17 and 1A as the original. Object fields below 2000
  are read in bank 80 (`object_slot_required` past it), the box and kind fields in
  bank 7E; a draw list index past 2000 stops at `draw_list_required`.
- The task append 80:C34A leaves A the new slot, X the list's old head with its sign
  and zero, Y 3 and the carry and overflow of the frame's end, as the original, and
  the frames of its inner calls and the heap's pushed next word on the stack. A full
  heap or no free task slot stops at `task_heap_required` or `task_slot_required`
  (the original writes through a meaningless frame or slot); it needs direct page 0,
  binary arithmetic and a data bank that reaches the low WRAM.
- The zones, the motion pass and the sprite list leave A, X, Y and all flags as the
  original; their tests compare them with the original instructions (the zones also
  the flags each callee starts with). The motion pass and the sprite list reproduce
  the frames of their inner calls and the data bank 7E they set through the stack,
  as the original leaves them below its own frame. The motion pass counts its draw
  list index on from the Y a callee leaves, as the original's DEY does.
- The movement 80:AB26 and its collision tests leave A, X, Y and all flags as the
  original: the tests the height in A (the edge tests with the carry set for none, the
  height test with the carry of its last search), X the slot, Y and the data bank as on
  entry, and the overflow of their last addition or subtraction; the movement the
  diagonal with the flags of its addition and shift. The registers inside the cell
  lists are overwritten before they leave; only their pushes stay on the stack, and the
  frames of the cell search and both lists are reproduced. A box's object word past
  WRAM stops at `collision_box_required`; the movement reads its fields in bank 80
  below 2000 (`object_slot_required`).
- The walk towards a target 80:C9E0, the depth sort 80:AFFC and the palette slot
  80:AB0A leave A, X, Y and all flags as the original; the walk keeps the X and the
  overflow the turn 80:AAAF leaves (the lifted turn, through its frame, now leaves A,
  X, Y and the flags as the original: the selection's box height offset 7 in Y, the
  carry of the last box byte's sign and the overflow of the direction offsets, or the
  8-bit carry and overflow of the frame offset's phase) and reads the step tables in
  the caller's data bank, as the original. The sort writes the
  direct page words 11, 14, 17 and 1A and reproduces the frames of its rule
  comparisons; a rule other than 1 to 4 (low 15 bits) has no comparison in the
  original's jump tables and stops at `depth_rule_required`. The walk's distance carry
  and the Y it indexes the target object with are replaced before they leave.
- The animation 80:AC2F keeps Y on the stack (PHY, PLY) and the slot around its tile
  queue (PHX, PLX), and leaves A, X (the slot, or the task that took the end event)
  and the flags as the original; it writes the direct page words 11 to 15, 17, 20, 35
  to 38, 3B, 3E and 82 as the original. A picture without tiles counts its upload
  jobs down from 0 through FFFF, as the original, until the jobs run past 2000
  (`object_slot_required`); a task chain whose waits never end stops at
  `task_chain_required`. With recorded interrupt observations (the Mesen cold boot
  replay records an NMI at 80:AC8F) the register-level animation runs.
- The OAM entry 80:B20A leaves X as the original (the sprite list's last object passes
  it on: the palette slot's X when hidden, else the last mask index, OAM offset or
  tile index); A, the flags and Y (pulled by the caller) are not produced. It writes
  the direct page words of the original (0E to 6B and the OAM offset 84), pushes the
  grid's mask index and column and leaves the return words of the palette slot and the
  wall sprites on the stack. Fields below 2000 are read in bank 80
  (`object_slot_required` past it), the walls in bank 7F and the pictures in 9B and 9C.
- The lifted window release (src/game/window-release.mjs) and window list now leave
  X as 80:FA3E leaves it (the window, or the one found below the last) and the carry
  of its comparison; without windows the list leaves the X of the window map 81:A9B2
  (FFFE after its tile loop, or the column after the segments of Jake's state bar,
  src/game/state-bar.mjs). They also leave the carry and overflow of the original:
  the list's comparison sets the carry after its windows, the last drawn window leaves
  the overflow of its bottom map row, and without windows the window map leaves those
  of its tile loop or of Jake's state bar (the segment subtraction, the small value's
  table addition, the carry of the doubled table entry). The glove's name window
  release 80:BE5B (`releaseNameWindowCallSequence`) leaves A FFFF with its sign and
  zero and these registers, which the scheduler round starts with. The frames of the
  window map unpack below the window list's are not reproduced.
- Script natives without frame waits run lifted code
  ([src/task/native-script-leaves.mjs](../src/task/native-script-leaves.mjs)): the fight
  list append 80:8521 (`appendToFightList` in
  [src/game/fight-list.mjs](../src/game/fight-list.mjs), with the lifted music mode
  81:EF47), the panned song level 80:C461 (`soundLevels` 80:C416 and the command 81:F007)
  the sound effect 80:C46E (`playSoundEffect` of src/apu/sound-effect.mjs) and the random numbers 80:C51F and 80:C560 (`randomBelow`, `randomWord` of src/system/random.mjs; the limit stays in the direct page word 02 and its mask in 04 as the original leaves them, and the draws are reported as before). The
  interpreter's $F509 replaces A, X, Y, the direct page and N/Z after the native's RTS
  and reads the result from the direct page word 00; no opcode reads the carry or
  overflow before it sets them, so these natives leave only their return. The
  references are in proof/game-reference/fight-list-append.mjs,
  proof/apu-reference/sound-stereo.mjs, src/task/native-audio-compose.mjs (80:C46E) and src/task/native-random.mjs (80:C51F, 80:C560), the last two still used by register-level callers. The movements 80:8D7F (towards an
  object), 80:8D3F (jump towards an object) and 80:8D4E (jump towards a point of the list
  at the direct page F3) run `setVelocityTowards` 80:8D95 of
  [src/game/object-velocity.mjs](../src/game/object-velocity.mjs) with the hardware
  divider; their bridge leaves the original's direct page values (the point, the signs
  and magnitudes, the divisor as the result and its half, the halving word 04). A point
  in the unmapped register area stops (`unmapped_read`), where the original reads the
  open bus; the register-level versions stay in src/task/native-combat.mjs.
  [tools/script-leaves-lift-functions.test.mjs](../tools/script-leaves-lift-functions.test.mjs)
  compares each against its reference on random states (WRAM outside the loader scratch
  and the stack, device writes, return); a planted karma shift differs. The Mesen
  oracle tests check these natives' returns without A, X, Y and the flags
  (tools/lifted-script-natives.mjs) and the WRAM without the free stack bytes and the
  loader scratch. The lifted natives reach object fields and lists through the data
  bank 80 as the original does ([src/system/data-bank.mjs](../src/system/data-bank.mjs)):
  80:offset plus the 16-bit index in 24 bits, so an index past the bank reaches the WRAM
  mirror of bank 81. Scripts pass the object FFFF (none) on, for example from 80:8C8D to
  80:8CCF, and the original then reads the word below the field; an earlier stop at
  indices past 80:2000 broke a user session (recording of 2026-11-13, NMI 12947).
- The object field natives 80:CA05 (the object's flag word as the result), 80:CA0D (the
  flag word replaced by the second argument), 80:CA15 (its bits set) and 80:CA20 (only
  its bits kept) run `objectFlags`, `setObjectFlags`, `setObjectFlagBits` and
  `keepObjectFlagBits` of [src/game/object-fields.mjs](../src/game/object-fields.mjs)
  in the game's native table (src/task/native-object-flags-*.mjs call them with the
  script arguments; `leafArgument` and `setLeafResult` of
  src/task/native-leaf-support.mjs read the arguments and write the result word). Game
  state only: they leave no registers (LIFTED_SCRIPT_NATIVES of
  tools/lifted-script-natives.mjs). The flag word lies at 7E:1458 plus the object
  through the data bank 80. The register-level versions moved to
  proof/game-reference/object-fields.mjs; the proof plans 80:CA05 to 80:CA20 and the
  Native58 dispatch of proof/task/native-dispatch.mjs run them.
  [tools/object-fields-lift-functions.test.mjs](../tools/object-fields-lift-functions.test.mjs)
  compares both (400 samples each; game slots, none and any index in the low WRAM
  mirror); planted changes of the OR, the AND and the index fail it.
- The object record natives 80:CA2B (byte 0), 80:CA3A (the flag byte), 80:CA49 (the
  count byte) and 80:CA58 (the property word) as the result, and 80:CAA2 (the flag byte
  set), 80:CAB4 (its bits set), 80:CACA (only its bits kept) and 80:CAE0 (the count set,
  with the health cheat's protection of Jake's count) run `recordFirstByte`,
  `recordFlags`, `recordCount`, `recordProperty`, `setRecordFlags`,
  `setRecordFlagBits`, `keepRecordFlagBits` and `setRecordCount` of
  [src/game/object-fields.mjs](../src/game/object-fields.mjs) in the same way (block
  81): the record pointer through the data bank 80, the record in bank 7E (a pointer
  near FFFF reaches 7F); without a record the reads return the bytes at 7E:0000 and the
  writes change nothing. The register-level versions moved to the same reference module,
  which their proof plans and the Native58 dispatch run. The same test compares them
  (400 samples each; no record, Jake's state record, records in low WRAM, any pointer
  and pointers near the bank's end; the count with and without the health cheat and
  Jake's count maximum 0 or not); planted changes of the missing record test, the OR,
  the AND, the cheat guard, the property's high byte, byte 0's offset and the bank
  crossing fail it.
- The object armour natives 80:8EF5 (the armour word at 7E:43F8 plus the object as the
  result), 80:8AF1 (set), 80:8AFA (plus the second argument) and 80:8B08 (minus it, both
  wrapping in 16 bits) run `objectArmour`, `storeObjectArmour`, `raiseObjectArmour` and
  `lowerObjectArmour` of the same module (block 84), with their references in the same
  reference module; the same test compares them (400 samples each); planted changes of
  the sum, the difference, the stored high byte and the bank crossing fail it.
- The motion getters 80:A941, 80:A949 and 80:A951 (the X, Y and Z velocity) and 80:A959,
  80:A963 and 80:A96D (the X and Y position and the height over 4) run `objectVelocityX`
  to `objectCoarseHeight` of the same module through the data bank 80 (block 85), with
  their references in the same reference module; the same test compares them (400
  samples each); planted changes of the shift and of the Z table fail it.
- The script variable natives 80:CC07 (the variable at the byte offset of the first
  argument as the result), 80:CC10 (set to the second argument), 80:CC19 (its bits set)
  and 80:CC26 (only its bits kept) run `scriptVariable`, `storeScriptVariable`,
  `setVariableBits` and `keepVariableBits` of
  [src/game/script-variables.mjs](../src/game/script-variables.mjs) in the game's native
  table, as the object fields above (block 82): the words at 7E:3BBB plus the offset,
  an offset near FFFF reaching bank 7F. The register-level versions moved to
  proof/game-reference/script-variables.mjs for the proof plans and the Native58
  dispatch.
  [tools/script-variables-lift-functions.test.mjs](../tools/script-variables-lift-functions.test.mjs)
  compares both (400 samples each; the game's offsets, any offset and offsets near
  FFFF); planted changes of the OR, the AND, the stored high byte and the bank crossing
  fail it.
- The actor state natives 80:CB2B (the flag byte of the state record of the actor entry
  in the first argument), 80:CB3C (its count byte) and 80:CB4D (its property word) as the
  result, and 80:CB9F (the flag byte set), 80:CBB3 (its bits set) and 80:CBCB (only its
  bits kept) run `actorStateFlags`, `actorStateCount`, `actorStateProperty`,
  `setActorStateFlags`, `setActorStateFlagBits` and `keepActorStateFlagBits` of
  [src/game/actor-state.mjs](../src/game/actor-state.mjs) in the game's native table
  (block 83): the record address from the actor table 8D:B01F, the record in bank 7E;
  without a record the reads return the bytes at 7E:0001-0004 and the writes change
  nothing. The native wrappers keep the bug fix of Akimi's arrival flags and the exploit
  fix that keeps a defeated vampire defeated (src/game/bugfixes.mjs). The register-level
  versions moved to proof/game-reference/actor-state.mjs for the proof plans and the
  Native58 dispatch.
  [tools/actor-state-lift-functions.test.mjs](../tools/actor-state-lift-functions.test.mjs)
  compares both (400 samples each; table entries, Akimi's, the vampire's and any offset,
  the bug fixes and the exploit prevention on or off); planted changes of the missing
  record test, the vampire's guard, the OR, the AND and the property's high byte fail
  it, as does a dropped Akimi fix in tools/gameplay-bugfixes.test.mjs. A record address
  near the bank's end does not occur in the ROM's table.
- The modals 80:CD20 (pay the nuyen of the first argument: FFFF if paid, else 0; a
  low word too small borrows from a nonzero high word) and 80:CBF7 (the actor of the
  first argument, an entry offset in the actor table 8D:B01F, gets the holder of the
  second in its state record; none without a record) run `payNuyen` and
  `setActorStateHolder` of [src/game/script-records.mjs](../src/game/script-records.mjs)
  as script leaves (LIFTED_SCRIPT_NATIVES); the record address adds in 24 bits as the
  original's 7E:0003 plus the record. The register-level versions stay in
  src/task/native-modal.mjs for the proofs.
  [tools/script-leaves-lift-functions.test.mjs](../tools/script-leaves-lift-functions.test.mjs)
  compares them (400 samples each); planted changes of the borrow compare and of the
  missing record test differ.
- The script native 80:BBA0 (a group member faces the room's direction: byte 2 of the
  room record 8D:929D, one step on for the member at group index 2 and one back at 4,
  the step velocity of 80:BBFA and 80:BC0A, then 80:D15C with the walking action 2)
  runs `faceRoomDirection` of [src/game/member-facing.mjs](../src/game/member-facing.mjs)
  as a script leaf. 80:D15C (`setActionAndDirection`) runs the animation selection
  80:A985 unless already selected (`selectObjectAnimation`) and the turn 80:AAAF of
  src/game/object-turn.mjs, with the original's pushed words and return words on the
  stack (a record pointer far out of range reads them through the WRAM mirror of bank
  8D). The selection's doubling carries bit 15 into its addition as the original's ASL
  and ADC. The turn now reaches its fields through the data bank 80 like the original
  (src/system/data-bank.mjs) instead of stopping at `object_slot_required`, writes
  the selection none before it selects, and keeps the selection's unchanged check, which
  holds where that word lies in ROM. [tools/script-leaves-lift-functions.test.mjs](../tools/script-leaves-lift-functions.test.mjs)
  compares 80:BBA0 and 80:D15C (600 samples each, any selection and direction) with the
  register-level versions; planted changes of the second member's step and of the
  doubling's carry differ.
- With lag-free frames the script native 80:855E (remove an object from the fight list)
  runs `removeFromFightListSequence` of [src/game/fight-list.mjs](../src/game/fight-list.mjs)
  (`liftedFightListRemoveSequence` in src/game/main-upkeep.mjs): the gap closed, the
  first removal's formation countdown, the karma gain's notice with its number, text and
  sound, and the music choice, with the lifted notice, cursor, number, text, sound effect
  and music mode; A carries the values the original loads. Recorded waits replay the
  register-level native. No live session ends a fight yet, so
  [tools/fight-list-remove-lift-functions.test.mjs](../tools/fight-list-remove-lift-functions.test.mjs)
  compares the removal with the register-level native on random states (800 samples)
  with the same stand-ins for the callees, which record their A and direct page
  arguments; planted changes of the notice's width bound, the countdown and the music
  test differ.
- With lag-free frames the script native 80:8B43 (spend the first argument's low byte
  of the shown member's magic points, else the notice with text 1) runs
  `spendMagicPointsSequence` of [src/game/magic-points.mjs](../src/game/magic-points.mjs)
  with the lifted notice; recorded waits replay the register-level native.
  [tools/magic-points-lift-functions.test.mjs](../tools/magic-points-lift-functions.test.mjs)
  compares it on random states with a shared notice stand-in; planted changes of the
  payment bound and the notice rows differ.
- With lag-free frames the script native 80:CD9D (the dialog window word cleared, the
  glove put away 80:BCB2 and the window list 81:AD92, both lifted) runs
  `releaseGloveSequence` of [src/game/glove-release.mjs](../src/game/glove-release.mjs);
  recorded waits replay the register-level native.
  [tools/glove-release-lift-functions.test.mjs](../tools/glove-release-lift-functions.test.mjs)
  compares it with shared callee stand-ins; a planted dialog window value differs.
- With lag-free frames the script native 80:F953 (each frame the word wait 81:B0A1 and
  the pad word 80:9E1A, both lifted, until B, Y, Select, A or X is newly pressed) runs
  `waitForConfirmKeySequence` of [src/game/confirm-key.mjs](../src/game/confirm-key.mjs);
  recorded waits and inputs replay the register-level native, whose callees read the
  recordings and cannot be replaced, so
  [tools/confirm-key-lift.test.mjs](../tools/confirm-key-lift.test.mjs) checks the loop
  against its source contract (every confirming button after the other ones, the call
  sites, the balanced stack); a planted button mask differs.
- With lag-free frames the script native 80:8D0B (the action glove put on over the
  player figure, 80:BC36 with 80:BC67; each frame the word wait, the pad word and the
  glove movement 80:BE6D until A, B, X or Y is newly pressed; the object under the
  glove or FFFF in DP 00, the glove put away and the pad word once more) runs
  `chooseObjectUnderGloveSequence` of
  [src/game/glove-target.mjs](../src/game/glove-target.mjs) with the lifted word wait,
  pad word, glove movement and release; recorded waits and inputs replay the
  register-level native, which now takes the glove movement from its routine table
  when the table has one.
  [tools/glove-target-lift-functions.test.mjs](../tools/glove-target-lift-functions.test.mjs)
  compares it with shared callee stand-ins (300 samples, one to four frames, an object
  under the glove or none, any player slot); planted differences in the borrow chain
  of the glove position, the X offset, the choosing buttons, the Y left and the kind
  copy fail it.
- With lag-free frames the script natives 80:9BC6 (the choice in reach 80:9C40, the
  slot turned into the object's number), 80:9BB9 (80:9BC6 with the script's mark
  7E:1D6D) and 80:9C33 (80:9C40 with the mark) run `chooseObjectNumberSequence`,
  `scriptChooseObjectNumberSequence` and `scriptChooseObjectSequence` of
  [src/game/glove-target.mjs](../src/game/glove-target.mjs). 80:9C40 takes the object
  under the glove only when the summed X and Y distances and the height distance are
  each below 81; a farther one shows the out-of-reach notice (lifted 80:FEC1) and
  counts as none; the window list 81:AEB0 is redrawn unless a member menu is open. The
  same test compares them (300 samples each, half with the object near the player
  figure, the member menu open or not); planted differences in the height test, the
  notice's top, the menu test, the object number, the mark's clear, DP 6B, the Y left,
  the distance's negation and the list's first window fail them.
- With lag-free frames the script native 80:9BD3 (an open member menu's dialog closed
  with the lifted 80:92C5, the window list prepared 81:AEB8 with the lifted window map
  81:A9B2 and upload request 81:ACB5, the spell glove put on 80:BC99, then the glove
  frames until an object with bit 15 of its flags or none is chosen; the slot or FFFF
  in DP 00 and 7E:1FD2) runs `spellGloveTargetSequence` of
  [src/game/glove-target.mjs](../src/game/glove-target.mjs). The window list module
  now offers the map unpack and the upload request for routine tables
  (`runUnpackWindowMap`, `runRequestUpload`, the latter lifted with lag-free frames and
  returning with its RTL). The same test compares it (300 samples, the object's flags
  drawn each frame); planted differences in the flag test, the stored FFFF, the
  list's first window, the dialog test, the X left and the glove kind fail it. No
  live session reaches the spell glove; the upload request's table form is checked by
  review only (the same steps as the JSL form without the caller's frame).
- With lag-free frames the script native 80:C724 (the motion record of the object DP 00
  set to mode 0, the window list prepared, the action glove's frames, the list redrawn
  81:AEB0, then the glove's position projected back onto the floor with the camera and
  the object's height into the record's Y and X, active 1, and the glove put away) runs
  `choosePlaceWithGloveSequence` of
  [src/game/glove-target.mjs](../src/game/glove-target.mjs). The same test compares it;
  since this block the stand-ins record the flags N, V, Z and C at every call too, so
  the overflow of the glove position, the reach sums and the floor place is lifted as
  well. Planted differences in the half pixel, the halving's carry, the active word,
  the mode, the height's slot, DP A5, the redraw, the carry and overflow left and the
  flags of the object index fail it.
- With lag-free frames the shooting natives 80:8AB5 (an object shoots with the shot's
  values from DP 04 to 0A), 80:8A51 (the player figure shoots with its weapon at the
  object under the glove, which is marked as attacked) and 80:8A8C (an object shoots
  with its own weapon) run `shootAtObjectSequence`, `shootAtGloveTargetSequence` and
  `shootWithOwnWeaponSequence` of
  [src/game/object-shoot.mjs](../src/game/object-shoot.mjs): the weapon 80:8860 with its
  shot sound 80:88EB, the line of sight 81:A25F with the low box 80:8A43, the facing
  80:8497 and the hit roll 80:8904 with the miss marker 80:89B0. Game state only
  (user, 2026-11-14): the script interpreter replaces A, X, Y and the flags after the
  native, so the natives leave none; the line of sight
  ([src/game/line-of-sight.mjs](../src/game/line-of-sight.mjs), without its direct page
  working bytes 7E:000E-006C, user decision 2026-11-13), the random numbers
  (src/system/random.mjs, with the range and mask in DP 02 and 04), the object slot
  80:A835, the turn 80:AAAF and the sound 80:C46E run lifted as plain calls. Only the hit 80:8691
  (lifted, below; its notices wait for frames) runs through its JSR frame from the
  routine table, with the damage in A, the target in X and the shooter in Y. [tools/object-shoot-lift-functions.test.mjs](../tools/object-shoot-lift-functions.test.mjs)
  runs the register-level natives with their real callees against the lifted ones (400
  samples each; a cell list with boxes on the shot's line, a free heap block for the
  miss marker's task, the shooters' direction tables in ROM, small bonuses and range
  penalties) and a hit stand-in that records its inputs (`calleeRecord`); WRAM outside
  the stacks, the sight's working bytes and the sample loader's scratch, the device
  writes and the return must be equal. Planted differences in the low box's step and
  floor, a blocked sight, the attacked mark, the ranged bonus's rounding, the penalty's
  sign, the facing, each borrow of the roll, the miss's armour word, the kind 5 damage,
  the reach bound, the random mask, the hit's Y, the glove's blocked result, the shooter
  word and the sound level fail it. The live comparison of
  [tools/script-native-lift.test.mjs](../tools/script-native-lift.test.mjs) (80:8AB5 on
  the club route) ignores the sight's working bytes.
- With lag-free frames the script native 80:8E36 (every object slot from the last down
  to 0 hit by 80:8691 with the damage DP 02 and no shooter when it holds an object
  that can be hit within 60 of the centre DP 00 on each axis) runs
  `hitObjectsInBlastSequence` of [src/game/object-blast.mjs](../src/game/object-blast.mjs)
  with the hit from the routine table (since block 78 the lifted hit below, `runHitObject`
  of src/game/main-upkeep.mjs; its notices pause in the scheduler's continuation; the
  shooting natives use it too). The register-level native takes the hit from a routine table
  when given one, so
  [tools/object-blast-lift-functions.test.mjs](../tools/object-blast-lift-functions.test.mjs)
  compares both with a shared stand-in (400 samples; objects or none, hittable or not,
  near the centre on some axes, any centre word). Planted differences in the reach
  bound, the overflow, the hittable test, the kind's sign, the height axis, the
  shooter word, the Y restored and the damage fail it. No live session reaches a
  blast.
- With lag-free frames the hit 80:8691 with the player hit 80:881C (called with JSR by
  the shooting natives and the blast: the damage in A, the target in X, the shooter in
  Y) runs `hitObjectSequence` of [src/game/object-hit.mjs](../src/game/object-hit.mjs):
  harmless hits counted with the warning and the karma penalty, the damage drawn below
  the damage plus 1 less the armour byte, the record's count or the root task's event
  bit 11, the hit effect and impact objects and the player figure's sound, shake and
  window list. Game state only: the random number 80:C51F
  (`drawBelowInDirectPage` of src/system/random.mjs, now shared with the shots), the
  object slots 80:A835 and the sound 80:C46E run lifted as plain calls; the notices'
  window 80:F963, text 80:FE69, word waits 81:B0A1 (X keeps the original's count), key
  wait 80:F953 and release 80:FA3E and the window list 81:AD92 run lifted through their
  frames from the routine table. The register-level hit takes those callees from a
  routine table when given one, so
  [tools/object-hit-lift-functions.test.mjs](../tools/object-hit-lift-functions.test.mjs)
  compares both with shared stand-ins that record their inputs (600 samples; damageable,
  harmless or neither targets, hit counts before both notices, karma around the
  penalty, records or none, task chains or a negative task, a shooter or none, the
  player figure hit or not). Planted differences in the wait count, the karma bound, the
  damage's sign, the count's floor and zero, the negative task's store, the root walk,
  the event bit, the impact height and facing, the stun, the effect armour and its
  carry, the results, the warning count, the shooter word, the sound, the text pointer
  and the window rows fail it. The live comparison of
  [tools/script-native-lift.test.mjs](../tools/script-native-lift.test.mjs) runs the
  lifted hit inside 80:8AB5.
- With lag-free frames the script native 80:E1CF (with learned spells a window
  80:F963, the spells' names after Exit as a menu 80:A6C7, the chosen spell or 0; the
  window DP 0E released 80:FA3E in every case) runs `chooseSpellSequence` of
  [src/game/spell-choice.mjs](../src/game/spell-choice.mjs) with the lifted window,
  plain menu and release of the Yes/No question.
  [tools/spell-choice-lift-functions.test.mjs](../tools/spell-choice-lift-functions.test.mjs)
  compares it with the register-level native and shared stand-ins (400 samples; none
  to eight spells, rows, Exit, cancels and 8000). Planted differences in the list's
  carry, the row's carry and index, the Exit test, the list end, the window's zero
  attributes, the kept window and the pushed result fail it. No live session reaches
  the spell choice.
- With lag-free frames the script native 80:F254 (a member's spell menu: the object
  DP 00's runner looked up, the record pointer DP F9 at its skills, then 80:E693 with
  the known spells after Exit in a window menu; a leader's choice selects the spell,
  another member's appends and visits its script as a nested round, then redraws and
  waits as the script asks) runs `openSpellMenuSequence` and `spellMenuSequence` of
  [src/game/member-spell-menu.mjs](../src/game/member-spell-menu.mjs) with the lifted
  window, plain menu, releases and equipment rows 80:E9C5 (below); the script append
  and visit stay register-level; the window list 81:AEB0, the key wait 80:F953 and the
  portrait 80:E4B3 runs
  lifted (below) run lifted. The register-level native takes the menu, portrait and equipment
  window from its routines when present, so
  [tools/member-spell-menu-lift-functions.test.mjs](../tools/member-spell-menu-lift-functions.test.mjs)
  compares 80:F254 (with its menu and with the menu as a stand-in), 80:E693 and the
  status screen's entry 80:E68E with shared stand-ins (400 samples each; Jake's WRAM
  record or a ROM record, none to all spells, rows, Exit and negative words, the
  leader or another member, scripts asking for a redraw or not, notice windows open or
  not). Planted differences in the level name's overflow, the leader compare's carry,
  the window rows, the level pointer column, the list end, the leader's selection,
  the notice window step, the redraw clear, the dialog end, the script mark, the
  record bank's A and sign, the object in Y and the runner step fail it.
  [tools/live-nested-round.test.mjs](../tools/live-nested-round.test.mjs) runs the
  lifted menu's nested round live, pausing and synchronous.
- With lag-free frames the script native 80:E014 (one frame of the player's control:
  Select, Start and Y open the party status 80:ED3C, the status screen 80:EA89 and its
  item list 80:EA8E; without a glove the pad walks and turns the leader 80:DEC7 or A,
  X, B, L and R put on the crosshair, spell or action glove with their notices; with a
  glove the leader faces it 80:DF6B and the aim gives its buttons or ends) runs
  `controlPlayerSequence` of [src/game/player-control.mjs](../src/game/player-control.mjs),
  which reuses the glove placement of
  [src/game/glove-target.mjs](../src/game/glove-target.mjs). Its table has the lifted
  window, text, release, glove release and turn and the lifted party status (below);
  the status screen and item list (`runStatusScreen` and `runItemList`, lifted, below)
  the key wait 80:F953 and the animation selection 80:A985 (`selectAnimationRoutine` of
  [src/game/object-turn.mjs](../src/game/object-turn.mjs), game state only; its own case
  in [tools/script-leaves-lift-functions.test.mjs](../tools/script-leaves-lift-functions.test.mjs))
  run lifted. The register-level native takes those three from
  its routines when present, so
  [tools/player-control-lift-functions.test.mjs](../tools/player-control-lift-functions.test.mjs)
  compares both with shared stand-ins (600 samples; single, double and random button
  words, glove open or not, idle or not, armed or not, spells none, Summon spirit or
  other, aims, tagged targets and weapon kinds). Planted differences in the rotation's
  overflow, the direction carries, the idle clear, the heavy weapon's carry, the next
  aim action, the borrow of the glove facing, its A, carry and overflow, both buttons,
  the Summon spirit carry, the aimed target and the notice's leader fail it.
  [tools/script-native-lift.test.mjs](../tools/script-native-lift.test.mjs) runs it on
  the club route against the register-level native.
- The equipment rows 80:E9C5 of the status window (the leader's selected spell, the
  weapon's name, the armour rating with the leader's dermal armour bonus and the
  armour's name, each row blanked first; the item names through 80:E9A8) run
  `equipmentRowsSequence` of
  [src/game/equipment-window.mjs](../src/game/equipment-window.mjs) as `runEquipmentRows`
  of the spell menu's table, with the lifted cursor, text and number.
  [tools/equipment-window-lift-functions.test.mjs](../tools/equipment-window-lift-functions.test.mjs)
  compares it with the register-level routine and shared stand-ins (400 samples; the
  leader or not, dermal armour or not, items none, listed or any word, ratings past a
  byte). Planted differences in the item index's shift carry and overflow, the DP 6B
  scratch, the leader compare's carry, the bonus's flags, the rating's byte and the X
  left fail it. The status screen 80:EA6E keeps its register-level rows.
- The member portrait 80:E4B3 (the dialog's portrait record unpacked and uploaded, the
  second portrait channel 80:E48D with its HDMA words and one more NMI job, then the
  colour window 80:E433 on HDMA channel 0 opening over eleven frames with the edges of
  80:E41F) runs `memberPortraitSequence` of
  [src/game/member-portrait.mjs](../src/game/member-portrait.mjs) as `runMemberPortrait`
  of the spell menu's table, with the lifted word wait and (since block 79) the dialog's
  lifted unpack 80:9F6D, row shift 80:8F20, first upload 80:9022 and DMA job 80:8FF5 of
  [src/game/portrait-upload.mjs](../src/game/portrait-upload.mjs), which keep the
  register interface of the register-level ones.
  [tools/member-portrait-lift-functions.test.mjs](../tools/member-portrait-lift-functions.test.mjs)
  compares it with the register-level routine and shared stand-ins (400 samples; the
  portraits of the dialogs and any word), port writes included; a second case runs the
  real unpack and row shift on both sides (100 samples), where a skipped row shift or a
  shifted unpack offset fails it. Planted differences in
  the A left by the edges, the HDMA target port, the NMI job, the portrait index's carry,
  the HDMA table, the record bank byte in Y and the edge compare's sign and zero fail
  it; the left edge's carry from the right edge never occurs with the edges up to 20.
- The skills and notes submenus 80:E834 and 80:E8C8 of the status screen (the known
  skills with names and values, Select ending the screen; a runner's datajack, or
  Jake's head computer, datajack and cyberware) run `skillsSequence` and
  `notesSequence` of [src/game/status-submenus.mjs](../src/game/status-submenus.mjs)
  with the lifted window, cursor, text, number and release. The register-level status
  screen now takes a submenu of its jump table ED2E from its routines when present (a
  tail call through the frame of its JSR to ECEA); the player control's status screen
  entries 80:EA89 and 80:EA8E run with them.
  [tools/status-submenus-lift-functions.test.mjs](../tools/status-submenus-lift-functions.test.mjs)
  compares both with the register-level routines and shared stand-ins (400 samples;
  Jake's WRAM record with none to six skills or a ROM record, Jake or another member,
  a datajack or none, each cyberware or none, Select pressed or not). Planted
  differences in the A without skills, the window rows, the name's carry, the row
  step, the last compare's flags, the Select test, Jake's compare carry and the
  cyberware rows fail them.
- The item submenus 80:E572, 80:E577 and 80:E57F (80:E585: the items of the chosen
  class that the story stage allows and the shown member holds, after Exit in a window
  with a numbered menu 80:A6AD, rebuilt after each use) and the item use 80:E4F3 (the
  actor's object created at a quarter of the member's position with its depth flags,
  its task visited as a nested round, then portrait, key and equipment rows) run
  `itemMenuSequence` and `useItemSequence` of
  [src/game/item-menu.mjs](../src/game/item-menu.mjs) in the player control's status
  screen, with the lifted window, releases, portrait, equipment rows, numbered menu
  80:A6AD, redraw 80:FA67, key wait 80:F953, object creation 80:A835 and window list
  81:AEB0; the visit 80:C1CA stays register-level. The
  register-level routines take the item use, portrait and equipment rows from their
  table when present. The list reads the class and member for each actor as the
  original does: a long list overwrites them.
  [tools/item-menu-lift-functions.test.mjs](../tools/item-menu-lift-functions.test.mjs)
  compares the three entries and the item use with shared stand-ins (200 samples each;
  the member holding a share of the actors' records, story stages, items at once or
  not, rows, Exit, cancels and bit 15). Planted differences in DP 02, the single count,
  the empty test's carry, the loop's borrow, the list end, the row's carry, the Y
  left, the depth order and its overflow, the position's carry, the redraw clear and
  the dialog end fail them.
- The window list from the first window 81:AEB0 (the first index 0200 cleared, the list
  81:AD92 by its JSL at 81:AEB3, RTL) runs `runResetWindowList` of
  [src/game/window-list.mjs](../src/game/window-list.mjs) with the lag-free frame model
  (else the register-level routine), and the object creation 80:A835 runs
  `createObject` of [src/game/object-create.mjs](../src/game/object-create.mjs) as a JSR
  callee (`runCreateObject`), in the item use, the spell menu and the shooting natives.
  The menus' tables also take the lifted numbered menus 80:A6AD and 80:A6B8, the tile
  clear 80:FA67 and the confirm key wait 80:F953. The live club route, the alley
  upkeep session and the item and spell menu function tests pass with them; no live
  test uses an item or casts a spell from the menu.
- The decimal number 80:FDCF (DP 04:02 by repeated subtraction of the powers of ten
  80:FE45, digits after the first non-zero one with commas after the billions, millions
  and thousands, then the remainder, 0D and 0, printed by 80:FB39 with the data bank
  7E) runs `decimalNumberSequence` of
  [src/game/decimal-number.mjs](../src/game/decimal-number.mjs) in the player control's
  status screen with the lifted text buffer; the register-level screen takes it from
  its table when present.
  [tools/decimal-number-lift-functions.test.mjs](../tools/decimal-number-lift-functions.test.mjs)
  compares it with a shared stand-in that records the data bank too (400 samples; any
  32-bit number, small ones and ones next to a power of ten). Planted differences in
  DP A2, the leading zeros, the commas, the last digit's carry and overflow, the bank
  restored and the text end fail it; A's high byte is always 0.
- The status screen 80:EA6E (script native, object DP 00 kept on the stack over the
  notice release), 80:EA89 (Start) and 80:EA8E (Y, the item submenu at once): sound
  dimmed, the object or the leader looked up in the group and among the runners, the
  status window with the attribute rows, state count, magic points, Jake's karma and
  money, the equipment rows and portrait, then the menu with the submenus of 80:ED2E
  until one ends the screen, and the cleanup. It runs `statusScreenSequence` of
  [src/game/status-screen.mjs](../src/game/status-screen.mjs) in the lifted player
  control and, with the `lifted` parameter of its observed wrapper, as the script
  native 80:EA6E (lag-free frames). Its table has the lifted submenus (the spell menu's
  entry 80:E68E too), releases, glove, window, plain menu, cursor, text, numbers,
  equipment rows, portrait, sound command 81:F007 (`sendApuCommandRoutine`), colour
  reset 81:886A and closing 80:92C5; nothing in it stays register-level. Two live differences of the first lifted version are resolved: the
  lifted equipment rows kept armour, rating and weapon in variables and the lifted
  portrait ran 80:E48D and 80:E433 inline, so the text and word waits inside them took
  their NMIs 2 to 6 bytes higher on the stack than the original (the lag list of
  [tools/mesen-live-room.test.mjs](../tools/mesen-live-room.test.mjs) compares S at each
  NMI). Both now push the words and the JSR frames as the original does, and their
  function tests record S and the pushed words at each call. The wheel step of
  [tools/live-mouse.test.mjs](../tools/live-mouse.test.mjs) waited a fixed 60 NMIs after
  the screen opened: the register-level screen ran its setup synchronously within one
  live step, the lifted one takes one step per NMI, and the setup lasts about 100 NMIs
  in both and in the original; the test now waits from the press.
  The register-level screen takes the equipment rows and portrait from its table when
  present. A leader outside the group stops at `task_ea6e_endless_search`, as before.
  [tools/status-screen-lift-functions.test.mjs](../tools/status-screen-lift-functions.test.mjs)
  compares the three entries with shared stand-ins (600 samples; the object or the
  leader in the group or neither, Jake or another member, items at once, menu rows,
  Exit and cancels, submenus ending the screen, a cursor that lowers the index kept in
  DP 6B). Planted differences in karma's carry, the skipped record byte, the pushed
  object, the leader's stop, the alternate portrait, the magic index carry, the
  negative row, the mark cleared, the glove test, the index re-read, the overflow and
  the items-at-once exit fail it. On the live club route of
  [tools/script-native-lift.test.mjs](../tools/script-native-lift.test.mjs) the Y press
  runs the lifted 80:EA8E; 80:EA6E is not on that route.
- The karma line 80:EF82 (the balance window redrawn with "Karma" and the karma 7E:3C11
  divided by eight, kept in DP 17) and the step purchase 80:F006 (eight times the value
  byte at the long pointer DP 0E from the karma, the byte raised by one with an 8-bit
  A; too little karma shows its notice until a key and clears DP 0E) run
  `karmaLineSequence` and `buyStepSequence` of
  [src/game/karma-menu.mjs](../src/game/karma-menu.mjs). The register-level karma menu
  and lists take them from their table when present; they run live with the lifted main
  menu.
  [tools/karma-menu-lift-functions.test.mjs](../tools/karma-menu-lift-functions.test.mjs)
  compares both with shared stand-ins (400 samples each; values in either WRAM bank,
  small values, karma below, at or above the cost). Planted differences in the karma's
  carry, DP 17, the cursor row, the overflow, the equal karma, A's high byte, the byte
  sign, the cost and the cleared pointer fail them.
- The karma lists 80:F054, 80:F0F3 and 80:F1B5 (`KARMA_LISTS`: the header text, then
  after Exit the values that are not zero and below their limits with their names and
  indices, the cursor DP 1A back on Exit when the row count changes, the numbered menu
  80:A6B8 in the redrawn list window; a row buys a step and shows the karma again; a
  Body step also raises 7E:3C00 by ten with an 8-bit A and the leader's state count
  over 80:CECB) run `karmaListSequence` of
  [src/game/karma-menu.mjs](../src/game/karma-menu.mjs). The same function test runs
  each list (400 samples each; values none, below, at or above their limits, menu
  rows, Exit, cancels and purchases that clear DP 0E). Planted differences in both
  Exit headers, the limit compare, the row index, the Y left, the list end, the cursor
  reset, the row count compare, the menu's start row, the negative row, the count
  maximum's carry and overflow, the Body compare and the bank word fail it.
- The karma menu 80:EE57 (notice release, glove, Jake's record at DP F9, the balance
  and category windows with the karma line, the category menu 80:EF78; a category
  opens the header and list windows, runs its list and releases them; Exit or FFFF
  releases the windows and tops up the leader's state count and magic points) runs
  `karmaMenuSequence` of [src/game/karma-menu.mjs](../src/game/karma-menu.mjs); the
  register-level menu takes the lists from its table when present. The function test
  runs it with stand-ins for the lists too and records S at every call, since the row
  stays on the stack over the detail windows (400 samples; Exit, FFFF, each list row
  and another negative row). Planted differences in the pushed and pulled row, the
  cancel compare, the second row compare, the third list, the bank byte, the top-up
  argument, the header release and a negative row taken as a cancel fail it. The
  loads of Jake's record leave A and flags that the window's stores replace: the
  lifted menu does not set them.
- The main menu 80:CE6D (its window 0A/0A/0C/05 in 1CED with the menu 80:CEC3, the
  choice kept on the stack over the window's release; save or karma, back to the
  menu; Exit or a cancel ends) and the save menu 80:CDD6 (a running countdown shows
  "Cannot save now" until a key; else the slots after Exit, or the port's list for
  four slots, and a slot n saves slot n - 1 with the lifted save 81:B17D, `saveGame` of
  [src/game/save-slots.mjs](../src/game/save-slots.mjs), then sound 36) run `mainMenuSequence` and `saveMenuSequence` of
  [src/game/main-menu.mjs](../src/game/main-menu.mjs) as the script native 80:CE6D
  (the `lifted` parameter of its observed wrapper, lag-free frames). Its table has the
  lifted save and karma menus, lists, line, purchase, window, text, cursor, number,
  releases, glove, plain menu, window redraw 80:FA67, key wait 80:F953, numbered menu
  80:A6B8, sound effect, state count and magic points (lifted bodies, below). The register-level main
  menu takes the save and karma menus from its table when present.
  [tools/main-menu-lift-functions.test.mjs](../tools/main-menu-lift-functions.test.mjs)
  compares both with shared stand-ins and the SRAM (300 samples each; countdown
  running or stopped, Exit, FFFF, both slots and another negative row). Since
  2026-11-14 it compares game state only: the stand-ins record their direct page
  arguments, and the save routine's direct page scratch 0E-15 is ignored. Planted
  differences in the saved slot, the countdown test, the sound level, the object FFFF,
  a negative row, the save list, the kept window, the key wait, the checksum's range
  and the copy's offset fail them. 80:CE6D is not on the live
  club route of [tools/script-native-lift.test.mjs](../tools/script-native-lift.test.mjs);
  no live plan opens the main menu yet.
- The party status 80:ED3C (Select in the player control: the glove put away, the
  notice windows released, a window of five rows plus half the group's last index with
  that halving's carry, then per member the name, state count with its maximum and
  magic points with ten times the magic byte as maximum, a key and the release) runs
  `partyStatusSequence` of [src/game/party-status.mjs](../src/game/party-status.mjs)
  as `runPartyStatus` of the player control's table, with the lifted releases, window,
  text, cursor and number.
  [tools/party-status-lift-functions.test.mjs](../tools/party-status-lift-functions.test.mjs)
  compares it with the register-level routine and shared stand-ins (400 samples; one to
  four members, odd and larger last indices, the leader alone or not, unknown members).
  Planted differences in the rows' carry, the maximum's overflow, the row halving's and
  the runner halving's carries, the record pointer's step, the end compare's sign and
  zero, the X left, the state count's offset and the runner search's end fail it.
- The runner state natives 80:CECB (raise a member's state count, at most its maximum)
  and 80:D079 with 80:D08A (refill every runner's magic points and state count) run
  `raiseStateCount` and `restoreRunners` of
  [src/game/runner-state.mjs](../src/game/runner-state.mjs) before their window list
  81:AD92; the natives' sequences take the body as a parameter, so the register-level
  bodies in proof/game-reference/runner-state.mjs run with the same window list call
  (the original instruction tests use them). The bodies leave the original's direct page
  values (the record pointer 6B-6D, the maximum 04, the doubled magic 68).
  [tools/runner-state-lift-functions.test.mjs](../tools/runner-state-lift-functions.test.mjs)
  compares the bodies on random states; planted changes of the magic factor and the
  maximum differ.
- The magic point raise 80:CF2E (a leaf native: the member found as for the state
  count, its magic points raised by the second argument, at most ten times its magic
  attribute) runs `raiseMagicPoints` of
  [src/game/runner-state.mjs](../src/game/runner-state.mjs) in the game's native table,
  so the main menu's top-up and the script native run it lifted. It leaves the
  original's direct page values (the record bank 6D, the doubled magic over 6B, the
  maximum 04), not its registers. The register-level version moved to
  proof/game-reference/runner-state.mjs; the proof plan of 80:CF2E, the Native58
  dispatch of proof/task/native-dispatch.mjs and the instruction test of
  [tools/task-native-m1d.test.mjs](../tools/task-native-m1d.test.mjs) run it. The same
  function test compares both on random members (600 samples); planted changes of the
  points index, the doubled magic's width, the amount's width and the bank fail it.
- The sight natives 80:8BC5 (an enemy's target in the group), 80:8C08 (the nearest
  group member the object sees), 80:8C8D (a random target of the fight list) and
  80:8CCF (whether an object can attack another) run
  [src/game/combat-targets.mjs](../src/game/combat-targets.mjs) with the line of sight
  81:A25F lifted in [src/game/line-of-sight.mjs](../src/game/line-of-sight.mjs): the
  bounding box test, the edge products and the height at the meeting edge on the
  hardware multiplier and divider at the original sites. The original's last edge test
  compares the box record's offset (CPY) instead of the product it reads; the lifted
  code keeps that. User decision 2026-11-13: the line of sight's direct page working
  bytes 7E:000E-006C are not produced (no caller of these natives reads them, including
  the low box mark 68, which `lineOfSight` returns); the comparisons ignore them after
  these natives (`inLiftedScratch` in tools/lifted-script-natives.mjs). The random draw's
  range and mask (direct page 02 and 04) and the distances of 80:8C08 (A2, A5, A8) stay.
  The register-level versions stay in proof/game-reference/enemy-target-choice.mjs,
  src/task/native-combat.mjs and src/task/line-of-sight.mjs (also called by the
  shooting natives 80:8AB5, 80:8A51 and 80:8A8C).
  [tools/sight-lift-functions.test.mjs](../tools/sight-lift-functions.test.mjs) compares
  the four natives (600 samples each) and the line of sight itself (3000 samples: the
  carry, the low box mark and the multiplier and divider writes with their sites) with
  the references; planted changes of the record offset compare, the eye height, the low
  box mark, the falling subtraction and a site differ.
- With lag-free frames (the live game) the script natives 80:FEC1 (notice), 80:FF79
  (release the notice windows), 80:CDA8 (redraw the dialog window's list), 80:936C
  (dialog), 80:9BA0 (action menu), 80:935B and 80:933A (a text number printed into the
  dialog's text window, 933A after clearing it and setting its cursor; `printWindowTextSequence`
  and `printTopicTextSequence` of src/game/dialog-text.mjs) and 80:CD43 (the Yes/No
  question: `askYesNoSequence` of src/game/yes-no-question.mjs with the lifted window,
  plain menu 80:A6C7 and release) run the lifted sequences: `liftedScriptActionSequence`
  (`chooseScriptActionSequence` of src/game/action-menu.mjs: no override, the mask
  from the first argument, the lifted menu 80:99EB, the chosen flag as the result), `redrawDialogWindowListSequence` of
  src/game/window-list.mjs, `liftedTalkSequence` (`talkSequence` of
  src/game/dialog-talk.mjs with `DIALOG_ROUTINES`), `liftedNoticeSequence`
  (`showNoticeSequence` of src/game/notice-show.mjs with the lifted window, text and
  release of `TEXT_ROUTINES` in src/game/main-upkeep.mjs) and
  `releaseNoticeWindowsCallSequence` of src/game/window-release.mjs, each ending with
  the native's RTS. The observed natives take the lifted sequence as a parameter
  (`showNoticeNative`, `releaseNoticeWindowsNative` and their continuations in
  src/vm/special-natives.mjs); recorded waits (the Mesen replays and the native proofs)
  replay the register-level versions. [tools/script-native-lift.test.mjs](../tools/script-native-lift.test.mjs)
  runs the route of BADGE_OFFER_LIVE_PLAN from the title through the alley to the club
  (14161 NMIs; from scripts three notices, one release, 20 list redraws, two dialogs, one action menu and two topic texts and one question answered Yes, so a changed No branch does not
  show; 80:935B is not on the route and
  shares the text print with 80:933A) with the lifted and the
  register-level natives in SPECIAL_NATIVES and SPECIAL_NATIVE_CONTINUATIONS
  (`compareLift` with `swap`); every NMI is equal, and planted changes of the notice's
  frames, of the first window index after the release and on the dialog's path and of the action menu's result differ;
  the list's first argument (direct page 00, in the session's ignored scratch) is not
  read by the list.
- The register-level script natives (SPECIAL_NATIVES in src/vm/special-natives.mjs)
  call the window list 81:AD92 and the window release 80:FA3E lifted with the lag-free
  frame model: their routine tables bind `runDrawWindowList` and
  `runReleaseWindowCall`, their inline calls `drawWindowListJslSequence` and
  `releaseWindowJsrSequence`. The caller pushes the JSL or JSR frame as before; the
  lifted callee returns with its RTL or RTS as { rawReturnWord, returnTarget }, which
  the callers check. With recorded interrupt observations (the Mesen replays and the
  native proofs) the register-level versions in src/task/native-render-compose.mjs
  replay them. Live comparison (per-NMI WRAM outside the cutscene scratch and stacks,
  VRAM, CGRAM, OAM, PPU registers, scroll, PPU write count and sound RAM) with the
  register-level versions: the alley plan (9201 NMIs, 23 list and 4 release calls) and
  the route of BADGE_OFFER_LIVE_PLAN through the club (14161 NMIs, 27 list and 12
  release calls) are equal at every NMI; a planted WRAM change after the release
  differs at 54 NMIs.
- The notice 80:FEC1 and the glove release 80:BCB2 run lifted from the time limit
  and the glove action (`UPKEEP_ROUTINES` in src/game/main-upkeep.mjs; other callers
  keep the register-level versions). The notice calls the window opening 80:F963 and
  the text 80:FE69 register-level from the routine table, and releases a replaced
  window with the lifted 80:FA3E below the slot the original pushes; it leaves A the
  window with its sign and zero, X the slot, and Y, the carry and the overflow of the
  last frames comparison or of the callee that ran last. The flags before its calls
  are not produced (none reads them). A text number past bank 80 stops at
  `notice_text_required`. The glove release leaves A the target tag and the other
  registers unchanged without a target, else those of the name window release.
- The time limit runs the text cursor 80:FAAC and the number 80:FD80 lifted
  (`UPKEEP_ROUTINES`); the menus and lists keep the register-level versions. The
  products and quotients run on the hardware multiplier and divider through the port,
  at the original instructions' sites. Both push the data bank and the bank pair (PHB,
  PEA, PLB, PLB) and leave those bytes below the stack. The cursor leaves A 0, X the
  window, Y unchanged, the sign and zero of the bank byte and the carry and overflow of
  the product's addition; the number calls 80:FB39 register-level from the routine
  table with the data bank 7E, A 0, X the end of the digits and Y the moved bytes (Y
  unchanged with five digits), and leaves FB39's registers with the sign and zero of
  the bank byte. The flags before FB39 are not produced (it reads none).
- The text 80:FE69 runs lifted from the time limit and from the notice of the time
  limit and the glove action (`UPKEEP_ROUTINES`, forwarded to the notice). The bit
  reader 81:AF04 is a function of it; the bytes of its last JSL frame and of its last
  refill push (A, the code tree index) stay below the stack, as the data bank and the
  bank pair (PHB, PEA, PLB, PLB). It calls 80:FB39 register-level from the routine table
  with the data bank 7E, X and Y the text's length and A the last node with its bytes
  swapped, and leaves FB39's registers with the sign and zero of the bank byte.
- The text buffer 80:FB39 runs lifted from the lifted text and number (and from the
  object search of the lifted glove movement, which prints the name with the lifted
  text: `MOVE_ROUTINES`; callers that do not pass their table on get `TEXT_ROUTINES`).
  It tracks A, X, Y, the carry and the overflow as the original and leaves them so, A
  0 with zero set and sign clear. Its upload requests run lifted with the lag-free
  frame model, below the frames of their two JSLs with A the request word and the
  original's X, Y, carry and overflow at the NMI; otherwise (recorded observations) the
  register-level requests run through their frames (`textRequestWaitSequence`), and
  with recorded interrupts inside a glyph (`startupInterrupts`) the register-level
  routine runs. The frames of the geometry and mask calls and the routine's own pushes
  (PHP, PHX, PHA) are not reproduced.
- The window opening 80:F963 runs lifted from the notice, the action menu and the object
  search (`TEXT_ROUTINES`, `MOVE_ROUTINES`). It leaves X the window, A 0 with zero set,
  and Y, the carry and the overflow of the window drawing (its last map row), as the
  original; past the last window index X the index with the carry set. The tile request
  waits lifted with the lag-free frame model below its JSR and JSL frames (A the request
  word, the original's X, Y, carry and overflow); otherwise the register-level request
  80:FA67 runs through its frame. The map upload is window-list.mjs's
  (`requestUploadCall`), which now also sets the program bank 81 at its wait for a
  caller in bank 80. The window drawing's own pushes are not reproduced.
- The action menu 80:99EB runs lifted from the glove action. It passes the window
  opening A 0, Y the table index and a clear carry and overflow, the menu the original's
  A and Y, and pushes the chosen flag around the release; it leaves A the flag with its
  sign and zero and the release's X, Y, carry and overflow (without an accepted action
  A 0, Y the index and the carry clear). The script's native 13 (80:9BA0) keeps the
  register-level menu.
- The object search measures the name with the lifted text width 80:FADD (the glove
  natives keep the register-level one). It leaves A the width with its sign and zero, X
  the last tree or table index and Y unchanged, and the bytes of its last calls below
  the stack (the bit reader's JSL frame and refill push, a later width step's JSR
  frame); the search replaces the carry and overflow. The glove action's pad word
  80:9E1A (after the release and after the out-of-reach notice) is the lifted entry of
  the top of the loop (`runPadPresses`, register-level without lag-free frames).
- The dialog 80:936C runs lifted from the glove action with its own callee table
  (`DIALOG_ROUTINES`: the register-level dialog parts of TALK_ROUTINES with the lifted
  glove release, window opening, window release `runReleaseWindow` and word wait); the
  glove action's table is not passed on. It passes each callee the original's A, X and
  Y and the carry of its own shifts and comparisons, keeps the old music (or FFFF) and
  both windows on the stack as the original, and leaves the registers of its last
  callee with A the pulled music word. The script's native 13 path (80:9BD3) keeps the
  register-level dialog. Its table also binds the lifted colour clear 81:886A, text
  width 80:FA92, sprite list 80:B8DE and the notice windows' release 80:FF79 with
  registers (A the last slot's window or FFFF, X FFFE with the sign set, Y, carry and
  overflow of the last release); the room entry keeps its register-free FF79. The
  dialog's main menu 80:91E2 and topic choice 80:9215 run lifted from its table with
  the dialog's text routines (events.text): with the standard routines the topic
  window opens and is released lifted and the menu runs register-level; with a test's
  replacements those run. They leave A, X, Y and the carry of their own comparisons as
  the original; the X pushed around a topic text lookup is not reproduced. The dialog
  text 80:9178 runs lifted from the same table: with the standard text routines its
  window request 80:FA67 (`requestTileClearSequence`), cursor 80:FAAC and text 80:FE69
  run lifted, the text drawn by the lifted 80:FB39 (`TEXT_ROUTINES`); the request leaves
  A 0 with zero set and sign clear, X the window, Y unchanged and the carry and overflow
  of its shifts and address addition, and runs register-level without the lag-free
  frame model (a test's replacements run as they are). Its search and
  topic add work with an 8-bit accumulator as the original (byte loads keep the high
  byte, XBA swaps), and it pushes the flag byte around the topic add and its status and
  Y around the text; the action runs as the register-level one runs it. The portrait
  window 80:8F3A and 80:8F97 runs lifted from the dialog's table, each frame's wait
  81:B0A1 from that table through its JSL frame; the edges' JSR frame and pushed status
  are not reproduced. The portrait rows 80:8F20 and the uploads 80:9022 and 80:905E run
  lifted from the same table; the uploads call the lifted DMA job 80:8FF5 through its
  JSR frame (`DIALOG_ROUTINES` binds it). It leaves A the request word with its sign
  set and zero clear and X, Y, the carry and the overflow unchanged; with the lag-free
  frame model the NMI arrives at its branch 80:901F, otherwise its observations are
  replayed as by the register-level job. The object tiles 80:ADF4 with 80:AE12 run
  lifted from the same table, with the lifted animation step 80:AC2F through its JSR
  frame and the table's word wait 81:B0A1 through its JSL frame; the job count's JSL
  frames (81:A954) are pushed as the original. They leave A 0 with zero set and sign
  clear, X the last object's last slot (or what its animation step leaves), Y the draw
  list index below 0 and the carry and overflow of the last object's last addition;
  with the lag-free frame model the NMI arrives at the waits' branches 80:AE61 and
  80:AE0F, otherwise the observations are replayed as by the register-level routine.
  The draw list is read through the data bank as the original's LDX abs,Y, the object
  fields below 2000 (`object_slot_required` past it). The portrait unpacker 80:9F6D runs
  lifted from the same table (`unpackLongRegisters` of src/system/unpack.mjs, which now
  also gives the A and X the original leaves: the output length it pulls, and the
  cursor after a literal run or the copy's source after a reference). It leaves A, X and
  Y as the original, the status and data bank as on entry, the unpacker's direct page
  state, and the bytes of its own pushes (status, data bank, bank pair, length) below the
  stack; the frames of its bit reads (the return word of the last one and the A its
  last refill pushed) are not reproduced. On the task stack of the live dialog they are
  four bytes at 7E:012C-012F, which nothing reads and the NMI of the portrait window's
  wait overwrites 14 frames later. With recorded interrupts inside it the register-level
  unpacker runs. The dialog's pad word 80:9E1A (at its close) is the lifted entry of the
  top of the loop (`runPadPresses`, register-level without lag-free frames). The music
  81:EF47 (the dialog's music change 80:93BC and its restore 80:94E5) runs lifted with
  the lag-free frame model (`runMusicMode`, the lifted `setMusicModeRoutine`; with
  recorded interrupt observations the register-level routine replays them). In the live
  comparison of the dialog (two music calls) the picture equals the register-level run at
  all 4557 NMIs; the WRAM differs in the sample loader's direct page (7E:0089-0099, a
  documented limit in docs/AUDIO-ROUTINES-LIFT.md, overwritten later) and in the unread
  stack bytes 7E:0122-012F below the task stack (the frames of its inner calls), which
  stay after the restore. The Y it does not produce is pulled by the glove action
  (80:C032) right after the dialog. The
  menu choice runs lifted (`MENU_ROUTINES` in src/game/main-upkeep.mjs: the lifted word
  wait, pad word, sound effect 80:C46E and text buffer) from the dialog's main menu and
  topic choice (80:A6C7, with the standard text routines) and from the glove's action
  menu (80:A6A5, `TEXT_ROUTINES`); the script's native 13 keeps the register-level
  menu. The lifted sound effect does not reproduce the frames of its inner calls: in the
  live dialog five stack bytes at 7E:012A-012E below the task stack differ for one NMI
  after each confirm sound.
- The lifted game NMI handler 80:C152 calls its jobs without their JSR and JSL frames.
  On the NMI stack these lie below the dispatcher's frame; in the live dialog comparison
  the only WRAM difference is the last job's JSL frame at 7E:1CAC-1CAE, which nothing
  reads (the picture equals the register-level run at all 4557 NMIs). Recorded runs keep
  the register-level handler with its joypad wait continuation.
- The main loop's data bank is 80: the colour ramp and the effect sound offsets
  80:FF73 are read in bank 80, the WRAM fields below 2000. The hit shake's object
  slot is game-sized; a slot whose velocity lies past 2000, where the original
  writes into the hardware registers, stops at `object_slot_required`, as do the
  camera follow and the formation step for a slot whose fields lie past 2000. The
  formation step reads its fields with the slot as a 16-bit index that wraps in the
  low WRAM mirror (the slot FFFF reads the word before each table).
- The camera follow pushes Y and calls the clamp 81:8A05 through a JSL; nothing
  waits there, so that frame is not reproduced.
- The notice release runs below the slot index the original pushes and the return
  word of its JSR at 80:FF2D, as the NMI of the window list's upload wait writes
  below them. The random numbers and the sound effect wait for nothing; their
  frames are not reproduced.

## Tests

[tools/main-upkeep-lift-functions.test.mjs](../tools/main-upkeep-lift-functions.test.mjs)
compares each routine with its reference on random states (600 to 300 samples): every request bit alone and together, phases at the ramp's end and wrap;
step, progress, direction, count and index edges of both cycles; hit frames 0, 1,
odd, even and any word with or without a player figure; notices with one frame
left in random window tables, the effect frames running, with the recorded upload
polls of the window list; player figures in game slots or none, camera boxes as
in the room entry test, cameras far from or near the aim; camera positions and
speeds at the limits; ring indices at both ends and steps equal to the figure in
some fields. Planted differences fail them: the flash colour, the
level decrement, the cycle wrap, the index carry, the shake direction, the freed
slot, the effect level, the frames test, the random word left in 00, the speed
limit, the height base, the row base, the ring wrap and the height comparison. X and Y
are compared too. The window
samples are shared with the room entry and game start tests in
[tools/lift-window-samples.mjs](../tools/lift-window-samples.mjs).

The zones (tools/main-gate-8000.test.mjs), the motion pass
(tools/main-motion-helpers.test.mjs) and the sprite list
(tools/task-native-dialog.test.mjs, 3000 samples) run both the register-level
reference and the lifted version against the original instructions on the same
states, with all registers, the calls and the whole WRAM. A 500-sample case in the
function tests compares the motion pass with the reference for up to six objects,
boxes across one to four cells and halted objects, without ignoring the stack.
Planted differences fail them: the cell column and row shifts, the one-cell test, the
box size, the frame bank, the grid flag, the box top, the pushed index, the node
start, the halted flag and the A left early (the link order quirk and the carry of
bit 1 of the box offset cannot differ); the hidden Y, the high table, the job count,
the OAM start, the drawn flag, the picture test, the jump word, the stack bank, the A
left and the player palette.

The collision tests (1800 samples each) run the register-level and the lifted version
against the original instructions; some samples have box offsets near 7FFF, so the
additions overflow. The lifted motion pass runs the lifted movement and tests; some of
its samples step to the height floor 0100 exactly. Planted differences fail them: the
overflow left, the overflow of the height subtraction, the height test's carry, the
pushed height, the centre test's border, the climbing limit, the carry of the
diagonal, the edge choice, the floor comparison, the unchanged height test and the
diagonal's overflow. The Y of the static list (restored by the cell search) and the
carry of a cell comparison in the height test (equal cells only, carry already set)
cannot differ.

The walk towards a target runs the same way (1800 samples, with the turn's stand-in on
both sides), and the lifted motion pass runs it too. The turn with registers (500
samples, in tools/room-entry-lift-functions.test.mjs) runs against the register-level
turn; planted differences in the carry and overflow of the phase, the selection's
carry and Y and the A of an unchanged direction fail it (the selection's overflow
needs a record at 7FF8 to 7FFF, outside the ROM, and cannot differ). The animation
(1500 samples, in tools/main-upkeep-lift-functions.test.mjs, with the stack) runs
against the register-level one on real records and frame streams, picture changes,
restarts, clocks, repeats, loops, single plays and ends with task chains, and pictures
that fit the upload list and the free slots or not; planted differences in the clock
test, the single play bound, the end event, the task X, the picture bank, the free
slot bound, the freed link, the source bank, the pushed slot, the bias carry and sign,
the tile count word and the kept Y fail it. The depth sort (1500 samples:
empty and negative lists, one to five objects, all with or without rules, keys and
biases near 7FFF) and the palette slot (600 samples) have their own comparisons with
the original instructions in tools/task-native-dialog.test.mjs, as the sprite list
overwrites the registers they leave; the lifted sprite list (3000 samples) runs both.
Planted differences fail them: the arrival distance, the axis switch distance, both
straight-axis bounds, the diagonal direction, the distance overflow, the step carry,
the arrival carry, the blocked axis and delay, the task Y, the step offset Y, the
negative difference word, the noted direction, the step delay A, the turn's direction
and object words, the step table, the task chain, the event A; the rule axes and
cases, the second rule's inversion, the swap comparison, the key overflow, the A and Y
of a step, the zero flag and X after the pass down, the X and flags after the pass
up, the X of an empty list, the position word, the rule's sign; the palette carry,
the new length's flags and the offset word 6B.

The glove movement and the object search run the lifted name window release against
the register-level one; planted differences in the window map's carry and overflow,
the state bar's carry and the release's A fail them. The overflow of the bottom map
row (map rows lie far below 7FC0), of the state bar's segment subtraction (small
segment counts) and of the tile loop (replaced by a drawn window or the bar) cannot
differ in the samples. The object search compares the stack down to 1EE2, above the
unpack's frames.

The lifted sprite list with the lifted OAM entry (3000 samples in
tools/task-native-dialog.test.mjs, against the original instructions with random wall
maps) fails with planted differences in the top bound, the quarter's sign, the left
hide, the depth order's cover flag, the row offset's extra row, the column alignment,
the cell offset and its use for the first map word only, the mask of a back wall, the
front wall flag, the pushed index and column, the cleared tile, the small sprite
bits, the tile byte, the covered cells, the grid's column step, the grid's X and the
palette slot's X. The X after a part's high table bits cannot differ: the next tile
step always replaces it.

The glove movement (600 samples) runs the register-level release on both sides and
the register-level search in the reference, with the stand-ins for their window, text
and release calls; planted differences
in the acceleration, both start speeds, the position minimum, both limits, the
overflow, the carry, X, the axes, the release test and the A left fail it (the speed
limits compared with or without equality give the same speed). A slower glove fails
the live session.

The object search (1500 samples, in tools/main-upkeep-lift-functions.test.mjs) runs
the register-level and the lifted search with the same callees on states where the
glove often lies in an object's box or at its edges: up to four objects with or
without a picture or name, kind 0B with each glove and aim, runners found or not,
marked objects and recorded offsets at the snap range. Planted differences fail it:
the negative distance's fill, the bottom test, the right edge's sign, the runner step
and the found runner, the spell glove test, the overflow left, the same-object test,
the kind index word, the language clip, the snap range, both releases, the snap
word's byte swap and the y offset. The pushed object slot (overwritten by the name
pointer's push) and the carry of the vertical shift (shifted out again) cannot
differ. The task append (600 samples, in tools/room-entry-lift-functions.test.mjs)
runs both versions on the object creation's heap and task slot samples; a changed
overflow or X fails it. The carry of the frame's end cannot differ, as the game-sized
frames end below 2000.

The notice (600 samples) runs the register-level and the lifted notice with recording
stand-ins for the window opening and the text on both sides (the register-level notice
takes them as an optional table) and the real window release with the recorded upload
polls; slots free or used with equal frames. Planted differences in the equal-frames
choice, the pulled slot, the effect test and the Y left fail it; the carry of the text
number's shift and the flags of a free slot's window are always overwritten. The glove
release (400 samples) fails with a changed release test or X. In the alley session the
glove release runs once, the notice not.

The text cursor and the number (600 samples each) run against the register-level
versions on a side with a hardware multiplier and divider (Book I 2-15-1); the number's
text buffer 80:FB39 is a recording stand-in on both sides that also records the data
bank (the register-level number takes it as an optional table). Planted differences
fail them: the first addition's carry, the border columns, the overflow, the pushed
bank pair, the pixel offset, the moved bytes' Y and the data bank. The overflow of the
last digit's addition cannot differ (FB39 replaces it). The time limit (Cortex bomb)
does not run in the alley session.

The text (600 samples) runs against the register-level text with the game's text
numbers and any number, and the same recording stand-in for 80:FB39 (an optional table
of the register-level text). Planted differences fail it: the bank of negative numbers,
the pushed A, the swapped last node, the refill count, a skipped second character and
the frame return word. The flags before FB39 cannot differ (it replaces them).

The text buffer (800 samples) runs against the register-level routine with the
hardware multiplier and divider, windows of the window tables, cursors in and past the
text area, the styles alone and together, and texts of words, spaces, bold toggles and
small letters that wrap and run past the window's bottom; both sides run the
register-level upload requests with recorded polls, found by running the reference
until it asks for no more (the stack below the caller's frame is not compared).
Planted differences fail it: the alignment's carry, the reserved rows, the mask close
test, the bold glyph, the shifted rows, the underline exception, the capitals and
their flag, the pending bytes' step back, the empty word width, the space after a
word, the bold width and Y's high byte. The carry of the end's tile shift cannot differ
(the pending bytes are multiples of 16). In the alley session the lifted text and text
buffer run three times (name windows), with lag-free frames.

The window opening (800 samples) runs against the register-level one on a side with the
PPU's signed multiplier, with one recorded poll each for the tile request and the map
upload; last indices up to past the limit, positions at and past the map's edges, and
next tiles near the wrap. Planted differences fail it: the position 0, the offset's
carry, the tile limit, Y, the multiplier's high byte and the carry past the limit. The
carry of the bottom map row cannot differ (map rows lie far below FFC0). The action
menu (600 samples) runs the register-level and the lifted menu with recording
stand-ins for the window opening and the menu (an optional table of the register-level
menu) and the real release; planted differences in the spell test, the override, a
cancel, the override's clearing, the carry without an action and the menu column fail
it. The overflow passed to the window opening cannot differ with the stand-in. In the
alley session the lifted window opening runs three times (name windows); the action
menu does not run there.

The text width runs inside the object search test (lifted search with the lifted width
against the register-level search and width, the stack compared down to 1EE2); planted
differences in the second character's high byte, a zero second character, the refill
push, the width step's frame and X fail it. In the alley session the lifted width runs
three times and the glove action's pad word once.

The dialog (600 samples) runs the register-level and the lifted dialog with recording
stand-ins for all 20 callees on both sides (the menu ends by its fifth call, the topic
choice gives a topic or none, the text sometimes sets the end word, the word wait keeps
X; they record the carry and overflow they get), dialog records of the game's 139, the
music option on or off and the current music equal to the dialog's or not. Planted
differences fail it: the music option and change, Jake's alternate portrait, the wait
frames, the no-topic test, the portrait Y, the font loads' A, the music restore, the
frame pixel and the carries of the record shift, the music and topic comparisons and
the menu test. The lifted dialog runs in neither the alley session nor the boot tests
(they use the script's native path), but in tools/live-talk.test.mjs (the badge plan's
dialog and Talk with the club guest). Its lifted waits end their live steps at the NMI:
a WRAM hash at every NMI of the plan equals the register-level run wherever both
sample it, only the live step boundaries differ (the register-level dialog ran up to
about 54 NMIs in one step). The test's wait after choosing Talk had relied on that
overshoot; the dialog's menu replaces the list cursor 63 NMIs after the button
(greeting and 61 frames), so the test now waits 90.

The colour clear, the text width and the notice windows' release (100, 400 and 300
samples) run against the register-level dialog callees; planted differences in the
colour's A, the zero width, the width's overflow and the release's A, X and sign fail
them.

The dialog's main menu and topic choice (600 samples each) run against the
register-level ones with recording stand-ins for the menu, the window opening and the
release (the menu leaves a row or a cancel), and topic lists empty, all flagged or with
up to twelve topics; planted differences in the menu's comparison flags, the flag skip,
the row count, the list end, the cancel's carry and Y fail them. The main menu runs in
tools/live-talk.test.mjs.

The dialog text (800 samples) runs against the register-level one with the game's
dialog records, keys of the record and others, and sorted topic lists with flags; the
window request, cursor and text are recording stand-ins and the topic action records
its registers. Planted differences in the insert position, the moved flags, the action
word skip, the fallback, the first byte swap fail it. The topic add's carry (replaced
by the caller's shift), count nibbles of 8 and more (not in the records), the overflow
of an entry skip and the pushed flag byte (overwritten by PHP) cannot differ.
The function tests' recorded observations run the register-level request. A live
comparison (BADGE_BUY_LIVE_PLAN to the club guest, then Talk and topics from an input
schedule indexed by the NMI, eight dialog texts) found the WRAM and the picture at all
3440 NMIs that both runs sample equal to a run with the register-level request, cursor
and text; a request for the wrong window differs from the dialog's greeting on.

The portrait window (150 samples each way) runs against the register-level routines
with the register-level word wait on both sides, its counter polls found by running
the reference; planted differences in the HDMA table length, the channel's enable, the
TRB's zero and the edge in A fail it. The edges' carry cannot differ (steps up to 32).
Both run in tools/live-talk.test.mjs.

The portrait rows (50 samples), uploads and DMA job (200 samples each) run against the
register-level routines, the reference with the register-level DMA job and the lifted
side with the lifted one, its request's polls found by running the reference; planted
differences in the row destination, the bank's sign, the HDMA fill, the mirror bit, the
job count's zero, the second portrait's VRAM address, the DMA target, the byte count's
width, the address increment and the request's load site fail them. The request word
(the first recorded poll replaces it) and the sign left (the replayed load sets it)
cannot differ there; in the live comparison of the dialog (with the dialog text above)
a request for the wrong VRAM address differs in the picture from the first portrait on,
and the lifted job's run equals the register-level one's at all 3466 NMIs. They run in
tools/live-talk.test.mjs.

The object tiles (400 samples) run against the register-level routine on one to four
objects of the draw list, prepared as for the animation step, most without a picture
change, some with a change or restart whose picture has few tiles, upload indices that
fill the list or not; the polls of the waits and the NMI's words are found by running
the reference (the job lists empty at once or after a poll, the upload index small). In
the samples 133 objects took the change path and 224 waited for a full list; 7 stopped
on both sides and 7 lay outside the lifted domain (a field past 2000, which the
reference reads unmapped). Planted differences fail them: the frame offset step, the
picture's increment and bank, the list limit, the halves' order, the X left, the change
test, the draw list step, the NMI's job count word, the stream bank's high byte, the
cleared tile count and the empty picture's return. The overflow of the list test cannot
differ (the queue replaces it), but an NMI at the wait pushes it. In the live comparison
of the dialog, extended to Exit, the lifted routine runs once at the dialog's close and
all 4557 NMIs equal the register-level run; swapped halves differ from the close on.

The portrait unpacker (150 samples) runs against the register-level one on the game's
portrait streams, into 5250 or another offset, with bank words with a high byte and any
status and data bank, the whole of bank 7F compared; planted differences in its X and A
and the unpacker's copy source and literal cursor fail it. Its pushes lie below the
caller's frame. In the live comparison of the dialog the picture equals the
register-level run at all 4557 NMIs; the WRAM differs at 14 NMIs in the four unread
stack bytes above.

The menu list's mark and its removal (300 samples each) run against the register-level
helpers on windows of the window tables, list columns and rows anywhere, page starts
and word indices on the page or not, the reference's text buffer register-level and the
lifted side's lifted, both with the recorded polls of its upload requests; planted
differences in the page start, the halving, the column and the text fail them (the
print's return word lies below the caller's frame). The list drawing (120 samples: up
to nine of the game's text numbers, numbers or none, one to six visible rows, page
starts on the list or past its end) runs the same way; planted differences in the mark
inset, the draw row step, the number list, the previous mark and its text, the index
step, the pushed Y, the more test and the rows left fail it.

The menu choice (40 samples for each of the four entries) runs against the
register-level menu, which now takes an optional table for its word wait, pad word and
sound (`menuComposeSequence`); both sides use stand-ins for them, the pad word from a
script per sample (down, up, R, L, held directions that repeat, hotkeys, then B, Y or a
hotkey), lists of one to nine of the game's text numbers and one to six visible rows.
The reference draws with its register-level helpers, the lifted side with the lifted
ones, both with the recorded polls of the text uploads and the tile requests. In the
samples about 170 moves, 60 pages, 60 repeats, 24 hotkeys and 25 cancels ran. Planted
differences fail it: the repeat delay and its reload, the down step, the top row test,
the forward page's carry, the hotkey test before paging, the confirm sound, the order
of the pushed words, the hotkey's pad word, the preselection's shift, the page buttons,
the cancel button and the forward page's row count. The confirm's carry (the pad word
replaces it) and the clamp of a page start below 0 (page starts are multiples of the
visible rows in the samples) cannot differ. In the live comparison of the dialog
(the action list with the wheel and the left button, then the dialog's menus) the lifted
menu runs 12 times; picture and WRAM equal the register-level run at all 4557 NMIs but
6, where only the stack bytes above differ. The pad word in the live
comparison of the dialog runs once and equals the register-level adapter at all 4557
NMIs.

The time limit (400 samples) and the glove action (600 samples) run with the same
recording stand-ins for their register-level callees on both sides: each records the
direct page words 00 to 0C, A, X, Y, the stack pointer and the word above its return
address, and leaves random registers. Hours negative, zero, one and more with frames
at zero and at the warning steps; aiming, targets, B, L and R alone and together,
waiting tasks with and without a child, wait masks with the offered and accepted
bits, distances at the reach limits and dialog records or none. Planted differences
fail them: the text choice, the hour length, the fast warning bound, the hours
decrement, the A passed to the notice, the window word, the sound Y, the zero test;
the B-alone test, the offered and accepted masks, both reaches, the distance sign,
the pushed slot, the talk bit, the action without a dialog, the L and R masks, the
notice frames, the event OR, the X and Y left, the dialog record and DP 6B.

The game NMI handler (300 samples, the lists of the game's sizes, its jobs' frames on the
NMI stack ignored) and its jobs ([tools/game-nmi-lift-functions.test.mjs](../tools/game-nmi-lift-functions.test.mjs),
600 samples each) run against the register-level jobs of GAME_NMI_ROUTINES with the
data bank and direct page at 0 on the NMI stack: job lists closed or open, fades off,
in or out at their last frame or not, brightness 0, 15 or between with the forced blank
set or clear; palette lists of 0 to 23 entries, VRAM records 0 to 64 or none, odd
indices; scene palette requests of 0 to 47 palettes (8000, whose doubled count is 0,
runs past 2000), palette cycle steps with slots in the game or up to 400; portrait requests
sent or waiting; glove changes to each kind, another or none, a glove shown or not; map uploads held or not with a column, a row, both or
none marked; each text request set or clear, tile clears below, at and above one chunk. WRAM, device writes, S, PC and the 16-bit modes must be equal (the
handler restores the other registers). Planted differences fail them: the forced blank
kept, the fade-out bound, the job lists left open, the rotation bit, the frames reload
and the frames decrement; the palette source's and colour's shift carries, the last
palette entry, the palette list start, the VRAM index left, the bank byte and the VRAM
increment; the scene colour, the scene list end, the backdrop, the scene and cycle
requests, the cycle direction byte and the DMAP word; the portrait colour offset, its
request mark and bank, the spell picture, the glove lower half, the kind cleared, the
priority and the glove word test; the map hold and job list tests, the chunk bound,
the tile address step, the map and read back requests and the text buffer length. The
harness compares writes, not reads: a missing VRAM latch read (RDVRAMH at 81:AA8E,
which steps the VRAM address before the read back) passes it, and neither live
session requests a read back; the lifted job keeps the read as the original. Planted differences in the handler: the
job order, the forced blank, a missing shadow and the held pad word. The lists are read below 2000 (data bank 0); an odd palette byte count, which
ends at index FFFF, stops at `nmi_list_required`.
[tools/game-nmi-lift.test.mjs](../tools/game-nmi-lift.test.mjs) runs the alley session
below with the lifted jobs and with the register-level ones (about 54 seconds); every
NMI must be equal, with the screen shadows 7E:01BC-01C9 compared too. A forced blank
kept by the fade in fails it; a changed reload of the fade out's frames does not show in
the session (the room entry blanks the screen and starts the fade in after its first
steps), so only the function test sees it. The alley session has no portraits; a run of the
club dialog session (the live dialog comparison above) with the lifted jobs and with
the register-level ones swapped in was equal at all 4557 NMIs, and a changed portrait
colour offset differed in the picture from the first portrait on.

[tools/main-upkeep-lift.test.mjs](../tools/main-upkeep-lift.test.mjs) compares the
lifted routines with the references in the alley session of
[tools/live-alley-plan.mjs](../tools/live-alley-plan.mjs) (moved there from
tools/live-alley-bus.test.mjs, which uses it too): from the title and the apartment
save into the alley with the random draws synchronized, the orc shooting, the
Beretta picked up and equipped, and shots; every NMI must be equal (about 55
seconds). A reversed hit shake fails it, and so do a changed glove action event (NMI 8505), a
repeated B press from the pad word (NMI 9105) and skipped tile buffers. In the
session each lifted entry runs about 5070 times, in the lifted run only. A pad word
that is never taken hangs the plan (it waits for presses); the carry of the pad word,
the X of the tile buffers and the A of the word wait are not observable in the
session. All the routines run in every pass. The closed plan BADGE_BUY_LIVE_PLAN alone
starts in the main menu after a game over and cannot run from the title.

[tools/main-loop-camera.test.mjs](../tools/main-loop-camera.test.mjs),
[tools/main-motion-helpers.test.mjs](../tools/main-motion-helpers.test.mjs),
[tools/main-loop-motion.test.mjs](../tools/main-loop-motion.test.mjs) and
[tools/main-text-continuation.test.mjs](../tools/main-text-continuation.test.mjs)
keep proving the references against the ROM.
