import { SECOND_ARGUMENT, leaf } from './native-leaf-support.mjs';
import { measureObjectDistance } from './native-object-distance.mjs';

// 80:C694: distance between the objects in the first and second argument: the larger
// of |dx| and |dy|, divided by four, returned in place of the first argument.
// The second object goes to Y, then the shared body 80:C696 runs without a JSR frame.
export const getDistanceBetweenObjects = (a, outerReturn = true) =>
  leaf(
    a,
    (h) => {
      h.index('y', h.dp(SECOND_ARGUMENT));
      measureObjectDistance(h);
    },
    outerReturn,
  );
