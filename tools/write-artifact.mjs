import {readFile,writeFile} from 'node:fs/promises';

// Compute and validate the report before calling this helper. A byte-identical
// report needs no truncation, which can fail while Windows readers map the file.
export async function writeArtifactIfChanged(path,text){
 const bytes=Buffer.from(text,'utf8');
 try{if((await readFile(path)).equals(bytes))return false;}
 catch(error){if(error.code!=='ENOENT')throw error;}
 await writeFile(path,bytes);
 return true;
}
