import { FIRST_ARGUMENT, finishLeaf, leafArgument } from './native-leaf-support.mjs';
import { advanceOrbit as advance } from '../game/object-bob.mjs';

// 80:D796, the shared body of the orbit entries D769, D76F, D775, D77B, D781, D787, D78D
// and D793 (lifted in src/game/object-bob.mjs; register-level reference in
// proof/game-reference/object-bob.mjs): advance the object (first argument) one step on
// its orbit in phase slot Y.
export const advanceOrbit = (a, slot, outerReturn = true) => {
  advance(a.mem, leafArgument(a, FIRST_ARGUMENT), slot);
  return finishLeaf(a, outerReturn);
};
// Entry -> phase slot Y: the n-th entry loads Y = 2n.
export const D796_ENTRIES = Object.freeze(
  new Map(
    [0x80d769, 0x80d76f, 0x80d775, 0x80d77b, 0x80d781, 0x80d787, 0x80d78d, 0x80d793].map(
      (entry, n) => [entry, 2 * n],
    ),
  ),
);
