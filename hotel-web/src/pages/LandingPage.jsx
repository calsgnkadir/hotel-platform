import { useState } from 'react'
import { Link } from 'react-router-dom'
import DarkVeil from '../components/DarkVeil'
import HeroHeading from '../components/HeroHeading'
import RotatingText from '../components/RotatingText'
import LandingPulse from '../components/LandingPulse'
import AuthModal from '../components/AuthModal'

/**
 * Landing v3 — "Hospitality Concierge" tasarım dili:
 *  - Krem (#faf7f2) sıcak zemin
 *  - Derin petrol/teal (#6B21A8) brand
 *  - Sıcak terracotta (#A855F7) CTA + accent
 *  - Inter (UI) + Fraunces (büyük başlıklar, "concierge" hissi)
 *
 * FAZ 5.4: Hero section "dark island" — DarkVeil WebGL shader + Bebas Neue
 * + RotatingText (Garson/Resepsiyon/...). Sayfanın geri kalanı krem temada kalır.
 */
export default function LandingPage() {
  const [authOpen, setAuthOpen] = useState(false)
  const [authRole, setAuthRole] = useState(null)
  const openAuth = (role = null) => { setAuthRole(role); setAuthOpen(true) }
  const closeAuth = () => setAuthOpen(false)
  return (
    <div className="min-h-screen legacy-dark" style={{ background: '#13110f', color: '#ede4d3' }}>
      {/* Champagne hairline strip */}
      <div className="neon-strip" />

      {/* ───── Header ───── */}
      <header className="sticky top-0 z-30 backdrop-blur-md"
              style={{
                background: 'rgba(19, 17, 15, 0.78)',
                borderBottom: '1px solid rgba(205, 183, 143, 0.08)',
              }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-semibold text-lg tracking-tight"
                  style={{ color: '#f5efe2', letterSpacing: '-0.015em' }}>
              AjansHotel
            </span>
            <span className="text-[9px] uppercase tracking-[0.28em] font-medium"
                  style={{ color: '#6b6358' }}>
              istanbul
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-[13px] font-medium"
               style={{ color: '#928678' }}>
            <a href="#features" className="transition-colors hover:text-[color:#cdb78f]">Özellikler</a>
            <a href="#demo"     className="transition-colors hover:text-[color:#cdb78f]">Demo</a>
            <a href="#contact"  className="transition-colors hover:text-[color:#cdb78f]">İletişim</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/login"
              className="text-[13px] font-medium px-4 py-1.5 rounded-full transition-colors"
              style={{ color: '#c9bdaa' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(205, 183, 143, 0.06)'; e.currentTarget.style.color = '#ede4d3' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#c9bdaa' }}>
              Giriş Yap
            </Link>
            <button type="button" onClick={openAuth}
              className="text-[13px] font-semibold px-4 py-1.5 rounded-full transition-all hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)',
                color: '#1a1208',
                boxShadow: '0 8px 20px rgba(205, 183, 143, 0.22), inset 0 1px 0 rgba(255,255,255,0.24)',
              }}>
              Kayıt Ol
            </button>
          </div>
        </div>
      </header>

      {/* ───── Hero (FAZ 5.UX3 — Editorial Dark Luxe) ───── */}
      <section className="relative overflow-hidden" style={{ minHeight: '92vh', background: '#13110f' }}>
        {/* WebGL CPPN shader — warm hue (champagne range, not purple) */}
        <DarkVeil hueShift={35} noiseIntensity={0.02} speed={0.40} warpAmount={0.30} />

        {/* Warm graphite vinyet — kenar koyu, merkez aydinlik */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none z-[1]"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 0%, rgba(13, 11, 9, 0.72) 90%)',
          }}
        />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-32 lg:py-36">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Sol: baslik + CTA */}
            <div className="lg:col-span-7 animate-fade-up">
              <div className="inline-flex items-center gap-2 glass-panel rounded-full px-3 py-1.5 mb-8">
                <span className="w-1.5 h-1.5 rounded-full animate-glow-pulse"
                      style={{ background: '#cdb78f', boxShadow: '0 0 8px rgba(205, 183, 143, 0.55)' }} />
                <span className="text-[10px] uppercase tracking-[0.28em] font-medium"
                      style={{ color: '#c9bdaa' }}>
                  Yeni Sezon Açık
                </span>
              </div>

              {/* Hero baslik — Bebas Neue + stratejik vurgu */}
              <HeroHeading
                size="xl"
                align="left"
                className="mb-3 hero-glow"
              >
                <span className="block text-white">İstanbul'un</span>
                <span className="block">
                  <span style={{
                    background: 'linear-gradient(135deg, #cdb78f 0%, #d4a853 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 0 24px rgba(205, 183, 143, 0.35))',
                  }}>
                    Hospitality
                  </span>
                </span>
                <span className="block text-white">platformu</span>
              </HeroHeading>

              {/* RotatingText alt baslik */}
              <div className="flex flex-wrap items-baseline gap-2 mb-7 mt-4 uppercase tracking-wider text-3xl sm:text-4xl"
                   style={{ color: '#ede4d3' }}>
                <span>Bugün</span>
                <RotatingText
                  texts={['GARSON', 'RESEPSIYON', 'BELLBOY', 'KAT HİZMETLERİ', 'BARİSTA']}
                  rotationInterval={2200}
                  className=""
                  style={{ color: '#cdb78f' }}
                />
                <span>arıyor.</span>
              </div>

              <p className="text-base sm:text-lg leading-relaxed mb-10 max-w-xl"
                 style={{ color: '#c9bdaa' }}>
                Hotel, restoran ve kafelerde günlük, sezonluk veya sürekli iş arıyorsan
                doğru yerdesin. Vardiya seç, başvur, mesajlaş — gerisini bize bırak.
              </p>

              {/* Dual CTA — primary (gold) + secondary (champagne hairline) */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button type="button" onClick={() => openAuth('CANDIDATE')}
                  className="group flex-1 sm:flex-initial sm:min-w-[220px] inline-flex items-center justify-between gap-3 text-left px-5 py-4 rounded-2xl transition-all hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)',
                    boxShadow: '0 14px 36px rgba(205, 183, 143, 0.28), inset 0 1px 0 rgba(255,255,255,0.24)',
                    color: '#1a1208',
                  }}>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] font-semibold opacity-70">Aday için</div>
                    <div className="text-base font-semibold mt-0.5">İş arıyorum</div>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                       className="group-hover:translate-x-1 transition-transform" aria-hidden="true">
                    <path d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </button>
                <button type="button" onClick={() => openAuth('BUSINESS_OWNER')}
                  className="group flex-1 sm:flex-initial sm:min-w-[220px] inline-flex items-center justify-between gap-3 text-left px-5 py-4 rounded-2xl transition-all hover:-translate-y-0.5"
                  style={{
                    background: 'rgba(205, 183, 143, 0.06)',
                    border: '1px solid rgba(205, 183, 143, 0.32)',
                    color: '#ede4d3',
                  }}>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] font-semibold" style={{ color: '#928678' }}>İşletme için</div>
                    <div className="text-base font-semibold mt-0.5">Eleman arıyorum</div>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                       className="group-hover:translate-x-1 transition-transform" aria-hidden="true">
                    <path d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </div>
              <div className="mt-4">
                <a href="#features"
                   className="inline-flex items-center gap-2 text-[12px] font-medium px-4 py-2 rounded-full glass-panel transition-colors"
                   style={{ color: '#c9bdaa' }}
                   onMouseEnter={(e) => { e.currentTarget.style.color = '#ede4d3' }}
                   onMouseLeave={(e) => { e.currentTarget.style.color = '#c9bdaa' }}>
                  Nasıl çalışır?
                </a>
              </div>

              {/* Trust strip */}
              <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-[11px]"
                   style={{ color: '#928678' }}>
                {['KVKK uyumlu', 'Belge cüzdanı', 'Otomatik mesajlaşma'].map(label => (
                  <span key={label} className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"
                         style={{ color: '#cdb78f' }}>
                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                    </svg>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Sag: pulse widget + gorsel kart — glass panel uzerinde */}
            <div className="lg:col-span-5 hidden lg:block animate-fade-up space-y-5" style={{ animationDelay: '0.2s' }}>
              {/* FAZ G.8 — Canli "Vardiya Nabzi" widget — manifesto'nun kalbi */}
              <LandingPulse />

              <div className="relative animate-float-y">
                <div className="glass-panel p-7"
                     style={{ borderRadius: '28px 12px 28px 12px' }}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-semibold"
                         style={{
                           background: 'rgba(205, 183, 143, 0.08)',
                           border: '1px solid rgba(205, 183, 143, 0.30)',
                           color: '#cdb78f',
                         }}>
                      C
                    </div>
                    <div>
                      <div className="text-base font-semibold" style={{ color: '#f5efe2', letterSpacing: '-0.015em' }}>Conrad İstanbul</div>
                      <div className="text-[11px] mt-0.5" style={{ color: '#928678' }}>Beşiktaş · 5 yıldız</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <ListingPreview pos="Garson" time="Cumartesi · 18:00–02:00" wage="₺550/vardiya" dark />
                    <ListingPreview pos="Resepsiyon" time="Pazar · 08:00–16:00" wage="₺480/vardiya" dark />
                    <ListingPreview pos="Bellboy" time="Hafta sonu · gece" wage="₺520/vardiya" dark />
                  </div>
                  <button className="w-full mt-6 py-3 rounded-2xl text-[13px] font-semibold uppercase tracking-[0.14em] transition-all hover:-translate-y-0.5"
                          style={{
                            background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)',
                            color: '#1a1208',
                            boxShadow: '0 12px 28px rgba(205, 183, 143, 0.22), inset 0 1px 0 rgba(255,255,255,0.22)',
                          }}>
                    3 vardiyaya başvur
                  </button>
                </div>

                <div className="absolute -bottom-4 -left-4 glass-panel rounded-2xl px-4 py-3 hidden xl:flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full animate-pulse"
                       style={{ background: '#cdb78f', boxShadow: '0 0 8px rgba(205, 183, 143, 0.55)' }} />
                  <span className="text-[11px] font-medium" style={{ color: '#ede4d3' }}>Aday yazıyor…</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Features ───── */}
      <section id="features"
               style={{
                 background: '#13110f',
                 borderTop: '1px solid rgba(205, 183, 143, 0.08)',
               }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-24">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-6"
                 style={{
                   background: 'rgba(205, 183, 143, 0.08)',
                   border: '1px solid rgba(205, 183, 143, 0.22)',
                 }}>
              <span className="text-[10px] uppercase tracking-[0.28em] font-semibold"
                    style={{ color: '#cdb78f' }}>Özellikler</span>
            </div>
            <h2 className="mb-4"
                style={{
                  color: '#f5efe2',
                  fontSize: 'clamp(32px, 5vw, 48px)',
                  fontWeight: 600,
                  letterSpacing: '-0.025em',
                  lineHeight: 1.05,
                }}>
              İhtiyacın olan her şey,
              <span className="block italic"
                    style={{ color: '#cdb78f', fontWeight: 600 }}>tek platformda</span>
            </h2>
            <p className="text-[15px] max-w-2xl mx-auto leading-relaxed"
               style={{ color: '#928678' }}>
              Belge cüzdanı, otomatik mesajlaşma, sesli/görüntülü arama — başvuru hiç bu kadar
              insani olmamıştı.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <Feature
              iconPath="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"
              title="Vardiya bazlı başvuru"
              text="Tek bir ilana değil, çalışabileceğin spesifik vardiyalara başvurursun."
            />
            <Feature
              iconPath="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
              title="Otomatik mesajlaşma"
              text="Başvur, mesajlaşma otomatik açılır. Belge ve fotoları sohbetten paylaş."
            />
            <Feature
              iconPath="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
              title="Sesli + görüntülü arama"
              text="Jitsi entegrasyonu ile mesaj kompozerinden tek tıkla arama başlat."
            />
            <Feature
              iconPath="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
              title="Belge cüzdanı"
              text="CV, transkript, sertifika — bir kez yükle, her başvuruda otomatik paylaş."
            />
            <Feature
              iconPath="m15 10.5-4.5-3v9l4.5-3m6.75 0a9.75 9.75 0 1 1-19.5 0 9.75 9.75 0 0 1 19.5 0Z"
              title="İstanbul haritası"
              text="İlanları harita üzerinde keşfet, ulaşımına göre filtrele."
            />
            <Feature
              iconPath="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
              title="KVKK koruması"
              text="Hassas belgelere işveren ancak senin onayınla erişebilir."
            />
          </div>
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section id="demo"
               style={{
                 background: '#1b1815',
                 borderTop: '1px solid rgba(205, 183, 143, 0.08)',
               }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-24 text-center">
          <h2 className="mb-5"
              style={{
                color: '#f5efe2',
                fontSize: 'clamp(32px, 5vw, 48px)',
                fontWeight: 600,
                letterSpacing: '-0.025em',
                lineHeight: 1.05,
              }}>
            Bir sonraki vardiyan
            <span className="block italic" style={{ color: '#cdb78f' }}>bir tık uzakta</span>
          </h2>
          <p className="text-[15px] mb-10 max-w-xl mx-auto leading-relaxed"
             style={{ color: '#928678' }}>
            Aday veya işletme — kayıt 2 dakika. Aktif sezonda %78 başvuru kabul oranı.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={openAuth}
              className="inline-flex items-center gap-2 text-[14px] font-semibold uppercase tracking-[0.14em] px-8 py-4 rounded-2xl hover:-translate-y-0.5 transition-all"
              style={{
                background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)',
                color: '#1a1208',
                boxShadow: '0 14px 36px rgba(205, 183, 143, 0.28), inset 0 1px 0 rgba(255,255,255,0.24)',
              }}>
              Hemen Kayıt Ol
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </button>
            <Link to="/login"
              className="inline-flex items-center gap-2 text-[14px] font-semibold uppercase tracking-[0.14em] px-8 py-4 rounded-2xl transition-colors"
              style={{
                background: 'transparent',
                border: '1px solid rgba(205, 183, 143, 0.32)',
                color: '#ede4d3',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(205, 183, 143, 0.06)'; e.currentTarget.style.borderColor = 'rgba(205, 183, 143, 0.55)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(205, 183, 143, 0.32)' }}>
              Giriş Yap
            </Link>
          </div>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer id="contact"
              style={{
                background: '#13110f',
                borderTop: '1px solid rgba(205, 183, 143, 0.08)',
              }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-wrap items-center justify-between gap-4 text-[11px]"
             style={{ color: '#6b6358' }}>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-base" style={{ color: '#ede4d3', letterSpacing: '-0.01em' }}>AjansHotel</span>
            <span className="text-[9px] uppercase tracking-[0.28em]" style={{ color: '#6b6358' }}>istanbul</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link to="/kvkk" className="transition-colors hover:text-[color:#cdb78f]" style={{ color: '#928678' }}>KVKK</Link>
            <a href="mailto:destek@ajanshotel.com" className="transition-colors hover:text-[color:#cdb78f]" style={{ color: '#928678' }}>
              destek@ajanshotel.com
            </a>
            <span>© 2026 AjansHotel</span>
          </div>
        </div>
      </footer>

      {/* Dalga 2/4 — Landing CTA'lardan açılan Auth Modal (rol pre-selected) */}
      <AuthModal open={authOpen} onClose={closeAuth} defaultRole={authRole} />
    </div>
  )
}

function Feature({ iconPath, title, text }) {
  return (
    <div className="card hover:-translate-y-1 transition-all">
      <div className="w-11 h-11 rounded-2xl mb-5 grid place-items-center"
           style={{
             background: 'rgba(205, 183, 143, 0.08)',
             border: '1px solid rgba(205, 183, 143, 0.22)',
           }}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
             strokeWidth={1.6} stroke="#cdb78f" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
      </div>
      <h3 className="text-base font-semibold mb-2"
          style={{ color: '#f5efe2', letterSpacing: '-0.015em' }}>{title}</h3>
      <p className="text-[13px] leading-relaxed" style={{ color: '#928678' }}>{text}</p>
    </div>
  )
}

function ListingPreview({ pos, time, wage, dark = false }) {
  if (dark) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-colors"
           style={{ background: 'rgba(205, 183, 143, 0.05)', border: '1px solid rgba(205, 183, 143, 0.10)' }}>
        <div className="min-w-0">
          <div className="font-semibold text-[13px] truncate" style={{ color: '#ede4d3' }}>{pos}</div>
          <div className="text-[11px] truncate mt-0.5" style={{ color: '#928678' }}>{time}</div>
        </div>
        <div className="text-[13px] font-semibold tabular-nums shrink-0" style={{ color: '#cdb78f' }}>{wage}</div>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl"
         style={{ background: 'rgba(205, 183, 143, 0.05)', border: '1px solid rgba(205, 183, 143, 0.10)' }}>
      <div className="min-w-0">
        <div className="font-semibold text-[13px] truncate" style={{ color: '#ede4d3' }}>{pos}</div>
        <div className="text-[11px] truncate mt-0.5" style={{ color: '#928678' }}>{time}</div>
      </div>
      <div className="text-[13px] font-semibold tabular-nums shrink-0" style={{ color: '#cdb78f' }}>{wage}</div>
    </div>
  )
}
