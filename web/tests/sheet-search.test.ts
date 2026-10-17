import {expect,test} from 'vitest';
import {DEFAULT_SETTINGS,newPart,type Document,type Result} from '../src/model';
import {bounds} from '../src/geometry/normalize';
import {packResultIntoSheets} from '../src/geometry/multiSheet';
import {prepareSheetSearch,restoreSheetSearchResult} from '../src/geometry/sheetSearch';
import {collisionRing,collisionWorldRings,transform,validate} from '../src/geometry/validate';
import {solverInput} from '../src/import/sparrow';

function fixture():Document {
  const part={...newPart([[0,0],[3,0],[3,2],[0,2]],'attached contour'),id:'detail',quantity:2,
    holes:[[[.5,.5],[1,.5],[1,1],[.5,1]]],
    source:{format:'dxf' as const,dxfDetails:[{layer:'CUT',ring:[[2,0],[5,0],[5,1],[2,1]] as [number,number][]}]},
    preparationPosition:[6,7] as [number,number],rotations:{kind:'discrete' as const,degrees:[0,180]}};
  return {name:'finite-axis',parts:[part],settings:{...DEFAULT_SETTINGS,materialType:'sheet',
    materialWidthMm:20,materialLengthMm:10,clearanceMm:.25},placements:[
      {partId:part.id,copyIndex:0,xMm:2,yMm:3,angleDeg:37,fixedAngleDeg:37},
      {partId:part.id,copyIndex:1,xMm:12,yMm:5,angleDeg:180},
    ]};
}

function result(placements:Result['placements'],sheetCount=1,length=20):Result {
  return {documentRevision:4,solverRevision:'test',seed:'42',elapsedSeconds:1,
    usedLengthMm:sheetCount*length,sheetCount,placements,
    validation:{status:'passed',source:'local',overlapAreaMm2:0,maxBoundaryViolationMm:0,minClearanceMm:null,errors:[]}};
}

test('roll and plates whose width does not exceed their length retain their original objects',()=>{
  const doc=fixture(),packed=result([]);
  for(const settings of [
    {...doc.settings,materialType:'roll' as const},
    {...doc.settings,materialWidthMm:10,materialLengthMm:10},
    {...doc.settings,materialWidthMm:9,materialLengthMm:10},
  ]){
    const original={...doc,settings},search=prepareSheetSearch(original);
    expect(search).toEqual({document:original,transposed:false});
    expect(search.document).toBe(original);
    expect(restoreSheetSearchResult(original,packed,search.transposed)).toBe(packed);
  }
});

test('search transposes the complete collision envelope and per-copy angle constraints without changing the document',()=>{
  const original=fixture(),before=structuredClone(original),search=prepareSheetSearch(original);
  expect(search.transposed).toBe(true);
  expect(search.document.settings).toEqual({...original.settings,materialWidthMm:10,materialLengthMm:20});
  const part=search.document.parts[0];
  expect(part).toMatchObject({id:'detail',quantity:2,source:{format:'drawn'},holes:[],
    preparationPosition:[7,6],rotations:{kind:'discrete',degrees:[-0,-180]}});
  expect(part.outer).toEqual(collisionRing(original.parts[0]).map(([x,y])=>[y,x]));
  expect(bounds(part.outer)).toEqual([0,0,2,5]);
  expect(search.document.placements).toEqual([
    {partId:'detail',copyIndex:0,xMm:3,yMm:2,angleDeg:-37,fixedAngleDeg:-37},
    {partId:'detail',copyIndex:1,xMm:5,yMm:12,angleDeg:-180},
  ]);
  const native=JSON.parse(solverInput(search.document));
  expect(native.strip_height).toBeCloseTo(10.52);
  expect(native.items.map((item:{orientation:unknown})=>item.orientation)).toEqual([
    {rotation:{mode:'discrete',angles:[37]}},{rotation:{mode:'discrete',angles:[0,180]}},
  ]);
  for(const item of native.items)expect(item.shape.data).toEqual(collisionRing(original.parts[0]));
  expect(original).toEqual(before);
});

test('continuous rotations remain continuous and stored mirror transforms exchange axes reversibly',()=>{
  const original=fixture();
  original.parts[0].rotations={kind:'continuous'};
  original.placements![0]={...original.placements![0],mirrorX:true,mirrorY:false};
  const search=prepareSheetSearch(original).document;
  expect(search.parts[0].rotations).toEqual({kind:'continuous'});
  expect(search.placements![0]).toMatchObject({mirrorX:false,mirrorY:true});
  const source=transform(collisionRing(original.parts[0]),original.placements![0]);
  const reflected=transform(search.parts[0].outer,search.placements![0]);
  reflected.forEach(([x,y],i)=>{
    expect(x).toBeCloseTo(source[i][1],10);
    expect(y).toBeCloseTo(source[i][0],10);
  });
});

test.each(['right-bottom','right-top'] as const)('restores complete copies and fixed angles at the original %s corner',startCorner=>{
  const original=fixture();original.settings.startCorner=startCorner;
  const before=structuredClone(original),search=prepareSheetSearch(original);
  const packed=packResultIntoSheets(search.document,result([
    {partId:'detail',copyIndex:0,xMm:0,yMm:2,angleDeg:-37,fixedAngleDeg:-37,sheetIndex:0},
    {partId:'detail',copyIndex:1,xMm:5,yMm:15,angleDeg:-180,sheetIndex:0},
  ]));
  expect(validate(search.document,packed)).toMatchObject({status:'passed',errors:[]});
  const source=structuredClone(packed),restored=restoreSheetSearchResult(original,packed,search.transposed);
  expect(restored).toMatchObject({sheetCount:1,usedLengthMm:10,validation:{status:'pending',errors:[]}});
  expect(restored.placements.map(p=>[p.partId,p.copyIndex,p.angleDeg,p.fixedAngleDeg,p.sheetIndex]))
    .toEqual([['detail',0,37,37,0],['detail',1,180,undefined,0]]);
  expect(restored.placements[1]).not.toHaveProperty('fixedAngleDeg');
  expect(validate(original,restored)).toMatchObject({status:'passed',errors:[]});
  const boxes=collisionWorldRings(original,restored).map(bounds);
  expect(Math.max(...boxes.map(b=>b[2]))).toBeCloseTo(20,9);
  if(startCorner==='right-bottom')expect(Math.min(...boxes.map(b=>b[1]))).toBeCloseTo(0,9);
  else expect(Math.max(...boxes.map(b=>b[3]))).toBeCloseTo(10,9);
  const searchRings=collisionWorldRings(search.document,packed),restoredRings=collisionWorldRings(original,restored);
  const dx=restoredRings[0][0][0]-searchRings[0][0][1],dy=restoredRings[0][0][1]-searchRings[0][0][0];
  restoredRings.forEach((ring,i)=>ring.forEach(([x,y],j)=>{
    expect(x).toBeCloseTo(searchRings[i][j][1]+dx,9);
    expect(y).toBeCloseTo(searchRings[i][j][0]+dy,9);
  }));
  expect(packed).toEqual(source);
  expect(original).toEqual(before);
});

test('restores multiple finite sheets without losing their copy identities or indices',()=>{
  const part={...newPart([[0,0],[4,0],[4,2],[0,2]],'batch'),id:'batch',quantity:3,
    rotations:{kind:'discrete' as const,degrees:[0]}};
  const original:Document={name:'two finite sheets',parts:[part],settings:{...DEFAULT_SETTINGS,
    materialType:'sheet',materialWidthMm:8,materialLengthMm:4,startCorner:'right-top'}};
  const search=prepareSheetSearch(original),packed=packResultIntoSheets(search.document,result([
    {partId:'batch',copyIndex:0,xMm:0,yMm:0,angleDeg:0,sheetIndex:0},
    {partId:'batch',copyIndex:1,xMm:2,yMm:4,angleDeg:0,sheetIndex:0},
    {partId:'batch',copyIndex:2,xMm:0,yMm:0,angleDeg:0,sheetIndex:1},
  ],2,8));
  expect(validate(search.document,packed).status).toBe('passed');
  const restored=restoreSheetSearchResult(original,packed,search.transposed);
  expect(restored.sheetCount).toBe(2);
  expect(restored.usedLengthMm).toBe(8);
  expect(restored.placements.map(p=>[p.copyIndex,p.sheetIndex])).toEqual([[0,0],[1,0],[2,1]]);
  expect(validate(original,restored)).toMatchObject({status:'passed',errors:[]});
  expect(restored.validation.status).toBe('pending');
});
