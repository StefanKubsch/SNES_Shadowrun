// Module hook for the probe tools/rom-vram-hook.mjs, tool only: wraps the
// unpacker entries unpackStreamLong (9F49/9F4D, also through the startup
// interrupt path) and unpackPortrait (portraits into bank 7F) so the probe sees each
// call with its registers on entry (A source offset, Y source bank, X
// destination offset; src/task/native-unpack.mjs). 9E7E (room tiles, fixed
// 128 bytes) is left out. The product never loads this file.
const WRAPS = {
  '/src/task/native-unpack.mjs': ['export function unpackStreamLong(', 'function probeOriginal9F49(',
    `export function unpackStreamLong(a,outerReturn=true,entry=0x809F49,events=null){
 if(entry===0x809E7E)return probeOriginal9F49(a,outerReturn,entry,events);
 const c=a.ctx;globalThis.__unpackBegin?.(entry,(c.y&255)<<16|c.a,0x7E0000|c.x);
 try{return probeOriginal9F49(a,outerReturn,entry,events);}finally{globalThis.__unpackEnd?.();}}`],
  '/src/task/native-dialog-portrait.mjs': ['export function unpackPortrait(', 'function probeOriginal9F6D(',
    `export function unpackPortrait(h,e){const c=h.ctx;globalThis.__unpackBegin?.(0x809F6D,(c.y&255)<<16|c.a,0x7F0000|c.x);
 try{return probeOriginal9F6D(h,e);}finally{globalThis.__unpackEnd?.();}}`],
};
export async function load(url, context, next) {
  const result = await next(url, context);
  const wrap = Object.entries(WRAPS).find(([end]) => url.endsWith(end));
  if (!wrap) return result;
  const [, [from, to, wrapper]] = wrap, source = String(result.source);
  if (!source.includes(from)) throw new Error(`Probe wrap point missing in ${url}`);
  return {...result, source: source.replace(from, to) + '\n' + wrapper + '\n'};
}
