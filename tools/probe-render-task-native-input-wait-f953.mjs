import { emitTaskNativeProbe } from './task-native-probe.mjs';
import { prepareTaskNativeInputWaitF953 } from '../proof/task/native-input-wait-f953.mjs';
import { decodeSource, proveTaskInputWaitF953 } from './task-native-input-wait-f953-source.mjs';
import { taskInputWaitFixture } from './task-native-input-wait-f953-fixtures.mjs';
await emitTaskNativeProbe({
  name: 'native-input-wait-f953',
  module: 'proof/task/native-input-wait-f953.mjs',
  prepare: prepareTaskNativeInputWaitF953,
  exportName: 'prepareTaskNativeInputWaitF953',
  sourceName: 'native-input-wait-f953',
  proofField: 'proofs',
  entries: [0x80f953],
  proveSource: proveTaskInputWaitF953,
  decodeSource,
  fixture: taskInputWaitFixture,
});
