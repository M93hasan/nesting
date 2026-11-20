import { useEffect, useState } from 'react';
import { cleanZoneStyles, type ZoneStyles } from '../../components/design-zone-styles';
import { cleanBlocks, type DesignBlock } from '../../components/design-blocks';

/** All visual-preview effects are isolated from the CAD editor state. */
export function useDesignStudioAppearance() {
  // An explicit URL flag is required. The editor preview never changes the normal application.
  const designPreviewEnabled=typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('design-preview')==='1';
  const [designPreview,setDesignPreview]=useState<{background:string;panel:string;accent:string;radius:number;spacing:number;fontSize:number;workspaceOrder?:string[];zoneStyles?:ZoneStyles;blocks?:DesignBlock[]}|null>(null);
  const [publishedVisual,setPublishedVisual]=useState<{background:string;panel:string;accent:string;radius:number;spacing:number;fontSize:number;workspaceOrder?:string[];zoneStyles?:ZoneStyles;blocks?:DesignBlock[]}|null>(null);
  useEffect(()=>{
    if(designPreviewEnabled)return;
    let active=true;
    const read=async()=>{
      try{
        const response=await fetch('/api/design/published',{credentials:'same-origin',cache:'no-store'});
        if(!response.ok)return;
        const data:unknown=await response.json();
        const d=(data as {published?:{design?:Record<string,unknown>}|null})?.published?.design;
        if(!d){if(active)setPublishedVisual(null);return;}
        const color=/^#[0-9a-f]{6}$/i;
        if(!['background','panel','accent'].every(k=>typeof d[k]==='string'&&color.test(d[k] as string)))return;
        if(!([['radius',0,32],['spacing',8,40],['fontSize',12,22]] as const).every(([k,lo,hi])=>typeof d[k]==='number'&&Number.isFinite(d[k])&&(d[k] as number)>=lo&&(d[k] as number)<=hi))return;
        const orderCandidate=d.workspaceOrder;
        const workspaceOrder=Array.isArray(orderCandidate)&&orderCandidate.length===3&&new Set(orderCandidate).size===3&&['parts','canvas','material'].every(x=>orderCandidate.includes(x))?[...orderCandidate] as string[]:undefined;
        if(active)setPublishedVisual({background:d.background as string,panel:d.panel as string,accent:d.accent as string,radius:d.radius as number,spacing:d.spacing as number,fontSize:d.fontSize as number,workspaceOrder,zoneStyles:cleanZoneStyles(d.zoneStyles),blocks:cleanBlocks(d.blocks)});
      }catch{/* Published design failure must never block Nesting functionality. */}
    };
    void read();window.addEventListener('focus',read);
    return()=>{active=false;window.removeEventListener('focus',read);};
  },[designPreviewEnabled]);
  useEffect(()=>{
    if(!designPreviewEnabled)return;
    const update=()=>{
      try{
        const raw=localStorage.getItem('serula-design-studio-live-preview-v1');
        const value:unknown=JSON.parse(raw??'null');
        if(!value||typeof value!=='object')return;
        const d=value as Record<string,unknown>,color=/^#[0-9a-f]{6}$/i;
        if(!['background','panel','accent'].every(k=>typeof d[k]==='string'&&color.test(d[k] as string)))return;
        if(!([['radius',0,32],['spacing',8,40],['fontSize',12,22]] as const).every(([k,lo,hi])=>typeof d[k]==='number'&&(d[k] as number)>=lo&&(d[k] as number)<=hi))return;
        const orderCandidate=d.workspaceOrder;
        const workspaceOrder=Array.isArray(orderCandidate)&&orderCandidate.length===3&&new Set(orderCandidate).size===3&&['parts','canvas','material'].every(x=>orderCandidate.includes(x))?[...orderCandidate] as string[]:undefined;
        setDesignPreview({background:d.background as string,panel:d.panel as string,accent:d.accent as string,radius:d.radius as number,spacing:d.spacing as number,fontSize:d.fontSize as number,workspaceOrder,zoneStyles:cleanZoneStyles(d.zoneStyles),blocks:cleanBlocks(d.blocks)});
      }catch{/* Keep the original style when preview data is invalid. */}
    };
    const onRefresh=(event:MessageEvent)=>{
      if(event.origin===window.location.origin&&event.source===window.parent&&event.data==='serula-design-preview-refresh')update();
    };
    update();window.addEventListener('storage',update);window.addEventListener('message',onRefresh);
    return()=>{window.removeEventListener('storage',update);window.removeEventListener('message',onRefresh);};
  },[designPreviewEnabled]);
  return { designPreviewEnabled, designPreview, publishedVisual };
}
