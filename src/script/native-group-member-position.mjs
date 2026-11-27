import {
  FIRST_ARGUMENT,
  finishLeaf,
  leafArgument,
  setLeafResult,
} from '../system/native-leaf-support.mjs';
import { groupMemberPosition } from '../game/group-members.mjs';

// 80:A297 (lifted in src/game/group-members.mjs; register-level reference in
// proof/game-reference/group-members.mjs): return the group position of the member object
// (first argument); 0 for an empty group or a miss.
export const getGroupMemberPosition = (a) => {
  setLeafResult(a, groupMemberPosition(a.mem, leafArgument(a, FIRST_ARGUMENT)));
  return finishLeaf(a);
};
