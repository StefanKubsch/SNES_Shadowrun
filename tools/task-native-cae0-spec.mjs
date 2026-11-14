export const nativeCAE0Spec={name:'native-cae0',id:0xA0,entry:0x80CAE0,
 windows:[{start:0x80CAE0,hex:'A400BEA813F00AE220A5029F02007EC22060'}],
 anchors:[{kind:'pointer',start:0x82D8F8,hex:'E0CA'},{kind:'argument-metadata',start:0x82DAEC,hex:'0201'},
  {kind:'return-metadata',start:0x82DA10,hex:'0000'}],
 contract:'Whole original NativeA0/CAE0..CAF1. Full DP00/Y, fresh actualDBR13A8+Y WORDpointer/X with full24bit carry. Zero pointer skips DP02 and destination. Nonzero SEP20/LDA DP02 BYTE/STA long7E0002+X BYTE/REP20; actual accumulator high and BYTE N/Z/C/V retained. No destination read, WORD mask, clamped indices or initialized actor/caller/scene/frame inferred; fresh real protected root RTS.'};
