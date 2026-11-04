import {describe,expect,it} from 'vitest';
import {verificationEmail} from '../worker/email-templates.js';

describe('Serula Nesting verification email',()=>{
  it('contains a responsive branded HTML card and readable code',()=>{
    const mail=verificationEmail('547298');
    expect(mail.subject).toContain('Serula Nesting');
    expect(mail.html).toContain('<html lang="tr">');
    expect(mail.html).toContain('name="viewport"');
    expect(mail.html).toContain('SERULA');
    expect(mail.html).toContain('NESTING PRO');
    expect(mail.html).toContain('547298');
    expect(mail.html).toContain('10 dakika');
    expect(mail.html).toContain('Kodu kimseyle paylaşmayın');
    expect(mail.html).toContain('role="presentation"');
    expect(mail.html).toContain('https://serula.site/');
    expect(mail.html).not.toContain('{{CODE}}');
    expect(mail.html).not.toContain('<script');
    expect(mail.html).not.toContain('<img');
  });

  it('retains the exact plain text OTP phrase for older mail clients',()=>{
    const mail=verificationEmail('002701');
    expect(mail.text).toMatch(/doğrulama kodunuz: 002701/);
    expect(mail.text).toContain('10 dakika');
    expect(mail.text).toContain('Bu otomatik bir mesajdır');
    expect(mail.html).toContain('002701');
    expect((mail.html.match(/002701/g)||[])).toHaveLength(1);
  });

  it('only accepts six numeric digits to prevent HTML injection',()=>{
    for(const value of ['12345','1234567','<img src=x onerror=alert(1)>','123 56','12&345',null,123456]){
      expect(()=>verificationEmail(value as string)).toThrow();
    }
  });

  it('does not include secret OTP in preview or subject',()=>{
    const mail=verificationEmail('834506');
    expect(mail.subject).not.toContain('834506');
    const hiddenPreview=mail.html.match(/<div style="display:none[^>]*>([\s\S]*?)<\/div>/)?.[1]||'';
    expect(hiddenPreview).not.toContain('834506');
  });
});
