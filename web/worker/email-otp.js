export const otpCode=()=>String(crypto.getRandomValues(new Uint32Array(1))[0]%10000).padStart(4,'0');
export async function otpDigest(email,code,pepper){
  if(!pepper)throw Error('Missing OTP_PEPPER');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(email+':'+code)));
  return Array.from(sig,x=>x.toString(16).padStart(2,'0')).join('');
}
export async function sendOtpEmail(env,email,code){
  if(!env.RESEND_API_KEY||!env.OTP_FROM_EMAIL)throw Error('Resend is not configured');
  const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({
    from:env.OTP_FROM_EMAIL,to:[email],subject:'Serula e-posta doğrulama',
    text:'Serula doğrulama kodunuz: '+code+'\nKod 5 dakika geçerlidir. Siz istemediyseniz bu e-postayı yok sayın.'
  })});
  if(!res.ok)throw Error('Resend HTTP '+res.status);
}
