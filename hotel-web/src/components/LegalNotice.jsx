/**
 * FAZ C.3 — Şeffaflık / hukuki konumlandırma metinleri.
 *
 * ⚠️ HUKUK GÖRÜŞÜ GEREKLİ (FAZ 0): Aşağıdaki metinler platformun konumunu
 * ("aracı eşleştirme platformu, işveren değil") makul ve olgusal biçimde
 * ifade eden TASLAKLARDIR. Kesin ifade — özellikle ÖİB (Özel İstihdam
 * Bürosu) mevzuatı ve SGK yükümlülükleri — avukat onayından geçmelidir.
 * Metinler tek dosyada toplandı ki hukukçu tek yerden düzenleyebilsin.
 *
 * Emoji kullanılmaz (proje kuralı) — SVG ikon + metin.
 */

const InfoIcon = ({ color = 'currentColor' }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color}
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
       className="flex-shrink-0 mt-0.5" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
)

/**
 * İşletmeye: kabul edilen aday için SGK işe giriş bildirgesi yükümlülüğü.
 * Kabul akışında (ApplicationDetail) gösterilir.
 */
export function SgkNotice() {
  return (
    <div className="rounded-2xl px-4 py-3 flex items-start gap-2.5"
         style={{ background: 'var(--ah-warn-soft)', border: '1px solid var(--ah-warn)' }}>
      <InfoIcon color="#8a5e17" />
      <div>
        <div className="type-body font-semibold" style={{ color: '#8a5e17' }}>
          SGK işe giriş bildirgesi
        </div>
        <div className="type-caption mt-0.5" style={{ color: '#8a5e17' }}>
          Adayı çalıştırmaya başlamadan önce, yasal olarak SGK işe giriş bildirgesini
          vermeniz gerekir. AjansHotel bir eşleştirme platformudur; iş ilişkisi
          doğrudan sizinle aday arasında kurulur ve bu yükümlülük işletmeye aittir.
          Vardiya yaklaştığında size hatırlatma göndeririz.
        </div>
      </div>
    </div>
  )
}

/**
 * Platform konumlandırması: "aracı platform, işveren değil".
 * Hem aday hem işletme tarafında bilgilendirme amaçlı gösterilebilir.
 */
export function PlatformRoleNotice({ audience = 'candidate' }) {
  const text = audience === 'business'
    ? 'AjansHotel, işletmeler ile adayları buluşturan bir eşleştirme platformudur; '
      + 'taraf değildir. İş sözleşmesi, ücret ödemesi, SGK ve diğer yasal yükümlülükler '
      + 'doğrudan işletme ile aday arasındadır.'
    : 'AjansHotel, seni işletmelerle doğrudan buluşturan bir eşleştirme platformudur — '
      + 'aracı komisyonu almaz. İş ilişkisi, ücret ve sigorta işlemleri seninle işletme '
      + 'arasında kurulur.'
  return (
    <div className="flex items-start gap-2 type-caption" style={{ color: 'var(--ah-ink-3)' }}>
      <InfoIcon color="var(--ah-ink-4)" />
      <span>{text}</span>
    </div>
  )
}
