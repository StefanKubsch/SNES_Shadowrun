import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,utimes,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {writeArtifactIfChanged} from './write-artifact.mjs';

async function fixture(t){
 const prefix=join(tmpdir(),'snes-artifact-write-'),root=await mkdtemp(prefix);
 t.after(async()=>{assert.ok(root.startsWith(prefix));await rm(root,{recursive:true,force:true});});
 return root;
}
test('identical generated UTF8 bytes retain the existing file and timestamp',async t=>{
 const root=await fixture(t),path=join(root,'render-proof.json'),text='{"source":"äΩ"}\n';
 assert.equal(await writeArtifactIfChanged(path,text),true);
 await utimes(path,946684800,946684800);const before=await stat(path);
 assert.equal(await writeArtifactIfChanged(path,text),false);
 assert.equal((await stat(path)).mtimeMs,before.mtimeMs);
 assert.deepEqual(await readFile(path),Buffer.from(text,'utf8'));
});
test('changed artifacts replace all bytes including a shorter report and newline changes',async t=>{
 const root=await fixture(t),path=join(root,'render-proof.json');
 for(const text of ['{"long":"original report"}\n','{}\n','{}\r\n','{}']){
  assert.equal(await writeArtifactIfChanged(path,text),true);
  assert.deepEqual(await readFile(path),Buffer.from(text));
 }
});
test('unreadable targets and missing parent directories propagate failures',async t=>{
 const root=await fixture(t),directory=join(root,'directory');await mkdir(directory);
 await assert.rejects(()=>writeArtifactIfChanged(directory,'do not swallow read errors'));
 await assert.rejects(()=>writeArtifactIfChanged(join(root,'absent','render-proof.json'),'{}'),{code:'ENOENT'});
 assert.equal((await stat(directory)).isDirectory(),true);
});
