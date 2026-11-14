// Planbefehle der Mesen-Wege (tools/mesen-f390-oracle.mjs, Format wie
// tools/mesen/trace-f390.lua) als Padwort je Live-NMI für den nativen Livemodus.
// "glove" regelt den Handschuh über die native Position ($01D4/$01D6, High-Byte),
// "aim" auf Wort(x)/4 + dx, Wort(y)/4 + dy (Objektposition), höchstens 120 Bilder.
// Mit einer Rundenzahl r (["wait", n, r], ["press", keys, n, r]) endet der Befehl
// nach r Rückkehren der Hauptschleife an 80:96C3 (rounds()) statt nach n NMIs,
// damit Lag-Frames die Spielzeit im Feld nicht verschieben.
// "walk" steuert die Spielfigur (Slot $0CC2, Wort $0E28/$0E80+Slot durch 4) auf
// x, y, bis es sie genau erreicht; "exit" hält die Tasten bis zu
// einem Sprung der Position über 32 zwischen zwei NMIs (Szenenwechsel). Geschlossen über die Position statt
// der Dauer, damit Lag-Frames des Originals den Weg nicht verschieben.
// Nur Werkzeug/Test; jedes Padwort wird je NMI genau einmal bestimmt, ends[i] ist
// [k, Slot, x, y, Runden]: NMI k, an dem Befehl i endet, die Spielfigur dort und rounds() (Mesen: recordLiveRoom mit livePlan).
const BITS={b:0x8000,y:0x4000,select:0x2000,start:0x1000,up:0x0800,down:0x0400,left:0x0200,right:0x0100,a:0x80,x:0x40,l:0x20,r:0x10};
// Weltachsen der Spielfigur: oben+links +x, unten+rechts -x, oben+rechts +y, unten+links -y.
const STEER=[BITS.down,BITS.down|BITS.right,BITS.right,BITS.down|BITS.left,0,BITS.up|BITS.right,BITS.left,BITS.up|BITS.left,BITS.up];
const keys=text=>text.split('+').reduce((word,key)=>word|BITS[key],0);
export function livePlanDriver(plan,wram,rounds=()=>0){
  let index=0,start=null,startRounds=0,jumped=false,last=null;const pads=[],ends=[],word=at=>wram[at]|wram[at+1]<<8;
  const player=()=>{const slot=word(0xCC2);return slot<0x8000?[word(0xE28+slot)>>2,word(0xE80+slot)>>2]:null;};
  const step=k=>{
    for(;;){
      const command=plan[index];if(!command)return 0;if(start===null){start=k;startRounds=rounds();}
      const t=k-start,[kind]=command;let input=0,done=false;
      const r=rounds()-startRounds;
      if(kind==='hold'){input=t<command[2]?keys(command[1]):0;done=t+1>=command[2];}
      else if(kind==='press'){input=t<6?keys(command[1]):0;done=command[3]===undefined?t+1>=(command[2]??12):t>=6&&r>=command[3];}
      else if(kind==='wait')done=command[2]===undefined?t+1>=command[1]:r>=command[2];
      else if(kind==='walk'||kind==='exit'){
        const p=player();if(t===0){jumped=false;last=p;}
        if(p&&last&&(Math.abs(p[0]-last[0])>32||Math.abs(p[1]-last[1])>32))jumped=true;if(p)last=p;
        if(t>2000)throw Error(`${kind} target not reached: command ${index} at ${p}`);
        if(kind==='exit')jumped?done=true:input=keys(command[1]);
        else if(p){const sx=Math.sign(command[2]-p[0]),sy=Math.sign(command[3]-p[1]);
          if(!sx&&!sy)done=true;else input=STEER[(sx+1)*3+sy+1];}
      }
      else if(kind==='glove'||kind==='aim'){
        const x=wram[0x1D5],y=wram[0x1D7];
        const [tx,ty]=kind==='glove'?command.slice(1,3):[((word(command[2])>>2)+command[4])&255,((word(command[3])>>2)+command[5])&255];
        if(Math.abs(x-tx)<=1&&Math.abs(y-ty)<=1||kind==='aim'&&t>120)done=true;
        else{
          if(t>600)throw Error(`glove target not reached: command ${index} at ${x},${y}`);
          if(x<tx-1)input|=BITS.right;else if(x>tx+1)input|=BITS.left;
          if(y<ty-1)input|=BITS.down;else if(y>ty+1)input|=BITS.up;
        }
      }else throw Error('unknown plan command '+kind);
      if(done){const slot=word(0xCC2)&0x7FFF;ends[index]=[k,word(0xCC2),word(0xE28+slot),word(0xE80+slot),rounds()];index++;start=null;if(kind!=='hold'&&kind!=='press'&&kind!=='wait')continue;}
      return input;
    }
  };
  return {pads,ends,pad:k=>{pads[k]??=step(k);return pads[k];},done:()=>index>=plan.length};
}
