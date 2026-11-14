import { readFile, writeFile } from 'node:fs/promises';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRenderACCF } from '../proof/render/entry-accf.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const source = JSON.parse(await readFile('analysis/render-ad92.json', 'utf8'));
const rom = await readFile('Shadowrun (E).smc'), map = new Map();
for (let pc = 0x81ACCF; pc < 0x81AD92;) {
  const i = decode(rom, pc, { e: 0, m: 0, x: 0 }); map.set(pc, i); pc = i.next;
}
const declaredInputs = { bank: 0x80, status: 0xC5, x: 2, emulation: 0, directPage: 0,
  stackWindow: [0x1F00, 0x1FFF] };
const writeWindows = [[0x7E00C3, 0x7E00D3], [0x7E23A0, 0x7F23A0]];
const fixtures = [
  { origin: 0x40, width: 4, height: 3, tile: 0xF, attributes: 0x10, base: 0, limit: 0xFFFF },
  { origin: 0xDC60, width: 3, height: 3, tile: 0x10, attributes: 0, base: 0x10, limit: 1 },
  { origin: 0, width: 2, height: 3, tile: 0, attributes: 0, base: 0, limit: 0xFFFF, maxWork: 30 },
];
const probes = [];
for (const fixture of fixtures) {
  const data = createRenderData({ writeWindows });
  for (const [offset, key] of [[0x2000, 'origin'], [0x2020, 'width'], [0x2040, 'height'],
    [0x2060, 'base'], [0x2080, 'tile'], [0x20A0, 'limit'], [0x2180, 'attributes']]) {
    const value = fixture[key]; data.seed(0x7E0000 + offset + declaredInputs.x, [value & 255, value >>> 8]);
  }
  const before = JSON.stringify(data.snapshot());
  const p = prepareRenderACCF({ data, ...declaredInputs, maxWork: fixture.maxWork ?? 1000000 });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  probes.push({ fixture, ...p });
}
await writeFile('analysis/render-accf-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows.find(w => w.name === 'entryACCF'),
  stackProof: proveWordStack(map, 0x81ACCF, 'RTL', { measureStack: true }),
  addressingSource: 'WDC W65C816S datasheet sections3.5/7.3: contiguous24bit data WORDs and absolute-index bankcarry; Y/C3 counters remain wrapping WORDs.',
  scope: 'Manual atomic ACCF with synthetic parameter, output, stack and write-window fixtures. No original scene, CPU/device/time/interrupt execution or frame binding.',
  declaredInputs: { ...declaredInputs, writeWindows }, probes }, null, 2) + '\n');
console.log('ACCF: synthetic tile progression, bank-carry and unconditional-zero-loop boundary probes.');
