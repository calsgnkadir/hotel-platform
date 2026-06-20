// k6 baseline load test — ramp 0→20 VU, hold 3min, ramp down.
//
// Amaç: Normal kullanım yükü altında p50/p95/p99 latency ve hata oranı
// baseline'ı belirlemek. Sonuçlar loadtest/results/baseline.json'a
// yazılır ve BASELINE_RAPORU.md'de referans olarak tutulur.
//
// Çalıştırma:
//   k6 run --out json=loadtest/results/baseline.json loadtest/baseline.js
//
// FAZ H.5 — production hardening baseline.

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Trend, Counter } from 'k6/metrics'

const BASE = __ENV.BASE_URL || 'http://localhost:8080'

const listingsLatency  = new Trend('latency_listings',  true)
const healthLatency    = new Trend('latency_health',    true)
const errors           = new Counter('app_errors')

export const options = {
  // Stages: yumuşak ramp, 3 dakika sürdür, sonra düşür
  stages: [
    { duration: '30s', target: 5  },     // warm-up
    { duration: '30s', target: 20 },     // ramp to 20
    { duration: '3m',  target: 20 },     // hold
    { duration: '30s', target: 0  },     // ramp down
  ],
  thresholds: {
    http_req_failed:    ['rate<0.02'],   // <%2 hata
    http_req_duration:  ['p(95)<800', 'p(99)<1500'],
    latency_listings:   ['p(95)<700'],
    checks:             ['rate>0.98'],
  },
  // Sonuç klasör default tag
  tags: { suite: 'baseline' },
}

export default function () {
  group('public read traffic', function () {
    const health = http.get(`${BASE}/actuator/health`, { tags: { name: 'health' } })
    check(health, { 'health 200': (r) => r.status === 200 }) || errors.add(1)
    healthLatency.add(health.timings.duration)

    sleep(0.2)

    const listings = http.get(`${BASE}/api/listings?page=0&size=20`,
      { tags: { name: 'listings' } })
    const ok = check(listings, {
      'listings 200':      (r) => r.status === 200,
      'listings json arr': (r) => r.body && (r.body.startsWith('[') || r.body.indexOf('"content"') !== -1),
    })
    if (!ok) errors.add(1)
    listingsLatency.add(listings.timings.duration)
  })

  // Gerçek kullanıcı düşünme süresi
  sleep(Math.random() * 2 + 0.5)
}
