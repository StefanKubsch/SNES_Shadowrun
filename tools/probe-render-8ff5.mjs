import { readFile, writeFile } from 'node:fs/promises';
import { prepareRender8FF5 } from '../proof/render/setup-8ff5.mjs';
import { setup8FF5Entry, setup8FF5Fixture } from './render-8ff5-fixtures.mjs';
const source = JSON.parse(await readFile('analysis/render-9022.json', 'utf8'));
const fixtures = [
  {}, { x: 0, initial: 0xFFFF, waitRead0140: [0, 0xFFFF] },
  { x: 0x8123, waitRead0140: null, waitMode: null, maxWork: 8, maxOutputBytes: 2 },
  { bank: 0x7E, ioMode: null }, { bank: 0x7F, ioMode: null },
  { bank: 0xC0 }, { x: 0, waitRead0140: [0, 0x7FFF] },
  { x: 0, waitRead0140: null, maxWork: 10 }, { maxOutputBytes: 1 },
  { writeWindows: [[0x7E0140, 0x7E0140]] }, { maxWork: 11 },
];
const probes = fixtures.map(fixture => {
  const data = setup8FF5Fixture(fixture), before = JSON.stringify(data.snapshot());
  const p = prepareRender8FF5({ ...setup8FF5Entry, data, ...fixture });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  return { fixture, ...p };
});
await writeFile('analysis/render-8ff5-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows[1], stackProof: source.helper_graph.proof,
  scope: 'Manual atomic8FF5 under2 protected stackbytes with explicitly synthetic writable metadata and chronological WORD0140 observations. ActualDBR six ordered WORD/BYTE setupstores, fullX publication before fresh signed polling, preservedX/Y/DBR/C/V/I, global waitPolls0140, cumulative work/native-WRAM-output budgets and one outer commit. No CPU/device/clock/interrupt/scene/frame execution,420B trigger or transferbuffer read. Original936C/BF3B ownership and wait/NMI/RTI chronology remain open; next atomic9022 composition under4 protected stackbytes.',
  declaredInputs: setup8FF5Entry, probes }, null, 2) + '\n');
console.log('8FF5: eleven synthetic setup/publication/signed-wait/DBR/budget/window probes.');
