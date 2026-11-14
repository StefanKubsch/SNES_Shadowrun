import { readFile, writeFile } from 'node:fs/promises';
import { prepareRenderC46E } from '../proof/render/audio-c46e.mjs';
import { audioEntry, audioFixture, highAudioEntry, highAudioFixture } from './render-c46e-fixtures.mjs';
const source = JSON.parse(await readFile('analysis/render-audio.json', 'utf8'));
const fixtures = [
  {},
  { cachedSound: 45, cachedVoice: 3, token: 255, ioRead2140: [0, 255, 0] },
  { selector: 0xFFFF, sound: 0x7FFF, voice: 0xFFFF, index: 2, position: 0x7FFF, scroll: 0x8000,
    ioRead4217: [0x80, 0], ioRead2140: [99, 0, 1, 2] },
  { voice: 0 },
  { sound: 0x8000, writeWindows: [[0x7E0098,0x7E0098],[0x7E1CE0,0x7E1CE4]] },
  { ioRead2140: [0, 1] },
  { load: true, sound: 0x8007 },
  { sound: 0xFFFF, cachedSound: 0xFFFF, stackWindow: [0x1FF8,0x1FFF] },
  { load: true, sound: 0x8007, blocks: [{kind:'repeat',count:2,value:0xBEEF}] },
];
const probes = fixtures.map(fixture => {
  const data = fixture.load ? highAudioFixture(fixture) : audioFixture(fixture), before = JSON.stringify(data.snapshot());
  const p = prepareRenderC46E({ ...(fixture.load ? highAudioEntry : audioEntry), data, ...fixture });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  return { fixture, ...p };
});
await writeFile('analysis/render-c46e-native.json', JSON.stringify({ romSha256: source.rom_sha256,
  source: source.windows.find(w => w.name === 'audioC46E'), stackProof: source.graph.nonzero_voice_c46e_proof,
  lowStackProof: source.graph.bounded_c46e_proof, cacheHitProof: source.graph.cache_hit_c46e_proof,
  scope: 'Manual atomic all-WORD-sound/nonzero-voice C46E with explicitly synthetic table/cache/voice/directory/payload inputs and actual BYTE4217/BYTE2140 observations. Forced DBR80, saved sound, original high-miss F130 and actual callee A/X/Y/status, fresh DP04/06/caches, global polls, one provider/budget/commit. Low/cache-hit8-byte and transitive14-byte stack proofs remain separate; unbalanced zero voice remains a boundary; no audio/device/CPU/time/interrupt/scene execution.',
  declaredInputs: audioEntry, probes }, null, 2) + '\n');
console.log('C46E: nine synthetic manual low/high/cache/raw/repeat/wrap/zero-voice/source/exhaustion probes.');
