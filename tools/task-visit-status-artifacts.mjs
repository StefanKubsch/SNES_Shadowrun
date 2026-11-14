import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom } from './rom.mjs';
import { taskRomHash } from './task-partial-source.mjs';
import { proveVisitStatus } from './task-visit-status-source.mjs';
import { statusOpcodeSpecs, taskVisitStatusFixture } from './task-visit-status-fixtures.mjs';
import { prepareTaskVisitStatusOpcodes as prepare } from '../proof/task/visit-opcodes.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
const path = 'analysis/render-task-visit-status-opcodes.json';
const put = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
async function renewed() {
  const { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
  if (metadata.rom_sha256 !== taskRomHash) throw Error('Wrong status Visit ROM');
  return proveVisitStatus(bytes);
}
export async function emitVisitStatusSource() {
  const r = await renewed();
  await put(path, {
    rom_sha256: taskRomHash,
    progress_reference: 'docs/PORTIERUNGSSTAND.json',
    ...r,
    source_graph: { native_binding: false, local_source_complete: true, full_graph_closed: false },
    scope: r.proofs[0].boundary,
  });
  console.log('Separate current-stack F927 Visit source and 29 original slots renewed.');
}
export async function emitVisitStatusNative() {
  const r = await renewed(),
    source = JSON.parse(await readFile(path));
  if (JSON.stringify(source.proofs) !== JSON.stringify(r.proofs))
    throw Error('Status Visit source drift');
  const probes = [];
  for (const s of statusOpcodeSpecs) {
    const base = prepare(taskVisitStatusFixture(s.opcode));
    if (!base.handled) throw Error('Status Visit probe ' + base.reason);
    for (const [limit, patch] of [
      ['exact', { maxWork: base.work, maxOutputBytes: base.outputBytes }],
      ['work-minus-one', { maxWork: base.work - 1 }],
      ['output-minus-one', { maxOutputBytes: base.outputBytes - 1 }],
    ]) {
      const f = taskVisitStatusFixture(s.opcode),
        before = JSON.stringify(f.data.snapshot()),
        p = prepare({ ...f, ...patch });
      if (JSON.stringify(f.data.snapshot()) !== before) throw Error('Status Visit mutated owner');
      if (limit === 'exact' && (!p.handled || !commitTaskPlan(f.data, p).handled))
        throw Error('Status Visit exact budget failed');
      if (limit !== 'exact' && (p.handled || p.accesses || p.byteWrites || p.ioRequests))
        throw Error('Status Visit leaked effects');
      probes.push({ ...p, synthetic: true, opcode: s.opcode, limit });
    }
  }
  await put('analysis/render-task-visit-status-opcodes-native.json', {
    rom_sha256: taskRomHash,
    progress_reference: 'docs/PORTIERUNGSSTAND.json',
    native_binding: true,
    manual_only: true,
    full_task_binding: false,
    global_stack_minimum: null,
    bindings: r.proofs.map((p) => ({
      entry: p.entry,
      module: 'proof/task/visit-opcodes.mjs',
      export: 'prepareTaskVisitStatusOpcodes',
      source_contract: path,
      source_proof_field: 'proofs',
      source_proof: p,
    })),
    probes,
    scope: r.proofs[0].boundary,
  });
  console.log('29 current-stack status Visit slots: exact and atomic budget probes.');
}
