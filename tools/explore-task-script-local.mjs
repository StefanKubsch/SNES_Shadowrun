import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { renderAddress } from '../src/render/data.mjs';
import { localBodySpecs as modalBodySpecs } from '../proof/task/script-body-local-specs.mjs';
import { modalBodySpecs as sharedModalBodySpecs } from '../proof/task/script-body-modal-specs.mjs';
import { localBodySeedBytes as modalBodySeedBytes } from './task-script-body-local-seeds.mjs';
import { scriptBodyFixture, bodyCases } from './task-script-body-fixtures.mjs';
import { prepareTaskScriptBody } from '../proof/task/script-bodies.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { execFileSync } from 'node:child_process';
import { selectionBodySpecs } from '../proof/task/script-body-selection-specs.mjs';
if (!process.argv.includes('--worker')) {
  // Provisional shared original data pool, independently rechecked against the
  // ROM below. Final full-path trace retains only each body's actual reads.
  const pool = new Map(
    [...selectionBodySpecs, ...sharedModalBodySpecs, ...modalBodySpecs]
      .flatMap((s) => s.romReads)
      .map((r) => [r.address, r]),
  );
  for (const s of modalBodySpecs)
    s.romReads = [
      ...new Map([...pool.values(), ...s.romReads].map((r) => [r.address, r])).values(),
    ].sort((a, b) => a.address - b.address);
  await writeFile(
    'proof/task/script-body-local-specs.mjs',
    '// Whole individually admitted original local body sources and reached original ROM WORDs.\nexport const localBodySpecs=' +
      JSON.stringify(modalBodySpecs, null, 2) +
      ';\n',
  );
  let start = 0;
  for (let n = 0; n < 10000; n++) {
    const output = execFileSync(process.execPath, [process.argv[1], '--worker', String(start)], {
      encoding: 'utf8',
      windowsHide: true,
    });
    process.stdout.write(output);
    if (output.includes('Complete local exploration')) {
      for (const flags of [['--prune'], []]) {
        const verified = execFileSync(
          process.execPath,
          [process.argv[1], '--worker', '0', ...flags],
          { encoding: 'utf8', windowsHide: true },
        );
        process.stdout.write(verified);
        if (!verified.includes('Complete local exploration'))
          throw Error('Incomplete final full-path verification');
      }
      process.exit(0);
    }
    const resume = output.match(/Resume case (\d+)/);
    if (!resume) throw Error('Missing source checkpoint');
    start = Number(resume[1]);
  }
  throw Error('Source exploration bound exceeded');
}
const { bytes } = inspectRom(await readFile('Shadowrun (E).smc'));
const save = () =>
  writeFile(
    'proof/task/script-body-local-specs.mjs',
    '// Whole individually admitted original local body sources and reached original ROM WORDs.\nexport const localBodySpecs=' +
      JSON.stringify(modalBodySpecs, null, 2) +
      ';\n',
  );
for (const s of modalBodySpecs)
  for (const r of s.romReads)
    if (bytes.readUInt16LE(cpuToOffset(r.address, bytes.length)) !== r.value)
      throw Error('Provisional original ROM pool drift');
let paths = 0;
const reached = new Map(modalBodySpecs.map((s) => [s.id, new Set()])),
  reachedFields = new Map(modalBodySpecs.map((s) => [s.id, new Set()]));
const cases = modalBodySpecs.flatMap((s) => bodyCases(s).map((v) => ({ s, v }))),
  start = Number(process.argv[3] ?? 0);
for (let caseIndex = start; caseIndex < cases.length; caseIndex++) {
  const { s, v } = cases[caseIndex],
    f = scriptBodyFixture(s, v),
    p = prepareTaskScriptBody(f);
  if (!p.handled) {
    const address = p.address,
      owner = Number.isInteger(address) ? renderAddress(address) : null;
    if (
      ['task_script_body_ROM_read_required', 'render_source_required'].includes(p.reason) &&
      owner >= 0x800000
    ) {
      const off = cpuToOffset(address, bytes.length),
        value = bytes.readUInt16LE(off);
      if (s.romReads.some((r) => r.address === address))
        throw Error('Repeated pinned source ' + JSON.stringify(p));
      for (const candidate of modalBodySpecs)
        if (!candidate.romReads.some((r) => r.address === address)) {
          candidate.romReads.push({ address, value });
          candidate.romReads.sort((a, b) => a.address - b.address);
        }
      await save();
      console.log('OriginalROM WORD', s.id, address.toString(16), value.toString(16));
      console.log('Resume case', caseIndex);
      process.exit(0);
    }
    if (p.reason === 'render_source_required' && owner >= 0x7e0000 && owner <= 0x7fffff) {
      const seeds = (modalBodySeedBytes[s.id] ??= []);
      if (seeds.some(([a]) => a === owner))
        throw Error('Repeated synthetic field ' + JSON.stringify(p));
      const present = new Set(f.data.snapshot().bytes.map(([a]) => a)),
        base = owner & ~255;
      for (let a = base; a < base + 256; a++)
        if (!present.has(a) && !seeds.some(([b]) => b === a)) seeds.push([a, 0]);
      seeds.sort((a, b) => a[0] - b[0]);
      await writeFile(
        'tools/task-script-body-local-seeds.mjs',
        '// Explicit independent synthetic field/record bytes, never original initialization.\nexport const localBodySeedBytes=' +
          JSON.stringify(modalBodySeedBytes, null, 2) +
          ';\n',
      );
      console.log(
        'Declared synthetic field BYTE',
        s.id,
        owner.toString(16),
        '00; no original initialized caller claim',
      );
      console.log('Resume case', caseIndex);
      process.exit(0);
    }
    throw Error(`Body${s.id.toString(16)}/${v.name}: ${JSON.stringify(p)}`);
  }
  if (!p.bodyComplete || !commitTaskPlan(f.data, p).handled) throw Error('Incomplete body/commit');
  for (const a of p.accesses)
    if (a.kind === 'read') {
      reachedFields.get(s.id).add(renderAddress(a.address));
      if (
        !a.label.startsWith('original-body-ROM-table') &&
        (a.label.endsWith('-low') || a.label === 'text-root-BYTE' || a.label === 'd2-indirect-BYTE')
      )
        reached.get(s.id).add(a.address);
    }
  paths++;
  console.log('Whole', s.id.toString(16), v.name, p.handlersExecuted, p.resultWord);
}
if (process.argv.includes('--prune')) {
  for (const s of modalBodySpecs) {
    s.romReads = s.romReads.filter((r) => reached.get(s.id).has(r.address));
    modalBodySeedBytes[s.id] = (modalBodySeedBytes[s.id] ?? []).filter(([a]) =>
      reachedFields.get(s.id).has(a),
    );
  }
  await writeFile(
    'tools/task-script-body-local-seeds.mjs',
    '// Explicit independent synthetic field/record bytes, never original initialization.\nexport const localBodySeedBytes=' +
      JSON.stringify(modalBodySeedBytes, null, 2) +
      ';\n',
  );
}
await save();
console.log(
  'Complete local exploration',
  paths,
  modalBodySpecs.map((s) => [s.id, s.romReads.length]),
);
