import {expect,it} from 'vitest';
import {newPart,type Document} from '../src/model';
import {captureClipboard,pasteClipboard} from '../src/geometry/clipboard';
import {removeCopies,documentPlacements} from '../src/geometry/placements';

const part=newPart([[0,0],[20,0],[20,10],[0,10]],'Kesim');
part.source={format:'dxf',fileName:'test.dxf',dxfSourceEntityCount:1,
  dxfEntities:[{kind:'polyline',points:[[0,0],[20,0],[20,10],[0,10]],closed:true,sourceType:'LWPOLYLINE',layer:'CUT'}]};
const initial:Document={name:'test',settings:{materialWidthMm:1400,clearanceMm:0,timeLimitSeconds:30},parts:[part]};
const refs=[{partId:part.id,copyIndex:0}];

it('copies selected DXF pieces with original native geometry and new positions',()=>{
  const items=captureClipboard(initial,refs);
  const result=pasteClipboard(initial,items,15);
  expect(result.document.parts).toHaveLength(1);
  expect(result.document.parts[0].quantity).toBe(2);
  expect(result.document.parts[0].source.dxfEntities).toEqual(part.source.dxfEntities);
  expect(result.selection).toEqual([{partId:part.id,copyIndex:1}]);
  expect(documentPlacements(result.document).map(p=>[p.xMm,p.yMm])).toEqual([[0,0],[15,15]]);
});

it('cuts and re-pastes the only copy without changing exact position or part definition',()=>{
  const items=captureClipboard(initial,refs);
  const cut=removeCopies(initial,refs);
  expect(cut.parts[0].quantity).toBe(0);
  const restored=pasteClipboard(cut,items,0);
  expect(restored.document.parts[0].quantity).toBe(1);
  expect(restored.document.parts[0].source.dxfEntities).toEqual(part.source.dxfEntities);
  expect(documentPlacements(restored.document)[0].xMm).toBe(0);
});

it('keeps a clipboard snapshot usable when pasting into another project',()=>{
  const items=captureClipboard(initial,refs);
  const result=pasteClipboard({...initial,parts:[]},items,0);
  expect(result.document.parts).toHaveLength(1);
  expect(result.document.parts[0].id).not.toBe(part.id);
  expect(result.document.parts[0].source.dxfEntities).toEqual(part.source.dxfEntities);
});
