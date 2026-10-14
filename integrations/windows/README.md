# Serula — Windows Otomatik Aktarım Köprüsü

**Güncel sürüm: 1.3** · [Ana proje belgesi](../../README.md) · [PC sürümü](https://github.com/M93hasan/serula-nesting-pro-pc/releases/latest)

Bu klasör, Serula Nesting üzerinden tamamlanmış DXF yerleşimini Windows'ta çalışan **CorelDRAW** veya **RDWorks** programına aktarmak için gereken yerel uygulama köprüsünü içerir.

> **Amaç:** Serula'da aktarım butonuna bir kez basıldığında, DXF dosyasını kullanıcıya ayrıca indirtmeden hedef programda açmak. RDWorks sürümlerinin farklı pencere davranışları nedeniyle gerçek otomatik açılışın her bilgisayarda başarılı olacağı garanti edilemez.

## Dosyalar

| Dosya | İşlev |
|---|---|
| [Serula-Kur.cmd](Serula-Kur.cmd) | Çift tıklamalı Windows kurucusu |
| [InstallSerulaBridge.ps1](InstallSerulaBridge.ps1) | Köprüyü doğrulayarak indirir, kurar, başlatır |
| [SerulaTransferBridge.ps1](SerulaTransferBridge.ps1) | Yerel HTTP ve hedef uygulama otomasyonu |
| [Web sitesindeki kurucu](../../web/public/downloads/Serula-Kur.cmd) | Hakkında bölümünden indirilen kurucu kopyası |

Serula Nesting Pro PC uygulamasını kullananlar için köprü PC kurulum paketine dâhildir. PC kaynakları bu depoda değil, **[M93hasan/serula-nesting-pro-pc](https://github.com/M93hasan/serula-nesting-pro-pc)** deposunda tutulur.

## Sistem gereksinimleri

- Windows bilgisayarda Windows PowerShell 5.1 ve aktif kullanıcı masaüstü.
- Tarayıcı/PC Serula uygulamasıyla hedef CorelDRAW/RDWorks **aynı bilgisayarda**.
- Programın kurulu ve tercihen standart kullanıcı haklarıyla açık olması.
- Aktif Serula oturumu, geçerli lisans ve yönetici tarafından verilen hedef aktarım izni.
- İlk URL rezervasyonunda bir kez Windows yönetici izni gerekebilir.
- Tarayıcının yerel ağ/loopback erişim izni sorulursa resmî Serula sitesine izin verilmelidir.

## Otomatik kurulum ve güncelleme

1. Serula'da **Hakkında → Otomatik Aktarım Köprüsü → Otomatik Kurulumu İndir (.cmd)** düğmesini kullanın.
2. İndirilen **Serula-Kur.cmd** dosyasına çift tıklayın.
3. Kurucu doğrulanan GitHub revizyonundan köprü v1.3'ü indirir.
4. Gerekirse Windows'un yalnızca **127.0.0.1:43842** URL rezervasyonu onayını verin.
5. Önceki köprü işlemi güncel değilse sonlandırılır ve yenisi başlatılır.
6. Windows kullanıcı oturumu açılışında otomatik başlatma kısayolu oluşturulur.
7. Aynı bilgisayarda [health kontrolünü](http://127.0.0.1:43842/health) açın.

Beklenen yanıt örneği:

~~~json
{"ok":true,"service":"serula-bridge","version":"1.3"}
~~~

**Eski kurucuyu yeniden kullanmayın:** Serula-Kur.cmd belirli bir commit ve dosya SHA'sına sabitlenmiştir. Yeni köprü çıktığında .cmd dosyasını **yeniden indirin**.

## Aktarım adımları

1. CorelDRAW veya RDWorks'ü Windows'ta açın.
2. Serula'da parçaları içe aktarıp geçerli yerleşimi tamamlayın.
3. Yetkiliyseniz **CorelDRAW'a Aktar** veya **RDWorks'e Aktar** düğmesine basın.
4. Serula sunucusundan yaklaşık **120 saniye** geçerli, **tek kullanımlık** aktarım bileti alınır.
5. Yerel köprü bileti sunucuda doğrular.
6. Yerleşim DXF'i Windows'taki geçici klasöre yazılır ve seçili programda açılmaya çalışılır.
7. Çizimin doğru geldiği, kesim katmanları ve ölçüleri operatör tarafından kontrol edilir.

### CorelDRAW

CorelDRAW otomasyon nesnesi **COM** aracılığıyla açılır veya erişilir. Geçici DXF için **OpenDocument** denenir. Kurulu CorelDRAW sürümü veya COM kaydı uygun değilse aktarım gerçekleşmeyebilir.

### RDWorks — v1.3

Köprü şu yolu dener:

1. RDWorks / RDLaser ana penceresini bulur.
2. Windows'un odak kısıtları altında güvenli biçimde öne getirir.
3. **Ctrl+I** ile Import dosya seçme ekranını açar.
4. Açılan pencerenin RDWorks'e ait olduğunu doğrular.
5. Windows **UI Automation** üzerinden dosya yolu alanını doldurur ve **Aç** düğmesini tetikler.
6. Operatör çizimi RDWorks'te görüntülediğini doğrular.

Bu işlem deneysel bir Windows GUI otomasyonudur; RDWorks'ün genel, güvenilir bir resmî API'si değildir. Farklı sürümlerde dosya seçme penceresi, kısayol ya da butonlar değişmiş olabilir. Sistem yanlış pencereye tuş göndermemeye çalışır, başarısızsa hata verir. **Başarılı HTTP yanıtı çizimin üretime hazır olduğu anlamına gelmez.**

## Yerel bağlantı ve güvenlik

~~~text
Serula Web (https://serula.site)
    ↓   Oturum / lisans / hedef yetkisi
Cloudflare Worker: /api/transfer/ticket
    ↓   Tek kullanımlık bilet
Windows localhost: http://127.0.0.1:43842
    ↓   /api/transfer/redeem ile sunucu doğrulaması
Geçici yerel DXF
    ↓
CorelDRAW COM veya RDWorks UI Automation
~~~

- Dinleyici yalnızca **127.0.0.1** adresini kullanır, yerel ağa açılmaz.
- Tarayıcı origin izni **https://serula.site** kaynağıyla kısıtlıdır.
- Origin kontrolü yetki yerine geçmez; bilet sunucu tarafında tek kullanımlıktır.
- Geçici DXF'ler köprü açılışında eski kayıtlar için temizlenir (**7 gün** eşiği).
- Köprü **lazer kesim, başlat, durdur gibi cihaz komutları göndermez**.

## Manuel başlatma

Yalnızca geliştirici kullanımında, kaynağı incelenmiş dosyayla:

~~~powershell
powershell.exe -NoProfile -STA -File .\SerulaTransferBridge.ps1
~~~

URLACL izni yoksa Windows HTTP dinleyicisi başlatılamaz. Yetkiyi yalnızca gerekli kullanıcı SID'sine verin. Köprüyü tüm ağ arayüzlerinde dinletecek şekilde değiştirmeyin.

## Hata çözümleri

### Failed to fetch / Köprü bağlantısı yok

- Aynı Windows bilgisayarında **/health** yanıtı geliyor mu?
- Yanıttaki sürüm **1.3** mü?
- Eski bir köprü aynı 43842 portunda çalışıyor olabilir mi?
- Chrome'da Serula için **yerel ağ erişimi** izni açık mı?
- Serula resmî HTTPS origin üzerinden mi açık?

### RDWorks açılıyor ancak yerleşim görünmüyor

- Bu RDWorks sürümünde **Ctrl+I** gerçekten **File → Import** açıyor mu?
- RDWorks yönetici olarak çalışıyor ama köprü normal yetkiyle mi çalışıyor? RDWorks'ü normal yetkiyle açmayı deneyin.
- Dosya seçme penceresi başka uygulama/process olarak mı görünüyor?
- Windows ekran kilitli mi; uzak masaüstü oturumu etkisiz mi?
- RDWorks dosya filtresi ya da DXF uyarı ekranı var mı?
- Bir çizim açılmış fakat ekranda zoom dışında kalmış olabilir mi?
- Köprü sağlığı **1.3** değilse yeniden indirilmiş kurucuyla güncelleyin.

### Import penceresi algılanmadı

v1.3, pencerenin süreç/sahiplik ilişkisini ve otomasyon alanlarını denetler. Sorun sürerse Windows ve RDWorks sürümüyle birlikte hata metnini raporlayın. Gerçek program üzerinde sürüme özel uyarlama gerekebilir.

### CorelDRAW COM bulunamadı

CorelDRAW'ın kurulu ve ilgili Windows oturumunda erişilebilir olduğunu kontrol edin. Bazı sürümlerde COM kayıtları eksik veya kullanıcının erişimi kısıtlı olabilir.

### Türkçe karakterler bozuk

v1.3 PowerShell betiği **UTF-8 BOM** içerir. Sadece dosyayı güncellemek yeterli değildir; eski köprü bellekte çalışıyorsa kurucuyla yeniden başlatın.

## Üretim öncesi kritik kontrol

Aktarım tamamlandıktan sonra parçaların gerçek ölçüsünü, adedini, dönüşlerini, iç deliklerini, kesim katmanlarını, plaka sırasını, kerf/hız/güç ve lazer başlangıç noktasını **hedef yazılımda** kontrol edin. Serula aktarım köprüsü **otomatik kesim başlatmaz**.

**[Ana README](../../README.md)** · **[Serula Web](https://serula.site)** · **[PC Releases](https://github.com/M93hasan/serula-nesting-pro-pc/releases/latest)**
