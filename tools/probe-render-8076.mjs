import { readFile, writeFile } from 'node:fs/promises';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRender8076 } from '../proof/render/palette-update-8076.mjs';

const source = JSON.parse(await readFile('analysis/render-80c4.json', 'utf8'));
const declaredInputs = {
  bank: 0x80,
  status: 0xc5,
  x: 0xbeef,
  y: 0xcafe,
  emulation: 0,
  directPage: 0,
  stackWindow: [0x1f00, 0x1fff],
};
const writeWindows = [
  [0x7e1cc2, 0x7e1cc5],
  [0x7e1cd6, 0x7e1cdd],
];
const sparse = { progress: null, direction: null, index: null, count: null, table: null };
const fixtures = [
  { first: { ...sparse, gate: 0 }, second: { ...sparse, gate: null } },
  {},
  { first: { index: 7 } },
  { first: { direction: 0x8000, index: 1, count: null } },
  { first: { direction: 0x8000, index: 0, count: 0 } },
  { first: { index: 0x7fff, count: 1, table: 0xffff } },
  { first: { ...sparse, gate: 1, progress: 0 }, second: { index: 7 } },
  { first: { ...sparse, gate: 0x7fff, progress: 1 }, second: { ...sparse, gate: 1, progress: 1 } },
];
const probes = [];
for (const fixture of fixtures) {
  const data = createRenderData({ writeWindows });
  for (const [x, slot] of [
    [0, fixture.first ?? {}],
    [2, fixture.second ?? {}],
  ]) {
    const f = { gate: 1, progress: 127, direction: 0, index: 2, count: 8, table: 0x4000, ...slot };
    for (const [key, offset] of [
      ['gate', 0x1cbe],
      ['progress', 0x1cc2],
      ['direction', 0x1cc6],
      ['index', 0x1cd6],
      ['count', 0x1cd2],
      ['table', 0x1cce],
    ])
      if (f[key] !== null)
        data.seed(declaredInputs.bank * 65536 + offset + x, [f[key] & 255, f[key] >>> 8]);
  }
  const p = prepareRender8076({ data, ...declaredInputs });
  if (!p.handled || !data.commit(p).handled) throw Error(JSON.stringify(p));
  probes.push({ fixture, ...p });
}
await writeFile(
  'analysis/render-8076-native.json',
  JSON.stringify(
    {
      romSha256: source.rom_sha256,
      source: source.windows.find((w) => w.name === 'requestAdvance8076'),
      scope:
        'Manual atomic8076 with explicitly synthetic gate/progress/direction/index/count/table/stack/write fixtures. Fresh WORD operations and one commit only; no device execution, DMA, clock, NMI, original WRAM hydration or frame binding.',
      declaredInputs: { ...declaredInputs, writeWindows },
      probes,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  '8076: eight synthetic gate/progress/index/pointer probes; atomic manual producer only.',
);
