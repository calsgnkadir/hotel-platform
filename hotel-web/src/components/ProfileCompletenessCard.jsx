/**
 * FAZ 1/#34 — Profile Completeness Card
 *
 * Profil ne kadar dolu progress bar + eksik alan listesi.
 * %100 olunca kutlama mesajı.
 *
 * `bare`: dış .card sarmalını atlar — birleşik panel içinde bölüm olarak kullanılır.
 * `audience`: 'candidate' (varsayılan) | 'business' — ileti metni role göre.
 * Tema: açık + monokrom (eski koyu-tema beyaz pill/metin bırakıldı — açık kartta görünmüyordu).
 */
/** Role göre ileti: aday işverene, işletme adaya görünür. Eşik sırası yukarıdan aşağı. */
const MESSAGES = {
  candidate: {
    full: 'Tebrikler, profilin tamamen dolu.',
    near: 'Çok yakın — son birkaç alanı doldur.',
    good: 'İyi gidiyor, birkaç alan eksik.',
    mid:  'Profilini tamamla — dolu profiller işverenlerde daha çok güven uyandırır.',
    low:  'Profilin çok eksik; işverenler başvurunu değerlendirirken zorlanabilir.',
  },
  business: {
    full: 'Tebrikler, işletme profilin tamamen dolu.',
    near: 'Çok yakın — son birkaç alanı doldur.',
    good: 'İyi gidiyor, birkaç alan eksik.',
    mid:  'Profilini tamamla — dolu işletme profilleri adaylarda daha çok güven uyandırır.',
    low:  'Profilin çok eksik; adaylar ilanına başvurmadan önce işletmeni tanımak ister.',
  },
}

export default function ProfileCompletenessCard({ data, bare = false, audience = 'candidate' }) {
  if (!data) return null
  const { percentage, missing } = data
  const m = MESSAGES[audience] || MESSAGES.candidate

  const message =
    percentage >= 100 ? m.full :
    percentage >= 90  ? m.near :
    percentage >= 70  ? m.good :
    percentage >= 40  ? m.mid :
                        m.low

  return (
    <div className={bare ? '' : 'card p-5'}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="type-card mb-1">Profil doluluğu</h3>
          <p className="type-meta">{message}</p>
        </div>
        <div className="text-[28px] leading-8 font-bold tracking-tight flex-shrink-0 type-num" style={{ color: 'var(--ah-ink)' }}>
          %{percentage}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 rounded-full overflow-hidden mb-3"
           role="progressbar" aria-label="Profil doluluğu" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}
           style={{ background: 'var(--ah-line)' }}>
        <div
          className="h-full transition-all duration-500 rounded-full"
          style={{ width: `${percentage}%`, background: 'var(--ah-brand)' }}
        />
      </div>

      {/* Eksik alanlar listesi */}
      {missing.length > 0 && (
        <div>
          <div className="type-label mb-2">
            Eksik {missing.length} alan
          </div>
          <div className="flex flex-wrap gap-1.5">
            {missing.slice(0, 8).map(m => (
              <span key={m.key}
                className="type-badge px-2.5 py-1 rounded-full"
                style={{ background: 'var(--ah-band)', color: 'var(--ah-ink-2)', border: '1px solid var(--ah-line)' }}>
                {m.label}
              </span>
            ))}
            {missing.length > 8 && (
              <span className="type-badge px-2 py-1" style={{ color: 'var(--ah-ink-3)' }}>
                +{missing.length - 8} daha…
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
