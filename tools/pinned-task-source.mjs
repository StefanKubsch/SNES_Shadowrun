import {opcodes} from './disassemble.mjs';
// Static fixed byte-window assertions, not a CPU runner. No data/memory effects.
const sizes={i:1,A:1,imm8:2,dp:2,dpx:2,dpy:2,dix:2,diy:2,di:2,dil:2,dily:2,sr:2,siy:2,abs:3,absx:3,absy:3,ind:3,indx:3,word:3,block:3,rel8:2,rel16:3,long:4,longx:4};
export function assertPinnedTaskSource(map,windows){
  for(const w of windows){const raw=Buffer.from(w.hex,'hex');let offset=0,m=w.initialM??0,x=w.initialX??0;
    if(![m,x,w.finalM??0,w.finalX??0].every(v=>[0,1].includes(v)))throw Error('Pinned task window mode');
    while(offset<raw.length){const pc=w.start+offset,b=raw[offset],{mnemonic,mode}=opcodes[b],length=mode==='immM'?(m?2:3):mode==='immX'?(x?2:3):sizes[mode],i=map.get(pc);
      if(!length||offset+length>raw.length)throw Error('Pinned task window width');const bytes=raw.subarray(offset,offset+length),value=length===1?0:bytes.readUIntLE(1,length-1),next=pc+length;
      const target=mode==='rel8'?next+bytes.readInt8(1):mode==='rel16'?next+bytes.readInt16LE(1):['JSR','JMP'].includes(mnemonic)&&mode==='abs'?(pc&0xFF0000)|value:['JSL','JML'].includes(mnemonic)&&mode==='long'?value:undefined;
      if(!i||i.cpu!==pc||i.opcode!==b||i.mnemonic!==mnemonic||i.mode!==mode||i.length!==length||i.value!==value||i.next!==next||i.target!==target||!i.raw.equals(bytes)
        ||i.state?.e!==0||i.state?.m!==m||i.state?.x!==x)throw Error('Renew pinned task source '+pc.toString(16));
      if(['SEP','REP'].includes(mnemonic)){if(![16,32,48].includes(value))throw Error('Unsupported pinned mode mask');if(value&32)m=Number(mnemonic==='SEP');if(value&16)x=Number(mnemonic==='SEP');}offset+=length;
    }if(m!==(w.finalM??0)||x!==(w.finalX??0))throw Error('Pinned window exit mode');
  }
}
export const taskFetchWindow={start:0x80F389,hex:'B100C829FF00AA7CB4F2'};
export function finiteTaskPaths(map,entry,frontier=0x80F390){const pending=[[entry,[]]],paths=[];
  while(pending.length){const [pc,seen]=pending.pop(),i=map.get(pc);if(!i||seen.includes(pc)||seen.length>100)throw Error('Uncovered/cyclic finite task path');const path=[...seen,pc];
    if(pc===frontier){paths.push(path);continue;}if(i.mnemonic==='JMP'||i.mnemonic==='BRA')pending.push([i.target,path]);else if(i.mode==='rel8')pending.push([i.target,path],[i.next,path]);else pending.push([i.next,path]);}
  return paths;
}
