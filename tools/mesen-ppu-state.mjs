// Renderer-Orakel (nur Werkzeug/Test): baut aus dem PPU-Zustand, den Mesen zu
// einem Bild liefert (recordLiveRoom mit shotPpu), einen PpuState mit denselben
// Registerbytes und Speichern. So prüft der Vergleich allein den Renderer,
// unabhängig davon, ob der native Spielablauf an diesem Bild gleich ist
// (Lag-Frames des Originals). Feldnamen: Mesen emu.getState(), Präfix "ppu.".
// Registerbits nach Book I Kapitel 27 (PDF 115-131).
import {PpuState} from '../src/video/ppu-state.mjs';

export function ppuFromMesen({fields,vram,cgram,oam}){
  const f=name=>{if(!(name in fields))throw Error('Mesen PPU field missing: '+name);return fields[name];};
  const num=name=>Number(f(name)),flag=name=>f(name)==='true';
  const bits=(prefix,count)=>Array.from({length:count},(_,n)=>flag(`${prefix}[${n}]`)?1<<n:0).reduce((a,b)=>a|b,0);
  const p=new PpuState();
  p.vram.set(vram);p.cgram.set(cgram);p.oam.set(oam);
  for(const name of ['vramKnown','cgramKnown','oamKnown'])p[name].fill(1);
  const set=(port,value)=>{p.registers[port-0x2100]=value&255;p.registerKnown[port-0x2100]=1;};
  set(0x2100,(flag('forcedBlank')?0x80:0)|num('screenBrightness'));
  // OBJSEL 2101: Größe, Namenslücke (Wortversatz (n+1)*4096), Basis (n*8192 Wörter).
  set(0x2101,num('oamMode')<<5|((num('oamAddressOffset')>>12)-1)<<3|num('oamBaseAddress')>>13);
  set(0x2103,flag('enableOamPriority')?0x80:0);
  let bgmode=num('bgMode')|(flag('mode1Bg3Priority')?8:0);
  for(let n=0;n<4;n++)if(flag(`layers[${n}].largeTiles`))bgmode|=0x10<<n;
  set(0x2105,bgmode);
  set(0x2106,(num('mosaicSize')-1)<<4|num('mosaicEnabled'));
  for(let n=0;n<4;n++){
    set(0x2107+n,num(`layers[${n}].tilemapAddress`)>>10<<2|(flag(`layers[${n}].doubleWidth`)?1:0)|(flag(`layers[${n}].doubleHeight`)?2:0));
    p.scroll[n*2]=num(`layers[${n}].hscroll`)&1023;p.scroll[n*2+1]=num(`layers[${n}].vscroll`)&1023;p.scrollKnown[n*2]=p.scrollKnown[n*2+1]=1;
  }
  set(0x210B,num('layers[0].chrAddress')>>12|num('layers[1].chrAddress')>>12<<4);
  set(0x210C,num('layers[2].chrAddress')>>12|num('layers[3].chrAddress')>>12<<4);
  set(0x212C,num('mainScreenLayers'));set(0x212D,num('subScreenLayers'));
  set(0x212E,bits('windowMaskMain',5));set(0x212F,bits('windowMaskSub',5));
  // 2123-2125: je Ebene (BG1-4, OBJ, Farbe) W1 IN/OUT, W1 EN, W2 IN/OUT, W2 EN.
  const select=layer=>[0,1].reduce((v,w)=>v|(flag(`window[${w}].invertedLayers[${layer}]`)?1<<(w*2):0)|(flag(`window[${w}].activeLayers[${layer}]`)?2<<(w*2):0),0);
  for(let n=0;n<3;n++)set(0x2123+n,select(n*2)|select(n*2+1)<<4);
  set(0x2126,num('window[0].left'));set(0x2127,num('window[0].right'));set(0x2128,num('window[1].left'));set(0x2129,num('window[1].right'));
  // 2130 bits 7-4 and 212A/212B are not in Mesen's state: the last CPU write
  // (wNNNN, trace-live-room.lua). Without such a write they stay unknown.
  const written=port=>fields['w'+port.toString(16).toUpperCase()];
  if(written(0x2130)!==undefined)set(0x2130,(Number(written(0x2130))&0xF0)|(flag('colorMathAddSubscreen')?2:0)|(flag('directColorMode')?1:0));
  for(const port of [0x212A,0x212B])if(written(port)!==undefined)set(port,Number(written(port)));
  // fixedColor: BGR555 of 2132 (R bits 0-4, G 5-9, B 10-14).
  p.fixedColor=num('fixedColor')&0x7FFF;p.fixedKnown=7;
  set(0x2131,num('colorMathEnabled')|(flag('colorMathHalveResult')?0x40:0)|(flag('colorMathSubtractMode')?0x80:0));
  set(0x2133,(flag('screenInterlace')?1:0)|(flag('objInterlace')?2:0)|(flag('overscanMode')?4:0)|(flag('hiResMode')?8:0)|(flag('extBgEnabled')?0x40:0));
  return p;
}
