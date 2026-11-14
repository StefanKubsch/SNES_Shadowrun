import { readFile, writeFile } from 'node:fs/promises';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRenderFA67 } from '../proof/render/request-fa67.mjs';

const source = JSON.parse(await readFile('analysis/render-be6d.json', 'utf8'));
const declaredInputs = { bank: 0x80, status: 0xC5, y: 0xBEEF, emulation: 0, directPage: 0,
  stackWindow: [0x1F00, 0x1FFF], waitMode: 'record-observations' };
const writeWindows = [[0x7E020A, 0x7E020D], [0x7E01F6, 0x7E01F7]];
const fixtures = [
  { index: 2, position: 0x2000, height: 0x1001, counter: 0, polls: [1, 0x8000, 0] },
  { index: 0xFFFF, position: 0xFFFF, height: 0xFFFF, counter: 0xFFFF, polls: null },
  { index: 0, position: 1, height: 3, counter: 0, polls: [1] },
];
const probes = [];
for (const fixture of fixtures) {
  const data = createRenderData({ writeWindows });
  const word = (address, value) => data.seed(address, [value & 255, value >>> 8]);
  word(0, fixture.index); word(0x7E2060 + fixture.index, fixture.position);
  word(0x7E20A0 + fixture.index, fixture.height); word(0x1F6, fixture.counter);
  const before = JSON.stringify(data.snapshot());
  const p = prepareRenderFA67({ data, ...declaredInputs, waitRead01F6: fixture.polls });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  probes.push({ fixture, ...p });
}
await writeFile('analysis/render-fa67-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  sources: source.windows.filter(w => ['requestFA67', 'waitACBD'].includes(w.name)),
  stackProof: source.structural_proofs.find(p => p.entry === '80:FA67'),
  scope: 'Manual atomic FA67/ACBD with synthetic indices, WORD parameters, counter and chronological external observations. No device/time/interrupt execution or transfer completion claim.',
  declaredInputs: { ...declaredInputs, writeWindows }, probes }, null, 2) + '\n');
console.log('FA67: synthetic chronological wait, counter-wrap and exhausted-transcript probes.');
