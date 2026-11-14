import { listEntry,listFixture,listWindows } from './render-list-fixtures.mjs';
import { textWord } from './render-text-compose-fixtures.mjs';
import { sampleFixture } from './render-f130-fixtures.mjs';
export const menuWindows = [...listWindows,[0x7E1DA7,0x7E1DA8],[0x7E01CA,0x7E01CF],
  [0x7E1C76,0x7E1C77],[0x7E1CE0,0x7E1CE7],[0x7E01F6,0x7E01F9]];
export const menuEntry = { ...listEntry,a:0,x:0x1234,y:0xBEEF,
  stackWindow:[0x1FEC,0x1FFF],ioRead4214:Array(256).fill(0),ioRead4216:Array(256).fill(0),
  ioRead4214Word:Array(256).fill(0),ioRead4216Byte:Array(256).fill(5),
  waitRead01FA:Array(256).fill(0),waitRead01FC:Array(256).fill(0),waitRead01F6:Array(256).fill(0),
  waitRead1C76:[1],ioRead4217:[17,34],ioRead2140:Array.from({length:256},(_,n)=>n) };
// Synthetic complete menu/list/dictionary/font/cache/input bytes, never an
// initialized original scene, NMI/capture pairing or automatic browser input.
export function menuFixture({ held=0x2000,previous=0,counter=0,sound=0x2D,cachedSound=0,cachedVoice=0,
  token=0,bank=0x80,column=1,row=1,numbers=[0,0,0],writeWindows=menuWindows,
  load=false,...list }={}) {
  const data=listFixture({...list,bank,numbers,column,row,writeWindows}),base=bank*65536;
  textWord(data,2,column);textWord(data,4,row);
  textWord(data,0x7E20A0+(list.index ?? 2),8);
  for(const [offset,value] of [[0x1CA,held],[0x1CC,previous],[0x1CE,0],[0x1DA7,0],[0x1DA1,0],
    [0x1D97,0],[0x1F6,0]])textWord(data,base+offset,value);
  textWord(data,0x7E1C76,counter);textWord(data,0x801CE0,cachedSound);
  textWord(data,0x801CE2,cachedVoice);data.seed(0x801CE4,[token]);textWord(data,0x80C4FF,sound);
  if(load) {
    const samples=sampleFixture({...list,selector:sound&255,token,writeWindows:[]});
    for(const [address,value] of samples.snapshot().bytes)data.seed(address,[value]);
  }
  return data;
}
