import {Children,isValidElement,useRef,useState,type CSSProperties,type ReactNode,type SelectHTMLAttributes} from 'react';
import {controlText} from './controlText';

type Option={value:string;label:string;disabled:boolean};
function optionsOf(children:ReactNode,groupDisabled=false):Option[]{
  return Children.toArray(children).flatMap(child=>{
    if(!isValidElement<{children?:ReactNode;value?:string|number;disabled?:boolean}>(child))return [];
    if(child.type==='option')return [{value:String(child.props.value??controlText(child.props.children)),label:controlText(child.props.children),disabled:groupDisabled||!!child.props.disabled}];
    return optionsOf(child.props.children,groupDisabled||!!child.props.disabled);
  });
}

/** Native select remains the single accessible/keyboard control. Short lists
 * gain pointer shortcuts; long or dynamic lists retain their native dropdown. */
export function GlassSelect({children,className='',onChange,...props}:SelectHTMLAttributes<HTMLSelectElement>){
  const select=useRef<HTMLSelectElement>(null),options=optionsOf(children);
  const [uncontrolled,setUncontrolled]=useState(String(props.defaultValue??options[0]?.value??''));
  const value=String(props.value??uncontrolled),index=options.findIndex(option=>option.value===value);
  const segmented=!props.multiple&&!props.size&&options.length>=2&&options.length<=3&&
    options.every(option=>option.value!==''&&option.label.length<=22);
  const choose=(option:Option)=>{
    const element=select.current;
    if(!element||element.matches(':disabled')||option.disabled||element.value===option.value)return;
    element.focus({preventScroll:true});element.value=option.value;
    element.dispatchEvent(new Event('change',{bubbles:true}));
  };
  return <span className={`glass-select ${segmented?'glass-select--segmented':''}`} data-disabled={props.disabled||undefined}
    style={{'--choice-count':options.length,'--choice-index':Math.max(0,index)} as CSSProperties}>
    <select {...props} ref={select} className={`${className} ${segmented?'glass-select-native':''}`} onChange={event=>{
      setUncontrolled(event.currentTarget.value);onChange?.(event);
    }}>{children}</select>
    {segmented&&<span className="glass-choices" aria-hidden="true">
      <span className="glass-glider" data-choice={index}/>
      {options.map(option=><span key={option.value} className="glass-choice" data-disabled={option.disabled||undefined}
        onPointerDown={event=>{event.preventDefault();select.current?.focus({preventScroll:true});}}
        onClick={event=>{event.preventDefault();choose(option);}}>{option.label}</span>)}
    </span>}
  </span>;
}
