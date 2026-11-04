export type AdminHistoryRow={id:number;userId:number;email:string;name:string;projectName:string;sourceFileName:string;usedCredit:number;createdAt:string};
export type AdminInputSettings={materialWidthMm:number;clearanceMm:number;marginMm:number;rotation:string;materialType:string;solverPreset:string};
export function validAdminSettings(s:AdminInputSettings):boolean{
  return Number.isFinite(s.materialWidthMm)&&s.materialWidthMm>0&&s.materialWidthMm<=100000
    &&Number.isFinite(s.clearanceMm)&&s.clearanceMm>=0&&s.clearanceMm<=10000
    &&Number.isFinite(s.marginMm)&&s.marginMm>=0&&s.marginMm<=10000
    &&['fixed','half','free'].includes(s.rotation)&&['roll','sheet'].includes(s.materialType)&&['standard','fast'].includes(s.solverPreset);
}
export function parseCredits(value:string):number|null{
  const trimmed=value.trim();
  if(!/^\d{1,6}$/.test(trimmed))return null;
  const parsed=Number(trimmed);
  return Number.isSafeInteger(parsed)&&parsed<=100000?parsed:null;
}
export function filterHistory(rows:AdminHistoryRow[],query:string):AdminHistoryRow[]{
  const search=query.trim().toLocaleLowerCase('tr');
  if(!search)return rows;
  return rows.filter(row=>(row.email+' '+row.name+' '+row.projectName+' '+row.sourceFileName).toLocaleLowerCase('tr').includes(search));
}
function csvCell(value:string|number):string{
  let text=String(value);
  if(/^[\s]*[=+\-@]/.test(text)||/^[\t\r]/.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
export function historyCsv(rows:AdminHistoryRow[]):string{
  const lines:[string,...string[]][]=[['Tarih','Kullanıcı','E-posta','Proje','Kaynak dosya','Kullanılan hak'],...rows.map(r=>[r.createdAt,r.name,r.email,r.projectName,r.sourceFileName,String(r.usedCredit)] as [string,...string[]])];
  return '\ufeff'+lines.map(line=>line.map(csvCell).join(',')).join('\r\n')+'\r\n';
}