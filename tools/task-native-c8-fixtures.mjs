import {taskFEC1Fixture} from './task-native-fec1-fixtures.mjs';import {heldWord} from './render-be6d-fixtures.mjs';
import {createRenderData,renderAddress} from '../src/render/data.mjs';
export function taskNativeC8Fixture({frame=0x1000,operandS=0x3F0,args=[2,2,10,8,0,0,60],omit=null,...notice}={}){
 const f=taskFEC1Fixture(notice),{data}=f;
 for(const [address,value] of [[frame,0x1200],[frame+1,0x8012],[0x800250,0x10],[0x800262,frame],
  [0x8001F2,f.context.s],[0x82D948,0xFEC1],[0x82DB14,7],[0x82DA38,0],[0x80F30C,0xF4CB]])heldWord(data,address,value);
 heldWord(data,0x7E0000+((f.context.s+1)&65535),0xC20A);
 for(const [n,value] of args.entries())heldWord(data,(operandS+1+2*n)&65535,value);
 data.seed(0x801204,[0xC8,0x14,0xA5]);
 const context=Object.freeze({...f.context,a:0xABCD,x:0x58,y:4,s:operandS,d:frame,pc:0xF390});
 let owner=data;if(omit!==null){owner=createRenderData({writeWindows:data.snapshot().writeWindows});for(const [address,value] of data.snapshot().bytes)if(address!==renderAddress(omit))owner.seed(address,[value]);}
 return {...f,data:owner,context,entry:0x80F390};
}
