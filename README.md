# Serula Nesting Pro

<div align="center">

<img src="web/public/serula-logo.svg" alt="Serula Nesting Pro" width="96" />

### Web tabanlı DXF nesting ve üretim hazırlık sistemi

**Rulo ve plaka malzemelerde düzensiz parçaları gerçek geometrileriyle yerleştirir, üretim ölçülerini korur ve DXF çıktısını üretime hazırlar.**

[![Version](https://img.shields.io/github/package-json/v/M93hasan/nesting?filename=web%2Fpackage.json&style=flat-square)](web/package.json)
[![React](https://img.shields.io/badge/React-19-20232a?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-WASM-000000?style=flat-square&logo=rust)](web/wasm/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-f38020?style=flat-square&logo=cloudflare&logoColor=white)](web/wrangler.jsonc)

**Canlı uygulama:** [serula.site](https://serula.site/) 

</div>

---

## Serula nedir?

**Serula Nesting Pro**, özellikle ayakkabı, suni deri, tekstil, lazer kesim ve CNC üretim akışları için geliştirilen tarayıcı tabanlı bir 2D nesting uygulamasıdır.

Amaç yalnızca parçaları bir yüzeye sığdırmak değildir. Serula; gerçek DXF geometrisini, iç boşlukları, dönüş izinlerini, malzeme sınırlarını, parça aralığını ve üretim yönünü koruyarak mümkün olduğunca verimli bir yerleşim üretmeye çalışır.

Uygulama iki temel malzeme tipini destekler:

- **Rulo:** Sabit genişlik, optimize edilen kullanılan uzunluk.
- **Plaka:** Sabit genişlik × uzunluk, gerektiğinde Plaka 1, Plaka 2, Plaka 3… şeklinde çoklu plaka.

Varsayılan üretim ayarları:

- **Malzeme genişliği:** 1400 mm
- **Parça aralığı:** 0 mm
- **Başlangıç yönü:** Sağ alt
- **Varsayılan dönüş:** 0° / 180°

---

## Temel özellikler

### DXF içe aktarma

Serula kapalı üretim konturlarını içe aktarır ve geçersiz geometrileri sessizce düzeltmek yerine kullanıcıya bildirir.

Desteklenen başlıca DXF varlıkları:

- LINE
- ARC
- CIRCLE
- ELLIPSE
- LWPOLYLINE
- POLYLINE
- SPLINE
- INSERT

Desteklenen ek davranışlar:

- Katman seçimi
- İç boşlukların korunması
- DXF renk ve bağlı detay geometrilerinin korunması
- Milimetre birimlerinin korunması
- Açık/geçersiz kontur raporlama
- Kaynak SPLINE bilgisinin uygun durumlarda korunması

SVG, PLT/HP-GL ve Serula/Sparrow proje verileri de içe aktarılabilir.

### PLT / HP-GL içe aktarma

Serula `.plt`, `.hpgl`, `.hpg` ve `.hgl` çizimlerini açabilir. Standart HP-GL plotter ölçüsü korunur: **1 plotter birimi = 0,025 mm (40 birim = 1 mm)**. `PU`, `PD`, `PA`, `PR`, `AA`, `AR` ve `CI` komutları işlenir; kapalı kesim konturları parça, içte kalan kapalı konturlar delik olarak içe alınır.

Fiziksel ölçüyü güvenli belirlemek için `SC` kullanıcı ölçeklemesi kullanılan dosyalarda açık bir `IP` giriş penceresi bulunması gerekir.

### Nesting

Yerleştirme motoru tarayıcı içinde **Rust + WebAssembly** ile çalışır. Ağır hesaplamalar Web Worker üzerinde yürütülür; böylece UI ana iş parçacığı mümkün olduğunca serbest kalır.

Serula kendi yerine bağımsız bir nesting motoru icat etmez. Üretim yerleşiminin temel motoru doğrudan upstream Sparrow projesidir:

```text
https://github.com/JeroenGar/sparrow.git
```

Projede sabitlenen Sparrow revizyonu:

```text
7f0e10f946f70a86138d3938548a13ee46464f39
```

Sparrow, çakışma ve yerleşim geometrisi için Jagua tabanlı altyapı kullanır.

### Rotasyon seçenekleri

Kullanıcı arayüzündeki üretim seçenekleri:

- **0°**
- **0° / 180°**
- **Her yöne**

Parçanın izin verilen dönüşleri nesting motoruna aktarılır; yerleşim sonrası parça yönleri keyfî olarak değiştirilmez.

### Başlangıç yönü

Desteklenen başlangıç yönleri:

- **Sağ alt**
- **Sağ üst**

Sonuç geometrisi seçilen görsel başlangıç köşesine göre konumlandırılır. Bu işlem parçaların kendi aralarındaki Sparrow yerleşimini bozmaz.

---

## Rulo modu

Rulo modunda kullanıcı malzeme genişliğini belirler. Sparrow bu genişlik içerisinde parçaları yerleştirir ve kullanılan rulo uzunluğunu azaltmaya çalışır.

Örnek:

```text
Genişlik: 1400 mm
Uzunluk: nesting sonucuna göre değişir
```

Rulo DXF dışa aktarma davranışı, plaka modundaki çoklu plaka düzeninden bağımsızdır.

---

## Plaka modu

Plaka modunda hem genişlik hem uzunluk sabittir.

Örnek:

```text
1400 × 2000 mm
```

Birinci plakaya bütün parçalar sığmıyorsa Serula kalan kopyaları **aynı Sparrow/Jagua motoruyla** sonraki fiziksel plakada yeniden çözer:

```text
Plaka 1 → sığan parçalar
Plaka 2 → kalan parçalar
Plaka 3 → hâlâ kalan parçalar
...
```

Serula plaka modunda ikinci bir shelf/grid nesting algoritmasına geçmez. Her fiziksel plakanın gerçek yerleşimi Sparrow tarafından üretilir; Serula çoklu plaka orkestrasyonunu ve plaka sınırı kontrolünü yönetir.

Bu yaklaşım, upstream Sparrow'un doğal olarak bir **irregular strip packing** çözücüsü olması nedeniyle çoklu fiziksel plaka davranışını uygulama katmanında koordine eder.

---

## DXF dışa aktarma

Üretim çıktısı **DXF** olarak alınır ve CorelDRAW gibi CAD/vektör uygulamalarında kullanılmak üzere hazırlanır.

### Tek plaka

Tek plaka varsa mevcut yerleşim koordinatları korunur.

### Çoklu plaka

Birden fazla plaka varsa çıktı yine **tek bir DXF dosyasıdır**.

Plakaların içindeki Sparrow/Jagua yerleşimi kesinlikle değiştirilmez. Yalnızca dışa aktarım sırasında her plakanın gerçek çizim geometrisine yatay X ofseti uygulanır.

Plakalar arasında sabit **50 mm** boşluk bulunur.

1400 mm genişlik örneği:

```text
Plaka 1 başlangıcı: X = 0 mm
Plaka 2 başlangıcı: X = 1450 mm
Plaka 3 başlangıcı: X = 2900 mm
```

Genel kural:

```text
X ofseti = plakaIndex × (malzemeGenişliği + 50 mm)
```

Önemli:

- DXF içine plaka çerçevesi eklenmez.
- Ek dikdörtgen/kutu çizilmez.
- Yalnızca gerçek üretim geometrisi dışa aktarılır.
- Parçaların plaka içindeki göreli X/Y konumu korunur.
- Dönüş açısı korunur.
- Ölçek ve gerçek ölçü korunur.
- İç boşluk ve bağlı detay geometrileri aynı ofsetle taşınır.
- Rulo modu bu davranıştan etkilenmez.

---

## Geometri doğruluğu

Serula'nın temel üretim kuralları:

1. **Gerçek ölçü korunur.** Nesting parçaları otomatik küçültmez veya büyütmez.
2. **Gerçek kontur kullanılır.** İçbükey dış sınırlar korunur.
3. **Bounding box / convex hull gerçek yerleşimin yerine kullanılmaz.** Bunlar yalnızca gerekli ön kontroller veya güvenli yardımcı durumlar için kullanılabilir.
4. **Geçersiz geometri sessizce düzeltilmez.**
5. **İç boşluklar korunur.**
6. **Parça aralığı ayrı bir üretim parametresidir.**
7. **Kontrol edilmiş sonuç doğrulanmadan üretim DXF'i oluşturulmaz.**

---

## Kullanıcı arayüzü

Serula çalışma alanı CAD benzeri sade bir üretim arayüzü sunar.

Başlıca işlevler:

- DXF, SVG ve PLT/HP-GL seçme ve içe aktarma
- Parça adedi değiştirme
- Parça seçme, taşıma, silme ve çoğaltma
- Rotasyon kuralı seçme
- Rulo / Plaka seçimi
- Malzeme genişliği ve plaka uzunluğu girişi
- Parça aralığı ayarı
- Sağ alt / sağ üst başlangıç yönü
- Otomatik nesting
- Canlı yerleşim görüntüsü
- Geometri doğrulaması
- DXF indirme
- Tarayıcıda proje kurtarma
- Kullanıcı hesabına bağlı otomatik bulut kayıt
- **Geçmiş** sekmesinden son proje durumunu ve DXF exportlarını açma/indirme
- Açık / koyu görünüm
- mm / inç görüntüleme

---

## Bulut kayıt ve Geçmiş

Giriş yapmış kullanıcının çalıştığı proje yalnızca DXF export anında değil, proje üzerinde değişiklik oldukça otomatik olarak buluta senkronlanır.

Ana otomatik kayıt adı:

```text
Serula Nesting En Temiz Hali
```

Bu kayıt son geçerli çalışma durumunu saklar:

- Proje adı
- Parçalar ve adetler
- Orijinal DXF kaynak entity bilgileri
- İç boşluklar ve bağlı detay geometrileri
- İzin verilen dönüşler
- Malzeme tipi ve ölçüleri
- Parça aralığı ve başlangıç yönü
- Kopya konumları / yerleşim
- Geçerli nesting sonucu
- Seri adedi
- Görünüm (açık/koyu/sistem) ve mm/inç tercihi

**Geçmiş** sekmesinde iki kayıt türü bulunur:

1. **Serula Nesting En Temiz Hali** — sürekli güncellenen son proje durumu; tekrar açılabilir veya proje dosyası olarak indirilebilir.
2. **DXF export geçmişi** — her export ayrı kayıt olarak tutulur; DXF tekrar indirilebilir, o export anındaki proje tekrar açılabilir veya kayıt silinebilir.

Kayıtlar kullanıcı hesabına bağlıdır; kullanıcılar birbirlerinin proje veya export kayıtlarını göremez.

Büyük proje ve DXF içerikleri Cloudflare D1 tek-satır sınırına takılmamak için parçalara bölünerek saklanır.

**Saklama süresi:** DXF export geçmişi ve ona bağlı proje kopyaları 32 günü geçince otomatik silinir. Güncel otomatik proje kaydı (`Serula Nesting En Temiz Hali`) bu temizlemeden etkilenmez.

---

## Kullanıcı ve yönetim altyapısı

Serula'nın Cloudflare tabanlı sunucu katmanı kullanıcı ve yönetim işlemlerini yürütür.

Başlıca özellikler:

- E-posta/parola ile giriş
- Google ile giriş
- Oturum yönetimi
- Kullanıcı kotası / nesting hakkı
- Admin panelinden kullanıcıya özel lisans süresi (7/30/90/180/365 gün veya özel gün)
- Lisans başlangıç/bitiş tarihi ve süresi dolan hesaplarda üretim/export yetkisi kontrolü
- Lisans süresini kaldırıp kullanıcıyı süresiz yapabilme
- Sınırsız kullanıcı
- Kullanıcıya özel varsayılanlar
- Sistem varsayılanları
- Şifre sıfırlama
- Admin kullanıcı yönetimi ve kullanıcı hesabını tamamen silme
- İletişim bölümünde kullanıcı ↔ admin kalıcı destek mesajlaşması
- Admin destek gelen kutusu, okunmamış mesajlar, çevrim içi sayısı ve yeşil durum noktası
- Audit / sistem logları
- Kullanıcıya özel otomatik proje bulut kaydı ve DXF geçmişi
- Kullanıcı onaylı uzaktan destek

Yönetim paneli:

```text
https://serula.site/admin
```

---

## Mimari

```text
┌──────────────────────────┐
│      React + TypeScript  │
│        Vite SPA          │
└────────────┬─────────────┘
             │
       ┌─────┴─────┐
       │           │
       ▼           ▼
┌──────────────┐  ┌──────────────────┐
│ Web Workers  │  │ Cloudflare Worker│
│ Geometry /   │  │ Auth / Admin/API │
│ Solver       │  └────────┬─────────┘
└──────┬───────┘           │
       │                   ▼
       ▼             ┌──────────────┐
┌──────────────┐     │ Cloudflare D1│
│ Rust + WASM  │     └──────────────┘
│ Sparrow/Jagua│
└──────────────┘
```

### İstemci

React + TypeScript; çalışma alanı, içe aktarma, ayarlar, sonuç görüntüleme ve kullanıcı etkileşimlerini yönetir.

### Worker katmanı

Geometri hazırlığı ve solver işlemleri UI iş parçacığından ayrılır.

### WASM

Rust wrapper, sabitlenen upstream Sparrow sürümünü tarayıcıda çalıştırır.

### Sunucu

Cloudflare Worker; auth, admin API, kota, ayarlar, loglar ve D1 erişimini yönetir.

---

## Teknoloji yığını

| Katman | Teknoloji |
|---|---|
| UI | React 19, TypeScript, Vite |
| Nesting | Sparrow |
| Çakışma / geometri altyapısı | Jagua |
| WASM | Rust, wasm-bindgen / wasm-pack |
| Arka plan hesaplama | Web Workers |
| Sunucu | Cloudflare Workers |
| Veri | Cloudflare D1 |
| Test | Vitest, Playwright |

---

## Proje yapısı

```text
nesting/
├── README.md
├── LICENSE
└── web/
    ├── public/
    ├── scripts/
    ├── src/
    │   ├── components/      UI bileşenleri
    │   ├── export/          DXF dışa aktarma
    │   ├── geometry/        Geometri ve çoklu plaka işlemleri
    │   ├── import/          DXF / SVG / proje içe aktarma
    │   ├── storage/         Tarayıcı proje kurtarma
    │   ├── workers/         Solver ve geometri worker'ları
    │   ├── App.tsx
    │   └── Admin.tsx
    ├── wasm/                Rust/WASM Sparrow wrapper
    ├── worker/              Cloudflare sunucu kodu
    ├── tests/
    ├── package.json
    └── wrangler.jsonc
```

---

## Yerel geliştirme

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
npm run dev
```

### Üretim derlemesi

```bash
cd web
npm run build
```

### Test

```bash
cd web
npm test
```

Uçtan uca testler:

```bash
npm run test:e2e
```

---

## Yayın ve sürümleme

Üretim branch'i:

```text
main
```

Ana sürüm kaynağı:

```text
web/package.json
```

Yayın sürümü ayrıca lockfile ve deploy marker ile senkron tutulur.

Cloudflare üretim dağıtımı repository entegrasyonu üzerinden `main` branch'ini takip eder.

Canlı adres:

```text
https://serula.site/
```

---

## Geliştirme ilkeleri

Serula'da değişiklik yapılırken şu kurallar korunmalıdır:

- Üretim geometrisi ve ölçüleri bozulmamalıdır.
- Sparrow/Jagua yerleşiminin yerine ayrı bir gizli nesting algoritması konulmamalıdır.
- Plaka ve rulo davranışları açık biçimde ayrılmalıdır.
- Geçersiz DXF geometrisi kullanıcıdan saklanmamalıdır.
- Export, ekrandaki doğrulanmış yerleşimi temsil etmelidir.
- CorelDRAW uyumluluğu üretim gereksinimi olarak korunmalıdır.
- Değişiklikler test edilmeden `main` branch'ine alınmamalıdır.
- Her yayınlanan değişiklikte sürüm artırılmalıdır.

---

## İletişim

**Geliştirici:** Muhammet Hasanoğlu

- E-posta: [m93hasan@gmail.com](mailto:m93hasan@gmail.com)
- GitHub: [M93hasan](https://github.com/M93hasan)
- Uygulama: [serula.site](https://serula.site/)

---

## Lisans ve üçüncü taraf bileşenler

Repository lisansı:

```text
LICENSE
```

Üçüncü taraf bildirimleri:

```text
web/public/THIRD_PARTY_NOTICES.txt
```

Sparrow ve diğer Rust/WASM bağımlılıklarının kesin sürüm ve revizyonları ilgili `Cargo.toml` / lock dosyalarında sabitlenir.

---

<div align="center">

### Serula Nesting Pro

**DXF nesting · Rulo ve plaka · Sparrow/Jagua · Üretim DXF**

[Uygulamayı Aç](https://serula.site/) · [Admin Paneli](https://serula.site/admin)

</div>
