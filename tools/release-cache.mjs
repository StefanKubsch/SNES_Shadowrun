// Eingabebasierter Cache für verify:release.
// Ein Generator oder eine Testdatei wird übersprungen, wenn alle aufgezeichneten
// Eingaben (gelesene Dateien, geladene Module, Verzeichnislisten, Existenzprüfungen,
// Programmdateien externer Werkzeuge wie Mesen2 und Edge mit absolutem Pfad)
// und alle eigenen Ausgaben unverändert sind. Aufzeichnung: track-inputs.mjs.
// Der Salt umfasst Node-Version und Cachecode; jede Änderung daran verwirft alles.
import {readFile,writeFile,mkdir,readdir,stat,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const toolFiles=['tools/track-inputs.mjs','tools/release-cache.mjs'];
const sha=data=>createHash('sha256').update(data).digest('hex');
export const cacheKey=name=>name.replace(/[^A-Za-z0-9._-]/g,'_');

export async function createReleaseCache({root,cacheDir=join(root,'.cache','release'),trackDir,full=false}){
 const salt=sha(process.version+'\n'+(await Promise.all(toolFiles.map(f=>readFile(join(root,f))))).map(sha).join('\n'));
 const memo=new Map();
 async function state(kind,path){
  const abs=kind==='external'?path:join(root,path);let info;
  try{info=await stat(abs);}catch{return 'missing';}
  if(kind==='exists')return info.isDirectory()?'dir':'file';
  const tag=`${kind}:${info.size}:${info.mtimeMs}`,hit=memo.get(kind+':'+path);
  if(hit?.tag===tag)return hit.value;
  let value;
  if(kind==='dir')value=info.isDirectory()?sha((await readdir(abs)).sort().join('\n')):'not-dir';
  else value=info.isDirectory()?'dir':sha(await readFile(abs));
  memo.set(kind+':'+path,{tag,value});return value;
 }
 const entryPath=(kind,key)=>join(cacheDir,kind,cacheKey(key)+'.json');
 async function readRecords(key){
  const out=join(trackDir,cacheKey(key));let names;
  try{names=await readdir(out);}catch{return null;}
  const merged={reads:new Set(),writes:new Set(),dirs:new Set(),exists:new Set(),external:new Set(),uncacheable:[]};
  for(const name of names){
   const r=JSON.parse(await readFile(join(out,name),'utf8'));
   for(const p of [...r.reads,...r.modules])merged.reads.add(p);
   for(const k of ['writes','dirs','exists','external'])for(const p of r[k]??[])merged[k].add(p);
   merged.uncacheable.push(...r.uncacheable);
  }
  return names.length?merged:null;
 }
 async function snapshot(paths,kind){const o={};for(const p of [...paths].sort())o[p]=await state(kind,p);return o;}
 return {
  full,
  // Nach jedem Prozess, der Dateien verändert haben kann, aufrufen; der Hashspeicher
  // gilt nur, solange sich nichts geändert hat (Zeitstempel allein reichen nicht).
  changed(){memo.clear();},
  // Mit key: fester Schlüssel für einen Generator. Ohne key: jede Testdatei
  // des Testrunners erhält ihren Pfad als Schlüssel.
  env(key=null,base=process.env){
   const {NODE_TEST_CONTEXT,...rest}=base;
   return {...rest,TRACK_DIR:trackDir,TRACK_ROOT:resolve(root),TRACK_KEY:key?cacheKey(key):'',TRACK_OWNER:key?'1':'',
    NODE_OPTIONS:[base.NODE_OPTIONS,'--import='+pathToFileURL(join(root,'tools','track-inputs.mjs')).href].filter(Boolean).join(' ')};
  },
  // Gibt true zurück, wenn der Eintrag vollständig zum aktuellen Dateistand passt.
  async valid(kind,key){
   if(full)return false;
   let entry;try{entry=JSON.parse(await readFile(entryPath(kind,key),'utf8'));}catch{return false;}
   if(entry.salt!==salt)return false;
   for(const [group,stateKind] of [['inputs','file'],['dirs','dir'],['exists','exists'],['external','external'],['outputs','file']])
    for(const [p,v] of Object.entries(entry[group]??{}))if(await state(stateKind,p)!==v)return false;
   return true;
  },
  // Speichert nach erfolgreichem Lauf; liefert den Grund, falls nicht cachebar.
  async store(kind,key,{allowWrites}){
   const r=await readRecords(key);
   if(!r)return 'no-record';
   if(r.uncacheable.length)return 'subprocess:'+[...new Set(r.uncacheable)].join(',');
   if(!allowWrites&&r.writes.size)return 'repo-writes';
   for(const p of r.writes)r.reads.delete(p);
   const entry={salt,key,inputs:await snapshot(r.reads,'file'),dirs:await snapshot(r.dirs,'dir'),
    exists:await snapshot([...r.exists].filter(p=>!r.reads.has(p)&&!r.writes.has(p)),'exists'),external:await snapshot(r.external,'external'),outputs:await snapshot(r.writes,'file')};
   await mkdir(join(cacheDir,kind),{recursive:true});
   await writeFile(entryPath(kind,key),JSON.stringify(entry));
   return null;
  },
  async clearRecords(key){await rm(join(trackDir,cacheKey(key)),{recursive:true,force:true});},
 };
}
