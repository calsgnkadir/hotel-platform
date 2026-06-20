# Load Testing — k6

FAZ H.5 production hardening baseline. Hedef: normal kullanım altında latency dağılımını ve hata oranını ölç, regresyon penceresi oluştur.

## Önkoşul

- k6 v0.50+ (`winget install GrafanaLabs.k6` veya `brew install k6`)
- Backend ayakta (`http://localhost:8080`)
- MySQL'de demo seed data (`SPRING_PROFILES_ACTIVE=demo` ile ayağa kaldır)

## Senaryolar

| Dosya         | Pattern                              | Süre  | Amaç                              |
|---------------|--------------------------------------|-------|-----------------------------------|
| `smoke.js`    | 1 VU sabit                           | 60 s  | Sanity, CI gate                   |
| `baseline.js` | Ramp 5→20 VU, hold 3 m, ramp down 0 | ~4.5 m | Üretim trafiği baseline           |

## Çalıştırma

```bash
# Smoke (hızlı kontrol)
k6 run loadtest/smoke.js

# Baseline (sonuç JSON'a)
k6 run --out json=loadtest/results/baseline.json loadtest/baseline.js

# Farklı host
BASE_URL=https://staging.example.com k6 run loadtest/baseline.js
```

## Threshold'lar (smoke.js)

- `http_req_failed < 1%`
- `p(95) < 500 ms`
- `listings_latency p(95) < 400 ms`
- `checks > 99%`

## Threshold'lar (baseline.js)

- `http_req_failed < 2%`
- `p(95) < 800 ms`, `p(99) < 1500 ms`
- `latency_listings p(95) < 700 ms`
- `checks > 98%`

## Test edilen endpoint'ler

- `GET /actuator/health` — liveness
- `GET /api/listings?page=0&size=20` — en sık public read

Auth-gated endpoint'ler şu an kapsam dışı. İleride login flow + Idempotency-Key header'lı `POST /api/applications` eklenecek (FAZ H.5 v2).

## Baseline raporu

Sonuçlar [BASELINE_RAPORU.md](BASELINE_RAPORU.md) altında, ölçüm tarihi ve donanımla birlikte tutulur.
