import {SOLVER_REVISION,type Document,type Result} from '../model';
import type {Candidate} from './protocol';
import {solverCopies} from '../import/sparrow';
import {documentPlacements,placementKey} from '../geometry/placements';

export function candidateResult(doc:Document,candidate:Candidate,seed:string):Result {
  if(doc.settings.materialType==='sheet'&&candidate.sheetResult)return {...candidate.sheetResult,documentRevision:candidate.documentRevision,solverRevision:SOLVER_REVISION,seed};
  const copies=solverCopies(doc);
  const fixedAngles=new Map(documentPlacements(doc).filter(p=>p.fixedAngleDeg!==undefined).map(p=>[placementKey(p),p.fixedAngleDeg!]));
  return {documentRevision:candidate.documentRevision,solverRevision:SOLVER_REVISION,seed,
    elapsedSeconds:candidate.elapsedMs/1000,usedLengthMm:candidate.solution.strip_width,
    placements:candidate.solution.layout.placed_items.map(p=>{
      if(p.transformation.reflected)throw Error('Solver returned a reflected part, but Serula reflection is disabled.');
      const copy=copies[p.item_id],partId=copy?.partId ?? `unknown:${p.item_id}`,copyIndex=copy?.copyIndex ?? 0;
      // solverInput transposes the solver geometry. Swap the translation axes
      // back and invert the solver rotation so the original DXF orientation is
      // preserved while nesting advances down the material length.
      const rawY=p.transformation.translation[0],sheetLength=doc.settings.materialLengthMm;
      const sheetIndex=doc.settings.materialType==='sheet'&&candidate.report==='SheetFeas'&&sheetLength
        ? Math.max(0,Math.floor((rawY+1e-7)/sheetLength)) : undefined;
      const yMm=sheetIndex===undefined?rawY:rawY-sheetIndex*sheetLength!;
      const fixedAngleDeg=fixedAngles.get(placementKey({partId,copyIndex}));
      return {partId,copyIndex,xMm:p.transformation.translation[1],yMm,angleDeg:-p.transformation.rotation,...(fixedAngleDeg===undefined?{}:{fixedAngleDeg}),...(sheetIndex===undefined?{}:{sheetIndex})};
    }), validation:{status:'pending',overlapAreaMm2:0,maxBoundaryViolationMm:0,minClearanceMm:null,errors:[]}};
}
