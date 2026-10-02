import {expect,test} from 'vitest';
import {candidateResult} from '../src/workers/useSolver';
import {friendlyInitialPlacementError,preflightSolverFit,solverCopies,solverInput} from '../src/import/sparrow';
import {newPart,type Document} from '../src/model';
import type {Candidate} from '../src/workers/protocol';

test('multiple copies are sent as independent demand-one items and decode to stable copy indices',()=>{
  const part={...newPart([[0,0],[10,0],[10,10],[0,10]],'curve'),id:'curve',quantity:3};
  const doc:Document={name:'copies',parts:[part],settings:{materialWidthMm:100,clearanceMm:.3,timeLimitSeconds:30}};
  expect(solverCopies(doc)).toEqual([
    {itemId:0,partId:'curve',copyIndex:0},
    {itemId:1,partId:'curve',copyIndex:1},
    {itemId:2,partId:'curve',copyIndex:2},
  ]);
  const input=JSON.parse(solverInput(doc)) as {items:{id:number;demand:number}[]};
  expect(input.items.map(item=>[item.id,item.demand])).toEqual([[0,1],[1,1],[2,1]]);

  const candidate:Candidate={type:'candidate',runId:1,documentRevision:1,sequence:1,report:'ExplFeas',elapsedMs:10,
    solution:{strip_width:30,layout:{placed_items:[
      {item_id:2,transformation:{rotation:0,translation:[20,0]}},
      {item_id:0,transformation:{rotation:0,translation:[0,0]}},
      {item_id:1,transformation:{rotation:0,translation:[10,0]}},
    ]}}};
  const result=candidateResult(doc,candidate,'1');
  expect(result.placements.map(p=>[p.partId,p.copyIndex])).toEqual([
    ['curve',2],['curve',0],['curve',1]
  ]);
});


test('restricted rotations stay restricted and preflight reports a part that cannot fit material width',()=>{
  const part={...newPart([[0,0],[1500,0],[1500,100],[0,100]],'Upper'),id:'upper',quantity:1,rotations:{kind:'discrete' as const,degrees:[0,180]}};
  const doc:Document={name:'restricted',parts:[part],settings:{materialWidthMm:1400,clearanceMm:.3,timeLimitSeconds:30}};
  expect(()=>preflightSolverFit(doc)).toThrow('Upper seçilen dönüş kuralıyla 1400 mm malzeme genişliğine sığmıyor');
  expect(()=>solverInput(doc)).toThrow('İzin verilen açılar: 0°, 180°');
});

test('a permitted 90 degree rotation can fit without broadening the rotation rule',()=>{
  const part={...newPart([[0,0],[1500,0],[1500,100],[0,100]],'Upper'),id:'upper',quantity:1,rotations:{kind:'discrete' as const,degrees:[90]}};
  const doc:Document={name:'restricted-fit',parts:[part],settings:{materialWidthMm:1400,clearanceMm:.3,timeLimitSeconds:30}};
  expect(()=>preflightSolverFit(doc)).not.toThrow();
  const input=JSON.parse(solverInput(doc)) as {min_item_separation:number;items:{orientation:{rotation:{mode:string;angles:number[]}}}[]};
  expect(input.min_item_separation).toBe(.3);
  expect(input.items[0].orientation.rotation).toEqual({mode:'discrete',angles:[-90]});
});

test('initial placement errors identify the real part copy instead of raw solver item id',()=>{
  const a={...newPart([[0,0],[10,0],[10,10],[0,10]],'A'),id:'a',quantity:2};
  const b={...newPart([[0,0],[10,0],[10,10],[0,10]],'B'),id:'b',quantity:2};
  const doc:Document={name:'names',parts:[a,b],settings:{materialWidthMm:100,clearanceMm:0,timeLimitSeconds:30}};
  expect(friendlyInitialPlacementError(doc,'No valid initial placement could be constructed for item 3. Review the part size.'))
    .toContain('B — Kopya 2');
});
