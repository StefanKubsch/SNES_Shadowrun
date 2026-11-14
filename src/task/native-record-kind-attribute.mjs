import { FIRST_ARGUMENT, leaf, readActorKind, returnKindValue } from './native-leaf-support.mjs';

// 80:CAF2: return the kind value of the actor entry (offset in the first argument).
export const getActorKindValue = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const actor = h.index('x', h.dp(FIRST_ARGUMENT));
      readActorKind(h, actor);
      returnKindValue(h, 'leaf-scaled-word', 'leaf-table-result');
    },
    outerReturn,
  );
