import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom } from './rom.mjs';
import { taskRomHash } from './task-partial-source.mjs';
import { proveTaskNativeC8 } from './task-native-c8-source.mjs';
import { prepareTaskNativeOpcodeFEC1 } from '../proof/task/native-c8-opcode.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskNativeC8Fixture } from './task-native-c8-fixtures.mjs';
const sourcePath = 'analysis/render-task-native-opcode-fec1.json',
  source = JSON.parse(await readFile(sourcePath)),
  { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
const proof = await proveTaskNativeC8(bytes);
if (
  source.rom_sha256 !== taskRomHash ||
  metadata.rom_sha256 !== taskRomHash ||
  JSON.stringify(source.proofs) !== JSON.stringify([proof])
)
  throw Error('NativeC8 source drift');
const probes = [
  [{}, true],
  [{ cursor: 0, occupied: [4, 4, 4, 4], activeAF1F: true }, true],
  [{ s: 0xa3 }, false],
].map(([inputs, expectedHandled]) => {
  const f = taskNativeC8Fixture(inputs),
    before = f.data.snapshot(),
    p = prepareTaskNativeOpcodeFEC1(f);
  if (p.handled !== expectedHandled) throw Error('NativeC8 unexpected probe boundary');
  if (JSON.stringify(before) !== JSON.stringify(f.data.snapshot()))
    throw Error('NativeC8 prepare mutation');
  if (p.handled && !commitTaskPlan(f.data, p).handled) throw Error('NativeC8 commit failed');
  const { accesses, byteWrites, readAddresses, ...result } = p;
  return {
    synthetic: true,
    inputs,
    result,
    planned_bytes: byteWrites?.length ?? 0,
    qualification:
      'Original C8 pointer/argument/return anchors and loader/table sources, otherwise explicit synthetic Task/frame/operand/outerstack/notice/text/glyph/slots and chronological MMIO/wait events. Actual bounded Native58/C8/FEC1/F508/F509/F390 composition only; no whole original body/device/time/scene/frame execution.',
  };
});
await writeFile(
  'analysis/render-task-native-opcode-fec1-native.json',
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
          entry: '80:F390',
          module: 'proof/task/native-c8-opcode.mjs',
          export: 'prepareTaskNativeOpcodeFEC1',
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
  'Native58/C8: separate original full-call native evidence, active/free/replacement and fresh-A2 JSR alias probes.',
);
