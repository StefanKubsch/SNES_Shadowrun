// Screen fades (lifted from 81:EEDD and 81:EEF1; register-level versions in
// src/task/main-scene-wait.mjs). One brightness step per frame; wait() is the
// frame wait of the caller's sequence (a generator that ends after the next NMI).
import { INIDISP_FORCED_BLANK, MAX_BRIGHTNESS } from '../constants/ppu.mjs';

// From black to full brightness: levels 0 to 15, each after a frame.
export function* fadeIn(video, wait) {
  for (let level = 0; level <= MAX_BRIGHTNESS; level++) {
    yield* wait();
    yield () => video.setDisplay(level);
  }
}
// From full brightness to black: levels 15 to 0, each after a frame, then forced blank.
export function* fadeOut(video, wait) {
  for (let level = MAX_BRIGHTNESS; level >= 0; level--) {
    yield* wait();
    yield () => video.setDisplay(level);
  }
  yield () => video.setDisplay(INIDISP_FORCED_BLANK);
}
