import {cloneElement,useId,type CSSProperties,type InputHTMLAttributes,type LabelHTMLAttributes,type ReactElement,type ReactNode} from 'react';
import {useI18n} from '../i18n';
import {controlText} from './controlText';

/** Keep the original native input, label association and every event handler. */
export function WaveField({caption,children,className='',...props}:Omit<LabelHTMLAttributes<HTMLLabelElement>,'children'> & {
  caption:ReactNode;children:ReactElement<InputHTMLAttributes<HTMLInputElement>>;
}){
  const {locale,t}=useI18n(),captionId=useId(),text=controlText(caption,t);
  const letters=locale==='ar'||locale==='fa'?[text]:Array.from(text);
  return <label {...props} className={`wave-field ${className}`}>
    <span className="wave-caption"><span className="control-sr-only" id={captionId}>{caption}</span><span aria-hidden="true" data-no-i18n className="wave-letters">{letters.map((letter,index)=><span key={index} style={{'--letter-index':index} as CSSProperties}>{letter===' '?'\u00a0':letter}</span>)}</span></span>
    {cloneElement(children,{'aria-labelledby':children.props['aria-labelledby']??(children.props['aria-label']?undefined:captionId),placeholder:children.props.placeholder??' ',className:`wave-input ${children.props.className??''}`})}
    <span className="wave-bar" aria-hidden="true"/>
  </label>;
}

export {GlassSelect} from './GlassSelect';

export function SettingsIcon(){
  return <svg className="settings-gear" aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none"><g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle r="2.5" cx="10" cy="10"/><path d="m8.39079 2.80235c.53842-1.51424 2.67991-1.51424 3.21831 0 .3392.95358 1.4284 1.40477 2.3425.97027 1.4514-.68995 2.9657.82427 2.2758 2.27575-.4345.91407.0166 2.00334.9702 2.34248 1.5143.53842 1.5143 2.67996 0 3.21836-.9536.3391-1.4047 1.4284-.9702 2.3425.6899 1.4514-.8244 2.9656-2.2758 2.2757-.9141-.4345-2.0033.0167-2.3425.9703-.5384 1.5142-2.67989 1.5142-3.21831 0-.33914-.9536-1.4284-1.4048-2.34247-.9703-1.45148.6899-2.96571-.8243-2.27575-2.2757.43449-.9141-.01669-2.0034-.97028-2.3425-1.51422-.5384-1.51422-2.67994 0-3.21836.95358-.33914 1.40476-1.42841.97027-2.34248-.68996-1.45148.82427-2.9657 2.27575-2.27575.91407.4345 2.00333-.01669 2.34247-.97026Z"/></g></svg>;
}

export function RocketIcon(){
  return <svg className="launch-rocket" aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="currentColor"><path d="M5 13c0-5.088 2.903-9.436 7-11.182C16.097 3.564 19 7.912 19 13c0 .823-.076 1.626-.22 2.403l1.94 1.832a.5.5 0 0 1 .095.603l-2.495 4.575a.5.5 0 0 1-.793.114l-2.234-2.234a1 1 0 0 0-.707-.293H9.414a1 1 0 0 0-.707.293l-2.234 2.234a.5.5 0 0 1-.793-.114l-2.495-4.575a.5.5 0 0 1 .095-.603l1.94-1.832A12.5 12.5 0 0 1 5 13Zm1.476 6.696.817-.817A3 3 0 0 1 9.414 18h5.172a3 3 0 0 1 2.121.879l.817.817.982-1.8-1.1-1.04a2 2 0 0 1-.593-1.82c.124-.664.187-1.345.187-2.036 0-3.87-1.995-7.3-5-8.96C8.995 5.7 7 9.13 7 13c0 .691.063 1.372.187 2.037a2 2 0 0 1-.593 1.82l-1.1 1.039.982 1.8ZM12 13a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"/></svg>;
}

export function DownloadIcon(){
  return <svg className="download-button__icon reference-download-icon" aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M1 14.5a6.496 6.496 0 0 1 3.064-5.519 8.001 8.001 0 0 1 15.872 0 6.5 6.5 0 0 1-2.936 12L7 21c-3.356-.274-6-3.078-6-6.5zm15.848 4.487a4.5 4.5 0 0 0 2.03-8.309l-.807-.503-.12-.942a6.001 6.001 0 0 0-11.903 0l-.12.942-.805.503a4.5 4.5 0 0 0 2.029 8.309l.173.013h9.35l.173-.013zM13 12h3l-4 5-4-5h3V8h2v4z"/></svg>;
}

export function WaitingIndicator({className=''}:{className?:string}){
  return <span className={`reference-loader ${className}`} aria-hidden="true">
    {Array.from({length:9},(_,index)=><span className="reference-loader-rail" key={index} style={{'--rail-index':index} as CSSProperties}><span className="reference-loader-ball"/></span>)}
  </span>;
}
