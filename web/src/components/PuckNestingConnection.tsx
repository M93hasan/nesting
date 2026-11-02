import type {Config,Data} from '@puckeditor/core';
import type {CSSProperties} from 'react';
import {cleanZoneStyles,type ZoneStyles} from './design-zone-styles';

/** Real, allowlisted Nesting UI regions. These are NOT simulated project data. */
export type ConnectedRoot={
  background:string;panel:string;accent:string;heading:string;
  radius:number;spacing:number;fontSize:number;
};
export type ConnectedZone={
  text:string;background:string;color:string;
  radius:number;spacing:number;fontSize:number;shadow:number;
  offsetX:number;offsetY:number;
};
type Names='Header'|'Parts'|'Canvas'|'Material'|'Actions'|'RunButton'|'CorelButton'|'DownloadButton';
export type ConnectedBlocks=Record<Names,ConnectedZone>;
export type ConnectedPage=Data<ConnectedBlocks,ConnectedRoot>;
export type NestingDesign=ConnectedRoot&{workspaceOrder:string[];zoneStyles:ZoneStyles};

export const zoneComponentIds:Record<Names,keyof ZoneStyles>={
  Header:'header',Parts:'parts',Canvas:'canvas',Material:'material',
  Actions:'actions',RunButton:'runButton',CorelButton:'corelButton',DownloadButton:'downloadButton'
};
const componentNames=Object.keys(zoneComponentIds) as Names[];
const buttonZones=new Set<Names>(['RunButton','CorelButton','DownloadButton']);
const labels:Record<Names,string>={
  Header:'Üst başlık',Parts:'Gerçek parça paneli',Canvas:'Gerçek yerleşim alanı',
  Material:'Gerçek malzeme paneli',Actions:'Alt işlem çubuğu',
  RunButton:'Yerleştirme butonu',CorelButton:'CorelDRAW aktarımı',DownloadButton:'DXF indirme'
};
const defaultText:Record<Names,string>={
  Header:'Akıllı DXF yerleştirme ve malzeme optimizasyonu',
  Parts:'Parçalar',Canvas:'Çalışma alanı',Material:'Malzeme ve Yerleşim',
  Actions:'',RunButton:'Yerleştir',CorelButton:"CorelDRAW'a Aktar",DownloadButton:'DXF İndir'
};
const color=/^#[0-9a-f]{6}$/i;
export const defaultConnectedRoot:ConnectedRoot={
  background:'#121421',panel:'#242935',accent:'#5278ed',
  heading:'Serula çalışma alanı',radius:12,spacing:16,fontSize:15
};
function defaultZone(name:Names):ConnectedZone{
  return {text:defaultText[name],background:'#242935',color:'#ffffff',radius:12,
    spacing:16,fontSize:15,shadow:0,offsetX:0,offsetY:0};
}
export const initialConnectedPage:ConnectedPage={
  root:{props:{...defaultConnectedRoot}},
  content:componentNames.map(type=>({type,props:{id:'nesting-'+zoneComponentIds[type],...defaultZone(type)}}))
};

function clamp(value:unknown,lo:number,hi:number,fallback:number){
  return typeof value==='number'&&Number.isFinite(value)?Math.min(hi,Math.max(lo,Math.round(value))):fallback;
}
function validColor(value:unknown,fallback:string):string{
  return typeof value==='string'&&color.test(value)?value.toLowerCase():fallback;
}
function safeText(value:unknown,fallback:string):string{
  return typeof value==='string'&&value.length<=80&&!/[<>\x00-\x1f]/.test(value)?value:fallback;
}
/** Validate untrusted local JSON instead of loading arbitrary component markup. */
export function parseConnectedPage(input:unknown):ConnectedPage|null{
  if(!input||typeof input!=='object'||Array.isArray(input))return null;
  const d=input as Partial<ConnectedPage>;
  if(!d.root?.props||!Array.isArray(d.content)||d.content.length!==componentNames.length)return null;
  const root=d.root.props as Record<string,unknown>;
  if(!['background','panel','accent'].every(k=>typeof root[k]==='string'&&color.test(root[k] as string)))return null;
  if(typeof root.heading!=='string'||root.heading.length>80||/[<>\x00-\x1f]/.test(root.heading))return null;
  if(!(['radius','spacing','fontSize'] as const).every(key=>typeof root[key]==='number'&&Number.isInteger(root[key])))return null;
  const types=new Set<string>();
  for(const block of d.content){
    if(!block||!componentNames.includes(block.type as Names)||types.has(block.type)||!block.props||typeof block.props!=='object')return null;
    types.add(block.type);
    const p=block.props as Record<string,unknown>;
    if(typeof p.id!=='string'||p.id.length>160||p.id!==('nesting-'+zoneComponentIds[block.type as Names]))return null;
    if(!['background','color'].every(k=>typeof p[k]==='string'&&color.test(p[k] as string)))return null;
    if(typeof p.text!=='string'||p.text.length>80||/[<>\x00-\x1f]/.test(p.text))return null;
    if(!['radius','spacing','fontSize','shadow','offsetX','offsetY'].every(k=>typeof p[k]==='number'&&Number.isInteger(p[k])))return null;
  }
  return types.size===componentNames.length?input as ConnectedPage:null;
}
/** Translate Puck field edits to the SAME server-validated design used by live App.tsx. */
export function toNestingDesign(input:ConnectedPage):NestingDesign{
  const root=input.root.props;
  const mapped:ConnectedRoot={
    background:validColor(root.background,defaultConnectedRoot.background),
    panel:validColor(root.panel,defaultConnectedRoot.panel),
    accent:validColor(root.accent,defaultConnectedRoot.accent),
    heading:safeText(root.heading,defaultConnectedRoot.heading),
    radius:clamp(root.radius,0,32,12),spacing:clamp(root.spacing,8,40,16),
    fontSize:clamp(root.fontSize,12,22,15)
  };
  const styles:Record<string,unknown>={};
  for(const block of input.content){
    const name=block.type as Names;
    const zone=zoneComponentIds[name];
    if(!zone||styles[zone])continue;
    const p=block.props as ConnectedZone;
    const base={background:validColor(p.background,'#242935'),color:validColor(p.color,'#ffffff'),
      radius:clamp(p.radius,0,32,12),spacing:clamp(p.spacing,0,48,16),
      fontSize:clamp(p.fontSize,11,24,15),shadow:clamp(p.shadow,0,32,0)};
    const item:Record<string,unknown>={...base};
    if(name!=='Actions')item.text=safeText(p.text,defaultText[name]);
    if(buttonZones.has(name)){item.offsetX=clamp(p.offsetX,-80,80,0);item.offsetY=clamp(p.offsetY,-80,80,0);}
    styles[zone]=item;
  }
  const order=input.content.map(item=>zoneComponentIds[item.type as Names]).filter(id=>['parts','canvas','material'].includes(id));
  return {...mapped,workspaceOrder:order.length===3&&new Set(order).size===3?order:['parts','canvas','material'],
    zoneStyles:cleanZoneStyles(styles)};
}

const styleFields={
  background:{type:'text' as const,label:'Arka plan rengi (#RRGGBB)'},
  color:{type:'text' as const,label:'Yazı rengi (#RRGGBB)'},
  radius:{type:'number' as const,label:'Köşe yarıçapı',min:0,max:32},
  spacing:{type:'number' as const,label:'İç boşluk (px)',min:0,max:48},
  fontSize:{type:'number' as const,label:'Yazı boyutu',min:11,max:24},
  shadow:{type:'number' as const,label:'Gölge',min:0,max:32}
};
function component(name:Names){
  const isAction=name==='Actions';
  const fields={
    ...(!isAction?{text:{type:'text' as const,label:'Gerçek ekrandaki yazı'}}:{}),
    ...styleFields,
    ...(buttonZones.has(name)?{offsetX:{type:'number' as const,label:'Yatay konum (px)',min:-80,max:80},
      offsetY:{type:'number' as const,label:'Dikey konum (px)',min:-80,max:80}}:{})
  };
  return {
    label:labels[name],
    fields,
    defaultProps:defaultZone(name),
    render:(p:ConnectedZone)=><div className="puck-connected-region" data-connected-zone={zoneComponentIds[name]}
      style={{borderLeft:'4px solid '+validColor(p.background,'#242935')}}>
      <strong>{labels[name]}</strong><span>{isAction?'Çalışan uygulamanın alt işlem çubuğu':p.text}</span>
      <small>Gerçek Nesting bölgesi · sağ panelde düzenle</small>
    </div>
  };
}
export const connectedPuckConfig:Config<ConnectedBlocks,ConnectedRoot>={
  categories:{
    real:{title:'GERÇEK NESTING BÖLGELERİ',components:['Header','Parts','Canvas','Material','Actions']},
    buttons:{title:'GERÇEK İŞLEM BUTONLARI',components:['RunButton','CorelButton','DownloadButton']}
  },
  root:{
    defaultProps:defaultConnectedRoot,
    fields:{
      background:{type:'text',label:'Uygulama arka planı (#RRGGBB)'},
      panel:{type:'text',label:'Panel rengi (#RRGGBB)'},
      accent:{type:'text',label:'Vurgu rengi (#RRGGBB)'},
      heading:{type:'text',label:'Düzen başlığı'},
      radius:{type:'number',label:'Köşe yarıçapı',min:0,max:32},
      spacing:{type:'number',label:'Genel boşluk',min:8,max:40},
      fontSize:{type:'number',label:'Genel yazı boyutu',min:12,max:22}
    },
    render:({puck:{renderDropZone:DropZone}})=><div className="puck-connected-canvas">
      <div className="puck-connected-intro"><strong>Gerçek Nesting ekranı bağlantısı</strong>
        <span>Aşağıdaki bölgeler uygulamadaki gerçek panellere bağlanır. Yerleştirme ve DXF işlemleri değiştirilmez.</span>
      </div>
      <DropZone zone="default-zone" className="puck-connected-sections"/>
      <div className="puck-connected-real-app">
        <strong>Gerçek uygulama · canlı ve salt okunur önizleme</strong>
        <iframe title="Gerçek Nesting canlı önizleme" src={import.meta.env.BASE_URL+'?design-preview=1'}
          onLoad={e=>e.currentTarget.contentWindow?.postMessage('serula-design-preview-refresh',window.location.origin)}
          style={{width:1440,height:770,flexShrink:0,pointerEvents:'none'}}/>
      </div>
    </div>
  },
  components:{
    Header:component('Header'),Parts:component('Parts'),Canvas:component('Canvas'),
    Material:component('Material'),Actions:component('Actions'),
    RunButton:component('RunButton'),CorelButton:component('CorelButton'),DownloadButton:component('DownloadButton')
  }
};
