import {taskRenderComposeFixture} from './task-native-render-compose-fixtures.mjs';import {sampleWord} from './render-f130-fixtures.mjs';
import {nativeA7Anchors} from './task-native-clear-opcode-source.mjs';import {taskOpcodeSpecs} from './task-opcode-specs.mjs';
export function taskClearFixture(entry=0x80FF79,{slots=[65535,65535,65535,65535],...inputs}={}){
 const f=taskRenderComposeFixture('FA3E',{wait:Array(slots.filter(v=>!(v&32768)).length).fill(0),...inputs});
 for(const [n,value] of slots.entries())sampleWord(f.data,0x7E0216+2*n,value);
 sampleWord(f.data,((f.context.s+1)&65535),0xC20A);
 return {...f,entry,context:Object.freeze({...f.context,pc:entry&65535,programBank:entry>>>16})};
}
export function taskNativeClearOpcodeFixture({frame=0x600,...inputs}={}){
 const f=taskClearFixture(0x80F390,inputs),word=(a,v)=>sampleWord(f.data,a,v);
 for(const s of taskOpcodeSpecs)word(0x80F2B4+s.opcode,s.target&65535);
 for(const a of nativeA7Anchors)f.data.seed(a.start,Buffer.from(a.hex,'hex'));
 word(frame,0x1200);word(frame+1,0x8012);word(frame+3,4);word(frame+7,0x3F0);word(frame+9,0xA7);
 word(0x800250,2);word(0x800254,frame);word(0x8001F2,f.context.s);
 word(0x3F1,0xBEEF);f.data.seed(0x801204,[0xA7,0x14,0xA5]);
 return {...f,context:Object.freeze({...f.context,a:0xABCD,x:0x58,y:4,s:0x3F0,d:frame,pc:0xF390})};
}
