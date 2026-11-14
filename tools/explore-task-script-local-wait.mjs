import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, cpuToOffset } from './rom.mjs';
import { renderAddress } from '../src/render/data.mjs';
import { localWaitBodySpecs as modalBodySpecs } from '../proof/task/script-body-local-wait-specs.mjs';
import { modalBodySpecs as sharedModalBodySpecs } from '../proof/task/script-body-modal-specs.mjs';
import { localWaitSeedBytes as modalBodySeedBytes } from './task-script-body-local-wait-seeds.mjs';
import { scriptBodyFixture, bodyCases } from './task-script-body-fixtures.mjs';
import { prepareTaskScriptBody } from '../proof/task/script-bodies.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { execFileSync } from 'node:child_process';
import { runWaitBodyFixture } from './task-script-body-wait-fixtures.mjs';
import {
  localWaitC8Streams,
  localWaitC8WaitStreams,
} from './task-script-body-local-wait-observations.mjs';
import { c8BodySpecs } from '../proof/task/script-body-c8-specs.mjs';
import { multiAudioBodySpecs } from '../proof/task/script-body-audio-multi-specs.mjs';
import { selectionBodySpecs } from '../proof/task/script-body-selection-specs.mjs';
if (!process.argv.includes('--worker')) {
  // Provisional shared original data pool, independently rechecked against the
  // ROM below. Final full-path trace retains only each body's actual reads.
  const pool = new Map(
    [
      ...selectionBodySpecs,
      ...sharedModalBodySpecs,
      ...c8BodySpecs,
      ...multiAudioBodySpecs,
      ...modalBodySpecs,
    ]
      .flatMap((s) => s.romReads)
      .map((r) => [r.address, r]),
  );
  for (const s of modalBodySpecs)
    s.romReads = [
      ...new Map([...pool.values(), ...s.romReads].map((r) => [r.address, r])).values(),
    ].sort((a, b) => a.address - b.address);
  await writeFile(
    'proof/task/script-body-local-wait-specs.mjs',
    '// Whole individually admitted original local body sources and reached original ROM WORDs.\nexport const localWaitBodySpecs=' +
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
    if (output.includes('Complete local-wait exploration')) {
      for (const flags of [['--prune'], []]) {
        const verified = execFileSync(
          process.execPath,
          [process.argv[1], '--worker', '0', ...flags],
          { encoding: 'utf8', windowsHide: true },
        );
        process.stdout.write(verified);
        if (!verified.includes('Complete local-wait exploration'))
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
    'proof/task/script-body-local-wait-specs.mjs',
    '// Whole individually admitted original local body sources and reached original ROM WORDs.\nexport const localWaitBodySpecs=' +
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
    run = runWaitBodyFixture(s, v, { reportBoundary: true }),
    f = run.fixture,
    p = run.boundary ?? run.plan;
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
        'tools/task-script-body-local-wait-seeds.mjs',
        '// Explicit independent synthetic field/record bytes, never original initialization.\nexport const localWaitSeedBytes=' +
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
    if (p.reason === 'task_io_observation_required' && s.id === 0x2d0) {
      const independent = new Map([
          [0x81addd, [0x804216, 2, 0]],
          [0x81ae39, [0x804216, 2, 0]],
          [0x81ae73, [0x804214, 1, 0]],
          [0x81ae7d, [0x804214, 1, 1]],
          [0x81ae94, [0x804216, 2, 0]],
        ]),
        sample = independent.get(p.pc);
      const previous = run.segments.at(-1),
        following = f.localWaitPCs.slice(previous?.bodyPCs.length ?? 0),
        callPC = following.find((pc) => {
          const i = s.instructions.find((i) => i.pc === pc);
          return i.opcode === 0x58 && i.operand === 0xc8;
        });
      if (!sample || sample[0] !== p.address || sample[1] !== p.width || callPC === undefined)
        throw Error('Unproved independent device sample ' + JSON.stringify(p));
      const key = s.id + ':' + v.name + ':' + callPC,
        records = (localWaitC8Streams[key] ??= [...f.localC8Observations.ioObservations]);
      if (p.observationIndex !== records.length)
        throw Error('Existing device ledger mismatch ' + JSON.stringify(p));
      records.push({ pc: p.pc, address: p.address, width: p.width, value: sample[2] });
      await writeFile(
        'tools/task-script-body-local-wait-observations.mjs',
        '// Reached original PC/address/width shape; independently chosen synthetic samples. No hardware calculation or runtime fallback.\nexport const localWaitC8Streams=' +
          JSON.stringify(localWaitC8Streams, null, 2) +
          ';\nexport const localWaitC8WaitStreams=' +
          JSON.stringify(localWaitC8WaitStreams, null, 2) +
          ';\n',
      );
      console.log(
        'Declared synthetic arithmetic sample',
        key,
        p.pc.toString(16),
        p.width,
        sample[2],
      );
      console.log('Resume case', caseIndex);
      process.exit(0);
    }
    if (p.reason === 'task_wait_observation_required' && s.id === 0x2d0) {
      const allowed = new Map([
        [0x81acc3, [0x7e01fa, 0x8001fa]],
        [0x81acc9, [0x7e01fc, 0x8001fc, ...Array.from({ length: 8 }, (_, n) => 0x7e2ae0 + 2 * n)]],
        [0x81acaf, [0x8001f8]],
        [0x81acbd, [0x8001f6]],
      ]);
      const previous = run.segments.at(-1),
        following = f.localWaitPCs.slice(previous?.bodyPCs.length ?? 0),
        callPC = following.find((pc) => {
          const i = s.instructions.find((i) => i.pc === pc);
          return i.opcode === 0x58 && i.operand === 0xc8;
        });
      if (!allowed.get(p.pc)?.includes(p.address) || p.width !== 2 || callPC === undefined)
        throw Error('Unproved independently declared wait ' + JSON.stringify(p));
      const key = s.id + ':' + v.name + ':' + callPC,
        records = (localWaitC8WaitStreams[key] ??= []);
      // Text wait adapters report their local poll index after slicing the global ledger.
      // Append the next independent zero sample; never use that index as global.
      // After $01FC: the eight mask words read from VRAM by the NMI,
      // synthetically $AAAA like the prefilled buffer.
      if (records.length >= 256) throw Error('Unproved wait-shape bound ' + JSON.stringify(p));
      records.push({
        pc: p.pc,
        address: p.address,
        width: 2,
        value: (p.address & 0xffff) >= 0x2ae0 ? 0xaaaa : 0,
      });
      await writeFile(
        'tools/task-script-body-local-wait-observations.mjs',
        '// Reached original PC/address/width shape; independent synthetic arithmetic and wait samples, no device/time inference or runtime fallback.\nexport const localWaitC8Streams=' +
          JSON.stringify(localWaitC8Streams, null, 2) +
          ';\nexport const localWaitC8WaitStreams=' +
          JSON.stringify(localWaitC8WaitStreams, null, 2) +
          ';\n',
      );
      console.log(
        'Declared synthetic wait sample',
        key,
        p.pc.toString(16),
        p.address.toString(16),
        0,
      );
      console.log('Resume case', caseIndex);
      process.exit(0);
    }
    throw Error(
      `Body${s.id.toString(16)}/${v.name}/segment${run.segments.length}/afterPC${run.segments.at(-1)?.bodyPCs.at(-1)}: ${JSON.stringify(p)}`,
    );
  }
  if (!p.bodyComplete) throw Error('Incomplete body');
  for (const segment of run.segments)
    for (const a of segment.accesses)
      if (a.kind === 'read') {
        reachedFields.get(s.id).add(renderAddress(a.address));
        if (
          !a.label.startsWith('original-body-ROM-table') &&
          (a.label.endsWith('-low') ||
            [
              'text-root-BYTE',
              'd2-indirect-BYTE',
              'script-header-BYTE',
              'script-header-indexed-BYTE',
            ].includes(a.label))
        )
          reached.get(s.id).add(a.address);
      }
  paths++;
  console.log(
    'Whole',
    s.id.toString(16),
    v.name,
    p.handlersExecuted,
    p.resultWord,
    'segments',
    run.segments.length,
  );
}
if (process.argv.includes('--prune')) {
  for (const s of modalBodySpecs) {
    s.romReads = s.romReads.filter((r) => reached.get(s.id).has(r.address));
    modalBodySeedBytes[s.id] = (modalBodySeedBytes[s.id] ?? []).filter(([a]) =>
      reachedFields.get(s.id).has(a),
    );
  }
  await writeFile(
    'tools/task-script-body-local-wait-seeds.mjs',
    '// Explicit independent synthetic field/record bytes, never original initialization.\nexport const localWaitSeedBytes=' +
      JSON.stringify(modalBodySeedBytes, null, 2) +
      ';\n',
  );
}
await save();
console.log(
  'Complete local-wait exploration',
  paths,
  modalBodySpecs.map((s) => [s.id, s.romReads.length]),
);
