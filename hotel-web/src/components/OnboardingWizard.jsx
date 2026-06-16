/**
 * FAZ 1/#44 (FAZ 6.2 redesign) — Onboarding Wizard
 *
 * Yeni kullanıcı için 4 adımlık guided setup:
 *  1. Hoş geldin (rol bazlı tanıtım)
 *  2. Profil tamamla
 *  3. İlk eylem (aday: ilanları keşfet, işletme: ilan oluştur)
 *  4. Hazırsın
 *
 * Tetik: LocalStorage'da bu userId yoksa, dashboard mount'ta açılır.
 * 'Atla' veya 4. adımdan sonra 'Bitir' = localStorage'a userId ekle.
 *
 * FAZ 6.2: Dark glass + Bebas Neue + SVG ikonlar (emoji yok).
 */
import { useState } from 'react'

/* SVG ikonlar — emoji yerine */
const ICON_WAVE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-12 h-12">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M14 9l1.5-1.5a3 3 0 014.5 4.0L13.5 18.5a2 2 0 01-2.83 0L4 12.5l1.5-1.5a3 3 0 014.5 0l3 3" />
    <circle cx="18" cy="6" r="1" fill="currentColor" />
  </svg>
)
const ICON_PROFILE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-12 h-12">
    <circle cx="12" cy="8" r="4" strokeLinecap="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 21v-1a8 8 0 0116 0v1" />
  </svg>
)
const ICON_SEARCH = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-12 h-12">
    <circle cx="11" cy="11" r="7" strokeLinecap="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
  </svg>
)
const ICON_ROCKET = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-12 h-12">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M5 13a7 7 0 0114 0M12 3v8m-4 11l4-4 4 4M8 17l4 4M16 17l-4 4" />
  </svg>
)
const ICON_BUILDING = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-12 h-12">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M4 21V8l8-5 8 5v13M4 21h16M9 21v-6h6v6M9 11h.01M15 11h.01" />
  </svg>
)
const ICON_LISTING = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-12 h-12">
    <rect x="4" y="4" width="16" height="16" rx="2" strokeLinecap="round" />
    <path strokeLinecap="round" d="M8 9h8M8 13h8M8 17h5" />
  </svg>
)

const STEPS_CANDIDATE = [
  {
    title: 'Hoş Geldin',
    description: "AjansHotel ile İstanbul'daki en iyi otel, restoran ve kafe işlerini birkaç dokunuşla bul. Hadi profilini tamamlayalım.",
    icon: ICON_WAVE,
  },
  {
    title: 'Profilini Tamamla',
    description: 'Profil fotoğrafı, telefon ve ilçe bilgisi başvurularının yanıt oranını 3 kat artırır.',
    icon: ICON_PROFILE,
    cta: 'Profile Git',
    targetTab: 'profile',
  },
  {
    title: 'İlanları Keşfet',
    description: 'Sana uygun pozisyon ve vardiya tipini seçtin mi? İlanlar her gün eklenir — hızlı başvuranlar öncelikli.',
    icon: ICON_SEARCH,
    cta: 'İlanlara Bak',
    targetTab: 'listings',
  },
  {
    title: 'Hazırsın',
    description: 'Artık başvurmaya başlayabilirsin. İşverenler genelde 24 saat içinde yanıt verir.',
    icon: ICON_ROCKET,
  },
]

const STEPS_BUSINESS = [
  {
    title: 'Hoş Geldin',
    description: "AjansHotel ile İstanbul'un en yetkin otel/restoran personelini hızla bul. Hadi işletme profilini tamamlayalım.",
    icon: ICON_WAVE,
  },
  {
    title: 'İşletme Profili',
    description: 'Logo, açıklama, harita konumu ve fotoğraflar adayların ilana güvenini artırır.',
    icon: ICON_BUILDING,
    cta: 'Profile Git',
    targetTab: 'profile',
  },
  {
    title: 'İlk İlanını Aç',
    description: 'Pozisyon + vardiya tarihi + ücret yeterli. Adaylar dakikalar içinde başvurmaya başlar.',
    icon: ICON_LISTING,
    cta: 'İlan Oluştur',
    targetTab: 'mylistings',
  },
  {
    title: 'Hazırsın',
    description: 'Başvurular geldikçe Mesajlar sekmesinden adaylarla direkt iletişim kurabilirsin.',
    icon: ICON_ROCKET,
  },
]

const STORAGE_KEY = 'onboarding-completed-v2'  // v2: yeni tasarım, eski cache temizlensin

export function shouldShowOnboarding(userId) {
  if (!userId) return false
  const completed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  return !completed.includes(userId)
}

export function markOnboardingDone(userId) {
  if (!userId) return
  const completed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  if (!completed.includes(userId)) {
    completed.push(userId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completed))
  }
}

export default function OnboardingWizard({ user, onClose, onTabChange }) {
  const [stepIdx, setStepIdx] = useState(0)

  const isCandidate = user?.role === 'CANDIDATE'
  const steps = isCandidate ? STEPS_CANDIDATE : STEPS_BUSINESS
  const step = steps[stepIdx]
  const isLast = stepIdx === steps.length - 1

  function handleNext() {
    if (isLast) {
      markOnboardingDone(user.id)
      onClose()
    } else {
      setStepIdx(stepIdx + 1)
    }
  }

  function handleSkip() {
    markOnboardingDone(user.id)
    onClose()
  }

  function handleCta() {
    markOnboardingDone(user.id)
    if (step.targetTab && onTabChange) {
      onTabChange(step.targetTab)
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(10, 6, 18, 0.85)', backdropFilter: 'blur(10px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div
        className="max-w-md w-full rounded-2xl overflow-hidden relative"
        style={{
          background: 'linear-gradient(135deg, rgba(20, 14, 38, 0.95), rgba(15, 10, 30, 0.95))',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.60), 0 0 40px rgba(168, 85, 247, 0.20)',
        }}
      >
        {/* Hero alan — radial glow + ikon */}
        <div className="relative h-44 flex items-center justify-center overflow-hidden"
             style={{
               background: 'linear-gradient(135deg, #4c1d95 0%, #7e22ce 50%, #d946ef 100%)',
             }}>
          {/* Dekoratif daireler */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-25"
               style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }} />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-20"
               style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }} />

          {/* Ikon wrapper */}
          <div
            className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center text-white"
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: '2px solid rgba(255, 255, 255, 0.25)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.30)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {step.icon}
          </div>

          {/* Adım göstergesi */}
          <div
            className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
            style={{
              background: 'rgba(15, 10, 30, 0.55)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.25)',
            }}
          >
            {stepIdx + 1} / {steps.length}
          </div>
        </div>

        {/* İçerik */}
        <div className="p-6 sm:p-7 text-center">
          <h2
            id="onboarding-title"
            className="font-bebas text-3xl tracking-wider uppercase text-white mb-2.5"
            style={{ textShadow: '0 0 16px rgba(168, 85, 247, 0.40)' }}
          >
            {step.title}
          </h2>
          <p className="text-sm leading-relaxed mb-6" style={{ color: '#d8b4fe' }}>
            {step.description}
          </p>

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 mb-6">
            {steps.map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === stepIdx ? '28px' : '6px',
                  background: i <= stepIdx ? '#d946ef' : 'rgba(216, 180, 254, 0.28)',
                  boxShadow: i === stepIdx ? '0 0 10px rgba(217, 70, 239, 0.55)' : 'none',
                }}
              />
            ))}
          </div>

          {/* Butonlar */}
          <div className="flex flex-col gap-2">
            {step.cta && (
              <button
                onClick={handleCta}
                className="w-full py-3 font-bebas text-base tracking-wider uppercase text-white rounded-full transition-all hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(135deg, #d946ef, #a855f7)',
                  boxShadow: '0 0 20px rgba(168, 85, 247, 0.45)',
                }}
              >
                {step.cta} →
              </button>
            )}
            <button
              onClick={handleNext}
              className="w-full py-3 font-bebas text-base tracking-wider uppercase rounded-full transition-all hover:-translate-y-0.5"
              style={
                step.cta
                  ? {
                      background: 'rgba(168, 85, 247, 0.14)',
                      color: '#d8b4fe',
                      border: '1px solid rgba(168, 85, 247, 0.30)',
                    }
                  : {
                      background: 'linear-gradient(135deg, #d946ef, #a855f7)',
                      color: '#fff',
                      boxShadow: '0 0 20px rgba(168, 85, 247, 0.45)',
                    }
              }
            >
              {isLast ? 'Başlayalım →' : 'İleri'}
            </button>
            {!isLast && (
              <button
                onClick={handleSkip}
                className="w-full py-2 text-[11px] font-bold uppercase tracking-widest hover:underline transition-all"
                style={{ color: '#a5b4fc' }}
              >
                Şimdi atla
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
