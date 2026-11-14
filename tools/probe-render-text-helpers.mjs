import { readFile, writeFile } from 'node:fs/promises';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRenderADBA, prepareRenderAE14, prepareRenderAE4D } from '../proof/render/text-geometry.mjs';
import { prepareRenderAEC8 } from '../proof/render/text-mask-aec8.mjs';
import { prepareRenderAEF4, prepareRenderAEFC } from '../proof/render/request-aef4.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const source = JSON.parse(await readFile('analysis/render-be6d.json', 'utf8'));
const names = ['cursorADBA', 'remainingAE14', 'noopAE4C', 'newlineAE4D', 'maskAEC8',
  'requestAEF4', 'requestAEFC', 'waitACC3', 'waitACC9'];
const sources = names.map(name => source.windows.find(w => w.name === name));
if (sources.some(w => !w)) throw Error('Missing text helper source');
const rom = await readFile('Shadowrun (E).smc'), map = new Map();
for (const w of sources) {
  const state = { e: 0, m: 0, x: 0 }, end = parseInt(w.end_exclusive.replace(':', ''), 16);
  for (let pc = parseInt(w.entry.replace(':', ''), 16); pc < end;) {
    const i = decode(rom, pc, state); map.set(pc, i); pc = i.next;
    if (['REP', 'SEP'].includes(i.mnemonic) && i.value & 32) state.m = Number(i.mnemonic === 'SEP');
  }
}
const writeWindows = [[0x7E00AB, 0x7E00C1], [0x7E01FA, 0x7E0211], [0x7E20C0, 0x7E20E3], [0x7E2AE0, 0x7E2AFF]];
const declaredInputs = { bank: 0x7E, status: 0xC5, x: 2, y: 0xBEEF, emulation: 0, directPage: 0,
  stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests', ioRead4214: [0, 3], ioRead4216: [1],
  waitMode: 'record-observations', waitRead01FA: [1, 0], waitRead01FC: [0] };
const fixtures = [
  ['ADBA', prepareRenderADBA, { cursor: 0x20, base: 0x20, offset: 0, origin: 12 }],
  ['AE14', prepareRenderAE14, { cursor: 0x20, base: 0x20, offset: 3, origin: 0 }],
  ['AE4D', prepareRenderAE4D, { cursor: 0x20, base: 0x20, offset: 3, origin: 0 }],
  ['AEC8', prepareRenderAEC8, { ab: 0, b7: 1, mask: 0xFF00 }],
  ['AEF4', prepareRenderAEF4, { counter: 0 }],
  ['AEFC', prepareRenderAEFC, { counter: 0xFFFF, waitRead01FC: null, waitMode: null }],
  ['AE4D', prepareRenderAE4D, { cursor: 0x20, base: 0x20, offset: 3, origin: 0, ioRead4214: [0] }],
];
const probes = [];
for (const [helper, prepare, fixture] of fixtures) {
  const data = createRenderData({ writeWindows });
  const word = (address, value) => data.seed(address, [value & 255, value >>> 8]);
  if (helper.startsWith('AD') || helper === 'AE14' || helper === 'AE4D') {
    for (const [offset, value] of [[0x20C0, fixture.cursor], [0x2060, fixture.base], [0x20E0, fixture.offset],
      [0x2100, fixture.origin], [0x2020, 6], [0x2040, 5], [0x2080, 0x21]]) word(0x7E0002 + offset, value);
  } else if (helper === 'AEC8') {
    word(0xAB, fixture.ab); word(0xB7, fixture.b7); word(0x81AC8F, fixture.mask); data.seed(0x7E2AE0, Array(32).fill(0));
  } else word(helper === 'AEF4' ? 0x7E01FA : 0x7E01FC, fixture.counter);
  const before = JSON.stringify(data.snapshot()), p = prepare({ ...declaredInputs, ...fixture, data });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  probes.push({ helper, fixture, ...p });
}
await writeFile('analysis/render-text-helpers-native.json', JSON.stringify({ romSha256: source.rom_sha256, sources,
  stackProofs: sources.map(w => proveWordStack(map, parseInt(w.entry.replace(':', ''), 16), 'RTL', { measureStack: true })),
  scope: 'Manual native text geometry, mask and request/wait prerequisites with explicit synthetic sources, MMIO arithmetic readings and chronological counter observations. FE69/FB39 binding supplied separately; no calculated hardware result, original scene, CPU/device/time/interrupt execution or frame binding.',
  declaredInputs: { ...declaredInputs, writeWindows }, probes }, null, 2) + '\n');
console.log('Text helpers: seven synthetic geometry/mask/wait and late-result-boundary probes.');
