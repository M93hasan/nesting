# Serula Nesting

Serula Nesting, DXF parçalarını **rulo veya plaka malzeme üzerine otomatik olarak yerleştirmek** ve malzeme kullanımını iyileştirmek için geliştirilen web tabanlı bir 2D nesting uygulamasıdır.

Proje özellikle **ayakkabı üretimi, suni deri, tekstil, lazer kesim ve CNC** gibi alanlardaki düzensiz parça yerleşimleri için geliştirilmektedir.

**Güncel sürüm:** 0.0.13  
**Uygulama:** https://serula.site/

## Temel Özellikler

- DXF dosyalarını içe aktarma
- DXF parçalarının gerçek ölçülerini koruma
- Rulo ve sabit ölçülü plaka desteği
- Tek ve çoklu plaka yerleşimi
- Otomatik nesting
- Manuel parça düzenleme
- Parça adetlerini değiştirme
- Parçalar arası boşluk ayarı
- 0°, 0°/180° ve serbest dönüş seçenekleri
- Sağ alt ve sağ üst başlangıç yönü seçimi
- Yerleşim sonucunda malzeme verimliliği ve fire bilgisi
- DXF çıktı alma
- Web Worker üzerinde arka plan hesaplama
- Rust + WebAssembly tabanlı yerleştirme motoru
- Yönetim alanı için `/admin` arayüzü

## Yerleştirme ve Geometri

Serula Nesting'in temel amacı yalnızca parçaları yan yana dizmek değil, gerçek geometrileri dikkate alarak kullanılabilir malzeme alanını daha verimli değerlendirmektir.

DXF içe aktarımında desteklenen başlıca geometriler:

- LINE
- ARC
- CIRCLE
- ELLIPSE
- LWPOLYLINE
- POLYLINE
- SPLINE
- INSERT

İçe aktarılan parçaların ölçüleri otomatik olarak değiştirilmez. Geometri milimetre tabanlı işlenir ve açık veya geçersiz konturlar mümkün olduğunca kullanıcıya bildirilir.

## Malzeme Türleri

### Rulo

Kullanıcı malzeme genişliğini belirler. Yerleştirme motoru parçaları bu genişlik içerisinde mümkün olduğunca az uzunluk kullanacak şekilde yerleştirmeye çalışır.

### Plaka

Kullanıcı plakanın genişlik ve uzunluğunu belirler. Parçalar tek plakaya sığmadığında sistem birden fazla plaka kullanabilir.

## Dönüş ve Başlangıç Yönü

Parçalar için izin verilen dönüş seçenekleri:

- **0°** — parça yönü korunur
- **0° / 180°** — parça ters çevrilebilir
- **Serbest** — uygun açılar değerlendirilebilir

Yerleşim başlangıç yönü olarak **Sağ Alt** veya **Sağ Üst** seçilebilir.

## Teknoloji

Web uygulaması:

- React
- TypeScript
- Vite

Yerleştirme motoru:

- Rust
- WebAssembly (WASM)
- Web Worker
- Sparrow tabanlı nesting altyapısı

WASM motoru farklı tarayıcı yetenekleri için birden fazla yapılandırmada derlenir. Ayrı WASM build akışı sayesinde hazır derleme çıktılarının yeniden kullanılabilmesi hedeflenmektedir.

## Proje Yapısı

Ana uygulama:

```text
web/
```

Önemli bölümler:

```text
web/src/          React / TypeScript uygulaması
web/src/geometry/ Geometri ve yerleşim yardımcıları
web/src/import/   DXF / SVG içe aktarma
web/src/workers/  Yerleştirme worker altyapısı
web/wasm/         Rust / WebAssembly motoru
web/scripts/      Build ve yardımcı scriptler
```

## Yerel Geliştirme

```bash
cd web
npm ci
npm run dev
```

TypeScript kontrolü:

```bash
npm run typecheck
```

Testler:

```bash
npm test
```

Üretim derlemesi:

```bash
npm run build
```

## Cloudflare Yayını

Üretim ortamı **Cloudflare Workers** üzerinde çalışacak şekilde yapılandırılmıştır.

```text
Production branch: main
Build command:      bash web/scripts/build-cloudflare.sh
Deploy command:     cd web && npx --yes wrangler@4 deploy
Version command:    cd web && npx --yes wrangler@4 versions upload
Root directory:     boş
```

Cloudflare yapılandırması:

```text
web/wrangler.jsonc
```

## Yönetim

Yönetim arayüzü:

```text
/admin
```

Yönetim alanı kullanıcılar, roller, kullanıcı ayarları, sistem varsayılanları ve işlem geçmişi gibi yönetim özelliklerinin geliştirileceği ayrı bölümdür.

Güvenli kullanıcı yetkilendirmesi ve kalıcı kullanıcı verileri için sunucu tarafı kimlik doğrulama ve veritabanı altyapısı gereklidir.

## Projenin Öncelikleri

- DXF ölçülerini değiştirmemek
- Yerleştirme sırasında çakışmayı önlemek
- Malzeme firesini azaltmak
- Küçük parçaları kullanılabilir boşluklarda değerlendirmek
- Kesim ve esneme yönlerini korumak
- Rulo ve plaka çalışma biçimlerini desteklemek
- Güvenilir DXF çıktısı üretmek
- Büyük işlemlerde arayüzün donmasını önlemek

## Proje Sahibi

**Muhammet Hasanoğlu**

E-posta: m93hasan@gmail.com  
Telefon: +90 539 348 06 22

## Açık Kaynak Bileşenler

Projede kullanılan üçüncü taraf kütüphane ve bileşenlerin lisans bilgileri:

```text
web/public/THIRD_PARTY_NOTICES.txt
```

## Lisans

Repository lisans koşulları için [LICENSE](LICENSE) dosyasına bakabilirsiniz.

---

**Serula Nesting — DXF yerleştirme ve malzeme optimizasyonu.**
