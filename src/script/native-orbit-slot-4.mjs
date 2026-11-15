import { advanceOrbit, D796_ENTRIES } from './native-orbit.mjs';

// 80:D77B: advance the orbit of the object (first argument) in phase slot 4
// (LDY #slot, then the shared body 80:D796 in native-orbit.mjs).
export const advanceOrbitSlot4 = (a, outerReturn = true) =>
  advanceOrbit(a, D796_ENTRIES.get(0x80d77b), outerReturn);
