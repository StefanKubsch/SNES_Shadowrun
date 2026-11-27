import { finishLeaf } from '../system/native-leaf-support.mjs';
import { addTopic as add } from '../game/topic-list.mjs';

// 80:90EB (lifted in src/game/topic-list.mjs; register-level reference in
// proof/game-reference/topic-list.mjs): add the topic (low byte of the first argument) to
// the sorted topic list with flag 0 unless it is known.
export const addTopic = (a) => {
  add(a.mem);
  return finishLeaf(a);
};
