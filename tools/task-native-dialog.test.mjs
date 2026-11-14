import test from 'node:test';import assert from 'node:assert/strict';
import {rom,window,decodeWindows,compareDialog,prng} from './task-native-dialog-harness.mjs';
import {clearFixedColour,setWindowTextWidth,unpackPortrait,shiftPortraitRows,uploadFirstPortrait,uploadSecondPortrait,openPortraitWindow,closePortraitWindow,putGloveAway} from '../src/task/native-dialog-portrait.mjs';
import {waitForRandomStateChange} from '../src/task/native-frame-wait.mjs';

// Fenster- und Porträtroutinen des Dialogs $936C gegen die Originalbefehle. Jede Routine hat eigene
// Szenarien; alle Befehle ihrer Fenster müssen erreicht werden.
const romOffset=address=>((address>>>16)&0x1F)<<15|(address&0x7FFF);
const romWord=address=>rom[romOffset(address)]|rom[romOffset(address+1)]<<8;
function scenarioBase(seed,entry){
 const r=prng(seed),int=n=>Math.floor(r()*n),wram=new Uint8Array(0x20000);
 const put=(address,v)=>{const o=address>=0x7E0000?address-0x7E0000:address&0xFFFF;wram[o]=v&255;wram[o+1]=(v>>>8)&255;};
 return {r,int,pick:list=>list[int(list.length)],wram,put,s:{entry,wram,a:int(0x10000),x:int(0x10000),y:int(0x10000),dbr:0x80,p:int(256)&0xC7}};
}
function check(name,windows,entry,scenarios,make,options={}){
 test(`${name} matches the original instructions on every instruction`,()=>{
  const map=decodeWindows(windows),covered=new Set();
  for(let seed=1;seed<=scenarios;seed++){
   const s=make(scenarioBase(seed*7919+entry,entry));
   const result=compareDialog(map,s,options.feed?{...options,feed:s.feed}:options);
   assert.deepEqual(result.differences,[],`${name} seed ${seed}`);
   for(const pc of result.visited)covered.add(pc);
  }
  assert.deepEqual([...map.keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),[]);
 });
}
// Zähler B0A1 auf beiden Seiten als bewiesenes Modul mit denselben Beobachtungen.
const counterCalls=(acc,events)=>new Map([[0x81B0A1,()=>{
 const p=waitForRandomStateChange(acc,{waitObservations:Object.freeze(events.values.slice(events.waitIndex))},false,true);
 events.waitIndex+=p.waitObservationsUsed;return p;}]]);
const counterWaits=(int,count,start)=>{const list=[];let c=start;
 for(let n=0;n<count;n++){if(int(5)===0)list.push({pc:0x81B0A5,address:0x7E1C76,width:2,value:c});c=(c+1+int(2))&0xFFFF;list.push({pc:0x81B0A5,address:0x7E1C76,width:2,value:c});}
 return list;};

check('81:886A',[window(0x81886A,0x818877)],0x81886A,50,({s})=>s,{native:h=>clearFixedColour(h),root:'RTL'});

check('FA92',[window(0x80FA92,0x80FAAC)],0x80FA92,800,({s,int,pick,put})=>{
 const x=int(0x40)*2;put(0,x);put(2,int(0x10000));put(4,pick([0,1,0x7FFF,0x8000,0xFFF8,int(0x10000)]));put(0x7E2020+x,int(0x10000));return s;},
 {native:h=>setWindowTextWidth(h)});

// Echte komprimierte Porträts aus den Dialogdatensätzen (Zeiger in 8D:0000 über 80:94F7).
const portraits=(()=>{const set=new Map();
 for(let k=0;k<0x60;k++){const record=0x8D0000|romWord(0x8094F7+2*k),pointer=romWord(record)|rom[romOffset(record+2)]<<16;
  if((pointer>>>16)<0x80||(pointer>>>16)>0x9F)continue;set.set(romWord(pointer)|rom[romOffset(pointer+2)]<<16,k);}
 return [...set.keys()];})();
check('9F6D/9E65',[window(0x809E65,0x809E7E),window(0x809F6D,0x80A033)],0x809F6D,portraits.length*2,({s,int,pick,r})=>{
 const source=pick(portraits);s.a=source&0xFFFF;s.y=source>>>16;s.x=pick([0x5250,0x5250,0x6000+int(0x100)]);
 for(let n=0;n<0x100;n++)s.wram[0xE0+n]=int(256);return s;},{native:h=>unpackPortrait(h)});

check('8F20',[window(0x808F20,0x808F3A)],0x808F20,20,({s,int})=>{for(let n=0x15000;n<0x17000;n++)s.wram[n]=int(256);return s;},{native:h=>shiftPortraitRows(h)});

// 8FF5 wartet auf $0140 negativ (NMI); die Referenz liest die Beobachtungen an derselben Adresse.
const dmaWaits=(int)=>{const list=[];for(let n=int(3);n>0;n--)list.push({pc:0x80901C,address:0x800140,width:2,value:int(0x8000)});
 list.push({pc:0x80901C,address:0x800140,width:2,value:0x8000|int(0x8000)});return list;};
check('9022/8FF5',[window(0x809022,0x80905E),window(0x808FF5,0x809022)],0x809022,30,({s,int})=>{s.waits=dmaWaits(int);return s;},
 {native:(h,e)=>uploadFirstPortrait(h,e),waits:[0x80901C]});
check('905E/8FF5/A954',[window(0x80905E,0x80908C),window(0x808FF5,0x809022),window(0x81A954,0x81A958)],0x80905E,60,({s,int,put})=>{
 s.waits=dmaWaits(int);put(0x1BA,int(0x10000));put(0x1562,int(0x10000));return s;},{native:(h,e)=>uploadSecondPortrait(h,e),waits:[0x80901C]});

check('8F3A/8EFE',[window(0x808F3A,0x808F87),window(0x808EFE,0x808F20)],0x808F3A,40,({s,int,put})=>{
 const c=int(0x10000);put(0x7E1C76,c);s.waits=counterWaits(int,11,c);put(0x1C4,int(0x10000));return s;},
 {native:(h,e)=>openPortraitWindow(h,e),calls:counterCalls});
check('8F97/8EFE',[window(0x808F97,0x808FB3),window(0x808EFE,0x808F20)],0x808F97,40,({s,int,put})=>{
 const c=int(0x10000);put(0x7E1C76,c);s.waits=counterWaits(int,11,c);put(0x1C4,int(0x10000));return s;},
 {native:(h,e)=>closePortraitWindow(h,e),calls:counterCalls});

// FA3E hat einen eigenen Beweis; hier auf beiden Seiten derselbe Stub mit echtem Rahmen.
const fa3eStub=acc=>{const raw=acc.pullWord();acc.ctx.pc=(raw+1)&0xFFFF;acc.trace.push({kind:'call',pc:0x80FA3E,address:acc.readWord(0,16),value:0});
 acc.ctx.a=acc.readWord(0,16)^0x5A5A;return {rawReturnWord:raw};};
check('BCB2/BE5B',[window(0x80BCB2,0x80BCBE),window(0x80BE5B,0x80BE6D)],0x80BCB2,200,({s,int,pick,put})=>{
 put(0x1DA,pick([0xFFFF,0x8000,0,0x18,int(0x10000)]));put(0x1DC,int(0x10000));put(0x1D8,int(0x10000));return s;},
 {native:(h,e)=>putGloveAway(h,e,{fa3e:acc=>fa3eStub(acc)}),calls:acc=>new Map([[0x80FA3E,()=>fa3eStub(acc)]])});

// Text und Auswahl: FA67, FAAC, FE69, A6C7, F963, FA3E, C34A und C1CA haben eigene Beweise und laufen auf
// beiden Seiten als gleiche Stubs mit echtem Rahmen; Menü und Allokation liefern das Szenarioergebnis in DP00.
import {showDialogText,chooseDialogAction,chooseDialogTopic,dialogTopic} from '../src/task/native-dialog-text.mjs';
const TEXT_TARGETS={request:0x80FA67,cursor:0x80FAAC,text:0x80FE69,menu:0x80A6C7,allocate:0x80F963,release:0x80FA3E,append:0x80C34A,visit:0x80C1CA};
function textStub(target,acc,results){
 const raw=acc.pullWord();acc.ctx.pc=(raw+1)&0xFFFF;const dp=[0,2,4,6,8,0xA].map(o=>acc.readWord(o,16));
 acc.trace.push({kind:'call',pc:target,address:dp[0]|dp[1]<<16,value:dp.slice(2).reduce((v,w)=>v*31+w,acc.ctx.x)%0x1000000});
 if(target===0x80A6C7||target===0x80F963)acc.writeWord(0,results.shift()??0xFFFF,16);
 acc.ctx.a=(dp[0]*3+dp[2]+target)&0xFFFF;acc.ctx.status=(acc.ctx.status&~0x83)|(dp[3]&0x83);return {rawReturnWord:raw};
}
const textRoutines=(s)=>{const results=[...s.results];const r=Object.fromEntries(Object.entries(TEXT_TARGETS).map(([k,t])=>[k,acc=>textStub(t,acc,results)]));
 r.topic=dialogTopic(r.append,r.visit);return r;};
const textCalls=s=>(acc)=>{const results=[...s.results];return new Map(Object.values(TEXT_TARGETS).map(t=>[t,()=>textStub(t,acc,results)]));};
// Dialogdatensatz [11] ab Y=4: Einträge (Schlüssel, Länge, Flagbyte, IDs, [Aktionswort], Textwort), Ende F8.
function dialogRecord(int,pick,put,key){
 const bytes=[0,0,0,0];const keys=[0xFF,0xFE,0x10,0x20,0x30,int(256)];
 for(let n=1+int(4);n>0;n--){const k=pick(keys),ids=int(4),action=int(2),body=[k];const flag=(action?0x80:0)|ids|(int(3)===0?0x40:0);
  const inner=[flag];for(let i=0;i<ids;i++)inner.push(pick([0x10,0x11,0x30,0x05,int(0xF0)]));if(action)inner.push(int(256),int(256));inner.push(int(256),int(256));
  bytes.push(k,inner.length+1,...inner);}
 if(int(4))bytes.push(pick([key&255,0xFF,0xFE]),5,int(256),int(256),int(256),int(256));bytes.push(0xF8);
 for(let n=0;n<bytes.length;n++)put.byte(0x7F8000+n,bytes[n]);put(0x11,0x8000);put(0x13,0x7F);
}
check('9178/908C',[window(0x809178,0x8091E2),window(0x80908C,0x8090EB,{initialM:1})],0x809178,3000,({s,int,pick,put})=>{
 put.byte=(a,v)=>{s.wram[a-0x7E0000]=v;};const key=pick([0xFFFF,0xFFFE,0xFFFD,0x10,0x20,int(0x10000)]);s.a=key;
 dialogRecord(int,pick,put,key);put(0x14,int(0x10000));put(0x26,int(0x10000));
 const list=[...new Set(Array.from({length:int(6)},()=>pick([0x05,0x10,0x11,0x20,int(0xF0)])))].sort((x,y)=>x-y);
 for(let n=0;n<0x30;n++){s.wram[0x3CA3+n]=n<list.length?list[n]:(n===list.length?0xFF:int(256));s.wram[0x3CD6+n]=int(2);}
 s.results=[];return s;},{native:(h,e,s)=>showDialogText(h,e,textRoutines(s)),calls:(acc,e,s)=>textCalls(s)(acc)});
check('91E2',[window(0x8091E2,0x80920D)],0x8091E2,200,({s,int,pick,put})=>{put(0x17,int(0x10000));s.results=[pick([0,1,2,0xFFFF])];return s;},
 {native:(h,e,s)=>chooseDialogAction(h,e,textRoutines(s)),calls:(acc,e,s)=>textCalls(s)(acc)});
check('9215',[window(0x809215,0x8092C5)],0x809215,1500,({s,int,pick})=>{
 const count=int(3)===0?0:int(12);for(let n=0;n<0x40;n++){s.wram[0x3CA3+n]=n<count?int(0xFF):(n===count?0xFF:int(256));s.wram[0x3CD6+n]=int(3)===0?1:0;}
 s.results=[int(0x10000),pick([0,1,2,3,0xFFFF,int(8)])];return s;},
 {native:(h,e,s)=>chooseDialogTopic(h,e,textRoutines(s)),calls:(acc,e,s)=>textCalls(s)(acc)});

// Kacheln der Szenenobjekte (ADF4/AE12/AC2F). Animationsströme liegen im WRAM (Bank 8C, Offset < 2000),
// Bildzeiger zeigen auf ROM-Stellen in 9B/9C mit kleiner Kachelzahl, damit alle Pfade erreichbar sind.
import {reloadObjectTiles} from '../src/task/native-scene-tiles.mjs';
import {DIALOG_WINDOWS} from './task-native-936c-windows.mjs';
const smallFrames=(()=>{const list=[];for(let a=0x8000;a<0xFF00;a+=7)for(const bank of [0x9B,0x9C])
 if(rom[romOffset(bank<<16|a)]>=1&&rom[romOffset(bank<<16|a)]<=6)list.push((a&0x7FFF)|(bank===0x9C?0x8000:0));return list;})();
check('ADF4/AE12/AC2F',DIALOG_WINDOWS.adf4,0x80ADF4,2500,({s,int,pick,put})=>{
 const objects=[0x10,0x20,0x30,0x40].slice(0,1+int(3));put(0x14B0,2*(objects.length-1));objects.forEach((o,k)=>put(0x14B2+2*k,o));
 put(0x40,int(0x10000));put(0x82,pick([0,4,0x10,0x20,0x30,0x48]));
 // Platzkette: Freiliste ab 0D1E über $1564, Objektketten ab $12F8+X.
 const slots=Array.from({length:64},(_,k)=>0x60+2*k);let next=0;
 const chain=n=>{const first=slots[next]??0x60;for(let k=0;k<n;k++){const s=slots[next++]??0x60;put(0x1564+s,slots[next]??0x60);}return first;};
 for(const o of objects){
  const stream=0x1E00+(o-0x10)*4;for(let n=0;n<0x20;n+=2)put(stream+n,pick(smallFrames));
  for(let n=0x20;n<0x40;n++)s.wram[stream+n]=2*int(0xF);
  const noStream=int(4)===0;put(0x1090+o,noStream?0:stream);put(0x11F0+o,2+2*int(8));put(0x1198+o,0x20+int(8));
  const count=pick([0,1,2,3]);put(0x12A0+o,count);put(0x12F8+o,chain(count));
  put(0x1140+o,noStream?0xFFFF:pick([0,0,0,0xFFFF,pick(smallFrames)]));
  put(0x7E4088+o,pick([0,0x10,0x7F,int(0x10000)]));put(0x7E4030+o,pick([0,0x70,int(0x80)]));put(0x7E3FD8+o,pick([1,1,2,int(0x10000)]));
  put(0x10E8+o,pick([0,0,5,0x85]));put(0x1038+o,int(0x10000));put(0x1350+o,pick([0xFFFF,0x10]));
  put(0x7E3F80+o,int(0x10000));put(0xF88+o,int(0x10000));put(0xFE0+o,int(0x10000));
 }
 // Genug freie Plätze: sonst wiederholt AE12 den Bildwechsel wie das Original ohne Ende.
 put(0xD1E,slots[next]??0x60);chain(30);put(0xD1C,pick([28,30]));
 put(0xBA2+0x10,pick([0x8000,5]));put(0x372+0x10,0x20);put(0xBA2+0x20,3);put(0xC62+0x20,int(0x10000));put(0xC62+0x10,int(0x10000));
 put(0x1562,int(4));
 put(0x7E1C76,int(0x10000));s.waits=[];
 // Fehlende Beobachtungen bei Bedarf: Zähler (neuer Wert), Auftragsliste (Austritt 0, DP82 vom NMI).
 s.feed=d=>d.pc===0x81B0A5?int(0x10000):d.address===0x82?pick([0xFFFE,0xFFFE,0xFFFE,0,8]):d.address===0x1562&&d.pc===0x80AE23?0:pick([0,0,1]);
 return s;},{native:(h,e)=>reloadObjectTiles(h,e),calls:counterCalls,waits:[0x80AE0C,0x80AE5E,0x80AE23],feed:true});

// Sprites der Szene (B8DE mit AFFC, AB0A, B20A, B130). Kamera je Objekt so gewählt, dass Bilder auf, neben
// und außerhalb des Bildschirms liegen; Karte in Bank 7F aus leeren (negativen) und kleinen Zellen.
import {buildSpriteList} from '../src/task/native-scene-sprites.mjs';
import {runSpriteList} from '../src/game/main-upkeep.mjs';
const romByte=address=>rom[romOffset(address)];
// Bildköpfe mit 1..6 Zeilen und Spalten (Byte 2): 0 zählt wie im Original 65536-mal, große Bilder laufen
// mit den Verdeckungspuffern $1872/$1A72 in $1C72 hinein (beides kommt bei echten Figuren nicht vor).
const pictures=(()=>{const list=[];for(let a=0x8000;a<0xFF00;a+=3)for(const bank of [0x9B,0x9C]){const b=rom[romOffset(bank<<16|a+2)];
 if(b>>4&&b>>4<=6&&b&15&&(b&15)<=6)list.push((a&0x7FFF)|(bank===0x9C?0x8000:0));}return list;})();
// The register-level reference and the lifted sprite list (src/game/sprite-list.mjs).
for(const [name,native] of [['B8DE/AFFC/B20A/B130',h=>buildSpriteList(h)],['lifted B8DE',h=>runSpriteList(h)]])
check(name,DIALOG_WINDOWS.b8de,0x80B8DE,3000,({s,int,pick,put})=>{
 for(let n=0x10000;n<0x20000;n+=2)put(0x7E0000+n,int(2)?0x8000|int(0x8000):2*int(0x800));
 const objects=[0x10,0x20,0x30,0x40].slice(0,1+int(4)),count=int(8)===0?0:objects.length;
 put(0x14B0,count?2*(count-1):0xFFFE);objects.forEach((o,k)=>put(0x14B2+2*k,o));
 const sorted=int(3)===0;
 put(0xCC2,pick([0xFFFF,...objects]));
 // Kamera: erstes Objekt bestimmt sie, die anderen liegen daneben.
 let cx=null,cy=null;
 for(const o of objects){
  const picture=pick(pictures),address=((picture&0x8000)?0x9C0000:0x9B0000)|(picture|0x8000);
  put(0x7E3F80+o,int(6)===0?0:picture);put(0x1458+o,int(0x10000)&~(int(3)?0x80:0));
  const depth=0x200+int(0x600),height=int(4)?int(0x40):int(0x400),x=int(0x800),z=int(0x800);
  put(0xF30+o,depth);put(0xED8+o,height);put(0xE28+o,x);put(0xE80+o,z);
  if(cx===null&&int(6)===0){// Bild knapp oberhalb der Kartenzeile 0: Kamera 0, große Tiefe (B349..B350).
   const k=1+int(0x14);put(0xF30+o,(0xC00-height-2*romByte(address+1)+4*k)&0xFFFF);cy=int(4);
   const sx=((0x600+z-x-2*romByte(address))<<16>>16)>>2;cx=(sx-pick([0,0x10,0x80]))*4;}
  if(cx===null){const sy=((0xC00-depth-height-2*romByte(address+1))<<16>>16)>>2,sx=((0x600+z-x-2*romByte(address))<<16>>16)>>2;
   cy=(sy-pick([-0x30,-8,0,0x10,0x60,0xC0,0xD4,0xE0]))*4;cx=(sx-pick([-0x30,-8,0,0x10,0x80,0xE8,0xF4,0x100]))*4;}
  put(0x12F8+o,int(0x100));put(0x1400+o,pick([0,0,0,0,1,0x8000]));put(0x1248+o,int(0x20));
  put(0xF88+o,sorted?0:pick([1,2,3,4,0x8001,0x8002,0x8003,0x8004]));put(0xFE0+o,int(0x80));
 }
 put(0xCC6,cy&0xFFFF);put(0xCC4,cx&0xFFFF);
 for(let n=0;n<0x200;n++)s.wram[0x1564+n]=int(256);
 put(0x84,int(0x10000));put(0x1562,int(4));
 return s;},{native});

// The lifted depth sort and palette slot alone (src/game/depth-sort.mjs, palette-slots.mjs),
// so that the registers and flags they leave, which the sprite list overwrites, are compared.
import {sortDrawList} from '../src/game/depth-sort.mjs';
import {paletteSlot} from '../src/game/palette-slots.mjs';
const b8deWindows=starts=>DIALOG_WINDOWS.b8de.filter(w=>starts.includes(w.start));
check('lifted AFFC',b8deWindows([0x80AFFC,0x80B0ED,0x80B0F2]),0x80AFFC,1500,({s,int,pick,put})=>{
 const count=int(6),objects=[0x10,0x20,0x30,0x40,0x50].slice(0,count),ruled=int(3)!==0;
 put(0x14B0,count?2*(count-1):pick([0xFFFE,0x8000]));objects.forEach((o,k)=>put(0x14B2+2*k,o));
 const near=int(4)===0;
 for(const o of objects){
  put(0xF30+o,near?0x7F00+int(0x200):int(8)?int(0x1000):0x400);put(0xF88+o,ruled?pick([1,2,3,4,0x8001,0x8002,0x8003,0x8004]):0);
  put(0xFE0+o,near?0x7F00+int(0x200):int(0x80));put(0xE28+o,int(4)?int(0x40):0x20);put(0xE80+o,int(4)?int(0x40):0x20);
 }
 return s;},{native:h=>sortDrawList(h)});
check('lifted AB0A',b8deWindows([0x80AB0A]),0x80AB0A,600,({s,int,pick,put})=>{
 s.a=pick([0,1,int(0x20),0x8000|int(0x20)]);for(let n=0;n<0x20;n++)put(0x17E6+2*n,int(2)?0x8000|int(0x8000):2*int(0x10));
 put(0x17D4,2*int(0x10));return s;},{native:h=>paletteSlot(h)});

// Eigener Code von Native95/936C mit 92C5: alle gerufenen Routinen als gleiche Stubs mit echtem Rahmen
// (RTS oder RTL); Menü (91E2), Themen (9215), Text (9178, setzt $1D63) und Fenster (F963) liefern ihre
// Ergebnisse aus Szenariolisten, danach Exit.
import {talkWithObject} from '../src/task/native-dialog.mjs';
const DIALOG_CALLEES=[0x81886A,0x80BCB2,0x80FF79,0x81EF47,0x80F963,0x80FA92,0x809F6D,0x808F20,0x809022,0x80905E,0x808F3A,0x809178,
 0x81B0A1,0x8091E2,0x809215,0x80FA3E,0x808F97,0x80ADF4,0x809E1A,0x80B8DE];
function dialogStub(target,acc,lists){
 const {ctx}=acc,raw=acc.pullWord();if(target>>>16===0x81){ctx.programBank=acc.read((ctx.s+1)&0xFFFF);ctx.s=(ctx.s+1)&0xFFFF;}
 ctx.pc=(raw+1)&0xFFFF;const dp=[0,2,4,6,8,0xA].map(o=>acc.readWord(o,16));
 acc.trace.push({kind:'call',pc:target,address:dp[0]|dp[1]<<16,value:(dp.slice(2).reduce((v,w)=>v*31+w,ctx.a)+ctx.x*7+ctx.y)%0x1000000});
 const next=(name,fallback)=>lists[name].length?lists[name].shift():fallback;
 let a=(dp[0]*5+dp[2]+target)&0xFFFF;
 if(target===0x8091E2){a=next('menu',0);acc.writeWord(0,a,16);}
 if(target===0x809215)acc.writeWord(0,next('topic',0xFF),16);
 if(target===0x809178)acc.writeWord(0x801D63,next('talk',0),24);
 if(target===0x80F963)acc.writeWord(0,next('window',0x40),16);
 ctx.a=a;ctx.status=(ctx.status&~0x83)|(a&0x8000?0x80:0)|(a===0?2:0)|(dp[3]&1);return {rawReturnWord:raw};
}
const dialogLists=s=>({menu:[...s.menu],topic:[...s.topic],talk:[...s.talk],window:[...s.windows]});
check('936C/92C5',DIALOG_WINDOWS['936c'],0x80936C,3000,({s,int,pick,put})=>{
 put(0,int(0x60));put(2,pick([0x10,0x20,0x30,int(0x60)]));put(0x1FD6,int(0x10000));put(0x1CDE,pick([9,0xA,int(0x10000)]));
 s.wram[0x3C17]=pick([0,1]);for(let n=0;n<0x40;n++)s.wram[0x3CA3+n]=int(256);put(0x1D63,int(0x10000));
 // Dialogdatensatz [11] in Bank 8D (über 80:94F7): Flagbyte an +3 aus der ROM.
 const steps=int(6);s.menu=Array.from({length:steps},()=>pick([1,1,2,2,int(4)]));s.menu.push(0);
 s.talk=Array.from({length:steps},()=>int(6)===0?pick([1,0x100]):0);s.topic=Array.from({length:steps},()=>pick([0xFF,0,1,3,0xFFFF]));
 s.windows=[int(0x10000),int(0x10000)];return s;},
 {native:(h,e,s)=>{const lists=dialogLists(s);talkWithObject(h.a,e,true,new Map(DIALOG_CALLEES.map(t=>[t,hh=>dialogStub(t,hh.a,lists)])));},
  calls:(acc,e,s)=>{const lists=dialogLists(s);return new Map(DIALOG_CALLEES.map(t=>[t,()=>dialogStub(t,acc,lists)]));}});

import {decodeTaskWindows} from './task-partial-source.mjs';
import {romBytes} from './task-native-dialog-harness.mjs';
import {native936CSpecs,prove936CSource,native936CExpected} from './task-native-936c-source.mjs';
import {SPECIAL_NATIVES} from '../src/vm/special-natives.mjs';
test('936C and its subroutines: pinned windows and stack/mode proofs per group, bound as special native',()=>{
 assert.deepEqual(native936CSpecs.map(s=>s.name).sort(),Object.keys(native936CExpected).sort());
 for(const spec of native936CSpecs){const {map}=decodeTaskWindows(romBytes,spec.windows),proof=prove936CSource(map,spec);
  assert.equal(proof.reachable_instructions,native936CExpected[spec.name].instructions,spec.name);}
 assert.ok(SPECIAL_NATIVES.has(0x80936C));
});
