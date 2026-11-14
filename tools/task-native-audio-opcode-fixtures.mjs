import {taskAudioFixture} from './task-native-audio-fixtures.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';
import {createRenderData,renderAddress} from '../src/render/data.mjs';

// All Task/workspace/stack/cache/directory/APU/product values are synthetic.
// Native pointer/argument/return/dispatch anchors are the original ROM bytes.
export function taskNativeAudioOpcodeFixture({frame=0x1000,operandS=0x3F0,scriptBank=0x80,omit=null,
 entity=65535,soundIndex=0x4C,pan=0x40,voice=3,...audio}={}){
 const f=taskAudioFixture(0x80C46E,{voice,...audio}),{data}=f;
 for(const [address,value]of[[frame,0x1200],[frame+1,scriptBank*256+0x12],
  [0x800250,0x10],[0x800262,frame],[scriptBank*65536+0x1F2,f.context.s],
  [0x82D850,0xC46E],[0x82DA98,0x0104],[0x82D9BC,0],[0x80F30C,0xF4CB],
  [f.context.s+1,0xC20A],[0x80C4B3+soundIndex,audio.sound??45]])sampleWord(data,address,value);
 for(const [n,value]of[entity,soundIndex,pan,voice].entries())sampleWord(data,operandS+1+2*n,value);
 data.seed(scriptBank*65536+0x1204,[0x4C,0x14,0xA5]);
 const context=Object.freeze({...f.context,bank:scriptBank,a:0xABCD,x:0x58,y:4,s:operandS,d:frame,pc:0xF390});
 let owner=data;if(omit!==null){owner=createRenderData({writeWindows:data.snapshot().writeWindows});
  for(const[address,value]of data.snapshot().bytes)if(address!==renderAddress(omit))owner.seed(address,[value]);}
 return {...f,data:owner,context,entry:0x80F390};
}
