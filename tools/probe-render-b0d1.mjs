import { readFile, writeFile } from 'node:fs/promises';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRenderB0D1 } from '../proof/render/fade-b0d1.mjs';

const source = JSON.parse(await readFile('analysis/render-b0d1.json', 'utf8'));
const declaredInputs = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF] };
const fixtures = [
  { gate: 0, bank: 0x80 }, { gate: 0xFFFF, countdown: 0, bank: 0 },
  { gate: 0x8000, countdown: 2, bank: 0x80 },
  { gate: 0xFFFE, countdown: 1, brightness: 0x80, bank: 0x80 },
  { gate: 0xFFFE, countdown: 1, brightness: 0x8F, bank: 0x80 },
  { gate: 0x8000, countdown: 1, brightness: 0, bank: 0xBF },
  { gate: 0x7FFF, countdown: 1, brightness: 0xFF, bank: 0x7E },
  { gate: 0x100, countdown: 1, brightness: 0x80, bank: 0x7F },
  { gate: 1, countdown: 1, brightness: 0xFE, bank: 0x80 },
];
const probes = fixtures.map(fixture => {
  const base = fixture.bank * 65536, owner = fixture.bank === 0x7F ? 0x7F0000 : 0x7E0000;
  const writeWindows = fixture.gate ? [[owner + 0x1BC, owner + 0x1BC], [owner + 0x1C6, owner + 0x1C9]] : [];
  const data = createRenderData({ writeWindows });
  data.seed(base + 0x1C6, [fixture.gate & 255, fixture.gate >>> 8]);
  if (fixture.gate) data.seed(base + 0x1C8, [fixture.countdown & 255, fixture.countdown >>> 8]);
  if (fixture.countdown === 1) data.seed(base + 0x1BC, [fixture.brightness]);
  const plan = prepareRenderB0D1({ data, ...declaredInputs, bank: fixture.bank });
  if (!plan.handled || !data.commit(plan).handled) throw Error(JSON.stringify(plan));
  return { fixture, writeWindows, ...plan };
});
await writeFile('analysis/render-b0d1-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows[0], scope: 'Nine explicitly synthetic gate/countdown/brightness/DBR/stack/write fixtures; original73byte source separate. Manual data plan only; no device execution, time measurement, NMI or automatic frame binding.',
  declaredInputs, probes }, null, 2) + '\n');
console.log('B0D1: nine synthetic zero/countdownwrap/negative/positive/endpoint/highA/physical-bank probes.');
