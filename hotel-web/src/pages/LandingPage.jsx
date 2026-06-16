import { Link } from 'react-router-dom'
import DarkVeil from '../components/DarkVeil'
import HeroHeading from '../components/HeroHeading'
import RotatingText from '../components/RotatingText'

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
  return (
    <div className="min-h-screen bg-cream-100 text-ink-900">
      {/* Üst hat — sıcak gradient */}
      <div className="neon-strip" />

      {/* ───── Header ───── */}
      <header className="border-b border-cream-300 sticky top-0 z-30 bg-cream-100/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-display font-bold text-lg tracking-tight text-ink-900">
              AjansHotel
            </span>
            <span className="text-[9px] uppercase tracking-[0.18em] text-ink-400 font-medium">
              istanbul
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-[13px] text-ink-600 font-medium">
            <a href="#features" className="hover:text-brand-700 transition-colors">Özellikler</a>
            <a href="#demo"     className="hover:text-brand-700 transition-colors">Demo</a>
            <a href="#contact"  className="hover:text-brand-700 transition-colors">İletişim</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/login"
              className="text-[13px] font-medium px-4 py-1.5 rounded-full text-ink-700 hover:bg-cream-200 transition-colors">
              Giriş Yap
            </Link>
            <Link to="/register"
              className="text-[13px] font-semibold px-4 py-1.5 rounded-full text-white shadow-terra-sm hover:shadow-terra transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)' }}>
              Kayıt Ol
            </Link>
          </div>
        </div>
      </header>

      {/* ───── Hero (FAZ 5.4 — Dark Island) ───── */}
      <section className="relative overflow-hidden" style={{ background: '#0c1726', minHeight: '92vh' }}>
        {/* FAZ 5.4 — WebGL CPPN shader arka plan, mor brand'e hue-shift */}
        <DarkVeil hueShift={285} noiseIntensity={0.025} speed={0.45} warpAmount={0.35} />

        {/* Hafif vinyet — kenar koyu, merkez aydinlik */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none z-[1]"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 0%, rgba(10,6,24,0.65) 90%)',
          }}
        />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-32 lg:py-36">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Sol: baslik + CTA */}
            <div className="lg:col-span-7 animate-fade-up">
              <div className="inline-flex items-center gap-2 glass-panel rounded-full px-3 py-1.5 mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-glow-pulse" />
                <span className="text-[11px] uppercase tracking-widest font-semibold"
                      style={{ color: '#dde7f3' }}>
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
                    background: 'linear-gradient(135deg, #f7c43c 0%, #d4a853 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 0 24px rgba(212, 168, 83, 0.45))',
                  }}>
                    Hospitality
                  </span>
                </span>
                <span className="block text-white">platformu</span>
              </HeroHeading>

              {/* RotatingText alt baslik */}
              <div className="flex flex-wrap items-baseline gap-2 mb-7 mt-4 font-bebas uppercase tracking-wider text-3xl sm:text-4xl text-white/85">
                <span>Bugün</span>
                <RotatingText
                  texts={['GARSON', 'RESEPSIYON', 'BELLBOY', 'KAT HİZMETLERİ', 'BARİSTA']}
                  rotationInterval={2200}
                  className="text-brand-400 font-bebas"
                />
                <span>arıyor.</span>
              </div>

              <p className="text-base sm:text-lg leading-relaxed mb-9 max-w-xl"
                 style={{ color: '#fde9a5' }}>
                Hotel, restoran ve kafelerde günlük, sezonluk veya sürekli iş arıyorsan
                doğru yerdesin. Vardiya seç, başvur, mesajlaş — gerisini bize bırak.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 text-sm font-bold px-7 py-3 rounded-full text-white cta-glow transition-all hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(135deg, #d4a853 0%, #d4a853 100%)',
                  }}
                >
                  Hemen Başla
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                       strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-full glass-panel hover:bg-white/10 transition-colors"
                  style={{ color: '#dde7f3' }}
                >
                  Nasıl çalışır?
                </a>
              </div>

              {/* Trust strip */}
              <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs"
                   style={{ color: '#fde9a5' }}>
                {['KVKK uyumlu', 'Belge cüzdanı', 'Otomatik mesajlaşma'].map(label => (
                  <span key={label} className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"
                         style={{ color: '#d4a853' }}>
                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                    </svg>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Sag: gorsel kart — glass panel uzerinde */}
            <div className="lg:col-span-5 hidden lg:block animate-fade-up" style={{ animationDelay: '0.2s' }}>
              <div className="relative animate-float-y">
                <div className="glass-panel rounded-3xl p-7 shadow-glow-lg">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bebas text-2xl tracking-wider"
                         style={{ background: 'linear-gradient(135deg, #1e3a5f, #d4a853)' }}>
                      O
                    </div>
                    <div>
                      <div className="font-display text-base font-bold text-white">Conrad İstanbul</div>
                      <div className="text-xs" style={{ color: '#fde9a5' }}>Beşiktaş · 5 yıldız</div>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <ListingPreview pos="Garson" time="Cumartesi · 18:00–02:00" wage="₺550/vardiya" dark />
                    <ListingPreview pos="Resepsiyon" time="Pazar · 08:00–16:00" wage="₺480/vardiya" dark />
                    <ListingPreview pos="Bellboy" time="Hafta sonu · gece" wage="₺520/vardiya" dark />
                  </div>
                  <button className="w-full mt-5 py-2.5 rounded-full text-white text-sm font-semibold cta-glow transition-all"
                          style={{ background: 'linear-gradient(135deg, #d4a853 0%, #d4a853 100%)' }}>
                    3 vardiyaya başvur
                  </button>
                </div>

                <div className="absolute -bottom-4 -left-4 glass-panel rounded-2xl px-4 py-3 shadow-glow hidden xl:flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                  <span className="text-xs font-semibold text-white">Aday yazıyor…</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Features ───── */}
      <section id="features" className="border-t border-cream-300 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-full px-3 py-1 mb-5">
              <span className="text-[11px] uppercase tracking-widest text-brand-800 font-bold">Özellikler</span>
            </div>
            <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-ink-900 mb-3">
              İhtiyacın olan her şey,
              <span className="block text-brand-700 italic">tek platformda</span>
            </h2>
            <p className="text-base text-ink-600 max-w-2xl mx-auto">
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
      <section id="demo" className="border-t border-cream-300">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-ink-900 mb-4">
            Bir sonraki vardiyan
            <span className="block text-terra-500 italic">bir tık uzakta</span>
          </h2>
          <p className="text-base text-ink-600 mb-9 max-w-xl mx-auto">
            Aday veya işletme — kayıt 2 dakika. Aktif sezonda %78 başvuru kabul oranı.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/register"
              className="inline-flex items-center gap-2 text-base font-semibold px-7 py-3.5 rounded-full text-white shadow-terra hover:-translate-y-0.5 transition-all"
              style={{ background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)' }}>
              Hemen Kayıt Ol
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link to="/login"
              className="inline-flex items-center gap-2 text-base font-semibold px-7 py-3.5 rounded-full border-2 border-brand-700 text-brand-700 hover:bg-brand-50 transition-colors">
              Giriş Yap
            </Link>
          </div>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer id="contact" className="border-t border-cream-300 bg-cream-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-wrap items-center justify-between gap-4 text-xs text-ink-500">
          <div className="flex items-baseline gap-2">
            <span className="font-display font-bold text-base text-ink-700">AjansHotel</span>
            <span className="text-[9px] uppercase tracking-[0.18em] text-ink-400">istanbul</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link to="/kvkk" className="hover:text-brand-700 transition-colors">KVKK</Link>
            <a href="mailto:destek@ajanshotel.com" className="hover:text-brand-700 transition-colors">
              destek@ajanshotel.com
            </a>
            <span>© 2026 AjansHotel</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Feature({ iconPath, title, text }) {
  return (
    <div className="card hover:-translate-y-1 hover:shadow-glow transition-all">
      <div className="w-11 h-11 rounded-xl mb-4 grid place-items-center
                      bg-gradient-to-br from-brand-100 to-brand-50
                      border border-brand-200">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
             strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-brand-800">
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
      </div>
      <h3 className="font-display text-lg font-bold text-ink-900 mb-1.5">{title}</h3>
      <p className="text-sm text-ink-600 leading-relaxed">{text}</p>
    </div>
  )
}

function ListingPreview({ pos, time, wage, dark = false }) {
  if (dark) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl"
           style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(212, 168, 83,0.18)' }}>
        <div className="min-w-0">
          <div className="font-semibold text-sm text-white truncate">{pos}</div>
          <div className="text-[11px] truncate" style={{ color: '#fde9a5' }}>{time}</div>
        </div>
        <div className="text-sm font-bold shrink-0" style={{ color: '#f7c43c' }}>{wage}</div>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-cream-50 border border-cream-200">
      <div className="min-w-0">
        <div className="font-semibold text-sm text-ink-800 truncate">{pos}</div>
        <div className="text-[11px] text-ink-500 truncate">{time}</div>
      </div>
      <div className="text-sm font-bold text-brand-700 shrink-0">{wage}</div>
    </div>
  )
}
