# Serula Nesting — Web uygulaması

Bu klasör **Serula Nesting Pro** uygulamasının React/TypeScript istemcisini, Cloudflare Worker sunucusunu, Rust/WASM yerleştirme motorunu ve testlerini içerir.

**Tam ve güncel ürün/kurulum belgesi:** [Kök README](../README.md).

> Bu dosya, geçmişten kalan Sparrow Studio demo ve GitHub Pages talimatlarının yerini almıştır. Üretim adresi **https://serula.site**, dağıtım Cloudflare Git entegrasyonudur; bu projede *.github/workflows/pages.yml* iş akışı test/doğrulama içindir.

## Başlangıç

~~~bash
cd web
npm ci
npm run dev
~~~

## Sık kullanılan komutlar

| Komut | İşlev |
|---|---|
| npm run dev | Vite yerel geliştirme |
| npm run typecheck | TypeScript kontrolü |
| npm test | Vitest testleri |
| npm run build | Üretim kontrolü + Vite derlemesi |
| npm run preview | Derlenmiş üretim önizlemesi |
| npm run test:e2e | Build + Playwright testleri |
| npm run wasm:verify | Önceden üretilmiş WASM dosyalarının doğrulaması |
| npm run wasm:build | Rust kaynağından dört WASM paketinin derlenmesi |

WASM yeniden derleme: nightly-2026-08-30, wasm32-unknown-unknown, rust-src, wasm-pack 0.15.0. Ayrıntılar [build-wasm.mjs](scripts/build-wasm.mjs).

## Dizinler

- **src/** — React UI, geometri hazırlığı, import/export, workers, tarayıcı kayıt
- **worker/** — Cloudflare auth/admin/proje/transfer API
- **wasm/** — Sparrow/Jagua Rust wrapper ve WASM paketleri
- **public/** — statik kaynaklar, örnekler ve lisans bildirimleri
- **tests/** — Vitest ve Playwright kapsamı
- **scripts/** — kaynak doğrulama, WASM ve test DXF katalog işlemleri
- **wrangler.jsonc** — Cloudflare Worker/D1/statik varlık yapılandırması

## Önemli sınırlar

- **Bu klasör Windows PC kurulumunun kaynak deposu değildir.** PC sürümü [ayrı repodadır](https://github.com/M93hasan/serula-nesting-pro-pc).
- Tarayıcıdan Windows uygulamalarına aktarım için **[integrations/windows](../integrations/windows/README.md)** yerel köprüsü gerekir.
- Kullanıcı hesabı, geçmiş ve export yetkileri Cloudflare API gerektirir; Vite tek başına üretim D1 hesabını sağlamaz.
- DXF içe aktarma/dışa aktarma tüm CAD entity çeşitlerini garanti etmez; üretimde gerçek ölçüyü kontrol edin.
- GitHub PR kontrolleri geçse bile canlı Cloudflare yayınını ayrıca doğrulayın.

**Sürüm kaynağı:** [package.json](package.json) · **Ana dokümantasyon:** [../README.md](../README.md).
