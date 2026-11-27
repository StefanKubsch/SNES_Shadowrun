// The dialog's screen (docs/READABLE-GAME.md, dialog pilot): the colour effect cleared
// when a dialog opens, the portraits of Jake and the partner, and the screen put back
// when it closes. The presentation layer draws them (src/platform/).
import { segmentSequence } from '../system/sequence-runner.mjs';
import { reloadObjectTiles } from './object-tiles.mjs';
import { buildSpritesInPlace } from './sprite-list.mjs';
import { closePortraitWindow } from './portrait-window.mjs';
import { takePad } from '../system/live-input-calls.mjs';
import { waitForCounterWord } from '../system/frame-wait.mjs';
import { showDialogPortraits } from '../platform/portrait-tiles.mjs';
import { clearColourEffect, hidePortraits, restoreFont } from '../platform/dialog-screen.mjs';

// Clear the colour effect.
export function clearFixedColourInPlace(h) {
  clearColourEffect(h);
}

// Show Jake's portrait on the left and the partner's on the right, perhaps mirrored.
export function* showPortraits(h, events, jake, partner, mirrored) {
  yield* showDialogPortraits(h, events, jake, partner, mirrored);
}

// Close the dialog's screen: the portrait window closes, the portraits go, the objects'
// pictures and the font come back, one frame passes, the pad is read and the sprites are
// rebuilt.
export function* closeDialog(h, events) {
  yield* closePortraitWindow(h, events);
  yield () => hidePortraits(h);
  yield* reloadObjectTiles(h, events);
  yield* waitForCounterWord(h, events);
  yield () => restoreFont(h);
  yield* segmentSequence(() => takePad(h, events));
  yield () => buildSpritesInPlace(h);
}
