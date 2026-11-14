export const nativeC68DSpec={name:'native-c68d',id:0x0A,entry:0x80C68D,maximumLocalStackBytes:2,peiWordPushes:[],
 windows:[{start:0x80C68D,hex:'ACC20C2096C660'},
  {start:0x80C696,hex:'A60038BD280EF9280E100449FFFF1A850038BD800EF9800E100449FFFF1AC500B002A5004A4A850060'}],
 anchors:[{kind:'pointer',start:0x82D7CC,hex:'8DC6'},
  {kind:'argument-metadata',start:0x82DA56,hex:'0101'},
  {kind:'return-metadata',start:0x82D97A,hex:'0200'}],
 contract:'Whole original Native0A C68D/C696, excluding unrelated C694 entry. Fresh actualDBR0CC2 Y, real C692 inner JSR frame/RTS, fresh full DP00 X. SEC/binary WORDSBC for both coordinate pairs with 24bit actualDBR indexed addresses, actual BPL/EOR/INC moduloWORD magnitude, DP00store before fresh second pair. Unsigned CMP/fresh DP00 reload on lower second magnitude, two LSRs with actual final Carry/V/N/Z, resultDP00 and rootRTS. Two local plus two outer stack bytes under intact owners; no scene/caller/wholeTask assumption.',
 helperReturnContract:'Complete pinned48byte/24instruction C68D/C696 graph, actual C692 JSR/RTS high/low bytes checked before C693. Two local plus two outer stack bytes. E0M0X0D0 and entry DBR retained, fresh full indices and aliased coordinate/DP00 reads, binary SBC and source signed-wrap/unsigned-CMP/LSR flags. No inferred initialization, conventional non-wrapping distance, wholeTask/scene/frame or executed root return target.'};
