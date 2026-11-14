import { emitTaskNativeProbe } from './task-native-probe.mjs';
import { proveTaskAppend } from './task-append-source.mjs';
import { taskAppendFixture } from './task-append-fixtures.mjs';
import { prepareTaskAppendC34A } from '../proof/task/append-c34a.mjs';
await emitTaskNativeProbe({
  name: 'append-c34a',
  sourceName: 'append-c34a',
  module: 'proof/task/append-c34a.mjs',
  exportName: 'prepareTaskAppendC34A',
  prepare: prepareTaskAppendC34A,
  entries: [0x80c34a],
  proofField: 'proofs',
  proveSource: proveTaskAppend,
  fixture: taskAppendFixture,
});
