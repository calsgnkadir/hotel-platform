import { useState } from 'react'
import BackButton from '../components/BackButton'

const FAQS = [
  {
    q: 'Bir ilana başvurduktan sonra ne olur?',
    a: 'İşletme başvurunu inceler. Onaylarsa "Kabul" durumuna geçer, mesajlaşma sekmesinden iletişime geçebilirsiniz. Reddedilirse "Red" olarak görürsünüz.',
  },
  {
    q: 'Belgelerimi yüklemek zorunda mıyım?',
    a: 'Hayır, başvurmak için zorunlu değildir. Ama CV, transkript ve hassas belgeleri yüklersen başvurularının daha hızlı değerlendirilmesini sağlarsın.',
  },
  {
    q: 'Şifremi unuttum, ne yapmalıyım?',
    a: 'Giriş sayfasında "Şifremi unuttum" linkine tıkla. Email adresini gir, sıfırlama linki gönderilir. Link 1 saat geçerlidir.',
  },
  {
    q: 'Google ile giriş yapıyorum, şifrem var mı?',
    a: 'Hayır. İstersen "Şifremi unuttum" akışıyla bir şifre belirleyebilir, sonradan hem Google hem normal şifre ile giriş yapabilirsin.',
  },
  {
    q: 'Bir kullanıcıyı nasıl şikayet ederim?',
    a: 'İlgili kullanıcının profilinde veya başvurusunda ⚠ Şikayet Et butonu olur. Sebebi açıklayıp gönder. Yönetici 24 saat içinde inceler.',
  },
  {
    q: 'Bildirimleri nasıl kapatırım?',
    a: 'Sağ üstteki dişli ikonundan açılan menüde "Bildirimler" toggle\'ını kapat. Zil ikonunda artık yeni bildirim görmezsin.',
  },
  {
    q: 'Başvurumu iptal edebilir miyim?',
    a: 'Evet, sadece "Beklemede" veya "İncelemede" durumdaki başvurular iptal edilebilir. Kabul edilmiş bir başvuruyu iptal edemezsin.',
  },
  {
    q: 'İşletme beni "HOLD"a aldı, ne demek?',
    a: 'İşletme seninle ilgileniyor ve 24 saat içinde cevap vermeni bekliyor. Onaylarsan başvurun ACCEPTED olur, reddedersen geri kalan başvurularına devam edebilirsin.',
  },
]

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-cream-50 py-10 px-4">
      <div className="fixed top-3 left-4 z-40">
        <BackButton label="Geri" />
      </div>

      <div className="max-w-3xl mx-auto">
        {/* Başlık */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#3b0764' }}>
            Yardım & Destek
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6b21a8' }}>
            Sık sorulan sorular ve iletişim bilgileri.
          </p>
        </div>

        {/* SSS */}
        <section className="bg-white rounded-2xl shadow-xl border border-brand-200 p-6 sm:p-8 mb-6">
          <div className="text-[11px] uppercase tracking-widest mb-4" style={{ color: '#6b21a8' }}>
            Sık Sorulan Sorular
          </div>
          <div className="divide-y divide-brand-100">
            {FAQS.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
          </div>
        </section>

        {/* İletişim */}
        <section className="bg-white rounded-2xl shadow-xl border border-brand-200 p-6 sm:p-8">
          <div className="text-[11px] uppercase tracking-widest mb-4" style={{ color: '#6b21a8' }}>
            İletişim
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <a href="mailto:destek@ajanshotel.com"
               className="flex flex-col gap-1 px-4 py-3 rounded-xl bg-brand-50 border border-brand-100
                          hover:border-brand-400 transition-colors min-w-0">
              <span className="text-[10px] uppercase tracking-widest" style={{ color: '#6b21a8' }}>E-posta</span>
              <span className="font-mono text-[13px] truncate" style={{ color: '#3b0764' }}>destek@ajanshotel.com</span>
            </a>
            <a href="tel:+902120000000"
               className="flex flex-col gap-1 px-4 py-3 rounded-xl bg-brand-50 border border-brand-100
                          hover:border-brand-400 transition-colors min-w-0">
              <span className="text-[10px] uppercase tracking-widest" style={{ color: '#6b21a8' }}>Telefon</span>
              <span className="font-mono text-[13px] truncate" style={{ color: '#3b0764' }}>+90 212 000 00 00</span>
            </a>
          </div>
          <p className="text-[12px] mt-4" style={{ color: '#6b21a8' }}>
            Hafta içi 09:00–18:00 arası destek ekibimize ulaşabilirsiniz.
          </p>
        </section>
      </div>
    </div>
  )
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="py-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <span className="font-semibold text-[14px]" style={{ color: '#3b0764' }}>{q}</span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             strokeWidth={2} stroke="currentColor"
             className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
             style={{ color: '#6b21a8' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && <p className="text-[13px] mt-2 leading-relaxed" style={{ color: '#4c1d95' }}>{a}</p>}
    </div>
  )
}
