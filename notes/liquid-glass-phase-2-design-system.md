# Liquid Glass — Aşama 2: Ortak Tasarım Sistemi

**Dal:** `feat/liquid-glass-phase-2-design-system`  
**Temel dal:** `main`  
**Durum:** İlk ortak tasarım katmanı eklendi; yerel derleme/test çalıştırması bu ortamda yapılmadı. Canlı siteye yayın yapılmadı.

## Eklenenler

- `web/src/liquid-glass.css`: Liquid Glass'a benzer web yüzeyleri, ortak hareket/yarıçap token'ları ve çizim araçları için hover/active/focus durumları.
- `web/src/main.tsx`: yeni katmanı mevcut `premium-theme.css` sonrasında yükler.
- `web/tests/liquid-glass.test.ts`: katmanın yükleme sırası, kapsamı, araç kontrollerinin durumları ve erişilebilirlik alternatifleri için kaynak testleri.

## Tasarım kararları

1. Cam efekti yalnızca üst gezinme, admin üst çubuğu, çizim araçları grubu ve açılır yakalama/menü yüzeylerinde kullanılır.
2. Admin kartları, metrikler, kullanıcı satırları ve tablolar opak/okunabilir kalır.
3. Renk token'ları mevcut tema değişkenlerinden türetilir; bu ilk geçişte mevcut marka rengi veya kullanıcının görünüm tercihleri değiştirilmez.
4. Blur için WebKit ve standart özellikler birlikte tanımlanır.
5. `prefers-reduced-motion`, `prefers-contrast: more` ve `forced-colors: active` durumları için alternatifler eklenir.
6. Uygulama mantığına, API'lere, yetkilere, yerleşim/geometry motoruna, nesting işlemlerine veya veri saklamaya dokunulmaz.

## Bu aşamada henüz tamamlanmamış işler

- CSS dosyaları arasında renk ve yüzey token'larının nihai sahipliğini belirlemek. Mevcut `styles.css`, `premium-theme.css` ve `vision.css` aynı bazı token'ları yeniden tanımlıyor; mevcut davranışı bilmeden bunları tek noktada birleştirmek risklidir.
- Görsel karşılaştırma: açık/koyu/system teması, admin, dar pencere ve mobil düzen.
- `npm run source:check`, `npm run typecheck`, `npm test`, `npm run build` ve mümkünse `npm run test:e2e` çalıştırmak.
- Kontrollerin görsel durumlarını ve kullanıcı tarafından kaydedilen özel görünüm ayarlarını doğrulamak.

## Kabul ölçütleri

- Yeni CSS mevcut işlevleri ve tema seçimini değiştirmemeli.
- Admin veri alanları ve çizim tuvali bulanıklıkla örtülmemeli.
- Klavye odağı görünür kalmalı.
- Azaltılmış hareket, yüksek kontrast ve Windows zorunlu renk modlarında kullanılabilirlik korunmalı.
- Test/derleme sonuçları doğrulanmadan değişiklikler `main` dalına birleştirilmemeli.

## Güncel sonuç

İkinci aşamanın başlangıç tasarım katmanı ve testleri geliştirme dalına kaydedildi. İlk GitHub Actions doğrulama koşusu (commit `912b6c23b1f5e98f382efd0dbe1e77387af0d3e9`) başarılı tamamlandı; daha sonra eklenen hover/active/focus düzeltmeleri için yeni commit üzerinde ayrı bir CI sonucu henüz doğrulanmadı. Bu nedenle sonuç, tüm son değişikliklerin geçtiği anlamına gelmez. Bu henüz tamamlanmış ve yayına hazır bir Liquid Glass dönüşümü değildir; kalan token denetimi ve son commit doğrulaması tamamlanmalıdır.
