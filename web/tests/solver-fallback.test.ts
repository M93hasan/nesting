import {expect,test} from 'vitest';
import {appendFallbackItems,initialPlacementItemId,removeFallbackItem,type FallbackSolverInput} from '../src/workers/solverFallback';

test('detects Sparrow initial-placement failures and removes only the failing copy',()=>{
  expect(initialPlacementItemId('No valid initial placement could be constructed for item 55. Review the part size.')).toBe(55);
  expect(initialPlacementItemId('RuntimeError: unreachable')).toBeUndefined();
  const input:FallbackSolverInput={strip_height:1400,items:[
    {id:3,demand:1,allowed_orientations:[0,-180],shape:{type:'simple_polygon',data:[[0,0],[10,0],[10,20],[0,20]]}},
    {id:55,demand:1,allowed_orientations:[0,-180],shape:{type:'simple_polygon',data:[[0,0],[273,0],[273,320],[0,320]]}},
  ]};
  const removed=removeFallbackItem(input,55)!;
  expect(removed.item.id).toBe(55);
  expect(removed.input.items.map(item=>item.id)).toEqual([3]);
  expect(input.items.map(item=>item.id)).toEqual([3,55]);
});

test('safe append keeps restricted rotations and places the fallback beyond the optimized strip',()=>{
  const solution={strip_width:500,layout:{placed_items:[{item_id:3,transformation:{rotation:0,translation:[0,0] as [number,number]}}]}};
  const item={id:55,demand:1,allowed_orientations:[0,-180],shape:{type:'simple_polygon' as const,data:[[0,0],[273,0],[273,320],[0,320]] as [number,number][]}};
  const next=appendFallbackItems(solution,[item],1400,.3);
  expect(next.layout.placed_items).toHaveLength(2);
  const fallback=next.layout.placed_items[1];
  expect([0,-180]).toContain(fallback.transformation.rotation);
  expect(fallback.transformation.translation[0]).toBeGreaterThan(500);
  expect(next.strip_width).toBeGreaterThan(773);
});

test('safe append never invents a forbidden rotation to make a part fit',()=>{
  const item={id:9,demand:1,allowed_orientations:[0,180],shape:{type:'simple_polygon' as const,data:[[0,0],[100,0],[100,1500],[0,1500]] as [number,number][]}};
  expect(()=>appendFallbackItems({strip_width:0,layout:{placed_items:[]}},[item],1400,0)).toThrow('does not fit the material width');
});
