# FAZ H.5 — k6 Yük Testi Baseline Raporu

**Tarih:** 2026-06-21
**Donanım:** Windows 11, geliştirici makinası (localhost backend + MySQL)
**Backend:** Spring Boot 3.2.5, dev profili, `http://localhost:8080`
**Araç:** k6 v2.0.0

---

## 1. Yönetici Özeti

Backend **tek kullanıcı altında çok hızlı** (`p95 = 42 ms`, `0 hata`). Eşzamanlı 3 anonymous istemci bile `~%54 oranında 429` ile reddediliyor — yani **FAZ D.1 rate limiter agresif çalışıyor**. Bu güvenlik açısından *iyi*, ama public read endpoint'lerinin rate limit politikasının gözden geçirilmesi gerekiyor.

## 2. Çalıştırılan Senaryolar

| Senaryo         | VU profili          | Süre  | Sonuç                          |
|-----------------|---------------------|-------|--------------------------------|
| `smoke.js`      | 1 VU sabit          | 60 s  | **✅ Pass** (tüm threshold'lar) |
| `baseline.js`   | 5→20 VU ramp + hold | ~4.5 m| ❌ %94 429 — rate limit         |
| `baseline-soft.js` | 1→3 VU + hold    | ~3 m  | ❌ %54 429 — rate limit         |

## 3. Smoke Test Sonuçları (Baseline kabul edilen)

**Test edilen endpoint'ler:** `GET /actuator/health`, `GET /api/listings?page=0&size=20`

| Metrik                       | Değer       | Threshold | Durum |
|------------------------------|-------------|-----------|-------|
| `http_req_failed`            | 0.00%       | < 1%      | ✅    |
| `http_req_duration` p50      | 21.48 ms    | —         |       |
| `http_req_duration` p95      | **41.89 ms**| < 500 ms  | ✅    |
| `http_req_duration` p99      | ~50 ms      | —         |       |
| `latency_listings` p95       | **69.25 ms**| < 400 ms  | ✅    |
| `latency_listings` max       | 521 ms      | —         | (cold-start)|
| `checks_succeeded`           | 100.00% (228/228) | > 99% | ✅ |
| `http_reqs`                  | 114 / 60s = **1.9 RPS** | — | |
| `data_received`              | 885 KB      | —         |       |

**Sonuç:** Tek kullanıcı altında backend latency profili güvenli aralıkta. p95 < 100 ms, hata yok. Bu değer **regresyon penceresi referansı** olarak kayıt altına alındı.

## 4. Baseline 20 VU — Rate Limit Tespiti

20 anonim VU 3 dakika sürekli istek:

| Metrik                       | Değer       |
|------------------------------|-------------|
| `http_req_failed`            | **94.25%**  |
| `app_errors`                 | 4811        |
| `http_req_duration` p95      | 5 ms (✗ çoğu 429 — hızlıca rejected) |
| `expected_response:true` p95 | 26.45 ms    |
| `http_reqs`                  | 5104 / 270s = **18.9 RPS** |

**Yorum:** Rate limiter (FAZ D.1 `RateLimitingFilter`) anonymous IP başına çok düşük bir kotada — 20 paralel istemci ~5 RPS'i geçince hemen reject. p95'in 5 ms olması "filtre erken kapıyor" anlamına geliyor; latency değil throttle sonucu.

## 5. Baseline-soft 3 VU — Limit Bordürü

3 VU ile bile %54 reject:

| Metrik                       | Değer       |
|------------------------------|-------------|
| `http_req_failed`            | **54.45%**  |
| `latency_listings` p95       | 23.09 ms    |
| `expected_response:true` p95 | 23.83 ms    |
| `http_reqs`                  | 494 / 165s = **3 RPS** |

**Yorum:** Anonymous IP başına izin verilen RPS **~1 req/s** civarında. Tek bir SPA istemcinin bir sayfada 2-3 endpoint çağırdığını düşünürsek, normal kullanıcı bile ilk sayfa yüklemesinde kotaya çarpıyor olabilir.

## 6. Aksiyon Önerileri

| Öncelik | Aksiyon |
|---------|---------|
| **YÜKSEK** | `GET /api/listings`, `GET /actuator/health`, `GET /api/businesses/*` gibi public **read** endpoint'lerine ayrı (daha gevşek) rate limit tier'ı tanımla — yazma operasyonları sıkı kalsın. |
| **ORTA**  | Frontend'de `Cache-Control: max-age` header'larını kullan + React Query `staleTime` yükselt → aynı endpoint'e arka arkaya istek atmayalım. |
| **DÜŞÜK** | Authenticated user için ayrı k6 senaryosu (JWT login + protected endpoint'ler) — FAZ H.5 v2. |
| **DÜŞÜK** | k6'yı GitHub Actions'a `smoke.js` ile CI gate olarak ekle (PR başına 60s, threshold ihlali → ❌). |

## 7. Threshold Referansları (Regresyon Penceresi)

Bundan sonra her PR için **smoke testi** bu threshold'larla geçmek zorunda:

```
http_req_failed   < 1%
http_req_duration p95 < 500 ms
listings_latency  p95 < 400 ms
checks            > 99%
```

p95'in **100 ms'den 500 ms'ye** sıçraması bile inceleme tetikler.

## 8. Tekrar Üretim

```bash
# 1. Backend ayağa kalksın
cd hotelapp && ./mvnw spring-boot:run

# 2. k6 kur
winget install GrafanaLabs.k6   # veya brew install k6

# 3. Smoke
k6 run loadtest/smoke.js

# 4. Tam baseline (rate-limit görmek için)
k6 run --out json=loadtest/results/baseline.json loadtest/baseline.js
k6 run --out json=loadtest/results/baseline-soft.json loadtest/baseline-soft.js
```

## 9. Bağlantılar

- [`loadtest/smoke.js`](smoke.js)
- [`loadtest/baseline.js`](baseline.js)
- [`loadtest/baseline-soft.js`](baseline-soft.js)
- [`loadtest/results/smoke.summary.json`](results/smoke.summary.json)
- [`loadtest/results/baseline.summary.json`](results/baseline.summary.json)
- [`loadtest/results/baseline-soft.summary.json`](results/baseline-soft.summary.json)
- FAZ D.1 — `hotelapp/src/main/java/com/hotelapp/security/RateLimitingFilter.java`
