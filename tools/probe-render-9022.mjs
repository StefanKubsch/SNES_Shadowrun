import { readFile, writeFile } from 'node:fs/promises';
import { prepareRender9022 } from '../proof/render/fields-9022.mjs';
import { fields9022Entry, fields9022Fixture, fields9022Windows } from './render-9022-fixtures.mjs';
const source = JSON.parse(await readFile('analysis/render-9022.json', 'utf8'));
const fixtures = [
  {}, { initial: 0xFFFF, waitRead0140: [0, 0, 0x7FFF, 0xFFFF] },
  { bank: 0x7E, ioMode: null }, { bank: 0x7F, ioMode: null },
  { waitRead0140: [0x8000], maxWork: 156, maxOutputBytes: 168 },
  { waitRead0140: [0, 0x7FFF] }, { waitRead0140: null, maxWork: 20 },
  { stackWindow: [0x1FFE, 0x1FFF] }, { maxWork: 156 }, { maxOutputBytes: 167 },
  { writeWindows: fields9022Windows().filter(([a]) => a !== 0x7E3D0F) },
];
const probes = fixtures.map(fixture => {
  const data = fields9022Fixture(fixture), before = JSON.stringify(data.snapshot());
  const p = prepareRender9022({ ...fields9022Entry, data, ...fixture });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  return { fixture, ...p };
});
await writeFile('analysis/render-9022-native.json', JSON.stringify({ romSha256: source.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json',
  source: source.windows[0], helperSource: source.windows[1], stackProof: source.full_graph.proof,
  scope: 'Manual atomic9022 under4 protected stackbytes with explicitly synthetic writable metadata/field windows and chronological WORD0140 observations. ActualDBR0142/X0, sole actual8FF5 call,128 fixedlong7E BYTE stores/16 WORD clears and late3D0D overwrite. Exact finalA3200/XFFFE/N0/Z0, preservedY/DBR/C/V/I; shared global waitPolls0140, cumulative work/native-WRAM-output budgets and one outer commit. No CPU/device/clock/interrupt/scene/frame execution,420B trigger or transferbuffer read. Original936C/BF3B ownership and wait/NMI/RTI chronology remain open; 905E-8FF5-A954 source95/36 supplied under5 protected stackbytes; native atomic905E supplied under5 stackbytes; current work: docs/PORTIERUNGSSTAND.json.',
  declaredInputs: fields9022Entry, probes }, null, 2) + '\n');
console.log('9022: eleven synthetic atomic setup/wait/field/tail/DBR/late-boundary probes.');
