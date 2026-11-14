import { readFile, writeFile } from 'node:fs/promises';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRenderF290, prepareRenderF298 } from '../proof/render/input-wrappers.mjs';
const source = JSON.parse(await readFile('analysis/render-input-flow.json', 'utf8'));
const declaredInputs = { bank: 0x80, status: 0xC5, x: 0x34, y: 0x56,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF],
  ioMode: 'record-requests', ioRead4212: [0xFFFF, 0xFFFE], ioRead4218: 0xABCD };
const fixtures = [
  ...[0, 0x10, 0x20, 0x30].map(widths => ({ wrapper: 'F290', status: 0xC5 | widths, current: 0, previous: 0 })),
  ...[0, 0x10, 0x20, 0x30].map(widths => ({ wrapper: 'F298', status: 0xC5 | widths, current: 0x8001, previous: 0 })),
  { wrapper: 'F290', status: 0xF7, current: 0x8000, previous: 0, bank: 0x7F },
  { wrapper: 'F298', status: 0xF7, current: 0, previous: 0x8000, bank: 0x7E },
  { wrapper: 'F298', status: 0x30, current: 0x3030, previous: 0 },
];
const probes = fixtures.map(fixture => {
  const bank = fixture.bank ?? 0x80, base = bank * 65536, owner = bank === 0x7F ? 0x7F0000 : 0x7E0000;
  const data = createRenderData({ writeWindows: [[owner + 0x1CA, owner + 0x1CF]] });
  for (const [offset, value] of [[0x1CA, fixture.current], [0x1CC, fixture.previous]]) data.seed(base + offset, [value & 255, value >>> 8]);
  if (fixture.bank && fixture.wrapper === 'F290') { data.seed(base + 0x4212, [0xFE, 0xFF]); data.seed(base + 0x4218, [fixture.current & 255, fixture.current >>> 8]); }
  const plan = (fixture.wrapper === 'F290' ? prepareRenderF290 : prepareRenderF298)({
    ...declaredInputs, data, bank, status: fixture.status, ioMode: fixture.bank ? null : 'record-requests' });
  if (fixture.current === 0x3030 ? plan.reason !== 'render_reset_source_required' : !plan.handled || !data.commit(plan).handled) throw Error(JSON.stringify(plan));
  return { fixture, ...plan };
});
await writeFile('analysis/render-input-flow-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows.slice(2, 4), declaredInputs,
  scope: 'Eleven explicitly synthetic wrapper width/flag/physicalbyte/resetboundary fixtures. Original16/10 wrapper source separate. Manual atomic input operations only; B0A1 nativewait supplied separately; no NMIcounter/capture pairing, fullmain, clock, CPU or successful reset execution.',
  probes }, null, 2) + '\n');
console.log('Inputwrappers: eleven synthetic nativewidth/status/physicalbyte/resetboundary fixtures.');
