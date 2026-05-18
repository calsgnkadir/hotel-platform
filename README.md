# Hotel Student Platform

Otel ve öğrenciler arasında doğrudan iş birliği sağlayan platform.
Aracı kurumlar olmadan, öğrenciler boş günlerini belirtip otellere direkt başvurabilir.

## Yapı

```
hotel-platform/
├── hotelapp/       Spring Boot backend (Java 17 + MySQL)
├── hotel-web/      React frontend (Vite + Tailwind)
└── README.md       Bu dosya
```

## Gereksinimler

Başlamadan önce bilgisayarında yüklü olması gerekenler:

- **Java 17** veya üzeri — `java -version` ile kontrol et
- **Maven** (IDE içinden de çalışır) — IntelliJ IDEA bunu otomatik sağlar
- **MySQL 8** — `mysql --version`
- **Node.js 18** veya üzeri — `node -v`
- **npm** — Node.js ile birlikte gelir

## Kurulum (3 adım)

### 1. Veritabanını oluştur

MySQL'e bağlan (MySQL Workbench veya komut satırı), şu komutu çalıştır:

```sql
CREATE DATABASE hotel_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_turkish_ci;
```

### 2. Backend'i hazırla

```bash
cd hotelapp
cp .env.example .env
```

Sonra `.env` dosyasını aç ve şu iki değeri doldur:

```
DB_PASSWORD=senin_mysql_şifren
JWT_SECRET=en_az_32_karakterlik_rastgele_bir_metin
```

### 3. Frontend bağımlılıklarını yükle

```bash
cd hotel-web
npm install
```

İlk seferde 1-2 dakika sürer.

## Çalıştırma

**İki ayrı terminal gerekli — iki proje aynı anda çalışmalı.**

### Terminal 1 — Backend

```bash
cd hotelapp

# .env değerlerini yükle (Mac/Linux)
export $(cat .env | xargs)

# Uygulamayı başlat
./mvnw spring-boot:run
```

**Windows PowerShell için:**

```powershell
cd hotelapp
Get-Content .env | ForEach-Object {
  $name, $value = $_.split('=', 2)
  Set-Item -Path "env:$name" -Value $value
}
./mvnw.cmd spring-boot:run
```

**IntelliJ IDEA kullanıyorsan:** projeyi aç, `Run Configuration → Environment Variables` kısmına `.env` içindeki değerleri gir, `HotelStudentPlatformApplication` sınıfını çalıştır. Bu en kolay yol.

Başarılı çalışınca konsolda `Started HotelStudentPlatformApplication` yazar. Backend artık `http://localhost:8080` üzerinden hizmet veriyor.

**Swagger UI:** `http://localhost:8080/swagger-ui.html` — tüm API endpoint'lerini interaktif test edebilirsin.

### Terminal 2 — Frontend

```bash
cd hotel-web
npm run dev
```

Tarayıcıda aç: `http://localhost:5173`

## Nasıl çalışır

```
Tarayıcı (5173)  →  Vite proxy  →  Backend (8080)  →  MySQL
```

Tarayıcı React uygulamasını 5173'ten yüklüyor. Kullanıcı kayıt olduğunda Axios `/api/auth/register` isteği atıyor. Vite bu isteği otomatik olarak 8080'e yönlendiriyor (CORS problemi yaşanmıyor).

Backend isteği alıyor, MySQL'e kaydediyor, JWT token üretip dönüyor. React token'ı `localStorage`'a koyuyor, her sonraki istekte `Authorization: Bearer ...` header'ını otomatik ekliyor.

## Test akışı

1. `http://localhost:5173/register` → öğrenci olarak kayıt ol
2. Otomatik `/student` dashboard'a yönlendirileceksin
3. Çıkış yap, tekrar giriş yap
4. Tarayıcı DevTools → Application → Local Storage → token'ı göreceksin
5. DevTools → Network → `/api/auth/register` isteğinin 8080'e proxy'lendiğini göreceksin

## Yaygın sorunlar

**Backend başlamıyor, `Access denied for user 'root'`**
MySQL şifresini yanlış girmişsin, `.env` dosyasını kontrol et.

**Frontend açılıyor ama kayıt olunca hata**
Backend çalışmıyor olabilir, Terminal 1'e bak. Tarayıcıda F12 → Network sekmesinde kırmızı hata var mı kontrol et.

**Port 8080 already in use**
Başka bir şey o portu kullanıyor. `.env` içinde `SERVER_PORT=8090` yap, sonra `hotel-web/vite.config.js` içinde `target: 'http://localhost:8090'` olarak güncelle.

**Port 5173 already in use**
Vite otomatik olarak 5174'e geçer, terminaldeki URL'ye bak.

**`./mvnw: Permission denied` (Mac/Linux)**
`chmod +x hotelapp/mvnw` çalıştır, sonra tekrar dene.

## API endpointleri özeti

| Endpoint | Metod | Rol | Açıklama |
|----------|-------|-----|----------|
| `/api/auth/register` | POST | - | Kayıt ol |
| `/api/auth/login` | POST | - | Giriş yap |
| `/api/hotels/list` | GET | - | Otel listesi (public) |
| `/api/student/applications` | POST | STUDENT | Başvuru oluştur |
| `/api/student/applications` | GET | STUDENT | Başvurularım |
| `/api/hotel/applications` | GET | HOTEL | Gelen başvurular |
| `/api/hotel/applications/{id}/decide` | PUT | HOTEL | Kabul/Red |
| `/api/documents/upload` | POST | STUDENT | Belge yükle |

Tam liste Swagger UI'da: `http://localhost:8080/swagger-ui.html`

## Sonraki adımlar

- Öğrenci paneli içeriği: otel listesi, başvuru formu, belge yönetimi
- Otel paneli içeriği: başvuru tablosu, inceleme akışı
- Prodüksiyon deploy: Railway/Render (backend) + Vercel (frontend)
