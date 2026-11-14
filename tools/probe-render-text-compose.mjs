import { readFile, writeFile } from 'node:fs/promises';
import { prepareRenderFE69, prepareRenderFB39 } from '../proof/render/text-compose.mjs';
import { textEntry, textWindows, textFixture } from './render-text-compose-fixtures.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const source = JSON.parse(await readFile('analysis/render-be6d.json', 'utf8'));
const names = ['textFE69', 'composeFB39', 'cursorADBA', 'remainingAE14', 'noopAE4C',
  'newlineAE4D', 'maskAEC8', 'requestAEF4', 'requestAEFC', 'waitACC3', 'waitACC9', 'bitAF04'];
const sources = names.map(name => source.windows.find(w => w.name === name));
const rom = await readFile('Shadowrun (E).smc'), map = new Map();
for (const w of sources) {
  const state = { e: 0, m: 0, x: 0 }, end = parseInt(w.end_exclusive.replace(':', ''), 16);
  for (let pc = parseInt(w.entry.replace(':', ''), 16); pc < end;) {
    if (pc === 0x80FC5F) state.m = 1;
    const i = decode(rom, pc, state); map.set(pc, i); pc = i.next;
    if (['REP', 'SEP'].includes(i.mnemonic) && i.value & 32) state.m = Number(i.mnemonic === 'SEP');
  }
}
const fixtures = [
  ['FE69', {}, {}], ['FB39', {}, {}], ['FB39', { style: 0xF8, text: [0x7C, 97, 32, 98, 0, 0] }, {}],
  ['FB39', { width: 4, text: [65, 66, 32, 67, 68, 69, 0, 0] },
    { ioRead4214: [0, 1], ioRead4216: [0, 0, 1, 0, 0], waitRead01FA: [5, 0, 7, 8, 0] }],
  ['FE69', {}, { waitRead01FA: [] }], ['FE69', {}, { maxOutputBytes: 20 }],
];
const probes = [];
for (const [helper, fixture, extra] of fixtures) {
  const data = textFixture(fixture), before = JSON.stringify(data.snapshot());
  const plan = (helper === 'FE69' ? prepareRenderFE69 : prepareRenderFB39)({ ...textEntry, ...extra, data });
  if (JSON.stringify(data.snapshot()) !== before) throw Error('Prepare mutated data');
  if (plan.handled && !data.commit(plan).handled) throw Error('Commit failed');
  probes.push({ helper, fixture, extra, ...plan });
}
await writeFile('analysis/render-text-compose-native.json', JSON.stringify({ romSha256: source.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json',
  sources, stackProofs: [0x80FE69, 0x80FB39].map(entry => proveWordStack(map, entry, 'RTS',
    { measureStack: true, widthJoins: new Set([0x80FC36]) })),
  scope: 'Manual atomic native FE69/FB39 dictionary decode, word measurement, line transitions and glyph composition. Explicit synthetic providers and globally ordered arithmetic/wait observations. No original scene, inferred hardware result, CPU/device/time/interrupt execution or automatic frame binding. Native AD92 composition supplied with one provider/budget/commit and22 protectedstackbytes. Native BE6D/BCBE composition supplied with global arithmetic/wait chronology. NativeF03A BYTE pair prerequisite supplied separately. NativeF122/F1E8 WORD senders supplied separately. NativeF130/F100 supplied separately. NativeC46E all-WORD-sound/nonzero-voice supplied with14/8-byte conditional proofs. Current work is tracked in docs/PORTIERUNGSSTAND.json.',
  declaredInputs: { ...textEntry, writeWindows: textWindows }, probes }, null, 2) + '\n');
console.log('Text composition: six synthetic decode/glyph/style/newline and late-boundary probes.');
