import { readFile, writeFile } from 'node:fs/promises';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRender9E0B } from '../proof/render/input-9e0b.mjs';
const source = JSON.parse(await readFile('analysis/render-9e0b.json', 'utf8'));
const declaredInputs = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests' };
const fixtures = [
  { bank: 0x80, ioRead4212: [0], ioRead4218: 0 },
  { bank: 0, ioRead4212: [1, 0xFFFF, 0xFFFE], ioRead4218: 0x8000 },
  { bank: 0xBF, ioRead4212: [0x8000, 1], ioRead4218: 0x3030 },
  { bank: 0x80, ioRead4212: [1], ioRead4218: 0x1234, reason: 'render_io_read_required' },
  { bank: 0x7E, poll: 0xFFFE, capture: 0xFFFF },
  { bank: 0x7F, poll: 0x8000, capture: 1 },
  { bank: 0x7E, poll: 1, capture: 0x1234, maxWork: 3, reason: 'render_work_budget_required' },
];
const probes = [];
for (const fixture of fixtures) {
  const base = fixture.bank * 65536, physical = fixture.bank === 0x7E || fixture.bank === 0x7F;
  const writeWindows = [[physical ? base + 0x1CA : 0x7E01CA, physical ? base + 0x1CB : 0x7E01CB]];
  const data = createRenderData({ writeWindows });
  if (physical) {
    data.seed(base + 0x4212, [fixture.poll & 255, fixture.poll >>> 8]);
    data.seed(base + 0x4218, [fixture.capture & 255, fixture.capture >>> 8]);
  }
  const p = prepareRender9E0B({ ...declaredInputs, ...fixture, data, ioMode: physical ? null : 'record-requests' });
  if (fixture.reason ? p.handled || p.reason !== fixture.reason : !p.handled || !data.commit(p).handled) throw Error(JSON.stringify(p));
  probes.push({ fixture, writeWindows, ...p });
}
await writeFile('analysis/render-9e0b-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows[0], declaredInputs,
  scope: 'Manual atomic9E0B with explicitly synthetic chronological WORD I/O samples or physical WRAM fixtures. No device execution, clock, real joypad input, wait acknowledgment or automatic frame binding.', probes }, null, 2) + '\n');
console.log('9E0B: seven synthetic immediate/delayed/exhausted/physical/persistent-busy probes; full WORD input and atomic store.');
