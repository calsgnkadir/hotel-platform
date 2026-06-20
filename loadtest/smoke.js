// k6 smoke test — 1 VU, 60s.
//
// Amaç: Basic sanity. Endpoint'ler erişilebilir mi, response 200 mü,
// p95 < 500ms mi. CI'ya konabilecek hafif test.
//
// Çalıştırma:
//   k6 run loadtest/smoke.js
//   k6 run --out json=loadtest/results/smoke.json loadtest/smoke.js
//
// FAZ H.5 — production hardening baseline.

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend } from 'k6/metrics'

const BASE = __ENV.BASE_URL || 'http://localhost:8080'

// Custom metric — sadece /api/listings için ayrı trend
const listingsLatency = new Trend('listings_latency', true)

export const options = {
  vus: 1,
  duration: '60s',
  thresholds: {
    http_req_failed:   ['rate<0.01'],        // <%1 hata
    http_req_duration: ['p(95)<500'],         // p95 < 500ms
    listings_latency:  ['p(95)<400'],
    checks:            ['rate>0.99'],         // %99+ check başarısı
  },
}

export default function () {
  // 1. Liveness
  const health = http.get(`${BASE}/actuator/health`, { tags: { name: 'health' } })
  check(health, {
    'health 200':     (r) => r.status === 200,
    'health UP':      (r) => r.body && r.body.indexOf('"UP"') !== -1,
  })

  // 2. Public listings (en sık endpoint)
  const listings = http.get(`${BASE}/api/listings?page=0&size=20`,
    { tags: { name: 'listings' } })
  check(listings, {
    'listings 200':       (r) => r.status === 200,
    'listings has body':  (r) => r.body && r.body.length > 0,
  })
  listingsLatency.add(listings.timings.duration)

  // 3. KVKK page (frontend static) — atlandı; backend testimiz
  sleep(1)
}
