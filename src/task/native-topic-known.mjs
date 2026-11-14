import { FIRST_ARGUMENT, finishLeaf, leafArgument, setLeafResult } from './native-leaf-support.mjs';
import { isTopicKnown as isKnown } from '../game/topic-list.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';

// 80:9159 (lifted in src/game/topic-list.mjs; register-level reference in
// proof/game-reference/topic-list.mjs): return TRUE (FFFF) when the topic (low byte of
// the first argument) is in the topic list, else FALSE (0).
export const isTopicKnown = (a, outerReturn = true) => {
  setLeafResult(a, isKnown(a.mem, leafArgument(a, FIRST_ARGUMENT) & BYTE_MASK));
  return finishLeaf(a, outerReturn);
};
