// Replays share the continuation runner with the game. Preserve both implementations
// when a reference and a live table bind different functions to the same ROM target.
import { NATIVE_CALL_CONTINUATIONS as shared } from '../../src/system/native-call-continuation.mjs';
export const NATIVE_CALL_CONTINUATIONS = {
  get: (key) => shared.get(key),
  set(key, factory) {
    const previous = shared.get(key);
    if (typeof key === 'number') {
      if (previous && !shared.has(previous.run)) shared.set(previous.run, previous);
      if (!shared.has(factory.run)) shared.set(factory.run, factory);
    }
    shared.set(key, factory);
    return this;
  },
};
