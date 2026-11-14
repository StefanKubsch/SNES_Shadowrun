import { readFile } from 'node:fs/promises';
import { inspectRom } from './rom.mjs';
import { emitTaskNativeProbe } from './task-native-probe.mjs';
import { renew8E36Helpers, prove8E36Local } from './task-native-8e36-source.mjs';
import { task8E36Fixture } from './task-native-8e36-fixtures.mjs';
import { prepareTaskNative8E36 } from '../proof/task/native-8e36.mjs';
const { bytes } = inspectRom(await readFile('Shadowrun (E).smc')),
  helpers = renew8E36Helpers(bytes);
await emitTaskNativeProbe({
  name: 'native-8e36',
  sourceName: 'native-8e36',
  module: 'proof/task/native-8e36.mjs',
  exportName: 'prepareTaskNative8E36',
  entries: [0x808e36],
  proofField: 'proofs',
  proveSource: (map) => prove8E36Local(map, helpers),
  prepare: prepareTaskNative8E36,
  fixture: () => task8E36Fixture({ flags: 0xa000 }),
});
