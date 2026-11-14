import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decodeTaskWindows, taskRomHash } from './task-partial-source.mjs';
import {
  renderComposeEntries,
  renderComposeWindows,
  proveTaskRenderCompose,
} from './task-native-render-compose-source.mjs';
import * as native from '../proof/task/native-render-compose.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskRenderComposeFixture } from './task-native-render-compose-fixtures.mjs';
const sourcePath = 'analysis/render-task-native-render-compose.json',
  source = JSON.parse(await readFile(sourcePath));
const { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
if (source.rom_sha256 !== taskRomHash || metadata.rom_sha256 !== taskRomHash)
  throw Error('Render compose ROM drift');
const names = ['ACAF', 'ACB5', 'ACCF', 'AD92', 'FA3E'];
const bindings = renderComposeEntries.map((entry, n) => {
  const proof = proveTaskRenderCompose(
    decodeTaskWindows(bytes, renderComposeWindows(entry)).map,
    entry,
  );
  if (
    JSON.stringify(proof) !== JSON.stringify(source.proofs.find((p) => p.entry === cpuLabel(entry)))
  )
    throw Error('Render compose source drift');
  return {
    entry: cpuLabel(entry),
    module: 'proof/task/native-render-compose.mjs',
    export: 'prepareTaskNative' + names[n],
    source_contract: sourcePath,
    source_proof_field: 'proofs',
    source_proof: proof,
  };
});
const probes = [
  ...names.map((helper) => [helper, {}]),
  ['AD92', { active: true, last: 4, flags: [1, 0, 1], wait: [0x100, 0] }],
  ['FA3E', { last: 4, index: 4, flags: [1, 0, 1] }],
  ['ACB5', { counter: 65535 }],
  ['AD92', { s: 0xcf, last: 2, flags: [1, 1] }],
  ['AD92', { omit: 0x7e2181 }],
].map(([helper, inputs]) => {
  const f = taskRenderComposeFixture(helper, inputs),
    before = f.data.snapshot(),
    p = native['prepareTaskNative' + helper](f);
  if (JSON.stringify(before) !== JSON.stringify(f.data.snapshot()))
    throw Error('Render compose prepare mutation');
  if (p.handled && !commitTaskPlan(f.data, p).handled) throw Error('Render compose commit failed');
  const { accesses, byteWrites, readAddresses, ...result } = p;
  return {
    helper,
    inputs,
    result,
    planned_bytes: byteWrites?.length ?? 0,
    qualification:
      'Original compressed source and tables, otherwise explicit synthetic Task/fields/flags/stack and chronological MMIO/wait events; whole native helper graphs only, no original body/device/scene/frame execution.',
  };
});
await writeFile(
  'analysis/render-task-native-render-compose-native.json',
  JSON.stringify(
    {
      rom_sha256: taskRomHash,
      progress_reference: 'docs/PORTIERUNGSSTAND.json',
      native_binding: true,
      manual_only: true,
      full_task_binding: false,
      global_stack_minimum: null,
      bindings,
      completed_script_bodies: 0,
      probes,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Whole Task FA3E/AD92/ACCF/ACB5/ACAF: full source/stack branches, fresh observations and atomic commit.',
);
