import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderF007, renderF007 } from '../proof/render/apu-f007.mjs';
const entry={bank:0x80,status:0xC5,a:0xAB34,x:0xBEEF,y:0x1234,emulation:0,directPage:0,stackWindow:[0x1F00,0x1FFF],ioMode:'record-requests',ioRead2140:[0x12]};
function fixture(token=0x12,bank=0x80,windows=null){
  const base=bank*65536,owner=bank===0x7F?0x7F0000:0x7E0000;
  const d=createRenderData({writeWindows:windows??[[owner+0x1CE4,owner+0x1CE4],...([0x7E,0x7F].includes(bank)?[[base+0x2140,base+0x2143]]:[])]});
  d.seed(base+0x1CE4,[token]);if([0x7E,0x7F].includes(bank))d.seed(base+0x2140,[token]);return d;
}
const prepare=(data,opts={})=>prepareRenderF007({...entry,data,...opts});
function fail(d,opts,reason,phase){const before=d.snapshot(),p=prepare(d,opts);assert.equal(p.handled,false);assert.equal(p.reason,reason);if(phase)assert.equal(p.phase,phase);
  for(const k of ['byteWrites','operations','ioReads','ioWrites'])assert.equal(p[k],undefined);assert.deepEqual(d.snapshot(),before);return p;}
test('All256 tokenswrap with BYTEcommand from LowA, fullWORDX and incomingstatusrestore',()=>{
  for(let token=0;token<256;token++)for(const a of [0,0xFF,0x1234,0xAB00,0xFFFF]){
    const p=prepare(fixture(token),{a,ioRead2140:[token]});assert.ok(p.handled);assert.equal(p.a,(a%256)*256+(token+1)%256);assert.equal(p.status,entry.status);
    assert.deepEqual(p.ioWrites.map(e=>[e.address&65535,e.value,e.bytes]),[[0x2142,0xBEEF,2],[0x2141,a%256,1],[0x2140,(token+1)%256,1]]);
    assert.deepEqual(p.byteWrites,[[0x7E1CE4,(token+1)%256]]);assert.equal(p.work,6);
  }
});
test('Pollchronology stops atfirstequalBYTE, ignoresunusedsamples and retainsonetokenread',()=>{
  const d=fixture(),before=d.snapshot(),p=prepare(d,{ioRead2140:[0xFF,0,0x12,0]});assert.deepEqual(d.snapshot(),before);assert.equal(p.polls,3);
  assert.deepEqual(p.operations.map(e=>[e.kind,e.space,e.address&65535,e.value,e.bytes]),
    [['read','data',0x1CE4,0x12,1],['read','io',0x2140,0xFF,1],['read','io',0x2140,0,1],['read','io',0x2140,0x12,1],
      ['write','io',0x2142,0xBEEF,2],['write','io',0x2141,0x34,1],['write','io',0x2140,0x13,1],['write','data',0x1CE4,0x13,1]]);
  assert.deepEqual(d.commit(p),{handled:true});assert.equal(d.readByte(0x1CE4).value,0x13);assert.equal(d.readByte(0x1CE5).available,false);
});
test('All valid statuses survivePHP/PLP including inconsistent A/NZ and finalzero',()=>{
  for(let status=0;status<256;status++){if(status&0x38)continue;const p=prepare(fixture(255),{status,a:0,ioRead2140:[255]});
    assert.equal(p.a,0);assert.equal(p.status,status);assert.equal(p.x,entry.x);assert.equal(p.y,entry.y);assert.equal(p.bank,entry.bank);}
});
test('Missingtoken, missing/exhausted samples and I/Ocontext neverfabricateack',()=>{
  fail(createRenderData(),{},'render_source_required','token');
  for(const ioRead2140 of [null,[],[0],[0,255]])fail(fixture(),{ioRead2140},'render_io_read_required','poll');
  fail(fixture(),{ioMode:null},'render_io_context_required','poll');
});
test('Everyspatebudget and late1CE4ownership withhold all precedingdevicewrites',()=>{
  for(let maxWork=1;maxWork<6;maxWork++)fail(fixture(),{maxWork},'render_work_budget_required');
  assert.ok(prepare(fixture(),{maxWork:6}).handled);fail(fixture(0x12,0x80,[]),{},'render_write_window_required','store');
});
test('Physical7E/7F poll actualbytes and updateWORDparameters/command/token with no I/O',()=>{
  for(const bank of [0x7E,0x7F]){
    const d=fixture(255,bank),p=prepare(d,{bank,a:0xAB00,ioMode:null,ioRead2140:[0]});assert.ok(p.handled);assert.equal(p.a,0);
    assert.deepEqual(p.ioWrites,[]);assert.deepEqual(p.ioReads,[]);assert.deepEqual(d.commit(p),{handled:true});const base=bank*65536;
    assert.deepEqual([0x2140,0x2141,0x2142,0x2143,0x1CE4].map(a=>d.readByte(base+a).value),[0,0,0xEF,0xBE,0]);
    assert.equal(d.readByte(base+0x2144).available,false);assert.equal(d.readByte(base+0x1CE5).available,false);
  }
});
test('Physicalwrongtoken rereads tobudget and neveraccepts suppliedACK; missingpollsource explicit',()=>{
  const d=fixture(0x12,0x7E);d.seed(0x7E2140,[0]);fail(d,{bank:0x7E,maxWork:12},'render_work_budget_required','poll');
  const missing=createRenderData();missing.seed(0x7E1CE4,[0x12]);fail(missing,{bank:0x7E},'render_source_required','poll');
});
test('Everyphysicaldestinationbyte needsownership, partialWORD or late store nevercommits',()=>{
  for(const missing of [0x1CE4,0x2140,0x2141,0x2142,0x2143]){
    const windows=[0x1CE4,0x2140,0x2141,0x2142,0x2143].filter(a=>a!==missing).map(a=>[0x7E0000+a,0x7E0000+a]);
    fail(fixture(0x12,0x7E,windows),{bank:0x7E},'render_write_window_required');
  }
});
test('SystemDBRs record actualdeviceaddress while tokensharesWRAM; unsupportedbankfails',()=>{
  for(const bank of [0,0x3F,0x80,0xBF]){
    const p=prepare(fixture(0x12,bank),{bank});assert.ok(p.handled);assert.equal(p.ioReads[0].address,bank*65536+0x2140);assert.deepEqual(p.byteWrites,[[0x7E1CE4,0x13]]);
  }
  fail(fixture(),{bank:0x40},'render_address_required','token');
});
test('Fourprotectedbytes coverJSL/PHP; tokenandphysicalregisterstackaliases reject',()=>{
  assert.ok(prepare(fixture(),{stackWindow:[0x1FFC,0x1FFF]}).handled);fail(fixture(),{stackWindow:[0x1FFD,0x1FFF]},'render_stack_required');
  fail(fixture(),{stackWindow:[0x1CE1,0x1CE4]},'render_stack_alias_required','token');
  fail(fixture(0x12,0x7E),{bank:0x7E,stackWindow:[0x2140,0x2143]},'render_stack_alias_required','poll');
});
test('InnerF007 sees outerwrites; earlierwriteswithheld at missingpoll, innercannotcommit',()=>{
  const d=fixture(),view=prepareRenderView(d,[0x7E1F00,0x7E1FFF]),before=d.snapshot();view.write(0x1CE4,255);
  assert.throws(()=>renderF007(view,{...entry,ioRead2140:[]},{work:0,maxWork:100}),e=>e.reason==='render_io_read_required');assert.deepEqual(d.snapshot(),before);
  const p=renderF007(view,{...entry,ioRead2140:[255]},{work:0,maxWork:100});assert.equal(p.token,255);assert.throws(()=>d.commit(p));
  assert.deepEqual(d.commit(view.finish(p)),{handled:true});assert.equal(d.readByte(0x1CE4).value,0);
});
test('Repeatedcommitsrequire newactualtokenACK and planowner/revision',()=>{
  const d=fixture(),p=prepare(d);assert.throws(()=>fixture().commit(p));assert.deepEqual(d.commit(p),{handled:true});assert.deepEqual(d.commit(p),{handled:false,reason:'render_plan_stale'});
  fail(d,{},'render_io_read_required','poll');assert.ok(prepare(d,{ioRead2140:[0x13]}).handled);
});
test('Invalid or missing APUarguments, samples andentry remainexplicit',()=>{
  for(const opts of [{a:null},{x:null}])fail(fixture(),opts,'render_apu_context_required');
  for(const opts of [{a:-1},{x:65536},{y:-1},{ioRead2140:[256]},{ioRead2140:Array(1)},{ioRead2140:0},{ioMode:'execute'}])assert.throws(()=>prepare(fixture(),opts));
  for(const opts of [{bank:null},{status:null},{status:32},{status:16},{status:8},{emulation:1},{directPage:1}])fail(fixture(),opts,'render_entry_required');
});
