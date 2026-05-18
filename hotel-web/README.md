# Hotel Student Platform — Web (React)

Spring Boot backend ile konuşan React uygulaması.

## Kurulum

```bash
cd hotel-web
npm install
```

## Çalıştırma (geliştirme)

**Önce backend'i başlat** — Spring Boot 8080 portunda çalışıyor olmalı.

Sonra ayrı bir terminalde:

```bash
npm run dev
```

Tarayıcıda aç: `http://localhost:5173`

## Yapı

```
src/
├── api/            API client, JWT interceptor, endpoint fonksiyonları
│   ├── client.js   Axios instance — her istekte token otomatik eklenir
│   └── auth.js     login, register
├── components/
│   ├── DashboardLayout.jsx   Üst bar + logout
│   └── ProtectedRoute.jsx    Giriş kontrolü, rol kontrolü
├── context/
│   └── AuthContext.jsx       Global auth state
├── pages/
│   ├── auth/
│   │   ├── LoginPage.jsx
│   │   └── RegisterPage.jsx
│   ├── student/
│   │   └── StudentDashboard.jsx
│   └── hotel/
│       └── HotelDashboard.jsx
├── App.jsx         Router
├── main.jsx        React root
└── index.css       Tailwind + global stil
```

## Nasıl çalışır

1. Kullanıcı login olunca backend JWT token döner
2. Token `localStorage`'a kaydedilir
3. Axios interceptor her istekte `Authorization: Bearer {token}` ekler
4. Token expire olursa (401) kullanıcı otomatik login'e yönlendirilir
5. Vite proxy `/api/*` isteklerini backend'e yönlendirir — CORS sorunu yok

## Sonraki adım

- Öğrenci paneli: otel listesi, başvuru formu (haftalık müsaitlik takvimi), belge yükleme
- Otel paneli: başvuru tablosu, inceleme akışı, belge talep etme
