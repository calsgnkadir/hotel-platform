import { Link } from 'react-router-dom'

/**
 * Landing v3 — "Hospitality Concierge" tasarım dili:
 *  - Krem (#faf7f2) sıcak zemin
 *  - Derin petrol/teal (#0F766E) brand
 *  - Sıcak terracotta (#E07856) CTA + accent
 *  - Inter (UI) + Fraunces (büyük başlıklar, "concierge" hissi)
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
              style={{ background: 'linear-gradient(135deg, #e07856 0%, #d05f3a 100%)' }}>
              Kayıt Ol
            </Link>
          </div>
        </div>
      </header>

      {/* ───── Hero ───── */}
      <section className="relative overflow-hidden">
        {/* Sıcak spotlight blob arka plan */}
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[5%] w-[55%] h-[450px] rounded-full bg-terra-200/40 blur-[120px]" />
          <div className="absolute top-[40%] right-[-5%] w-[40%] h-[400px] rounded-full bg-brand-200/30 blur-[100px]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Sol: başlık + CTA */}
            <div className="lg:col-span-7 animate-fade-up">
              <div className="inline-flex items-center gap-2 bg-white border border-cream-300 rounded-full px-3 py-1.5 mb-7 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-terra-400 animate-glow-pulse" />
                <span className="text-[11px] uppercase tracking-widest text-ink-600 font-semibold">
                  Yeni Sezon Açık
                </span>
              </div>

              <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
                İstanbul'un
                <span className="block text-brand-700 italic">hospitality</span>
                <span className="block">iş eşleştirmesi</span>
              </h1>

              <p className="text-lg text-ink-600 max-w-xl leading-relaxed mb-9">
                Hotel, restoran ve kafelerde günlük, sezonluk veya sürekli iş arıyorsan
                doğru yerdesin. Vardiya seç, başvur, mesajlaş — gerisini bize bırak.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Link to="/register"
                  className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-full text-white shadow-terra hover:-translate-y-0.5 transition-all"
                  style={{ background: 'linear-gradient(135deg, #e07856 0%, #d05f3a 100%)' }}>
                  Hemen Başla
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                       strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <a href="#features"
                  className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-full border-2 border-brand-700 text-brand-700 hover:bg-brand-50 transition-colors">
                  Nasıl çalışır?
                </a>
              </div>

              {/* Trust strip */}
              <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs text-ink-500">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-brand-700" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                  </svg>
                  KVKK uyumlu
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-brand-700" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                  </svg>
                  Belge cüzdanı
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-brand-700" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                  </svg>
                  Otomatik mesajlaşma
                </span>
              </div>
            </div>

            {/* Sağ: görsel kart */}
            <div className="lg:col-span-5 hidden lg:block animate-fade-up" style={{ animationDelay: '0.2s' }}>
              <div className="relative">
                {/* Ana kart */}
                <div className="bg-white rounded-3xl p-7 shadow-glow-lg border border-cream-300">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-display text-xl"
                         style={{ background: 'linear-gradient(135deg, #0f766e, #0d9488)' }}>
                      O
                    </div>
                    <div>
                      <div className="font-display text-base font-bold text-ink-900">Conrad İstanbul</div>
                      <div className="text-xs text-ink-500">Beşiktaş · 5 yıldız</div>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <ListingPreview pos="Garson" time="Cumartesi · 18:00–02:00" wage="₺550/vardiya" />
                    <ListingPreview pos="Resepsiyon" time="Pazar · 08:00–16:00" wage="₺480/vardiya" />
                    <ListingPreview pos="Bellboy" time="Hafta sonu · gece" wage="₺520/vardiya" />
                  </div>
                  <button className="w-full mt-5 py-2.5 rounded-full text-white text-sm font-semibold shadow-terra-sm hover:shadow-terra transition-all"
                          style={{ background: 'linear-gradient(135deg, #e07856 0%, #d05f3a 100%)' }}>
                    3 vardiyaya başvur
                  </button>
                </div>

                {/* Floating badge */}
                <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl px-4 py-3 shadow-glow border border-cream-300 hidden xl:flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                  <span className="text-xs font-semibold text-ink-700">Aday yazıyor...</span>
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
              icon="📋"
              title="Vardiya bazlı başvuru"
              text="Tek bir ilana değil, çalışabileceğin spesifik vardiyalara başvurursun."
            />
            <Feature
              icon="💬"
              title="Otomatik mesajlaşma"
              text="Başvur, mesajlaşma otomatik açılır. Belge ve fotoları sohbetten paylaş."
            />
            <Feature
              icon="📞"
              title="Sesli + görüntülü arama"
              text="Jitsi entegrasyonu ile mesaj kompozerinden tek tıkla arama başlat."
            />
            <Feature
              icon="🗂"
              title="Belge cüzdanı"
              text="CV, transkript, sertifika — bir kez yükle, her başvuruda otomatik paylaş."
            />
            <Feature
              icon="🗺"
              title="İstanbul haritası"
              text="İlanları harita üzerinde keşfet, ulaşımına göre filtrele."
            />
            <Feature
              icon="🔒"
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
              style={{ background: 'linear-gradient(135deg, #e07856 0%, #d05f3a 100%)' }}>
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

function Feature({ icon, title, text }) {
  return (
    <div className="card hover:-translate-y-1 hover:shadow-glow transition-all">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-display text-lg font-bold text-ink-900 mb-1.5">{title}</h3>
      <p className="text-sm text-ink-600 leading-relaxed">{text}</p>
    </div>
  )
}

function ListingPreview({ pos, time, wage }) {
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
