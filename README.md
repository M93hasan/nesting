# Serula Nesting Pro

Serula, kesilecek parçaları rulo veya plaka üzerine yerleştiren tarayıcı tabanlı bir CAD uygulamasıdır. Bir DXF çizimini açabilir, her parçadan kaç adet kesileceğini belirleyebilir ve doğrulanmış yerleşimi DXF olarak indirebilirsin. Yerleştirme hesabı tarayıcıda, Rust ve WebAssembly ile çalışan Sparrow motorunda yapılır.

[Uygulamayı aç](https://serula.site/) · [Yönetim paneli](https://serula.site/admin) · [Sorun bildir](https://github.com/M93hasan/nesting/issues)

## Çizimden üretim DXF’ine

1. **Çizimi aç.** DXF, SVG veya PLT/HP-GL dosyasını içe aktar. Önizlemede ölçü birimini, DXF katmanlarını, iç boşlukları ve varsa geçersiz kontur uyarılarını kontrol et.
2. **Malzemeyi tanımla.** Rulo için genişliği, plaka için genişlik ve uzunluğu gir. Parça adetlerini, aralığı ve izin verilen dönüşleri ayarla.
3. **Yerleşimi çalıştır.** Rulo modunda motor kullanılan uzunluğu azaltmaya çalışır. Plaka modunda tek plakaya sığmayan kopyalar sonraki plakalar için çözülür.
4. **Sonucu kontrol et ve indir.** Geçerli yerleşimi seçip **DXF İndir** düğmesini kullan. Çoklu plaka çıktısında plakalar tek DXF içinde yatayda 50 mm aralıkla dizilir. Her parçanın plaka içindeki konumu, ölçeği ve yönü korunur.

DXF indirme için hesap ve dışa aktarma yetkisi gerekir. Çalışmaya daha sonra devam etmek için proje arşivini indir. Tarayıcıdaki kurtarma kaydı aynı cihaz ve siteye bağlıdır.

## Yönetim ve hesaplar

Yeni kullanıcılar kayıt sırasında e-postalarına gelen altı haneli kodu girer. Yönetim panelinden kullanıcılar, kullanım hakları ve lisans süreleri yönetilir. **Tasarım Editörünü Aç** düğmesiyle yönetici, çalışma alanına metin, görsel veya düğme ekleyebilir, taslağı önizleyebilir ve kaydedilen bir sürümü yayımlayabilir. [E-posta doğrulama akışı](docs/registration-email-otp.md)

## Yerelde çalıştırma

CI ile aynı ortamı kullanmak için Node.js 22 ve npm kurulu olmalıdır. Normal geliştirme ve derleme, depodaki hazır WASM dosyalarını kullanır.

```sh
git clone https://github.com/M93hasan/nesting.git
cd nesting/web
npm ci
npm run dev
```

Terminalde yazan yerel adresi aç. Aşağıdaki komutları da `web/` dizininde çalıştır. Derleme, testlerde kullanılan örnek DXF kataloğunu üretir ve hazır WASM dosyalarını doğrular.

```sh
npm run build
npm test
```

Tarayıcı üzerinden temel iş akışını kontrol etmek için:

```sh
npx playwright install chromium
npx playwright test tests/critical-smoke.spec.ts --project=chromium
```

## Depoda neler var?

| Konum | İçerik |
|---|---|
| [web/src](web/src) | React ve TypeScript arayüzü, içe aktarma, geometri doğrulama ve tarayıcı worker’ları |
| [web/wasm](web/wasm) | Sparrow bağlantısı, Rust araç zinciri ve hazır WASM paketleri |
| [web/worker](web/worker) | Cloudflare Worker API’si, hesaplar, dışa aktarma yetkisi ve tasarım yayını |
| [web/tests](web/tests) | Geometri, dosya biçimleri, hesaplar ve tarayıcı iş akışları için testler |
| [integrations/windows](integrations/windows) | Windows ve CorelDRAW entegrasyonu |

Dosya biçimlerinin sınırları ve WASM derleme ayrıntıları için [teknik kılavuza](web/README.md) bak. Uygulama sürümü [web/package.json](web/package.json) dosyasında tutulur. [GitHub Actions](https://github.com/M93hasan/nesting/actions) derleme ve test sonuçlarını, [Deployments](https://github.com/M93hasan/nesting/deployments) GitHub’a bildirilen dağıtımları gösterir.

## Lisans ve iletişim

[MIT lisansı](LICENSE) · [Üçüncü taraf bildirimleri](web/public/THIRD_PARTY_NOTICES.txt) · [Sparrow yerleştirme motoru](https://github.com/JeroenGar/sparrow)

Geliştirici: [Muhammet Hasanoğlu](https://github.com/M93hasan) · [m93hasan@gmail.com](mailto:m93hasan@gmail.com)
