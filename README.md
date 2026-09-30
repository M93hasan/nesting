# Serula Nesting

**Web tabanlı DXF otomatik yerleştirme ve malzeme optimizasyon uygulaması.**

Serula Nesting; özellikle **ayakkabı üretiminde kullanılan suni deri rulo ve plaka malzemeler** üzerinde DXF parçalarını mümkün olduğunca verimli yerleştirmek için geliştirilmektedir. Amaç, kesim kurallarını korurken malzeme tüketimini ve fireyi azaltmaktır.

🌐 **Uygulama:** https://serula.site/  
📦 **Güncel sürüm:** **0.0.13**

## Özellikler

- DXF dosyalarını içe aktarma
- Gerçek parça geometrisine göre 2D nesting
- Rulo ve plaka malzeme seçenekleri
- Çoklu plaka yerleşimi
- Sağ alt / sağ üst başlangıç yönü seçimi
- Malzeme genişliği ve plaka ölçüsü ayarları
- Parça adetleri ve dönüş açıları
- Parçalar arası boşluk ayarı
- Otomatik yerleştirme ve manuel düzenleme
- Yerleşim sonucunu görsel olarak kontrol etme
- **DXF çıktı alma**
- WebAssembly tabanlı yüksek performanslı hesaplama
- Ayrı WASM build akışı ve yeniden kullanılabilir build çıktıları
- `/admin` yönetim arayüzü
- Web Worker desteği sayesinde yerleştirme sırasında arayüzün kullanılabilir kalması

## Kullanım Amacı

Projenin ana kullanım alanı ayakkabı üretimidir. Özellikle suni deri ve benzeri malzemelerde farklı şekil ve ölçülerdeki parçaların rulo veya plaka üzerine daha verimli yerleştirilmesi hedeflenmektedir.

Serula Nesting geliştirilirken şu konular önceliklidir:

- Daha düşük fire
- Gerçek DXF geometrisinin korunması
- Küçük parçaların uygun boşluklarda değerlendirilmesi
- Kesim yönü ve izin verilen dönüşlerin korunması
- Rulo ve plaka çalışma biçimlerinin desteklenmesi
- Üretimde kullanılabilecek temiz DXF çıktısı

## Teknoloji

Arayüz **React + TypeScript + Vite** ile geliştirilmiştir. Yerleştirme motoru Rust tabanlıdır ve tarayıcıda **WebAssembly (WASM)** üzerinden çalışır. Hesaplama işlemleri Web Worker üzerinde yürütülür.

Ana web uygulaması `web/` klasöründedir.

## Geliştirme

```bash
cd web
npm ci
npm run dev
```

Üretim derlemesi:

```bash
npm run build
```

Test:

```bash
npm test
```

## Yayınlama

Proje GitHub üzerinden yönetilir ve üretim sitesi **Cloudflare Workers** altyapısında yayınlanmak üzere yapılandırılmıştır.

Cloudflare build ayarları:

```text
Production branch: main
Build command: bash web/scripts/build-cloudflare.sh
Deploy command: cd web && npx --yes wrangler@4 deploy
Version command: cd web && npx --yes wrangler@4 versions upload
Root directory: (boş)
```

Ana domain:

**https://serula.site/**

## Proje Sahibi

**Muhammet Hasanoğlu**

İletişim:

- E-posta: m93hasan@gmail.com
- Telefon: +90 539 348 06 22

## Açık Kaynak Bileşenler

Serula Nesting çeşitli açık kaynak kütüphane ve algoritmalardan yararlanır. Kullanılan üçüncü taraf bileşenlerin lisans ve atıfları kendi koşullarına tabidir. Ayrıntılar için `web/public/THIRD_PARTY_NOTICES.txt` dosyasına bakılabilir.

## Lisans

Bu repository'deki lisans koşulları için [LICENSE](LICENSE) dosyasına bakın.

---

**Serula Nesting — DXF yerleştirme ve malzeme optimizasyonu.**
