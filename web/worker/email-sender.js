/*
 * Transactional email for Serula's Worker.
 * Resend uses standard fetch, works on Workers Free and never exposes the
 * API key to the browser. Existing EMAIL binding is supported for local tests
 * and for accounts that explicitly configure Cloudflare Email Sending.
 */
export function hasEmailSender(env){
  return !!(typeof env.RESEND_API_KEY==='string'&&env.RESEND_API_KEY.trim()) ||
    typeof env.EMAIL?.send==='function';
}

export async function sendAppEmail(env,message){
  if(typeof env.RESEND_API_KEY==='string'&&env.RESEND_API_KEY.trim()){
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{
        'Authorization':'Bearer '+env.RESEND_API_KEY,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        from:message.from,
        to:[message.to],
        subject:message.subject,
        text:message.text,
        ...(typeof message.html==='string'?{html:message.html}:{})
      })
    });
    if(!response.ok){
      // Do not leak the API key, OTP, recipient, or provider response body.
      throw new Error('Resend e-posta isteği başarısız (HTTP '+response.status+').');
    }
    return;
  }
  if(typeof env.EMAIL?.send==='function'){
    // Workers EMAIL fallback accepts text, not Resend's HTML JSON property.
    const {html,...textMessage}=message;
    await env.EMAIL.send(textMessage);
    return;
  }
  throw new Error('E-posta servisi yapılandırılmamış.');
}
