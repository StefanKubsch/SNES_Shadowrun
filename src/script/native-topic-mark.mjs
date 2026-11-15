import { FIRST_ARGUMENT, finishLeaf, leafArgument } from '../system/native-leaf-support.mjs';
import { markTopic as mark } from '../game/topic-list.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';

// 80:913C (lifted in src/game/topic-list.mjs; register-level reference in
// proof/game-reference/topic-list.mjs): mark the topic (low byte of the first argument)
// in the topic list; an unknown topic changes nothing.
export const markTopic = (a, outerReturn = true) => {
  mark(a.mem, leafArgument(a, FIRST_ARGUMENT) & BYTE_MASK);
  return finishLeaf(a, outerReturn);
};
