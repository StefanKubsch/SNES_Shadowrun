import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom } from './rom.mjs';
import { taskRomHash } from './task-partial-source.mjs';
import { proveTaskNativeAudioOpcode } from './task-native-audio-opcode-source.mjs';
import { prepareTaskNativeOpcodeC46E as prepare } from '../proof/task/native-audio-opcode.mjs';
import { taskNativeAudioOpcodeFixture as fixture } from './task-native-audio-opcode-fixtures.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
const sourcePath = 'analysis/render-task-native-opcode-c46e.json',
  source = JSON.parse(await readFile(sourcePath)),
  { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc')),
  proof = await proveTaskNativeAudioOpcode(bytes);
if (
  source.rom_sha256 !== taskRomHash ||
  metadata.rom_sha256 !== taskRomHash ||
  JSON.stringify(source.proofs) !== JSON.stringify([proof])
)
  throw Error('Native4C source drift');
const probes = [
  [{}, true],
  [{ sound: 0x8007, token: 254, scriptBank: 0x83 }, true],
  [{ voice: 0 }, false],
].map(([inputs, expected]) => {
  const f = fixture(inputs),
    before = f.data.snapshot(),
    p = prepare(f);
  if (p.handled !== expected) throw Error('Native4C unexpected probe boundary: ' + p.reason);
  if (JSON.stringify(before) !== JSON.stringify(f.data.snapshot()))
    throw Error('Native4C prepare mutation');
  if (p.handled && !commitTaskPlan(f.data, p).handled) throw Error('Native4C commit failed');
  const { accesses, byteWrites, readAddresses, ...result } = p;
  return {
    synthetic: true,
    inputs,
    result,
    planned_bytes: byteWrites?.length ?? 0,
    qualification:
      'Original4C pointer/argument/return/dispatch/code sources; explicitly synthetic Task/frame/operand/outerstack/cache/sound/directory/payload/APU/product values. Actual whole conditional normal Native58/4C/F508/F509/F390 only; zeroVoice failure publishes no effects. No original initialized caller/device/time/scene/frame/body claim.',
  };
});
await writeFile(
  'analysis/render-task-native-opcode-c46e-native.json',
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
          module: 'proof/task/native-audio-opcode.mjs',
          export: 'prepareTaskNativeOpcodeC46E',
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
  'Native58/4C: whole-call normal/high-loader/token-wrap/scriptBank and zeroVoice boundary evidence.',
);
