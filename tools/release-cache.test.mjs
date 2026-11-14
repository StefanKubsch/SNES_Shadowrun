import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,copyFile,rm,appendFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {verifyArtifactPasses,runLogged} from './verify-release.mjs';
import {createReleaseCache} from './release-cache.mjs';

async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'snes-cache-'));t.after(()=>rm(root,{recursive:true,force:true}));
 for(const d of ['tools','analysis','assets','docs','data','logs'])await mkdir(join(root,d));
 await writeFile(join(root,'analysis/dialog-936c-inventory.json'),'{}');await writeFile(join(root,'docs/PORTIERUNGSSTAND.md'),'');
 for(const f of ['track-inputs.mjs','release-cache.mjs'])await copyFile(join(import.meta.dirname,f),join(root,'tools',f));
 return root;
}
const generator=['probe:render-test','node tools/gen.mjs'];
async function pass(root,{full=false,gen=[generator]}={}){
 const cache=await createReleaseCache({root,trackDir:await mkdtemp(join(root,'logs','track-')),full}),stats={};
 await verifyArtifactPasses({root,generators:gen,logDir:join(root,'logs'),announce:()=>{},cache,stats});
 return stats;
}

test('Generator wird nur bei geänderten Eingaben, Modulen, Listen, Existenz oder Ausgaben erneut ausgeführt',async t=>{
 const root=await fixture(t);
 await writeFile(join(root,'data/input.txt'),'a');await writeFile(join(root,'tools/helper.mjs'),'export const h="1";');
 await writeFile(join(root,'tools/gen.mjs'),`import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {h} from './helper.mjs';
const opt=existsSync('data/optional.txt');
writeFileSync('analysis/render-test.json',readFileSync('data/input.txt','utf8')+h+readdirSync('data').length+opt);`);
 const runs=async()=>(await pass(root)).executed;
 assert.equal(await runs(),1);assert.equal(await runs(),0);
 await writeFile(join(root,'data/input.txt'),'b');assert.equal(await runs(),1);assert.equal(await runs(),0);
 await writeFile(join(root,'tools/helper.mjs'),'export const h="2";');assert.equal(await runs(),1);
 await writeFile(join(root,'data/optional.txt'),'');assert.equal(await runs(),1);
 await writeFile(join(root,'data/extra.txt'),'');assert.equal(await runs(),1);
 await writeFile(join(root,'analysis/render-test.json'),'manipuliert');assert.equal(await runs(),1);
 assert.notEqual(await readFile(join(root,'analysis/render-test.json'),'utf8'),'manipuliert');
 await rm(join(root,'analysis/render-test.json'));assert.equal(await runs(),1);
 assert.equal(await runs(),0);assert.equal((await pass(root,{full:true})).executed,1);
 await appendFile(join(root,'tools/track-inputs.mjs'),'\n// Salt\n');assert.equal(await runs(),1);
});

test('Fremdprozesse machen nicht cachebar; nicht deterministische Ausgaben scheitern weiterhin',async t=>{
 const root=await fixture(t);
 await writeFile(join(root,'tools/gen.mjs'),`import {spawnSync} from 'node:child_process';import {writeFileSync} from 'node:fs';
spawnSync('git',['--version']);writeFileSync('analysis/render-test.json','x');`);
 const first=await pass(root);assert.match(first.uncacheable['probe:render-test'],/^subprocess:git/);
 assert.equal((await pass(root)).executed,1);
 await writeFile(join(root,'tools/gen.mjs'),`import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const n=existsSync('count')?Number(readFileSync('count','utf8'))+1:1;writeFileSync('count',String(n));writeFileSync('analysis/render-test.json',String(n));`);
 await assert.rejects(()=>pass(root),/Non-reproducible artifacts: analysis\/render-test.json/);
});

test('Testdateien: Eingabeänderung invalidiert, Repo-Schreibzugriffe und fehlende Aufzeichnung werden nicht gecacht',async t=>{
 const root=await fixture(t),trackDir=join(root,'logs','track');
 await writeFile(join(root,'data/input.txt'),'1');
 await writeFile(join(root,'tools/a.test.mjs'),`import test from 'node:test';import {readFileSync} from 'node:fs';test('a',()=>readFileSync('data/input.txt'));`);
 await writeFile(join(root,'tools/w.test.mjs'),`import test from 'node:test';import {writeFileSync} from 'node:fs';test('w',()=>writeFileSync('data/out.txt','x'));`);
 const cache=await createReleaseCache({root,trackDir});
 await runLogged(process.execPath,['--test','tools/a.test.mjs','tools/w.test.mjs'],{root,logPath:join(root,'logs','t.log'),env:cache.env()});
 assert.equal(await cache.store('tests','tools/a.test.mjs',{allowWrites:false}),null);
 assert.equal(await cache.store('tests','tools/w.test.mjs',{allowWrites:false}),'repo-writes');
 assert.equal(await cache.store('tests','tools/fehlt.test.mjs',{allowWrites:false}),'no-record');
 const fresh=await createReleaseCache({root,trackDir});
 assert.equal(await fresh.valid('tests','tools/a.test.mjs'),true);assert.equal(await fresh.valid('tests','tools/w.test.mjs'),false);
 await writeFile(join(root,'data/input.txt'),'2');fresh.changed();assert.equal(await fresh.valid('tests','tools/a.test.mjs'),false);
 await writeFile(join(root,'data/input.txt'),'1');fresh.changed();assert.equal(await fresh.valid('tests','tools/a.test.mjs'),true);
 await writeFile(join(root,'tools/a.test.mjs'),`import test from 'node:test';test('a',()=>{});`);fresh.changed();assert.equal(await fresh.valid('tests','tools/a.test.mjs'),false);
});

test('Aufzeichnung erhält promisify(execFile) mit stdout und stderr',async t=>{
 const root=await fixture(t),trackDir=join(root,'logs','track');
 await writeFile(join(root,'tools/p.mjs'),`import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {writeFileSync} from 'node:fs';
const r=await promisify(execFile)(process.execPath,['-e','console.log(1);console.error(2)']);writeFileSync('data/r.json',JSON.stringify(r));`);
 const cache=await createReleaseCache({root,trackDir});
 await runLogged(process.execPath,['tools/p.mjs'],{root,logPath:join(root,'logs','p.log'),env:cache.env('p')});
 const r=JSON.parse(await readFile(join(root,'data/r.json'),'utf8'));
 assert.equal(r.stdout.trim(),'1');assert.equal(r.stderr.trim(),'2');
});

test('Deterministische Werkzeuge sind cachebar; Programm- und Begleitdateien invalidieren',async t=>{
 const root=await fixture(t),trackDir=join(root,'logs','track'),tool=await mkdtemp(join(tmpdir(),'snes-tool-'));
 t.after(()=>rm(tool,{recursive:true,force:true}));
 const exe=join(tool,'Mesen.exe');await copyFile(process.execPath,exe);await writeFile(join(tool,'settings.json'),'{}');
 await writeFile(join(root,'data/rom.smc'),'rom');await writeFile(join(root,'data/noop.js'),'');
 await writeFile(join(root,'tools/m.test.mjs'),`import test from 'node:test';import {spawnSync} from 'node:child_process';
test('m',()=>{const r=spawnSync(${JSON.stringify(exe)},['data/noop.js','data/rom.smc','--flag'],{env:{}});if(r.status!==0)throw Error('tool');});`);
 const run=async()=>{const cache=await createReleaseCache({root,trackDir});await cache.clearRecords('tools/m.test.mjs');
  await runLogged(process.execPath,['--test','tools/m.test.mjs'],{root,logPath:join(root,'logs','m.log'),env:cache.env()});
  return cache.store('tests','tools/m.test.mjs',{allowWrites:false});};
 const valid=async()=>(await createReleaseCache({root,trackDir})).valid('tests','tools/m.test.mjs');
 assert.equal(await run(),null);assert.equal(await valid(),true);
 await writeFile(join(root,'data/rom.smc'),'rom2');assert.equal(await valid(),false);assert.equal(await run(),null);
 await writeFile(join(tool,'settings.json'),'{"x":1}');assert.equal(await valid(),false);assert.equal(await run(),null);
 await writeFile(join(tool,'MesenCore.dll'),'core');assert.equal(await valid(),false);assert.equal(await run(),null);
 assert.equal(await valid(),true);await appendFile(exe,'x');assert.equal(await valid(),false);
});