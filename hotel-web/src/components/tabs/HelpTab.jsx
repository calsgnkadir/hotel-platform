import { useState } from 'react'
import { Link } from 'react-router-dom'

/**
 * Yardım sekmesi — SSS + iletişim + yasal linkler.
 * Tüm rollerde aynı içerik.
 */
export default function HelpTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight">Yardım</h2>
        <p className="text-[12px] text-slate-400 mt-1">
          Sık sorulan sorular ve iletişim bilgileri.
        </p>
      </div>

      {/* SSS */}
      <div className="card">
        <div className="text-[11px] uppercase tracking-widest text-slate-400 mb-3">
          Sık Sorulan Sorular
        </div>
        <div className="divide-y divide-slate-800/60">
          {FAQS.map((f, i) => (
            <FaqItem key={i} q={f.q} a={f.a} />
          ))}
        </div>
      </div>

      {/* İletişim */}
      <div className="card">
        <div className="text-[11px] uppercase tracking-widest text-slate-400 mb-3">
          İletişim
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <ContactItem
            label="E-posta"
            value="destek@ajanshotel.com"
            href="mailto:destek@ajanshotel.com"
          />
          <ContactItem
            label="Telefon"
            value="+90 212 000 00 00"
            href="tel:+902120000000"
          />
        </div>
        <p className="text-[12px] text-slate-400 mt-4">
          Hesabınla ilgili bir sorun olursa veya bir kullanıcıyı şikayet etmek istersen,
          ilgili kullanıcının profilinde ⚠ Şikayet Et butonunu kullanabilirsin.
        </p>
      </div>

      {/* Yasal */}
      <div className="card">
        <div className="text-[11px] uppercase tracking-widest text-slate-400 mb-3">
          Yasal Bilgi
        </div>
        <div className="flex flex-wrap gap-2">
          <LegalLink to="/kvkk">KVKK Aydınlatma Metni</LegalLink>
        </div>
        <p className="text-[12px] text-slate-400 mt-4">
          AjansHotel İstanbul'daki hotel, restoran ve kafelerde günlük/aylık iş arayan
          adaylarla işletmeleri buluşturan bir platformdur. Tüm verileriniz KVKK
          kapsamında korunur.
        </p>
      </div>
    </div>
  )
}

const FAQS = [
  {
    q: 'Bir ilana başvurduktan sonra ne olur?',
    a: 'İşletme başvurunu inceler. Onaylarsa "Kabul" durumuna geçer ve mesajlaşma ' +
       'sekmesinden iletişime geçebilirsiniz. Reddedilirse durumu "Red" olarak ' +
       'görürsünüz. İncelenmemişse "Bekleyen" olarak kalır.',
  },
  {
    q: 'Belgelerimi yüklemek zorunda mıyım?',
    a: 'Hayır, başvurmak için zorunlu değildir. Ama CV, transkript ve hassas belgeleri ' +
       'profilinde tutmak başvurularının daha hızlı değerlendirilmesini sağlar. Belgeler ' +
       'Cloudinary üzerinde şifreli olarak saklanır.',
  },
  {
    q: 'Şifremi unuttum, ne yapmalıyım?',
    a: 'Giriş sayfasında "Şifremi unuttum" linkine tıkla. E-posta adresini gir, ' +
       'sıfırlama linki gönderilir. Link 1 saat geçerlidir.',
  },
  {
    q: 'Google ile giriş yapıyorum, şifrem var mı?',
    a: 'Hayır, Google ile giriş yaptıysan şifren yok. İstersen "Şifremi unuttum" ' +
       'akışıyla bir şifre belirleyebilir, sonradan hem Google hem normal şifre ile ' +
       'giriş yapabilirsin.',
  },
  {
    q: 'Bir kullanıcıyı nasıl şikayet ederim?',
    a: 'İlgili kullanıcının profilinde veya başvurusunda ⚠ Şikayet Et butonu olur. ' +
       'Sebebi açıklayıp gönder. Yönetici 24 saat içinde inceler.',
  },
  {
    q: 'Bildirimleri nasıl kapatırım?',
    a: 'Ayarlar sekmesinden "Bildirimleri kapat" anahtarını aç. Zil ikonunda artık ' +
       'yeni bildirim görmezsin (kayıtlar backend\'de tutulmaya devam eder).',
  },
]

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="py-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 text-left group"
      >
        <span className="font-semibold text-slate-100 text-[14px]">{q}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth={2}
          stroke="currentColor"
          className={`w-4 h-4 shrink-0 text-slate-400 transition-transform
            ${open ? 'rotate-180' : ''}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <p className="text-[13px] text-slate-300 mt-2 leading-relaxed">{a}</p>
      )}
    </div>
  )
}

function ContactItem({ label, value, href }) {
  return (
    <a
      href={href}
      className="flex flex-col gap-1 px-4 py-3 rounded-xl bg-slate-800/40 border border-slate-700/50
                 hover:bg-slate-800/70 hover:border-brand-500/40 transition-colors"
    >
      <span className="text-[10px] uppercase tracking-widest text-slate-400">{label}</span>
      <span className="font-mono text-[13px] text-slate-100">{value}</span>
    </a>
  )
}

function LegalLink({ to, children }) {
  return (
    <Link
      to={to}
      className="px-3 py-1.5 rounded-full text-[12px] font-semibold border bg-slate-800/60
                 text-slate-300 border-slate-700 hover:bg-slate-700/60 transition-colors"
    >
      {children}
    </Link>
  )
}
