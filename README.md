Serula Nesting Pro
Web Tabanlı DXF Nesting ve Üretim Hazırlık Sistemi
Rulo ve plaka malzemelerde düzensiz parçaları gerçek geometrileriyle yerleştirir, üretim ölçülerini korur ve DXF çıktısını üretime hazırlar.

Canlı Uygulama: https://serula.site/
Admin Paneli: https://serula.site/admin
Uygulama Arayüzü
Arayüz Önizlemesi: web/public/screenshots/app-preview.png
Şekil 1: Serula Nesting Pro ana çalışma alanı ve canlı nesting görünümü.
Serula Nedir?
Serula Nesting Pro, özellikle ayakkabı, suni deri, tekstil, lazer kesim ve CNC üretim akışları için geliştirilmiş tarayıcı tabanlı bir 2D nesting (fire minimize etme) uygulamasıdır.

Sadece parçaları bir yüzeye sığdırmayı değil; gerçek DXF geometrisini, iç boşlukları, dönüş izinlerini, malzeme sınırlarını, parça aralıklarını ve üretim yönünü koruyarak maksimum verimlilikte bir yerleşim üretmeyi hedefler.
Desteklenen Malzeme Tipleri
Malzeme Tipi
Tanım
Örnek Ayarlar
Dosya Yolu
Rulo Modu
Sabit genişlik, kullanılan uzunluk otomatik optimize edilir.
Genişlik: 1400 mmUzunluk: Değişken
web/public/screenshots/roll-mode.png
Plaka Modu
Sabit genişlik x uzunluk. Parçalar sığmadıkça otomatik yeni plaka açılır (Plaka 1, Plaka 2, ...).
Ölçü: 1400 x 2000 mm
web/public/screenshots/sheet-mode.png


Varsayılan Üretim Ayarları:

Malzeme Genişliği: 1400 mm
Parça Aralığı: 0 mm
Başlangıç Yönü: Sağ Alt
Varsayılan Dönüş: 0° / 180°
Temel Özellikler
1. Dosya İçe Aktarma (Import)
DXF Desteği: Kapalı üretim konturlarını hassasiyetle içe aktarır. Geçersiz geometrileri gizlemek yerine kullanıcıya raporlar.
Desteklenen Varlıklar: LINE, ARC, CIRCLE, ELLIPSE, LWPOLYLINE, POLYLINE, SPLINE, INSERT
Özellikler: Katman seçimi, iç boşluk/renk/detay koruma, mm birim koruması, kaynak SPLINE koruması.
PLT / HP-GL Desteği: .plt, .hpgl, .hpg ve .hgl formatlarını destekler. 1 plotter birimi = 0.025 mm (40 birim = 1 mm) hassasiyetinde işlenir (PU, PD, PA, PR, AA, AR, CI komutları tam desteklenir).
Diğer Formatlar: SVG ve Serula/Sparrow proje verileri.

İçe Aktarma Önizlemesi: web/public/screenshots/dxf-import-preview.png
Şekil 2: DXF katman seçimi ve geometri doğrulama penceresi.
2. Nesting Motoru (Rust + WASM)
Yerleştirme motoru tarayıcı içinde Rust + WebAssembly ile çalışır. Hesaplama süreçleri Web Worker üzerinde yürütüldüğünden arayüz donmaz (UI thread serbest kalır).
Gücünü doğrudan Sparrow Engine (Rev: 7f0e10f) ve çakışma geometrisi için Jagua altyapısından alır.
3. Esnek Üretim Ayarları
Rotasyon Seçenekleri: 0°, 0° / 180° veya Her Yöne.
Başlangıç Yönü: Sağ Alt veya Sağ Üst başlangıç konumlandırması.
DXF Dışa Aktarma (Export)
Üretim çıktısı CorelDRAW ve diğer CAD/CAM uygulamalarıyla %100 uyumlu DXF formatında alınır.

DXF Export Önizlemesi: web/public/screenshots/dxf-export-preview.png
Şekil 3: Çoklu plaka DXF dışa aktarma düzeni (50 mm plaka arası güvenlik boşluğu).

Tek Plaka: Mevcut yerleşim koordinatları birebir korunur.
Çoklu Plaka: Tüm plakalar tek bir DXF dosyasında birleştirilir.
Her plaka arasına 50 mm güvenlik boşluğu eklenir.
Hesaplama Formülü: X Ofseti = Plaka_Index x (Malzeme_Genişliği + 50 mm)
Önemli: Plaka dışına hayali kutu/çerçeve eklenmez; sadece gerçek üretim geometrisi, doğru ölçek ve açılarla aktarılır.
Geometri Doğruluğu İlkeleri
Ölçek Korunur: Parçalar asla otomatik büyütülmez veya küçültülmez.
Gerçek Kontur: Bounding box veya convex hull gibi basitleştirmeler gerçek yerleşim yerine kullanılmaz; içbükey sınırlar korunur.
Sıfır Toleranslı Hata Bildirimi: Geçersiz geometriler sessizce düzeltilmez, kullanıcı bilgilendirilir.
İç Boşluklar ve Detaylar: Tüm iç delikler ve bağlı detay çizgileri eksiksiz taşınır.
Bulut Kayıt, Geçmiş ve Yönetim
Otomatik Senkronizasyon: Oturum açmış kullanıcıların projeleri çalışırken anlık olarak buluta kaydedilir.
DXF Geçmişi: Yapılan her DXF export'u 32 gün boyunca saklanır, istenildiğinde tekrar indirilebilir veya projeye geri yüklenebilir.
Çoklu Dil & RTL: Türkçe, İngilizce, Arapça ve Farsça (RTL) arayüz desteği.
Lisans ve Kota: Admin paneli üzerinden süreli/süresiz lisanslama ve kullanıcı destek mesajlaşma altyapısı.
Mimari Yapı
t
┌──────────────────────────────────────────────────────────┐
│                   React 19 + TypeScript                  │
│                        (Vite SPA)                        │
└──────────────┬────────────────────────────┬──────────────┘
│                            │
▼                            ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│       Web Workers        │   │    Cloudflare Worker     │
│   Geometry / Solver      │   │    Auth / Admin / API    │
└──────────────┬───────────┘   └────────────┬─────────────┘
│                            │
▼                            ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│       Rust + WASM        │   │      Cloudflare D1       │
│     Sparrow / Jagua      │   │        Database          │
└──────────────────────────┘   └──────────────────────────┘

**Sistem Mimarisi Diyagramı:** `web/public/screenshots/architecture-diagram.png`

### Teknoloji Yığını

| Katman | Teknolojiler |

| :--- | :--- |

| **Frontend** | React 19, TypeScript, Vite, Tailwind/CSS |

| **Nesting & Engine** | Rust, WebAssembly, Sparrow, Jagua, Web Workers |

| **Backend & Cloud** | Cloudflare Workers, Cloudflare D1 (SQL) |

| **Test** | Vitest, Playwright (E2E) |

## Yerel Geliştirme (Local Setup)

### Gereksinimler

* Node.js (v18+) ve npm

* Rust Toolchain & wasm-pack (Yalnızca WASM derlenecekse)

### Kurulum

1. Repository'yi klonlayın:

```bash

git clone https://github.com/M93hasan/nesting.git

cd nesting/web

Bağımlılıkları yükleyin ve geliştirme sunucusunu başlatın:

npm ci

npm run dev

Testleri çalıştırın:

npm test          # Birim testleri

npm run test:e2e  # Playwright uçtan uca testler
İletişim & Katkı
Geliştirici: Muhammet Hasanoğlu

E-posta: m93hasan@gmail.com
GitHub: https://github.com/M93hasan
Web: https://serula.site/



Serula Nesting Pro - Endüstriyel 2D Nesting Çözümü
