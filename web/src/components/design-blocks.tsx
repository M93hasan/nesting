import type {CSSProperties} from 'react';

export const BLOCK_KINDS=['text','heading','button','image','divider'] as const;
export const BLOCK_REGIONS=['header','parts','canvas','material','actions'] as const;
export const BLOCK_DEVICES=['desktop','tablet','mobile'] as const;
export type BlockKind=typeof BLOCK_KINDS[number];
export type BlockRegion=typeof BLOCK_REGIONS[number];
export type BlockDevice=typeof BLOCK_DEVICES[number];
export type DesignBlock={
  id:string;kind:BlockKind;region:BlockRegion;text:string;
  href?:string;src?:string;color?:string;background?:string;
  fontSize?:number;padding?:number;radius?:number;width?:number;
  x?:number;y?:number;opacity?:number;align?:'left'|'center'|'right';
  hidden?:boolean;devices?:BlockDevice[];
};
const HEX=/^#[0-9a-f]{6}$/i;
export const BLOCK_IMAGE_SOURCES=['/serula-logo.svg','/corel-button-logo.svg'] as const;
export const BLOCK_LINK_PATTERN=/^\/(?!\/)[a-zA-Z0-9/_-]{0,80}$/;
const bounded=(v:unknown,a:number,b:number)=>typeof v==='number'&&Number.isInteger(v)&&v>=a&&v<=b;
export function cleanBlocks(value:unknown):DesignBlock[]{
  if(!Array.isArray(value))return [];
  const ids=new Set<string>();
  return value.slice(0,100).flatMap((raw):DesignBlock[]=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return [];
    const b=raw as Record<string,unknown>;
    if(typeof b.id!=='string'||!/^widget-[a-z0-9-]{8,64}$/.test(b.id)||ids.has(b.id))return [];
    if(!BLOCK_KINDS.includes(b.kind as BlockKind)||!BLOCK_REGIONS.includes(b.region as BlockRegion))return [];
    if(typeof b.text!=='string'||b.text.length>160||/[<>\x00-\x1f]/.test(b.text))return [];
    if(b.href!==undefined&&(typeof b.href!=='string'||!BLOCK_LINK_PATTERN.test(b.href)))return [];
    if(b.src!==undefined&&(typeof b.src!=='string'||!BLOCK_IMAGE_SOURCES.includes(b.src as typeof BLOCK_IMAGE_SOURCES[number])))return [];
    for(const key of ['color','background'])if(b[key]!==undefined&&(typeof b[key]!=='string'||!HEX.test(b[key])))return [];
    for(const [key,a,z] of [['fontSize',10,36],['padding',0,48],['radius',0,40],['width',40,650],['x',-300,300],['y',-300,300],['opacity',0,100]] as const){
      if(b[key]!==undefined&&!bounded(b[key],a,z))return [];
    }
    if(b.align!==undefined&&!['left','center','right'].includes(String(b.align)))return [];
    if(b.hidden!==undefined&&typeof b.hidden!=='boolean')return [];
    if(b.devices!==undefined&&(!Array.isArray(b.devices)||!b.devices.length||new Set(b.devices).size!==b.devices.length||!b.devices.every(v=>BLOCK_DEVICES.includes(v))))return [];
    ids.add(b.id);
    const result:DesignBlock={id:b.id,kind:b.kind as BlockKind,region:b.region as BlockRegion,text:b.text};
    if(b.href!==undefined)result.href=b.href as string;
    if(b.src!==undefined)result.src=b.src as string;
    for(const k of ['color','background','fontSize','padding','radius','width','x','y','opacity','align','hidden','devices'] as const)
      if(b[k]!==undefined)(result as unknown as Record<string,unknown>)[k]=b[k];
    return [result];
  });
}
export function defaultBlock(kind:BlockKind,region:BlockRegion,id:string):DesignBlock{
  const base:DesignBlock={id,kind,region,text:({text:'Yeni metin',heading:'Yeni başlık',button:'Yeni buton',image:'Logo',divider:''})[kind],fontSize:kind==='heading'?22:14,padding:8,x:0,y:0,align:'left',devices:['desktop','tablet','mobile']};
  if(kind==='button')base.href='/';
  if(kind==='image')base.src='/serula-logo.svg';
  return base;
}
export function blockStyle(block:DesignBlock):CSSProperties{
  const color=block.color&&HEX.test(block.color)?block.color:undefined;
  const background=block.background&&HEX.test(block.background)?block.background:undefined;
  return {color,background,borderRadius:block.radius??6,fontSize:block.fontSize??14,padding:block.padding??8,
    width:block.width??undefined,maxWidth:'100%',textAlign:block.align??'left',opacity:(block.opacity??100)/100,
    transform:'translate('+(block.x??0)+'px,'+(block.y??0)+'px)'};
}
export function DesignBlocks({region,blocks}:{region:BlockRegion;blocks:unknown}){
  const rows=cleanBlocks(blocks).filter(b=>b.region===region&&!b.hidden);
  if(!rows.length)return null;
  return <div className="design-widget-region" data-design-widget-region={region}>
    {rows.map(b=>{
      const props={key:b.id,'data-design-block-id':b.id,className:'design-widget design-widget-'+b.kind+' '+(b.devices??BLOCK_DEVICES).map(d=>'design-device-'+d).join(' '),style:blockStyle(b)};
      if(b.kind==='divider')return <div {...props} role="separator"><hr/></div>;
      if(b.kind==='heading')return <h3 {...props}>{b.text}</h3>;
      if(b.kind==='button')return <a {...props} href={b.href&&BLOCK_LINK_PATTERN.test(b.href)?b.href:'/'}>{b.text}</a>;
      if(b.kind==='image')return <img {...props} src={b.src&&BLOCK_IMAGE_SOURCES.includes(b.src as typeof BLOCK_IMAGE_SOURCES[number])?b.src:'/serula-logo.svg'} alt={b.text}/>;
      return <p {...props}>{b.text}</p>;
    })}
  </div>;
}
