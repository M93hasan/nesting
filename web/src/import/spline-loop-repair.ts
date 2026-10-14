/**
 * Repair a closed footwear contour with a short extra SPLINE lead-in.
 * Trim NURBS knots exactly; don't polygonize or auto-close unrelated marks.
 */
export type SplinePoint={x:number;y:number;z?:number};
export type SplineCurve={degree?:number;controlPoints?:SplinePoint[];knots?:number[];weights?:number[]};
type Vec=number[];
type XY=[number,number];
const dist=(a:XY,b:XY)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

function span(u:number,p:number,U:number[],count:number):number{
  if(u>=U[count])return count-1;
  let low=p,high=count,middle=Math.floor((low+high)/2);
  while(u<U[middle]||u>=U[middle+1]){
    if(u<U[middle])high=middle;else low=middle;
    middle=Math.floor((low+high)/2);
  }
  return middle;
}
function lerp(a:Vec,b:Vec,alpha:number):Vec{return a.map((v,i)=>(1-alpha)*v+alpha*b[i]);}
function deBoor(u:number,p:number,U:number[],P:Vec[]):Vec{
  const k=span(u,p,U,P.length),d=Array.from({length:p+1},(_,i)=>[...P[k-p+i]]);
  for(let r=1;r<=p;r++)for(let j=p;j>=r;j--){
    const i=k-p+j,div=U[i+p-r+1]-U[i];
    d[j]=lerp(d[j-1],d[j],div>0?(u-U[i])/div:0);
  }
  return d[p];
}
function insertKnot(u:number,p:number,U:number[],P:Vec[]):{U:number[],P:Vec[]}{
  const k=span(u,p,U,P.length),s=U.filter(v=>v===u).length,n=P.length-1;
  if(s>=p)return {U:[...U],P:P.map(q=>[...q])};
  const Q:Vec[]=Array(P.length+1);
  for(let i=0;i<=k-p;i++)Q[i]=[...P[i]];
  for(let i=k-s;i<=n;i++)Q[i+1]=[...P[i]];
  for(let i=k-p+1;i<=k-s;i++){
    const div=U[i+p]-U[i],a=div>0?(u-U[i])/div:0;
    Q[i]=lerp(P[i-1],P[i],a);
  }
  return {U:[...U.slice(0,k+1),u,...U.slice(k+1)],P:Q};
}
function trimStart(u:number,p:number,U:number[],P:Vec[]):{U:number[],P:Vec[]}|undefined{
  let K=[...U],C=P.map(v=>[...v]);
  const s=K.filter(v=>v===u).length;
  if(s>=p)return;
  for(let j=s;j<p;j++)({U:K,P:C}=insertKnot(u,p,K,C));
  const first=K.indexOf(u);
  if(first<1)return;
  const right=[u,...K.slice(first)];
  const controls=C.slice(first-1);
  if(right.length!==controls.length+p+1)return;
  const high=right[right.length-1];if(!(high>u))return;
  return {U:right.map(value=>Math.max(0,Math.min(1,(value-u)/(high-u)))),P:controls};
}
function area(points:XY[]):number{
  let a=0;for(let i=0;i<points.length;i++){
    const [x,y]=points[i], [u,v]=points[(i+1)%points.length];a+=x*v-u*y;
  }
  return Math.abs(a)/2;
}
export function repairOpenSplineLoop<T extends SplineCurve>(
  entity:T,originalRing:XY[],tolerance:number,flatten:(curve:T)=>XY[]
):{entity:T;ring:XY[]}|undefined{
  const cps=entity.controlPoints??[],U=entity.knots??[],p=entity.degree??0;
  if(p<1||p>3||!Number.isInteger(p)||cps.length<=p||U.length!==cps.length+p+1)return;
  const weights=entity.weights?.length?entity.weights:undefined;
  if(weights&&weights.length!==cps.length)return;
  if(!cps.every((v,i)=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&(!weights||weights[i]>0)))return;
  if(originalRing.length<12)return;
  const low=U[p],high=U[cps.length];if(!(high>low))return;
  const start=originalRing[0],end=originalRing[originalRing.length-1];
  const seamTolerance=Math.max(.001,Math.min(.01,2*tolerance));
  if(dist(start,end)<=seamTolerance)return;
  const totalLength=originalRing.slice(1).reduce((sum,pt,i)=>sum+dist(originalRing[i],pt),0);
  const maxSpurLength=Math.min(30,totalLength*.10);
  let travelled=0,hasPossibleJoin=false;
  for(let i=0;i<originalRing.length-2;i++){
    const a=originalRing[i],b=originalRing[i+1],vx=b[0]-a[0],vy=b[1]-a[1],l2=vx*vx+vy*vy;
    if(l2===0)continue;
    const t=Math.max(0,Math.min(1,((end[0]-a[0])*vx+(end[1]-a[1])*vy)/l2));
    travelled+=Math.sqrt(l2);
    if(travelled>maxSpurLength)break;
    const q:XY=[a[0]+t*vx,a[1]+t*vy];
    if(t>0.00001&&t<.99999&&dist(q,end)<=seamTolerance){hasPossibleJoin=true;break;}
  }
  if(!hasPossibleJoin)return;
  const homogeneous=cps.map((c,i)=>{const w=weights?.[i]??1;return [c.x*w,c.y*w,w]});
  const evaluate=(u:number):XY=>{
    const q=deBoor(u,p,U,homogeneous);return [q[0]/q[2],q[1]/q[2]];
  };
  const breaks=[...new Set(U.slice(p,cps.length+1))];
  let bestU=NaN,bestDistance=Infinity,arcLength=0,previous=evaluate(low);
  for(let s=0;s<Math.min(4,breaks.length-1);s++){
    const a=breaks[s],b=breaks[s+1];if(b<=a)continue;
    const samples=24,step=(b-a)/samples;
    const sampled:Array<{u:number;d:number}>=[];
    for(let j=0;j<=samples;j++){
      const u=a+j*step,pt=evaluate(u);
      if(j||s)arcLength+=dist(previous,pt);
      previous=pt;
      sampled.push({u,d:dist(pt,end)});
    }
    const minIndex=sampled.reduce((index,value,i)=>value.d<sampled[index].d?i:index,0);
    if(sampled[minIndex].d<bestDistance){
      let left=sampled[Math.max(0,minIndex-1)].u,right=sampled[Math.min(samples,minIndex+1)].u;
      const golden=(Math.sqrt(5)-1)/2;
      let c=right-golden*(right-left),d=left+golden*(right-left);
      for(let k=0;k<65;k++){
        if(dist(evaluate(c),end)<dist(evaluate(d),end)){right=d;d=c;c=right-golden*(right-left);}
        else{left=c;c=d;d=left+golden*(right-left);}
      }
      const u=(left+right)/2,error=dist(evaluate(u),end);
      if(error<bestDistance){bestDistance=error;bestU=u;}
    }
    if(arcLength>maxSpurLength+5)break;
  }
  if(!Number.isFinite(bestU)||bestU<=low+1e-12||bestU>=high||bestDistance>seamTolerance)return;
  const trimmed=trimStart(bestU,p,U,homogeneous);if(!trimmed)return;
  const [first,last]=[trimmed.P[0],trimmed.P[trimmed.P.length-1]];
  const firstXY:XY=[first[0]/first[2],first[1]/first[2]];
  const lastXY:XY=[last[0]/last[2],last[1]/last[2]];
  if(dist(firstXY,lastXY)>seamTolerance)return;
  const lastWeight=last[2];
  trimmed.P[trimmed.P.length-1]=[firstXY[0]*lastWeight,firstXY[1]*lastWeight,lastWeight];
  const repaired={...entity,degree:p,knots:trimmed.U,
    controlPoints:trimmed.P.map(q=>({x:q[0]/q[2],y:q[1]/q[2],z:0})),
    ...(weights?{weights:trimmed.P.map(q=>q[2])}:{})} as T;
  let ring:XY[];
  try{ring=flatten(repaired);}catch{return;}
  if(ring.length<4||dist(ring[0],ring[ring.length-1])>seamTolerance)return;
  if(area(ring)<=1e-6)return;
  return {entity:repaired,ring};
}
