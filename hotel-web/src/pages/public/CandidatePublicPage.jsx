/**
 * Dalga G — Aday Public Profili
 * Route: /p/candidate/:id
 * Yetki: Sadece ilgili isletme (aday bu isletmenin ilanina basvurmussa) veya admin
 */
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as hotelApi from '../../api/hotel'
import StarRating from '../../components/StarRating'
import { POSITION_LABELS } from '../../utils/labels'

const EDUCATION_LABELS = { HIGH_SCHOOL: 'Lise', UNIVERSITY_GRADUATE: 'Üniversite' }
const JOB_TYPE_LABELS = { PERMANENT: 'Daimi', SEASONAL: 'Sezonluk', DAILY: 'Günlük', PART_TIME: 'Yarı Zamanlı' }
const LANG_LABELS = {
  TURKISH: 'Türkçe', ENGLISH: 'İngilizce', GERMAN: 'Almanca',
  RUSSIAN: 'Rusça', ARABIC: 'Arapça', FRENCH: 'Fransızca',
  SPANISH: 'İspanyolca', ITALIAN: 'İtalyanca',
}
const TIER_COLORS = {
  HIGH:   { color: '#22c55e', label: 'Yüksek' },
  MEDIUM: { color: '#f7c43c', label: 'Orta' },
  LOW:    { color: '#f97316', label: 'Düşük' },
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white relative z-10">
        <div className="spinner" />
      </div>
    )
  }

  if (error) {
    const status = error?.response?.status
    const msg = status === 403
      ? 'Bu adayın profilini görüntülemek için ilanınıza başvurmuş olması gerekir.'
      : status === 404
      ? 'Aday bulunamadı.'
      : 'Profil yüklenirken hata oluştu.'
    return (
      <div className="min-h-screen flex items-center justify-center text-white relative z-10">
        <div className="card max-w-md text-center p-8">
          <h2 className="text-xl font-bold mb-2">Erişim Yok</h2>
          <p className="text-sm opacity-80 mb-4">{msg}</p>
          <button onClick={() => navigate(-1)}
            className="px-5 py-2.5 rounded-lg text-white font-semibold"
            style={{ background: 'linear-gradient(135deg, #1e3a5f, #234a82)' }}>
            Geri Dön
          </button>
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
    <div className="min-h-screen text-white relative z-10">
      {/* Top bar */}
      <header className="px-4 lg:px-6 py-3 sticky top-0 z-20 bg-cream-100/85 backdrop-blur-lg border-b border-cream-300">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-cream-200 transition-colors text-ink-700"
            title="Geri">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="text-xs text-ink-500 truncate">
            <Link to="/business" className="hover:text-brand-700">Panel</Link>
            <span className="mx-1.5">/</span>
            <span className="text-ink-700 font-medium">{profile.fullName}</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 lg:px-6 py-6 space-y-5">
        {/* HERO */}
        <div className="card !p-0 overflow-hidden">
          <div className="relative h-32"
               style={{ background: 'linear-gradient(135deg, #15243d 0%, #234a82 70%, #d4a853 100%)' }}>
            <div aria-hidden className="absolute -top-12 -right-12 w-44 h-44 rounded-full opacity-25"
                 style={{ background: 'radial-gradient(circle, #fff, transparent 70%)' }} />
          </div>
          <div className="px-5 pb-5 -mt-12 relative">
            <div className="flex items-end gap-4 flex-wrap">
              <div className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                   style={{
                     background: 'rgba(212, 168, 83, 0.15)',
                     border: '3px solid rgba(15, 23, 38, 0.92)',
                     boxShadow: '0 4px 16px rgba(0,0,0,0.30)',
                   }}>
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.fullName}
                       className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bebas text-4xl" style={{ color: '#f7c43c' }}>{initial}</span>
                )}
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-bebas text-3xl tracking-wider uppercase truncate"
                      style={{ color: '#ffffff' }}>
                    {profile.fullName}
                  </h1>
                  {/* Dalga H2 — Is ariyorum rozeti (LinkedIn Open to Work) */}
                  {profile.isAvailable && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                          style={{
                            background: 'rgba(34, 197, 94, 0.15)',
                            color: '#86efac',
                            border: '1px solid rgba(34, 197, 94, 0.40)',
                          }}>
                      <span className="w-1.5 h-1.5 rounded-full inline-block"
                            style={{ background: '#22c55e', boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)' }} />
                      İş Arıyor
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap text-[13px]"
                     style={{ color: '#fde9a5' }}>
                  {profile.district && <span>{profile.district}</span>}
                  {profile.reviewCount > 0 && (
                    <>
                      <span style={{ color: 'rgba(229, 231, 235, 0.40)' }}>·</span>
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
            color={profile.noShowCount > 0 ? '#f97316' : '#22c55e'}
          />
          <MetricCard
            label="Ortalama Puan"
            value={profile.averageRating ? profile.averageRating.toFixed(1) : '—'}
            sub={`${profile.reviewCount ?? 0} değerlendirme`}
            color="#fbbf24"
          />
        </div>

        {/* 2-sütun: sol info + sag detay */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* SOL: Tercihler */}
          <div className="card p-5 space-y-4">
            <h2 className="font-bebas text-base tracking-[0.2em] uppercase pb-2 border-b"
                style={{ color: '#fde9a5', borderColor: 'rgba(212, 168, 83, 0.18)' }}>
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
          <div className="card p-5 space-y-4">
            <h2 className="font-bebas text-base tracking-[0.2em] uppercase pb-2 border-b"
                style={{ color: '#fde9a5', borderColor: 'rgba(212, 168, 83, 0.18)' }}>
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
          <div className="card p-5">
            <h2 className="font-bebas text-base tracking-[0.2em] uppercase pb-2 mb-3 border-b"
                style={{ color: '#fde9a5', borderColor: 'rgba(212, 168, 83, 0.18)' }}>
              Önceki Deneyim
            </h2>
            <p className="text-[14px] leading-relaxed whitespace-pre-line"
               style={{ color: 'rgba(229, 231, 235, 0.85)' }}>
              {profile.previousExperience}
            </p>
          </div>
        )}

        {/* Dalga G2 — Hassas iletisim bilgileri (sadece basvuru aldıysa açık) */}
        {profile.sensitiveUnlocked ? (
          <div className="card p-5"
               style={{ border: '1px solid rgba(212, 168, 83, 0.35)' }}>
            <div className="flex items-center justify-between pb-2 mb-3 border-b"
                 style={{ borderColor: 'rgba(212, 168, 83, 0.18)' }}>
              <h2 className="font-bebas text-base tracking-[0.2em] uppercase"
                  style={{ color: '#fde9a5' }}>İletişim Bilgileri</h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                    style={{
                      background: 'rgba(34, 197, 94, 0.15)',
                      color: '#86efac',
                      border: '1px solid rgba(34, 197, 94, 0.30)',
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
            <p className="text-[11px] mt-3 italic"
               style={{ color: 'rgba(229, 231, 235, 0.50)' }}>
              KVKK kapsamında bu bilgiler sadece adayın size başvurmuş olması nedeniyle gösteriliyor.
              Üçüncü kişilerle paylaşmayın.
            </p>
          </div>
        ) : (
          <div className="card p-4"
               style={{ background: 'rgba(15, 23, 38, 0.55)', border: '1px dashed rgba(212, 168, 83, 0.25)' }}>
            <div className="flex items-start gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                   className="flex-shrink-0 mt-0.5" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <div className="text-[12px]" style={{ color: 'rgba(229, 231, 235, 0.75)' }}>
                <p className="font-semibold mb-1" style={{ color: '#fde9a5' }}>
                  Hassas bilgiler gizli
                </p>
                <p style={{ color: 'rgba(229, 231, 235, 0.55)' }}>
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
    <div className="card !p-4">
      <div className="text-[10px] uppercase tracking-widest font-semibold mb-1"
           style={{ color: 'rgba(229, 231, 235, 0.55)' }}>
        {label}
      </div>
      <div className="font-bebas text-2xl tracking-wider mb-0.5" style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider"
           style={{ color: 'rgba(229, 231, 235, 0.50)' }}>
        {sub}
      </div>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest font-semibold mb-2"
           style={{ color: 'rgba(229, 231, 235, 0.55)' }}>
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
        <span key={it} className="inline-flex items-center text-[12px] font-medium px-2.5 py-1 rounded-full"
              style={{
                background: 'rgba(212, 168, 83, 0.12)',
                color: '#fde9a5',
                border: '1px solid rgba(212, 168, 83, 0.22)',
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
      <span className="text-[11px] uppercase tracking-wider"
            style={{ color: 'rgba(229, 231, 235, 0.50)' }}>{label}</span>
      <span className="text-[13px] font-semibold" style={{ color: '#dde7f3' }}>{value}</span>
    </div>
  )
}
