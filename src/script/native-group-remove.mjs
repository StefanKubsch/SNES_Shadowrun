import { FIRST_ARGUMENT, finishLeaf, leafArgument } from '../system/native-leaf-support.mjs';
import { removeGroupMember as remove } from '../game/group-members.mjs';

// 80:A2B5 (lifted in src/game/group-members.mjs; register-level reference in
// proof/game-reference/group-members.mjs): remove the member object (first argument) from
// the group; an empty group or a miss changes nothing.
export const removeGroupMember = (a) => {
  remove(a.mem, leafArgument(a, FIRST_ARGUMENT));
  return finishLeaf(a);
};
