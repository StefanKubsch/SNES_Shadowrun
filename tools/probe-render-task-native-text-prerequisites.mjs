import { readFile, writeFile } from 'node:fs/promises';
import * as native from '../proof/task/native-text-prerequisites.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskTextFixture } from './task-native-text-fixtures.mjs';
import { taskTextSpecs } from './task-native-text-specs.mjs';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decodeTaskWindows, taskRomHash } from './task-partial-source.mjs';
import { proveTaskTextRoot } from './task-native-text-source.mjs';
const { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
const sourcePath = 'analysis/render-task-native-text-prerequisites.json',
  source = JSON.parse(await readFile(sourcePath));
if (metadata.rom_sha256 !== taskRomHash || source.rom_sha256 !== taskRomHash)
  throw Error('Text prerequisite ROM drift');
const bindings = taskTextSpecs.map((spec) => {
  const proof = proveTaskTextRoot(decodeTaskWindows(bytes, spec.windows).map, spec);
  if (
    JSON.stringify(proof) !==
    JSON.stringify(source.proofs.find((p) => p.entry === cpuLabel(spec.entry)))
  )
    throw Error('Text native/source drift');
  return {
    entry: cpuLabel(spec.entry),
    module: 'proof/task/native-text-prerequisites.mjs',
    export: 'prepareTaskText' + spec.name,
    source_contract: sourcePath,
    source_proof_field: 'proofs',
    source_proof: proof,
  };
});
const cases = [
  ['AF04', {}],
  ['AF04', { remaining: 1 }],
  ['ADBA', {}],
  ['ADBA', { minimum: 9, offset: 7, results: [0] }],
  ['AE14', {}],
  ['AE4D', {}],
  ['AE4D', { height: 4, quotients: [1], results: [3] }],
  ['AE4D', { results: [224] }],
  ['ADBA', { results: [] }],
  ['AEC8', {}],
  ['AEC8', { maskIndex: 0 }],
  ['AEF4', {}],
  ['AEFC', {}],
  ['ACC3', {}],
  ['ACC9', {}],
  ['AEF4', { s: 0x1fd, waitValues: [0] }],
];
const probes = cases.map(([name, inputs]) => {
  const f = taskTextFixture(name, inputs),
    before = f.data.snapshot(),
    p = native['prepareTaskText' + name](f);
  if (JSON.stringify(before) !== JSON.stringify(f.data.snapshot()))
    throw Error('Text prepare mutated provider');
  if (p.handled && !commitTaskPlan(f.data, p).handled) throw Error('Text commit failed');
  const { accesses, byteWrites, readAddresses, ...result } = p;
  return {
    helper: name,
    synthetic_inputs: inputs,
    result,
    planned_bytes: byteWrites?.length ?? 0,
    qualification:
      'Explicit synthetic Task/stack/geometry/dictionary and chronological MMIO observations. No initialized original caller, devices/time/interrupt/Task/scene/frames or complete original body.',
  };
});
await writeFile(
  'analysis/render-task-native-text-prerequisites-native.json',
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
  'Task text: nine complete roots, actual RTL/stack/DBR/mode/chronological MMIO/waits and atomic abort probes.',
);
