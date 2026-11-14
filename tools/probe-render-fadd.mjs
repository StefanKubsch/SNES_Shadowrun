import { readFile, writeFile } from 'node:fs/promises';
import { createRenderData } from '../src/render/data.mjs';
import { prepareRenderFADD } from '../proof/render/text-width-fadd.mjs';

const source = JSON.parse(await readFile('analysis/render-be6d.json', 'utf8'));
const declaredInputs = { bank: 0x80, status: 0x45, emulation: 0, directPage: 0,
  y: 0xABCD, stackWindow: [0x1F00, 0x1FFF] };
const writeWindows = [[0x7E00BA, 0x7E00BB], [0x7E00CF, 0x7E00D3], [0x7E0206, 0x7E0209]];
const fixtures = [
  { first: 0xC142, stream: 0x0040, widths: [[0x41, 7], [0x42, 9]] },
  { first: 0x8A00, stream: 0, widths: [] },
  { first: 0xC141, stream: 0x0020, widths: [[0x41, 255], [0x241, 9]] },
];
const probes = [];
for (const fixture of fixtures) {
  const data = createRenderData({ writeWindows });
  const word = (address, value) => data.seed(address, [value & 255, value >>> 8]);
  word(0, 0x1800); word(0x9D9800, fixture.stream);
  word(0x9D8000, fixture.first); word(0x9D8002, 0x8A00);
  for (const [index, width] of fixture.widths) data.seed(0x81AC0C + index, [width]);
  const p = prepareRenderFADD({ data, ...declaredInputs });
  if (!p.handled || !data.commit(p).handled) throw Error(JSON.stringify(p));
  probes.push({ fixture, ...p });
}
await writeFile('analysis/render-fadd-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  sources: source.windows.filter(w => ['widthFADD', 'widthByteFB2A', 'bitAF04'].includes(w.name)),
  scope: 'Manual atomic AF04/FADD/FB2A using explicitly synthetic text, dictionary, width, stack and write fixtures. No original text hydration, CPU/device/time execution or frame binding.',
  declaredInputs: { ...declaredInputs, writeWindows }, probes }, null, 2) + '\n');
console.log('FADD: three synthetic text-width probes; one manual atomic plan.');
