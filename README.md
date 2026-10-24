# Serula Nesting Pro

**Web tabanlı 2D DXF yerleşim (nesting) ve üretim hazırlık uygulaması.**

Serula Nesting Pro; rulo ve plaka malzemelerdeki parçaları gerçek konturlarını ve ölçülerini koruyarak yerleştirmeye, malzeme kullanımını azaltmaya ve yerleşimi DXF olarak dışa aktarmaya yardımcı olur.

- **Canlı uygulama:** https://serula.site/
- **Yönetim paneli:** https://serula.site/admin
- **Kaynak kod:** https://github.com/M93hasan/nesting

## Görsel ve video

### Uygulama ekran görüntüsü

Aşağıdaki görseli depoya `web/public/media/re.png` adıyla ekleyin.

![Serula Nesting Pro uygulama ekran görüntüsü](web/public/media/re.png)

### Uygulama tanıtım videosu

**YouTube üzerinden izle:** Aşağıdaki video görseline tıklayarak tanıtımı YouTube'da açabilirsiniz.

[![Serula Nesting Pro tanıtım videosu — YouTube'da izle](https://img.youtube.com/vi/awy4QFCk7jg/hqdefault.jpg)](https://youtu.be/awy4QFCk7jg)

- [▶ YouTube'da tanıtım videosunu izle](https://youtu.be/awy4QFCk7jg)
- [MP4 dosyasını GitHub'dan aç](web/public/media/ve.mp4)

Videonun MP4 kopyası depoda `web/public/media/ve.mp4` adıyla tutulur. GitHub README içinde MP4'ün doğrudan oynatımı her yerde desteklenmediğinden, YouTube bağlantısı da eklenmiştir.

> **Dosyaları nereye koymalısınız?** GitHub deposunda `web/public/media/` klasörünü açın ve dosyaları tam olarak `re.png` ve `ve.mp4` adlarıyla yükleyin. Görsel için PNG veya JPG kullanabilirsiniz; bu README'deki bağlantı `re.png` adını bekler. Video MP4 biçiminde olmalıdır. Dosyalar yüklenmeden görsel/video bağlantıları görüntülenmez.

## Serula ne işe yarar?

Serula Nesting Pro; ayakkabı, suni deri, tekstil, lazer kesim ve CNC gibi üretim iş akışlarında 2D parçaların malzeme üzerine yerleştirilmesi için geliştirilmiş tarayıcı tabanlı bir uygulamadır. Amaç yalnızca parçaları alana sığdırmak değil; gerçek DXF konturlarını, parça aralıklarını, dönüş seçeneklerini ve malzeme sınırlarını dikkate alan bir yerleşim oluşturmaktır.

## Temel özellikler

### 1. Dosya içe aktarma

- DXF dosyalarını içe aktarma.
- Desteklenen DXF varlıkları: `LINE`, `ARC`, `CIRCLE`, `ELLIPSE`, `LWPOLYLINE`, `POLYLINE`, `SPLINE`, `INSERT`.
- Katman seçimi ve geometri doğrulama.
- PLT / HP-GL uzantıları: `.plt`, `.hpgl`, `.hpg`, `.hgl`.
- SVG ve Serula/Sparrow proje verileri için destek.

### 2. Nesting motoru

- Rust ve WebAssembly tabanlı yerleştirme motoru.
- Hesaplamaların Web Worker üzerinde çalıştırılması.
- Sparrow yerleştirme motoru ve geometri çakışma kontrollerinde Jagua altyapısı.

### 3. Rulo ve plaka modları

- **Rulo modu:** Malzeme genişliği sabittir; gereken uzunluk yerleşime göre değişir.
- **Plaka modu:** Malzeme genişliği ve uzunluğu sabittir; yerleşim için gerektiğinde birden fazla plaka kullanılabilir.
- Varsayılan malzeme genişliği: 1400 mm.
- Varsayılan parça aralığı: 0 mm.
- Başlangıç yönü ve rotasyon seçenekleri yapılandırılabilir.

### 4. Yerleştirme seçenekleri

- 0° dönüş, 0° / 180° dönüş veya tüm yönlerde dönüş seçenekleri.
- Sağ alt veya sağ üst başlangıç yönü.
- Benzer şekilleri yan yana gruplama seçeneği.
- Malzeme ölçülerine ve parça geometrisine göre yerleşimi inceleme.

### 5. DXF dışa aktarma

- Yerleşimi DXF olarak dışa aktarma.
- Tek plaka veya çoklu plaka çıktısı.
- Çoklu plaka dışa aktarımında plakalar arasında 50 mm güvenlik boşluğu kullanılması.
- Parça ölçeğini ve yerleşim koordinatlarını korumaya yönelik geometri odaklı iş akışı.

**Üretim notu:** DXF çıktısını makinede kullanmadan önce kendi CAD/CAM yazılımınızda açıp ölçüleri, konturları, yönleri ve makine ayarlarını kontrol edin.

### 6. Proje kaydı ve yönetim

- Oturum açmış kullanıcılar için proje senkronizasyonu.
- DXF dışa aktarma geçmişinin saklanması.
- Türkçe, İngilizce, Arapça ve Farsça arayüz desteği.
- Yönetim panelinde lisans/kota ve kullanıcı destek akışları.

## Geometri doğruluğu ilkeleri

- Parçalar otomatik olarak büyütülmemeli veya küçültülmemelidir.
- Gerçek konturlar, içbükey alanlar ve iç boşluklar korunmalıdır.
- Geçersiz geometriler sessizce düzeltilmek yerine kullanıcıya bildirilmelidir.
- Üretim öncesinde dışa aktarılan dosya, hedef CAD/CAM yazılımında doğrulanmalıdır.

## Teknoloji yığını

| Katman | Teknolojiler |
| --- | --- |
| Web arayüzü | React, TypeScript, Vite |
| Nesting ve geometri | Rust, WebAssembly, Sparrow, Jagua, Web Workers |
| Bulut | Cloudflare Workers, Cloudflare D1 |
| Test | Vitest, Playwright |

## Yerel geliştirme

### Gereksinimler

- Node.js ve npm
- Rust toolchain ve `wasm-pack` (WASM derlemesi gerektiğinde)

### Kurulum

Komutları sırayla çalıştırın:

```bash
git clone https://github.com/M93hasan/nesting.git
cd nesting/web
npm ci
npm run dev
```

### Testler

```bash
npm test
npm run test:e2e
```

Üretim derlemesi:

```bash
npm run build
```

GitHub Actions, ana dala gelen değişikliklerde uygulamanın derleme ve test kontrollerini çalıştırır.

## Katkı ve iletişim

- **Geliştirici:** Muhammet Hasanoğlu
- **GitHub:** https://github.com/M93hasan
- **Web:** https://serula.site/

## Lisans

Lisans koşulları için depodaki `LICENSE` dosyasını inceleyin.

---

**Serula Nesting Pro — 2D yerleşim ve üretim hazırlık aracı.**
