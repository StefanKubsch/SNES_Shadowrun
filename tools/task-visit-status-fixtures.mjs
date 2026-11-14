import {taskVisitOpcodesFixture} from './task-visit-opcodes-fixtures.mjs';
import {visitWord as word} from './task-visit-fixtures.mjs';
import {taskOpcodeSpecs} from './task-opcode-specs.mjs';
export const statusOpcodeSpecs=taskOpcodeSpecs.filter(s=>['status-return','trap-prefix'].includes(s.family));
// Synthetic current-S observation; source-written rawC20A exists at this S.
export function taskVisitStatusFixture(opcode=6,entry=0x80C1CA){
 const f=taskVisitOpcodesFixture('end',entry),spec=statusOpcodeSpecs.find(s=>s.opcode===opcode);
 if(!spec)throw Error('Unknown synthetic status slot');
 word(f,0x3DD,entry===0x80C1CA?0x6F9:0x6FD);
 word(f,0x801204,0xA500|opcode);word(f,0x80F2B4+opcode,spec.target&65535);
 f.data.seed(0x8001BE,[0xFF]);f.data.seed(0x8001C0,[0xFF]);
 return f;
}
