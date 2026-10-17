import {expect,test} from 'vitest';
import {DEFAULT_SETTINGS,newPart,type Document,type Part,type Result} from '../src/model';
import {arrangeSheetRows,improveSheetPacking} from '../src/geometry/sheetPacking';
import {packResultIntoSheets} from '../src/geometry/multiSheet';
import {validate} from '../src/geometry/validate';

function rectangle(width:number,height:number,id:string):Part{
  return {...newPart([[0,0],[width,0],[width,height],[0,height]],id),id,
    rotations:{kind:'discrete',degrees:[0]}};
}
function fixture(parts:Part[],width:number,length:number,starts:number[],gap=0){
  const doc:Document={name:'finite-sheets',parts,settings:{...DEFAULT_SETTINGS,
    materialType:'sheet',materialWidthMm:width,materialLengthMm:length,clearanceMm:gap}};
  const result:Result={documentRevision:3,solverRevision:'test',seed:'42',elapsedSeconds:1,
    usedLengthMm:starts.at(-1)!+10,
    placements:parts.flatMap((part,i)=>Array.from({length:part.quantity},(_,copyIndex)=>({
      partId:part.id,copyIndex,xMm:0,yMm:starts[i]+copyIndex*(length+1),angleDeg:0}))),
    validation:{status:'pending',overlapAreaMm2:0,maxBoundaryViolationMm:0,minClearanceMm:null,errors:[]}};
  return {doc,result};
}
function checked(doc:Document,result:Result){
  expect(validate(doc,result)).toMatchObject({status:'passed',errors:[]});
  expect(result.placements).toHaveLength(doc.parts.reduce((sum,part)=>sum+part.quantity,0));
}

test('fills a single plate instead of preserving the three-sheet strip order',()=>{
  const {doc,result}=fixture([6,6,4,4].map((h,i)=>rectangle(1,h,`p${i}`)),20,10,[0,7,14,19]);
  expect(packResultIntoSheets(doc,result).sheetCount).toBe(3);
  const original=structuredClone({doc,result}),packed=improveSheetPacking(doc,result);
  expect(packed.sheetCount).toBe(1);
  checked(doc,packed);
  expect({doc,result}).toEqual(original);
  expect(packed.placements.map(p=>[p.partId,p.copyIndex])).toEqual(result.placements.map(p=>[p.partId,p.copyIndex]));
});

test('places three 300mm parts on one 1400x700 plate despite their overlapping strip bands',()=>{
  const part={...rectangle(300,300,'linked'),quantity:3};
  const {doc,result}=fixture([part],1400,700,[0],.3);
  result.placements.forEach((p,i)=>{p.xMm=i===1?400:0;p.yMm=i*250;});
  expect(packResultIntoSheets(doc,result).sheetCount).toBe(2);
  const packed=improveSheetPacking(doc,result);
  expect(packed.sheetCount).toBe(1);
  checked(doc,packed);
});

test('fits an actual contour notch even when the bounding rectangles overlap',()=>{
  const l={...newPart([[0,0],[6,0],[6,2],[2,2],[2,6],[0,6]],'L'),id:'L',rotations:{kind:'discrete' as const,degrees:[0]}};
  const {doc,result}=fixture([l,rectangle(4,4,'insert')],6,6,[0,7]);
  expect(packResultIntoSheets(doc,result).sheetCount).toBe(2);
  const packed=improveSheetPacking(doc,result);
  expect(packed.sheetCount).toBe(1);
  checked(doc,packed);
});

test('respects clearance without reserving extra material-edge margins',()=>{
  const part={...rectangle(2,2,'square'),quantity:2};
  const {doc,result}=fixture([part],4.3,2,[0],.3);
  const packed=improveSheetPacking(doc,result);
  expect(packed.sheetCount).toBe(1);
  const validation=validate(doc,packed);
  expect(validation.status).toBe('passed');
  expect(validation.minClearanceMm).toBeCloseTo(.3,7);
  doc.settings.materialWidthMm=4;
  const separate=improveSheetPacking(doc,result);
  expect(separate.sheetCount).toBe(2);
  checked(doc,separate);
});

test('can use a permitted rotation to fit the finite plate length',()=>{
  const part={...rectangle(2,5,'turnable'),rotations:{kind:'discrete' as const,degrees:[0,90]}};
  const {doc,result}=fixture([part],5,2,[0]);
  expect(()=>packResultIntoSheets(doc,result)).toThrow('plaka uzunluğuna sığmıyor');
  const packed=improveSheetPacking(doc,result);
  expect(packed.sheetCount).toBe(1);
  expect(packed.placements[0].angleDeg).toBe(90);
  checked(doc,packed);
  doc.parts[0].rotations={kind:'discrete',degrees:[0]};
  expect(()=>improveSheetPacking(doc,result)).toThrow('izin verilen dönüşlerle');
});

test('keeps per-copy manual angles while moving copies between plates',()=>{
  const part={...rectangle(3,7,'locked'),quantity:2};
  const {doc,result}=fixture([part],7,6,[0]);
  result.placements=result.placements.map(p=>({...p,xMm:7,angleDeg:90,fixedAngleDeg:90}));
  const packed=improveSheetPacking(doc,result);
  expect(packed.sheetCount).toBe(1);
  expect(packed.placements.every(p=>p.angleDeg===90&&p.fixedAngleDeg===90)).toBe(true);
  checked(doc,packed);
});

test('checks attached DXF geometry rather than just the selected main contour',()=>{
  const part=rectangle(1,1,'detail');
  part.source={format:'dxf',dxfDetails:[{layer:'CUT',ring:[[0,0],[3,0],[3,1],[0,1]]}]};
  const {doc,result}=fixture([part],2,2,[0]);
  expect(()=>improveSheetPacking(doc,result)).toThrow('izin verilen dönüşlerle');
});

test('returns the complete original packing when the search budget is exhausted',()=>{
  const {doc,result}=fixture([6,6,4,4].map((h,i)=>rectangle(1,h,`p${i}`)),20,10,[0,7,14,19]);
  const baseline=packResultIntoSheets(doc,result),packed=improveSheetPacking(doc,result,{timeLimitMs:0});
  expect(packed.placements).toEqual(baseline.placements);
  expect(packed.sheetCount).toBe(baseline.sheetCount);
  checked(doc,packed);
});

test('backfills earlier plates for a production-size batch without dropping copies',()=>{
  const part={...rectangle(100,100,'batch'),quantity:50};
  const {doc,result}=fixture([part],500,500,[0]);
  result.placements.forEach((p,i)=>{p.yMm=i*110;});
  const packed=improveSheetPacking(doc,result,{timeLimitMs:1000});
  expect(packed.sheetCount).toBe(2);
  checked(doc,packed);
});

test.each(['right-bottom','right-top'] as const)('reflows an already single plate in physical right-to-left rows from %s',startCorner=>{
  const part={...rectangle(2,2,'rows'),quantity:6};
  const {doc,result}=fixture([part],4,6,[0]);
  doc.settings.startCorner=startCorner;
  result.sheetCount=1;result.usedLengthMm=6;
  result.placements.forEach((placement,index)=>{
    placement.xMm=Math.floor(index/3)*2;placement.yMm=(index%3)*2;placement.sheetIndex=0;
  });
  const before=structuredClone({doc,result}),packed=arrangeSheetRows(doc,result);
  expect(packed.sheetCount).toBe(1);
  packed.placements.forEach((placement,index)=>{
    expect(placement.xMm).toBeCloseTo(index%2===0?2:0);
    expect(placement.yMm).toBeCloseTo(startCorner==='right-bottom'?Math.floor(index/2)*2:4-Math.floor(index/2)*2);
  });
  checked(doc,packed);
  expect({doc,result}).toEqual(before);
});

test('does not trade a dense interlocking one-plate result for extra directional sheets',()=>{
  const l={...newPart([[0,0],[6,0],[6,2],[2,2],[2,6],[0,6]],'L'),id:'L',rotations:{kind:'discrete' as const,degrees:[0]}};
  const {doc,result}=fixture([l,rectangle(4,4,'insert')],6,6,[0,7]);
  const nested=improveSheetPacking(doc,result),packed=arrangeSheetRows(doc,nested);
  expect(packed.sheetCount).toBe(1);
  checked(doc,packed);
  expect(arrangeSheetRows(doc,nested,{timeLimitMs:0})).toBe(nested);
});
