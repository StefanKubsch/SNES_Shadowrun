import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel } from './rom.mjs';
import { inspectScriptTables } from './scripts.mjs';
import { decode, formatBlock } from './disassemble.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const mode = { e: 0, m: 0, x: 0 };
const specs = [['resetBCB2', 0x80BCB2, 0x80BCBE], ['releaseBE5B', 0x80BE5B, 0x80BE6D],
  ['removeFA3E', 0x80FA3E, 0x80FA67], ['renderAD92', 0x81AD92, 0x81ADBA],
  ['renderPrefixA9B2', 0x81A9B2, 0x81A9C0], ['callerA4BF', 0x80A4DD, 0x80A4E7]];
const blocks = specs.map(([name, entry, end]) => {
  const instructions = [];
  for (let pc = entry; pc < end;) {
    const i = decode(bytes, pc, mode);
    if (i.next > end || ['REP', 'SEP', 'PLP', 'PLB', 'PLD', 'XCE', 'TCD', 'SED', 'RTI', 'BRK', 'COP'].includes(i.mnemonic)) throw Error(`Renew ${name} source proof`);
    instructions.push(i); pc = i.next;
  }
  return { name, entry, initialState: mode, instructions,
    stop: 'Complete local window or selected render prefix; external return widths/DBR/D/stack assumed,not proved; no CPU or render execution' };
});
const describe = b => {
  const raw = Buffer.concat(b.instructions.map(i => i.raw));
  return { name: b.name, entry: cpuLabel(b.entry), end_exclusive: cpuLabel(b.instructions.at(-1).next), covered_bytes: raw.length,
    instruction_count: b.instructions.length, sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() };
};
const graphs = blocks.slice(0, 4).map(b => {
  const map = new Map(b.instructions.map(i => [i.cpu, i])), pending = [b.entry], seen = new Set();
  while (pending.length) {
    const pc = pending.pop(); if (seen.has(pc)) continue;
    const i = map.get(pc); if (!i) throw Error(`Uncovered ${b.name} edge`);
    seen.add(pc); if (['RTS', 'RTL'].includes(i.mnemonic)) continue;
    if (i.target !== undefined && !['JSR', 'JSL'].includes(i.mnemonic)) pending.push(i.target);
    if (i.mnemonic !== 'BRA') pending.push(i.next);
  }
  if (seen.size !== map.size) throw Error(`Unreachable ${b.name} source bytes`);
  return { name: b.name, reachable_local_instructions: seen.size,
    edges: b.instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
    return_sites: b.instructions.filter(i => ['RTS', 'RTL'].includes(i.mnemonic)).map(i => cpuLabel(i.cpu)) };
});
const natives = inspectScriptTables(bytes).native_functions.filter(n => ['97', 'A5'].includes(n.id));
if (natives.find(n => n.id === '97')?.cpu_address !== '80:FA3E' || natives.find(n => n.id === 'A5')?.cpu_address !== '80:BCB2') throw Error('Reset native anchor changed');
const report = {
  rom_sha256: metadata.rom_sha256,
  scope: 'Complete localBCB2/BE5B/FA3E reset chain71 bytes plus complete localAD92 render wrapper40 bytes. Separate historical A9B2 prefix14 andA4BF caller10. NativeA5/97 table anchors pinned. Full structuralcallee/reset graph is separately supplied inrender-ad92.json; actualmemory/termination/wait return remains source-required;no native reset/render execution.',
  windows: blocks.map(describe), source_bytes: 125, caller_bytes: 10, local_graphs: graphs, native_profiles: natives,
  transitive_return_proven: false,
  entry: 'Explicit E0/M0/X0,D0000,actual absolute-operand DBR/WRAM mapping andvalidstack/data sources. Local bodies do not changeDBR/D/widths/decimal mode. Post-render continuations assume valid returned WORDmode/DBR/D/stack; no all-path proof. No decimal arithmetic in these local bodies.',
  reset: {
    order: 'BCB2 STZ WORD01D8 beforeLDA WORD01DA;BMI BCBD skipsBE5B onlyifloaded01DA isnegative. No old01D8 read. Nonnegative01DA invokesBE5B atBCBA,includingzero;not a nonzero gate.',
    inactive_return: 'Negative01DA:RTSBCBD,A=loaded01DA,N1/Z0;X/Y/DBR/D/E/M/X/decimal/Carry/V preserved.01D8=0 is the sole direct write. NativeA5 returns this WORD throughits two-byte ABI;not an inventedFFFF return.',
    active: 'BE5B reads WORD01DC,writes sharedDP00,thenJSRFA3E. OnlyafterFA3E andrender actually return,LDAFFFF/STA01DA/STA01DE/RTS.01DC preserved bythelocalwrites;no claim it survives unknownrendercallees. AFFFF/N1/Z0 fromLDA ifWORDmode returned;Carry/V inherit actualrenderresult.',
  },
  remove: {
    first_write: 'FA3E LDXDP00;LDA0;STA WORD DBR:0226+X beforeCPX WORD0204. No alignment,capacity,occupancy,sign ornegativehandle guard. Native97 hasoneWORDarg,no returnbytes;directBE5B call supplies01DC inworkspace00.',
    not_tail: 'CPX0204/BNEFA62 goes straight toAD92 withno0212/0204 writes;render still called. Slot/tablezeroing cannot be acknowledged as a full native97 effect byitself.',
    tail_scan: 'WhenX equalscurrentWORD0204,DEX twice thenBMI checks the secondDEX word-sign. Ifnonnegative,readWORD0226+X andBEQ repeatDEXpair. Stop atnegativeX orfirstnonzeroWORD. Odd offsets are not rejected;the source mayfinishwithFFFF ratherthanFFFE.',
    projection: 'Afterstop,INX twice;read longindexedWORD7E:2060+X;STAWORD0212;DEX twice;STXWORD0204. Reads the projection atcursor+2,notatcursor. FororiginalevenX0 removingthelastactiveoffset,projection2060 isstillread and0204 becomesFFFE. Long-indexed read maycross7E to7F forlargeX;actual bytecoverage required,not a copiedtablewrap.',
    render: 'FA62 JSL81AD92 isunconditional onbothbranches,thenRTSFA66. No localpushes. Callee maywrite globals ornot return;priorwrites andpost-renderBE5B resets cannot be collapsed intoa no-op return.',
  },
  render_wrapper: {
    first: 'AD92 alwaysJSL A9B2 before readingWORD0204. Negative0204 skips onlytheentryloop,notthiscall andnotfinalACB5.',
    loop: 'Forpost-A9B2 nonnegative0204,LDX0 andenterloopwithoutanextraX<=0204 guard. CPXWORD0200/BCC skips entry0226 read. OtherwiseLDAWORD0226+X/BEQ skipsACCF forzero. NonzeroatX>=0200 invokesACCF. INX twice;freshCPXWORD0204;BCC orBEQ repeats. Unsigned comparisons,upperboundinclusive;0200/0204 reread eachiteration,notcached. CalleeX/globalmutations andwrap/termination remain explicit boundaries.',
    last: 'ADB5 alwaysJSL ACB5 thenRTLADB9. No direct datawrites orlocalpushes inAD92. Three externalrendercalls:A9B2,ACCF,ACB5;no complete effects/return contracts suppliedhere.',
    prefix: 'A9B2 PHB;LDAWORD01FE;LDYWORD01F4;LDX23A0;JSL80:9F49. Historical selected prefix endsatfirstcopycall. PHB isnotmatched locally inthisprefix;fullA9B2 DBR/stack/copy/output source supplied separately inrender-a9b2.json,closedAD92/reset graph inrender-ad92.json.',
  },
  ownership: 'Workspace00 is the existing native argumentworkspace,not a separate reset buffer. Absolute01D8/01DA/01DC/01DE/0200/0204/0212/0226 andlongWRAM2060 table do not yet havea source-verified shared native render-state owner. Do not initializeunknownbytes tozero oridentifytheseoffsetswithgameslots/tasks byshapealone.',
  caller: 'A4DD JSLB0AC;A4E1 JSRBCB2;A4E4 JSRC1A6. NativeA5 returnprofile doesnot makeA4BF usea scriptedreturn;thisdirectcaller hasno returnvalue check. CompleteBCB2 effects andrealrenderreturn must precedethe later destructiveC1A6 task/heap reset.',
  boundaries: ['Full A9B2/AF1F/ACCF/ACB5/ACAF andstructuralAD92/reset source supplied inrender-ad92.json; thisselectedprefix alone stilldoesnotprove fullreturn. Full localA9E1/NMI/channel source supplied inrender-a9e1.json. Full localAA9C/AB2C/maincaller source supplied inrender-aa9c.json. Next bounded implementation:native9F49/9F4D shared decompressor plan,not nativewait acknowledgment.',
    'No nativeA5/97 binding,partialnegative-pathimplementation,renderacknowledgement orautomaticreset. Unknownsources andlate renderboundaries must retain live owners ineventualatomic hostplans. Hardware/interrupt/DMA/scene/finalA4BFreturn remainopen.'],
};
await writeFile('analysis/motion-reset-bcb2.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/motion-reset-bcb2.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; LocalBCB2/BE5B/FA3E71 plusAD9240 bytes;A9B2 prefix14 andcaller10 separate.\n; E0M0X0,D0;post-render modes/DBR/stack assumed,notproved. NoCPU orrenderexecution.\n\n` + blocks.map(formatBlock).join('\n'));
console.log('BCB2/BE5B/FA3E71 bytes andAD9240 locally complete;historicalA9B2 prefix14/caller10/nativeA5/97 pinned. Closed structural graph supplied separately; next native9F49 plan.');
