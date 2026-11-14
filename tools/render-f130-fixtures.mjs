import { createRenderData } from '../src/render/data.mjs';
export const sampleEntry={bank:0x80,status:0xC5,a:0x8007,x:0xBEEF,y:0x1234,
  emulation:0,directPage:0,stackWindow:[0x1F00,0x1FFF],ioMode:'record-requests',
  ioRead2140:Array.from({length:256},(_,n)=>n)};
export function sampleWord(data,address,value){data.seed(address,[value&255,value>>>8]);}
export function samplePointer(data,address,value){data.seed(address,[value&255,value>>>8&255,value>>>16]);}
// Synthetic directory/block/payload bytes, not an original initialized scene
// or automatically executed directory loader/boot/SPC lifecycle.
export function sampleFixture({bank=0x80,token=0,selector=7,directory=0x908000,blockPointer=0x908100,
  address=0x1234,blocks=[{kind:'raw',values:[0xAB]}],length=null,writeWindows=null}={}){
  const owner=bank===0x7F?0x7F0000:0x7E0000,base=bank*65536;
  const data=createRenderData({writeWindows:writeWindows??[[0x7E0089,0x7E0099],
    [owner+0x1CE4,owner+0x1CE7],...([0x7E,0x7F].includes(bank)?[[base+0x2140,base+0x2143]]:[])]});
  data.seed(base+0x1CE4,[token]);data.seed(base+0x1CE6,[0,0]);
  if([0x7E,0x7F].includes(bank))data.seed(base+0x2140,[token]);
  samplePointer(data,0x8C,directory);data.seed(0x99,[0xA5]);
  data.seed(directory+5,[selector,blockPointer&255,blockPointer>>>8&255,blockPointer>>>16,255]);
  let offset=4,payloadLength=0;
  for(const [n,block]of blocks.entries()){
    if(block.kind==='raw'){
      const count=block.count??block.values.length,pointer=block.pointer??0x918000+n*0x1000;
      sampleWord(data,blockPointer+offset,count);samplePointer(data,blockPointer+offset+2,pointer);
      if(block.values.length)data.seed(pointer,block.values);payloadLength+=count;offset+=5;
    }else{
      sampleWord(data,blockPointer+offset,0x8000|block.count);sampleWord(data,blockPointer+offset+2,block.value);
      payloadLength+=block.count*2;offset+=4;
    }
  }
  sampleWord(data,blockPointer,length??((payloadLength+2)&65535));sampleWord(data,blockPointer+2,address);
  return data;
}
