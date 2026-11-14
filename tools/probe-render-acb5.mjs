import { readFile, writeFile } from 'node:fs/promises';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRenderACB5 } from '../proof/render/request-acb5.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const source = JSON.parse(await readFile('analysis/render-ad92.json', 'utf8'));
const rom = await readFile('Shadowrun (E).smc'), map = new Map();
for (let pc = 0x81ACAF; pc < 0x81ACBD;) {
  const i = decode(rom, pc, { e: 0, m: 0, x: 0 }); map.set(pc, i); pc = i.next;
}
const declaredInputs = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF], waitMode: 'record-observations' };
const writeWindows = [[0x7E01F8, 0x7E01F9]];
const fixtures = [
  { counter: 0, polls: [1, 0x0100, 0] },
  { counter: 0xFFFF, polls: null },
  { counter: 0, polls: [1] },
];
const probes = [];
for (const fixture of fixtures) {
  const data = createRenderData({ writeWindows });
  data.seed(0x1F8, [fixture.counter & 255, fixture.counter >>> 8]);
  const before = JSON.stringify(data.snapshot());
  const p = prepareRenderACB5({ data, ...declaredInputs, waitRead01F8: fixture.polls });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  probes.push({ fixture, ...p });
}
await writeFile('analysis/render-acb5-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  sources: source.windows.filter(w => ['requestACB5', 'waitACAF'].includes(w.name)),
  stackProofs: [0x81ACB5, 0x81ACAF].map(pc => proveWordStack(map, pc, 'RTL', { measureStack: true })),
  scope: 'Manual atomic ACB5/ACAF using synthetic counter and chronological external observations. No device/time/interrupt execution or transfer completion claim.',
  declaredInputs: { ...declaredInputs, writeWindows }, probes }, null, 2) + '\n');
console.log('ACB5: synthetic WORD-wait chronology, counter-wrap and exhausted-transcript probes.');
