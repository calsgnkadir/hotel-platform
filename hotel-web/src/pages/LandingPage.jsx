import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthModal from '../components/AuthModal'

/**
 * Landing v4 — FAZ A.1 (acik + teal, kurumsal).
 *
 * Eski v3 "editorial dark luxe" (DarkVeil WebGL, RotatingText, LandingPulse,
 * altin glow) BIRAKILDI: animasyon yok, koyu zemin yok, emoji yok.
 *
 * Konumlandirma (kullanici vizyonu): "internetteki ajans" —
 * isletme ajansa komisyon odemez, calisan kazancinin tamamini alir.
 * Guven blogu urunun GERCEK ozelliklerini anlatir (GPS giris-cikis,
 * cift yonlu puan, belge cuzdani) — uydurma istatistik yok.
 */

const POSITIONS = ['Garson', 'Komi', 'Bulaşıkçı', 'Resepsiyon', 'Kat Hizmetleri', 'Mutfak Personeli', 'Bellboy', 'Güvenlik']

export default function LandingPage() {
  const [authOpen, setAuthOpen] = useState(false)
  const [authRole, setAuthRole] = useState(null)
  const openAuth = (role = null) => { setAuthRole(role); setAuthOpen(true) }
  const closeAuth = () => setAuthOpen(false)

  return (
    <div className="min-h-screen ah-surface" style={{ background: 'var(--ah-page)', color: 'var(--ah-ink-2)' }}>

      {/* ───── Header ───── */}
      <header className="sticky top-0 z-30 border-b" style={{ background: 'var(--ah-card)', borderColor: 'var(--ah-line)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-baseline gap-2">
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.01em', color: 'var(--ah-ink)' }}>AjansHotel</span>
            <span className="hidden sm:inline" style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ah-ink-4)' }}>istanbul</span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium" style={{ color: 'var(--ah-ink-3)' }}>
            <a href="#nasil" className="hover:underline" style={{ color: 'inherit' }}>Nasıl çalışır</a>
            <a href="#neden" className="hover:underline" style={{ color: 'inherit' }}>Neden AjansHotel</a>
            <a href="#iletisim" className="hover:underline" style={{ color: 'inherit' }}>İletişim</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/login"
              className="text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors"
              style={{ color: 'var(--ah-ink-2)', border: '1px solid var(--ah-line-2)', background: 'var(--ah-card)' }}>
              Giriş Yap
            </Link>
            <button type="button" onClick={() => openAuth()}
              className="text-[13px] font-semibold px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
              style={{ background: 'var(--ah-brand)', color: '#ffffff' }}>
              Kayıt Ol
            </button>
          </div>
        </div>
      </header>

      {/* ───── Hero ───── */}
      <section style={{ background: 'var(--ah-card)', borderBottom: '1px solid var(--ah-line)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-24 grid lg:grid-cols-12 gap-12 items-center">
          {/* Sol: mesaj + CTA */}
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-6"
                 style={{ background: 'var(--ah-brand-soft)', border: '1px solid var(--ah-line)' }}>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--ah-brand)' }}>
                Otel · Restoran · Kafe — vardiyalık personel
              </span>
            </div>

            <h1 style={{
              fontSize: 'clamp(30px, 4.5vw, 44px)', lineHeight: 1.12, fontWeight: 800,
              letterSpacing: '-0.025em', color: 'var(--ah-ink)',
            }}>
              Ajansın yaptığını yapar,
              <span className="block" style={{ color: 'var(--ah-brand)' }}>komisyonunu almaz.</span>
            </h1>

            <p className="mt-5 max-w-xl text-[15px] leading-relaxed" style={{ color: 'var(--ah-ink-3)' }}>
              İşletme ile çalışanı doğrudan buluşturur: işletme aracı komisyonu ödemez,
              çalışan kazancının tamamını alır. Eşleştirme, mesajlaşma, vardiya takibi
              ve giriş-çıkış kaydı — hepsi platformda.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button type="button" onClick={() => openAuth('CANDIDATE')}
                className="flex-1 sm:flex-initial sm:min-w-[220px] text-left px-5 py-4 rounded-xl transition-opacity hover:opacity-90"
                style={{ background: 'var(--ah-brand)', color: '#ffffff' }}>
                <span className="block text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ opacity: 0.8 }}>Çalışan için</span>
                <span className="block text-base font-bold mt-0.5">İş arıyorum</span>
              </button>
              <button type="button" onClick={() => openAuth('BUSINESS_OWNER')}
                className="flex-1 sm:flex-initial sm:min-w-[220px] text-left px-5 py-4 rounded-xl transition-colors"
                style={{ background: 'var(--ah-card)', color: 'var(--ah-ink)', border: '1px solid var(--ah-line-2)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ah-brand)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--ah-line-2)' }}>
                <span className="block text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--ah-ink-4)' }}>İşletme için</span>
                <span className="block text-base font-bold mt-0.5">Personel arıyorum</span>
              </button>
            </div>

            {/* Guven satiri — urunun gercek ozellikleri */}
            <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 text-[12px]" style={{ color: 'var(--ah-ink-3)' }}>
              {['GPS doğrulamalı giriş-çıkış', 'Çift yönlü puanlama', 'KVKK uyumlu belge cüzdanı'].map(label => (
                <span key={label} className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="var(--ah-ok)"
                       strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Sag: ornek vardiya karti (kurgusal isletme) */}
          <div className="lg:col-span-5 hidden lg:block">
            <div className="card !p-0 overflow-hidden" style={{ boxShadow: 'var(--elev-2)' }}>
              <div className="px-5 py-4 flex items-center gap-3 border-b" style={{ borderColor: 'var(--ah-line)' }}>
                <span className="w-11 h-11 rounded-lg grid place-items-center text-white font-bold text-lg"
                      style={{ background: 'var(--ah-brand)' }}>K</span>
                <div className="min-w-0">
                  <div className="font-semibold" style={{ color: 'var(--ah-ink)' }}>Karaköy Kıyı Restoran</div>
                  <div className="text-[12px]" style={{ color: 'var(--ah-ink-3)' }}>Beyoğlu · 4.6 puan · 38 vardiya tamamlandı</div>
                </div>
              </div>
              <div className="p-4 space-y-2">
                <ShiftRow pos="Garson" time="Cumartesi · 18:00–02:00" wage="Vardiya ücreti" />
                <ShiftRow pos="Komi" time="Pazar · 12:00–20:00" wage="Vardiya ücreti" />
                <ShiftRow pos="Bulaşıkçı" time="Hafta içi · akşam" wage="Vardiya ücreti" />
              </div>
              <div className="px-4 pb-4">
                <button type="button" onClick={() => openAuth('CANDIDATE')}
                  className="w-full py-3 rounded-lg text-[13px] font-bold transition-opacity hover:opacity-90"
                  style={{ background: 'var(--ah-brand)', color: '#ffffff' }}>
                  Vardiyaya başvur
                </button>
              </div>
            </div>
            <p className="mt-3 text-center text-[11px]" style={{ color: 'var(--ah-ink-4)' }}>
              Örnek ilan görünümü
            </p>
          </div>
        </div>
      </section>

      {/* ───── Nasil calisir ───── */}
      <section id="nasil" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
        <h2 className="text-center mb-3" style={{ fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ah-ink)' }}>
          Nasıl çalışır?
        </h2>
        <p className="text-center text-[14px] mb-12 max-w-xl mx-auto" style={{ color: 'var(--ah-ink-3)' }}>
          İki taraf için de üç adım. Aracı yok, telefon trafiği yok.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <StepsCard
            title="Çalışan"
            steps={[
              ['Profilini oluştur', 'Deneyimini, belgelerini ve çalışmak istediğin pozisyonları ekle.'],
              ['Vardiyaya başvur', 'İlana değil, çalışabileceğin spesifik vardiya gün ve saatine başvurursun.'],
              ['Çalış, kazan, puanla', 'GPS ile giriş-çıkış yap; kazancın kayıt altında, işletmeyi sen de puanla.'],
            ]}
          />
          <StepsCard
            title="İşletme"
            steps={[
              ['Vardiya ilanı ver', 'Pozisyon, gün, saat ve ücreti belirt — dakikalar içinde yayında.'],
              ['Adayı seç', 'Başvuranların geçmiş vardiya sayısını, puanını ve güvenilirlik skorunu gör.'],
              ['Takip et', 'Giriş-çıkış GPS kaydıyla doğrulanır; vardiya sonunda çalışanı değerlendir.'],
            ]}
          />
        </div>

        {/* Pozisyonlar */}
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {POSITIONS.map(p => (
            <span key={p} className="text-[12.5px] font-medium px-3 py-1.5 rounded-full"
                  style={{ background: 'var(--ah-card)', border: '1px solid var(--ah-line-2)', color: 'var(--ah-ink-2)' }}>
              {p}
            </span>
          ))}
        </div>
      </section>

      {/* ───── Neden ajans degil ───── */}
      <section id="neden" style={{ background: 'var(--ah-card)', borderTop: '1px solid var(--ah-line)', borderBottom: '1px solid var(--ah-line)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
          <h2 className="text-center mb-3" style={{ fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ah-ink)' }}>
            Neden ajans değil?
          </h2>
          <p className="text-center text-[14px] mb-12 max-w-xl mx-auto" style={{ color: 'var(--ah-ink-3)' }}>
            Ajansın verdiği güvenceyi ürünle karşılıyoruz — aradan çıkan komisyon iki tarafta kalıyor.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <WhyCard
              iconPath="M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              title="Aracı maliyeti yok"
              text="İşletme ajans komisyonu ödemez; çalışan kazancının tamamını alır. Platform işletmeden düşük, sabit bir ücret alır."
            />
            <WhyCard
              iconPath="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              title="GPS doğrulamalı mesai"
              text="Giriş ve çıkış, işyerine uzaklıkla birlikte kayda geçer. Kim, ne zaman, nerede — tartışma değil, kayıt konuşur."
            />
            <WhyCard
              iconPath="M11.48 3.5a.56.56 0 0 1 1.04 0l2.13 5.11 5.52.44a.56.56 0 0 1 .32.99l-4.2 3.6 1.28 5.38a.56.56 0 0 1-.84.61L12 16.73l-4.73 2.9a.56.56 0 0 1-.84-.61l1.28-5.39-4.2-3.6a.56.56 0 0 1 .32-.98l5.52-.44 2.13-5.12Z"
              title="Çift yönlü puanlama"
              text="Sadece işletme adayı değil, çalışan da işletmeyi puanlar. Vardiyaya gelmeyenin de ücret geciktirenin de sicili görünür."
            />
            <WhyCard
              iconPath="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
              title="Belgeler güvende"
              text="CV, adli sicil, hijyen belgesi bir kez yüklenir; işletme ancak çalışanın onayıyla erişir. KVKK uyumlu."
            />
          </div>
        </div>
      </section>

      {/* ───── CTA band ───── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="rounded-xl px-6 py-12 text-center" style={{ background: 'var(--ah-brand)', color: '#ffffff' }}>
          <h2 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Kayıt iki dakika sürer.
          </h2>
          <p className="mt-2 text-[14px]" style={{ opacity: 0.85 }}>
            Çalışan veya işletme — bir sonraki vardiya buradan bulunur.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={() => openAuth()}
              className="text-[14px] font-bold px-7 py-3 rounded-lg transition-opacity hover:opacity-90"
              style={{ background: '#ffffff', color: 'var(--ah-brand)' }}>
              Hemen Kayıt Ol
            </button>
            <Link to="/login"
              className="text-[14px] font-semibold px-7 py-3 rounded-lg transition-colors"
              style={{ border: '1px solid rgba(255,255,255,0.45)', color: '#ffffff' }}>
              Giriş Yap
            </Link>
          </div>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer id="iletisim" style={{ background: 'var(--ah-card)', borderTop: '1px solid var(--ah-line)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-wrap items-center justify-between gap-4 text-[12px]"
             style={{ color: 'var(--ah-ink-3)' }}>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-base" style={{ color: 'var(--ah-ink)', letterSpacing: '-0.01em' }}>AjansHotel</span>
            <span className="text-[9px] uppercase tracking-[0.06em]" style={{ color: 'var(--ah-ink-4)' }}>istanbul</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link to="/kvkk" className="hover:underline" style={{ color: 'inherit' }}>KVKK</Link>
            <Link to="/terms" className="hover:underline" style={{ color: 'inherit' }}>Kullanım Koşulları</Link>
            <Link to="/yardim" className="hover:underline" style={{ color: 'inherit' }}>Yardım</Link>
            <a href="mailto:destek@ajanshotel.com" className="hover:underline" style={{ color: 'inherit' }}>destek@ajanshotel.com</a>
            <span style={{ color: 'var(--ah-ink-4)' }}>© 2026 AjansHotel</span>
          </div>
        </div>
      </footer>

      {/* Landing CTA'lardan açılan Auth Modal (rol pre-selected) */}
      <AuthModal open={authOpen} onClose={closeAuth} defaultRole={authRole} />
    </div>
  )
}

/* ── Ornek vardiya satiri (hero mock) ── */
function ShiftRow({ pos, time, wage }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg"
         style={{ background: 'var(--ah-page)', border: '1px solid var(--ah-line)' }}>
      <div className="min-w-0">
        <div className="font-semibold text-[13px] truncate" style={{ color: 'var(--ah-ink)' }}>{pos}</div>
        <div className="text-[11.5px] truncate mt-0.5" style={{ color: 'var(--ah-ink-3)' }}>{time}</div>
      </div>
      <span className="text-[11px] font-semibold px-2 py-1 rounded-md shrink-0"
            style={{ background: 'var(--ah-ok-soft)', color: 'var(--ah-ok)' }}>{wage}</span>
    </div>
  )
}

/* ── Nasil calisir — taraf karti ── */
function StepsCard({ title, steps }) {
  return (
    <div className="card">
      <div className="text-[11px] font-bold uppercase tracking-[0.06em] mb-5" style={{ color: 'var(--ah-brand)' }}>
        {title}
      </div>
      <ol className="space-y-5">
        {steps.map(([head, text], i) => (
          <li key={head} className="flex gap-3.5">
            <span className="w-7 h-7 rounded-full grid place-items-center text-[13px] font-bold flex-shrink-0"
                  style={{ background: 'var(--ah-brand-soft)', color: 'var(--ah-brand)' }}>
              {i + 1}
            </span>
            <div>
              <div className="font-semibold text-[14.5px]" style={{ color: 'var(--ah-ink)' }}>{head}</div>
              <p className="text-[13px] leading-relaxed mt-1" style={{ color: 'var(--ah-ink-3)' }}>{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

/* ── Neden karti ── */
function WhyCard({ iconPath, title, text }) {
  return (
    <div className="card">
      <div className="w-10 h-10 rounded-lg mb-4 grid place-items-center"
           style={{ background: 'var(--ah-brand-soft)' }}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
             strokeWidth={1.8} stroke="var(--ah-brand)" className="w-5 h-5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
      </div>
      <h3 className="text-[15px] font-bold mb-1.5" style={{ color: 'var(--ah-ink)', letterSpacing: '-0.01em' }}>{title}</h3>
      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ah-ink-3)' }}>{text}</p>
    </div>
  )
}
