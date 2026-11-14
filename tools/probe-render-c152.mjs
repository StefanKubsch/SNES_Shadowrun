import { readFile, writeFile } from 'node:fs/promises';
import { prepareRenderC152 } from '../proof/render/callback-c152.mjs';
import { callbackEntry, callbackFixture } from './render-c152-fixtures.mjs';

const source = JSON.parse(await readFile('analysis/render-c152.json', 'utf8'));
const fixtures = [{ active: false, bank: 0 }, { active: false, bank: 0x80 },
  { active: true, bank: 0x80 }, { active: true, bank: 0xBF },
  { active: true, bank: 0x7E }, { active: true, bank: 0x7F },
  { active: true, bank: 0x80, ioRead4212: [1] }, { active: true, bank: 0x80, missing: [0x8001C4] }];
const probes = fixtures.map(fixture => {
  const data = callbackFixture(fixture), options = { ...callbackEntry, bank: fixture.bank,
    ioRead4212: fixture.ioRead4212 ?? callbackEntry.ioRead4212, ioMode: fixture.bank === 0x7E || fixture.bank === 0x7F ? null : 'record-requests' };
  const before = JSON.stringify(data.snapshot()), plan = prepareRenderC152({ data, ...options });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Preparation mutated data');
  if (plan.handled && !data.commit(plan).handled) throw Error('Commit failed');
  return { fixture, ...plan };
});
await writeFile('analysis/render-c152-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows[0], graphBytes: source.code_bytes, graphInstructions: source.instruction_count,
  scope: 'Eight explicitly synthetic complete-callback gate/source/DBR/IO/stack/write fixtures. Original1027/419 graph separate; manual atomic ordered requests only, no device execution, NMI/RTI, timing or automatic frame binding.',
  declaredInputs: callbackEntry, probes }, null, 2) + '\n');
console.log('C152: eight synthetic inactive/active/physical-bank/late-source probes; one atomic eleven-callee plan.');
