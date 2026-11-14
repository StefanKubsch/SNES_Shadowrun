import { readFile, writeFile } from 'node:fs/promises';
import { prepareRender905E } from '../proof/render/fields-905e.mjs';
import { fields905EEntry, fields905EFixture, fields905EWindows } from './render-905e-fixtures.mjs';
const source = JSON.parse(await readFile('analysis/render-905e.json', 'utf8'));
const fixtures = [
  {}, { selector: 0, value: 0x7FFF }, { initial: 0xFFFF, waitRead0140: [0,0x7FFF,0xFFFF], value: 0xFF },
  { bank: 0x7E, ioMode: null }, { bank: 0x7F, ioMode: null },
  { maxWork: 16, maxOutputBytes: 12, y: null },
  { waitRead0140: [0,0x7FFF] }, { waitRead0140: null, maxWork: 20 },
  { stackWindow: [0x1FFC,0x1FFF] }, { selector: null }, { value: null },
  { maxWork: 15 }, { maxOutputBytes: 11 },
  { writeWindows: fields905EWindows().filter(([a]) => a !== 0x7E1562).concat([[0x7E1562,0x7E1562]]) },
];
const probes = fixtures.map(fixture => {
  const data = fields905EFixture(fixture), before = JSON.stringify(data.snapshot());
  const p = prepareRender905E({ ...fields905EEntry, data, ...fixture });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  return { fixture, ...p };
});
await writeFile('analysis/render-905e-native.json', JSON.stringify({ romSha256: source.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json',
  source: source.windows[0], helperSources: source.windows.slice(1), stackProof: source.full_graph.proof,
  scope: 'Manual atomic905E under5 protected stackbytes with explicitly synthetic known selector/gate bytes, writable windows and chronological0140 observations. ActualDBR0142/X0800, actual8FF5, three fixedlong7E WORD fields and actualA954 increment. FinalA0028/X0800/C0, INC-derived N/Z, preservedY/DBR/V/I; shared global waitPolls0140, cumulative work/native-WRAM-output budgets and one outer commit. No CPU/device/clock/interrupt/scene/frame execution,420B trigger or transferbuffer read. Original936C/BF3B ownership and wait/NMI/RTI chronology remain open; current work: docs/PORTIERUNGSSTAND.json.',
  declaredInputs: fields905EEntry, probes }, null, 2) + '\n');
console.log('905E: fourteen synthetic atomic setup/wait/selector/field/increment/DBR and late-boundary probes.');
