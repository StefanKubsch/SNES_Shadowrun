import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom } from './rom.mjs';
import { decodeTaskWindows, taskRomHash } from './task-partial-source.mjs';
import { spec, prove } from './render-task-status-return-source-proof.mjs';
import { taskStatusReturnFixture } from './task-status-return-fixtures.mjs';
import { prepareTaskStatusReturn } from '../proof/task/status-return.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
const { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
if (metadata.rom_sha256 !== taskRomHash) throw Error('Wrong status-return ROM');
const proofs = prove(decodeTaskWindows(bytes, spec.windows).map),
  source_contract = 'analysis/render-task-status-return.json';
const source = JSON.parse(await readFile(source_contract));
if (JSON.stringify(source.proofs) !== JSON.stringify(proofs))
  throw Error('Status return source drift');
const base = prepareTaskStatusReturn(taskStatusReturnFixture());
if (!base.handled) throw Error(base.reason);
const probes = [];
for (const [limit, patch] of [
  ['exact', { maxWork: base.work, maxOutputBytes: base.outputBytes }],
  ['work-minus-one', { maxWork: base.work - 1 }],
  ['output-minus-one', { maxOutputBytes: base.outputBytes - 1 }],
]) {
  const f = taskStatusReturnFixture(),
    before = JSON.stringify(f.data.snapshot()),
    p = prepareTaskStatusReturn({ ...f, ...patch });
  if (JSON.stringify(f.data.snapshot()) !== before)
    throw Error('Status preparation mutated live owner');
  if (limit === 'exact' && (!p.handled || !commitTaskPlan(f.data, p).handled))
    throw Error('Status exact commit failed');
  if (limit !== 'exact' && (p.handled || p.byteWrites || p.ioRequests))
    throw Error('Status partial effects escaped');
  probes.push({ ...p, synthetic: true, limit });
}
await writeFile(
  'analysis/render-task-status-return-native.json',
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
          entry: '80:F927',
          module: 'proof/task/status-return.mjs',
          export: 'prepareTaskStatusReturn',
          source_contract,
          source_proof_field: 'proofs',
          source_proof: proofs[0],
        },
      ],
      probes,
      scope: spec.host_boundary,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'F927: source-linked current-stack native return, synthetic exact/failed budget probes.',
);
