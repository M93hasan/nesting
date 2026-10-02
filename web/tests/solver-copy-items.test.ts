import {expect,test} from 'vitest';
import {candidateResult} from '../src/workers/useSolver';
import {solverCopies,solverInput} from '../src/import/sparrow';
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
