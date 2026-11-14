import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decodeTaskWindows, taskRomHash } from './task-partial-source.mjs';
import {
  textComposeWindows,
  proveTaskTextComposition,
} from './task-native-text-compose-source.mjs';
import { prepareTaskTextFE69, prepareTaskTextFB39 } from '../proof/task/native-text-compose.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskTextComposeFixture } from './task-native-text-compose-fixtures.mjs';
const sourcePath = 'analysis/render-task-native-text-compose.json',
  source = JSON.parse(await readFile(sourcePath)),
  { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
if (source.rom_sha256 !== taskRomHash || metadata.rom_sha256 !== taskRomHash)
  throw Error('Whole Task text ROM drift');
const bindings = [0x80fe69, 0x80fb39].map((entry) => {
  const proof = proveTaskTextComposition(
    decodeTaskWindows(bytes, textComposeWindows(entry)).map,
    entry,
  );
  if (
    JSON.stringify(proof) !== JSON.stringify(source.proofs.find((p) => p.entry === cpuLabel(entry)))
  )
    throw Error('Whole native text source drift');
  return {
    entry: cpuLabel(entry),
    module: 'proof/task/native-text-compose.mjs',
    export: entry === 0x80fe69 ? 'prepareTaskTextFE69' : 'prepareTaskTextFB39',
    source_contract: sourcePath,
    source_proof_field: 'proofs',
    source_proof: proof,
  };
});
const probes = [
  ['FE69', {}],
  ['FB39', {}],
  ['FB39', { style: 0xf8, text: [0x7c, 97, 32, 98, 0, 0] }],
  ['FE69', { waitFA: [] }],
  ['FB39', { s: 0x1ff }],
  ['FE69', { s: 0x209 }],
  ['FB39', { s: 0xcf }],
].map(([helper, inputs]) => {
  const f = taskTextComposeFixture(helper, inputs),
    before = f.data.snapshot(),
    p = (helper === 'FE69' ? prepareTaskTextFE69 : prepareTaskTextFB39)(f);
  if (JSON.stringify(before) !== JSON.stringify(f.data.snapshot()))
    throw Error('Whole text prepare mutated provider');
  if (p.handled && !commitTaskPlan(f.data, p).handled) throw Error('Whole text commit failed');
  const { accesses, byteWrites, readAddresses, ...result } = p;
  return {
    helper,
    synthetic_inputs: inputs,
    result,
    planned_bytes: byteWrites?.length ?? 0,
    qualification:
      'Explicit synthetic dictionary/Task/fields/stack/geometry/glyph sources and chronological MMIO/wait events; complete fixed native helper paths only, no original caller, device/time/interrupt/scene/frame execution or original body claim.',
  };
});
await writeFile(
  'analysis/render-task-native-text-compose-native.json',
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
  'Whole Task FE69/FB39: native dictionary/word/style/glyph/line graphs and actual stack/chronological device/wait/atomic return probes.',
);
