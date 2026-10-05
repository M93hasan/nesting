import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {displayLength,unitScale,type DisplayUnit} from '../units';

export default function SelectionControls({
  box,disabled,sizeLocked=false,angle,mirroredX,mirroredY,onPosition,onSize,onSetAngle,onRotate,onMirror,onValidity,unit='mm'
}:{
  box:number[];disabled:boolean;sizeLocked?:boolean;angle?:number;mirroredX?:boolean;mirroredY?:boolean;
  onPosition:(axis:0|1,value:number)=>void;onSize:(axis:0|1,value:number)=>void;
  onSetAngle:(degrees:number)=>void;onRotate:(degrees:number)=>void;onMirror:(axis:'x'|'y')=>void;
  onValidity:(valid:boolean)=>void;unit?:DisplayUnit
}) {
  const values=[box[0],box[1],box[2]-box[0],box[3]-box[1]];
  const scale=unitScale(unit),initial=values.map(v=>displayLength(v,unit));
  const [fields,setFields]=useState(initial),[angleText,setAngleText]=useState(angle===undefined?'':String(angle)),[step,setStep]=useState('5');
  const previous=useRef({values,unit});
  const angleEditing=useRef(false);
  useLayoutEffect(()=>{
    const old=previous.current;
    setFields(fields=>values.map((value,i)=>old.unit!==unit||old.values[i]!==value?displayLength(value,unit):fields[i]));
    previous.current={values,unit};
  },[...values,unit]);
  useEffect(()=>{if(!angleEditing.current)setAngleText(angle===undefined?'':String(angle));},[angle]);
  const valid=(text:string,i:number)=>!!text.trim()&&Number.isFinite(Number(text))&&Math.abs(Number(text)*scale)<=100_000&&(i<2||Number(text)>0);
  const invalid=fields.some((text,i)=>!valid(text,i));
  useEffect(()=>{onValidity(!invalid);return()=>onValidity(true);},[invalid,onValidity]);
  function apply(i:number) {
    if(!valid(fields[i],i)||fields[i]===initial[i]||Number(fields[i])===Number(initial[i]))return;
    if(i<2)onPosition(i as 0|1,Number(fields[i])*scale);else onSize((i-2) as 0|1,Number(fields[i])*scale);
  }
  const angleValid=!!angleText.trim()&&Number.isFinite(Number(angleText));
  const stepValue=Number(step),stepValid=!!step.trim()&&Number.isFinite(stepValue)&&stepValue>0&&stepValue<=360;
  return <><div className="size-controls">{['X','Y','Genişlik','Yükseklik'].map((label,i)=><label key={label}>{label}, {unit}<input type="number" step="any" min={(i<2?-100000:.000001)/scale} max={100000/scale} required disabled={disabled||(sizeLocked&&i>=2)} aria-invalid={!valid(fields[i],i)} value={fields[i]} onChange={e=>setFields(f=>f.map((v,j)=>j===i?e.target.value:v))} onBlur={()=>apply(i)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>)}<small>Konum, döndürme ve aynalama seçili kopyaları etkiler. Boyutlandırma bu şeklin tüm kopyalarını değiştirir; en-boy oranı kilitlidir.</small>{invalid&&<small className="field-error" role="alert">Geçerli konumlar ve şu sınıra kadar pozitif ölçüler girin: {unit==='mm'?'100,000':displayLength(100000,unit)} {unit}.</small>}{sizeLocked&&<small>DXF ölçüleri kilitlidir; genişlik ve yükseklik değiştirilemez.</small>}</div>
    <form className="rotation-control" onSubmit={e=>{e.preventDefault();if(!disabled&&angleValid)onSetAngle(Number(angleText));}}>
      <label>Yön açısı, derece<input type="text" inputMode="decimal" placeholder={angle===undefined?'—':undefined} value={angleText} disabled={disabled} onFocus={e=>{angleEditing.current=true;e.currentTarget.select();}} onChange={e=>setAngleText(e.target.value.replace(',', '.'))} onBlur={()=>{angleEditing.current=false;if(angle!==undefined&&!angleText.trim())setAngleText(String(angle));}}/></label>
      <button disabled={disabled||!angleValid}>Açıyı uygula</button>
    </form>
    <div className="rotation-control">
      <label>Elle çevirme adımı, derece<input type="text" inputMode="decimal" value={step} disabled={disabled} onFocus={e=>e.currentTarget.select()} onChange={e=>setStep(e.target.value.replace(',', '.'))}/></label>
      <div className="row-actions"><button type="button" disabled={disabled||!stepValid} onClick={()=>onRotate(stepValue)}>Sola ↺</button><button type="button" disabled={disabled||!stepValid} onClick={()=>onRotate(-stepValue)}>Sağa ↻</button></div>
      <small>Tuvaldeki döndürme kolunu fareyle sürükleyerek de çevirebilirsiniz.</small>
    </div>
    <div className="mirror-control"><div className="row-actions"><button type="button" aria-pressed={mirroredX===true} disabled={disabled} onClick={()=>onMirror('x')}>Yatay aynala</button><button type="button" aria-pressed={mirroredY===true} disabled={disabled} onClick={()=>onMirror('y')}>Dikey aynala</button></div></div>
  </>;
}
