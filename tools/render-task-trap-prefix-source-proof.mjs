import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {cpuLabel} from './rom.mjs';
export const entries=[0x80F4BB,0x80F774,0x80F7B6,0x80F7F8,0x80F83D];
export const spec={name:'trap-prefix',classification:'original-JMP-before-unproved-F927',
  windows:entries.map(start=>({start,hex:'4C27F9'})),
  host_boundary:'Only the original JMP is bound; F927, fallthrough bytes and subsequent Task return remain unproved.'};
export function prove(map){
  assertPinnedTaskSource(map,spec.windows);
  return entries.map(entry=>{
    const i=map.get(entry);
    if(i.mnemonic!=='JMP'||i.mode!=='abs'||i.target!==0x80F927)throw Error('Original F927 boundary JMP required');
    return {entry:cpuLabel(entry),native_binding:false,local_source_complete:true,
      source_closed_to_dispatch:false,external_return_assumptions:0,visited:[cpuLabel(entry)],
      frontier:{at:'80:F927',before:'unproved target'},operand_s_delta:0,outer_return_frames_added:0,
      output_mode:{e:0,m:0,x:0},effects:'PC=F927 only. All A/X/Y/S/D/DBR/status preserved; no reads, writes or return frame beyond opcode table. Target not executed.'};
  });
}
