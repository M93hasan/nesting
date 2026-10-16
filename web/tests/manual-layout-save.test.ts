import {describe,expect,it,vi} from 'vitest';
import {createDxfExportCache} from '../src/export/dxfCache';
import {createSerialQueue} from '../src/storage/serialQueue';
import {newPart,type Document} from '../src/model';
import {updatePlacements,documentPlacements} from '../src/geometry/placements';
import {exportDXFOnly} from '../src/export/svg';
import {exportProject,importProject} from '../src/import/project';

const initial=():Document=>({
  name:'Manual nesting',
  settings:{materialWidthMm:1400,clearanceMm:0,timeLimitSeconds:30},
  parts:[newPart([[0,0],[20,0],[20,10],[0,10]],'shoe pattern')]
});

describe('manual nesting coordinates',()=>{
  it('keeps the hand-moved copy in project storage and the exported DXF',()=>{
    const source=initial(),id=source.parts[0].id;
    const moved=updatePlacements(source,[{partId:id,copyIndex:0,xMm:52.75,yMm:19.25,angleDeg:0}]);
    const restored=importProject(exportProject(moved,2)).document;
    expect(documentPlacements(restored)[0]).toMatchObject({xMm:52.75,yMm:19.25});
    const bundle=exportDXFOnly(restored);
    expect(bundle.world[0].outer[0]).toEqual([52.75,19.25]);
    expect(bundle.dxf).toContain('52.75');
    expect(bundle.dxf).toContain('19.25');
  });

  it('does not reuse an in-flight DXF from before a manual move',async()=>{
    const oldLayout=initial(),newLayout=updatePlacements(oldLayout,[{
      partId:oldLayout.parts[0].id,copyIndex:0,xMm:52.75,yMm:19.25,angleDeg:0
    }]);
    const releases=new Map<Document,(value:string)=>void>();
    const exporter=vi.fn(({document}:{document:Document})=>new Promise<string>(resolve=>releases.set(document,resolve)));
    const cache=createDxfExportCache(exporter);
    const oldKey={document:oldLayout,revision:1},newKey={document:newLayout,revision:2};
    const older=cache.get(oldKey),latest=cache.get(newKey);
    await Promise.resolve();
    expect(exporter).toHaveBeenCalledTimes(2);
    releases.get(oldLayout)!('old positions');
    releases.get(newLayout)!('new positions');
    expect(await older).toBe('old positions');
    expect(await latest).toBe('new positions');
    expect(await cache.get(newKey)).toBe('new positions');
    expect(exporter).toHaveBeenCalledTimes(2);
  });

  it('sends cloud writes serially and retries even after a failed save',async()=>{
    const enqueue=createSerialQueue();
    const order:string[]=[];
    let finishOld!:()=>void;
    const first=enqueue(async()=>{order.push('old start');await new Promise<void>(resolve=>{finishOld=resolve;});order.push('old end');throw Error('offline');});
    const second=enqueue(async()=>{order.push('new start');return 'saved';});
    await Promise.resolve();
    expect(order).toEqual(['old start']);
    finishOld();
    await expect(first).rejects.toThrow('offline');
    await expect(second).resolves.toBe('saved');
    expect(order).toEqual(['old start','old end','new start']);
  });
});
