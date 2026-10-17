import {Children,isValidElement,type ReactNode} from 'react';

export function controlText(node:ReactNode,translate:(text:string)=>string=text=>text):string{
  return Children.toArray(node).map(child=>{
    if(typeof child==='string'){
      const trimmed=child.trim();
      return trimmed?child.replace(trimmed,translate(trimmed)):child;
    }
    if(typeof child==='number')return String(child);
    if(isValidElement<{children?:ReactNode;className?:string}>(child))return (child.props.className?.includes('__unit')?' ':'')+controlText(child.props.children,translate);
    return '';
  }).join('');
}
