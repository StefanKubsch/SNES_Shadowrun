import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom } from './rom.mjs';
import { formatBlock } from './disassemble.mjs';
import { proveRender8F3ASource, describeRenderDialogBlock as describe } from './render-dialog-source.mjs';
const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const {root, helper, wait, callers, map, proof, helperProof, raw} = proveRender8F3ASource(bytes);
const input=JSON.parse(await readFile('analysis/render-input-flow.json','utf8'));
if(input.rom_sha256!==metadata.rom_sha256 || JSON.stringify(input.windows.find(w=>w.name===wait.name))!==JSON.stringify(describe(wait))) throw Error('B0A1 drift');
const report={rom_sha256:metadata.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',
  scope:'Complete 8F3A and actual 8EFE/B0A1 transitive source, BYTE/WORD widths, actual DBR and typed stack; original table16 and selected936C callers separate. No CPU/device/time/interrupt/scene/frame execution.',
  windows:[root,helper,wait].map(describe),
  tables:[{name:'transferTable8F87',entry:'80:8F87',covered_bytes:16,sha256:createHash('sha256').update(raw).digest('hex'),machine_bytes:raw.toString('hex').toUpperCase()}],
  full_graph:{closed:true,code_bytes:122,instructions:map.size,proof,native_binding:true,actual_termination_proven:false,
    calls:[{from:'80:8F77',to:'81:B0A1',kind:'JSL'},{from:'80:8F7B',to:'80:8EFE',kind:'JSR'}],
    qualification:'RootJSR2 plus maximum of B0A1 JSL3 or 8EFE JSR2/PHP1/PHA1 needs6 protected bytes. All local calls closed; eleven fixed iterations still require actual counter changes, not proof of NMI/DMA completion.'},
  helper_graph:{closed:true,entry:'80:8EFE',code_bytes:34,instructions:helper.instructions.length,proof:helperProof,native_binding:true,actual_termination_proven:true},
  dependencies:[{report:'analysis/render-input-flow.json',window:describe(wait),native:'proof/render/counter-b0a1.mjs'}],
  callers:callers.map(describe),
  contract:{
    entry:'E0/M0/X0/D0000 binary, actual DBR, six disjoint protected root stackbytes. Incoming A/X overwritten; Y preserved or explicitly unknown. Standalone8EFE needs four bytes and incoming full A/X (hidden high A required).',
    setup:'WORD2222->DBR2123 (including2124), WORDzero->212A/212B, WORD0144->4302/4303. BYTE table copy X000F..0000 from fixedlong80:8F87+X to actualDBR0144+X, descending; X endsFFFF. Table16 is data, not instructions or wholebuffer initialization.',
    publish:'BYTE4300=01,4301=26,4304=7E; fresh BYTE01C4 TSB01 preserves bits1..7 and highbyte01C5 untouched. WORD000F->01C2/01C3. No420B startstore, transfer source execution or automatic callback.',
    loop:'X=0002; actual B0A1 captures fresh fixedlong7E1C76 baseline once per invocation and compares fresh fullWORD observations until unequal; equality including wrap holds. No delta/countcatchup or baseline reload. Then actual8EFE, three WORD INX, CPX0021/BCC. Eleven indices 2,5,8,11,14,17,20,23,26,29,32; finalX0023, not0021. Counter baseline fresh between iterations and global counterPolls chronological.',
    helper:'PHP/SEP20; TXA BYTE lowX; CLC then ADC39 ->0149; TXA then ADCC5 with carry from firstADC ->014F; TXA/EORFF/PHA then ADC3B with secondADC carry ->0148; PLA/CLC then ADCC7 ->014E. Four BYTE stores only in this order. All ADCs wrapBYTE; TXA/EOR/PLA do not clear carry. Hidden highA stays incoming; final lowA=((lowX XOR FF)+C7)&FF. PLP restores whole original P; X/Y/DBR unchanged.',
    return:'A=(last B0A1 saved baseline AND FF00) OR A6 from finalX0020 helper; X0023, Y/DBR/V/I preserved. Final CPX givesC1/N0/Z0, not helperADC flags or baseline comparison. M0/X0/D0. EntryP not wholly restored by root.',
    mapping:'128 systembanks record explicit I/O requests; DBR7E/7F setup addresses are physical WRAM and require byte windows; remaining126 banks unsupported. Low metadata/table destinations use actualDBR; ROM source fixed80 and counter fixed7E. Original DMA bank7E versus actualDBR data ownership remains separate.',
    atomicity:'Shared fresh provider, native output budget, work budget, global wait observations and one outer commit. External counter writes do not count native output. Systembank native output63 bytes; WRAMbank72. Eleven immediately changed polls need118 work accesses. Missing source/window/stack/observation or late budget failure publishes no effects.',
  },
  native:{module:'proof/render/transfer-8f3a.mjs',helper_module:'proof/render/window-8efe.mjs'},
  next:'Current next block and open boundaries: docs/PORTIERUNGSSTAND.json.'};
await writeFile('analysis/render-8f3a.json',JSON.stringify(report,null,2)+'\n');
await writeFile('analysis/render-8f3a.asm.txt',`; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete8F3A/8EFE/B0A1. Table16 data separate; actualcounter/NMI/DMA termination unproved.\n\n`+[root,helper,wait,...callers].map(formatBlock).join('\n')+`\n; Table80:8F87 (16 data bytes): ${raw.toString('hex').toUpperCase()}\n`);
console.log(`8F3A77/${root.instructions.length}; graph122/${map.size}; stack${proof.minimum_protected_stack_bytes}; helper stack${helperProof.minimum_protected_stack_bytes}.`);
