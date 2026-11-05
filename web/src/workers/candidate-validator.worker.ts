import {packResultIntoSheets} from '../geometry/multiSheet';
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
    self.postMessage({...identity,result:{...packed,validation:{...checked,source:'local' as const}}});
  }catch(error){
    self.postMessage({...identity,error:error instanceof Error?error.message:String(error)});
  }
};
