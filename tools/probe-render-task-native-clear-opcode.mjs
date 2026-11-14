import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom } from './rom.mjs';
import { taskRomHash } from './task-partial-source.mjs';
import { proveTaskNativeA7 } from './task-native-clear-opcode-source.mjs';
import { taskNativeClearOpcodeFixture } from './task-native-clear-fixtures.mjs';
import { prepareTaskNativeOpcodeFF79 } from '../proof/task/native-clear-opcode.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
const path = 'analysis/render-task-native-opcode-ff79.json',
  source = JSON.parse(await readFile(path)),
  { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
const proof = await proveTaskNativeA7(bytes);
if (
  source.rom_sha256 !== taskRomHash ||
  metadata.rom_sha256 !== taskRomHash ||
  JSON.stringify(source.proofs) !== JSON.stringify([proof])
)
  throw Error('A7 source proof drift');
const probes = [];
for (const patch of [{}, { maxWork: 0 }, { maxOutputBytes: 0 }]) {
  const f = taskNativeClearOpcodeFixture(),
    before = JSON.stringify(f.data.snapshot()),
    p = prepareTaskNativeOpcodeFF79({ ...f, ...patch });
  if (JSON.stringify(f.data.snapshot()) !== before) throw Error('A7 prepare mutation');
  if (p.handled && !commitTaskPlan(f.data, p).handled) throw Error('A7 commit failed');
  probes.push({ ...p, synthetic: true, limits: patch });
}
if (!probes[0].handled || probes.slice(1).some((p) => p.handled))
  throw Error('A7 native probe boundary drift');
await writeFile(
  'analysis/render-task-native-opcode-ff79-native.json',
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
          module: 'proof/task/native-clear-opcode.mjs',
          export: 'prepareTaskNativeOpcodeFF79',
          source_contract: path,
          source_proof_field: 'proofs',
          source_proof: proof,
        },
      ],
      probes,
      completed_script_bodies: 0,
      scope:
        'One explicit original A7 Native58 call with full native FF79 and actual F508/F509. Synthetic observed caller/data/IO/wait only; no body/caller initialization/scene/frames.',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Whole native A7 call: zero pops, no PHA, full FF79, actual F508/F509, 3 atomic probes.',
);
