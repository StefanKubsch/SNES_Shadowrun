import {taskNativeCallFixture} from './task-native-dispatch-fixtures.mjs';
import {nativeOpcodeSpecs} from './task-native-opcode-specs.mjs';
import {taskOpcodeSpecs} from './task-opcode-specs.mjs';

// Synthetic physical byte sources; never original initialized scene evidence.
// Default: Native02/CA3A (the tests use its table pointer 82D7BC, arguments and result word).
export function taskNativeOpcodeFixture(spec=nativeOpcodeSpecs.find(s=>s.name==='native-ca3a')){
 const f=taskNativeCallFixture(spec),word=(a,v)=>f.data.seed(a,[v&255,v>>>8]);
 f.context=Object.freeze({...f.context,a:0xABCD,x:0x58,y:4,s:0x3F0,d:0x200,pc:0xF390});
 for(const s of taskOpcodeSpecs)word(0x80F2B4+s.opcode,s.target&65535);
 f.data.seed(0x801204,[spec.id,0x14,0xA5]);
 const metadata=spec.anchors.find(a=>a.kind==='argument-metadata');
 f.data.seed(metadata.start,Buffer.from(metadata.hex,'hex'));
 for(const [n,value] of [0x10,3,5,0x4567,65535].entries())word(0x3F1+2*n,value);
 return {...f,entry:0x80F390,maxHandlers:1,maxWork:250000,maxOutputBytes:2048};
}
