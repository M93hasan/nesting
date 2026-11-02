import type {Config,Data,Slot} from '@puckeditor/core';
import type {CSSProperties} from 'react';

// The uploaded Puck 0.24 demo uses real component registries and nested slot
// fields. This is a genuine Puck document, NOT a fixed list of fake zones.
export type BuilderBlocks={
  Heading:{text:string;level:'h1'|'h2'|'h3';align:'left'|'center'|'right'};
  Text:{text:string;align:'left'|'center'|'right';size:number};
  Button:{label:string;href:string;variant:'primary'|'secondary';radius:number};
  Card:{title:string;body:string;accent:string};
  Flex:{direction:'row'|'column';gap:number;items:Slot};
  Grid:{columns:number;gap:number;items:Slot};
  Space:{height:number};
  PartsPanel:{title:string;parts:{name:string;quantity:number}[]};
  NestingCanvas:{title:string;sheetWidth:number;sheetHeight:number;fill:string};
  MaterialPanel:{title:string;width:number;gap:number;material:string};
  ActionBar:{label:string;downloadLabel:string;corelLabel:string};
  RichText:{richtext:string};
  Hero:{title:string;description:string;buttonText:string;buttonHref:string;align:'left'|'center'|'right'};
  Logos:{logos:{alt:string;imageUrl:string}[]};
  Stats:{items:{title:string;description:string}[]};
  Template:{title:string;description:string;items:Slot};
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
    typography:{title:'Yazı ve başlık',components:['Heading','Text','RichText']},
    interactive:{title:'Eylemler',components:['Button']},
    content:{title:'İçerik',components:['Card','Hero','Logos','Stats','Template']},
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
        href:{type:'text',label:'Bağlantı (# veya https://)'},
        variant:{type:'radio',label:'Görünüm',options:[{label:'Vurgu',value:'primary'},{label:'İkincil',value:'secondary'}]},
        radius:{type:'number',label:'Köşe yarıçapı',min:0,max:32}
      },
      defaultProps:{label:'Yeni buton',href:'#',variant:'primary',radius:9},
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
      fields:{
        title:{type:'text',label:'Panel başlığı',contentEditable:true},
        parts:{type:'array',label:'Parçalar',getItemSummary:(item,i)=>item.name||'Parça '+(i+1),
          defaultItemProps:{name:'Yeni parça',quantity:1},
          arrayFields:{name:{type:'text',label:'Parça adı'},quantity:{type:'number',label:'Adet',min:1,max:10000}}}
      },
      defaultProps:{title:'Parçalar',parts:[{name:'Parça 01',quantity:4},{name:'Parça 02',quantity:2},{name:'Parça 03',quantity:1}]},
      render:({title,parts=[]})=><section className="puck-builder-parts" style={surface}>
        <strong>{title}</strong><small>Parça listesi · düzenlenebilir tasarım örneği</small>
        {parts.map((part,i)=><div key={i} className="puck-builder-item"><span>▣</span><span>{part.name}</span><em>× {part.quantity}</em></div>)}
      </section>
    },
    NestingCanvas:{
      label:'Yerleşim alanı',
      fields:{
        title:{type:'text',label:'Başlık',contentEditable:true},
        sheetWidth:{type:'number',label:'Genişlik (mm)',min:50,max:100000},
        sheetHeight:{type:'number',label:'Yükseklik (mm)',min:50,max:100000},
        fill:{type:'text',label:'Zemin rengi (#RRGGBB)'}
      },
      defaultProps:{title:'Yerleşim önizlemesi',sheetWidth:1500,sheetHeight:3000,fill:'#f8fbfe'},
      render:({title,sheetWidth,sheetHeight,fill})=><section className="puck-builder-nesting" style={surface}>
        <strong>{title}</strong>
        <div className="puck-builder-sheet" style={{background:/^#[0-9a-f]{6}$/i.test(fill)?fill:'#f8fbfe'}}><span/><span/><span/><span/></div>
        <small>{sheetWidth} × {sheetHeight} mm · tasarım önizlemesi, hesaplama yapmaz</small>
      </section>
    },
    MaterialPanel:{
      label:'Malzeme ayarları',
      fields:{
        title:{type:'text',label:'Başlık',contentEditable:true},
        width:{type:'number',label:'Genişlik (mm)',min:50,max:100000},
        gap:{type:'number',label:'Boşluk (mm)',min:0,max:1000},
        material:{type:'text',label:'Malzeme adı',contentEditable:true}
      },
      defaultProps:{title:'Malzeme ayarları',width:1500,gap:5,material:'Rulo'},
      render:({title,width,gap,material})=><section className="puck-builder-material" style={surface}>
        <strong>{title}</strong><label>Genişlik (mm)<span>{width}</span></label>
        <label>Boşluk (mm)<span>{gap}</span></label><label>Malzeme<span>{material}</span></label>
      </section>
    },
    RichText:{
      label:'Zengin metin',
      fields:{richtext:{type:'richtext',label:'Biçimlendirilmiş metin'}},
      defaultProps:{richtext:'<h2>Başlık</h2><p>Açıklama metni</p>'},
      render:({richtext})=><section className="puck-builder-card" style={surface}><span style={{whiteSpace:'pre-wrap'}}>{richtext.replace(/<[^>]*>/g,' ').trim()}</span></section>
    },
    Hero:{
      label:'Tanıtım (Hero)',
      fields:{
        title:{type:'text',label:'Başlık',contentEditable:true},
        description:{type:'textarea',label:'Açıklama',contentEditable:true},
        buttonText:{type:'text',label:'Buton metni',contentEditable:true},
        buttonHref:{type:'text',label:'Buton bağlantısı'},
        align:{type:'radio',label:'Hizalama',options:[...alignOptions]}
      },
      defaultProps:{title:'Üretime hazır tasarım',description:'Nesting çalışma alanınızı düzenleyin.',buttonText:'Başla',buttonHref:'#',align:'center'},
      render:({title,description,buttonText,align})=><section className="puck-builder-hero" style={{...surface,textAlign:align,padding:'32px 24px'}}>
        <h2>{title}</h2><p>{description}</p><span className="puck-builder-button is-primary">{buttonText}</span>
      </section>
    },
    Logos:{
      label:'Logolar',
      fields:{
        logos:{type:'array',label:'Logolar',getItemSummary:(item,i)=>item.alt||'Logo '+(i+1),
          defaultItemProps:{alt:'Logo',imageUrl:''},
          arrayFields:{alt:{type:'text',label:'Alternatif yazı'},imageUrl:{type:'text',label:'Görsel URL'}}}
      },
      defaultProps:{logos:[{alt:'Marka 1',imageUrl:''},{alt:'Marka 2',imageUrl:''}]},
      render:({logos})=><section className="puck-builder-logos" style={surface}>
        {logos.map((item,i)=><div key={i} className="puck-builder-logo">
          {/^https:\/\//i.test(item.imageUrl)?<img alt={item.alt} src={item.imageUrl} loading="lazy"/>:<strong>{item.alt}</strong>}
        </div>)}
      </section>
    },
    Stats:{
      label:'İstatistikler',
      fields:{
        items:{type:'array',label:'Ölçümler',getItemSummary:(item,i)=>item.title||'İstatistik '+(i+1),
          defaultItemProps:{title:'Üretim',description:'100%'},
          arrayFields:{title:{type:'text',label:'Başlık'},description:{type:'text',label:'Değer'}}}
      },
      defaultProps:{items:[{title:'Verimlilik',description:'%86'},{title:'Parça',description:'128'}]},
      render:({items})=><section className="puck-builder-stats" style={surface}>
        {items.map((item,i)=><div key={i}><strong>{item.description}</strong><small>{item.title}</small></div>)}
      </section>
    },
    Template:{
      label:'Şablon alanı',
      fields:{title:{type:'text',label:'Başlık',contentEditable:true},description:{type:'textarea',label:'Açıklama'},items:{type:'slot',label:'İç bileşenler'}},
      defaultProps:{title:'Yeni şablon',description:'İçerik eklemek için bileşen sürükleyin',items:[]},
      render:({title,description,items:Items})=><section className="puck-builder-template" style={surface}>
        <h3>{title}</h3><p>{description}</p><Items className="puck-builder-slot" style={{minHeight:140}}/>
      </section>
    },
    ActionBar:{
      label:'İşlem çubuğu',
      fields:{
        label:{type:'text',label:'Ana buton yazısı',contentEditable:true},
        downloadLabel:{type:'text',label:'İndirme butonu'},
        corelLabel:{type:'text',label:'CorelDRAW butonu'}
      },
      defaultProps:{label:'Parçaları yerleştir',downloadLabel:'DXF İndir',corelLabel:'CorelDRAW'},
      render:({label,downloadLabel,corelLabel})=><div className="puck-builder-actions" style={surface}>
        <button type="button" tabIndex={-1} className="puck-builder-button is-primary">{label}</button>
        <button type="button" tabIndex={-1} className="puck-builder-button is-secondary">{downloadLabel}</button>
        <button type="button" tabIndex={-1} className="puck-builder-button is-secondary">{corelLabel}</button>
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
      {type:'PartsPanel',props:{id:'demo-parts',title:'Parçalar',parts:[{name:'Parça 01',quantity:4},{name:'Parça 02',quantity:2},{name:'Parça 03',quantity:1}]}},
      {type:'NestingCanvas',props:{id:'demo-canvas',title:'Yerleşim önizlemesi',sheetWidth:1500,sheetHeight:3000,fill:'#f8fbfe'}},
      {type:'MaterialPanel',props:{id:'demo-material',title:'Malzeme ayarları',width:1500,gap:5,material:'Rulo'}}
    ]}},
    {type:'ActionBar',props:{id:'demo-actions',label:'Parçaları yerleştir',downloadLabel:'DXF İndir',corelLabel:'CorelDRAW'}},
    // A visible, empty Puck slot is the supported insertion target. Non-empty
    // dropzones disable direct collisions; users then drop between components.
    {type:'Flex',props:{id:'demo-insert-here',direction:'column',gap:14,items:[]}}
  ]
};
