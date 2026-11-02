// Only explicitly named structural UI zones can be styled by an admin design draft.
// Never accept arbitrary selectors, HTML, or CSS from browser/server payloads.
export const DESIGN_ZONES=['header','parts','canvas','material','actions'] as const;
export type DesignZone=typeof DESIGN_ZONES[number];
export type ZoneStyle={background?:string;color?:string;radius?:number;spacing?:number;fontSize?:number;shadow?:number};
export type ZoneStyles=Partial<Record<DesignZone,ZoneStyle>>;
const COLOR=/^#[0-9a-f]{6}$/i;
const NUMBER_BOUNDS={radius:[0,32],spacing:[0,48],fontSize:[11,24],shadow:[0,32]} as const;
export function cleanZoneStyles(value:unknown):ZoneStyles{
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  const result:ZoneStyles={};
  for(const id of DESIGN_ZONES){
    const input=(value as Record<string,unknown>)[id];
    if(!input||typeof input!=='object'||Array.isArray(input))continue;
    const record=input as Record<string,unknown>,out:ZoneStyle={};
    for(const key of ['background','color'] as const){
      if(typeof record[key]==='string'&&COLOR.test(record[key]))out[key]=(record[key] as string).toLowerCase();
    }
    for(const key of ['radius','spacing','fontSize','shadow'] as const){
      const num=record[key],bounds=NUMBER_BOUNDS[key];
      if(typeof num==='number'&&Number.isInteger(num)&&num>=bounds[0]&&num<=bounds[1])out[key]=num;
    }
    if(Object.keys(out).length)result[id]=out;
  }
  return result;
}
export function renderZoneCss(input:unknown):string{
  const styles=cleanZoneStyles(input);
  return DESIGN_ZONES.map(id=>{
    const style=styles[id];if(!style)return '';
    const parts=[];
    if(style.background)parts.push('background:'+style.background+' !important');
    if(style.color)parts.push('color:'+style.color+' !important');
    if(style.radius!==undefined)parts.push('border-radius:'+style.radius+'px !important');
    if(style.spacing!==undefined)parts.push('padding:'+style.spacing+'px !important');
    if(style.fontSize!==undefined)parts.push('font-size:'+style.fontSize+'px !important');
    if(style.shadow!==undefined)parts.push('box-shadow:0 '+Math.round(style.shadow/3)+'px '+style.shadow+'px rgba(15,23,42,.25) !important');
    return ':root #root .app [data-design-zone="'+id+'"] {'+parts.join(';')+'}';
  }).join('\n');
}
