import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom } from './rom.mjs';
import { taskRomHash } from './task-partial-source.mjs';
import { proveTaskNative7C } from './task-native-8e36-opcode-source.mjs';
import { task7COpcodeFixture } from './task-native-8e36-opcode-fixtures.mjs';
import { prepareTaskNativeOpcode8E36 } from '../proof/task/native-8e36-opcode.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
const { bytes } = inspectRom(await readFile('Shadowrun (E).smc')),
  proof = await proveTaskNative7C(bytes),
  probes = [];
for (const limits of [{}, { maxWork: 0 }, { maxOutputBytes: 0 }]) {
  const f = task7COpcodeFixture({ flags: 0xa000 }),
    before = JSON.stringify(f.data.snapshot()),
    p = prepareTaskNativeOpcode8E36({ ...f, ...limits });
  if (JSON.stringify(f.data.snapshot()) !== before) throw Error('7C prepare mutated owner');
  if (!Object.keys(limits).length && !p.handled) throw Error('7C fixture ' + p.reason);
  if (p.handled && !commitTaskPlan(f.data, p).handled) throw Error('7C commit failed');
  probes.push({ ...p, entry: '80:F390', synthetic: true, limits });
}
await writeFile(
  'analysis/render-task-native-opcode-8e36-native.json',
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
          entry: '80:F390',
          module: 'proof/task/native-8e36-opcode.mjs',
          export: 'prepareTaskNativeOpcode8E36',
          source_contract: 'analysis/render-task-native-opcode-8e36.json',
          source_proof_field: 'proofs',
          source_proof: proof,
        },
      ],
      probes,
    },
    null,
    2,
  ) + '\n',
);
