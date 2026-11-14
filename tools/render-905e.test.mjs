import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRender905E, render905E } from '../proof/render/fields-905e.mjs';
import { render9022 } from '../proof/render/fields-9022.mjs';
import { fields9022Windows } from './render-9022-fixtures.mjs';
import { fields905EEntry as entry, fields905EFixture as fixture, fields905EBytes as fields,
  fields905EWindows as windows } from './render-905e-fixtures.mjs';
import { cpuToOffset } from './rom.mjs';
const prepare=(data,options={})=>prepareRender905E({...entry,data,...options});
const word=(data,address)=>data.readByte(address).value|data.readByte(address+1).value<<8;
const seed=(data,address,value)=>data.seed(address,[value&255,value>>>8]);
function unchanged(data,options,reason,phase){
  const before=data.snapshot(),p=prepare(data,options);assert.equal(p.handled,false,JSON.stringify(p));assert.equal(p.reason,reason);
  if(phase)assert.equal(p.compositionPhase,phase);
  for(const key of ['operations','ioWrites','byteWrites','readAddresses'])assert.equal(p[key],undefined);
  assert.deepEqual(data.snapshot(),before);return p;
}

test('Native905E pins46/16 root and real8FF5/A954 sources with5-byte proof separate from14 synthetic probes',async()=>{
  const rom=await readFile('Shadowrun (E).smc'),report=JSON.parse(await readFile('analysis/render-905e-native.json','utf8'));
  for(const[w,start,end,count,hash]of [[report.source,0x80905E,0x80908C,16,'14799593294dc957841fa1d1d40d8486be8aa914b113b79edd9d01901ae6ce16'],
    [report.helperSources[0],0x808FF5,0x809022,18,'c1fc51d93929dd0a4fbabfc2fd22a93230285adefc8ac7a669f178682e1a3f54'],
    [report.helperSources[1],0x81A954,0x81A958,2,'8dae4a16e8b1334cc47a0b132b15f9d2c934f3732b2d9d26199c3d78d597b0a2']]){
    const raw=rom.subarray(cpuToOffset(start,rom.length),cpuToOffset(end,rom.length));assert.equal(createHash('sha256').update(raw).digest('hex'),hash);
    assert.equal(w.machine_bytes,raw.toString('hex').toUpperCase());assert.equal(w.instruction_count,count);
  }
  assert.equal(report.stackProof.minimum_protected_stack_bytes,5);assert.equal(report.stackProof.external_return_assumptions,0);
  assert.match(report.scope,/synthetic/);assert.match(report.scope,/No CPU\/device/);
  assert.deepEqual(report.probes.map(p=>p.handled),[true,true,true,true,true,true,false,false,false,false,false,false,false,false]);
});

test('905E exactprefix/real8FF5/wait/field/selector/realA954 order uses16work12output and one outercommit',()=>{
  const data=fixture(),before=data.snapshot(),p=prepare(data);assert.ok(p.handled);assert.deepEqual(data.snapshot(),before);
  assert.equal(p.work,16);assert.equal(p.outputBytes,12);assert.equal(p.fieldOutputBytes,6);assert.equal(p.byteWrites.length,12);assert.equal(p.ioWrites.length,6);
  assert.deepEqual(p.operations.map(e=>[e.kind,e.space,e.address,e.value,e.bytes]),[
    ['write','data',0x800142,0xA1,2],['write','io',0x804305,0x1000,2],['write','io',0x804302,0x5250,2],
    ['write','io',0x804304,0x7F,1],['write','io',0x804301,0x18,1],['write','io',0x802115,0x80,1],['write','io',0x804300,1,1],
    ['write','data',0x800140,0x800,2],['write','external',0x800140,0x8001,2],['read','data',0x800140,0x8001,2],
    ['write','data',0x7E3D10,0x1A1A,2],['read','data',0x8001BA,0x80,2],['write','data',0x7E3D12,0x7480,2],
    ['write','data',0x7E3F08,0x28,2],['read','data',0x801562,0xFFFF,2],['write','data',0x801562,0,2]]);
  assert.ok(p.operations.every(Object.isFrozen));assert.equal(p.a,0x28);assert.equal(p.x,0x800);assert.equal(p.y,entry.y);assert.equal(p.status,0x46);
  assert.equal(p.previous,0xFFFF);assert.equal(p.value,0);assert.equal(p.observed,0x8001);assert.equal(p.polls,1);
  assert.deepEqual(data.commit(p),{handled:true});assert.equal(word(data,0x142),0xA1);assert.equal(word(data,0x1562),0);
});

test('905E all65536 selectors requirefullWORD but isolate onlybit7 with exact3480/7480 and C0',()=>{
  const data=fixture({value:0});for(let selector=0;selector<65536;selector++){
    seed(data,0x1BA,selector);const p=prepare(data);assert.ok(p.handled);assert.equal(p.selector,selector);
    assert.equal(p.fieldWord,selector&128?0x7480:0x3480);assert.equal(p.carry,0);assert.equal(p.status,0x44);
    assert.equal(p.operations[11].bytes,2);assert.equal(p.operations[12].value,selector&128?0x7480:0x3480);
  }
});

test('905E all65536 gatewords use actualA954 carry/wrap and finalmemoryNZ while retainingA0028/X0800',()=>{
  const data=fixture();for(let value=0;value<65536;value++){
    seed(data,0x1562,value);const p=prepare(data);assert.ok(p.handled);assert.equal(p.previous,value);assert.equal(p.value,(value+1)&65535);
    assert.equal(p.a,0x28);assert.equal(p.x,0x800);assert.equal(p.status,0x44|(value===65535?2:0)|(value>=32767&&value<65535?128:0));
    assert.deepEqual(p.byteWrites.slice(-2),[[0x7E1562,(value+1)&255],[0x7E1563,((value+1)&65535)>>>8]]);
  }
});

test('905E all32768 negativepolls return beforefields with fixedregisters, no hiddenpollA leaks',()=>{
  const data=fixture();for(let observed=32768;observed<65536;observed++){
    const p=prepare(data,{waitRead0140:[observed]});assert.ok(p.handled);assert.equal(p.observed,observed);
    assert.equal(p.work,16);assert.equal(p.a,0x28);assert.equal(p.x,0x800);assert.equal(p.status,0x46);assert.equal(p.operations[10].value,0x1A1A);
  }
});

test('905E all32768 nonnegativepolls includingzero hold allfields and gateincrement back',()=>{
  const data=fixture(),before=data.snapshot();for(let observed=0;observed<32768;observed++){
    const p=prepare(data,{waitRead0140:[observed]});assert.equal(p.handled,false);assert.equal(p.reason,'render_wait_read_required');
    assert.equal(p.compositionPhase,'setupWait');assert.equal(p.calleeCaller,'8FF5');assert.equal(p.polls,1);assert.equal(p.byteWrites,undefined);
  }assert.deepEqual(data.snapshot(),before);
});

test('905E 65536 changingpositive observations and finalnegative retain fulltranscript and late atomicity',()=>{
  const data=fixture(),waitRead0140=[...Array.from({length:65536},(_,n)=>n&1),0x8001],p=prepare(data,{waitRead0140,maxWork:131088});
  assert.ok(p.handled);assert.equal(p.polls,65537);assert.equal(p.work,131088);assert.equal(p.operations.length,131088);assert.equal(p.outputBytes,12);
  assert.equal(p.operations.at(-1).address,0x801562);unchanged(data,{waitRead0140,maxWork:131087},'render_work_budget_required','increment');
});

test('905E all256 DBRs use130 realWRAM sources and fixed7Efields;126 fail atprefix without IO assumptions',()=>{
  for(let bank=0;bank<256;bank++){
    const data=fixture({bank,value:0xFF}),before=data.snapshot(),p=prepare(data,{bank});
    if(!(bank&0x40)||bank===0x7E||bank===0x7F){
      assert.ok(p.handled);assert.equal(p.bank,bank);assert.equal(p.outputBytes,[0x7E,0x7F].includes(bank)?20:12);
      assert.equal(p.ioWrites.length,[0x7E,0x7F].includes(bank)?0:6);assert.equal(p.fieldWord,0x7480);
      assert.deepEqual(data.snapshot(),before);assert.deepEqual(data.commit(p),{handled:true});
      assert.equal(word(data,bank===0x7F?0x7F1562:0x7E1562),0x100);assert.equal(word(data,0x7E3D10),0x1A1A);assert.equal(word(data,0x7E3D12),0x7480);
    }else {assert.equal(p.handled,false);assert.equal(p.reason,'render_address_required');assert.equal(p.compositionPhase,'prefix');assert.deepEqual(data.snapshot(),before);}
  }
});

test('905E everyadmissible status preservesV/I withC0 and INCmemoryNZ, including unknownY',()=>{
  for(let status=0;status<256;status++)if(!(status&0x38))for(const value of [0,0x7FFF,0xFFFE,0xFFFF]){
    const p=prepare(fixture({value}),{status,y:null});assert.ok(p.handled);assert.equal(p.status&0x7D,status&0x7C);
    assert.equal(p.y,null);assert.equal(p.carry,0);assert.equal(p.overflow,status>>>6&1);
    assert.equal(Boolean(p.status&2),value===65535);assert.equal(Boolean(p.status&128),value>=32767&&value<65535);
  }
});

test('905E exactfield/metadata/gatebytes preserve all other65536 bytes in surrounding7Ebank',()=>{
  const data=fixture(),initial=Uint8Array.from({length:65536},(_,n)=>(n*13+(n>>>8)*37)&255);data.seed(0x7E0000,initial);
  seed(data,0x1BA,0x80);seed(data,0x1562,0xFFFF);const p=prepare(data);assert.ok(p.handled);
  const expected=new Map([[0x140,1],[0x141,0x80],[0x142,0xA1],[0x143,0],[0x3D10,0x1A],[0x3D11,0x1A],
    [0x3D12,0x80],[0x3D13,0x74],[0x3F08,0x28],[0x3F09,0],[0x1562,0],[0x1563,0],[0x1BA,0x80],[0x1BB,0]]);
  assert.deepEqual(data.commit(p),{handled:true});for(let a=0;a<65536;a++)assert.equal(data.readByte(0x7E0000+a).value,expected.get(a)??initial[a]);
});

test('905E no initial0140/0142/field/setupbytes required; knownselector and gate are required',()=>{
  const p=prepare(fixture());assert.ok(p.handled);assert.deepEqual(p.readAddresses,[0x7E0140,0x7E0141,0x7E01BA,0x7E01BB,0x7E1562,0x7E1563]);
  unchanged(fixture({selector:null}),{},'render_source_required','selector');unchanged(fixture({value:null}),{},'render_source_required','increment');
  for(const missing of [0x7E01BA,0x7E01BB,0x7E1562,0x7E1563]){
    const full=fixture().snapshot(),data=createRenderData({writeWindows:full.writeWindows});for(const[a,v]of full.bytes)if(a!==missing)data.seed(a,[v]);
    assert.equal(unchanged(data,{},'render_source_required').address,missing);
  }
});

test('905E preexistingnegative0140 overwritten by0800; no observation means boundedpositive wait',()=>{
  for(const initial of [null,0,0x8000,0xFFFF]){
    const data=fixture({initial}),p=prepare(data,{waitRead0140:[0x800,0x8001]});assert.ok(p.handled);assert.equal(p.work,17);
    assert.deepEqual(p.operations.slice(7,11).map(e=>[e.kind,e.space,e.value]),[['write','data',0x800],['read','data',0x800],['write','external',0x8001],['read','data',0x8001]]);
    unchanged(data,{waitRead0140:null,maxWork:20},'render_work_budget_required','setupWait');
  }
});

test('905E freshwait modes/shortstreams stopatomically; trailing observations after actualreturn untouched',()=>{
  unchanged(fixture(),{waitMode:null},'render_wait_context_required','setupWait');unchanged(fixture(),{waitRead0140:[]},'render_wait_read_required','setupWait');
  const p=prepare(fixture(),{waitRead0140:[0x8000,0,0]});assert.ok(p.handled);assert.equal(p.waitPolls0140,1);assert.equal(p.polls,1);
});

test('905E every12 actualoutputbyte requireswindow; late1563 failure withholds all metadata/fields',()=>{
  const p=prepare(fixture());assert.ok(p.handled);for(const[missing]of p.byteWrites){
    const writeWindows=p.byteWrites.filter(([a])=>a!==missing).map(([a])=>[a,a]);
    const q=unchanged(fixture({writeWindows}),{},'render_write_window_required');assert.equal(q.address,missing);
    if(missing===0x7E1563){assert.equal(q.compositionPhase,'increment');assert.equal(q.calleeCaller,'A954');}
  }
});

test('905E physicalsetupbanks need all8 extra writablebytes and no IOmode; systembanks require requests',()=>{
  for(const bank of [0x7E,0x7F]){
    const p=prepare(fixture({bank}),{bank,ioMode:null});assert.ok(p.handled);assert.equal(p.outputBytes,20);
    for(const[missing]of p.byteWrites.filter(([a])=>((a&65535)===0x2115)||(a&65535)>=0x4300&&(a&65535)<=0x4306)){
      const writeWindows=p.byteWrites.filter(([a])=>a!==missing).map(([a])=>[a,a]);assert.equal(unchanged(fixture({bank,writeWindows}),{bank,ioMode:null},'render_write_window_required','setupWait').address,missing);
    }
  }unchanged(fixture(),{ioMode:null},'render_io_context_required','setupWait');
});

test('905E allwork/outputbudget prefixes fail atomically with exact16/12 and16/20 success thresholds',()=>{
  for(const bank of [0x80,0x7E,0x7F]){
    const total=bank===0x80?12:20;
    for(let maxWork=1;maxWork<16;maxWork++)unchanged(fixture({bank}),{bank,maxWork},'render_work_budget_required');
    for(let maxOutputBytes=1;maxOutputBytes<total;maxOutputBytes++)unchanged(fixture({bank}),{bank,maxOutputBytes},'render_output_budget_required');
    assert.ok(prepare(fixture({bank}),{bank,maxWork:16,maxOutputBytes:total}).handled);
  }
});

test('905E protects5 stackbytes at every reachedphysicalsource/store;7Fmetadata can be disjoint from7Estack',()=>{
  unchanged(fixture(),{stackWindow:[0x1FFC,0x1FFF]},'render_stack_required');assert.ok(prepare(fixture(),{stackWindow:[0x1FFB,0x1FFF]}).handled);
  for(const a of [0x140,0x141,0x142,0x143,0x1BA,0x1BB,0x1562,0x1563,...fields.map(a=>a&65535)])
    unchanged(fixture(),{stackWindow:[a,a+4]},'render_stack_alias_required');
  assert.ok(prepare(fixture({bank:0x7F}),{bank:0x7F,stackWindow:[0x1561,0x1565]}).handled);
});

test('905E two realinnercalls share chronologicalpollcursor/freshgate and one outercommit',()=>{
  const data=fixture({value:0xFFFE}),before=data.snapshot(),view=prepareRenderView(data),budget={work:0,maxWork:35,outputBytes:0,maxOutputBytes:24};
  const context={...entry,waitRead0140:[0,0x8000,0x800,0x8001],observations:{}};
  const first=render905E(view,context,budget),second=render905E(view,{...context,status:first.status},budget);
  assert.equal(first.previous,0xFFFE);assert.equal(first.value,0xFFFF);assert.equal(second.previous,0xFFFF);assert.equal(second.value,0);
  assert.equal(first.polls,2);assert.equal(second.polls,2);assert.equal(second.waitPolls0140,4);assert.equal(second.work,35);assert.equal(second.outputBytes,24);
  assert.equal(second.status,0x46);assert.deepEqual(data.snapshot(),before);assert.throws(()=>data.commit(first));assert.throws(()=>data.commit(second));
  assert.deepEqual(data.commit(view.finish(second)),{handled:true});assert.equal(word(data,0x1562),0);
});

test('905E secondinner latebudget or missingsecondnegative withholds preceding successfulcall',()=>{
  for(const[maxWork,maxOutputBytes,waitRead0140,reason]of [[31,24,[0x8000,0x8001],'render_work_budget_required'],
    [32,23,[0x8000,0x8001],'render_output_budget_required'],[32,24,[0x8000,0],'render_wait_read_required']]){
    const data=fixture(),before=data.snapshot(),view=prepareRenderView(data),budget={work:0,maxWork,outputBytes:0,maxOutputBytes},context={...entry,waitRead0140,observations:{}};
    const first=render905E(view,context,budget);assert.ok(first.handled);assert.throws(()=>render905E(view,context,budget),e=>e.reason===reason);
    assert.deepEqual(data.snapshot(),before);assert.throws(()=>data.commit(first));
  }
});

test('905E precedingouter highbyte/selectorwrites are fresh and inheritedbudgets retained',()=>{
  const data=fixture({value:0xFF,writeWindows:[...windows(),[0x7E01BA,0x7E01BB]]}),before=data.snapshot(),view=prepareRenderView(data);
  view.write(0x1BA,0);view.write(0x1563,0x7F);const p=render905E(view,entry,{work:7,maxWork:23,outputBytes:5,maxOutputBytes:17});
  assert.equal(p.selector,0);assert.equal(p.fieldWord,0x3480);assert.equal(p.previous,0x7FFF);assert.equal(p.value,0x8000);assert.equal(p.status,0xC4);
  assert.equal(p.work,23);assert.equal(p.outputBytes,17);assert.deepEqual(data.snapshot(),before);assert.deepEqual(data.commit(view.finish(p)),{handled:true});
});

test('905E actual9022 then905E sharefieldalias and waitcursor; lateincrement failure withholds both',()=>{
  // Synthetic outercaller joins two real source operations, not original936C execution.
  for(const late of [false,true]){
    const writeWindows=[...fields9022Windows(),...windows()].flatMap(([a,b])=>late&&a<=0x7E1563&&b>=0x7E1563?[[a,0x7E1562]]:[[a,b]]);
    const data=fixture({writeWindows}),before=data.snapshot(),view=prepareRenderView(data),budget={work:0,maxWork:172,outputBytes:0,maxOutputBytes:180},context={...entry,waitRead0140:[0x8000,0x8001],observations:{}};
    const first=render9022(view,context,budget);assert.equal(view.read(0x7E3F08),0);assert.equal(first.outputBytes,168);
    if(late){assert.throws(()=>render905E(view,context,budget),e=>e.reason==='render_write_window_required'&&e.address===0x7E1563);assert.deepEqual(data.snapshot(),before);}
    else{const p=render905E(view,context,budget);assert.equal(p.work,172);assert.equal(p.outputBytes,180);assert.equal(p.waitPolls0140,2);assert.equal(view.read(0x7E3F08),0x28);
      assert.deepEqual(data.snapshot(),before);assert.deepEqual(data.commit(view.finish(p)),{handled:true});assert.equal(word(data,0x7E3F08),0x28);assert.equal(word(data,0x142),0xA1);}
    assert.throws(()=>data.commit(first));
  }
});

test('905E foreign/copied/stale plans rejected and successfulplan hasone application',()=>{
  const data=fixture(),p=prepare(data),other=fixture(),before=other.snapshot();assert.throws(()=>other.commit(p));assert.deepEqual(other.snapshot(),before);assert.throws(()=>data.commit({...p}));
  assert.deepEqual(data.commit(p),{handled:true});const applied=data.snapshot();assert.deepEqual(data.commit(p),{handled:false,reason:'render_plan_stale'});assert.deepEqual(data.snapshot(),applied);
  const q=prepare(data);seed(data,0x1562,0xABCD);const changed=data.snapshot();assert.deepEqual(data.commit(q),{handled:false,reason:'render_plan_stale'});assert.deepEqual(data.snapshot(),changed);
});

test('905E entry/width/decimal/DP/stack and malformedregister/mode/observation/budget reject explicitly',()=>{
  for(const options of [{bank:null},{status:null},{status:0x20},{status:0x10},{status:8},{emulation:1},{directPage:1}])unchanged(fixture(),options,'render_entry_required');
  for(const stackWindow of [null,[1],[3,2],[-1,4]])unchanged(fixture(),{stackWindow},'render_stack_required');
  for(const options of [{y:-1},{y:65536},{bank:256},{status:256},{maxWork:0},{maxOutputBytes:0},{data:null},
    {ioMode:'automatic'},{waitMode:'automatic'},{waitRead0140:[-1]},{waitRead0140:[65536]},{waitRead0140:new Array(2)}]){
    const data=fixture(),before=data.snapshot();assert.throws(()=>prepare(data,options));assert.deepEqual(data.snapshot(),before);
  }
});
