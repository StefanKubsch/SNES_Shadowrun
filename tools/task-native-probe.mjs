import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuToOffset, cpuLabel } from './rom.mjs';
import { decodeTaskWindows, taskRomHash } from './task-partial-source.mjs';
import { taskFixture } from './task-native-fixtures.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
export async function emitTaskNativeProbe({
  name,
  module,
  prepare,
  exportName,
  sourceName,
  proofField,
  entries,
  proveSource,
  decodeModes = [],
  decodeSource = null,
  fixture: makeFixture = taskFixture,
}) {
  const sourcePath = `analysis/render-task-${sourceName}.json`,
    source = JSON.parse(await readFile(sourcePath)),
    { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
  if (metadata.rom_sha256 !== taskRomHash || source.rom_sha256 !== taskRomHash)
    throw Error('Native source ROM drift');
  const windows = source.windows.map((w) => {
    const start = parseInt(w.entry.replace(':', ''), 16),
      off = cpuToOffset(start, bytes.length),
      raw = bytes.subarray(off, off + w.covered_bytes);
    if (
      raw.toString('hex').toUpperCase() !== w.machine_bytes ||
      createHash('sha256').update(raw).digest('hex') !== w.sha256
    )
      throw Error('Native source window drift');
    return { start, hex: w.machine_bytes };
  });
  const { map } = decodeSource
      ? decodeSource(bytes)
      : decodeTaskWindows(
          bytes,
          windows.map((w) => ({ ...w, ...decodeModes.find((m) => m.entry === w.start) })),
        ),
    proofs = source[proofField];
  if (!Array.isArray(proofs)) throw Error('Native source proof field');
  const bindings = entries.map((entry) => {
    const proof = proveSource(map, entry),
      saved = proofs.find((p) => p.entry === cpuLabel(entry));
    if (JSON.stringify(proof) !== JSON.stringify(saved)) throw Error('Native source proof drift');
    return {
      entry: cpuLabel(entry),
      module,
      export: exportName,
      source_contract: sourcePath,
      source_proof_field: proofField,
      source_proof: saved,
    };
  });
  const probes = [];
  for (const entry of entries)
    for (const patch of [{}, { maxWork: 0 }, { maxOutputBytes: 0 }]) {
      const fixture = makeFixture(entry),
        before = fixture.data.snapshot(),
        p = prepare({ ...fixture, ...patch });
      if (JSON.stringify(fixture.data.snapshot()) !== JSON.stringify(before))
        throw Error('Prepare mutated task owner');
      if (p.handled && !commitTaskPlan(fixture.data, p).handled)
        throw Error('Native task commit failed');
      probes.push({ ...p, entry: cpuLabel(entry), synthetic: true, limits: patch });
    }
  if (entries.some((entry) => !probes.some((p) => p.entry === cpuLabel(entry) && p.handled)))
    throw Error('No successful native fixture for entry');
  const report = {
    rom_sha256: taskRomHash,
    progress_reference: 'docs/PORTIERUNGSSTAND.json',
    native_binding: true,
    manual_only: true,
    full_task_binding: false,
    global_stack_minimum: null,
    scope:
      'Manual source-specific atomic byte plans with explicit frozen entry observations and actual physical providers; stop before dynamic indexed dispatch or return target execution. Synthetic fixtures only, no CPU/device/scene/frame execution or original Task initialization/wholeC1CA/9178/BF3B binding.',
    bindings,
    probes,
  };
  await writeFile(
    `analysis/render-task-${name}-native.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    `${name}: ${entries.length} manual native entries, ${probes.length} synthetic probes; full Task binding OPEN.`,
  );
  return report;
}
