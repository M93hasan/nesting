// Versioned, allowlisted Serula design drafts. Never accepts executable markup or styles.
const COLOR=/^#[0-9a-f]{6}$/i;
const LABELS=['Başlık','Ana panel','Birincil buton'];
const EXACT=['background','panel','accent','radius','spacing','fontSize','heading','hidden','order','positions','workspaceOrder','zoneStyles','blocks'];
const has=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
export function parseDesignDocument(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Tasarım nesnesi gerekli.');
  if(Object.keys(input).some(key=>!EXACT.includes(key)))throw new Error('İzin verilmeyen tasarım alanı.');
  const output={};
  for(const key of ['background','panel','accent']){
    if(typeof input[key]!=='string'||!COLOR.test(input[key]))throw new Error('Geçersiz renk.');
    output[key]=input[key].toLowerCase();
  }
  for(const [key,lower,upper] of [['radius',0,32],['spacing',8,40],['fontSize',12,22]]){
    if(typeof input[key]!=='number'||!Number.isFinite(input[key])||input[key]<lower||input[key]>upper)throw new Error('Geçersiz sayı.');
    output[key]=input[key];
  }
  if(typeof input.heading!=='string'||input.heading.length>80)throw new Error('Geçersiz başlık.');
  output.heading=input.heading;
  if(has(input,'hidden')){
    if(!Array.isArray(input.hidden)||input.hidden.length>3||new Set(input.hidden).size!==input.hidden.length||!input.hidden.every(x=>LABELS.includes(x)))throw new Error('Geçersiz gizli katman.');
    output.hidden=[...input.hidden];
  }
  if(has(input,'order')){
    if(!Array.isArray(input.order)||input.order.length!==3||new Set(input.order).size!==3||!LABELS.every(x=>input.order.includes(x))||input.order[2]!=='Birincil buton')throw new Error('Geçersiz katman sıralaması.');
    output.order=[...input.order];
  }
  if(has(input,'positions')){
    if(!input.positions||typeof input.positions!=='object'||Array.isArray(input.positions)||Object.keys(input.positions).some(key=>!LABELS.includes(key)))throw new Error('Geçersiz konumlar.');
    output.positions={};
    for(const [key,value] of Object.entries(input.positions)){
      if(!value||typeof value!=='object'||!Number.isInteger(value.x)||!Number.isInteger(value.y)||value.x<0||value.x>80||value.y<0||value.y>80||Object.keys(value).some(field=>!['x','y'].includes(field)))throw new Error('Geçersiz konum.');
      output.positions[key]={x:value.x,y:value.y};
    }
  }
  if(has(input,'workspaceOrder')){
    const allowed=['parts','canvas','material'];
    if(!Array.isArray(input.workspaceOrder)||input.workspaceOrder.length!==allowed.length||new Set(input.workspaceOrder).size!==allowed.length||!allowed.every(id=>input.workspaceOrder.includes(id)))throw new Error('Geçersiz gerçek panel sırası.');
    output.workspaceOrder=[...input.workspaceOrder];
  }
  if(has(input,'zoneStyles')){
    const zones=['header','parts','canvas','material','actions','runButton','corelButton','downloadButton','brand','projectBar','partsList','canvasHeading','rotationSettings','materialSettings','runControls','exportActions','projectStatus','partsTitle'];
    const allowed=['background','color','radius','spacing','fontSize','shadow','text','offsetX','offsetY'];
    if(!input.zoneStyles||typeof input.zoneStyles!=='object'||Array.isArray(input.zoneStyles)||Object.keys(input.zoneStyles).some(id=>!zones.includes(id)))throw new Error('Geçersiz bileşen kimliği.');
    output.zoneStyles={};
    for(const [id,style] of Object.entries(input.zoneStyles)){
      if(!style||typeof style!=='object'||Array.isArray(style)||Object.keys(style).some(key=>!allowed.includes(key)))throw new Error('İzin verilmeyen özellik.');
      const cleaned={};
      for(const key of ['background','color'])if(Object.prototype.hasOwnProperty.call(style,key)){
        if(typeof style[key]!=='string'||!COLOR.test(style[key]))throw new Error('Geçersiz bileşen rengi.');
        cleaned[key]=style[key].toLowerCase();
      }
      for(const [key,min,max] of [['radius',0,32],['spacing',0,48],['fontSize',11,24],['shadow',0,32]])if(Object.prototype.hasOwnProperty.call(style,key)){
        if(!Number.isInteger(style[key])||style[key]<min||style[key]>max)throw new Error('Geçersiz bileşen ölçüsü.');
        cleaned[key]=style[key];
      }
      for(const key of ['offsetX','offsetY'])if(Object.prototype.hasOwnProperty.call(style,key)){
        if(!['runButton','corelButton','downloadButton'].includes(id)||!Number.isInteger(style[key])||style[key]<-80||style[key]>80)throw new Error('Geçersiz düğme konumu.');
        cleaned[key]=style[key];
      }
      if(Object.prototype.hasOwnProperty.call(style,'text')){
        if(!['header','parts','canvas','material','runButton','corelButton','downloadButton'].includes(id)||typeof style.text!=='string'||style.text.length>80||/[<>\x00-\x1f]/.test(style.text))throw new Error('Geçersiz bileşen başlığı.');
        cleaned.text=style.text;
      }
      output.zoneStyles[id]=cleaned;
    }
  }
  if(has(input,'blocks')){
    const kinds=['text','heading','button','image','divider'],regions=['header','parts','canvas','material','actions'],devices=['desktop','tablet','mobile'];
    const allowed=['id','kind','region','text','href','src','color','background','fontSize','padding','radius','width','x','y','opacity','align','hidden','devices','borderWidth','borderColor','fontFamily','animation'];
    if(!Array.isArray(input.blocks)||input.blocks.length>100)throw new Error('Çok fazla tasarım bileşeni.');
    const ids=new Set();
    output.blocks=input.blocks.map(block=>{
      if(!block||typeof block!=='object'||Array.isArray(block)||Object.keys(block).some(k=>!allowed.includes(k)))throw new Error('Geçersiz bileşen alanı.');
      if(typeof block.id!=='string'||!/^widget-[a-z0-9-]{8,64}$/.test(block.id)||ids.has(block.id))throw new Error('Geçersiz bileşen kimliği.');
      if(!kinds.includes(block.kind)||!regions.includes(block.region)||typeof block.text!=='string'||block.text.length>160||/[<>\x00-\x1f]/.test(block.text))throw new Error('Geçersiz tasarım bileşeni.');
      if(has(block,'href')&&(typeof block.href!=='string'||!/^\/(?!\/)[a-zA-Z0-9/_-]{0,80}$/.test(block.href)))throw new Error('Geçersiz düğme bağlantısı.');
      if(has(block,'src')&&!['/serula-logo.svg','/corel-button-logo.svg'].includes(block.src))throw new Error('İzin verilmeyen görsel adresi.');
      for(const key of ['color','background','borderColor'])if(has(block,key)&&(typeof block[key]!=='string'||!COLOR.test(block[key])))throw new Error('Geçersiz bileşen rengi.');
      for(const [key,min,max] of [['fontSize',10,36],['padding',0,48],['radius',0,40],['width',40,650],['x',-300,300],['y',-300,300],['opacity',0,100],['borderWidth',0,8]])if(has(block,key)&&(!Number.isInteger(block[key])||block[key]<min||block[key]>max))throw new Error('Geçersiz bileşen ölçüsü.');
      if(has(block,'fontFamily')&&!['system','serif','mono'].includes(block.fontFamily))throw new Error('Geçersiz yazı tipi.');
      if(has(block,'animation')&&!['none','fade','slide'].includes(block.animation))throw new Error('Geçersiz animasyon.');
      if(has(block,'align')&&!['left','center','right'].includes(block.align))throw new Error('Geçersiz hizalama.');
      if(has(block,'hidden')&&typeof block.hidden!=='boolean')throw new Error('Geçersiz görünürlük.');
      if(has(block,'devices')&&(!Array.isArray(block.devices)||!block.devices.length||new Set(block.devices).size!==block.devices.length||!block.devices.every(d=>devices.includes(d))))throw new Error('Geçersiz cihaz görünürlüğü.');
      ids.add(block.id);
      return {...block};
    });
  }
  return output;
}
export function parseDesignPayload(input){
  if(!input||input.format!=='serula-design-v1')throw new Error('Desteklenmeyen belge sürümü.');
  return {format:'serula-design-v1',design:parseDesignDocument(input.design)};
}
