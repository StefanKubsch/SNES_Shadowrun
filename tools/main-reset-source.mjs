import {decodeTaskWindows} from './task-partial-source.mjs';
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
// The generic window decoder supplies M/X lengths. E is pinned separately at
// the two source-proved exchanges; no instruction runs in the product.
export function decodeResetSource(bytes,windows){const {map}=decodeTaskWindows(bytes,windows);assertPinnedTaskSource(map,windows);
  for(const [pc,i]of map){const at=pc&65535,e=(at>=0xE382&&at<=0xE39E)||pc===0x809E55?1:0;map.set(pc,{...i,state:{...i.state,e}});}return map;
}
export function proveResetSource(map,entry){
  const software=entry===0x809E3D,pending=[{pc:entry,e:software?0:1,m:software?0:1,x:software?0:1,c:null,a:null,d:0,s:'entry',bank:'entry',stack:[]}],seen=new Set(),visited=new Set(),terminals=[];
  while(pending.length){const state=pending.pop(),key=JSON.stringify(state);if(seen.has(key))continue;seen.add(key);const i=map.get(state.pc);if(!i)throw Error('Uncovered reset edge');
    if(i.state.e!==state.e||i.state.m!==state.m||i.state.x!==state.x)throw Error('Reset source mode drift');visited.add(state.pc);
    const next={...state,pc:i.next,stack:[...state.stack]};
    switch(i.mnemonic){
      case 'CLC':next.c=0;break;case 'SEC':next.c=1;break;
      case 'XCE':if(state.c===null)throw Error('Unproved reset XCE');next.e=state.c;next.c=state.e;if(next.e){next.m=1;next.x=1;next.s='page01';}break;
      case 'SEP':case 'REP':{const bit=Number(i.mnemonic==='SEP');if(i.value&32)next.m=bit;if(i.value&16)next.x=bit;break;}
      case 'LDA':if(i.mode!=='immM')throw Error('Unproved reset load');next.a=state.m?null:i.value;break;
      case 'PEA':next.stack.push(i.value>>>8,i.value&255);break;
      case 'PLB':if(!next.stack.length)throw Error('Unproved reset PLB');next.bank=next.stack.pop();break;
      case 'JSL':if(i.target!==0x81F007||state.e||state.m||state.x||state.bank!==0x80)throw Error('Unproved reset helper');next.a=null;break;
      case 'TCD':if(state.a!==0)throw Error('Unproved reset D');next.d=0;break;
      case 'TCS':if(state.a!==0x13F||next.stack.length)throw Error('Unproved reset S');next.s=state.a;break;
      case 'JML':if(i.target===0x80A133){
        if(state.e||state.m||state.x||state.c!==1||state.d!==0||state.s!==0x13F||state.bank!==0x80||next.stack.length)throw Error('Reset terminal drift');
        terminals.push({at:i.cpu,target:i.target,e:state.e,m:state.m,x:state.x,d:state.d,s:state.s,bank:state.bank});continue;
      }if(i.cpu!==0x809E55||i.target!==0x80E382||state.e!==1)throw Error('Unproved reset tail');next.pc=i.target;break;
      default:if(!['SEI','CLD','LDX','STZ','STA','DEX','BPL'].includes(i.mnemonic))throw Error('Unproved reset instruction');
    }
    if(i.mode==='rel8')pending.push({...next,pc:i.target,stack:[...next.stack]});pending.push(next);
  }
  if(terminals.length!==1||visited.size!==map.size)throw Error('Incomplete reset graph');
  return {entry,instructions:visited.size,terminals,externalReturns:software?[0x81F007]:[],qualification:'Pinned source control/mode/register/stack-reset contract with explicit entry E/M/X/D, separately proved F007, intact pre-reset stack and no interrupt interference; not hardware timing or reset-state invention.'};
}
export const resetWindows=[
  {
    "start": 8446850,
    "hex": "789C00429C0C429C0B429C40219C41219C42219C4321A9808D002118FB",
    "initialM": 1,
    "initialX": 1,
    "finalM": 1,
    "finalX": 1
  },
  {
    "start": 8446879,
    "hex": "D8F48080ABABA2029E01219E1521CA10F7A2079E05219E0D219E0D21CA10F49C1A219C2121A9019C1B218D1B219C1C219C1C219C1D219C1D219C1E218D1E219C1F219C1F219C20219C20219C3321A20E9E23219E0042CA10F7A9FF8D0142A9E08D3221A9308D3021C230",
    "initialM": 1,
    "initialX": 1
  },
  {
    "start": 8446985,
    "hex": "A900005BA93F011BA901008D0D425C33A180"
  }
];
export const coldResetWindows=[
  {
    "start": 58242,
    "hex": "789C00429C0C429C0B429C40219C41219C42219C4321A9808D002118FB",
    "initialM": 1,
    "initialX": 1,
    "finalM": 1,
    "finalX": 1
  },
  {
    "start": 58271,
    "hex": "D8F48080ABABA2029E01219E1521CA10F7A2079E05219E0D219E0D21CA10F49C1A219C2121A9019C1B218D1B219C1C219C1C219C1D219C1D219C1E218D1E219C1F219C1F219C20219C20219C3321A20E9E23219E0042CA10F7A9FF8D0142A9E08D3221A9308D3021C230",
    "initialM": 1,
    "initialX": 1
  },
  {
    "start": 58377,
    "hex": "A900005BA93F011BA901008D0D425C33A180"
  }
];
export const softwareResetWindows=[
  {
    "start": 8429117,
    "hex": "F48080ABABA900002207F081F48080ABABE2309C004238FB",
    "finalM": 1,
    "finalX": 1
  },
  {
    "start": 8429141,
    "hex": "5C82E380",
    "initialM": 1,
    "initialX": 1,
    "finalM": 1,
    "finalX": 1
  }
];
export const resetVector={"start":65532,"hex":"82E3"};
