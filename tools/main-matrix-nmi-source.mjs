import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
// TCS graphs require explicit source lemmas; the generic typed-stack prover
// cannot treat queue pulls as ordinary saved-register or return-frame pulls.
export function proveMatrixNmi(map,s){
  assertPinnedTaskSource(map,s.windows);
  if(s.name==='bec3'){
    const proof=proveWordStack(map,s.entry,'RTL',{measureStack:true,externalReturns:new Map(s.externalReturns)});
    if(map.size!==102||proof.reachable_instructions!==102||proof.minimum_protected_stack_bytes!==3
      ||JSON.stringify(proof.returns)!==JSON.stringify([{at:'81:BFD3',m:0,x:0,dbr:'entry'}]))throw Error('BEC3 source drift');
    return proof;
  }
  const at=(pc,op,value)=>{const i=map.get(pc);if(i?.mnemonic!==op||(value!==undefined&&i.value!==value))throw Error('NMI stack lemma drift');};
  if(s.name==='b1e2'){
    at(0x81B1E2,'PHP');at(0x81B1E3,'REP',0x20);at(0x81B1E5,'SEP',0x10);
    at(0x81B1EC,'TSC');at(0x81B1ED,'STA',0x32);at(0x81B1EF,'LDA',0x113D);at(0x81B1F2,'TCS');
    for(const [pc,op]of [[0x81B1FD,'PLA'],[0x81B203,'PLX'],[0x81B207,'PLX'],[0x81B20B,'PLA'],[0x81B20F,'PLA']])at(pc,op);
    at(0x81B1FE,'BEQ',0x18);at(0x81B216,'BRA',0xE5);at(0x81B218,'LDA',0x32);at(0x81B21A,'TCS');
    at(0x81B226,'PLP');at(0x81B227,'RTS');
    if(map.size!==34)throw Error('B1E2 instruction drift');
    return {entry:'81:B1E2',stack_lemma:'PHP protects caller P below JSR; DP32 saves S after PHP; S=113D; each nonzero size pulls 2+1+1+2+2 bytes; zero size pulls 2; fresh DP32 restores S before PLP/RTS',
      protected_caller_bytes:3,queue_start:0x113E,queue_record_bytes:8,global_stack_minimum:null};
  }
  if(s.name!=='nmi'||map.size!==32)throw Error('NMI instruction drift');
  at(0x00C112,'REP',0x30);at(0x00C118,'LDA',0x4210);at(0x00C11B,'TSC');at(0x00C11C,'STA',0x7E1C7A);
  at(0x00C120,'LDA',0x1CBB);at(0x00C123,'TCS');at(0x00C12C,'PHD');at(0x00C130,'TCD');at(0x00C131,'PHK');
  at(0x00C133,'INC',0x1C76);at(0x00C137,'JSL',0x80C14F);at(0x80C14F,'JML',0x6E);
  at(0x00C13B,'PLP');at(0x00C13C,'PLD');at(0x00C145,'LDA',0x7E1C7A);at(0x00C149,'TCS');at(0x00C14E,'RTI');
  return {entry:'00:C112',stack_lemma:'hardware PB/PC/P frame remains on interrupted S; saved A/X/Y/DBR/D use 9 bytes below 1CBB; PHP plus JSL use 4; JML adds no frame; PLP/PLD/PLB/PLY/PLX/PLA restore, fresh 1C7A restores interrupted S before RTI',
    callback_s:0x1CAE,callback_dbr:0,callback_d:0,counter_before_callback:true,global_stack_minimum:null};
}
export const matrixNmiSpecs=[
  {
    "name": "bec3",
    "entry": 8502979,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8502979,
        "hex": "228BED81AD34174A8D3817AD36174A8D3A17E220A9008D21219C22219C2221A9E08D2221A9018D2221A9058D2121A9E08D2221A9038D2221AD4E138D12218F54017FAD4F138D12218F55017FAD34178D0D21AD35178D0D21AD36178D0E21AD37178D0E21AD38178D0F21AD39178D0F21AD3A178D1021AD3B178D1021C220AF761C7E290F00D023AE3E13E220A9098D2121BFD4BF818D2221BFD5BF818D2221C2208A1A1A2903008D3E13AF761C7E290700D023AE4013E220A90D8D2121BFD4BF818D2221BFD5BF818D2221C2208A1A1A2903008D4013AD4E131869E80029F8000A0A0900088D1621A21F009C1821CA10FAAD52138D16219C182120E2B1AD50138D52138D1621A9022C8D18212290F2806B"
      }
    ],
    "externalReturns": [
      [
        8514955,
        "RTL"
      ],
      [
        8499682,
        "RTS"
      ],
      [
        8450704,
        "RTL"
      ]
    ]
  },
  {
    "name": "b1e2",
    "entry": 8499682,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8499682,
        "finalX": 1,
        "hex": "08C220E210AD4A17F03A3B8532A93D111BA0018C0043A2188E014368F0188D0543FA8E1521FA8E0443688D0243688D16218C0B4280E5A5321B9C48179C4A17A2008E0B422860"
      }
    ]
  },
  {
    "name": "nmi",
    "entry": 49426,
    "rootReturn": "RTI",
    "windows": [
      {
        "start": 49426,
        "hex": "C2308F781C7EAD10423B8F7A1C7EA9BB1C1BAF781C7E48DA5A8B0BA900005B4BABEE761C08224FC180282BAB7AFA688F781C7EAF7A1C7E1BAF781C7E40"
      },
      {
        "start": 8438095,
        "hex": "DC6E00"
      }
    ]
  }
];
export const matrixNmiTables=[
  {
    "start": 65514,
    "hex": "12C1"
  },
  {
    "start": 8503252,
    "hex": "0000E001"
  }
];
