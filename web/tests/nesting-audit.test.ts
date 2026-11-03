import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {expect,it} from 'vitest';
import {initSync,run as wasmRun} from '../wasm/pkg/sparrow_web';
import {importDXF} from '../src/import/dxf';
import {solverInput} from '../src/import/sparrow';
import {candidateResult} from '../src/workers/useSolver';
import {packResultIntoSheets} from '../src/geometry/multiSheet';
import {netArea,validate,worldParts} from '../src/geometry/validate';
import {exportDXF} from '../src/export/dxf';
import {bounds} from '../src/geometry/normalize';
import {DEFAULT_SETTINGS,type Document,type Result} from '../src/model';
import type {Candidate} from '../src/workers/protocol';

// Run the actual checked-in serial WASM engine, not a simulated layout.
initSync({module:readFileSync(new URL('../wasm/pkg/sparrow_web_bg.wasm',import.meta.url))});
const options={scale:1,tolerance:.01,enclosed:'holes' as const};
type Rectangle={x:number;y:number;width:number;height:number;layer?:string};
const rectangle=({x,y,width,height,layer='CUT'}:Rectangle)=>[
  '0','LWPOLYLINE','8',layer,'90','4','70','1',
  ...[[x,y],[x+width,y],[x+width,y+height],[x,y+height]].flatMap(([px,py])=>['10',String(px),'20',String(py)])
].join('\n')+'\n';
const asciiDxf=(entities:string)=>[
  '0','SECTION','2','HEADER','9','$INSUNITS','70','4','0','ENDSEC',
  '0','SECTION','2','ENTITIES',entities.trimEnd(),'0','ENDSEC','0','EOF'
].join('\n')+'\n';
const log=(event:string,values:Record<string,unknown>)=>console.log('NESTING_QA '+JSON.stringify({event,...values}));

it('round-trips two DXF copies and their holes through independent validation and export',()=>{
  const input=asciiDxf(rectangle({x:0,y:0,width:80,height:50})+rectangle({x:20,y:10,width:15,height:12,layer:'INNER'}));
  const imported=importDXF(input,'qa-hole.dxf',options);
  expect(imported.issues??[]).toEqual([]);
  expect(imported.document.parts).toHaveLength(1);
  expect(imported.document.parts[0].holes).toHaveLength(1);
  const doc:Document={...imported.document,settings:{...DEFAULT_SETTINGS,materialWidthMm:200,clearanceMm:1},parts:imported.document.parts.map(p=>({...p,quantity:2}))};
  const p=doc.parts[0];
  const result:Result={documentRevision:1,solverRevision:'qa',seed:'42',elapsedSeconds:0,usedLengthMm:120,
    placements:[{partId:p.id,copyIndex:0,xMm:0,yMm:0,angleDeg:0},{partId:p.id,copyIndex:1,xMm:100,yMm:0,angleDeg:0}],
    validation:{status:'pending',overlapAreaMm2:0,maxBoundaryViolationMm:0,minClearanceMm:null,errors:[]}};
  const checked=validate(doc,result);
  expect(checked.status).toBe('passed');
  const serialized=exportDXF(doc,worldParts(doc,result),result.placements,true);
  const importedAgain=importDXF(serialized,'qa-export.dxf',options);
  expect(importedAgain.issues??[]).toEqual([]);
  expect(importedAgain.document.parts).toHaveLength(2);
  expect(importedAgain.document.parts.every(part=>part.holes.length===1)).toBe(true);
  expect(importedAgain.document.parts.map(p=>[bounds(p.outer)[2]-bounds(p.outer)[0],bounds(p.outer)[3]-bounds(p.outer)[1]]))
    .toEqual([[80,50],[80,50]]);
  log('dxf-roundtrip',{inputBytes:Buffer.byteLength(input),exportBytes:Buffer.byteLength(serialized),copies:2,holes:2,validation:checked.status});
});

for(const count of [64,256,500])it('measures DXF import performance for '+count+' contour entities',()=>{
  const text=asciiDxf(Array.from({length:count},(_,i)=>rectangle({x:(i%25)*12,y:Math.floor(i/25)*12,width:8,height:6})).join(''));
  const memBefore=process.memoryUsage();
  const started=performance.now();
  const imported=importDXF(text,'qa-'+count+'.dxf',options);
  const ms=performance.now()-started;
  const memAfter=process.memoryUsage();
  expect(imported.issues??[]).toEqual([]);
  expect(imported.document.parts).toHaveLength(count);
  expect(imported.document.parts.reduce((n,p)=>n+p.quantity,0)).toBe(count);
  expect(imported.document.parts.every(p=>p.outer.length===4&&p.holes.length===0)).toBe(true);
  log('dxf-scale',{entities:count,bytes:Buffer.byteLength(text),durationMs:Number(ms.toFixed(2)),rssBeforeBytes:memBefore.rss,rssAfterBytes:memAfter.rss,heapDeltaBytes:memAfter.heapUsed-memBefore.heapUsed});
},120000);

it('measures genuine WASM waste across three seeds and two DXF part orders',()=>{
  const shapes=[
    {x:0,y:0,width:35,height:25},
    {x:120,y:0,width:45,height:20},
    {x:240,y:0,width:25,height:30},
    {x:360,y:0,width:50,height:15},
  ];
  const measurements:Record<string,unknown>[]=[];
  for(const order of ['forward','reversed'] as const){
    const list=order==='forward'?shapes:[...shapes].reverse();
    const dxf=asciiDxf(list.map(shape=>rectangle(shape)).join(''));
    const review=importDXF(dxf,'qa-'+order+'.dxf',options);
    expect(review.issues??[]).toEqual([]);
    expect(review.document.parts).toHaveLength(4);
    const doc:Document={...review.document,name:'QA-'+order,
      settings:{...DEFAULT_SETTINGS,materialType:'roll',materialWidthMm:80,clearanceMm:1,solverPreset:'fast',timeLimitSeconds:10},
      parts:review.document.parts.map(part=>({...part,rotations:{kind:'discrete' as const,degrees:[0,180]}}))};
    const input=solverInput(doc);
    const netAreaMm2=doc.parts.reduce((total,part)=>total+netArea(part)*part.quantity,0);
    for(const seed of ['42','99','2026']){
      let reported=0;
      let best:Result|undefined;
      let firstValidMs:number|undefined;
      const before=performance.now();
      wasmRun(input,10,seed,doc.settings.clearanceMm,'fast',(json:string)=>{
        const raw=JSON.parse(json) as Candidate;
        if(raw.type!=='candidate'&&raw.type!=='live')return;
        reported++;
        if(raw.solution?.layout?.placed_items?.length!==4)return;
        try{
          const candidate={...raw,documentRevision:1,sequence:reported} as Candidate;
          const result=packResultIntoSheets(doc,candidateResult(doc,candidate,seed));
          if(validate(doc,result).status!=='passed')return;
          firstValidMs??=performance.now()-before;
          if(!best||result.usedLengthMm<best.usedLengthMm)best=result;
        }catch{/* A candidate that failed independent validation is never counted as valid. */}
      });
      const elapsedMs=performance.now()-before;
      expect(best,'No valid WASM candidate for '+order+'/'+seed+'; reports='+reported).toBeDefined();
      const usedLengthMm=best!.usedLengthMm;
      const efficiencyPct=100*netAreaMm2/(doc.settings.materialWidthMm*usedLengthMm);
      const row={order,seed,partCount:4,netAreaMm2,stripWidthMm:doc.settings.materialWidthMm,
        usedLengthMm:Number(usedLengthMm.toFixed(4)),efficiencyPct:Number(efficiencyPct.toFixed(3)),
        wastePct:Number((100-efficiencyPct).toFixed(3)),durationMs:Number(elapsedMs.toFixed(2)),
        firstValidMs:Number(firstValidMs?.toFixed(2)),candidatesReported:reported,validation:'passed'};
      measurements.push(row);log('seed-order',row);
    }
  }
  expect(measurements).toHaveLength(6);
  const byOrder=Object.fromEntries(['forward','reversed'].map(order=>{
    const rows=measurements.filter(row=>row.order===order);
    const densities=rows.map(row=>Number(row.efficiencyPct));
    return [order,{minEfficiencyPct:Math.min(...densities),maxEfficiencyPct:Math.max(...densities),
      rangePctPoints:Number((Math.max(...densities)-Math.min(...densities)).toFixed(3))}];
  }));
  log('seed-order-summary',{samples:measurements.length,byOrder});
},120000);
