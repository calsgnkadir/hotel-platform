import { Link } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'

/**
 * Landing — Hibrit tasarım: Wordplay (dev başlık + sağ leaderboard) +
 * StoryHell (pill butonlar, dark) + Randex (soft kutucuk) karışımı.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink-900 text-slate-100">
      {/* Neon yeşil üst hat */}
      <div className="neon-strip" />

      {/* ───── Header ───── */}
      <header className="border-b border-slate-800/60 sticky top-0 z-30 bg-ink-900/85 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glow-sm">
              <span className="text-white text-sm font-black">A</span>
            </div>
            <span className="font-bold text-sm tracking-tight">AjansHotel</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-[13px] text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Özellikler</a>
            <a href="#demo"     className="hover:text-white transition-colors">Demo</a>
            <a href="#contact"  className="hover:text-white transition-colors">İletişim</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/login"
              className="text-[13px] font-medium px-4 py-1.5 rounded-full text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
              Giriş Yap
            </Link>
            <Link to="/register"
              className="text-[13px] font-semibold px-4 py-1.5 rounded-full text-white shadow-glow-sm hover:shadow-glow transition-all"
              style={{ background: 'linear-gradient(135deg, #047857, #10b981)' }}>
              Kayıt Ol
            </Link>
          </div>
        </div>
      </header>

      {/* ───── Hero ───── */}
      <section className="relative overflow-hidden">
        {/* spotlight blob arka plan */}
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[5%] w-[55%] h-[450px] rounded-full bg-brand-600/20 blur-[120px]" />
          <div className="absolute top-[40%] right-[-5%] w-[40%] h-[400px] rounded-full bg-emerald-500/15 blur-[100px]" />
          <div className="absolute inset-0 opacity-[0.04]"
               style={{
                 backgroundImage: 'linear-gradient(to right, #10b981 1px, transparent 1px), linear-gradient(to bottom, #10b981 1px, transparent 1px)',
                 backgroundSize: '60px 60px'
               }} />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            {/* Sol: dev başlık + CTA */}
            <div className="lg:col-span-7 animate-fade-up">
              <div className="inline-flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-full px-3 py-1 mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-glow-pulse" />
                <span className="text-[11px] uppercase tracking-widest text-slate-300">Yeni Sezon Aktif</span>
              </div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight uppercase">
                <span className="block text-white">AjansHotel'e</span>
                <span className="block bg-gradient-to-r from-emerald-300 via-emerald-400 to-brand-500 bg-clip-text text-transparent">
                  Hoş Geldin
                </span>
              </h1>
              <p className="mt-7 text-[15px] text-slate-400 leading-relaxed max-w-lg">
                İstanbul'daki <b className="text-slate-200">hoteller, restoranlar ve kafelerde</b> günlük
                veya aylık iş arayan adaylarla işletmeleri buluşturan platform. Başvuru, mesajlaşma,
                vardiya planı ve puanlama tek panelde.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link to="/login"
                  className="inline-flex items-center gap-2 text-[14px] font-bold px-7 py-3.5 rounded-full text-white transition-all shadow-glow hover:shadow-glow-lg hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg, #047857, #10b981)' }}>
                  Demoyu Aç
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                       strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <a href="#features"
                  className="inline-flex items-center gap-2 text-[14px] font-semibold px-7 py-3.5 rounded-full border border-slate-700 text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition-all">
                  Özellikleri Gör
                </a>
              </div>

              {/* Trust chips */}
              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-slate-500">
                <TrustChip>KVKK Uyumlu</TrustChip>
                <TrustChip>Güvenli Oturum</TrustChip>
                <TrustChip>Reklamsız</TrustChip>
              </div>
            </div>

            {/* Sağ: Wordplay tarzı leaderboard / live activity kartı */}
            <div className="lg:col-span-5 animate-fade-up">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur p-5 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Bu Hafta</div>
                    <div className="text-base font-bold text-white">En Aktif İlanlar</div>
                  </div>
                  <button className="text-[11px] text-slate-400 hover:text-white transition-colors px-3 py-1 rounded-full border border-slate-700">
                    Tümünü Gör
                  </button>
                </div>
                <div className="space-y-2">
                  <LeaderRow rank={1} title="Garson · Beyoğlu" sub="Park Otel" count="42 başvuru" hot />
                  <LeaderRow rank={2} title="Resepsiyonist · Şişli" sub="Bosphorus Suite" count="38 başvuru" />
                  <LeaderRow rank={3} title="Barista · Kadıköy" sub="Caffeine Lab" count="29 başvuru" />
                  <LeaderRow rank={4} title="Komi · Beşiktaş" sub="Marina Restaurant" count="24 başvuru" />
                  <LeaderRow rank={5} title="Aşçı Yard. · Üsküdar" sub="Boğaz Restoran" count="19 başvuru" />
                </div>
                <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500">Son güncelleme: az önce</div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-glow-pulse" />
                    <span className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider">Canlı</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Alt istatistik bandı */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
            <StatPill v="3" l="Rol Tipi" />
            <StatPill v="39" l="İstanbul İlçesi" />
            <StatPill v="7/24" l="Bildirim" />
            <StatPill v="0₺" l="Komisyon" />
          </div>
        </div>
      </section>

      {/* ───── Features ───── */}
      <section id="features" className="relative border-t border-slate-800/60 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-[11px] uppercase tracking-widest text-emerald-400 font-bold mb-3">Platform Özellikleri</div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Tek panelde her şey</h2>
            <p className="mt-4 text-[14px] text-slate-400 leading-relaxed">
              İlan açmaktan başvuru kabul etmeye, mesajlaşmaya ve raporlamaya kadar uçtan uca iş akışı.
            </p>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(f => <FeatureCard key={f.title} {...f} />)}
          </div>
        </div>
      </section>

      {/* ───── Demo CTA ───── */}
      <section id="demo" className="relative border-t border-slate-800/60 py-20 sm:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-ink-900 p-10 sm:p-14 text-center relative overflow-hidden">
            <div aria-hidden className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="relative">
              <div className="text-[11px] uppercase tracking-widest text-emerald-400 font-bold mb-3">Hızlı Başlangıç</div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">Demo ile hemen tanı</h2>
              <p className="mt-4 text-[14px] text-slate-400">
                Aşağıdaki hesaplarla giriş yap, dolu bir sistemde aday ve işletme akışlarını gez.
              </p>

              <div className="mt-9 grid sm:grid-cols-2 gap-4 text-left">
                <DemoAccount role="Aday Hesabı"    email="demo-aday1@test.com"    pwd="Demo1234!" />
                <DemoAccount role="İşletme Hesabı" email="demo-isletme1@test.com" pwd="Demo1234!" />
              </div>

              <Link to="/login"
                className="inline-flex items-center gap-2 mt-10 text-[14px] font-bold px-8 py-3.5 rounded-full text-white shadow-glow hover:shadow-glow-lg transition-all"
                style={{ background: 'linear-gradient(135deg, #047857, #10b981)' }}>
                Demoyu Aç
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                     strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer id="contact" className="border-t border-slate-800/60 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-[12px] text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <span className="text-white text-[10px] font-black">A</span>
            </div>
            <span>AjansHotel · İstanbul · 2026</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/kvkk" className="hover:text-slate-200 transition-colors">KVKK</Link>
            <a href="https://github.com/calsgnkadir/hotel-platform"
              target="_blank" rel="noreferrer"
              className="hover:text-slate-200 transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ─────────── Yardımcılar ─────────── */

function TrustChip({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd"
          d="M16.704 5.29a1 1 0 010 1.42l-8 8a1 1 0 01-1.41 0l-4-4a1 1 0 011.41-1.42L8 12.59l7.29-7.3a1 1 0 011.414 0z"
          clipRule="evenodd" />
      </svg>
      {children}
    </span>
  )
}

function LeaderRow({ rank, title, sub, count, hot }) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800/60 transition-colors">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black flex-shrink-0
        ${rank === 1 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
          rank === 2 ? 'bg-slate-700 text-slate-200 border border-slate-600' :
          rank === 3 ? 'bg-orange-700/30 text-orange-300 border border-orange-700/40' :
                      'bg-slate-800 text-slate-400 border border-slate-700'}`}>
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-white truncate flex items-center gap-2">
          {title}
          {hot && (
            <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
              Hot
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-500 truncate">{sub}</div>
      </div>
      <div className="text-[11px] text-emerald-400 font-bold whitespace-nowrap">{count}</div>
    </div>
  )
}

function StatPill({ v, l }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-4 text-center">
      <div className="text-2xl sm:text-3xl font-black bg-gradient-to-br from-emerald-300 to-brand-500 bg-clip-text text-transparent">
        {v}
      </div>
      <div className="text-[11px] uppercase tracking-widest text-slate-500 mt-1">{l}</div>
    </div>
  )
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition-all duration-200 hover:border-brand-600/50 hover:bg-slate-900 group">
      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
             strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <h3 className="text-[15px] font-bold tracking-tight text-white">{title}</h3>
      <p className="mt-2 text-[13px] text-slate-400 leading-relaxed">{desc}</p>
    </div>
  )
}

function DemoAccount({ role, email, pwd }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
      <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-3">{role}</div>
      <KV k="E-posta" v={email} />
      <KV k="Şifre"   v={pwd} />
    </div>
  )
}

function KV({ k, v }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12px] py-1.5 border-t border-slate-800 first:border-0">
      <span className="text-slate-500 uppercase tracking-wider text-[10px]">{k}</span>
      <code className="font-mono text-slate-200 text-[12px]">{v}</code>
    </div>
  )
}

const FEATURES = [
  {
    title: 'Vardiya bazlı ilan',
    desc:  'Tarih + saat + ihtiyaç sayısı. Aday istediği slotlara başvurur, doluluk anlık güncellenir.',
    icon:  'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
  },
  {
    title: 'Akıllı eşleştirme',
    desc:  'Aday tercihlerine göre yeni ilan açıldığında bildirim — kullanıcılar fırsatları kaçırmaz.',
    icon:  'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z',
  },
  {
    title: 'Anlık mesajlaşma',
    desc:  'İşletme ve aday arasında doğrudan sohbet — ilan bağlamı korunur, okundu bilgisi gerçek zamanlı.',
    icon:  'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155',
  },
  {
    title: 'No-show takibi',
    desc:  'Adaya kabul aldıktan sonra gelmemeyi otomatik tespit ediyoruz — işletme güvenliği önemli.',
    icon:  'M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z',
  },
  {
    title: 'Vardiya bazlı puanlama',
    desc:  'Çalışma tamamlandıktan sonra her iki taraf puan verir — kötü deneyimler şeffaf görünür.',
    icon:  'M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z',
  },
  {
    title: 'KVKK + güvenlik',
    desc:  'Hassas belgeler (kimlik, adli sicil) yalnızca açık rıza ile paylaşılır — aday kontrolü elinde.',
    icon:  'M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z',
  },
]
