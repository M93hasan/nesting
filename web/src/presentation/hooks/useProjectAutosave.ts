import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { Document, Result } from '../../model';
import type { DisplayUnit } from '../../units';
import type { RecoveryStore } from '../../application/ports/RecoveryStore';
import { HttpProjectAutosave } from '../../infrastructure/persistence/HttpProjectAutosave';
import { autosaveProject } from '../../application/use-cases/AutosaveProject';

const cloudAutosave = new HttpProjectAutosave();
const CLOUD_SAVE_NAME = 'Serula Nesting En Temiz Hali';
type BrowserSave = { document: Document; result?: Result; revision: number };
type CloudSaveState = 'idle' | 'saving' | 'saved' | 'signed-out' | 'error';

export function useProjectAutosave({
  doc,recoveryResult,revision,loadingExample,recoveryReady,invalidSettings,polygonOpen,unit,cloudSaveTick,
  recoveryStore,setBrowserSaved,setRecoveryError,setCloudSaveState,
}: {
  doc:Document; recoveryResult?:Result; revision:number; loadingExample:boolean; recoveryReady:boolean;
  invalidSettings:boolean; polygonOpen:boolean; unit:DisplayUnit; cloudSaveTick:number;
  recoveryStore:RecoveryStore;
  setBrowserSaved:Dispatch<SetStateAction<BrowserSave|undefined>>;
  setRecoveryError:Dispatch<SetStateAction<string>>;
  setCloudSaveState:Dispatch<SetStateAction<CloudSaveState>>;
}) {
  useEffect(()=>{
    if(!recoveryReady||loadingExample||invalidSettings||!doc.name.trim())return;
    const project={...doc,...(recoveryResult?{placements:recoveryResult.placements,result:recoveryResult}:{}),schemaVersion:1 as const,revision};
    let written=false,active=true;
    const write=()=>{
      if(written)return;written=true;
      void recoveryStore.saveLatest(project).then(()=>{if(active){setBrowserSaved({document:doc,result:recoveryResult,revision});setRecoveryError('');}},()=>{if(active)setRecoveryError('Değişiklikler bu tarayıcıya kaydedilemedi. Bir kopya saklamak için projeyi dışa aktarın.');});
    };
    const timer=setTimeout(write,500);
    const hidden=()=>{if(document.visibilityState==='hidden')write();};
    window.addEventListener('pagehide',write);document.addEventListener('visibilitychange',hidden);
    return ()=>{active=false;clearTimeout(timer);window.removeEventListener('pagehide',write);document.removeEventListener('visibilitychange',hidden);};
  },[doc,recoveryResult,revision,loadingExample,recoveryReady,invalidSettings]);
  useEffect(()=>{
    if(!recoveryReady||loadingExample||invalidSettings||polygonOpen||!doc.name.trim())return;
    const project={...doc,...(recoveryResult?{placements:recoveryResult.placements,result:recoveryResult}:{}),schemaVersion:1 as const,revision,serulaCloud:{label:CLOUD_SAVE_NAME,ui:{unit}}};
    let active=true,written=false;
    setCloudSaveState('saving');
    const write=async()=>{
      if(written)return;written=true;
      try{
        const outcome=await autosaveProject(cloudAutosave,doc.name,JSON.stringify(project));
        if(!active)return;
        setCloudSaveState(outcome);
      }catch{if(active)setCloudSaveState('error')}
    };
    const timer=setTimeout(()=>void write(),1200);
    const hidden=()=>{if(document.visibilityState==='hidden')void write();};
    window.addEventListener('pagehide',write);document.addEventListener('visibilitychange',hidden);
    return()=>{active=false;clearTimeout(timer);window.removeEventListener('pagehide',write);document.removeEventListener('visibilitychange',hidden)};
  },[doc,recoveryResult,revision,loadingExample,recoveryReady,invalidSettings,polygonOpen,unit,cloudSaveTick]);
}
