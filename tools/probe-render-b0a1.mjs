import { readFile, writeFile } from 'node:fs/promises';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRenderB0A1 } from '../proof/render/counter-b0a1.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const source = JSON.parse(await readFile('analysis/render-input-flow.json', 'utf8'));
const rom = await readFile('Shadowrun (E).smc'), map = new Map();
for (let pc = 0x81B0A1; pc < 0x81B0AC;) {
  const i = decode(rom, pc, { e: 0, m: 0, x: 0 }); map.set(pc, i); pc = i.next;
}
const declaredInputs = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1FFD, 0x1FFF], waitMode: 'record-observations' };
const fixtures = [
  { baseline: 0xFF, polls: [0xFF, 0xFF, 0x100, 7] },
  { baseline: 0xFFFF, polls: [0] },
  { baseline: 0, polls: [0xFFFF], bank: 0x7F },
  { baseline: 0x8000, polls: [0] },
  { baseline: 0, polls: [0, 0] },
  { baseline: 0x100, polls: null, maxWork: 5 },
  { baseline: 0, polls: [1], writeWindows: [] },
];
const probes = fixtures.map(fixture => {
  const writeWindows = fixture.writeWindows ?? [[0x7E1C76, 0x7E1C77]];
  const data = createRenderData({ writeWindows });
  data.seed(0x7E1C76, [fixture.baseline & 255, fixture.baseline >>> 8]);
  const before = JSON.stringify(data.snapshot());
  const p = prepareRenderB0A1({ ...declaredInputs, data, ...fixture, waitRead1C76: fixture.polls });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  return { fixture, ...p };
});
await writeFile('analysis/render-b0a1-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows.find(w => w.name === 'waitB0A1'),
  stackProof: proveWordStack(map, 0x81B0A1, 'RTL', { measureStack: true }),
  scope: 'Manual atomic B0A1 with explicitly synthetic baseline and chronological WORD observations. Fixed long7E1C76, original saved A, unsigned CMP flags, preserved X/Y/DBR/V/I, global counterPolls, one provider/budget/commit. No CPU/device/time/interrupt execution, native counter write, callback completion or automatic input/scene/frame binding.',
  declaredInputs, probes }, null, 2) + '\n');
console.log('B0A1: seven synthetic manual equality/change/wrap/DBR/exhaustion/budget/window probes.');
