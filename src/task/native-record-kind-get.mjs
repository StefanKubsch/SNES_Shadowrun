import { FIRST_ARGUMENT, leaf, readActorKind } from './native-leaf-support.mjs';

// 80:D0FC: return the kind of the actor entry (offset in the first argument).
export const getActorKind = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      const actor = h.index('x', h.dp(FIRST_ARGUMENT));
      h.result(readActorKind(h, actor), 'leaf-table-result');
    },
    outerReturn,
  );
