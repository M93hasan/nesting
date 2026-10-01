# Serula Nesting Pro

<div align="center">

<img src="web/public/serula-logo.svg" alt="Serula Nesting" width="96" />

### Web tabanlı profesyonel DXF nesting ve malzeme optimizasyon sistemi

**Rulo ve plaka malzemelerde düzensiz parçaları verimli yerleştirmek, fireyi azaltmak ve üretim hazırlığını hızlandırmak için geliştirilmiştir.**

[![Version](https://img.shields.io/badge/version-0.0.67-111827?style=flat-square)](web/package.json)
[![React](https://img.shields.io/badge/React-19-20232a?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-WASM-000000?style=flat-square&logo=rust)](web/wasm/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-f38020?style=flat-square&logo=cloudflare&logoColor=white)](web/wrangler.jsonc)

**Canlı Uygulama:** [serula.site](https://serula.site/) · **Yönetim Paneli:** [serula.site/admin](https://serula.site/admin)

</div>

---

## İçindekiler

- [Genel Bakış](#genel-bakış)
- [Öne Çıkan Özellikler](#öne-çıkan-özellikler)
- [Kullanım Alanları](#kullanım-alanları)
- [Nesting ve Geometri](#nesting-ve-geometri)
- [Desteklenen Dosya ve Geometri Türleri](#desteklenen-dosya-ve-geometri-türleri)
- [Malzeme Yönetimi](#malzeme-yönetimi)
- [Kullanıcı ve Yönetim Sistemi](#kullanıcı-ve-yönetim-sistemi)
- [Mimari](#mimari)
- [Teknoloji Yığını](#teknoloji-yığını)
- [Proje Yapısı](#proje-yapısı)
- [Yerel Geliştirme](#yerel-geliştirme)
- [Test ve Kalite Kontrolü](#test-ve-kalite-kontrolü)
- [Cloudflare Dağıtımı](#cloudflare-dağıtımı)
- [Güvenlik ve Veri Yönetimi](#güvenlik-ve-veri-yönetimi)
- [Tasarım İlkeleri](#tasarım-ilkeleri)
- [Sürümleme](#sürümleme)
- [İletişim](#iletişim)
- [Lisans ve Üçüncü Taraf Bileşenler](#lisans-ve-üçüncü-taraf-bileşenler)

---

## Genel Bakış

**Serula Nesting Pro**, DXF ve desteklenen vektör geometrilerini üretim malzemesi üzerine otomatik olarak yerleştiren web tabanlı bir 2D nesting uygulamasıdır.

Projenin temel hedefi yalnızca parçaları yüzeye sığdırmak değil; gerçek geometrileri, parça yönlerini, malzeme sınırlarını ve üretim kurallarını koruyarak daha verimli bir yerleşim üretmektir.

Sistem özellikle ayakkabı üretimi, suni deri, tekstil, lazer kesim, CNC ve benzeri üretim süreçlerinde kullanılmak üzere geliştirilmektedir.

### Temel hedefler

- Malzeme firesini azaltmak
- Parça ölçülerini değiştirmeden yerleşim yapmak
- İçbükey ve düzensiz geometrileri doğru işlemek
- Rulo ve plaka çalışma biçimlerini desteklemek
- Parça yönü ve dönüş kurallarını korumak
- Büyük hesaplamalarda arayüzü mümkün olduğunca akıcı tutmak
- Üretime uygun DXF çıktısı oluşturmak
- Kullanıcı, kota ve sistem ayarlarını merkezi olarak yönetmek

---

## Öne Çıkan Özellikler

### DXF ve parça hazırlığı

- DXF dosyalarını içe aktarma
- SVG içe aktarma desteği
- Parçaların gerçek ölçülerini koruma
- Açık ve geçersiz konturları kontrol etme
- İç boşlukları koruma
- Katman bazlı içe aktarma
- Parça adetlerini değiştirme
- Manuel parça düzenleme
- Parça çoğaltma ve silme
- Klavye kısayolları ile hızlı hazırlık

### Otomatik nesting

- WebAssembly tabanlı yüksek performanslı yerleştirme
- Web Worker üzerinde arka plan hesaplama
- Rulo malzeme desteği
- Sabit ölçülü plaka desteği
- Çoklu plaka yerleşimi
- Parça aralığı kontrolü
- Başlangıç yönü seçenekleri
- Rotasyon kuralları
- Canlı ve kontrol edilmiş yerleşim sonucu
- Kullanılabilir malzeme alanını daha verimli değerlendirmeye yönelik optimizasyon

### Kullanıcı deneyimi

- Tarayıcı tabanlı çalışma
- Kurulum gerektirmeyen üretim arayüzü
- Proje kurtarma / tarayıcıya kaydetme
- Koyu ve açık görünüm desteği
- Milimetre ve inç görüntüleme
- Mobil uyumlu kullanıcı ve admin ekranları
- DXF dışa aktarma

---

## Kullanım Alanları

Serula Nesting Pro aşağıdaki üretim alanlarına odaklanır:

| Alan | Kullanım |
|---|---|
| Ayakkabı üretimi | Saya, astar, taban ve yardımcı parçaların yerleşimi |
| Suni deri | Rulo malzemede fire azaltma |
| Tekstil | Düzensiz kalıp parçalarının yerleşimi |
| Lazer kesim | DXF tabanlı üretim hazırlığı |
| CNC | Vektör parçalarının plaka üzerine yerleşimi |
| Prototipleme | Hızlı parça hazırlama ve yerleşim denemeleri |

---

## Nesting ve Geometri

Serula, parçaları yalnızca bounding-box seviyesinde değerlendirmek yerine gerçek konturları temel alan bir geometri akışı kullanır.

Geometri işlemleri uygulama içinde ayrı modüllere ayrılmıştır:

- Normalizasyon
- Kontur doğrulama
- Yerleşim geometrisi
- Çoklu plaka yönetimi
- Parça hareket ve dönüş işlemleri
- Yerleşim sonuçlarının çalışma alanına uygulanması
- DXF/SVG dışa aktarma hazırlığı

Yerleştirme motoru Rust + WebAssembly üzerinden çalışır ve hesaplama yükünün kullanıcı arayüzünü bloke etmemesi için worker altyapısından yararlanır.

> **Önemli:** İçe aktarılan parçaların üretim ölçüleri otomatik olarak küçültülmez veya büyütülmez.

---

## Desteklenen Dosya ve Geometri Türleri

### İçe aktarma

- DXF
- SVG
- Serula/Sparrow proje verileri

### DXF geometrileri

Projede işlenen başlıca geometri türleri:

- LINE
- ARC
- CIRCLE
- ELLIPSE
- LWPOLYLINE
- POLYLINE
- SPLINE
- INSERT

İçe aktarma sırasında kapalı konturlar değerlendirilir; açık veya geçersiz geometriler kullanıcıya bildirilir.

---

## Malzeme Yönetimi

### Rulo

Rulo modunda kullanıcı malzeme genişliğini belirler. Yerleştirme motoru bu genişlik içerisinde kullanılan toplam uzunluğu azaltmaya çalışır.

### Plaka

Plaka modunda genişlik ve uzunluk birlikte tanımlanır. Tüm parçalar tek plakaya sığmadığında sistem çoklu plaka çalışma biçimini destekler.

### Yerleşim ayarları

Yönetilebilen temel parametreler:

- Malzeme genişliği
- Plaka uzunluğu
- Parça aralığı
- Kenar payı
- Malzeme türü
- Rotasyon kuralı
- Yerleşim başlangıç yönü
- Solver profili

### Rotasyon seçenekleri

- **0°** — yön korunur
- **0° / 180°** — parça ters çevrilebilir
- **Serbest** — desteklenen serbest dönüş davranışı kullanılır

---

## Kullanıcı ve Yönetim Sistemi

Serula yalnızca bir nesting arayüzü değil, aynı zamanda sunucu tarafı kullanıcı ve yönetim altyapısına sahiptir.

### Kullanıcı tarafı

- E-posta ve parola ile giriş
- Google hesabı ile giriş
- Oturum yönetimi
- Nesting hakkı / kota sistemi
- Sınırsız kullanıcı desteği
- Şifre sıfırlama
- Kullanıcıya özel varsayılan ayarlar
- Kullanıcı oturumunda merkezi ayarların uygulanması

### Admin paneli

Yönetim rotası:

```text
/admin
```

Admin panelinde:

- Kullanıcı listesi
- Kullanıcı arama ve filtreleme
- Nesting hakkı yönetimi
- Sınırsız / kotasız kullanım anahtarı
- Kullanıcıya özel ayarlar
- Sistem varsayılanları
- Şifre sıfırlama
- Sistem sağlık durumu
- Admin API durumu
- Kimlik doğrulama durumu
- Kalıcı kullanıcı deposu durumu
- Sistem logları
- Onay tabanlı uzaktan destek oturumu

### Uzaktan destek

Uzaktan destek özelliği yalnızca **Serula uygulamasının kendi ayarlarını** yönetmek için tasarlanmıştır.

- Admin destek isteği gönderir
- Kullanıcı isteği açıkça onaylar veya reddeder
- Onaylanan oturum sınırlı süreyle aktif olur
- Kullanıcı istediği anda desteği kapatabilir
- Tarayıcının diğer sekmelerine, yerel dosyalara veya cihazın diğer bölümlerine erişim verilmez

---

## Mimari

```text
                    ┌───────────────────────┐
                    │      Kullanıcı        │
                    │ Safari / Chrome / vb. │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   React + TypeScript  │
                    │      Vite SPA         │
                    └───────┬───────┬───────┘
                            │       │
                  Geometri  │       │  API / Auth
                            ▼       ▼
              ┌────────────────┐  ┌────────────────────┐
              │   Web Worker   │  │ Cloudflare Worker  │
              │ Geometry/Solver│  │ Auth / Admin / API │
              └───────┬────────┘  └─────────┬──────────┘
                      │                     │
                      ▼                     ▼
              ┌────────────────┐  ┌────────────────────┐
              │ Rust + WASM    │  │ Cloudflare D1     │
              │ Sparrow/Jagua  │  │ Kullanıcı / Log   │
              └────────────────┘  └────────────────────┘
```

### İstemci

React ve TypeScript arayüzü dosya içe aktarma, çalışma alanı, ayar kontrolleri, kullanıcı etkileşimleri ve sonuç görselleştirmesini yönetir.

### Worker katmanı

Yoğun geometri ve solver görevleri ana UI iş parçacığından ayrılır.

### WASM motoru

Rust tabanlı motor tarayıcı içerisinde WebAssembly olarak çalışır. Projede Sparrow ve Jagua tabanlı bileşenler kullanılır.

### Sunucu katmanı

Cloudflare Worker:

- API yönlendirme
- Kullanıcı kimlik doğrulama
- Google giriş doğrulama
- Admin işlemleri
- Kota yönetimi
- Kullanıcı ayarları
- Sistem logları
- Şifre sıfırlama
- D1 erişimi

işlevlerini yürütür.

---

## Teknoloji Yığını

### Frontend

- React 19
- TypeScript 5.8
- Vite 6
- Native browser APIs
- Web Workers

### Geometri / Nesting

- Rust
- WebAssembly
- Sparrow
- Jagua
- polygon-clipping
- polylabel
- robust-predicates

### Sunucu

- Cloudflare Workers
- Cloudflare D1
- Cloudflare Assets
- Cloudflare Email binding

### Kimlik doğrulama

- E-posta / parola
- PBKDF2-SHA256 parola türetme
- Google Identity Services
- HttpOnly + Secure oturum çerezleri

### Test ve geliştirme

- Vitest
- Playwright
- TypeScript typecheck
- Kaynak bütünlüğü kontrolü

---

## Proje Yapısı

```text
nesting/
├── README.md
├── LICENSE
└── web/
    ├── public/                 Statik dosyalar ve örnek veri setleri
    ├── scripts/                Build ve yardımcı scriptler
    ├── src/
    │   ├── components/         Arayüz bileşenleri
    │   ├── export/             DXF / SVG / PDF / ZIP dışa aktarma
    │   ├── geometry/           Geometri ve yerleşim yardımcıları
    │   ├── import/             DXF / SVG / proje içe aktarma
    │   ├── storage/            Tarayıcı tarafı proje kurtarma
    │   ├── workers/            Worker protokolü ve solver iş parçacıkları
    │   ├── Admin.tsx           Yönetim paneli
    │   ├── App.tsx             Ana çalışma alanı
    │   ├── AuthGate.tsx        Kullanıcı/admin kimlik doğrulama
    │   └── main.tsx            Uygulama başlangıcı
    ├── wasm/
    │   ├── Cargo.toml
    │   └── ...
    ├── worker/
    │   └── serula-worker.js    Cloudflare API Worker
    ├── package.json
    └── wrangler.jsonc
```

---

## Yerel Geliştirme

### Gereksinimler

- Node.js
- npm
- Rust toolchain — WASM yeniden derlenecekse
- wasm-pack — WASM yeniden derlenecekse

### Kurulum

```bash
git clone https://github.com/M93hasan/nesting.git
cd nesting/web
npm ci
```

### Geliştirme sunucusu

```bash
npm run dev
```

Varsayılan geliştirme adresi:

```text
http://127.0.0.1:5173
```

### Üretim derlemesi

```bash
npm run build
```

### Önizleme

```bash
npm run preview
```

---

## Test ve Kalite Kontrolü

### TypeScript kontrolü

```bash
npm run typecheck
```

### Birim testleri

```bash
npm test
```

### Uçtan uca test

```bash
npm run test:e2e
```

### Kaynak bütünlüğü

```bash
npm run source:check
```

Kaynak bütünlüğü adımı ayrıca sürüm numarasının aşağıdaki yerlerde senkron kalmasını kontrol eder:

- `web/package.json`
- `web/package-lock.json`
- Worker build marker'ları

Bu kontrol, farklı dosyalarda farklı sürüm numarasıyla yayın yapılmasını engeller.

---

## Cloudflare Dağıtımı

Üretim ortamı Cloudflare Workers üzerinde çalışır.

### Yapılandırma

```text
web/wrangler.jsonc
```

### Ana bileşenler

| Bileşen | Kullanım |
|---|---|
| Worker | API ve sunucu iş mantığı |
| Assets | Vite üretim çıktısı |
| D1 | Kalıcı kullanıcı ve yönetim verileri |
| Email binding | Şifre sıfırlama e-postaları |
| Custom Domain | serula.site |

### Dağıtım

```bash
cd web
npm run build
npx wrangler deploy
```

Üretim branch'i:

```text
main
```

---

## Güvenlik ve Veri Yönetimi

Projede güvenlik açısından temel olarak şu uygulamalar kullanılır:

- Parolalar düz metin olarak tutulmaz
- PBKDF2-SHA256 tabanlı parola türetme
- Oturum anahtarları hashlenerek saklanır
- HttpOnly oturum çerezleri
- Secure cookie kullanımı
- SameSite koruması
- Same-origin POST kontrolü
- Google ID token doğrulaması
- Şifre sıfırlama tokenlarının hashlenmesi
- Tek kullanımlık şifre sıfırlama bağlantıları
- Admin işlemlerinin sunucu tarafında doğrulanması
- Onay tabanlı uzaktan destek

### Sistem logları

Audit / sistem logları:

- Giriş
- Çıkış
- Nesting başlatma
- Dışa aktarma yetkilendirme
- Kota değişikliği
- Sınırsız kullanım değişikliği
- Kullanıcı ayarı değişikliği
- Sistem varsayılanı değişikliği
- Şifre sıfırlama işlemleri
- Uzaktan destek işlemleri

gibi olayları kaydeder.

**Log saklama süresi: 10 gün.**

10 günden eski audit logları otomatik temizlenir.

---

## Tasarım İlkeleri

Serula geliştirilirken aşağıdaki kurallar önceliklidir:

1. **Geometri doğruluğu** — üretim ölçüsü korunmalıdır.
2. **Sessiz veri düzeltme yapılmamalıdır** — geçersiz konturlar kullanıcıya bildirilmelidir.
3. **Nesting motoru arayüzden ayrılmalıdır** — hesaplama UI'ı mümkün olduğunca engellememelidir.
4. **Sunucu tarafı kontroller zorunludur** — kota ve yetki yalnızca istemciye bırakılmamalıdır.
5. **Kullanıcı ayarları merkezi yönetilebilir olmalıdır.**
6. **Mobil arayüz yönetilebilir kalmalıdır.**
7. **Yayınlanan sürüm numarası sistemin her yerinde aynı olmalıdır.**

---

## Sürümleme

Güncel sürüm:

```text
v0.0.67
```

Serula'da yayınlanan her değişiklikte sürüm numarası artırılır. Böylece kullanıcı arayüzünde görünen sürüm ile yayınlanan kodun eşleşmesi kolayca doğrulanabilir.

---

## Yol Haritası

Proje aktif olarak geliştirilmektedir. Öncelikli geliştirme alanları:

- Nesting verimliliğinin artırılması
- Büyük DXF dosyalarında performans geliştirmeleri
- Daha kapsamlı kullanıcı ve lisans yönetimi
- Admin raporlama ekranlarının geliştirilmesi
- Üretim makinesi profilleri
- Kullanıcı bazlı daha kapsamlı varsayılanlar
- DXF dışa aktarma uyumluluğunun genişletilmesi
- Hata teşhis ve üretim loglarının geliştirilmesi

---

## İletişim

**Proje Sahibi / Geliştirici:** Muhammet Hasanoğlu

- E-posta: [m93hasan@gmail.com](mailto:m93hasan@gmail.com)
- Telefon: [+90 539 348 06 22](tel:+905393480622)
- GitHub: [M93hasan](https://github.com/M93hasan)
- Uygulama: [https://serula.site](https://serula.site)

---

## Lisans ve Üçüncü Taraf Bileşenler

Repository lisans koşulları için:

```text
LICENSE
```

Üçüncü taraf kütüphane ve bileşen bildirimleri:

```text
web/public/THIRD_PARTY_NOTICES.txt
```

Rust / WASM tarafında kullanılan bağımlılıkların lisans ve sürüm bilgileri ilgili proje dosyalarında tutulur.

---

<div align="center">

### Serula Nesting Pro

**DXF yerleştirme · Malzeme optimizasyonu · Üretim hazırlığı**

[Uygulamayı Aç](https://serula.site/) · [Admin Paneli](https://serula.site/admin)

</div>
