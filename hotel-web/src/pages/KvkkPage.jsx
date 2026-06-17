import { Link } from 'react-router-dom'
import BackButton from '../components/BackButton'

/**
 * KVKK aydinlatma metni — dark theme (FAZ 6 eksiklik avi).
 * Eski: bg-white dark:bg-white -> dark zeminde okunamiyordu.
 */
export default function KvkkPage() {
  return (
    <div className="min-h-screen py-10 px-4 relative" style={{ background: '#0c1726' }}>
      {/* Calm radial halo */}
      <div aria-hidden className="fixed inset-0 z-0 pointer-events-none"
           style={{
             background:
               'radial-gradient(ellipse 700px 500px at 15% 25%, rgba(30, 58, 95, 0.18) 0%, transparent 60%),' +
               'radial-gradient(ellipse 600px 500px at 85% 75%, rgba(212, 168, 83, 0.10) 0%, transparent 60%)',
           }} />

      {/* Sabit sol üst geri butonu */}
      <div className="fixed top-3 left-4 z-40">
        <BackButton label="Geri" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto rounded-2xl p-6 sm:p-10"
           style={{
             background: 'linear-gradient(135deg, rgba(21, 36, 61, 0.85), rgba(15, 23, 38, 0.85))',
             border: '1px solid rgba(212, 168, 83, 0.20)',
             boxShadow: '0 8px 32px rgba(0, 0, 0, 0.40)',
           }}>
        <div className="mb-6">
          <h1 className="font-bebas text-3xl sm:text-4xl tracking-wider uppercase text-white"
              style={{ textShadow: '0 0 18px rgba(212, 168, 83, 0.40)' }}>
            Kişisel Verilerin Korunması
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold mt-2"
             style={{ color: '#fde9a5' }}>
            Aydınlatma Metni · Son güncelleme: 22 Mayıs 2026
          </p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed" style={{ color: '#dde7f3' }}>
          <Section title="1. Veri Sorumlusu">
            <p>
              AjansHotel platformunun (bundan sonra "Platform") veri sorumlusu, platformu işleten
              kişi/kurumdur. Platform, otel ve aday arasında iş eşleştirmesi yapan bir çevrimiçi
              hizmettir.
            </p>
          </Section>

          <Section title="2. Toplanan Kişisel Veriler">
            <ul className="list-disc pl-5 space-y-1">
              <li><b>Kimlik bilgileri:</b> Ad, soyad, doğum tarihi, cinsiyet (opsiyonel)</li>
              <li><b>İletişim bilgileri:</b> E-posta, telefon, adres, ilçe</li>
              <li><b>Eğitim ve deneyim:</b> Eğitim durumu, önceki iş tecrübesi (aday)</li>
              <li><b>Belgeler:</b> CV, transkript, adli sicil, sağlık raporu, kimlik fotokopisi (aday)</li>
              <li><b>İşletme bilgileri:</b> Ad, tür, lokasyon, açıklama, logo, galeri fotoğrafları (işletme)</li>
              <li><b>Başvuru verileri:</b> İlan, ön yazı, müsaitlik, başvuru durumu</li>
              <li><b>Teknik veriler:</b> IP adresi, oturum tokeni, kullanım istatistikleri</li>
            </ul>
          </Section>

          <Section title="3. İşleme Amaçları">
            <ul className="list-disc pl-5 space-y-1">
              <li>Platform üyelik ve kimlik doğrulama</li>
              <li>İş ilanı oluşturma, başvuru alma ve süreç yönetimi</li>
              <li>Aday ile işletme arasında bilgi paylaşımı (izninle)</li>
              <li>Platform güvenliği ve kötüye kullanım önleme</li>
              <li>Yasal yükümlülükler çerçevesinde kayıt tutma</li>
            </ul>
          </Section>

          <Section title="4. Hukuki Sebep">
            <p>
              Verileriniz, KVKK m.5/2 uyarınca bir sözleşmenin kurulması ve ifası için zorunlu olması,
              meşru menfaat kapsamında ve açık rızanız ile işlenmektedir.
            </p>
          </Section>

          <Section title="5. Veri Paylaşımı">
            <p>
              <b>Hassas belgeler</b> (adli sicil, sağlık raporu, kimlik) yalnızca senin açık iznin ile,
              başvurduğun işletmenin görüntülemesine açılır. Açık belgeler (CV, transkript, öğrenci belgesi)
              ilan başvurusu kapsamında işletmeyle paylaşılır.
            </p>
            <p className="mt-2">
              Verileriniz üçüncü taraflarla pazarlama amacıyla paylaşılmaz.
            </p>
          </Section>

          <Section title="6. KVKK Madde 11 Hakları">
            <p>Aşağıdaki haklara sahipsiniz:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
              <li>İşlenmişse buna ilişkin bilgi talep etme</li>
              <li>Yanlış işlenmişse düzeltilmesini, eksiksiz olarak işlenmesini isteme</li>
              <li>Silinmesini veya yok edilmesini talep etme</li>
              <li>Otomatik analizi ile aleyhe sonuç doğmasına itiraz etme</li>
              <li>Kanuna aykırı işleme nedeniyle zarara uğramışsanız tazminat talep etme</li>
            </ul>
          </Section>

          <Section title="7. İletişim">
            <p>
              KVKK kapsamındaki taleplerinizi platformun destek e-posta adresine iletebilirsiniz.
              Talebiniz en geç <b>30 gün</b> içinde değerlendirilir.
            </p>
          </Section>

          {/* Onay kutusu */}
          <div className="rounded-xl p-4"
               style={{
                 background: 'rgba(212, 168, 83, 0.10)',
                 border: '1px solid rgba(212, 168, 83, 0.25)',
                 color: '#dde7f3',
               }}>
            <p className="font-medium">
              Platforma kayıt olarak bu aydınlatma metnini okuduğunuzu ve verilerinizin yukarıda
              belirtilen amaçlarla işlenmesine açık rıza verdiğinizi kabul edersiniz.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t text-center"
             style={{ borderColor: 'rgba(212, 168, 83, 0.18)' }}>
          <Link to="/register"
                className="inline-block text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-full transition-all hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(135deg, #1e3a5f, #b8902d)',
                  color: '#ffffff',
                  boxShadow: '0 0 18px rgba(212, 168, 83, 0.40)',
                }}>
            Kayıt sayfasına dön
          </Link>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="font-bebas text-lg tracking-[0.2em] uppercase mb-2.5"
          style={{ color: '#fde9a5' }}>
        {title}
      </h2>
      <div style={{ color: '#dde7f3' }}>
        {children}
      </div>
    </section>
  )
}
