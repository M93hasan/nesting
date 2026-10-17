import type {Document,Placement,Point,Result} from '../model';
import {packResultIntoSheets} from './multiSheet';
import {collisionRing} from './validate';

// Reflection across x=y changes the search axes without physically rotating a
// part: S R(angle) = R(-angle) S. Reflections exchange their axes as well.
function transposePlacement(placement:Placement):Placement {
  const {fixedAngleDeg,mirrorX,mirrorY,...rest}=placement;
  return {...rest,xMm:placement.yMm,yMm:placement.xMm,angleDeg:-placement.angleDeg,
    ...(fixedAngleDeg===undefined?{}:{fixedAngleDeg:-fixedAngleDeg}),
    ...(mirrorY===undefined?{}:{mirrorX:mirrorY}),
    ...(mirrorX===undefined?{}:{mirrorY:mirrorX})};
}

/** Search along a wide plate's finite length, retaining the normal strip solver. */
export function prepareSheetSearch(original:Document):{document:Document;transposed:boolean} {
  const {materialWidthMm:width,materialLengthMm:length}=original.settings;
  if(original.settings.materialType!=='sheet'||length===undefined||width<=length)
    return {document:original,transposed:false};
  return {transposed:true,document:{...original,
    settings:{...original.settings,materialWidthMm:length,materialLengthMm:width},
    parts:original.parts.map(part=>({...part,
      outer:collisionRing(part).map(([x,y]):Point=>[y,x]),holes:[],source:{format:'drawn'},
      rotations:part.rotations.kind==='discrete'
        ?{kind:'discrete',degrees:part.rotations.degrees.map(angle=>-angle)}
        :{kind:'continuous'},
      preparationPosition:[part.preparationPosition[1],part.preparationPosition[0]]})),
    ...(original.placements===undefined?{}:{placements:original.placements.map(transposePlacement)}),
  }};
}

/** Restore production geometry's coordinate system before normal UI validation. */
export function restoreSheetSearchResult(original:Document,packed:Result,transposed:boolean):Result {
  if(!transposed)return packed;
  return packResultIntoSheets(original,{...packed,
    placements:packed.placements.map(transposePlacement),
    usedLengthMm:original.settings.materialLengthMm!*(packed.sheetCount??1),
    validation:{status:'pending',overlapAreaMm2:0,maxBoundaryViolationMm:0,minClearanceMm:null,errors:[]},
  });
}
