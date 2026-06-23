# Daily Health Check

Otomatik kontrol — her gün 09:07 İstanbul saati (GitHub Actions).
3 fazlı: Uptime + Smoke Test (auth) + Endpoint Sentinel.
En son rapor en üstte.

---

## 2026-06-23 13:00 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.46s |
| Backend OpenAPI | ❌ 404 | 0.25s |
| Backend listings (public) | ❌ 404 | 0.25s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ❌ 404 | 0.28s |
| Authenticated checks | ⏭️ skipped | login başarısız |


**Endpoint Sentinel** — ✅ Tüm 5 endpoint sağlıklı

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | ⚠️ 404 | 0.28s |
| GET /listings (position) | ⚠️ 404 | 0.27s |
| GET /listings (date filter) | ⚠️ 404 | 0.27s |
| GET /v3/api-docs | ⚠️ 404 | 0.27s |
| GET /swagger-ui.html | ⚠️ 404 | 0.25s |


---

## 2026-06-22 15:23 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.31s |
| Backend OpenAPI | ❌ 404 | 0.26s |
| Backend listings (public) | ❌ 404 | 0.27s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ❌ 404 | 0.27s |
| Authenticated checks | ⏭️ skipped | login başarısız |


**Endpoint Sentinel** — ✅ Tüm 5 endpoint sağlıklı

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | ⚠️ 404 | 0.23s |
| GET /listings (position) | ⚠️ 404 | 0.27s |
| GET /listings (date filter) | ⚠️ 404 | 0.25s |
| GET /v3/api-docs | ⚠️ 404 | 0.25s |
| GET /swagger-ui.html | ⚠️ 404 | 0.25s |


---

## 2026-06-21 13:03 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.44s |
| Backend OpenAPI | ❌ 404 | 0.16s |
| Backend listings (public) | ❌ 404 | 0.08s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ❌ 404 | 0.09s |
| Authenticated checks | ⏭️ skipped | login başarısız |


**Endpoint Sentinel** — ✅ Tüm 5 endpoint sağlıklı

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | ⚠️ 404 | 0.08s |
| GET /listings (position) | ⚠️ 404 | 0.06s |
| GET /listings (date filter) | ⚠️ 404 | 0.06s |
| GET /v3/api-docs | ⚠️ 404 | 0.08s |
| GET /swagger-ui.html | ⚠️ 404 | 0.06s |


---

## 2026-06-20 12:36 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.24s |
| Backend OpenAPI | ❌ 000 | 15.00s |
| Backend listings (public) | ❌ 000 | 15.00s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ❌ 502 | 15.13s |
| Authenticated checks | ⏭️ skipped | login başarısız |


**Endpoint Sentinel** — 🚨 5/5 endpoint 5xx döndü

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | 🚨 000 | 10.00s |
| GET /listings (position) | 🚨 000 | 10.00s |
| GET /listings (date filter) | 🚨 000 | 10.00s |
| GET /v3/api-docs | 🚨 000 | 10.00s |
| GET /swagger-ui.html | 🚨 000 | 10.00s |


---

## 2026-06-19 13:56 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.40s |
| Backend OpenAPI | ❌ 000 | 15.00s |
| Backend listings (public) | ❌ 000 | 15.00s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ❌ 502 | 15.09s |
| Authenticated checks | ⏭️ skipped | login başarısız |


**Endpoint Sentinel** — 🚨 5/5 endpoint 5xx döndü

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | 🚨 000 | 10.00s |
| GET /listings (position) | 🚨 000 | 10.00s |
| GET /listings (date filter) | 🚨 000 | 10.00s |
| GET /v3/api-docs | 🚨 000 | 10.00s |
| GET /swagger-ui.html | 🚨 000 | 10.00s |


---

## 2026-06-18 13:47 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.23s |
| Backend OpenAPI | ❌ 000 | 15.00s |
| Backend listings (public) | ❌ 000 | 15.00s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ❌ 502 | 15.15s |
| Authenticated checks | ⏭️ skipped | login başarısız |


**Endpoint Sentinel** — 🚨 5/5 endpoint 5xx döndü

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | 🚨 000 | 10.00s |
| GET /listings (position) | 🚨 000 | 10.00s |
| GET /listings (date filter) | 🚨 000 | 10.00s |
| GET /v3/api-docs | 🚨 000 | 10.00s |
| GET /swagger-ui.html | 🚨 000 | 10.00s |


---

## 2026-06-17 14:17 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.33s |
| Backend OpenAPI | ❌ 000 | 15.00s |
| Backend listings (public) | ❌ 000 | 15.00s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ❌ 502 | 15.11s |
| Authenticated checks | ⏭️ skipped | login başarısız |


**Endpoint Sentinel** — 🚨 5/5 endpoint 5xx döndü

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | 🚨 000 | 10.00s |
| GET /listings (position) | 🚨 000 | 10.00s |
| GET /listings (date filter) | 🚨 000 | 10.00s |
| GET /v3/api-docs | 🚨 000 | 10.00s |
| GET /swagger-ui.html | 🚨 000 | 10.00s |


---

## 2026-06-16 14:31 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.22s |
| Backend OpenAPI | ❌ 502 | 0.25s |
| Backend listings (public) | ❌ 502 | 0.14s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ❌ 502 | 0.14s |
| Authenticated checks | ⏭️ skipped | login başarısız |


**Endpoint Sentinel** — 🚨 5/5 endpoint 5xx döndü

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | 🚨 502 | 0.12s |
| GET /listings (position) | 🚨 502 | 0.13s |
| GET /listings (date filter) | 🚨 502 | 0.13s |
| GET /v3/api-docs | 🚨 502 | 0.11s |
| GET /swagger-ui.html | 🚨 502 | 0.11s |


---

## 2026-06-15 15:39 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.21s |
| Backend OpenAPI | ❌ 404 | 0.99s |
| Backend listings (public) | ❌ 404 | 1.01s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ❌ 404 | 0.94s |
| Authenticated checks | ⏭️ skipped | login başarısız |


**Endpoint Sentinel** — ✅ Tüm 5 endpoint sağlıklı

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | ⚠️ 404 | 0.96s |
| GET /listings (position) | ⚠️ 404 | 1.16s |
| GET /listings (date filter) | ⚠️ 404 | 0.93s |
| GET /v3/api-docs | ⚠️ 404 | 1.05s |
| GET /swagger-ui.html | ⚠️ 404 | 0.95s |


---

## 2026-06-14 12:55 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.30s |
| Backend OpenAPI | ❌ 000 | 15.00s |
| Backend listings (public) | ❌ 000 | 15.00s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ❌ 502 | 15.94s |
| Authenticated checks | ⏭️ skipped | login başarısız |


**Endpoint Sentinel** — 🚨 5/5 endpoint 5xx döndü

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | 🚨 000 | 10.00s |
| GET /listings (position) | 🚨 000 | 10.00s |
| GET /listings (date filter) | 🚨 000 | 10.00s |
| GET /v3/api-docs | 🚨 000 | 10.00s |
| GET /swagger-ui.html | 🚨 000 | 10.00s |


---

## 2026-06-13 12:33 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.30s |
| Backend OpenAPI | ❌ 000 | 15.00s |
| Backend listings (public) | ❌ 000 | 15.00s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ❌ 502 | 15.95s |
| Authenticated checks | ⏭️ skipped | login başarısız |


**Endpoint Sentinel** — 🚨 5/5 endpoint 5xx döndü

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | 🚨 000 | 10.00s |
| GET /listings (position) | 🚨 000 | 10.00s |
| GET /listings (date filter) | 🚨 000 | 10.00s |
| GET /v3/api-docs | 🚨 000 | 10.00s |
| GET /swagger-ui.html | 🚨 000 | 10.00s |


---

## 2026-06-12 13:40 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.43s |
| Backend OpenAPI | ❌ 000 | 15.00s |
| Backend listings (public) | ❌ 000 | 15.00s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ❌ 502 | 15.97s |
| Authenticated checks | ⏭️ skipped | login başarısız |


**Endpoint Sentinel** — 🚨 5/5 endpoint 5xx döndü

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | 🚨 000 | 10.00s |
| GET /listings (position) | 🚨 000 | 10.00s |
| GET /listings (date filter) | 🚨 000 | 10.00s |
| GET /v3/api-docs | 🚨 000 | 10.00s |
| GET /swagger-ui.html | 🚨 000 | 10.00s |


---

## 2026-06-11 13:58 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.21s |
| Backend OpenAPI | ❌ 000 | 15.00s |
| Backend listings (public) | ❌ 000 | 15.00s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ❌ 502 | 15.93s |
| Authenticated checks | ⏭️ skipped | login başarısız |


**Endpoint Sentinel** — 🚨 5/5 endpoint 5xx döndü

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | 🚨 000 | 10.00s |
| GET /listings (position) | 🚨 000 | 10.00s |
| GET /listings (date filter) | 🚨 000 | 10.00s |
| GET /v3/api-docs | 🚨 000 | 10.00s |
| GET /swagger-ui.html | 🚨 000 | 10.00s |


---

## 2026-06-10 13:20 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.30s |
| Backend OpenAPI | ❌ 502 | 0.98s |
| Backend listings (public) | ❌ 502 | 0.95s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ❌ 502 | 0.95s |
| Authenticated checks | ⏭️ skipped | login başarısız |


**Endpoint Sentinel** — 🚨 5/5 endpoint 5xx döndü

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | 🚨 502 | 0.95s |
| GET /listings (position) | 🚨 502 | 0.94s |
| GET /listings (date filter) | 🚨 502 | 0.94s |
| GET /v3/api-docs | 🚨 502 | 0.96s |
| GET /swagger-ui.html | 🚨 502 | 0.95s |


---

## 2026-06-09 13:02 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.33s |
| Backend OpenAPI | ❌ 000 | 15.00s |
| Backend listings (public) | ❌ 000 | 15.00s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ❌ 502 | 15.95s |
| Authenticated checks | ⏭️ skipped | login başarısız |


**Endpoint Sentinel** — 🚨 5/5 endpoint 5xx döndü

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | 🚨 000 | 10.00s |
| GET /listings (position) | 🚨 000 | 10.00s |
| GET /listings (date filter) | 🚨 000 | 10.00s |
| GET /v3/api-docs | 🚨 000 | 10.00s |
| GET /swagger-ui.html | 🚨 000 | 10.00s |


---

## 2026-06-08 14:20 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.39s |
| Backend OpenAPI | ❌ 000 | 15.00s |
| Backend listings (public) | ❌ 000 | 15.00s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ❌ 502 | 15.65s |
| Authenticated checks | ⏭️ skipped | login başarısız |


**Endpoint Sentinel** — 🚨 5/5 endpoint 5xx döndü

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | 🚨 000 | 10.00s |
| GET /listings (position) | 🚨 000 | 10.00s |
| GET /listings (date filter) | 🚨 000 | 10.00s |
| GET /v3/api-docs | 🚨 000 | 10.00s |
| GET /swagger-ui.html | 🚨 000 | 10.00s |


---

## 2026-06-07 12:34 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.29s |
| Backend OpenAPI | ❌ 000 | 15.00s |
| Backend listings (public) | ❌ 000 | 15.00s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ❌ 502 | 15.70s |
| Authenticated checks | ⏭️ skipped | login başarısız |


**Endpoint Sentinel** — 🚨 5/5 endpoint 5xx döndü

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | 🚨 000 | 10.00s |
| GET /listings (position) | 🚨 000 | 10.00s |
| GET /listings (date filter) | 🚨 000 | 10.00s |
| GET /v3/api-docs | 🚨 000 | 10.00s |
| GET /swagger-ui.html | 🚨 000 | 10.00s |


---

## 2026-06-06 11:45 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.32s |
| Backend OpenAPI | ❌ 404 | 0.67s |
| Backend listings (public) | ❌ 404 | 0.68s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ❌ 404 | 0.67s |
| Authenticated checks | ⏭️ skipped | login başarısız |


**Endpoint Sentinel** — ✅ Tüm 5 endpoint sağlıklı

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | ⚠️ 404 | 0.68s |
| GET /listings (position) | ⚠️ 404 | 0.66s |
| GET /listings (date filter) | ⚠️ 404 | 0.67s |
| GET /v3/api-docs | ⚠️ 404 | 0.67s |
| GET /swagger-ui.html | ⚠️ 404 | 0.66s |


---

## 2026-06-05 13:13 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.21s |
| Backend OpenAPI | ✅ 200 | 6.59s |
| Backend listings (public) | ✅ 200 | 1.18s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ✅ 200 | 1.05s |
| Profile (GET /candidate/profile) | ✅ 200 | 1.09s |
| My applications (GET /candidate/applications) | ✅ 200 | 1.10s |


**Endpoint Sentinel** — ✅ Tüm 5 endpoint sağlıklı

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | ✅ 200 | 1.18s |
| GET /listings (position) | ✅ 200 | 1.00s |
| GET /listings (date filter) | ✅ 200 | 1.16s |
| GET /v3/api-docs | ✅ 200 | 1.65s |
| GET /swagger-ui.html | ✅ 200 | 1.05s |


---

## 2026-06-04 23:40 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.20s |
| Backend OpenAPI | ✅ 200 | 3.97s |
| Backend listings (public) | ✅ 200 | 1.03s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ✅ 200 | 1.32s |
| Profile (GET /candidate/profile) | ✅ 200 | 1.19s |
| My applications (GET /candidate/applications) | ✅ 200 | 1.19s |


**Endpoint Sentinel** — ✅ Tüm 5 endpoint sağlıklı

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | ✅ 200 | 1.38s |
| GET /listings (position) | ✅ 200 | 1.34s |
| GET /listings (date filter) | ✅ 200 | 1.21s |
| GET /v3/api-docs | ✅ 200 | 1.56s |
| GET /swagger-ui.html | ✅ 200 | 0.99s |


---

## 2026-06-04 13:11 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.38s |
| Backend OpenAPI | ✅ 200 | 4.99s |
| Backend listings (public) | ✅ 200 | 1.14s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ✅ 200 | 1.46s |
| Profile (GET /candidate/profile) | ✅ 200 | 1.07s |
| My applications (GET /candidate/applications) | ✅ 200 | 0.90s |


**Endpoint Sentinel** — ✅ Tüm 5 endpoint sağlıklı

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | ✅ 200 | 1.03s |
| GET /listings (position) | ✅ 200 | 1.05s |
| GET /listings (date filter) | ✅ 200 | 1.01s |
| GET /v3/api-docs | ✅ 200 | 1.32s |
| GET /swagger-ui.html | ✅ 200 | 0.94s |


---

## 2026-06-03 14:21 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.28s |
| Backend OpenAPI | ✅ 200 | 2.82s |
| Backend listings (public) | ✅ 200 | 0.22s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ✅ 200 | 0.27s |
| Profile (GET /candidate/profile) | ✅ 200 | 0.20s |
| My applications (GET /candidate/applications) | ✅ 200 | 0.20s |


**Endpoint Sentinel** — ✅ Tüm 5 endpoint sağlıklı

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | ✅ 200 | 0.21s |
| GET /listings (position) | ✅ 200 | 0.21s |
| GET /listings (date filter) | ✅ 200 | 0.21s |
| GET /v3/api-docs | ✅ 200 | 0.34s |
| GET /swagger-ui.html | ✅ 200 | 0.19s |


---

## 2026-06-02 13:53 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.37s |
| Backend OpenAPI | ✅ 200 | 2.54s |
| Backend listings (public) | ✅ 200 | 0.34s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ✅ 200 | 0.37s |
| Profile (GET /candidate/profile) | ✅ 200 | 0.24s |
| My applications (GET /candidate/applications) | ✅ 200 | 0.19s |


**Endpoint Sentinel** — ✅ Tüm 5 endpoint sağlıklı

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | ✅ 200 | 0.19s |
| GET /listings (position) | ✅ 200 | 0.20s |
| GET /listings (date filter) | ✅ 200 | 0.16s |
| GET /v3/api-docs | ✅ 200 | 0.21s |
| GET /swagger-ui.html | ✅ 200 | 0.21s |


---

## 2026-06-02 01:27 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.41s |
| Backend OpenAPI | ✅ 200 | 4.63s |
| Backend listings (public) | ✅ 200 | 0.61s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ✅ 200 | 0.47s |
| Profile (GET /candidate/profile) | ✅ 200 | 0.49s |
| My applications (GET /candidate/applications) | ✅ 200 | 0.28s |


**Endpoint Sentinel** — ✅ Tüm 5 endpoint sağlıklı

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | ✅ 200 | 0.25s |
| GET /listings (position) | ✅ 200 | 0.26s |
| GET /listings (date filter) | ✅ 200 | 0.24s |
| GET /v3/api-docs | ✅ 200 | 0.14s |
| GET /swagger-ui.html | ✅ 200 | 0.14s |


---

## 2026-06-02 01:20 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.19s |
| Backend OpenAPI | ✅ 200 | 2.68s |
| Backend listings (public) | ✅ 200 | 0.41s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ✅ 200 | 0.41s |
| Profile (GET /candidate/profile) | ✅ 200 | 0.27s |
| My applications (GET /candidate/applications) | ✅ 200 | 0.20s |


**Endpoint Sentinel** — ✅ Tüm 5 endpoint sağlıklı

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | ✅ 200 | 0.28s |
| GET /listings (position) | ✅ 200 | 0.35s |
| GET /listings (date filter) | ✅ 200 | 0.27s |
| GET /v3/api-docs | ✅ 200 | 0.31s |
| GET /swagger-ui.html | ✅ 200 | 0.18s |


---

## 2026-06-02 01:16 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.36s |
| Backend OpenAPI | ✅ 200 | 2.59s |
| Backend listings (public) | ✅ 200 | 0.42s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ✅ 200 | 0.40s |
| Profile (GET /candidate/profile) | ✅ 200 | 0.18s |
| My applications (GET /candidate/applications) | ✅ 200 | 0.14s |


**Endpoint Sentinel** — ✅ Tüm 0 endpoint sağlıklı

| Check | Status | Time |
|---|---|---|
| GET /listings (no filter) | ✅ 200 | 0.21s |
| GET /listings (position) | ✅ 200 | 0.22s |
| GET /listings (date filter) | ✅ 200 | 0.18s |
| GET /v3/api-docs | ✅ 200 | 0.16s |
| GET /swagger-ui.html | ✅ 200 | 0.10s |


---

## 2026-06-01 14:54 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.41s |
| Backend OpenAPI | ✅ 200 | 2.57s |
| Backend listings (public) | ✅ 200 | 0.44s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ✅ 200 | 0.49s |
| Profile (GET /candidate/profile) | ✅ 200 | 0.35s |
| My applications (GET /candidate/applications) | ✅ 200 | 0.28s |


---

## 2026-06-01 01:14 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.20s |
| Backend OpenAPI | ✅ 200 | 2.80s |
| Backend listings (public) | ✅ 200 | 0.40s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ✅ 200 | 0.46s |
| Profile (GET /candidate/profile) | ✅ 200 | 0.31s |
| My applications (GET /candidate/applications) | ✅ 200 | 0.24s |


---

## 2026-06-01 01:06 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.21s |
| Backend OpenAPI | ✅ 200 | 2.59s |
| Backend listings (public) | ✅ 200 | 0.34s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ❌ 400 | 0.23s |
| Authenticated checks | ⏭️ skipped | login başarısız |


---

## 2026-06-01 01:01 +03

**Uptime**

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.11s |
| Backend OpenAPI | ✅ 200 | 2.39s |
| Backend listings (public) | ✅ 200 | 0.38s |


**Smoke Test** (auth flow)

| Check | Status | Time |
|---|---|---|
| Login (POST /auth/login) | ❌ 400 | 0.23s |
| Authenticated checks | ⏭️ skipped | login başarısız |


---

## 2026-06-01 00:07 +03

| Check | Status | Time |
|---|---|---|
| Frontend (Vercel) | ✅ 200 | 0.28s |
| Backend OpenAPI | ✅ 200 | 3.07s |
| Backend listings (public) | ✅ 200 | 0.51s |

---

