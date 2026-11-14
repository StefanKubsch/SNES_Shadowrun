import test from 'node:test';import assert from 'node:assert/strict';
import {m1dLeafSpecs} from './task-native-m1d-specs.mjs';import {loadTaskNativeBlock} from './task-native-catalog.mjs';
import {taskLeafFixture} from './task-native-leaf-fixtures.mjs';import {taskNativeOpcodeFixture} from './task-native-opcode-fixtures.mjs';
import {nativeOpcodeSpecs} from './task-native-opcode-specs.mjs';import * as bindings from '../proof/task/native-opcode-bindings.mjs';
import {prepared,commit,unchangedFailure} from './task-native-test-support.mjs';
import {createRenderData,renderAddress} from '../src/render/data.mjs';
import {readFileSync} from 'node:fs';import {inspectRom} from './rom.mjs';import {decodeTaskWindows} from './task-partial-source.mjs';
import {runReference} from './w65c816-reference.mjs';import {proveLeafSource} from './task-native-leaf-source.mjs';import {VmMemory,VmFault} from '../src/vm/memory.mjs';import {TaskAccessor} from '../src/vm/task-accessor.mjs';
import {getDistanceBetweenObjects} from '../src/task/native-object-distance-direct.mjs';import {getStoryStageReference as getStoryStage} from '../proof/game-reference/room-story.mjs';
import {moveObjectToObject} from '../src/task/native-motion-object-move.mjs';import {getDirectionToPlayer} from '../src/task/native-player-direction.mjs';
import {getRunnerStrength} from '../src/task/native-runner-record-byte.mjs';import {addMagicPointsReference as addMagicPoints} from '../proof/game-reference/party-funds.mjs';
import {haltObject} from '../src/task/native-object-halt-set.mjs';import {resumeObject} from '../src/task/native-object-halt-clear.mjs';import {appendSelectedSpellTask} from '../src/task/native-task-append-from-list.mjs';import {getPlayerObjectAfterBreak} from '../src/task/native-player-object-break.mjs';import {addObjectHeightReference as addObjectHeight} from '../proof/game-reference/object-fields.mjs';
import {moveObjectToPlayer} from '../src/task/native-motion-player-move.mjs';import {raiseMemberMagicPointsReference as raiseMemberMagicPoints} from '../proof/game-reference/runner-state.mjs';
import {addTopic} from '../src/task/native-topic-add.mjs';import {getPreviousFightObject} from '../src/task/native-fight-list-previous.mjs';
import {isInFightList} from '../src/task/native-fight-list-contains.mjs';import {setItemPropertyAndUnequip} from '../src/task/native-object-record-property-equip.mjs';
import {bobObject,bobSecondObject} from '../src/task/native-object-bob.mjs';import {advanceOrbit,D796_ENTRIES} from '../src/task/native-orbit.mjs';
import {decrementObjectStateCount} from '../src/task/native-object-record-count-decrement.mjs';import {removeGroupMember} from '../src/task/native-group-remove.mjs';import {startBrightnessFade} from '../src/task/native-signed-offset-set.mjs';
import {placeObjectInFormation} from '../src/task/native-formation-place.mjs';import {hasNoObjectAnimation} from '../src/task/native-object-selection-empty.mjs';import {getGroupMemberPosition} from '../src/task/native-group-member-position.mjs';import {startSwarmOrbit} from '../src/task/native-swarm-orbit-start.mjs';
import {moveSwarmAlongPath} from '../src/task/native-swarm-follow-path.mjs';import {moveSwarmWave} from '../src/task/native-swarm-wave.mjs';import {setActorItemPropertyAndUnequip} from '../src/task/native-record-property-equip.mjs';import {moveObjectToPoint} from '../src/task/native-motion-point-move.mjs';import {limitCrosshair} from '../src/task/native-glove-crosshair-limits.mjs';import {limitSpellGlove} from '../src/task/native-glove-spell-limits.mjs';
const blocks=new Map(await Promise.all(m1dLeafSpecs.map(async s=>[s.entry,await loadTaskNativeBlock(s.name)])));
const fixture=entry=>({b:blocks.get(entry),f:taskLeafFixture(entry)});
const put=(f,a,v)=>f.data.seed(a,[v&255,v>>>8]);
const word=(f,a)=>f.data.readByte(a).value|f.data.readByte(a+1).value<<8;
const omit=(f,...addresses)=>{const data=createRenderData({writeWindows:f.data.snapshot().writeWindows}),set=new Set(addresses.map(renderAddress));for(const[a,v]of f.data.snapshot().bytes)if(!set.has(a))data.seed(a,[v]);return {...f,data};};
test('Native7D/E30F full path: slot bytes, both table matches, fresh [A2]+9 BYTE and record fields',()=>{
 const {b,f}=fixture(0x80E30F),p=commit(b.prepare,f);
 assert.deepEqual(p.byteWrites,[[0x7E1CE9,0xFE],[0x7E1CEA,0xFF],[0x7E2DE2,3],[0x7E2DE3,0],[0x7E1D8D,0x40],[0x7E1D90,0x67],[0x7E1D8F,0x10],
  [0x7E1D8E,5],[0x7E00A2,0],[0x7E00A3,0x90],[0x7E00A4,0x8D],[0x7E1D8C,0x66],[0x7E1D8B,0x77],[0x7E1D93,0],[0x7E1D94,4]]);
 assert.equal(p.outputContext.a,0x0077);assert.equal(p.outputContext.x,0x400);assert.equal(p.outputContext.y,0x10);
 assert.equal(p.outputContext.status&0xF3,0x41);assert.equal(p.rawReturnWord,0xC20A);
});
test('Native7D misses end at X=FFFE/N1 with the last CMP carry; zero record skips 1D8B/1D93',()=>{
 for(const [dp8,carry] of [[0x56,0],[0xEEEF,1]]){const {b,f}=fixture(0x80E30F);put(f,8,dp8);
  const p=prepared(b.prepare,f);assert.equal(p.outputContext.x,0xFFFE);assert.equal(p.outputContext.a,dp8);
  assert.equal(p.outputContext.status&0x83,0x80|carry);assert.ok(!p.byteWrites.some(([a])=>a===0x7E00A2));}
 const second=fixture(0x80E30F);put(second.f,0x7E2E08,0x54);put(second.f,0x7E2E06,0x54);
 for(let x=0;x<0x16;x+=2)put(second.f,0x7E2DF0+x,0x54);
 const q=prepared(second.b.prepare,second.f);assert.equal(q.outputContext.x,0xFFFE);assert.equal(q.byteWrites.at(-1)[0],0x7E1D8C);
 const zero=fixture(0x80E30F);put(zero.f,0x8013B8,0);const z=prepared(zero.b.prepare,zero.f);
 assert.equal(z.outputContext.x,0);assert.equal(z.outputContext.status&2,2);assert.equal(z.byteWrites.at(-1)[0],0x7E1D8C);
});
test('Native7D long pointer Y addition carries into the next bank; second search starts at the first match',()=>{
 const {b,f}=fixture(0x80E30F);put(f,0x809732,0xFFFA);f.data.seed(0x8E0003,[0x99]);
 const p=prepared(b.prepare,f);assert.equal(new Map(p.byteWrites).get(0x7E1D8C),0x99);
 // First match is X=18 (searched downward), so 7E2DF0+18 is compared before any lower index.
 assert.ok(!p.accesses.some(r=>r.address===renderAddress(0x7E2E06)));
});
test('Native7F/CCB9 ADC uses the third ASL carry and fresh 7E2DE2; decimal mode stops',()=>{
 const {b,f}=fixture(0x80CCB9);put(f,0x7E2DE2,0x2000);put(f,0x8D929D+0x2001,0xBEEF);
 const p=commit(b.prepare,f);assert.equal(p.outputContext.x,0x2001);assert.equal(word(f,0),0xBEEF);assert.equal(p.outputContext.status&0xC3,0x80);
 unchangedFailure(b.prepare,f,{context:Object.freeze({...f.context,status:f.context.status|8})},'task_binary_arithmetic_required');
});
test('Native6F/9D6A and Native96/CAA2 skip zero records, carry X across banks and keep high A on BYTE store',()=>{
 for(const entry of [0x809D6A,0x80CAA2]){
  const {b,f}=fixture(entry);put(f,0x8013B8,0);const z=prepared(b.prepare,f);assert.equal(z.outputBytes,0);assert.equal(z.outputContext.status&2,2);
  const g=fixture(entry).f;put(g,0x8013B8,0xFFFF);put(g,2,0x1280);const p=commit(b.prepare,g);
  if(entry===0x809D6A){assert.equal(word(g,0x7F0002),0x2468);assert.equal(p.outputContext.a,0x2468);}
  else{assert.equal(g.data.readByte(0x7F0000).value,0x80);assert.equal(p.outputContext.a,0xAB80);assert.equal(p.outputContext.status&0xA2,0x80);}
 }
});
test('Native83/D14A writes fresh DP02/DP04/DP06 WORDs at actualDBR 0E28/0E80/0ED8+X',()=>{
 const {b,f}=fixture(0x80D14A),p=commit(b.prepare,f);
 assert.equal(word(f,0x7E0E38),3);assert.equal(word(f,0x7E0E90),5);assert.equal(word(f,0x7E0EE8),0x4567);
 assert.equal(p.outputContext.a,0x4567);assert.equal(p.outputContext.x,0x10);
 unchangedFailure(b.prepare,omit(f,7),{},'render_source_required');
});
test('Native98/9159 FF terminator STZs with CMP flags; DP00 match stores FFFF; X counts past the hit',()=>{
 const {b,f}=fixture(0x809159);f.data.seed(0x7E3CA3,[1,2,0xFF]);const t=commit(b.prepare,f);
 assert.equal(word(f,0),0);assert.equal(t.outputContext.x,3);assert.equal(t.outputContext.a,0xABFF);assert.equal(t.outputContext.status&0x83,3);
 const g=fixture(0x809159).f;g.data.seed(0x7E3CA3,[1,0x10]);const m=commit(b.prepare,g);
 assert.equal(word(g,0),0xFFFF);assert.equal(m.outputContext.x,2);assert.equal(m.outputContext.status&0x83,0x81);
 const h=fixture(0x809159).f;h.data.seed(0x7E3CA3,[1]);unchangedFailure(b.prepare,h,{},'render_source_required');
});
test('NativeC4/E262 ORs 1D87/1D89 at actualDBR; nonzero stores FFFF with LDA# flags, zero keeps ORA Z',()=>{
 const {b,f}=fixture(0x80E262),bank=f.context.bank*65536,p=commit(b.prepare,f);
 assert.equal(word(f,0),0xFFFF);assert.equal(p.outputContext.a,0xFFFF);assert.equal(p.outputContext.status&0x82,0x80);
 const g=fixture(0x80E262).f;put(g,bank+0x1D89,0);const z=commit(b.prepare,g);
 assert.equal(word(g,0),0);assert.equal(z.outputContext.a,0);assert.equal(z.outputContext.status&0x82,2);
 const h=fixture(0x80E262).f;put(h,bank+0x1D87,0x8000);put(h,bank+0x1D89,0);assert.equal(commit(b.prepare,h).outputContext.a,0xFFFF);
 unchangedFailure(b.prepare,omit(f,bank+0x1D89),{},'render_source_required');
});
test('NativeB2/8371 overlap in the first cell stores FFFF; real JSR/JSL frames and DBR restored',()=>{
 const {b,f}=fixture(0x808371),p=commit(b.prepare,f);
 assert.equal(word(f,0),0xFFFF);assert.equal(word(f,0x3B),0x20);assert.equal(word(f,0x3E),0x10);
 assert.deepEqual([0x11,0x14,0x17,0x1A,0x1D,0x20].map(n=>word(f,n)),[0x38,0x48,0x38,0x48,0,0x10]);
 assert.deepEqual([0x23,0x26,0x29,0x2C,0x2F,0x32,0x35,0x38].map(n=>word(f,n)),[0,2,0,0x20,2,0x20,0x22,0]);
 assert.equal(p.outputContext.a,0xFFFF);assert.equal(p.outputContext.status&0x83,0x80);assert.equal(p.outputContext.bank,f.context.bank);
 assert.equal(p.outputContext.s,f.context.s+2);
});
test('NativeB2 without overlap visits all four cells and stores 0; own object and player rules skip boxes',()=>{
 const empty=fixture(0x808371);put(empty.f,0x7EE0CC,0xFFFF);const e=commit(empty.b.prepare,empty.f);
 assert.equal(word(empty.f,0),0);assert.equal(e.outputContext.status&1,1);
 for(const cell of [0x20,0,2,0x22])assert.ok(e.accesses.some(r=>r.address===renderAddress(0x7EE0AC+cell)),cell.toString(16));
 const own=fixture(0x808371);put(own.f,0x7FE216,0x10);assert.equal((commit(own.b.prepare,own.f),word(own.f,0)),0);
 const player=fixture(0x808371);put(player.f,0x7FE216,0x40);put(player.f,0x7E1468,3);
 assert.equal((commit(player.b.prepare,player.f),word(player.f,0)),0);
 const blocking=fixture(0x808371);put(blocking.f,0x7FE216,0x40);put(blocking.f,0x7E1468,1);
 assert.equal((commit(blocking.b.prepare,blocking.f),word(blocking.f,0)),0xFFFF);
 const low=fixture(0x808371);put(low.f,0x7E0008+0xE2B0,0x11);assert.equal((commit(low.b.prepare,low.f),word(low.f,0)),0);
 unchangedFailure(empty.b.prepare,omit(fixture(0x808371).f,0x7EF7A0),{},'render_source_required');
});
test('Native88/DE7E resets the control flags at actualDBR; flags from LDA#FFFF',()=>{
 const {b,f}=fixture(0x80DE7E),bank=f.context.bank*65536,p=commit(b.prepare,f);
 assert.deepEqual([0x1D5B,0x1D5D,0x1D5F,0x1D65,0x1D6B,0x1D6D].map(o=>word(f,bank+o)),[0xFFFF,0,0,0,0,0]);
 assert.equal(p.outputContext.a,0xFFFF);assert.equal(p.outputContext.status&0x82,0x80);
});
test('Native59/866F searches 1FB2 downward: bit 12 skips, bit 2 stores FFFF; exhausted or negative list stores 0',()=>{
 const {b,f}=fixture(0x80866F),bank=f.context.bank*65536,p=commit(b.prepare,f);
 assert.equal(word(f,0),0xFFFF);assert.equal(p.outputContext.x,2);assert.equal(p.outputContext.y,0x20);
 assert.equal(p.outputContext.a,0xFFFF);assert.equal(p.outputContext.status&0x82,0x80);
 // No candidate: the loop ends after X=0 with N from DEX; STZ keeps those flags.
 const none=fixture(0x80866F).f;put(none,bank+0x1458+0x20,0x1004);put(none,bank+0x1458+0x30,0);
 const q=commit(b.prepare,none);assert.equal(word(none,0),0);assert.equal(q.outputContext.x,0xFFFE);
 assert.equal(q.outputContext.a,0);assert.equal(q.outputContext.status&0x82,0x80);
 // Negative 1FB0 skips the list entirely.
 const empty=fixture(0x80866F).f;put(empty,bank+0x1FB0,0xFFFE);
 const r=commit(b.prepare,empty);assert.equal(word(empty,0),0);assert.ok(!r.accesses.some(e=>e.address===renderAddress(bank+0x1FB6)));
});
test('Native1B/CF93 picks the direction from the dominant axis and calls AAAF with a real JSR; FF target returns early',()=>{
 const {b,f}=fixture(0x80CF93),p=commit(b.prepare,f);
 assert.deepEqual([0,2,0xA2,0xA5,0xA8,0xAB].map(o=>word(f,o)),[0x10,2,0x50,0x10,0,0]);
 assert.equal(p.outputContext.x,0x10);
 // All eight directions from the source branches: +dx 2, -dx 6, +dy 0, -dy 4, diagonals 1/7/5/3.
 for(const [dx,dy,direction] of [[0x50,0,2],[-0x50,0,6],[0,0x50,0],[0,-0x50,4],[0x40,0x40,1],[-0x40,0x40,7],[-0x40,-0x40,5],[0x40,-0x40,3]]){
  const g=fixture(0x80CF93).f,bank=g.context.bank*65536;put(g,bank+0x0E48,0x100+dx);put(g,bank+0x0EA0,0x100+dy);
  put(g,bank+0x1198+0x10,direction);commit(b.prepare,g);assert.equal(word(g,2),direction,`${dx},${dy}`);
  if(dx<0)assert.equal(word(g,0xA8),(dx+65536)&65535);if(dy<0)assert.equal(word(g,0xAB),(dy+65536)&65535);
 }
 const none=fixture(0x80CF93).f;put(none,2,0x12FF);const q=commit(b.prepare,none);
 assert.equal(q.outputContext.status&3,3);
 assert.ok(!q.accesses.some(e=>e.address===renderAddress(0x7E00A8)));
 unchangedFailure(b.prepare,fixture(0x80CF93).f,{context:Object.freeze({...f.context,status:f.context.status|8})},'task_binary_arithmetic_required');
});
test('Native92/C694 stores the larger axis distance shifted right twice; negative differences are negated',()=>{
 const {b,f}=fixture(0x80C694),p=commit(b.prepare,f);
 assert.equal(word(f,0),0x20);assert.equal(p.outputContext.x,0x10);assert.equal(p.outputContext.y,0x20);
 // dx dominates: 0x1F0-0x100 = 0xF0 against |0x100-0x180| = 0x80; the lower dy reloads DP00 (0xF0 >> 2).
 const g=fixture(0x80C694).f,bank=g.context.bank*65536;put(g,bank+0x0E38,0x1F0);commit(b.prepare,g);assert.equal(word(g,0),0x3C);
 unchangedFailure(b.prepare,fixture(0x80C694).f,{context:Object.freeze({...f.context,status:f.context.status|8})},'task_binary_arithmetic_required');
});
test('NativeD5/D134, B1/C6F8 and 29/D1DD: masked 7E2DE4, four record words, direction through the real D1E3 frame',()=>{
 const d=fixture(0x80D134),p=commit(d.b.prepare,d.f);assert.equal(word(d.f,0),0x34);assert.equal(p.outputContext.status&0x82,0);
 const c=fixture(0x80C6F8);commit(c.b.prepare,c.f);
 assert.deepEqual([0x7E4148,0x7E41A0,0x7E41F8,0x7E40F0].map(o=>word(c.f,o)),[1,0,3,1]);
 const t=fixture(0x80D1DD),q=commit(t.b.prepare,t.f);assert.equal(word(t.f,0),2);assert.equal(q.outputContext.y,2);
 assert.deepEqual([0xA2,0xA5,0xA8].map(o=>word(t.f,o)),[0x50,0,0]);
});
// The new M1d leaves against the original instructions (tools/w65c816-reference.mjs): random object
// indices, positions and flags; both sides start from the same WRAM and registers.
const romBytes=inspectRom(readFileSync(new URL('../Shadowrun (E).smc',import.meta.url))).bytes,romArray=new Uint8Array(romBytes);
test('Native0F/D067 reads byte 2 of the object record; B8/BC83 and 6B/BC9C set the crosshair and spell glove limits',()=>{
 const d=fixture(0x80D067),p=commit(d.b.prepare,d.f);assert.equal(word(d.f,0),0x56);assert.equal(word(d.f,2),2);
 assert.equal(p.outputContext.x,0);assert.equal(word(d.f,0xA2),0x3BFB);
 for(const [entry,limits] of [[0x80BC83,[0x05E4,0x0BE8,0xFFFE,0xFFFE]],[0x80BC9C,[0x0600,0x0C00,0xFFFD,0xFFFD]]]){
  const g=fixture(entry),bank=g.f.context.bank*65536;commit(g.b.prepare,g.f);
  assert.deepEqual([0x01E4,0x01E6,0x01E8,0x01D8].map(o=>word(g.f,bank+o)),limits,entry.toString(16));
 }
});
test('Native00/D186: BRK through the plain RTI vector, then DP00 = 0CC2; the four interrupt bytes stay below S',()=>{
 const word16=a=>romBytes[a]|romBytes[a+1]<<8;
 assert.equal(word16(0x7FE6),0xF2B3);assert.equal(romBytes[0x72B3],0x40); // 00:FFE6 vector, 00:F2B3 RTI
 const d=fixture(0x80D186),p=commit(d.b.prepare,d.f);assert.equal(word(d.f,0),0x56);
 const s=d.f.context.s;assert.deepEqual([s,s-1,s-2].map(a=>d.f.data.readByte(a).value),[0x80,0xD1,0x8A]);
 assert.equal(d.f.data.readByte(s-3).value,d.f.context.status);assert.equal(p.outputContext.status&0x0C,d.f.context.status&0x0C);
 const {map}=decodeTaskWindows(romBytes,m1dLeafSpecs.find(s=>s.entry===0x80D186).windows);
 assert.throws(()=>proveLeafSource(map,{...m1dLeafSpecs.find(s=>s.entry===0x80D186),interruptReturns:[]}),/Unproved interrupt 80:D188/);
});
test('Native9C/A977 raises the height, AE/C71D records the player, CB/CF2E raises the counter up to ten times the record byte',()=>{
 const h=fixture(0x80A977),hb=h.f.context.bank*65536;commit(h.b.prepare,h.f);assert.equal(word(h.f,hb+0x0ED8+0x10),0x10C);
 const c=fixture(0x80C71D);commit(c.b.prepare,c.f);assert.equal(word(c.f,2),0x56);assert.equal(word(c.f,0x7E41E8+0x10),0x56);
 const t=fixture(0x80CF2E);commit(t.b.prepare,t.f);assert.equal(word(t.f,4),30);assert.equal(t.f.data.readByte(0x7E3C96).value,30);
});
test('Native71/90EB inserts a topic, 48/8631 and 5F/8656 search the fight list, BA/C7A1 fills the record',()=>{
 const t=fixture(0x8090EB);commit(t.b.prepare,t.f);
 assert.deepEqual([0,1,2,3].map(n=>t.f.data.readByte(0x7E3CA3+n).value),[5,0x10,0x20,0xFF]);
 // The flag of the terminator is not moved: the loop ends right after storing FF.
 assert.deepEqual([0,1,2,3].map(n=>t.f.data.readByte(0x7E3CD6+n).value),[1,0,2,0]);
 const p=fixture(0x808631);commit(p.b.prepare,p.f);assert.equal(word(p.f,0),0x30);
 const m=fixture(0x808656);commit(m.b.prepare,m.f);assert.equal(word(m.f,0),0xFFFF);
 const c=fixture(0x80C7A1);commit(c.b.prepare,c.f);assert.deepEqual([0x7E4148,0x7E41A0,0x7E41F8,0x7E40F0].map(o=>word(c.f,o)),[1,12,20,1]);
});
test('Native75/9D15 copies the ROM equipment entry; its two ROM writes have no effect',()=>{
 const d=fixture(0x809D15),p=commit(d.b.prepare,d.f);
 assert.equal(word(d.f,0x7E0403),3);assert.equal(word(d.f,0x7E3C31+0x60),0x5678);assert.equal(word(d.f,0x7E3C33+0x60),0x5678);
 assert.equal(d.f.data.readByte(0x7E3C35+0x60).value,0x78);assert.ok(!p.accesses.some(a=>a.kind==='write'&&a.address>=0x808000&&a.address<0x7E0000));
});
test('Native5E/D714 and 65/D73B bob an object by the table D3D1; D769..D793 swing it in two axes',()=>{
 for(const [entry,phase,height] of [[0x80D714,0x1D57,0x169],[0x80D73B,0x1D59,0x166]]){
  const d=fixture(entry),bank=d.f.context.bank*65536,p=commit(d.b.prepare,d.f),x=p.outputContext.x;
  assert.equal(word(d.f,bank+phase),0x10);assert.equal(word(d.f,bank+0x0ED8+x),height);
 }
 for(const [entry,slot] of D796_ENTRIES){
  const d=fixture(entry),bank=d.f.context.bank*65536,p=commit(d.b.prepare,d.f),x=p.outputContext.x;
  assert.equal(word(d.f,bank+0x1CEF+slot),4);assert.equal(word(d.f,bank+0x0ED8+x),0x86+0x174);assert.equal(word(d.f,bank+0x0E28+x),0x7F+0x648);
 }
});
test('Native2B/9DC8 counts a record down, 84/A2B5 removes a group member, 55/D9AD stores the negated DP00',()=>{
 const c=fixture(0x809DC8);commit(c.b.prepare,c.f);assert.equal(word(c.f,0),0xFFFF);assert.equal(c.f.data.readByte(0x7E0402).value,0);
 const g=fixture(0x80A2B5),bank=g.f.context.bank*65536;commit(g.b.prepare,g.f);
 // Only entries below the old index 4 move; the last entry stays as a copy, 1FAE is not read.
 assert.equal(word(g.f,0x7E2DE6),2);assert.deepEqual([0,2,4,6].map(n=>word(g.f,bank+0x1FA8+n)),[0x30,0x20,0x20,0x40]);
 assert.deepEqual([0,2].map(n=>word(g.f,0x7E2DF0+n)),[0x200,0x202]);
 const d=fixture(0x80D9AD),db=d.f.context.bank*65536,dp=word(d.f,0),p=commit(d.b.prepare,d.f),v=(0x10000-dp)&0xFFFF;
 assert.equal(word(d.f,db+0x01C6),v);assert.equal(word(d.f,db+0x01C8),((v&0x8000?0x10000-v:v)+8)&0xFFFF);assert.equal(p.outputContext.s,d.f.context.s+2);
});
test('Native0B/BB2C places an object at its recorded formation position; BC/9CE4 copies the ROM equipment entry',()=>{
 const f=fixture(0x80BB2C),bank=f.f.context.bank*65536,p=commit(f.b.prepare,f.f);
 assert.deepEqual([0x0ED8,0x0E28,0x0E80].map(o=>word(f.f,bank+o+0x10)),[0x30,0x140,0x120]);
 assert.equal(word(f.f,0),0x10);assert.equal(word(f.f,2),2);assert.equal(p.outputContext.s,f.f.context.s+2);
 const e=fixture(0x809CE4),q=commit(e.b.prepare,e.f);
 assert.equal(word(e.f,0x7E0403),3);assert.equal(word(e.f,0x7E3C2E+0x60),0x5678);assert.equal(e.f.data.readByte(0x7E3C30+0x60).value,0x9A);
 assert.equal(q.outputContext.s,e.f.context.s+2);
});
test('Native6E/BB90 tests the selection, D6/A297 reads the group column, AD/D604 resets the swing phases',()=>{
 const b=fixture(0x80BB90);commit(b.b.prepare,b.f);assert.equal(word(b.f,0),0xFFFF);
 const g=fixture(0x80A297);commit(g.b.prepare,g.f);assert.equal(word(g.f,0),0x77);
 const d=fixture(0x80D604),bank=d.f.context.bank*65536;commit(d.b.prepare,d.f);
 assert.equal(word(d.f,bank+0x1D4D),0x10);assert.equal(word(d.f,bank+0x1D33),0x64);assert.equal(word(d.f,bank+0x1CEF+0x1E),0x180);
});
test('Native1E/D85B moves five objects along the swing, AA/D2E7 steps towards the targets',()=>{
 const d=fixture(0x80D85B),bank=d.f.context.bank*65536;commit(d.b.prepare,d.f);
 // All phases 100: D3D1+100 and D3D1+180 bytes; the goals 1D41..1D47 equal the values (no step).
 assert.equal(word(d.f,bank+0x1D29),0x100);assert.ok([0x10,0x12,0x14,0x16,0x18].every(o=>word(d.f,bank+0x0E28+o)!==0));
 const t=fixture(0x80D2E7),tb=t.f.context.bank*65536;commit(t.b.prepare,t.f);
 assert.equal(word(t.f,tb+0x1D0B),0xFE);assert.equal(word(t.f,tb+0x1D33),0x10A);assert.equal(word(t.f,tb+0x1D35),0xF8);
 assert.equal(word(t.f,tb+0x1D25),(0xFE-13*0x18)&0xFFFF);
});
test('Native77/D7DD and 09/D260 start a swarm through A835 (here without a free slot); 8D/D63C circles the leader',()=>{
 const d=fixture(0x80D7DD),bank=d.f.context.bank*65536;commit(d.b.prepare,d.f);
 assert.equal(word(d.f,bank+0x1CF7),0x10);assert.equal(word(d.f,bank+0x1D0B),0x210);assert.equal(word(d.f,bank+0x1D43),0x100);
 assert.deepEqual([0,2,4,6].map(o=>word(d.f,bank+0x1CEF+o)),[6,6,6,6]);
 const g=fixture(0x80D260),gb=g.f.context.bank*65536;commit(g.b.prepare,g.f);
 assert.equal(word(g.f,gb+0x1D07),0x10);assert.equal(word(g.f,gb+0x1D17),0x210);assert.equal(word(g.f,gb+0x1CEF+0x16),0xDF);
 const c=fixture(0x80D63C),cb=c.f.context.bank*65536;commit(c.b.prepare,c.f);
 // The speed clamp compares unsigned and always leaves FFEC (-14), so 1D53 = 80 - 14.
 assert.equal(word(c.f,cb+0x1D35),0xFFEC);assert.equal(word(c.f,cb+0x1D55),0x44);assert.equal(word(c.f,cb+0x1D53),0x6C);assert.equal(word(c.f,2),1);assert.equal(word(c.f,0),0x10);
});
test('Native8C/8B8A adds to the member counter; 64/8E96 and 9E/8EB8 follow the link chain; 94/8EDA appends a task',()=>{
 const c=fixture(0x808B8A);commit(c.b.prepare,c.f);assert.equal(c.f.data.readByte(0x7E3C98).value,0x40);
 for(const [entry,flag,bits] of [[0x808E96,0x0404,0x1001],[0x808EB8,0x0004,0x0001]]){
  const g=fixture(entry),bank=g.f.context.bank*65536;commit(g.b.prepare,g.f);
  assert.equal(word(g.f,bank+0x1458+0x10),entry===0x808E96?0x0404:0x0004);assert.equal(word(g.f,bank+0x0BA2+0x30),bits);
  assert.equal(word(g.f,bank+0x0BA2+0x20),0x8000);void flag;
 }
 const t=fixture(0x808EDA),bank=t.f.context.bank*65536,q=commit(t.b.prepare,t.f);
 assert.equal(word(t.f,0),0x21);assert.equal(word(t.f,0xA2),0x5000);assert.equal(word(t.f,bank+0x024C),q.outputContext.a);
});
// Object numbers of the record table $80:9700 (13 words) for the D02F search of D067.
const romWord=address=>{const o=((address>>16)&0x7F)*0x8000+(address&0x7FFF);return romBytes[o]|romBytes[o+1]<<8;};
const recordObjects=Array.from({length:13},(_,n)=>romBytes[0x1700+2*n]|romBytes[0x1701+2*n]<<8);
for(const [entry,run] of [[0x80C694,getDistanceBetweenObjects],[0x80D134,getStoryStage],[0x80C6F8,moveObjectToObject],[0x80D1DD,getDirectionToPlayer],
 [0x80D067,getRunnerStrength],[0x80BC83,limitCrosshair],[0x80BC9C,limitSpellGlove],
 [0x808B8A,addMagicPoints],[0x808E96,haltObject],[0x808EB8,resumeObject],[0x808EDA,appendSelectedSpellTask],[0x80D186,getPlayerObjectAfterBreak],
 [0x80A977,addObjectHeight],[0x80C71D,moveObjectToPlayer],[0x80CF2E,raiseMemberMagicPoints],
 [0x8090EB,addTopic],[0x808631,getPreviousFightObject],[0x808656,isInFightList],[0x80C7A1,moveObjectToPoint],[0x809D15,setItemPropertyAndUnequip],
 [0x80D714,bobObject],[0x80D73B,bobSecondObject],...[...D796_ENTRIES].map(([entry,slot])=>[entry,(a,o)=>advanceOrbit(a,slot,o)]),
 [0x809DC8,decrementObjectStateCount],[0x80A2B5,removeGroupMember],[0x80D9AD,startBrightnessFade],[0x80BB2C,placeObjectInFormation],[0x809CE4,setActorItemPropertyAndUnequip],
 [0x80BB90,hasNoObjectAnimation],[0x80A297,getGroupMemberPosition],[0x80D604,startSwarmOrbit],[0x80D85B,moveSwarmAlongPath],[0x80D2E7,moveSwarmWave]])
 test(`Native ${(entry&65535).toString(16).toUpperCase()} equations match the original instructions on every instruction`,()=>{
  const {map}=decodeTaskWindows(romBytes,m1dLeafSpecs.find(s=>s.entry===entry).windows),covered=new Set();
  // D186: the reference really executes BRK, the vector 00:FFE6 and the RTI at 00:F2B3.
  const referenceMap=entry===0x80D186?new Map([...map,...decodeTaskWindows(romBytes,[{start:0x00F2B3,hex:'40'}]).map]):map;
  let t=entry&65535,faults=0;const int=n=>{t=(t*1103515245+12345)>>>0;return (t>>>8)%n;};
  for(let k=0;k<3000;k++){
   const wram=new Uint8Array(0x20000),put16=(o,v)=>{wram[o]=v&255;wram[o+1]=v>>>8&255;};
   const pick16=list=>list[int(list.length)];
   const x=int(0x60)*2,y=int(3)?int(0x60)*2:x,record=entry===0x80D067;put16(0,int(8)||record?x:int(0x10000));put16(2,y);put16(0x0CC2,int(0x60)*2);put16(0x2DE4,int(0x10000));
   for(const base of [0x0E28,0x0E80])for(let o=0;o<0xC0;o+=2)put16(base+o,int(4)?int(0x400):int(0x10000));
   // D067 (DBR 80 with the ROM table): mostly known object numbers, Jake's WRAM record 7E3BFB random.
   if(record){put16(0x150A+x,int(5)?recordObjects[int(13)]:int(0x10000));for(let o=0;o<12;o++)wram[0x3BFB+o]=int(256);}
   if(entry===0x808B8A){put16(0x1F60,int(4)?2*int(13):int(0x10000));for(let o=0;o<16;o++)wram[0x3C96+o]=int(256);}
   if(entry===0x808E96||entry===0x808EB8){
    // Link chain from 1350: up to two negative 0BA2 entries linked by 0372, then a nonnegative one (the
    // original loops for ever on a cycle of negative entries, so every chain here ends).
    put16(0x1458+x,int(0x10000));
    for(let o=0;o<0x60;o+=2){put16(0x0BA2+o,int(0x8000));put16(0x0372+o,2*int(0x30));}
    const chain=[2*int(0x30)];for(let n=int(3);n>0;n--){let next=2*int(0x30);while(chain.includes(next))next=(next+2)%0x60;chain.push(next);}
    put16(0x1350+x,int(5)?chain[0]:0x8000|int(0x8000));
    chain.forEach((link,n)=>{if(n+1<chain.length){put16(0x0BA2+link,0x8000|int(0x8000));put16(0x0372+link,chain[n+1]);}});
   }
   if(entry===0x8090EB){
    // Sorted topic list with FF (sometimes DP00 already present), flags random.
    const ids=[...new Set(Array.from({length:int(8)},()=>int(0xFE)))].sort((p,q)=>p-q);
    ids.forEach((v,n)=>{wram[0x3CA3+n]=v;wram[0x3CD6+n]=int(256);});wram[0x3CA3+ids.length]=0xFF;wram[0x3CD6+ids.length]=int(256);
    wram[0]=ids.length&&int(3)===0?ids[int(ids.length)]:int(0xFF);
   }
   if(entry===0x808631||entry===0x808656){
    const last=int(5)?2*int(6):0xFFFE;put16(0x1FB0,last);const list=[0x00,0x02,0x10,0x30,0x56];
    for(let n=0;n<14;n+=2)put16(0x1FB2+n,list[int(5)]);put16(0,int(5)?list[int(5)]:0x8000|int(0x8000));
   }
   if(entry===0x809D15){
    // Record 13A8+Y (sometimes 0), equipment table 7E3C2E/7E3C31 with the object's number at one of the 14 entries.
    put16(0x13A8+x,int(6)?0x200+2*int(0x100):0);const number=int(0x10000);put16(0x150A+x,number);
    for(let e=0;e<=0x68;e+=8){put16(0x3C2E+e,int(0x10000));put16(0x3C31+e,int(0x10000));}
    if(int(4))put16((int(2)?0x3C2E:0x3C31)+8*int(14),number);
   }
   if(entry===0x80CF2E){
    // Group 7E2DF0 (index 7E2DE6) always holds the player's number; DP00 sometimes outside the group.
    const count=2*int(6),player=2*int(0x30);put16(0x2DE6,count);put16(0x0CC2,player);
    for(let n=0;n<=count;n+=2)put16(0x2DF0+n,recordObjects[int(13)]);put16(0x150A+player,recordObjects[int(13)]);
    put16(0x2DF0+2*int(count/2+1),wram[0x150A+player]|wram[0x150B+player]<<8);
    if(x!==player)put16(0x150A+x,int(3)?wram[0x2DF0+2*int(count/2+1)]|wram[0x2DF1+2*int(count/2+1)]<<8:recordObjects[int(13)]);
    for(let o=0;o<16;o++)wram[0x3C96+o]=int(256);for(let o=0;o<12;o++)wram[0x3BFB+o]=int(256);put16(2,int(0x100));
   }
   if(entry===0x80D714||entry===0x80D73B||D796_ENTRIES.has(entry)){
    // Phases 1CEF+Y and 1D57/1D59 anywhere (AND 1FF wraps them), so both sides of the CMP #28 mirror occur.
    for(let o=0;o<0x10;o+=2)put16(0x1CEF+o,int(0x10000));put16(0x1D57,int(0x10000));put16(0x1D59,int(0x10000));
   }
   if(entry===0x80BB2C){
    // Group with the object's number (sometimes missing), step 0D18, recorded positions (some 0); AAAF and A985
    // run on the same data (desired action 1198/1038 equal or not).
    const count=2*int(6);put16(0x2DE6,count);const number=int(0x10000);put16(0x150A+x,number);
    for(let n=0;n<=count;n+=2)put16(0x2DF0+n,int(0x10000));if(int(4))put16(0x2DF0+2*int(count/2+1),number);
    put16(0x0D18,int(0x100));put16(0x0D1A,int(2)?0:int(0x10000));
    for(let o=0;o<0x100;o+=2){put16(0x45A8+o,int(4)?int(0x10000):0);put16(0x44A8+o,int(0x10000));put16(0x4528+o,int(0x10000));put16(0x4628+o,int(8));}
    for(let o=0;o<0x60;o+=2){put16(0x1198+o,int(8));put16(0x1038+o,int(3)?int(4):0xFFFF);put16(0x3F28+o,int(0x20));}
   }
   if(entry===0x809CE4){
    // Record 8D:B020+DP00 (DP00 even below C0), the number DP00 at one of the 14 table entries or missing.
    put16(0,2*int(0x60));for(let e=0;e<=0x68;e+=8){put16(0x3C2E+e,int(0x10000));put16(0x3C31+e,int(0x10000));}
    if(int(4))put16((int(2)?0x3C2E:0x3C31)+8*int(14),wram[0]|wram[1]<<8);
   }
   if(entry===0x80D85B||entry===0x80D2E7){
    // Swing state 1D0B..1D47 anywhere, objects 1CEF.. inside the object tables; D2E7 with DP00 0/1/other and
    // a WRAM list [F3] (7E:6000) for the targets.
    for(let o=0x1D0B;o<0x1D49;o+=2)put16(o,int(4)?int(0x200):int(0x10000));for(let o=0;o<0x20;o+=2)put16(0x1CEF+o,2*int(0x30));
    if(int(3)===0){put16(0x1D29,pick16([0x80,0x280]));put16(0x1D2D,pick16([0x80,0x380]));}
    if(entry===0x80D2E7){put16(0,pick16([0,1,1,2,int(0x10000)]));put16(2,int(0x40));put16(0xF3,0x6000);wram[0xF5]=0x7E;for(let o=0;o<0x200;o++)wram[0x6000+o]=int(256);}
   }
   if(entry===0x80BB90)for(let o=0;o<0xC0;o+=2)put16(0x1038+o,int(2)?0xFFFF:int(0x10000));
   if(entry===0x80A297){
    // Group index 7E2DE6 (sometimes negative), DP00 at one of the entries of 1FA8 or missing.
    const count=int(6)?2*int(8):0x8000|int(0x8000);put16(0x2DE6,count);
    for(let o=0;o<0x14;o+=2){put16(0x1FA8+o,2*int(0x30));put16(0x2DF8+o,int(0x10000));}
    if(count<0x8000&&int(4))put16(0x1FA8+2*int(count/2+1),wram[0]|wram[1]<<8);
   }
   if(entry===0x809DC8){
    // Object number -> record 8D:B020 (some 0), counter BYTE 7E0002+record with 1 (reaches 0) or more.
    const number=2*int(0x40);put16(0x150A+x,int(8)?number:int(0x10000));wram[2+romWord(0x8DB020+number)]=pick16([1,1,2,0,int(256)]);
   }
   if(entry===0x80A2B5){
    // Group index 7E2DE6 (sometimes negative), DP00 at one of the entries of 1FA8 or missing.
    const count=int(6)?2*int(8):0x8000|int(0x8000);put16(0x2DE6,count);
    for(let o=0;o<0x14;o+=2){put16(0x1FA8+o,2*int(0x30));put16(0x2DE8+o,int(0x10000));put16(0x2DF0+o,int(0x10000));put16(0x2DF8+o,int(0x10000));}
    if(count<0x8000&&int(4))put16(0x1FA8+2*int(count/2+1),wram[0]|wram[1]<<8);
   }
   if(entry===0x808EDA){
    // Script id 7E3C13 below 3A9, its list pointer 7E3C1A into WRAM, one free heap block 0200 and free task slots 40..46.
    put16(0x3C13,int(0x3A9));put16(0x3C1A,0x5000+int(0x100));for(let o=0;o<0x200;o++)wram[0x5000+o]=int(256);
    // Heap blocks at 03D2+X (size, negative = used; link 03D4+X, 0 = end): used, small (merged with a free
    // successor), close fits and exhaustion, sizes around the frame size of the script.
    let at=0;const blocks=1+int(4);
    for(let b=0;b<blocks;b++){const size=pick16([0x08,0x18,0x20,0x28,0x30,0x40,0x80,0x200]);const next=b+1<blocks?at+size+4:0;
     put16(0x03D2+at,int(3)?size:0x8000|size);put16(0x03D4+at,next);at=next;}
    put16(0x024E,0x40);put16(0x024C,int(3)?0xFFFF:2*int(0x30));
    [0x40,0x42,0x44,0x46].forEach((v,n,l)=>put16(0x0312+v,l[n+1]??0xFFFF));
   }
   const a0=int(0x10000),p0=int(256)&0xC7,run2=reference=>{const mem=new VmMemory(romArray,wram.slice());
    const vm={mem,a:a0,x:0x1111,y:0x2222,s:0x1EF0,d:0,dbr:[0x80D067,0x80BC83,0x80BC9C,0x808B8A,0x808E96,0x808EB8,0x808EDA,0x80A977,0x80C71D,0x80CF2E,0x8090EB,0x808631,0x808656,0x80C7A1,0x809D15,0x80D714,0x80D73B,...D796_ENTRIES.keys(),0x809DC8,0x80A2B5,0x80D9AD,0x80BB2C,0x809CE4,0x80BB90,0x80A297,0x80D604,0x80D85B,0x80D2E7].includes(entry)?0x80:0x7E,p:p0,pc:entry&65535};
    mem.write8(0x1EF0,0xF5);mem.write8(0x1EEF,0x08);vm.s=0x1EEE;
    const a=new TaskAccessor(vm);a.load();a.trace=[];
    // A D067 miss reads its record pointer behind the table; both sides must fail at the same address.
    try{if(reference)for(const pc of runReference(referenceMap,mem,a.ctx,{entry,root:'RTS'}).visited)covered.add(pc);
     else run(a,true);}catch(error){if(!(error instanceof VmFault))throw error;return {fault:error.reason+' '+error.address};}
    return {ctx:{...a.ctx},wram:mem.wram};};
   const n=run2(false),r=run2(true);
   // D15C (under BB2C/A985) reads [dp],Y from unmapped system-bank addresses as open bus
   // (src/task/native-object-turn.mjs); the reference has no bus model and faults there instead.
   const openBus=/^unmapped_read (\d+)$/.exec(r.fault??'')?.[1],low=openBus&0xFFFF;
   if(openBus!==undefined&&!n.fault&&!(openBus&0x400000)&&low>=0x2000&&low<0x8000&&!(low>=0x2100&&low<0x2200||low===0x4016||low===0x4017||low>=0x4200&&low<0x4220||low>=0x4300&&low<0x4380)){faults++;continue;}
   assert.equal(n.fault,r.fault,'fault '+k);if(n.fault){faults++;continue;}
   for(const key of ['a','x','y','s','status','pc'])assert.equal(n.ctx[key],r.ctx[key],key+' '+k);
   assert.ok(Buffer.from(n.wram).equals(Buffer.from(r.wram)),'wram '+k);
  }
  // BB2C runs the windows of AAAF/A985 too; those have their own comparison, here only its own window counts.
  const required=entry===0x80BB2C?decodeTaskWindows(romBytes,[m1dLeafSpecs.find(s=>s.entry===entry).windows[0]]).map:map;
  assert.deepEqual([...required.keys()].filter(pc=>!covered.has(pc)).map(pc=>pc.toString(16)),[]);
  assert.ok(faults<800,'faults '+faults); // unknown object numbers (1 in 5 for D067)
 });
test('Native78/A1E6 appends the object, runs A835/AAAF with real JSR frames and fills the record fields',()=>{
 const {b,f}=fixture(0x80A1E6),bank=f.context.bank*65536,p=commit(b.prepare,f);
 assert.equal(word(f,0x7E2DE6),2);assert.equal(word(f,0x7E2DEA),0x10);assert.equal(word(f,0x7E2DFA),0x50);assert.equal(word(f,0x7E2DF2),4);
 assert.equal(word(f,0x7E3F7E),0x10);assert.equal(word(f,bank+0x150A+0x56),4);assert.equal(word(f,bank+0x13A8+0x56),0x1204);
 assert.equal(word(f,bank+0x1400+0x56),0x0000);assert.equal(word(f,bank+0x1FAA),0x56);assert.equal(word(f,0x7E43F8+0x56),0x77);
 assert.equal(word(f,bank+0x0CC2),0x3456);assert.equal(p.outputContext.x,0x56);assert.equal(p.outputContext.s,f.context.s+2);
 const first=fixture(0x80A1E6).f;put(first,0x7E2DE6,0xFFFE);commit(b.prepare,first);
 assert.equal(word(first,0x7E2DE6),0);assert.equal(word(first,bank+0x0CC2),0x56);assert.equal(word(first,bank+0x1458+0x56)&3,3);
});
test('M1d leaves run as whole Native58 opcodes with original argument and result metadata',()=>{
 for(const s of m1dLeafSpecs){
  const spec=nativeOpcodeSpecs.find(n=>n.entry===s.entry),prepare=bindings[spec.exportName],f=taskNativeOpcodeFixture(spec);
  const p=prepared(prepare,f),step=p.steps[0],args=Buffer.from(s.anchors[1].hex,'hex')[0],result=Buffer.from(s.anchors[2].hex,'hex')[0];
  assert.equal(step.id,s.id);assert.equal(step.wordPops,args);assert.equal(step.resultPushed,result!==0);
  assert.equal(step.calleeEntry,s.entry);assert.equal(step.calleeReturnTarget,0x80F509);assert.equal(p.frontier,'80:F390');
  unchangedFailure(prepare,f,{maxWork:p.work-1},'task_work_budget_required');
 }
});
