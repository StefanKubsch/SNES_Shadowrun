import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode, formatBlock } from './disassemble.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const word = { e: 0, m: 0, x: 0 };
const specs = [['overlayAF1F', 0x81AF1F, 0x81B026], ['callerA9B2', 0x81A9D6, 0x81A9E1]];
const blocks = specs.map(([name, entry, end]) => {
  const instructions = [], state = { ...word };
  for (let pc = entry; pc < end;) {
    const i = decode(bytes, pc, state);
    if (i.next > end || ['PLP', 'PLB', 'PLD', 'XCE', 'TCD', 'SED', 'RTI', 'BRK', 'COP'].includes(i.mnemonic) && name === 'overlayAF1F') throw Error(`Renew ${name} source proof`);
    instructions.push(i); pc = i.next;
    if (['REP', 'SEP'].includes(i.mnemonic)) {
      if (i.value & 32) state.m = i.mnemonic === 'SEP' ? 1 : 0;
      if (i.value & 16) state.x = i.mnemonic === 'SEP' ? 1 : 0;
    }
  }
  return { name, entry, initialState: word, instructions, stop: 'Complete local AF1F or selected caller; static source only, no CPU/hardware execution' };
});
const describe = (name, entry, raw, count) => ({ name, entry: cpuLabel(entry), end_exclusive: cpuLabel(entry + raw.length),
  covered_bytes: raw.length, ...(count === undefined ? {} : { instruction_count: count }),
  sha256: createHash('sha256').update(raw).digest('hex'), machine_bytes: raw.toString('hex').toUpperCase() });
const data = (name, entry, end) => describe(name, entry, bytes.subarray(cpuToOffset(entry, bytes.length), cpuToOffset(end, bytes.length)));
const body = blocks[0], map = new Map(body.instructions.map(i => [i.cpu, i]));
const pending = [{ pc: body.entry, m: 0, x: 0, depth: 0 }], seen = new Set(), reached = new Set(), returns = new Set();
while (pending.length) {
  const s = pending.pop(), key = JSON.stringify(s); if (seen.has(key)) continue; seen.add(key);
  const i = map.get(s.pc); if (!i || i.state.m !== s.m || i.state.x !== s.x) throw Error('Uncovered edge or mode');
  reached.add(s.pc); const t = { ...s, pc: i.next };
  if (['JSR', 'JSL', 'JMP', 'JML', 'PHP', 'PHA', 'PHY'].includes(i.mnemonic)) throw Error('Renew local call/stack proof');
  if (i.mnemonic === 'PHX') t.depth += s.x ? 1 : 2;
  if (i.mnemonic === 'PLX') { t.depth -= s.x ? 1 : 2; if (t.depth < 0) throw Error('Stack underflow'); }
  if (['REP', 'SEP'].includes(i.mnemonic)) {
    if (i.value & 32) t.m = i.mnemonic === 'SEP' ? 1 : 0;
    if (i.value & 16) t.x = i.mnemonic === 'SEP' ? 1 : 0;
  }
  if (i.mnemonic === 'RTL') {
    if (s.depth || s.m || s.x) throw Error('Unbalanced return'); returns.add(cpuLabel(s.pc)); continue;
  }
  if (i.mnemonic === 'BRA') t.pc = i.target;
  else if (i.mode === 'rel8') pending.push({ ...t, pc: i.target });
  pending.push(t);
}
if (reached.size !== map.size) throw Error('Unreachable body bytes');
// Selected fixed sequences, no variable cycles or device execution. WORD memory
// accesses add their high-byte cycle; earliest low-byte absolute read has 3 fetches.
const fixedCycles = i => {
  if (['REP', 'SEP'].includes(i.mnemonic)) return 3;
  if (i.mode === 'i') return 2;
  if (['immM', 'immX'].includes(i.mode)) return 3;
  if (i.mode === 'dp') return 4;
  if (['long', 'longx'].includes(i.mode)) return 6;
  throw Error('Renew selected cycle bound');
};
const division = [[0x81AF39, 0x81AF56], [0x81AFB2, 0x81AFC9], [0x81AFE0, 0x81AFEC]].map(([write, read]) => {
  const sequence = body.instructions.filter(i => i.cpu >= map.get(write).next && i.cpu < read);
  const cycles = sequence.reduce((n, i) => n + fixedCycles(i), 0);
  if (cycles + 3 < 16) throw Error('Division wait too short');
  return { divisor_write: cpuLabel(write), first_read: cpuLabel(read), full_cycles_before_read_instruction: cycles,
    fetch_cycles_before_low_byte: 3, minimum_cycles_before_low_byte: cycles + 3 };
});
const table = data('overlayWords', 0x81B026, 0x81B064), pointer = data('valuePointer', 0x8DB8D2, 0x8DB8D4);
const report = {
  rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json', scope: 'Complete AF1F local body263 bytes/103 instructions/no calls, table62, ROM pointer2 and caller11. Structural WORD/stack return, completed division bounds; no native renderer or CPU execution.',
  windows: blocks.map(b => describe(b.name, b.entry, Buffer.concat(b.instructions.map(i => i.raw)), b.instructions.length)),
  code_bytes: 263, caller_bytes: 11, table, pointer,
  graph: { reachable_instructions: reached.size, edges: body.instructions.filter(i => i.target !== undefined).map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })),
    return_sites: [...returns].sort(), calls: 0, return_mode: 'E0M0X0,DBR/D/decimal unchanged; intact PHX/PLX pair, no local leaked stack bytes', actual_memory_termination_proven: false },
  entry: 'Explicit E0/M0/X0,D0000,binary arithmetic, DBR80 from A9B2 and real WRAM/register/source coverage, valid disjoint stack. Device mapping and uninterrupted division results are required; no hardware execution.',
  gates: { first: 'LDA WORD DBR:1D61;BNE AF25,elseRTL AF24. Zero reads no2DE6 andwrites nothing;A0,N0/Z1,X/Y/Carry/V preserved.',
    second: 'LDA WORD7E2DE6;BMI AF24. Negative actualWORD returns asA,N1/Z0,X/Y/Carry/V preserved;no writes andno3C00 read. Nonnegative includingzero reachesactivebody. 1D61 is shared MotionData word, not a new flag copy.' },
  division: { manufacturer_sources: ['https://gamingdoc.org/wp-content/uploads/2021/02/book1.pdf#page=82', 'https://www.westerndesigncenter.com/wdc/documentation/w65c816s.pdf'],
    contract: 'Nintendo BookI printed2-15-1: unsigned16/8 quotient4214/4215,remainder4216/4217 after16 machinecycles. All three divisors areBYTE14,notWORD. WDC table5-7/notes yield local completed-read bounds, not hardware confirmation.',
    completed_read_bounds: division,
    first: 'Read actualWORD7E3C00,AND00FF ->WORD4204. SEP20/LDA14/STA4206/REP20. Three fixed WORDwrites andLDX14 beforeLDYWORD4214. Later freshWORD4216 afterloop;do not cache remainder across unknown aliases/interference.',
    second: 'FreshWORD7E3C00/AND00FF ->WORD4204,repeatBYTE14 divisor. Then readROMWORD8DB8D2=33DC;TAX;actualWORD7E0002+X=7E33DE,AND00FF ->sharedWORDA8. CLC/ADC13 givesmaskedvalue+19. LDY4214/STYA2;LDY4216/STYA5;BEQ usesLDY flags afterSTY,notA. OnlynonzeroA5 doesSEC/SBC0A.',
    third: 'STAWORD4204 ofvalue+19 orvalue+9;repeatBYTE14 divisor. REP/NOP/LDX14/SEC/LDADPA2 thenSBCWORD4214. WrappedWORDdifference,BEQ skips middlefill;no signed orcapacity guard. Thirdremainder4216 readfresh later.' },
  writes: { fixed: 'Before first quotientloop,WORD6C04->7E241C,6C07->7E245C,EC04->7E249C. These overlap A9B2 converted buffer23A0..2ADF; no separate render copy.',
    first_loop: 'X14,Y=firstquotient;enter body unconditionally:WORD2C05->7E2406+X,2C10->7E2446+X,AC05->7E2486+X;DEX twice/DEY/BNE. Quotient0 nominally65536 bodies,notzero;X wraps16 bits andlong indexedaddresses maycross7E to7F. No inferred clamp.',
    cap: 'Read firstremainder4216. Nonzero writes2C06/2C15/AC06 atcurrentX;zero writes2C04/2C07/AC04. Writes allWORD, three rows ordered. Second3C00 read follows thesewrites andmustsee aliases.',
    middle: 'Afterthirdquotient, count=(sharedA2-read4214)&FFFF. Zero skips loop,elseY=count writesWORD2C08 to7E2446+X thenDEX twice/DEY/BNE. NegativeWORDdifference is a large unsigned countdown;no sign gate.',
    last: 'LDYsharedA5/BEQ B012. Ifnonzero,LDAsharedA8/CMP0B/BCS B016;below11 loadsfresh4216,CLC/ADC0B. IfA5zero,LDAsharedA8/BEQ B025 skipslastwrite onlywhenA8zero;elsefresh4216. Selectedvalue ASL ->tableoffset;PHX/TAX/readlongWORD81B026+X/PLX preservescurrentdestinationX;STAWORD7E2446+X. Nominalindex0..30 requires stablecompleted divisions andintact sharedscratch;31 tableWORDs pinned, no capacityguard inROM.',
    scratch: 'ActualWORDSTAA8,STYA2,STYA5 share the existing D9/motion byte owner. No A8-sign interpretation or cache; source reads follow earlier planned writes. Unknowns and latealias/coverage boundaries require whole-plan preflight before eventual live writes.' },
  returns: 'BothRTL sites preserve E/M/X widths,DBR,D,decimal. Inactive X/Y preserved;active X follows real loop decrements, Y can be second remainder fromA5. PHX/PLX restores onlytemporary table index. A/Carry/V/N/Z depend on actual path;no generic stable register/flag result. Structural returns do not prove termination or valid memory.',
  boundaries: ['ACB5/ACAF/ACCF andclosedstructuralAD92/reset graphs supplied inrender-ad92.json. Full localA9E1/NMI/channel source supplied inrender-a9e1.json. Full localAA9C/AB2C/maincaller source supplied inrender-aa9c.json. Native9F49/A9B2/AF1F/AA9C atomic data plans supplied, with explicit request-only IO and stable arithmetic contracts. Native A9E1 ordered request plan supplied with fresh parameters, clear ordering and explicit213A metadata read contract. Native AB2C atomic initializer supplied with original channel0 ROM assets, shared AA9C/A9E1 byte view and request-only IO. Native8949 atomic ordered request plan supplied with both early gates, fresh parameters and paired scroll byte writes. Full local999A/caller-prefix source supplied inrender-999a.json, including WORDcountwrap, five-ASL carry, BYTEtail and shared aliases. Native999A atomic ordered request plan supplied with fresh gates/records/tail, WORDcountwrap, five-ASL carry, shared aliases and request-only IO. Full local80C4/requestwriter source supplied inrender-80c4.json. Native80C4 atomic request plan supplied separately with fresh indexedBYTE/unindexedsize, fullX/bankcarry, six stores, shared aliases and lateclear. Full localA919/listwriter source supplied inrender-a919.json. NativeA919 atomic request plan supplied separately with signedBPL/countwrap, bothshiftCarries, fresh records, fullWORDbankcarry and shared aliases. Full localA958 and selected outputwriter source supplied inrender-a958.json. Native atomicA958 request plan supplied separately with fresh tables, DBR-independentDP82, retained highA, latecursorstore and shared view/budget/stack. Full localA98E and selected bufferwriter/setup source supplied inrender-a98e.json. Native atomicA98E request plan supplied separately with four ordered requests, lateWORDgateclear, retained A8004/BYTEflags and shared provider/budget/stack. Full local8FBA/reset/setup/selectedparameter source supplied inrender-8fba.json. Native atomic8FBA request plan supplied separately with signedgate, DBR-independentDP, WORDpointerwrap C/V, seven ordered requests, lateFFFF marker and shared view/budget/twoJSRbytes. Full local9E0B/selectedconsumer source supplied inrender-9e0b.json. Native atomic9E0B plan supplied separately with explicit chronological WORDsamples, bit0 polling, capturedWORD/NZ, late01CA store and shared provider/budget/twoJSRbytes. Full localC06B/BC1A/BC36/selector/getter source and originalROM384 supplied inrender-c06b.json. Native atomicC06B plan supplied separately with two ordered420B requests, lateWORDclear, unconditionalOAMtail, BYTEflags/highA and shared provider/budget/twoJSRbytes. Full localB0D1/B0AC/B0BD/B0C7 source and selectedsetup/callbacktail supplied inrender-b0d1.json. Native atomicB0D1 plan supplied separately with WORDcountdownwrap, freshgate reload, BYTEbrightness/highA/NZ/C and shared provider/budget/threeJSLbytes. Full local9E1A63/26 and F00729/15 source supplied inrender-9e1a.json: normalWORDreturn or explicitE1M1X1 resetterminal80E382, zeroexternalreturn assumptions; normal9E1A and standaloneF007 manualatomicplans supplied, complete reset held at source-required startup boundary. Complete localmain96AB72/25 chronology with17 explicitcallee-return boundaries and fullB0A1/F290/F298 nativewidth source supplied inrender-input-flow.json; both manualatomicwrappers supplied, counterchange isnotcallbackcompletion. Full localpostwait81:8877/886A/88A2/88E1 source185/82 andmanualatomic8877 plan supplied inrender-8877; original80D3D1 BYTEtable512 separate. Native8076 atomic updateplan supplied inrender-8076-native with freshWORD gates/progress/direction/index/count/table, ASLcarry, pointerwrap and shared provider/budget/threeJSLbytes. Full localBE6D206/85 andBCBE413/190 with alltransitive localcallees supplied inrender-be6d.json: closed2835/1318 WORD/DBR graph,32 protectedstackbytes,zeroexternalreturn assumptions; nativeBE6D/BCBE manual atomic composition supplied separately; actualtermination stillopen. Native81:AF04/80:FADD/FB2A manual atomic bitreader/textwidth plans supplied inrender-fadd-native with freshBYTEaliases, hiddenhighA, shared provider/budget and5/7 protectedstackbytes. Native80:FA67/81:ACBD manual atomic request/wait plans supplied inrender-fa67-native with fullWORD arithmetic/aliases, explicit chronological externalobservations and5/3 protectedstackbytes; no transfercompletion claim. Native81:ACB5/ACAF manual atomic request/wait plans supplied inrender-acb5-native with freshWORD01F8, preservedC/V/X/Y, shared observationprovider/budget and6/3 protectedstackbytes; no transfercompletion claim. Native81:ACCF manual atomic entry plan supplied inrender-accf-native with originalWORD do-loops, fresh parameter/output aliases, evolvingA/D2, inclusivewrap and6 protectedstackbytes; full24bit bankcarry follows WDC3.5/7.3. Native80:F963 manual atomic allocation plan supplied inrender-f963-native with fresh2134 reads, ordered BYTE211B/211C requests, shared FA67/ACCF/ACB5, one provider/budget/commit and8 protectedstackbytes. Native80:FE69/FB39 manual atomic text plans supplied inrender-text-compose-native with dictionarydecode, BYTE/WORD widths, styles/glyphs/masks, global arithmetic/wait chronology, one provider/budget/commit and12/9 protectedstackbytes. Native81:AD92 manual atomic composition supplied inrender-ad92-native with fresh caller/table/output bytes, shared A9B2/ACCF/ACB5 provider, cumulative output/work budgets, chronological WORDwait observations and22 protectedstackbytes. Native80:BE6D/BCBE manual atomic composition supplied inrender-be6d-native with original held/selection/geometry, full BE5B/FA3E/AD92 release, width/allocation/text calls, global arithmetic/wait observations, shared provider/output/work budgets and32/30 protectedstackbytes. BF3B local source and closedFEC1 native prerequisite supplied inrender-bf3b/render-fec1-native; A6A5 local source and nativeFAAC supplied inrender-a6a5/render-faac-native; Transitiveaudio sources andselectedmenu8-byte proof supplied inrender-audio; nativeC416 supplied separately. nativeC46E all-WORD-sound/nonzero-voice supplied inrender-c46e-native with14/8-byte conditional proofs; nativeF03A BYTE pair prerequisite supplied inrender-f03a-native; nativeF122/F1E8 WORD senders supplied inrender-f122-native; nativeF130/F100 supplied inrender-f130-native; nativeC46E all-WORD-sound/nonzero-voice supplied with14/8-byte conditional proofs; Current work is tracked in docs/PORTIERUNGSSTAND.json. Full localC1521027/419 eleven-callee graph supplied inrender-c152.json with zeroexternalreturn assumptions; manual atomicC152 supplied with six protectedstackbytes, one chronological provider/budget/commit and fresh orderedtail; realwait/transfer lifecycle, nativeA5/97 and actualreset/renderreturn remain open.',
    'A9B2/AF1F local callgraph closes with existing9F49 source; no CPU/device execution, arbitraryalias/termination proof, originalscene/puffer initialization, native renderer orautomatic frame/transition binding.'],
};
await writeFile('analysis/render-af1f.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-af1f.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; AF1F263 code bytes;table62/pointer2/caller11 separate.\n; Both local returns WORD/DBR/stack checked; memory/termination not proved. No CPU/device execution.\n\n` + blocks.map(formatBlock).join('\n'));
console.log(`AF1F263 bytes/103 instructions/no calls; table62/pointer2/caller11 pinned. Division read minima:${division.map(d => d.minimum_cycles_before_low_byte).join('/')}. Native data plan supplied; AA9C loader plan supplied; next A9E1 request plan.`);
