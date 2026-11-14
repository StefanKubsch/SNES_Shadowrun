import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderA954, renderA954 } from '../proof/render/gate-a954.mjs';
import { a954Entry, a954Fixture } from './render-a954-fixtures.mjs';
const prepare = (data, options = {}) => prepareRenderA954({ ...a954Entry, data, ...options });
const seed = (data, address, value) => data.seed(address, [value & 255, value >>> 8]);
const word = (data, address) => data.readByte(address).value | data.readByte(address + 1).value << 8;
function fail(data, options, reason) {
  const before = data.snapshot(), p = prepare(data, options);
  assert.equal(p.handled, false); assert.equal(p.reason, reason);
  for (const key of ['byteWrites', 'operations', 'ioWrites', 'readAddresses']) assert.equal(p[key], undefined);
  assert.deepEqual(data.snapshot(), before); return p;
}

test('A954 all65536 WORDvalues increment fullbytes and deriveNZ from memory while preserving A/X/Y/C/V/I',()=>{
  const data=a954Fixture();
  for(let value=0;value<65536;value++){
    seed(data,0x7E1562,value);const p=prepare(data);assert.ok(p.handled);
    const result=value===65535?0:value+1;
    assert.equal(p.previous,value);assert.equal(p.value,result);
    assert.equal(p.status,(a954Entry.status&0x7D)|(result===0?2:0)|(result>=32768?128:0));
    assert.equal(p.a,0x28);assert.equal(p.x,0x800);assert.equal(p.y,0xBEEF);assert.equal(p.bank,0x80);
    assert.equal(p.carry,1);assert.equal(p.overflow,1);assert.equal(p.work,2);assert.equal(p.outputBytes,2);
    assert.deepEqual(p.byteWrites,[[0x7E1562,result&255],[0x7E1563,result>>>8]]);
  }
});

test('A954 all admissible statuses preserve every bit except INC N/Z',()=>{
  for(let status=0;status<256;status++)if(!(status&0x38))for(const value of [0,0xFF,0x7FFE,0x7FFF,0xFFFE,0xFFFF]){
    const p=prepare(a954Fixture({value}),{status});assert.ok(p.handled);
    assert.equal(p.status&0x7D,status&0x7D);assert.equal(Boolean(p.status&2),value===65535);
    assert.equal(Boolean(p.status&128),value>=32767&&value<65535);
    assert.equal(p.carry,status&1);assert.equal(p.overflow,status>>>6&1);
  }
});

test('A954 all256 DBRs map128 systembanks and7E/7F to realWRAM;126 unsupportedbanks fail without effects',()=>{
  for(let bank=0;bank<256;bank++){
    const data=a954Fixture({bank,value:0x7FFF});
    if(bank===0x7E||bank===0x7F||!(bank&0x40)){
      const before=data.snapshot(),p=prepare(data,{bank});assert.ok(p.handled);assert.deepEqual(data.snapshot(),before);
      const physical=bank===0x7F?0x7F1562:0x7E1562;
      assert.equal(p.operations[0].address,bank*65536+0x1562);assert.equal(p.operations[1].address,bank*65536+0x1562);
      assert.deepEqual(p.readAddresses,[physical,physical+1]);assert.equal(p.bank,bank);assert.deepEqual(p.ioRequests,[]);
      assert.deepEqual(data.commit(p),{handled:true});assert.equal(word(data,physical),0x8000);
    }else assert.equal(fail(data,{bank},'render_address_required').address,bank*65536+0x1562);
  }
});

test('A954 each preservedregister accepts all65536 WORDvalues or explicit unknown without fabricating a load',()=>{
  const data=a954Fixture();
  for(let value=0;value<65536;value++){
    const p=prepare(data,{a:value,x:65535-value,y:value^0x8000});assert.ok(p.handled);
    assert.equal(p.a,value);assert.equal(p.x,65535-value);assert.equal(p.y,value^0x8000);
  }
  const p=prepare(data,{a:null,x:null,y:null});assert.ok(p.handled);assert.equal(p.a,null);assert.equal(p.x,null);assert.equal(p.y,null);
});

test('A954 exact two-event WORDtranscript preserves freshread before write with frozen operations',()=>{
  const p=prepare(a954Fixture({value:0xFFFF}));assert.ok(p.handled);
  assert.deepEqual(p.operations,[{kind:'read',space:'data',phase:'source',address:0x801562,value:65535,bytes:2},
    {kind:'write',space:'data',phase:'increment',address:0x801562,value:0,bytes:2}]);
  assert.ok(Object.isFrozen(p.operations));assert.ok(p.operations.every(Object.isFrozen));
  assert.equal(p.minimumStackBytes,3);assert.equal(p.outcome,'gate_increment_prepared');
});

test('A954 committed low/highbytecarry and wrap preserve every other7E bankbyte',()=>{
  const initial=Uint8Array.from({length:65536},(_,n)=>(n*13+(n>>>8)*31)&255);
  for(const value of [0,0xFF,0x7FFF,0xFFFF]){
    const data=a954Fixture({value:null});data.seed(0x7E0000,initial);seed(data,0x7E1562,value);
    const before=data.snapshot(),p=prepare(data);assert.ok(p.handled);assert.deepEqual(data.snapshot(),before);
    assert.deepEqual(data.commit(p),{handled:true});assert.equal(word(data,0x7E1562),(value+1)&65535);
    for(let a=0;a<65536;a++)if(a!==0x1562&&a!==0x1563)assert.equal(data.readByte(0x7E0000+a).value,initial[a]);
  }
});

test('A954 both requiredsourcebytes including missinghighbyte stop atomically',()=>{
  for(const missing of [0x7E1562,0x7E1563]){
    const data=a954Fixture({value:null});data.seed(missing===0x7E1562?0x7E1563:0x7E1562,[0xFF]);
    const p=fail(data,{},'render_source_required');assert.equal(p.address,missing);assert.equal(p.phase,'source');assert.equal(p.caller,'A954');
  }
});

test('A954 both destinationbytes require windows; latehighbyte failure withholds the lowbyte',()=>{
  for(const missing of [0x7E1562,0x7E1563]){
    const other=missing===0x7E1562?0x7E1563:0x7E1562;
    const p=fail(a954Fixture({value:0xFF,writeWindows:[[other,other]]}),{},'render_write_window_required');
    assert.equal(p.address,missing);assert.equal(p.phase,'increment');
  }
});

test('A954 exact work2/output2 boundaries and every valid smallerbudget fail without effects',()=>{
  fail(a954Fixture(),{maxWork:1},'render_work_budget_required');fail(a954Fixture(),{maxOutputBytes:1},'render_output_budget_required');
  const p=prepare(a954Fixture(),{maxWork:2,maxOutputBytes:2});assert.ok(p.handled);assert.equal(p.work,2);assert.equal(p.outputBytes,2);
});

test('A954 three protectedJSLbytes required; actual7E source/writealiases are rejected,7F disjoint allowed',()=>{
  assert.ok(prepare(a954Fixture(),{stackWindow:[0x1FFD,0x1FFF]}).handled);
  fail(a954Fixture(),{stackWindow:[0x1FFE,0x1FFF]},'render_stack_required');
  for(const stackWindow of [[0x1560,0x1562],[0x1563,0x1565]])fail(a954Fixture(),{stackWindow},'render_stack_alias_required');
  assert.ok(prepare(a954Fixture({bank:0x7F}),{bank:0x7F,stackWindow:[0x1561,0x1563]}).handled);
});

test('A954 two actualinnercalls read freshincremented bytes, share budgets and one outercommit',()=>{
  // Synthetic caller; no original905E/callback/936C chronology inferred.
  const data=a954Fixture({value:0xFFFE}),before=data.snapshot(),view=prepareRenderView(data),budget={work:0,maxWork:4,outputBytes:0,maxOutputBytes:4};
  const first=renderA954(view,a954Entry,budget),second=renderA954(view,first,budget);
  assert.equal(first.value,0xFFFF);assert.equal(first.status&0x82,0x80);assert.equal(second.previous,0xFFFF);assert.equal(second.value,0);assert.equal(second.status&0x82,2);
  assert.equal(first.work,2);assert.equal(second.work,4);assert.equal(second.outputBytes,4);assert.equal(second.a,a954Entry.a);
  assert.deepEqual(data.snapshot(),before);assert.throws(()=>data.commit(first));assert.throws(()=>data.commit(second));
  const p=view.finish(second);assert.deepEqual(p.byteWrites,[[0x7E1562,0],[0x7E1563,0]]);assert.deepEqual(data.commit(p),{handled:true});assert.equal(word(data,0x7E1562),0);
});

test('A954 earlier outerhighbytewrite is fresh; inherited work/outputbudget remain cumulative',()=>{
  const data=a954Fixture({value:0xFF}),before=data.snapshot(),view=prepareRenderView(data);view.write(0x7E1563,0x7F);
  const budget={work:7,maxWork:9,outputBytes:5,maxOutputBytes:7},p=renderA954(view,a954Entry,budget);
  assert.equal(p.previous,0x7FFF);assert.equal(p.value,0x8000);assert.equal(p.work,9);assert.equal(p.outputBytes,7);assert.deepEqual(data.snapshot(),before);
  assert.deepEqual(data.commit(view.finish(p)),{handled:true});assert.equal(word(data,0x7E1562),0x8000);
});

test('A954 secondinner work/outputfailure withholds earlier successful increment and all outerwrites',()=>{
  for(const[options,reason]of [[{maxWork:3,maxOutputBytes:4},'render_work_budget_required'],[{maxWork:4,maxOutputBytes:3},'render_output_budget_required']]){
    const data=a954Fixture(),before=data.snapshot(),view=prepareRenderView(data),budget={work:0,outputBytes:0,...options};
    const first=renderA954(view,a954Entry,budget);assert.ok(first.handled);
    assert.throws(()=>renderA954(view,first,budget),e=>e.reason===reason&&e.caller==='A954'&&e.phase==='increment');
    assert.deepEqual(data.snapshot(),before);assert.throws(()=>data.commit(first));
  }
});

test('A954 late innerhighbytewindow and stackaliases discard earlier synthetic outereffects',()=>{
  for(const[windows,stack,reason]of [[[[0x7E1500,0x7E1500],[0x7E1562,0x7E1562]],[],'render_write_window_required'],
    [[[0x7E1500,0x7E1500],[0x7E1562,0x7E1563]],[0x7E1563,0x7E1565],'render_stack_alias_required']]){
    const data=a954Fixture({writeWindows:windows}),before=data.snapshot(),view=prepareRenderView(data,stack);view.write(0x7E1500,0xAB);
    assert.throws(()=>renderA954(view,a954Entry,{work:0,maxWork:2,outputBytes:0,maxOutputBytes:2}),e=>e.reason===reason);
    assert.deepEqual(data.snapshot(),before);
  }
});

test('A954 foreign, copied, appliedtwice and staleplans reject with unchanged livebytes',()=>{
  const data=a954Fixture(),p=prepare(data),foreign=a954Fixture(),before=foreign.snapshot();
  assert.throws(()=>foreign.commit(p));assert.deepEqual(foreign.snapshot(),before);assert.throws(()=>data.commit({...p}));
  assert.deepEqual(data.commit(p),{handled:true});const applied=data.snapshot();assert.deepEqual(data.commit(p),{handled:false,reason:'render_plan_stale'});assert.deepEqual(data.snapshot(),applied);
  const q=prepare(data);seed(data,0x7E1562,0xABCD);const changed=data.snapshot();assert.deepEqual(data.commit(q),{handled:false,reason:'render_plan_stale'});assert.deepEqual(data.snapshot(),changed);
});

test('A954 unknown entry, unsupported widths/decimal/DP and malformed contexts reject without effects',()=>{
  for(const options of [{bank:null},{status:null},{status:0x20},{status:0x10},{status:8},{emulation:1},{directPage:1}])fail(a954Fixture(),options,'render_entry_required');
  for(const stackWindow of [null,[1],[3,2],[-1,2]])fail(a954Fixture(),{stackWindow},'render_stack_required');
  for(const options of [{a:-1},{a:65536},{x:1.5},{y:'1'},{bank:256},{status:256},{maxWork:0},{maxWork:1.5},{maxOutputBytes:0},{data:null}]){
    const data=a954Fixture(),before=data.snapshot();assert.throws(()=>prepare(data,options));assert.deepEqual(data.snapshot(),before);
  }
});

test('A954 twelve public syntheticprobes pin4/2 source,3 protectedbytes and six atomicfailures',async()=>{
  const report=JSON.parse(await readFile('analysis/render-a954-native.json','utf8'));
  assert.match(report.scope,/explicitly synthetic/);assert.match(report.scope,/No CPU\/device\/clock/);
  assert.equal(report.source.machine_bytes,'EE62156B');assert.equal(report.source.covered_bytes,4);assert.equal(report.source.instruction_count,2);
  assert.equal(report.stackProof.minimum_protected_stack_bytes,3);assert.equal(report.stackProof.external_return_assumptions,0);
  assert.deepEqual(report.probes.map(p=>p.handled),[true,true,true,true,true,true,false,false,false,false,false,false]);
  for(const p of report.probes.slice(6))assert.equal(p.operations,undefined);
});
