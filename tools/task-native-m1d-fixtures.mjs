import {seedTaskCreationFixture} from './task-native-create-fixtures.mjs';
import {readFileSync} from 'node:fs';import {inspectRom} from './rom.mjs';
// Sine table 80:D3D1 (0x281 bytes read by the swing natives) as it is in the ROM.
const rom=inspectRom(readFileSync(new URL('../Shadowrun (E).smc',import.meta.url))).bytes;
const sineTable=[...rom.subarray(0x53D1,0x53D1+0x281)];
// Explicit synthetic physical sources for the M1d leaves; no scene or table capacity inferred.
export function seedTaskM1dFixture(f,entry){
 const word=(a,v)=>f.data.seed(a,[v&255,v>>>8]),bank=f.context.bank*65536;
 if(entry===0x809D6A)word(0x7E2DF0,0x2468);
 if(entry===0x80CCB9){word(0x7E2DE2,1);word(0x8D92A6,0x1357);}
 if(entry===0x809159)f.data.seed(0x7E3CA3,[0x10]);
 if(entry===0x80A1E6){
  // Object 10 of type 4 at row 2: free slot 56 (creation fixture), sprite FFFF skips the A835 JSL,
  // AAAF returns early (A835 clears 1198+56, DP02 = old DP08 0), 9700 search hits X=18.
  seedTaskCreationFixture(f);word(8,0);word(0x0A,4);word(0x0C,0x40);word(0x7E2DE6,0);word(0x7E3C05,2);
  word(0x8DB028,0xFFFF);f.data.seed(0x8DB025,[0x12]);word(0x809718,4);word(0x7E3C90,0x5577);
  // Native58 fixture: operand words 6/7 at 03FB/03FD become DP0A/DP0C; its DP08 = FFFF takes the
  // AAAF selection path, which returns at 1038+56 = FFFF (set by A835) after 10E8+56 = 0.
  word(0x3FB,4);word(0x3FD,0x40);word(bank+0x10E8+0x56,0);
 }
 if(entry===0x80DE7E)for(const offset of [0x1D5B,0x1D5D,0x1D5F,0x1D65,0x1D6B,0x1D6D])word(bank+offset,0x1234);
 if(entry===0x80866F){
  // List 1FB2 with X=4: object 10 has bits 2 and 12 (skipped), object 20 has bit 2 only (match at X=2).
  word(bank+0x1FB0,4);word(bank+0x1FB6,0x10);word(bank+0x1FB4,0x20);word(bank+0x1FB2,0x30);
  word(bank+0x1458+0x10,0x1004);word(bank+0x1458+0x20,0x0004);word(bank+0x1458+0x30,0x0004);
 }
 if(entry===0x80C694){
  // Objects 10 and 20: dx 0x150-0x100 = 0x50, dy 0x100-0x180 negative (magnitude 0x80 wins): 0x80>>2 = 0x20.
  word(0,0x10);word(2,0x20);word(bank+0x0E38,0x150);word(bank+0x0E48,0x100);word(bank+0x0E90,0x100);word(bank+0x0EA0,0x180);
  word(bank+0x0E2B,0x120);word(bank+0x0E83,0x100); // Native58 fixture: DP02 = 3
 }
 if(entry===0x80D134)word(0x7E2DE4,0x1234);
 if(entry===0x80D186)word(bank+0x0CC2,0x0056);
 if(entry===0x80A977){word(bank+0x0ED8+0x10,0x100);word(bank+0x0ED8+3,0x200);}
 if(entry===0x80C71D)word(bank+0x0CC2,0x0056);
 if(entry===0x809D15){
  // Object 10 (record 400) has number 1234, found at 7E3C31+60; ROM 97AC+60 = 0x5678 (synthetic source).
  // Native58 fixture: DP00 = 3 with record 0 does nothing.
  word(bank+0x150A+0x10,0x1234);word(0x7E3C31+0x60,0x1234);word(0x80980C,0x5678);
  for(let x=0x68;x>=0;x-=8){if(x!==0x60){word(0x7E3C2E+x,0xFFFF);word(0x7E3C31+x,0xFFFF);}}word(0x7E3C2E+0x60,0xFFFF);word(bank+0x13A8+3,0);
 }
 if(entry===0x8090EB){
  // Topics 05/20/FF: DP00 = 10 is inserted between them (flags 1/2 move along). Native58 fixture: DP00 = 3.
  word(0,0x10);f.data.seed(0x7E3CA3,[5,0x20,0xFF,0]);f.data.seed(0x7E3CD6,[1,2,9,0]);
 }
 if(entry===0x808631||entry===0x808656){
  // Fight list 1FB2: 30, 10, 20 (1FB0 = 4). DP00 = 10 has 30 before it; the Native58 fixture's 3 is missing.
  word(bank+0x1FB0,4);word(bank+0x1FB2,0x30);word(bank+0x1FB4,0x10);word(bank+0x1FB6,0x20);
 }
 if(entry===0x80CF2E){
  // Object 10 (number 08B2) is group member 2 of 7E2DF0; record 7E3BFB byte 1 = 3 gives the limit 30.
  // Native58 fixture: DP00 = 3 is not in the group, the player 0CC2 = 10 is.
  [0x08B2,0x0A4F,0x0D2E,0x1458,0x079A,0x089D,0x1B6D,0x0B52,0x15D2,0x0BA6,0x078C,0x0B3D,0x098B].forEach((n,i)=>word(0x809700+2*i,n));
  word(0x80971A,0x3BFB);f.data.seed(0x809734,[0x7E]);f.data.seed(0x7E3BFC,[3,0]);
  word(0x7E2DE6,2);word(0x7E2DF0,0x0A4F);word(0x7E2DF2,0x08B2);word(bank+0x150A+0x10,0x08B2);word(bank+0x150A+3,0x1234);
  word(bank+0x0CC2,0x10);f.data.seed(0x7E3C96,[0x1C,0]);
 }
 // D714/D73B: phase 1F0 wraps to 10 (D73B reads 110); D796 slots: phase 1FC wraps to 4, second read at 84.
 // The ROM bytes of the table D3D1 at these phases are seeded as they are in the ROM.
 if(entry===0x80D714){word(bank+0x1D57,0x1F0);word(0x80D3E1,0x4D4C);}
 if(entry===0x80D73B){word(bank+0x1D59,0x1F0);word(0x80D4E1,0x3233);}
 if(entry>=0x80D769&&entry<=0x80D793){for(let o=0;o<0x10;o+=2)word(bank+0x1CEF+o,0x1FC);word(0x80D3D5,0x4343);word(0x80D455,0x7F7F);}
 // 9DC8: object 10 has number 4, record 8D:B024 (synthetic 0400) with counter 1: reaches 0, DP00 = FFFF.
 if(entry===0x809DC8){word(0,0x10);word(bank+0x150A+0x10,4);word(0x8DB024,0x400);f.data.seed(0x7E0402,[1]);word(bank+0x150A+3,0);word(0x8DB020,0);}
 // A2B5: group 30, 10, 20 (7E2DE6 = 4); DP00 = 10 is removed, 20 moves down.
 if(entry===0x80A2B5){word(0,0x10);word(0x7E2DE6,4);[0x30,0x10,0x20].forEach((v,n)=>{word(bank+0x1FA8+2*n,v);word(0x7E2DE8+2*n,0x100+n);word(0x7E2DF0+2*n,0x200+n);word(0x7E2DF8+2*n,0x300+n);});
  word(bank+0x1FAE,0x40);word(0x7E2DEE,0x103);word(0x7E2DF6,0x203);word(0x7E2DFE,0x303);}
 // BB2C: object 10 (and the Native58 fixture's 3) has number 4, member 1 of the group (X = 2): step BB88+2 = 20
 // with 0D18 = 0 selects the recorded position 7E45C8. AAAF finds 1198 already 5, A985 finds 1038 already 2.
 if(entry===0x80BB2C){word(0,0x10);word(0x7E2DE6,2);word(0x7E2DF0,9);word(0x7E2DF2,4);word(bank+0x0D18,0);word(bank+0x0D1A,0);
  word(0x80BB8A,0x20);word(0x7E45C8,0x30);word(0x7E44C8,0x140);word(0x7E4548,0x120);word(0x7E4648,5);
  for(const y of [0x10,3]){word(bank+0x150A+y,4);word(bank+0x1198+y,5);word(bank+0x1038+y,2);}}
 // 9CE4: object 10 has record 8D:B030 = 0400 (synthetic), DP02 to 7E0403; the number 10 sits at 7E3C2E+60 and
 // takes ROM 97A9+60 = 5678 (synthetic) and BYTE 97AB+60 = 9A. Native58 fixture: object 3 has record 0.
 if(entry===0x809CE4){word(0,0x10);word(0x8DB030,0x400);word(0x8DB023,0);
  for(let x=0x68;x>=0;x-=8){word(0x7E3C2E+x,x===0x60?0x10:0xFFFF);word(0x7E3C31+x,0xFFFF);}word(0x809809,0x5678);f.data.seed(0x80980B,[0x9A]);}
 // BB90: object 10 (and 3) with selection FFFF. A297: object 10 is member 1 of 1FA8 (index 2), 7E2DFA = 77;
 // the Native58 fixture's 3 is missing. D604: object 10, sixteen phases written.
 if(entry===0x80BB90){word(0,0x10);word(bank+0x1038+0x10,0xFFFF);word(bank+0x1038+3,0xFFFF);}
 if(entry===0x80A297){word(0,0x10);word(0x7E2DE6,2);word(bank+0x1FAA,0x10);word(bank+0x1FA8,0x30);word(0x7E2DFA,0x77);}
 if(entry===0x80D604)word(0,0x10);
 // D85B/D2E7: swing state with five (thirteen) objects 10, 12, ..; D2E7 DP00 = 0 (Native58 fixture: 3) steps.
 if(entry===0x80D85B||entry===0x80D2E7){
  f.data.seed(0x80D3D1,sineTable);
  for(let o=0x1D0B;o<0x1D49;o+=2)word(bank+o,0x100);for(let o=0;o<0x1A;o+=2)word(bank+0x1CEF+o,0x10+o);
  if(entry===0x80D2E7)word(0,0);
 }
 // Swarm natives: every object slot 7E3F28 taken, so A835 returns at once without writes (its exhausted scan).
 // D7DD: object 90 (bit 7: type 106, origin 10); D260: object 11 (bit 0: type DF, origin 10), sprites D2DD;
 // the Native58 fixtures' 3 reads its own coordinates. D63C: phases give the direction 1, which AAAF finds in
 // 1198+10 already; 1D33 negative ends before A835.
 if(entry===0x80D7DD||entry===0x80D260){
  for(let x=0;x<0x58;x+=2)word(0x7E3F28+x,7);
  for(const o of entry===0x80D7DD?[0x10,0x90,3]:[0x10,2])for(const t of [0x0E28,0x0E80,0x0ED8])word(bank+t+o,0x200+o);
  word(0,entry===0x80D7DD?0x90:0x11);if(entry===0x80D260)f.data.seed(0x80D2DD,[...rom.subarray(0x52DD,0x52DD+10)]);
 }
 if(entry===0x80D63C){
  f.data.seed(0x80D3D1,sineTable);word(bank+0x1D35,5);word(bank+0x1D55,0x40);word(bank+0x1D37,4);word(bank+0x1D53,0x80);
  word(bank+0x1D4D,0x10);word(bank+0x1198+0x10,1);word(bank+0x1D33,0xFFFF);
 }
 if(entry===0x808B8A){word(bank+0x1F60,4);f.data.seed(0x7E3C98,[0x30,0x77]);}
 if(entry===0x808E96||entry===0x808EB8){
  // Object 10: link 20 (0BA2 negative) to 30, whose 0BA2 gets bit 12. Native58 fixture: DP00 = 3 without link.
  word(bank+0x1458+0x10,0x0004);word(bank+0x1350+0x10,0x20);word(bank+0x0BA2+0x20,0x8000);word(bank+0x0372+0x20,0x30);
  word(bank+0x0BA2+0x30,0x1001);word(bank+0x1458+3,0x0400);word(bank+0x1350+3,0xFFFF);
 }
 if(entry===0x808EDA){
  // Spell 3, list pointer 7E5000 with script byte 21; C34A appends a frame at the free heap block 0200.
  word(0x7E3C13,3);word(0x7E3C1A,0x5000);f.data.seed(0x7E5000,[0x21,0]);
  word(bank+0x03D2,0x0200);word(bank+0x03D4,0);word(bank+0x024E,0x40);word(bank+0x024C,0xFFFF);
  [0x40,0x42,0x44,0x46].forEach((x,n,l)=>word(bank+0x0312+x,l[n+1]??0xFFFF));
  // Original script tables of C2C8 for script 3 (bank 82) and the header bytes of its body at 9B:D91E.
  f.data.seed(0x82DB2B,[0x9B,0x9F]);f.data.seed(0x82E9CF,[2,2]);f.data.seed(0x82DED7,[0x1E,0xD9]);f.data.seed(0x9BD91E,[1,4]);
 }
 if(entry===0x80D067){
  // Object 10 has number 08B2: the search reads all 13 words of the ROM table 9700 down to index 0,
  // whose record pointer 971A/9734 is 7E3BFB (WRAM): byte 2 = 56 to DP00. Native58 fixture: DP00 = 3.
  [0x08B2,0x0A4F,0x0D2E,0x1458,0x079A,0x089D,0x1B6D,0x0B52,0x15D2,0x0BA6,0x078C,0x0B3D,0x098B].forEach((n,i)=>word(0x809700+2*i,n));
  word(0x80971A,0x3BFB);f.data.seed(0x809734,[0x7E]);
  word(0,0x10);word(bank+0x150A+0x10,0x08B2);f.data.seed(0x7E3BFD,[0x56,0x9A]);word(bank+0x150A+3,0x08B2);
 }
 if(entry===0x80D1DD){
  // Player 0CC2 = 20 lies right of object 10 (0E28: player minus object = +0x50): direction 2 to DP00.
  word(0,0x10);word(bank+0x0CC2,0x20);word(bank+0x0E38,0x100);word(bank+0x0E48,0x150);word(bank+0x0E90,0x100);word(bank+0x0EA0,0x100);
  word(bank+0x0E2B,0x100);word(bank+0x0E83,0x100); // Native58 fixture: DP00 = 3
 }
 if(entry===0x80CF93){
  // Object 10 looks at object 20 (Native58 fixture: object 3) to the right: direction 2. AAAF finds
  // 1198+10 already 2 and returns before the action store.
  word(0,0x10);word(2,0x20);word(bank+0x0E38,0x100);word(bank+0x0E90,0x100);
  for(const y of [0x20,3]){word(bank+0x0E28+y,0x150);word(bank+0x0E80+y,0x110);}
  word(bank+0x1198+0x10,2);
 }
 if(entry===0x80E262){word(bank+0x1D87,0);word(bank+0x1D89,0x0100);}
 if(entry===0x808371){
  // Object 10 (type 0) moved by DP02=1 (Native58 fixture: 3): offsets F8/08/F8/08, height 10 from record 8C:A000.
  // Cells 20/00/02/22; cell 20 holds object 4 (box 8, owner 30) overlapping by 20.
  word(0,0x10);word(2,1);word(0x7E3F38,0);word(0x8CED8A,0x9000);word(0x8C9002,0xA000);word(0x8C9006,0xA000);
  f.data.seed(0x8CA003,[0xF8,0x08,0xF8,0x08,0x10,0x00]);
  word(0x7E0E38,0x0100);word(0x7E0E90,0x0100);word(0x7E0EE8,0);
  word(0x7E0CC2,0x40);word(0x7EE0CC,4);for(const cell of [0,2,0x22])word(0x7EE0AC+cell,0xFFFF);
  word(0x7EEF40,8);word(0x7EF7A0,0xFFFF);word(0x7FE216,0x30);
  for(const [offset,value] of [[0xE2AC,0x40],[0xE2AE,0x40],[0xE2B0,0],[0xE2B2,0x50],[0xE2B4,0x50],[0xE2B6,0x20]])word(0x7E0008+offset,value);
 }
 if(entry===0x80E30F){
  // DP08 matches both tables at X=18; pointer 8D9000 (+9) and record 7E0402.
  for(let x=0;x<0x18;x+=2)word(0x809700+x,0xEEEE);
  word(8,0x55);word(0x809718,0x55);word(0x809732,0x9000);f.data.seed(0x80974C,[0x8D]);f.data.seed(0x8D9009,[0x66]);
  word(0x7E2E08,0x55);word(bank+0x1FC0,0x10);f.data.seed(0x7E0402,[0x77]);
 }
 return f;
}
