import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRender9E1A, render9E1A } from '../proof/render/input-9e1a.mjs';
import { render9E0B } from '../proof/render/input-9e0b.mjs';
const entry = { bank: 0x80, status: 0xC5, x: 0xABCD, y: 0xBEEF, emulation: 0, directPage: 0, stackWindow: [0x1F00,0x1FFF] };
const seed = (d,a,v) => d.seed(a,[v&255,v>>>8]);
const word = (d,a) => d.readByte(a).value | d.readByte(a+1).value<<8;
function fixture(current=0x8000,previous=0x4000,bank=0x80,windows=null) {
  const owner=bank===0x7F?0x7F0000:0x7E0000,base=bank*65536;
  const data=createRenderData({writeWindows:windows??[[owner+0x1CA,owner+0x1CF]]});
  seed(data,base+0x1CA,current);seed(data,base+0x1CC,previous);return data;
}
const prepare=(data,opts={})=>prepareRender9E1A({...entry,data,...opts});
test('Probeartifact separates original92/41 from eleven synthetic input/APUfixtures',async()=>{
  const report=JSON.parse(await readFile(new URL('../analysis/render-9e1a-native.json',import.meta.url),'utf8'));
  assert.equal(report.source[0].sha256,'947b5802e14cc8c39c08d9976b76f46dec1e8ca657e4a5a9e4ebec186578ad80');
  assert.equal(report.source[1].sha256,'ea46b86b724dbd5b6dbc861317cc51dbf4a39776940179f193f961e331110cb8');
  assert.equal(report.inputProbes.length,6);assert.equal(report.apuProbes.length,5);assert.match(report.scope,/synthetic/);
  assert.equal(report.inputProbes.at(-1).reason,'render_reset_source_required');assert.equal(report.inputProbes.at(-1).byteWrites,undefined);
  assert.equal(report.apuProbes[2].reason,'render_io_read_required');assert.equal(report.apuProbes[2].ioWrites,undefined);
});
function fail(data,opts,reason,phase) {
  const before=data.snapshot(),p=prepare(data,opts);assert.equal(p.handled,false);assert.equal(p.reason,reason);
  if(phase)assert.equal(p.phase,phase);for(const k of ['byteWrites','operations','ioWrites','ioReads'])assert.equal(p[k],undefined);
  assert.deepEqual(data.snapshot(),before);return p;
}
test('All65536 capturedwords follow unsignedCMP, exactreset or nibblefilter; fullcopy precedes clear',()=>{
  const data=fixture();
  for(let current=0;current<65536;current++){
    const previous=(current*73+0x1234)&65535;seed(data,0x1CA,current);seed(data,0x1CC,previous);
    const p=prepare(data);
    if(current===0x3030){assert.equal(p.handled,false);assert.equal(p.reason,'render_reset_source_required');continue;}
    const nibble=current%16,edge=current&~previous;
    assert.ok(p.handled);assert.equal(p.a,nibble);assert.equal(p.status,0x44|Number(current>=0x3030)|(nibble===0?2:0));
    const writes=new Map(p.byteWrites);
    assert.equal(writes.get(0x7E01CC),current&255);assert.equal(writes.get(0x7E01CD),current>>>8);
    assert.equal(writes.get(0x7E01CE),(nibble?0:edge)&255);assert.equal(writes.get(0x7E01CF),(nibble?0:edge)>>>8);
    assert.equal(writes.has(0x7E01CA),nibble!==0);assert.equal(p.work,nibble?8:6);
  }
});
test('Heldpress, release and re-press derive edges from committed01CC without repeatededges',()=>{
  const d=fixture(0x8000,0);
  for(const [current,expected]of [[0x8000,0x8000],[0x8000,0],[0,0],[0x8000,0x8000],[0x8001,0],[0x8000,0]]){
    seed(d,0x1CA,current);const p=prepare(d);assert.ok(p.handled);assert.deepEqual(d.commit(p),{handled:true});
    assert.equal(word(d,0x1CC),current);assert.equal(word(d,0x1CE),expected);assert.equal(word(d,0x1CA),current%16?0:current);
  }
});
test('Originalorderedreads and WORDstores require no previous01CE and preserve adjacentbytes',()=>{
  const d=fixture(0x1231,0x1230);d.seed(0x1C9,[0xA5]);d.seed(0x1D0,[0x5A]);const before=d.snapshot(),p=prepare(d);
  assert.deepEqual(d.snapshot(),before);assert.deepEqual(p.operations.map(e=>[e.kind,e.address&65535,e.value,e.bytes]),
    [['read',0x1CA,0x1231,2],['read',0x1CC,0x1230,2],['read',0x1CA,0x1231,2],['write',0x1CE,1,2],
      ['read',0x1CA,0x1231,2],['write',0x1CC,0x1231,2],['write',0x1CA,0,2],['write',0x1CE,0,2]]);
  assert.deepEqual(d.commit(p),{handled:true});assert.equal(d.readByte(0x1C9).value,0xA5);assert.equal(d.readByte(0x1D0).value,0x5A);
});
test('All valid statuses preserveV/I/X/Y/DBR while N/Z/C follow filter andCMP',()=>{
  for(let status=0;status<256;status++){if(status&0x38)continue;
    for(const current of [0,1,0x302F,0x3040,0x800F,0xFFFF]){
      const p=prepare(fixture(current),{status});assert.equal(p.status,(status&0x7C)|Number(current>=0x3030)|(current%16===0?2:0));
      assert.equal(p.x,entry.x);assert.equal(p.y,entry.y);assert.equal(p.bank,entry.bank);
    }
  }
});
test('Systembanks alias realWRAM; physical7E/7F use actualbankbytes and no I/O',()=>{
  for(const bank of [0,0x3F,0x80,0xBF,0x7E,0x7F]){
    const d=fixture(0xF001,0x1234,bank),p=prepare(d,{bank});assert.ok(p.handled);assert.deepEqual(p.ioWrites,[]);assert.deepEqual(p.ioReads,[]);
    assert.deepEqual(d.commit(p),{handled:true});const base=bank*65536;assert.equal(word(d,base+0x1CC),0xF001);assert.equal(word(d,base+0x1CA),0);
  }
  fail(fixture(),{bank:0x40},'render_address_required','edge');
});
test('Every requiredsourcebyte and writebyte failsatomically even after earlierplannedwrites',()=>{
  for(const missing of [0x1CA,0x1CB,0x1CC,0x1CD]){
    const d=createRenderData({writeWindows:[[0x7E01CA,0x7E01CF]]});for(const a of [0x1CA,0x1CB,0x1CC,0x1CD])if(a!==missing)d.seed(a,[1]);
    fail(d,{},'render_source_required','edge');
  }
  for(const missing of [0x1CA,0x1CB,0x1CC,0x1CD,0x1CE,0x1CF]){
    const windows=[0x1CA,0x1CB,0x1CC,0x1CD,0x1CE,0x1CF].filter(a=>a!==missing).map(a=>[0x7E0000+a,0x7E0000+a]);
    fail(fixture(1,0,0x80,windows),{},'render_write_window_required',missing<=0x1CB?'filter':missing<=0x1CD?'copy':'edge');
  }
  assert.ok(prepare(fixture(0x8000,0,0x80,[[0x7E01CC,0x7E01CF]])).handled);
});
test('Every incompleteworkbudget and stackalias withholds earlieredge/copy/clear',()=>{
  for(let maxWork=1;maxWork<8;maxWork++)fail(fixture(1),{maxWork},'render_work_budget_required');
  assert.equal(prepare(fixture(1),{maxWork:8}).work,8);
  for(const a of [0x1CA,0x1CC,0x1CE])fail(fixture(1),{stackWindow:[a,a+1]},'render_stack_alias_required');
  assert.ok(prepare(fixture(),{stackWindow:[0x1FFE,0x1FFF]}).handled);
  fail(fixture(),{stackWindow:[0x1FFF,0x1FFF]},'render_stack_required');
});
test('Exact3030 alwayswithholds resetedge/copy withoutinventingAPUsources or success',()=>{
  for(const bank of [0x80,0x7E,0x7F]){
    const d=fixture(0x3030,0,bank);const p=fail(d,{bank},'render_reset_source_required','reset');assert.equal(p.target,'80:E382');
    assert.throws(()=>d.commit(p));assert.equal(word(d,bank*65536+0x1CC),0);
  }
});
test('Sharedcaptureandconsume sees late01CA, commits once and discards capture at resetboundary',()=>{
  for(const captured of [0x8000,0x8001,0x3030]){
    const d=fixture(0,0),before=d.snapshot(),view=prepareRenderView(d,[0x7E1F00,0x7E1FFF]),budget={work:0,maxWork:100};
    render9E0B(view,{...entry,ioMode:'record-requests',ioRead4212:[0],ioRead4218:captured},budget);
    if(captured===0x3030){assert.throws(()=>render9E1A(view,entry,budget),e=>e.reason==='render_reset_source_required');assert.deepEqual(d.snapshot(),before);continue;}
    const inner=render9E1A(view,entry,budget);assert.equal(inner.current,captured);assert.throws(()=>d.commit(inner));
    assert.deepEqual(d.commit(view.finish(inner)),{handled:true});assert.equal(word(d,0x1CC),captured);
  }
});
test('RepeatedCA reads remainfresh against explicit testprovider changes, with actualthirdcopy/CMP',()=>{
  const d=fixture(0,0),view=prepareRenderView(d),values=[0x8000,0x4000,0x3040];let readIndex=0,high;
  const provider={...view,read(a){if((a&65535)===0x1CA){const v=values[readIndex++];high=v>>>8;return v&255;}if((a&65535)===0x1CB)return high;return view.read(a);}};
  const p=render9E1A(provider,entry,{work:0,maxWork:100});assert.equal(readIndex,3);assert.equal(p.edge,0);assert.equal(p.current,0x3040);assert.equal(p.carry,1);
  assert.deepEqual(d.commit(view.finish(p)),{handled:true});assert.equal(word(d,0x1CC),0x3040);
});
test('Planowner/revision preventforeigncommit or staleinputplans',()=>{
  const d=fixture(),p=prepare(d);assert.throws(()=>fixture().commit(p));seed(d,0x1CA,0);assert.deepEqual(d.commit(p),{handled:false,reason:'render_plan_stale'});
});
test('Invalid or missingentrycontexts retainexplicit boundary',()=>{
  for(const opts of [{bank:null},{status:null},{status:32},{status:16},{status:8},{emulation:1},{directPage:1}])fail(fixture(),opts,'render_entry_required');
  for(const opts of [{x:-1},{y:65536},{maxWork:0}])assert.throws(()=>prepare(fixture(),opts));
});
