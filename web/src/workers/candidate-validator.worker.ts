import {packResultIntoSheets} from '../geometry/multiSheet';
import {compactValidatedGaps} from '../geometry/gapCompaction';
import {validate} from '../geometry/validate';
import type {Document,Result} from '../model';

// One long-lived per-run validation worker. Clone the DXF document once,
// instead of cloning complex contours for every solver improvement.
type Incoming=
  | {type:'init';document:Document}
  | {type:'validate';runId:number;documentRevision:number;sequence:number;result:Result};
let document:Document|undefined;
self.onmessage=({data}:MessageEvent<Incoming>)=>{
  if(data.type==='init'){document=data.document;return;}
  const identity={type:'validated-candidate' as const,runId:data.runId,documentRevision:data.documentRevision,sequence:data.sequence};
  try {
    if(!document)throw Error('Validator has not received the project.');
    const packed=packResultIntoSheets(document,data.result);
    const checked=validate(document,packed);
    const original={...packed,validation:{...checked,source:'local' as const}};
    // Only optimize already-safe roll candidates; the independent validator
    // checks every accepted translation, and any failure keeps the original.
    let result=original;
    if(checked.status==='passed'){
      try {result=compactValidatedGaps(document,original);}
      catch {result=original;} // Never discard a valid Sparrow layout on experimental failure.
    }
    self.postMessage({...identity,result});
  }catch(error){
    self.postMessage({...identity,error:error instanceof Error?error.message:String(error)});
  }
};
