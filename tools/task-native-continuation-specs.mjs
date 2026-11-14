// Literal European-ROM windows. Migration is explicit, no caller timing inferred.
export const continuationSpecs=[
 {name:'native-bridge',entry:0x80F4F6,classification:'native58-stack-pointer-bridge',
  windows:[{start:0x80F4F6,hex:'1BA900005BF48080ABABBFB8D78285A2202FF5'}],
  host_boundary:'Observed A migrates S; D0/DBR80 are established by actual PEA/PLB bytes. Stop at F52F BEFORE indirect callee dispatch.'},
 {name:'native-resume',entry:0x80F509,classification:'native58-observed-callee-return-resume',
  windows:[{start:0x80F509,hex:'AE5002BD52025BD401ABAB3B8DF201A5071BA609BF70D98229FF00F004AD000048A4034C89F3'},
   {start:0x80F389,hex:'B100C829FF00AA'}],
  host_boundary:'Independent observed entry AFTER callee return; no callee completion inferred. Fresh Task D/DBR/S/ID/return metadata/result/PC/pointer; stop BEFORE F390.'}
];
