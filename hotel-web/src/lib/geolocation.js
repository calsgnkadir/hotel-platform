/**
 * FAZ 2/#21 — Geolocation helper.
 *
 * Browser geolocation API'sini Promise tabanli bir wrapper'a sarar.
 * Hata mesajlarini Turkce + actiklayici hale getirir.
 */

export function isGeolocationSupported() {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      return reject(new Error('Tarayicin konum bilgisini desteklemiyor'))
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: Number(pos.coords.latitude.toFixed(7)),
        lng: Number(pos.coords.longitude.toFixed(7)),
        accuracyMeters: Math.round(pos.coords.accuracy || 0),
      }),
      (err) => {
        const msg = {
          1: 'Konum izni reddedildi — Tarayici izinlerinden Konumu "Izin Ver" yap',
          2: 'Konum belirlenemiyor — GPS aktif mi? Acik alanda dene',
          3: 'Konum istegi zaman asimina ugradi — tekrar dene',
        }[err.code] || ('Konum hatasi: ' + err.message)
        reject(new Error(msg))
      },
      {
        enableHighAccuracy: true,   // GPS chip aktif
        timeout: 15000,
        maximumAge: 0,              // taze konum iste
        ...options,
      }
    )
  })
}
