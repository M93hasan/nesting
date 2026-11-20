import { expect, test, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Document } from '../src/model';
import { authorizeCadExport } from '../src/application/use-cases/AuthorizeCadExport';

const document:Document={
  name:'CAD project',
  parts:[{
    id:'p',name:'p',source:{format:'dxf',fileName:'original.dxf'},
    outer:[[0,0],[10,0],[10,10],[0,10]],holes:[],
    quantity:1,rotations:{kind:'discrete',degrees:[0,180]},approximationToleranceMm:0,preparationPosition:[0,0],
  }],
  settings:DEFAULT_SETTINGS,
};

test('DXF authorization always happens after successful CAD preparation',async()=>{
  const calls:string[]=[];
  const geometry={prepareExport:vi.fn(async()=>{
    calls.push('geometry');return {dxf:'DXF-MM',svg:'<svg/>',world:[]};
  }),importFiles:vi.fn()};
  const authorization={authorize:vi.fn(async()=>{
    calls.push('authorize');
  })};
  const dxf=await authorizeCadExport(geometry,authorization,{
    sourceDocument:document,exportDocument:document,revision:4,runId:7,
    fileName:'original-serula.dxf',unit:'mm',cloudLabel:'Serula Nesting En Temiz Hali',
  });
  expect(dxf).toBe('DXF-MM');
  expect(calls).toEqual(['geometry','authorize']);
  const [projectName,sourceFileName,fileName,content,raw] = authorization.authorize.mock.calls[0];
  expect([projectName,sourceFileName,fileName,content]).toEqual(['CAD project','original.dxf','original-serula.dxf','DXF-MM']);
  expect(JSON.parse(raw)).toMatchObject({name:'CAD project',schemaVersion:1,revision:4,serulaCloud:{ui:{unit:'mm'}}});
});

test('failed geometry validation must not charge credits',async()=>{
  const geometry={prepareExport:vi.fn(async()=>{throw Error('invalid geometry');}),importFiles:vi.fn()};
  const authorization={authorize:vi.fn(async()=>undefined)};
  await expect(authorizeCadExport(geometry,authorization,{
    sourceDocument:document,exportDocument:document,revision:4,runId:7,
    fileName:'export.dxf',unit:'mm',cloudLabel:'label',
  })).rejects.toThrow('invalid geometry');
  expect(authorization.authorize).not.toHaveBeenCalled();
});

test('failed authorization never returns a downloadable DXF',async()=>{
  const geometry={prepareExport:vi.fn(async()=>({dxf:'D',svg:'',world:[]})),importFiles:vi.fn()};
  const authorization={authorize:vi.fn(async()=>{throw Error('no credits');})};
  await expect(authorizeCadExport(geometry,authorization,{
    sourceDocument:document,exportDocument:document,revision:4,runId:7,
    fileName:'export.dxf',unit:'mm',cloudLabel:'label',
  })).rejects.toThrow('no credits');
});
