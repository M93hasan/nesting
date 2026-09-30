import {useEffect,useRef,useState,type ReactNode} from 'react';
import packageInfo from '../package.json';

export type SessionUser={id:number;email:string;name:string;role:string;credits:number;unlimited:boolean};
const GOOGLE_CLIENT_ID='249559754500-36grgmm2jucf2159d41efqdcqut02lj6.apps.googleusercontent.com';
type GoogleCredentialResponse={credential?:string};
type GoogleAccounts={id:{initialize:(options:{client_id:string;callback:(response:GoogleCredentialResponse)=>void;auto_select?:boolean;use_fedcm_for_button?:boolean})=>void;renderButton:(parent:HTMLElement,options:Record<string,unknown>)=>void}};
const google=()=> (window as Window & {google?:{accounts:GoogleAccounts}}).google;

async function request(path:string,options?:RequestInit){
  const response=await fetch(path,{credentials:'same-origin',...options,headers:{'content-type':'application/json',...(options?.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'İşlem başarısız.');
  return data;
}
export async function authorizeExport(projectName:string,sourceFileName:string){
  const response=await fetch('/api/export/authorize',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({projectName,sourceFileName})});
  const data=await response.json().catch(()=>({}));
  if(response.status===401){window.dispatchEvent(new Event('serula-login-required'));throw Error(data.error||'DXF indirmek için giriş yapmalısınız.')}
  if(response.status===402)throw Error((data.error||'Nesting hakkınız kalmadı.')+' Yeni hak için m93hasan@icloud.com veya +90 539 348 06 22 üzerinden iletişime geçebilirsiniz.');
  if(!response.ok)throw Error(data.error||'İndirme yetkisi alınamadı.');
  return data;
}

export function UserGate({children}:{children:ReactNode}){
  const [user,setUser]=useState<SessionUser|null|undefined>(undefined);
  const [open,setOpen]=useState(false),[mode,setMode]=useState<'login'|'register'>('login');
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState('');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const googleButton=useRef<HTMLDivElement>(null);

  const refresh=()=>fetch('/api/auth/me',{credentials:'same-origin'}).then(r=>r.ok?r.json():{user:null}).then(d=>setUser(d.user??null)).catch(()=>setUser(null));
  useEffect(()=>{void refresh();const listener=()=>void refresh();const need=()=>setOpen(true);window.addEventListener('serula-auth-updated',listener);window.addEventListener('serula-login-required',need);return()=>{window.removeEventListener('serula-auth-updated',listener);window.removeEventListener('serula-login-required',need)}},[]);
  useEffect(()=>{
    if(!open||user)return;
    let cancelled=false;
    const setup=()=>{
      if(!google()?.accounts.id||!googleButton.current)return;
      const accounts=google()?.accounts.id;if(!accounts)return;
      accounts.initialize({client_id:GOOGLE_CLIENT_ID,auto_select:false,use_fedcm_for_button:true,callback:async response=>{
        try{setBusy(true);setError('');const data=await request('/api/auth/google',{method:'POST',body:JSON.stringify({credential:response.credential})});if(!cancelled){setUser(data.user);setOpen(false)}}
        catch(e){if(!cancelled)setError(e instanceof Error?e.message:String(e))}finally{if(!cancelled)setBusy(false)}
      }});
      googleButton.current.replaceChildren();
      accounts.renderButton(googleButton.current,{theme:'outline',size:'large',text:'continue_with',shape:'pill',width:300});
    };
    if(google()?.accounts.id){setup();return()=>{cancelled=true}};
    const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;script.onload=setup;document.head.appendChild(script);
    return()=>{cancelled=true};
  },[open,user]);

  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError('');
    try{const data=await request(mode==='register'?'/api/auth/register':'/api/auth/login',{method:'POST',body:JSON.stringify({email,password,name})});setUser(data.user);setOpen(false)}
    catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
  }
  return <>{children}
    {user?<div className="auth-account"><span>{user.name||user.email}</span><strong>{user.unlimited?'Sınırsız':user.credits+' hak'}</strong><button onClick={async()=>{await request('/api/auth/logout',{method:'POST',body:'{}'});setUser(null)}}>Çıkış</button></div>
    :<div className="auth-account"><span>Misafir</span><button onClick={()=>setOpen(true)}>Giriş yap</button></div>}
    {open&&!user&&<div className="auth-screen auth-overlay" onMouseDown={e=>{if(e.currentTarget===e.target)setOpen(false)}}><div className="auth-card">
      <img src="/serula-logo.svg" alt=""/><h1>Serula Nesting</h1><p>DXF indirmek için giriş yapın. Dosya içe aktarma ve yerleştirme giriş yapmadan kullanılabilir.</p>
      <div className="auth-tabs"><button className={mode==='login'?'active':''} onClick={()=>setMode('login')}>Giriş yap</button><button className={mode==='register'?'active':''} onClick={()=>setMode('register')}>Kayıt ol</button></div>
      <form onSubmit={submit}>{mode==='register'&&<label>Adınız<input required value={name} onChange={e=>setName(e.target.value)}/></label>}<label>E-posta<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Parola<input type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>{busy?'Bekleyin…':mode==='register'?'Hesap oluştur':'Giriş yap'}</button></form>
      {error&&<p className="auth-error">{error}</p>}<div className="auth-or"><span/>veya<span/></div><div ref={googleButton} className="auth-google"/><small>Yeni normal kullanıcılar 5 indirme/nesting hakkıyla başlar.</small>
      <button onClick={()=>setOpen(false)}>Şimdilik kapat</button>
    </div></div>}
  </>;
}

export function AdminGate({children}:{children:ReactNode}){
  const [user,setUser]=useState<SessionUser|null|undefined>(undefined),[email,setEmail]=useState('M93Hasan@icloud.com'),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{fetch('/api/auth/admin-me',{credentials:'same-origin'}).then(async r=>{const d=await r.json().catch(()=>({}));setUser(r.ok&&d.user?.role==='admin'?d.user:null)}).catch(()=>setUser(null))},[]);
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const d=await request('/api/auth/admin-login',{method:'POST',body:JSON.stringify({email,password})});if(d.user.role!=='admin')throw Error('Bu hesabın admin yetkisi yok.');setUser(d.user)}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
  if(user===undefined)return <div className="auth-screen"><div className="auth-card"><p>Admin oturumu kontrol ediliyor…</p></div></div>;
  if(!user)return <div className="auth-screen"><div className="auth-card"><img src="/serula-logo.svg" alt=""/><h1>Serula Yönetim</h1><p>Admin e-posta ve parolanızı girin.</p><div style={{margin:'10px 0 18px',fontWeight:700,opacity:.75}}>Sürüm v{packageInfo.version}</div><form onSubmit={submit}><label>E-posta<input type="email" autoComplete="username" autoFocus required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Parola<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>{busy?'Bekleyin…':'Admin girişi'}</button></form>{error&&<p className="auth-error">{error}</p>}</div></div>;
  return <>{children}</>;
}
