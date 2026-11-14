import {taskModalFixture} from './task-native-modal-fixtures.mjs';import {taskSelectionFixture} from './task-native-selection-roots-fixtures.mjs';
import {taskAudioFixture} from './task-native-audio-fixtures.mjs';import {taskFEC1Fixture} from './task-native-fec1-fixtures.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';import {menuRecords} from './task-native-menu-fixtures.mjs';
import {modalBodySeedBytes} from './task-script-body-modal-seeds.mjs';
import {tierBodySeedBytes} from './task-script-body-tier-seeds.mjs';
import {localBodySeedBytes} from './task-script-body-local-seeds.mjs';
import {localBodyCases,localBodyPCs} from './task-script-body-local-fixtures.mjs';
import {propertyPairCases,propertyPairPCs,expandPropertyPairFixture} from './task-script-body-property-pair-fixtures.mjs';
export function modalBodyCases(s){
 if(s.propertyPairBody)return propertyPairCases();
 if(s.localBody)return localBodyCases(s);
 if(s.tierBody)return [{name:'confirmed-rank0',confirm:true,low:5000,rank:0},{name:'confirmed-rank5',confirm:true,low:5000,rank:5},
  {name:'rank6-original-refund',confirm:true,low:5000,rank:6},{name:'rank255-masked-refund',confirm:true,low:5000,rank:255},
  {name:'cancel',confirm:false,low:5000,rank:5},{name:'no-funds',confirm:true,low:0,rank:5},{name:'borrow-rank5',confirm:true,low:0,high:1,rank:5}];
 if(s.id===0x381)return [{name:'property-match',propertyMatch:true},{name:'original-high-audio-property-change',propertyMatch:false}];
 const ordinary=[{name:'confirmed-funded',confirm:true,low:5000},{name:'cancel-funded',confirm:false,low:5000},
  {name:'confirmed-no-funds',confirm:true,low:0},{name:'confirmed-borrow',confirm:true,low:0,high:1}];
 if([0x04D,0x118].includes(s.id))ordinary.push({name:'existing-record-flag',confirm:true,low:5000,flags:s.id===0x118?128:1});
 if(s.id===0x0D7)ordinary.push({name:'existing-record-flag',flags:1,low:5000},{name:'property-match',propertyMatch:true,low:5000});
 if(s.id===0x0C3)ordinary.push({name:'original-state1-price4000',confirm:true,state:1,low:5000},{name:'original-state2-price2000',confirm:true,state:2,low:5000});
 if(s.id===0x27A)ordinary.push({name:'existing-original-state',state:1,low:5000});
 if(s.id===0x162)ordinary.push(...[3,4,5,6].flatMap(state=>[
  {name:`state-${state}-original-guard`,confirm:true,state,globalWord:state===3?2:state===6?5:3,low:5000},
  {name:`state-${state}-original-valid`,confirm:true,state,globalWord:state===3?0:state===6?4:2,low:5000}]));
 return ordinary;
}
// Independent source predicates for each original JZ/JNZ. The fixture walker
// chooses static edges only; it never executes bytecodes, native routines,
// a CPU, hardware, elapsed time or an original caller lifecycle.
export function modalBodyPCs(s,v={}){
 if(s.propertyPairBody)return propertyPairPCs(s,v);
 if(s.localBody)return localBodyPCs(s,v);
 // Opcode9A returns FFFF for unsigned left>right; opcode04 masks the
 // freshly read state WORD to BYTE. These are ordering gates, not equality.
 const confirm=v.confirm===true,state=v.state??0,price=s.id===0x0C8?(v.price??100):s.id===0x0C3?(state>1?2000:4000):s.id===0x04D?150:s.id===0x1E6?500:s.id===0x27A?1000:100,
  funded=(v.low??0)>=price||(v.high??0)!==0,flags=v.flags??0,globalWord=(v.globalWord??0)&255;
 const invalid=(state===3&&globalWord>0)||(state===4&&globalWord>2)||(state===5&&globalWord>2)||(state===6&&globalWord>4);
 const branches=s.tierBody?{6:!confirm,13:!funded,24:(v.rank??0)<6}:{
  0x04D:{9:!(flags&1),29:!confirm,36:!funded},0x0A4:{6:!confirm},
  0x0C3:{10:state<=1,44:!confirm,51:!funded},0x0C8:{12:!confirm,19:!funded},
  0x0D7:{9:!(flags&1),27:!v.propertyMatch,47:!confirm},0x0E3:{6:!confirm},
  0x118:{11:!(flags&128),31:!confirm},0x143:{6:!confirm,13:!funded},
  0x162:{64:!invalid,85:!confirm,92:!funded},0x1E6:{8:!confirm,16:!funded},0x1ED:{8:!confirm},
  0x27A:{5:state!==0,18:!confirm,26:!funded},0x381:{8:!v.propertyMatch}
 }[s.id];
 const pcs=[];let pc=0;
 for(let n=0;n<=s.instructions.length;n++){const i=s.instructions.find(i=>i.pc===pc);if(!i)throw Error('Uncovered expected modal source edge');pcs.push(pc);
  if(i.opcode===0x56)return pcs;
  if([0x44,0x46].includes(i.opcode)){if(typeof branches[pc]!=='boolean')throw Error('Unproved modal branch predicate');pc=branches[pc]?i.operand:pc+i.length;}
  else pc=i.opcode===0x48?i.operand:pc+i.length;
 }
 throw Error('Unbounded modal source fixture');
}
export function expandModalBodyFixture(s,v,f){
 if(s.propertyPairBody)return expandPropertyPairFixture(s,v,f);
 const original=f.data.snapshot().bytes,menu=taskModalFixture(0x72,{held:v.confirm?0x40:0x2000}),text=taskSelectionFixture(0x9A),
  notice=taskFEC1Fixture({s:0xAFF}),mappedSound=s.romReads.find(r=>r.address===0x80C4EB)?.value??0x8030,
  audio=taskAudioFixture(0x80C46E,{s:0xAFF,sound:mappedSound,voice:3,selector:mappedSound&255,directory:0x7E7000,
   blockPointer:0x7E7100,blocks:[{kind:'raw',pointer:0x7E7200,values:[0xAB]}]});
 const word=(a,n)=>sampleWord(f.data,a,n);
 for(const source of [notice,audio,text,menu])for(const [a,n]of source.data.snapshot().bytes)f.data.seed(a,[n]);
 for(const [a,n]of original)f.data.seed(a,[n]);for(const [a,n]of (s.localBody?localBodySeedBytes:s.tierBody?tierBodySeedBytes:modalBodySeedBytes)[s.id]??[])f.data.seed(a,[n]);
 for(const r of s.romReads)word(r.address,r.value);
 // Two independent observed windows: persistent text2 and allocated menu4.
 word(0x14,2);word(0x800204,2);word(0x800228,1);word(0x80022A,0);word(0x800212,0x2027);
 // Keep the independent text window inside its declared render region;
 // an oversized redraw would legitimately overwrite the currency records.
 for(const [offset,n]of [[0x2020,250],[0x2040,8],[0x2060,32],[0x2080,256],[0x20C0,32],[0x20E0,0],[0x2100,0],[0x2140,0]])word(0x7E0000+offset+2,n);
 word(0x7E3C0D,v.low??0);word(0x7E3C0F,v.high??0);word(0x7E3C06,0xAB00|(v.state??0));word(0x7E3BFF,0xCD00|(v.state??0));word(0x7E2DE6,v.globalWord??0);
 if(s.localBody){word(0x7E3BBF,v.counter??0);word(0x605,v.returnPointer??0x900);word(0x9F0900,0xA5A5);}
 for(const r of s.romReads.filter(r=>r.address>=0x8DB020&&r.address<0x8DD020))if(r.value){
  word(0x7E0000+r.value+1,v.flags??0);word(0x7E0000+r.value+3,v.propertyMatch?(s.id===0x381?0x8B2:0x1538):0);}
 const args=s.id===0x0C8?[0xCBE,100,0x199]:s.id===0x162?[0xCBE,0x199,100,0x19A,0xCF]:s.id===0x118?[0x199]:[16];
 for(let n=0;n<s.argumentBytes/2;n++)word(0x800+n*2,args[n]);word(0x800+s.argumentBytes,0xBEEF);
 if(s.tierBody){const record=s.instructions.find(i=>i.pc===16).operand,pointer=s.romReads.find(r=>r.address===0x8DB020+record)?.value;
  if(pointer!==undefined)word(0x7E0002+pointer,0xAB00|(v.rank??0));}
 const pcs=modalBodyPCs(s,v),io=[],waits=[],inputs=[];
 for(const pc of pcs){const i=s.instructions.find(i=>i.pc===pc);if(i.opcode!==0x58)continue;
  if(i.operand===0x72){io.push(...menu.ioObservations);waits.push(...menu.waitObservations);inputs.push(...menu.inputObservations);}
  else if(i.operand===0x9A){io.push(...text.ioObservations);waits.push(...text.waitObservations);}
  else if(i.operand===0xD7){io.push(...text.ioObservations.slice(1));waits.push(...text.waitObservations.slice(1));}
  else if(i.operand===0x4C)io.push(...audio.ioObservations);
  else if(i.operand===0xC8){io.push({pc:0x80FA01,address:0x802134,width:2,value:0},...notice.ioObservations);
   waits.push({pc:0x81ACBD,address:0x8001F6,width:2,value:0},{pc:0x81ACAF,address:0x8001F8,width:2,value:0},...notice.waitObservations);}
 }
 return {...f,maxHandlers:pcs.length,maxWork:2000000,maxOutputBytes:2000000,ioMode:'record-requests',ioObservations:menuRecords(io),
  waitMode:'record-observations',waitObservations:menuRecords(waits),inputMode:'record-observations',inputObservations:menuRecords(inputs)};
}
