import {taskFixture} from './task-native-fixtures.mjs';
import {taskOpcodeSpecs} from './task-opcode-specs.mjs';
import {taskArithmeticFixture} from './task-arithmetic-native-fixtures.mjs';
import {taskControlFixture} from './task-control-native-fixtures.mjs';
import {taskPrefixFixture} from './task-prefix-native-fixtures.mjs';
import {taskStatusReturnFixture} from './task-status-return-fixtures.mjs';
export function taskOpcodeFixture(spec=null,patch={}){
  const jump=spec?.family.startsWith('jump'),state=spec?.family.startsWith('state-');
  let f=taskFixture(0x80F390,{top:2,opcodeWord:jump?6:state?0x0310:0xA514,...patch});
  if(spec?.family.startsWith('multiply-')||spec?.family.startsWith('divide-'))f=taskArithmeticFixture(spec.target,{top:2,...patch});
  if(['call-local','return-local'].includes(spec?.family))f=taskControlFixture(spec.target,patch);
  if(['script-arguments','native-arguments'].includes(spec?.family))f=taskPrefixFixture(spec.target,patch);
  if(spec?.family.startsWith('remainder-'))f=taskFixture(spec.target,{top:0x4000,left:2,...patch});
  if(spec?.family==='status-return')f=taskStatusReturnFixture(patch);
  if(jump)f.data.seed(0x801206,[0x14,0xA5]);
  if(state)f.data.seed(0x7E0310,[0xCD,0xAB]);
  for(const slot of taskOpcodeSpecs)f.data.seed(0x80F2B4+slot.opcode,[slot.target&255,(slot.target>>>8)&255]);
  f.context=Object.freeze({...f.context,x:spec?.opcode??0xC0,pc:0xF390});
  return {...f,entry:0x80F390,maxHandlers:1};
}
