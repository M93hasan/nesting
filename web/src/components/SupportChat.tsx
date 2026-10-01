import {useEffect,useRef,useState} from 'react';

type ChatMessage={id:number;sender:'user'|'admin';body:string;createdAt:string;readAt?:string|null};

export default function SupportChat(){
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [message,setMessage]=useState('');
  const [status,setStatus]=useState<'loading'|'ready'|'signed-out'|'error'>('loading');
  const [sending,setSending]=useState(false);
  const [error,setError]=useState('');
  const listRef=useRef<HTMLDivElement>(null);

  async function load(){
    try{
      const response=await fetch('/api/chat',{credentials:'same-origin',cache:'no-store'});
      if(response.status===401){setStatus('signed-out');setMessages([]);return;}
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(data.error||'Mesajlar alınamadı.');
      setMessages(data.messages??[]);setStatus('ready');setError('');
    }catch(e){
      setStatus('error');setError(e instanceof Error?e.message:String(e));
    }
  }

  useEffect(()=>{
    let active=true;
    const poll=async()=>{if(active)await load()};
    void poll();
    const timer=window.setInterval(()=>void poll(),4000);
    return()=>{active=false;clearInterval(timer)};
  },[]);

  useEffect(()=>{
    const el=listRef.current;
    if(el)el.scrollTop=el.scrollHeight;
  },[messages.length]);

  async function send(){
    const text=message.trim();
    if(!text||sending)return;
    setSending(true);setError('');
    try{
      const response=await fetch('/api/chat',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({message:text})});
      const data=await response.json().catch(()=>({}));
      if(response.status===401){setStatus('signed-out');return;}
      if(!response.ok)throw Error(data.error||'Mesaj gönderilemedi.');
      setMessage('');await load();
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setSending(false)}
  }

  if(status==='signed-out')return <section className="support-chat support-chat-signed-out">
    <div><strong>Canlı destek</strong><p>Admin ile kalıcı mesajlaşmak için giriş yapın.</p></div>
    <button className="primary" onClick={()=>window.dispatchEvent(new Event('serula-login-required'))}>Giriş yap</button>
  </section>;

  return <section className="support-chat" aria-label="Canlı destek mesajlaşma">
    <div className="support-chat-head"><div><strong>Canlı destek</strong><small>Mesajlar hesabınıza bağlı olarak saklanır.</small></div><span className="support-chat-status"><i/>Destek</span></div>
    <div className="support-chat-messages" ref={listRef}>
      {status==='loading'?<p className="support-chat-empty">Mesajlar yükleniyor…</p>:messages.length?messages.map(item=><div key={item.id} className={'support-chat-message '+(item.sender==='user'?'from-user':'from-admin')}>
        <span>{item.sender==='user'?'Siz':'Serula Destek'}</span>
        <p>{item.body}</p>
        <time>{new Date(item.createdAt).toLocaleString('tr-TR')}</time>
      </div>):<p className="support-chat-empty">Henüz mesaj yok. Buradan admin ile doğrudan yazışabilirsiniz.</p>}
    </div>
    {error&&<p className="field-error" role="alert">{error}</p>}
    <form className="support-chat-compose" onSubmit={e=>{e.preventDefault();void send()}}>
      <textarea maxLength={2000} rows={3} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Mesajınızı yazın…" aria-label="Destek mesajı"/>
      <button className="primary" disabled={sending||!message.trim()}>{sending?'Gönderiliyor…':'Gönder'}</button>
    </form>
  </section>;
}
