import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decode} from './disassemble.mjs';
const rom=await readFile(new URL('../Shadowrun (E).smc',import.meta.url));
const report=JSON.parse(await readFile(new URL('../analysis/slot-motion.json',import.meta.url),'utf8'));
const mode={e:0,m:0,x:0};
const instructions=new Map();for(let pc=0x80AB26;pc<0x80AC2F;){const i=decode(rom,pc,mode);instructions.set(pc,i);pc=i.next;}

test('Entire motion body and two-pass caller are pinned to European original bytes, with all branch and helper targets covered or declared',()=>{
 const windows=[[0x2B26,0x2C2F,'f146e6fd18bad65ee6833f440700860f19cae048c076f8ac44aeb24eb9a76f19',report.body],[0x2FC4,0x2FFC,'6b50cea385aeeb8e71d6dd79714bffa17930077aa70acfde2b580615bd5b2850',report.caller]];
 for(const [start,end,digest,record]of windows){const bytes=rom.subarray(start,end);assert.equal(createHash('sha256').update(bytes).digest('hex'),digest);assert.equal(record.sha256,digest);assert.equal(record.covered_bytes,end-start);assert.equal(record.machine_bytes,bytes.toString('hex').toUpperCase());}
 assert.equal(report.branches.length,24);const branches=[...instructions.values()].filter(i=>i.mode==='rel8');assert.equal(branches.length,24);for(const i of branches)assert.ok(instructions.has(i.target));
 assert.deepEqual([...instructions.values()].filter(i=>i.mnemonic==='JSR').map(i=>i.target),[0x80C9E0,0x8080B2,0x808133,0x8081B4,0x808238,0x8082BC]);
 assert.equal(rom.subarray(0x16C6,0x16D3).toString('hex'),'b0e3204bccb0de2094de20c4af');
 assert.equal(rom.subarray(0x2FF4,0x2FF7).toString('hex'),'202fac'); // Second pass is a separate callee.
});

test('Known-zero prelude and clear0040 reach RTS through only covered mode-preserving game operations, without helper calls',()=>{
 // CFG proof, no execution: these BEQs must take their targets for this slice.
 const forced=new Set([0x80AB2A,0x80AB4F,0x80ABA6,0x80AC14]);const pending=[0x80AB26];const seen=new Set();
 while(pending.length){const pc=pending.pop();if(seen.has(pc))continue;seen.add(pc);const i=instructions.get(pc);assert.ok(i);assert.equal(i.mnemonic==='JSR',false);
  assert.equal(['REP','SEP','PLP','PLD','TCD','PLB','SED','XCE','TAX','TXA','INX','DEX'].includes(i.mnemonic),false);
  if(i.mnemonic==='RTS')continue;
  if(forced.has(pc)){assert.equal(i.mnemonic,'BEQ');pending.push(i.target);}else if(i.mode==='rel8'){pending.push(i.target);if(i.mnemonic!=='BRA')pending.push(i.next);}else pending.push(i.next);
 }
 assert.ok(seen.has(0x80AC2E));assert.ok(seen.has(0x80ABF2));assert.ok(seen.has(0x80AC1B));assert.ok(seen.has(0x80AC0B));
 assert.deepEqual([...seen].map(pc=>instructions.get(pc)).filter(i=>i.mnemonic==='STA'&&i.mode==='dp').map(i=>i.value),[0x6B,0x6B,0x6B]);
});
