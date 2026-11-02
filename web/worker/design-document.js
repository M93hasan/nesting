// Versioned, allowlisted Serula design drafts. Never accepts executable markup or styles.
const COLOR=/^#[0-9a-f]{6}$/i;
const LABELS=['Başlık','Ana panel','Birincil buton'];
const EXACT=['background','panel','accent','radius','spacing','fontSize','heading','hidden','order','positions','workspaceOrder','zoneStyles'];
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
    const zones=['header','parts','canvas','material','actions','runButton','corelButton','downloadButton'];
    const allowed=['background','color','radius','spacing','fontSize','shadow','text'];
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
      if(Object.prototype.hasOwnProperty.call(style,'text')){
        if(id==='actions'||typeof style.text!=='string'||style.text.length>80||/[<>\x00-\x1f]/.test(style.text))throw new Error('Geçersiz bileşen başlığı.');
        cleaned.text=style.text;
      }
      output.zoneStyles[id]=cleaned;
    }
  }
  return output;
}
export function parseDesignPayload(input){
  if(!input||input.format!=='serula-design-v1')throw new Error('Desteklenmeyen belge sürümü.');
  return {format:'serula-design-v1',design:parseDesignDocument(input.design)};
}
