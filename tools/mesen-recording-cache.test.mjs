import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readdir,rm,appendFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {recordingCache,openSink,replayRecording} from './mesen.mjs';

test('Mesen-Aufzeichnungscache: nur bestätigte Läufe mit Code 0, Abspielen zeilengenau, jede Eingabe ändert den Schlüssel',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'snes-mesen-cache-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const saved={on:process.env.SNES_MESEN_CACHE,dir:process.env.SNES_MESEN_CACHE_DIR};
 t.after(()=>{for(const [k,v] of [['SNES_MESEN_CACHE',saved.on],['SNES_MESEN_CACHE_DIR',saved.dir]])if(v===undefined)delete process.env[k];else process.env[k]=v;});
 const exe=join(dir,'Mesen.exe'),rom=join(dir,'rom.smc'),script=join(dir,'trace.lua');
 for(const [p,v] of [[exe,'exe'],[join(dir,'MesenCore.dll'),'core'],[join(dir,'settings.json'),'{}'],[rom,'rom'],[script,'lua']])await writeFile(p,v);
 process.env.SNES_MESEN_CACHE_DIR=join(dir,'cache');
 const keep=()=>true,open=(o={})=>recordingCache(exe,rom,script,60000,o.sram??null,o.overrides??[],o.keep??keep);
 delete process.env.SNES_MESEN_CACHE;assert.equal(open(),null);
 process.env.SNES_MESEN_CACHE='1';assert.equal(recordingCache(exe,rom,script,60000,null,[],null),null,'ohne keep kein Cache');
 const lines=['S 1 2 #1','','äÿ ende #2','N 2'];
 const store=async(cached,result)=>{const sink=openSink(cached);for(const l of lines)sink.write(l);await sink.finish(result);sink.discard();};
 const first=open();assert.equal(first.hit,false);
 await store(first,{code:1,stderr:'x',elapsedMs:5});assert.equal(open().hit,false,'Code ungleich 0');
 await store(open({keep:()=>false}),{code:0,stderr:'',elapsedMs:5});assert.equal(open().hit,false,'nicht bestätigt');
 assert.deepEqual(await readdir(join(dir,'cache')),[],'keine Reste');
 await store(first,{code:0,stderr:'warn',elapsedMs:1234});
 process.env.SNES_MESEN_CACHE='record';assert.equal(open().hit,false,'record nimmt immer frisch auf');
 process.env.SNES_MESEN_CACHE='1';const hit=open();assert.equal(hit.hit,true);
 const seen=[],tools=[],listener=f=>tools.push(f);process.on('snes-track-external',listener);
 const result=await replayRecording(hit,exe,l=>seen.push(l));process.off('snes-track-external',listener);
 assert.deepEqual(seen,lines);assert.deepEqual(result,{code:0,stderr:'warn',elapsedMs:1234,cached:true});assert.deepEqual(tools,[exe]);
 for(const o of [{sram:Buffer.from([1])},{overrides:['--x']}])assert.equal(open(o).hit,false);
 for(const p of [join(dir,'settings.json'),join(dir,'MesenCore.dll'),rom,script,exe]){
  await appendFile(p,'!');assert.equal(open().hit,false,p);
 }
});
