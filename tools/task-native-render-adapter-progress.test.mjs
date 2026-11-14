import test from 'node:test';import assert from 'node:assert/strict';import {readProgress,validateRenderAdapterBlock} from './progress.mjs';
test('Task render adapter evidence preserves independent supplied renderer and full own native source/stack graph',async()=>{
 const p=await readProgress(process.cwd()),group=p.work_groups.find(g=>g.id==='task-f378-opcode-dispatch'),blocks=group.render_adapter_blocks;
 const block=blocks.find(b=>b.id==='task-render-native-fec1');assert.deepEqual(block.entries,['80:FEC1']);assert.ok(p.supplied.some(r=>r.entry==='80:FEC1'&&r.native==='proof/render/notice-fec1.mjs'));
 await validateRenderAdapterBlock(process.cwd(),block,p.rom_sha256);
});
test('Task render adapter cannot inherit wrong ROM/root/module or unrelated source evidence',async()=>{
 const p=await readProgress(process.cwd()),block=p.work_groups.find(g=>g.id==='task-f378-opcode-dispatch').render_adapter_blocks.find(b=>b.id==='task-render-native-fec1');
 await assert.rejects(()=>validateRenderAdapterBlock(process.cwd(),block,'0'.repeat(64)));
 await assert.rejects(()=>validateRenderAdapterBlock(process.cwd(),{...block,entries:['80:FA3E']},p.rom_sha256));
 await assert.rejects(()=>validateRenderAdapterBlock(process.cwd(),{...block,source_contract:'analysis/render-task-native-render-compose.json'},p.rom_sha256));
 await assert.rejects(()=>validateRenderAdapterBlock(process.cwd(),{...block,manual_native:{...block.manual_native,module:'proof/render/notice-fec1.mjs'}},p.rom_sha256));
});
