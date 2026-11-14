import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRenderData,prepareRenderView,renderAddress} from '../src/render/data.mjs';
import {prepareRenderF130,renderF130,renderF100} from '../proof/render/samples-f130.mjs';
import {sampleEntry,sampleFixture,sampleWord,samplePointer} from './render-f130-fixtures.mjs';
const prepare=(data,options={})=>prepareRenderF130({...sampleEntry,data,...options});
const at=(data,address)=>data.readByte(address).value;
const word=(data,address)=>at(data,address)|at(data,address+1)<<8;
const pairs=p=>p.ioWrites.filter(e=>e.bytes===1&&['first','second'].includes(e.phase)).map(e=>e.value);
function fail(data,options,reason){const before=data.snapshot(),p=prepare(data,options);
  assert.equal(p.handled,false);assert.equal(p.reason,reason);
  for(const key of ['byteWrites','operations','ioWrites','ioReads','calls','blocks'])assert.equal(p[key],undefined);
  assert.deepEqual(data.snapshot(),before);return p;}

test('F130 all32768 low entry words skip every source/request/write and restore full entry status',()=>{
  const data=createRenderData();for(let a=0;a<0x8000;a++){
    const p=prepare(data,{a,ioMode:null,ioRead2140:null,maxWork:1});assert.ok(p.handled);
    assert.equal(p.outcome,'audio_loader_skipped');assert.equal(p.a,a);assert.equal(p.status,sampleEntry.status);
    assert.equal(p.x,sampleEntry.x);assert.equal(p.y,sampleEntry.y);assert.equal(p.work,0);
    assert.deepEqual(p.operations,[]);assert.deepEqual(p.byteWrites,[]);
  }
});
test('F130 all32768 high words select by lowBYTE and retain hiddenhighA on directoryFF returns',()=>{
  const data=sampleFixture({blocks:[]});for(let a=0x8000;a<=65535;a++){
    const p=prepare(data,{a,ioMode:null,ioRead2140:null});assert.ok(p.handled);
    const found=a%256===7;assert.equal(p.outcome,found?'audio_data_requests_prepared':'audio_directory_terminated');
    assert.equal(p.a,found?0:(a&0xFF00)|255);assert.equal(p.y,found?4:9);assert.equal(p.x,sampleEntry.x);
    assert.equal(p.status,sampleEntry.status);
  }
});
test('F130 restores every admissible PHP/PLP status on low/FF/zero/raw/repeat paths',()=>{
  for(let status=0;status<256;status++){if(status&0x38)continue;
    for(const options of [{a:7},{a:0x8008},{blocks:[]},{},{blocks:[{kind:'repeat',count:1,value:0x8000}]}]){
      const p=prepare(sampleFixture(options),{...options,status});assert.ok(p.handled);assert.equal(p.status,status);
      assert.equal(p.carry,status&1);assert.equal(p.overflow,status>>>6&1);
    }
  }
});
test('F100 all65536 input lengths and remaining lengths retain WORD subtraction C/V/NZ and fresh DP98',()=>{
  for(const vary of ['input','left']){
    const data=createRenderData({writeWindows:[[0x7E0092,0x7E0093],[0x7E0098,0x7E0099]]});
    for(let value=0;value<=65535;value++){
      const input=vary==='input'?value:0x8001,left=vary==='left'?value:0x7FFF;
      sampleWord(data,0x92,left);const view=prepareRenderView(data),p=renderF100(view,{...sampleEntry,a:input},{work:0,maxWork:4});
      const diff=(left-input)&65535,C=left>=input;
      const signed=n=>n<32768?n:n-65536,signedDifference=signed(left)-signed(input);
      const V=signedDifference< -32768||signedDifference>32767;
      const flags=(sampleEntry.status&~0xC3)|Number(C)|(Number(V)<<6)|(diff===0?2:diff>=32768?128:0);
      assert.equal(p.a,diff);assert.equal(p.status,flags);assert.equal(p.work,4);assert.equal(p.x,sampleEntry.x);
      assert.equal(p.y,sampleEntry.y);assert.equal(p.bank,sampleEntry.bank);
      assert.deepEqual(p.operations.map(e=>[e.kind,e.address,e.value]),
        [['write',0x98,input],['read',0x92,left],['read',0x98,input],['write',0x92,diff]]);
    }
  }
});
test('F130 raw counts1..64 preserve full requestlength and BYTE-only address carry with original odd/even tails',()=>{
  for(let count=1;count<=64;count++){
    const values=Array.from({length:count},(_,n)=>0x80+n),data=sampleFixture({address:0x12FF,blocks:[{kind:'raw',values}]});
    const before=data.snapshot(),p=prepare(data);assert.ok(p.handled);assert.deepEqual(data.snapshot(),before);
    assert.equal(p.rawBytes,count);assert.equal(p.repeatWords,0);assert.equal(p.a,0);assert.equal(p.x,count);assert.equal(p.y,9);
    assert.equal(p.polls,2+Math.ceil(count/2));assert.equal(p.calls[0].name,'F100');
    assert.equal(p.calls[1].name,'F007');assert.equal(p.calls[1].before.x,count);
    const sent=[255,0x12,...values];if(count%2)sent.push(values.at(-1));assert.deepEqual(pairs(p),sent);
    assert.deepEqual(data.commit(p),{handled:true});assert.equal(word(data,0x96),0x1200+(count-1));
    assert.equal(at(data,0x1CE6),count%2?0:255);if(!(count%2))assert.equal(at(data,0x1CE7),p.polls);
  }
});
test('F130 repeated words use actual F122/F1E8 with WORD addresswrap and fresh DEC94 do-loop',()=>{
  for(const count of [1,2,3,16]){
    const data=sampleFixture({address:0xFFFE,blocks:[{kind:'repeat',count,value:0xABCD}]}),p=prepare(data);assert.ok(p.handled);
    assert.equal(p.rawBytes,0);assert.equal(p.repeatWords,count);assert.equal(p.x,count*2);assert.equal(p.y,8);assert.equal(p.a,0);
    assert.deepEqual(pairs(p),[254,255,...Array.from({length:count},()=>[0xCD,0xAB]).flat()]);
    assert.equal(p.polls,count+2);assert.deepEqual(data.commit(p),{handled:true});
    assert.equal(word(data,0x96),(0xFFFE+count*2)%65536);assert.equal(word(data,0x94),0);assert.equal(word(data,0x98),0xABCD);
  }
});
test('F130 mixed blocks retain distinct header strides, fresh remaining length and one cumulative request sequence',()=>{
  const data=sampleFixture({blocks:[{kind:'raw',values:[0xAA]},{kind:'repeat',count:2,value:0xBEEF},{kind:'raw',values:[0x12,0x34]}]});
  const p=prepare(data);assert.ok(p.handled);assert.deepEqual(p.blocks.map(b=>[b.kind,b.headerIndex]),[['raw',4],['repeat',9],['raw',13]]);
  assert.deepEqual(p.ioWrites.filter(e=>e.bytes===2).map(e=>e.value),[1,4,2]);assert.equal(p.y,18);assert.equal(p.x,2);
  assert.equal(p.rawBytes,3);assert.equal(p.repeatWords,2);assert.deepEqual(data.commit(p),{handled:true});assert.equal(word(data,0x96),0x123B);
});
test('F130 every BYTEselector including FF has source-defined terminator priority and no fixed table bound',()=>{
  for(let selector=0;selector<256;selector++){
    const p=prepare(sampleFixture({selector,blocks:[]}),{a:0xFF00|selector});assert.ok(p.handled);
    assert.equal(p.outcome,selector===255?'audio_directory_terminated':'audio_data_requests_prepared');
    assert.equal(p.scanned,1);
  }
});
test('F130 WORD directoryY wraps fromFFFD to1 with no record cap and actual long bankcarry',()=>{
  const data=sampleFixture({directory:0x7E5000});data.seed(0x7E5000,new Uint8Array(65536).fill(1));
  samplePointer(data,0x8C,0x7E5000);data.seed(0x7E5001,[255]);
  const p=prepare(data,{a:0xAB07,maxWork:100000});assert.ok(p.handled);assert.equal(p.scanned,16384);
  assert.equal(p.y,1);assert.equal(p.a,0xABFF);assert.equal(p.status,sampleEntry.status);
});
test('F130 directory/header/payload WORD and long addresses carry across actual bank boundaries',()=>{
  for(const options of [{directory:0x7EFFF9},{blockPointer:0x7EFFFF},
    {blocks:[{kind:'raw',pointer:0x7FFFFF,values:[0xAA,0xBB]}]}]){
    const p=prepare(sampleFixture(options));assert.ok(p.handled);assert.equal(p.rawBytes,options.blocks?2:1);
    if(options.blocks)assert.deepEqual(p.operations.filter(e=>e.phase==='raw'&&e.kind==='read'&&[0x7FFFFF,0x800000].includes(e.address))
      .map(e=>[e.address,e.value]),[[0x7FFFFF,0xAA],[0x800000,0xBB]]);
  }
});
test('F130 fresh raw payload aliases observe token, pairflag and previous buffer writes in one overlay',()=>{
  const data=sampleFixture({blocks:[{kind:'raw',pointer:0x7E1CE4,values:[0,0x42,0,0]}]});
  const p=prepare(data);assert.ok(p.handled);assert.deepEqual(pairs(p),[0x34,0x12,2,0x42,0,0]);
  assert.deepEqual(p.operations.filter(e=>e.phase==='raw'&&e.kind==='read'&&e.address>=0x7E1CE4&&e.address<=0x7E1CE7)
    .map(e=>e.value),[2,0x42,0,0]);
});
test('F130 scratch/header aliases require fresh address and overlapping pointer/WORD reads, no immutable block cache',()=>{
  const raw=sampleFixture({blockPointer:0x7E0090});raw.seed(1,[0xAB]);const p=prepare(raw);assert.ok(p.handled);
  assert.deepEqual(pairs(p),[1,0,0xAB,0xAB]);assert.deepEqual(raw.commit(p),{handled:true});
  assert.equal(word(raw,0x96),2);assert.equal(at(raw,0x8F),1);assert.equal(at(raw,0x90),0);assert.equal(at(raw,0x91),1);
  const repeated=sampleFixture({blockPointer:0x7E0090,blocks:[{kind:'repeat',count:1,value:0xBEEF}]});
  const q=prepare(repeated);assert.ok(q.handled);assert.deepEqual(pairs(q),[2,0,2,0]);
  assert.deepEqual(repeated.commit(q),{handled:true});assert.equal(word(repeated,0x96),4);assert.equal(word(repeated,0x98),2);
});
test('F130 zero raw/repeat counts are do-loops and exhaust explicit work, never succeed via a zero count cap',()=>{
  for(const kind of ['raw','repeat']){
    const data=sampleFixture({length:3,blocks:kind==='raw'?[{kind,count:0,values:Array(32).fill(0)}]:[{kind,count:0,value:0xABCD}]});
    const before=data.snapshot(),view=prepareRenderView(data),writes=[];
    const shared={read:a=>view.read(a),write(a,v){view.write(a,v);writes.push([a,v]);}};
    assert.throws(()=>renderF130(shared,sampleEntry,{work:0,maxWork:180}),e=>e.reason==='render_work_budget_required');
    if(kind==='repeat')assert.ok(writes.some(([a,v])=>a===0x94&&v===255));
    else assert.ok(writes.some(([a,v])=>a===0x96&&v===0x35));
    assert.deepEqual(data.snapshot(),before);
  }
});
test('F130 header lengths0/1 retain two wrapping DEC operations and keep nonzero remaining lengths explicit',()=>{
  for(const length of [0,1]){
    const data=sampleFixture({length}),before=data.snapshot(),view=prepareRenderView(data),remaining=[];
    const shared={read:a=>view.read(a),write(a,v){view.write(a,v);if(a===0x93)remaining.push(view.read(0x92)|v<<8);}};
    assert.throws(()=>renderF130(shared,sampleEntry,{work:0,maxWork:1000}),e=>e.reason==='render_source_required');
    assert.deepEqual(remaining,[(length-2)&65535,(length-3)&65535]);assert.deepEqual(data.snapshot(),before);
  }
});
test('F130 every initial sourceBYTE in successful read set and partial long pointers fails atomically',()=>{
  for(const options of [{},{blocks:[{kind:'repeat',count:1,value:0x1234}]}]){
    const full=sampleFixture(options),p=prepare(full);assert.ok(p.handled);const snapshot=full.snapshot();
    const written=new Set(),required=new Set();
    for(const e of p.operations.filter(e=>e.space==='data'))for(let n=0;n<e.bytes;n++){
      const address=renderAddress(e.address+n);
      if(e.kind==='write')written.add(address);else if(!written.has(address))required.add(address);
    }
    for(const missing of required){
      assert.ok(snapshot.bytes.some(([address])=>address===missing));
      const data=createRenderData({writeWindows:snapshot.writeWindows});
      for(const [address,value]of snapshot.bytes)if(address!==missing)data.seed(address,[value]);
      const q=fail(data,{},'render_source_required');assert.equal(q.address,missing);
    }
  }
  for(const dp of [0x8C,0x8D,0x8E]){
    const data=createRenderData({writeWindows:[[0x7E0098,0x7E0098]]});for(const [a,v]of [[0x8C,0],[0x8D,0x80],[0x8E,0x90]])if(a!==dp)data.seed(a,[v]);
    fail(data,{},'render_source_required');
  }
});
test('F130 all work/poll prefixes and every actually written BYTEwindow leave no effects or requests',()=>{
  for(const options of [{},{blocks:[{kind:'repeat',count:1,value:0xABCD}]}]){
    const full=sampleFixture(options),p=prepare(full);assert.ok(p.handled);
    for(let maxWork=1;maxWork<p.work;maxWork++)fail(sampleFixture(options),{maxWork},'render_work_budget_required');
    assert.ok(prepare(sampleFixture(options),{maxWork:p.work}).handled);
    for(let n=0;n<p.apuPolls;n++)fail(sampleFixture(options),{ioRead2140:sampleEntry.ioRead2140.slice(0,n)},'render_io_read_required');
    fail(sampleFixture(options),{ioMode:null},'render_io_context_required');
    for(const [missing]of p.byteWrites){const writeWindows=p.byteWrites.filter(([a])=>a!==missing).map(([a])=>[a,a]);
      fail(sampleFixture({...options,writeWindows}),{},'render_write_window_required');}
  }
});
test('F130 all256 banks retain DBR; lowgate skips unsupported banks while active mapping remains explicit',()=>{
  for(let bank=0;bank<256;bank++){
    assert.ok(prepare(createRenderData(),{bank,a:0}).handled);
    if(bank&0x40&&bank!==0x7E&&bank!==0x7F){fail(sampleFixture(),{bank},'render_address_required');continue;}
    const p=prepare(sampleFixture({bank}),{bank});assert.ok(p.handled);assert.equal(p.bank,bank);
    if(bank!==0x7E&&bank!==0x7F)assert.equal(p.ioReads[0].address,bank*65536+0x2140);
    else {assert.deepEqual(p.ioRequests,[]);assert.equal(p.apuPolls,0);assert.equal(p.polls,3);}
  }
});
test('F130 physical registers need actual source/windows; supplied samples never rescue physical mismatch',()=>{
  for(const bank of [0x7E,0x7F]){
    const data=sampleFixture({bank});data.seed(bank*65536+0x2140,[99]);fail(data,{bank,maxWork:100},'render_work_budget_required');
    const full=sampleFixture({bank}),p=prepare(full,{bank});
    for(const [missing]of p.byteWrites){const writeWindows=p.byteWrites.filter(([a])=>a!==missing).map(([a])=>[a,a]);
      fail(sampleFixture({bank,writeWindows}),{bank},'render_write_window_required');}
  }
});
test('F130 ten protected stackbytes cover mixed callees and all data/DP/register stack aliases reject',()=>{
  assert.ok(prepare(sampleFixture(),{stackWindow:[0x1FF6,0x1FFF]}).handled);
  fail(sampleFixture(),{stackWindow:[0x1FF7,0x1FFF]},'render_stack_required');
  for(const address of [0x89,0x8C,0x92,0x94,0x96,0x98,0x1CE4,0x1CE6,0x1CE7])
    fail(sampleFixture(),{stackWindow:[address,address+9]},'render_stack_alias_required');
  fail(sampleFixture({bank:0x7E}),{bank:0x7E,stackWindow:[0x2140,0x2149]},'render_stack_alias_required');
});
test('F130 inner loaders share actual global F007/pair poll positions and cumulative work with a single outer commit',()=>{
  const data=sampleFixture(),before=data.snapshot(),view=prepareRenderView(data),budget={work:7,maxWork:1000};
  const baseWork=prepare(sampleFixture()).work;
  const observations={apuPolls:2},context={...sampleEntry,observations,ioRead2140:[99,99,0,99,1,2,3,4,5]};
  const first=renderF130(view,context,budget);assert.equal(first.apuPolls,6);assert.equal(first.polls,4);assert.equal(first.work,baseWork+8);
  const second=renderF130(view,context,budget);assert.equal(second.apuPolls,9);assert.equal(second.polls,3);
  assert.equal(second.work,baseWork*2+8);assert.deepEqual(data.snapshot(),before);
  assert.throws(()=>data.commit(first));assert.throws(()=>data.commit(second));
  assert.deepEqual(data.commit(view.finish(second)),{handled:true});assert.equal(at(data,0x1CE4),6);
});
test('F130 foreign/stale/inner plans cannot commit and late inner failures hold earlier outer writes back',()=>{
  const data=sampleFixture(),p=prepare(data);assert.throws(()=>sampleFixture().commit(p));
  data.seed(0x1CE4,[99]);assert.deepEqual(data.commit(p),{handled:false,reason:'render_plan_stale'});
  const d=sampleFixture(),before=d.snapshot(),view=prepareRenderView(d);view.write(0x1CE7,0x88);
  assert.throws(()=>renderF130(view,{...sampleEntry,ioRead2140:[0,1]},{work:0,maxWork:1000}),e=>e.reason==='render_io_read_required');
  assert.deepEqual(d.snapshot(),before);
});
test('F130 missing/invalid contexts remain explicit, without widening public BYTE/WORD APIs',()=>{
  for(const options of [{a:null},{x:null},{y:null},{bank:null},{status:null},{status:32},{status:16},{status:8},{emulation:1},{directPage:1}])
    fail(sampleFixture(),options,'render_entry_required');
  for(const options of [{a:-1},{x:65536},{y:0.5},{bank:256},{status:256},{maxWork:0},{ioMode:'execute'},
    {ioRead2140:[256]},{ioRead2140:Array(1)},{ioRead2140:0}])assert.throws(()=>prepare(sampleFixture(),options));
});
test('F130 synthetic probe pins original184/94 and10-byte proof with seven explicit scope/boundary records',async()=>{
  const report=JSON.parse(await readFile('analysis/render-f130-native.json','utf8'));assert.match(report.scope,/explicitly synthetic/);
  assert.match(report.scope,/No audio\/device\/CPU\/clock/);assert.equal(report.source.covered_bytes,184);assert.equal(report.source.instruction_count,94);
  assert.equal(report.stackProof.minimum_protected_stack_bytes,10);assert.equal(report.stackProof.external_return_assumptions,0);
  assert.deepEqual(report.probes.map(p=>p.handled),[true,true,true,true,true,false,false]);
  for(const p of report.probes.slice(5))assert.equal(p.operations,undefined);
});
