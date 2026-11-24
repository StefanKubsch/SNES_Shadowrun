// Live startup 80:A133: direct composition of the boot screens after the reset
// (docs/BOOT-SERVICE-COMPOSITION.md). The former address-dispatched path is retained
// in proof/script/live-startup.mjs.
import { taskStop } from './task-stop.mjs';
import { lagFree } from './main-wait-interrupt.mjs';
import { bootScreensInPlace } from '../frontend/boot-screens.mjs';

// The JSR to 80:A15C and its JSL to the boot screens 81:E7BC run without their
// frames. Live startup takes game services only (h.a); the PHP/PLP around the screens,
// the data bank 80 set before its RTS and the owner entry A139 are CPU return metadata,
// kept for recorded comparisons by tools/startup-entry-adapter.mjs. The original
// passes the owner A = 1 (show the title first); the caller passes showTitle instead.
export function* mainStartupSequence(h, events) {
  if (!lagFree(events)) taskStop('game_lag_free_required');
  yield* bootScreensInPlace(h, events);
}
