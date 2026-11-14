import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData,prepareRenderView } from '../src/render/data.mjs';
import { prepareRender8F3A,render8F3A } from '../proof/render/transfer-8f3a.mjs';
import { prepareRender8EFE,render8EFE } from '../proof/render/window-8efe.mjs';
import { render905E } from '../proof/render/fields-905e.mjs';
import { fields905EWindows } from './render-905e-fixtures.mjs';
import { transferEntry as entry,transferFixture as fixture,transferWindows as windows,transferTable as table } from './render-8f3a-fixtures.mjs';
const prepare=(data,options={})=>prepareRender8F3A({...entry,data,...options});
const helper=(data,options={})=>prepareRender8EFE({...entry,data,a:0xABCD,x:0x20,stackWindow:[0x1FFC,0x1FFF],...options});
const word=(data,a)=>data.readByte(a).value|data.readByte(a+1).value<<8;
function unchanged(data,options,reason,phase){const before=data.snapshot(),p=prepare(data,options);
  assert.equal(p.handled,false,JSON.stringify(p));assert.equal(p.reason,reason);if(phase)assert.equal(p.compositionPhase,phase);
  for(const k of['operations','byteWrites','ioWrites','readAddresses'])assert.equal(p[k],undefined);
  assert.deepEqual(data.snapshot(),before);return p;}
// Signed integer addition is independent of the implementation's carry-chain
// expression. No CPU execution; models only source-proven binary BYTE ADC.
function addByte(left,right,carry){const sum=left+right+carry;return {value:sum%256,carry:Math.floor(sum/256)};}
function expected(x){const low=x%256,first=addByte(low,0x39,0),second=addByte(low,0xC5,first.carry),
  inverse=255-low,third=addByte(inverse,0x3B,second.carry),last=addByte(inverse,0xC7,0);
  return [first.value,second.value,third.value,last.value];}
test('8F3A probes keep original table separate from synthetic observations and local proof',async()=>{
  const source=JSON.parse(await readFile('analysis/render-8f3a.json','utf8')),report=JSON.parse(await readFile('analysis/render-8f3a-native.json','utf8'));
  assert.deepEqual(report.source,source.windows[0]);assert.deepEqual(report.helperSources,source.windows.slice(1));assert.deepEqual(report.table,source.tables[0]);
  assert.deepEqual(report.stackProof,source.full_graph.proof);assert.match(report.scope,/synthetic/);
  assert.deepEqual(report.probes.map(p=>p.handled),[true,true,true,true,true,true,false,false,false,false,false,false,false,false,false]);
  assert.ok(report.helperProbes.every(p=>p.handled));
});
test('8F3A exact ordered setup/table/gate and eleven calls use118work63output with one commit',()=>{
  const data=fixture(),before=data.snapshot(),p=prepare(data);assert.ok(p.handled);assert.deepEqual(data.snapshot(),before);
  assert.equal(p.work,118);assert.equal(p.outputBytes,63);assert.equal(p.ioWrites.length,6);assert.equal(p.counterPolls,11);
  assert.equal(p.a,0x12A6);assert.equal(p.x,0x23);assert.equal(p.y,entry.y);assert.equal(p.status,0x45);
  assert.deepEqual(p.operations.slice(0,3).map(e=>[e.space,e.address,e.value,e.bytes]),
    [['io',0x802123,0x2222,2],['io',0x80212A,0,2],['io',0x804302,0x144,2]]);
  for(let n=0;n<16;n++){const x=15-n;assert.deepEqual(p.operations.slice(3+n*2,5+n*2).map(e=>[e.kind,e.address,e.value,e.bytes]),
    [['read',0x808F87+x,table[x],1],['write',0x800144+x,table[x],1]]);}
  assert.deepEqual(p.operations.slice(35,41).map(e=>[e.kind,e.address,e.value,e.bytes]),
    [['write',0x804300,1,1],['write',0x804301,0x26,1],['write',0x804304,0x7E,1],
      ['read',0x8001C4,0xA4,1],['write',0x8001C4,0xA5,1],['write',0x8001C2,15,2]]);
  const indices=[2,5,8,11,14,17,20,23,26,29,32];assert.deepEqual(p.iterations.map(i=>i.x),indices);
  for(let n=0;n<11;n++){
    assert.deepEqual(p.operations.slice(41+n*7,44+n*7).map(e=>[e.kind,e.space,e.address,e.value]),
      [['read','data',0x7E1C76,0x1234+n],['write','external',0x7E1C76,0x1235+n],['read','data',0x7E1C76,0x1235+n]]);
    assert.deepEqual(p.operations.slice(44+n*7,48+n*7).map(e=>[e.address,e.value,e.bytes]),
      [0x149,0x14F,0x148,0x14E].map((a,k)=>[0x800000+a,expected(indices[n])[k],1]));
  }
  assert.ok(p.operations.every(Object.isFrozen));assert.equal(p.byteWrites.length,21);assert.deepEqual(data.commit(p),{handled:true});
  assert.equal(word(data,0x1C2),15);assert.equal(data.readByte(0x1C4).value,0xA5);assert.equal(word(data,0x1C76),0x123F);
});
test('8EFE all65536 X values use BYTE carry propagation while retaining full X/highA/P',()=>{
  const data=fixture();for(let x=0;x<65536;x++){
    const a=(x*137)&65535,p=helper(data,{x,a});assert.ok(p.handled);assert.equal(p.a,(a&0xFF00)|expected(x)[3]);
    assert.equal(p.x,x);assert.equal(p.status,entry.status);assert.equal(p.work,4);assert.equal(p.outputBytes,4);
    assert.deepEqual(p.operations.map(e=>e.value),expected(x));
  }
});
test('8EFE all admissible status flags restored including carry/overflow and unknown Y',()=>{
  for(let status=0;status<256;status++)if(!(status&0x38))for(const x of[0,0x39,0x3A,0xC6,0xC7,0xFF,0xFFFF]){
    const p=helper(fixture(),{status,x,y:null});assert.ok(p.handled);assert.equal(p.status,status);assert.equal(p.y,null);
    assert.equal(p.carry,status&1);assert.equal(p.overflow,status>>>6&1);
  }
});
test('8F3A all65536 last baseline words preserve highA but end with lowA6/CPX flags',()=>{
  // Ten arbitrary unequal observations then any final baseline and another
  // unequal word: B0A1's saved baseline, not final observation, supplies highA.
  const data=fixture();for(let baseline=0;baseline<65536;baseline++){
    const prior=baseline<=1?2:0,observed=baseline^65535;
    const polls=[prior^1,prior,prior^1,prior,prior^1,prior,prior^1,prior,prior^1,baseline,observed];
    data.seed(0x7E1C76,[prior&255,prior>>>8]);const p=prepare(data,{waitRead1C76:polls});
    assert.ok(p.handled);assert.equal(p.a,(baseline&0xFF00)|0xA6);assert.equal(p.status,0x45);assert.equal(p.x,35);
    assert.equal(p.iterations.at(-1).baseline,baseline);assert.equal(p.iterations.at(-1).observed,observed);
  }
});
test('8F3A all admissible status bits end with C1/N0/Z0 preserving V/I and Y',()=>{
  for(let status=0;status<256;status++)if(!(status&0x38)){
    const p=prepare(fixture(),{status,y:null});assert.ok(p.handled);assert.equal(p.status,(status&~0x83)|1);assert.equal(p.y,null);
  }
});
test('8F3A all256 gate bytes TSB onlybit0 and does not require highbyte01C5',()=>{
  const data=fixture();for(let gate=0;gate<256;gate++){
    data.seed(0x1C4,[gate]);const p=prepare(data);assert.ok(p.handled);assert.equal(p.operations[39].value,gate|1);
    assert.ok(!p.readAddresses.includes(0x7E01C5));assert.ok(!p.byteWrites.some(([a])=>a===0x7E01C5));
  }
});
test('8F3A all256 DBRs keep table80 and counter7E fixed; physical WRAMsetup adds9 outputbytes',()=>{
  for(let bank=0;bank<256;bank++){
    const data=fixture({bank}),before=data.snapshot(),p=prepare(data,{bank});
    if(!(bank&0x40)||[0x7E,0x7F].includes(bank)){
      assert.ok(p.handled);assert.equal(p.bank,bank);assert.equal(p.outputBytes,[0x7E,0x7F].includes(bank)?72:63);
      assert.equal(p.ioWrites.length,[0x7E,0x7F].includes(bank)?0:6);assert.deepEqual(data.snapshot(),before);
      assert.deepEqual(data.commit(p),{handled:true});const base=bank===0x7F?0x7F0000:0x7E0000;assert.equal(word(data,base+0x1C2),15);
      assert.equal(word(data,0x7E1C76),0x123F);
    }else{assert.equal(p.handled,false);assert.equal(p.reason,'render_address_required');assert.deepEqual(data.snapshot(),before);}
  }
});
test('8F3A every ROM source byte is required through provider; overridden bytes remain explicit inputs',()=>{
  const full=fixture().snapshot();for(let missing=0x808F87;missing<0x808F97;missing++){
    const data=createRenderData({writeWindows:full.writeWindows});for(const[a,v]of full.bytes)if(a!==missing)data.seed(a,[v]);
    assert.equal(unchanged(data,{},'render_source_required','table').address,missing);
  }
  const data=fixture({table:Array.from({length:16},(_,n)=>n)}),p=prepare(data);assert.ok(p.handled);
  assert.deepEqual(p.operations.filter(e=>e.phase==='table'&&e.kind==='read').map(e=>e.value),Array.from({length:16},(_,n)=>15-n));
});
test('8F3A missing gate/counter bytes stop late writes without effects',()=>{
  unchanged(fixture({gate:null}),{},'render_source_required','gate');unchanged(fixture({baseline:null}),{},'render_source_required','counterWait');
  const full=fixture().snapshot(),data=createRenderData({writeWindows:full.writeWindows});for(const[a,v]of full.bytes)if(a!==0x7E1C77)data.seed(a,[v]);
  assert.equal(unchanged(data,{},'render_source_required','counterWait').address,0x7E1C77);
});
test('8F3A all destination byte windows, stack aliases and work/output budget prefixes are atomic',()=>{
  for(const bank of[0x80,0x7E,0x7F]){
    const all=windows(bank),p=prepare(fixture({bank}),{bank}),addresses=new Set(p.byteWrites.map(([a])=>a));
    for(const missing of addresses){const writeWindows=all.flatMap(([a,b])=>missing<a||missing>b?[[a,b]]:
      [...(a<missing?[[a,missing-1]]:[]),...(missing<b?[[missing+1,b]]:[])]);
      assert.equal(unchanged(fixture({bank,writeWindows}),{bank},'render_write_window_required').address,missing);
    }
  }
  for(let maxWork=1;maxWork<118;maxWork++)unchanged(fixture(),{maxWork},'render_work_budget_required');
  for(let maxOutputBytes=1;maxOutputBytes<63;maxOutputBytes++)unchanged(fixture(),{maxOutputBytes},'render_output_budget_required');
  assert.ok(prepare(fixture(),{maxWork:118,maxOutputBytes:63}).handled);
  for(const stackWindow of[[0x144,0x149],[0x1C0,0x1C5],[0x1C74,0x1C79]])unchanged(fixture(),{stackWindow},'render_stack_alias_required');
  unchanged(fixture(),{stackWindow:[0x1FFB,0x1FFF]},'render_stack_required');
});
test('8EFE standalone every write/work/output/context boundary is atomic',()=>{
  for(const address of[0x148,0x149,0x14E,0x14F]){
    const data=createRenderData({writeWindows:[0x148,0x149,0x14E,0x14F].filter(a=>a!==address).map(a=>[0x7E0000+a,0x7E0000+a])}),before=data.snapshot(),p=helper(data);
    assert.equal(p.reason,'render_write_window_required');assert.equal(p.byteWrites,undefined);assert.deepEqual(data.snapshot(),before);
  }
  for(const options of[{maxWork:3},{maxOutputBytes:3},{a:null},{x:null},{stackWindow:[0x1FFD,0x1FFF]},{stackWindow:[0x148,0x14B]}]){
    const data=fixture(),before=data.snapshot(),p=helper(data,options);assert.equal(p.handled,false);assert.deepEqual(data.snapshot(),before);
  }
});
test('8F3A equal polls wait; WORDwrap and arbitrary unequal values release one iteration each',()=>{
  const polls=[];for(let n=0;n<11;n++){const baseline=(0xFFFF+n)&65535;polls.push(baseline,baseline,(baseline+1)&65535);}
  const p=prepare(fixture({baseline:0xFFFF}),{waitRead1C76:polls});assert.ok(p.handled);assert.equal(p.counterPolls,33);
  assert.equal(p.work,140);assert.ok(p.iterations.every(i=>i.polls===3));assert.equal(p.a,0xA6);
  const arbitrary=[0xF123,4,0x8000,0xFFFF,0x1234,0,0xFEEE,0x1233,5,0xDCBA,1];
  assert.equal(prepare(fixture(),{waitRead1C76:arbitrary}).a,0xDCA6);
});
test('8F3A lateeleventh wait exhaustion or observation/mode absence holds setup and ten updates back',()=>{
  const p=unchanged(fixture(),{waitRead1C76:entry.waitRead1C76.slice(0,10)},'render_wait_read_required','counterWait');assert.equal(p.iteration,10);
  unchanged(fixture(),{waitRead1C76:[]},'render_wait_read_required');
  unchanged(fixture(),{waitMode:null},'render_wait_context_required');
  unchanged(fixture(),{waitRead1C76:null,maxWork:80},'render_work_budget_required');
  unchanged(fixture(),{ioMode:null},'render_io_context_required','prefix');
  assert.ok(prepare(fixture(),{waitRead1C76:[...entry.waitRead1C76,0xFFFF]}).handled);
});
test('8F3A 65536 equal observations then eleven changes share complete transcript with late limits',()=>{
  const waitRead1C76=[...Array(65536).fill(0x1234),...entry.waitRead1C76],data=fixture(),p=prepare(data,{waitRead1C76,maxWork:65654});
  assert.ok(p.handled);assert.equal(p.work,65654);assert.equal(p.counterPolls,65547);assert.equal(p.outputBytes,63);
  unchanged(data,{waitRead1C76,maxWork:65653},'render_work_budget_required','window');
});
test('8F3A only explicitly written physical bytes change; full surrounding7E bank preserved',()=>{
  const data=fixture(),initial=Uint8Array.from({length:65536},(_,n)=>(n*19+(n>>>8)*3)&255);data.seed(0x7E0000,initial);data.seed(0x1C76,[0x34,0x12]);
  const p=prepare(data),changed=new Map(p.byteWrites);assert.ok(p.handled);assert.deepEqual(data.commit(p),{handled:true});
  for(let n=0;n<65536;n++)assert.equal(data.readByte(0x7E0000+n).value,changed.get(0x7E0000+n)??initial[n]);
});
test('8F3A foreign/copied/stale/replayed plans and innerresults cannot commit',()=>{
  const data=fixture(),p=prepare(data);assert.throws(()=>fixture().commit(p),/Invalid render plan/);assert.throws(()=>data.commit({...p}),/Invalid render plan/);
  assert.deepEqual(data.commit(p),{handled:true});assert.equal(data.commit(p).reason,'render_plan_stale');
  const stale=prepare(data,{waitRead1C76:Array.from({length:11},(_,n)=>0x1240+n)});data.seed(0x1C4,[3]);assert.equal(data.commit(stale).reason,'render_plan_stale');
  const inner=render8F3A(prepareRenderView(fixture()),entry,{work:0,maxWork:118,outputBytes:0,maxOutputBytes:63});assert.throws(()=>data.commit(inner),/Invalid render plan/);
});
test('two actual inner8F3A calls share global observations, fresh counter baselines and one cumulative plan',()=>{
  const data=fixture(),before=data.snapshot(),view=prepareRenderView(data),observations={},context={...entry,observations,waitRead1C76:Array.from({length:22},(_,n)=>0x1235+n)},
    budget={work:0,maxWork:236,outputBytes:0,maxOutputBytes:126};
  const first=render8F3A(view,context,budget),second=render8F3A(view,context,budget);assert.equal(first.counterPolls,11);assert.equal(second.counterPolls,22);
  assert.equal(second.iterations[0].baseline,0x123F);assert.equal(second.outputBytes,126);assert.equal(second.work,236);assert.deepEqual(data.snapshot(),before);
  assert.deepEqual(data.commit(view.finish(second)),{handled:true});assert.equal(word(data,0x1C76),0x124A);
  for(const limited of[{maxWork:235},{maxOutputBytes:125}]){
    const owner=fixture(),snapshot=owner.snapshot(),v=prepareRenderView(owner),b={work:0,maxWork:236,outputBytes:0,maxOutputBytes:126,...limited},c={...context,observations:{}};
    render8F3A(v,c,b);assert.throws(()=>render8F3A(v,c,b),e=>e.renderBoundary===true);assert.deepEqual(owner.snapshot(),snapshot);
  }
});
test('actual905E then8F3A share provider/independent wait streams; late failure also holds905E back',()=>{
  const writeWindows=[...windows(),...fields905EWindows()],data=fixture({writeWindows});data.seed(0x1BA,[0x80,0]);data.seed(0x1562,[0xFF,0xFF]);
  const before=data.snapshot(),view=prepareRenderView(data),context={...entry,waitRead0140:[0x8001],observations:{}},budget={work:0,maxWork:134,outputBytes:0,maxOutputBytes:75};
  const fields=render905E(view,context,budget),transfer=render8F3A(view,{...context,status:fields.status,y:fields.y},budget);
  assert.equal(transfer.work,134);assert.equal(transfer.outputBytes,75);assert.equal(context.observations.waitPolls0140,1);assert.equal(context.observations.counterPolls,11);
  assert.deepEqual(data.snapshot(),before);assert.deepEqual(data.commit(view.finish(transfer)),{handled:true});assert.equal(word(data,0x7E3D12),0x7480);
  const owner=fixture({writeWindows});owner.seed(0x1BA,[0,0]);owner.seed(0x1562,[0,0]);const snapshot=owner.snapshot(),v=prepareRenderView(owner),b={work:0,maxWork:133,outputBytes:0,maxOutputBytes:75},c={...context,observations:{}};
  render905E(v,c,b);assert.throws(()=>render8F3A(v,c,b),e=>e.reason==='render_work_budget_required');assert.deepEqual(owner.snapshot(),snapshot);
});
test('8EFE inner reads incoming highA/fresh caller context and contributes to outer budget only',()=>{
  const data=fixture(),view=prepareRenderView(data),budget={work:0,maxWork:8,outputBytes:0,maxOutputBytes:8};
  const first=render8EFE(view,{bank:0x80,status:0xC5,a:0xDEAD,x:0xC7,y:null},budget),second=render8EFE(view,{...first,x:0x39},budget);
  assert.equal(second.work,8);assert.equal(second.outputBytes,8);assert.equal(second.a,0xDE8D);assert.equal(second.status,0xC5);
  assert.throws(()=>data.commit(first),/Invalid render plan/);assert.deepEqual(data.commit(view.finish(second)),{handled:true});
});
test('8F3A malformed options throw and unsupported mode contexts fail without effects',()=>{
  for(const options of[{y:-1},{waitRead1C76:[-1]},{waitRead1C76:Array(2)},{ioMode:'automatic'},{waitMode:'automatic'},{maxWork:0}])assert.throws(()=>prepare(fixture(),options),/Invalid/);
  for(const options of[{bank:null},{status:null},{status:0x20},{status:8},{status:0x10},{emulation:1},{directPage:1}])unchanged(fixture(),options,'render_entry_required');
});
