/**
 * Dalga G — Aday Public Profili
 * Route: /p/candidate/:id
 * Yetki: Sadece ilgili isletme (aday bu isletmenin ilanina basvurmussa) veya admin
 */
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as hotelApi from '../../api/hotel'
import StarRating from '../../components/StarRating'
import usePageTitle from '../../lib/usePageTitle'
import { POSITION_LABELS } from '../../utils/labels'

const EDUCATION_LABELS = { HIGH_SCHOOL: 'Lise', UNIVERSITY_GRADUATE: 'Üniversite' }
const JOB_TYPE_LABELS = { PERMANENT: 'Daimi', SEASONAL: 'Sezonluk', DAILY: 'Günlük', PART_TIME: 'Yarı Zamanlı' }
const LANG_LABELS = {
  TURKISH: 'Türkçe', ENGLISH: 'İngilizce', GERMAN: 'Almanca',
  RUSSIAN: 'Rusça', ARABIC: 'Arapça', FRENCH: 'Fransızca',
  SPANISH: 'İspanyolca', ITALIAN: 'İtalyanca',
}
const TIER_COLORS = {
  HIGH:   { color: '#7a9f7a', label: 'Yüksek' },
  MEDIUM: { color: '#c8923a', label: 'Orta' },
  LOW:    { color: '#b46a55', label: 'Düşük' },
}

export default function CandidatePublicPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['candidate-public', id],
    queryFn: () => hotelApi.getCandidatePublicProfile(id),
    enabled: !!id,
    retry: false,
  })

  // FAZ 14.3 — tab basligi (sayfa auth'lu, sitemap'e girmez — PII)
  usePageTitle(profile?.fullName ? `${profile.fullName} — Aday Profili` : null)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white relative z-10 legacy-dark">
        <div className="spinner" />
      </div>
    )
  }

  if (error) {
    const status = error?.response?.status
    const title = status === 403 ? 'Erişim Yok'
                : status === 404 ? 'Aday Bulunamadı'
                : status === 500 ? 'Sunucu Hatası'
                : status === 401 || status === undefined ? 'Bağlantı Hatası'
                : 'Hata Oluştu'
    const msg = status === 403
      ? 'Bu adayın profilini görüntülemek için ilanınıza başvurmuş olması gerekir.'
      : status === 404
      ? 'Aday bulunamadı ya da hesap silinmiş olabilir.'
      : status === 500
      ? 'Sunucu yanıt vermiyor. Backend yeniden başlatılmış olabilir, birkaç saniye sonra tekrar deneyin.'
      : status === 401
      ? 'Oturumun süresi dolmuş olabilir. Çıkış yapıp tekrar giriş yap.'
      : status === undefined
      ? 'Backend uygulamasına bağlanılamadı. Spring Boot çalışıyor mu?'
      : `HTTP ${status} — ${error?.response?.data?.message || 'Beklenmedik hata'}`
    return (
      <div className="min-h-screen flex items-center justify-center text-white relative z-10 legacy-dark">
        <div className="card max-w-md text-center p-8">
          <h2 className="text-xl font-bold mb-2">{title}</h2>
          <p className="text-sm opacity-80 mb-4">{msg}</p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg text-white font-semibold text-sm"
              style={{ background: 'linear-gradient(135deg, #7a9f7a, #5e8460)' }}>
              Tekrar Dene
            </button>
            <button onClick={() => navigate(-1)}
              className="px-4 py-2 rounded-lg text-white font-semibold text-sm"
              style={{ background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)', color: '#1a1208' }}>
              Geri Dön
            </button>
          </div>
        </div>
      </div>
    )
  }

  const initial = (profile.fullName || 'A').trim().charAt(0).toUpperCase()
  const tier = TIER_COLORS[profile.reliabilityTier] || TIER_COLORS.MEDIUM
  const memberSinceStr = profile.memberSince
    ? new Date(profile.memberSince).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  return (
    <div className="min-h-screen text-white relative z-10 legacy-dark">
      {/* Top bar */}
      <header className="px-4 lg:px-6 py-3 sticky top-0 z-20 backdrop-blur-lg border-b border-hairline"
              style={{ background: 'rgba(19, 17, 15, 0.85)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="tier-raised tier-raised-hover p-2"
            style={{ borderRadius: '10px', color: 'var(--text-secondary)' }}
            title="Geri">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="type-caption truncate">
            <Link to="/business" className="hover:text-champagne-300 transition-colors">Panel</Link>
            <span className="mx-1.5">/</span>
            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{profile.fullName}</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 lg:px-6 py-6 space-y-5">
        {/* HERO */}
        <div className="tier-raised !p-0 overflow-hidden">
          <div className="relative h-32"
               style={{ background: 'linear-gradient(135deg, #221f1b 0%, #2d2823 50%, #1b1815 100%)' }}>
            <div aria-hidden className="absolute -top-12 -right-12 w-44 h-44 rounded-full opacity-25"
                 style={{ background: 'radial-gradient(circle, #fff, transparent 70%)' }} />
          </div>
          <div className="px-5 pb-5 -mt-12 relative">
            <div className="flex items-end gap-4 flex-wrap">
              <div className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                   style={{
                     background: 'rgba(205, 183, 143, 0.12)',
                     border: '3px solid rgba(19, 17, 15, 0.94)',
                     boxShadow: '0 4px 16px rgba(0,0,0,0.30)',
                   }}>
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.fullName}
                       className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl" style={{ color: '#cdb78f' }}>{initial}</span>
                )}
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="type-display truncate">
                    {profile.fullName}
                  </h1>
                  {/* Dalga H2 — Is ariyorum rozeti (LinkedIn Open to Work) */}
                  {profile.isAvailable && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                          style={{
                            background: 'rgba(122, 159, 122, 0.12)',
                            color: '#a8c8a8',
                            border: '1px solid rgba(122, 159, 122, 0.35)',
                          }}>
                      <span className="w-1.5 h-1.5 rounded-full inline-block"
                            style={{ background: '#7a9f7a', boxShadow: '0 0 8px rgba(122, 159, 122, 0.55)' }} />
                      İş Arıyor
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap text-[13px]"
                     style={{ color: '#cdb78f' }}>
                  {profile.district && <span>{profile.district}</span>}
                  {profile.reviewCount > 0 && (
                    <>
                      <span style={{ color: '#6b6358' }}>·</span>
                      <StarRating value={profile.averageRating} count={profile.reviewCount} size="sm" />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Güvenilirlik metrik grid'i */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            label="Güvenilirlik"
            value={profile.reliabilityScore != null ? `${profile.reliabilityScore}/100` : '—'}
            sub={tier.label}
            color={tier.color}
          />
          <MetricCard
            label="Tamamlanan İş"
            value={profile.completedJobs ?? 0}
            sub="kabul + çalışma"
            color="#d4a853"
          />
          <MetricCard
            label="No-show"
            value={profile.noShowCount ?? 0}
            sub="iptal/gelmedim"
            color={profile.noShowCount > 0 ? '#b46a55' : '#7a9f7a'}
          />
          <MetricCard
            label="Ortalama Puan"
            value={profile.averageRating ? profile.averageRating.toFixed(1) : '—'}
            sub={`${profile.reviewCount ?? 0} değerlendirme`}
            color="#c8923a"
          />
        </div>

        {/* 2-sütun: sol info + sag detay */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* SOL: Tercihler */}
          <div className="tier-raised p-5 space-y-4">
            <h2 className="type-overline pb-2 border-b border-hairline"
                style={{ color: 'var(--accent-action)', fontSize: '12px' }}>
              İş Tercihleri
            </h2>

            {profile.preferredPositions?.length > 0 && (
              <Section label="Pozisyon">
                <ChipList items={profile.preferredPositions.map(p => POSITION_LABELS[p] || p)} />
              </Section>
            )}

            {profile.availabilityTypes?.length > 0 && (
              <Section label="Müsaitlik">
                <ChipList items={profile.availabilityTypes.map(t => JOB_TYPE_LABELS[t] || t)} />
              </Section>
            )}

            {profile.languages?.length > 0 && (
              <Section label="Diller">
                <ChipList items={profile.languages.map(l => LANG_LABELS[l] || l)} />
              </Section>
            )}
          </div>

          {/* SAG: Eğitim + Diğer */}
          <div className="tier-raised p-5 space-y-4">
            <h2 className="type-overline pb-2 border-b border-hairline"
                style={{ color: 'var(--accent-action)', fontSize: '12px' }}>
              Genel Bilgiler
            </h2>

            <DetailRow label="Eğitim" value={EDUCATION_LABELS[profile.education] || '—'} />
            <DetailRow label="Ehliyet" value={profile.hasLicense === true ? 'Var' : profile.hasLicense === false ? 'Yok' : '—'} />
            <DetailRow label="Sigara"  value={profile.smokes === true ? 'İçer' : profile.smokes === false ? 'İçmez' : '—'} />
            <DetailRow label="Üyelik"  value={memberSinceStr} />
          </div>
        </div>

        {/* Deneyim */}
        {profile.previousExperience && (
          <div className="tier-raised p-5">
            <h2 className="type-overline pb-2 mb-3 border-b border-hairline"
                style={{ color: 'var(--accent-action)', fontSize: '12px' }}>
              Önceki Deneyim
            </h2>
            <p className="type-body leading-relaxed whitespace-pre-line">
              {profile.previousExperience}
            </p>
          </div>
        )}

        {/* Dalga G2 — Hassas iletisim bilgileri (sadece basvuru aldıysa açık) */}
        {profile.sensitiveUnlocked ? (
          <div className="tier-featured p-5">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-hairline">
              <h2 className="type-overline"
                  style={{ color: 'var(--accent-action)', fontSize: '12px' }}>İletişim Bilgileri</h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                    style={{
                      background: 'rgba(122, 159, 122, 0.12)',
                      color: '#a8c8a8',
                      border: '1px solid rgba(122, 159, 122, 0.28)',
                    }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Başvuru alındı — erişim açık
              </span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {profile.email && <DetailRow label="E-posta" value={profile.email} />}
              {profile.phone && <DetailRow label="Telefon" value={profile.phone} />}
              {profile.neighborhood && <DetailRow label="Mahalle" value={profile.neighborhood} />}
              {profile.birthDate && (
                <DetailRow label="Doğum Tarihi"
                           value={new Date(profile.birthDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} />
              )}
              {profile.gender && (
                <DetailRow label="Cinsiyet"
                           value={{ MALE: 'Erkek', FEMALE: 'Kadın', OTHER: 'Diğer' }[profile.gender] || profile.gender} />
              )}
            </div>

            {/* Dalga I3 — CV indir butonu (sadece yuklendiyse) */}
            {profile.resumeUrl && (
              <a href={profile.resumeUrl} target="_blank" rel="noopener noreferrer"
                 className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-bold uppercase tracking-wider transition-all hover:-translate-y-0.5"
                 style={{
                   background: 'linear-gradient(135deg, #d4a853, #b8902d)',
                   color: '#221f1b',
                   boxShadow: '0 4px 16px rgba(205, 183, 143, 0.28)',
                 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                CV / Özgeçmiş İndir
              </a>
            )}
            <p className="text-[11px] mt-3 italic"
               style={{ color: '#6b6358' }}>
              KVKK kapsamında bu bilgiler sadece adayın size başvurmuş olması nedeniyle gösteriliyor.
              Üçüncü kişilerle paylaşmayın.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl p-4"
               style={{ background: 'rgba(13, 11, 9, 0.55)', border: '1px dashed rgba(205, 183, 143, 0.18)' }}>
            <div className="flex items-start gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8923a"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                   className="flex-shrink-0 mt-0.5" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <div className="text-[12px]" style={{ color: '#c9bdaa' }}>
                <p className="font-semibold mb-1" style={{ color: '#cdb78f' }}>
                  Hassas bilgiler gizli
                </p>
                <p style={{ color: '#6b6358' }}>
                  Email, telefon, mahalle ve doğum tarihi gibi bilgiler yalnızca aday
                  size başvurduğunda görüntülenebilir. İlanlarınız üzerinden başvuru
                  bekleyiniz.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div className="tier-raised p-4">
      <div className="type-overline mb-1">
        {label}
      </div>
      <div className="text-2xl tracking-wider mb-0.5 tabular-nums" style={{ color, fontWeight: 600 }}>
        {value}
      </div>
      <div className="type-overline" style={{ color: 'var(--text-faint)' }}>
        {sub}
      </div>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div>
      <div className="type-overline mb-2">
        {label}
      </div>
      {children}
    </div>
  )
}

function ChipList({ items }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(it => (
        <span key={it} className="type-caption inline-flex items-center font-medium px-2.5 py-1 rounded-full"
              style={{
                background: 'rgba(205, 183, 143, 0.10)',
                color: 'var(--accent-action)',
                border: '1px solid rgba(205, 183, 143, 0.18)',
              }}>
          {it}
        </span>
      ))}
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="type-overline">{label}</span>
      <span className="type-body font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}
