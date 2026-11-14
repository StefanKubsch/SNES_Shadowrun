import { readFile, writeFile } from 'node:fs/promises';
import { prepareRender9215 } from '../proof/render/selection-9215.mjs';
import { choice9215Entry, choice9215Fixture } from './render-9215-fixtures.mjs';
const source = JSON.parse(await readFile('analysis/render-selection.json', 'utf8'));
const fixtures = [{}, { held: 0x40 }, { ids: [255] }, { flags: [1, 2, 0] }, { held: 0x3030 },
  { cursor: 30 }, { ioRead2134: [] }, { waitRead01F8: [0] }, { active: true },
  { active: true, divisionMode: 'stable-native' }];
const probes = fixtures.map(fixture => {
  const data = choice9215Fixture(fixture), before = JSON.stringify(data.snapshot());
  const p = prepareRender9215({ ...choice9215Entry, data, ...fixture });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed'); return { fixture, ...p };
});
await writeFile('analysis/render-9215-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  progress_reference: 'docs/PORTIERUNGSSTAND.json', source: source.windows[1], originalTokens: source.tables[1],
  stackProof: source.choice9215_graph.proof, originalSoundStackProof: source.choice9215_graph.original_sound_proof,
  scope: 'Manual atomic9215 with actualF963/A6C7/FA3E under28 protected stackbytes. Original510 token bytes and release compressed stream separately pinned; explicitly synthetic lists/flags/dictionary/font/buffers/input and independent chronological arithmetic/transfer/counter/APU observations. Fresh WORD scans/aliases, fullX/Y wrap, actual producer and returned DBR, saved selection/fresh DP1A/unconditional release, global budgets/observations/one outer commit. No CPU/device/time/interrupt/scene execution or automatic frame binding; E382 reset and actual termination remain open.',
  declaredInputs: choice9215Entry, probes }, null, 2) + '\n');
console.log(probes.map(p => p.outcome ?? p.reason).join(', '));
