import type {RotationRule} from '../model';

export default function RotationControl({rule,mixed,disabled,onChange}:{rule:RotationRule;mixed:boolean;disabled:boolean;onChange:(rule:RotationRule)=>void}) {
  const value=rule.kind==='continuous'?'free':JSON.stringify(rule.degrees);
  return <label>İzin verilen dönüşler<select disabled={disabled} value={mixed?'mixed':value} onChange={e=>{
    if(e.target.value==='mixed')return;
    onChange(e.target.value==='free'?{kind:'continuous'}:{kind:'discrete',degrees:JSON.parse(e.target.value)});
  }}>
    {mixed&&<option value="mixed" disabled>Mixed</option>}
    <option value="[0]">0°</option>
    <option value="[0,180]">0° / 180°</option>
    <option value="free">Serbest dönüş</option>
  </select></label>;
}
