import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderC152, renderC152 } from '../proof/render/callback-c152.mjs';
import { callbackEntry as entry, callbackFixture as fixture } from './render-c152-fixtures.mjs';

const prepare = (data, options={}) => prepareRenderC152({...entry,data,...options});
const word = (d,a) => d.readByte(a).value | d.readByte(a+1).value<<8;
const seedWord = (d,a,v) => d.seed(a,[v&255,v>>>8]);
const commit = (d,p) => { assert.ok(p.handled,JSON.stringify(p)); assert.deepEqual(d.commit(p),{handled:true}); };
function unchanged(d,options,reason,callee,phase) {
  const before=d.snapshot(),p=prepare(d,options); assert.equal(p.handled,false); assert.equal(p.reason,reason);
  if (callee!==undefined) assert.equal(p.callee,callee); if (phase) assert.equal(p.phase,phase);
  for (const key of ['operations','ioWrites','ioReads','byteWrites','calls']) assert.equal(p[key],undefined);
  assert.deepEqual(d.snapshot(),before); return p;
}
const order=['8949','A9E1','999A','80C4','A919','A958','A98E','8FBA','9E0B','C06B','B0D1'];

test('C152 eight reproducible probes separate synthetic plans from original1027/419 graph',async()=>{
  const report=JSON.parse(await readFile(new URL('../analysis/render-c152-native.json',import.meta.url),'utf8'));
  assert.equal(report.graphBytes,1027);assert.equal(report.graphInstructions,419);assert.equal(report.probes.length,8);assert.match(report.scope,/synthetic/);
  for(const old of report.probes){ const f=old.fixture,d=fixture(f);assert.deepEqual(prepare(d,{bank:f.bank,ioRead4212:f.ioRead4212??entry.ioRead4212,
    ioMode:[0x7E,0x7F].includes(f.bank)?null:'record-requests'}),Object.fromEntries(Object.entries(old).filter(([k])=>k!=='fixture'))); }
});
test('Inactive callback still polls input, runs OAMtail and five tail writes after initial blank',()=>{
  const d=fixture(),before=d.snapshot(),p=prepare(d);assert.deepEqual(d.snapshot(),before);
  assert.deepEqual(p.calls.map(c=>c.callee),order);assert.equal(p.work,33);assert.equal(p.a,128);assert.equal(p.x,0);assert.equal(p.y,0xBEEF);assert.equal(p.status,0xC5);
  assert.deepEqual(p.ioWrites.map(e=>[e.address&65535,e.value,e.bytes]),[[0x2100,128,1],[0x2102,0,2],[0x2104,18,1],[0x2104,240,1],
    [0x2100,143,1],[0x212C,4,1],[0x212D,1,1],[0x212E,2,1],[0x420C,128,1]]);
  assert.deepEqual(p.byteWrites,[[0x7E01CA,0x5A],[0x7E01CB,0xA5]]);commit(d,p);assert.equal(word(d,0x1CA),0xA55A);
});
test('Active call order propagates real registers/status and shares one cumulative budget',()=>{
  const p=prepare(fixture({active:true}));assert.ok(p.handled);assert.equal(p.work,180);assert.equal(p.ioWrites.length,104);
  assert.deepEqual(p.calls.map(c=>[c.callee,c.work,c.a,c.status]),[
    ['8949',38,0x0201,0x45],['A9E1',35,0x2A20,5],['999A',14,0xBB,0x84],['80C4',11,0,6],
    ['A919',8,0x10,0x84],['A958',12,0x4002,0x84],['A98E',6,0x8004,4],['8FBA',12,0xFFFF,0x85],
    ['9E0B',4,0xA55A,0x85],['C06B',21,0x30,5],['B0D1',8,1,4]]);
  let work=1;for(const c of p.calls){assert.equal(c.workBefore,work);work+=c.work;assert.equal(c.workAfter,work);}
  assert.equal(p.a,128);assert.equal(p.x,0x8000);assert.equal(p.y,0xFFFE);assert.equal(p.status,0x84);
});
test('List consumers see1562 before A98Eclear; tail sees B0D1 brightness update',()=>{
  const d=fixture({active:true}),p=prepare(d);
  assert.deepEqual(p.operations.filter(e=>(e.address&65535)===0x1562).map(e=>[e.callee,e.kind,e.value]),
    [['8949','read',1],['A919','read',1],['A958','read',1],['A98E','read',1],['A98E','write',0]]);
  assert.deepEqual(p.operations.slice(-10).map(e=>[e.kind,e.address&65535,e.value,e.bytes]),
    [[0x1BC,0x2100,1],[0x1BE,0x212C,4],[0x1C0,0x212D,1],[0x1C2,0x212E,2],[0x1C4,0x420C,128]].flatMap(([r,w,v])=>[['read',r,v,1],['write',w,v,1]]));
  commit(d,p);for(const a of [0xCD0,0xCD6,0x1F8,0x1FA,0x1FC,0xD0E,0x1CDA,0x1562,0x1E8])assert.equal(word(d,a),0);
  assert.equal(word(d,0x1F6),1); // A9E1 intentionally does not clear this persistent gate.
  assert.equal(word(d,0x140),65535);assert.equal(word(d,0x1C8),1);assert.equal(d.readByte(0x1BC).value,1);
});
test('All tail BYTE values retain B0D1 highA but compute BYTE NZ after REP20',()=>{
  const d=fixture({active:true});seedWord(d,0x1C6,0x8000);d.seed(0x1BC,[0x80]);
  for(let value=0;value<256;value++){d.seed(0x1C4,[value]);const p=prepare(d);assert.ok(p.handled);assert.equal(p.a,0x8000|value);
    assert.equal(p.status,5|(value&128)|(value===0?2:0));assert.equal(p.overflow,0);assert.equal(p.carry,1);}
});
test('Inactive paths preserve every valid incoming C/V/I through callback tail',()=>{
  for(let status=0;status<256;status++){if(status&0x38)continue;const p=prepare(fixture(),{status});
    assert.ok(p.handled);assert.equal(p.status,(status&0x45)|128);}
});
test('All128 systembanks preserve CPU request addresses and physical7E/7F commit register bytes',()=>{
  for(let bank=0;bank<256;bank++){if(bank&0x40 && ![0x7E,0x7F].includes(bank))continue;
    const physical=[0x7E,0x7F].includes(bank),d=fixture({active:true,bank}),p=prepare(d,{bank,ioMode:physical?null:'record-requests'});
    assert.ok(p.handled,JSON.stringify(p));assert.equal(p.work,physical?179:180);assert.equal(p.ioWrites.length,physical?0:104);
    if(!physical)assert.ok(p.ioWrites.every(e=>e.address>>>16===bank));commit(d,p);
    if(physical){const base=bank*65536;assert.equal(d.readByte(base+0x2100).value,1);assert.equal(word(d,base+0x4302),0xFB78);
      assert.equal(d.readByte(base+0x420C).value,128);assert.equal(d.readByte(base+0x2104).value,48);}
  }
});
test('Every lower active budget withholds all earlier requests and writes; exact180 succeeds',()=>{
  const d=fixture({active:true});for(let maxWork=1;maxWork<180;maxWork++)unchanged(d,{maxWork},'render_work_budget_required');
  assert.equal(prepare(d,{maxWork:180}).work,180);
});
test('Budget exhaustion names each reached callee and late tail without a partial plan',()=>{
  const d=fixture({active:true}),p=prepare(d);for(const c of p.calls)unchanged(d,{maxWork:c.workBefore},'render_work_budget_required',c.callee);
  unchanged(d,{maxWork:179},'render_work_budget_required',null,'tail');
});
test('Missing each fresh tail source rolls back earlier gateclears, capture and fade',()=>{
  for(const offset of [0x1BE,0x1C0,0x1C2,0x1C4])unchanged(fixture({active:true,missing:[0x800000+offset]}),{},'render_source_required',null,'tail');
  unchanged(fixture({missing:[0x8001BC]}),{},'render_source_required',null,'tail');
});
test('Late poll/capture and fade failures withhold all preceding callee effects',()=>{
  for(const options of [{ioRead4212:null},{ioRead4212:[1]},{ioRead4218:null}])unchanged(fixture({active:true}),options,'render_io_read_required','9E0B');
  unchanged(fixture({active:true,missing:[0x8001C8]}),{},'render_source_required','B0D1');
});
test('Every initially present reached sourcebyte is required or replaced by an earlier overlay write',()=>{
  const d=fixture({active:true}),p=prepare(d),initial=new Map(d.snapshot().bytes);let checked=0;
  for(const a of p.readAddresses){if(!initial.has(a))continue;const cpu=a>=0x7E0000&&a<0x7E2000?0x800000+(a&65535):a;
    const earlierWrite=p.operations.find(e=>e.space==='data'&&e.kind==='write'&&((e.address&65535)===(a&65535)));
    const firstRead=p.operations.find(e=>e.space==='data'&&e.kind==='read'&&e.address<=cpu&&e.address+e.bytes>cpu);
    if(earlierWrite&&p.operations.indexOf(earlierWrite)<p.operations.indexOf(firstRead))continue;
    // DP00 sources are distinct from DBR addresses in the fixture seed list.
    const missing=cpu===0x800082||cpu===0x800083||cpu===0x8000F6||cpu===0x8000F7||cpu===0x8000F8?cpu&65535:cpu;
    const failure=unchanged(fixture({active:true,missing:[missing]}),{},'render_source_required');assert.equal(failure.address,a);checked++;
  }assert.ok(checked>50);
});
test('Physical late register write ownership failures discard initial blank and all previous stores',()=>{
  const base=0x7F0000,normal=fixture({active:true,bank:0x7F}).snapshot().writeWindows;
  for(const target of [0x212C,0x212D,0x212E,0x420C]){
    const address=base+target,windows=normal.flatMap(([lo,hi])=>address<lo||address>hi?[[lo,hi]]:[[lo,address-1],[address+1,hi]].filter(([a,b])=>a<=b));
    unchanged(fixture({active:true,bank:0x7F,writeWindows:windows}),{bank:0x7F,ioMode:null},'render_write_window_required',null,'tail');
  }
});
test('Six stackbytes cover nested calls; every declared source alias is excluded atomically',()=>{
  assert.ok(prepare(fixture(),{stackWindow:[0x1FFA,0x1FFF]}).handled);
  for(const stackWindow of [null,[0x1FFB,0x1FFF]])unchanged(fixture(),{stackWindow},'render_stack_required');
  for(const stackWindow of [[0xCD8,0xCDD],[0x82,0x87],[0x1CA,0x1CF],[0x1BF,0x1C4]])unchanged(fixture({active:true}),{stackWindow},'render_stack_alias_required');
});
test('213A is required only if reached; chronological WORDpoll stops at first bit0 clear',()=>{
  assert.ok(prepare(fixture(),{ioRead213A:null,ioRead4212:[0,1,1]}).handled);
  unchanged(fixture({active:true}),{ioRead213A:null},'render_io_read_required','A9E1');
  const p=prepare(fixture(),{ioRead4212:[0xFFFF,0x100,1],ioRead4218:0xFFFF});assert.ok(p.handled);
  assert.deepEqual(p.ioReads.map(e=>[e.address&65535,e.value,e.bytes]),[[0x4212,65535,2],[0x4212,256,2],[0x4218,65535,2]]);
});
test('Invalid entry and malformed IO context stop before any prepared prefix',()=>{
  for(const options of [{bank:null},{status:null},{status:32},{status:16},{status:8},{emulation:1},{directPage:1}])unchanged(fixture(),options,'render_entry_required');
  unchanged(fixture(),{ioMode:null},'render_io_context_required',null,'prologue');unchanged(fixture(),{bank:0x40},'render_address_required',null,'prologue');
  for(const options of [{x:-1},{y:65536},{maxWork:0},{ioRead213A:256},{ioRead4212:[undefined]},{ioRead4218:65536}])assert.throws(()=>prepare(fixture(),options));
});
test('Outer writes feed fresh callback sources and only outer finish creates commit payload',()=>{
  const d=fixture(),view=prepareRenderView(d,[0x7E1F00,0x7E1FFF]),budget={work:0,maxWork:100};
  view.write(0x1CA,255);const inner=renderC152(view,entry,budget);assert.equal(inner.work,33);assert.throws(()=>d.commit(inner));
  commit(d,view.finish(inner));assert.equal(word(d,0x1CA),0xA55A);
});
test('Public plans are immutable and owner/revision bound including aggregate callee metadata',()=>{
  const d=fixture(),p=prepare(d);assert.throws(()=>fixture().commit(p));assert.ok(Object.isFrozen(p.calls[0]));assert.ok(Object.isFrozen(p.operations[0]));
  assert.throws(()=>{p.byteWrites[0][1]=0;});d.seed(0x1C4,[0]);assert.deepEqual(d.commit(p),{handled:false,reason:'render_plan_stale'});
  const a=prepare(d),b=prepare(d);commit(d,a);assert.deepEqual(d.commit(b),{handled:false,reason:'render_plan_stale'});
});
test('Repeated manual callbacks consume prior committed clears and countdown without a frame clock',()=>{
  const d=fixture({active:true}),first=prepare(d);commit(d,first);const second=prepare(d);assert.ok(second.handled);
  assert.equal(second.calls.find(c=>c.callee==='999A').work,1);assert.equal(second.calls.find(c=>c.callee==='A98E').work,1);
  assert.equal(second.calls.find(c=>c.callee==='B0D1').a,2);commit(d,second);assert.equal(d.readByte(0x1BC).value,2);
});
test('Full32768-record child aggregation exceeds JS argument limits while retaining one atomic owner',()=>{
  const d=createRenderData({writeWindows:[[0x7F2000,0x7F43FF],[0x7F0D0E,0x7F0D0F],[0x7F01CA,0x7F01CB]]});
  d.seed(0x7F0000,new Uint8Array(65536));d.seed(0x800000,new Uint8Array(0xD00));
  seedWord(d,0x7F0CD8,1);seedWord(d,0x7F0D0E,1);seedWord(d,0x7F0D10,0x8000);seedWord(d,0x7F0140,65535);
  const before=d.snapshot(),p=prepare(d,{bank:0x7F,ioMode:null});assert.ok(p.handled,JSON.stringify(p));assert.ok(p.operations.length>196608);
  assert.equal(p.calls.find(c=>c.callee==='999A').operationCount,196616);assert.deepEqual(d.snapshot(),before);commit(d,p);
});
