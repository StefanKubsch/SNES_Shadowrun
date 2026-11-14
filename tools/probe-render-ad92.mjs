import { readFile, writeFile } from 'node:fs/promises';
import { prepareRenderAD92 } from '../proof/render/compose-ad92.mjs';
import { ad92Entry, ad92Windows, ad92Fixture } from './render-ad92-fixtures.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const source = JSON.parse(await readFile('analysis/render-ad92.json', 'utf8'));
const sources = [...source.windows.slice(0, 4), ...source.dependencies[0].windows];
const rom = await readFile('Shadowrun (E).smc'), map = new Map();
for (const w of sources) {
  const state = { e: 0, m: 0, x: 0 }, end = parseInt(w.end_exclusive.replace(':', ''), 16);
  for (let pc = parseInt(w.entry.replace(':', ''), 16); pc < end;) {
    const i = decode(rom, pc, state); map.set(pc, i); pc = i.next;
    if (['REP', 'SEP'].includes(i.mnemonic) && i.value & 32) state.m = Number(i.mnemonic === 'SEP');
    if (['REP', 'SEP'].includes(i.mnemonic) && i.value & 16) state.x = Number(i.mnemonic === 'SEP');
  }
}
const fixtures = [
  [{}, {}], [{ last: 4, first: 1, flags: [1, 0, 1] }, {}],
  [{ last: 0xFFFF, counter: 0xFFFF }, { waitMode: null, waitRead01F8: null }],
  [{ active: true }, { divisionMode: 'stable-native' }],
  [{}, { waitRead01F8: [0x100] }], [{ last: 2, flags: [1, 1] }, { maxOutputBytes: 3759 }],
];
const probes = [];
for (const [fixture, extra] of fixtures) {
  const data = ad92Fixture(fixture), before = JSON.stringify(data.snapshot());
  const p = prepareRenderAD92({ ...ad92Entry, ...extra, data });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (p.handled && !data.commit(p).handled) throw Error('Commit failed');
  // The report keeps WORD wait provenance and a byte-access count; the full
  // native chronology is verified by behavioral tests, rather than duplicated.
  const { operations, byteWrites, readAddresses, ...result } = p;
  probes.push({ fixture, extra, ...result });
}
await writeFile('analysis/render-ad92-native.json', JSON.stringify({ romSha256: source.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json',
  sources, stackProof: proveWordStack(map, 0x81AD92, 'RTL', { measureStack: true }),
  scope: 'Manual atomic AD92 with original0740 ROM stream and explicit synthetic pointers, gates, entry tables and wait observations. Shared byte provider, work/output budgets and one outer commit. AF1F stable-native division requires explicit opt-in. No original scene, CPU/device/time/interrupt execution or automatic frame binding. Native BE6D/BCBE composition supplied with global arithmetic/wait chronology. NativeF03A BYTE pair prerequisite supplied separately. NativeF122/F1E8 WORD senders supplied separately. NativeF130/F100 supplied separately. NativeC46E all-WORD-sound/nonzero-voice supplied with14/8-byte conditional proofs. Current work is tracked in docs/PORTIERUNGSSTAND.json.',
  declaredInputs: { ...ad92Entry, writeWindows: ad92Windows }, probes }, null, 2) + '\n');
console.log('AD92: six manual composition/list/active-arithmetic/counterwrap and late-boundary probes.');
