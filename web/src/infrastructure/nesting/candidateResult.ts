import { SOLVER_REVISION, type Document, type Result } from '../../model';
import { solverCopies } from '../../import/sparrow';
import type { Candidate } from '../../workers/protocol';

/** Maps Sparrow coordinates into Serula placements without altering geometry. */
export function candidateResult(doc:Document,candidate:Candidate,seed:string):Result {
  const copies=solverCopies(doc);
  const originals=new Map((doc.placements??[]).map(copy=>[`${copy.partId}:${copy.copyIndex}`,copy] as const));
  return {documentRevision:candidate.documentRevision,solverRevision:SOLVER_REVISION,seed:candidate.attemptSeed??seed,
    elapsedSeconds:candidate.elapsedMs/1000,usedLengthMm:candidate.solution.strip_width,
    placements:candidate.solution.layout.placed_items.map(p=>{
      if(p.transformation.reflected)throw Error('Solver returned a reflected part, but Serula reflection is disabled.');
      const copy=copies[p.item_id],partId=copy?.partId ?? `unknown:${p.item_id}`,copyIndex=copy?.copyIndex ?? 0;
      const original=originals.get(`${partId}:${copyIndex}`);
      // solverInput transposes the solver geometry. Swap the translation axes
      // back and invert the solver rotation so the original DXF orientation is
      // preserved while nesting advances down the material length.
      const rawY=p.transformation.translation[0],sheetLength=doc.settings.materialLengthMm;
      const sheetIndex=doc.settings.materialType==='sheet'&&candidate.report==='SheetFeas'&&sheetLength
        ? Math.max(0,Math.floor((rawY+1e-7)/sheetLength)) : undefined;
      const yMm=sheetIndex===undefined?rawY:rawY-sheetIndex*sheetLength!;
      return {partId,copyIndex,xMm:p.transformation.translation[1],yMm,angleDeg:-p.transformation.rotation,
        ...(original?.mirrorX?{mirrorX:true}:{}),...(original?.mirrorY?{mirrorY:true}:{}),
        ...(original?.orientationLocked?{orientationLocked:true}:{}),
        ...(sheetIndex===undefined?{}:{sheetIndex})};
    }), validation:{status:'pending',overlapAreaMm2:0,maxBoundaryViolationMm:0,minClearanceMm:null,errors:[]}};
}
