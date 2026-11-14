import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom } from './rom.mjs';
import { decodeTaskWindows, taskRomHash } from './task-partial-source.mjs';
import { emitTaskPartialSource } from './task-partial-source.mjs';
import {
  proveOpcodeTarget,
  proveOpcodeBinding,
  opcodeDispatchWindow,
} from './task-opcode-source.mjs';
import { taskOpcodeSpecs } from './task-opcode-specs.mjs';
import { taskOpcodeFixture } from './task-opcode-fixtures.mjs';
import { prepareTaskOpcodeTarget } from '../proof/task/opcode-target.mjs';
import * as sequences from '../proof/task/opcode-sequence.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
const put = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
async function proofFor(name) {
  const { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
  if (metadata.rom_sha256 !== taskRomHash) throw Error('Wrong opcode ROM');
  const spec = taskOpcodeSpecs.find((s) => s.name === name);
  if (!spec && name !== 'opcode-dispatch') throw Error('Unknown opcode source');
  const proof = spec
    ? await proveOpcodeBinding(bytes, spec)
    : proveOpcodeTarget(decodeTaskWindows(bytes, [opcodeDispatchWindow]).map);
  return { spec, proof };
}
export async function emitOpcodeSource(name) {
  const { spec, proof } = await proofFor(name);
  const report = await emitTaskPartialSource(
    {
      name,
      entry: 0x80f390,
      windows: [opcodeDispatchWindow],
      classification: 'bounded-original-opcode-slot-contract',
      host_boundary: proof.boundary ?? proof.frontier,
    },
    () => [proof],
    [],
  );
  if (spec)
    report.dispatch_entries = [{ opcode: spec.opcode, ...proof.slot, target: proof.target }];
  await put(`analysis/render-task-${name}.json`, report);
}
export async function emitOpcodeNative(name) {
  const { spec, proof } = await proofFor(name),
    sourcePath = `analysis/render-task-${name}.json`,
    source = JSON.parse(await readFile(sourcePath));
  if (
    source.rom_sha256 !== taskRomHash ||
    JSON.stringify(source.proofs) !== JSON.stringify([proof])
  )
    throw Error('Opcode source drift');
  const module = spec ? 'proof/task/opcode-sequence.mjs' : 'proof/task/opcode-target.mjs';
  const exportName = spec ? spec.exportName : 'prepareTaskOpcodeTarget',
    prepare = spec ? sequences[exportName] : prepareTaskOpcodeTarget;
  const probes = [];
  for (const limits of [{}, { maxWork: 0 }, { maxOutputBytes: 0 }]) {
    const f = taskOpcodeFixture(spec),
      before = JSON.stringify(f.data.snapshot()),
      p = prepare({ ...f, ...limits });
    if (JSON.stringify(f.data.snapshot()) !== before)
      throw Error('Opcode prepare changed live data');
    if (p.handled && !commitTaskPlan(f.data, p).handled) throw Error('Opcode commit failed');
    probes.push({ ...p, entry: '80:F390', synthetic: true, limits });
  }
  if (!probes[0].handled)
    throw Error('Missing successful opcode fixture ' + name + ': ' + probes[0].reason);
  const compositionProbes = [];
  if (!spec)
    for (const limit of ['exact', 'work-minus-one', 'output-minus-one']) {
      const f = taskOpcodeFixture();
      f.data.seed(0x801204, [0x86, 0xba, 0x5c, 0xbe, 0x14, 0xa5]);
      const options = { ...f, maxHandlers: 5 },
        reference = sequences.prepareTaskOpcodeSequence(options);
      if (!reference.handled) throw Error('Missing whole opcode composition');
      if (limit === 'work-minus-one') options.maxWork = reference.work - 1;
      if (limit === 'output-minus-one') options.maxOutputBytes = reference.outputBytes - 1;
      const before = JSON.stringify(f.data.snapshot()),
        plan = sequences.prepareTaskOpcodeSequence(options);
      if (JSON.stringify(f.data.snapshot()) !== before)
        throw Error('Whole opcode plan mutated owner');
      compositionProbes.push({ ...plan, synthetic: true, limit });
    }
  await put(`analysis/render-task-${name}-native.json`, {
    rom_sha256: taskRomHash,
    progress_reference: 'docs/PORTIERUNGSSTAND.json',
    native_binding: true,
    manual_only: true,
    full_task_binding: false,
    global_stack_minimum: null,
    scope:
      'Original full-X bank80 dispatch with individually pinned handler equations on one atomic overlay. Explicit finite count, cumulative access/output budgets and protected actual outer owners. Synthetic fixtures only; no whole Task/scene/frame evidence.',
    bindings: [
      {
        entry: '80:F390',
        module,
        export: exportName,
        source_contract: sourcePath,
        source_proof_field: 'proofs',
        source_proof: proof,
      },
    ],
    probes,
    ...(!spec
      ? {
          composition: {
            module: 'proof/task/opcode-sequence.mjs',
            export: 'prepareTaskOpcodeSequence',
            entry: '80:F390',
            probes: compositionProbes,
          },
        }
      : {}),
  });
  console.log(name + ': original opcode native plan checked.');
}
