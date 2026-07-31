# Health Check

Bu dosya `Health Check` workflow'unun (`.github/workflows/daily-health-check.yml`)
çıktısını tutar: uptime + auth smoke testi + endpoint sentinel.

**Durum:** Otomatik günlük kontrol şu an **kapalı**. Barındırma denemesi (Railway)
sona erdiği için hedeflenen backend adresi ölü; cron her sabah 404 dolu bir rapor
üretip repoya commit atıyordu. Workflow duruyor ve elle tetiklenebiliyor
(Actions → Health Check → Run workflow).

Backend Fly.io'ya alınıp `BACKEND_URL` secret'i güncellendiğinde workflow'daki
`schedule` bloğu geri açılacak ve raporlar buradan devam edecek.

Projeyi çalışır görmek için: [README → Hızlı Başlangıç (Docker)](README.md#hızlı-başlangıç-docker)

---
