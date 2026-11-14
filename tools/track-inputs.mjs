// Zeichnet für den Release-Cache auf, welche Repo-Dateien ein Node-Prozess liest,
// schreibt, auflistet oder auf Existenz prüft und welche Module er lädt.
// Aktiv nur mit TRACK_DIR; geladen über NODE_OPTIONS=--import=<diese Datei>.
// Jeder Prozess schreibt beim Beenden <TRACK_DIR>/<schlüssel>/<pid>.json.
// Andere Unterprozesse machen den Schlüssel nicht cachebar, außer den deterministischen
// Werkzeugen in EXTERNAL_TOOLS: Deren Programmdatei und Begleitdateien werden als externe
// Eingaben aufgezeichnet, Repo-Dateien unter ihren Argumenten als gelesene Dateien.
// Was ein solches Werkzeug sonst aus dem Repo liest, muss der Aufrufer selbst lesen.
import fs from 'node:fs';
import module from 'node:module';
import {createHash} from 'node:crypto';
import {resolve,relative,sep,join,isAbsolute,basename,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import childProcess from 'node:child_process';
import {promisify} from 'node:util';

// Mesen2 läuft mit festen Overrides (tools/mesen.mjs); Kern und settings.json gehören zur Eingabe.
// Edge rendert nur, was der Testserver aus dem Repo ausliefert.
export const EXTERNAL_TOOLS={'mesen.exe':['MesenCore.dll','settings.json'],'msedge.exe':[]};
const dir=process.env.TRACK_DIR,root=process.env.TRACK_ROOT;
if(dir&&root){
 // Testrunner-Kinder bekommen einen eigenen Schlüssel aus ihrer Testdatei;
 // deren Unterprozesse erben ihn über TRACK_KEY/TRACK_OWNER.
 const testChild=process.env.NODE_TEST_CONTEXT&&!process.env.TRACK_OWNER;
 if(testChild||!process.env.TRACK_KEY){
  const main=process.argv[1]?relative(root,resolve(process.argv[1])).split(sep).join('/'):'unknown';
  process.env.TRACK_KEY=main.replace(/[^A-Za-z0-9._-]/g,'_');
 }
 if(!process.execArgv.includes('--test')||process.env.NODE_TEST_CONTEXT)process.env.TRACK_OWNER='1';
 const key=process.env.TRACK_KEY,record={key,reads:new Set(),writes:new Set(),dirs:new Set(),exists:new Set(),modules:new Set(),external:new Set(),uncacheable:[]};
 const rootAbs=resolve(root),origMkdir=fs.mkdirSync,origWrite=fs.writeFileSync,origStat=fs.statSync;
 const local=p=>{
  try{
   if(Buffer.isBuffer(p))p=p.toString();
   if(p instanceof URL||typeof p==='string'&&p.startsWith('file:'))p=fileURLToPath(p);
   if(typeof p!=='string')return null;
   const rel=relative(rootAbs,resolve(p));
   if(!rel||rel.startsWith('..')||isAbsolute(rel))return null;
   const norm=rel.split(sep).join('/');
   return norm.startsWith('.git/')||norm.startsWith('.cache/')?null:norm;
  }catch{return null;}
 };
 const add=(set,p)=>{const l=local(p);if(l)set.add(l);};
 const writeFlag=f=>typeof f==='string'?/[wa+]/.test(f):typeof f==='number'&&(f&(fs.constants.O_WRONLY|fs.constants.O_RDWR|fs.constants.O_CREAT|fs.constants.O_APPEND|fs.constants.O_TRUNC))!==0;
 // Eigene promisify-Varianten (z. B. execFile -> {stdout,stderr}) bleiben erhalten.
 const wrap=(obj,name,fn)=>{
  const orig=obj[name];if(typeof orig!=='function')return;
  const wrapped=function(...args){fn(...args);return orig.apply(this,args);};
  const custom=orig[promisify.custom];
  if(typeof custom==='function')wrapped[promisify.custom]=function(...args){fn(...args);return custom.apply(this,args);};
  obj[name]=wrapped;
 };
 for(const target of [fs,fs.promises]){
  for(const n of ['readFile','readFileSync','createReadStream'])wrap(target,n,p=>add(record.reads,p));
  for(const n of ['writeFile','writeFileSync','appendFile','appendFileSync','createWriteStream','unlink','unlinkSync','rm','rmSync','truncate','truncateSync','mkdir','mkdirSync'])wrap(target,n,p=>add(record.writes,p));
  for(const n of ['readdir','readdirSync','opendir','opendirSync'])wrap(target,n,p=>add(record.dirs,p));
  for(const n of ['existsSync','stat','statSync','lstat','lstatSync','access','accessSync'])wrap(target,n,p=>add(record.exists,p));
  for(const n of ['open','openSync'])wrap(target,n,(p,f)=>add(writeFlag(f)?record.writes:record.reads,p));
  for(const n of ['copyFile','copyFileSync','cp','cpSync'])wrap(target,n,(a,b)=>{add(record.reads,a);add(record.writes,b);});
  for(const n of ['rename','renameSync'])wrap(target,n,(a,b)=>{add(record.writes,a);add(record.writes,b);});
 }
 module.syncBuiltinESMExports();
 const nodeBinary=f=>typeof f==='string'&&(resolve(f)===resolve(process.execPath)||/^node(\.exe)?$/i.test(f));
 const externalTool=(f,args)=>{
  const companions=typeof f==='string'&&isAbsolute(f)?EXTERNAL_TOOLS[basename(f).toLowerCase()]:undefined;
  if(!companions)return false;
  for(const name of [basename(f),...companions])record.external.add(resolve(dirname(f),name).split(sep).join('/'));
  if(Array.isArray(args))for(const a of args)if(typeof a==='string'&&local(a)&&origStat(a,{throwIfNoEntry:false})?.isFile())add(record.reads,a);
  return true;
 };
 // Abgespielte Aufzeichnungen (tools/mesen.mjs) melden ihr Werkzeug ohne Start.
 process.on('snes-track-external',f=>externalTool(f,[]));
 for(const n of ['spawn','spawnSync','execFile','execFileSync'])wrap(childProcess,n,(f,args)=>{if(!nodeBinary(f)&&!externalTool(f,args))record.uncacheable.push(String(f));});
 for(const n of ['exec','execSync','fork'])wrap(childProcess,n,f=>{if(n!=='fork')record.uncacheable.push(String(f));});
 module.syncBuiltinESMExports();
 module.registerHooks({load(url,context,next){if(url.startsWith('file:'))add(record.modules,url);return next(url,context);}});
 process.on('exit',code=>{
  try{
   const out=join(dir,key);origMkdir(out,{recursive:true});
   const data={key,pid:process.pid,exit:code,argv:process.argv.slice(1).map(a=>local(a)??a),
    reads:[...record.reads].sort(),writes:[...record.writes].sort(),dirs:[...record.dirs].sort(),
    exists:[...record.exists].sort(),modules:[...record.modules].sort(),external:[...record.external].sort(),uncacheable:record.uncacheable};
   origWrite(join(out,process.pid+'-'+createHash('sha1').update(String(Math.random())).digest('hex').slice(0,8)+'.json'),JSON.stringify(data));
  }catch{}
 });
}
