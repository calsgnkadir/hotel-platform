/**
 * FAZ 1/#34 — Profile Completeness Card
 *
 * Profil ne kadar dolu → progress bar + eksik alan listesi.
 * %100 olunca kutlama mesajı.
 */
export default function ProfileCompletenessCard({ data }) {
  if (!data) return null
  const { percentage, missing } = data

  // Renk: kırmızı → sarı → mor (mor seviye 70+)
  const color =
    percentage >= 90 ? '#16a34a' :     // yeşil
    percentage >= 70 ? '#1e3a5f' :     // mor (brand)
    percentage >= 40 ? '#d97706' :     // amber
                       '#dc2626'        // kırmızı

  const message =
    percentage >= 100 ? 'Tebrikler — profilin %100 dolu!' :
    percentage >= 90  ? 'Çok yakın — son birkaç alanı doldur.' :
    percentage >= 70  ? 'İyi gidiyor, biraz daha eksik var.' :
    percentage >= 40  ? 'Profilini tamamla — işverenler güveniyor.' :
                        'Profilin çok eksik. Başvuruların görünmüyor olabilir.'

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">
            Profil Doluluk
          </div>
          <div className="text-sm opacity-90">{message}</div>
        </div>
        <div className="text-3xl font-black flex-shrink-0" style={{ color: percentage >= 70 ? '#fff' : color }}>
          %{percentage}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 rounded-full overflow-hidden mb-3"
           style={{ background: 'rgba(255,255,255,0.15)' }}>
        <div
          className="h-full transition-all duration-500 rounded-full"
          style={{
            width: `${percentage}%`,
            background: percentage >= 100
              ? 'linear-gradient(90deg, #22c55e, #16a34a)'
              : 'linear-gradient(90deg, #fde9a5, #fff)',
          }}
        />
      </div>

      {/* Eksik alanlar listesi */}
      {missing.length > 0 && (
        <div>
          <div className="text-xs font-semibold opacity-80 mb-2">
            Eksik {missing.length} alan:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {missing.slice(0, 8).map(m => (
              <span key={m.key}
                className="text-[11px] px-2 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}>
                {m.label}
              </span>
            ))}
            {missing.length > 8 && (
              <span className="text-[11px] px-2 py-1 opacity-70">
                +{missing.length - 8} daha…
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
