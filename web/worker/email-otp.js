/*
 * Email verification for password sign-ups.
 * A six-digit OTP is only usable with a separate 256-bit browser challenge.
 * Only SHA-256(challenge) and SHA-256(challenge:code) are persisted, so a
 * database reader cannot brute-force the 1,000,000 six-digit combinations.
 */
const TTL_MS=10*60*1000,COOLDOWN_MS=60*1000,WINDOW_MS=60*60*1000,MAX_SENDS=5,MAX_ATTEMPTS=5;
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const randomChallenge=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const otp=()=>String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
const sha=async text=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))));
const checkEmail=email=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=254;

export async function sendVerificationCode(env,user,{initial=false}={}){
  if(!env.EMAIL?.send)return {error:'E-posta doğrulama servisi hazır değil.',status:503};
  const now=Date.now();
  const previous=await env.DB.prepare('SELECT * FROM email_verifications WHERE user_id=?').bind(user.id).first();
  const age=previous?now-Date.parse(String(previous.sent_at)):Infinity;
  const windowAge=previous?now-Date.parse(String(previous.window_started_at)):Infinity;
  if(previous&&!initial&&Number.isFinite(age)&&age<COOLDOWN_MS)
    return {error:'Yeni bir kod için 60 saniye bekleyin.',status:429};
  if(previous&&!initial&&Number.isFinite(windowAge)&&windowAge<WINDOW_MS&&previous.window_count>=MAX_SENDS)
    return {error:'Saatlik kod sınırına ulaştınız. Daha sonra deneyin.',status:429};

  const code=otp(),challenge=randomChallenge(),nowIso=new Date(now).toISOString();
  const expiresAt=new Date(now+TTL_MS).toISOString(),challengeHash=await sha(challenge),codeHash=await sha(challenge+':'+code);
  const windowReset=!Number.isFinite(windowAge)||windowAge>=WINDOW_MS;
  const windowStart=windowReset?nowIso:String(previous.window_started_at);
  const count=windowReset?1:Number(previous.window_count)+1;
  // Conditional UPSERT keeps concurrent resend requests from bypassing limits.
  const saved=await env.DB.prepare(`INSERT INTO email_verifications
    (user_id,challenge_hash,code_hash,expires_at,attempts,sent_at,window_started_at,window_count)
    VALUES(?,?,?,?,0,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET
      challenge_hash=excluded.challenge_hash,code_hash=excluded.code_hash,
      expires_at=excluded.expires_at,attempts=0,sent_at=excluded.sent_at,
      window_started_at=excluded.window_started_at,window_count=excluded.window_count
    WHERE datetime(email_verifications.sent_at)<=datetime('now','-60 seconds')
      AND (datetime(email_verifications.window_started_at)<=datetime('now','-1 hour')
        OR email_verifications.window_count<5)`)
    .bind(user.id,challengeHash,codeHash,expiresAt,nowIso,windowStart,count).run();
  if(!saved.meta.changes)return {error:'Çok sık kod istendi. Lütfen daha sonra deneyin.',status:429};
  try{
    await env.EMAIL.send({
      to:user.email,from:'noreply@serula.site',
      subject:'Serula Nesting - E-posta Doğrulama',
      text:`Serula Nesting doğrulama kodunuz: ${code}\n\nKodunuz 10 dakika geçerlidir. Bu kaydı siz başlatmadıysanız mesajı yok sayın.`
    });
  }catch{
    // Never remove a pending marker after a delivery failure.
    return {error:'Doğrulama e-postası gönderilemedi. Daha sonra tekrar deneyin.',status:503};
  }
  return {verificationRequired:true,email:user.email,challenge,expiresInSeconds:600};
}

export async function confirmVerificationCode(env,email,challenge,code){
  if(!checkEmail(email)||!(/^[a-f0-9]{64}$/.test(challenge))||!(/^[0-9]{6}$/.test(code)))
    return {error:'Kod geçersiz veya süresi dolmuş.',status:400};
  const user=await env.DB.prepare('SELECT id,email FROM users WHERE email=?').bind(email).first();
  if(!user)return {error:'Kod geçersiz veya süresi dolmuş.',status:400};
  const challengeHash=await sha(challenge);
  const pending=await env.DB.prepare('SELECT code_hash,expires_at,attempts FROM email_verifications WHERE user_id=? AND challenge_hash=?')
    .bind(user.id,challengeHash).first();
  if(!pending||pending.attempts>=MAX_ATTEMPTS||Date.parse(String(pending.expires_at))<=Date.now())
    return {error:'Kod geçersiz veya süresi dolmuş. Yeni kod isteyin.',status:400};
  const codeHash=await sha(challenge+':'+code);
  if(codeHash!==pending.code_hash){
    await env.DB.prepare('UPDATE email_verifications SET attempts=attempts+1 WHERE user_id=? AND challenge_hash=? AND attempts<?')
      .bind(user.id,challengeHash,MAX_ATTEMPTS).run();
    return {error:'Doğrulama kodu hatalı.',status:400};
  }
  const done=await env.DB.prepare(`DELETE FROM email_verifications
    WHERE user_id=? AND challenge_hash=? AND code_hash=? AND attempts<?
      AND datetime(expires_at)>datetime('now')`)
    .bind(user.id,challengeHash,codeHash,MAX_ATTEMPTS).run();
  if(!done.meta.changes)return {error:'Kod geçersiz veya süresi dolmuş.',status:400};
  return {user};
}
