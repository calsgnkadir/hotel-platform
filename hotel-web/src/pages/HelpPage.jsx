import { useState, useMemo, useId } from 'react'
import { Link } from 'react-router-dom'
import BackButton from '../components/BackButton'
import EmptyState from '../components/EmptyState'

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
    a: 'İşletme başvurunu inceler. Onaylarsa "Kabul edildi" durumuna geçer, mesajlaşma sekmesinden iletişime geçebilirsin. Seçilmezsen başvurunu "Seçilmedi" olarak görürsün.' },
  { cat: 'Aday', q: 'Belgelerimi yüklemek zorunda mıyım?',
    a: 'Hayır. Profilinde veya başvuru sırasında belge yüklemen gerekmez. İşletme bir belge isterse ilgili sohbette Dosya / Foto ekle düğmesiyle paylaşabilirsin.' },
  { cat: 'Aday', q: 'Başvurumu iptal edebilir miyim?',
    a: 'Evet, "Gönderildi" veya "İnceleniyor" durumdaki başvurular iptal edilebilir. Yedek listesindeysen ("Yedeksin") de iptal edebilirsin; sana yedek teklifi geldiyse ("Sıra sende") iptal yerine teklifi "Kabul et" ya da "Gelemem" ile yanıtlarsın. Kabul edilmiş bir başvuruyu iptal edemezsin; vardiyaya gitmezsen "Gelmedi" olarak işaretlenir.' },
  { cat: 'Aday', q: 'Başvurum "Yanıtın bekleniyor" görünüyor, ne demek?',
    a: 'İşletme seninle ilgileniyor ve 24 saat içinde cevap vermeni bekliyor. Onaylarsan başvurun "Kabul edildi" durumuna geçer, reddedersen diğer başvurulara devam edersin.' },
  { cat: 'Aday', q: '"Gelmedi" ne demek? Cezalandırılır mıyım?',
    a: 'Kabul ettiğin vardiyaya gitmediğin durumdur. İşletme seni "Gelmedi" olarak işaretlediğinde 1 ceza hakkın düşer. 3 ceza hakkın da bitince hesabın 30 gün askıya alınır.' },

  // ── İSLETME ──
  { cat: 'İşletme', q: '"Doğrulanmış işletme" rozetini nasıl alırım?',
    a: 'Vergi numarası + faaliyet belgesi + telefon doğrulaması ile admin onayına başvurursun. Onay sonrası profilinde ve ilanlarında "Doğrulanmış işletme" onay rozeti görünür — güven sinyali.' },
  { cat: 'İşletme', q: 'İlan oluştururken hangi alanlar zorunlu?',
    a: 'Pozisyon, başlık, açıklama ve en az 1 vardiya slotu (tarih + başlangıç/bitiş saat + kaç aday). Ücret ve gereksinimler güçlü öneri ama opsiyonel.' },
  { cat: 'İşletme', q: 'Bir adayı "Gelmedi" olarak nasıl işaretlerim?',
    a: 'Başvurular sekmesinden ilgili adayın kartını aç → "Gelmedi olarak işaretle" butonu. Aday otomatik bildirim alır ve 1 ceza hakkı düşer; 3 ceza hakkı biten aday 30 gün askıya alınır.' },
  { cat: 'İşletme', q: 'Başvurulara ne kadar hızlı yanıt vermeliyim?',
    a: 'En geç 24 saat. Kanban görünümünde yanıt bekleyen kartın sol kenarındaki şerit, başvurunun ne kadar süredir yanıtsız kaldığını gösterir: 6 saatten az (zamanında), 6–24 saat (dikkat), 24 saatten fazla (acil yanıt). Hızlı yanıt, kabul oranını yükseltir.' },

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
    const q = query.trim().toLocaleLowerCase('tr-TR')
    return FAQS.filter(f => {
      if (cat !== 'all' && f.cat !== cat) return false
      if (!q) return true
      return f.q.toLocaleLowerCase('tr-TR').includes(q) || f.a.toLocaleLowerCase('tr-TR').includes(q)
    })
  }, [cat, query])

  const resetFilters = () => { setQuery(''); setCat('all') }

  return (
    <div className="min-h-screen py-10 px-4 relative z-10">
      {/* Geri düğmesi içerik sütununa hizalı, akış içinde (sabit değil) */}
      <div className="relative z-10 max-w-3xl mx-auto -mt-6 mb-4">
        <BackButton label="Geri" />
      </div>

      <div className="max-w-3xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--ah-ink)' }}>
            Yardım & SSS
          </h1>
          <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--ah-ink-3)' }}>
            Sıkça sorulan sorular. Cevap bulamadıysan{' '}
            <Link to="/iletisim" className="underline font-semibold" style={{ color: 'var(--ah-ink)' }}>iletişim sayfasından</Link>{' '}
            yaz.
          </p>
        </header>

        {/* Kategori çipleri + arama (açık tema: ortak .chip ve .input) */}
        <div className="mb-5 space-y-3">
          <div className="flex gap-2 flex-wrap" role="group" aria-label="Kategori">
            {CATEGORIES.map(c => {
              const active = cat === c.id
              return (
                <button key={c.id} type="button" onClick={() => setCat(c.id)}
                  aria-pressed={active}
                  className={`chip cand-filter-chip ${active ? 'is-active' : ''}`}>
                  {c.label}
                </button>
              )
            })}
          </div>
          <div className="relative">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none"
                 className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                 style={{ color: 'var(--ah-ink-4)' }}>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Soru içinde ara…"
              aria-label="Sorularda ara"
              className="input !pl-11"
            />
          </div>
        </div>

        <section className="card sm:p-8" aria-label="Sorular">
          <div className="type-label mb-2" aria-live="polite">
            {filtered.length} sonuç
          </div>
          {filtered.length === 0 ? (
            <EmptyState type="search" compact
              title="Eşleşen soru bulunamadı"
              description="Farklı bir kelime dene ya da tüm kategorilere dön."
              ctaLabel="Aramayı temizle" onCta={resetFilters} />
          ) : (
            <div className="divide-y divide-[color:var(--ah-line)]">
              {filtered.map(f => <FaqItem key={`${f.cat}-${f.q}`} cat={f.cat} q={f.q} a={f.a} />)}
            </div>
          )}
        </section>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--ah-ink-3)' }}>
          Hâlâ aradığını bulamadın mı?{' '}
          <Link to="/iletisim" className="font-semibold underline" style={{ color: 'var(--ah-ink)' }}>Bize yaz</Link>.
        </p>
      </div>
    </div>
  )
}

function FaqItem({ cat, q, a }) {
  const [open, setOpen] = useState(false)
  const uid = useId()
  const buttonId = `faq-q-${uid}`
  const panelId = `faq-a-${uid}`
  return (
    <div className="py-1">
      <h2 className="m-0">
        <button
          id={buttonId}
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full min-h-[44px] flex items-start justify-between gap-3 py-2.5 text-left rounded-lg"
          aria-expanded={open}
          aria-controls={panelId}
        >
          <span className="flex items-start gap-2.5 min-w-0">
            <span className="badge badge-neutral flex-shrink-0 mt-px min-w-[60px] justify-center">{cat}</span>
            <span className="font-semibold text-[15px] leading-snug break-words" style={{ color: 'var(--ah-ink)' }}>{q}</span>
          </span>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none"
               style={{ flexShrink: 0, marginTop: 1, color: 'var(--ah-ink-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h2>
      <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open}>
        <p className="pb-3 text-sm leading-relaxed" style={{ color: 'var(--ah-ink-2)' }}>
          {a}
        </p>
      </div>
    </div>
  )
}
