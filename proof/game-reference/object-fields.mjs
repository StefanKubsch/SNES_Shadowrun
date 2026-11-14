// Register-level references of the object field script natives (moved from
// src/task/native-object-flags-get.mjs, -set.mjs, -or.mjs and -and.mjs; lifted in
// src/game/object-fields.mjs). The proof plans and the Native58 dispatch of
// proof/task/native-dispatch.mjs run these; the game runs the lifted natives.
import { FIRST_ARGUMENT, SECOND_ARGUMENT, leaf } from '../../src/task/native-leaf-support.mjs';
import { OBJECT_FLAGS } from '../../src/task/wram.mjs';

// 80:CA05: return the flag word of the object (first argument).
export const getObjectFlagsReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.result(h.load(h.longRead(h.abs(OBJECT_FLAGS) + object)));
    },
    outerReturn,
  );
// 80:CA0D: replace the flag word of the object (first argument) with the second argument.
export const setObjectFlagsReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT)),
        flags = h.load(h.dp(SECOND_ARGUMENT));
      h.longWrite(h.abs(OBJECT_FLAGS) + object, flags);
    },
    outerReturn,
  );
// 80:CA15: set the bits of the second argument in the flag word of the object (first argument).
export const setObjectFlagBitsReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT)),
        bits = h.load(h.dp(SECOND_ARGUMENT)),
        address = h.abs(OBJECT_FLAGS) + object;
      h.longWrite(address, h.load(bits | h.longRead(address)));
    },
    outerReturn,
  );
// 80:CA20: keep only the bits of the second argument in the flag word of the object (first argument).
export const keepObjectFlagBitsReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT)),
        bits = h.load(h.dp(SECOND_ARGUMENT)),
        address = h.abs(OBJECT_FLAGS) + object;
      h.longWrite(address, h.load(bits & h.longRead(address)));
    },
    outerReturn,
  );
