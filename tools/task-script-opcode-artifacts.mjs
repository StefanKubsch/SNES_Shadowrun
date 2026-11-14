import { readFile } from 'node:fs/promises';
import { writeArtifactIfChanged } from './write-artifact.mjs';
import { inspectRom } from './rom.mjs';
import { taskRomHash } from './task-partial-source.mjs';
import { proveScriptOpcode, proveScriptContinuation } from './task-script-opcode-source.mjs';
import {
  scriptOpcodeSpecs,
  taskScriptOpcodeFixture,
  taskScriptResumeFixture,
} from './task-script-opcode-fixtures.mjs';
import { prepareTaskScriptOpcode52 } from '../proof/task/opcode-sequence.mjs';
import { prepareTaskScriptYield } from '../proof/task/script-yield.mjs';
import { prepareTaskScriptArguments } from '../proof/task/script-arguments.mjs';
import { prepareTaskScriptResume } from '../proof/task/script-resume.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import * as bindings from '../proof/task/script-opcode-bindings.mjs';
import { scriptOpcodeOutputPlan } from './script-opcode-outputs.mjs';
const put = (path, v) => writeArtifactIfChanged(path, JSON.stringify(v, null, 2) + '\n');
const { blocks, continuation } = scriptOpcodeOutputPlan(scriptOpcodeSpecs);
async function rom() {
  const { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
  if (metadata.rom_sha256 !== taskRomHash) throw Error('Wrong script ROM');
  return bytes;
}
export async function emitScriptOpcodeSources() {
  const bytes = await rom();
  for (const { spec: s, source } of blocks) {
    const proof = await proveScriptOpcode(bytes, s);
    await put(source, {
      rom_sha256: taskRomHash,
      progress_reference: 'docs/PORTIERUNGSSTAND.json',
      windows: proof.parts.flatMap((p) => p.windows),
      proofs: [proof],
      source_graph: {
        native_binding: false,
        local_source_complete: true,
        full_graph_closed: false,
        classification: 'bounded-script52-actual-outer-yield',
      },
      scope: proof.boundary,
    });
  }
  const proofs = await proveScriptContinuation(bytes);
  await put(continuation.source, {
    rom_sha256: taskRomHash,
    progress_reference: 'docs/PORTIERUNGSSTAND.json',
    proofs,
    source_graph: { native_binding: false, local_source_complete: true, full_graph_closed: false },
    scope:
      'Separate yielding F488 and later externally reached F495. Shared equation dependency checked, no readiness/temporal join.',
  });
  console.log(
    `Script52: ${blocks.length} original opcode/ID contracts and one separate two-entry continuation contract.`,
  );
}
function probes(prepare, fixture) {
  const base = prepare(fixture());
  if (!base.handled) throw Error('Script probe: ' + base.reason);
  return [
    ['exact', { maxWork: base.work, maxOutputBytes: base.outputBytes }],
    ['work-minus-one', { maxWork: base.work - 1 }],
    ['output-minus-one', { maxOutputBytes: base.outputBytes - 1 }],
  ].map(([limit, patch]) => {
    const f = fixture(),
      before = JSON.stringify(f.data.snapshot()),
      p = prepare({ ...f, ...patch });
    if (JSON.stringify(f.data.snapshot()) !== before) throw Error('Script prepare changed owner');
    if (limit === 'exact' && (!p.handled || !commitTaskPlan(f.data, p).handled))
      throw Error('Exact script plan failed');
    if (limit !== 'exact' && (p.handled || p.byteWrites || p.ioRequests))
      throw Error('Script budget leaked effects');
    return { ...p, synthetic: true, limit };
  });
}
export async function emitScriptOpcodeNatives() {
  const bytes = await rom();
  for (const { spec: s, source: sourcePath, native } of blocks) {
    const proof = await proveScriptOpcode(bytes, s),
      source = JSON.parse(await readFile(sourcePath));
    if (JSON.stringify(source.proofs) !== JSON.stringify([proof]))
      throw Error('Script native source drift');
    const exportName = s
      ? 'prepareTaskScriptOpcode' + s.id.toString(16).padStart(3, '0').toUpperCase()
      : 'prepareTaskScriptOpcode52';
    const module = s ? 'proof/task/script-opcode-bindings.mjs' : 'proof/task/opcode-sequence.mjs',
      prepare = s ? bindings[exportName] : prepareTaskScriptOpcode52;
    await put(native, {
      rom_sha256: taskRomHash,
      progress_reference: 'docs/PORTIERUNGSSTAND.json',
      native_binding: true,
      manual_only: true,
      full_task_binding: false,
      global_stack_minimum: null,
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
      probes: probes(prepare, () => taskScriptOpcodeFixture(s ?? undefined)),
      scope:
        'Manual original argument/heap/frame/child/outer-yield equations. No script body or later resume executed. All fixtures synthetic.',
    });
  }
  const sourcePath = continuation.source,
    proofs = await proveScriptContinuation(bytes);
  const source = JSON.parse(await readFile(sourcePath));
  if (JSON.stringify(source.proofs) !== JSON.stringify(proofs))
    throw Error('Continuation source drift');
  const yieldFixture = () => {
    const f = taskScriptOpcodeFixture(),
      p = prepareTaskScriptArguments({
        ...f,
        entry: 0x80f460,
        context: Object.freeze({ ...f.context, pc: 0xf460 }),
      });
    if (!p.handled || !commitTaskPlan(f.data, p).handled)
      throw Error('Yield fixture prefix failed');
    return { ...f, entry: 0x80f488, context: p.outputContext };
  };
  await put(continuation.native, {
    rom_sha256: taskRomHash,
    progress_reference: 'docs/PORTIERUNGSSTAND.json',
    native_binding: true,
    manual_only: true,
    full_task_binding: false,
    global_stack_minimum: null,
    bindings: proofs.map((p, i) => ({
      entry: p.entry,
      module: 'proof/task/script-continuation.mjs',
      export: i ? 'prepareTaskScriptResume' : 'prepareTaskScriptYield',
      source_contract: sourcePath,
      source_proof_field: 'proofs',
      source_proof: p,
    })),
    probes: [
      ...probes(prepareTaskScriptYield, yieldFixture),
      ...probes(prepareTaskScriptResume, taskScriptResumeFixture),
    ],
    scope:
      'Separate actual yielding F488 and externally entered F495. No readiness, chronology or implicit head-to-resume join.',
  });
  console.log(
    `Script52: ${blocks.length + 1} source-linked native blocks with exact budgets and atomic failures.`,
  );
}
