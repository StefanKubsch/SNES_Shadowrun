import { emitTaskNativeProbe } from './task-native-probe.mjs';
import { prepareTaskNativeRandom } from '../proof/task/native-random.mjs';
import { taskRandomFixture } from './task-native-random-fixtures.mjs';
import { decodeSource, prove } from './render-task-native-random-source-proof.mjs';
await emitTaskNativeProbe({
  name: 'native-random',
  module: 'proof/task/native-random.mjs',
  exportName: 'prepareTaskNativeRandom',
  prepare: prepareTaskNativeRandom,
  sourceName: 'native-random',
  proofField: 'proofs',
  entries: [0x80c51f, 0x80c560],
  proveSource: prove,
  decodeSource,
  fixture: taskRandomFixture,
});
