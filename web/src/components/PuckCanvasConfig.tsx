import type {Config,Data,Slot} from '@puckeditor/core';
import type {CSSProperties} from 'react';

// The uploaded Puck 0.24 demo uses real component registries and nested slot
// fields. This is a genuine Puck document, NOT a fixed list of fake zones.
export type BuilderBlocks={
  Heading:{text:string;level:'h1'|'h2'|'h3';align:'left'|'center'|'right'};
  Text:{text:string;align:'left'|'center'|'right';size:number};
  Button:{label:string;variant:'primary'|'secondary';radius:number};
  Card:{title:string;body:string;accent:string};
  Flex:{direction:'row'|'column';gap:number;items:Slot};
  Grid:{columns:number;gap:number;items:Slot};
  Space:{height:number};
  PartsPanel:{title:string};
  NestingCanvas:{title:string};
  MaterialPanel:{title:string};
  ActionBar:{label:string};
};
export type BuilderRoot={title:string;background:string;panel:string;accent:string};

const swatches={background:'#f5f7fb',panel:'#ffffff',accent:'#405dd7'};
const border='#dce3ed';
const surface:CSSProperties={background:'#fff',border:'1px solid '+border,borderRadius:12,padding:16,boxShadow:'0 3px 16px #1428470a'};
const alignOptions=[
  {label:'Sol',value:'left'},{label:'Orta',value:'center'},{label:'Sağ',value:'right'}
] as const;
const spacing=(n:number)=>Math.max(0,Math.min(64,n||0));

export const puckBuilderConfig:Config<BuilderBlocks,BuilderRoot>={
  categories:{
    layout:{title:'Yerleşim',components:['Grid','Flex','Space']},
    typography:{title:'Yazı ve başlık',components:['Heading','Text']},
    content:{title:'Buton ve kart',components:['Button','Card']},
    nesting:{title:'Nesting bileşenleri',components:['PartsPanel','NestingCanvas','MaterialPanel','ActionBar']}
  },
  root:{
    defaultProps:{title:'Serula Nesting tasarımı',...swatches},
    fields:{
      title:{type:'text',label:'Tasarım başlığı'},
      background:{type:'text',label:'Sayfa rengi (#RRGGBB)'},
      panel:{type:'text',label:'Panel rengi (#RRGGBB)'},
      accent:{type:'text',label:'Vurgu rengi (#RRGGBB)'}
    },
    render:({puck:{renderDropZone:DropZone},title,background,panel,accent})=>
      <main className="puck-builder-page" style={{
        background:/^#[a-f0-9]{6}$/i.test(background)?background:swatches.background,
        '--puck-panel':/^#[a-f0-9]{6}$/i.test(panel)?panel:swatches.panel,
        '--puck-accent':/^#[a-f0-9]{6}$/i.test(accent)?accent:swatches.accent
      } as CSSProperties}>
        <div className="puck-builder-page-head"><strong>{title}</strong><span>Görsel tasarım taslağı · Puck</span></div>
        <DropZone zone="default-zone" className="puck-builder-page-content"/>
      </main>
  },
  components:{
    Heading:{
      label:'Başlık',
      fields:{
        text:{type:'text',label:'Başlık',contentEditable:true},
        level:{type:'select',label:'Seviye',options:[{label:'Büyük',value:'h1'},{label:'Orta',value:'h2'},{label:'Küçük',value:'h3'}]},
        align:{type:'radio',label:'Hizalama',options:[...alignOptions]}
      },
      defaultProps:{text:'Yeni başlık',level:'h2',align:'left'},
      render:({text,level,align})=>{
        const Tag=level||'h2';
        return <Tag className="puck-builder-heading" style={{textAlign:align}}>{text}</Tag>;
      }
    },
    Text:{
      label:'Metin',
      fields:{
        text:{type:'textarea',label:'Metin',contentEditable:true},
        align:{type:'radio',label:'Hizalama',options:[...alignOptions]},
        size:{type:'number',label:'Yazı boyutu',min:11,max:32}
      },
      defaultProps:{text:'Metni seçip düzenleyin',align:'left',size:15},
      render:({text,align,size})=><p className="puck-builder-text" style={{textAlign:align,fontSize:Math.min(32,Math.max(11,size||15))}}>{text}</p>
    },
    Button:{
      label:'Buton',
      fields:{
        label:{type:'text',label:'Buton yazısı',contentEditable:true},
        variant:{type:'radio',label:'Görünüm',options:[{label:'Vurgu',value:'primary'},{label:'İkincil',value:'secondary'}]},
        radius:{type:'number',label:'Köşe yarıçapı',min:0,max:32}
      },
      defaultProps:{label:'Yeni buton',variant:'primary',radius:9},
      render:({label,variant,radius})=><div className="puck-builder-button-holder"><button type="button" tabIndex={-1} className={'puck-builder-button '+(variant==='primary'?'is-primary':'is-secondary')} style={{borderRadius:radius}}>{label}</button></div>
    },
    Card:{
      label:'Bilgi kartı',
      fields:{
        title:{type:'text',label:'Kart başlığı',contentEditable:true},
        body:{type:'textarea',label:'Açıklama',contentEditable:true},
        accent:{type:'text',label:'Vurgu rengi (#RRGGBB)'}
      },
      defaultProps:{title:'Bilgi kartı',body:'Kart açıklaması',accent:'#405dd7'},
      render:({title,body,accent})=><article className="puck-builder-card" style={{...surface,borderTop:'4px solid '+(/^#[0-9a-f]{6}$/i.test(accent)?accent:'#405dd7')}}><strong>{title}</strong><p>{body}</p></article>
    },
    Flex:{
      label:'Esnek düzen (Flex)',
      fields:{
        direction:{type:'radio',label:'Yön',options:[{label:'Yan yana',value:'row'},{label:'Alt alta',value:'column'}]},
        gap:{type:'number',label:'Öğeler arası boşluk',min:0,max:64},
        items:{type:'slot',label:'İç bileşenler'}
      },
      defaultProps:{direction:'row',gap:14,items:[]},
      render:({direction,gap,items:Items})=><Items className="puck-builder-slot puck-builder-flex" style={{flexDirection:direction,gap:spacing(gap)}}/>
    },
    Grid:{
      label:'Izgara (Grid)',
      fields:{
        columns:{type:'number',label:'Sütun sayısı',min:1,max:4},
        gap:{type:'number',label:'Öğeler arası boşluk',min:0,max:64},
        items:{type:'slot',label:'İç bileşenler'}
      },
      defaultProps:{columns:3,gap:14,items:[]},
      render:({columns,gap,items:Items})=><Items className="puck-builder-slot puck-builder-grid" style={{gridTemplateColumns:'repeat('+Math.max(1,Math.min(4,columns||1))+',minmax(0,1fr))',gap:spacing(gap)}}/>
    },
    Space:{
      label:'Boşluk',
      fields:{height:{type:'number',label:'Yükseklik',min:8,max:160}},
      defaultProps:{height:24},
      render:({height})=><div aria-label="Boşluk" className="puck-builder-space" style={{height:Math.max(8,Math.min(160,height||24))}}/>
    },
    PartsPanel:{
      label:'Parçalar paneli',
      fields:{title:{type:'text',label:'Panel başlığı',contentEditable:true}},
      defaultProps:{title:'Parçalar'},
      render:({title})=><section className="puck-builder-parts" style={surface}>
        <strong>{title}</strong><small>Parça listesi · örnek görünüm</small>
        <div className="puck-builder-item"><span>▣</span><span>Parça 01</span><em>× 4</em></div>
        <div className="puck-builder-item"><span>▣</span><span>Parça 02</span><em>× 2</em></div>
        <div className="puck-builder-item"><span>▣</span><span>Parça 03</span><em>× 1</em></div>
      </section>
    },
    NestingCanvas:{
      label:'Yerleşim alanı',
      fields:{title:{type:'text',label:'Başlık',contentEditable:true}},
      defaultProps:{title:'Yerleşim önizlemesi'},
      render:({title})=><section className="puck-builder-nesting" style={surface}>
        <strong>{title}</strong>
        <div className="puck-builder-sheet"><span/><span/><span/><span/></div>
        <small>Temsili tasarım öğesi — hesaplama yapmaz</small>
      </section>
    },
    MaterialPanel:{
      label:'Malzeme ayarları',
      fields:{title:{type:'text',label:'Başlık',contentEditable:true}},
      defaultProps:{title:'Malzeme ayarları'},
      render:({title})=><section className="puck-builder-material" style={surface}>
        <strong>{title}</strong><label>Genişlik (mm)<span>1500</span></label>
        <label>Boşluk (mm)<span>5</span></label><label>Malzeme<span>Rulo</span></label>
      </section>
    },
    ActionBar:{
      label:'İşlem çubuğu',
      fields:{label:{type:'text',label:'Ana buton yazısı',contentEditable:true}},
      defaultProps:{label:'Parçaları yerleştir'},
      render:({label})=><div className="puck-builder-actions" style={surface}>
        <button type="button" tabIndex={-1} className="puck-builder-button is-primary">{label}</button>
        <button type="button" tabIndex={-1} className="puck-builder-button is-secondary">DXF İndir</button>
        <button type="button" tabIndex={-1} className="puck-builder-button is-secondary">CorelDRAW</button>
      </div>
    }
  }
};

export const initialPuckPage:Data<BuilderBlocks,BuilderRoot>={
  root:{props:{title:'Serula Nesting çalışma alanı',...swatches}},
  content:[
    {type:'Heading',props:{id:'demo-heading',text:'Serula Nesting',level:'h2',align:'left'}},
    {type:'Text',props:{id:'demo-intro',text:'Soldaki bileşenleri bu alana sürükle. Bileşene tıklayıp sağ panelden özelliklerini düzenle.',align:'left',size:14}},
    {type:'Grid',props:{id:'demo-grid',columns:3,gap:16,items:[
      {type:'PartsPanel',props:{id:'demo-parts',title:'Parçalar'}},
      {type:'NestingCanvas',props:{id:'demo-canvas',title:'Yerleşim önizlemesi'}},
      {type:'MaterialPanel',props:{id:'demo-material',title:'Malzeme ayarları'}}
    ]}},
    {type:'ActionBar',props:{id:'demo-actions',label:'Parçaları yerleştir'}}
  ]
};
