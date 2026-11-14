import { readFile, writeFile } from 'node:fs/promises';
import { prepareRenderA617, prepareRenderA5DB, prepareRenderA5F9 } from '../proof/render/list-a617.mjs';
import { listEntry, listFixture } from './render-list-fixtures.mjs';

const source = JSON.parse(await readFile('analysis/render-a6a5.json', 'utf8'));
const fixtures = [
  { helper: 'A617', fixture: {}, context: {} },
  { helper: 'A617', fixture: { numberFlag: 1, numbers: [5] }, context: {} },
  { helper: 'A617', fixture: { tokens: [0, 0x10, 0x10], scroll: 2 }, context: {} },
  { helper: 'A5DB', fixture: { scroll: 1, row: 65535, column: 0 }, context: { y: 0 } },
  { helper: 'A5F9', fixture: {}, context: { y: 2 } },
  { helper: 'A617', fixture: { numberFlag: 1, numbers: [5] }, context: { ioRead4216Byte: [] } },
];
const functions = { A617: prepareRenderA617, A5DB: prepareRenderA5DB, A5F9: prepareRenderA5F9 };
const probes = fixtures.map(fixture => {
  const data = listFixture(fixture.fixture), before = JSON.stringify(data.snapshot());
  const p = functions[fixture.helper]({ ...listEntry, data, ...fixture.context });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  return { fixture: fixture.fixture, context: fixture.context, helper: fixture.helper, ...p };
});
await writeFile('analysis/render-list-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  sources: source.windows.filter(w => ['listA617', 'unmarkA5DB', 'markA5F9'].includes(w.name)),
  stackProofs: source.helper_graph.proofs.filter(p => ['80:A617', '80:A5DB', '80:A5F9'].includes(p.entry)),
  scope: 'Manual atomic A617/A5DB/A5F9 with explicitly synthetic list/pointer/menu/dictionary/font bytes, full WORD do-loop, PHY/PLY, fresh aliases, global mixed-width arithmetic/wait observations and one outer commit. No original scene, CPU/device/time/interrupt or automatic frame execution. Whole A6A5/BF3B remains open at transitive audio/input/reset sources.',
  declaredInputs: listEntry, probes }, null, 2) + '\n');
console.log('List: six synthetic manual list, number, scroll, mark and late-boundary probes.');
