import { FIRST_ARGUMENT, finishLeaf, leafArgument } from '../system/native-leaf-support.mjs';
import { startBrightnessFade as startFade } from '../game/game-nmi.mjs';

// 80:D9AD (lifted in src/game/game-nmi.mjs; register-level reference in
// proof/game-reference/brightness-fade.mjs): start a brightness fade with step -n (first
// argument n; positive n darkens).
export const startBrightnessFade = (a) => {
  startFade(a.mem.wram, leafArgument(a, FIRST_ARGUMENT));
  return finishLeaf(a);
};
