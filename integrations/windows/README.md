# Serula Nesting — CorelDRAW / RDWorks yerel aktarım

Serula'da yetkili kullanıcıya **CorelDRAW'a Aktar** ve/veya **RDWorks'e Aktar** düğmeleri görünür. Sistem varsayılanlarında ve kullanıcıya özel ayarlarda yönetici her hedefi bağımsız açıp kapatabilir. Varsayılan: kapalı.

Tarayıcı Windows uygulamasının belleğine doğrudan veri veremez. Bunun için bu klasördeki `SerulaTransferBridge.ps1` betiği kullanılır.

## Tek tıklamayla kurulum ve güncelleme (önerilen)

1. [Serula-Kur.cmd](Serula-Kur.cmd) dosyasını GitHub'dan **yeniden indirin**. Önceden indirilen kurucu, sabitlenmiş eski sürümü yükler.
2. Dosyayı Windows'ta çift tıklayın. Gerekirse yalnızca ilk kurulumda localhost URL rezervasyonu için yönetici izni verin.
3. Kurucu eski çalışan Serula Bridge işlemini durdurur, imzası/hash'i doğrulanmış **v1.3** betiğini günceller ve yeniden başlatır. Windows kullanıcı hesabı açılışındaki otomatik başlangıç korunur.
4. [Yerel sağlık kontrolü](http://127.0.0.1:43842/health) JSON sonucunda `"version":"1.3"` ve `"ok":true` görünmelidir.

**RDWorks penceresi etkinleştirilemedi:** Köprü WScript, Win32 pencere aktivasyonu ve Alt-yardımlı yeniden deneme yapar. Windows yine reddederse geçici DXF yolunu panoya kopyalayıp RDWorks için Ctrl+I, Ctrl+V, Enter yönergesi verir. RDWorks yönetici olarak çalışıyorsa kapatıp standart kullanıcı olarak açın; ekran kilitliyken veya arka planda farklı oturumdayken tuş aktarımı yapılamaz. Pencere etkinleştirilemezse yanlış pencereye tuş gönderilmez. RDWorks içindeki dosya önizlemesini ve ölçüleri kontrol edin.

**Bozuk Türkçe karakterler:** v1.3 köprü betiği Windows PowerShell 5.1 için UTF-8 BOM içerir. Eski köprü bellekte çalışmaya devam edebileceğinden kurucuyu yeniden çalıştırmak gerekir.

## Kurulum (Windows)

1. SerulaTransferBridge.ps1 betiğini kendi bilgisayarınıza kaydedin.
2. PowerShell açın: `powershell.exe -NoProfile -STA -File .\SerulaTransferBridge.ps1`
3. PowerShell yürütme ilkesi betiği engellerse dosyanın kaynağını inceleyip güvenilir bulduğunuzda, indirilen dosyayı `Unblock-File -Path .\SerulaTransferBridge.ps1` ile açabilirsiniz. Yönetici yetkileri olmadan HTTP URL rezervasyonu yapılamazsa Windows yönetici terminalinden `netsh http add urlacl url=http://127.0.0.1:43842/ user=%USERDOMAIN%\%USERNAME%` (cmd.exe) çalıştırılması gerekebilir.
4. Açılan pencerede `Serula Bridge hazır` yazmasını bekleyin; yerel sağlık kontrolü: http://127.0.0.1:43842/health
5. `https://serula.site` üzerinden aktarım yaparken Chrome yerel ağ erişim iznini sorarsa izin verin.

**İşleyiş:** Web uygulaması güncel yerleşim DXF'ini bellekte oluşturur; sunucudan tek kullanımlık izin alır ve DXF metnini yalnızca kendi bilgisayarınızdaki 127.0.0.1 köprüsüne gönderir. Köprü izni sunucuda doğruladıktan sonra Windows geçici klasöründe bir DXF oluşturur. **Kullanıcının manuel indirip kaydetmesi gerekmez** ancak uygulamaların veri alabilmesi için geçici dosya kullanılır. Geçici dosyalar 7 gün sonra köprü yeniden başlatıldığında temizlenir.

**CorelDRAW:** COM otomasyonu ile DXF'i CorelDRAW'da açmayı dener. Sürüm ve kurulum koşullarına göre davranış değişebilir.

**RDWorks:** Resmî ve güvenilir yerel entegrasyon API'si bulunmadığı için açık RDWorks penceresinde *Ctrl+I* ile içe aktarma diyaloğu başlatılıp geçici dosya adı gönderilir. Bu işlem **deneyseldir**, RDWorks sürümünüzün Ctrl+I kısayolunu desteklediği doğrulanmalıdır. Başarılı yanıt, çizimin gerçekten RDWorks tuvaline yüklendiği anlamına gelmez. Kesimden önce ölçüleri, katmanları ve yerleşimi RDWorks içinde kontrol edin.

## Güvenlik ve kısıtlar

- Köprü yalnızca 127.0.0.1 dinler; tüm ağa açılmaz.
- Yalnızca `https://serula.site` kaynağına CORS izni verir.
- Aktarım için sunucu tarafından verilen 2 dakika geçerli, bir kez kullanılabilen yetki gerekir.
- Yetki verilmeyen kullanıcılara sunucu aktarım bileti vermez.
- Köprü, CorelDRAW/RDWorks çalışmıyorsa hata verir; çizim dosyasını otomatik kesime göndermez.
- Canlı Windows/CorelDRAW/RDWorks üzerinde uçtan uca test gereklidir.

## RDWorks tek tıkla otomatik Import (v1.3)

RDWorks açıksa Serula düğmesi bir DXF'yi geçici dosyaya dönüştürür; Windows UI Automation aracılığıyla RDWorks'e ait Import penceresinin Dosya adı alanını doldurup Aç düğmesini tetikler. Kullanıcının manuel dosya seçmesi gerekmez. RDWorks ve Windows sürümlerine göre değişebileceği için çizimin açıldığını ekranda kontrol edin. Odak kilitliyse yanlış pencereye komut gönderilmez ve manuel geri dönüş yolu sunulur.
