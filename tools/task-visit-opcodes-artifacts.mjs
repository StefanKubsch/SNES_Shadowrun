import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom } from './rom.mjs';
import { taskRomHash } from './task-partial-source.mjs';
import { proveVisitOpcodes, proveVisitTailBytes } from './task-visit-opcodes-source.mjs';
import { taskVisitOpcodesFixture, taskVisitTailFixture } from './task-visit-opcodes-fixtures.mjs';
import { prepareTaskVisitOpcodes } from '../proof/task/visit-opcodes.mjs';
import { prepareTaskVisitTail } from '../proof/task/visit-tail.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
const put = (path, v) => writeFile(path, JSON.stringify(v, null, 2) + '\n');
const blocks = [
  {
    name: 'visit-tail',
    prove: proveVisitTailBytes,
    prepare: prepareTaskVisitTail,
    module: 'proof/task/visit-tail.mjs',
    export: 'prepareTaskVisitTail',
    fixtures: [() => taskVisitTailFixture()],
  },
  {
    name: 'visit-opcodes',
    prove: proveVisitOpcodes,
    prepare: prepareTaskVisitOpcodes,
    module: 'proof/task/visit-opcodes.mjs',
    export: 'prepareTaskVisitOpcodes',
    fixtures: ['end', 'push-end', 'native-end', 'yield', 'yield-resume-end'].map(
      (kind) => () => taskVisitOpcodesFixture(kind),
    ),
  },
];
async function rom() {
  const { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
  if (metadata.rom_sha256 !== taskRomHash) throw Error('Wrong visit composition ROM');
  return bytes;
}
export async function emitVisitOpcodeSources() {
  const bytes = await rom();
  for (const b of blocks) {
    const r = await b.prove(bytes);
    await put(`analysis/render-task-${b.name}.json`, {
      rom_sha256: taskRomHash,
      progress_reference: 'docs/PORTIERUNGSSTAND.json',
      ...r,
      source_graph: {
        native_binding: false,
        local_source_complete: true,
        full_graph_closed: false,
      },
      scope: r.proofs[0].boundary,
    });
  }
  console.log(
    'Visit compositions: separately renewed C1D9 tail and actual inner-return opcode joins.',
  );
}
export async function emitVisitOpcodeNatives() {
  const bytes = await rom();
  for (const b of blocks) {
    const r = await b.prove(bytes),
      sourcePath = `analysis/render-task-${b.name}.json`,
      source = JSON.parse(await readFile(sourcePath));
    if (JSON.stringify(r.proofs) !== JSON.stringify(source.proofs))
      throw Error('Visit composition native source drift');
    const probes = [];
    for (const fixture of b.fixtures) {
      const base = b.prepare(fixture());
      if (!base.handled) throw Error('Visit composition probe ' + base.reason);
      for (const [limit, patch] of [
        ['exact', { maxWork: base.work, maxOutputBytes: base.outputBytes }],
        ['work-minus-one', { maxWork: base.work - 1 }],
        ['output-minus-one', { maxOutputBytes: base.outputBytes - 1 }],
      ]) {
        const f = fixture(),
          before = JSON.stringify(f.data.snapshot()),
          p = b.prepare({ ...f, ...patch });
        if (JSON.stringify(f.data.snapshot()) !== before)
          throw Error('Visit composition changed owner');
        if (limit === 'exact' && (!p.handled || !commitTaskPlan(f.data, p).handled))
          throw Error('Visit exact budget failed');
        if (limit !== 'exact' && (p.handled || p.accesses || p.byteWrites || p.ioRequests))
          throw Error('Visit failed plan leaked effects');
        probes.push({ ...p, synthetic: true, limit });
      }
    }
    await put(`analysis/render-task-${b.name}-native.json`, {
      rom_sha256: taskRomHash,
      progress_reference: 'docs/PORTIERUNGSSTAND.json',
      native_binding: true,
      manual_only: true,
      full_task_binding: false,
      global_stack_minimum: null,
      bindings: r.proofs.map((p) => ({
        entry: p.entry,
        module: b.module,
        export: b.export,
        source_contract: sourcePath,
        source_proof_field: 'proofs',
        source_proof: p,
      })),
      probes,
      scope:
        'Actual inner-return ownership, fixed manual joins, explicit finite count and one owner commit. All fixtures synthetic. No whole interpreter/task, timing, scene or frame proof.',
    });
  }
  console.log(
    'Visit compositions: source-linked native bindings, exact cumulative budgets and atomic probes.',
  );
}
