import { writeFile } from 'node:fs/promises';
import { taskRomHash } from './task-partial-source.mjs';
import { verifyTaskNativeRandomOpcodeSource } from './task-native-random-opcode-source.mjs';
import { taskNativeRandomOpcodeFixture } from './task-native-random-fixtures.mjs';
import {
  prepareTaskNativeOpcodeC51F,
  prepareTaskNativeOpcodeC560,
} from '../proof/task/native-random-opcode.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
const proof = await verifyTaskNativeRandomOpcodeSource(),
  proof63 = await verifyTaskNativeRandomOpcodeSource(0x63),
  source = 'analysis/render-task-native-opcode-c51f.json',
  probes = [];
for (const [name, options] of [
  ['zero', { limit: 0 }],
  ['normal', {}],
  [
    'retry',
    {
      limit: 16,
      values: [
        [123, 26, 0],
        [123, 143, 1],
      ],
    },
  ],
  ['actual-mask-stack-alias', { s: 7 }],
]) {
  for (const patch of [{}, { maxWork: 0 }, { maxOutputBytes: 0 }]) {
    const f = taskNativeRandomOpcodeFixture(options),
      before = JSON.stringify(f.data.snapshot()),
      p = prepareTaskNativeOpcodeC51F({ ...f, ...patch });
    if (
      JSON.stringify(f.data.snapshot()) !== before ||
      (p.handled && !commitTaskPlan(f.data, p).handled)
    )
      throw Error('Native3E prepare/commit drift');
    probes.push({ ...p, entry: '80:F390', case: name, synthetic: true, limits: patch });
  }
}
if (probes.filter((p) => p.handled).length !== 4) throw Error('Whole Native3E fixture missing');
await writeFile(
  'analysis/render-task-native-opcode-c51f-native.json',
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
          module: 'proof/task/native-random-opcode.mjs',
          export: 'prepareTaskNativeOpcodeC51F',
          source_contract: source,
          source_proof_field: 'proofs',
          source_proof: proof,
        },
      ],
      probes,
      scope:
        'Whole observed originalNative58/3E with independent PPU BYTE samples, actual argument/stack/RTS/F509/resultPHA; no termination/time/Task/scene/frame/body proof.',
    },
    null,
    2,
  ) + '\n',
);
console.log('Whole Native58/3E:zero/range/retry/actual-stack-alias synthetic probes.');
const probes63 = [];
for (const [name, options] of [
  ['normal', {}],
  ['full-WORD-result', { mixLow: 0xaa, mixHigh: 0x55 }],
  ['state-byte-wrap', { seed: 255, mixLow: 0x64, values: [[0, 0, 255]] }],
]) {
  for (const patch of [{}, { maxWork: 0 }, { maxOutputBytes: 0 }]) {
    const f = taskNativeRandomOpcodeFixture({ id: 0x63, ...options }),
      before = JSON.stringify(f.data.snapshot()),
      p = prepareTaskNativeOpcodeC560({ ...f, ...patch });
    if (
      JSON.stringify(f.data.snapshot()) !== before ||
      (p.handled && !commitTaskPlan(f.data, p).handled)
    )
      throw Error('Native63 prepare/commit drift');
    probes63.push({ ...p, entry: '80:F390', case: name, synthetic: true, limits: patch });
  }
}
if (probes63.filter((p) => p.handled).length !== 3) throw Error('Whole Native63 fixture missing');
await writeFile(
  'analysis/render-task-native-opcode-c560-native.json',
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
          module: 'proof/task/native-random-opcode.mjs',
          export: 'prepareTaskNativeOpcodeC560',
          source_contract: 'analysis/render-task-native-opcode-c560.json',
          source_proof_field: 'proofs',
          source_proof: proof63,
        },
      ],
      probes: probes63,
      scope:
        'Exactly originalNative58/63:zeroWORDpops/original0100/C560/actualF508-F509/0002-resultPHA with independently observed PPU BYTE reads, no range/device/time/Task/scene/frame/body inference.',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Whole Native58/63:normal/fullWORDresult/stateBYTEwrap, zero argument pops and actualF509/resultPHA.',
);
