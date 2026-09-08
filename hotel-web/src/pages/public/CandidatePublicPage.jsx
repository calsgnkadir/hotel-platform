/**
 * Dalga G — Aday Public Profili
 * Route: /p/candidate/:id
 * Yetki: Sadece ilgili isletme (aday bu isletmenin ilanina basvurmussa) veya admin
 *
 * Tema: "sadece gri ve siyah" kimligine gecti — eski koyu-sampanya legacy-dark
 * birakildi, sayfa .ah-surface altinda acik temaya alindi. Renk yok; hero
 * grafit banner (marka tonu), geri kalan noteral gri/siyah.
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
      <div className="ah-surface min-h-screen flex items-center justify-center relative z-10">
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
      <div className="ah-surface min-h-screen flex items-center justify-center relative z-10">
        <div className="card max-w-md text-center p-8">
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--ah-ink)' }}>{title}</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--ah-ink-3)' }}>{msg}</p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg text-white font-semibold text-sm"
              style={{ background: 'var(--ah-brand-gradient)' }}>
              Tekrar Dene
            </button>
            <button onClick={() => navigate(-1)}
              className="px-4 py-2 rounded-lg font-semibold text-sm"
              style={{ background: 'var(--ah-band)', color: 'var(--ah-ink)', border: '1px solid var(--ah-line)' }}>
              Geri Dön
            </button>
          </div>
        </div>
      </div>
    )
  }

  const initial = (profile.fullName || 'A').trim().charAt(0).toUpperCase()
  const memberSinceStr = profile.memberSince
    ? new Date(profile.memberSince).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  return (
    <div className="ah-surface min-h-screen relative z-10">
      {/* Top bar */}
      <header className="px-4 lg:px-6 py-3 sticky top-0 z-20 backdrop-blur-lg border-b"
              style={{ background: 'rgba(255, 255, 255, 0.85)', borderColor: 'var(--ah-line)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="tier-raised tier-raised-hover p-2"
            style={{ borderRadius: '10px', color: 'var(--ah-ink-2)' }}
            title="Geri">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="type-caption truncate">
            <Link to="/business" className="hover:underline transition-colors" style={{ color: 'var(--ah-ink-2)' }}>Panel</Link>
            <span className="mx-1.5" style={{ color: 'var(--ah-ink-4)' }}>/</span>
            <span className="font-medium" style={{ color: 'var(--ah-ink-2)' }}>{profile.fullName}</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 lg:px-6 py-6 space-y-5">
        {/* HERO */}
        <div className="tier-raised !p-0 overflow-hidden">
          <div className="relative h-32"
               style={{ background: 'var(--ah-brand-gradient)' }}>
            <div aria-hidden className="absolute -top-12 -right-12 w-44 h-44 rounded-full opacity-15"
                 style={{ background: 'radial-gradient(circle, #fff, transparent 70%)' }} />
          </div>
          <div className="px-5 pb-5 -mt-12 relative">
            <div className="flex items-end gap-4 flex-wrap">
              <div className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                   style={{
                     background: 'var(--ah-brand-soft)',
                     border: '3px solid var(--ah-card)',
                     boxShadow: 'var(--elev-2)',
                   }}>
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.fullName}
                       className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-semibold" style={{ color: 'var(--ah-brand)' }}>{initial}</span>
                )}
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="type-display truncate" style={{ color: 'var(--ah-ink)' }}>
                    {profile.fullName}
                  </h1>
                  {/* Dalga H2 — Is ariyorum rozeti (LinkedIn Open to Work) */}
                  {profile.isAvailable && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                          style={{
                            background: 'var(--ah-brand-soft)',
                            color: 'var(--ah-brand)',
                            border: '1px solid var(--ah-line-2)',
                          }}>
                      <span className="w-1.5 h-1.5 rounded-full inline-block"
                            style={{ background: 'var(--ah-brand)' }} />
                      İş Arıyor
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap text-[13px]"
                     style={{ color: 'var(--ah-ink-3)' }}>
                  {profile.district && <span>{profile.district}</span>}
                  {profile.reviewCount > 0 && (
                    <>
                      <span style={{ color: 'var(--ah-ink-4)' }}>·</span>
                      <StarRating value={profile.averageRating} count={profile.reviewCount} size="sm" />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Deneyim metrikleri — guvenilirlik skoru kaldirildi (kullanici istegi) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard
            label="Tamamlanan İş"
            value={profile.completedJobs ?? 0}
            sub="kabul + çalışma"
          />
          <MetricCard
            label="No-show"
            value={profile.noShowCount ?? 0}
            sub="iptal/gelmedim"
          />
          <MetricCard
            label="Ortalama Puan"
            value={profile.averageRating ? profile.averageRating.toFixed(1) : '—'}
            sub={`${profile.reviewCount ?? 0} değerlendirme`}
          />
        </div>

        {/* 2-sütun: sol info + sag detay */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* SOL: Tercihler */}
          <div className="tier-raised p-5 space-y-4">
            <h2 className="type-overline pb-2 border-b"
                style={{ color: 'var(--ah-ink)', borderColor: 'var(--ah-line)', fontSize: '12px' }}>
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
            <h2 className="type-overline pb-2 border-b"
                style={{ color: 'var(--ah-ink)', borderColor: 'var(--ah-line)', fontSize: '12px' }}>
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
            <h2 className="type-overline pb-2 mb-3 border-b"
                style={{ color: 'var(--ah-ink)', borderColor: 'var(--ah-line)', fontSize: '12px' }}>
              Önceki Deneyim
            </h2>
            <p className="type-body leading-relaxed whitespace-pre-line" style={{ color: 'var(--ah-ink-2)' }}>
              {profile.previousExperience}
            </p>
          </div>
        )}

        {/* Dalga G2 — Hassas iletisim bilgileri (sadece basvuru aldıysa açık) */}
        {profile.sensitiveUnlocked ? (
          <div className="tier-featured p-5">
            <div className="flex items-center justify-between pb-2 mb-3 border-b" style={{ borderColor: 'var(--ah-line)' }}>
              <h2 className="type-overline"
                  style={{ color: 'var(--ah-ink)', fontSize: '12px' }}>İletişim Bilgileri</h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                    style={{
                      background: 'var(--ah-brand-soft)',
                      color: 'var(--ah-brand)',
                      border: '1px solid var(--ah-line-2)',
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
                 className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-bold uppercase tracking-wider transition-all hover:-translate-y-0.5 text-white"
                 style={{
                   background: 'var(--ah-brand-gradient)',
                   boxShadow: 'var(--elev-1)',
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
               style={{ color: 'var(--ah-ink-3)' }}>
              KVKK kapsamında bu bilgiler sadece adayın size başvurmuş olması nedeniyle gösteriliyor.
              Üçüncü kişilerle paylaşmayın.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl p-4"
               style={{ background: 'var(--ah-band)', border: '1px dashed var(--ah-line-2)' }}>
            <div className="flex items-start gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ah-ink-3)"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                   className="flex-shrink-0 mt-0.5" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <div className="text-[12px]" style={{ color: 'var(--ah-ink-3)' }}>
                <p className="font-semibold mb-1" style={{ color: 'var(--ah-ink)' }}>
                  Hassas bilgiler gizli
                </p>
                <p style={{ color: 'var(--ah-ink-3)' }}>
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

function MetricCard({ label, value, sub }) {
  return (
    <div className="tier-raised p-4">
      <div className="type-overline mb-1" style={{ color: 'var(--ah-ink-3)' }}>
        {label}
      </div>
      <div className="text-2xl tracking-wider mb-0.5 tabular-nums" style={{ color: 'var(--ah-ink)', fontWeight: 600 }}>
        {value}
      </div>
      <div className="type-overline" style={{ color: 'var(--ah-ink-4)' }}>
        {sub}
      </div>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div>
      <div className="type-overline mb-2" style={{ color: 'var(--ah-ink-3)' }}>
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
                background: 'var(--ah-brand-soft)',
                color: 'var(--ah-brand)',
                border: '1px solid var(--ah-line)',
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
      <span className="type-overline" style={{ color: 'var(--ah-ink-3)' }}>{label}</span>
      <span className="type-body font-semibold" style={{ color: 'var(--ah-ink)' }}>{value}</span>
    </div>
  )
}
