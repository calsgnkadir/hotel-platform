/**
 * FAZ 1/#34 — Profile Completeness Card
 *
 * Profil ne kadar dolu progress bar + eksik alan listesi.
 * %100 olunca kutlama mesajı.
 *
 * `bare`: dış .card sarmalını atlar — birleşik panel içinde bölüm olarak kullanılır.
 * Tema: açık + monokrom (eski koyu-tema beyaz pill/metin bırakıldı — açık kartta görünmüyordu).
 */
export default function ProfileCompletenessCard({ data, bare = false }) {
  if (!data) return null
  const { percentage, missing } = data

  const message =
    percentage >= 100 ? 'Tebrikler — profilin %100 dolu!' :
    percentage >= 90  ? 'Çok yakın — son birkaç alanı doldur.' :
    percentage >= 70  ? 'İyi gidiyor, biraz daha eksik var.' :
    percentage >= 40  ? 'Profilini tamamla — işverenler güveniyor.' :
                        'Profilin çok eksik. Başvuruların görünmüyor olabilir.'

  return (
    <div className={bare ? '' : 'card p-5'}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--ah-ink-3)' }}>
            Profil Doluluk
          </div>
          <div className="text-sm" style={{ color: 'var(--ah-ink-2)' }}>{message}</div>
        </div>
        <div className="text-3xl font-black flex-shrink-0 tabular-nums" style={{ color: 'var(--ah-ink)' }}>
          %{percentage}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 rounded-full overflow-hidden mb-3"
           style={{ background: 'var(--ah-line)' }}>
        <div
          className="h-full transition-all duration-500 rounded-full"
          style={{ width: `${percentage}%`, background: 'var(--ah-brand)' }}
        />
      </div>

      {/* Eksik alanlar listesi */}
      {missing.length > 0 && (
        <div>
          <div className="text-xs font-semibold mb-2" style={{ color: 'var(--ah-ink-3)' }}>
            Eksik {missing.length} alan:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {missing.slice(0, 8).map(m => (
              <span key={m.key}
                className="text-[11px] px-2 py-1 rounded-full"
                style={{ background: 'var(--ah-band)', color: 'var(--ah-ink-2)', border: '1px solid var(--ah-line)' }}>
                {m.label}
              </span>
            ))}
            {missing.length > 8 && (
              <span className="text-[11px] px-2 py-1" style={{ color: 'var(--ah-ink-3)' }}>
                +{missing.length - 8} daha…
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
