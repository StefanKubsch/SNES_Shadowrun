import { readFile, writeFile } from 'node:fs/promises';
import { prepareTaskNativeF963 } from '../proof/task/native-f963.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskRenderFixture } from './task-native-render-fixtures.mjs';
import { inspectRom } from './rom.mjs';
import { decodeTaskWindows, taskRomHash } from './task-partial-source.mjs';
import { taskNativeRenderSpec } from './task-native-render-spec.mjs';
import { proveTaskNativeRender } from './task-native-render-source.mjs';
const { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
const source = JSON.parse(await readFile('analysis/render-task-native-f963.json'));
const proof = proveTaskNativeRender(decodeTaskWindows(bytes, taskNativeRenderSpec.windows).map);
if (
  metadata.rom_sha256 !== taskRomHash ||
  source.rom_sha256 !== taskRomHash ||
  JSON.stringify(source.proofs) !== JSON.stringify([proof])
)
  throw Error('Native F963 source proof drift');
const probes = [
  ['normal', {}],
  ['fresh-second-product', { position: 0x23ff, products: [2, 7] }],
  ['capacity', { cursor: 30, products: [], waitF6: [], waitF8: [] }],
  ['return-alias', { s: 0x1fa, waitF6: [0] }],
  ['late-wait-missing', { waitF8: [] }],
  ['multiple-polls', { waitF6: [7, 1, 0], waitF8: [1, 0] }],
].map(([name, inputs]) => {
  const f = taskRenderFixture(inputs),
    before = f.data.snapshot(),
    plan = prepareTaskNativeF963(f);
  if (JSON.stringify(before) !== JSON.stringify(f.data.snapshot()))
    throw Error('Prepare mutated provider');
  if (plan.handled && !commitTaskPlan(f.data, plan).handled) throw Error('Commit failed');
  const { accesses, byteWrites, readAddresses, ...result } = plan;
  return {
    name,
    synthetic_inputs: inputs,
    result,
    planned_bytes: byteWrites?.length ?? 0,
    qualification:
      'Explicit synthetic parameters, Task stack/fields, hardware product and external wait events. No initialized original caller, device/time/interrupt/scene/frame execution or complete scriptbody.',
  };
});
await writeFile(
  'analysis/render-task-native-f963-native.json',
  JSON.stringify(
    {
      rom_sha256: taskRomHash,
      progress_reference: 'docs/PORTIERUNGSSTAND.json',
      native_binding: true,
      manual_only: true,
      full_task_binding: false,
      global_stack_minimum: null,
      bindings: [
        {
          entry: '80:F963',
          module: 'proof/task/native-f963.mjs',
          export: 'prepareTaskNativeF963',
          source_contract: 'analysis/render-task-native-f963.json',
          source_proof_field: 'proofs',
          source_proof: proof,
        },
      ],
      completed_script_bodies: 0,
      probes,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Task F963: complete native helper, actual stackbytes, chronological observations and atomic abort probes.',
);
