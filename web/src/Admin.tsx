import {useEffect,useMemo,useRef,useState} from 'react';
import packageInfo from '../package.json';

type Section='overview'|'users'|'roles'|'user-settings'|'defaults'|'history'|'logs'|'system';

const nav:{id:Section;label:string;icon:string}[]=[
  {id:'overview',label:'Genel Bakış',icon:'⌂'},
  {id:'users',label:'Kullanıcılar',icon:'◎'},
  {id:'roles',label:'Roller ve Yetkiler',icon:'◆'},
  {id:'user-settings',label:'Kullanıcı Ayarları',icon:'⚙'},
  {id:'defaults',label:'Sistem Varsayılanları',icon:'◫'},
  {id:'history',label:'İşlem Geçmişi',icon:'↺'},
  {id:'logs',label:'Sistem Logları',icon:'≡'},
  {id:'system',label:'Sistem Bilgisi',icon:'ⓘ'},
];

function Empty({title,children}:{title:string;children:string}){
  return <div className="admin-empty"><strong>{title}</strong><p>{children}</p></div>;
}
function Metric({label,value,detail}:{label:string;value:string;detail:string}){
  return <article className="admin-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

type GoogleCredentialResponse={credential?:string};
type GoogleAccounts={id:{initialize:(options:{client_id:string;callback:(response:GoogleCredentialResponse)=>void;auto_select?:boolean})=>void;renderButton:(parent:HTMLElement,options:Record<string,unknown>)=>void;disableAutoSelect:()=>void}};
declare global { interface Window { google?:{accounts:GoogleAccounts} } }

function decodeGoogleEmail(credential:string){
  try{
    const payload=credential.split('.')[1];
    if(!payload)return '';
    const normalized=payload.replace(/-/g,'+').replace(/_/g,'/');
    const json=decodeURIComponent(Array.from(atob(normalized),c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join(''));
    const claims=JSON.parse(json) as {email?:string;email_verified?:boolean;aud?:string};
    return claims.email_verified?claims.email??'':'';
  }catch{return '';}
}

export default function Admin({allowedEmail,clientId}:{allowedEmail:string;clientId:string}){
  const localDevelopment=import.meta.env.DEV&&(location.hostname==='127.0.0.1'||location.hostname==='localhost');
  const [auth,setAuth]=useState<'loading'|'signed-out'|'allowed'|'denied'>(localDevelopment?'allowed':'loading');
  const [signedEmail,setSignedEmail]=useState('');
  const googleButton=useRef<HTMLDivElement>(null);
  const [section,setSection]=useState<Section>('overview');
  const [query,setQuery]=useState('');
  const [role,setRole]=useState('Tümü');
  const title=useMemo(()=>nav.find(item=>item.id===section)?.label??'Yönetim',[section]);

  useEffect(()=>{
    if(localDevelopment)return;
    let cancelled=false;
    const onCredential=(response:GoogleCredentialResponse)=>{
      const email=response.credential?decodeGoogleEmail(response.credential):'';
      if(cancelled)return;
      setSignedEmail(email);
      setAuth(email.toLowerCase()===allowedEmail.toLowerCase()?'allowed':'denied');
    };
    const setup=()=>{
      if(!window.google?.accounts.id||!googleButton.current)return;
      window.google.accounts.id.initialize({client_id:clientId,callback:onCredential,auto_select:false});
      googleButton.current.replaceChildren();
      window.google.accounts.id.renderButton(googleButton.current,{theme:'outline',size:'large',text:'signin_with',shape:'pill'});
      setAuth('signed-out');
    };
    if(window.google?.accounts.id){setup();return()=>{cancelled=true};}
    const script=document.createElement('script');
    script.src='https://accounts.google.com/gsi/client';
    script.async=true;script.defer=true;script.onload=setup;
    script.onerror=()=>!cancelled&&setAuth('signed-out');
    document.head.appendChild(script);
    return()=>{cancelled=true};
  },[allowedEmail,clientId,localDevelopment]);

  if(auth!=='allowed'){
    return <div className="admin-page"><main className="admin-main" style={{maxWidth:560,margin:'10vh auto'}}>
      <section className="admin-card">
        <h1>Serula Yönetim</h1>
        <p>{auth==='denied'?signedEmail+' hesabının admin yetkisi yok.':'Admin paneline yalnızca yetkili Google hesabı ile giriş yapılabilir.'}</p>
        <div ref={googleButton} style={{marginTop:20}} />
        {auth==='denied'&&<button style={{marginTop:16}} onClick={()=>{window.google?.accounts.id.disableAutoSelect();setSignedEmail('');setAuth('signed-out')}}>Başka hesapla giriş yap</button>}
      </section>
    </main></div>;
  }
  return <div className="admin-page">
    <header className="admin-topbar">
      <div className="admin-brand"><img src={import.meta.env.BASE_URL+'serula-logo.svg'} alt="" /><div><strong>Serula</strong><span>Yönetim Paneli</span></div></div>
      <div className="admin-top-actions">{localDevelopment&&<span className="admin-badge">Yerel test</span>}<span className="admin-version">v{packageInfo.version}</span><a className="admin-workspace-link" href={import.meta.env.BASE_URL}>Çalışma alanına dön</a></div>
    </header>

    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Yönetim menüsü">
        <nav>{nav.map(item=><button key={item.id} className={section===item.id?'active':''} onClick={()=>setSection(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
        <div className="admin-security-note"><strong>Güvenli yönetim</strong><small>Kullanıcı ve yetki değişiklikleri sunucu kimlik doğrulaması olmadan uygulanmaz.</small></div>
      </aside>

      <main className="admin-main">
        <div className="admin-heading"><div><p>Yönetim</p><h1>{title}</h1></div><span className="admin-connection">Sunucu bağlantısı bekleniyor</span></div>

        {section==='overview'&&<>
          <section className="admin-metrics">
            <Metric label="Toplam kullanıcı" value="—" detail="Veritabanı bağlı değil"/>
            <Metric label="Aktif kullanıcı" value="—" detail="Canlı veri bekleniyor"/>
            <Metric label="Bugünkü nesting" value="—" detail="İstatistik servisi bağlı değil"/>
            <Metric label="Sistem durumu" value="Hazır" detail={(localDevelopment?'Yerel geliştirme':'İstemci')+' · v'+packageInfo.version}/>
          </section>
          <section className="admin-grid-two">
            <article className="admin-card"><div className="admin-card-head"><h2>Hızlı Durum</h2><span className="admin-badge">İstemci</span></div>
              <dl className="admin-status-list"><div><dt>Uygulama</dt><dd>Çalışıyor</dd></div><div><dt>Admin rotası</dt><dd>/admin</dd></div><div><dt>Kimlik doğrulama</dt><dd>{localDevelopment?'Yerel test modu':'Google hesabı'}</dd></div><div><dt>Kalıcı veritabanı</dt><dd>Bağlantı gerekli</dd></div></dl>
            </article>
            <article className="admin-card"><div className="admin-card-head"><h2>Son İşlemler</h2></div><Empty title="Henüz veri yok">Kalıcı işlem geçmişi bağlandığında burada kullanıcı, proje, nesting ve dışa aktarma kayıtları gösterilecek.</Empty></article>
          </section>
        </>}

        {section==='users'&&<section className="admin-card admin-users">
          <div className="admin-card-head"><div><h2>Kullanıcı Yönetimi</h2><p>Hesapları, durumu ve erişimi yönetin.</p></div><button disabled>＋ Kullanıcı ekle</button></div>
          <div className="admin-toolbar"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Kullanıcı ara…" aria-label="Kullanıcı ara"/><select value={role} onChange={e=>setRole(e.target.value)}><option>Tümü</option><option>Admin</option><option>Operatör</option></select></div>
          <div className="admin-table"><div className="admin-table-head"><span>Kullanıcı</span><span>Rol</span><span>Durum</span><span>Son aktivite</span><span></span></div>
            <Empty title="Kullanıcı verisi bağlı değil">Güvenli kullanıcı veritabanı bağlandığında aktif/pasif, rol ve kullanıcı bazlı erişim burada yönetilecek.</Empty>
          </div>
        </section>}

        {section==='roles'&&<section className="admin-grid-two">
          <article className="admin-card"><div className="admin-card-head"><h2>Admin</h2><span className="admin-badge">Tam erişim</span></div><ul className="admin-check-list"><li>✓ Kullanıcı yönetimi</li><li>✓ Sistem varsayılanları</li><li>✓ Log ve geçmiş</li><li>✓ Kullanıcı ayarlarını kilitleme</li></ul></article>
          <article className="admin-card"><div className="admin-card-head"><h2>Operatör</h2><span className="admin-badge muted">Sınırlı</span></div><ul className="admin-check-list"><li>✓ DXF içe aktarma</li><li>✓ Nesting çalıştırma</li><li>✓ DXF dışa aktarma</li><li>— Admin erişimi yok</li></ul></article>
          <article className="admin-card admin-span-two"><Empty title="Rol düzenleme sunucu bağlantısı gerektiriyor">Yetki değişiklikleri istemci tarafında taklit edilmeyecek; güvenli API bağlandığında bu bölüm aktif olacak.</Empty></article>
        </section>}

        {section==='user-settings'&&<section className="admin-card">
          <div className="admin-card-head"><div><h2>Kullanıcıya Özel Ayarlar</h2><p>Sistem varsayılanlarının üzerine kullanıcı bazlı değerler uygulanacak.</p></div><button disabled>Kullanıcı seç</button></div>
          <div className="admin-settings-grid">
            <label>Parça aralığı (mm)<input type="number" value="0.3" readOnly/></label>
            <label>Kenar payı (mm)<input type="number" value="5" readOnly/></label>
            <label>Rotasyon<select disabled><option>0° / 180°</option></select></label>
            <label>Malzeme tipi<select disabled><option>Rulo / Plaka</option></select></label>
          </div>
          <div className="admin-lock-row"><span>🔒 Kullanıcının değiştiremeyeceği ayarlar</span><button disabled>Kilitleri düzenle</button></div>
          <Empty title="Önce kullanıcı seçilmeli">Kullanıcı veritabanı bağlandığında burada özellik izinleri, nesting seçenekleri ve kilitli ayarlar yönetilecek.</Empty>
        </section>}

        {section==='defaults'&&<section className="admin-card">
          <div className="admin-card-head"><div><h2>Sistem Varsayılanları</h2><p>Yeni kullanıcı ve projeler için başlangıç ayarları.</p></div><span className="admin-badge">Taslak</span></div>
          <div className="admin-settings-grid">
            <label>Varsayılan malzeme genişliği (mm)<input type="number" defaultValue="1000"/></label>
            <label>Parça aralığı (mm)<input type="number" step="0.1" defaultValue="0.3"/></label>
            <label>Kenar payı (mm)<input type="number" defaultValue="5"/></label>
            <label>Varsayılan rotasyon<select defaultValue="half"><option value="fixed">0°</option><option value="half">0° / 180°</option><option value="free">Serbest</option></select></label>
            <label>Varsayılan malzeme<select defaultValue="roll"><option value="roll">Rulo</option><option value="sheet">Plaka</option></select></label>
            <label>Solver profili<select defaultValue="standard"><option value="standard">Standart</option><option value="fast">Hızlı</option></select></label>
          </div>
          <div className="admin-save-row"><small>Bu alanlar şu anda yalnızca arayüz taslağıdır; kalıcı kaydetme API bağlantısı ile açılacak.</small><button disabled>Kaydet</button></div>
        </section>}

        {section==='history'&&<section className="admin-card">
          <div className="admin-card-head"><div><h2>İşlem Geçmişi</h2><p>Nesting, proje ve dışa aktarma kayıtları.</p></div><button disabled>Dışa aktar</button></div>
          <div className="admin-toolbar"><input placeholder="Proje veya kullanıcı ara…" disabled/><select disabled><option>Son 30 gün</option></select></div>
          <Empty title="Geçmiş kaydı yok">Sunucu kayıt altyapısı bağlandığında işlem süresi, malzeme kullanımı, plaka sayısı ve kullanıcı bilgisi burada görünecek.</Empty>
        </section>}

        {section==='logs'&&<section className="admin-card">
          <div className="admin-card-head"><div><h2>Sistem Logları</h2><p>Uygulama hataları ve yönetim olayları.</p></div><button disabled>Logları temizle</button></div>
          <div className="admin-log-window"><span>Log servisi bağlı değil.</span></div>
        </section>}

        {section==='system'&&<section className="admin-grid-two">
          <article className="admin-card"><h2>Uygulama</h2><dl className="admin-status-list"><div><dt>Ürün</dt><dd>Serula Nesting</dd></div><div><dt>Sürüm</dt><dd>v{packageInfo.version}</dd></div><div><dt>Yönetim yolu</dt><dd>/admin</dd></div><div><dt>Dağıtım</dt><dd>Cloudflare</dd></div></dl></article>
          <article className="admin-card"><h2>Güvenlik</h2><dl className="admin-status-list"><div><dt>Admin API</dt><dd>Bekleniyor</dd></div><div><dt>Kimlik doğrulama</dt><dd>Bekleniyor</dd></div><div><dt>Kalıcı kullanıcı deposu</dt><dd>Bekleniyor</dd></div></dl></article>
        </section>}
      </main>
    </div>
  </div>;
}
