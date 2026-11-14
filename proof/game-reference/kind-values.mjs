// Register-level references of the kind script natives (moved from
// src/task/native-object-kind-attribute.mjs and native-record-kind-*.mjs; lifted in
// src/game/kind-values.mjs). The proof plans and the Native58 dispatch of
// proof/task/native-dispatch.mjs run these; the game runs the lifted natives.
import {
  FIRST_ARGUMENT,
  leaf,
  readActorKind,
  returnKindValue,
} from '../../src/task/native-leaf-support.mjs';
import { OBJECT_KIND, WRAM } from '../../src/task/wram.mjs';
import { KIND_FLAGS_OFFSET } from '../../src/data/kinds.mjs';

// 80:C9F1: return the kind value of the object (first argument).
export const getObjectKindValueReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const object = h.index('x', h.dp(FIRST_ARGUMENT));
      h.load(h.longRead(WRAM + OBJECT_KIND + object));
      returnKindValue(h, 'leaf-intermediate-DP00', 'leaf-result-DP00');
    },
    outerReturn,
  );
// 80:CAF2: return the kind value of the actor entry (offset in the first argument).
export const getActorKindValueReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const actor = h.index('x', h.dp(FIRST_ARGUMENT));
      readActorKind(h, actor);
      returnKindValue(h, 'leaf-scaled-word', 'leaf-table-result');
    },
    outerReturn,
  );
// 80:CB06: return the kind flags of the actor entry (offset in the first argument).
export const getActorKindFlagsReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const actor = h.index('x', h.dp(FIRST_ARGUMENT));
      readActorKind(h, actor);
      returnKindValue(h, 'leaf-scaled-word', 'leaf-table-result', KIND_FLAGS_OFFSET);
    },
    outerReturn,
  );
// 80:D0FC: return the kind of the actor entry (offset in the first argument).
export const getActorKindReference = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const actor = h.index('x', h.dp(FIRST_ARGUMENT));
      h.result(readActorKind(h, actor), 'leaf-table-result');
    },
    outerReturn,
  );
