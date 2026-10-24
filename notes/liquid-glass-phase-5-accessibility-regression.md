# Liquid Glass — Aşama 5: Erişilebilirlik ve regresyon

**Dal:** `feat/liquid-glass-phase-5-final-main`  
**Temel:** Güncel `main` (Aşama 4 dahil)  
**Kapsam:** Görsel erişilebilirlik ve kaynak testleri; uygulama mantığı değiştirilmez.

## Kontroller

- Klavye ile gezinmede görünür odak halkası.
- `prefers-reduced-motion` ayarına saygı.
- Yüksek kontrast ve Windows forced-colors modlarında kenarlık/odak yedekleri.
- Bu davranışları doğrulayan kaynak testleri.

## Son yayın kapısı

- CI/build/test sonuçları başarılı olmalı.
- Ana dala birleştirmeden önce diff ve çakışmalar gözden geçirilmeli.
- Canlı dağıtım sonrası masaüstü ve dar ekranlarda Yönetim, Workspace ve Görünüm kontrol edilmeli.
- Canlı site testi doğrulanmadan yayın başarılı sayılmaz.
