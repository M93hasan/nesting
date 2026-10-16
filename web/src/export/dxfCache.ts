import type {Document,Result} from '../model';

export type DxfExportKey={document:Document;result?:Result;revision:number};
type Completed=DxfExportKey & {dxf:string};
type Running=DxfExportKey & {work:Promise<string>};
const same=(a:DxfExportKey,b:DxfExportKey)=>
  a.document===b.document && a.result===b.result && a.revision===b.revision;

/** Cache/dedupe only an identical layout snapshot, never the previous drag. */
export function createDxfExportCache(exporter:(key:DxfExportKey)=>Promise<string>) {
  let cached:Completed|undefined;
  let running:Running|undefined;
  return {
    get(key:DxfExportKey):Promise<string> {
      if(cached&&same(cached,key))return Promise.resolve(cached.dxf);
      if(running&&same(running,key))return running.work;
      const work=Promise.resolve().then(()=>exporter(key))
        .then(dxf=>{
          if(running?.work===work)cached={...key,dxf};
          return dxf;
        })
        .finally(()=>{if(running?.work===work)running=undefined;});
      running={...key,work};
      return work;
    }
  };
}
