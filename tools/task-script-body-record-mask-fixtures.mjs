import {sampleWord} from './render-f130-fixtures.mjs';import {directionVectors} from './task-script-body-direction-fixtures.mjs';
export const recordMaskBodyCases=()=>[
 ...[0,1,0x7F].map(flag=>({name:`record-low-${flag}`,flag})),
 {name:'null-pointer-record-DP-alias',pointer:0,flag:0},
 ...directionVectors.map(([dx,dy],direction)=>({name:`mask80-direction-${direction}`,flag:0x80,dx,dy,direction})),
 {name:'maskFF-direction7',flag:0xFF,dx:-4,dy:4,direction:7}
];
export const recordMaskBodyPCs=(s,v={})=>[0,2,3,5,7,8,9,...((v.flag??0x80)&0x80&&v.pointer!==0?
 [17,20,21,23,25,26,28,29,30,32,33,35,37]:[12,13,15,16])];
export function expandRecordMaskBodyFixture(s,v,f){
 const word=(a,n)=>sampleWord(f.data,a,n),slot=v.slot??16;
 for(const r of s.romReads)word(r.address,r.value);
 word(0x800,slot);word(0x802,0xBEEF);word(2,0xAB80);
 word(0x8013A8+(slot&255),v.pointer??0x4000);word(0x7E4001,0xAB00|(v.flag??0x80));
 word(0x800CC2,0x20);word(0x800E28+(slot&255),0);word(0x800E80+(slot&255),0);
 word(0x800E48,(v.dx??0)&65535);word(0x800EA0,(v.dy??8)&65535);
 for(const [o,n]of [[0x1038,65535],[0x1198,0],[0x10E8,1],[0x11F0,0xAB31],[0x1090,0x8000],[0x1458,v.actorFlags??0xBEAF],[0x12A0,0]])word(0x800000+o+(slot&255),n);
 word(0x7E3F28+(slot&255),11);word(0x8014B0,0);word(0x8014B2,slot&255);word(0x7E43F8+(slot&255),0);word(0x801FD0,0);
 return {...f,maxHandlers:recordMaskBodyPCs(s,v).length,maxWork:1000000,maxOutputBytes:1000000};
}
