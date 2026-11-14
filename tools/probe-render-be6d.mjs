import { readFile, writeFile } from 'node:fs/promises';
import { prepareRenderBE6D, prepareRenderBCBE } from '../proof/render/held-be6d.mjs';
import { heldEntry, heldWindows, heldFixture } from './render-be6d-fixtures.mjs';

const source = JSON.parse(await readFile('analysis/render-be6d.json', 'utf8'));
const fixtures = [
  ['BE6D', { gate: 0 }, {}], ['BE6D', { input: 0xF00 }, {}],
  ['BCBE', { tracked: true }, {}], ['BE6D', {}, {}],
  ['BCBE', { currentType: 2 }, {}], ['BCBE', { action: true, fallback: true }, {}],
  ['BCBE', {}, { waitRead01FA: [] }],
  ['BCBE', { wrap: true }, { ioRead4216: [0, 0, 1, 0, 0] }],
];
const probes = [];
for (const [helper, fixture, extra] of fixtures) {
  const data = heldFixture(fixture), before = JSON.stringify(data.snapshot());
  const p = (helper === 'BE6D' ? prepareRenderBE6D : prepareRenderBCBE)({ ...heldEntry, ...extra, data });
  if (before !== JSON.stringify(data.snapshot())) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  const { operations, byteOperations, ioRequests, ioWrites, readAddresses, byteWrites, ...result } = p;
  probes.push({ helper, fixture, extra, ...result });
}
await writeFile('analysis/render-be6d-native.json', JSON.stringify({ romSha256: source.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json',
  sources: [...source.windows.slice(0, -1), ...source.dependencies[0].windows],
  stackProofs: source.structural_proofs.slice(0, 2),
  scope: 'Manual atomic BE6D/BCBE with explicit synthetic held/list/geometry/dictionary/font/action bytes and original0740 release stream. One byte provider, global chronological arithmetic/wait observations, cumulative work/output budgets and one outer commit. No original scene, inferred MMIO result, CPU/device/time/interrupt execution or automatic frame binding. NativeF03A BYTE pair prerequisite supplied separately. NativeF122/F1E8 WORD senders supplied separately. NativeF130/F100 supplied separately. NativeC46E all-WORD-sound/nonzero-voice supplied with14/8-byte conditional proofs. Current work is tracked in docs/PORTIERUNGSSTAND.json.',
  declaredInputs: { ...heldEntry, writeWindows: heldWindows }, probes }, null, 2) + '\n');
console.log('BE6D/BCBE: eight manual gate/motion/tracking/text/reset/fallback/wrap and late-boundary probes.');
