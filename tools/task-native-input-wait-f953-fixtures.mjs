import {taskLeafFixture} from './task-native-leaf-fixtures.mjs';import {sampleWord} from './render-f130-fixtures.mjs';
import {nativeA3Anchors} from './task-native-input-wait-opcode-source.mjs';import {taskOpcodeSpecs} from './task-opcode-specs.mjs';
const records=vs=>Object.freeze(vs.map(Object.freeze));
export function taskInputWaitFixture(entry=0x80F953,{previous=0,controls=[0x40],polls=[6],baseline=5,...patch}={}){
 const f=taskLeafFixture(entry,{...patch,savedOuterS:patch.savedOuterS??patch.s??0x6FF}),base=f.context.bank*65536;
 for(const [a,v]of [[0x7E1C76,baseline],[base+0x1CA,0],[base+0x1CC,previous],[base+0x1CE,0]])sampleWord(f.data,a,v);
 return {...f,waitMode:'record-observations',waitObservations:records(polls.map(value=>({pc:0x81B0A5,address:0x7E1C76,width:2,value}))),
  inputMode:'record-observations',inputObservations:records(controls.map(value=>({pc:0x809E1A,address:base+0x1CA,width:2,value}))),maxOutputBytes:4096};
}
export function taskNativeInputWaitOpcodeFixture(patch={}){
 const f=taskInputWaitFixture(0x80F390,patch),word=(a,v)=>sampleWord(f.data,a,v),frame=0x600;
 for(const s of taskOpcodeSpecs)word(0x80F2B4+s.opcode,s.target&65535);
 for(const anchor of nativeA3Anchors)f.data.seed(anchor.start,Buffer.from(anchor.hex,'hex'));
 for(const [o,v]of [[0,0x1200],[1,0x8012],[3,4],[7,0x3F0],[9,0xA3]])word(frame+o,v);
 word(0x800250,2);word(0x800254,frame);word(0x8001F2,f.context.s);word(0x3F1,0xBEEF);
 f.data.seed(0x801204,[0xA3,0x14,0xA5]);
 return {...f,entry:0x80F390,context:Object.freeze({...f.context,a:0xABCD,x:0x58,y:4,s:0x3F0,d:frame,pc:0xF390}),maxHandlers:1};
}
