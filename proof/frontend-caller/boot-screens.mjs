// The boot screens 81:E7BC with their RTL, for the register-level startup callers
// (moved from src/frontend/boot-screens.mjs): the lifted screens, then the return
// through the caller's JSL frame.
import { bootScreensInPlace } from '../../src/frontend/boot-screens.mjs';

export function* bootScreensSequence(h, events) {
  yield* bootScreensInPlace(h, events);
  let result;
  yield () => {
    result = h.rtl();
  };
  return result;
}
