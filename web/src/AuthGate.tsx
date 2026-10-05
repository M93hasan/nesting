import {useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import packageInfo from '../package.json';
import {LanguageSelect,localeTag,useI18n} from './i18n';

export type SessionUser={id:number;email:string;name:string;role:string;credits:number;unlimited:boolean;licenseStartedAt?:string|null;licenseExpiresAt?:string|null;licenseExpired?:boolean};
type SupportSession={id:number;status:'pending'|'approved';mode?:'settings'|'screen';expiresAt?:string;offer?:RTCSessionDescriptionInit|null;answer?:RTCSessionDescriptionInit|null};
async function request(path:string,options?:RequestInit){
  const response=await fetch(path,{credentials:'same-origin',...options,headers:{'content-type':'application/json',...(options?.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'İşlem başarısız.');
  return data;
}
export async function authorizeExport(projectName:string,sourceFileName:string,fileName:string,dxf:string,projectJson:string){
  const response=await fetch('/api/export/authorize',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({projectName,sourceFileName,fileName,dxf,projectJson})});
  const data=await response.json().catch(()=>({}));
  if(response.status===401){window.dispatchEvent(new Event('serula-login-required'));throw Error(data.error||'DXF indirmek için giriş yapmalısınız.')}
  if(response.status===402)throw Error((data.error||'Nesting hakkınız kalmadı.')+' Yeni hak için m93hasan@icloud.com veya +90 539 348 06 22 üzerinden iletişime geçebilirsiniz.');
  if(!response.ok)throw Error(data.error||'İndirme yetkisi alınamadı.');
  return data;
}

export function UserGate({children}:{children:ReactNode}){
  const {locale}=useI18n();
  const [user,setUser]=useState<SessionUser|null|undefined>(undefined);
  const resetToken=new URLSearchParams(location.search).get('reset')||'';
  const [open,setOpen]=useState(!!resetToken),[mode,setMode]=useState<'login'|'register'|'reset'>(resetToken?'reset':'login');
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState('');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [support,setSupport]=useState<SupportSession|null>(null);
  const lastRemoteSettings=useRef('');
  const supportPeer=useRef<RTCPeerConnection|null>(null);
  const supportStream=useRef<MediaStream|null>(null);
  const supportAnswer=useRef('');
  const fallbackTimer=useRef<number|undefined>(undefined);
  const fallbackVideo=useRef<HTMLVideoElement|null>(null);
  const fallbackSession=useRef<number|undefined>(undefined);
  const [screenConnection,setScreenConnection]=useState<'idle'|'connecting'|'connected'|'fallback'|'failed'>('idle');
  const [accountHost,setAccountHost]=useState<HTMLElement|null>(null);

  const refresh=()=>fetch('/api/auth/me',{credentials:'same-origin'}).then(r=>r.ok?r.json():{user:null}).then(d=>setUser(d.user??null)).catch(()=>setUser(null));
  const stopFrameFallback=()=>{
    if(fallbackTimer.current!==undefined){clearInterval(fallbackTimer.current);fallbackTimer.current=undefined}
    if(fallbackVideo.current){fallbackVideo.current.pause();fallbackVideo.current.srcObject=null;fallbackVideo.current.remove();fallbackVideo.current=null}
    fallbackSession.current=undefined;
  };
  const stopScreenSupport=()=>{
    stopFrameFallback();
    supportPeer.current?.close();supportPeer.current=null;
    supportStream.current?.getTracks().forEach(track=>track.stop());supportStream.current=null;
    supportAnswer.current='';setScreenConnection('idle');
  };
  const startFrameFallback=async(stream:MediaStream,sessionId:number)=>{
    if(fallbackSession.current===sessionId)return;
    stopFrameFallback();fallbackSession.current=sessionId;
    const video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=stream;
    video.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px;top:-10px';
    document.body.appendChild(video);fallbackVideo.current=video;
    try{await video.play()}catch{}
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{alpha:false});
    let sending=false;
    const send=async()=>{
      if(sending||!ctx||video.videoWidth<2||video.videoHeight<2||stream.getVideoTracks()[0]?.readyState!=='live')return;
      sending=true;
      try{
        const scale=Math.min(1,960/video.videoWidth,540/video.videoHeight);
        canvas.width=Math.max(2,Math.round(video.videoWidth*scale));canvas.height=Math.max(2,Math.round(video.videoHeight*scale));
        ctx.drawImage(video,0,0,canvas.width,canvas.height);
        const frame=canvas.toDataURL('image/jpeg',0.48);
        const response=await fetch('/api/support/frame',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({id:sessionId,frame})});
        if(response.ok)setScreenConnection('fallback');
      }catch{}finally{sending=false}
    };
    await send();fallbackTimer.current=window.setInterval(()=>void send(),1500);
  };
  const waitIce=async(pc:RTCPeerConnection)=>{
    if(pc.iceGatheringState==='complete')return;
    await new Promise<void>(resolve=>{
      const done=()=>{if(pc.iceGatheringState==='complete'){pc.removeEventListener('icegatheringstatechange',done);resolve()}};
      pc.addEventListener('icegatheringstatechange',done);
      setTimeout(()=>{pc.removeEventListener('icegatheringstatechange',done);resolve()},5000);
    });
  };
  useEffect(()=>{setAccountHost(document.getElementById('serula-account-slot'));void refresh();const listener=()=>void refresh();const need=()=>setOpen(true);window.addEventListener('serula-auth-updated',listener);window.addEventListener('serula-login-required',need);return()=>{window.removeEventListener('serula-auth-updated',listener);window.removeEventListener('serula-login-required',need)}},[]);
  useEffect(()=>{
    if(!user){setSupport(null);lastRemoteSettings.current='';return;}
    let cancelled=false;
    const loadInitialSettings=async()=>{
      try{
        const response=await fetch('/api/settings/effective',{credentials:'same-origin'});
        if(response.ok){
          const data=await response.json();
          if(!cancelled)window.dispatchEvent(new CustomEvent('serula-user-settings',{detail:data.settings}));
        }
      }catch{}
    };
    const poll=async()=>{
      try{
        const response=await fetch('/api/support/status',{credentials:'same-origin'});
        if(!response.ok){if(!cancelled)setSupport(null);return;}
        const data=await response.json();
        if(cancelled)return;
        const next=data.support??null;setSupport(next);
        if(!next&&supportStream.current)stopScreenSupport();
        if(next?.status==='approved'&&next.mode==='screen'){
          const answerSignature=JSON.stringify(next.answer??null);
          if(next.answer&&supportPeer.current&&!supportPeer.current.remoteDescription&&answerSignature!==supportAnswer.current){
            supportAnswer.current=answerSignature;
            try{await supportPeer.current.setRemoteDescription(next.answer)}catch{}
          }
        }else if(next?.status==='approved'){
          const settingsResponse=await fetch('/api/settings/effective',{credentials:'same-origin'});
          if(settingsResponse.ok){
            const settingsData=await settingsResponse.json();
            const signature=JSON.stringify(settingsData.settings??{});
            if(signature&&signature!==lastRemoteSettings.current){
              lastRemoteSettings.current=signature;
              window.dispatchEvent(new CustomEvent('serula-remote-settings',{detail:settingsData.settings}));
            }
          }
        }else lastRemoteSettings.current='';
      }catch{if(!cancelled)setSupport(null)}
    };
    void loadInitialSettings();void poll();const timer=setInterval(()=>void poll(),4000);
    return()=>{cancelled=true;clearInterval(timer)};
  },[user]);

  async function approveSupport(){
    if(!support)return;
    if(support.mode!=='screen'){
      const data=await request('/api/support/respond',{method:'POST',body:JSON.stringify({id:support.id,approve:true})});
      setSupport(data.support);return;
    }
    if(!navigator.mediaDevices?.getDisplayMedia){setError('Bu tarayıcı ekran paylaşımını desteklemiyor. Masaüstü Chrome, Edge veya Safari kullanın.');return;}
    setBusy(true);setError('');setScreenConnection('connecting');
    try{
      const stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:15,max:30}},audio:false});
      supportStream.current=stream;
      const data=await request('/api/support/respond',{method:'POST',body:JSON.stringify({id:support.id,approve:true})});
      setSupport(data.support);
      const pc=new RTCPeerConnection({iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}]});
      supportPeer.current=pc;
      pc.onconnectionstatechange=()=>{
        if(pc.connectionState==='connected'){stopFrameFallback();setScreenConnection('connected')}
        else if(pc.connectionState==='failed'||pc.connectionState==='closed'){void startFrameFallback(stream,support.id)}
        else if(pc.connectionState==='connecting'||pc.connectionState==='new'||pc.connectionState==='disconnected')setScreenConnection(previous=>previous==='fallback'?'fallback':'connecting');
      };
      pc.oniceconnectionstatechange=()=>{if(pc.iceConnectionState==='failed')void startFrameFallback(stream,support.id)};
      stream.getTracks().forEach(track=>{pc.addTrack(track,stream);track.addEventListener('ended',()=>{void request('/api/support/end',{method:'POST',body:JSON.stringify({id:support.id})}).catch(()=>{});stopScreenSupport();setSupport(null)},{once:true})});
      const offer=await pc.createOffer({offerToReceiveAudio:false,offerToReceiveVideo:false});await pc.setLocalDescription(offer);await waitIce(pc);
      await request('/api/support/signal',{method:'POST',body:JSON.stringify({id:support.id,offer:pc.localDescription})});
      window.setTimeout(()=>{if(supportPeer.current===pc&&pc.connectionState!=='connected')void startFrameFallback(stream,support.id)},8000);
    }catch(e){
      stopScreenSupport();setScreenConnection('failed');
      setError(e instanceof Error?e.message:String(e));
    }finally{setBusy(false)}
  }
  async function declineSupport(){
    if(!support)return;
    await request('/api/support/respond',{method:'POST',body:JSON.stringify({id:support.id,approve:false})});
    stopScreenSupport();setSupport(null);
  }
  async function endSupportFromUser(){
    if(!support)return;
    await request('/api/support/end',{method:'POST',body:JSON.stringify({id:support.id})});
    stopScreenSupport();setSupport(null);
  }

  async function submit(e:React.FormEvent){    e.preventDefault();setBusy(true);setError('');
    try{if(mode==='reset'){await request('/api/auth/reset-password',{method:'POST',body:JSON.stringify({token:resetToken,password})});history.replaceState({},'',location.pathname);setMode('login');setPassword('');setError('Parolanız yenilendi. Şimdi giriş yapabilirsiniz.');return;}const data=await request(mode==='register'?'/api/auth/register':'/api/auth/login',{method:'POST',body:JSON.stringify({email,password,name,locale})});setUser(data.user);setOpen(false);window.dispatchEvent(new Event('serula-auth-updated'))}
    catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
  }
  return <>{children}
    {accountHost&&createPortal(user?
      <details className="auth-account-menu">
        <summary aria-label="Hesap menüsü"><span className="auth-avatar">{(user.name||user.email).trim().charAt(0).toUpperCase()}</span><span className="auth-account-name">{user.name||user.email}</span><span className="auth-chevron" aria-hidden="true">▾</span></summary>
        <div className="auth-account-dropdown"><strong>{user.name||'Kullanıcı'}</strong><small>{user.email}</small><div className="auth-account-meta"><span>{user.unlimited?'Sınırsız kullanım':user.credits+' hak kaldı'}</span><span>{user.licenseExpiresAt?(user.licenseExpired?'Lisans süresi doldu':'Lisans: '+new Date(user.licenseExpiresAt).toLocaleDateString(localeTag(locale))):'Lisans: süresiz'}</span></div><LanguageSelect/><button className="danger-button" onClick={async()=>{await request('/api/auth/logout',{method:'POST',body:'{}'});setUser(null);window.dispatchEvent(new Event('serula-auth-updated'))}}>Çıkış yap</button></div>
      </details>
      :<button className="auth-login-header" onClick={()=>setOpen(true)}><span className="auth-avatar" aria-hidden="true">↪</span>Giriş yap</button>,accountHost)}
    {support?.status==='approved'&&<div className={'auth-support-active '+(support.mode==='screen'?'screen-'+screenConnection:'')}><span>{support.mode==='screen'?(screenConnection==='connected'?'Ekran paylaşımı canlı':screenConnection==='fallback'?'Ekran paylaşımı canlı · yedek bağlantı':screenConnection==='failed'?'Ekran bağlantısı kurulamadı':'Ekran bağlantısı kuruluyor…'):'Uzaktan destek aktif'}</span><button className="danger-button" onClick={()=>void endSupportFromUser()}>Bitir</button></div>}
    {support?.status==='pending'&&<div className="auth-screen auth-overlay"><div className="auth-card auth-support-card"><img src="/serula-logo.svg" alt=""/><h2>{support.mode==='screen'?'Ekran paylaşımı isteği':'Uzaktan destek isteği'}</h2><p>{support.mode==='screen'?'Serula yöneticisi ekranınızı canlı görmek istiyor. Paylaşılacak ekranı siz seçersiniz; izin vermeden görüntü aktarılmaz ve istediğiniz an durdurabilirsiniz.':'Serula yöneticisi yalnızca bu uygulamanın ayarlarını uzaktan düzenlemek istiyor. Tarayıcınızın diğer sekmelerine, dosyalarınıza veya cihazınıza erişim verilmez.'}</p>{error&&<p className="auth-error">{error}</p>}<div className="auth-support-actions"><button disabled={busy} onClick={()=>void declineSupport()}>Reddet</button><button disabled={busy} className="primary" onClick={()=>void approveSupport()}>{busy?'Bağlanıyor…':support.mode==='screen'?'Onayla ve ekranı paylaş':'Onayla'}</button></div></div></div>}
    {open&&!user&&<div className="auth-screen auth-overlay" onMouseDown={e=>{if(e.currentTarget===e.target)setOpen(false)}}><div className="auth-card">
      <img src="/serula-logo.svg" alt=""/><h1>Serula Nesting</h1><LanguageSelect/><p>DXF indirmek için giriş yapın. Dosya içe aktarma ve yerleştirme giriş yapmadan kullanılabilir.</p>
      {mode!=='reset'&&<div className="auth-tabs"><button className={mode==='login'?'active':''} onClick={()=>setMode('login')}>Giriş yap</button><button className={mode==='register'?'active':''} onClick={()=>setMode('register')}>Kayıt ol</button></div>}{mode==='reset'&&<h2>Yeni parola belirle</h2>}
      <form onSubmit={submit}>{mode==='register'&&<label>Adınız<input required value={name} onChange={e=>setName(e.target.value)}/></label>}{mode!=='reset'&&<label>E-posta<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>}<label>{mode==='reset'?'Yeni parola':'Parola'}<input type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>{busy?'Bekleyin…':mode==='reset'?'Parolayı değiştir':mode==='register'?'Hesap oluştur':'Giriş yap'}</button></form>
      {error&&<p className="auth-error">{error}</p>}<div className="auth-or"><span/>veya<span/></div><div className="auth-google"><button type="button" onClick={()=>{location.href="/google-login.html?locale="+encodeURIComponent(locale)}}>Google ile devam et</button></div><small>Yeni normal kullanıcılar 5 indirme/yerleştirme hakkıyla başlar.</small>
      <button onClick={()=>setOpen(false)}>Şimdilik kapat</button>
    </div></div>}
  </>;
}

export function AdminGate({children}:{children:ReactNode}){
  const [user,setUser]=useState<SessionUser|null|undefined>(undefined),[email,setEmail]=useState('M93Hasan@icloud.com'),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{fetch('/api/auth/admin-me',{credentials:'same-origin'}).then(async r=>{const d=await r.json().catch(()=>({}));setUser(r.ok&&d.user?.role==='admin'?d.user:null)}).catch(()=>setUser(null))},[]);
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const d=await request('/api/auth/admin-login',{method:'POST',body:JSON.stringify({email,password})});if(d.user.role!=='admin')throw Error('Bu hesabın yönetici yetkisi yok.');setUser(d.user)}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
  if(user===undefined)return <div className="auth-screen"><div className="auth-card"><p>Yönetici oturumu kontrol ediliyor…</p></div></div>;
  if(!user)return <div className="auth-screen"><div className="auth-card"><img src="/serula-logo.svg" alt=""/><h1>Serula Yönetim</h1><LanguageSelect/><p>Yönetici e-posta ve parolanızı girin.</p><div style={{margin:'10px 0 18px',fontWeight:700,opacity:.75}}>Sürüm v{packageInfo.version}</div><form onSubmit={submit}><label>E-posta<input type="email" autoComplete="username" autoFocus required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Parola<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>{busy?'Bekleyin…':'Yönetici girişi'}</button></form>{error&&<p className="auth-error">{error}</p>}</div></div>;
  return <>{children}</>;
}
