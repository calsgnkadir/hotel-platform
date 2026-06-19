import { useState } from 'react'
import { Link } from 'react-router-dom'
import BackButton from '../components/BackButton'

/**
 * FAZ I.3 — İletişim sayfası.
 *
 * KVKK m.10 zorunluluğu: veri sorumlusu erişilebilir iletişim. Kullanıcı
 * "hesabımı silemiyorum", "verim hatalı görünüyor" gibi taleplerde buradan
 * yazabilmeli.
 *
 * MVP: mailto link + kategorize form. Form submit edilince konu/içerik
 * pre-filled mailto açar (statik). I.5'te SupportTicket backend gelince
 * gerçek POST endpoint'e bağlanacak.
 *
 * JSON-LD ContactPoint schema SEO için (Google "AjansHotel iletişim"
 * aramasında destek bilgisi snippet'ı gösterir).
 */
const SUBJECTS = [
  { v: 'genel',   label: 'Genel soru' },
  { v: 'hesap',   label: 'Hesap / Giriş' },
  { v: 'kvkk',    label: 'KVKK başvurusu (m.11)' },
  { v: 'isletme', label: 'İşletme doğrulama (KYC)' },
  { v: 'teknik',  label: 'Teknik sorun' },
  { v: 'is',      label: 'İş birliği / Basın' },
]

const SUPPORT_EMAIL = 'destek@ajanshotel.com'
const KVKK_EMAIL    = 'kvkk@ajanshotel.com'

export default function ContactPage() {
  const [subject, setSubject] = useState('genel')
  const [body, setBody]       = useState('')

  const targetEmail = subject === 'kvkk' ? KVKK_EMAIL : SUPPORT_EMAIL
  const subjLabel = SUBJECTS.find(s => s.v === subject)?.label || 'Genel'
  const mailtoHref = `mailto:${targetEmail}` +
    `?subject=${encodeURIComponent('[AjansHotel] ' + subjLabel)}` +
    `&body=${encodeURIComponent(body)}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: 'AjansHotel · İletişim',
    contactPoint: [
      { '@type': 'ContactPoint', email: SUPPORT_EMAIL, contactType: 'Müşteri destek', areaServed: 'TR', availableLanguage: 'Turkish' },
      { '@type': 'ContactPoint', email: KVKK_EMAIL,    contactType: 'KVKK',           areaServed: 'TR', availableLanguage: 'Turkish' },
    ],
  }

  return (
    <div className="min-h-screen bg-cream-50 py-10 px-4">
      <div className="fixed top-3 left-4 z-40">
        <BackButton label="Geri" />
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#0c1726' }}>
            İletişim
          </h1>
          <p className="text-sm mt-1" style={{ color: '#1e3a5f' }}>
            Bize yazabileceğin birkaç yol var. Önce{' '}
            <Link to="/yardim" className="underline font-semibold">SSS</Link>
            'ye bakman cevabı hızlandırabilir.
          </p>
        </div>

        {/* Veri sorumlusu kartı (KVKK m.10) */}
        <section className="bg-white rounded-2xl shadow-xl border border-brand-200 p-6 sm:p-8 mb-6">
          <div className="text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: '#1e3a5f' }}>
            Veri Sorumlusu
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <InfoCard label="Genel destek" value={SUPPORT_EMAIL} href={`mailto:${SUPPORT_EMAIL}`} />
            <InfoCard label="KVKK başvuruları" value={KVKK_EMAIL} href={`mailto:${KVKK_EMAIL}`} />
            <InfoCard label="Adres"
                      value="İstanbul, Türkiye"
                      caption="Tam adres yasal başvurularda paylaşılır" />
            <InfoCard label="Çalışma saatleri"
                      value="Hafta içi 09:00–18:00"
                      caption="Hafta sonu yalnızca acil teknik destek" />
          </div>
        </section>

        {/* Form — mailto pre-fill */}
        <section className="bg-white rounded-2xl shadow-xl border border-brand-200 p-6 sm:p-8">
          <div className="text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: '#1e3a5f' }}>
            Bize Yaz
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#1e3a5f' }}>
                Konu
              </label>
              <select value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2"
                style={{ borderColor: '#cbd5e1', color: '#0c1726' }}>
                {SUBJECTS.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#1e3a5f' }}>
                Mesajın
              </label>
              <textarea
                value={body} onChange={e => setBody(e.target.value)}
                rows={6}
                placeholder={subject === 'kvkk'
                  ? 'KVKK madde 11 kapsamında hangi hakkını kullanmak istediğini açıkla. Kimlik doğrulaması için e-postanın kayıtlı adresinden gönderildiğini teyit edeceğiz.'
                  : 'Sorunu mümkün olduğunca detaylı yaz — hesap email\'in, kullandığın tarayıcı, hata mesajı vb. cevap süresi 24 saat.'}
                className="w-full px-4 py-3 rounded-xl text-sm border focus:outline-none focus:ring-2 resize-y"
                style={{ borderColor: '#cbd5e1', color: '#0c1726', minHeight: 140 }}
              />
            </div>
            <a href={mailtoHref}
               className="block w-full text-center px-5 py-3 rounded-xl font-semibold text-sm transition-all"
               style={{
                 background: body.trim() ? 'linear-gradient(135deg, #1e3a5f, #234a82)' : '#cbd5e1',
                 color: '#fff',
                 pointerEvents: body.trim() ? 'auto' : 'none',
                 opacity: body.trim() ? 1 : 0.7,
               }}>
              {body.trim() ? 'E-posta uygulamasında aç' : 'Önce mesaj yaz'}
            </a>
            <p className="text-[11px] text-ink-500 leading-relaxed">
              Bu form, varsayılan e-posta uygulamanı açar — gönderim {targetEmail}{' '}
              adresine yapılır. Yanıt süresi <strong>24 saat</strong> hedeflenir.
            </p>
          </div>
        </section>
      </div>

      <script type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    </div>
  )
}

function InfoCard({ label, value, href, caption }) {
  const inner = (
    <>
      <div className="text-[10px] uppercase tracking-widest" style={{ color: '#1e3a5f' }}>{label}</div>
      <div className={`font-mono text-[13px] truncate mt-1 ${href ? 'underline' : ''}`}
           style={{ color: '#0c1726' }}>{value}</div>
      {caption && (
        <div className="text-[10px] mt-1" style={{ color: '#64748b' }}>{caption}</div>
      )}
    </>
  )
  const cls = "flex flex-col gap-0.5 px-4 py-3 rounded-xl bg-brand-50 border border-brand-100 hover:border-brand-400 transition-colors min-w-0"
  return href
    ? <a href={href} className={cls}>{inner}</a>
    : <div className={cls}>{inner}</div>
}
