import test from 'node:test';import assert from 'node:assert/strict';
import {sceneLoadSpecs,proveSceneLoad} from './main-scene-load-source.mjs';
import {compareDialog,decodeWindows,prng} from './task-native-dialog-harness.mjs';
import {SCENE_LOAD_ROUTINES,loadScene} from '../src/task/main-scene-load.mjs';
import {dialogAccess} from '../src/task/native-dialog-support.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
import {rom,window} from './task-native-dialog-harness.mjs';
import {cpuToOffset} from './rom.mjs';
import {runReference} from './w65c816-reference.mjs';
import {mainInitializeSpecs} from './main-initialize-source.mjs';
import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {DialogTestMemory} from './task-native-dialog-harness.mjs';
import {MAIN_SCENE_ROUTINES} from '../src/task/main-scene.mjs';
const maps=sceneLoadSpecs.map(s=>decodeWindows(s.windows));
const union=new Map(maps.flatMap(m=>[...m]));
const external=(a,e,map,r)=>new Map([...r].filter(([target])=>!map.has(target)).map(([target,run])=>[target,()=>{
 const v=run(dialogAccess(a),e,r);return {rawReturnWord:v?.rawReturnWord??v};}]));
function base(entry,seed=1){const wram=new Uint8Array(0x20000),word=(at,v)=>{wram[at]=v&255;wram[at+1]=v>>>8&255;};return {entry,wram,word,a:0,x:0,y:0,dbr:0x7E,p:seed&0xC7};}
test('scene loader pins all reachable bytes, frames and mode restoration',()=>{
 sceneLoadSpecs.forEach((s,i)=>{assert.equal(proveSceneLoad(maps[i],s).reachable_instructions,maps[i].size);assert.equal(MAIN_SCENE_ROUTINES.get(s.entry),SCENE_LOAD_ROUTINES.get(s.entry));});
 const layer=sceneLoadSpecs.find(s=>s.entry===0x81903E),fullLayer=decodeWindows([...layer.windows,...layer.unreachableWindows]);
 assert.equal(fullLayer.size,464);assert.equal(proveWordStack(fullLayer,layer.entry,'RTS',{externalReturns:new Map(layer.externalReturns)}).reachable_instructions,452);
 const s=sceneLoadSpecs[1],m=maps[1];assert.throws(()=>proveWordStack(m,s.entry,s.rootReturn),/Mode mismatch/);
 assert.throws(()=>proveWordStack(m,s.entry,s.rootReturn,{statusRestoreJoins:new Set([0x81802B])}),/Invalid status restore/);
 // PLB remains width independent; PLP must still consume the saved PHP.
 const broken=new Map(m);broken.set(0x81801A,{...broken.get(0x81801A),mnemonic:'NOP'});
 assert.throws(()=>proveWordStack(broken,s.entry,s.rootReturn,{statusRestoreJoins:new Set(s.statusRestoreJoins)}),/Stack mismatch/);
 const graph=new Map(union);for(const s of mainInitializeSpecs.filter(s=>[0x818CB9,0x818000].includes(s.entry)))for(const item of decodeWindows(s.windows))graph.set(...item);
 const proof=proveWordStack(graph,0x81A117,'RTL',{measureStack:true,externalReturns:new Map([[0x809F6D,'RTS']]),statusRestoreJoins:new Set([0x818073,0x818074]),indexPulls:new Set([0x818EFC])});
 assert.equal(proof.external_return_assumptions,1);assert.equal(proof.minimum_protected_stack_bytes,21);
 assert.deepEqual(proof.returns,[{at:'81:A1BB',m:0,x:0,dbr:'entry'}]);
});
test('A117 composes original scene data with every native loader and palette helper',()=>{
 for(let scene=0;scene<16;scene++){
  const s=base(0x81A117,scene);s.a=scene;s.dbr=[0x80,0x81,0x7E,0][scene%4];
  const result=compareDialog(union,s,{root:'RTL',referenceLimit:4_000_000,native:(h,e)=>loadScene(h,e),calls:(a,e)=>external(a,e,union,SCENE_LOAD_ROUTINES)});
  assert.deepEqual(result.differences,[],`scene ${scene}`);
 }
});
function synthetic(spec,seed){
 const s=base(spec.entry,seed),{word,wram}=s,random=prng(seed),rnd=n=>Math.floor(random()*n);
 // Synthetic WRAM only; no fixture is an observed scene/frame.
 for(let n=0;n<0x2000;n++)wram[n]=rnd(256);
 s.a=rnd(65536);s.x=[0,0x7E,0x80,0xFFE,0xFFF,0xFFFE][seed%6];s.y=rnd(65536);
 word(0x17,seed%4);word(0x20,0x40);word(0x23,rnd(0x10000));word(0x26,[0xFFFF,0,1,5][seed%4]);word(0x29,seed%3);word(0x2C,seed%3);
 word(0xE,0xF000);wram[0x10]=0x7F;word(0x11,0xF800);wram[0x13]=0x7F;word(0x14,0xF900);wram[0x16]=0x7F;
 word(0xD10,seed%4);word(0x1CBC,seed%3*2);
 const entries=[0x12,0x4012,0x8012,0xC012];for(let i=0;i<8;i++){word(0x1F000+5*i,entries[(seed+i)%4]);word(0x1F002+5*i,0x0101);word(0x1F003+5*i,0x0101);}
 for(let i=0;i<8;i++)word(0x1F800+i*2,(seed+i)%3?i+1:0);
 wram[0x1F900+0x101]=seed%7;
 if(spec.entry===0x81801A){s.a=seed%2?rom[cpuToOffset(0x8BFD75+seed%6*3,rom.length)]:0xFE;s.y=seed;}
 if(spec.entry===0x818CE0){s.a=seed%4;word(0x1C980+s.a*2,seed&1?seed%4:0xFFFF);}
 if(spec.entry===0x818E57){
  const triples=[[0,0,0],[0x123,0,0],[0x123,0x456,0],[0x123,0x456,0x789],[0xFFFF,0xFFFF,0xFFFF]],v=triples[seed%5];
  v.forEach((n,i)=>word(0x1A+2*i,n));word(0xD6E8,0x40);
  for(let i=0;i<256;i++)word(0x1C780+2*i,0xFFFF);
  let sum=v[0]+v[1];sum=(sum&65535)+v[2]+Number(sum>65535);const hash=(sum&255)*2;
  if(seed%7){word(0x1C780+hash,0);const flip=seed&1?0x4000:0;
   for(let n=0;n<2;n++){v.forEach((value,i)=>word([0xA6A8,0xAEA8,0xB6A8][i]+2*n,value^flip^(n===0&&i===seed%3&&seed%7>1?1:0)));word(0xBEA8+2*n,n===0&&seed%7<6?2:0xFFFF);word(0xCEA8+2*n,seed);}
  }
 }
 if(spec.entry===0x818EDF){for(const x of [0,2,0x80,0x100,0xBBE])word(0x1CE14+x,0x101);}
 if(spec.entry===0x81940A){
  for(let x=0;x<0xC00;x+=2)word(0x10000+x,0xFFFF);
  for(const x of [0,2,0xBFE])word(0x10000+x,x%0x18);
  for(const y of [0,2,4,6,0x2FF8,0x2FFA,0x2FFC,0x2FFE])word(0x46A8+y,(seed%3?1:0)|(seed&1?0xC000:0));
  for(let i=0;i<8;i++){word(0xAEA8+i*2,seed%3?seed%5:0);word(0xB6A8+i*2,seed%4?seed%5:0);}
 }
 if(spec.entry===0x81A117){s.a=seed%8;word(0x1DA14,seed);wram[0x1DA16]=seed%6;wram[0x1DA17]=seed%2;wram[0x1DA18]=seed%2;wram[0x1DA19]=seed%2;}
 return s;
}
const stubRoutines=(spec,seed)=>new Map(spec.externalReturns.map(([target,op])=>[target,h=>{
 h.a.trace.push({kind:'scene-call',pc:target,address:h.ctx.x,value:h.ctx.a+h.ctx.y*65536});
 h.load(seed%7);return op==='RTL'?h.rtl():h.rts();
}]));
for(const [i,spec]of sceneLoadSpecs.entries())if(spec.entry!==0x81903E)test(`${spec.name}: synthetic branch equations and every own instruction`,()=>{
 const covered=new Set();for(let seed=0;seed<96;seed++){
  const s=synthetic(spec,seed),r=stubRoutines(spec,seed),result=compareDialog(maps[i],s,{root:spec.rootReturn,native:(h,e)=>SCENE_LOAD_ROUTINES.get(spec.entry)(h,e,r),calls:(a,e)=>external(a,e,maps[i],r)});
  assert.deepEqual(result.differences,[],`seed ${seed}`);for(const pc of result.visited)covered.add(pc);
 }assert.deepEqual([...maps[i].keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),[]);
});
function layerFixture(seed){
 const s=base(0x81903E,seed),{word,wram}=s;s.rom=rom.slice();
 const put=(at,bytes)=>s.rom.set(bytes,cpuToOffset(at,s.rom.length));
 const putWord=(at,n)=>put(at,[n&255,n>>>8&255]);
 word(0xE,0xF000);wram[0x10]=0x7F;word(0x17,1+(seed>>>8)%2);word(0x5C,0x46A8);word(0x20,0x40);word(0x65,seed&1?0x2000:0);
 // Explicitly synthetic data tables; executable ROM bytes remain unchanged.
 const flags=(seed%8)*0x2000;word(0x1F000,flags);wram[0x1F002]=seed%9===0?0xFF:0;wram[0x1F003]=0;wram[0x1F004]=0;
 wram.set(wram.subarray(0x1F000,0x1F005),0x1F005);
 putWord(0x8AC36A,0xF000);put(0x8AF000,[(seed>>>7)%3]);
 for(const at of [0x8AF001,0x8AF003])putWord(at,[0xEF40,0xCF40,0x2F40,0][(seed>>>3)%4]);
 putWord(0x8AF005,seed%10);for(const at of [0x8AF008,0x8AF00D]){putWord(at,seed&1?0x8000:0);putWord(at+2,seed&2?0x100:0);put(at+4,[0]);}
 put(0x96C3FA,[0x00,0xF8,0x7F]);
 wram[0x1F800]=seed%3===0?0x11:0;wram[0x1F801]=seed&4?0x80:0;
 let cursor=0x1F802;for(let i=0;i<4;i++){if(!(seed&4))wram[cursor++]=seed%10;word(cursor,seed%13===0?0:0x123+i);cursor+=2;}
 for(let at=0x46A8;at<0x76A8;at+=2)word(at,seed%7===0?0:1|([0,0x4000,0xC000][(seed>>>4)%3]));
 if(seed%11===0)for(let at=0x10000;at<0x10C00;at+=2)word(at,0xFFFF);
 for(let at=0x10C00;at<0x10C18;at+=6){const depths=[[0xFFFF,0xFFFF,0xFFFF],[0,0,0],[8,5,2],[2,5,8]][(seed>>>1)%4];depths.forEach((n,i)=>word(at+i*2,n));}
 word(0xA6AA,0x10);word(0xAEAA,(seed>>>5)%3?0x20:0);word(0xB6AA,(seed>>>5)%4?0x30:0);word(0xCEAA,seed%3===1?0:2);word(0xBEAA,seed&1?0xFFFF:4);word(0xC6AA,seed&2?0x8000:6);
 return s;
}
test('903E: synthetic clipping, both mirror axes, depth insertion and eviction agree with original instructions',()=>{
 const spec=sceneLoadSpecs.find(s=>s.entry===0x81903E),map=maps[sceneLoadSpecs.indexOf(spec)],covered=new Set();
 for(let seed=0;seed<1024;seed++){
  const s=layerFixture(seed),r=stubRoutines(spec,seed),result=compareDialog(map,s,{native:(h,e)=>SCENE_LOAD_ROUTINES.get(s.entry)(h,e,r),calls:(a,e)=>external(a,e,map,r)});
  assert.deepEqual(result.differences,[],`seed ${seed}`);for(const pc of result.visited)covered.add(pc);
 }
 // With 5F=0 the old stack has one or two words (Y=1/2). The search
 // increments X by two at most Y times, so X-56 <=4; CMP #6 cannot
 // fall through to the JMP at 9308. A full three-word stack sets 5F=3
 // and takes the separate eviction branch. This is a value invariant,
 // not a claim that the syntactic branch graph lacks that instruction.
 assert.deepEqual([...map.keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),['819308']);
 for(const [pc,op,value]of [[0x81926E,'LDY',3],[0x819271,'STY',0x5F],[0x819291,'LDY',2],[0x819294,'STZ',0x5F],[0x81929C,'LDY',1],[0x81929F,'STZ',0x5F],[0x8192AB,'INX',0],[0x8192AC,'INX',0],[0x8192AD,'DEY',0],[0x8192B4,'LDA',0x5F],[0x819303,'CMP',6]]){
  assert.equal(map.get(pc).mnemonic,op);assert.equal(map.get(pc).value,value);
 }
});
test('A117 reads a changed outer return frame freshly and its caller rejects the changed continuation',()=>{
 const spec=sceneLoadSpecs[0],s=synthetic(spec,1),mem=new DialogTestMemory(s.wram.slice()),a=new TaskAccessor({mem,a:s.a,x:s.x,y:s.y,s:0x1EF0,d:0,dbr:0x80,p:0,pc:0xA518});
 a.load();a.ctx.programBank=0x80;a.trace=[];a.devices={write(){}};const h=dialogAccess(a),r=stubRoutines(spec,1);
 r.set(0x81940A,h=>{h.write((h.ctx.s+4)&65535,0x1111,2);return h.rts();});
 assert.throws(()=>h.call(0x80A518,0x81A117,()=>loadScene(h,null,r),true),e=>e.reason==='task_native_helper_return_required'&&e.returnPc===0x1112);
 assert.equal(h.ctx.s,0x1EF0);assert.equal(h.ctx.programBank,0x80);
});
test('reference memory BIT takes N/V from the operand at its actual width; immediate BIT preserves N/V',()=>{
 const bit=union.get(0x81913D),immediate=union.get(0x81907E),ret=union.get(0x819409);
 for(const [instruction,status,value,a,expected]of [[bit,1,0xC000,1,0xC3],[bit,0x21,0xC000,1,0x23],[bit,0x21,0xC0,1,0xE3],[bit,0xC1,1,1,1],[immediate,0xC1,0,0,0xC3],[immediate,0xC1,0,0x80,0xC1]]){
  const mem=new DialogTestMemory(new Uint8Array(0x20000));mem.write16(instruction.value,value);mem.write16(0x1EEF,0x1234);
  const ctx={a,x:0,y:0,s:0x1EEE,d:0,bank:0x7E,status,programBank:0x81};
  const map=new Map([[instruction.cpu,instruction],[instruction.next,{...ret,cpu:instruction.next,next:instruction.next+1}]]);
  runReference(map,mem,ctx,{entry:instruction.cpu,root:'RTS'});assert.equal(ctx.status,expected);
 }
});
