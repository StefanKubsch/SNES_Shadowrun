// The dialog's portrait window (docs/READABLE-GAME.md, dialog pilot): a rectangle around
// the portraits that opens and closes. Opening takes eleven frames, its opening growing
// by 3 each frame from 2 to 32; closing takes eleven frames, shrinking by 3 from 31 to 1,
// after which the window goes. The presentation layer draws it
// (src/platform/portrait-window.mjs).
import { waitForCounterWord } from '../system/frame-wait.mjs';
import {
  beginPortraitWindow,
  endPortraitWindow,
  setPortraitWindowOpening,
} from '../platform/portrait-window.mjs';

const OPEN_FIRST = 2,
  OPEN_LAST = 32,
  CLOSE_FIRST = 31,
  STEP = 3;

// Open the portrait window.
export function* openPortraitWindow(h, events) {
  yield () => beginPortraitWindow(h);
  for (let opening = OPEN_FIRST; opening <= OPEN_LAST; opening += STEP) {
    yield* waitForCounterWord(h, events);
    yield () => setPortraitWindowOpening(h, opening);
  }
}

// Close the portrait window.
export function* closePortraitWindow(h, events) {
  for (let opening = CLOSE_FIRST; opening > 0; opening -= STEP) {
    yield* waitForCounterWord(h, events);
    yield () => setPortraitWindowOpening(h, opening);
  }
  yield () => endPortraitWindow(h);
}
