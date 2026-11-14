import {readFile,writeFile} from 'node:fs/promises';
import {inspectRom,cpuLabel} from './rom.mjs';
import {formatBlock} from './disassemble.mjs';
import {proveRenderText9178Source} from './render-menu-source.mjs';
import {describeRenderDialogBlock as describe} from './render-dialog-source.mjs';
import {verifyMenuSourceReports} from './render-menu-source-reports.mjs';
import {proveRender9178TaskSources} from './render-9178-task-source.mjs';

const {bytes,metadata}=inspectRom(await readFile(process.argv[2]??'Shadowrun (E).smc'));
if(metadata.rom_sha256!=='91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690')throw Error('Wrong European ROM revision');
const {roots, dependencies, map, reused, proof, helperProof, excerpts} = proveRenderText9178Source(bytes);
await verifyMenuSourceReports(dependencies.filter(d => d.report !== 'analysis/render-a6a5.json'), metadata.rom_sha256);
// C34A and C1CA results come from the ROM directly; their reports stay provenance only.
const {append,visit}=proveRender9178TaskSources(bytes);
const gate=JSON.parse(await readFile('analysis/motion-gate-8000.json','utf8'));
if(gate.rom_sha256!==metadata.rom_sha256||!gate.windows.some(w=>w.machine_bytes===describe(excerpts[0]).machine_bytes&&w.entry==='80:C34A'))throw Error('Append excerpt drift');
const report={rom_sha256:metadata.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',
  scope:'Complete local9178/908C source and actual FA67/FAAC/FE69 render graph. C34A fixed-callee source supplied separately; post-PLP C1CA dynamic branch remains source-required. No native binding or full9178/936C/BF3B return promotion; no CPU/device/time/interrupt/scene/frame execution.',
  windows:roots.map(describe),dependencies,excerpts:excerpts.map(describe),
  render_graph:{conditional_graph_closed:true,native_binding:false,proof,actual_termination_proven:false,
    code_bytes:[...map.values()].reduce((n,i)=>n+i.raw.length,0),instructions:map.size,
    condition:'Matched flag bit7 clear; or sentinel return. Full task branch excluded at original91C8; all render callees real.'},
  helper_graph:{closed:true,native_binding:false,proof:helperProof,actual_termination_proven:false},
  full_graph:{closed:false,native_binding:false,unresolved_nested_callees:['80:C1CA'],minimum_protected_stack_bytes:null,
    supplied_source_nested_callees:[{entry:'80:C34A',source:'analysis/render-c34a.json',native_binding:false,
      minimum_protected_stack_bytes:append.proof.minimum_protected_stack_bytes,
      qualification:'Separate complete fixed-callee source under intact code/stack/effective stores. Includes real allocation/slot failure continuations; no whole9178 or dynamicvisit return proof.'}],
    supplied_partial_nested_callees:[{entry:'80:C1CA',source:'analysis/render-c1ca.json',full_graph_closed:false,native_binding:false,
      minimum_protected_stack_bytes:null,minimum_protected_prefix_stack_bytes:visit.frontier.minimum_protected_prefix_stack_bytes,
      qualification:'Complete local visit/readiness/removal and explicit interpreter/native windows. Actual continuation RTS and operand-stack TCS frontier, no assumed dynamic return or whole9178 stack promotion.'}]},
  local:roots.map(b=>({entry:cpuLabel(b.entry),calls:b.instructions.filter(i=>['JSR','JSL'].includes(i.mnemonic)).map(i=>({from:cpuLabel(i.cpu),to:cpuLabel(i.target),kind:i.mnemonic})),
    edges:b.instructions.filter(i=>i.target!==undefined).map(i=>({from:cpuLabel(i.cpu),to:cpuLabel(i.target),kind:i.mnemonic})),returns:b.instructions.filter(i=>i.mnemonic==='RTS').map(i=>cpuLabel(i.cpu))})),
  contract:{entry:'9178 E0M0X0/D0 binary actual DBR; full incomingA storedDP1D/1E.908C actual entry E0M1X0, low nibble only. Source/stack/output disjoint; explicit uninitialized sources remain boundaries.',
    setup:'Fresh WORDDP14->DP00, actualFA67; WORDSTZ02/04, actualFAAC. Explicit transfer/math observations needed for native binding; no hardware result inferred.',
    records:'BYTE mode/Y0004; freshDP11 longpointer on every indexed read. TagF8 goes to91D8; otherwise INY then BYTECMP freshDP1D. Mismatch: WORDread length at currentpointer+Y, AND00FF, DP23 store, TYA/CLC/ADC freshDP23/TAY fullWORD wrap, SEP20 and freshtag. Ignored length highbyte is still a real source; no item/record cap or original pointer fixture inferred.',
    insert:'Match: INY, freshBYTEflag, BYTEPHA; actualBYTE908C maskslow4, advancesY once even forzero, BYTEcounterDP20. Fresh ID bytes with fullX select firstsentinel/largerID or equalduplicate. Duplicate skips all insertion/flagwrites. Insert preserves oldID in HighA throughXBA, stores newID andzeroFlag, shifts freshID/flag bytes viaDP23/24 and HighA until movedFF; terminalflag not shifted. Counts0..15, X/YWORDwrap, fixed7E addresses/crossbank aliases remain fresh; no sorted-list initialization or capacity assumption.',
    savedFlag:'BYTEPLA restores only lowA, actual HighA from908C retained. BYTEASL produces C from originalflagbit7; REP20 thenPHP and WORDPHY save flags/Y across actualFE69. BCC91B7 picks currentY, bit7-set INYs twice toskip actionWORD before text token.',
    text:'Fresh WORDlongpointer+Y->DP02, freshWORDDP14->DP00 and actualFE69. PLY restores original post908CY; PLP restores full originalP including C rather than callee flags. DP11/14/26 and stream bytes remain fresh, not cached across helpers.',
    retry:'F8: REP20, LDAFFFD, CMP freshWORDDP1D. Equal returns; otherwise BNE9178 with AFFFD, overwriting DP1D/1E and repeating real setup.908C changes lowDP1D, retains highDP1E. No original source/loop termination proven.',
    taskTail:'RestoredC1 reads fresh actionWORD viaDP11/Y toX, freshDP26->DP00, realC34A thenC1CA. Separate analysis/render-c34a.json closes actualC2C8/C242 fixed-callee source under8 protected bytes, including unguarded allocator/slot exhaustion continuations and fresh DBR/argument/scratch aliases. No immediate visit inside append. Separate analysis/render-c1ca.json pins full local visit/readiness/removal and actual interpreter/native windows, conditional no-dispatch8 and prefix-only10 stackbytes. Fresh nonzero DBR02B2,X is data-derived code dispatch viaPEAC20A/PHA/RTS to WORD+1; F378 changesD/DBR/operandstack. Existing host scheduler/task profiles are no transitive machine-mode/DBR/stack proof for this caller. Dynamic native/script effects and actual compatible return still need separate source contracts.',
    boundaries:'Only render subset source closed under explicit bit7-clear exclusion; full9178/task/native binding remains open. Actual waits/MMIO, source owners/initialization, original936C/BF3B composition and automatic scene/frame integration separate.'}};
await writeFile('analysis/render-9178.json',JSON.stringify(report,null,2)+'\n');
await writeFile('analysis/render-9178.asm.txt',`; European ROM SHA-256 ${metadata.rom_sha256}\n; Full local9178/908C and actual render source; post-PLP task path explicitly open. No CPU execution.\n\n`+[...roots,...reused,...excerpts].map(formatBlock).join('\n'));
console.log(`9178/908C ${roots.map(b=>describe(b).covered_bytes+'/'+b.instructions.length)}; render ${report.render_graph.code_bytes}/${map.size}; stack ${proof.minimum_protected_stack_bytes}/${helperProof.minimum_protected_stack_bytes}; full task graph OPEN.`);
