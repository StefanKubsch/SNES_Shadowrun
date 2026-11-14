import { readFile, writeFile } from 'node:fs/promises';
import { prepareRender9F6D } from '../proof/render/unpack-9f6d.mjs';
import { unpack9F6DEntry, unpack9F6DFixture, lengthBits9F6D } from './render-9f6d-fixtures.mjs';
const source = JSON.parse(await readFile('analysis/render-9f6d.json', 'utf8'));
const fixtures = [
  {},
  { header: 3, payload: [0, 0x80, 0xFF], bits: lengthBits9F6D(3) },
  { header: 5, bits: [1, 0, ...lengthBits9F6D(3)] },
  { header: 0, bits: [...Array(16).fill([0, 0]).flat(), 1] },
  { sourceAddress: 0x7EFFFD, a: 0xFFFD, y: 0x7E, bank: 0x7F },
  { header: 4, bits: [1, 0, 1], x: 0xFFFF },
  { header: 4, bits: [1, 0, 1], table: false },
  { header: 4, bits: [1, 0, 1], maxOutputBytes: 3 },
  { header: 2, payload: [0x12, 0x34], bits: lengthBits9F6D(2), x: 0xFFFF,
    writeWindows: [[0x7FFFFF, 0x7FFFFF]] },
];
const probes = fixtures.map(fixture => {
  const data = unpack9F6DFixture(fixture), before = JSON.stringify(data.snapshot());
  const p = prepareRender9F6D({ ...unpack9F6DEntry, data, ...fixture });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  return { fixture, ...p };
});
await writeFile('analysis/render-9f6d-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  sources: source.windows, stackProof: source.full_graph.proof,
  scope: 'Manual atomic9F6D/9E65 under10 protected stackbytes with explicitly synthetic source/output/window inputs. Fresh BYTE/WORD reads, literal0 and offsetwidth0 do-loop, ascending MVN7F overlap/bankwrap, actual final X/Y, original header and complete entryP/DBR, cumulative work/output budgets and one outer commit. No CPU/device/clock/interrupt/scene/frame execution. Original936C/BF3B caller and5250 initialization remain open.',
  declaredInputs: unpack9F6DEntry, probes }, null, 2) + '\n');
console.log('9F6D: nine synthetic literal/repeat/zero/bankcarry/late-boundary probes.');
