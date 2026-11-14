import test from 'node:test';import assert from 'node:assert/strict';
import {readProgress,validateOpcodeBlock} from './progress.mjs';
import {taskOpcodeSpecs} from './task-opcode-specs.mjs';
test('delivered opcode blocks have distinct original slots and separate source-linked native evidence',async()=>{
 const p=await readProgress(process.cwd()),g=p.work_groups.find(g=>g.id==='task-f378-opcode-dispatch');
 assert.ok(g.dispatch_blocks.length>=taskOpcodeSpecs.length);assert.equal(new Set(g.dispatch_blocks.map(b=>b.opcode)).size,g.dispatch_blocks.length);
 for(const s of taskOpcodeSpecs)assert.ok(g.dispatch_blocks.some(b=>b.opcode===s.opcode&&b.handler==='80:'+(s.target&65535).toString(16).toUpperCase()));
 if(p.autonomous_batch.completed_groups.includes(g.id)){
  const expected=[g.id,g.id+':manual-native',...g.dispatch_blocks.flatMap(b=>[b.id,b.id+':manual-native'])];
  for(const id of expected)assert.ok(p.autonomous_batch.completed_groups.includes(id));
 }
 for(const b of g.dispatch_blocks){await validateOpcodeBlock(process.cwd(),b,p.rom_sha256);
  await assert.rejects(()=>validateOpcodeBlock(process.cwd(),{...b,opcode:b.opcode^1},p.rom_sha256));
  await assert.rejects(()=>validateOpcodeBlock(process.cwd(),{...b,handler:'80:1234'},p.rom_sha256));
 }
});
