export const nativeCB06Spec={name:'native-cb06',id:0x5C,entry:0x80CB06,
 windows:[{start:0x80CB06,hex:'A600BF22B08D0A85000A6500AABFB4EF8C850060'}],
 anchors:[{kind:'pointer',start:0x82D870,hex:'06CB'},
  {kind:'argument-metadata',start:0x82DAA8,hex:'0101'},
  {kind:'return-metadata',start:0x82D9CC,hex:'0202'}],
 contract:'Fresh full DP00 index and original8DB022+X WORD; first ASL then actual DP00store, second ASL then ADC freshly reread DP00 retaining second-ASL Carry. Full WORD X indexes8CEFB4, including original24bit bank crossing; full returned WORD toDP00. No multiply6 shortcut, fabricated table bytes, or executed RTS target.'};
