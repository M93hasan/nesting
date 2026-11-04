import {afterEach,describe,expect,it,vi} from 'vitest';
import {hasEmailSender,sendAppEmail} from '../worker/email-sender.js';

afterEach(()=>vi.unstubAllGlobals());

const msg={from:'noreply@serula.site',to:'new-user@example.test',subject:'Serula doğrulama',text:'Kodunuz: 123456'};

describe('Resend email delivery on Cloudflare Workers',()=>{
  it('sends via Resend using a secret API key without the paid Cloudflare EMAIL binding',async()=>{
    const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({id:'queued'}),{status:200}));
    vi.stubGlobal('fetch',fetchMock);
    const env={RESEND_API_KEY:'re_test_secret'};
    expect(hasEmailSender(env)).toBe(true);
    await sendAppEmail(env,msg);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url,options]=fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer re_test_secret');
    expect(JSON.parse(options.body)).toEqual({from:msg.from,to:[msg.to],subject:msg.subject,text:msg.text});
  });
  it('fails closed without a delivery provider',async()=>{
    expect(hasEmailSender({})).toBe(false);
    await expect(sendAppEmail({},msg)).rejects.toThrow('yapılandırılmamış');
  });
  it('does not expose sensitive provider errors or the OTP',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({message:'Sensitive OTP: 123456'}),{status:422})));
    await expect(sendAppEmail({RESEND_API_KEY:'re_test_secret'},msg)).rejects.toThrow('HTTP 422');
    try{await sendAppEmail({RESEND_API_KEY:'re_test_secret'},msg)}catch(error){
      expect(String(error)).not.toContain('123456');
      expect(String(error)).not.toContain('re_test_secret');
    }
  });
  it('supports the existing mock binding used by Worker SQLite regression tests',async()=>{
    const send=vi.fn().mockResolvedValue(undefined),env={EMAIL:{send}};
    expect(hasEmailSender(env)).toBe(true);
    await sendAppEmail(env,msg);
    expect(send).toHaveBeenCalledWith(msg);
  });
});
