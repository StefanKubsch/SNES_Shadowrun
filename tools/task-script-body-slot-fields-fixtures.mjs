// Synthetic caller fields and DP:F3 pointer; original fetched ROM WORDs are independently pinned.
export function slotFieldsBodyCases(){
 return [false,true].flatMap(selectionEqual=>[0,5].flatMap(currentAction=>[0,1,2,3,255].map(index=>({
  name:`selection-${selectionEqual}-action-${currentAction}-index-${index}`,selectionEqual,currentAction,index}))))
  .concat([{name:'full-argument-highs-truncated',args:[0xAB10,0xFF03],index:3,currentAction:5},
   {name:'slot255-truncated-index',args:[65535,0xAB01],index:1,currentAction:0}]);
}
export function expandSlotFieldsBodyFixture(s,v,f){
 const word=(a,n)=>f.data.seed(a,[n&255,n>>>8]),args=v.args??[16,v.index??3],slot=args[0]&255;
 word(0x800,args[0]);word(0x802,args[1]);word(0x804,0xBEEF);
 word(0x801038+slot,v.selectionEqual?2:65535);word(0x801198+slot,v.currentAction??0);word(0x7E3F28+slot,11);
 word(0x8010E8+slot,1);word(0x8011F0+slot,0xAB31);word(0x801090+slot,0x88F8+8);
 f.data.seed(0xF3,[0,0x90,0x8D]);
 return {...f,maxWork:40000,maxOutputBytes:10000};
}
