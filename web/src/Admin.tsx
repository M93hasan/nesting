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

type AdminUser={id:number;email:string;name:string;role:string;credits:number;unlimited:boolean;testDxfEnabled?:boolean;authProvider?:string;suspended?:boolean;licenseStartedAt?:string;licenseExpiresAt?:string;createdAt?:string;lastLoginAt?:string};
type AdminSettings={materialWidthMm:number;clearanceMm:number;marginMm:number;rotation:'fixed'|'half'|'free';materialType:'roll'|'sheet';solverPreset:'standard'|'fast'};
type AuditLog={id:number;actorType:string;actorEmail:string;targetEmail:string;action:string;detail:string;success:boolean;createdAt:string};
type Health={adminApi:boolean;auth:boolean;userStore:boolean};
type SupportSession={id:number;status:'pending'|'approved'|'declined'|'ended'|'expired';mode?:'settings'|'screen';expiresAt?:string;createdAt?:string;approvedAt?:string;endedAt?:string;offer?:RTCSessionDescriptionInit|null;answer?:RTCSessionDescriptionInit|null};
const FALLBACK_SETTINGS:AdminSettings={materialWidthMm:1000,clearanceMm:.3,marginMm:5,rotation:'half',materialType:'roll',solverPreset:'standard'};

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

export default function Admin({allowedEmail,clientId,skipAuth=false}:{allowedEmail:string;clientId:string;skipAuth?:boolean}){
  const localDevelopment=import.meta.env.DEV&&(location.hostname==='127.0.0.1'||location.hostname==='localhost');
  const bypassAuth=skipAuth||localDevelopment;
  const [auth,setAuth]=useState<'loading'|'signed-out'|'allowed'|'denied'>(bypassAuth?'allowed':'loading');
  const [signedEmail,setSignedEmail]=useState('');
  const googleButton=useRef<HTMLDivElement>(null);
  const [section,setSection]=useState<Section>('overview');
  const [query,setQuery]=useState('');
  const [role,setRole]=useState('Tümü');
  const [users,setUsers]=useState<AdminUser[]>([]);
  const [usersLoading,setUsersLoading]=useState(false);
  const [usersError,setUsersError]=useState('');
  const [savingUserId,setSavingUserId]=useState<number>();
  const [resettingUserId,setResettingUserId]=useState<number>();
  const [userNotice,setUserNotice]=useState('');
  const [selectedUserId,setSelectedUserId]=useState<number>();
  const [userSettings,setUserSettings]=useState<AdminSettings>(FALLBACK_SETTINGS);
  const [customSettings,setCustomSettings]=useState(false);
  const [systemSettings,setSystemSettings]=useState<AdminSettings>(FALLBACK_SETTINGS);
  const [logs,setLogs]=useState<AuditLog[]>([]);
  const [health,setHealth]=useState<Health>();
  const [adminBusy,setAdminBusy]=useState('');
  const [support,setSupport]=useState<SupportSession|null>(null);
  const screenVideo=useRef<HTMLVideoElement>(null);
  const screenStage=useRef<HTMLDivElement>(null);
  const screenPeer=useRef<RTCPeerConnection|null>(null);
  const screenOfferKey=useRef('');
  const [screenStream,setScreenStream]=useState<MediaStream|null>(null);
  const [screenFrame,setScreenFrame]=useState('');
  const [screenConnection,setScreenConnection]=useState<'idle'|'waiting'|'connecting'|'connected'|'failed'>('idle');
  const title=useMemo(()=>nav.find(item=>item.id===section)?.label??'Yönetim',[section]);
  const filteredUsers=useMemo(()=>users.filter(user=>(!query.trim()||(user.email+' '+user.name).toLowerCase().includes(query.trim().toLowerCase()))&&(role==='Tümü'||(role==='Admin'?user.role==='admin':user.role!=='admin'))),[users,query,role]);
  const screenConnectionLabel=screenStream?'Canlı':screenFrame?'Canlı · yedek bağlantı':({idle:'Hazır',waiting:'Kullanıcı onayı bekleniyor',connecting:'Bağlanıyor…',connected:'Canlı',failed:'Bağlantı kurulamadı'}[screenConnection]);
  function resetScreenView(){
    screenPeer.current?.close();screenPeer.current=null;screenOfferKey.current='';
    setScreenStream(null);setScreenFrame('');setScreenConnection('idle');
    if(screenVideo.current)screenVideo.current.srcObject=null;
  }
  useEffect(()=>{
    const video=screenVideo.current;
    if(!video)return;
    video.srcObject=screenStream;
    if(screenStream)void video.play().catch(()=>{});
  },[screenStream]);

  useEffect(()=>{
    if(!selectedUserId||support?.status!=='approved'||support.mode!=='screen'||!support.id||screenStream){if(screenStream)setScreenFrame('');return;}
    let cancelled=false;
    const poll=async()=>{
      try{
        const response=await fetch(`/api/admin/users/${selectedUserId}/support/frame?id=${support.id}`,{credentials:'same-origin',cache:'no-store'});
        if(!response.ok)return;
        const data=await response.json().catch(()=>({}));
        if(!cancelled&&typeof data.frame==='string'&&data.frame.startsWith('data:image/jpeg;base64,')){
          setScreenFrame(data.frame);
        }
      }catch{}
    };
    void poll();const timer=window.setInterval(()=>void poll(),1000);
    return()=>{cancelled=true;clearInterval(timer)};
  },[selectedUserId,support?.id,support?.status,support?.mode,screenStream]);

  useEffect(()=>{
    if(bypassAuth)return;
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
  },[allowedEmail,clientId,bypassAuth]);

  async function loadUsers(){
    setUsersLoading(true);setUsersError('');
    try{
      const response=await fetch('/api/admin/users',{credentials:'same-origin'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(data.error||'Kullanıcılar alınamadı.');
      setUsers(data.users??[]);
    }catch(e){setUsersError(e instanceof Error?e.message:String(e))}
    finally{setUsersLoading(false)}
  }
  useEffect(()=>{if(auth==='allowed'){void loadUsers();void loadHealth();void loadSystemSettings()}},[auth]);
  useEffect(()=>{if(section==='logs')void loadLogs();if(section==='system')void loadHealth()},[section]);
  useEffect(()=>{
    if(section!=='user-settings'||!selectedUserId)return;
    const timer=setInterval(()=>void loadSupport(selectedUserId),2500);
    return()=>clearInterval(timer);
  },[section,selectedUserId]);
  useEffect(()=>{
    if(!selectedUserId||support?.status!=='approved'||support.mode!=='screen'||!support.offer)return;
    const key=JSON.stringify(support.offer);
    if(screenOfferKey.current===key)return;
    screenOfferKey.current=key;setScreenConnection('connecting');setScreenStream(null);
    let cancelled=false;
    void (async()=>{
      try{
        screenPeer.current?.close();
        const pc=new RTCPeerConnection({iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}]});
        screenPeer.current=pc;
        const updateState=()=>{
          if(cancelled)return;
          if(pc.connectionState==='connected')setScreenConnection('connected');
          else if(pc.connectionState==='failed'||pc.connectionState==='closed')setScreenConnection('failed');
          else if(pc.connectionState==='connecting'||pc.connectionState==='new'||pc.connectionState==='disconnected')setScreenConnection('connecting');
        };
        pc.onconnectionstatechange=updateState;
        pc.oniceconnectionstatechange=()=>{if(pc.iceConnectionState==='failed'&&!cancelled)setScreenConnection('failed')};
        pc.ontrack=event=>{
          if(cancelled)return;
          const stream=event.streams[0]??new MediaStream();
          if(!event.streams[0])stream.addTrack(event.track);
          setScreenFrame('');setScreenStream(stream);
        };
        await pc.setRemoteDescription(support.offer!);
        const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
        if(pc.iceGatheringState!=='complete')await new Promise<void>(resolve=>{const done=()=>{if(pc.iceGatheringState==='complete'){pc.removeEventListener('icegatheringstatechange',done);resolve()}};pc.addEventListener('icegatheringstatechange',done);setTimeout(()=>{pc.removeEventListener('icegatheringstatechange',done);resolve()},7000)});
        await getJson(`/api/admin/users/${selectedUserId}/support/signal`,{method:'POST',body:JSON.stringify({id:support.id,answer:pc.localDescription})});
        if(!cancelled)setUserNotice('Ekran bağlantısı yanıtlandı. Canlı görüntü bekleniyor.');
      }catch(e){
        if(!cancelled){setScreenConnection('failed');setUsersError(e instanceof Error?e.message:String(e))}
      }
    })();
    return()=>{cancelled=true};
  },[support,selectedUserId]);
  async function getJson(path:string,options?:RequestInit){
    const response=await fetch(path,{credentials:'same-origin',...options,headers:{'content-type':'application/json',...(options?.headers||{})}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.error||'İşlem başarısız.');
    return data;
  }
  async function loadHealth(){try{const data=await getJson('/api/admin/health');setHealth(data)}catch{setHealth({adminApi:false,auth:false,userStore:false})}}
  async function loadSystemSettings(){try{const data=await getJson('/api/admin/settings');setSystemSettings(data.settings??FALLBACK_SETTINGS)}catch(e){setUsersError(e instanceof Error?e.message:String(e))}}
  async function loadLogs(){try{const data=await getJson('/api/admin/logs');setLogs(data.logs??[])}catch(e){setUsersError(e instanceof Error?e.message:String(e))}}
  async function loadUserSettings(id:number){
    setSelectedUserId(id);setAdminBusy('user-settings');setUsersError('');setSupport(null);
    try{const data=await getJson(`/api/admin/users/${id}/settings`);setUserSettings(data.settings??systemSettings);setCustomSettings(!!data.custom);await loadSupport(id)}
    catch(e){setUsersError(e instanceof Error?e.message:String(e))}
    finally{setAdminBusy('')}
  }
  async function saveUserSettings(){
    if(!selectedUserId)return;setAdminBusy('user-settings');setUsersError('');
    try{const data=await getJson(`/api/admin/users/${selectedUserId}/settings`,{method:'POST',body:JSON.stringify({settings:userSettings})});setUserSettings(data.settings);setCustomSettings(true);setUserNotice(support?.status==='approved'?'Ayarlar kaydedildi ve kullanıcının açık Serula oturumuna uygulanıyor.':'Kullanıcıya özel varsayılanlar kaydedildi.')}
    catch(e){setUsersError(e instanceof Error?e.message:String(e))}
    finally{setAdminBusy('')}
  }
  async function resetUserSettings(){
    if(!selectedUserId)return;setAdminBusy('user-settings');setUsersError('');
    try{const data=await getJson(`/api/admin/users/${selectedUserId}/settings`,{method:'DELETE',body:'{}'});setUserSettings(data.settings);setCustomSettings(false);setUserNotice('Kullanıcı sistem varsayılanlarına döndürüldü.')}
    catch(e){setUsersError(e instanceof Error?e.message:String(e))}
    finally{setAdminBusy('')}
  }
  async function loadSupport(id:number){
    try{
      const data=await getJson(`/api/admin/users/${id}/support`),next=data.support??null;
      setSupport(next);
      if(next?.mode==='screen'&&next.status==='pending')setScreenConnection('waiting');
      if(!next||next.mode!=='screen'||!['pending','approved'].includes(next.status))resetScreenView();
    }catch{setSupport(null);resetScreenView()}
  }
  async function requestSupport(mode:'settings'|'screen'='settings',userId=selectedUserId){
    if(!userId)return;setSelectedUserId(userId);setAdminBusy('support');setUsersError('');setUserNotice('');
    if(mode==='screen'){resetScreenView();setScreenConnection('waiting')}
    try{const data=await getJson(`/api/admin/users/${userId}/support`,{method:'POST',body:JSON.stringify({mode})});setSupport(data.support);setUserNotice(mode==='screen'?'Ekran paylaşımı isteği kullanıcıya gönderildi. Onay bekleniyor.':'Uzaktan destek isteği kullanıcıya gönderildi. Kullanıcının onayı bekleniyor.')}
    catch(e){setUsersError(e instanceof Error?e.message:String(e))}
    finally{setAdminBusy('')}
  }
  async function endSupport(){
    if(!selectedUserId)return;setAdminBusy('support');setUsersError('');
    try{await getJson(`/api/admin/users/${selectedUserId}/support`,{method:'DELETE',body:'{}'});resetScreenView();setSupport(null);setUserNotice('Uzaktan destek oturumu kapatıldı.')}
    catch(e){setUsersError(e instanceof Error?e.message:String(e))}
    finally{setAdminBusy('')}
  }
  async function saveSystemSettings(){
    setAdminBusy('system-settings');setUsersError('');
    try{const data=await getJson('/api/admin/settings',{method:'POST',body:JSON.stringify({settings:systemSettings})});setSystemSettings(data.settings);setUserNotice('Sistem varsayılanları kaydedildi.')}
    catch(e){setUsersError(e instanceof Error?e.message:String(e))}
    finally{setAdminBusy('')}
  }
  async function setUnlimited(user:AdminUser,unlimited:boolean){
    setSavingUserId(user.id);setUsersError('');
    try{await getJson(`/api/admin/users/${user.id}/unlimited`,{method:'POST',body:JSON.stringify({unlimited})});await loadUsers()}
    catch(e){setUsersError(e instanceof Error?e.message:String(e))}
    finally{setSavingUserId(undefined)}
  }
  async function setTestDxf(user:AdminUser,enabled:boolean){
    setSavingUserId(user.id);setUsersError('');setUserNotice('');
    try{
      await getJson(`/api/admin/users/${user.id}/test-dxf`,{method:'POST',body:JSON.stringify({enabled})});
      setUserNotice(user.email+' için Test DXF '+(enabled?'açıldı.':'kapatıldı.'));
      await loadUsers();
    }catch(e){setUsersError(e instanceof Error?e.message:String(e))}
    finally{setSavingUserId(undefined)}
  }
  async function saveCredits(user:AdminUser,credits:number){
    setSavingUserId(user.id);setUsersError('');
    try{
      const response=await fetch(`/api/admin/users/${user.id}/credits`,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({credits})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(data.error||'Hak güncellenemedi.');
      await loadUsers();
    }catch(e){setUsersError(e instanceof Error?e.message:String(e))}
    finally{setSavingUserId(undefined)}
  }

  async function sendPasswordReset(user:AdminUser){
    if(!confirm(user.email+' adresine şifre sıfırlama e-postası gönderilsin mi?'))return;
    setResettingUserId(user.id);setUsersError('');setUserNotice('');
    try{
      const response=await fetch(`/api/admin/users/${user.id}/password-reset`,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{}'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(data.error||'Şifre sıfırlama e-postası gönderilemedi.');
      setUserNotice(user.email+' adresine şifre sıfırlama bağlantısı gönderildi.');
    }catch(e){setUsersError(e instanceof Error?e.message:String(e))}
    finally{setResettingUserId(undefined)}
  }

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
        <div className="admin-heading"><div><p>Yönetim</p><h1>{title}</h1></div><span className="admin-connection">{health?.adminApi?'Sunucu bağlı':health?'Sunucu hatası':'Kontrol ediliyor…'}</span></div>

        {section==='overview'&&<>
          <section className="admin-metrics">
            <Metric label="Toplam kullanıcı" value="—" detail="D1 kullanıcı veritabanı"/>
            <Metric label="Aktif kullanıcı" value={String(users.filter(user=>!!user.lastLoginAt).length)} detail="Giriş kaydı olan kullanıcı"/>
            <Metric label="Bugünkü nesting" value="—" detail="İstatistik servisi bağlı değil"/>
            <Metric label="Sistem durumu" value="Hazır" detail={(localDevelopment?'Yerel geliştirme':'İstemci')+' · v'+packageInfo.version}/>
          </section>
          <section className="admin-grid-two">
            <article className="admin-card"><div className="admin-card-head"><h2>Hızlı Durum</h2><span className="admin-badge">İstemci</span></div>
              <dl className="admin-status-list"><div><dt>Uygulama</dt><dd>Çalışıyor</dd></div><div><dt>Admin rotası</dt><dd>/admin</dd></div><div><dt>Kimlik doğrulama</dt><dd>{localDevelopment?'Yerel test modu':'E-posta + parola'}</dd></div><div><dt>Kalıcı veritabanı</dt><dd>D1 bağlı</dd></div></dl>
            </article>
            <article className="admin-card"><div className="admin-card-head"><h2>Son İşlemler</h2></div><Empty title="Henüz veri yok">Kalıcı işlem geçmişi bağlandığında burada kullanıcı, proje, nesting ve dışa aktarma kayıtları gösterilecek.</Empty></article>
          </section>
        </>}

        {section==='users'&&<section className="admin-card admin-users">
          <div className="admin-card-head"><div><h2>Kullanıcı Yönetimi</h2><p>E-posta veya Google ile giriş yapan kullanıcıların hesap, kota ve 375 günlük lisans bilgilerini yönetin.</p></div><button onClick={()=>void loadUsers()} disabled={usersLoading}>↻ Yenile</button></div>
          <div className="admin-toolbar"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Kullanıcı ara…" aria-label="Kullanıcı ara"/><select value={role} onChange={e=>setRole(e.target.value)}><option>Tümü</option><option>Admin</option><option>Operatör</option></select></div>
          {usersError&&<p className="field-error" role="alert">{usersError}</p>}{userNotice&&<p className="admin-notice" role="status">{userNotice}</p>}
          <div className="admin-table"><div className="admin-table-head"><span>Kullanıcı</span><span>Rol / Giriş</span><span>Nesting hakkı</span><span>Lisans</span><span>İşlemler</span></div>
            {usersLoading?<Empty title="Yükleniyor">Kullanıcı bilgileri D1 veritabanından alınıyor.</Empty>:filteredUsers.length?filteredUsers.map(user=><div className="admin-user-row" key={user.id}>
              <span className="admin-user-identity"><strong>{user.name||'İsimsiz'}</strong><small>{user.email}</small><small>{user.lastLoginAt?'Son giriş: '+new Date(user.lastLoginAt).toLocaleString('tr-TR'):'Henüz giriş yok'}</small></span>
              <span><strong>{user.role==='admin'?'Admin':'Kullanıcı'}</strong><small>{user.authProvider==='google'?'Google / Gmail':'E-posta'}</small></span>
              <span className="admin-user-quota"><div className="admin-switch-row"><label className="switch"><input type="checkbox" checked={user.unlimited} disabled={savingUserId===user.id} onChange={e=>void setUnlimited(user,e.target.checked)}/><span className="slider"><span className="glow"/><span className="icon-on">✓</span><span className="icon-off">○</span></span></label><span>Kotasız / Sınırsız</span></div>{!user.unlimited&&<label>Hak<input aria-label={user.email+' nesting hakkı'} type="number" min="0" max="100000" defaultValue={user.credits} key={user.id+'-'+user.credits} onBlur={e=>{const value=Math.max(0,Math.trunc(e.currentTarget.valueAsNumber||0));if(value!==user.credits)void saveCredits(user,value)}}/></label>}</span>
              <span><strong>{user.licenseExpiresAt?new Date(user.licenseExpiresAt).toLocaleDateString('tr-TR'):'Lisans yok'}</strong><small>{user.licenseStartedAt?'Başlangıç: '+new Date(user.licenseStartedAt).toLocaleDateString('tr-TR'):'375 gün · etkinleştirme bekliyor'}</small></span>
              <span className="admin-user-actions"><button className={user.testDxfEnabled?'primary':''} onClick={()=>void setTestDxf(user,!user.testDxfEnabled)} disabled={savingUserId===user.id}>{user.testDxfEnabled?'Test DXF Kapat':'Test DXF Aç'}</button><button onClick={()=>{setSection('user-settings');void loadUserSettings(user.id)}}>Ayarlar</button><button className="screen-support-button" onClick={()=>{setSection('user-settings');void loadUserSettings(user.id).then(()=>requestSupport('screen',user.id))}}>Ekrana bağlan</button><button onClick={()=>void sendPasswordReset(user)} disabled={resettingUserId===user.id}>{resettingUserId===user.id?'Gönderiliyor…':'Şifre sıfırla'}</button></span>
            </div>):<Empty title="Kullanıcı bulunamadı">Filtreye uyan kullanıcı yok.</Empty>}
          </div>
        </section>}

        {section==='roles'&&<section className="admin-grid-two">
          <article className="admin-card"><div className="admin-card-head"><h2>Admin</h2><span className="admin-badge">Tam erişim</span></div><ul className="admin-check-list"><li>✓ Kullanıcı yönetimi</li><li>✓ Sistem varsayılanları</li><li>✓ Log ve geçmiş</li><li>✓ Kullanıcı ayarlarını kilitleme</li></ul></article>
          <article className="admin-card"><div className="admin-card-head"><h2>Operatör</h2><span className="admin-badge muted">Sınırlı</span></div><ul className="admin-check-list"><li>✓ DXF içe aktarma</li><li>✓ Nesting çalıştırma</li><li>✓ DXF dışa aktarma</li><li>— Admin erişimi yok</li></ul></article>
          <article className="admin-card admin-span-two"><Empty title="Rol düzenleme sunucu bağlantısı gerektiriyor">Yetki değişiklikleri istemci tarafında taklit edilmeyecek; güvenli API bağlandığında bu bölüm aktif olacak.</Empty></article>
        </section>}

        {section==='user-settings'&&<section className="admin-card">
          <div className="admin-card-head"><div><h2>Kullanıcıya Özel Varsayılanlar</h2><p>Seçilen kullanıcı için sistem varsayılanlarının üzerine uygulanır.</p></div><select aria-label="Kullanıcı seç" value={selectedUserId??''} onChange={e=>{const id=Number(e.target.value);if(id)void loadUserSettings(id);else setSelectedUserId(undefined)}}><option value="">Kullanıcı seç…</option>{users.map(user=><option key={user.id} value={user.id}>{user.name||user.email} · {user.email}</option>)}</select></div>
          {usersError&&<p className="field-error" role="alert">{usersError}</p>}{userNotice&&<p className="admin-notice" role="status">{userNotice}</p>}{selectedUserId?<><div className="admin-selected-user"><strong>{users.find(u=>u.id===selectedUserId)?.name||users.find(u=>u.id===selectedUserId)?.email}</strong><span>{customSettings?'Özel varsayılanlar aktif':'Sistem varsayılanları kullanılıyor'}</span></div>
          <div className="admin-support-box"><div><strong>{support?.mode==='screen'?'Ekran bağlantısı':'Uzaktan destek'}</strong><small>{support?.mode==='screen'&&support?.status!=='ended'?screenConnectionLabel:support?.status==='approved'?'Aktif · kullanıcı onayladı':support?.status==='pending'?'Kullanıcı onayı bekleniyor':'Kapalı'}</small><p>{support?.mode==='screen'?'Kullanıcı onayladığında seçtiği ekranı canlı görebilirsiniz. Kullanıcı istediği an paylaşımı durdurabilir.':'Bu özellik yalnızca Serula içindeki ayarları canlı uygular. Kullanıcının onayı olmadan aktif olmaz.'}</p></div><div>{support?.status==='approved'||support?.status==='pending'?<button onClick={()=>void endSupport()} disabled={adminBusy==='support'}>Desteği bitir</button>:<><button onClick={()=>void requestSupport('screen')} disabled={adminBusy==='support'}>Ekrana bağlan</button><button className="primary" onClick={()=>void requestSupport('settings')} disabled={adminBusy==='support'}>{adminBusy==='support'?'Gönderiliyor…':'Ayar desteği iste'}</button></>}</div></div>
          {support?.mode==='screen'&&support.status==='approved'&&<div className={'admin-screen-view screen-'+screenConnection}>
            <div className="admin-screen-toolbar"><strong>Canlı ekran</strong><span>{screenConnectionLabel}</span><button onClick={()=>{const stage=screenStage.current;if(stage?.requestFullscreen)void stage.requestFullscreen()}}>Tam ekran</button></div>
            <div className="admin-screen-stage" ref={screenStage}>
              {screenStream?<video ref={screenVideo} autoPlay playsInline muted/>:screenFrame?<img className="admin-screen-fallback" src={screenFrame} alt="Kullanıcının paylaştığı ekran"/>:<video ref={screenVideo} autoPlay playsInline muted/>}
              {!screenStream&&!screenFrame&&<div className="admin-screen-overlay">{screenConnection==='failed'?'Doğrudan görüntü bağlantısı kurulamadı. Yedek görüntü aktarımı başlatılıyor…':'Karşı tarafın ekran görüntüsü bekleniyor…'}</div>}
            </div>
            <small>{screenFrame&&!screenStream?'Yedek bağlantı üzerinden ekran görüntüsü · yaklaşık 1–2 saniye gecikmeli':'Kullanıcının paylaştığı ekran · “Tam ekran” ile büyütebilirsiniz.'}</small>
          </div>}
          <div className="admin-settings-grid">
            <label>Malzeme genişliği (mm)<input type="number" min="1" value={userSettings.materialWidthMm} onChange={e=>setUserSettings({...userSettings,materialWidthMm:e.target.valueAsNumber})}/></label>
            <label>Parça aralığı (mm)<input type="number" min="0" step="0.1" value={userSettings.clearanceMm} onChange={e=>setUserSettings({...userSettings,clearanceMm:e.target.valueAsNumber})}/></label>
            <label>Kenar payı (mm)<input type="number" min="0" step="0.1" value={userSettings.marginMm} onChange={e=>setUserSettings({...userSettings,marginMm:e.target.valueAsNumber})}/></label>
            <label>Rotasyon<select value={userSettings.rotation} onChange={e=>setUserSettings({...userSettings,rotation:e.target.value as AdminSettings['rotation']})}><option value="fixed">0°</option><option value="half">0° / 180°</option><option value="free">Serbest</option></select></label>
            <label>Malzeme tipi<select value={userSettings.materialType} onChange={e=>setUserSettings({...userSettings,materialType:e.target.value as AdminSettings['materialType']})}><option value="roll">Rulo</option><option value="sheet">Plaka</option></select></label>
            <label>Solver profili<select value={userSettings.solverPreset} onChange={e=>setUserSettings({...userSettings,solverPreset:e.target.value as AdminSettings['solverPreset']})}><option value="standard">Standart</option><option value="fast">Hızlı</option></select></label>
          </div><div className="admin-save-row"><button onClick={()=>void resetUserSettings()} disabled={adminBusy==='user-settings'}>Sistem varsayılanlarına dön</button><button className="primary" onClick={()=>void saveUserSettings()} disabled={adminBusy==='user-settings'}>{adminBusy==='user-settings'?'Kaydediliyor…':'Kullanıcı ayarlarını kaydet'}</button></div></>:<Empty title="Kullanıcı seçin">Yukarıdaki listeden bir kullanıcı seçerek ona özel varsayılanları düzenleyebilirsiniz.</Empty>}
        </section>}

        {section==='defaults'&&<section className="admin-card">
          <div className="admin-card-head"><div><h2>Sistem Varsayılanları</h2><p>Yeni kullanıcı ve projeler için başlangıç ayarları.</p></div><span className="admin-badge">Aktif</span></div>
          <div className="admin-settings-grid">
            <label>Varsayılan malzeme genişliği (mm)<input type="number" min="1" value={systemSettings.materialWidthMm} onChange={e=>setSystemSettings({...systemSettings,materialWidthMm:e.target.valueAsNumber})}/></label>
            <label>Parça aralığı (mm)<input type="number" min="0" step="0.1" value={systemSettings.clearanceMm} onChange={e=>setSystemSettings({...systemSettings,clearanceMm:e.target.valueAsNumber})}/></label>
            <label>Kenar payı (mm)<input type="number" min="0" step="0.1" value={systemSettings.marginMm} onChange={e=>setSystemSettings({...systemSettings,marginMm:e.target.valueAsNumber})}/></label>
            <label>Varsayılan rotasyon<select value={systemSettings.rotation} onChange={e=>setSystemSettings({...systemSettings,rotation:e.target.value as AdminSettings['rotation']})}><option value="fixed">0°</option><option value="half">0° / 180°</option><option value="free">Serbest</option></select></label>
            <label>Varsayılan malzeme<select value={systemSettings.materialType} onChange={e=>setSystemSettings({...systemSettings,materialType:e.target.value as AdminSettings['materialType']})}><option value="roll">Rulo</option><option value="sheet">Plaka</option></select></label>
            <label>Solver profili<select value={systemSettings.solverPreset} onChange={e=>setSystemSettings({...systemSettings,solverPreset:e.target.value as AdminSettings['solverPreset']})}><option value="standard">Standart</option><option value="fast">Hızlı</option></select></label>
          </div>
          <div className="admin-save-row"><small>Kullanıcıya özel ayar yoksa bu değerler kullanılır.</small><button className="primary" onClick={()=>void saveSystemSettings()} disabled={adminBusy==='system-settings'}>{adminBusy==='system-settings'?'Kaydediliyor…':'Kaydet'}</button></div>
        </section>}

        {section==='history'&&<section className="admin-card">
          <div className="admin-card-head"><div><h2>İşlem Geçmişi</h2><p>Nesting, proje ve dışa aktarma kayıtları.</p></div><button disabled>Dışa aktar</button></div>
          <div className="admin-toolbar"><input placeholder="Proje veya kullanıcı ara…" disabled/><select disabled><option>Son 30 gün</option></select></div>
          <Empty title="Geçmiş kaydı yok">Sunucu kayıt altyapısı bağlandığında işlem süresi, malzeme kullanımı, plaka sayısı ve kullanıcı bilgisi burada görünecek.</Empty>
        </section>}

        {section==='logs'&&<section className="admin-card">
          <div className="admin-card-head"><div><h2>Sistem Logları</h2><p>Giriş, nesting, dışa aktarma ve yönetim işlemleri.</p></div><button onClick={()=>void loadLogs()}>↻ Yenile</button></div>
          {usersError&&<p className="field-error" role="alert">{usersError}</p>}
          <div className="admin-log-window">{logs.length?logs.map(log=><div className="admin-log-row" key={log.id}><time>{new Date(log.createdAt).toLocaleString('tr-TR')}</time><strong>{log.action}</strong><span>{log.actorEmail||log.actorType}{log.targetEmail?' → '+log.targetEmail:''}</span>{log.detail&&<small>{log.detail}</small>}<b>{log.success?'Başarılı':'Hata'}</b></div>):<span>Henüz sistem logu yok.</span>}</div>
        </section>}

        {section==='system'&&<section className="admin-grid-two">
          <article className="admin-card"><h2>Uygulama</h2><dl className="admin-status-list"><div><dt>Ürün</dt><dd>Serula Nesting</dd></div><div><dt>Sürüm</dt><dd>v{packageInfo.version}</dd></div><div><dt>Yönetim yolu</dt><dd>/admin</dd></div><div><dt>Dağıtım</dt><dd>Cloudflare</dd></div></dl></article>
          <article className="admin-card"><div className="admin-card-head"><h2>Güvenlik</h2><button onClick={()=>void loadHealth()}>Kontrol et</button></div><dl className="admin-status-list"><div><dt>Admin API</dt><dd className={health?.adminApi?'status-ok':'status-error'}>{health?.adminApi?'Aktif':health?'Hata':'Kontrol ediliyor'}</dd></div><div><dt>Kimlik doğrulama</dt><dd className={health?.auth?'status-ok':'status-error'}>{health?.auth?'Aktif':health?'Hata':'Kontrol ediliyor'}</dd></div><div><dt>Kalıcı kullanıcı deposu</dt><dd className={health?.userStore?'status-ok':'status-error'}>{health?.userStore?'Aktif':health?'Hata':'Kontrol ediliyor'}</dd></div></dl></article>
        </section>}
      </main>
    </div>
  </div>;
}
