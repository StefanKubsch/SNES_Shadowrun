import { leaf } from './native-leaf-support.mjs';
import { releaseObjectGraphics as releaseBody } from './native-object-release.mjs';

// 80:AA4C: clear the picture, animation, box and motion of the object (first argument)
// and return its VRAM slots to the free list; the body is shared with 80:A8F5.
export const releaseObjectGraphics = (a, outerReturn = true) => leaf(a, releaseBody, outerReturn);
