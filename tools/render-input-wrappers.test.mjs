import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderF290, prepareRenderF298, renderF290, renderF298 } from '../proof/render/input-wrappers.mjs';
const entry={bank:0x80,status:0xC5,x:0x34,y:0x56,emulation:0,directPage:0,stackWindow:[0x1F00,0x1FFF],ioMode:'record-requests',ioRead4212:[0],ioRead4218:0x8000};
const word=(d,a)=>d.readByte(a).value|d.readByte(a+1).value<<8;
const seed=(d,a,v)=>d.seed(a,[v&255,v>>>8]);
function fixture(current=0x8000,previous=0,bank=0x80,windows=null){
  const base=bank*65536,owner=bank===0x7F?0x7F0000:0x7E0000,d=createRenderData({writeWindows:windows??[[owner+0x1CA,owner+0x1CF]]});
  seed(d,base+0x1CA,current);seed(d,base+0x1CC,previous);
  if([0x7E,0x7F].includes(bank)){seed(d,base+0x4212,0);seed(d,base+0x4218,current);}return d;
}
const prepare=(fn,data,opts={})=>fn({...entry,data,...opts});
function fail(fn,d,opts,reason,phase){const before=d.snapshot(),p=prepare(fn,d,opts);assert.equal(p.handled,false);assert.equal(p.reason,reason);if(phase)assert.equal(p.phase,phase);
  for(const key of ['operations','byteWrites','ioReads','ioWrites'])assert.equal(p[key],undefined);assert.deepEqual(d.snapshot(),before);return p;}
test('All128 binarynative statuses restoreP exactly for captureandconsume with full A',()=>{
  for(let status=0;status<256;status++){if(status&8)continue;
    for(const fn of [prepareRenderF290,prepareRenderF298])for(const current of [0,1,0x8000,0xFFFF]){
      const p=prepare(fn,fixture(current),{status,ioRead4218:current});assert.ok(p.handled);assert.equal(p.status,status);assert.equal(p.x,0x34);assert.equal(p.y,0x56);
      assert.equal(p.a,fn===prepareRenderF290?current:current%16);assert.equal(p.carry,status&1);assert.equal(p.overflow,status>>>6&1);
      assert.equal(p.childStatus&0x30,0);
    }
  }
});
test('IncomingBYTEA still pollsandcaptures WORD4212/4218, retainsB and originalN/Z',()=>{
  const d=fixture(),p=prepare(prepareRenderF290,d,{status:0x32,ioRead4212:[0xFFFF,0xFFFE],ioRead4218:0xABCD});
  assert.ok(p.handled);assert.equal(p.a,0xABCD);assert.equal(p.status,0x32);assert.equal(p.childStatus,0x80);assert.equal(p.polls,2);
  assert.deepEqual(p.ioReads.map(e=>[e.value,e.bytes]),[[0xFFFF,2],[0xFFFE,2],[0xABCD,2]]);assert.deepEqual(d.commit(p),{handled:true});assert.equal(word(d,0x1CA),0xABCD);
});
test('Consumewrapper restoresincomingC/N/Z evenwhenchildCMPandnibble disagree',()=>{
  for(const [current,status]of [[0,0xB1],[0x8001,0x72],[0x8000,0x80]]){
    const d=fixture(current,0),p=prepare(prepareRenderF298,d,{status});assert.ok(p.handled);assert.equal(p.status,status);assert.notEqual(p.status,p.childStatus);
    assert.deepEqual(d.commit(p),{handled:true});assert.equal(word(d,0x1CC),current);assert.equal(word(d,0x1CA),current%16?0:current);
  }
});
test('WORDindices arepreserved, BYTEindexcontext cannot invent nonzerohighbytes',()=>{
  for(const fn of [prepareRenderF290,prepareRenderF298]){
    const p=prepare(fn,fixture(),{status:0x20,x:0xABCD,y:0xBEEF});assert.equal(p.x,0xABCD);assert.equal(p.y,0xBEEF);
    for(const opts of [{status:0x10,x:256},{status:0x30,y:65535}])fail(fn,fixture(),opts,'render_index_width_required');
    assert.ok(prepare(fn,fixture(),{status:0x30,x:255,y:0}).handled);
    assert.ok(prepare(fn,fixture(),{status:0x30,x:null,y:null}).handled);
  }
});
test('Sixprotectedbytes coverrootJSL/PHP/JSR; missingstackand latealiases reject',()=>{
  for(const fn of [prepareRenderF290,prepareRenderF298]){
    assert.ok(prepare(fn,fixture(),{stackWindow:[0x1FFA,0x1FFF]}).handled);
    for(const stackWindow of [null,[0x1FFB,0x1FFF]])fail(fn,fixture(),{stackWindow},'render_stack_required');
    fail(fn,fixture(),{stackWindow:[0x1CA,0x1CF]},'render_stack_alias_required');
  }
});
test('Physical7E/7F captureandconsume share actualWORDbytes and restoredBYTEstatus',()=>{
  for(const bank of [0x7E,0x7F])for(const fn of [prepareRenderF290,prepareRenderF298]){
    const d=fixture(0x8001,0,bank),p=prepare(fn,d,{bank,status:0xF7,ioMode:null,ioRead4218:0});assert.ok(p.handled);assert.equal(p.status,0xF7);
    assert.deepEqual(p.ioReads,[]);assert.deepEqual(p.ioWrites,[]);assert.deepEqual(d.commit(p),{handled:true});
    assert.equal(word(d,bank*65536+0x1CA),fn===prepareRenderF290?0x8001:0);
  }
});
test('Capture transcript limits and latewriteownership discard allrequests',()=>{
  for(const ioRead4212 of [null,[],[1]])fail(prepareRenderF290,fixture(),{ioRead4212},'render_io_read_required','poll');
  fail(prepareRenderF290,fixture(),{ioRead4218:null},'render_io_read_required','capture');
  fail(prepareRenderF290,fixture(0,0,0x80,[[0x7E01CA,0x7E01CA]]),{},'render_write_window_required','store');
  const p=fail(prepareRenderF290,fixture(),{ioMode:null},'render_io_context_required','poll');assert.equal(p.wrapper,'F290');
});
test('Consume fullWORDedge andcopy precedefilter; exact3030 preserves resetboundary evenforBYTEentry',()=>{
  const d=fixture(0x8001,0),p=prepare(prepareRenderF298,d,{status:0x30});assert.equal(p.work,8);assert.equal(p.edge,0x8001);
  assert.deepEqual(p.operations.filter(e=>e.kind==='write').map(e=>[e.address&65535,e.value]),[[0x1CE,0x8001],[0x1CC,0x8001],[0x1CA,0],[0x1CE,0]]);
  for(const status of [0,0x10,0x20,0x30]){
    const reset=fail(prepareRenderF298,fixture(0x3030),{status},'render_reset_source_required','reset');assert.equal(reset.wrapper,'F298');assert.equal(reset.target,'80:E382');
  }
});
test('Every budgetbelowcompletechildplan rejects withoutpartialcaptureorcopy',()=>{
  for(let maxWork=1;maxWork<3;maxWork++)fail(prepareRenderF290,fixture(),{maxWork},'render_work_budget_required');
  for(let maxWork=1;maxWork<8;maxWork++)fail(prepareRenderF298,fixture(1),{maxWork},'render_work_budget_required');
  assert.equal(prepare(prepareRenderF290,fixture(),{maxWork:3}).work,3);assert.equal(prepare(prepareRenderF298,fixture(1),{maxWork:8}).work,8);
});
test('Shared syntheticwrappercomposition seesfreshcaptureandrestoredP, commits onepayload',()=>{
  const d=fixture(0,0),before=d.snapshot(),view=prepareRenderView(d,[0x7E1F00,0x7E1FFF]),budget={work:0,maxWork:9},context={...entry,status:0xF7};
  const capture=renderF290(view,context,budget);assert.equal(capture.status,0xF7);assert.throws(()=>d.commit(capture));
  const consume=renderF298(view,{...context,status:capture.status},budget);assert.equal(consume.current,0x8000);assert.equal(consume.work,9);assert.equal(consume.status,0xF7);
  assert.deepEqual(d.snapshot(),before);assert.throws(()=>d.commit(consume));assert.deepEqual(d.commit(view.finish(consume)),{handled:true});assert.equal(word(d,0x1CC),0x8000);
});
test('Shared latebudget/reset failure withholds earliercapture evenwhenwrapperP was restored',()=>{
  for(const [captured,maxWork,reason]of [[0x8000,8,'render_work_budget_required'],[0x3030,20,'render_reset_source_required']]){
    const d=fixture(0,0),before=d.snapshot(),view=prepareRenderView(d),budget={work:0,maxWork},context={...entry,status:0x30,ioRead4218:captured};
    renderF290(view,context,budget);assert.throws(()=>renderF298(view,context,budget),e=>e.reason===reason&&e.wrapper==='F298');assert.deepEqual(d.snapshot(),before);
  }
});
test('Committedcapture revisionsinvalidateconsumerplans; foreignownerscannotcommit wrappers',()=>{
  const d=fixture(),consumer=prepare(prepareRenderF298,d),capture=prepare(prepareRenderF290,d,{ioRead4218:0});assert.throws(()=>fixture().commit(consumer));
  assert.deepEqual(d.commit(capture),{handled:true});assert.deepEqual(d.commit(consumer),{handled:false,reason:'render_plan_stale'});
  const fresh=prepare(prepareRenderF298,d);assert.equal(fresh.current,0);assert.deepEqual(d.commit(fresh),{handled:true});
});
test('Missing or nonnative/decimalentry and invalidsamples remainexplicit',()=>{
  for(const fn of [prepareRenderF290,prepareRenderF298]){
    for(const opts of [{bank:null},{status:null},{status:8},{status:0x38},{emulation:1},{directPage:1}])fail(fn,fixture(),opts,'render_entry_required');
    for(const opts of [{status:256},{status:-1},{x:-1},{y:65536},{ioRead4212:[65536]},{ioRead4212:Array(1)},{ioRead4218:-1},{ioMode:'execute'},{maxWork:0}])assert.throws(()=>prepare(fn,fixture(),opts));
  }
});
test('Probeartifact separates eleven syntheticwrapperfixtures from originalsource and retainsresetfail',async()=>{
  const r=JSON.parse(await readFile(new URL('../analysis/render-input-flow-native.json',import.meta.url),'utf8'));
  assert.equal(r.probes.length,11);assert.match(r.scope,/synthetic/);assert.equal(r.source[0].sha256,'1c305fa553554aed29925b876a5ce859243e515262b5af13ab3196a9134b5fe7');
  assert.equal(r.probes.at(-1).reason,'render_reset_source_required');assert.equal(r.probes.at(-1).byteWrites,undefined);
});
