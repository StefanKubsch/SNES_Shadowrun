import test from 'node:test';
import assert from 'node:assert/strict';
import {findMesen} from './mesen.mjs';
import {recordBootPrefix,compareBootPrefix} from './mesen-boot-prefix.mjs';
import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {ROOM_RECORD_OPTIONS,roomObservations,compareRoomNative} from './capture-room.mjs';

const {exe,reason}=findMesen();
test('cold reset reaches original room movement and two complete OBJ frames without state import',
  {skip:exe?false:'Mesen not available: '+reason},async t=>{
    const recorded=await recordBootPrefix(exe,ROOM_RECORD_OPTIONS);
    const report=compareBootPrefix(recorded,{driverRounds:true}),{dmaRequests,...summary}=report;
    const {rounds,...execution}=report.execution;
    t.diagnostic(JSON.stringify({...summary,execution,dmaRequests:dmaRequests.length,recording:recorded.recording}));
    assert.equal(recorded.initial.context.programBank,0);assert.equal(recorded.mainCalls.length,1587);
    assert.equal(report.nmis,2273);assert.equal(report.execution.roundsCompleted,1587);
    assert.equal(report.interruptSteps,19582782);assert.equal(report.ioBytes,1136813);
    assert.equal(report.writeInstructions,217676);assert.equal(report.dmaBytes,2000880);assert.equal(dmaRequests.length,7177);
    assert.equal(dmaRequests.flatMap(o=>o.transfers).filter(o=>o.dmap===0x81).length,8);
    assert.equal(execution.opcodes,144274);assert.equal(execution.nativeCalls,13554);assert.equal(execution.budgetStops,0);
    assert.deepEqual(rounds.slice(0,2),[{opcodes:0,nativeCalls:0},{opcodes:331,nativeCalls:52}]);
    assert.deepEqual(recorded.nativeCalls.map(o=>o.start.target),[
      0x80FEC1,0x80FEC1,0x80FEC1,0x80FEC1,0x80C46E,0x80C46E,0x80FEC1,0x80C46E,0x80C46E,
      0x80FEC1,0x80FEC1,0x80FEC1,0x80CDA8,0x80CDA8,0x80E014,0x80E014,0x80E014,0x80E014]);
    assert.deepEqual(recorded.nativeCalls.filter(o=>o.start.target===0x80FEC1).map(o=>o.nmis),[5,4,4,6,4,4,4,4]);
    const control=recorded.nativeCalls.filter(o=>o.start.target===0x80E014),state=o=>['slot','x','y','z','vx','vy','vz','input'].map(key=>o[key]);
    assert.deepEqual(control.map(o=>o.round),[1583,1584,1585,1586]);
    assert.deepEqual(control.map(o=>state(o.start.player)),[
      [0x42,1432,2004,256,0,0,0,0],[0x42,1432,2004,256,0,0,0,0x100],
      [0x42,1429,2007,256,0xFFFD,3,0,0x100],[0x42,1426,2010,256,0xFFFD,3,0,0x100]]);
    assert.deepEqual(control.map(o=>state(o.end.player)),[
      [0x42,1432,2004,256,0,0,0,0],[0x42,1432,2004,256,0xFFFD,3,0,0x100],
      [0x42,1429,2007,256,0xFFFD,3,0,0x100],[0x42,1426,2010,256,0xFFFD,3,0,0x100]]);
    const glyphNmis=recorded.chronology.filter(o=>o.kind==='H'&&o.pc===0x80FD21);
    assert.equal(glyphNmis.length,1);assert.equal(glyphNmis[0].context.status&0x30,0x20);
    assert.equal(recorded.chronology.filter(o=>o.kind==='T'&&o.pc===0x80FD21).length,1720);
    assert.ok(recorded.chronology.some(o=>o.kind==='L'&&o.pcs[0]===0x81B0A5));
    assert.ok(recorded.mainCalls.every(o=>o.returnWord===0x96C2));
    // Replaying only native equations with an exhausted opcode budget must
    // retain the same real caller frame through Scheduler.resume().
    const budgeted=compareBootPrefix(recorded,{driverRounds:true,opcodeBudget:0,mainBudget:1024});
    assert.equal(budgeted.execution.budgetStops,rounds.filter(o=>o.opcodes>0).length);
    assert.equal(budgeted.execution.opcodes,execution.opcodes);assert.equal(budgeted.execution.nativeCalls,execution.nativeCalls);
    assert.deepEqual(budgeted.execution.rounds,report.execution.rounds);
    assert.ok(budgeted.execution.mainBudgetStops>0);t.diagnostic(JSON.stringify({mainBudgetStops:budgeted.execution.mainBudgetStops}));
    const mainCalls=recorded.mainCalls.slice();mainCalls[0]={...mainCalls[0],returnWord:0x1234};
    assert.throws(()=>compareBootPrefix({...recorded,mainCalls},{driverRounds:true}),/original main caller return frame/);
    assert.throws(()=>compareBootPrefix({...recorded,mainCalls:[]},{driverRounds:true}),/original main caller records required/);
    const nativeCalls=recorded.nativeCalls.slice();nativeCalls[0]={...nativeCalls[0],start:{...nativeCalls[0].start,returnWord:0x1234}};
    assert.throws(()=>compareBootPrefix({...recorded,nativeCalls},{driverRounds:true}),/original native caller return frame/);
    nativeCalls[0]={...recorded.nativeCalls[0],end:{...recorded.nativeCalls[0].end,context:{...recorded.nativeCalls[0].end.context,a:recorded.nativeCalls[0].end.context.a^1}}};
    assert.throws(()=>compareBootPrefix({...recorded,nativeCalls},{driverRounds:true}),/original native return registers/);
    const bundle=roomObservations(recorded);
    assert.deepEqual(gzipSync(JSON.stringify(bundle)),readFileSync('assets/room-observations.json.gz'),'portable original input observations');
    const native=compareRoomNative(recorded,bundle);
    assert.deepEqual(bundle.frames,[{frame:2472,writes:2074805,controls:1,scanline:225},{frame:2474,writes:2076591,controls:3,scanline:225}]);
    assert.equal(bundle.windows.length,5247);assert.equal(native.bus.ppuWrites,2077216);
    let changed=0;const before=native.frames[0].pixels,after=native.frames[1].pixels;
    for(let n=0;n<before.length;n+=4)if(before[n]!==after[n]||before[n+1]!==after[n+1]||before[n+2]!==after[n+2])changed++;
    assert.equal(changed,242);t.diagnostic(JSON.stringify({changedPixels:changed,frames:bundle.frames,writeWindows:bundle.windows.length}));
  });
