import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import BackButton from '../components/BackButton'

/**
 * FAZ I.2 — SSS / FAQ sayfası.
 *
 * 4 kategori (Aday / İşletme / Genel / KVKK) + serbest arama input.
 * Mevcut açık tema korundu (Yardım sayfası içerik odaklı, manifesto'nun
 * "KVKK gibi metinler sade kalmalı" ilkesi).
 *
 * İletişim bölümü AYRI sayfaya tasindi (/iletisim — FAZ I.3).
 */
const FAQS = [
  // ── ADAY ──
  { cat: 'Aday', q: 'Bir ilana başvurduktan sonra ne olur?',
    a: 'İşletme başvurunu inceler. Onaylarsa "Kabul" durumuna geçer, mesajlaşma sekmesinden iletişime geçebilirsin. Reddedilirse "Red" olarak görürsün.' },
  { cat: 'Aday', q: 'Belgelerimi yüklemek zorunda mıyım?',
    a: 'Hayır, başvurmak için zorunlu değil. Ancak CV, transkript ve hassas belgeleri yüklersen başvuruların daha hızlı değerlendirilir ve "Güvenilirlik" skorun artar.' },
  { cat: 'Aday', q: 'Başvurumu iptal edebilir miyim?',
    a: 'Evet, sadece "Beklemede" veya "İncelemede" durumdaki başvurular iptal edilebilir. Kabul edilmiş bir başvuruyu iptal edemezsin (no-show olarak işaretlenir).' },
  { cat: 'Aday', q: 'İşletme beni "HOLD"a aldı, ne demek?',
    a: 'İşletme seninle ilgileniyor ve 24 saat içinde cevap vermeni bekliyor. Onaylarsan başvurun ACCEPTED olur, reddedersen diğer başvurulara devam edersin.' },
  { cat: 'Aday', q: 'No-show ne demek? Cezalandırılır mıyım?',
    a: 'Kabul ettiğin vardiyaya gitmediğin durumdur. İşletme no-show işaretlediğinde 1 "strike" alırsın. 3 strike sonrası hesabın 30 gün askıya alınır.' },
  { cat: 'Aday', q: 'Güvenilirlik skorum nasıl hesaplanıyor?',
    a: 'Aldığın yıldız ortalaması + tamamladığın işler + no-show oranı + son 90 gündeki aktivite. 0-100 arası bir skordur; profil fotoğrafının etrafındaki halka renk kodlu gösterir.' },

  // ── İSLETME ──
  { cat: 'İşletme', q: '"Doğrulanmış işletme" rozetini nasıl alırım?',
    a: 'Vergi numarası + faaliyet belgesi + telefon doğrulaması ile admin onayına başvurursun. Onay sonrası profilinde ve ilanlarında altın yıldız rozeti görünür — güven sinyali.' },
  { cat: 'İşletme', q: 'İlan oluştururken hangi alanlar zorunlu?',
    a: 'Pozisyon, başlık, açıklama ve en az 1 vardiya slotu (tarih + başlangıç/bitiş saat + kaç aday). Ücret ve gereksinimler güçlü öneri ama opsiyonel.' },
  { cat: 'İşletme', q: 'Bir adayı "no-show" olarak nasıl işaretlerim?',
    a: 'Başvurular sekmesinden ilgili adayın kartını aç → "No-Show İşaretle" butonu. Aday otomatik bildirim alır; üçüncü strike sonrası 30 gün ban.' },
  { cat: 'İşletme', q: 'Başvurulara ne kadar hızlı yanıt vermeliyim?',
    a: 'En geç 24 saat. Kanban kartının sol kenarında yanıt süresi şeridi vardır: yeşil (< 6sa), amber (6-24sa), mercan (> 24sa). Hızlı yanıt, kabul oranını yükseltir.' },
  { cat: 'İşletme', q: 'Analitik panelinde neleri görebilirim?',
    a: 'Recruitment funnel (alındı → incelendi → kabul → tamamlandı), pozisyon başına başvuru dağılımı, günlük trend, ortalama hire-time histogramı (< 1g, 1-3g, 3-7g, > 7g).' },

  // ── GENEL ──
  { cat: 'Genel', q: 'Şifremi unuttum, ne yapmalıyım?',
    a: 'Giriş sayfasında "Şifremi unuttum" linkine tıkla. Email adresini gir, sıfırlama linki gönderilir. Link 1 saat geçerlidir.' },
  { cat: 'Genel', q: 'Google ile giriş yapıyorum, şifrem var mı?',
    a: 'Hayır. İstersen "Şifremi unuttum" akışıyla bir şifre belirleyebilir, sonradan hem Google hem normal şifre ile giriş yapabilirsin.' },
  { cat: 'Genel', q: 'Bildirimleri nasıl kapatırım?',
    a: 'Sağ üstteki dişli ikonundan açılan menüde "Bildirimler" toggle\'ını kapat. Web push bildirimleri ayrıca tarayıcı ayarlarından da yönetilebilir.' },
  { cat: 'Genel', q: 'Bir kullanıcıyı nasıl şikayet ederim?',
    a: 'İlgili kullanıcının profilinde veya başvurusunda "Şikayet Et" butonu olur. Sebebi açıklayıp gönder. Yönetici 24 saat içinde inceler ve karar bildirir.' },

  // ── KVKK ──
  { cat: 'KVKK', q: 'Kişisel verilerimi nasıl indirebilirim?',
    a: 'Profil sayfanda "KVKK · Verileriniz" kartında "Verilerimi İndir (JSON)" butonu var. Profil + tüm başvurular + bildirimler tek dosyada indirilir.' },
  { cat: 'KVKK', q: 'Hesabımı nasıl silerim?',
    a: 'Profil → "KVKK · Verileriniz" → "Hesabımı Sil". Onay sonrası hesap devre dışı bırakılır; 30 gün içinde destek hattından geri alabilirsin. Süre sonunda PII anonimleştirilir.' },
  { cat: 'KVKK', q: 'Çerez tercihlerimi sonradan değiştirebilir miyim?',
    a: 'Evet. Sayfa altındaki "Çerez Ayarları" linkine tıkla — banner tekrar açılır ve analitik/pazarlama çerezlerini ayrı ayrı kapatabilirsin.' },
  { cat: 'KVKK', q: 'Veri sorumlusuna nasıl ulaşırım?',
    a: 'İletişim sayfasında veri sorumlusu iletişim bilgisi (email, adres) yer alır. KVKK madde 11 başvuruları için "konu" alanında "KVKK Başvurusu" seç.' },
]

const CATEGORIES = [
  { id: 'all',      label: 'Tümü' },
  { id: 'Aday',     label: 'Aday' },
  { id: 'İşletme',  label: 'İşletme' },
  { id: 'Genel',    label: 'Genel' },
  { id: 'KVKK',     label: 'KVKK' },
]

export default function HelpPage() {
  const [cat, setCat] = useState('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return FAQS.filter(f => {
      if (cat !== 'all' && f.cat !== cat) return false
      if (!q) return true
      return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
    })
  }, [cat, query])

  return (
    <div className="min-h-screen bg-cream-50 py-10 px-4">
      <div className="fixed top-3 left-4 z-40">
        <BackButton label="Geri" />
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#0c1726' }}>
            Yardım & SSS
          </h1>
          <p className="text-sm mt-1" style={{ color: '#1e3a5f' }}>
            Sıkça sorulan sorular. Cevap bulamadıysan{' '}
            <Link to="/iletisim" className="underline font-semibold">iletişim sayfasından</Link>{' '}
            yaz.
          </p>
        </div>

        {/* Filter pill'ler + arama */}
        <div className="mb-5 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(c => {
              const active = cat === c.id
              return (
                <button key={c.id} onClick={() => setCat(c.id)}
                  className="px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors"
                  style={{
                    background: active ? '#1e3a5f' : '#fff',
                    color: active ? '#fbd768' : '#1e3a5f',
                    border: `1px solid ${active ? '#1e3a5f' : '#cbd5e1'}`,
                  }}>
                  {c.label}
                </button>
              )
            })}
          </div>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Soru içinde ara…"
            className="w-full px-4 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2"
            style={{ borderColor: '#cbd5e1', color: '#0c1726' }}
          />
        </div>

        <section className="bg-white rounded-2xl shadow-xl border border-brand-200 p-6 sm:p-8">
          <div className="text-[11px] uppercase tracking-widest mb-4" style={{ color: '#1e3a5f' }}>
            {filtered.length} sonuç
          </div>
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-500">
              Bu aramayla eşleşen soru bulunamadı.
            </div>
          ) : (
            <div className="divide-y divide-brand-100">
              {filtered.map((f, i) => <FaqItem key={`${f.cat}-${i}`} cat={f.cat} q={f.q} a={f.a} />)}
            </div>
          )}
        </section>

        <p className="text-center text-[12px] mt-5" style={{ color: '#1e3a5f' }}>
          Hâlâ aradığını bulamadın mı?{' '}
          <Link to="/iletisim" className="font-semibold underline">Bize yaz</Link>.
        </p>
      </div>
    </div>
  )
}

function FaqItem({ cat, q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="py-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-[9px] uppercase tracking-widest font-bold flex-shrink-0 px-1.5 py-0.5 rounded"
                style={{ background: '#1e3a5f', color: '#fbd768' }}>
            {cat}
          </span>
          <span className="font-semibold text-[14px] truncate" style={{ color: '#0c1726' }}>{q}</span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             style={{ flexShrink: 0, color: '#1e3a5f', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <p className="mt-2 text-[13px] leading-relaxed pl-1" style={{ color: '#1e3a5f' }}>
          {a}
        </p>
      )}
    </div>
  )
}
