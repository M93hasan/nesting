import { useEffect, useState } from 'react';

/** Reads user-authorized CAD examples and bridge permissions; no local edits. */
export function useCadAccess() {
  const [testDxfOpen,setTestDxfOpen]=useState(false);
  const [testDxfFiles,setTestDxfFiles]=useState<string[]>([]);
  const [testDxfAllowed,setTestDxfAllowed]=useState(false);
  const [transferAccess,setTransferAccess]=useState({corel:false});
  useEffect(()=>{
    let cancelled=false;
    const refresh=async()=>{
      try{
        const response=await fetch('/api/test-dxf',{credentials:'same-origin',cache:'no-store'});
        const data=await response.json().catch(()=>({}));
        if(!cancelled){
          const allowed=response.ok&&data.allowed===true;
          setTestDxfAllowed(allowed);
          if(!allowed){setTestDxfOpen(false);setTestDxfFiles([]);}
          else{
            try{
              const catalogResponse=await fetch('/examples/test%20klasoru%20dxf/catalog.json',{cache:'no-store'});
              const catalog=await catalogResponse.json() as {files?:unknown};
              const names=Array.isArray(catalog.files)?catalog.files.filter((name):name is string=>typeof name==='string'&&/\.dxf$/i.test(name)):[];
              if(!cancelled)setTestDxfFiles(names);
            }catch{if(!cancelled)setTestDxfFiles([])}
          }
        }
      }catch{if(!cancelled){setTestDxfAllowed(false);setTestDxfOpen(false)}}
    };
    void refresh();
    const timer=setInterval(()=>void refresh(),10000);
    const changed=()=>void refresh();
    window.addEventListener('serula-auth-updated',changed);
    window.addEventListener('focus',changed);
    return()=>{cancelled=true;clearInterval(timer);window.removeEventListener('serula-auth-updated',changed);window.removeEventListener('focus',changed)};
  },[]);
  useEffect(()=>{
    let active=true;
    const refresh=async()=>{
      try{
        const response=await fetch('/api/transfer/access',{credentials:'same-origin',cache:'no-store'});
        const data=await response.json() as {corel?:boolean};
        if(active)setTransferAccess({corel:response.ok&&data.corel===true});
      }catch{if(active)setTransferAccess({corel:false});}
    };
    void refresh();
    const timer=window.setInterval(()=>void refresh(),15000);
    window.addEventListener('serula-auth-updated',refresh);
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener('serula-auth-updated',refresh)};
  },[]);
  return {testDxfOpen,setTestDxfOpen,testDxfFiles,testDxfAllowed,transferAccess};
}
