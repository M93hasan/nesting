/* Transactional OTP email: table-based and inline-styled for Gmail and mobile clients. */
const HTML = String.raw`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Serula Nesting e-posta doğrulama</title>
  <style>
    @media only screen and (max-width:620px) {
      .email-container {width:100%!important;}
      .email-content {padding:30px 22px!important;}
      .otp-digits {font-size:32px!important;letter-spacing:5px!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#1e293b;-webkit-text-size-adjust:100%;">
  <div style="display:none!important;font-size:1px;line-height:1px;color:#f1f5f9;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Serula Nesting hesabınızı doğrulamak için tek kullanımlık kodunuz hazır.
  </div>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f1f5f9;">
    <tr><td align="center" style="padding:42px 14px;">
      <table role="presentation" class="email-container" border="0" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <tr><td style="background-color:#172b4d;padding:28px 36px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="width:44px;height:44px;background-color:#2563eb;border-radius:12px;text-align:center;vertical-align:middle;color:#ffffff;font-weight:800;font-size:24px;">S</td>
            <td style="padding-left:13px;color:#ffffff;">
              <div style="font-size:20px;font-weight:800;letter-spacing:1.5px;line-height:1.2;">SERULA</div>
              <div style="font-size:11px;letter-spacing:3px;color:#cbd5e1;line-height:1.8;">NESTING PRO</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td class="email-content" style="padding:42px 40px 36px;">
          <p style="margin:0 0 15px;font-size:11px;line-height:1.4;font-weight:800;letter-spacing:1.8px;color:#2563eb;">HESAP DOĞRULAMA</p>
          <h1 style="margin:0 0 19px;font-size:26px;line-height:1.35;font-weight:750;letter-spacing:-0.6px;color:#0f172a;">E-posta adresinizi doğrulayın</h1>
          <p style="margin:0 0 10px;font-size:15px;line-height:1.7;color:#334155;">Merhaba,</p>
          <p style="margin:0 0 28px;font-size:15px;line-height:1.75;color:#475569;">Serula Nesting hesabınızı etkinleştirmek için aşağıdaki 6 haneli kodu kayıt ekranına girin.</p>
          <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%">
            <tr><td align="center" style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:26px 10px 22px;">
              <div style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:1.5px;margin-bottom:12px;">DOĞRULAMA KODUNUZ</div>
              <div class="otp-digits" style="font-family:Arial,Helvetica,sans-serif;font-size:38px;line-height:1.3;font-weight:800;letter-spacing:8px;color:#1d4ed8;white-space:nowrap;">{{CODE}}</div>
            </td></tr>
          </table>
          <p style="margin:22px 0 0;font-size:14px;line-height:1.7;text-align:center;color:#475569;">Bu kod <strong style="color:#0f172a;">10 dakika</strong> geçerlidir ve yalnızca bir kez kullanılabilir.</p>
          <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="margin-top:26px;">
            <tr><td style="border-left:3px solid #60a5fa;background-color:#f8fafc;padding:15px 17px;color:#475569;font-size:13px;line-height:1.7;">
              <strong style="color:#1e293b;">Güvenlik hatırlatması:</strong> Bu kodu kimseyle paylaşmayın. Kayıt işlemini siz başlatmadıysanız bu mesajı görmezden gelebilirsiniz.
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:22px 36px;text-align:center;">
          <p style="margin:0 0 8px;color:#475569;font-size:12px;line-height:1.7;">Bu e-posta Serula Nesting tarafından otomatik gönderilmiştir.</p>
          <a href="https://serula.site/" style="font-size:12px;color:#1d4ed8;text-decoration:none;font-weight:700;">serula.site</a>
          <p style="margin:10px 0 0;color:#94a3b8;font-size:11px;line-height:1.5;">Lütfen bu e-postayı yanıtlamayın.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

export function verificationEmail(code){
  if(typeof code!=='string'||!/^[0-9]{6}$/.test(code))throw new TypeError('Verification code must contain six digits.');
  return {
    subject:'Serula Nesting | E-posta adresinizi doğrulayın',
    text:[
      'SERULA NESTING PRO',
      'E-posta adresinizi doğrulayın',
      '',
      'Merhaba,',
      '',
      'Serula Nesting hesabınızı etkinleştirmek için doğrulama kodunuz: '+code,
      '',
      'Bu kod 10 dakika geçerlidir ve yalnızca bir kez kullanılabilir.',
      'Kodu kimseyle paylaşmayın. Kayıt işlemini siz başlatmadıysanız bu e-postayı görmezden gelebilirsiniz.',
      '',
      'Serula Nesting | https://serula.site/',
      'Bu otomatik bir mesajdır; lütfen yanıtlamayın.'
    ].join('\n'),
    html:HTML.replaceAll('{{CODE}}',code)
  };
}
