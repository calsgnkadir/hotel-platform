import { Link } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { PRIVACY_NOTICE_VERSION, PRIVACY_NOTICE_DATE_LABEL, TERMS_PATH } from '../lib/legal'

/**
 * KVKK Aydınlatma Metni (6698 sayılı Kanun m.10 + Aydınlatma Yükümlülüğü Tebliği).
 *
 * Bölümler hukuken beklenen sırayla: veri sorumlusu, işlenen veri kategorileri,
 * amaçlar ve hukuki sebepler, toplama yöntemi, aktarım, yurt dışı aktarım,
 * saklama süreleri, haklar, başvuru yolu. Sürüm/tarih src/lib/legal.js'ten gelir
 * (kayıt isteğinde gönderilen privacyNoticeVersion ile aynı).
 *
 * Köşeli parantezli alanlar (<Fill>) şirket bilgisiyle doldurulacak yer
 * tutuculardır; uydurma bilgi yazılmaz. Aydınlatma bir onay değildir: kayıtta
 * bu metin için onay kutusu yoktur.
 */
export default function KvkkPage() {
  return (
    <div className="min-h-screen py-10 px-4 relative ah-surface" style={{ background: 'var(--ah-page)' }}>
      {/* Geri düğmesi içerik sütununun sol üstünde, akış içinde (sabit değil: mobilde metnin üstüne biniyordu, geniş ekranda içerikten kopuktu) */}
      <div className="relative z-10 max-w-3xl mx-auto -mt-6 mb-4">
        <BackButton label="Geri" />
      </div>

      <article className="relative z-10 max-w-3xl mx-auto p-6 sm:p-10"
           style={{
             background: 'var(--ah-card)',
             borderRadius: 12,
             border: '1px solid var(--ah-line)',
             boxShadow: 'var(--elev-1)',
           }}>
        <header className="mb-8 pb-6" style={{ borderBottom: '1px solid var(--ah-line)' }}>
          <p className="type-label" style={{ color: 'var(--ah-ink-3)' }}>Aydınlatma Metni</p>
          <h1 className="mt-1 text-[28px] sm:text-[36px] font-bold"
              style={{ color: 'var(--ah-ink)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Kişisel Verilerin Korunması
          </h1>
          <p className="type-meta mt-3" data-testid="kvkk-version">
            Sürüm {PRIVACY_NOTICE_VERSION} · Son güncelleme: {PRIVACY_NOTICE_DATE_LABEL}
          </p>
          <p className="type-body mt-4" style={{ color: 'var(--ah-ink-2)' }}>
            Bu metin, Kadrom'u kullanırken kişisel verilerinin kim tarafından, hangi amaçla ve
            hangi hukuki sebeple işlendiğini, kimlere aktarıldığını ve haklarını nasıl
            kullanabileceğini anlatır (6698 sayılı Kişisel Verilerin Korunması Kanunu m.10).
          </p>
        </header>

        <div className="space-y-8 type-body leading-relaxed" style={{ color: 'var(--ah-ink-2)' }}>
          <Section title="1. Veri Sorumlusu">
            <p>
              Kadrom platformunun (bundan sonra "Platform") veri sorumlusu:
            </p>
            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-x-4 gap-y-2">
              <dt className="font-semibold" style={{ color: 'var(--ah-ink)' }}>Unvan</dt>
              <dd><Fill>[Şirket unvanı]</Fill></dd>
              <dt className="font-semibold" style={{ color: 'var(--ah-ink)' }}>Adres</dt>
              <dd><Fill>[Adres]</Fill></dd>
              <dt className="font-semibold" style={{ color: 'var(--ah-ink)' }}>İletişim</dt>
              <dd><Fill>[KEP/e-posta]</Fill></dd>
            </dl>
            <p className="mt-3">
              Platform; İstanbul'daki otel, restoran ve kafeler ile vardiyalı iş arayan adayları
              buluşturan çevrimiçi bir hizmettir.
            </p>
          </Section>

          <Section title="2. İşlenen Kişisel Veri Kategorileri">
            <ul className="list-disc pl-5 space-y-1.5">
              <li><b>Kimlik:</b> Ad, soyad; isteğe bağlı doğum tarihi ve cinsiyet (aday)</li>
              <li><b>İletişim:</b> E-posta, telefon, adres, ilçe/mahalle</li>
              <li><b>Mesleki deneyim:</b> Eğitim durumu, önceki iş deneyimi, tercih edilen pozisyonlar (aday)</li>
              <li><b>İşletme bilgileri:</b> İşletme adı, türü, konumu, açıklaması, logo ve galeri fotoğrafları (işletme yetkilisi)</li>
              <li><b>Başvuru ve vardiya:</b> Başvurduğun ilan, ön yazı, seçtiğin vardiyalar, başvuru durumu</li>
              <li><b>Konum:</b> Konumla vardiya girişi yapıldığında cihaz konumu ve işyerine uzaklık. Önceki çıkış işlemlerinden kalma konum kayıtları da bulunabilir.</li>
              <li><b>Yazışmalar ve ekler:</b> Sohbet mesajları, gönderdiğin dosya ve fotoğraflar</li>
              <li><b>İşlem güvenliği:</b> IP adresi, oturum ve giriş kayıtları, profil görüntülenme kayıtları</li>
            </ul>
            <p className="mt-3">
              Platform, özel nitelikli kişisel veri (ör. sağlık, adli sicil) talep etmez. Bir işletme
              böyle bir belge isterse, paylaşıp paylaşmamak senin kararındır; sohbet eki olarak
              gönderdiğin belge yalnızca o sohbetin iki tarafınca görülür ve Platform ayrı bir
              belge arşivi tutmaz.
            </p>
          </Section>

          <Section title="3. İşleme Amaçları ve Hukuki Sebepler">
            <ul className="space-y-3">
              <Purpose title="Üyelik, kimlik doğrulama ve hesap güvenliği"
                       basis="Sözleşmenin kurulması ve ifası (KVKK m.5/2-c); veri sorumlusunun meşru menfaati (m.5/2-f)" />
              <Purpose title="İlan yayınlama, başvuru alma, vardiya ve yoklama yönetimi"
                       basis="Sözleşmenin kurulması ve ifası (m.5/2-c)" />
              <Purpose title="Aday ile işletme arasında başvuru bilgilerinin paylaşılması ve mesajlaşma"
                       basis="Sözleşmenin kurulması ve ifası (m.5/2-c)" />
              <Purpose title="Konumla vardiya girişinin doğrulanması"
                       basis="Sözleşmenin ifası (m.5/2-c); meşru menfaat (m.5/2-f)" />
              <Purpose title="Bildirim ve hizmet e-postaları (doğrulama, şifre sıfırlama, başvuru durumu)"
                       basis="Sözleşmenin ifası (m.5/2-c)" />
              <Purpose title="Kötüye kullanımın önlenmesi, şikâyetlerin incelenmesi, platform güvenliği"
                       basis="Meşru menfaat (m.5/2-f); bir hakkın tesisi, kullanılması veya korunması (m.5/2-e)" />
              <Purpose title="Mevzuattan doğan kayıt tutma ve yetkili mercilere bilgi verme"
                       basis="Kanunlarda açıkça öngörülme ve hukuki yükümlülük (m.5/2-a, m.5/2-ç)" />
            </ul>
          </Section>

          <Section title="4. Toplama Yöntemi">
            <p>
              Veriler; kayıt ve profil formları, ilan ve başvuru ekranları, sohbet, vardiya
              giriş-çıkış işlemi ve Google ile giriş seçildiğinde Google'dan alınan ad ve e-posta
              aracılığıyla, elektronik ortamda ve otomatik yollarla toplanır.
            </p>
          </Section>

          <Section title="5. Veri Paylaşımı">
            <p>
              Bir ilana başvurduğunda <b>adın, e-posta adresin ve profil bilgilerin</b> (deneyim, tercihler)
              ile başvuru verilerin (ön yazı, seçtiğin vardiyalar) o ilanı veren işletmeyle paylaşılır.
              Telefon numaran, mahallen ve doğum tarihin gibi bilgiler yalnızca başvurunu <b>kabul eden</b> işletmeye açılır;
              kabul edildiğin vardiyalar için adın, telefonun ve giriş-çıkış saatlerin o işletmenin ekip listesinde yer alır.
            </p>
            <p className="mt-3">
              <b>Sohbet ekleri</b> yalnızca o sohbetin iki tarafınca görüntülenebilir; herkese açık bir bağlantıyla paylaşılmaz.
            </p>
            <p className="mt-3">Hizmetin işletilmesi için veriler şu hizmet sağlayıcılara aktarılır:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><b>Barındırma:</b> Uygulama sunucusu ve veritabanı Türkiye'de barındırılır.</li>
              <li><b>Cloudinary:</b> Profil fotoğrafı, işletme logosu ve galeri görsellerinin depolanması ve gösterimi.</li>
              <li><b>Google:</b> Yalnız "Google ile devam et" seçildiğinde kimlik doğrulama.</li>
              <li><b>E-posta gönderim sağlayıcısı</b> <Fill>[Sağlayıcı adı]</Fill>: doğrulama, şifre sıfırlama ve bildirim e-postaları.</li>
            </ul>
            <p className="mt-3">
              Yetkili kamu kurum ve kuruluşlarının hukuken yetkili olduğu taleplerinde veriler bu
              kurumlarla paylaşılabilir. Veriler üçüncü taraflarla pazarlama amacıyla paylaşılmaz.
            </p>
          </Section>

          <Section title="6. Yurt Dışına Aktarım">
            <p>
              Cloudinary, Google ve e-posta gönderim sağlayıcısının sunucuları yurt dışında
              bulunabilir. Bu aktarımlar KVKK m.9 kapsamında yapılır:
            </p>
            <p className="mt-2"><Fill>[Aktarımın dayanağı: ör. Kurul'a bildirilen standart sözleşme; sağlayıcı bazında ülke bilgisi]</Fill></p>
          </Section>

          <Section title="7. Saklama Süreleri">
            <ul className="list-disc pl-5 space-y-1.5">
              <li><b>Hesap ve profil bilgileri:</b> Hesap açık olduğu sürece; hesap kapatılınca <Fill>[süre]</Fill> içinde silinir veya anonim hale getirilir.</li>
              <li><b>Başvuru, vardiya ve giriş-çıkış kayıtları:</b> <Fill>[süre]</Fill></li>
              <li><b>Sohbet mesajları ve ekleri:</b> <Fill>[süre]</Fill></li>
              <li><b>İşlem güvenliği kayıtları (IP, oturum):</b> <Fill>[süre]</Fill></li>
            </ul>
            <p className="mt-3">
              Süre dolduğunda veya işleme sebebi ortadan kalktığında veriler silinir, yok edilir ya da
              anonim hale getirilir.
            </p>
          </Section>

          <Section title="8. Çerezler">
            <p>
              Yalnızca zorunlu çerezler ve tarayıcı kaydı kullanılır: oturumun açık kalması, güvenlik ve
              dil/görünüm tercihlerin. Analitik, reklam veya takip çerezi kullanılmaz.
            </p>
          </Section>

          <Section title="9. KVKK m.11 Kapsamındaki Hakların">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Kişisel verilerinin işlenip işlenmediğini öğrenme</li>
              <li>İşlenmişse buna ilişkin bilgi talep etme</li>
              <li>İşlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme</li>
              <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
              <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
              <li>KVKK m.7'de öngörülen şartlar çerçevesinde silinmesini veya yok edilmesini isteme</li>
              <li>Düzeltme, silme veya yok etme işlemlerinin verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme</li>
              <li>Münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhine bir sonuç çıkmasına itiraz etme</li>
              <li>Kanuna aykırı işleme sebebiyle zarara uğraman halinde zararın giderilmesini talep etme</li>
            </ul>
          </Section>

          <Section title="10. Başvuru Yolu">
            <p>
              Haklarına ilişkin taleplerini, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında
              Tebliğ'e uygun olarak yazılı şekilde <Fill>[Adres]</Fill> adresine ya da{' '}
              <Fill>[KEP/e-posta]</Fill> adresine iletebilirsin. Başvurunda adını, soyadını, iletişim
              bilgini ve talebini açıkça belirtmen yeterlidir.
            </p>
            <p className="mt-3">
              Talebin en geç <b>30 gün</b> içinde ücretsiz olarak sonuçlandırılır. Yanıtı yeterli
              bulmazsan Kişisel Verileri Koruma Kurulu'na şikâyette bulunabilirsin.
            </p>
            <p className="mt-3">
              Hesabını ve verilerini panelindeki hesap ayarlarından da kapatabilirsin.
            </p>
          </Section>
        </div>

        <footer className="mt-10 pt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
             style={{ borderTop: '1px solid var(--ah-line)' }}>
          <p className="type-caption">
            Hizmet koşulları için{' '}
            <Link to={TERMS_PATH} className="font-semibold underline underline-offset-2" style={{ color: 'var(--ah-ink-2)' }}>
              Kullanım Şartları
            </Link>
            'na bakabilirsin.
          </p>
          <Link to="/register" className="btn-secondary !w-auto">
            Kayıt sayfasına dön
          </Link>
        </footer>
      </article>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="type-section mb-3" style={{ color: 'var(--ah-ink)' }}>
        {title}
      </h2>
      <div style={{ color: 'var(--ah-ink-2)' }}>
        {children}
      </div>
    </section>
  )
}

/** Amaç + hukuki sebep satırı */
function Purpose({ title, basis }) {
  return (
    <li className="rounded-lg px-4 py-3" style={{ background: 'var(--ah-band)', border: '1px solid var(--ah-line)' }}>
      <div className="font-semibold" style={{ color: 'var(--ah-ink)' }}>{title}</div>
      <div className="type-meta mt-0.5">Hukuki sebep: {basis}</div>
    </li>
  )
}

/** Şirket bilgisiyle doldurulacak yer tutucu (uydurma bilgi yazılmaz) */
function Fill({ children }) {
  return (
    <span data-placeholder="true" className="px-1 rounded"
          style={{ background: 'var(--ah-warn-soft)', color: 'var(--ah-ink)' }}>
      {children}
    </span>
  )
}
