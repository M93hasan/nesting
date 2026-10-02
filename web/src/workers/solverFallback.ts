import type {SolverMessage} from './protocol';

export type FallbackSolverItem={
  id:number;
  demand:number;
  allowed_orientations?:number[];
  shape:{type:'simple_polygon';data:[number,number][]};
};
export type FallbackSolverInput={name?:string;strip_height:number;items:FallbackSolverItem[]};
export type FallbackSolution=Extract<SolverMessage,{type:'candidate'}>['solution'];

export function initialPlacementItemId(message:string):number|undefined {
  const match=message.match(/No valid initial placement could be constructed for item\s+(\d+)/i);
  return match?Number(match[1]):undefined;
}

function rotatedBounds(points:[number,number][],angleDeg:number):[number,number,number,number] {
  const angle=angleDeg*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const [x,y] of points){
    const rx=x*c-y*s,ry=x*s+y*c;
    minX=Math.min(minX,rx);minY=Math.min(minY,ry);maxX=Math.max(maxX,rx);maxY=Math.max(maxY,ry);
  }
  return [minX,minY,maxX,maxY];
}

function fallbackOrientation(item:FallbackSolverItem,stripHeight:number):{angle:number;box:[number,number,number,number]} {
  if(item.demand!==1)throw Error('Safe-append fallback requires demand-one solver items.');
  const angles=item.allowed_orientations?.length?item.allowed_orientations:[0,90,180,270];
  const candidates=angles.map(angle=>({angle,box:rotatedBounds(item.shape.data,angle)}))
    .filter(({box})=>box[3]-box[1]<=stripHeight+1e-7)
    .sort((a,b)=>(a.box[2]-a.box[0])-(b.box[2]-b.box[0]));
  if(!candidates.length)throw Error(`Fallback item ${item.id} does not fit the material width in its allowed orientations.`);
  return candidates[0];
}

export function appendFallbackItems(solution:FallbackSolution,items:FallbackSolverItem[],stripHeight:number,clearance:number):FallbackSolution {
  if(!items.length)return solution;
  const placed=[...solution.layout.placed_items];
  let cursor=Math.max(0,solution.strip_width);
  for(const item of items){
    const {angle,box}=fallbackOrientation(item,stripHeight);
    if(placed.length)cursor+=Math.max(0,clearance)+1e-6;
    const translation:[number,number]=[cursor-box[0],-box[1]];
    placed.push({item_id:item.id,transformation:{rotation:angle,translation}});
    cursor+=box[2]-box[0];
  }
  return {strip_width:cursor,layout:{placed_items:placed}};
}

export function removeFallbackItem(input:FallbackSolverInput,itemId:number):{input:FallbackSolverInput;item:FallbackSolverItem}|undefined {
  const index=input.items.findIndex(item=>item.id===itemId);
  if(index<0)return undefined;
  const item=input.items[index];
  return {input:{...input,items:input.items.filter((_,i)=>i!==index)},item};
}
