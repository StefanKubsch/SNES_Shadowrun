import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData,prepareRenderView,renderAddress } from '../src/render/data.mjs';
import { prepareRenderA6A5,prepareRenderA6AD,prepareRenderA6B8,prepareRenderA6C7,
  renderA6A5,renderA6AD,renderA6B8,renderA6C7 } from '../proof/render/menu-a6a5.mjs';
import { menuEntry as entry,menuFixture as fixture,menuWindows as windows } from './render-menu-fixtures.mjs';
import { textWord as word } from './render-text-compose-fixtures.mjs';
const publicEntries=[prepareRenderA6A5,prepareRenderA6AD,prepareRenderA6B8,prepareRenderA6C7];
const innerEntries=[renderA6A5,renderA6AD,renderA6B8,renderA6C7];
const run=(data,extra={},fn=prepareRenderA6A5)=>fn({...entry,data,...extra});
const get=(data,address)=>data.readByte(address).value|data.readByte(address+1).value<<8;
const callerOps=p=>p.operations.filter(e=>e.phase===`menu${p.helper}`);
function fail(data,extra,reason,fn=prepareRenderA6A5) {
  const before=data.snapshot(),p=run(data,extra,fn);assert.equal(p.handled,false);assert.equal(p.reason,reason);
  assert.deepEqual(data.snapshot(),before);
  for(const key of ['byteWrites','operations','ioRequests','byteOperations','calls'])assert.equal(p[key],undefined);
  assert.throws(()=>data.commit(p),/Invalid render plan/);return p;
}
function minimal(full,p) {
  const first=new Map();for(const e of p.byteOperations) {const a=renderAddress(e.address);if(!first.has(a))first.set(a,e.kind);}
  const data=createRenderData({writeWindows:full.snapshot().writeWindows});
  for(const [a,v]of full.snapshot().bytes)if(first.get(a)==='read')data.seed(a,[v]);return data;
}
// Explicit synthetic WORD observations at individual input reads for an inner
// caller. No mapping from counter values or NMI completion; writes and work
// share the same outer owner and are checked as external fixture operations.
function observedInner(data,samples,context={},fn=renderA6C7,firstInputWrites=[]) {
  const view=prepareRenderView(data),budget={work:0,maxWork:1000000,maxOutputBytes:65536,outputBytes:0};
  let reads=0;const events=[];
  const observed={
    read(address) {
      if(address===0x8001CA) {
        if(reads===0)for(const [a,value]of firstInputWrites) {
          budget.work+=2;view.write(a,value&255);view.write(a+1,value>>>8);events.push({address:a,value,space:'external'});
        }
        const current=view.read(address)|view.read(address+1)<<8;
        if(reads>=samples.length)throw {renderBoundary:true,reason:'synthetic_input_observation_required'};
        const value=samples[reads++];
        if(value!==current) {budget.work+=2;view.write(address,value&255);view.write(address+1,value>>>8);
          events.push({address,value,space:'external'});}
      }
      return view.read(address);
    },
    write:(address,value)=>view.write(address,value),
  };
  const before=data.snapshot();
  const p=fn(observed,{...entry,...context},budget);
  assert.deepEqual(data.snapshot(),before);
  return {p,plan:view.finish(p),view,budget,events,reads};
}

test('normal menu cancel is one atomic list/mark/wait/filter/unmark plan with exact original order',()=>{
  const data=fixture(),before=data.snapshot(),p=run(data);assert.equal(p.handled,true);assert.deepEqual(data.snapshot(),before);
  assert.equal(p.outcome,'menu_cancelled');assert.equal(p.selection,65535);assert.equal(p.iterations,1);
  assert.deepEqual([p.a,p.x,p.y,p.bank,p.status],[0,2,0,0x80,6]);
  assert.deepEqual(p.calls.map(c=>[c.name,c.role]),[['A617','initial-list'],['A5F9','initial-mark'],
    ['B0A1','counter-wait'],['9E1A','loop-input'],['A5DB','cancel-unmark'],['9E1A','cancel-input']]);
  assert.equal(p.outputBytes,198);assert.equal(p.counterPolls,1);assert.equal(p.apuPolls,0);
  assert.equal(data.commit(p).handled,true);assert.equal(get(data,0),65535);assert.equal(get(data,0x1CC),0x2000);
  assert.equal(get(data,0x1CE),0);assert.equal(get(data,0x7E1C76),1);
});

test('four entry prefixes perform original flag/index stores; B8 doubles full incoming A before any helper',()=>{
  for(const [j,fn] of publicEntries.entries()) {
    const p=run(fixture(),{a:0x8001},fn);assert.equal(p.handled,true);
    const prefix=callerOps(p).filter(e=>e.kind==='write').slice(0,3).map(e=>[e.address,e.value]);
    assert.deepEqual(prefix,j===0?[[0x801DA7,65535],[0x801DA5,0],[0x801D97,0]]:
      j===1?[[0x801DA5,65535],[0x801DA7,0],[0x801D97,0]]:
      j===2?[[0x801D97,2],[0x801DA5,65535],[0x801DA7,0]]:[[0x801DA7,0],[0x801DA5,0],[0x801D97,0]]);
    assert.equal(p.calls[1].before.y,j===2?2:0);
  }
});

test('all65536 B8 input words preserve original doubling wrap and unsigned final selection',()=>{
  const full=fixture({held:0x40,tokens:[0]});word(full,0x9D8000,0x8A00);
  const first=run(full,{a:0},prepareRenderA6B8);assert.equal(first.handled,true);const data=minimal(full,first);
  for(let a=0;a<65536;a++) {
    const p=run(data,{a},prepareRenderA6B8);assert.equal(p.handled,true);
    assert.equal(p.selection,a%32768);assert.equal(p.calls[1].before.y,(a*2)%65536);
  }
});

test('all65536 held words follow original reset/nibble-filter/cancel/confirm gates without inventing input',()=>{
  const full=fixture({held:0x40,tokens:[0]});word(full,0x9D8000,0x8A00);
  const first=run(full,{},prepareRenderA6C7),data=minimal(full,first);assert.equal(first.handled,true);
  word(data,0x7E1802,0); // Explicit next-token boundary for the otherwise unused navigation path.
  for(let held=0;held<65536;held++) {
    word(data,0x1CA,held);word(data,0x1CC,0);
    const p=run(data,{},prepareRenderA6C7);
    if(held===0x3030) {assert.equal(p.reason,'render_reset_source_required');continue;}
    if(held%16!==0||!(held&0xF0C0)) {assert.equal(p.handled,false);assert.equal(p.reason,'render_wait_read_required');continue;}
    if(held&0x2000) {assert.equal(p.outcome,'menu_cancelled');assert.equal(p.selection,65535);}
    else {assert.equal(p.outcome,'menu_confirmed');assert.equal(p.selection,0);}
    assert.equal(p.a,0);assert.equal(p.carry,Number(held>=0x3030));
  }
});

test('confirmation executes original4C parameter stores, audio and fresh final filter; cancel wins over confirm',()=>{
  const data=fixture({held:0x40}),p=run(data,{},prepareRenderA6C7);assert.equal(p.handled,true);
  assert.deepEqual([p.a,p.x,p.y,p.bank,p.status],[0,0xFF2D,0x4C,0x80,6]);assert.equal(p.apuPolls,3);
  assert.deepEqual(p.calls.slice(-3).map(c=>c.name),['A5DB','C46E','9E1A']);
  const writes=callerOps(p).filter(e=>e.kind==='write').slice(-5).map(e=>[e.address,e.value]);
  assert.deepEqual(writes,[[0,65535],[4,64],[6,3],[2,76],[0,0]]);
  const cancel=run(fixture({held:0x2040}),{},prepareRenderA6C7);assert.equal(cancel.outcome,'menu_cancelled');
  assert.equal(cancel.calls.some(c=>c.name==='C46E'),false);
});

test('original down-before-up navigation preserves savedY, uses fresh hotkey mask and emits no4A audio',()=>{
  const data=fixture({tokens:[0x10,0x10,0],count:2,held:0xC00,numbers:[0,0xC00,0]});
  const p=run(data);assert.equal(p.handled,true);assert.equal(p.moves,1);assert.equal(p.selection,1);
  assert.deepEqual(p.calls.filter(c=>c.role.startsWith('move')).map(c=>[c.role,c.before.y]),[['move-unmark',0],['move-mark',2]]);
  const audio=p.calls.filter(c=>c.name==='C46E');assert.equal(audio.length,1);assert.equal(audio[0].before.a,76);
  const ops=callerOps(p);const saved=ops.findIndex(e=>e.kind==='read'&&e.address===0&&e.value===2);
  const pei=ops.slice(saved,saved+10).map(e=>[e.kind,e.address,e.value]);
  assert.deepEqual(pei,[['read',0,2],['read',6,2],['write',0,65535],['write',4,64],
    ['write',6,3],['write',2,74],['write',6,2],['write',0,2],['read',0x801DA7,65535],['read',8,0x1800]]);
});

test('down at null token and up at index0 do not move; hotkey first nonzero wins with original PHY-to-PLA',()=>{
  for(const held of [0x400,0x800]) {
    const p=run(fixture({held,numbers:[held,0,0]}));assert.equal(p.handled,true);assert.equal(p.moves,0);
    assert.equal(p.hotkeyReads,1);assert.equal(p.selection,0);
    assert.equal(p.calls.filter(c=>c.role==='hotkey-unmark').length,1);
  }
  const p=run(fixture({tokens:[0x10,0x10,0],count:2,held:0x100,numbers:[0x100,0x100,0]}));
  assert.equal(p.handled,true);assert.equal(p.hotkeyReads,1);assert.equal(p.selection,0);
});

test('scroll-down keeps selected WORDY across real FA67/A617 and globally consumes transfer observations',()=>{
  const data=fixture({tokens:[0x10,0x10,0],count:1,held:0x400,numbers:[0,0x400,0]});
  const p=run(data);assert.equal(p.handled,true);assert.equal(p.pages,1);assert.equal(p.moves,1);assert.equal(p.selection,1);
  assert.equal(p.pollsF6,1);assert.ok(p.calls.some(c=>c.role==='scroll-list'));
  const mark=p.calls.find(c=>c.role==='move-mark');assert.equal(mark.before.y,2);
  data.commit(p);assert.equal(get(data,0x1D95),2);assert.equal(get(data,6),3);
});

test('explicit synthetic input read transcript tests multi-iteration down then up with one global counter list',()=>{
  const data=fixture({tokens:[0x10,0x10,0],count:2,held:0x400});
  const {p,plan}=observedInner(data,[...Array(4).fill(0x400),...Array(4).fill(0x800),...Array(7).fill(0x40)],
    {waitRead1C76:[1,2,3]});
  assert.equal(p.iterations,3);assert.equal(p.moves,2);assert.equal(p.counterPolls,3);assert.equal(p.selection,0);
  data.commit(plan);assert.equal(get(data,0x1D97),0);
});

test('exact20 held repeat writes19 and forces a move; earlier equal held input supplies no edge',()=>{
  const data=fixture({tokens:[0x10,0x10,0],count:2,held:0x400,previous:0x400});
  const samples=[...Array(19*4+5).fill(0x400),...Array(7).fill(0x40)];
  const {p,plan}=observedInner(data,samples,{waitRead1C76:Array.from({length:21},(_,i)=>i+1)});
  assert.equal(p.iterations,21);assert.equal(p.repeats,1);assert.equal(p.moves,1);assert.equal(p.selection,1);
  const counts=callerOps(p).filter(e=>e.kind==='write'&&e.address===0x801DA1).map(e=>e.value);
  assert.ok(counts.includes(20));assert.deepEqual(counts.slice(-4),[19,20,19,0]);
  data.commit(plan);assert.equal(get(data,0x1DA1),0);
});

test('page-forward uses original WORD count do-loop, then page-back; scroll and selectedY remain fresh',()=>{
  const data=fixture({tokens:[0x10,0x10,0x10,0x10,0],count:2,held:0x10});
  const samples=[...Array(4).fill(0x10),...Array(4).fill(0x20),...Array(7).fill(0x40)];
  const {p,plan}=observedInner(data,samples,{waitRead1C76:[1,2,3],waitRead01F6:[1,0,2,0]});
  assert.equal(p.moves,2);assert.equal(p.pages,2);assert.equal(p.selection,0);assert.equal(p.pollsF6,4);
  assert.deepEqual(p.operations.filter(e=>e.phase==='wait'&&e.kind==='read'&&e.address===0x8001F6).map(e=>e.value),[1,0,2,0]);
  const before=data.snapshot();
  for(let length=0;length<4;length++) {
    assert.throws(()=>observedInner(data,samples,{waitRead1C76:[1,2,3],waitRead01F6:[1,0,2,0].slice(0,length)}),
      e=>e.reason==='render_wait_read_required');assert.deepEqual(data.snapshot(),before);
  }
  data.commit(plan);assert.equal(get(data,0x1D95),0);assert.equal(get(data,0x1D97),0);
});

test('page-forward count0 still reads first advanced entry and stops on actual zero; no count shortcut',()=>{
  const data=fixture({tokens:[0x10,0],count:0,held:0x10});
  const {p}=observedInner(data,[...Array(4).fill(0x10),...Array(7).fill(0x40)],{waitRead1C76:[1,2]});
  assert.equal(p.moves,0);assert.equal(p.pages,0);
  assert.ok(callerOps(p).some(e=>e.kind==='read'&&e.address===0x7E1802&&e.value===0));
});

test('previous-page double SBC inherits first borrow and clamps only final borrow, including wrapped positive result',()=>{
  const data=fixture({tokens:[0,0x10,0],count:20000,held:0x400});
  word(data,0x7E1800+25538,0);
  const {p,plan}=observedInner(data,[...Array(4).fill(0x400),...Array(7).fill(0x40)],
    {waitRead1C76:[1,2]},renderA6C7,[[0x801D95,3]]);
  // 3-20000 borrows to45539;45539-20000-1=25538 has no final borrow.
  assert.equal(p.pages,1);assert.equal(p.selection,1);
  assert.ok(callerOps(p).some(e=>e.kind==='write'&&e.address===0x801D95&&e.value===25538));
  data.commit(plan);assert.equal(get(data,0x1D95),25538);
});

test('fresh navigation token observes earlier text output alias instead of cached original list',()=>{
  const data=fixture({pointer:0x7E21A0,tokens:[0x10,0x10,0],count:2,held:0x400,numbers:[0x400,0,0]});
  word(data,0x9D8000,0xC141);const p=run(data);assert.equal(p.handled,true);assert.equal(p.moves,0);
  assert.equal(p.selection,0);assert.ok(callerOps(p).some(e=>e.kind==='read'&&e.address===0x7E21A2&&e.value===0));
});

test('long list WORD crosses7EFFFF and hotkey short pointer carries full Y into next bank',()=>{
  const data=fixture({pointer:0x7EFFFF,tokens:[0x10,0x10,0],count:2,held:0xC00,
    numberPointer:0xFFFF,numbers:[0x200,0,0]});
  const p=run(data);assert.equal(p.handled,true);assert.equal(p.selection,1);
  assert.ok(p.readAddresses.includes(0x7F0000));
  assert.ok(callerOps(p).some(e=>e.kind==='read'&&e.address===0x810001&&e.value===0x4A00));
});

test('numbered prefix shares distinct numeric division and WORD geometry transcripts before final input',()=>{
  const data=fixture({held:0x40,numbers:[5,0,0]}),p=run(data,{},prepareRenderA6AD);
  assert.equal(p.handled,true);assert.equal(p.numberQuotientReads,1);assert.equal(p.numberRemainderReads,1);
  assert.equal(p.quotientReads,0);assert.ok(p.resultReads>p.numberQuotientReads);
  const division=p.operations.find(e=>e.phase==='numberFD80'&&e.address===0x804204&&e.kind==='write');
  assert.equal(division.value,5);assert.equal(p.calls[0].after.y,2);
  fail(data,{ioRead4214Word:[]},'render_io_read_required',prepareRenderA6AD);
  fail(data,{ioRead4216Byte:[]},'render_io_read_required',prepareRenderA6AD);
});

test('late reset at loop, cancel or confirm discards earlier list/text/counter/audio effects',()=>{
  fail(fixture({held:0x3030}),{},'render_reset_source_required');
  for(const held of [0x40,0x2000]) {
    const data=fixture({held}),before=data.snapshot();
    assert.throws(()=>observedInner(data,[...Array(4).fill(held),...Array(3).fill(0x3030)]),
      e=>e.reason==='render_reset_source_required'&&e.menuStage===(held===0x40?'confirm-input':'cancel-input'));
    assert.deepEqual(data.snapshot(),before);
  }
});

test('low/high sound gates, cachehits and original FF terminator retain actual F130 Y under same menu commit',()=>{
  for(const sound of [0,0x2D,0x7FFF,0x8000,0x8007,0xFFFF]) {
    for(const cachedSound of [sound,0]) {
      const data=fixture({held:0x40,sound,cachedSound,load:sound>=0x8000&&sound!==cachedSound});
      const p=run(data,{},prepareRenderA6C7);assert.equal(p.handled,true);assert.equal(p.x,0xFF00|(sound&255));
      assert.equal(p.bank,0x80);assert.equal(p.y,sound>=0x8000&&sound!==cachedSound?(sound===0xFFFF?5:9):76);
      assert.equal(data.commit(p).handled,true);
    }
  }
});

test('all binary entry statuses preserve I and report flags from actual final9E1A not saved entry',()=>{
  for(let status=0;status<256;status++)if(!(status&0x38))for(const held of [0x40,0x2000,0x8000]) {
    const p=run(fixture({held}),{status},prepareRenderA6C7);assert.equal(p.handled,true);
    const last=p.calls.at(-1);assert.equal(p.status,(last.before.status&~0x83)|2|Number(held>=0x3030));
    assert.equal(p.status&4,status&4);assert.equal(p.a,0);
  }
});

test('all supported DBRs restore on cancel; confirmation forces80 and requires its fresh input source',()=>{
  for(let bank=0;bank<256;bank++) {
    if(bank&0x40&&bank!==0x7E&&bank!==0x7F) {fail(fixture(),{bank},'render_address_required');continue;}
    const writeWindows=bank===0x7F?[...windows,[0x7F01CA,0x7F0211],[0x7F1D95,0x7F1DA8]]:windows;
    const data=fixture({bank,writeWindows}),p=run(data,{bank});assert.equal(p.handled,true);assert.equal(p.bank,bank);
  }
  const data=fixture({bank:0x7F,held:0x40,writeWindows:[...windows,[0x7F01CA,0x7F0211],[0x7F1D95,0x7F1DA8]]});
  fail(data,{bank:0x7F},'render_source_required',prepareRenderA6C7);
  for(const [a,v]of [[0x1CA,0x8000],[0x1CC,0],[0x1CE,0]])word(data,a,v);
  word(data,0x1D97,0xBEEF);
  const p=run(data,{bank:0x7F},prepareRenderA6C7);assert.equal(p.handled,true);assert.equal(p.bank,0x80);assert.equal(p.carry,1);
  assert.equal(p.selection,0x5F77);
});

test('missing arithmetic/poll observations never produce native completion or publish earlier effects',()=>{
  for(const [field,reason]of [['ioRead4216','render_io_read_required'],['waitRead01FA','render_wait_read_required'],
    ['waitRead01FC','render_wait_read_required'],['waitRead1C76','render_wait_read_required'],
    ['ioRead4217','render_io_read_required'],['ioRead2140','render_io_read_required']]) {
    fail(fixture({held:0x40}),{[field]:[]},reason,prepareRenderA6C7);
  }
  fail(fixture(),{waitMode:null},'render_wait_context_required');
  fail(fixture(),{ioMode:null},'render_io_context_required');
  fail(fixture({held:0}),{waitRead1C76:[1,2,3]},'render_wait_read_required');
});

test('every global observation prefix fails atomically and genuine unequal APU/counter polls remain ordered',()=>{
  const data=fixture({held:0x40}),extra={waitRead1C76:[0,0,1],ioRead2140:[99,0,98,1,97,2]};
  const p=run(data,extra,prepareRenderA6C7);assert.equal(p.handled,true);
  assert.equal(p.counterPolls,3);assert.equal(p.apuPolls,6);
  const reads=p.operations.filter(e=>e.space==='io'&&e.kind==='read'&&e.address===0x802140);
  assert.deepEqual(reads.map(e=>e.value),[99,0,98,1,97,2]);
  for(const [field,count,reason]of [['ioRead4216',p.resultReads,'render_io_read_required'],
    ['ioRead4217',p.panResultReads,'render_io_read_required'],['ioRead2140',p.apuPolls,'render_io_read_required'],
    ['waitRead01FA',p.pollsFA,'render_wait_read_required'],['waitRead01FC',p.pollsFC,'render_wait_read_required'],
    ['waitRead1C76',p.counterPolls,'render_wait_read_required']])
    for(let length=0;length<count;length++)fail(data,{...extra,[field]:(extra[field]??entry[field]).slice(0,length)},reason,prepareRenderA6C7);
});

test('every required initial byte, late write byte and stack alias remain atomic boundaries',()=>{
  const full=fixture({held:0x40}),p=run(full,{},prepareRenderA6C7);assert.equal(p.handled,true);const data=minimal(full,p);
  const snapshot=data.snapshot();
  for(const [missing]of snapshot.bytes) {
    const owner=createRenderData({writeWindows:windows});
    for(const [a,v]of snapshot.bytes)if(a!==missing)owner.seed(a,[v]);
    fail(owner,{},'render_source_required',prepareRenderA6C7);
  }
  for(const [missing]of p.byteWrites.filter(([a])=>a>=0x7E1C76&&a<=0x7E1DA8)) {
    const trimmed=windows.flatMap(([a,b])=>missing<a||missing>b?[[a,b]]:
      [...(a<missing?[[a,missing-1]]:[]),...(missing<b?[[missing+1,b]]:[])]);
    const owner=createRenderData({writeWindows:trimmed});for(const [a,v]of snapshot.bytes)owner.seed(a,[v]);
    fail(owner,{},'render_write_window_required',prepareRenderA6C7);
  }
  fail(fixture(),{stackWindow:[0x1FED,0x1FFF]},'render_stack_required');
  for(const a of [0,0x1CA,0x1C76,0x1D95,0x21A0])
    fail(fixture(),{stackWindow:[a,a+19]},'render_stack_alias_required');
});

test('cumulative budget and output limits retain even late confirm/audio/counter writes',()=>{
  const data=fixture({held:0x40}),p=run(data,{},prepareRenderA6C7);assert.equal(p.handled,true);
  for(let maxWork=1;maxWork<p.work;maxWork+=Math.max(1,Math.floor(p.work/40)))
    fail(data,{maxWork},'render_work_budget_required',prepareRenderA6C7);
  fail(data,{maxWork:p.work-1},'render_work_budget_required',prepareRenderA6C7);
  assert.equal(run(data,{maxWork:p.work},prepareRenderA6C7).handled,true);
  for(let maxOutputBytes=1;maxOutputBytes<198;maxOutputBytes++)
    fail(data,{maxOutputBytes},'render_output_budget_required',prepareRenderA6C7);
  assert.equal(run(data,{maxOutputBytes:198},prepareRenderA6C7).handled,true);
  const full=fixture({held:0x40,tokens:[0]});word(full,0x9D8000,0x8A00);
  const fast=run(full,{},prepareRenderA6C7),small=minimal(full,fast);
  for(let maxWork=1;maxWork<fast.work;maxWork++)fail(small,{maxWork},'render_work_budget_required',prepareRenderA6C7);
});

test('inner/foreign/stale payloads cannot commit; public reports and byte payload remain immutable',()=>{
  const data=fixture();for(const fn of innerEntries) {
    const p=fn(prepareRenderView(data),entry,{work:0,maxWork:1000000,maxOutputBytes:65536,outputBytes:0});
    assert.equal(p.handled,true);assert.throws(()=>data.commit(p),/Invalid render plan/);
  }
  const p=run(data);assert.throws(()=>fixture().commit(p),/Invalid render plan/);
  assert.throws(()=>{p.calls[0].before.a=9;},TypeError);assert.throws(()=>{p.byteWrites[0][1]=9;},TypeError);
  word(data,0x1CA,0x40);const before=data.snapshot();
  assert.deepEqual(data.commit(p),{handled:false,reason:'render_plan_stale'});assert.deepEqual(data.snapshot(),before);
});

test('invalid observation streams and unknown entry values keep explicit public boundaries',()=>{
  for(const extra of [{a:-1},{x:65536},{y:NaN},{ioMode:'execute'},{waitMode:'execute'},
    {waitRead1C76:Array(1)},{ioRead4214Word:[65536]},{ioRead4216Byte:[256]},
    {ioRead4217:[-1]},{ioRead2140:[1.5]},{maxWork:0},{maxOutputBytes:0}])
    assert.throws(()=>run(fixture(),extra),/Invalid/);
  for(const extra of [{status:null},{bank:null},{emulation:1},{directPage:1},{status:0x20},{status:8}])
    fail(fixture(),extra,'render_entry_required');
  fail(fixture(),{a:null},'render_entry_required',prepareRenderA6B8);
  assert.equal(run(fixture(),{a:null,x:null,y:null},prepareRenderA6C7).handled,true);
});

test('synthetic manual report remains source/stack backed and reproducible through public APIs',async()=>{
  const report=JSON.parse(await readFile('analysis/render-menu-native.json','utf8'));
  assert.match(report.scope,/explicitly synthetic/);assert.match(report.scope,/No input inferred from counter/);
  assert.equal(report.stackProofs.length,4);assert.ok(report.stackProofs.every(p=>p.minimum_protected_stack_bytes===20));
  assert.equal(report.probes.length,10);
  for(const probe of report.probes) {
    const j=['A6A5','A6AD','A6B8','A6C7'].indexOf(probe.fixture.helper);
    const {fixture:input,...expected}=probe;assert.deepEqual(run(fixture(input),input,publicEntries[j]),expected);
  }
});
