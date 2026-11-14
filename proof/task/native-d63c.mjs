// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { prepareTaskPlan } from './plan.mjs';
import { circleSwarmLeader } from '../../src/task/native-swarm-start.mjs';

export const prepareTaskNativeD63C = (options) =>
  prepareTaskPlan(options, [0x80d63c], (a) => circleSwarmLeader(a));
