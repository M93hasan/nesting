import { DEFAULT_SETTINGS, type Point, type Ring } from '../model';
import { normalizeDocument, normalizeRing } from '../geometry/normalize';
import { append, ellipse } from '../geometry/flatten';
import { contoursToParts } from './svg';
import type { ImportReview } from './sparrow';

export const HPGL_PLOTTER_UNIT_MM = 0.025;
export type PLTOptions = { tolerance:number };

type Contour={ring:Ring;entityId:string;curved:boolean};

const numbers=(text:string):number[]=>{
  const matches=text.match(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?/g)??[];
  const values=matches.map(Number);
  if(values.some(value=>!Number.isFinite(value)))throw Error('PLT contains a non-finite coordinate.');
  return values;
};
const pairs=(values:number[]):[number,number][]=>{
  if(values.length%2)throw Error('PLT coordinate list must contain X/Y pairs.');
  return Array.from({length:values.length/2},(_,i)=>[values[i*2],values[i*2+1]]);
};
const samePoint=(a:Point,b:Point,tolerance=1e-9)=>Math.hypot(a[0]-b[0],a[1]-b[1])<=tolerance;

export function importPLT(text:string,fileName:string,options:PLTOptions):ImportReview {
  if(!Number.isFinite(options.tolerance)||options.tolerance<=0||options.tolerance>100)throw Error('PLT curve tolerance must be a positive finite number.');
  if(!text.trim())throw Error('PLT file is empty.');

  const warnings:string[]=[],ignored=new Set<string>(),contours:Contour[]=[];
  const clean=text
    .replace(/\x1b%[-+]?\d+(?:\.\d+)?[A-Za-z]/g,'')
    .replace(/LB[^\x03]*\x03/gi,'');
  let current:Point=[0,0],absolute=true,penDown=false,path:Ring=[],pathCurved=false;
  let inputWindow:[Point,Point]|undefined;
  let userScale:{xmin:number;xmax:number;ymin:number;ymax:number}|undefined;
  let contourIndex=0;
  const tolerancePlotter=options.tolerance/HPGL_PLOTTER_UNIT_MM;
  const closeTolerance=Math.max(2,tolerancePlotter);

  const toPlotter=(x:number,y:number):Point=>{
    if(!userScale)return [x,y];
    if(!inputWindow)throw Error('PLT uses SC user scaling without an explicit IP input window; physical size cannot be determined safely.');
    const [p1,p2]=inputWindow,{xmin,xmax,ymin,ymax}=userScale;
    return [
      p1[0]+(x-xmin)*(p2[0]-p1[0])/(xmax-xmin),
      p1[1]+(y-ymin)*(p2[1]-p1[1])/(ymax-ymin)
    ];
  };
  const deltaToPlotter=(x:number,y:number):Point=>{
    if(!userScale)return [x,y];
    if(!inputWindow)throw Error('PLT uses SC user scaling without an explicit IP input window; physical size cannot be determined safely.');
    const [p1,p2]=inputWindow,{xmin,xmax,ymin,ymax}=userScale;
    return [x*(p2[0]-p1[0])/(xmax-xmin),y*(p2[1]-p1[1])/(ymax-ymin)];
  };
  const point=(x:number,y:number):Point=>{
    if(absolute)return toPlotter(x,y);
    const [dx,dy]=deltaToPlotter(x,y);return [current[0]+dx,current[1]+dy];
  };
  const finishPath=()=>{
    if(path.length<2){path=[];pathCurved=false;return;}
    if(!samePoint(path[0],path[path.length-1],closeTolerance)){
      warnings.push(`PLT open path ${contourIndex+1} was ignored because nesting requires a closed contour.`);
      path=[];pathCurved=false;return;
    }
    if(samePoint(path[0],path[path.length-1]))path.pop();
    const mm=path.map(([x,y])=>[x*HPGL_PLOTTER_UNIT_MM,y*HPGL_PLOTTER_UNIT_MM] as Point);
    try{
      const ring=normalizeRing(mm);
      contours.push({ring,entityId:`PLT ${++contourIndex}`,curved:pathCurved});
    }catch(error){
      warnings.push(`PLT contour ${contourIndex+1} was ignored: ${error instanceof Error?error.message:String(error)}`);
    }
    path=[];pathCurved=false;
  };
  const drawTo=(target:Point)=>{
    if(!path.length)path=[current];
    if(!samePoint(path[path.length-1],target))append(path,target);
    current=target;
  };
  const moveTo=(target:Point)=>{
    if(penDown)drawTo(target);else current=target;
  };
  const movePairs=(values:number[])=>{
    for(const [x,y] of pairs(values))moveTo(point(x,y));
  };
  const addArc=(center:Point,sweepDeg:number)=>{
    const dx=current[0]-center[0],dy=current[1]-center[1],radius=Math.hypot(dx,dy);
    if(!(radius>0)||!Number.isFinite(sweepDeg)||sweepDeg===0)throw Error('PLT arc needs a finite center, radius and sweep angle.');
    const sweep=sweepDeg*Math.PI/180;
    if(penDown){
      if(!path.length)path=[current];
      ellipse(center,[dx,dy],[-dy,dx],0,sweep,tolerancePlotter,path);
      pathCurved=true;current=path[path.length-1];
    }else{
      const c=Math.cos(sweep),s=Math.sin(sweep);
      current=[center[0]+dx*c-dy*s,center[1]+dx*s+dy*c];
    }
  };
  const addCircle=(radius:number)=>{
    if(!Number.isFinite(radius)||radius<=0)throw Error('PLT circle radius must be positive.');
    const ring:Ring=[[current[0]+radius,current[1]]];
    ellipse(current,[radius,0],[0,radius],0,Math.PI*2,tolerancePlotter,ring);
    if(samePoint(ring[0],ring[ring.length-1]))ring.pop();
    const mm=ring.map(([x,y])=>[x*HPGL_PLOTTER_UNIT_MM,y*HPGL_PLOTTER_UNIT_MM] as Point);
    contours.push({ring:normalizeRing(mm),entityId:`PLT ${++contourIndex}`,curved:true});
  };

  const commands=clean.split(';');
  for(const raw of commands){
    const instruction=raw.trim();
    if(instruction.length<2)continue;
    const command=instruction.slice(0,2).toUpperCase(),args=instruction.slice(2),values=numbers(args);
    switch(command){
      case 'IN':
        finishPath();current=[0,0];absolute=true;penDown=false;inputWindow=undefined;userScale=undefined;break;
      case 'IP':
        if(values.length===0){inputWindow=undefined;break;}
        if(values.length!==4)throw Error('PLT IP requires four coordinates.');
        inputWindow=[[values[0],values[1]],[values[2],values[3]]];break;
      case 'SC':
        if(values.length===0){userScale=undefined;break;}
        if(values.length<4||values[0]===values[1]||values[2]===values[3])throw Error('PLT SC requires xmin,xmax,ymin,ymax with nonzero ranges.');
        userScale={xmin:values[0],xmax:values[1],ymin:values[2],ymax:values[3]};break;
      case 'PA':
        absolute=true;movePairs(values);break;
      case 'PR':
        absolute=false;movePairs(values);break;
      case 'PU':
        if(penDown)finishPath();penDown=false;movePairs(values);break;
      case 'PD':
        penDown=true;movePairs(values);break;
      case 'AA': {
        if(values.length<3)throw Error('PLT AA requires center X, center Y and sweep angle.');
        const center=toPlotter(values[0],values[1]);addArc(center,values[2]);break;
      }
      case 'AR': {
        if(values.length<3)throw Error('PLT AR requires center offset X, center offset Y and sweep angle.');
        const [dx,dy]=deltaToPlotter(values[0],values[1]);addArc([current[0]+dx,current[1]+dy],values[2]);break;
      }
      case 'CI':
        if(values.length<1)throw Error('PLT CI requires a radius.');
        addCircle(values[0]);break;
      case 'SP':case 'VS':case 'FS':case 'LT':case 'PW':case 'LA':case 'UL':case 'PG':
      case 'RO':case 'DI':case 'DR':case 'SL':case 'SR':case 'SI':case 'SS':case 'SA':case 'DT':
        break;
      default:
        if(['EA','ER','RA','RR','WG','EW','AT','RT','BZ','BR','PE','PM','FP','EP'].includes(command))ignored.add(command);
        break;
    }
  }
  finishPath();
  if(ignored.size)warnings.push(`PLT drawing commands not yet interpreted were ignored: ${[...ignored].sort().join(', ')}.`);
  if(!contours.length)throw Error('PLT içinde içe aktarılabilir kapalı kontur bulunamadı. PU/PD ile kapanan kesim konturlarını kontrol edin.');

  const parts=contoursToParts(contours,fileName,'plt',options.tolerance,'holes');
  if(!parts.length)throw Error('PLT içinde içe aktarılabilir kapalı kontur bulunamadı.');
  warnings.unshift('PLT / HP-GL ölçüsü: 1 plotter birimi = 0,025 mm (40 birim = 1 mm).');
  if(parts.some(part=>part.holes.length))warnings.push('PLT iç konturları delik olarak korundu; delik içine nesting yapılmaz.');
  return {document:normalizeDocument({name:fileName.replace(/\.(?:plt|hpgl|hpg|hgl)$/i,''),parts,settings:{...DEFAULT_SETTINGS}}),warnings,replace:false};
}
