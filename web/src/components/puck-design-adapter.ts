import {DESIGN_ZONES,cleanZoneStyles,type DesignZone,type ZoneStyle,type ZoneStyles} from './design-zone-styles';

// Puck is an editing surface only. The Worker continues to accept the original
// allowlisted serula-design-v1 document; Puck's free-form JSON is never sent.
export type StudioDesign={
  background:string;panel:string;accent:string;radius:number;spacing:number;fontSize:number;heading:string;
  workspaceOrder?:string[];zoneStyles?:ZoneStyles;
  hidden?:string[];order?:string[];positions?:Record<string,{x:number;y:number}>;
};
export const DEFAULT_STUDIO_DESIGN:StudioDesign={
  background:'#121421',panel:'#242935',accent:'#5278ed',radius:12,spacing:16,fontSize:15,heading:'Serula çalışma alanı'
};
export const PUCK_ZONE_NAMES:Record<DesignZone,string>={
  header:'Üst başlık',parts:'Parçalar paneli',canvas:'Çalışma alanı',material:'Malzeme ayarları',
  actions:'İşlem bölgesi',runButton:'Yerleştir butonu',corelButton:'CorelDRAW butonu',downloadButton:'DXF İndir butonu'
};
const HEX=/^#[0-9a-f]{6}$/i;
const MAIN_PANELS=['parts','canvas','material'];
const SAMPLE_LAYERS=['Başlık','Ana panel','Birincil buton'];
const isObject=(x:unknown):x is Record<string,unknown>=>typeof x==='object'&&x!==null&&!Array.isArray(x);
const inRange=(x:unknown,min:number,max:number)=>typeof x==='number'&&Number.isInteger(x)&&x>=min&&x<=max;
const isPanelOrder=(x:unknown):x is string[]=>Array.isArray(x)&&x.length===3&&new Set(x).size===3&&MAIN_PANELS.every(p=>x.includes(p));
export function parseStudioDesign(input:unknown):StudioDesign|null{
  if(!isObject(input)||!HEX.test(String(input.background))||!HEX.test(String(input.panel))||!HEX.test(String(input.accent)))return null;
  if(!inRange(input.radius,0,32)||!inRange(input.spacing,8,40)||!inRange(input.fontSize,12,22))return null;
  if(typeof input.heading!=='string'||input.heading.length>80||/[<>\x00-\x1f]/.test(input.heading))return null;
  const result:StudioDesign={
    background:input.background as string,panel:input.panel as string,accent:input.accent as string,
    radius:input.radius as number,spacing:input.spacing as number,fontSize:input.fontSize as number,heading:input.heading
  };
  if(isPanelOrder(input.workspaceOrder))result.workspaceOrder=[...input.workspaceOrder];
  const zones=cleanZoneStyles(input.zoneStyles);
  if(Object.keys(zones).length)result.zoneStyles=zones;
  // Preserve the old editor's metadata so migrating to Puck cannot discard it.
  if(Array.isArray(input.hidden)&&input.hidden.every(x=>SAMPLE_LAYERS.includes(x)))result.hidden=[...input.hidden];
  if(Array.isArray(input.order)&&input.order.length===3&&new Set(input.order).size===3&&SAMPLE_LAYERS.every(x=>input.order.includes(x))&&input.order[2]==='Birincil buton')result.order=[...input.order];
  if(isObject(input.positions)&&Object.keys(input.positions).every(k=>SAMPLE_LAYERS.includes(k)&&isObject(input.positions![k])&&inRange((input.positions![k] as Record<string,unknown>).x,0,80)&&inRange((input.positions![k] as Record<string,unknown>).y,0,80))){
    result.positions=Object.fromEntries(Object.entries(input.positions).map(([k,v])=>[k,{x:(v as {x:number}).x,y:(v as {y:number}).y}]));
  }
  return result;
}
export function loadStudioDesign():StudioDesign{
  try{const json=localStorage.getItem('serula-design-studio-draft-v1');return (json?parseStudioDesign(JSON.parse(json)):null)??DEFAULT_STUDIO_DESIGN;}
  catch{return DEFAULT_STUDIO_DESIGN;}
}
export function toPuckData(design:StudioDesign){
  const order=design.workspaceOrder??MAIN_PANELS;
  const sorted=[...DESIGN_ZONES].sort((a,b)=>{
    if(!MAIN_PANELS.includes(a)||!MAIN_PANELS.includes(b))return 0;
    return order.indexOf(a)-order.indexOf(b);
  });
  return {
    content:sorted.map(zone=>({type:'Zone' as const,props:{id:'serula-'+zone,zone,...design.zoneStyles?.[zone]}})),
    root:{props:{background:design.background,panel:design.panel,accent:design.accent,radius:design.radius,spacing:design.spacing,fontSize:design.fontSize,heading:design.heading}}
  };
}
export function fromPuckData(input:unknown,original:StudioDesign):StudioDesign|null{
  if(!isObject(input)||!Array.isArray(input.content)||input.content.length!==DESIGN_ZONES.length)return null;
  const root=isObject(input.root)&&isObject(input.root.props)?input.root.props:null;
  if(!root)return null;
  const base=parseStudioDesign({...original,...root});
  if(!base)return null;
  const zones:Record<string,unknown>={};
  const seen=new Set<string>();
  const panelOrder:string[]=[];
  for(const item of input.content as unknown[]){
    if(!isObject(item)||item.type!=='Zone'||!isObject(item.props))return null;
    const props=item.props,zone=props.zone;
    if(typeof zone!=='string'||!DESIGN_ZONES.some(z=>z===zone)||props.id!=='serula-'+zone||seen.has(zone))return null;
    seen.add(zone);
    if(MAIN_PANELS.includes(zone))panelOrder.push(zone);
    const style:Record<string,unknown>={};
    for(const key of ['background','color','radius','spacing','fontSize','shadow','text','offsetX','offsetY'] as (keyof ZoneStyle)[]){
      if(props[key]!==undefined&&props[key]!==null&&props[key]!=='')style[key]=props[key];
    }
    zones[zone]=style;
  }
  if(seen.size!==DESIGN_ZONES.length||!isPanelOrder(panelOrder))return null;
  return {...base,zoneStyles:cleanZoneStyles(zones),workspaceOrder:panelOrder};
}
