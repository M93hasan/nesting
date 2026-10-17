import {createContext,useCallback,useContext,useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';

export type Appearance={background:string;panel:string};
export const DEFAULT_APPEARANCE:Appearance={background:'#2f396b',panel:'#192142'};
export function parseAppearance(value:unknown):Appearance|null{
  if(!value||typeof value!=='object')return null;
  const input=value as Partial<Appearance>;
  return typeof input.background==='string'&&/^#[0-9a-f]{6}$/i.test(input.background)&&typeof input.panel==='string'&&/^#[0-9a-f]{6}$/i.test(input.panel)
    ?{background:input.background.toLowerCase(),panel:input.panel.toLowerCase()}:null;
}
type AppearanceContextValue={appearance:Appearance;loaded:boolean;error:string;preview:(value:Appearance|null)=>void;reload:()=>void;save:(value:Appearance)=>Promise<Appearance>};
const AppearanceContext=createContext<AppearanceContextValue|null>(null);

export function AppearanceProvider({children}:{children:ReactNode}){
  const [appearance,setAppearance]=useState(DEFAULT_APPEARANCE),[draft,setDraft]=useState<Appearance|null>(null);
  const [loaded,setLoaded]=useState(false),[error,setError]=useState('');
  const alive=useRef(true),generation=useRef(0),saving=useRef(false);
  const reload=useCallback(async()=>{
    if(saving.current)return;
    const version=++generation.current;
    try{
      const response=await fetch('/api/appearance',{credentials:'same-origin',cache:'no-store'});
      if(!response.ok)throw Error('Renkler yüklenemedi.');
      const value=parseAppearance((await response.json()).appearance);
      if(!value)throw Error('Renkler yüklenemedi.');
      if(alive.current&&generation.current===version){setAppearance(value);setLoaded(true);setError('');}
    }catch{
      if(alive.current&&generation.current===version)setError('Renkler yüklenemedi.');
    }
  },[]);
  useEffect(()=>{
    alive.current=true;void reload();
    const refresh=()=>{if(document.visibilityState==='visible')void reload();};
    const timer=window.setInterval(refresh,30000);
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    return()=>{alive.current=false;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[reload]);
  useLayoutEffect(()=>{
    const colors=draft??appearance;
    document.documentElement.style.setProperty('--appearance-background',colors.background);
    document.documentElement.style.setProperty('--appearance-panel',colors.panel);
  },[appearance,draft]);
  const save=useCallback(async(value:Appearance)=>{
    const valid=parseAppearance(value);if(!valid)throw Error('Geçerli renkler seçin.');
    saving.current=true;generation.current++;
    try{
      const response=await fetch('/api/admin/appearance',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({appearance:valid})});
      const data=await response.json().catch(()=>({})),saved=parseAppearance(data.appearance);
      if(!response.ok||!saved)throw Error(data.error||'Renkler kaydedilemedi.');
      generation.current++;
      if(alive.current){setAppearance(saved);setDraft(null);setLoaded(true);setError('');}
      return saved;
    }finally{saving.current=false;}
  },[]);
  return <AppearanceContext.Provider value={{appearance,loaded,error,preview:setDraft,reload,save}}>{children}</AppearanceContext.Provider>;
}
export function useAppearance(){
  const context=useContext(AppearanceContext);
  if(!context)throw Error('AppearanceProvider is required.');
  return context;
}
