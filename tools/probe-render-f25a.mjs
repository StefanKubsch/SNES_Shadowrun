import { readFile, writeFile } from 'node:fs/promises';
import { prepareRenderF25A } from '../proof/render/mode-f25a.mjs';
import { selectionEntry, selectionFixture, selectionZeroFixture } from './render-f25a-fixtures.mjs';
const source = JSON.parse(await readFile('analysis/render-ef47.json', 'utf8'));
const fixtures = [
  { a: 0xAB00, zeroFixture: true },
  { a: 0xFF00, status: 0xE5, zeroFixture: true },
  { entries: [0] },
  {},
  { entries: [6, 7, 6, 7, 0], modeLoader: { blocks: [{ kind: 'repeat', count: 2, value: 0xBEEF }] } },
  { status: 0xE5, modeLoader: { address: 0x12FF, blocks: [{ kind: 'raw', values: [0xAA, 0xBB] }] } },
  { ioRead2140: [0, 1, 2, 3] },
  { entries: [6, 7, 6], maxWork: 1000 },
  { modeLoader: { blocks: [{ kind: 'repeat', count: 1, value: 0xBEEF }] }, maxWork: 45 },
];
const probes = fixtures.map(fixture => {
  const data = fixture.zeroFixture ? selectionZeroFixture(fixture) : selectionFixture(fixture);
  const before = JSON.stringify(data.snapshot());
  const p = prepareRenderF25A({ ...selectionEntry, data, ...fixture });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  return { fixture, ...p };
});
await writeFile('analysis/render-f25a-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows.find(w => w.name === 'modeF25A'),
  stackProofs: source.full_graph.helper_proofs.filter(p => p.entry === '81:F25A'),
  scope: 'Manual atomic F25A with WORD/BYTE A and WORD X, using explicitly synthetic mode/header/directory/payload bytes and actual global BYTE2140 observations. Real F007/F1FA/F130, low BYTE PHA/PLA zero gate, saved WORD mode and 80FF-mode selector, fresh shared bytes, cumulative work/output budgets and one outer commit. No audio/device/CPU/clock/interrupt/scene execution. Native EF47 composition supplied under22 protected stackbytes; original callers remain open.',
  declaredInputs: selectionEntry, probes }, null, 2) + '\n');
console.log('F25A: nine synthetic WORD/BYTE zero/list/load/duplicate/late-boundary probes.');
