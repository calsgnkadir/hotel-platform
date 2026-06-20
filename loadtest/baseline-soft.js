// k6 baseline-soft — rate limiter ALTINDA gerçek throughput ölçümü.
//
// İlk baseline.js (20 VU) anonymous IP rate limiter'ı tetikledi
// (~%94 429). Bu dosya 3 VU ile sub-limit bölgede çalışır:
// "normal trafik altında p50/p95/p99 latency baseline"
//
// FAZ H.5

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Trend, Counter } from 'k6/metrics'

const BASE = __ENV.BASE_URL || 'http://localhost:8080'
const listingsLatency = new Trend('latency_listings', true)
const healthLatency   = new Trend('latency_health',   true)
const errors          = new Counter('app_errors')

export const options = {
  stages: [
    { duration: '15s', target: 1 },
    { duration: '15s', target: 3 },
    { duration: '2m',  target: 3 },     // hold 3 VU
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_failed:    ['rate<0.02'],
    http_req_duration:  ['p(95)<500', 'p(99)<1000'],
    latency_listings:   ['p(95)<500'],
    checks:             ['rate>0.98'],
  },
  tags: { suite: 'baseline-soft' },
}

export default function () {
  group('public read traffic', function () {
    const health = http.get(`${BASE}/actuator/health`, { tags: { name: 'health' } })
    check(health, { 'health 200': (r) => r.status === 200 }) || errors.add(1)
    healthLatency.add(health.timings.duration)

    sleep(0.5)

    const listings = http.get(`${BASE}/api/listings?page=0&size=20`,
      { tags: { name: 'listings' } })
    const ok = check(listings, {
      'listings 200':      (r) => r.status === 200,
      'listings has body': (r) => r.body && r.body.length > 0,
    })
    if (!ok) errors.add(1)
    listingsLatency.add(listings.timings.duration)
  })

  sleep(Math.random() * 1.5 + 0.5)
}
