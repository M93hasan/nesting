import {useRef,type ClipboardEvent,type FormEvent,type KeyboardEvent} from 'react';

type Props={
  email:string;
  digits:string[];
  onDigits:(digits:string[])=>void;
  onSubmit:(event:FormEvent<HTMLFormElement>)=>void;
  onResend:()=>void;
  onBack:()=>void;
  busy:boolean;
  error:string;
};

export function EmailOtp({email,digits,onDigits,onSubmit,onResend,onBack,busy,error}:Props){
  const fields=useRef<(HTMLInputElement|null)[]>([]);
  const fill=(index:number,text:string)=>{
    const numbers=text.replace(/\D/g,'');
    if(!numbers)return;
    const next=[...digits];
    for(let offset=0;offset<numbers.length&&index+offset<6;offset++)next[index+offset]=numbers[offset];
    onDigits(next);
    fields.current[Math.min(5,index+numbers.length)]?.focus();
  };
  const key=(index:number,event:KeyboardEvent<HTMLInputElement>)=>{
    if(event.key==='Backspace'){
      event.preventDefault();
      const next=[...digits];
      if(next[index])next[index]='';
      else if(index>0){next[index-1]='';fields.current[index-1]?.focus();}
      onDigits(next);
    }
    if(event.key==='ArrowLeft'&&index>0){event.preventDefault();fields.current[index-1]?.focus();}
    if(event.key==='ArrowRight'&&index<5){event.preventDefault();fields.current[index+1]?.focus();}
  };
  const paste=(index:number,event:ClipboardEvent<HTMLInputElement>)=>{
    event.preventDefault();fill(index,event.clipboardData.getData('text'));
  };
  return <form className="auth-card serula-otp-form" onSubmit={onSubmit}>
    <span className="serula-otp-check" aria-hidden="true">
      <svg viewBox="0 0 48 48" width="44" height="44" fill="none">
        <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="2.5"/>
        <path d="m14 24 7 7 14-15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"/>
      </svg>
    </span>
    <h2 className="serula-otp-heading">E-posta doğrulama</h2>
    <p className="serula-otp-description"><strong>{email}</strong> adresine gönderilen 6 haneli kodu girin. Kod 10 dakika geçerlidir.</p>
    <div className="serula-otp-digits" role="group" aria-label="6 haneli doğrulama kodu">
      {digits.map((digit,index)=><input
        key={index} ref={element=>{fields.current[index]=element;}}
        className="serula-otp-digit" type="text" inputMode="numeric" autoComplete={index===0?'one-time-code':'off'}
        aria-label={`${index+1}. rakam`} maxLength={6} pattern="[0-9]*"
        value={digit} disabled={busy}
        onChange={event=>{const entered=event.target.value.replace(/\D/g,'');if(entered)fill(index,entered);else{const next=[...digits];next[index]='';onDigits(next);}}}
        onKeyDown={event=>key(index,event)} onPaste={event=>paste(index,event)}
      />)}
    </div>
    {error&&<p className="auth-error" role="alert">{error}</p>}
    <button className="serula-otp-btn1" type="submit" disabled={busy||digits.some(digit=>!/^[0-9]$/.test(digit))}>{busy?'Doğrulanıyor…':'Doğrula ve giriş yap'}</button>
    <button className="serula-otp-btn2" type="button" onClick={onResend} disabled={busy}>Yeni kod gönder</button>
    <button className="serula-otp-back" type="button" onClick={onBack} disabled={busy}>Giriş ekranına dön</button>
  </form>;
}
