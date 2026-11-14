import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom } from './rom.mjs';
import { taskRomHash } from './task-partial-source.mjs';
import { proveTaskVisit } from './task-visit-source.mjs';
import { taskVisitFixture } from './task-visit-fixtures.mjs';
import { prepareTaskVisit } from '../proof/task/visit-c1ca.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
const { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
if (metadata.rom_sha256 !== taskRomHash) throw Error('Wrong visit ROM');
const { proofs } = await proveTaskVisit(bytes),
  sourcePath = 'analysis/render-task-visit.json',
  source = JSON.parse(await readFile(sourcePath));
if (JSON.stringify(proofs) !== JSON.stringify(source.proofs))
  throw Error('Visit native source drift');
const probes = [];
for (const [entry, kind] of [
  [0x80c1ca, 'negative-tail'],
  [0x80c1ca, 'blocked'],
  [0x80c1ca, 'ready'],
  [0x80c1ca, 'resume'],
  [0x80c1f9, 'blocked'],
  [0x80c20b, 'post-kept'],
  [0x80c20b, 'post-remove'],
  [0x80c3c9, 'blocked'],
  [0x80c396, 'blocked'],
]) {
  const base = prepareTaskVisit(taskVisitFixture(entry, kind));
  if (!base.handled) throw Error('Visit probe ' + base.reason);
  for (const [limit, patch] of [
    ['exact', { maxWork: base.work, maxOutputBytes: base.outputBytes }],
    ['work-minus-one', { maxWork: base.work - 1 }],
    ...(base.outputBytes ? [['output-minus-one', { maxOutputBytes: base.outputBytes - 1 }]] : []),
  ]) {
    const f = taskVisitFixture(entry, kind),
      before = JSON.stringify(f.data.snapshot()),
      p = prepareTaskVisit({ ...f, ...patch });
    if (JSON.stringify(f.data.snapshot()) !== before) throw Error('Visit prepare modified owner');
    if (limit === 'exact' && (!p.handled || !commitTaskPlan(f.data, p).handled))
      throw Error('Visit exact budget failed');
    if (limit !== 'exact' && (p.handled || p.accesses || p.byteWrites))
      throw Error('Visit failure leaked effects');
    probes.push({ ...p, synthetic: true, fixture: kind, limit });
  }
}
await writeFile(
  'analysis/render-task-visit-native.json',
  JSON.stringify(
    {
      rom_sha256: taskRomHash,
      progress_reference: 'docs/PORTIERUNGSSTAND.json',
      native_binding: true,
      manual_only: true,
      full_task_binding: false,
      global_stack_minimum: null,
      bindings: proofs.map((p) => ({
        entry: p.entry,
        module: 'proof/task/visit-c1ca.mjs',
        export: 'prepareTaskVisit',
        source_contract: sourcePath,
        source_proof_field: 'proofs',
        source_proof: p,
      })),
      probes,
      scope:
        'Manual bounded original equations; all fixtures synthetic. Full interpreter and postrun occurrence remain explicit boundaries.',
    },
    null,
    2,
  ) + '\n',
);
console.log('Visit: source-linked native entry proofs and exact cumulative budget/atomic probes.');
