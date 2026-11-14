import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';
import { proveAudioStack } from './render-audio-stack-proof.mjs';
import { describeRenderMenuWindow } from './render-menu-source.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const word = { e: 0, m: 0, x: 0 }, byte = { e: 0, m: 1, x: 0 };
const specs = [
  ['audioC46E', 0x80C46E, 0x80C4B3], ['panC416', 0x80C416, 0x80C461],
  ['samplesF130', 0x81F130, 0x81F1E8], ['repeatWordF1E8', 0x81F1E8, 0x81F1FA],
  ['subtractLengthF100', 0x81F100, 0x81F10A], ['sendWordF122', 0x81F122, 0x81F130],
  ['sendPairF03A', 0x81F03A, 0x81F067, byte], ['apuF007', 0x81F007, 0x81F024],
  ['directoryLoaderF092', 0x81F092, 0x81F100], ['directoryRepeatF10A', 0x81F10A, 0x81F122],
  ['byteCommandF024', 0x81F024, 0x81F03A, byte], ['byteReplyF067', 0x81F067, 0x81F07F, byte],
  ['selectedMenuA805', 0x80A805, 0x80A81C], ['cacheResetEF26', 0x81EF26, 0x81EF36],
  ['selectedInitEF63', 0x81EF63, 0x81EF94], ['selectedResetCF5E', 0x81CF5E, 0x81CF69],
];
const blocks = specs.map(([name, entry, end, initialState = word]) => {
  let state = { ...initialState }; const instructions = [], statuses = [];
  for (let pc = entry; pc < end;) {
    const i = decode(bytes, pc, state); if (i.next > end) throw Error('Audio window overrun ' + cpuLabel(pc));
    instructions.push(i); pc = i.next;
    if (i.mnemonic === 'PHP') statuses.push({ ...state });
    if (i.mnemonic === 'PLP') { state = statuses.pop(); if (!state) throw Error('Unpaired audio PLP'); }
    if (['REP', 'SEP'].includes(i.mnemonic)) {
      if (i.value & 32) state.m = Number(i.mnemonic === 'SEP');
      if (i.value & 16) state.x = Number(i.mnemonic === 'SEP');
    }
  }
  if (statuses.length) throw Error('Unbalanced local audio status');
  return { name, entry, initialState, instructions, stop: name.startsWith('selected')
    ? 'Selected caller/initialization excerpt only; external initialization callees not closed.'
    : 'Complete local body; static mode/stack proof separate, no CPU/device/time execution.' };
});
const describe = b => {
  const raw = Buffer.concat(b.instructions.map(i => i.raw));
  return { name: b.name, entry: cpuLabel(b.entry), end_exclusive: cpuLabel(b.instructions.at(-1).next),
    covered_bytes: raw.length, instruction_count: b.instructions.length,
    sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() };
};
const map = new Map(blocks.flatMap(b => b.instructions.map(i => [i.cpu, i])));
const sourceWindow = (name, entry, length, qualification) => {
  const raw = bytes.subarray(cpuToOffset(entry, bytes.length), cpuToOffset(entry, bytes.length) + length);
  return { name, entry: cpuLabel(entry), covered_bytes: length, sha256: createHash('sha256').update(raw).digest('hex'),
    machine_bytes: raw.toString('hex').toUpperCase(), qualification };
};
const table = sourceWindow('selectedSoundC4FF', 0x80C4FF, 2, 'Selected original menuWORD, no arbitrary selector/table-capacity claim');
const selectedSound = parseInt(table.machine_bytes.slice(2) + table.machine_bytes.slice(0, 2), 16);
const tables = [table, sourceWindow('selectedDirectoryPointer98FFFA', 0x98FFFA, 3,
  'Three actual original bytes from overlapping WORD reads by F092 atindex0; initialization is not automatically run.'),
  sourceWindow('selectedDirectory9FFEAC', 0x9FFEAC, 94,
    'Original selected directory header5,22 four-byte entries and BYTEFF terminator; selected pointer owner only, no scene/boot execution.')];
const apu = JSON.parse(await readFile('analysis/render-9e1a.json', 'utf8'));
for (const [old, name] of [[describeRenderMenuWindow(bytes, 'selectedAudioC46E'), 'audioC46E'],
  [apu.windows.find(w => w.name === 'apuF007'), 'apuF007']]) {
  const current = describe(blocks.find(b => b.name === name));
  if (old?.machine_bytes !== current.machine_bytes || old.sha256 !== current.sha256) throw Error('Reused audio source drift');
}
const roots = [[0x80C416, 'RTS'], [0x81F130, 'RTL'], [0x81F092, 'RTL'], [0x81F122, 'RTS'],
  [0x81F1E8, 'RTS'], [0x81F03A, 'RTS', 1], [0x81F024, 'RTS', 1], [0x81F067, 'RTL', 1],
  [0x81F007, 'RTL'], [0x81F007, 'RTL', 1], [0x81F100, 'RTS']];
const proofs = roots.map(([entry, ret, entryM = 0]) => proveAudioStack(map, entry, ret, { entryM }));
const selectedProof = proveAudioStack(map, 0x80C46E, 'RTS', { menuSound: selectedSound });
const boundedProof = proveAudioStack(map, 0x80C46E, 'RTS', { lowSoundNonzeroVoice: true });
const fullVoiceProof = proveAudioStack(map, 0x80C46E, 'RTS', { anySoundNonzeroVoice: true });
const cacheHitProof = proveAudioStack(map, 0x80C46E, 'RTS', { cacheHitNonzeroVoice: true });
let generalFailure;
try { proveAudioStack(map, 0x80C46E, 'RTS'); throw Error('Unexpected general C46E proof'); }
catch (error) { if (!error.message.startsWith('Audio stack mismatch')) throw error; generalFailure = error.message; }
const graphBlocks = blocks.slice(0, 8), graphInstructions = graphBlocks.flatMap(b => b.instructions);
const report = {
  rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json', windows: blocks.map(describe), tables,
  scope: 'Complete local transitive C46E/C416/F130/F007/F03A/F100/F122/F1E8 source and directory pointer owner F092. Closed structural helper returns including mixed BYTE/WORD calls; original selected menu caller has a separate8-byte proof. GeneralC46E zero-voice PHA/RTS is unbalanced, no repair or universal return. Selected cache/boot excerpts and byte reply source do not establish actual device progress or full boot/interrupt lifecycle.',
  graph: { code_bytes: graphBlocks.reduce((n, b) => n + describe(b).covered_bytes, 0), instructions: graphInstructions.length,
    edges: graphInstructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
    proofs, selected_menu_proof: selectedProof, bounded_c46e_proof: boundedProof,
    nonzero_voice_c46e_proof: fullVoiceProof, cache_hit_c46e_proof: cacheHitProof,
    general_c46e_return_proven: false, general_c46e_failure: generalFailure,
    native_binding: false, native_entries: ['80:C416', '80:C46E', '81:F03A', '81:F122', '81:F1E8', '81:F100', '81:F130'],
    native_c46e_scope: 'Manual all-WORD-sound/nonzero-voice with conditional14-byte transitive and8-byte low/cache-hit/menu proofs. Only zero voice remains an unbalanced atomic boundary.',
    actual_device_termination_proven: false },
  contract: {
    c46e: 'PHK/PLB forcesDBR80 withoutsaving entryDBR. FreshWORDDP02 selectsC4B3+Y, soundWORDPHA beforecacheCMP1CE0. Cachemiss andunsignedsound>=8000 writes1CE0 thenF130; equal/lowword skips. FreshDP04->C416; A6/F007. FreshDP06 zero goesRTS withsavedWORDstillonstack. Nonzero unsignedcomparefresh1CE2; ifdifferent storesvoice thenA0F/F007. PLAoriginalsound ORFF00->X;A5/F007; WORDRTS/DBR80 underselected nonzerovoice contract only.',
    c416: 'WORDSTAactualDBR4202 writes4202+4203 beforeLDA0080/LDXfreshDP00. SignednegativeX uses80 directly withoutpositions. Otherwisefresh0E80+X minusfresh0E28+X wrapping SEC/SBC,CLC+0600,BPLclamp0,SEC minusfresh0CC4,borrowclamp0; twoWORDLSR andunsignedmin255. SEP20/BYTELSR->4203, EOR7F savedBYTE. ActualBYTE4217/XBA/PLA/complement4203 thenactualBYTE4217/REP20/TAX. A=X=first4217<<8|second4217, first actualhigh result not recomputed. DBR/Yunchanged; N/ZfromfullTAX,CfromlastBYTELSR,VfromlastWORDADC/SBC; noNOPtiming claim.',
    f130: 'PHP/WORDbit8000 guard,REP10/SEP20->DP98-low; Y5 scansfresh[8C],Y BYTEid every4 untilFF ormatch, fullWORDYwrap. OverlappingWORDreadsY+1/Y+2->89/8A formactual24bitpointer. HeaderWORDminus2->92, addressWORD->96. Fresh92=0 terminates. Raw nonnegativecount->94/F100, fresh24bitpointer->8F/90,PHY/Y0, A10/Xfull98/F007 inBYTEmode, BYTE1CE6=0; send96-low/high throughF03A, originaldo-loop BYTE[8F],Y/F03A/BYTEINC96/WORDINY/CPY94 untilequal, finalF03A withactualcalleeA(oddduplicateslastBYTE/evenbufferstoken);REP20/PLY. Negativecount masks7FFF->94, ASL/PHA/F100/PLX;A10/F007 withWORDX, BYTEclear1CE6,WORD96/F122, nextWORD->98, F1E8/WORDDEC94 do-loop thenback. Freshscratch/pointers and originalcounterwrap, no data/bytecount cap.',
    f100: 'WORDinput->98;fresh92 SEC minusfresh98->92. Fixed overlap scratch, no stack/frame/DBR effect.',
    f122: 'WORDPHA/SEP20, lowBYTEPLA/F03A then highBYTEPLA/F03A, REP20/RTS. Doesnot increment96.',
    f1e8: 'Same two actual stackedBYTE sends asF122, thenWORDINC96 twice/RTS. Originallow-beforehigh andWORDwrap preserved.',
    f03a: 'BYTEPHA, freshBYTE1CE6 zero buffersPLA->1CE7 andBYTEDEC1CE6 toFF. Nonzero firstBYTEclear1CE6, freshBYTE1CE4 savedtoken pollsactual2140 untilequal; increment/XBA, freshBYTE1CE7->2141,PLAincoming->2142, XBA/token->2140 and1CE4. X/Y unchanged, highA and BYTEflags are actualcalleeeffects; noPHP restoration and nohardware completion assumption.',
    f007: 'PHP preservesactualentryM/status;SEP20/XBA, freshBYTE1CE4 thenfreshBYTE2140 equalitypolls. WORDX->2142/2143;BYTEcommand->2141,newtoken->2140/1CE4. PLP restores entryBYTEorWORDmode/status. ExistingpublicprepareF007 acceptsWORDentry only; internalfixedalgorithm has the same command<<8|nextToken fullA formula under either source-proven entryM, because firstXBA followedbyLDA discardsentryhighA.',
    owners: 'CompleteF092 reads overlappingoriginal98FFFA+fullWORDX/98FFFB+X into8C/8D and transfersbaseblock throughF007/F03A/F122/F100, withsharedscratch andPHP/PLP. SelectedEF26 clearscachewords1CE0/1CE2. SelectedEF63 forcesDBR80, callsunclosedF229 thenF092(index0), storesvoice3 andsends0F/03. SelectedCF5E clearscachewords. BYTEF067 pollsactualtoken, writesincrement2140, waitsactualecho, stores1CE4 thenreads2141. Otherreset/APUboot/SPC/interrupt owners remainopen; rawpatterns are not a writer census.',
    selected_menu: 'OriginalA805 prefixDP00FFFF/04=0040/06=0003/02=004C. ActualC4FF002D skipsF130 independent ofcache; C416negative-index path fixesmultiplier40/complement3F, but bothBYTE4217 values remainexternal. C416/F007 do notwriteDP06. Selectedbalanced8-byteWORDRTS returnsDBR80 withoutentryDBRrestore. Dynamic1CE2 chooses2 or3F007 calls; no actual audio output or response asserted.',
  },
  next: 'Current next block and open work: docs/PORTIERUNGSSTAND.json.',
};
await writeFile('analysis/render-audio.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-audio.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; Static transitive audio sources, complete directory owner and selected initialization excerpts. No CPU/device/time/scene execution.\n\n` + blocks.map(formatBlock).join('\n'));
console.log(`Audio C46E graph ${report.graph.code_bytes}/${report.graph.instructions}; helper stacks ${proofs.map(p => p.minimum_protected_stack_bytes)}; selected menu ${selectedProof.minimum_protected_stack_bytes}; general C46E OPEN.`);
