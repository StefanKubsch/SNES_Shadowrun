import {readFile} from 'node:fs/promises';
import {taskFixture} from './task-native-fixtures.mjs';
export const scriptOpcodeSpecs=Object.freeze(JSON.parse(await readFile(new URL('./script-opcode-specs.json',import.meta.url))));
export function taskScriptOpcodeFixture(spec=scriptOpcodeSpecs[0]){
 const f=taskFixture(0x80F390,{savedOuterS:0x6FF,outerWord:0xC20A,writeWindows:[[0x7E0000,0x7FFFFF]]});
 const word=(a,v)=>f.data.seed(a,[v&255,v>>>8]);
 f.context=Object.freeze({...f.context,x:0x52});word(0x80F306,0xF460);word(0x801204,spec.id);word(0x801206,0xA514);
 word(0x82E9CC+spec.id,spec.argument);word(0x82DB28+spec.id,spec.bank);word(0x82DED1+2*spec.id,spec.pointer);
 f.data.seed(((spec.bank&255)<<16)|spec.pointer,spec.header);
 word(0x8003D2,0x100);word(0x8003D4,0);word(0x80024E,2);word(0x800314,4);
 word(0x800250,0);word(0x800372,0xFFFF);
 for(let n=0;n<(spec.argument&255)/2;n++)word(0x3F1+2*n,0x110+n);
 return {...f,maxHandlers:1,maxWork:10000,maxOutputBytes:1024};
}
export function taskScriptResumeFixture(){
 const f=taskFixture(0x80F495,{s:0x6FF,savedOuterS:0x6FF,outerWord:0xC20A,writeWindows:[[0x7E0000,0x7FFFFF]]});
 const word=(a,v)=>f.data.seed(a,[v&255,v>>>8]);
 word(0x800250,0x10);word(0x800262,0x200);word(0x201,0x8012);word(0x203,4);word(0x207,0x3F0);word(0x209,12);
 word(0x82E62F,2);word(0x800000,0x4567);return {...f,maxOutputBytes:1024};
}
