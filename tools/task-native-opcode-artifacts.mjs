import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom } from './rom.mjs';
import { taskRomHash } from './task-partial-source.mjs';
import { proveNativeOpcode } from './task-native-opcode-source.mjs';
import { nativeOpcodeSpecs } from './task-native-opcode-specs.mjs';
import { taskNativeOpcodeFixture } from './task-native-opcode-fixtures.mjs';
import { prepareTaskNativeOpcodeSequence } from '../proof/task/opcode-sequence.mjs';
import * as bindings from '../proof/task/native-opcode-bindings.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
const put = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const blocks = [null, ...nativeOpcodeSpecs];
const nameFor = (s) => s?.compositionName ?? 'native-opcode';
async function rom() {
  const r = inspectRom(await readFile('Shadowrun (E).smc'));
  if (r.metadata.rom_sha256 !== taskRomHash) throw Error('Wrong Native58 ROM');
  return r.bytes;
}
export async function emitNativeOpcodeSources() {
  const bytes = await rom();
  for (const s of blocks) {
    const name = nameFor(s),
      proof = await proveNativeOpcode(bytes, s),
      windows = proof.parts.flatMap((p) => p.windows);
    const report = {
      rom_sha256: taskRomHash,
      progress_reference: 'docs/PORTIERUNGSSTAND.json',
      windows,
      proofs: [proof],
      source_graph: {
        native_binding: false,
        local_source_complete: true,
        source_closed_to_dispatch: true,
        full_graph_closed: false,
        classification: 'bounded-native58-full-opcode-composition',
        global_stack_minimum: null,
      },
      scope:
        'Conditional original Native58 argument/bridge/leaf/actual RTS/resume joins. No initialization, occurrence, whole Task, device, scene or frame proof.',
    };
    await put(`analysis/render-task-${name}.json`, report);
  }
  console.log(`Native58: ${blocks.length} separately renewed composition source reports.`);
}
export async function emitNativeOpcodeNatives() {
  const bytes = await rom();
  for (const s of blocks) {
    const name = nameFor(s),
      sourcePath = `analysis/render-task-${name}.json`,
      source = JSON.parse(await readFile(sourcePath));
    const proof = await proveNativeOpcode(bytes, s);
    if (
      source.rom_sha256 !== taskRomHash ||
      JSON.stringify(source.proofs) !== JSON.stringify([proof])
    )
      throw Error('Native58 source report drift');
    const prepare = s ? bindings[s.exportName] : prepareTaskNativeOpcodeSequence,
      probes = [];
    const reference = prepare(taskNativeOpcodeFixture(s ?? undefined));
    if (!reference.handled) throw Error(name + ': ' + reference.reason);
    for (const [limit, patch] of [
      ['exact', { maxWork: reference.work, maxOutputBytes: reference.outputBytes }],
      ['work-minus-one', { maxWork: reference.work - 1 }],
      ['output-minus-one', { maxOutputBytes: reference.outputBytes - 1 }],
    ]) {
      const f = taskNativeOpcodeFixture(s ?? undefined),
        before = JSON.stringify(f.data.snapshot()),
        p = prepare({ ...f, ...patch });
      if (JSON.stringify(f.data.snapshot()) !== before)
        throw Error('Native58 preparation mutated owner');
      if (limit === 'exact' && (!p.handled || !commitTaskPlan(f.data, p).handled))
        throw Error('Native58 exact plan/commit failed');
      if (limit !== 'exact' && (p.handled || p.byteWrites || p.ioRequests))
        throw Error('Native58 budget failure exposed effects');
      probes.push({ ...p, synthetic: true, limit });
    }
    const module = s ? 'proof/task/native-opcode-bindings.mjs' : 'proof/task/opcode-sequence.mjs',
      exportName = s?.exportName ?? 'prepareTaskNativeOpcodeSequence';
    await put(`analysis/render-task-${name}-native.json`, {
      rom_sha256: taskRomHash,
      progress_reference: 'docs/PORTIERUNGSSTAND.json',
      native_binding: true,
      manual_only: true,
      full_task_binding: false,
      global_stack_minimum: null,
      scope:
        'Manually composed original equations, one atomic overlay, fresh physical sources and actual inner RTS. All probes synthetic.',
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
    });
  }
  console.log(
    `Native58: ${blocks.length} source-linked native reports, exact and two failing budgets per block.`,
  );
}
