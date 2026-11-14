import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom } from './rom.mjs';
import { taskRomHash } from './task-partial-source.mjs';
import { proveTaskNative13 } from './task-native13-source.mjs';
import { prepareTaskNativeOpcode9BA0 } from '../proof/task/native13-opcode.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskNative13Fixture } from './task-native13-fixtures.mjs';
const sourcePath = 'analysis/render-task-native-opcode-9ba0.json',
  source = JSON.parse(await readFile(sourcePath)),
  { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
const proof = await proveTaskNative13(bytes);
if (
  source.rom_sha256 !== taskRomHash ||
  metadata.rom_sha256 !== taskRomHash ||
  JSON.stringify(source.proofs) !== JSON.stringify([proof])
)
  throw Error('Native13 source drift');
const probes = [
  [{}, true],
  [{ mask: 16, held: 16, scriptBank: 0x83 }, true],
  [{ s: 0xa3 }, false],
].map(([inputs, expected]) => {
  const f = taskNative13Fixture(inputs),
    before = f.data.snapshot(),
    p = prepareTaskNativeOpcode9BA0(f);
  if (p.handled !== expected) throw Error('Native13 unexpected probe boundary');
  if (JSON.stringify(before) !== JSON.stringify(f.data.snapshot()))
    throw Error('Native13 prepare mutation');
  if (p.handled && !commitTaskPlan(f.data, p).handled) throw Error('Native13 commit failed');
  const { accesses, byteWrites, readAddresses, ...result } = p;
  return {
    synthetic: true,
    inputs,
    result,
    planned_bytes: byteWrites?.length ?? 0,
    qualification:
      'Original13 pointer/argument/return anchors and unpack sources; explicitly synthetic Task/frame/operand/outerstack/menu/font/dictionary/cache/device/wait/control data. Actual bounded whole Native58/13/F508/F509/result-PHA/F390 only; no initialized original caller/device/time/scene/frame/body claim.',
  };
});
await writeFile(
  'analysis/render-task-native-opcode-9ba0-native.json',
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
          module: 'proof/task/native13-opcode.mjs',
          export: 'prepareTaskNativeOpcode9BA0',
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
  'Native58/13: separate whole-call native evidence; cancel/positive/scriptBank and actualA2-JSR-alias probes.',
);
