import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decodeTaskWindows, taskRomHash } from './task-partial-source.mjs';
import { taskAF1FSpec } from './task-native-af1f-spec.mjs';
import { proveTaskAF1F } from './task-native-af1f-source.mjs';
import { prepareTaskNativeAF1F } from '../proof/task/native-af1f.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskAF1FFixture } from './task-native-af1f-fixtures.mjs';
const sourcePath = 'analysis/render-task-native-af1f.json',
  source = JSON.parse(await readFile(sourcePath));
const { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc')),
  proof = proveTaskAF1F(decodeTaskWindows(bytes, taskAF1FSpec.windows).map);
if (
  metadata.rom_sha256 !== taskRomHash ||
  source.rom_sha256 !== taskRomHash ||
  JSON.stringify(source.proofs) !== JSON.stringify([proof])
)
  throw Error('AF1F source drift');
const probes = [
  {},
  { values: [2, 7, 5, 1, 3, 4] },
  { row: 60, parameter: 0, values: [3, 0, 3, 0, 0] },
  { firstGate: 0, values: [] },
  { secondGate: 0x8001, values: [] },
  { omit: 0x8db8d3 },
  { s: 0xa9 },
].map((inputs) => {
  const f = taskAF1FFixture(inputs),
    before = f.data.snapshot(),
    p = prepareTaskNativeAF1F(f);
  if (JSON.stringify(before) !== JSON.stringify(f.data.snapshot()))
    throw Error('AF1F prepare mutation');
  if (p.handled && !commitTaskPlan(f.data, p).handled) throw Error('AF1F commit failed');
  const { accesses, byteWrites, readAddresses, ...result } = p;
  return {
    synthetic_inputs: inputs,
    result,
    planned_bytes: byteWrites?.length ?? 0,
    qualification:
      'Explicit synthetic fields/Task/stack and separately observed device values; original pointer/table bytes. No calculated results, device/scene/frame execution or original body claim.',
  };
});
await writeFile(
  'analysis/render-task-native-af1f-native.json',
  JSON.stringify(
    {
      rom_sha256: taskRomHash,
      progress_reference: 'docs/PORTIERUNGSSTAND.json',
      native_binding: true,
      manual_only: true,
      full_task_binding: false,
      global_stack_minimum: null,
      completed_script_bodies: 0,
      bindings: [
        {
          entry: cpuLabel(taskAF1FSpec.entry),
          module: 'proof/task/native-af1f.mjs',
          export: 'prepareTaskNativeAF1F',
          source_contract: sourcePath,
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
console.log(
  'Task AF1F: full active/gated branches, real stack, independent chronological observations and atomic commit.',
);
