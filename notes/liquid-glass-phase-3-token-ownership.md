# Liquid Glass — Aşama 3: CSS token sahipliğini birleştirme

**Dal:** `feat/liquid-glass-phase-3-token-ownership`  
**Temel dal:** `main`  
**Kapsam:** Yalnızca CSS değişkenlerinin sahipliği ve bunu koruyan testler. Uygulama mantığı, nesting/geometry motoru, API'ler, yetkilendirme, veri saklama ve kullanıcı ayarlarının davranışı değiştirilmez.

## Yapılan değişiklikler

- `premium-theme.css`, ortak görsel token'ların tek tanımlama noktası olarak belirlenmiştir: renkler, yüzeyler, marka gradyanları, tipografi ve ortak radius/gölge değerleri.
- `vision.css` içindeki aynı ortak token'ların yinelenen tanımları kaldırılmıştır. Vision katmanı font dosyaları, kendi bileşen kuralları ve yalnızca o katmana özgü token'ları tutar.
- `liquid-glass.css` yalnızca `--lg-*` isim alanındaki cam/animasyon token'larını tanımlar; renkleri `--panel`, `--border`, `--ink` ve `--accent` gibi ortak token'lardan türetir.
- Testler, ortak token'ların `premium-theme.css` içinde bulunmasını ve `vision.css` içinde yeniden tanımlanmamasını kontrol eder.

## Neden bu yöntem?

CSS import sırası korunmuştur: `vision.css` → diğer bileşen temaları → `premium-theme.css` → `liquid-glass.css`. Ortak token sahipliğini tek dosyada toplamak, farklı temaların birbirini fark edilmeden ezmesi riskini azaltır. Tema katmanının mevcut nihai değerleri `premium-theme.css` içinde bırakıldığı için bu refaktörün hedefi renk paletini yeniden tasarlamak değil, aynı değerlerin iki yerde sahiplenilmesini önlemektir.

## Doğrulama durumu

- Kaynak değişiklikleri ve token sahipliği testleri bu dalda hazırlandı.
- GitHub Actions/derleme testleri PR açıldıktan sonra doğrulanmalıdır.
- CI başarılı olmadan `main` dalına birleştirme yapılmamalıdır.
- Canlı siteye dağıtım bu değişiklikle otomatik olarak doğrulanmış sayılmaz.
