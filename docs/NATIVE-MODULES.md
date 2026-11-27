# Native task modules

The modules in `src/task/` were renamed on 2026-11-04 from the ROM address of
their original routine to a name that describes what the routine does. The
names were derived from the module comments, `src/data/runners.mjs`,
`src/data/actors.mjs` and the readers of each WRAM field; they can be refined
later. Exported function names, proof modules in `proof/task/`, tools and
npm scripts keep the address.

The script VM lift removed `src/task/` on 2026-11-15. The table now points to
game adapters in `src/script/`, shared execution support in `src/system/`,
constants in `src/data/` and register-level references in `proof/`.

Use this table to go from an address (for example in a tool or proof name) to
the module that implements it.

| Former name              | Module                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `append-c34a`            | `task-append.mjs` (removed)                                                         |
| `main-gate-8000`         | `main-zone-gate.mjs` (removed)                                                                             |
| `native-8371`            | [native-object-collision.mjs](../src/script/native-object-collision.mjs)                                   |
| `native-8521`            | `native-fight-list-append.mjs` (removed)                                                                   |
| `native-855e`            | `native-fight-list-remove.mjs` (removed)                               |
| `native-8631`            | [native-fight-list-previous.mjs](../src/script/native-fight-list-previous.mjs)                             |
| `native-8656`            | [native-fight-list-contains.mjs](../src/script/native-fight-list-contains.mjs)                             |
| `native-866f`            | [native-fight-list-any-active.mjs](../src/script/native-fight-list-any-active.mjs)                         |
| `native-8ab5`            | `native-object-shoot.mjs` (removed)                                         |
| `native-8af1`            | [native-object-armour-set.mjs](../src/script/native-object-armour-set.mjs)                                 |
| `native-8afa`            | [native-object-armour-add.mjs](../src/script/native-object-armour-add.mjs)                                 |
| `native-8b08`            | [native-object-armour-subtract.mjs](../src/script/native-object-armour-subtract.mjs)                       |
| `native-8b16`            | [native-runner-armour-equip.mjs](../src/script/native-runner-armour-equip.mjs)                             |
| `native-8b8a`            | [native-magic-points-add.mjs](../src/script/native-magic-points-add.mjs)                                   |
| `native-8b9f`            | [native-runner-weapon-equip.mjs](../src/script/native-runner-weapon-equip.mjs)                             |
| `native-8bc5`            | `enemy-target-choice.mjs` (removed)                                                                        |
| `native-8e36`            | `native-object-hit.mjs` (removed)                                             |
| `native-8e36-tables`     | `native-object-hit-tables.mjs` (removed)                               |
| `native-8e96`            | [native-object-halt-set.mjs](../src/script/native-object-halt-set.mjs)                                     |
| `native-8eb8`            | [native-object-halt-clear.mjs](../src/script/native-object-halt-clear.mjs)                                 |
| `native-8eda`            | [native-task-append-from-list.mjs](../src/script/native-task-append-from-list.mjs)                         |
| `native-8ef5`            | [native-object-armour-get.mjs](../src/script/native-object-armour-get.mjs)                                 |
| `native-90eb`            | [native-topic-add.mjs](../src/script/native-topic-add.mjs)                                                 |
| `native-913c`            | [native-topic-mark.mjs](../src/script/native-topic-mark.mjs)                                               |
| `native-9159`            | [native-topic-known.mjs](../src/script/native-topic-known.mjs)                                             |
| `native-933a-bba0`       | `native-selection.mjs` (removed)                                               |
| `native-936c`            | `native-dialog.mjs` (removed)                                                     |
| `native-94ee`            | [native-object-dialog-set.mjs](../src/script/native-object-dialog-set.mjs)                                 |
| `native-9bc6`            | `native-glove-target.mjs` (removed)                                         |
| `native-9bc6-support`    | `native-glove-target-support.mjs` (removed)                         |
| `native-9ce4`            | [native-record-property-equip.mjs](../src/script/native-record-property-equip.mjs)                         |
| `native-9d15`            | [native-object-record-property-equip.mjs](../src/script/native-object-record-property-equip.mjs)           |
| `native-9d6a`            | [native-object-record-property-from-group.mjs](../src/script/native-object-record-property-from-group.mjs) |
| `native-9d7a`            | [native-object-record-property-reset.mjs](../src/script/native-object-record-property-reset.mjs)           |
| `native-9d98`            | [native-object-record-property-test.mjs](../src/script/native-object-record-property-test.mjs)             |
| `native-9dae`            | [native-record-property-equals.mjs](../src/script/native-record-property-equals.mjs)                       |
| `native-9dc8`            | [native-object-record-count-decrement.mjs](../src/script/native-object-record-count-decrement.mjs)         |
| `native-9dec`            | [native-record-count-add.mjs](../src/script/native-record-count-add.mjs)                                   |
| `native-9e59`            | [native-pad-held.mjs](../src/script/native-pad-held.mjs)                                                   |
| `native-9e5f`            | [native-pad-pressed.mjs](../src/script/native-pad-pressed.mjs)                                             |
| `native-a1e6`            | [native-scene-object-add.mjs](../src/script/native-scene-object-add.mjs)                                   |
| `native-a297`            | [native-group-member-position.mjs](../src/script/native-group-member-position.mjs)                         |
| `native-a2b5`            | [native-group-remove.mjs](../src/script/native-group-remove.mjs)                                           |
| `native-a835`            | `native-object-create.mjs` (removed)                                       |
| `native-a8f5`            | [native-object-release.mjs](../src/script/native-object-release.mjs)                                       |
| `native-a91d`            | [native-object-task-clear.mjs](../src/script/native-object-task-clear.mjs)                                 |
| `native-a926`            | [native-object-task-bind.mjs](../src/script/native-object-task-bind.mjs)                                   |
| `native-a92f`            | [native-object-velocity-set.mjs](../src/script/native-object-velocity-set.mjs)                             |
| `native-a941`            | [native-object-velocity-x.mjs](../src/script/native-object-velocity-x.mjs)                                 |
| `native-a949`            | [native-object-velocity-y.mjs](../src/script/native-object-velocity-y.mjs)                                 |
| `native-a951`            | [native-object-velocity-z.mjs](../src/script/native-object-velocity-z.mjs)                                 |
| `native-a959`            | [native-object-position-x.mjs](../src/script/native-object-position-x.mjs)                                 |
| `native-a963`            | [native-object-position-y.mjs](../src/script/native-object-position-y.mjs)                                 |
| `native-a96d`            | [native-object-height.mjs](../src/script/native-object-height.mjs)                                         |
| `native-a977`            | [native-object-height-add.mjs](../src/script/native-object-height-add.mjs)                                 |
| `native-a985`            | [native-object-action-apply.mjs](../src/script/native-object-action-apply.mjs)                             |
| `native-a9b2`            | `native-render-unpack.mjs` (removed)                                       |
| `native-aa4c`            | [native-object-release-direct.mjs](../src/script/native-object-release-direct.mjs)                         |
| `native-aaaf`            | [native-object-action-set.mjs](../src/script/native-object-action-set.mjs)                                 |
| `native-af1f`            | `native-bar-tiles.mjs` (removed)                                               |
| `native-bb2c`            | [native-formation-place.mjs](../src/script/native-formation-place.mjs)                                     |
| `native-bb90`            | [native-object-selection-empty.mjs](../src/script/native-object-selection-empty.mjs)                       |
| `native-bc83`            | [native-glove-crosshair-limits.mjs](../src/script/native-glove-crosshair-limits.mjs)                       |
| `native-bc9c`            | [native-glove-spell-limits.mjs](../src/script/native-glove-spell-limits.mjs)                               |
| `native-c0f7`            | [native-glove-screen-x.mjs](../src/script/native-glove-screen-x.mjs)                                       |
| `native-c100`            | [native-glove-screen-y.mjs](../src/script/native-glove-screen-y.mjs)                                       |
| `native-c461`            | native-sound-stereo.mjs (removed)                                                                          |
| `native-c68d`            | [native-object-distance.mjs](../src/script/native-object-distance.mjs)                                     |
| `native-c694`            | [native-object-distance-direct.mjs](../src/script/native-object-distance-direct.mjs)                       |
| `native-c6bf`            | [native-motion-waypoint-follow.mjs](../src/script/native-motion-waypoint-follow.mjs)                       |
| `native-c6c4`            | [native-motion-waypoint-move.mjs](../src/script/native-motion-waypoint-move.mjs)                           |
| `native-c6f3`            | [native-motion-object-follow.mjs](../src/script/native-motion-object-follow.mjs)                           |
| `native-c6f8`            | [native-motion-object-move.mjs](../src/script/native-motion-object-move.mjs)                               |
| `native-c716`            | [native-motion-player-follow.mjs](../src/script/native-motion-player-follow.mjs)                           |
| `native-c71d`            | [native-motion-player-move.mjs](../src/script/native-motion-player-move.mjs)                               |
| `native-c79c`            | [native-motion-point-follow.mjs](../src/script/native-motion-point-follow.mjs)                             |
| `native-c7a1`            | [native-motion-point-move.mjs](../src/script/native-motion-point-move.mjs)                                 |
| `native-c7c2`            | [native-motion-stop.mjs](../src/script/native-motion-stop.mjs)                                             |
| `native-c9f1`            | [native-object-kind-attribute.mjs](../src/script/native-object-kind-attribute.mjs)                         |
| `native-ca05`            | [native-object-flags-get.mjs](../src/script/native-object-flags-get.mjs)                                   |
| `native-ca0d`            | [native-object-flags-set.mjs](../src/script/native-object-flags-set.mjs)                                   |
| `native-ca15`            | [native-object-flags-or.mjs](../src/script/native-object-flags-or.mjs)                                     |
| `native-ca20`            | [native-object-flags-and.mjs](../src/script/native-object-flags-and.mjs)                                   |
| `native-ca2b`            | [native-object-record-byte0.mjs](../src/script/native-object-record-byte0.mjs)                             |
| `native-ca3a`            | [native-object-record-flags.mjs](../src/script/native-object-record-flags.mjs)                             |
| `native-ca49`            | [native-object-record-count.mjs](../src/script/native-object-record-count.mjs)                             |
| `native-ca58`            | [native-object-record-property.mjs](../src/script/native-object-record-property.mjs)                       |
| `native-caa2`            | [native-object-record-flags-set.mjs](../src/script/native-object-record-flags-set.mjs)                     |
| `native-cab4`            | [native-object-record-flags-or.mjs](../src/script/native-object-record-flags-or.mjs)                       |
| `native-caca`            | [native-object-record-flags-and.mjs](../src/script/native-object-record-flags-and.mjs)                     |
| `native-cae0`            | [native-object-record-count-set.mjs](../src/script/native-object-record-count-set.mjs)                     |
| `native-caf2`            | [native-record-kind-attribute.mjs](../src/script/native-record-kind-attribute.mjs)                         |
| `native-cb06`            | [native-record-kind-second-attribute.mjs](../src/script/native-record-kind-second-attribute.mjs)           |
| `native-cb2b`            | [native-record-flags-get.mjs](../src/script/native-record-flags-get.mjs)                                   |
| `native-cb3c`            | [native-record-count-get.mjs](../src/script/native-record-count-get.mjs)                                   |
| `native-cb4d`            | [native-record-property-get.mjs](../src/script/native-record-property-get.mjs)                             |
| `native-cb9f`            | [native-record-flags-set.mjs](../src/script/native-record-flags-set.mjs)                                   |
| `native-cbb3`            | [native-record-flags-or.mjs](../src/script/native-record-flags-or.mjs)                                     |
| `native-cbcb`            | [native-record-flags-and.mjs](../src/script/native-record-flags-and.mjs)                                   |
| `native-cc07`            | [native-script-variable-get.mjs](../src/script/native-script-variable-get.mjs)                             |
| `native-cc10`            | [native-script-variable-set.mjs](../src/script/native-script-variable-set.mjs)                             |
| `native-cc19`            | [native-script-variable-or.mjs](../src/script/native-script-variable-or.mjs)                               |
| `native-cc26`            | [native-script-variable-and.mjs](../src/script/native-script-variable-and.mjs)                             |
| `native-cc33`            | [native-scene-change.mjs](../src/script/native-scene-change.mjs)                                           |
| `native-cc97`            | [native-room-change.mjs](../src/script/native-room-change.mjs)                                             |
| `native-cca4`            | [native-story-stage-raise.mjs](../src/script/native-story-stage-raise.mjs)                                 |
| `native-ccb9`            | [native-room-entry-current.mjs](../src/script/native-room-entry-current.mjs)                               |
| `native-cccc`            | [native-room-entry.mjs](../src/script/native-room-entry.mjs)                                               |
| `native-ccdb`            | [native-nuyen-add.mjs](../src/script/native-nuyen-add.mjs)                                                 |
| `native-cd97`            | [native-player-object.mjs](../src/script/native-player-object.mjs)                                         |
| `native-cd9d`            | `native-glove-release.mjs` (removed)                                       |
| `native-cda8`            | `native-window-list-redraw.mjs` (removed)                             |
| `native-cdb2`            | [native-karma-add.mjs](../src/script/native-karma-add.mjs)                                                 |
| `native-cdcf`            | [native-dialog-end.mjs](../src/script/native-dialog-end.mjs)                                               |
| `native-ce6d`            | `native-main-menu.mjs` (removed)                                               |
| `native-cecb`            | `native-state-count-raise.mjs` (removed)                               |
| `native-cf2e`            | [native-magic-points-raise.mjs](../src/script/native-magic-points-raise.mjs)                               |
| `native-cf93`            | [native-object-face-object.mjs](../src/script/native-object-face-object.mjs)                               |
| `native-clear-ff79`      | `native-slot-release.mjs` (removed)                                         |
| `native-counter-b0a1`    | `native-frame-wait.mjs` (removed)                                             |
| `native-d016`            | [native-room-reload.mjs](../src/script/native-room-reload.mjs)                                             |
| `native-d067`            | [native-runner-record-byte.mjs](../src/script/native-runner-record-byte.mjs)                               |
| `native-d079`            | `native-runners-restore.mjs` (removed)                                   |
| `native-d0d3`            | [native-sprite-mode-from-flags.mjs](../src/script/native-sprite-mode-from-flags.mjs)                       |
| `native-d0fc`            | [native-record-kind-get.mjs](../src/script/native-record-kind-get.mjs)                                     |
| `native-d105`            | [native-object-to-waypoint.mjs](../src/script/native-object-to-waypoint.mjs)                               |
| `native-d134`            | [native-story-stage-get.mjs](../src/script/native-story-stage-get.mjs)                                     |
| `native-d13e`            | [native-object-velocity-clear.mjs](../src/script/native-object-velocity-clear.mjs)                         |
| `native-d14a`            | [native-object-position-set.mjs](../src/script/native-object-position-set.mjs)                             |
| `native-d15c`            | `native-object-turn.mjs` (removed)                                           |
| `native-d16d`            | [native-sprite-mode-set.mjs](../src/script/native-sprite-mode-set.mjs)                                     |
| `native-d17b`            | [native-sprite-mode-get.mjs](../src/script/native-sprite-mode-get.mjs)                                     |
| `native-d186`            | [native-player-object-break.mjs](../src/script/native-player-object-break.mjs)                             |
| `native-d18a`            | [native-player-object-second.mjs](../src/script/native-player-object-second.mjs)                           |
| `native-d1ca`            | [native-object-number.mjs](../src/script/native-object-number.mjs)                                         |
| `native-d1d2`            | [native-player-direction-slot.mjs](../src/script/native-player-direction-slot.mjs)                         |
| `native-d1dd`            | [native-player-direction.mjs](../src/script/native-player-direction.mjs)                                   |
| `native-d255`            | [native-object-direction.mjs](../src/script/native-object-direction.mjs)                                   |
| `native-d260`            | [native-swarm-start-second.mjs](../src/script/native-swarm-start-second.mjs)                               |
| `native-d2e7`            | [native-swarm-wave.mjs](../src/script/native-swarm-wave.mjs)                                               |
| `native-d604`            | [native-swarm-orbit-start.mjs](../src/script/native-swarm-orbit-start.mjs)                                 |
| `native-d622`            | [native-swarm-phases-reset.mjs](../src/script/native-swarm-phases-reset.mjs)                               |
| `native-d63c`            | [native-swarm-circle-leader.mjs](../src/script/native-swarm-circle-leader.mjs)                             |
| `native-d714`            | [native-object-bob.mjs](../src/script/native-object-bob.mjs)                                               |
| `native-d73b`            | [native-object-bob-offset.mjs](../src/script/native-object-bob-offset.mjs)                                 |
| `native-d769`            | [native-orbit-slot-1.mjs](../src/script/native-orbit-slot-1.mjs)                                           |
| `native-d76f`            | [native-orbit-slot-2.mjs](../src/script/native-orbit-slot-2.mjs)                                           |
| `native-d775`            | [native-orbit-slot-3.mjs](../src/script/native-orbit-slot-3.mjs)                                           |
| `native-d77b`            | [native-orbit-slot-4.mjs](../src/script/native-orbit-slot-4.mjs)                                           |
| `native-d781`            | [native-orbit-slot-5.mjs](../src/script/native-orbit-slot-5.mjs)                                           |
| `native-d787`            | [native-orbit-slot-6.mjs](../src/script/native-orbit-slot-6.mjs)                                           |
| `native-d78d`            | [native-orbit-slot-7.mjs](../src/script/native-orbit-slot-7.mjs)                                           |
| `native-d793`            | [native-orbit-slot-8.mjs](../src/script/native-orbit-slot-8.mjs)                                           |
| `native-d796`            | [native-orbit.mjs](../src/script/native-orbit.mjs)                                                         |
| `native-d7dd`            | [native-swarm-start.mjs](../src/script/native-swarm-start.mjs)                                             |
| `native-d85b`            | [native-swarm-follow-path.mjs](../src/script/native-swarm-follow-path.mjs)                                 |
| `native-d97c`            | [native-swarm-height-phase-target.mjs](../src/script/native-swarm-height-phase-target.mjs)                 |
| `native-d985`            | [native-swarm-path-phase-target.mjs](../src/script/native-swarm-path-phase-target.mjs)                     |
| `native-d98e`            | [native-swarm-path-speed-target.mjs](../src/script/native-swarm-path-speed-target.mjs)                     |
| `native-d997`            | [native-swarm-height-speed-target.mjs](../src/script/native-swarm-height-speed-target.mjs)                 |
| `native-d9a0`            | [native-main-loop-exit.mjs](../src/script/native-main-loop-exit.mjs)                                       |
| `native-d9a7`            | [native-shift-right-signed.mjs](../src/script/native-shift-right-signed.mjs)                               |
| `native-d9ad`            | [native-signed-offset-set.mjs](../src/script/native-signed-offset-set.mjs)                                 |
| `native-de7e`            | [native-player-control-reset.mjs](../src/script/native-player-control-reset.mjs)                           |
| `native-e014`            | `native-player-control.mjs` (removed)                                     |
| `native-e1b3`            | [native-spell-add.mjs](../src/script/native-spell-add.mjs)                                                 |
| `native-e1cf`            | `native-spell-choice.mjs` (removed)                                         |
| `native-e24e`            | [native-timer-stop.mjs](../src/script/native-timer-stop.mjs)                                               |
| `native-e255`            | [native-timer-start.mjs](../src/script/native-timer-start.mjs)                                             |
| `native-e262`            | [native-timer-running.mjs](../src/script/native-timer-running.mjs)                                         |
| `native-e30f`            | [native-matrix-enter.mjs](../src/script/native-matrix-enter.mjs)                                           |
| `native-ea6e`            | `native-status-screen.mjs` (removed)                                       |
| `native-f254`            | `native-member-spell-menu.mjs` (removed)                               |
| `native-f963`            | `native-window-open.mjs` (removed)                                           |
| `native-fec1`            | `native-notice.mjs` (removed)                                                     |
| `native-input-wait-f953` | `native-input-wait.mjs` (removed)                                             |
| `sight-a25f`             | `line-of-sight.mjs` (removed)                                                     |
