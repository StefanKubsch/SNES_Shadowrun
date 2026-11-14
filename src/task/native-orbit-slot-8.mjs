import { advanceOrbit, D796_ENTRIES } from './native-orbit.mjs';

// 80:D793: advance the orbit of the object (first argument) in phase slot 8
// (LDY #slot, then the shared body 80:D796 in native-orbit.mjs).
export const advanceOrbitSlot8 = (a, outerReturn = true) =>
  advanceOrbit(a, D796_ENTRIES.get(0x80d793), outerReturn);
