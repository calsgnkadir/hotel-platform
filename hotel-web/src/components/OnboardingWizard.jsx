/**
 * FAZ 1/#44 — Onboarding Wizard
 *
 * Yeni kullanıcı için 4 adımlık guided setup:
 *  1. Hoş geldin (rol bazlı tanıtım)
 *  2. Profil tamamla (avatar + telefon + ilçe)
 *  3. Tercihler / İlk eylem (aday: pozisyon, işletme: ilan)
 *  4. Hazırsın (CTA → ilanlara/profile)
 *
 * Tetik: LocalStorage'da 'onboarding-completed' yoksa, dashboard mount'ta açılır.
 * 'Atla' veya 4. adımdan sonra 'Bitir' = localStorage.setItem.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const STEPS_CANDIDATE = [
  {
    title: 'Hoş geldin! 🎉',
    description: 'AjansHotel ile İstanbul\'daki en iyi otel, restoran ve kafe işlerini birkaç dokunuşla bul. Hadi profilini tamamlayalım.',
    illustration: '👋',
  },
  {
    title: 'Profilini Tamamla',
    description: 'Profil fotoğrafı, telefon ve ilçe bilgisi başvurularının yanıt oranını 3 kat artırır.',
    illustration: '📝',
    cta: 'Profile Git',
    targetTab: 'profile',
  },
  {
    title: 'İlanları Keşfet',
    description: 'Sana uygun pozisyon ve vardiya tipini seçtin mi? İlanlar her gün eklenir — hızlı başvuranlar öncelikli.',
    illustration: '🔍',
    cta: 'İlanlara Bak',
    targetTab: 'listings',
  },
  {
    title: 'Hazırsın!',
    description: 'Artık başvurmaya başlayabilirsin. İşverenler genelde 24 saat içinde yanıt verir.',
    illustration: '🚀',
  },
]

const STEPS_BUSINESS = [
  {
    title: 'Hoş geldin! 🎉',
    description: 'AjansHotel ile İstanbul\'un en yetkin otel/restoran personelini hızla bul. Hadi işletme profilini tamamlayalım.',
    illustration: '👋',
  },
  {
    title: 'İşletme Profili',
    description: 'Logo, açıklama, harita konumu ve fotoğraflar adayların ilana güvenini artırır.',
    illustration: '🏢',
    cta: 'Profile Git',
    targetTab: 'profile',
  },
  {
    title: 'İlk İlanını Aç',
    description: 'Pozisyon + vardiya tarihi + ücret yeterli. Adaylar dakikalar içinde başvurmaya başlar.',
    illustration: '📋',
    cta: 'İlan Oluştur',
    targetTab: 'mylistings',
  },
  {
    title: 'Hazırsın!',
    description: 'Başvurular geldikçe Mesajlar sekmesinden adaylarla direkt iletişim kurabilirsin.',
    illustration: '🚀',
  },
]

const STORAGE_KEY = 'onboarding-completed-v1'

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
  const navigate = useNavigate()

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
         style={{ background: 'rgba(15, 8, 35, 0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="card max-w-md w-full p-0 overflow-hidden">
        {/* Hero alan */}
        <div className="relative h-40 flex items-center justify-center"
             style={{
               background: 'linear-gradient(135deg, #4c1d95 0%, #7e22ce 50%, #d946ef 100%)',
             }}>
          {/* Dekoratif daireler */}
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20"
               style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }} />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full opacity-15"
               style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }} />
          {/* Emoji illustration */}
          <div className="text-7xl relative z-10" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))' }}>
            {step.illustration}
          </div>
          {/* Adım göstergesi */}
          <div className="absolute top-4 right-4 text-xs font-bold px-3 py-1 rounded-full"
               style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', backdropFilter: 'blur(8px)' }}>
            {stepIdx + 1} / {steps.length}
          </div>
        </div>

        {/* İçerik */}
        <div className="p-6 text-center">
          <h2 className="text-xl font-bold mb-2" style={{ color: '#faf5ff' }}>
            {step.title}
          </h2>
          <p className="text-sm leading-relaxed mb-6" style={{ color: '#d8b4fe' }}>
            {step.description}
          </p>

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 mb-6">
            {steps.map((_, i) => (
              <div key={i}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === stepIdx ? '24px' : '6px',
                  background: i <= stepIdx ? '#d946ef' : 'rgba(216, 180, 254, 0.35)',
                }}
              />
            ))}
          </div>

          {/* Butonlar */}
          <div className="flex flex-col gap-2">
            {step.cta && (
              <button onClick={handleCta}
                className="w-full py-3 text-sm font-bold text-white rounded-xl transition-all hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #d946ef, #a855f7)', boxShadow: '0 4px 16px rgba(168,85,247,0.40)' }}>
                {step.cta} →
              </button>
            )}
            <button onClick={handleNext}
              className="w-full py-3 text-sm font-semibold rounded-xl transition-all"
              style={{ background: step.cta ? 'rgba(255,255,255,0.10)' : 'linear-gradient(135deg, #d946ef, #a855f7)',
                       color: '#fff',
                       border: step.cta ? '1px solid rgba(216,180,254,0.30)' : 'none',
                       boxShadow: step.cta ? 'none' : '0 4px 16px rgba(168,85,247,0.40)' }}>
              {isLast ? 'Başlayalım! 🚀' : 'İleri'}
            </button>
            {!isLast && (
              <button onClick={handleSkip}
                className="w-full py-2 text-xs font-medium hover:underline"
                style={{ color: '#c4b5fd' }}>
                Şimdi atla
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
