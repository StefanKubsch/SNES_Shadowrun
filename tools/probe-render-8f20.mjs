import { readFile, writeFile } from 'node:fs/promises';
import { prepareRender8F20 } from '../proof/render/rows-8f20.mjs';
import { rows8F20Entry, rows8F20Fixture, rows8F20Windows } from './render-8f20-fixtures.mjs';
const source = JSON.parse(await readFile('analysis/render-8f20.json', 'utf8'));
const fixtures = [
  {}, { bank: 0 }, { bank: 0x7F }, { bank: 0xFF, status: 0 },
  { maxWork: 3584, maxOutputBytes: 1792, stackWindow: [0xFFFF, 0xFFFF] },
  { maxWork: 3584, maxOutputBytes: 1792, stackWindow: [0xFFFD, 0xFFFF] },
  { missingSource: 0x7F5350 }, { maxWork: 3583 }, { maxOutputBytes: 1791 },
  { writeWindows: rows8F20Windows.map(([a, b], n) => [a + Number(n === 0), b]) },
];
const probes = fixtures.map(fixture => {
  const data = rows8F20Fixture(fixture), before = JSON.stringify(data.snapshot());
  const p = prepareRender8F20({ ...rows8F20Entry, data, ...fixture });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  return { fixture, ...p };
});
await writeFile('analysis/render-8f20-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows[0], stackProof: source.full_graph.proof,
  scope: 'Manual atomic8F20 under3 protected stackbytes, explicitly synthetic7F source/window inputs. Seven fixed descending MVP passes/1792 fresh read/write pairs, scattered destinations/gaps, actual entryDBR/final PLB flags, cumulative work/output budgets and one outer commit. No CPU/device/clock/interrupt/scene/frame execution. Original9F6D/936C/BF3B initialization and caller binding remain open.',
  declaredInputs: rows8F20Entry, probes }, null, 2) + '\n');
console.log('8F20: ten synthetic row-copy/DBR/exact-limit/late-boundary probes.');
