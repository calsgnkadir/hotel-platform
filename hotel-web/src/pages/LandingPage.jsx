import { Link } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'

/**
 * #90: Genel tanıtım sayfası (Perdeno tarzı, light/dark uyumlu).
 * Hero · Özellikler · Demo CTA · Footer.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      {/* ───── Header ───── */}
      <header className="border-b border-slate-100 dark:border-slate-800 sticky top-0 z-10 bg-white/90 dark:bg-slate-950/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-700 flex items-center justify-center">
              <span className="text-white text-sm font-bold">A</span>
            </div>
            <span className="font-semibold text-sm tracking-tight">AjansHotel</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-7 text-[13px] text-slate-600 dark:text-slate-400">
            <a href="#features" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">Özellikler</a>
            <a href="#demo"     className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">Demo</a>
            <a href="#contact"  className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">İletişim</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/login"
              className="text-[13px] font-medium px-3 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
              Giriş
            </Link>
            <Link to="/register"
              className="text-[13px] font-semibold px-3.5 py-1.5 rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors">
              Panel
            </Link>
          </div>
        </div>
      </header>

      {/* ───── Hero ───── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-up">
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/40 px-2.5 py-1 rounded-full">
                Otel & Restoran
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                İstanbul Pazarı
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1] tracking-tight">
              AjansHotel — başvurudan{' '}
              <span className="text-brand-700 dark:text-brand-400">çalışmaya tek ekranda</span>
            </h1>
            <p className="mt-5 text-[15px] text-slate-600 dark:text-slate-400 leading-relaxed max-w-md">
              İstanbul'daki hoteller, restoranlar ve kafelerde günlük veya aylık iş arayan
              adaylarla işletmeleri buluşturan platform — başvuru, mesajlaşma, vardiya planı,
              puanlama tek panelde.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/login"
                className="inline-flex items-center gap-2 text-[13px] font-semibold px-5 py-2.5 rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors shadow-sm">
                Demoyu Aç
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                     strokeWidth={2.2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </Link>
              <a href="#features"
                className="text-[13px] font-semibold px-5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Özelliklere Bak
              </a>
            </div>
            {/* Mini stats */}
            <div className="mt-9 grid grid-cols-3 gap-3 max-w-md">
              {[
                { v: '3', l: 'Rol Tipi' },
                { v: '39', l: 'İstanbul İlçesi' },
                { v: '7/24', l: 'Bildirim' },
              ].map(s => (
                <div key={s.l} className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-slate-900 dark:text-slate-100">{s.v}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero görsel — placeholder gradient kart */}
          <div className="animate-fade-up">
            <div className="relative aspect-[5/4] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-gradient-to-br from-brand-50 via-white to-brand-100 dark:from-brand-900/20 dark:via-slate-900 dark:to-brand-900/20 flex items-center justify-center">
              {/* mock pano: 3 metrik kart */}
              <div className="grid grid-cols-2 gap-3 p-6 w-full max-w-md">
                <MockCard label="Bu Ay" value="47" trend="↑ %38" color="text-brand-700 dark:text-brand-400" />
                <MockCard label="Kabul" value="62%" trend="başvuru kabul" color="text-emerald-600 dark:text-emerald-400" />
                <MockCard label="Yanıt"  value="6.9 sa" trend="ortalama" color="text-brand-700 dark:text-brand-400" />
                <MockCard label="Aktif İlan" value="12" trend="yayında" color="text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Features ───── */}
      <section id="features" className="border-t border-slate-100 dark:border-slate-800 py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Tek panelde her şey</h2>
            <p className="mt-3 text-[14px] text-slate-600 dark:text-slate-400">
              İlan açmaktan başvuru kabul etmeye, mesajlaşmaya ve raporlamaya kadar
              uçtan uca iş akışı.
            </p>
          </div>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(f => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ───── Demo CTA ───── */}
      <section id="demo" className="border-t border-slate-100 dark:border-slate-800 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Demo ile hemen tanı</h2>
          <p className="mt-3 text-[14px] text-slate-600 dark:text-slate-400">
            Aşağıdaki hesaplarla giriş yap ve dolu bir sistemde aday/işletme akışlarını gez.
          </p>

          <div className="mt-8 grid sm:grid-cols-2 gap-4 text-left">
            <DemoAccount role="Aday" email="demo-aday1@test.com" pwd="Demo1234!" />
            <DemoAccount role="İşletme" email="demo-isletme1@test.com" pwd="Demo1234!" />
          </div>

          <Link to="/login"
            className="inline-flex items-center gap-2 mt-9 text-[13px] font-semibold px-6 py-3 rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors shadow-sm">
            Demoyu Aç
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 strokeWidth={2.2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer id="contact" className="border-t border-slate-100 dark:border-slate-800 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-[12px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-brand-700 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">A</span>
            </div>
            <span>AjansHotel · İstanbul</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/kvkk" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">KVKK</Link>
            <a href="https://github.com/calsgnkadir/hotel-platform"
              target="_blank" rel="noreferrer"
              className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ── Yardımcılar ── */

function MockCard({ label, value, trend, color }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</div>
      <div className={`text-xl font-bold mt-1 ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-400 mt-0.5">{trend}</div>
    </div>
  )
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 bg-white dark:bg-slate-900 hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 flex items-center justify-center mb-3">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
             strokeWidth={1.8} stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <h3 className="text-[14px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">{desc}</p>
    </div>
  )
}

function DemoAccount({ role, email, pwd }) {
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400 mb-2">
        {role}
      </div>
      <KV k="E-posta" v={email} />
      <KV k="Şifre"   v={pwd} />
    </div>
  )
}

function KV({ k, v }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12px] py-1 border-t border-slate-100 dark:border-slate-800 first:border-0">
      <span className="text-slate-500 dark:text-slate-400">{k}</span>
      <code className="font-mono text-slate-800 dark:text-slate-200">{v}</code>
    </div>
  )
}

const FEATURES = [
  {
    title: 'Vardiya bazlı ilan',
    desc:  'Tarih + saat + ihtiyaç sayısı. Aday istediği slot(lar)a başvurur, doluluk anlık.',
    icon:  'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
  },
  {
    title: 'Mesajlaşma',
    desc:  'Kabul edilen başvurudan sonra aday ↔ işletme doğrudan iletişim. Okundu bilgisi, 5 sn polling.',
    icon:  'M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z',
  },
  {
    title: 'Akıllı eşleştirme',
    desc:  'Aday ilçe + pozisyon tercihlerini seçer. Eşleşen yeni ilanlar bildirim olarak düşer.',
    icon:  'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z',
  },
  {
    title: 'İki yönlü puanlama',
    desc:  'Çalışma bittikten sonra aday işletmeyi puanlar. Ortalama yıldız ilana yansır.',
    icon:  'M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z',
  },
  {
    title: 'Galeri + carousel',
    desc:  'İşletme fotoğrafları, drag-drop sıralama, kapak seçimi. Aday ilana bakarken carousel.',
    icon:  'm2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Z',
  },
  {
    title: 'Canlı dashboard',
    desc:  'Trend grafikleri, kabul/red oranları, pozisyon dağılımı. Ortalama yanıt süresi.',
    icon:  'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z',
  },
]
