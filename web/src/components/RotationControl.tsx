import type {RotationRule} from '../model';

const same=(rule:RotationRule,degrees:number[]|'free')=>{
  if(degrees==='free')return rule.kind==='continuous';
  if(rule.kind!=='discrete')return false;
  const a=[...new Set(rule.degrees.map(d=>((d%360)+360)%360))].sort((x,y)=>x-y);
  const b=[...degrees].sort((x,y)=>x-y);
  return a.length===b.length&&a.every((value,index)=>value===b[index]);
};

export default function RotationControl({rule,mixed,disabled,onChange}:{rule:RotationRule;mixed:boolean;disabled:boolean;onChange:(rule:RotationRule)=>void}) {
  return <div className="rotation-choice" role="group" aria-label="İzin verilen dönüşler">
    <span>İzin verilen dönüşler</span>
    <div className="row-actions">
      <button type="button" aria-pressed={!mixed&&same(rule,[0])} disabled={disabled} onClick={()=>onChange({kind:'discrete',degrees:[0]})}>0°</button>
      <button type="button" aria-pressed={!mixed&&same(rule,[0,180])} disabled={disabled} onClick={()=>onChange({kind:'discrete',degrees:[0,180]})}>0° / 180°</button>
      <button type="button" aria-pressed={!mixed&&same(rule,'free')} disabled={disabled} onClick={()=>onChange({kind:'continuous'})}>Her yöne</button>
    </div>
  </div>;
}
