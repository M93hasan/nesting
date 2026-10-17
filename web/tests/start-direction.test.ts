import {expect,test} from 'vitest';
import {DEFAULT_SETTINGS,newPart,type Document,type Part,type Placement,type Result} from '../src/model';
import {bounds} from '../src/geometry/normalize';
import {orientToStartCorner} from '../src/geometry/startDirection';
import {collisionWorldRings,validate} from '../src/geometry/validate';

function rectangle(id:string,width=2,height=1):Part{
  return {...newPart([[0,0],[width,0],[width,height],[0,height]],id),id,
    rotations:{kind:'discrete',degrees:[0]}};
}
function fixture(parts:Part[],placements:Placement[],settings:Partial<Document['settings']>={}){
  const doc:Document={name:'row direction',parts,settings:{...DEFAULT_SETTINGS,
    materialType:'sheet',materialWidthMm:6,materialLengthMm:8,...settings}};
  const result:Result={documentRevision:7,solverRevision:'direction-test',seed:'42',elapsedSeconds:3,
    usedLengthMm:doc.settings.materialLengthMm??8,sheetCount:1,placements,
    validation:{status:'pending',overlapAreaMm2:0,maxBoundaryViolationMm:0,minClearanceMm:null,errors:[]}};
  return {doc,result};
}
function world(doc:Document,result:Result){
  return new Map(collisionWorldRings(doc,result).map((ring,i)=>[
    `${result.placements[i].partId}:${result.placements[i].copyIndex}`,bounds(ring)]));
}
function expectStable(doc:Document,result:Result){
  const again=orientToStartCorner(doc,result);
  again.placements.forEach((placement,i)=>{
    expect(placement.xMm).toBeCloseTo(result.placements[i].xMm,10);
    expect(placement.yMm).toBeCloseTo(result.placements[i].yMm,10);
    expect({...placement,xMm:0,yMm:0}).toEqual({...result.placements[i],xMm:0,yMm:0});
  });
}

test.each(['right-bottom','right-top'] as const)('starts each of three rows at the right and continues %s',startCorner=>{
  const parts=Array.from({length:6},(_,i)=>rectangle(`p${i}`));
  // Physical rows and their left-to-right order intentionally oppose document order.
  const placements=parts.map((part,i)=>({partId:part.id,copyIndex:0,
    xMm:i%2?0:3,yMm:(2-Math.floor(i/2))*2,angleDeg:0,sheetIndex:0}));
  const {doc,result}=fixture(parts,placements,{startCorner,materialWidthMm:6,materialLengthMm:8});
  const before=structuredClone({doc,result}),packed=orientToStartCorner(doc,result),boxes=world(doc,packed);
  for(let row=0;row<3;row++){
    const first=boxes.get(`p${row*2}:0`)!,second=boxes.get(`p${row*2+1}:0`)!;
    expect(first[2]).toBeCloseTo(6);
    expect(second[2]).toBeCloseTo(first[0]);
    expect(first[1]).toBeCloseTo(startCorner==='right-bottom'?row:7-row);
    expect(second[1]).toBeCloseTo(first[1]);
  }
  expect(validate(doc,packed)).toMatchObject({status:'passed',errors:[]});
  expect({doc,result}).toEqual(before);
  expect({...packed,placements:[]}).toEqual({...result,placements:[]});
  expectStable(doc,packed);
  const shuffled=orientToStartCorner(doc,{...result,placements:[...placements].reverse()});
  expect(world(doc,shuffled)).toEqual(boxes);
});

test('separates rows and blocks at exactly the requested positive clearance',()=>{
  const part={...rectangle('copy'),quantity:4};
  const {doc,result}=fixture([part],[0,1,2,3].map(copyIndex=>({partId:part.id,copyIndex,
    xMm:copyIndex%2?0:2.5,yMm:Math.floor(copyIndex/2)*1.5,angleDeg:0,sheetIndex:0})),
  {materialWidthMm:4.5,materialLengthMm:2.5,clearanceMm:.5});
  const packed=orientToStartCorner(doc,result),boxes=world(doc,packed);
  expect(boxes.get('copy:0')).toEqual([2.5,0,4.5,1]);
  expect(boxes.get('copy:1')).toEqual([0,0,2,1]);
  expect(boxes.get('copy:2')).toEqual([2.5,1.5,4.5,2.5]);
  expect(validate(doc,packed)).toMatchObject({status:'passed',minClearanceMm:.5});
  expectStable(doc,packed);
});

test('keeps an asymmetric interlocking group rigid without adding a plate or changing its angles',()=>{
  const l={...newPart([[0,0],[6,0],[6,2],[2,2],[2,6],[0,6]],'L'),id:'L',
    rotations:{kind:'discrete' as const,degrees:[0]}};
  const insert=rectangle('insert',4,4);
  const {doc,result}=fixture([l,insert],[
    {partId:'L',copyIndex:0,xMm:1,yMm:1,angleDeg:0,sheetIndex:0},
    {partId:'insert',copyIndex:0,xMm:3,yMm:3,angleDeg:0,sheetIndex:0},
  ],{materialWidthMm:8,materialLengthMm:9,startCorner:'right-top'});
  const packed=orientToStartCorner(doc,result),[a,b]=packed.placements;
  expect(b.xMm-a.xMm).toBe(2);expect(b.yMm-a.yMm).toBe(2);
  expect(packed.sheetCount).toBe(1);expect(packed.usedLengthMm).toBe(9);
  expect(validate(doc,packed)).toMatchObject({status:'passed',errors:[]});
  expectStable(doc,packed);
});

test('accounts for attached DXF contours and mirrored fixed-angle geometry',()=>{
  const part=rectangle('detail',2,1);
  part.source={format:'dxf',dxfDetails:[{layer:'ALLOWANCE',ring:[[0,0],[3,0],[3,1],[0,1]]}]};
  const second={...rectangle('mirror',2,1),quantity:1};
  const {doc,result}=fixture([part,second],[
    {partId:'detail',copyIndex:0,xMm:0,yMm:0,angleDeg:0,sheetIndex:0},
    {partId:'mirror',copyIndex:0,xMm:2,yMm:4,angleDeg:37,fixedAngleDeg:37,mirrorX:true,mirrorY:false,sheetIndex:0},
  ],{materialWidthMm:9,materialLengthMm:8,startCorner:'right-top',clearanceMm:.3});
  const packed=orientToStartCorner(doc,result),boxes=[...world(doc,packed).values()];
  expect(boxes[0][2]).toBeCloseTo(9);expect(boxes[0][3]).toBeCloseTo(8);
  expect(boxes[1][2]).toBeCloseTo(9);expect(boxes[1][3]).toBeCloseTo(boxes[0][1]-.3);
  expect(packed.placements[1]).toMatchObject({angleDeg:37,fixedAngleDeg:37,mirrorX:true,mirrorY:false});
  expect(validate(doc,packed)).toMatchObject({status:'passed',errors:[]});
  expectStable(doc,packed);
});

test('moves unequal-height rows as rigid groups and restarts the right edge on every plate',()=>{
  const first={...rectangle('first',2,3),quantity:2},second={...rectangle('second',1,1),quantity:2};
  const {doc,result}=fixture([first,second],[
    {partId:'first',copyIndex:0,xMm:0,yMm:0,angleDeg:0,sheetIndex:0},
    {partId:'second',copyIndex:0,xMm:3,yMm:1,angleDeg:0,sheetIndex:0},
    {partId:'first',copyIndex:1,xMm:0,yMm:0,angleDeg:0,sheetIndex:1},
    {partId:'second',copyIndex:1,xMm:1,yMm:4,angleDeg:0,sheetIndex:1},
  ],{materialWidthMm:6,materialLengthMm:8,startCorner:'right-top',clearanceMm:.2});
  result.sheetCount=2;result.usedLengthMm=16;
  const packed=orientToStartCorner(doc,result),boxes=world(doc,packed);
  expect(boxes.get('first:0')![2]).toBeCloseTo(6);
  expect(boxes.get('second:0')![3]-boxes.get('first:0')![1]).toBeCloseTo(2);
  expect(boxes.get('first:1')![2]).toBeCloseTo(6);
  expect(boxes.get('second:1')![2]).toBeCloseTo(6);
  expect(packed.placements.map(p=>p.sheetIndex)).toEqual([0,0,1,1]);
  expect(packed.sheetCount).toBe(2);expect(packed.usedLengthMm).toBe(16);
  expect(validate(doc,packed)).toMatchObject({status:'passed',errors:[]});
  expectStable(doc,packed);
});

test('keeps a bridge across apparent rows and its separated neighbouring contours together',()=>{
  const bridge=rectangle('bridge',1,4),low=rectangle('low',1,1),high=rectangle('high',1,1);
  const {doc,result}=fixture([bridge,low,high],[
    {partId:'bridge',copyIndex:0,xMm:0,yMm:0,angleDeg:0,sheetIndex:0},
    {partId:'low',copyIndex:0,xMm:2,yMm:0,angleDeg:0,sheetIndex:0},
    {partId:'high',copyIndex:0,xMm:2,yMm:3,angleDeg:0,sheetIndex:0},
  ],{clearanceMm:.2});
  const packed=orientToStartCorner(doc,result),boxes=world(doc,packed);
  expect(boxes.get('bridge:0')).toEqual([5,0,6,4]);
  expect(boxes.get('high:0')![1]-boxes.get('low:0')![1]).toBe(3);
  expect(boxes.get('high:0')![0]).toBe(boxes.get('low:0')![0]);
  expect(validate(doc,packed)).toMatchObject({status:'passed',errors:[]});
  expectStable(doc,packed);
});

test('uses physical horizontal rows on a wide 1400x670 plate',()=>{
  const part={...rectangle('wide',300,200),quantity:4};
  const {doc,result}=fixture([part],[0,1,2,3].map(copyIndex=>({partId:part.id,copyIndex,
    xMm:copyIndex%2?0:400,yMm:Math.floor(copyIndex/2)*300,angleDeg:0,sheetIndex:0})),
  {materialWidthMm:1400,materialLengthMm:670});
  const packed=orientToStartCorner(doc,result),boxes=world(doc,packed);
  expect(boxes.get('wide:0')).toEqual([1100,0,1400,200]);
  expect(boxes.get('wide:1')).toEqual([800,0,1100,200]);
  expect(boxes.get('wide:2')).toEqual([1100,200,1400,400]);
  expect(boxes.get('wide:3')).toEqual([800,200,1100,400]);
  expect(validate(doc,packed)).toMatchObject({status:'passed',errors:[]});
  expectStable(doc,packed);
});

test.each(['right-bottom','right-top'] as const)('formats roll rows at %s without changing the optimized used length',startCorner=>{
  const part={...rectangle('roll'),quantity:3};
  const {doc,result}=fixture([part],[0,1,2].map(copyIndex=>({partId:part.id,copyIndex,
    xMm:1,yMm:copyIndex*2,angleDeg:0})),{materialType:'roll',materialWidthMm:5,startCorner});
  result.usedLengthMm=7;delete result.sheetCount;
  const packed=orientToStartCorner(doc,result),boxes=world(doc,packed);
  expect(packed.usedLengthMm).toBe(7);expect(packed).not.toHaveProperty('sheetCount');
  for(let copy=0;copy<3;copy++){
    const box=boxes.get(`roll:${copy}`)!;
    expect(box[2]).toBeCloseTo(5);
    expect(box[1]).toBeCloseTo(startCorner==='right-bottom'?copy:6-copy);
  }
  expect(validate(doc,packed)).toMatchObject({status:'passed',errors:[]});
  expectStable(doc,packed);
});

test('preserves an empty result unchanged',()=>{
  const {doc,result}=fixture([],[]);
  expect(orientToStartCorner(doc,result)).toBe(result);
});
