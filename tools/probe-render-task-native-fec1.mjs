import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom } from './rom.mjs';
import { decodeTaskWindows, taskRomHash } from './task-partial-source.mjs';
import { fec1Windows, proveTaskFEC1 } from './task-native-fec1-source.mjs';
import { prepareTaskNativeFEC1 } from '../proof/task/native-fec1.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskFEC1Fixture } from './task-native-fec1-fixtures.mjs';
const sourcePath = 'analysis/render-task-native-fec1.json',
  source = JSON.parse(await readFile(sourcePath)),
  { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
const proof = proveTaskFEC1(decodeTaskWindows(bytes, fec1Windows()).map);
if (
  source.rom_sha256 !== taskRomHash ||
  metadata.rom_sha256 !== taskRomHash ||
  JSON.stringify(source.proofs) !== JSON.stringify([proof])
)
  throw Error('Whole FEC1 source drift');
const probes = [
  [{}, true],
  [{ occupied: [4, 4, 4, 4] }, true],
  [{ cursor: 0, occupied: [4, 4, 4, 4], activeAF1F: true }, true],
  [{ cursor: 0, occupied: [4, 4, 4, 4], activeAF1F: true, afValues: [2, 7, 5, 1, 3, 4] }, true],
  [{ occupied: [4, 4, 0x8000, 4] }, true],
  [{ omit: 0x9d8011 }, false],
  [{ s: 0xcf, occupied: [4, 4, 4, 4] }, false],
].map(([inputs, expectedHandled]) => {
  const f = taskFEC1Fixture(inputs),
    before = f.data.snapshot(),
    p = prepareTaskNativeFEC1(f);
  if (p.handled !== expectedHandled) throw Error('Unexpected whole FEC1 probe boundary');
  if (JSON.stringify(before) !== JSON.stringify(f.data.snapshot()))
    throw Error('Whole FEC1 prepare mutation');
  if (p.handled && !commitTaskPlan(f.data, p).handled) throw Error('Whole FEC1 commit failed');
  const { accesses, byteWrites, readAddresses, ...result } = p;
  return {
    inputs,
    result,
    planned_bytes: byteWrites?.length ?? 0,
    qualification:
      'Original compressed loader/table/pointer bytes, explicit synthetic Task/notice/dictionary/glyph/fields/slot/stack and chronological hardware/wait observations. Full native helper only, no actual NativeC8/body/device/scene/frame execution.',
  };
});
await writeFile(
  'analysis/render-task-native-fec1-native.json',
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
          entry: '80:FEC1',
          module: 'proof/task/native-fec1.mjs',
          export: 'prepareTaskNativeFEC1',
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
  'Whole Task FEC1: free/occupied/allocation/text/replacement, actual mixed stack, global observed chronology and one outer commit.',
);
