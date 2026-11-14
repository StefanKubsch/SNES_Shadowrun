import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderF122, prepareRenderF1E8, renderF122, renderF1E8 } from '../proof/render/word-f122.mjs';
import { wordEntry, wordFixture } from './render-f122-fixtures.mjs';
const prepare = (data, options = {}, increment = false) =>
  (increment ? prepareRenderF1E8 : prepareRenderF122)({ ...wordEntry, data, ...options });
function fail(data, options, reason, increment = false) {
  const before = data.snapshot(), p = prepare(data,options,increment);
  assert.equal(p.handled,false); assert.equal(p.reason,reason);
  for(const key of ['byteWrites','operations','ioReads','ioWrites','calls']) assert.equal(p[key],undefined);
  assert.deepEqual(data.snapshot(),before); return p;
}
const nz = value => value === 0 ? 2 : value >= 0x8000 ? 128 : 0;

test('F122/F1E8 all65536 original WORDs send low before saved high with actual hiddenhighA returns',()=>{
  for(const increment of [false,true]) for(const flag of [0,1]) {
    const data=wordFixture({flag});
    for(let a=0;a<65536;a++) {
      const p=prepare(data,{a},increment); assert.ok(p.handled);
      assert.deepEqual(p.calls.map(c=>c.inputByte),[a%256,Math.floor(a/256)]);
      assert.deepEqual(p.calls.map(c=>c.buffered),flag?[false,true]:[true,false]);
      assert.equal(p.a,flag?(a%256)*256+Math.floor(a/256):Math.floor(a/256)*256+0x13);
      assert.equal(p.status,increment||!flag?0x45:0xC5);
      assert.equal(p.work,increment?17:13); assert.equal(p.bank,wordEntry.bank);
      assert.equal(p.x,wordEntry.x);assert.equal(p.y,wordEntry.y);
      assert.equal(p.calls[1].before.a>>>8,flag?a%256:Math.floor(a/256));
      assert.deepEqual(p.ioWrites.map(e=>[e.address&65535,e.value,e.bytes]),
        [[0x2141,flag?0x56:a%256,1],[0x2142,flag?a%256:Math.floor(a/256),1],[0x2140,0x13,1]]);
    }
  }
});
test('F1E8 all65536 DP96 WORDs increment twice with trueWORDwrap/NZ independent of return A',()=>{
  const data=wordFixture();
  for(let address=0;address<65536;address++) {
    data.seed(0x96,[address%256,Math.floor(address/256)]);
    const p=prepare(data,{},true),final=(address+2)%65536; assert.ok(p.handled);
    assert.equal(p.addressBefore,address);assert.equal(p.addressAfter,final);assert.equal(p.a,0x34AB);
    assert.equal(p.status,0x45|nz(final));
    assert.deepEqual(p.operations.slice(-4).map(e=>[e.kind,e.address,e.value,e.bytes]),
      [['read',0x96,address,2],['write',0x96,(address+1)%65536,2],['read',0x96,(address+1)%65536,2],['write',0x96,final,2]]);
  }
});
test('F122 REP20 preserves final BYTEflags even when fullA has a different sign or zero',()=>{
  const buffered=prepare(wordFixture({flag:0,token:255}),{a:0xAB00,ioRead2140:[255]});
  assert.equal(buffered.a,0xAB00);assert.equal(buffered.status,0x47); // FullA negative, BYTEtoken zero.
  const paired=prepare(wordFixture({flag:1}),{a:0});assert.equal(paired.a,0);assert.equal(paired.status,0xC5);
  assert.equal(paired.status&32,0); // FullA zero, final BYTE DEC negative.
});
test('F122/F1E8 all valid entry statuses and256 tokens preserve V/I/C and source-width NZ',()=>{
  for(let status=0;status<256;status++) {
    if(status&0x38)continue;
    for(let token=0;token<256;token++)for(const flag of [0,255])for(const increment of [false,true]){
      const p=prepare(wordFixture({flag,token,address:0xFFFE}),{status,ioRead2140:[token]},increment);
      assert.ok(p.handled); const next=(token+1)%256;
      const expected=increment?2:flag?128:next===0?2:next>=128?128:0;
      assert.equal(p.status,(status&~0xA3)|1|expected);assert.equal(p.overflow,status>>>6&1);
    }
  }
});
test('F122 every nonzero pairflag sends previousbuffer/low then buffers high without a second handshake',()=>{
  for(let flag=1;flag<256;flag++) {
    const data=wordFixture({flag}),p=prepare(data);assert.ok(p.handled);assert.equal(p.polls,1);
    assert.deepEqual(data.commit(p),{handled:true});
    assert.equal(data.readByte(0x1CE6).value,255);assert.equal(data.readByte(0x1CE7).value,0xAB);
    assert.equal(data.readByte(0x1CE4).value,0x13);assert.equal(data.readByte(0x96).value,0x34);
  }
});
test('F122 requires no DP96 source/window and flag0 does not need initial buffer bytes',()=>{
  const data=createRenderData({writeWindows:[[0x7E1CE4,0x7E1CE7]]});
  data.seed(0x1CE6,[0]);data.seed(0x1CE4,[0x12]);const p=prepare(data);assert.ok(p.handled);
  assert.deepEqual(p.readAddresses,[0x7E1CE4,0x7E1CE6,0x7E1CE7]);
  assert.equal(p.addressBefore,null);assert.equal(p.addressAfter,null);
  assert.ok(p.operations.every(e=>e.bytes===1));assert.equal(data.readByte(0x96).available,false);
});
test('F1E8 reads DP96 only after both calls and uses fresh WORD data and directpage independent of DBR',()=>{
  const data=wordFixture({bank:0x7F,address:0xFFFF}),before=data.snapshot();
  const p=prepare(data,{bank:0x7F,ioMode:null,ioRead2140:null},true);assert.deepEqual(data.snapshot(),before);
  assert.equal(p.addressAfter,1);assert.ok(p.operations.slice(0,-4).every(e=>e.address>=0x7F0000));
  assert.ok(p.operations.slice(-4).every(e=>e.address===0x96 && e.bytes===2));
  assert.deepEqual(data.commit(p),{handled:true});assert.equal(data.readByte(0x96).value,1);
  assert.equal(data.readByte(0x97).value,0);assert.equal(data.readByte(0x7F0096).available,false);
});
test('F122 original four buffer accesses precede second-call clear/token/poll and no2143 store',()=>{
  const p=prepare(wordFixture({flag:0}),{ioRead2140:[0,0x12]});
  assert.equal(p.polls,2);assert.deepEqual(p.operations.map(e=>[e.kind,e.address&65535,e.value,e.bytes]),
    [['read',0x1CE6,0,1],['write',0x1CE7,0x34,1],['read',0x1CE6,0,1],['write',0x1CE6,255,1],
      ['read',0x1CE6,255,1],['write',0x1CE6,0,1],['read',0x1CE4,0x12,1],
      ['read',0x2140,0,1],['read',0x2140,0x12,1],['read',0x1CE7,0x34,1],
      ['write',0x2141,0x34,1],['write',0x2142,0xAB,1],['write',0x2140,0x13,1],['write',0x1CE4,0x13,1]]);
});
test('F122/F1E8 every missing initial source byte including late DP96 highbyte withholds preceding requests',()=>{
  for(const increment of [false,true])for(const missing of [0x1CE6,0x1CE4,0x1CE7,...(increment?[0x96,0x97]:[])]){
    const data=createRenderData({writeWindows:[[0x7E1CE4,0x7E1CE7],[0x7E0096,0x7E0097]]});
    for(const [address,value] of [[0x1CE6,1],[0x1CE4,0x12],[0x1CE7,0x56],[0x96,0x34],[0x97,0x12]])
      if(address!==missing)data.seed(address,[value]);
    const p=fail(data,{},'render_source_required',increment);assert.equal(p.address,0x7E0000+missing);
    if(missing<0x100){assert.equal(p.callIndex,2);assert.equal(p.phase,'address');}
  }
});
test('F122/F1E8 missing samples and mismatching prefixes retain exact low/high call boundary atomically',()=>{
  for(const flag of [0,1])for(const increment of [false,true])for(const ioRead2140 of [null,[],[0],[0,255]]){
    const p=fail(wordFixture({flag}),{ioRead2140},'render_io_read_required',increment);
    assert.equal(p.callIndex,flag?0:1);assert.equal(p.phase,'poll');
  }
  fail(wordFixture(),{ioMode:null},'render_io_context_required');
});
test('F122/F1E8 all budget prefixes cover both inner calls and late counter accesses with one cumulative budget',()=>{
  for(const flag of [0,1])for(const increment of [false,true]){
    const work=increment?19:15;
    for(let maxWork=1;maxWork<work;maxWork++)
      fail(wordFixture({flag}),{maxWork,ioRead2140:[0,255,0x12]},'render_work_budget_required',increment);
    assert.ok(prepare(wordFixture({flag}),{maxWork:work,ioRead2140:[0,255,0x12]},increment).handled);
  }
});
test('F122/F1E8 every WRAM writewindow including partial DP96 WORD discards prior device requests',()=>{
  for(const increment of [false,true])for(const missing of [0x1CE6,0x1CE7,0x1CE4,...(increment?[0x96,0x97]:[])]){
    const writeWindows=[0x1CE6,0x1CE7,0x1CE4,...(increment?[0x96,0x97]:[])]
      .filter(a=>a!==missing).map(a=>[0x7E0000+a,0x7E0000+a]);
    fail(wordFixture({writeWindows}),{},'render_write_window_required',increment);
  }
});
test('F122/F1E8 all256 DBRs retain source-backed mapping and actual systembank addresses',()=>{
  for(let bank=0;bank<256;bank++)for(const increment of [false,true]){
    if(bank&0x40 && bank!==0x7E && bank!==0x7F){fail(wordFixture(),{bank},'render_address_required',increment);continue;}
    const p=prepare(wordFixture({bank}),{bank},increment);assert.ok(p.handled);assert.equal(p.bank,bank);
    if(bank!==0x7E&&bank!==0x7F)assert.equal(p.ioReads[0].address,bank*65536+0x2140);
  }
});
test('F122/F1E8 physicalbanks use actual registers and mismatched bytes ignore supplied ACK',()=>{
  for(const bank of [0x7E,0x7F])for(const increment of [false,true]){
    const p=prepare(wordFixture({bank,flag:0,token:255}),{bank,ioMode:null,ioRead2140:[0]},increment);
    assert.ok(p.handled);assert.deepEqual(p.ioRequests,[]);assert.equal(p.apuPolls,0);assert.equal(p.a,0xAB00);
    fail(wordFixture({bank,poll:0}),{bank,maxWork:20,ioRead2140:[0x12]},'render_work_budget_required',increment);
  }
});
test('F122/F1E8 six protected bytes and BYTE/WORD mode gates reject before effects',()=>{
  for(const increment of [false,true]){
    assert.ok(prepare(wordFixture(),{stackWindow:[0x1FFA,0x1FFF]},increment).handled);
    fail(wordFixture(),{stackWindow:[0x1FFB,0x1FFF]},'render_stack_required',increment);
    for(const address of [0x1CE4,0x1CE6,0x1CE7,...(increment?[0x96,0x97]:[])])
      fail(wordFixture(),{stackWindow:[address,address+5]},'render_stack_alias_required',increment);
    fail(wordFixture({bank:0x7E}),{bank:0x7E,stackWindow:[0x2140,0x2145]},'render_stack_alias_required',increment);
    for(const options of [{a:null},{x:null},{y:null},{bank:null},{status:null},{status:32},{status:16},
      {status:8},{emulation:1},{directPage:1}])fail(wordFixture(),options,'render_entry_required',increment);
  }
});
test('F122/F1E8 inner calls share fresh outer writes, global polls and exact cumulative work under one commit',()=>{
  const data=wordFixture({flag:0,token:255}),before=data.snapshot(),view=prepareRenderView(data);
  const observations={apuPolls:1},budget={work:7,maxWork:100},context={...wordEntry,observations,ioRead2140:[99,255,99,0]};
  const first=renderF122(view,context,budget);assert.equal(first.apuPolls,2);assert.equal(first.a,0xAB00);
  view.write(0x96,0xFE);view.write(0x97,0xFF);
  const second=renderF1E8(view,{...context,a:0x5678},budget);assert.equal(second.apuPolls,4);
  assert.equal(second.polls,2);assert.equal(second.addressBefore,0xFFFE);assert.equal(second.addressAfter,0);
  assert.equal(second.work,38);assert.equal(second.a,0x5601);
  assert.throws(()=>data.commit(first));assert.throws(()=>data.commit(second));assert.deepEqual(data.snapshot(),before);
  assert.deepEqual(data.commit(view.finish(second)),{handled:true});assert.equal(data.readByte(0x96).value,0);
});
test('F1E8 late inner DP96 boundary withholds earlier outer buffer/token writes and ledger',()=>{
  const data=wordFixture({address:null}),before=data.snapshot(),view=prepareRenderView(data);
  view.write(0x1CE7,0x99);
  assert.throws(()=>renderF1E8(view,wordEntry,{work:0,maxWork:100}),e=>e.reason==='render_source_required'&&e.phase==='address');
  assert.deepEqual(data.snapshot(),before);
});
test('F122/F1E8 plan immutability, ownership and source revision protect repeated commits',()=>{
  for(const increment of [false,true]){
    const data=wordFixture(),p=prepare(data,{},increment);assert.ok(Object.isFrozen(p));assert.ok(Object.isFrozen(p.calls));
    assert.throws(()=>wordFixture().commit(p));data.seed(0x1CE4,[0]);
    assert.deepEqual(data.commit(p),{handled:false,reason:'render_plan_stale'});
    const fresh=prepare(data,{ioRead2140:[0]},increment);assert.deepEqual(data.commit(fresh),{handled:true});
    assert.deepEqual(data.commit(fresh),{handled:false,reason:'render_plan_stale'});
  }
});
test('F122/F1E8 malformed registers, budgets, IO modes and sparse/nonBYTE samples reject',()=>{
  for(const increment of [false,true])for(const options of [{a:-1},{x:65536},{y:0.5},{bank:256},{status:256},{maxWork:0},
    {ioMode:'execute'},{ioRead2140:[256]},{ioRead2140:Array(1)},{ioRead2140:0}])assert.throws(()=>prepare(wordFixture(),options,increment));
});
test('F122/F1E8 synthetic probe pins both six-byte proofs and atomically rejects late source/poll failures',async()=>{
  const report=JSON.parse(await readFile('analysis/render-f122-native.json','utf8'));
  assert.match(report.scope,/explicitly synthetic/);assert.match(report.scope,/No audio\/device\/CPU\/clock/);
  assert.deepEqual(report.source.map(w=>[w.covered_bytes,w.instruction_count]),[[18,10],[14,8]]);
  assert.ok(report.stackProofs.every(p=>p.minimum_protected_stack_bytes===6&&p.external_return_assumptions===0));
  assert.deepEqual(report.probes.map(p=>p.handled),[true,true,true,true,false,false]);
  assert.equal(report.probes[2].addressAfter,0);assert.equal(report.probes[3].ioWrites.length,0);
  for(const p of report.probes.slice(4))assert.equal(p.operations,undefined);
});
