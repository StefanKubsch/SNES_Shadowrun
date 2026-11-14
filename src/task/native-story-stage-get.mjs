import { leaf } from './native-leaf-support.mjs';
import { STORY_STAGE, WRAM } from './wram.mjs';
import { BYTE_MASK } from '../constants/bits.mjs';

// 80:D134: return the story stage (low byte); the flags come from the AND.
export const getStoryStage = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.result(h.load(h.longRead(WRAM + STORY_STAGE) & BYTE_MASK));
    },
    outerReturn,
  );
