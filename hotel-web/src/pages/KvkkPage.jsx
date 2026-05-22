import { Link } from 'react-router-dom'

export default function KvkkPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white text-slate-800 rounded-2xl shadow-xl p-8 sm:p-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Kişisel Verilerin Korunması Aydınlatma Metni
          </h1>
          <Link to="/login" className="text-sm text-violet-600 hover:text-violet-700 font-medium">
            ← Geri
          </Link>
        </div>

        <p className="text-sm text-slate-500 mb-6">
          Son güncelleme: 22 Mayıs 2026
        </p>

        <div className="space-y-5 text-sm leading-relaxed text-slate-700">
          <section>
            <h2 className="font-semibold text-base text-slate-900 mb-2">1. Veri Sorumlusu</h2>
            <p>
              AjansHotel platformunun (bundan sonra "Platform") veri sorumlusu, platformu işleten
              kişi/kurumdur. Platform, otel ve aday arasında iş eşleştirmesi yapan bir çevrimiçi
              hizmettir.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base text-slate-900 mb-2">2. Toplanan Kişisel Veriler</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><b>Kimlik bilgileri:</b> Ad, soyad, doğum tarihi, cinsiyet (opsiyonel)</li>
              <li><b>İletişim bilgileri:</b> E-posta, telefon, adres, ilçe</li>
              <li><b>Eğitim ve deneyim:</b> Eğitim durumu, önceki iş tecrübesi (aday)</li>
              <li><b>Belgeler:</b> CV, transkript, adli sicil, sağlık raporu, kimlik fotokopisi (aday)</li>
              <li><b>İşletme bilgileri:</b> Ad, tür, lokasyon, açıklama, logo, galeri fotoğrafları (işletme)</li>
              <li><b>Başvuru verileri:</b> İlan, ön yazı, müsaitlik, başvuru durumu</li>
              <li><b>Teknik veriler:</b> IP adresi, oturum tokeni, kullanım istatistikleri</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-base text-slate-900 mb-2">3. İşleme Amaçları</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Platform üyelik ve kimlik doğrulama</li>
              <li>İş ilanı oluşturma, başvuru alma ve süreç yönetimi</li>
              <li>Aday ile işletme arasında bilgi paylaşımı (izninle)</li>
              <li>Platform güvenliği ve kötüye kullanım önleme</li>
              <li>Yasal yükümlülükler çerçevesinde kayıt tutma</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-base text-slate-900 mb-2">4. Hukuki Sebep</h2>
            <p>
              Verileriniz, KVKK m.5/2 uyarınca bir sözleşmenin kurulması ve ifası için zorunlu olması,
              meşru menfaat kapsamında ve açık rızanız ile işlenmektedir.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base text-slate-900 mb-2">5. Veri Paylaşımı</h2>
            <p>
              <b>Hassas belgeler</b> (adli sicil, sağlık raporu, kimlik) yalnızca senin açık iznin ile,
              başvurduğun işletmenin görüntülemesine açılır. Açık belgeler (CV, transkript, öğrenci belgesi)
              ilan başvurusu kapsamında işletmeyle paylaşılır.
            </p>
            <p className="mt-2">
              Verileriniz üçüncü taraflarla pazarlama amacıyla paylaşılmaz.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base text-slate-900 mb-2">6. KVKK Madde 11 Hakları</h2>
            <p>Aşağıdaki haklara sahipsiniz:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
              <li>İşlenmişse buna ilişkin bilgi talep etme</li>
              <li>Yanlış işlenmişse düzeltilmesini, eksiksiz olarak işlenmesini isteme</li>
              <li>Silinmesini veya yok edilmesini talep etme</li>
              <li>Otomatik analizi ile aleyhe sonuç doğmasına itiraz etme</li>
              <li>Kanuna aykırı işleme nedeniyle zarara uğramışsanız tazminat talep etme</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-base text-slate-900 mb-2">7. İletişim</h2>
            <p>
              KVKK kapsamındaki taleplerinizi platformun destek e-posta adresine iletebilirsiniz.
              Talebiniz en geç <b>30 gün</b> içinde değerlendirilir.
            </p>
          </section>

          <section className="bg-violet-50 rounded-lg p-4 text-violet-900 border border-violet-200">
            <p className="font-medium">
              Platforma kayıt olarak bu aydınlatma metnini okuduğunuzu ve verilerinizin yukarıda
              belirtilen amaçlarla işlenmesine açık rıza verdiğinizi kabul edersiniz.
            </p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200 text-center">
          <Link to="/register" className="text-sm font-semibold text-violet-600 hover:text-violet-700">
            Kayıt sayfasına dön →
          </Link>
        </div>
      </div>
    </div>
  )
}
