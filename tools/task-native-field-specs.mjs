export const fieldLeafSpecs=[
 {name:'native-cc33',id:0x54,entry:0x80CC33,windows:[{start:0x80CC33,hex:'A5008DE91CA5028DEB1CA5048FE22D7E60'}],
  anchors:[{kind:'pointer',start:0x82D860,hex:'33CC'},{kind:'argument-metadata',start:0x82DAA0,hex:'0301'},
   {kind:'return-metadata',start:0x82D9C4,hex:'0000'}],
  contract:'Fresh DP00 -> actualDBR1CE9, then freshDP02 -> actualDBR1CEB, then freshDP04 -> long7E2DE2; full WORD stores and aliases, no destination reads, C/V preserved.'},
 {name:'native-cc97',id:0x56,entry:0x80CC97,windows:[{start:0x80CC97,hex:'A5008FE22D7EA9FF7F8DE91C60'}],
  anchors:[{kind:'pointer',start:0x82D864,hex:'97CC'},{kind:'argument-metadata',start:0x82DAA2,hex:'0101'},
   {kind:'return-metadata',start:0x82D9C6,hex:'0002'}],
  contract:'Fresh WORD DP00 -> long7E2DE2; then original7FFF -> actualDBR1CE9, flags from final immediate load; no destination reads, C/V preserved.'}
];
