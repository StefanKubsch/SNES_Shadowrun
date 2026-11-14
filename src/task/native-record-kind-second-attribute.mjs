import { FIRST_ARGUMENT, leaf, readActorKind, returnKindValue } from './native-leaf-support.mjs';
import { KIND_FLAGS_OFFSET } from '../data/kinds.mjs';

// 80:CB06: return the kind flags of the actor entry (offset in the first argument).
export const getActorKindFlags = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const actor = h.index('x', h.dp(FIRST_ARGUMENT));
      readActorKind(h, actor);
      returnKindValue(h, 'leaf-scaled-word', 'leaf-table-result', KIND_FLAGS_OFFSET);
    },
    outerReturn,
  );
