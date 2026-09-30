import parseString from 'dxf/lib/parseString';
import bSpline from 'dxf/lib/util/bSpline';
import {pointSegmentDistance} from '../geometry/validate';
import {DEFAULT_SETTINGS,type DxfAuxEntity,type DxfSpline,type Point,type Ring} from '../model';
import {apply,multiply,append,ellipse,type Matrix} from '../geometry/flatten';
import {bounds,inside,normalizeDocument,normalizeRing,ringCrosses} from '../geometry/normalize';
import {contoursToParts} from './svg';
import type {ImportReview} from './sparrow';

type DxfPoint={x:number;y:number;z?:number;bulge?:number};
type DxfEntity={type:string;handle:string;layer?:string;x?:number;y?:number;z?:number;
  start?:DxfPoint;end?:DxfPoint;vertices?:DxfPoint[];closed?:boolean;r?:number;
  startAngle?:number;endAngle?:number;majorX?:number;majorY?:number;axisRatio?:number;
  block?:string;scaleX?:number;scaleY?:number;rotation?:number;rowCount?:number;columnCount?:number;rowSpacing?:number;columnSpacing?:number;
  extrusionZ?:number;controlPoints?:DxfPoint[];knots?:number[];degree?:number;weights?:number[]};
type DxfFile={entities:DxfEntity[];blocks:{name:string;x?:number;y?:number;entities:DxfEntity[]}[]};
type Group=[number,string];
type DxfRecord={type:string;groups:Group[];children:DxfRecord[];id:string;layer:string};
type Contour={ring:Ring;entityId:string;curved:boolean;dxfColorNumber?:number};
type Chain={points:Ring;id:string;curved:boolean;dxfColorNumber?:number};
export type DXFOptions={scale:number;tolerance:number;enclosed:'holes'|'parts';layers?:string[]};
const value=(r:DxfRecord,code:number)=>r.groups.find(g=>g[0]===code)?.[1];
function finite(text:string|undefined,fallback?:number):number {
  if(text===undefined&&fallback!==undefined)return fallback;
  if(text===undefined||!text.trim()||!Number.isFinite(Number(text)))throw Error('Missing or non-finite DXF number.');
  return Number(text);
}
function scan(text:string):{records:DxfRecord[];units:number;text:string} {
  if(text.startsWith('AutoCAD Binary DXF')||text.includes('\0'))throw Error('Binary DXF is unsupported. Export ASCII DXF.');
  const lines=text.replace(/^\uFEFF/,'').trimEnd().split(/\r\n|\n|\r/);
  if(lines.length%2)throw Error('ASCII DXF must contain complete group-code/value pairs.');
  const groups:Group[]=[];
  for(let i=0;i<lines.length;i+=2) {
    const code=Number(lines[i].trim());
    if(!lines[i].trim()||!Number.isInteger(code)||code<0||code>1071)throw Error(`Invalid DXF group code at line ${i+1}.`);
    groups.push([code,lines[i+1].trim()]);
  }
  if(groups[groups.length-1]?.[0]!==0||groups[groups.length-1]?.[1]!=='EOF')throw Error('DXF is missing its EOF record.');
  let section='',units=0;const raw:DxfRecord[]=[];
  for(let i=0;i<groups.length;i++) {
    const [code,v]=groups[i];
    if(code===0&&v==='SECTION') {if(groups[i+1]?.[0]!==2)throw Error('Malformed DXF section.');section=groups[++i][1];continue;}
    if(code===0&&v==='ENDSEC') {section='';continue;}
    if(section==='HEADER'&&code===9&&v==='$INSUNITS')units=finite(groups[i+1]?.[1]);
    if(!['ENTITIES','BLOCKS'].includes(section)||code!==0)continue;
    // Stable handles let conversion diagnostics refer back to the guarded source record.
    groups.splice(i+1,0,[5,`studio-${raw.length+1}`]);
    const body:Group[]=[];while(groups[i+1]&&groups[i+1][0]!==0){const group=groups[++i];if(group[0]===5)group[1]=`studio-${raw.length+1}`;body.push(group);}
    const r:DxfRecord={type:v,groups:body,children:[],id:'',layer:''};r.id=value(r,5)??`${v} ${raw.length+1}`;r.layer=value(r,8)??'0';raw.push(r);
    if(raw.length>10_000)throw Error('DXF exceeds 10,000 entities including vertices.');
  }
  const records:DxfRecord[]=[];
  for(let i=0;i<raw.length;i++) {
    const r=raw[i];
    if(r.type==='POLYLINE') {
      while(raw[i+1]?.type==='VERTEX')r.children.push(raw[++i]);
      if(raw[i+1]?.type!=='SEQEND')throw Error(`${r.id}: POLYLINE lacks a terminating SEQEND.`);
      r.children.push(raw[++i]);
    }else if(['VERTEX','SEQEND'].includes(r.type))throw Error(`${r.id}: orphan ${r.type}.`);
    records.push(r);
  }
  return {records,units,text:groups.map(g=>g.join('\n')).join('\n')};
}
function guard(r:DxfRecord) {
  for(const entity of [r,...r.children]) {
    for(const [code,v] of entity.groups) {
      if(code>=10&&code<=59)finite(v);
      if(code>=60&&code<=99&&!/^[+-]?\d+$/.test(v))throw Error('Invalid integer DXF field.');
      if((code>=30&&code<=38||code===39)&&finite(v)!==0)throw Error('Nonzero elevation, z coordinates, or thickness are unsupported.');
      if([210,220].includes(code)&&finite(v)!==0)throw Error('Non-XY extrusion is unsupported.');
      if(code===230&&![1,-1].includes(finite(v)))throw Error('Non-XY extrusion is unsupported.');
    }
    const flags=finite(value(entity,70),0);
    if(entity.type==='POLYLINE'&&(flags&~129)!==0)throw Error('Only ordinary 2D POLYLINE is supported; spline-fit, mesh and 3D flags are excluded.');
    if(entity.type==='VERTEX'&&flags!==0)throw Error('Only ordinary 2D VERTEX records are supported.');
  }
  if(r.type==='LWPOLYLINE') {
    const count=finite(value(r,90));
    if(!Number.isInteger(count)||count<2||count>5000||count!==r.groups.filter(g=>g[0]===10).length)throw Error('Invalid LWPOLYLINE vertex count.');
  }
}
function bulge(from:Point,to:Point,b:number,tolerance:number,output:Ring) {
  if(!Number.isFinite(b))throw Error('Non-finite polyline bulge.');
  const dx=to[0]-from[0],dy=to[1]-from[1],chord=Math.hypot(dx,dy);
  if(b===0||chord*Math.abs(b)/2<=tolerance) {append(output,to);return;}
  if(chord===0)throw Error('A bulged edge has coincident endpoints.');
  const k=(1-b*b)/(4*b),center:Point=[(from[0]+to[0])/2-dy*k,(from[1]+to[1])/2+dx*k],radius=chord*(1+b*b)/(4*Math.abs(b));
  ellipse(center,[radius,0],[0,radius],Math.atan2(from[1]-center[1],from[0]-center[0]),4*Math.atan(b),tolerance,output);
  output[output.length-1]=to;
}
function spline(entity:DxfEntity,tolerance:number):Ring {
  const points=entity.controlPoints??[],knots=entity.knots??[],degree=entity.degree??0;
  if(!Number.isInteger(degree)||degree<1||degree>3||points.length<=degree||points.length>5000)throw Error('SPLINE needs degree 1–3 and a valid control-point count.');
  const weights=entity.weights??points.map(()=>1);
  if(weights.length!==points.length||weights.some(w=>!Number.isFinite(w)||w<=0))throw Error('SPLINE weights must be finite and positive.');
  if(knots.length!==points.length+degree+1||knots.some((v,i)=>!Number.isFinite(v)||i>0&&v<knots[i-1]))throw Error('Invalid SPLINE knot vector.');
  if(points.some(p=>![p.x,p.y,p.z??0].every(Number.isFinite)||(p.z??0)!==0))throw Error('Invalid or nonplanar SPLINE control points.');
  const low=knots[degree],high=knots[points.length];if(!(high>low))throw Error('Empty SPLINE parameter domain.');
  const spans=[...new Set(knots.slice(degree,points.length+1))];
  if(spans.slice(1,-1).some(k=>knots.filter(v=>v===k).length>degree))throw Error('Discontinuous SPLINE cannot form one contour.');
  // Evaluate each polynomial knot span in homogeneous coordinates using dxf.
  // Degrees 1–3 can all be represented exactly as cubic rational Beziers.
  const homogeneous=points.map((p,i)=>[p.x*weights[i],p.y*weights[i],weights[i]]);
  const project=(p:number[]):Point=>[p[0]/p[2],p[1]/p[2]];
  const output:Ring=[];
  const flatten=(control:number[][],budget:number,depth=0)=>{
    if(depth>32)throw Error('SPLINE subdivision exceeded its depth limit.');
    const projected=control.map(project);
    if(projected.slice(1,-1).every(p=>pointSegmentDistance(p,projected[0],projected[3])<=budget)) {append(output,projected[3]);return;}
    const left=[control[0]],right=[control[3]];let row=control;
    while(row.length>1){row=row.slice(1).map((p,i)=>p.map((v,j)=>(v+row[i][j])/2));left.push(row[0]);right.unshift(row[row.length-1]);}
    flatten(left,budget,depth+1);flatten(right,budget,depth+1);
  };
  for(let i=1;i<spans.length;i++) {
    const samples=[0,1/3,2/3,1].map(t=>bSpline(Math.max(0,Math.min(1,(spans[i-1]+t*(spans[i]-spans[i-1])-low)/(high-low))),degree,homogeneous,knots));
    const [p0,a,b,p3]=samples;
    const p1=p0.map((v,j)=>(2*(27*a[j]-8*v-p3[j])-(27*b[j]-v-8*p3[j]))/18);
    const p2=p0.map((v,j)=>(2*(27*b[j]-v-8*p3[j])-(27*a[j]-8*v-p3[j]))/18);
    const control=[p0,p1,p2,p3];
    if(control.some(p=>p.some(v=>!Number.isFinite(v))||p[2]<=0))throw Error('Invalid SPLINE span.');
    // dxf rounds evaluations to nine decimal places; reserve an error budget
    // before applying the rational Bezier convex-hull subdivision bound.
    const precision=1e-7*(1+Math.max(...control.flatMap(p=>project(p).map(Math.abs))))/Math.min(...control.map(p=>p[2]));
    if(precision>=tolerance)throw Error('Requested tolerance is below SPLINE evaluation precision.');
    if(!output.length)append(output,project(p0));
    flatten(control,tolerance-precision);
  }
  return output;
}
function join(chains:Chain[],issues:string[]):{contours:Contour[];gaps:number;adjustment:number} {
  const endpoints=chains.flatMap((c,i)=>[{p:c.points[0],edge:i,end:0},{p:c.points[c.points.length-1],edge:i,end:1}]);
  const neighbors=endpoints.map(()=>[] as number[]),cells=new Map<string,number[]>();
  const tolerance=.01;
  for(let i=0;i<endpoints.length;i++) {
    const p=endpoints[i].p,x=Math.floor(p[0]/tolerance),y=Math.floor(p[1]/tolerance);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const j of cells.get(`${x+dx},${y+dy}`)??[]) {
      const q=endpoints[j].p;if(Math.hypot(p[0]-q[0],p[1]-q[1])<=tolerance){neighbors[i].push(j);neighbors[j].push(i);}
    }
    const key=`${x},${y}`;cells.set(key,[...(cells.get(key)??[]),i]);
  }
  const visited=new Set<number>(),contours:Contour[]=[];let gaps=0,adjustment=0;
  for(let i=0;i<chains.length;i++) {
    if(visited.has(i))continue;
    const component=new Set<number>([i]),queue=[i];
    for(let at=0;at<queue.length;at++)for(const e of [queue[at]*2,queue[at]*2+1])for(const neighbor of neighbors[e]) {
      const edge=endpoints[neighbor].edge;if(!component.has(edge)){component.add(edge);queue.push(edge);}
    }
    for(const edge of component)visited.add(edge);
    if([...component].some(edge=>neighbors[edge*2].length!==1||neighbors[edge*2+1].length!==1)) {
      issues.push(`${[...component].map(e=>chains[e].id).join(', ')}: open ends or ambiguous junctions within 0.01 mm. Exclude these contours or repair the source.`);continue;
    }
    let current=i*2;const ring:Ring=[];let curved=false,componentAdjustment=0;
    const walked=new Set<number>();
    do {
      const edge=endpoints[current].edge;if(walked.has(edge))throw Error('DXF chain traversal revisited an edge.');walked.add(edge);
      const chain=chains[edge],points=current%2?[...chain.points].reverse():chain.points;
      const entryNeighbor=endpoints[neighbors[current][0]].p,entry=points[0];
      const exitIndex=edge*2+(current%2?0:1),exit=points[points.length-1],exitNeighbor=endpoints[neighbors[exitIndex][0]].p;
      const entryPoint:Point=[(entry[0]+entryNeighbor[0])/2,(entry[1]+entryNeighbor[1])/2];
      const exitPoint:Point=[(exit[0]+exitNeighbor[0])/2,(exit[1]+exitNeighbor[1])/2];
      const gap=Math.hypot(exit[0]-exitNeighbor[0],exit[1]-exitNeighbor[1]);
      if(gap>0){gaps++;adjustment=Math.max(adjustment,gap/2);componentAdjustment=Math.max(componentAdjustment,gap/2);}
      for(const p of [entryPoint,...points.slice(1,-1),exitPoint])append(ring,p);
      curved ||= chain.curved;current=neighbors[exitIndex][0];
    }while(current!==i*2);
    if(walked.size!==component.size)throw Error('DXF component did not form a single closed chain.');
    const componentColors=[...new Set([...component].map(e=>chains[e].dxfColorNumber).filter((v):v is number=>v!==undefined))];
    contours.push({ring,entityId:[...component].map(e=>chains[e].id).join(' + '),curved:curved||componentAdjustment>0,
      ...(componentColors.length===1?{dxfColorNumber:componentColors[0]}:{})});
  }
  return {contours,gaps,adjustment};
}
export function importDXF(text:string,fileName:string,options:DXFOptions):ImportReview {
  if(!Number.isFinite(options.tolerance)||options.tolerance<=0)throw Error('DXF eğri toleransı pozitif bir sayı olmalıdır.');
  const source=scan(text),{records,units}=source,parsed=parseString(source.text) as DxfFile;
  const unitScales:Record<number,number>={1:25.4,2:304.8,4:1,5:10,6:1000,7:1_000_000,9:.0254,10:914.4,13:.001,14:100,15:10000};
  const scale=unitScales[units]??1,warnings:string[]=[],issues:string[]=[],unsupported=new Map<string,number>();
  warnings.push(unitScales[units]?`DXF INSUNITS ${units}: one unit = ${scale} mm.`:`DXF INSUNITS ${units} eksik veya desteklenmiyor. Ölçüyü değiştirmemek için 1 çizim birimi = 1 mm kabul edildi.`);
  const byHandle=new Map(records.map(r=>[r.id,r])),blocks=new Map(parsed.blocks.map(b=>[b.name,b]));
  const supported=['LINE','ARC','CIRCLE','ELLIPSE','LWPOLYLINE','POLYLINE','SPLINE','INSERT','POINT','TEXT','MTEXT'];
  for(const r of records)if(!supported.includes(r.type)&&!['BLOCK','ENDBLK'].includes(r.type))unsupported.set(r.type,(unsupported.get(r.type)??0)+1);
  const layers:string[]=[],contours:Contour[]=[],chains:Chain[]=[],auxEntities:DxfAuxEntity[]=[],sourceSplines=new Map<string,DxfSpline>();let totalVertices=0,expanded=0;
  const visit=(entity:DxfEntity,parent:Matrix,inheritedLayer:string,path:string[])=>{
    if(++expanded>10_000)throw Error('DXF exceeds 10,000 expanded entities.');
    const r=byHandle.get(entity.handle);if(!r||!supported.includes(entity.type))return;
    const layer=entity.layer&&entity.layer!=='0'?entity.layer:inheritedLayer;
    if(!layers.includes(layer))layers.push(layer);
    try {
      guard(r);
      if(entity.type==='INSERT') {
        if(!entity.block||path.includes(entity.block)||path.length>=32)throw Error('Missing, cyclic, or excessively nested block reference.');
        const block=blocks.get(entity.block);if(!block)throw Error(`Missing block ${entity.block}.`);
        const blockRecord=records.find(r=>r.type==='BLOCK'&&value(r,2)===block.name);if(blockRecord)guard(blockRecord);
        const rows=entity.rowCount??1,columns=entity.columnCount??1;
        if(![rows,columns].every(n=>Number.isInteger(n)&&n>0)||rows*columns>10_000)throw Error('Invalid or oversized INSERT array.');
        const sx=entity.scaleX??1,sy=entity.scaleY??1,angle=(entity.rotation??0)*Math.PI/180,c=Math.cos(angle),sn=Math.sin(angle);
        if(sx===0||sy===0)throw Error('INSERT scale must be nonzero.');
        // Compose base-point, scale, rotation and array offsets in DXF order.
        // Keep explicit child layers; only layer 0 inherits from its INSERT.
        const reflect:Matrix=[entity.extrusionZ===-1?-1:1,0,0,1,0,0];
        for(let row=0;row<rows;row++)for(let column=0;column<columns;column++) {
          const x=column*(entity.columnSpacing??0),y=row*(entity.rowSpacing??0);
          const transform:Matrix=[c*sx,sn*sx,-sn*sy,c*sy,(entity.x??0)+c*x-sn*y,(entity.y??0)+sn*x+c*y];
          const matrix=multiply(parent,multiply(reflect,multiply(transform,[1,0,0,1,-(block.x??0),-(block.y??0)])));
          for(const child of block.entities)visit(child,matrix,layer,[...path,block.name]);
        }
        return;
      }
      if(options.layers&&!options.layers.includes(layer))return;
      const matrix=entity.extrusionZ===-1&&['CIRCLE','ARC','LWPOLYLINE','POLYLINE'].includes(entity.type)?multiply(parent,[-1,0,0,1,0,0]):parent;
      const tolerance=options.tolerance/Math.hypot(matrix[0],matrix[1],matrix[2],matrix[3]);
      const point=(p:DxfPoint|undefined):Point=>{
        if(!p||![p.x,p.y,p.z??0].every(Number.isFinite)||p.z&&p.z!==0)throw Error('Invalid or nonplanar coordinates.');
        return [p.x,p.y];
      };
      let ring:Ring,closed=false,curved=false;
      const rawColor=value(r,62),dxfColorNumber=rawColor===undefined?undefined:Math.abs(finite(rawColor));
      if(['POINT','TEXT','MTEXT'].includes(entity.type)) {
        const at=apply(matrix,[finite(value(r,10)),finite(value(r,20))]);
        if(entity.type==='POINT') auxEntities.push({kind:'point',point:at,layer,...(dxfColorNumber!==undefined?{colorNumber:dxfColorNumber}:{})});
        else {
          const text=entity.type==='MTEXT'?r.groups.filter(([code])=>code===3).map(([,v])=>v).join('')+(value(r,1)??''):(value(r,1)??'');
          const rawHeight=finite(value(r,40),2.5),scaleY=Math.hypot(matrix[2],matrix[3])||Math.hypot(matrix[0],matrix[1])||1;
          const baseRotation=finite(value(r,50),0),matrixRotation=Math.atan2(matrix[1],matrix[0])*180/Math.PI;
          auxEntities.push({kind:entity.type==='MTEXT'?'mtext':'text',point:at,text,heightMm:Math.abs(rawHeight*scaleY),rotationDeg:baseRotation+matrixRotation,layer,...(dxfColorNumber!==undefined?{colorNumber:dxfColorNumber}:{})});
        }
        return;
      }
      if(entity.type==='LINE')ring=[point(entity.start),point(entity.end)];
      else if(entity.type==='SPLINE'){
        ring=spline(entity,tolerance);curved=true;
        // DXF SPLINE flag bit 1 marks a closed curve. Treat it as a contour
        // directly instead of sending its coincident endpoints through the
        // open-chain joiner (common in footwear CAD exports).
        const flags=finite(value(r,70),0);
        closed=(flags&1)!==0;
        if(closed&&ring.length>1&&Math.hypot(ring[0][0]-ring[ring.length-1][0],ring[0][1]-ring[ring.length-1][1])<=Math.max(.01,tolerance))ring.pop();
        if(closed){
          const controlPoints=(entity.controlPoints??[]).map(point).map(p=>apply(matrix,p));
          sourceSplines.set(r.id,{degree:entity.degree??0,knots:[...(entity.knots??[])],controlPoints,
            ...(entity.weights?.length?{weights:[...entity.weights]}:{}),flags});
        }
      }
      else if(['ARC','CIRCLE','ELLIPSE'].includes(entity.type)) {
        const center=point({x:entity.x!,y:entity.y!});let u:Point,v:Point;
        if(entity.type==='ELLIPSE') {
          u=[entity.majorX!,entity.majorY!];const ratio=entity.axisRatio!;
          if(!Number.isFinite(ratio)||ratio<=0||ratio>1||!Math.hypot(...u))throw Error('Invalid ellipse axes.');
          const sign=entity.extrusionZ===-1?-1:1;v=[-u[1]*ratio*sign,u[0]*ratio*sign];
        }else {
          const radius=entity.r!;if(!Number.isFinite(radius)||radius<=0)throw Error('Arc radius must be positive.');
          u=[radius,0];v=[0,radius];
        }
        const start=entity.type==='CIRCLE'?0:entity.startAngle!,end=entity.type==='CIRCLE'?2*Math.PI:entity.endAngle!;
        closed=entity.type==='CIRCLE'||entity.type==='ELLIPSE'&&Math.abs(end-start)>=2*Math.PI-1e-10;
        const sweep=closed?2*Math.PI:((end-start)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
        if(!Number.isFinite(start)||!Number.isFinite(sweep)||sweep===0)throw Error('Curve needs distinct finite start and end angles.');
        ring=[[center[0]+u[0]*Math.cos(start)+v[0]*Math.sin(start),center[1]+u[1]*Math.cos(start)+v[1]*Math.sin(start)]];
        ellipse(center,u,v,start,sweep,tolerance,ring);curved=true;if(closed)ring.pop();
      }else {
        const vertices=entity.vertices??[];
        if(vertices.length<2||vertices.length>5000)throw Error('Polyline needs 2–5,000 vertices.');
        const points=vertices.map(point);closed=!!entity.closed;ring=[points[0]];
        for(let i=0;i<points.length-(closed?0:1);i++) {const b=vertices[i].bulge??0;bulge(points[i],points[(i+1)%points.length],b,tolerance,ring);curved ||= b!==0;}
        if(closed)ring.pop();
        if(r.groups.some(([code,v])=>[40,41,43].includes(code)&&finite(v)!==0))warnings.push(`${r.id}: polyline width is ignored; the centerline is the contour.`);
      }
      ring=ring.map(p=>apply(matrix,p));
      if(ring.some(p=>!p.every(v=>Number.isFinite(v)&&Math.abs(v)<=100_000)))throw Error('Coordinates exceed the 100,000 mm limit.');
      totalVertices+=ring.length;if(totalVertices>100_000)throw Error('DXF exceeds 100,000 vertices.');
      if(closed)contours.push({ring,entityId:r.id,curved,dxfColorNumber});else chains.push({points:ring,id:r.id,curved,dxfColorNumber});
    }catch(error){if(expanded>10_000||totalVertices>100_000)throw error;issues.push(`${r.id} on ${layer}: ${error instanceof Error?error.message:String(error)}`);}
  };
  for(const entity of parsed.entities)visit(entity,[scale,0,0,scale,0,0],'0',[]);
  layers.sort();
  const joined=join(chains,issues);contours.push(...joined.contours);
  if(joined.gaps)warnings.push(`Joined ${joined.gaps} gaps within 0.01 mm; largest endpoint adjustment ${joined.adjustment} mm. Confirm this preview before importing.`);
  const valid:Contour[]=[];
  for(const c of contours)try{valid.push({...c,ring:normalizeRing(c.ring)});}catch(e){issues.push(`${c.entityId}: ${String(e)}`);}
  // Containment is valid DXF topology: an inner loop can be a hole. Only
  // boundary intersections/touches are rejected here; hierarchy is resolved
  // later by contoursToParts.
  const rejected=new Set<number>();
  const translatedSignature=(ring:Ring)=>{
    const b=bounds(ring),round=(n:number)=>Math.round(n*1e6)/1e6;
    const pts=ring.map(([x,y])=>`${round(x-b[0])},${round(y-b[1])}`);
    let best='';
    for(let i=0;i<pts.length;i++){const candidate=[...pts.slice(i),...pts.slice(0,i)].join(';');if(!best||candidate<best)best=candidate;}
    return best;
  };
  for(let i=0;i<valid.length;i++)for(let j=0;j<i;j++){
    const a=valid[i].ring,b=valid[j].ring;
    if(!ringCrosses(a,b))continue;
    // Pure containment is valid and is resolved into outer/hole hierarchy by
    // contoursToParts.
    const nested=inside(a[0],b)||inside(b[0],a);
    if(nested)continue;
    const duplicate=translatedSignature(a)===translatedSignature(b)
      && Math.abs(bounds(a)[0]-bounds(b)[0])<1e-6
      && Math.abs(bounds(a)[1]-bounds(b)[1])<1e-6;
    if(duplicate){
      rejected.add(i);rejected.add(j);
      issues.push('Aynı konumda yinelenen kontur bulundu; kaynak DXF içindeki kopyayı kaldırın.');
      continue;
    }
    // Independent closed DXF entities are separate cut parts. Footwear CAD
    // exports can contain parts that touch or overlap in the source drawing;
    // that must not make either source contour disappear during import.
    warnings.push('Kaynak DXF içinde temas eden veya kesişen bağımsız konturlar ayrı parçalar olarak korundu.');
  }
  const keptContours=valid.filter((_,i)=>!rejected.has(i));
  const imported=contoursToParts(keptContours,fileName,'dxf',options.tolerance+joined.adjustment,options.enclosed);
  // Attach POINT/TEXT/MTEXT records to the smallest containing outer contour.
  // Stored coordinates are local to the part, so every placement/rotation keeps marks rigidly locked to that part.
  for(const mark of auxEntities) {
    const candidates=imported.map(part=>{
      const contour=part.source.entityId?keptContours.find(c=>c.entityId===part.source.entityId):undefined;
      return contour?{part,contour,size:Math.abs(contour.ring.reduce((sum,p,i)=>{const q=contour.ring[(i+1)%contour.ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0))}:undefined;
    }).filter((v):v is NonNullable<typeof v>=>!!v&&inside(mark.point,v.contour.ring)).sort((a,b)=>a.size-b.size);
    const target=candidates[0];
    if(target){
      const b=bounds(target.contour.ring),local={...mark,point:[mark.point[0]-b[0],mark.point[1]-b[1]] as Point};
      target.part.source={...target.part.source,dxfAux:[...(target.part.source.dxfAux??[]),local]};
    } else warnings.push(`${mark.kind.toUpperCase()} on ${mark.layer} is outside every part and was not attached.`);
  }
  // Preserve the original compact closed SPLINE when it represents a complete
  // outer part. Nesting still uses the flattened ring, while DXF export can
  // transform the original control points instead of exploding the curve into
  // hundreds of nodes.
  for(const part of imported){
    const id=part.source.entityId,curve=id?sourceSplines.get(id):undefined,contour=id?valid.find(c=>c.entityId===id):undefined;
    if(!curve||!contour||part.holes.length)continue;
    const b=bounds(contour.ring);
    part.source={...part.source,dxfSpline:{...curve,controlPoints:curve.controlPoints.map(([x,y])=>[x-b[0],y-b[1]])}};
  }

  // Group repeated DXF geometry independently of its source X/Y position.
  // Orientation remains part of the signature, so rotated variants are not
  // accidentally merged.
  const ringSignature=(ring:Ring,origin:Point)=>{
    const round=(n:number)=>Math.round(n*1e6)/1e6;
    const points=ring.map(([x,y])=>`${round(x-origin[0])},${round(y-origin[1])}`);
    // Vertex zero is arbitrary in DXF. Canonicalize the cyclic start point
    // while preserving winding/orientation so rotated geometry stays distinct.
    let best='';
    for(let i=0;i<points.length;i++){
      const candidate=[...points.slice(i),...points.slice(0,i)].join(';');
      if(!best||candidate<best)best=candidate;
    }
    return best;
  };
  const signature=(part:(typeof imported)[number])=>{
    const b=bounds(part.outer),origin:Point=[b[0],b[1]];
    const holes=part.holes.map(h=>ringSignature(h,origin)).sort().join('|');
    const aux=(part.source.dxfAux??[]).map(mark=>JSON.stringify(mark)).sort().join('|');
    return `${ringSignature(part.outer,origin)}#${holes}#${aux}`;
  };
  const grouped=new Map<string,(typeof imported)[number]>();
  for(const part of imported){
    const key=signature(part),existing=grouped.get(key);
    if(existing) existing.quantity+=part.quantity;
    else grouped.set(key,{...part});
  }
  const parts=[...grouped.values()];

  // Preparation is deliberately vertical and independent from nesting.
  // Store every demanded copy explicitly so grouped/repeated DXF parts do not
  // fall back to the old diagonal copy offset. Source geometry and angle stay
  // untouched; only the preparation coordinates are arranged top-to-bottom.
  let offsetY=0;
  const placements=[];
  for(const p of parts){
    const b=bounds(p.outer),height=b[3]-b[1];
    for(let copyIndex=0;copyIndex<p.quantity;copyIndex++){
      const position:Point=[-b[0],offsetY-b[1]];
      if(copyIndex===0)p.preparationPosition=position;
      placements.push({partId:p.id,copyIndex,xMm:position[0],yMm:position[1],angleDeg:0});
      offsetY+=height+10;
    }
  }
  for(const [type,count] of unsupported)warnings.push(`Excluded ${count} unsupported ${type} entities.`);
  if(parts.some(p=>p.holes.length))warnings.push('Holes are preserved; nesting inside holes is not supported.');
  const document={name:fileName.replace(/\.dxf$/i,''),parts,settings:{...DEFAULT_SETTINGS},placements};
  return {document:parts.length?normalizeDocument(document):document,warnings,issues,layers,replace:false};
}
