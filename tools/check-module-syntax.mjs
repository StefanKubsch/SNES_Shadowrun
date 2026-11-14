import {readFile} from 'node:fs/promises';
import {resolve,relative,isAbsolute,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as vm from 'node:vm';

// Parse each file as its own ECMAScript module. No linking, import resolution
// or execution: the same V8 module grammar used by Node's --check, without
// starting a separate Node process for every module.
export async function checkModuleSyntax(root,files){
 if(typeof root!=='string'||!isAbsolute(root)||!Array.isArray(files)||!files.length
  ||new Set(files).size!==files.length)throw Error('Invalid syntax manifest');
 const paths=files.map(file=>{
  if(typeof file!=='string'||!file.endsWith('.mjs')||!/^(src|proof|tools)\//.test(file)||isAbsolute(file))throw Error('Invalid syntax module path');
  const absolute=resolve(root,file),local=relative(root,absolute);
  if(local==='..'||local.startsWith('..'+sep)||isAbsolute(local))throw Error('Syntax module outside workspace');
  return {file,absolute};
 });
 if(typeof vm.SourceTextModule!=='function')throw Error('Module parser requires --experimental-vm-modules');
 const started=performance.now();
 for(const {file,absolute}of paths){
  try{new vm.SourceTextModule(await readFile(absolute,'utf8'),{identifier:pathToFileURL(absolute).href});}
  catch(error){throw Error(`Module syntax failed: ${file}: ${error.message}`,{cause:error});}
 }
 return {modules:files.length,milliseconds:Math.round(performance.now()-started),executed:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  if(process.argv.length!==3)throw Error('Expected syntax manifest path');
  const {root,files}=JSON.parse(await readFile(process.argv[2],'utf8'));
  console.log(JSON.stringify(await checkModuleSyntax(root,files)));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
