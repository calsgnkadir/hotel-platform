import BackButton from '../components/BackButton'

/**
 * FAZ I.4 — Kullanım Şartları / Hizmet Sözleşmesi.
 * KVKK aydınlatma metninden ayrı; kullanıcı sözleşmesi (uyuşmazlık,
 * no-show politikası, sorumluluk reddi, fesih).
 *
 * Hukuki not: Bu sayfanın tasarımı KvkkPage ile aynı dark teması kullanır
 * (tutarlılık). İçerik bir avukat tarafından gözden geçirilmelidir —
 * mevcut metin taslak niteliğinde, MVP için yeterli baseline.
 */
export default function TermsPage() {
  return (
    <div className="min-h-screen py-10 px-4 relative">
      <div aria-hidden className="fixed inset-0 z-0 pointer-events-none"
           style={{
             background:
               'radial-gradient(ellipse 700px 500px at 15% 25%, rgba(74, 63, 51, 0.30) 0%, transparent 60%),' +
               'radial-gradient(ellipse 600px 500px at 85% 75%, rgba(205, 183, 143, 0.10) 0%, transparent 60%)',
           }} />

      <div className="fixed top-3 left-4 z-40">
        <BackButton label="Geri" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto p-6 sm:p-10"
           style={{
             background: '#1b1815',
             borderRadius: '28px 12px 28px 12px',
             border: 'none',
             boxShadow: '0 18px 48px rgba(0, 0, 0, 0.40), inset 0 1px 0 rgba(245,239,226,0.03)',
           }}>
        <div className="mb-7">
          <h1 className="text-3xl sm:text-[40px] font-semibold"
              style={{ color: '#f5efe2', letterSpacing: '-0.025em', lineHeight: 1.05 }}>
            Kullanım Şartları
          </h1>
          <p className="text-[10px] uppercase tracking-[0.28em] font-medium mt-3"
             style={{ color: '#928678' }}>
            Hizmet Sözleşmesi · Son güncelleme: 19 Haziran 2026
          </p>
        </div>

        <div style={{ color: '#ede4d3', fontSize: 14, lineHeight: 1.7 }}>
          <Section title="1. Taraflar ve Tanımlar">
            İşbu sözleşme, AjansHotel platformu ("Platform") ile platformu kullanan tüm üyeler
            arasında akdedilmiştir. Üye, aday (CANDIDATE) ya da işletme sahibi (BUSINESS_OWNER)
            sıfatıyla platforma kayıt olan gerçek veya tüzel kişiyi ifade eder.
          </Section>

          <Section title="2. Hizmetin Kapsamı">
            Platform, hospitality sektöründeki iş ilanı, başvuru, vardiya yönetimi, mesajlaşma ve
            puanlama hizmetlerini sunar. Platform <strong>aracı</strong> konumundadır — iş ilişkisi
            doğrudan aday ile işletme arasında kurulur. Çalışan ücreti, vergi yükümlülükleri ve SGK
            sorumluluğu işletmeye aittir.
          </Section>

          <Section title="3. Üyelik">
            <ul>
              <li>18 yaşından küçükler için aday üyelik açılamaz.</li>
              <li>İşletme üyelerinden vergi numarası, faaliyet belgesi veya benzer doğrulayıcı belgeler
                  istenebilir; doğrulama sonucu "Verified" rozeti tanınır.</li>
              <li>Tek kişi, tek hesap kuralı geçerlidir. Çoklu hesap tespit edilirse askıya alınır.</li>
            </ul>
          </Section>

          <Section title="4. Aday Yükümlülükleri">
            <ul>
              <li>Profilde paylaşılan bilgilerin doğruluğunu taahhüt eder.</li>
              <li>Kabul edilen başvuruya ait vardiyaya bildirimsiz katılmama (<strong>no-show</strong>)
                  durumunda strike kaydı oluşur; 3 strike sonrası hesap 30 gün süreyle askıya alınır
                  (otomatik ban).</li>
              <li>Mesajlaşmada saldırgan, küfürlü veya yanıltıcı içerik üretmez.</li>
            </ul>
          </Section>

          <Section title="5. İşletme Yükümlülükleri">
            <ul>
              <li>İlan açıklamasında ücret, mesai saatleri ve görev tanımı şeffaf belirtilir.</li>
              <li>Vardiya tamamlandıktan sonra mutabık kalınan ücret zamanında ödenir.</li>
              <li>Adayların kişisel verileri yalnızca işe alım amacıyla kullanılır, üçüncü taraflarla
                  paylaşılmaz.</li>
              <li>Çalışma sırasında oluşacak iş kazalarında 6331 sayılı kanun çerçevesinde işveren
                  sorumluluğu işletmeye aittir.</li>
            </ul>
          </Section>

          <Section title="6. İçerik Moderasyonu">
            Platform, ilan ve mesaj içeriklerini gözden geçirme hakkına sahiptir. Yasa dışı, yanıltıcı
            veya rahatsız edici içerikler haber verilmeksizin kaldırılabilir; tekrarlanan ihlallerde
            hesap kapatılır.
          </Section>

          <Section title="7. Hesap Silme ve Anonimleştirme">
            KVKK madde 11 gereği üye, hesabının silinmesini talep edebilir. Talep sonrası 30 gün
            <strong> grace period</strong> uygulanır — bu süre içinde geri alınabilir. 30 günden sonra
            kişisel veriler otomatik anonimleştirilir; referans bütünlüğü için başvuru/yorum gibi
            kayıtlar "Silinmiş Kullanıcı" etiketiyle kalır.
          </Section>

          <Section title="8. Sorumluluk Reddi">
            Platform, üye işlemlerinin sonucuna ilişkin kâr/zarar garantisi vermez. Aday ile işletme
            arasındaki iş ilişkisinden doğan uyuşmazlıklarda Platform tarafsız bir aracı konumundadır.
          </Section>

          <Section title="9. Uyuşmazlık ve Yetkili Mahkeme">
            İşbu sözleşmenin uygulanmasında <strong>Türkiye Cumhuriyeti hukuku</strong> geçerlidir.
            Uyuşmazlıklarda <strong>İstanbul (Çağlayan) Mahkemeleri ve İcra Daireleri</strong>
            yetkilidir.
          </Section>

          <Section title="10. İletişim">
            Sözleşmeyle ilgili sorularınız için: <a href="/iletisim"
            style={{ color: '#cdb78f', textDecoration: 'underline' }}>iletişim sayfası</a>. KVKK
            veri sorumlusu başvuruları için: <a href="/kvkk"
            style={{ color: '#cdb78f', textDecoration: 'underline' }}>KVKK metni</a>.
          </Section>

          <p style={{ marginTop: 24, fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
            Üye kaydı oluşturarak bu sözleşmeyi okuduğunuzu ve kabul ettiğinizi beyan etmiş olursunuz.
          </p>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h2 className="" style={{
        fontSize: 15, fontWeight: 600, color: '#cdb78f',
        marginBottom: 12, letterSpacing: '0.22em', textTransform: 'uppercase',
      }}>
        {title}
      </h2>
      <div style={{ color: '#ede4d3' }}>
        {children}
      </div>
    </section>
  )
}
