export function seedTaskDirectionFixture(f){
 const word=(a,v)=>f.data.seed(a,[v&255,v>>>8]),bank=f.context.bank*65536;
 word(bank+0xCC2,0x20);
 for(const offset of [0xE38,0xE48,0xE90,0xEA0,0x11A8])word(bank+offset,0);
}
