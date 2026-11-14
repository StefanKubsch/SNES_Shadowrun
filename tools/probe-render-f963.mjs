import { readFile, writeFile } from 'node:fs/promises';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRenderF963 } from '../proof/render/allocate-f963.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const source = JSON.parse(await readFile('analysis/render-be6d.json', 'utf8'));
const ad92 = JSON.parse(await readFile('analysis/render-ad92.json', 'utf8'));
const names = ['allocateF963', 'requestFA67', 'waitACBD', 'entryACCF', 'requestACB5', 'waitACAF'];
const sources = names.map(name => [...source.windows, ...ad92.windows].find(w => w.name === name));
if (sources.some(w => !w)) throw Error('Missing F963 source dependency');
const rom = await readFile('Shadowrun (E).smc'), map = new Map();
for (const w of sources) {
  const state = { e: 0, m: 0, x: 0 }, end = parseInt(w.end_exclusive.replace(':', ''), 16);
  for (let pc = parseInt(w.entry.replace(':', ''), 16); pc < end;) {
    const i = decode(rom, pc, state); map.set(pc, i); pc = i.next;
    if (['REP', 'SEP'].includes(i.mnemonic) && i.value & 32) state.m = Number(i.mnemonic === 'SEP');
  }
}
const declaredInputs = { bank: 0x80, status: 0xC5, a: 0xBEEF, y: 0x1234,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests',
  waitMode: 'record-observations', waitRead01F6: [1, 0], waitRead01F8: [0] };
const writeWindows = [[0x7E0000, 0x7E0009], [0x7E00C3, 0x7E00D3], [0x7E01F6, 0x7E0247],
  [0x7E2000, 0x7E219F], [0x7E23A0, 0x7F23A0]];
const fixtures = [
  { cursor: 0, position: 0x2027, ioRead2134: [2] },
  { cursor: 0, position: 0x23FF, ioRead2134: [2, 7] },
  { cursor: 0x1E },
  { cursor: 0, position: 0x2027, ioRead2134: [2], waitRead01F8: [1] },
];
const probes = [];
for (const fixture of fixtures) {
  const data = createRenderData({ writeWindows });
  const word = (address, value) => data.seed(address, [value & 255, value >>> 8]);
  word(0x204, fixture.cursor);
  if (fixture.cursor !== 0x1E) {
    for (const [address, value] of [[0, 1], [2, 1], [4, 4], [6, 3], [8, 0x800],
      [0x212, fixture.position], [0x228, 0], [0x1F6, 0], [0x1F8, 0]]) word(address, value);
  }
  const before = JSON.stringify(data.snapshot());
  const p = prepareRenderF963({ ...declaredInputs, ...fixture, data });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  probes.push({ fixture, ...p });
}
await writeFile('analysis/render-f963-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: sources[0], dependencies: sources.slice(1),
  stackProof: proveWordStack(map, 0x80F963, 'RTS', { measureStack: true }),
  scope: 'Manual atomic F963 with synthetic source bytes, chronological MMIO2134 and wait observations. One provider/budget/commit. No calculated MMIO result, original scene, CPU/device/time/interrupt execution or frame binding.',
  declaredInputs: { ...declaredInputs, writeWindows }, probes }, null, 2) + '\n');
console.log('F963: synthetic allocation, fresh second-result wrap, capacity-end and late-wait abort probes.');
