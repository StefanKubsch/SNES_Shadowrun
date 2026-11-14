import { readFile, writeFile } from 'node:fs/promises';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRender9E1A } from '../proof/render/input-9e1a.mjs';
import { prepareRenderF007 } from '../proof/render/apu-f007.mjs';
const source = JSON.parse(await readFile('analysis/render-9e1a.json', 'utf8'));
const declaredInputs = { bank: 0x80, status: 0xC5, x: 0xBEEF, y: 0x1234,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF] };
const inputFixtures = [
  { current: 0x8000, previous: 0 }, { current: 0x8000, previous: 0x8000 },
  { current: 0, previous: 0x8000 }, { current: 0x8001, previous: 0 },
  { current: 0x3040, previous: 0x3000, bank: 0x7F }, { current: 0x3030, previous: 0 },
];
const inputProbes = inputFixtures.map(fixture => {
  const bank = fixture.bank ?? 0x80, base = bank * 65536, owner = bank === 0x7F ? 0x7F0000 : 0x7E0000;
  const data = createRenderData({ writeWindows: [[owner + 0x1CA, owner + 0x1CF]] });
  for (const [offset, value] of [[0x1CA, fixture.current], [0x1CC, fixture.previous]]) data.seed(base + offset, [value & 255, value >>> 8]);
  const plan = prepareRender9E1A({ ...declaredInputs, data, bank });
  if (fixture.current === 0x3030 ? plan.reason !== 'render_reset_source_required' : !plan.handled || !data.commit(plan).handled) throw Error(JSON.stringify(plan));
  return { fixture, ...plan };
});
const apuFixtures = [
  { token: 0x12, a: 0xAB34, samples: [0, 255, 0x12] },
  { token: 255, a: 0, samples: [255] }, { token: 0x12, a: 0, samples: [0] },
  { token: 255, a: 0xFF00, samples: null, bank: 0x7E },
  { token: 0, a: 0xABFF, samples: null, bank: 0x7F },
];
const apuProbes = apuFixtures.map(fixture => {
  const bank = fixture.bank ?? 0x80, base = bank * 65536, owner = bank === 0x7F ? 0x7F0000 : 0x7E0000, physical = bank === 0x7E || bank === 0x7F;
  const data = createRenderData({ writeWindows: [[owner + 0x1CE4, owner + 0x1CE4], ...(physical ? [[base + 0x2140, base + 0x2143]] : [])] });
  data.seed(base + 0x1CE4, [fixture.token]); if (physical) data.seed(base + 0x2140, [fixture.token]);
  const plan = prepareRenderF007({ ...declaredInputs, data, bank, a: fixture.a,
    ioMode: physical ? null : 'record-requests', ioRead2140: fixture.samples });
  if (fixture.samples?.length === 1 && fixture.samples[0] !== fixture.token
    ? plan.reason !== 'render_io_read_required' : !plan.handled || !data.commit(plan).handled) throw Error(JSON.stringify(plan));
  return { fixture, ...plan };
});
await writeFile('analysis/render-9e1a-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows.slice(0, 2), declaredInputs,
  scope: 'Six input and five APU explicitly synthetic fixtures. Original92/41 source separate; manual atomic inputfilter or orderedAPU requests only. No CPU/device/audio/clock/interrupt/scene execution or successful reset completion.',
  inputProbes, apuProbes }, null, 2) + '\n');
console.log('9E1A/F007: eleven synthetic inputedge/filter/resetboundary and APUchronology/tokenwrap/physicalbyte probes.');
