type Day={key:string;label:string;count:number};
const dateKey=(date:Date)=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');

/** Chart of real user creation timestamps. No placeholder counts or external chart API. */
export function RegistrationChart({registrations}:{registrations:ReadonlyArray<string|undefined|null>}){
  const today=new Date();today.setHours(12,0,0,0);
  const dailyKeys=registrations.map(raw=>raw?new Date(raw):null)
    .filter((date):date is Date=>date!==null&&Number.isFinite(date.getTime()))
    .map(dateKey);
  const days:Day[]=Array.from({length:7},(_,index)=>{
    const date=new Date(today);date.setDate(today.getDate()-(6-index));
    const key=dateKey(date);
    return {key,label:date.toLocaleDateString('tr-TR',{weekday:'short',day:'numeric'}),count:dailyKeys.filter(entry=>entry===key).length};
  });
  const total=days.reduce((sum,day)=>sum+day.count,0);
  const max=Math.max(1,...days.map(day=>day.count));
  return <section className="admin-card sd-registration-card" aria-label="Haftalık yeni kullanıcı kayıtları">
    <div className="admin-card-head"><div><h2>Yeni kullanıcı kayıtları</h2><p>Son 7 gün · Gerçek kayıt tarihlerine göre</p></div><span className="sd-chart-total">{total} kayıt</span></div>
    <div className="sd-chart-bars" role="img" aria-label={`Son 7 günde toplam ${total} kayıt. ${days.map(day=>day.label+' '+day.count).join(', ')}`}>
      {days.map(day=><div className="sd-chart-day" key={day.key}>
        <span className="sd-chart-count" aria-hidden="true">{day.count}</span>
        <div className="sd-chart-track"><span className="sd-chart-bar" title={day.label+': '+day.count+' kayıt'} style={{height:(day.count/max*100)+'%'}}/></div>
        <small aria-hidden="true">{day.label}</small>
      </div>)}
    </div>
  </section>;
}
