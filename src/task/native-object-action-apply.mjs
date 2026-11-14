import { leaf } from './native-leaf-support.mjs';
import { taskSelectionSupport, runTaskSelection } from './native-object-turn.mjs';

// 80:A985: select animation (second argument) for the object (first argument): the
// action record of its kind is loaded into the object's frame, palette and box fields
// unless that animation is already selected (shared body in native-object-turn.mjs).
export const setObjectAnimation = (a, outerReturn = true) =>
  leaf(a, (h) => runTaskSelection(h, taskSelectionSupport(h)), outerReturn);
