import { advanceOrbit, D796_ENTRIES } from './native-orbit.mjs';

// 80:D78D: advance the orbit of the object (first argument) in phase slot 7
// (LDY #slot, then the shared body 80:D796 in native-orbit.mjs).
export const advanceOrbitSlot7 = (a, outerReturn = true) =>
  advanceOrbit(a, D796_ENTRIES.get(0x80d78d), outerReturn);
