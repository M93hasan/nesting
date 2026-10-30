import {createHmac} from 'node:crypto';

const ITERATIONS=100000;
const b64=bytes=>btoa(String.fromCharCode(...bytes));
const decode=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));

async function derive(password,salt,iterations){
  // Keep new hashes inside Workers' native Web Crypto limit.
  if(iterations<=ITERATIONS){
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,256));
  }
  // Existing 210k hashes must remain readable. PBKDF2's single 32-byte block,
  // using native HMAC, avoids the production deriveBits iteration restriction.
  const key=new TextEncoder().encode(password);
  const block=new Uint8Array(salt.length+4);block.set(salt);block[block.length-1]=1;
  let u=createHmac('sha256',key).update(block).digest();
  const result=Uint8Array.from(u);
  for(let i=1;i<iterations;i++){
    u=createHmac('sha256',key).update(u).digest();
    for(let j=0;j<32;j++)result[j]^=u[j];
  }
  return result;
}

export async function hashPassword(password,salt=crypto.getRandomValues(new Uint8Array(16))){
  return `pbkdf2_sha256$${ITERATIONS}$${b64(salt)}$${b64(await derive(password,salt,ITERATIONS))}`;
}

export async function verifyPassword(password,stored){
  try{
    const parts=String(stored||'').trim().split('$');
    const [kind,count,saltText,digestText]=parts,iterations=Number(count);
    if(parts.length!==4||kind!=='pbkdf2_sha256'||!Number.isInteger(iterations)||iterations<1||iterations>210000)return false;
    const salt=decode(saltText),expected=decode(digestText);
    if(salt.length!==16||expected.length!==32)return false;
    const actual=await derive(String(password),salt,iterations);
    let diff=0;for(let i=0;i<32;i++)diff|=actual[i]^expected[i];
    return diff===0;
  }catch{return false}
}
