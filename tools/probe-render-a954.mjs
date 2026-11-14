import { readFile, writeFile } from 'node:fs/promises';
import { prepareRenderA954 } from '../proof/render/gate-a954.mjs';
import { a954Entry, a954Fixture } from './render-a954-fixtures.mjs';
const source = JSON.parse(await readFile('analysis/render-905e.json', 'utf8'));
const fixtures = [
  {}, { value: 0 }, { value: 0xFF }, { value: 0x7FFF }, { bank: 0x7F, value: 0xFFFE },
  { a: null, x: null, y: null }, { value: null }, { maxWork: 1 }, { maxOutputBytes: 1 },
  { writeWindows: [[0x7E1562, 0x7E1562]] }, { bank: 0x40 },
  { stackWindow: [0x1561, 0x1563] },
];
const probes = fixtures.map(fixture => {
  const data = a954Fixture(fixture), before = JSON.stringify(data.snapshot());
  const p = prepareRenderA954({ ...a954Entry, data, ...fixture });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  return { fixture, ...p };
});
await writeFile('analysis/render-a954-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows.find(w => w.name === 'gateIncrementA954'), stackProof: source.increment_graph.proof,
  scope: 'Manual atomic WORD A954 under3 protected stackbytes with explicitly synthetic known1562 bytes/windows. Fresh actualDBR WORD1562 increment including highbytecarry andFFFF wrap; INC-derived N/Z, preserved A/X/Y/C/V/I/DBR or explicit unknown registers. Two work accesses/two native outputbytes, shared view/budgets and one outer commit. No CPU/device/clock/interrupt/scene/frame execution. Native905E composition supplied under5 protected stackbytes; original936C/BF3B ownership/wait chronology remain open.',
  declaredInputs: a954Entry, probes }, null, 2) + '\n');
console.log('A954: twelve synthetic wrap/flags/DBR/unknown-register and atomic boundary probes.');
