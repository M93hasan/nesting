import { expect, test, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Document } from '../src/model';
import { prepareLayoutDocument } from '../src/application/use-cases/PrepareLayoutDocument';
import { WorkerLayoutPreparation } from '../src/infrastructure/cad/WorkerLayoutPreparation';
import type { GeometryRequest, GeometryReply } from '../src/workers/protocol';

const document: Document = {
  name:'shop',settings:DEFAULT_SETTINGS,
  parts:[{
    id:'p',name:'p',source:{format:'drawn'},outer:[[0,0],[10,0],[10,10],[0,10]],
    holes:[],quantity:1,approximationToleranceMm:0,rotations:{kind:'discrete',degrees:[0,180]},
    preparationPosition:[10,20],
  }],
  placements:[{partId:'p',copyIndex:0,xMm:16,yMm:25,angleDeg:180,mirrorX:true}],
};

test('preparation use case preserves physical copy offset, rotation and mirroring',async()=>{
  const arranged={...document,parts:document.parts.map(part=>({...part,preparationPosition:[30,50] as [number,number]}))};
  const worker=vi.fn(async(_request:GeometryRequest):Promise<GeometryReply>=>({
    type:'normalized',runId:3,documentRevision:7,document:arranged,
  }));
  const next=await prepareLayoutDocument(new WorkerLayoutPreparation(worker),document,7,3,['p'],true);
  expect(worker).toHaveBeenCalledWith({
    type:'prepare-layout',runId:3,documentRevision:7,document,pinnedIds:['p'],compact:true,
  });
  expect(next.placements).toMatchObject([{partId:'p',copyIndex:0,xMm:36,yMm:55,angleDeg:180,mirrorX:true}]);
  // Canonical document placement owns the part's editable anchor after normalization.
  expect(next.parts[0].preparationPosition).toEqual([36,55]);
  expect(document.parts[0].preparationPosition).toEqual([10,20]);
});

test('preparation must stop when the geometry Worker fails',async()=>{
  const worker=vi.fn(async(_request:GeometryRequest):Promise<GeometryReply>=>({
    type:'error',runId:3,documentRevision:7,message:'invalid',
  }));
  await expect(prepareLayoutDocument(new WorkerLayoutPreparation(worker),document,7,3))
    .rejects.toThrow('Hazırlık çizimi düzenlenemedi.');
});
