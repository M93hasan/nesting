# Serula Nesting Pro — Liquid Glass, 1. Aşama: Dokümantasyon ve Mevcut Durum Analizi

**Durum:** İnceleme tamamlandı; uygulama koduna ve canlı siteye tasarım değişikliği uygulanmadı.  
**İncelenen depo:** [M93hasan/nesting](https://github.com/M93hasan/nesting)  
**Canlı adres:** https://serula.site/  
**Yönetim paneli:** https://serula.site/admin  
**Tarih:** 2026-10-24

## 1. Kapsam ve dürüstlük notu

Apple'ın Liquid Glass ana teknoloji belgesi, “Adopting Liquid Glass” kılavuzu ve Human Interface Guidelines içindeki “Materials” ilkeleri incelendi; bunlar Serula'nın web arayüzü ve erişilebilirlik gereksinimleriyle karşılaştırıldı. Apple dokümantasyonunun web görünümü JavaScript gerektirdiği için bazı sayfalar otomatik metin görünümünde yalnızca “This page requires JavaScript” gösteriyor. Bu nedenle bu rapor, erişilebilir resmî Markdown/indexlenmiş içerik ve ilişkili kılavuzların doğrulanabilen bölümlerine dayanır; Apple'ın bütün platform API referanslarının her satırının incelendiği iddiasında bulunmaz.

Ana kaynaklar:
- https://developer.apple.com/documentation/technologyoverviews/liquid-glass
- https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass
- https://developer.apple.com/design/human-interface-guidelines/materials
- https://developer.apple.com/documentation/swiftui/landmarks-refining-the-system-provided-glass-effect-in-toolbars
- https://developer.apple.com/documentation/accessibility/testing-system-accessibility-features-in-your-app

## 2. Apple dokümanlarından Serula için çıkarılan ilkeler

1. **Cam, işlevsel üst katmandır:** Liquid Glass öncelikle gezinme, araç çubukları, menüler ve etkileşimli kontroller içindir. İçerik alanının tüm kartlarını cam yapmak doğru yaklaşım değildir.
2. **İçerik okunaklı kalmalı:** İçerik katmanında sade/standart yüzeyler kullanılmalı; saydam navigasyon altındaki içerik kontrastını kaybetmemelidir.
3. **Az ve amaçlı kullan:** Cam efektleri yalnızca kullanıcıyı önemli eylemlere yönlendiren alanlarda kullanılmalı; cam kartların üst üste yığılması ve aşırı bulanıklık önlenmeli.
4. **Gezinme ile içerik ayrılmalı:** Üst çubuk, yan menü, sekmeler ve bağlamsal kontrollerin hiyerarşisi açık olmalı.
5. **Kontroller durumları tutarlı olmalı:** Normal, hover, active/pressed, selected, focus-visible, disabled, loading ve hata durumları aynı tasarım diline uymalı.
6. **Renk kontrollü olmalı:** Vurgu rengi navigasyon ve kontrol metinlerinin okunabilirliğini bozmayacak şekilde kullanılmalı; açık/koyu görünümde ve yüksek kontrast ihtiyacında doğrulanmalı.
7. **Gruplama anlamlı olmalı:** Aynı işlevi yapan araç çubuğu eylemleri birlikte, farklı işlevler ise görsel olarak ayrı gruplanmalı. İkonların erişilebilir etiketleri olmalı.
8. **Şekil ve boşluklar tutarlı olmalı:** Yuvarlatılmış köşeler, kontrol boyutları, satır yüksekliği ve aralıklar bir sistemin parçası olmalı; yoğun paneller gereksiz yere kalabalıklaştırılmamalı.
9. **Hareket erişilebilir olmalı:** `prefers-reduced-motion` desteği sağlanmalı; geçişler hızlı ve anlamlı olmalı, sürekli/sonsuz animasyonlar temel bilgi taşımamalı.
10. **Platform farkları gözetilmeli:** Serula web uygulaması SwiftUI/UIKit/AppKit API'lerini doğrudan kullanamaz. CSS ile benzer görsel dil uygulanabilir; bu uygulama Apple'ın yerel Liquid Glass materyaliyle birebir aynı olduğu iddiasını taşımamalı.

## 3. Mevcut Serula uygulamasında gözlenen durum

### Mevcut yapı
- Web uygulaması React + TypeScript + Vite kullanıyor.
- Çalışma alanı: `web/src/App.tsx`, `web/src/components/Workspace.tsx`, `web/src/components/Workspace.css`.
- Ana stiller: `web/src/styles.css`.
- Yönetim paneli: `web/src/Admin.tsx`, `web/src/admin.css`, `web/src/admin-buttons.css`.
- Ek görsel katmanlar: `web/src/premium-theme.css`, `web/src/vision.css`, `web/src/reference-controls.css`.
- Görünüm ayarları: `web/src/components/AppearanceSettings.tsx`, ilişkili CSS ve `web/src/appearance` modülü.
- Otomatik kontroller: `web/package.json` içinde `source:check`, `typecheck`, `test`, `test:e2e` ve `build` komutları var.
- Tema saklama anahtarı olarak `serula-theme` kullanılıyor; light/dark/system seçenekleri mevcut kodda yer alıyor.
- Yönetim panelinde genel bakış, kullanıcılar, canlı destek, roller ve yetkiler, kullanıcı ayarları, sistem varsayılanları, görünüm, işlem geçmişi, loglar ve sistem bilgisi bölümleri bulunuyor.
- Yönetim panelinin görünüm bölümünde renkleri deneme ve tüm kullanıcılara kaydetme akışı var. Bu, yeni tasarımın tema sistemine uyumlu olması gerektiği anlamına gelir.

### Önemli bulgular / riskler
1. **Birden fazla stil katmanı aynı token'ları tanımlıyor.** `styles.css`, `premium-theme.css` ve `vision.css` arasında `--page`, `--panel`, `--accent`, `--radius-card`, `--surface-shadow` gibi değişkenler tekrar tanımlanıyor. Liquid Glass uyarlaması yeni bir CSS bloğu olarak gelişigüzel eklenirse kaskad ve yükleme sırası nedeniyle tema tutarsızlığı çıkabilir.
2. **Cam benzeri kurallar zaten mevcut.** Ana stillerde bulanıklık/saturate; admin üst çubuğunda `backdrop-filter`; premium katmanda tema ve hareket kuralları bulunuyor. Önce mevcut kuralların sahipliği ve sırası netleştirilmeli; yeni efektlerin katman katman eklenmesi doğru değil.
3. **Mevcut görsel diller farklı.** Ana çalışma alanı, yönetim paneli, premium tema ve Vision UI uyarlaması farklı yüzey, köşe yarıçapı ve vurgu rengi kararları taşıyor. Önce ortak tasarım token'ları tanımlanmalı, ardından sayfa bazında uyarlanmalı.
4. **Admin kontrol kuralları kuvvetli seçiciler kullanıyor.** `admin-buttons.css` içinde `!important` ve genel buton seçicileri var. Yeni tasarım bunlarla çakışmadan planlanmalı; tüm butonları tek seferde değiştiren geniş seçicilerden kaçınılmalı.
5. **Özel kontrol örnekleri işlevsel davranışla iç içe.** `reference-controls.css` içinde başlatma, ayar, indirme, rotasyon ve input görünümleri var. Etkin durumlar ve erişilebilir odak halkaları korunmalı; görsel değişiklikler işlev/olay işleyicilerine dokunmamalı.
6. **Hareket ve saydamlık için özel durum testi gerekli.** Premium CSS'te azaltılmış hareket kuralı bulunuyor; fakat cam yüzeyleri için `prefers-reduced-transparency` tarayıcı standardı olarak varsayılmamalı. Açık/koyu tema, yüksek kontrast ve bulanıklık kapalıyken okunabilirlik ayrıca doğrulanmalı.
7. **Admin güvenlik/iş akışına dokunulmamalı.** Bu aşama kimlik doğrulama, yetkiler, kullanıcı silme, destek oturumu, API çağrıları, nesting motoru veya DXF işleme davranışını değiştirmez.

## 4. Dosya bazlı uygulama haritası

| Alan | İlk bakılacak dosyalar | Tasarım çalışmasındaki hedef |
|---|---|---|
| Tema token'ları ve genel kontrol durumları | `web/src/styles.css`, `web/src/premium-theme.css`, `web/src/vision.css` | Token sahipliğini sadeleştirmek; tek kaynaklı renk, yüzey, kenarlık, radius, gölge ve geçiş sistemi |
| Çalışma alanı gezinmesi ve üst araçlar | `web/src/App.tsx`, `web/src/components/Workspace.tsx`, `web/src/components/Workspace.css` | Fonksiyonel araçları içerikten ayırmak; camı yalnızca uygun araç/navigasyon yüzeylerinde kullanmak |
| Yönetim kabuğu | `web/src/Admin.tsx`, `web/src/admin.css`, `web/src/admin-buttons.css` | Admin üst çubuğu ve yan menüyü tutarlı yapmak; tablolar/formları okunaklı opak yüzeylerde tutmak |
| Görünüm ayarları | `web/src/components/AppearanceSettings.tsx`, `web/src/components/AppearanceSettings.css`, `web/src/appearance` | Kaydedilmiş renkleri ve kullanıcı önizlemesini korumak; yeni token'larla uyumluluğu doğrulamak |
| Özel kontroller | `web/src/reference-controls.css`, ilgili bileşenler | Başlatma, ayar, indirme, rotasyon ve form kontrollerinin durumlarını ortaklaştırmak |
| Testler | `web/tests/`, `web/package.json` | Görsel regresyon, erişilebilirlik ve mevcut işlevlerin korunması için kabul testleri eklemek |

## 5. Üç aşamalı uygulama planı

### Aşama 1 — Dokümantasyon ve denetim (bu rapor)
- Apple kaynakları ve web uyarlama sınırları belirlendi.
- İlgili uygulama dosyaları ve mevcut tasarım katmanları belirlendi.
- Çakışma riskleri ve değişiklik sırası çıkarıldı.
- **Bu aşamada uygulama CSS/TS kodu ve canlı yayın değiştirilmedi.**

### Aşama 2 — Ortak tasarım sistemi
- Tek ve belgelenmiş token katmanı: renkler, saydam yüzeyler, blur/saturate, kenarlık, gölge, radius, spacing ve motion.
- Açık/koyu/system tema ve admin görünüm önizlemesi ile uyumluluk.
- Buton durumları: default, hover, active, selected, focus-visible, disabled, loading.
- Navigasyon/toolbar cam katmanı; içerik, tablolar ve yoğun veri alanları sade ve okunaklı yüzeylerde.
- Hareket azaltma, klavye odağı ve kontrast kontrolleri.

### Aşama 3 — Çalışma alanı, admin ve yayın
- Çalışma alanı araç çubukları ve paneller.
- Admin üst çubuğu, yan navigasyon, metrik kartları, kullanıcı listeleri, formlar, modal/uyarılar ve görünüm ayarları.
- Mobil/dar pencere uyarlaması.
- Build, typecheck, unit test, E2E ve görsel regresyon kontrolleri.
- Önce geri dönüş noktası ve test; ardından ayrıca onaylanan yayın.

## 6. Kabul ölçütleri

- [ ] Açık, koyu ve sistem teması tutarlı çalışır.
- [ ] Navigasyon ile içerik görsel olarak ayrıdır; içerik katmanı cam efektleriyle aşırı doldurulmaz.
- [ ] Butonların hover/pressed/selected/focus/disabled/loading durumları tutarlıdır.
- [ ] Klavye ile kullanım ve görünür odak halkası korunur.
- [ ] Azaltılmış hareket ayarıyla gereksiz animasyonlar durur.
- [ ] Saydamlık/blur etkisi devre dışı olduğunda metin ve kontroller okunaklı kalır.
- [ ] Yönetim panelinin kimlik doğrulaması, API çağrıları ve yetki akışı değişmez.
- [ ] Nesting, geometri, yerleşim ve DXF içe/dışa aktarma davranışları değişmez.
- [ ] `npm run source:check`, `npm run typecheck`, `npm test`, `npm run build` ve mümkünse `npm run test:e2e` başarılı olur.
- [ ] Canlı yayın öncesinde değişiklik özeti ve geri dönüş commit'i bulunur.

## 7. Aşama 1 sonucu

**Denetim raporu tamamlandı.** Mevcut uygulama sıfırdan Liquid Glass'a dönüştürülmeyecek; hâlihazırda bulunan görsel katmanlar düzenlenerek tutarlı bir sisteme dönüştürülecek. En önemli teknik önkoşul, CSS token'ları ve stil katmanlarının çakışmasını çözmek. Aşama 2'ye geçerken ilk olarak tema token'larının sahipliği ve yüklenme sırası belirlenmeli; bundan önce genel seçicilerle yeni cam efektleri eklenmemeli.
