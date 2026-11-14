// Explicit synthetic sources for a free highest object slot and no callback.
// These bytes do not assert original slot/task initialization or ownership.
export function seedTaskCreationFixture(f){
 const word=(a,v)=>f.data.seed(a,[v&255,v>>>8]),bank=f.context.bank*65536;
 word(0x7E3F7E,65535);word(0x8CF014,0x2468);word(bank+0x14B0,0);word(8,65535);
 return f;
}
