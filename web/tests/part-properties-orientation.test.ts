import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {initSync,run as wasmRun} from '../wasm/pkg/sparrow_web';
import {newPart,type Document} from '../src/model';
import {documentPlacements,mirrorPlacements,releasePlacementAngleLocks,rotatePlacements,rotateToNextOrientation,setPlacementAngles,withDocumentPlacements} from '../src/geometry/placements';
import {solverInput} from '../src/import/sparrow';
import {candidateResult} from '../src/workers/useSolver';
import {validate,worldParts} from '../src/geometry/validate';
import {exportDXF} from '../src/export/dxf';
import {exportProject,importProject} from '../src/import/project';
import {safeFullPlateQuantity} from '../src/geometry/fullPlate';
import type {Candidate} from '../src/workers/protocol';

const fixture=():Document=>withDocumentPlacements({
  name:'orientation-qa',
  parts:[{...newPart([[0,0],[20,0],[20,10],[0,10]],'Sole'),id:'sole',quantity:2,
    rotations:{kind:'discrete',degrees:[0,180]}}],
  settings:{materialWidthMm:50,clearanceMm:0,timeLimitSeconds:10},
  placements:[
    {partId:'sole',copyIndex:0,xMm:25,yMm:2,angleDeg:0},
    {partId:'sole',copyIndex:1,xMm:0,yMm:22,angleDeg:0}
  ]
});

const candidate=(rotation:number,second=0):Candidate=>({
  type:'candidate',runId:1,documentRevision:1,sequence:1,report:'ExplFeas',elapsedMs:100,
  solution:{strip_width:45,layout:{placed_items:[
    {item_id:0,transformation:{rotation,translation:[2,25]}},
    {item_id:1,transformation:{rotation:second,translation:[22,0]}}
  ]}}
});

test('manual angle overrides the generic part rotation rule for only the selected copy',()=>{
  const doc=setPlacementAngles(fixture(),[{partId:'sole',copyIndex:0}],90);
  expect(doc.placements?.[0]).toMatchObject({orientationLocked:true,angleDeg:90});
  expect(doc.placements?.[1].orientationLocked).toBeUndefined();
  const input=JSON.parse(solverInput(doc)) as {items:{orientation:{rotation:{mode:string;angles:number[]}}}[]};
  expect(input.items[0].orientation.rotation).toEqual({mode:'discrete',angles:[-90]});
  expect(input.items[1].orientation.rotation).toEqual({mode:'discrete',angles:[0,-180]});
  const accepted=candidateResult(doc,candidate(-90),'42');
  expect(accepted.placements[0].orientationLocked).toBe(true);
  expect(accepted.placements[0].angleDeg).toBe(90);
  expect(validate(doc,accepted).status).toBe('passed');
  const rejected=candidateResult(doc,candidate(0),'42');
  expect(validate(doc,rejected).errors.join(' ')).toMatch(/Manual orientation/);
  const broken={...accepted,placements:accepted.placements.map((p,i)=>i? p:{...p,orientationLocked:undefined})};
  expect(validate(doc,broken).errors.join(' ')).toMatch(/Manual orientation lock/);
  const dxf=exportDXF(doc,worldParts(doc,accepted),accepted.placements,true);
  expect(dxf).toContain('LWPOLYLINE');
});

test('unlocked angles can return to the part rotation choices without changing the geometry',()=>{
  let doc=setPlacementAngles(fixture(),[{partId:'sole',copyIndex:0}],90);
  const before=doc.placements?.[0];
  doc=releasePlacementAngleLocks(doc,[{partId:'sole',copyIndex:0}]);
  expect(doc.placements?.[0].angleDeg).toBe(before?.angleDeg);
  expect(doc.placements?.[0].orientationLocked).toBeUndefined();
  const input=JSON.parse(solverInput(doc)) as {items:{orientation:{rotation:{angles:number[]}}}[]};
  expect(input.items[0].orientation.rotation.angles).toEqual([0,-180]);
});

test('manual left and right rotation commands and keyboard orientation cycling lock the chosen copy',()=>{
  const ref={partId:'sole',copyIndex:1};
  const rotated=rotatePlacements(fixture(),[ref],90,[0,0]);
  expect(rotated.placements?.[1].orientationLocked).toBe(true);
  expect(rotated.placements?.[0].orientationLocked).toBeUndefined();
  const cycled=rotateToNextOrientation(fixture(),[ref]);
  expect(cycled.placements?.[1]).toMatchObject({orientationLocked:true,angleDeg:180});
});

test('manual mirror is represented in solver geometry and retained on output',()=>{
  const doc=mirrorPlacements(fixture(),[{partId:'sole',copyIndex:0}],'x');
  const input=JSON.parse(solverInput(doc)) as {items:{shape:{data:number[][]}}[]};
  expect(input.items[0].shape.data).not.toEqual(input.items[1].shape.data);
  const result=candidateResult(doc,candidate(0),'9');
  expect(result.placements[0].mirrorX).toBe(true);
  expect(result.placements[1].mirrorX).toBeUndefined();
  expect(validate(doc,result).status).toBe('passed');
  const stripped={...result,placements:result.placements.map((p,i)=>i?p:{...p,mirrorX:undefined})};
  expect(validate(doc,stripped).errors.join(' ')).toMatch(/Mirroring/);
});

test('saved projects keep individual orientation locks and mirror commands',()=>{
  const ref={partId:'sole',copyIndex:0};
  const changed=mirrorPlacements(setPlacementAngles(fixture(),[ref],90),[ref],'x');
  const saved=exportProject(changed,1),restored=importProject(saved).document;
  expect(documentPlacements(restored)[0]).toMatchObject({angleDeg:90,orientationLocked:true,mirrorX:true});
  expect(JSON.parse(solverInput(restored)).items[0].orientation.rotation.angles).toEqual([-90]);
});

test('full plate does not delete another type and caps generated copies conservatively',()=>{
  const initial=fixture();
  const other={...newPart([[0,0],[10,0],[10,10],[0,10]],'Other'),id:'other',quantity:2};
  const sheet:Document={...initial,parts:[{...initial.parts[0],quantity:1},other],
    placements:undefined,settings:{...initial.settings,materialType:'sheet',materialWidthMm:100,materialLengthMm:100,clearanceMm:1}};
  const capacity=safeFullPlateQuantity(sheet,sheet.parts[0]);
  // 20x10 box with 1mm spacing in a 98x98 usable sheet.
  expect(capacity).toBeGreaterThan(1);
  expect(capacity).toBeLessThanOrEqual(500-other.quantity);
  expect(sheet.parts[1].quantity).toBe(2);
  const target={...sheet,parts:sheet.parts.map(part=>part.id==='sole'?{...part,quantity:capacity}:part)};
  expect(target.parts.find(part=>part.id==='other')?.quantity).toBe(2);
  expect(()=>safeFullPlateQuantity({...sheet,settings:{...sheet.settings,materialLengthMm:5}},sheet.parts[0])).toThrow();
});

test('genuine Sparrow WASM honors a forced manual angle on a nested DXF-style part',()=>{
  initSync({module:readFileSync(new URL('../wasm/pkg/sparrow_web_bg.wasm',import.meta.url))});
  const part={...newPart([[0,0],[22,0],[22,12],[0,12]],'DXF cut'),id:'native',quantity:1,
    source:{format:'dxf' as const,fileName:'fixture.dxf'},rotations:{kind:'discrete' as const,degrees:[0,180]}};
  const initial:Document={name:'Manual DXF direction',parts:[part],settings:{materialWidthMm:20,clearanceMm:0,timeLimitSeconds:10,solverPreset:'fast'}};
  const doc=setPlacementAngles(initial,[{partId:'native',copyIndex:0}],90);
  const input=solverInput(doc);
  const old=globalThis.postMessage;
  globalThis.postMessage=()=>{};
  let matched=false,seen=0;
  try{
    wasmRun(input,5,'42',0,'fast',(json:string)=>{
      const message=JSON.parse(json) as Candidate;
      if(message.type!=='candidate')return;
      seen++;
      const result=candidateResult(doc,{...message,documentRevision:1},'42');
      if(validate(doc,result).status==='passed'&&Math.abs(((result.placements[0].angleDeg-90)%360+540)%360-180)<.0001)
        matched=true;
    });
  }finally{globalThis.postMessage=old;}
  expect(matched,`Expected validated 90° WASM layout; reported candidates ${seen}`).toBe(true);
},120000);
