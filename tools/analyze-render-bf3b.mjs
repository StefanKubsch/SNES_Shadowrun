import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';
import { proveRender9F6DSource, proveRender8F20Source, proveRender9022Source,
  proveRender905ESource, proveRender8F3ASource, proveRenderFF79Source,
  proveRenderEF47Source, proveRenderFA92Source } from './render-dialog-source.mjs';
import { proveRenderSelectionSource, proveRenderText9178Source } from './render-menu-source.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const word = { e: 0, m: 0, x: 0 };
function block(name, entry, end) {
  const state = { ...word }, instructions = [];
  for (let pc = entry; pc < end;) {
    if (pc === 0x80FC5F) state.m = 1;
    const i = decode(bytes, pc, state);
    if (i.next > end || ['XCE', 'TCD', 'PLD', 'SED', 'RTI', 'BRK', 'COP'].includes(i.mnemonic)) throw Error(`Renew ${name} at ${cpuLabel(pc)}`);
    instructions.push(i); pc = i.next;
    if (['REP', 'SEP'].includes(i.mnemonic)) {
      if (i.value & 32) state.m = Number(i.mnemonic === 'SEP');
      if (i.value & 16) state.x = Number(i.mnemonic === 'SEP');
    }
  }
  return { name, entry, initialState: word, instructions, stop: 'Complete local window; external callee returns remain conditional unless separately closed. Static source only.' };
}
const describe = b => {
  const raw = Buffer.concat(b.instructions.map(i => i.raw));
  return { name: b.name, entry: cpuLabel(b.entry), end_exclusive: cpuLabel(b.instructions.at(-1).next),
    covered_bytes: raw.length, instruction_count: b.instructions.length,
    sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() };
};
const address = label => parseInt(label.replace(':', ''), 16);
const blocks = [
  ['edgeBF3B', 0x80BF3B, 0x80C06B], ['noticeFEC1', 0x80FEC1, 0x80FF14],
  ['actions99EB', 0x8099EB, 0x809BA0], ['dialog936C', 0x80936C, 0x8094EA],
  ['resetBCB2', 0x80BCB2, 0x80BCBE], ['mainCall96BD', 0x8096BD, 0x8096C0],
  ['expiryFF14', 0x80FF14, 0x80FF73], ['mainExpiry96E1', 0x8096E1, 0x8096E4],
].map(s => block(...s));
const previous = JSON.parse(await readFile('analysis/render-be6d.json', 'utf8'));
if (previous.rom_sha256 !== metadata.rom_sha256) throw Error('BE6D revision drift');
const excluded = new Set(['heldBE6D', 'selectBCBE', 'widthFADD', 'widthByteFB2A', 'mainCall96BA', 'releaseBE5B']);
const reusedWindows = [...previous.windows, ...previous.dependencies.flatMap(d => d.windows)].filter(w => !excluded.has(w.name));
const reused = reusedWindows.map(w => {
  const b = block(w.name, address(w.entry), address(w.end_exclusive));
  if (JSON.stringify(describe(b)) !== JSON.stringify(w)) throw Error('Dependency drift: ' + w.name);
  return b;
});
const noticeMap = new Map([blocks[1], ...reused].flatMap(b => b.instructions.map(i => [i.cpu, i])));
const noticeProof = proveWordStack(noticeMap, 0x80FEC1, 'RTS', { measureStack: true, widthJoins: new Set([0x80FC36]) });
if (noticeProof.reachable_instructions !== noticeMap.size) throw Error('Unexpected unused notice dependency');
const input = JSON.parse(await readFile('analysis/render-input-flow.json', 'utf8'));
if (input.rom_sha256 !== metadata.rom_sha256) throw Error('Main revision drift');
const prefix = input.windows.find(w => w.name === 'selectedEdgeBF3B');
if (!describe(blocks[0]).machine_bytes.startsWith(prefix.machine_bytes)) throw Error('BF3B prefix drift');
const main = input.windows.find(w => w.name === 'mainLoop96AB');
if (main.machine_bytes.slice(36, 42) !== describe(blocks[5]).machine_bytes) throw Error('Maincall drift');
if (main.machine_bytes.slice(108, 114) !== describe(blocks[7]).machine_bytes) throw Error('Expiry maincall drift');
const local = b => {
  const map = new Map(b.instructions.map(i => [i.cpu, i])), pending = [b.entry], seen = new Set();
  while (pending.length) {
    const pc = pending.pop(); if (seen.has(pc)) continue;
    const i = map.get(pc); if (!i) throw Error('Uncovered local edge ' + cpuLabel(pc)); seen.add(pc);
    if (i.mnemonic === 'RTS') continue;
    if (['JMP', 'BRA'].includes(i.mnemonic)) pending.push(i.target);
    else { if (i.mode === 'rel8') pending.push(i.target); pending.push(i.next); }
  }
  if (seen.size !== map.size) throw Error('Unreachable local instructions');
  return { name: b.name, reachable_local_instructions: seen.size,
    calls: b.instructions.filter(i => ['JSR', 'JSL'].includes(i.mnemonic)).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target),
      qualification: 'Original callsite; local continuation conditional on actual return widths/DBR/stack and fresh byte effects. Not a callee return proof.' })),
    edges: b.instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
    returns: b.instructions.filter(i => i.mnemonic === 'RTS').map(i => cpuLabel(i.cpu)) };
};
const localGraphs = [blocks[0], blocks[2], blocks[3], blocks[4]].map(local);
const ff79 = proveRenderFF79Source(bytes);
if (ff79.rom_sha256 !== metadata.rom_sha256 || !ff79.full_graph.closed
  || JSON.stringify(describe(block('clearFF79', 0x80FF79, 0x80FF98))) !== JSON.stringify(ff79.windows[0])) throw Error('FF79 source drift');
const ef47 = proveRenderEF47Source(bytes);
if (ef47.rom_sha256 !== metadata.rom_sha256 || !ef47.full_graph.closed
  || JSON.stringify(describe(block('selectEF47', 0x81EF47, 0x81EF63))) !== JSON.stringify(ef47.windows[0])) throw Error('EF47 source drift');
const fa92 = proveRenderFA92Source(bytes);
if (fa92.rom_sha256 !== metadata.rom_sha256 || !fa92.full_graph.closed
  || JSON.stringify(describe(block('positionFA92', 0x80FA92, 0x80FAAC))) !== JSON.stringify(fa92.windows[0])) throw Error('FA92 source drift');
const unpack = proveRender9F6DSource(bytes);
if (unpack.rom_sha256 !== metadata.rom_sha256 || !unpack.full_graph.closed
  || JSON.stringify(describe(block('unpack9F6D', 0x809F6D, 0x80A033))) !== JSON.stringify(unpack.windows[0])) throw Error('9F6D source drift');
const rows = proveRender8F20Source(bytes);
if (rows.rom_sha256 !== metadata.rom_sha256 || !rows.full_graph.closed
  || JSON.stringify(describe(block('rows8F20', 0x808F20, 0x808F3A))) !== JSON.stringify(rows.windows[0])) throw Error('8F20 source drift');
const fields = proveRender9022Source(bytes);
if (fields.rom_sha256 !== metadata.rom_sha256 || !fields.full_graph.closed
  || JSON.stringify(describe(block('fields9022', 0x809022, 0x80905E))) !== JSON.stringify(fields.windows[0])) throw Error('9022 source drift');
const furtherFields = proveRender905ESource(bytes);
if (furtherFields.rom_sha256 !== metadata.rom_sha256 || !furtherFields.full_graph.closed
  || JSON.stringify(describe(block('fields905E', 0x80905E, 0x80908C))) !== JSON.stringify(furtherFields.windows[0])) throw Error('905E source drift');
const transfer = proveRender8F3ASource(bytes);
if (transfer.rom_sha256 !== metadata.rom_sha256 || !transfer.full_graph.closed
  || JSON.stringify(describe(block('transfer8F3A', 0x808F3A, 0x808F87))) !== JSON.stringify(transfer.windows[0])) throw Error('8F3A source drift');
const selection = proveRenderSelectionSource(bytes);
if (selection.rom_sha256 !== metadata.rom_sha256 || !selection.conditional_graph.conditional_graph_closed
  || JSON.stringify(describe(block('choice91E2', 0x8091E2, 0x80920D))) !== JSON.stringify(selection.windows[0])
  || JSON.stringify(describe(block('choice9215', 0x809215, 0x8092C5))) !== JSON.stringify(selection.windows[1])) throw Error('Selection source drift');
const known = new Set([0x80FEC1, 0x80F963, 0x80FE69, 0x80FA3E, 0x80BE5B, 0x80BCB2, 0x8099EB, 0x80936C, 0x809E1A, 0x81886A, 0x81B0A1, 0x80FF79, 0x81EF47, 0x80FA92, 0x809F6D, 0x808F20, 0x809022, 0x80905E, 0x808F3A, 0x8091E2, 0x809215]);
const frontier = [...new Set(localGraphs.flatMap(g => g.calls.map(c => address(c.to))))].filter(pc => !known.has(pc)).map(cpuLabel);
const text9178 = proveRenderText9178Source(bytes);
if (text9178.rom_sha256 !== metadata.rom_sha256 || text9178.full_graph.closed !== false
  || !text9178.render_graph.conditional_graph_closed
  || text9178.windows[0].entry !== '80:9178') throw Error('Partial9178 source drift');
const owner = JSON.parse(await readFile('analysis/render-a9e1.json', 'utf8'));
const initializer = owner.windows.find(w => w.name === 'initializeAB2C');
const initializerBlock = block(initializer.name, address(initializer.entry), address(initializer.end_exclusive));
if (owner.rom_sha256 !== metadata.rom_sha256 || JSON.stringify(describe(initializerBlock)) !== JSON.stringify(initializer)) throw Error('AB2C owner drift');
const tables = [['selectedNoticeD9B8', 0x80D9B8, 2], ['selectedDialog94F7', 0x8094F7, 160], ['expiryTextFF73', 0x80FF73, 6]]
  .map(([name, entry, length]) => {
    const raw = bytes.subarray(cpuToOffset(entry, bytes.length), cpuToOffset(entry, bytes.length) + length);
    return { name, entry: cpuLabel(entry), covered_bytes: length, machine_bytes: raw.toString('hex').toUpperCase(), sha256: createHash('sha256').update(raw).digest('hex'),
      qualification: 'Selected original ROM bytes; actual DBR/index required. No table capacity, semantic meaning or provider initialization inferred.' };
  });
const report = {
  rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json',
  scope: 'Complete local BF3B, FEC1, 99EB, 936C, BCB2 and maincall bytes. FEC1 transitive local source closed without external return assumptions. BF3B full graph remains open at action/dialog nested callees and nonreturn E382 reset. No CPU/device/clock/scene execution.',
  windows: blocks.map(describe), dependencies: [{ report: 'analysis/render-be6d.json', windows: reusedWindows }], tables,
  local_graphs: localGraphs,
  selected_owners: { initializer_report: 'analysis/render-a9e1.json', initializer_window: initializer,
    expiry: local(blocks[6]), qualification: 'AB2C original slot initializer and FF14 local mainconsumer. FF14 C560/C51F/C46E returns remain open; no automatic lifetime/frame execution.' },
  notice_graph: { code_bytes: 83 + reusedWindows.reduce((n, w) => n + w.covered_bytes, 0), instructions: noticeMap.size,
    proof: noticeProof, actual_termination_proven: false, native_binding: true },
  full_graph: { closed: false, native_binding: false, unresolved_nested_callees: frontier,
    supplied_source_nested_callees: [{ entry: '80:FF79', source: 'analysis/render-ff79.json',
      code_bytes: ff79.full_graph.code_bytes, instructions: ff79.full_graph.instructions,
      minimum_protected_stack_bytes: ff79.full_graph.proof.minimum_protected_stack_bytes, native_binding: true,
      native: 'proof/render/clear-ff79.mjs',
      qualification: 'Complete local source/stack graph and native manual atomic FF79 supplied separately; original936C/BF3B caller/byte ownership remain open.' },
      { entry: '81:EF47', source: 'analysis/render-ef47.json', code_bytes: ef47.full_graph.code_bytes,
        instructions: ef47.full_graph.instructions, minimum_protected_stack_bytes: ef47.full_graph.proof.minimum_protected_stack_bytes,
        native_binding: true, qualification: 'Complete EF47/F25A/F1FA source and actual callees supplied; native atomic F1FA supplied separately; native atomic F25A supplied separately; native atomic EF47 supplied under22 protected stackbytes; original936C/BF3B caller/byte ownership remain open.' },
      { entry: '80:FA92', source: 'analysis/render-fa92.json', code_bytes: fa92.full_graph.code_bytes,
        instructions: fa92.full_graph.instructions, minimum_protected_stack_bytes: fa92.full_graph.proof.minimum_protected_stack_bytes,
        native_binding: true, native: 'proof/render/fields-fa92.mjs', qualification: 'Complete finite acyclic FA92 source26/12 with2 protected stackbytes and no callees. Native manual atomic prerequisite supplied separately; original936C/BF3B integration remains open.' },
      { entry: '80:9F6D', source: 'analysis/render-9f6d.json', code_bytes: unpack.full_graph.code_bytes,
        instructions: unpack.full_graph.instructions, minimum_protected_stack_bytes: unpack.full_graph.proof.minimum_protected_stack_bytes,
        native_binding: true, native: 'proof/render/unpack-9f6d.mjs', actual_termination_proven: false,
        qualification: 'Complete9F6D/9E65 source223/120 with10 protected stackbytes and original256-byte offset table. Native manual atomic prerequisite supplied separately with bounded fresh sources, exact literal0/offsetwidth0 and ascending MVN7F overlap/indexwrap. Original936C/BF3B initialization/caller/frame integration remains open.' },
      { entry: '80:8F20', source: 'analysis/render-8f20.json', code_bytes: rows.full_graph.code_bytes,
        instructions: rows.full_graph.instructions, minimum_protected_stack_bytes: rows.full_graph.proof.minimum_protected_stack_bytes,
        native_binding: true, native: 'proof/render/rows-8f20.mjs', actual_termination_proven: true,
        qualification: 'Complete8F20 source26/13 with3 protected stackbytes; seven fixed descending MVP7F passes/1792 bytes, actual entryDBR restored and final PLB flags. Native manual atomic prerequisite supplied separately; original936C/BF3B byte ownership/caller binding remains open.' },
      { entry: '80:9022', source: 'analysis/render-9022.json', code_bytes: fields.full_graph.code_bytes,
        instructions: fields.full_graph.instructions, minimum_protected_stack_bytes: fields.full_graph.proof.minimum_protected_stack_bytes,
        native_binding: true, actual_termination_proven: false,
        qualification: 'Complete9022/8FF5 source105/43 under4 protected stackbytes, standalone8FF5 under2. Fresh actualDBR0140 wait termination unproved; fixed128 BYTE/16 WORD loops and tailalias pinned. Native8FF5 prerequisite supplied under2 protected stackbytes; native atomic9022 supplied under4 protected stackbytes; original936C/BF3B initialization/caller binding remains open.' },
      { entry: '80:905E', source: 'analysis/render-905e.json', code_bytes: furtherFields.full_graph.code_bytes,
        instructions: furtherFields.full_graph.instructions, minimum_protected_stack_bytes: furtherFields.full_graph.proof.minimum_protected_stack_bytes,
        native_binding: true, native: 'proof/render/fields-905e.mjs', actual_termination_proven: false,
        qualification: 'Complete905E-8FF5-A954 source95/36 under5 protected stackbytes; realX0800 publication/signed0140 wait, three fixed fieldwords, selector01BA bit7 and freshWORD1562 increment/flags pinned. NativeA954 supplied under3 protected stackbytes; native atomic905E supplied under5 protected stackbytes; actual0140 wait and original936C/BF3B initialization/caller binding remain open.' },
      { entry: '80:8F3A', source: 'analysis/render-8f3a.json', code_bytes: transfer.full_graph.code_bytes,
        instructions: transfer.full_graph.instructions, minimum_protected_stack_bytes: transfer.full_graph.proof.minimum_protected_stack_bytes,
        native_binding: true, native: 'proof/render/transfer-8f3a.mjs', actual_termination_proven: false,
        qualification: 'Complete8F3A/8EFE/B0A1 source122/55 under6 protected stackbytes; original16-byte table, eleven actual counterwait/helper updates, BYTEcarry/highA/P restoration pinned. Native manual atomic composition supplied; actualNMI/DMA/wait and original936C/BF3B ownership/caller binding remain open.' }],
    supplied_conditional_nested_callees: [{ entry: '80:A6A5', source: 'analysis/render-a6a5.json',
      native: 'proof/render/menu-a6a5.mjs', minimum_protected_stack_bytes: 20,
      qualification: 'Manual normal menu supplied separately. Full original99EB/BF3B caller composition and reset/source ownership remain open; not an unconditional returning summary.' },
      ...['choice91e2_graph','choice9215_graph'].map(key => ({ entry: selection[key].entry,
        source: 'analysis/render-selection.json', graph: key,
        minimum_protected_stack_bytes: selection[key].proof.minimum_protected_stack_bytes,
        conditional_normal_graph_closed: true, full_reset_graph_closed: false,
        native_binding: selection[key].native_binding, actual_termination_proven: false,
        qualification: key === 'choice91e2_graph'
          ? 'Complete91E2 and actual transitive menu sources supplied with normal9E1A/reset exclusions. Native atomic91E2 supplied separately under22 stackbytes; no whole936C/BF3B return or initialization proof.'
          : 'Complete9215 and actual transitive menu/allocation/release sources supplied with normal9E1A/reset exclusions. Native atomic9215 supplied separately under28 stackbytes; no whole936C/BF3B return or initialization proof.' }))],
    supplied_partial_nested_callees: [{ entry: '80:9178', source: 'analysis/render-9178.json',
      full_graph_closed: false, native_binding: false, minimum_render_stack_bytes: text9178.render_graph.proof.minimum_protected_stack_bytes,
      unresolved_nested_callees: text9178.full_graph.unresolved_nested_callees,
      qualification: 'Complete local9178/908C and actual render subset, separate C34A fixed-callee source and C1CA local source/frontier supplied. C1CA dynamic return remains source-required;9178 stays in whole-source frontier. Render stack17 and C1CA prefix10 are not a full9178 stack minimum.' }],
    separate_nonreturn_terminal: '80:E382', minimum_protected_stack_bytes: null,
    qualification: 'No whole BF3B WORD/DBR/stack return proof; local source decoded under explicit compatible external returns only.' },
  contract: {
    entry: 'E0M0X0/D0000 binary, actual DBR, intact disjoint code/stack. Early return retains incoming X/Y. Full caller ownership and transitive stack remain open.',
    gates: 'Fresh WORD1D5D OR fresh1D5F: nonzero returns atBFE7 without reading01DA/01CE. Otherwise signed01DA negative returns; edge01CE AND8030 zero returns. WORDSTZ1FA6 happens before LDY01DE/LDX1350,Y signedgate; negative taskhead still leaves1FA6 cleared.',
    chains: 'Three independent fresh1350,Y -> 0BA2,X signed-chain walks through0372,X with full WORD indices. Negative successor is not a sentinel exit: TAX then reread0BA2,X. First saves masked edge inDP6B after taskheadgate. Middle and final walks rereadhead after earlier callees. No cached task/link/flags and no termination assumed.',
    distance: 'Firstwalk terminal taskflags reread twice only when DP6B==8000 and flags&6002!=0; last flags&6682->1FA6. X reloaded0CC2. Full wrapping SEC/SBC for0E28 and0E80, signedBPL elseEORFFFF/INCA magnitudes; CLC wrapping sum, unsignedCMP00A1. Thirdaxis0ED8 magnitude unsignedCMP0081 only below00A1. Nearpath STZ1FA6; farpath nonzero1FA6 bypasses notice.',
    notice: 'Farzero1FA6 setsDP00=2,02=2,04=12,06=3,08=0,0A=0,0C=60 thenJSRFEC1/BCB2/9E1A/RTS.9E1A may terminate atE382; no unconditional RTS contract.',
    actions: 'Secondwalk flags&67F2 zero returns; TAX then fresh01CE. BIT8000 priority calls99EB with TXA and savedY. ReturnA bit2 selects optional dialog via fixedlong7E4450+Y, preservingX aroundTYX andY around936C. Zero dialogword emitsA2; nonzero calls936C withDP00=Y,DP02=word thenA0. Withoutbit8000, bit20 emitsflags&80; otherwise flags&0610, exact0600 becomeszero. BIT immediate affects Z only, not N/V.',
    event: 'Third fresh1350,Y signedgate happens before saving actionA; negativehead returns without event/reset/filter. Otherwise PHA protectsA acrosschain. PLA/ORAfresh0C62,X/STA0C62,X; thenBCB2/9E1A. 0C62 is existing task eventword, not a new flag owner or scheduler invocation.',
    fec1: 'FreshDP08 exact0400 writes0202=30 beforeF963. Allocation may return capacity-full without output initialization; caller still readsDP00/PHA, freshDP0A/ASL WORDwrap/TAX, actualDBR D9B8+X->DP02, FE69. Scan X6,4,2,0: long7E0216+X signednegative choosesfirst free; occupiedentry compares carriedminimum unsigned to freshDBR021E+X; equality updatesY so ties choose lowerindex. Withalloccupied PHA minimum/TYX/freshlong7E0216+X->DP00/PHX/FA3E/PLX. Shared footer freshDP0C->DBR021E+X, PLA discards scan/minimum, PLA restoresallocationword->long7E0216+X. Both stackpaths balance; final A=allocationword,N/Z fromPLA,C/V from actualcallee/comparison path; X chosenentry,Y actualscan/callee result,DBR preserved.',
    owners: '1FA6 BF3B writer/99EB reader-and-clear;01CE 9E1A/C152 input ownership remains existing source contract.1350 taskhead/0372 link/0BA2 flags/0C62 eventword use existing Taskliste owners, actual DBR and full indices.0216 slots fixed7E;021E lifetimes actualDBR, overlapping WORD bytes remain fresh. DP00/02/08/0A/0C share allocation/text/reset scratch. No original initialization or main/interrupt chronology inferred.',
    expiry: 'KnownAB2C initializes four long7E0216..021C toFFFF and clears0202. Main96E1 callsFF14 conditionally on earlierreturns/gates. FF14 X6..0 skipsnegative fixed7Eslots; occupiedslots DECWORDactualDBR021E+X/STA, onlyexactzero rereadsfixed7Eslot->DP00/PHX/FA3E/PLX thenFFFF marker. Countdown0 wrapsFFFF withoutrelease. Tailfresh0202 zeroRTS, elseDEC/store beforeC560, optionalC51F andC46E; allthree callee sources remain separate. No counted gameframes or invented original initialization chronology.',
  },
  next: 'Current next block and open work: docs/PORTIERUNGSSTAND.json.',
};
await writeFile('analysis/render-bf3b.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-bf3b.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete local BF3B/FEC1/99EB/936C, open nested action/dialog boundaries. FEC1 transitive source closed. No CPU execution.\n\n` + blocks.map(formatBlock).join('\n'));
console.log(`BF3B local ${report.windows[0].covered_bytes}/${report.windows[0].instruction_count}; FEC1 graph ${report.notice_graph.code_bytes}/${noticeMap.size}, stack ${noticeProof.minimum_protected_stack_bytes}; whole BF3B OPEN, ${frontier.length} nested callees.`);
