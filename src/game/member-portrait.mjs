// The shown party member's portrait in the status and spell menus (docs/READABLE-GAME.md):
// the portrait of the member's dialog is shown, then its window opens over eleven frames,
// the opening growing by 3 each frame from 2 to 32. The presentation layer draws both
// (src/platform/portrait-tiles.mjs, src/platform/portrait-window.mjs).
import { waitForCounterWord } from '../system/frame-wait.mjs';
import { showMemberPortrait } from '../platform/portrait-tiles.mjs';
import {
  beginMemberPortraitWindow,
  setMemberPortraitWindowOpening,
} from '../platform/portrait-window.mjs';
import { dialogContent } from '../content/dialogs.mjs';
import { dialogState } from '../state/dialog.mjs';

const OPEN_FIRST = 2,
  OPEN_LAST = 32,
  STEP = 3;

// Show the member's portrait and open its window.
export function* memberPortrait(h, events) {
  const { mem } = h.a,
    dialog = dialogContent(mem).dialogs[dialogState(mem).memberPortrait];
  yield* showMemberPortrait(h, events, dialog.portrait);
  yield () => beginMemberPortraitWindow(h);
  for (let opening = OPEN_FIRST; opening <= OPEN_LAST; opening += STEP) {
    yield* waitForCounterWord(h, events);
    yield () => setMemberPortraitWindowOpening(h, opening);
  }
}
